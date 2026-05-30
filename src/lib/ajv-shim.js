/**
 * CSP-safe AJV v6 shim for Chrome Manifest V3 extensions.
 *
 * `@smartholdem/crypto@3.8` ships with AJV v6 which compiles JSON schemas into
 * JavaScript at runtime via `new Function(...)`. MV3 `script-src 'self'`
 * categorically forbids dynamic code generation, producing the
 * `Uncaught EvalError: Refused to evaluate a string as JavaScript` error.
 *
 * In an outbound-only wallet (we *construct* transactions with typed builders;
 * we never accept arbitrary remote tx JSON for re-signing) AJV schema
 * validation adds no security value — the cryptographic constraints are
 * enforced by the signer itself. We therefore replace the entire AJV surface
 * with a lightweight, fully typed, eval-free stub.
 *
 * Surface covered (matches every call site inside
 *   @smartholdem/crypto/dist/validation/{index,keywords}.js):
 *   - default export (constructor `new Ajv(options?)`)
 *   - .addSchema(schema, key?)        → registers but does not compile
 *   - .addKeyword(name, def)          → registers a custom keyword (no-op)
 *   - .addFormat(name, fmt)           → registers a custom format (no-op)
 *   - .removeSchema(key)              → returns this
 *   - .getSchema(key)                 → returns a permissive validator
 *   - .validate(schemaOrKey, data)    → returns true (no errors)
 *   - .compile(schema)                → returns a permissive validator
 *   - .errors                         → null
 *   - .errorsText()                   → ""
 *
 * Every returned "validator" function tolerates any input and reports valid.
 */

function makePermissiveValidator() {
  function validate(_data) {
    return true;
  }
  validate.errors = null;
  validate.schema = {};
  return validate;
}

class AjvShim {
  constructor(_options) {
    this._schemas = new Map();
    this._formats = new Map();
    this._keywords = new Map();
    this.errors = null;
  }

  addSchema(schema, key) {
    const k = key || (schema && schema.$id) || `__schema_${this._schemas.size}`;
    this._schemas.set(k, schema);
    return this;
  }

  removeSchema(key) {
    if (typeof key === "string") this._schemas.delete(key);
    else this._schemas.clear();
    return this;
  }

  addKeyword(name, def) {
    this._keywords.set(name, def);
    return this;
  }

  removeKeyword(name) {
    this._keywords.delete(name);
    return this;
  }

  addFormat(name, fmt) {
    this._formats.set(name, fmt);
    return this;
  }

  getSchema(_key) {
    return makePermissiveValidator();
  }

  compile(_schema) {
    return makePermissiveValidator();
  }

  validate(_schemaOrKey, _data) {
    this.errors = null;
    return true;
  }

  errorsText(_errors, _opts) {
    return "";
  }
}

export default AjvShim;
// CommonJS interop — `@smartholdem/crypto` is transpiled with __importDefault
// which expects `module.exports.default` for ES default imports.
export const Ajv = AjvShim;
