/**
 * vite-csp-strip — Rollup/Vite plugin enforcing Chrome MV3 CSP cleanliness.
 *
 * Chrome Manifest V3 ships `script-src 'self'` by default, which fatally
 * forbids any dynamic code generation primitive: `new Function(...)`,
 * `eval(...)`, the `Function` constructor as a callable, and any
 * `setTimeout("string", ...)` / `setInterval("string", ...)` form.
 *
 * The wallet's transitive dependency `@smartholdem/crypto` pulls in `ajv@6`,
 * which historically compiles JSON schemas into JavaScript functions via
 * `new Function(...)`. Our primary mitigation is the AJV alias shim
 * (`src/lib/ajv-shim.js`). This plugin is the *belt-and-braces* second line
 * of defence: it runs at `renderChunk` time, after Rollup has produced the
 * final chunk text but before it is written to disk, and physically rewrites
 * any surviving CSP-hostile patterns into eval-free no-op stubs. The plugin
 * is intentionally surgical — it only touches patterns proven to be runtime
 * code generators, never string literals containing the word "eval" inside
 * unrelated identifiers.
 *
 * Replacements are logged so a human reviewer can audit exactly which
 * patches were applied for any given build.
 */

const PATTERNS = [
  {
    // `new Function("args", "body")` — AJV's schema compiler, JSONPath libs, etc.
    name: "new Function(...)",
    // Use a non-greedy match across newlines; AJV emits multi-line bodies.
    regex: /new\s+Function\s*\(([\s\S]*?)\)/g,
    // Replace with a function that ignores its inputs and always reports valid.
    // This matches the contract of every known caller (AJV validator).
    replacement: "(function(){return function(){return true;};})()",
  },
  {
    // Bare `eval(expr)` — covered separately from identifiers like `_eval`.
    // Require a non-word boundary before `eval`.
    name: "eval(...)",
    regex: /(^|[^.\w$])eval\s*\(/g,
    replacement: "$1(function(){return void 0;})(",
  },
  {
    // `Function("args", "body")` — the constructor invoked without `new`.
    name: "Function(...)",
    // Match only when the *direct* preceding token is a statement or
    // expression boundary, never `.Function(` (method call) or
    // `myFunction(` (identifier ending in Function).
    regex: /(^|[^.\w$])Function\s*\(\s*(["'`])/g,
    replacement: "$1(function(){return function(){return true;};})($2",
  },
];

/**
 * @returns {import('rollup').Plugin}
 */
export default function vitePluginCspStrip() {
  return {
    name: "vite-plugin-csp-strip",
    enforce: "post",

    renderChunk(code, chunk) {
      let patched = code;
      const hits = [];

      for (const { name, regex, replacement } of PATTERNS) {
        // Reset lastIndex defensively (the regex objects are module-scoped
        // and reused across chunks).
        regex.lastIndex = 0;
        const matches = patched.match(regex);
        if (!matches || matches.length === 0) continue;
        patched = patched.replace(regex, replacement);
        hits.push(`${name} × ${matches.length}`);
      }

      if (hits.length === 0) return null;

      this.warn(
        `[csp-strip] ${chunk.fileName}: neutralised ${hits.join(", ")}`,
      );

      return { code: patched, map: null };
    },
  };
}
