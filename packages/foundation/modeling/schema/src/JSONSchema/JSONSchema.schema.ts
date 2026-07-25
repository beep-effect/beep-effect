/**
 * Structured, recursive model of JSON Schema draft-2020-12 documents.
 *
 * Effect's `JsonSchema` module types documents as open records; this module
 * provides the typed node model it deliberately does not. A {@link Node} is a
 * single self-recursive class carrying the full draft-2020-12 vocabulary as
 * Option-wrapped optional fields plus an `extensions` bag that preserves
 * unknown keywords losslessly. {@link NodeCodec} is the wire codec (flat JSON
 * object in, `Node` out); {@link SubSchema} is the `boolean | Node` union the
 * spec allows at every subschema position; {@link Document} mirrors effect's
 * draft-2020-12 document envelope.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SchemaGetter } from "effect";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import {
  $I,
  AnchorName,
  ExtensionsBag,
  isCanonicalKeyword,
  JsonValue,
  NonNegativeCount,
  PositiveNumber,
  RegexKeysCheck,
  RegexPatternString,
  Types,
  UriReferenceString,
} from "./JSONSchema.shared.ts";
import type { FastCheck } from "effect/testing";

const RequiredKeysUniqueCheck = S.isUnique({
  identifier: $I`RequiredKeysUniqueCheck`,
  title: "Unique property names",
  description: "Draft-2020-12 mandates that `required` and `dependentRequired` entries are unique.",
  message: "property name entries must be unique",
});

const RequiredKeys = S.Array(S.String).check(RequiredKeysUniqueCheck);

/**
 * Shared depth identifier for {@link SubSchema} generation: every recursive
 * position draws from one fast-check depth budget, mirroring effect's own
 * per-suspend bounding (`maxDepth: 2`).
 */
let subSchemaDepthIdentifier: FastCheck.DepthIdentifier | undefined;

const getSubSchemaDepthIdentifier = (fc: typeof FastCheck): FastCheck.DepthIdentifier =>
  (subSchemaDepthIdentifier ??= fc.createDepthIdentifier());

// Explicit types on the arbitrary factories are load-bearing: they keep the
// closures' bodies (which reference `Node`) out of the class's own type
// resolution, breaking the base-expression circularity.
const subSchemaToArbitrary: () => (fc: typeof FastCheck) => FastCheck.Arbitrary<SubSchema.Type> = () => (fc) =>
  fc.oneof(
    { maxDepth: 2, depthIdentifier: getSubSchemaDepthIdentifier(fc) },
    { arbitrary: fc.boolean(), weight: 4 },
    {
      arbitrary: fc.constant(null).chain((): FastCheck.Arbitrary<SubSchema.Type> => S.toArbitrary(Node)),
      weight: 1,
    }
  );

const nodeToArbitrary: () => (fc: typeof FastCheck) => FastCheck.Arbitrary<Node.Type> = () => (fc) =>
  fc.constant(null).chain((): FastCheck.Arbitrary<Node.Type> => S.toArbitrary(Node));

/**
 * A complete schema at any subschema position: draft-2020-12 allows `true`
 * (accept everything) and `false` (reject everything) wherever a schema is
 * expected, so every recursive position in {@link Node} uses this union.
 *
 * The `toArbitrary` annotation is load-bearing: effect `4.0.0-beta.98` cannot
 * derive arbitraries for recursion through Option/Union fields (its suspend
 * bounding only short-circuits at empty-collection cuts such as `S.Array`),
 * so generation is depth-gated here instead of relying on derivation.
 *
 * @example
 * ```ts
 * import { SubSchema } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const accepting = S.decodeUnknownSync(SubSchema)(true)
 * const typed = S.decodeUnknownSync(SubSchema)({ type: "string" })
 * console.log(accepting, typed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SubSchema = S.Union([S.Boolean, S.suspend((): S.Codec<Node.Type, Node.Encoded> => NodeCodec)]).pipe(
  $I.annoteSchema("SubSchema", {
    description: "A boolean schema or a full JSON Schema node.",
    toArbitrary: subSchemaToArbitrary,
  })
);

/**
 * Runtime type for {@link SubSchema}.
 *
 * @example
 * ```ts
 * import type { SubSchema } from "@beep/schema/JSONSchema"
 *
 * const accepting: SubSchema = true
 * console.log(accepting)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SubSchema = typeof SubSchema.Type;

/**
 * Types for {@link SubSchema}.
 *
 * @example
 * ```ts
 * import type { SubSchema } from "@beep/schema/JSONSchema"
 *
 * const runtime: SubSchema.Type = false
 * const wire: SubSchema.Encoded = { type: "string", minLength: 1 }
 * console.log(runtime, wire)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SubSchema {
  /**
   * Runtime form: a boolean or a decoded {@link Node}.
   *
   * @since 0.0.0
   */
  export type Type = boolean | Node.Type;
  /**
   * Wire form: a boolean or a flat JSON Schema object.
   *
   * @since 0.0.0
   */
  export type Encoded = boolean | Node.Encoded;
}

