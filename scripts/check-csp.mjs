#!/usr/bin/env node
/**
 * check-csp.mjs — Post-build Chrome MV3 CSP regression guard.
 *
 * Walks the build output (`apps/extension/dist`) and fails the build with
 * exit code 1 if any JavaScript artefact contains a Content Security Policy
 * violator that would crash an MV3 extension at runtime.
 *
 * Patterns checked:
 *   - new Function(...)
 *   - bare Function("...", ...) constructor call
 *   - bare eval(...) invocation
 *   - setTimeout / setInterval with string first argument
 *
 * Why: an inadvertent dependency upgrade or a misconfigured tree-shake can
 * silently reintroduce dynamic code generation. Loading such a build into
 * Chrome produces the cryptic `Refused to evaluate a string as JavaScript`
 * error at first use. This script catches the regression at build time,
 * before the .crx is packaged.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, "..", "..");
// Allow callers to scan an arbitrary output dir (e.g. `dist-firefox/`)
// while defaulting to the Chromium build path. Accepts:
//   node scripts/check-csp.mjs                     → apps/extension/dist
//   node scripts/check-csp.mjs dist-firefox        → apps/extension/dist-firefox
//   node scripts/check-csp.mjs /abs/path/to/build  → absolute path
const TARGET_ARG = process.argv[2];
const DIST = TARGET_ARG
  ? (TARGET_ARG.startsWith("/")
      ? TARGET_ARG
      : join(ROOT, "apps", "extension", TARGET_ARG))
  : join(ROOT, "apps", "extension", "dist");

const PATTERNS = [
  { label: "new Function(...)", regex: /new\s+Function\s*\(/g },
  { label: "bare eval(...)", regex: /(^|[^.\w$])eval\s*\(/g },
  {
    label: "Function(string) constructor",
    regex: /(^|[^.\w$])Function\s*\(\s*["'`]/g,
  },
  {
    label: "setTimeout(string,...)",
    regex: /setTimeout\s*\(\s*["'`]/g,
  },
  {
    label: "setInterval(string,...)",
    regex: /setInterval\s*\(\s*["'`]/g,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

let violations = 0;
const scanned = [];

for (const file of walk(DIST)) {
  if (!/\.(js|mjs|cjs)$/.test(file)) continue;
  const rel = relative(ROOT, file);
  scanned.push(rel);
  const text = readFileSync(file, "utf8");
  for (const { label, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      violations++;
      const line = lineOf(text, m.index);
      const snippet = text
        .slice(Math.max(0, m.index - 20), m.index + 60)
        .replace(/\s+/g, " ");
      console.error(
        `\u001b[31m✗ CSP violation\u001b[0m ${rel}:${line}  ` +
          `[${label}]  …${snippet}…`,
      );
    }
  }
}

console.log(
  `\n[check-csp] scanned ${scanned.length} JS file(s) under ${relative(ROOT, DIST)}`,
);

if (violations > 0) {
  console.error(
    `\n\u001b[41m\u001b[37m FAIL \u001b[0m ${violations} Chrome MV3 CSP violation(s) detected in build output.\n` +
      `         Chrome will refuse to execute this extension under \`script-src 'self'\`.\n` +
      `         Inspect the listed files and either alias the offending dependency\n` +
      `         (see src/lib/ajv-shim.js) or extend scripts/vite-csp-strip.mjs.\n`,
  );
  process.exit(1);
}

console.log("\u001b[32m✓ CSP clean — no dynamic code generation found.\u001b[0m");
