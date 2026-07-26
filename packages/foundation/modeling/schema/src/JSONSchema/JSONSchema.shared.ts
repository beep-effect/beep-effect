/**
 * Shared identity, leaf schemas, and named checks for the {@link JSONSchema}
 * structured model of JSON Schema draft-2020-12 documents.
 *
 * Everything here is dialect-locked to draft-2020-12: leaf constraints carry
 * the spec-MUST invariants (non-negative counts, positive `multipleOf`, anchor
 * grammar, URI-reference syntax) so that invalid keyword values are
 * unrepresentable, and every constrained leaf ships a `toArbitrary` annotation
 * so schema-derived generation always satisfies its own checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";

/**
 * Identity composer for every schema in the JSONSchema module.
 *
 * @example
 * ```ts
 * import { $SchemaId } from "@beep/identity/packages"
 *
 * const $I = $SchemaId.create("JSONSchema")
 * console.log($I`Node`)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const $I = $SchemaId.create("JSONSchema");

/**
 * Every keyword the {@link Node} model treats as first-class draft-2020-12
 * vocabulary. Wire keys outside this set are preserved verbatim in the
 * node's `extensions` bag rather than dropped or rejected.
 *
 * @example
 * ```ts
 * import { CanonicalKeyword } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const keyword = S.decodeUnknownResult(CanonicalKeyword)("properties")
 * console.log(keyword._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CanonicalKeyword = LiteralKit([
  "$anchor",
  "$comment",
  "$defs",
  "$dynamicAnchor",
  "$dynamicRef",
  "$id",
  "$ref",
  "$schema",
  "$vocabulary",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "contains",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
  "default",
  "dependentRequired",
  "dependentSchemas",
  "deprecated",
  "description",
  "else",
  "enum",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "if",
  "items",
  "maxContains",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minContains",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "not",
  "oneOf",
  "pattern",
  "patternProperties",
  "prefixItems",
  "properties",
  "propertyNames",
  "readOnly",
  "required",
  "then",
  "title",
  "type",
  "unevaluatedItems",
  "unevaluatedProperties",
  "uniqueItems",
  "writeOnly",
]).pipe(
  $I.annoteSchema("CanonicalKeyword", {
    description: "A first-class draft-2020-12 keyword recognized by the JSONSchema node model.",
  })
);

/**
 * Type for {@link CanonicalKeyword}.
 *
 * @example
 * ```ts
 * import type { CanonicalKeyword } from "@beep/schema/JSONSchema"
 *
 * const keyword: CanonicalKeyword = "properties"
 * console.log(keyword)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CanonicalKeyword = typeof CanonicalKeyword.Type;

/**
 * Guard for {@link CanonicalKeyword}.
 *
 * @example
 * ```ts
 * import { isCanonicalKeyword } from "@beep/schema/JSONSchema"
 *
 * console.log(isCanonicalKeyword("properties"))
 * console.log(isCanonicalKeyword("x-vendor"))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCanonicalKeyword = S.is(CanonicalKeyword);

/**
 * The seven draft-2020-12 primitive type names accepted by the `type` keyword.
 *
 * @example
 * ```ts
 * import { TypeName } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const name = S.decodeUnknownResult(TypeName)("string")
 * console.log(name._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypeName = LiteralKit(["array", "boolean", "integer", "null", "number", "object", "string"]).pipe(
  $I.annoteSchema("TypeName", {
    description: "A draft-2020-12 primitive type name.",
  })
);

/**
 * Type for {@link TypeName}.
 *
 * @example
 * ```ts
 * import type { TypeName } from "@beep/schema/JSONSchema"
 *
 * const name: TypeName = "string"
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypeName = typeof TypeName.Type;

const TypeNameListUniqueCheck = S.isUnique({
  identifier: $I`TypeNameListUniqueCheck`,
  title: "Unique type names",
  description: "The array form of the `type` keyword must not repeat type names.",
  message: "type array entries must be unique",
});

/**
 * The array form of the `type` keyword: a non-empty array of unique
 * {@link TypeName} values, per the draft-2020-12 meta-schema
 * (`minItems: 1, uniqueItems: true`).
 *
 * @example
 * ```ts
 * import { TypeNameList } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const names = S.decodeUnknownResult(TypeNameList)(["string", "null"])
 * console.log(names._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypeNameList = S.NonEmptyArray(TypeName)
  .check(TypeNameListUniqueCheck)
  .pipe(
    $I.annoteSchema("TypeNameList", {
      description: "Non-empty array of unique draft-2020-12 type names.",
    })
  );

/**
 * Type for {@link TypeNameList}.
 *
 * @example
 * ```ts
 * import type { TypeNameList } from "@beep/schema/JSONSchema"
 *
 * const names: TypeNameList = ["string", "null"]
 * console.log(names.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypeNameList = typeof TypeNameList.Type;

/**
 * The full value space of the `type` keyword: a single {@link TypeName} or a
 * non-empty unique {@link TypeNameList}.
 *
 * @example
 * ```ts
 * import { Types } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const single = S.decodeUnknownResult(Types)("object")
 * const many = S.decodeUnknownResult(Types)(["string", "null"])
 * console.log(single._tag, many._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Types = S.Union([TypeName, TypeNameList]).pipe(
  $I.annoteSchema("Types", {
    description: "The `type` keyword value: one type name or a non-empty unique array of type names.",
  })
);

/**
 * Type for {@link Types}.
 *
 * @example
 * ```ts
 * import type { Types } from "@beep/schema/JSONSchema"
 *
 * const single: Types = "object"
 * const many: Types = ["string", "null"]
 * console.log(single, many)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Types = typeof Types.Type;

const NonNegativeCountCheck = S.isGreaterThanOrEqualTo(0, {
  identifier: $I`NonNegativeCountCheck`,
  title: "Non-negative count",
  description: "Draft-2020-12 count bounds must be non-negative integers.",
  message: "must be a non-negative integer",
});

/**
 * A non-negative integer, the value space the spec mandates for every count
 * bound (`maxLength`, `minItems`, `maxContains`, `minProperties`, ...).
 *
 * @example
 * ```ts
 * import { NonNegativeCount } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const count = S.decodeUnknownResult(NonNegativeCount)(3)
 * console.log(count._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NonNegativeCount = S.Int.check(NonNegativeCountCheck).pipe(
  $I.annoteSchema("NonNegativeCount", {
    description: "Non-negative integer count bound.",
    toArbitrary: () => (fc) => fc.integer({ min: 0, max: 1000 }),
  })
);

/**
 * Type for {@link NonNegativeCount}.
 *
 * @example
 * ```ts
 * import type { NonNegativeCount } from "@beep/schema/JSONSchema"
 *
 * const maxItems: NonNegativeCount = 3
 * console.log(maxItems)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonNegativeCount = typeof NonNegativeCount.Type;

const PositiveNumberCheck = S.isGreaterThan(0, {
  identifier: $I`PositiveNumberCheck`,
  title: "Strictly positive",
  description: "The `multipleOf` keyword value must be strictly greater than zero.",
  message: "must be strictly greater than 0",
});

/**
 * A finite number strictly greater than zero — the spec-mandated value space
 * of `multipleOf`.
 *
 * @example
 * ```ts
 * import { PositiveNumber } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const step = S.decodeUnknownResult(PositiveNumber)(0.5)
 * console.log(step._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PositiveNumber = S.Finite.check(PositiveNumberCheck).pipe(
  $I.annoteSchema("PositiveNumber", {
    description: "Finite number strictly greater than zero.",
    toArbitrary: () => (fc) => fc.oneof(fc.integer({ min: 1, max: 1000 }), fc.constantFrom(0.5, 0.25, 1.5, 10)),
  })
);

/**
 * Type for {@link PositiveNumber}.
 *
 * @example
 * ```ts
 * import type { PositiveNumber } from "@beep/schema/JSONSchema"
 *
 * const step: PositiveNumber = 0.5
 * console.log(step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PositiveNumber = typeof PositiveNumber.Type;

const compilesAsRegExp = (value: string): boolean => {
  try {
    new RegExp(value, "u");
    return true;
  } catch {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }
};

const RegexCompilesCheck = S.makeFilter<string>(
  (value) => compilesAsRegExp(value) || "must be a valid ECMA-262 regular expression",
  {
    identifier: $I`RegexCompilesCheck`,
    title: "Valid ECMA-262 regular expression",
    description: "The `pattern` keyword and `patternProperties` keys should hold compilable regular expressions.",
  }
);

/**
 * Record-level check requiring every key to compile as an ECMA-262 regular
 * expression — the `patternProperties` key space. Enforced on the record
 * itself because this effect version does not apply key-schema checks inside
 * `S.Record`.
 *
 * @example
 * ```ts
 * import * as R from "effect/Record"
 * import * as S from "effect/Schema"
 *
 * const compiles = (key: string): boolean => {
 *   try {
 *     new RegExp(key)
 *     return true
 *   } catch {
 *     return false
 *   }
 * }
 * const RegexKeys = S.makeFilter<{ readonly [key: string]: unknown }>(
 *   (record) => R.keys(record).every(compiles) || "keys must be valid ECMA-262 regular expressions"
 * )
 * const PatternProperties = S.Record(S.String, S.Unknown).check(RegexKeys)
 * console.log(S.decodeUnknownResult(PatternProperties)({ "^[a-z]+$": true })._tag)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const RegexKeysCheck = S.makeFilter<{ readonly [key: string]: unknown }>(
  (record) => {
    const invalid = R.keys(record).filter((key) => !compilesAsRegExp(key));
    return invalid.length === 0 || `keys must be valid ECMA-262 regular expressions: ${invalid.join(", ")}`;
  },
  {
    identifier: $I`RegexKeysCheck`,
    title: "Regex-keyed record",
    description: "Every `patternProperties` key must compile as an ECMA-262 regular expression.",
  }
);

const safeRegexSources = [
  "^$",
  ".*",
  "^[a-z]+$",
  "^[0-9]{1,3}$",
  "^[A-Za-z_][A-Za-z0-9_]*$",
  "^x-",
  "a|b",
  "^\\d+(\\.\\d+)?$",
] as const;

/**
 * A string that compiles as an ECMA-262 regular expression — the value space
 * of `pattern` and the key space of `patternProperties`. Kept as a string
 * rather than transformed to `RegExp` so schema equivalence stays structural.
 *
 * @example
 * ```ts
 * import { RegexPatternString } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const pattern = S.decodeUnknownResult(RegexPatternString)("^[a-z]+$")
 * console.log(pattern._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RegexPatternString = S.String.check(RegexCompilesCheck).pipe(
  $I.annoteSchema("RegexPatternString", {
    description: "ECMA-262-compilable regular expression source.",
    toArbitrary: () => (fc) => fc.constantFrom(...safeRegexSources),
  })
);

/**
 * Type for {@link RegexPatternString}.
 *
 * @example
 * ```ts
 * import type { RegexPatternString } from "@beep/schema/JSONSchema"
 *
 * const pattern: RegexPatternString = "^[a-z]+$"
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RegexPatternString = typeof RegexPatternString.Type;

const anchorNamePattern = /^[A-Za-z_][-A-Za-z0-9._]*$/;

const AnchorNameCheck = S.isPattern(anchorNamePattern, {
  identifier: $I`AnchorNameCheck`,
  title: "Anchor name grammar",
  description: "Draft-2020-12 `$anchor`/`$dynamicAnchor` values must match ^[A-Za-z_][-A-Za-z0-9._]*$.",
  message: "must match ^[A-Za-z_][-A-Za-z0-9._]*$",
});

/**
 * A plain-name fragment for `$anchor` and `$dynamicAnchor`, constrained to the
 * grammar the draft-2020-12 core spec mandates.
 *
 * @example
 * ```ts
 * import { AnchorName } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const anchor = S.decodeUnknownResult(AnchorName)("node")
 * console.log(anchor._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnchorName = S.String.check(AnchorNameCheck).pipe(
  $I.annoteSchema("AnchorName", {
    description: "Draft-2020-12 anchor name.",
    toArbitrary: () => (fc) => fc.constantFrom("a", "node", "_anchor", "A-1.b_c", "Z9"),
  })
);

/**
 * Type for {@link AnchorName}.
 *
 * @example
 * ```ts
 * import type { AnchorName } from "@beep/schema/JSONSchema"
 *
 * const anchor: AnchorName = "node"
 * console.log(anchor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AnchorName = typeof AnchorName.Type;

const UriReferenceCheck = S.isPattern(/^\S*$/, {
  identifier: $I`UriReferenceCheck`,
  title: "URI-Reference",
  description: "Pragmatic URI-Reference syntax gate: rejects whitespace, which no RFC 3986 URI-Reference may contain.",
  message: "must be a URI-Reference (whitespace is not allowed)",
});

/**
 * A pragmatic URI-Reference string for `$ref`, `$dynamicRef`, and other
 * reference-valued keywords. Full RFC 3986 grammar validation is deliberately
 * out of scope; the check rejects whitespace, which no URI-Reference may
 * contain. `$id` additionally uses {@link IdUriReferenceString}.
 *
 * @example
 * ```ts
 * import { UriReferenceString } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const ref = S.decodeUnknownResult(UriReferenceString)("#/$defs/User")
 * console.log(ref._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UriReferenceString = S.String.check(UriReferenceCheck).pipe(
  $I.annoteSchema("UriReferenceString", {
    description: "URI-Reference (pragmatic validation: no whitespace).",
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "#/$defs/User",
        "#/$defs/Item",
        "#/$defs/A1",
        "#",
        "https://example.com/schema.json",
        "other.json#/$defs/T",
        "urn:example:schema"
      ),
  })
);

/**
 * Type for {@link UriReferenceString}.
 *
 * @example
 * ```ts
 * import type { UriReferenceString } from "@beep/schema/JSONSchema"
 *
 * const ref: UriReferenceString = "#/$defs/User"
 * console.log(ref)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UriReferenceString = typeof UriReferenceString.Type;

const IdUriReferenceCheck = S.isPattern(/^[^#]*#?$/, {
  identifier: $I`IdUriReferenceCheck`,
  title: "$id URI-Reference",
  description: "Draft-2020-12 `$id` URI-Reference without a non-empty fragment.",
  message: "must not contain a non-empty fragment",
});

/**
 * A draft-2020-12 `$id` URI-Reference. It retains the pragmatic whitespace
 * validation of {@link UriReferenceString} and rejects non-empty fragments;
 * a trailing empty `#` remains backward-compatible.
 *
 * @example
 * ```ts
 * import { IdUriReferenceString } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownResult(IdUriReferenceString)("https://example.com/schema#")
 * console.log(id._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IdUriReferenceString = UriReferenceString.check(IdUriReferenceCheck).pipe(
  $I.annoteSchema("IdUriReferenceString", {
    description: "Draft-2020-12 `$id` URI-Reference without a non-empty fragment.",
    toArbitrary: () => (fc) =>
      fc.constantFrom("", "#", "schema.json", "https://example.com/schema.json", "urn:example:schema"),
  })
);

/**
 * Type for {@link IdUriReferenceString}.
 *
 * @example
 * ```ts
 * import type { IdUriReferenceString } from "@beep/schema/JSONSchema"
 *
 * const id: IdUriReferenceString = "https://example.com/schema.json"
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type IdUriReferenceString = typeof IdUriReferenceString.Type;

const NotCanonicalKeywordCheck = S.makeFilter<string>(
  (value) => (isCanonicalKeyword(value) ? "must not shadow a canonical JSON Schema keyword" : true),
  {
    identifier: $I`NotCanonicalKeywordCheck`,
    title: "Not a canonical keyword",
    description:
      "Extension-bag keys must not collide with first-class keywords; collisions would be silently shadowed when the bag is merged back onto the wire.",
  }
);

/**
 * A key admissible in a node's `extensions` bag: any string that is not a
 * {@link CanonicalKeyword}. The constraint makes wire-merge collisions
 * unrepresentable.
 *
 * @example
 * ```ts
 * import { ExtensionKey } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const key = S.decodeUnknownResult(ExtensionKey)("x-vendor")
 * console.log(key._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExtensionKey = S.String.check(NotCanonicalKeywordCheck).pipe(
  $I.annoteSchema("ExtensionKey", {
    description: "Extension keyword name (any string that is not a canonical keyword).",
    toArbitrary: () => (fc) => fc.constantFrom("x-a", "x-vendor", "x-beep", "x-note", "x-flag", "x-meta"),
  })
);

/**
 * Type for {@link ExtensionKey}.
 *
 * @example
 * ```ts
 * import type { ExtensionKey } from "@beep/schema/JSONSchema"
 *
 * const key: ExtensionKey = "x-vendor"
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtensionKey = typeof ExtensionKey.Type;

/**
 * Any JSON value — the value space of `const`, `default`, and the members of
 * `enum` and `examples`. Identical to `S.Json` at decode time; generation is
 * depth-bounded so schema-derived documents stay tractable.
 *
 * @example
 * ```ts
 * import { JsonValue } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const value = S.decodeUnknownResult(JsonValue)({ nested: [1, "two", null] })
 * console.log(value._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonValue = S.Json.pipe(
  $I.annoteSchema("JsonValue", {
    description: "Any JSON value (depth-bounded generation).",
    toArbitrary: () => (fc) => fc.jsonValue({ maxDepth: 2 }).map((value) => value as (typeof S.Json)["Type"]),
  })
);

/**
 * Type for {@link JsonValue}.
 *
 * @example
 * ```ts
 * import type { JsonValue } from "@beep/schema/JSONSchema"
 *
 * const value: JsonValue = { nested: [1, "two", null] }
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonValue = typeof JsonValue.Type;

const ExtensionsBagKeysCheck = S.makeFilter<{ readonly [key: string]: unknown }>(
  (record) => {
    const shadowed = R.keys(record).filter(isCanonicalKeyword);
    return shadowed.length === 0 || `extension keys must not shadow canonical keywords: ${shadowed.join(", ")}`;
  },
  {
    identifier: $I`ExtensionsBagKeysCheck`,
    title: "Non-shadowing extension keys",
    description:
      "Extension-bag keys must not collide with first-class keywords; collisions would be silently shadowed when the bag is merged back onto the wire. Enforced on the record because this effect version does not apply key-schema checks inside S.Record.",
  }
);

/**
 * The unknown-keyword bag carried by every node: wire keys outside the
 * canonical vocabulary decode into this record and are merged back inline on
 * encode, so foreign documents round-trip losslessly.
 *
 * The record key schema stays plain `S.String` because this effect version
 * skips all record checks (including record-level ones) when the key schema
 * itself carries checks; the {@link ExtensionKey} constraint is enforced by a
 * record-level check instead.
 *
 * @example
 * ```ts
 * import { ExtensionsBag } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const bag = S.decodeUnknownResult(ExtensionsBag)({ "x-vendor": 42 })
 * console.log(bag._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExtensionsBag = S.Record(S.String, S.Unknown)
  .check(ExtensionsBagKeysCheck)
  .pipe(
    $I.annoteSchema("ExtensionsBag", {
      description: "Preserved non-canonical keywords, keyed by extension name.",
      toArbitrary: () => (fc) =>
        fc.dictionary(
          fc.constantFrom("x-a", "x-vendor", "x-beep", "x-note", "x-flag", "x-meta"),
          fc.jsonValue({ maxDepth: 2 }),
          {
            maxKeys: 3,
          }
        ),
    })
  );

/**
 * Type for {@link ExtensionsBag}.
 *
 * @example
 * ```ts
 * import type { ExtensionsBag } from "@beep/schema/JSONSchema"
 *
 * const bag: ExtensionsBag = { "x-vendor": 42 }
 * console.log(bag["x-vendor"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExtensionsBag = typeof ExtensionsBag.Type;