const optionalKeyword = <Inner extends S.Top>(inner: Inner, description: string) =>
  S.OptionFromOptionalKey(inner).pipe(SchemaUtils.withNoneDefault).annotateKey({ description });

const SubSchemaRecord = S.Record(S.String, SubSchema);

const SubSchemaList = S.NonEmptyArray(SubSchema);

/**
 * A JSON Schema draft-2020-12 node: one class, every keyword an
 * Option-wrapped optional field. Keyword co-occurrence is unrestricted (the
 * spec's grammar is a single uniform vocabulary, not a discriminated union),
 * `$ref` siblings are legal, and non-canonical wire keys live in
 * `extensions`. Construct with `Node.make` — every keyword defaults to
 * `Option.none` and `extensions` to `{}` — or decode raw documents through
 * {@link NodeCodec}.
 *
 * @example
 * ```ts
 * import { Node } from "@beep/schema/JSONSchema"
 * import * as O from "effect/Option"
 *
 * const node = Node.make({ type: O.some("string"), minLength: O.some(1) })
 * console.log(O.getOrNull(node.type))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Node extends S.Class<Node>($I`Node`)(
  {
    $anchor: optionalKeyword(AnchorName, "Plain-name fragment identifier for this subschema."),
    $comment: optionalKeyword(S.String, "Free-form commentary for schema maintainers; never affects validation."),
    $defs: optionalKeyword(SubSchemaRecord, "Locally defined reusable subschemas, referenceable via $ref."),
    $dynamicAnchor: optionalKeyword(AnchorName, "Dynamic anchor name resolvable by $dynamicRef at evaluation time."),
    $dynamicRef: optionalKeyword(UriReferenceString, "Dynamically resolved reference cooperating with $dynamicAnchor."),
    $id: optionalKeyword(UriReferenceString, "Base URI identifier for this schema resource."),
    $ref: optionalKeyword(
      UriReferenceString,
      "Reference to another schema by URI-Reference; draft-2020-12 permits sibling keywords."
    ),
    $schema: optionalKeyword(S.String, "Dialect meta-schema URI this schema conforms to."),
    $vocabulary: optionalKeyword(
      S.Record(S.String, S.Boolean),
      "Vocabulary availability declarations (meta-schemas only)."
    ),
    additionalProperties: optionalKeyword(
      SubSchema,
      "Schema for properties not matched by properties or patternProperties."
    ),
    allOf: optionalKeyword(SubSchemaList, "Instance must validate against every subschema (non-empty per spec)."),
    anyOf: optionalKeyword(
      SubSchemaList,
      "Instance must validate against at least one subschema (non-empty per spec)."
    ),
    const: optionalKeyword(JsonValue, "Instance must equal exactly this JSON value."),
    contains: optionalKeyword(SubSchema, "At least one array item must validate against this schema."),
    contentEncoding: optionalKeyword(S.String, "Encoding (e.g. base64) of string content."),
    contentMediaType: optionalKeyword(S.String, "MIME type of string content."),
    contentSchema: optionalKeyword(SubSchema, "Schema for the decoded string content."),
    default: optionalKeyword(JsonValue, "Default JSON value tooling may substitute for absent instances."),
    dependentRequired: optionalKeyword(
      S.Record(S.String, RequiredKeys),
      "When the key property is present, the listed unique property names are required."
    ),
    dependentSchemas: optionalKeyword(
      SubSchemaRecord,
      "When the key property is present, the mapped schema must also validate."
    ),
    deprecated: optionalKeyword(S.Boolean, "Marks the schema as deprecated for consumers."),
    description: optionalKeyword(S.String, "Human-readable description of the schema's purpose."),
    else: optionalKeyword(SubSchema, "Applied when the instance fails the if schema."),
    enum: optionalKeyword(S.Array(JsonValue), "Instance must equal one of these JSON values."),
    examples: optionalKeyword(S.Array(JsonValue), "Sample JSON instances illustrating the schema."),
    exclusiveMaximum: optionalKeyword(S.Finite, "Numeric instances must be strictly less than this value."),
    exclusiveMinimum: optionalKeyword(S.Finite, "Numeric instances must be strictly greater than this value."),
    format: optionalKeyword(S.String, "Semantic format hint (open vocabulary, e.g. date-time, uuid)."),
    if: optionalKeyword(SubSchema, "Conditional gate: outcome selects then or else."),
    items: optionalKeyword(SubSchema, "Schema for array items beyond prefixItems."),
    maxContains: optionalKeyword(NonNegativeCount, "Upper bound on items matching contains."),
    maxItems: optionalKeyword(NonNegativeCount, "Maximum number of array items."),
    maxLength: optionalKeyword(NonNegativeCount, "Maximum string length in Unicode code points."),
    maxProperties: optionalKeyword(NonNegativeCount, "Maximum number of object properties."),
    maximum: optionalKeyword(S.Finite, "Inclusive numeric upper bound."),
    minContains: optionalKeyword(NonNegativeCount, "Lower bound on items matching contains."),
    minItems: optionalKeyword(NonNegativeCount, "Minimum number of array items."),
    minLength: optionalKeyword(NonNegativeCount, "Minimum string length in Unicode code points."),
    minProperties: optionalKeyword(NonNegativeCount, "Minimum number of object properties."),
    minimum: optionalKeyword(S.Finite, "Inclusive numeric lower bound."),
    multipleOf: optionalKeyword(PositiveNumber, "Numeric instances must be an integer multiple of this value."),
    not: optionalKeyword(SubSchema, "Instance must NOT validate against this schema."),
    oneOf: optionalKeyword(SubSchemaList, "Instance must validate against exactly one subschema (non-empty per spec)."),
    pattern: optionalKeyword(RegexPatternString, "ECMA-262 regular expression string instances must match."),
    patternProperties: optionalKeyword(
      S.Record(S.String, SubSchema).check(RegexKeysCheck),
      "Schemas applied to properties whose names match the regex keys."
    ),
    prefixItems: optionalKeyword(SubSchemaList, "Positional tuple schemas (non-empty per spec)."),
    properties: optionalKeyword(SubSchemaRecord, "Schemas for named object properties."),
    propertyNames: optionalKeyword(SubSchema, "Schema every property name must validate against."),
    readOnly: optionalKeyword(S.Boolean, "Value is managed by the authority and read-only for clients."),
    required: optionalKeyword(RequiredKeys, "Unique property names that must be present."),
    then: optionalKeyword(SubSchema, "Applied when the instance passes the if schema."),
    title: optionalKeyword(S.String, "Short human-readable title."),
    type: optionalKeyword(Types, "Primitive type name or non-empty unique array of type names."),
    unevaluatedItems: optionalKeyword(SubSchema, "Schema for array items not evaluated by other applicators."),
    unevaluatedProperties: optionalKeyword(SubSchema, "Schema for properties not evaluated by other applicators."),
    uniqueItems: optionalKeyword(S.Boolean, "When true, all array items must be distinct."),
    writeOnly: optionalKeyword(S.Boolean, "Value is accepted on writes but omitted from reads."),
    extensions: ExtensionsBag.pipe(SchemaUtils.withKeyDefaults({})).annotateKey({
      description:
        "Non-canonical keywords preserved from the wire; merged back inline on encode. Keys must not shadow canonical keywords.",
    }),
  },
  $I.annote("Node", {
    description: "A JSON Schema draft-2020-12 node with lossless unknown-keyword preservation.",
  })
) {
  /**
   * Guard for decoded {@link Node} instances.
   *
   * @since 0.0.0
   */
  static readonly is = S.is(Node);
}

