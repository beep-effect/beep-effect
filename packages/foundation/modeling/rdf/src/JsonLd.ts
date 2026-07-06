/**
 * JSON-LD value families and normalized document shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { AbsoluteIRI, IRI, IRIReference } from "./Iri.ts";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata.ts";

const $I = $RdfId.create("jsonld");

const JsonLdScalar = S.Union([S.String, S.Finite, S.Boolean]).pipe(
  $I.annoteSchema("JsonLdScalar", {
    description: "Scalar JSON-LD literal value input used by bounded document helpers.",
  })
);

const jsonLdBlankNodeIdentifierChecks = S.makeFilterGroup(
  [
    S.isPattern(/^_:\S+$/, {
      identifier: $I`JsonLdBlankNodeIdentifierPatternCheck`,
      title: "JSON-LD Blank Node Identifier Pattern",
      description: "A JSON-LD blank-node identifier beginning with `_:` and containing no whitespace.",
      message: "Blank-node identifiers must begin with `_:`, and must not contain whitespace",
    }),
  ],
  {
    identifier: $I`JsonLdBlankNodeIdentifierChecks`,
    title: "JSON-LD Blank Node Identifier",
    description: "Checks for bounded JSON-LD blank-node identifiers.",
  }
);

/**
 * JSON-LD keyword surface used by the bounded v1 model.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdKeyword } from "@beep/rdf/JsonLd"
 *
 * console.log(S.is(JsonLdKeyword)("@context")) // true
 * console.log(S.is(JsonLdKeyword)("@invalid")) // false
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const JsonLdKeyword = LiteralKit([
  "@base",
  "@context",
  "@graph",
  "@id",
  "@language",
  "@type",
  "@value",
  "@vocab",
]).pipe(
  $I.annoteSchema("JsonLdKeyword", {
    description: "JSON-LD keyword surface used by the bounded v1 model.",
  })
);

/**
 * Type for {@link JsonLdKeyword}.
 *
 * @example
 * ```ts
 * import type { JsonLdKeyword } from "@beep/rdf/JsonLd"
 *
 * const acceptJsonLdKeyword = (value: JsonLdKeyword) => value
 * console.log(acceptJsonLdKeyword)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdKeyword = typeof JsonLdKeyword.Type;

/**
 * Normalized JSON-LD term definition used by the bounded context model.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdTermDefinition } from "@beep/rdf/JsonLd"
 *
 * const term = S.decodeUnknownSync(JsonLdTermDefinition)({
 *   "@id": "https://schema.org/name",
 *   "@type": "http://www.w3.org/2001/XMLSchema#string"
 * })
 * console.log(term["@id"]) // "https://schema.org/name"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdTermDefinition extends S.Class<JsonLdTermDefinition>($I`JsonLdTermDefinition`)(
  {
    "@id": S.String,
    "@type": S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdTermDefinition", {
    description: "Normalized JSON-LD term definition used by the bounded context model.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdTermDefinition",
      overview: "Normalized JSON-LD term definition used by the bounded context model.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Term Definitions", disposition: "normative" }],
      equivalenceBasis: "Exact @id and optional @type equality.",
      representations: [{ kind: "JSON-LD" }],
    }),
  })
) {}

/**
 * Normalized JSON-LD context model with bounded base, vocab, and term bindings.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdContext } from "@beep/rdf/JsonLd"
 *
 * const context = S.decodeUnknownSync(JsonLdContext)({
 *   "@base": "https://example.org/",
 *   "@vocab": "https://schema.org/",
 *   terms: {
 *     name: "https://schema.org/name"
 *   }
 * })
 * console.log(context.terms.name) // "https://schema.org/name"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdContext extends S.Class<JsonLdContext>($I`JsonLdContext`)(
  {
    "@base": S.OptionFromOptionalKey(AbsoluteIRI).pipe(SchemaUtils.withNoneDefault),
    "@vocab": S.OptionFromOptionalKey(IRI).pipe(SchemaUtils.withNoneDefault),
    terms: S.Record(S.String, S.Union([S.String, JsonLdTermDefinition])),
  },
  $I.annote("JsonLdContext", {
    description: "Normalized JSON-LD context model with bounded base, vocab, and term bindings.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdContext",
      overview: "Normalized JSON-LD context model with bounded base, vocab, and term bindings.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Context Definitions", disposition: "normative" }],
      equivalenceBasis: "Exact base, vocab, and term binding equality.",
      representations: [{ kind: "JSON-LD" }],
      canonicalizationRequired: false,
    }),
  })
) {}

/**
 * JSON-LD blank-node identifier used by the bounded document model.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdBlankNodeIdentifier } from "@beep/rdf/JsonLd"
 *
 * const identifier = S.decodeUnknownSync(JsonLdBlankNodeIdentifier)("_:b0")
 * console.log(identifier) // "_:b0"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const JsonLdBlankNodeIdentifier = S.String.check(jsonLdBlankNodeIdentifierChecks).pipe(
  S.brand("JsonLdBlankNodeIdentifier"),
  $I.annoteSchema("JsonLdBlankNodeIdentifier", {
    description: "JSON-LD blank-node identifier used by the bounded document model.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "identifier",
      canonicalName: "JsonLdBlankNodeIdentifier",
      overview: "JSON-LD blank-node identifier used by the bounded document model.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Node Identifiers", disposition: "normative" }],
      equivalenceBasis: "Exact blank-node identifier equality within a bounded document.",
      canonicalizationRequired: true,
      representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS", note: "Bridges to RDF blank-node labels." }],
    }),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link JsonLdBlankNodeIdentifier}.
 *
 * @example
 * ```ts
 * import type { JsonLdBlankNodeIdentifier } from "@beep/rdf/JsonLd"
 *
 * const acceptJsonLdBlankNodeIdentifier = (value: JsonLdBlankNodeIdentifier) => value
 * console.log(acceptJsonLdBlankNodeIdentifier)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdBlankNodeIdentifier = typeof JsonLdBlankNodeIdentifier.Type;

/**
 * JSON-LD node identifier used by the bounded document model.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdNodeIdentifier } from "@beep/rdf/JsonLd"
 *
 * const identifier = S.decodeUnknownSync(JsonLdNodeIdentifier)("https://example.org/person/alice")
 * console.log(identifier) // "https://example.org/person/alice"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const JsonLdNodeIdentifier = S.Union([IRIReference, JsonLdBlankNodeIdentifier]).pipe(
  $I.annoteSchema("JsonLdNodeIdentifier", {
    description: "JSON-LD node identifier used by the bounded document model.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "identifier",
      canonicalName: "JsonLdNodeIdentifier",
      overview: "JSON-LD node identifier used by the bounded document model.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Node Identifiers", disposition: "normative" }],
      equivalenceBasis: "Identifier equality after bounded context-aware compaction or expansion.",
      canonicalizationRequired: true,
      representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS", note: "Bridges to named nodes or blank nodes." }],
    }),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link JsonLdNodeIdentifier}.
 *
 * @example
 * ```ts
 * import type { JsonLdNodeIdentifier } from "@beep/rdf/JsonLd"
 *
 * const acceptJsonLdNodeIdentifier = (value: JsonLdNodeIdentifier) => value
 * console.log(acceptJsonLdNodeIdentifier)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdNodeIdentifier = typeof JsonLdNodeIdentifier.Type;

/**
 * JSON-LD node reference value.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdReferenceValue } from "@beep/rdf/JsonLd"
 *
 * const reference = S.decodeUnknownSync(JsonLdReferenceValue)({
 *   "@id": "https://example.org/person/alice"
 * })
 * console.log(reference["@id"]) // "https://example.org/person/alice"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdReferenceValue extends S.Class<JsonLdReferenceValue>($I`JsonLdReferenceValue`)(
  {
    "@id": JsonLdNodeIdentifier,
  },
  $I.annote("JsonLdReferenceValue", {
    description: "JSON-LD node reference value.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdReferenceValue",
      overview: "JSON-LD node reference value.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Node References", disposition: "normative" }],
      equivalenceBasis: "Identifier equality after context-aware compaction or expansion.",
      representations: [{ kind: "JSON-LD" }],
      canonicalizationRequired: true,
    }),
  })
) {}

/**
 * JSON-LD literal value object.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdLiteralValue } from "@beep/rdf/JsonLd"
 *
 * const value = S.decodeUnknownSync(JsonLdLiteralValue)({
 *   "@value": "Alice",
 *   "@language": "en"
 * })
 * console.log(value["@value"]) // "Alice"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdLiteralValue extends S.Class<JsonLdLiteralValue>($I`JsonLdLiteralValue`)(
  {
    "@value": JsonLdScalar,
    "@type": S.OptionFromOptionalKey(IRIReference).pipe(SchemaUtils.withNoneDefault),
    "@language": S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdLiteralValue", {
    description: "JSON-LD literal value object.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdLiteralValue",
      overview: "JSON-LD literal value object used in bounded document bridging.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Value Objects", disposition: "normative" }],
      equivalenceBasis: "Exact value, optional @type, and optional @language equality.",
      representations: [{ kind: "JSON-LD" }],
    }),
  })
) {}

/**
 * JSON-LD property value union used by bounded node objects.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdLiteralValue, JsonLdPropertyValue } from "@beep/rdf/JsonLd"
 *
 * const propertyValue = S.decodeUnknownSync(JsonLdPropertyValue)({
 *   "@value": "Alice"
 * })
 * if (S.is(JsonLdLiteralValue)(propertyValue)) {
 *   console.log(propertyValue["@value"]) // "Alice"
 * }
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const JsonLdPropertyValue = S.Union([JsonLdReferenceValue, JsonLdLiteralValue]).pipe(
  $I.annoteSchema("JsonLdPropertyValue", {
    description: "JSON-LD property value union used by bounded node objects.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link JsonLdPropertyValue}.
 *
 * @example
 * ```ts
 * import type { JsonLdPropertyValue } from "@beep/rdf/JsonLd"
 *
 * const acceptJsonLdPropertyValue = (value: JsonLdPropertyValue) => value
 * console.log(acceptJsonLdPropertyValue)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type JsonLdPropertyValue = typeof JsonLdPropertyValue.Type;

/**
 * JSON-LD node object used by bounded document and framing helpers.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdNodeObject } from "@beep/rdf/JsonLd"
 *
 * const node = S.decodeUnknownSync(JsonLdNodeObject)({
 *   "@id": "https://example.org/person/alice",
 *   "@type": ["https://schema.org/Person"],
 *   properties: {
 *     "https://schema.org/name": [{ "@value": "Alice" }]
 *   }
 * })
 * console.log(Object.keys(node.properties).length) // 1
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdNodeObject extends S.Class<JsonLdNodeObject>($I`JsonLdNodeObject`)(
  {
    "@id": S.OptionFromOptionalKey(JsonLdNodeIdentifier).pipe(SchemaUtils.withNoneDefault),
    "@type": IRIReference.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    properties: S.Record(S.String, S.Array(JsonLdPropertyValue)),
  },
  $I.annote("JsonLdNodeObject", {
    description: "JSON-LD node object used by bounded document and framing helpers.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdNodeObject",
      overview: "JSON-LD node object used by bounded document and framing helpers.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "Node Objects", disposition: "normative" }],
      equivalenceBasis: "Exact identifier, type, and property-value equality.",
      representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS", note: "Bridge source for quad generation." }],
      canonicalizationRequired: true,
    }),
  })
) {}

/**
 * Bounded JSON-LD document model with normalized context and graph content.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdDocument } from "@beep/rdf/JsonLd"
 *
 * const doc = S.decodeUnknownSync(JsonLdDocument)({ "@graph": [] })
 * console.log(doc["@graph"].length) // 0
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdDocument extends S.Class<JsonLdDocument>($I`JsonLdDocument`)(
  {
    "@context": S.OptionFromOptionalKey(JsonLdContext).pipe(SchemaUtils.withNoneDefault),
    "@graph": S.Array(JsonLdNodeObject),
  },
  $I.annote("JsonLdDocument", {
    description: "Bounded JSON-LD document model with normalized context and graph content.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdDocument",
      overview: "Bounded JSON-LD document model with normalized context and graph content.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1", section: "JSON-LD Documents", disposition: "normative" }],
      equivalenceBasis:
        "Document-shape equality only; RDF semantic identity requires explicit bridging and canonicalization.",
      representations: [{ kind: "JSON-LD" }, { kind: "RDF/JS", note: "Produced through document service bridging." }],
      canonicalizationRequired: true,
    }),
  })
) {}

/**
 * Bounded JSON-LD frame model.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsonLdFrame } from "@beep/rdf/JsonLd"
 *
 * const frame = S.decodeUnknownSync(JsonLdFrame)({
 *   "@type": "https://schema.org/Person",
 *   includeProperties: ["https://schema.org/name"]
 * })
 * console.log(frame.includeProperties._tag) // "Some"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class JsonLdFrame extends S.Class<JsonLdFrame>($I`JsonLdFrame`)(
  {
    "@type": S.OptionFromOptionalKey(IRIReference).pipe(SchemaUtils.withNoneDefault),
    includeProperties: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("JsonLdFrame", {
    description: "Bounded JSON-LD frame model.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "jsonldConstruct",
      canonicalName: "JsonLdFrame",
      overview: "Bounded JSON-LD frame model.",
      status: "stable",
      specifications: [{ name: "JSON-LD 1.1 Framing", disposition: "informative" }],
      equivalenceBasis: "Exact frame-shape equality.",
      representations: [{ kind: "JSON-LD" }],
    }),
  })
) {}
