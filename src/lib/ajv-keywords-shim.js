/**
 * CSP-safe `ajv-keywords` shim.
 *
 * The real package's public surface (v3.x, used transitively by
 * `@smartholdem/crypto`):
 *
 *   const keywords = require('ajv-keywords');
 *   keywords(ajv, ['instanceof', 'range']);   // bulk register (function call)
 *   keywords.get('range');                     // fetch a single definition
 *   keywords.keywords;                         // string[] of supported names
 *
 * Since our `ajv-shim` performs no actual compilation, every keyword macro
 * is a no-op. We therefore return a keyword definition whose `compile`
 * (and legacy `validate`) hook is a permissive validator. This satisfies
 * `Ajv.addKeyword(name, def)` contract without touching `new Function(...)`.
 */

function noopValidator() {
  return true;
}

// Shared, mutable `CONSTRUCTORS` registry for the `instanceof` keyword.
// `@smartholdem/crypto` (validation/keywords.js:68) mutates this map at
// import time:
//   `ajv_keywords.default.get("instanceof").definition.CONSTRUCTORS.BigNumber = …`
// Keeping it module-scoped means every consumer sees the same object.
const INSTANCEOF_CONSTRUCTORS = {};

function makeKeywordDef(name) {
  const def = {
    // AJV v6 keyword definition shape; every field is no-op-safe.
    type: ["number", "string", "array", "object", "boolean", "null"],
    errors: false,
    metaSchema: { type: "object" },
    compile() {
      return noopValidator;
    },
    validate: noopValidator,
  };
  // Only the `instanceof` keyword module exposes a `CONSTRUCTORS` map,
  // but attaching it unconditionally is harmless and future-proofs other
  // libraries that probe `.definition.CONSTRUCTORS`.
  if (name === "instanceof") {
    def.CONSTRUCTORS = INSTANCEOF_CONSTRUCTORS;
  }
  return def;
}

/**
 * Replica of the real `ajv-keywords` "keyword module" shape:
 *   { definition: <AJV addKeyword def>, … }
 * AJV core resolves a keyword via `require('ajv-keywords/keywords/<name>')`
 * but the higher-level helper is `ajvKeywords.get(name)` — both must yield
 * the same object so that `.definition.CONSTRUCTORS` mutations stick.
 */
function makeKeywordModule(name) {
  return { definition: makeKeywordDef(name) };
}

// Module-level keyword catalogue — kept in sync with the names the real
// `ajv-keywords@3` package ships, so any consumer iterating over
// `.keywords` sees the expected list.
const SUPPORTED_KEYWORDS = [
  "typeof",
  "instanceof",
  "range",
  "exclusiveRange",
  "regexp",
  "transform",
  "uniqueItemProperties",
  "allRequired",
  "anyRequired",
  "oneRequired",
  "prohibited",
  "deepProperties",
  "deepRequired",
  "formatMinimum",
  "formatMaximum",
  "patternRequired",
  "switch",
  "select",
  "dynamicDefaults",
];

function ajvKeywordsShim(ajv, keywordList) {
  if (!ajv) return ajvKeywordsShim;
  const list = Array.isArray(keywordList) ? keywordList : SUPPORTED_KEYWORDS;
  for (const name of list) {
    if (typeof ajv.addKeyword === "function") {
      try {
        ajv.addKeyword(name, makeKeywordDef(name));
      } catch (_e) {
        /* duplicate-add — swallowed silently as in the real lib */
      }
    }
  }
  return ajv;
}

// `.get(name)` — used by `@smartholdem/crypto` and AJV core when a schema
// references a keyword that hasn't been bulk-registered yet. The return
// value must be a *module* (`{ definition: … }`), not a bare definition,
// so callers can do `.get('instanceof').definition.CONSTRUCTORS.X = Y`.
ajvKeywordsShim.get = function get(name) {
  return makeKeywordModule(name);
};

// `.keywords` — exposed by the real package as a `string[]`.
ajvKeywordsShim.keywords = SUPPORTED_KEYWORDS.slice();

export default ajvKeywordsShim;
export const get = ajvKeywordsShim.get;
export const keywords = ajvKeywordsShim.keywords;