/**
 * Types for {@link Node}.
 *
 * @example
 * ```ts
 * import { Node, NodeCodec } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const wire: Node.Encoded = { type: "object", "x-vendor": 1 }
 * const node: Node.Type = S.decodeUnknownSync(NodeCodec)(wire)
 * console.log(node.extensions["x-vendor"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Node {
  /**
   * Runtime form of a node: every keyword Option-wrapped, plus the
   * `extensions` bag of preserved non-canonical keywords. {@link Node}
   * instances satisfy this interface; it exists so recursive positions can be
   * typed without depending on class inference.
   *
   * @since 0.0.0
   */
  export interface Type {
    readonly $anchor: O.Option<string>;
    readonly $comment: O.Option<string>;
    readonly $defs: O.Option<{ readonly [key: string]: SubSchema.Type }>;
    readonly $dynamicAnchor: O.Option<string>;
    readonly $dynamicRef: O.Option<string>;
    readonly $id: O.Option<string>;
    readonly $ref: O.Option<string>;
    readonly $schema: O.Option<string>;
    readonly $vocabulary: O.Option<{ readonly [key: string]: boolean }>;
    readonly additionalProperties: O.Option<SubSchema.Type>;
    readonly allOf: O.Option<readonly [SubSchema.Type, ...Array<SubSchema.Type>]>;
    readonly anyOf: O.Option<readonly [SubSchema.Type, ...Array<SubSchema.Type>]>;
    readonly const: O.Option<JsonValue>;
    readonly contains: O.Option<SubSchema.Type>;
    readonly contentEncoding: O.Option<string>;
    readonly contentMediaType: O.Option<string>;
    readonly contentSchema: O.Option<SubSchema.Type>;
    readonly default: O.Option<JsonValue>;
    readonly dependentRequired: O.Option<{ readonly [key: string]: ReadonlyArray<string> }>;
    readonly dependentSchemas: O.Option<{ readonly [key: string]: SubSchema.Type }>;
    readonly deprecated: O.Option<boolean>;
    readonly description: O.Option<string>;
    readonly else: O.Option<SubSchema.Type>;
    readonly enum: O.Option<ReadonlyArray<JsonValue>>;
    readonly examples: O.Option<ReadonlyArray<JsonValue>>;
    readonly exclusiveMaximum: O.Option<number>;
    readonly exclusiveMinimum: O.Option<number>;
    readonly extensions: { readonly [key: string]: unknown };
    readonly format: O.Option<string>;
    readonly if: O.Option<SubSchema.Type>;
    readonly items: O.Option<SubSchema.Type>;
    readonly maxContains: O.Option<number>;
    readonly maxItems: O.Option<number>;
    readonly maximum: O.Option<number>;
    readonly maxLength: O.Option<number>;
    readonly maxProperties: O.Option<number>;
    readonly minContains: O.Option<number>;
    readonly minItems: O.Option<number>;
    readonly minimum: O.Option<number>;
    readonly minLength: O.Option<number>;
    readonly minProperties: O.Option<number>;
    readonly multipleOf: O.Option<number>;
    readonly not: O.Option<SubSchema.Type>;
    readonly oneOf: O.Option<readonly [SubSchema.Type, ...Array<SubSchema.Type>]>;
    readonly pattern: O.Option<string>;
    readonly patternProperties: O.Option<{ readonly [key: string]: SubSchema.Type }>;
    readonly prefixItems: O.Option<readonly [SubSchema.Type, ...Array<SubSchema.Type>]>;
    readonly properties: O.Option<{ readonly [key: string]: SubSchema.Type }>;
    readonly propertyNames: O.Option<SubSchema.Type>;
    readonly readOnly: O.Option<boolean>;
    readonly required: O.Option<ReadonlyArray<string>>;
    readonly then: O.Option<SubSchema.Type>;
    readonly title: O.Option<string>;
    readonly type: O.Option<Types>;
    readonly unevaluatedItems: O.Option<SubSchema.Type>;
    readonly unevaluatedProperties: O.Option<SubSchema.Type>;
    readonly uniqueItems: O.Option<boolean>;
    readonly writeOnly: O.Option<boolean>;
  }

  /**
   * Wire form of a node: a flat JSON object whose canonical keywords are
   * validated by {@link NodeCodec} and whose remaining keys are preserved in
   * the `extensions` bag. Typed as an open record because the codec accepts
   * any JSON object shape and partitions it.
   *
   * @since 0.0.0
   */
  export interface Encoded {
    readonly [keyword: string]: unknown;
  }
}

