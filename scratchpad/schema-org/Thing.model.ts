/**
 * Schema.org `Thing` model.
 *
 * @see https://schema.org/Thing
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils, UnknownRecord } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("schema-org/Thing.model");

const SCHEMA_ORG_BASE_URL = "https://schema.org/";
const URL_REFERENCE_CHARACTERS = /^[^\u0000-\u0020\u007f]*$/u;

const SchemaOrgUrlReferenceChecks = S.makeFilterGroup(
  [
    S.isTrimmed({
      identifier: $I`SchemaOrgUrlReferenceTrimmedCheck`,
      title: "Schema.org URL Reference Is Trimmed",
      description: "A Schema.org URL value cannot contain leading or trailing whitespace.",
      message: "Schema.org URL values must not contain leading or trailing whitespace",
    }),
    S.isPattern(URL_REFERENCE_CHARACTERS, {
      identifier: $I`SchemaOrgUrlReferenceCharactersCheck`,
      title: "Schema.org URL Reference Characters",
      description: "A Schema.org URL value cannot contain unescaped ASCII whitespace or control characters.",
      message: "Schema.org URL values must not contain unescaped whitespace or control characters",
    }),
    S.makeFilter((value: string) => URL.canParse(value, SCHEMA_ORG_BASE_URL), {
      identifier: $I`SchemaOrgUrlReferenceSyntaxCheck`,
      title: "Schema.org URL Reference Syntax",
      description:
        "A Schema.org URL value must be an absolute URL or a relative URL reference resolvable against a document base URL.",
      message: "Expected an absolute or relative URL reference",
    }),
  ],
  {
    identifier: $I`SchemaOrgUrlReferenceChecks`,
    title: "Schema.org URL Reference",
    description: "Lexical checks for URL-valued Schema.org properties.",
  }
);

/** A URL-valued Schema.org property value, including relative references. */
export const SchemaOrgUrlReference = S.String.check(SchemaOrgUrlReferenceChecks).annotate(
  $I.annote("SchemaOrgUrlReference", {
    description: "An absolute or relative URL reference used by a URL-valued Schema.org property.",
  })
);

/** Runtime type decoded by {@link SchemaOrgUrlReference}. */
export type SchemaOrgUrlReference = typeof SchemaOrgUrlReference.Type;

/**
 * An open object-valued Schema.org range member.
 *
 * Concrete types such as `CreativeWork`, `ImageObject`, and `Person` are
 * recursively defined `Thing` subtypes. Their complete validation belongs to
 * those concrete schemas (or to graph validation), while this base model only
 * distinguishes object-valued range members from literal values.
 */
export const SchemaOrgNode = UnknownRecord.annotate(
  $I.annote("SchemaOrgNode", {
    description: "An open Schema.org node whose concrete subtype is validated by its owning schema or graph.",
  })
);

/** Runtime type decoded by {@link SchemaOrgNode}. */
export type SchemaOrgNode = typeof SchemaOrgNode.Type;

/** A Schema.org range accepting either `Text` or an object-valued node. */
export const TextOrNode = S.Union([S.String, SchemaOrgNode]).pipe(
  $I.annoteSchema("TextOrNode", {
    description: "A Schema.org range accepting either a Text value or an object-valued node.",
  })
);

/** Runtime type decoded by {@link TextOrNode}. */
export type TextOrNode = typeof TextOrNode.Type;

/** A Schema.org range accepting either `URL` or an object-valued node. */
export const UrlOrNode = S.Union([SchemaOrgUrlReference, SchemaOrgNode]).pipe(
  $I.annoteSchema("UrlOrNode", {
    description: "A Schema.org range accepting either a URL reference or an object-valued node.",
  })
);

/** Runtime type decoded by {@link UrlOrNode}. */
export type UrlOrNode = typeof UrlOrNode.Type;

/**
 * Schema.org properties are optional and may have one or more values. Compact
 * scalar input is normalized to an array while an omitted property remains
 * `Option.none`, preserving Schema.org's open-world semantics.
 */
export const optionalValues = <Value extends S.Constraint>(value: Value) =>
  S.ArrayEnsure(value).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

const ThingFields = S.Struct({
  additionalType: optionalValues(S.String),
  alternateName: optionalValues(S.String),
  description: optionalValues(TextOrNode),
  disambiguatingDescription: optionalValues(S.String),
  identifier: optionalValues(TextOrNode),
  image: optionalValues(UrlOrNode),
  mainEntityOfPage: optionalValues(UrlOrNode),
  name: optionalValues(S.String),
  owner: optionalValues(SchemaOrgNode),
  potentialAction: optionalValues(SchemaOrgNode),
  sameAs: optionalValues(SchemaOrgUrlReference),
  subjectOf: optionalValues(SchemaOrgNode),
  url: optionalValues(SchemaOrgUrlReference),
});

/**
 * The most generic Schema.org item.
 *
 * All thirteen vocabulary properties are optional and multi-valued. Schema.org
 * defines no required fields, maximum cardinalities, or local cross-field
 * invariants for `Thing`; consequently this class deliberately has no
 * object-wide filter. URL-only value positions use the lexical `.check(...)`
 * filters above. JSON-LD keywords such as `@id` and `@type` are document syntax,
 * not properties of `Thing`; the class itself carries the decoded value's type.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Thing } from "./Thing.model.js"
 *
 * const thing = Thing.make({
 *   name: O.some(["Schema.org Ontology"]),
 * })
 *
 * console.log(O.isSome(thing.name)) // true
 * ```
 *
 * @see https://schema.org/Thing
 * @since 0.0.0
 */
export class Thing extends S.Class<Thing>($I`Thing`)(
  ThingFields,
  $I.annote("Thing", {
    description: "The most generic type of Schema.org item.",
    documentation: "https://schema.org/Thing",
  })
) {}
