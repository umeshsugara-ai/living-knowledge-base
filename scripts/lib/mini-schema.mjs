/**
 * scripts/lib/mini-schema.mjs — a small dependency-free validator for the JSON Schema
 * Draft 2020-12 subset this repo's *.schema.json files actually use: type, enum, pattern,
 * minLength, required, properties, items, additionalProperties, allOf[{if,then}].
 *
 * Why this exists instead of `ajv`: no JS schema-validator package is in package.json yet
 * (T-016/T-017 never needed one — `schema/validate.py` + `jsonschema` is the cross-collection
 * authority, proven by every collection's fixture pair). Adding a dependency for one caller
 * would be the "fork a second validator" the contract forbids in spirit; this reads the SAME
 * schema/*.schema.json file at runtime (no hand-copied field list) so the schema stays the one
 * definition — this module is just a small interpreter for it, not an independent shape.
 *
 * Not a general JSON Schema engine — only the keywords above are implemented. Extend here if a
 * future *.schema.json needs another keyword; do not hand-roll a parallel check elsewhere.
 */

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function checkType(schema, value, path, errors) {
  if (schema.type === undefined) return;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (!types.includes(typeOf(value))) {
    errors.push(`${path}: expected type ${types.join("|")}, got ${typeOf(value)}`);
  }
}

function checkObject(schema, value, path, errors) {
  if (typeOf(value) !== "object") return;
  for (const key of schema.required ?? []) {
    if (!(key in value)) errors.push(`${path}: missing required property '${key}'`);
  }
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    if (key in value) validate(sub, value[key], `${path}.${key}`, errors);
  }
}

function matches(schema, value) {
  const errors = [];
  validate(schema, value, "$", errors);
  return errors.length === 0;
}

/** Recursive validator. Mutates `errors` with human-readable messages; returns nothing. */
export function validate(schema, value, path = "$", errors = []) {
  checkType(schema, value, path, errors);
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value '${value}' not in enum [${schema.enum.join(", ")}]`);
  }
  if (schema.pattern && typeOf(value) === "string" && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${path}: '${value}' does not match pattern ${schema.pattern}`);
  }
  if (schema.minLength !== undefined && typeOf(value) === "string" && value.length < schema.minLength) {
    errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
  }
  if (typeOf(value) === "object") checkObject(schema, value, path, errors);
  if (typeOf(value) === "array" && schema.items) {
    value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`, errors));
  }
  for (const clause of schema.allOf ?? []) {
    if (!clause.if || matches(clause.if, value)) {
      // "if" absent = unconditional branch of allOf; "if" present and matching = apply "then"
      if (clause.then) validate(clause.then, value, path, errors);
    }
  }
  return errors;
}

/** Convenience wrapper: returns { valid, errors }. */
export function validateDoc(schema, doc) {
  const errors = validate(schema, doc, "$", []);
  return { valid: errors.length === 0, errors };
}