const partitionWire = (record: { readonly [k: string]: unknown }): { readonly [k: string]: unknown } => {
  // crispen: kept native and imperative — this is a trust boundary. Building
  // with plain objects (as effect's Record helpers do) hits the
  // Object.prototype "__proto__" setter, silently dropping that wire key and
  // transiently installing attacker-controlled JSON as a prototype.
  // Null-prototype accumulators + spread (which defines own properties)
  // preserve the hostile key losslessly; fold back into Record helpers only if
  // effect ships pollution-safe record construction.
  const known: Record<string, unknown> = Object.create(null);
  const extensions: Record<string, unknown> = Object.create(null);
  for (const [key, value] of Object.entries(record)) {
    if (isCanonicalKeyword(key)) {
      known[key] = value;
    } else {
      extensions[key] = value;
    }
  }
  return { ...known, extensions: { ...extensions } };
};

const mergeWire = ({ extensions, ...known }: { readonly [k: string]: unknown }): { readonly [k: string]: unknown } => ({
  ...known,
  ...(extensions as { readonly [k: string]: unknown }),
});

/**
 * The wire codec for {@link Node}: decodes any flat JSON Schema object —
 * canonical keywords validated field-by-field, everything else preserved in
 * `extensions` — and encodes back to the identical flat wire form.
 *
 * @example
 * ```ts
 * import { NodeCodec } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownSync(NodeCodec)({ type: "object", "x-vendor": 1 })
 * console.log(node.extensions["x-vendor"])
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const NodeCodec = S.Record(S.String, S.Unknown).pipe(
  S.decodeTo(Node, {
    decode: SchemaGetter.transform(partitionWire),
    encode: SchemaGetter.transform(mergeWire),
  }),
  $I.annoteSchema("NodeCodec", {
    description: "Wire codec between flat JSON Schema objects and Node instances.",
    toArbitrary: nodeToArbitrary,
  })
);

/**
 * Runtime type for {@link NodeCodec}: decoded values are {@link Node}
 * instances.
 *
 * @example
 * ```ts
 * import { NodeCodec } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const node: NodeCodec = S.decodeUnknownSync(NodeCodec)({ type: "object" })
 * console.log(node.extensions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NodeCodec = typeof NodeCodec.Type;

/**
 * Effect-style document envelope for draft-2020-12, mirroring
 * `JsonSchema.Document<"draft-2020-12">`: a root schema plus a definitions
 * record hoisted out of the schema. Output of `S.toJsonSchemaDocument`
 * decodes directly into this class.
 *
 * @example
 * ```ts
 * import { Document } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(Document)({
 *   dialect: "draft-2020-12",
 *   schema: { $ref: "#/$defs/User" },
 *   definitions: { User: { type: "object" } },
 * })
 * console.log(document.dialect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Document extends S.Class<Document>($I`Document`)(
  {
    dialect: S.Literal("draft-2020-12")
      .pipe(SchemaUtils.withKeyDefaults("draft-2020-12"))
      .annotateKey({ description: "The canonical dialect of this envelope; always draft-2020-12." }),
    schema: NodeCodec.annotateKey({
      description: "Root schema of the document (object form; the envelope has no boolean root).",
    }),
    definitions: S.Record(S.String, NodeCodec)
      .pipe(SchemaUtils.withKeyDefaults({}))
      .annotateKey({ description: "Definitions hoisted out of the root schema, keyed by definition name." }),
  },
  $I.annote("Document", {
    description: "Draft-2020-12 document envelope: dialect, root schema, and hoisted definitions.",
  })
) {
  /**
   * Guard for decoded {@link Document} instances.
   *
   * @since 0.0.0
   */
  static readonly is = S.is(Document);
}

/**
 * Types for {@link Document}.
 *
 * @example
 * ```ts
 * import { Document } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const wire: Document.Encoded = { schema: { type: "object" } }
 * const decoded: Document.Type = S.decodeUnknownSync(Document)(wire)
 * console.log(decoded.dialect)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Document {
  /**
   * Runtime form of the envelope.
   *
   * @since 0.0.0
   */
  export interface Type {
    readonly definitions: { readonly [name: string]: Node.Type };
    readonly dialect: "draft-2020-12";
    readonly schema: Node.Type;
  }

  /**
   * Wire form of the envelope.
   *
   * @since 0.0.0
   */
  export interface Encoded {
    readonly definitions?: { readonly [name: string]: Node.Encoded };
    readonly dialect?: "draft-2020-12";
    readonly schema: Node.Encoded;
  }
}

const localDefsRefPrefix = "#/$defs/";

const decodePointerSegment = F.flow(Str.replace(/~1/g, "/"), Str.replace(/~0/g, "~"));

const isSingleSegment = (segment: string): boolean => Str.isNonEmpty(segment) && !Str.includes("/")(segment);

/**
 * Resolves a local single-hop `#/$defs/<key>` reference against a definitions
 * record. The single supported shape matches everything the repo emits and
 * consumes today; multi-segment pointers, anchors, dynamic references, and
 * remote URIs deliberately resolve to `Option.none`, as do missing keys.
 *
 * @example
 * ```ts
 * import { resolveLocalRef } from "@beep/schema/JSONSchema"
 * import * as O from "effect/Option"
 *
 * const defs = { "a/b": true }
 * console.log(O.getOrNull(resolveLocalRef("#/$defs/a~1b", defs)))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const resolveLocalRef: {
  <Value>(definitions: { readonly [key: string]: Value }): (ref: string) => O.Option<Value>;
  <Value>(ref: string, definitions: { readonly [key: string]: Value }): O.Option<Value>;
} = F.dual(
  2,
  <Value>(ref: string, definitions: { readonly [key: string]: Value }): O.Option<Value> =>
    F.pipe(
      O.some(ref),
      O.filter(Str.startsWith(localDefsRefPrefix)),
      O.map(Str.slice(localDefsRefPrefix.length)),
      O.filter(isSingleSegment),
      O.map(decodePointerSegment),
      O.flatMap((key) => R.get(definitions, key))
    )
);

/**
 * Resolves a node's own `$ref` against its sibling `$defs` in a single hop —
 * the exact shape MCP tool schemas use. Returns `Option.none` when either
 * keyword is absent or the reference does not point into the sibling `$defs`.
 *
 * @example
 * ```ts
 * import { NodeCodec, resolveNodeRef } from "@beep/schema/JSONSchema"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownSync(NodeCodec)({
 *   $ref: "#/$defs/User",
 *   $defs: { User: { type: "object" } },
 * })
 * console.log(O.isSome(resolveNodeRef(node)))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const resolveNodeRef = (node: Node.Type): O.Option<SubSchema.Type> =>
  F.pipe(
    O.all({ ref: node.$ref, definitions: node.$defs }),
    O.flatMap(({ definitions, ref }) => resolveLocalRef(ref, definitions))
  );

/**
 * Resolves a document's top-level `$ref` against its hoisted definitions,
 * mirroring effect's `JsonSchema.resolveTopLevel$ref`. Returns `Option.none`
 * when the root schema has no `$ref` or the target is missing.
 *
 * @example
 * ```ts
 * import { Document, resolveDocumentRef } from "@beep/schema/JSONSchema"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(Document)({
 *   dialect: "draft-2020-12",
 *   schema: { $ref: "#/$defs/User" },
 *   definitions: { User: { type: "object" } },
 * })
 * console.log(O.isSome(resolveDocumentRef(document)))
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const resolveDocumentRef = (document: Document): O.Option<Node> =>
  F.pipe(
    document.schema.$ref,
    O.flatMap((ref) => resolveLocalRef(ref, document.definitions))
  );
