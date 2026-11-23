/**
 * RDF/JS-aligned value families for `@beep/rdf`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $RdfId } from "@beep/identity/packages";
import { namespace } from "@beep/identity/Registry";
import { A, R, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata/index.ts";
import type { RegistryPrefix } from "@beep/identity/Registry";

const $I = $RdfId.create("rdf");

const namespaceBindingMetadata = makeSemanticSchemaMetadata({
  kind: "rdfConstruct",
  canonicalName: "NamespaceBinding",
  overview: "Prefix-to-IRI binding used for RDF compaction and expansion.",
  status: "stable",
  specifications: [
    {
      name: "RDF 1.1 Concepts",
      section: "6",
      disposition: "informative",
    },
  ],
  equivalenceBasis: "String equality over prefix and namespace pairs.",
});

const namedNodeMetadata = makeSemanticSchemaMetadata({
  kind: "rdfConstruct",
  canonicalName: "NamedNode",
  overview: "RDF named node aligned with the RDF/JS data-model surface.",
  status: "stable",
  specifications: [
    {
      name: "RDF/JS Data Model",
      section: "NamedNode",
      disposition: "normative",
    },
  ],
  canonicalizationRequired: true,
  equivalenceBasis: "IRI equality after identifier-level normalization when callers request normalization.",
  representations: [
    { kind: "RDF/JS" },
    {
      kind: "JSON-LD",
      note: "Used for compacted and expanded identifiers.",
    },
  ],
});

const literalMetadata = makeSemanticSchemaMetadata({
  kind: "rdfConstruct",
  canonicalName: "Literal",
  overview: "RDF literal value with explicit lexical form, datatype, and optional language tag.",
  status: "stable",
  specifications: [
    {
      name: "RDF/JS Data Model",
      section: "Literal",
      disposition: "normative",
    },
  ],
  equivalenceBasis: "Lexical form, datatype, and optional language-tag equality.",
  representations: [{ kind: "RDF/JS" }, { kind: "JSON-LD" }],
});

const quadMetadata = makeSemanticSchemaMetadata({
  kind: "rdfConstruct",
  canonicalName: "Quad",
  overview: "RDF statement value aligned with the RDF/JS quad surface.",
  status: "stable",
  specifications: [
    {
      name: "RDF/JS Data Model",
      section: "Quad",
      disposition: "normative",
    },
  ],
  equivalenceBasis: "Subject, predicate, object, and graph equality by RDF term serialization.",
  canonicalizationRequired: true,
  representations: [
    { kind: "RDF/JS" },
    {
      kind: "JSON-LD",
      note: "Produced by JSON-LD bridging.",
    },
  ],
});

const datasetMetadata = makeSemanticSchemaMetadata({
  kind: "rdfConstruct",
  canonicalName: "Dataset",
  overview: "Collection of RDF quads used as the package's RDF interoperability layer.",
  status: "stable",
  specifications: [
    {
      name: "RDF/JS DatasetCore",
      disposition: "informative",
    },
  ],
  equivalenceBasis: "Sorted quad serialization equality.",
  canonicalizationRequired: true,
  representations: [{ kind: "RDF/JS" }, { kind: "TriG" }],
});

const PrefixLabelChecks = S.makeFilterGroup(
  [
    S.isPattern(
      /^(?:|[A-Za-z][A-Za-z0-9._-]*)$/,
      $I.annote("PrefixLabelPatternCheck", {
        title: "Prefix Label Pattern",
        description: "A prefixed-name label or empty default-prefix label used in RDF namespace bindings.",
        message:
          "Prefix labels must be empty for the default prefix or begin with an ASCII letter and then use letters, digits, dot, underscore, or hyphen",
      })
    ),
  ],
  $I.annote("PrefixLabelChecks", {
    title: "Prefix Label",
    description: "Checks for RDF prefix labels.",
  })
);

const LanguageTagChecks = S.makeFilterGroup(
  [
    S.isPattern(
      /^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/,
      $I.annote("LanguageTagPatternCheck", {
        title: "Language Tag Pattern",
        description: "A simple BCP 47-style language tag.",
        message: "Language tags must use alphanumeric subtags separated by hyphens",
      })
    ),
  ],
  $I.annote("LanguageTagChecks", {
    title: "Language Tag",
    description: "Checks for RDF literal language tags.",
  })
);

const BlankNodeLabelChecks = S.makeFilterGroup(
  [
    S.isNonEmpty(
      $I.annote("BlankNodeLabelNonEmptyCheck", {
        title: "Blank Node Label Non Empty",
        description: "Blank node labels must not be empty.",
        message: "Blank node labels must not be empty",
      })
    ),
    S.isTrimmed(
      $I.annote("BlankNodeLabelTrimmedCheck", {
        title: "Blank Node Label Trimmed",
        description: "Blank node labels must not contain leading or trailing whitespace.",
        message: "Blank node labels must not contain leading or trailing whitespace",
      })
    ),
  ],
  $I.annote("BlankNodeLabelChecks", {
    title: "Blank Node Label",
    description: "Checks for blank node labels.",
  })
);

const BlankNodeLabel = S.String.check(BlankNodeLabelChecks).pipe(
  $I.annoteSchema("BlankNodeLabel", {
    description: "Blank node label accepted by RDF/JS blank nodes.",
  })
);

/**
 * Prefix label used by RDF namespace bindings.
 *
 * **Example** (Decode prefix labels)
 *
 * ```ts import.meta.vitest name="Decode prefix labels"
 * import * as S from "effect/Schema"
 * import { PrefixLabel } from "@beep/rdf/Rdf"
 *
 * const decoded = S.decodeUnknownSync(PrefixLabel)("schema")
 * const defaultPrefix = S.decodeUnknownSync(PrefixLabel)("")
 * decoded // => "schema"
 * defaultPrefix // => ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrefixLabel = S.String.check(PrefixLabelChecks).pipe(
  S.brand("PrefixLabel"),
  $I.annoteSchema("PrefixLabel", {
    description: "Prefix label used by RDF namespace bindings.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "identifier",
      canonicalName: "PrefixLabel",
      overview: "Prefix label used by RDF namespace bindings.",
      status: "stable",
      specifications: [
        {
          name: "RDF 1.1 Concepts",
          disposition: "informative",
        },
      ],
      equivalenceBasis: "Exact string equality; the empty string denotes the default prefix.",
    }),
  })
);

/**
 * Type for {@link PrefixLabel}.
 *
 * **Example** (Accept PrefixLabel type)
 *
 * ```ts
 * import type { PrefixLabel } from "@beep/rdf/Rdf"
 *
 * const acceptPrefixLabel = (value: PrefixLabel) => value
 * console.log(acceptPrefixLabel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrefixLabel = typeof PrefixLabel.Type;

const PrefixMapKeyChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      (prefixes: Readonly<Record<string, unknown>>) =>
        R.every(prefixes, (_namespace, prefix) => S.is(PrefixLabel)(prefix)),
      $I.annote("PrefixMapKeyCheck", {
        title: "Prefix Map Keys",
        description: "Prefix maps must use RDF prefix labels for every key.",
        message:
          "Prefix labels must be empty for the default prefix or begin with an ASCII letter and then use letters, digits, dot, underscore, or hyphen",
      })
    ),
  ],
  $I.annote("PrefixMapKeyChecks", {
    title: "Prefix Map Keys",
    description: "Checks for RDF prefix map keys.",
  })
);

/**
 * RDF literal language tag.
 *
 * **Example** (Decode language tag)
 *
 * ```ts import.meta.vitest name="Decode language tag"
 * import * as S from "effect/Schema"
 * import { LanguageTag } from "@beep/rdf/Rdf"
 *
 * const tag = S.decodeUnknownSync(LanguageTag)("en-US")
 * tag // => "en-US"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LanguageTag = S.String.check(LanguageTagChecks).pipe(
  S.brand("LanguageTag"),
  $I.annoteSchema("LanguageTag", {
    description: "RDF literal language tag.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "rdfConstruct",
      canonicalName: "LanguageTag",
      overview: "Language tag attached to RDF literals.",
      status: "stable",
      specifications: [
        {
          name: "RDF 1.1 Concepts",
          section: "Language-Tagged Strings",
          disposition: "normative",
        },
      ],
      equivalenceBasis: "Lower-cased language-tag equality.",
    }),
  })
);

/**
 * Type for {@link LanguageTag}.
 *
 * **Example** (Accept LanguageTag type)
 *
 * ```ts
 * import type { LanguageTag } from "@beep/rdf/Rdf"
 *
 * const acceptLanguageTag = (value: LanguageTag) => value
 * console.log(acceptLanguageTag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LanguageTag = typeof LanguageTag.Type;

/**
 * RDF named node value.
 *
 * **Example** (Decode named node)
 *
 * ```ts import.meta.vitest name="Decode named node"
 * import * as S from "effect/Schema"
 * import { NamedNode } from "@beep/rdf/Rdf"
 *
 * const node = S.decodeUnknownSync(NamedNode)({
 *   termType: "NamedNode",
 *   value: "https://example.org/person/alice"
 * })
 * node.termType // => "NamedNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NamedNode extends S.Opaque<NamedNode, { readonly brand: unique symbol }>()(
  S.Struct({
    termType: S.tag("NamedNode"),
    value: IRI,
  }).pipe(
    $I.annoteSchema("NamedNode", {
      description: "RDF named node value aligned with RDF/JS.",
      semanticSchemaMetadata: namedNodeMetadata,
    })
  )
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);

  static readonly decodeEffect = S.decodeEffect(NamedNode);

  static readonly is = S.is(NamedNode);
}

/**
 * RDF blank node value.
 *
 * **Example** (Decode blank node)
 *
 * ```ts import.meta.vitest name="Decode blank node"
 * import * as S from "effect/Schema"
 * import { BlankNode } from "@beep/rdf/Rdf"
 *
 * const node = S.decodeUnknownSync(BlankNode)({
 *   termType: "BlankNode",
 *   value: "b0"
 * })
 * node.value // => "b0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlankNode extends S.Opaque<BlankNode, { readonly brand: unique symbol }>()(
  S.Struct({
    termType: S.tag("BlankNode"),
    value: BlankNodeLabel,
  }).pipe(
    $I.annoteSchema("BlankNode", {
      description: "RDF blank node value aligned with RDF/JS.",
      semanticSchemaMetadata: makeSemanticSchemaMetadata({
        kind: "rdfConstruct",
        canonicalName: "BlankNode",
        overview: "RDF blank node value aligned with the RDF/JS data-model surface.",
        status: "stable",
        specifications: [
          {
            name: "RDF/JS Data Model",
            section: "BlankNode",
            disposition: "normative",
          },
        ],
        equivalenceBasis: "Blank-node label equality within a bounded dataset.",
        canonicalizationRequired: true,
        representations: [{ kind: "RDF/JS" }, { kind: "TriG" }],
      }),
    })
  )
) {}

/**
 * RDF literal value.
 *
 * **Example** (Decode RDF literal)
 *
 * ```ts import.meta.vitest name="Decode RDF literal"
 * import * as S from "effect/Schema"
 * import { Literal } from "@beep/rdf/Rdf"
 *
 * const literal = S.decodeUnknownSync(Literal)({
 *   termType: "Literal",
 *   value: "Alice",
 *   language: "en",
 *   datatype: { termType: "NamedNode", value: "http://www.w3.org/2001/XMLSchema#string" }
 * })
 * literal.termType // => "Literal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Literal extends S.Opaque<Literal, { readonly brand: unique symbol }>()(
  S.Struct({
    termType: S.tag("Literal"),
    value: S.String,
    language: S.OptionFromOptionalKey(LanguageTag).pipe(S.withConstructorDefault(Effect.succeedNone)),
    datatype: NamedNode,
  }).pipe(
    $I.annoteSchema("Literal", {
      description: "RDF literal value aligned with RDF/JS.",
      semanticSchemaMetadata: literalMetadata,
    })
  )
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);

  static readonly is = S.is(Literal);
}

/**
 * RDF default graph term.
 *
 * **Example** (Decode default graph)
 *
 * ```ts import.meta.vitest name="Decode default graph"
 * import * as S from "effect/Schema"
 * import { DefaultGraph } from "@beep/rdf/Rdf"
 *
 * const graph = S.decodeUnknownSync(DefaultGraph)({
 *   termType: "DefaultGraph",
 *   value: ""
 * })
 * graph.value // => ""
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DefaultGraph extends S.Opaque<DefaultGraph, { readonly brand: unique symbol }>()(
  S.Struct({
    termType: S.tag("DefaultGraph"),
    value: S.tag(""),
  }).pipe(
    $I.annoteSchema("DefaultGraph", {
      description: "RDF default graph term aligned with RDF/JS.",
      semanticSchemaMetadata: makeSemanticSchemaMetadata({
        kind: "rdfConstruct",
        canonicalName: "DefaultGraph",
        overview: "Default graph term aligned with the RDF/JS data-model surface.",
        status: "stable",
        specifications: [
          {
            name: "RDF/JS Data Model",
            section: "DefaultGraph",
            disposition: "normative",
          },
        ],
        equivalenceBasis: "Exact empty-string value equality.",
      }),
    })
  )
) {}

const TermDefinition = S.Union([NamedNode, BlankNode, Literal, DefaultGraph]);
const TermUntagged = TermDefinition.pipe(
  $I.annoteSchema("Term", {
    description: "RDF term union aligned with RDF/JS.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "rdfConstruct",
      canonicalName: "Term",
      overview: "RDF term union aligned with the RDF/JS data-model surface.",
      status: "stable",
      specifications: [
        {
          name: "RDF/JS Data Model",
          section: "Term",
          disposition: "normative",
        },
      ],
      equivalenceBasis: "Term-type aware serialized equality.",
      canonicalizationRequired: true,
      representations: [{ kind: "RDF/JS" }, { kind: "JSON-LD" }],
    }),
  })
);

/**
 * RDF term union.
 *
 * **Example** (Decode term union)
 *
 * ```ts import.meta.vitest name="Decode term union"
 * import * as S from "effect/Schema"
 * import { Term } from "@beep/rdf/Rdf"
 *
 * const term = S.decodeUnknownSync(Term)({
 *   termType: "NamedNode",
 *   value: "https://example.org/person/alice"
 * })
 * term.termType // => "NamedNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Term = TermUntagged.pipe(S.toTaggedUnion("termType"));

/**
 * Type for {@link Term}.
 *
 * **Example** (Accept Term type)
 *
 * ```ts
 * import type { Term } from "@beep/rdf/Rdf"
 *
 * const acceptTerm = (value: Term) => value
 * console.log(acceptTerm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Term = typeof Term.Type;

const SubjectDefinition = S.Union([NamedNode, BlankNode]);
const SubjectUntagged = SubjectDefinition.pipe($I.annoteSchema("Subject", { description: "RDF subject term union." }));

/**
 * RDF subject term union.
 *
 * **Example** (Decode subject term)
 *
 * ```ts import.meta.vitest name="Decode subject term"
 * import * as S from "effect/Schema"
 * import { Subject } from "@beep/rdf/Rdf"
 *
 * const subject = S.decodeUnknownSync(Subject)({
 *   termType: "BlankNode",
 *   value: "subject0"
 * })
 * subject.termType // => "BlankNode"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Subject = SubjectUntagged.pipe(S.toTaggedUnion("termType"));

/**
 * Type for {@link Subject}.
 *
 * **Example** (Accept Subject type)
 *
 * ```ts
 * import type { Subject } from "@beep/rdf/Rdf"
 *
 * const acceptSubject = (value: Subject) => value
 * console.log(acceptSubject)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Subject = typeof Subject.Type;

const ObjectTermDefinition = S.Union([NamedNode, BlankNode, Literal]);
const ObjectTermUntagged = ObjectTermDefinition.pipe(
  $I.annoteSchema("ObjectTerm", {
    description: "RDF object term union.",
  })
);

/**
 * RDF object term union.
 *
 * **Example** (Decode object term)
 *
 * ```ts import.meta.vitest name="Decode object term"
 * import * as S from "effect/Schema"
 * import { ObjectTerm } from "@beep/rdf/Rdf"
 *
 * const object = S.decodeUnknownSync(ObjectTerm)({
 *   termType: "Literal",
 *   value: "Alice",
 *   datatype: { termType: "NamedNode", value: "http://www.w3.org/2001/XMLSchema#string" }
 * })
 * object.termType // => "Literal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectTerm = ObjectTermUntagged.pipe(S.toTaggedUnion("termType"));

/**
 * Type for {@link ObjectTerm}.
 *
 * **Example** (Accept ObjectTerm type)
 *
 * ```ts
 * import type { ObjectTerm } from "@beep/rdf/Rdf"
 *
 * const acceptObjectTerm = (value: ObjectTerm) => value
 * console.log(acceptObjectTerm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectTerm = typeof ObjectTerm.Type;

const GraphTermDefinition = S.Union([NamedNode, BlankNode, DefaultGraph]);
const GraphTermUntagged = GraphTermDefinition.pipe(
  $I.annoteSchema("GraphTerm", {
    description: "RDF graph term union.",
  })
);

/**
 * RDF graph term union.
 *
 * **Example** (Decode graph term)
 *
 * ```ts import.meta.vitest name="Decode graph term"
 * import * as S from "effect/Schema"
 * import { GraphTerm } from "@beep/rdf/Rdf"
 *
 * const graph = S.decodeUnknownSync(GraphTerm)({
 *   termType: "DefaultGraph",
 *   value: ""
 * })
 * graph.termType // => "DefaultGraph"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GraphTerm = GraphTermUntagged.pipe(S.toTaggedUnion("termType"));

/**
 * Type for {@link GraphTerm}.
 *
 * **Example** (Accept GraphTerm type)
 *
 * ```ts
 * import type { GraphTerm } from "@beep/rdf/Rdf"
 *
 * const acceptGraphTerm = (value: GraphTerm) => value
 * console.log(acceptGraphTerm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GraphTerm = typeof GraphTerm.Type;

/**
 * RDF quad value aligned with RDF/JS.
 *
 * **Example** (Decode RDF quad)
 *
 * ```ts import.meta.vitest name="Decode RDF quad"
 * import * as S from "effect/Schema"
 * import { Quad } from "@beep/rdf/Rdf"
 *
 * const quad = S.decodeUnknownSync(Quad)({
 *   subject: { termType: "NamedNode", value: "https://example.org/person/alice" },
 *   predicate: { termType: "NamedNode", value: "https://schema.org/name" },
 *   object: {
 *     termType: "Literal",
 *     value: "Alice",
 *     datatype: { termType: "NamedNode", value: "http://www.w3.org/2001/XMLSchema#string" }
 *   },
 *   graph: { termType: "DefaultGraph", value: "" }
 * })
 * quad.predicate.value // => "https://schema.org/name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Quad extends S.Opaque<Quad, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: Subject,
    predicate: NamedNode,
    object: ObjectTerm,
    graph: GraphTerm,
  }).pipe(
    $I.annoteSchema("Quad", {
      description: "RDF quad value aligned with RDF/JS.",
      semanticSchemaMetadata: quadMetadata,
    })
  )
) {}

/**
 * Dataset wrapper for RDF quads.
 *
 * **Example** (Build dataset from quads)
 *
 * ```ts import.meta.vitest name="Build dataset from quads"
 * import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/person/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * const dataset = makeDataset([quad])
 * dataset.quads.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Dataset extends S.Opaque<Dataset, { readonly brand: unique symbol }>()(
  S.Struct({
    quads: S.Array(Quad),
  }).pipe(
    $I.annoteSchema("Dataset", {
      description: "Dataset wrapper for RDF quads.",
      semanticSchemaMetadata: datasetMetadata,
    })
  )
) {
  static readonly is = S.is(Dataset);
}

/**
 * Prefix-to-namespace binding for RDF compaction and expansion.
 *
 * **Example** (Decode namespace binding)
 *
 * ```ts import.meta.vitest name="Decode namespace binding"
 * import * as S from "effect/Schema"
 * import { NamespaceBinding } from "@beep/rdf/Rdf"
 *
 * const binding = S.decodeUnknownSync(NamespaceBinding)({
 *   prefix: "schema",
 *   namespace: "https://schema.org/"
 * })
 * binding.prefix // => "schema"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NamespaceBinding extends S.Opaque<NamespaceBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: PrefixLabel,
    namespace: IRI,
  }).pipe(
    $I.annoteSchema("NamespaceBinding", {
      description: "Prefix-to-namespace binding for RDF compaction and expansion.",
      semanticSchemaMetadata: namespaceBindingMetadata,
    })
  )
) {}

/**
 * Prefix map keyed by {@link PrefixLabel}.
 *
 * **Example** (Decode prefix map)
 *
 * ```ts import.meta.vitest name="Decode prefix map"
 * import * as S from "effect/Schema"
 * import { PrefixMap } from "@beep/rdf/Rdf"
 *
 * const prefixes = S.decodeUnknownSync(PrefixMap)({
 *   schema: "https://schema.org/"
 * })
 * Object.keys(prefixes) // => ["schema"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrefixMap = S.Record(S.String, IRI).pipe(
  S.check(PrefixMapKeyChecks),
  S.decodeTo(S.Record(PrefixLabel, IRI)),
  $I.annoteSchema("PrefixMap", {
    description: "Prefix map keyed by RDF prefix labels.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "rdfConstruct",
      canonicalName: "PrefixMap",
      overview: "Prefix-to-namespace bindings used for RDF compaction and expansion.",
      status: "stable",
      specifications: [
        {
          name: "RDF 1.1 Concepts",
          section: "6",
          disposition: "informative",
        },
      ],
      equivalenceBasis: "Prefix and namespace string equality.",
    }),
  })
);

/**
 * Type for {@link PrefixMap}.
 *
 * **Example** (Accept PrefixMap type)
 *
 * ```ts
 * import type { PrefixMap } from "@beep/rdf/Rdf"
 *
 * const acceptPrefixMap = (value: PrefixMap) => value
 * console.log(acceptPrefixMap)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrefixMap = typeof PrefixMap.Type;

/**
 * Build a prefix map from namespaces of the identity registry.
 *
 * **When to use**
 *
 * Use to give a serializer the prefixes it may print, so every prefix label
 * and namespace IRI comes from the one registry instead of a local literal.
 *
 * **Example** (Build a prefix map from registry namespaces)
 *
 * ```ts import.meta.vitest name="Build a prefix map from registry namespaces"
 * import * as R from "effect/Record"
 * import { prefixMapFromRegistry } from "@beep/rdf/Rdf"
 *
 * const prefixes = prefixMapFromRegistry(["rdf", "xsd"])
 * R.values(prefixes) // => ["http://www.w3.org/1999/02/22-rdf-syntax-ns#", "http://www.w3.org/2001/XMLSchema#"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const prefixMapFromRegistry = (prefixes: ReadonlyArray<RegistryPrefix>): PrefixMap =>
  R.fromEntries(A.map(prefixes, (prefix) => [PrefixLabel.make(prefix), IRI.make(namespace(prefix).iri)] as const));

/**
 * Build a named node from an IRI string.
 *
 * **Example** (Create named node)
 *
 * ```ts import.meta.vitest name="Create named node"
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const node = makeNamedNode("https://schema.org/Person")
 * node.termType // => "NamedNode"
 * node.value // => "https://schema.org/Person"
 * ```
 *
 * @param value - Named node IRI.
 * @returns Decoded named node.
 * @category utilities
 * @since 0.0.0
 */
export const makeNamedNode = (value: string): NamedNode =>
  pipe(
    NamedNode.decodeUnknownResult({
      termType: "NamedNode",
      value,
    }),
    Result.getOrThrow
  );

/**
 * Build a blank node from a non-empty label.
 *
 * **Example** (Create blank node)
 *
 * ```ts import.meta.vitest name="Create blank node"
 * import { makeBlankNode } from "@beep/rdf/Rdf"
 *
 * const node = makeBlankNode("b0")
 * node.termType // => "BlankNode"
 * node.value // => "b0"
 * ```
 *
 * @param value - Blank node label.
 * @returns Decoded blank node.
 * @category utilities
 * @since 0.0.0
 */
export const makeBlankNode = (value: string): BlankNode =>
  BlankNode.make({
    termType: "BlankNode",
    value: Result.getOrThrow(S.decodeResult(BlankNodeLabel)(value)),
  });

/**
 * Optional language settings for {@link makeLiteral}.
 *
 * **Example** (Literal language options)
 *
 * ```ts
 * import { MakeLiteralOptions } from "@beep/rdf/Rdf"
 * import * as O from "effect/Option"
 *
 * const options = MakeLiteralOptions.make({ language: O.some("en") })
 * console.log(options)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class MakeLiteralOptions extends S.Opaque<MakeLiteralOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    language: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("MakeLiteralOptions", {
      description: "Optional language settings for makeLiteral.",
    })
  )
) {}

/**
 * Constructor input accepted by {@link makeLiteral}.
 *
 * **Example** (Type literal options input)
 *
 * ```ts
 * import type { MakeLiteralOptionsInput } from "@beep/rdf/Rdf"
 *
 * const options: MakeLiteralOptionsInput = { language: "en" }
 * console.log(options.language)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type MakeLiteralOptionsInput = typeof MakeLiteralOptions.Encoded;

const isMakeLiteralDataFirst = (args: IArguments): boolean => args.length >= 2 && P.isString(args[1]);

const makeLiteralInternal = (value: string, datatype: string, options: MakeLiteralOptionsInput = {}): Literal =>
  pipe(
    Literal.decodeUnknownResult({
      termType: "Literal",
      value,
      datatype: makeNamedNode(datatype),
      ...O.getSomesStruct({ language: O.fromUndefinedOr(options.language) }),
    }),
    Result.getOrThrow
  );

/**
 * Build an RDF literal.
 *
 * **Example** (Create RDF literal)
 *
 * ```ts import.meta.vitest name="Create RDF literal"
 * import { makeLiteral } from "@beep/rdf/Rdf"
 *
 * const lit = makeLiteral("hello", "http://www.w3.org/2001/XMLSchema#string", { language: "en" })
 * lit.termType // => "Literal"
 * lit.value // => "hello"
 * ```
 *
 * @param value - Lexical form.
 * @param datatype - Datatype IRI.
 * @param options - Optional literal settings; pass the language tag as
 * `{ language }` rather than a bare string.
 * @returns Decoded RDF literal.
 * @category utilities
 * @since 0.0.0
 */
export const makeLiteral: {
  (value: string, datatype: string): Literal;
  (value: string, datatype: string, options: MakeLiteralOptionsInput): Literal;
  (datatype: string): (value: string) => Literal;
  (datatype: string, options: MakeLiteralOptionsInput): (value: string) => Literal;
} = dual(isMakeLiteralDataFirst, makeLiteralInternal);

/**
 * Object and optional graph settings for {@link makeQuad}.
 *
 * **Example** (Accept MakeQuadOptions type)
 *
 * ```ts
 * import type { MakeQuadOptions } from "@beep/rdf/Rdf"
 *
 * const acceptOptions = (options: MakeQuadOptions) => options
 * console.log(acceptOptions)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class MakeQuadOptions extends S.Opaque<MakeQuadOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    object: ObjectTerm,
    graph: GraphTerm.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("MakeQuadOptions", {
      description: "Object and optional graph settings for makeQuad.",
    })
  )
) {}

/**
 * Constructor input accepted by {@link makeQuad}.
 *
 * **Example** (Type quad options input)
 *
 * ```ts
 * import { MakeQuadOptionsInput, makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const options = MakeQuadOptionsInput.make({
 *   object: makeNamedNode("https://example.org/object")
 * })
 * console.log(options.object)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class MakeQuadOptionsInput extends S.Opaque<MakeQuadOptionsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    object: ObjectTerm,
    graph: GraphTerm.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("MakeQuadOptionsInput", {
      description: "In-memory object and optional graph input accepted by makeQuad.",
    })
  )
) {}

const isMakeQuadOptions = (input: ObjectTerm | MakeQuadOptionsInput): input is MakeQuadOptionsInput =>
  P.hasProperty(input, "object");

const makeDefaultGraph = (): DefaultGraph =>
  DefaultGraph.make({
    termType: "DefaultGraph",
    value: "",
  });

/**
 * Build an RDF quad.
 *
 * **Example** (Create RDF quad)
 *
 * ```ts import.meta.vitest name="Create RDF quad"
 * import { makeNamedNode, makeLiteral, makeQuad } from "@beep/rdf/Rdf"
 *
 * const subject = makeNamedNode("https://example.org/alice")
 * const predicate = makeNamedNode("https://schema.org/name")
 * const object = makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * const quad = makeQuad(subject, predicate, object)
 * quad.subject.value // => "https://example.org/alice"
 * ```
 *
 * @param subject - Subject term.
 * @param predicate - Predicate term.
 * @param options - Object term or object/graph settings.
 * @returns Decoded quad.
 * @category utilities
 * @since 0.0.0
 */
export const makeQuad: {
  (subject: Subject, predicate: NamedNode, object: ObjectTerm): Quad;
  (subject: Subject, predicate: NamedNode, options: MakeQuadOptionsInput): Quad;
  (predicate: NamedNode, object: ObjectTerm): (subject: Subject) => Quad;
  (predicate: NamedNode, options: MakeQuadOptionsInput): (subject: Subject) => Quad;
} = dual(
  3,
  (subject: Subject, predicate: NamedNode, input: ObjectTerm | MakeQuadOptionsInput): Quad =>
    Quad.make({
      subject,
      predicate,
      object: isMakeQuadOptions(input) ? input.object : input,
      graph: isMakeQuadOptions(input)
        ? pipe(input.graph, O.fromUndefinedOr, O.getOrElse(makeDefaultGraph))
        : makeDefaultGraph(),
    })
);

/**
 * Build a dataset from quads.
 *
 * **Example** (Create dataset from quads)
 *
 * ```ts import.meta.vitest name="Create dataset from quads"
 * import { makeNamedNode, makeLiteral, makeQuad, makeDataset } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * const dataset = makeDataset([quad])
 * dataset.quads.length // => 1
 * ```
 *
 * @param quads - Input quads.
 * @returns Decoded dataset.
 * @category utilities
 * @since 0.0.0
 */
export const makeDataset = (quads: ReadonlyArray<Quad>): Dataset => Dataset.make({ quads: A.fromIterable(quads) });

// Escape an RDF literal lexical form for the N-Triples/N-Quads `STRING_LITERAL_QUOTE`
// production so attacker-controlled quotes, backslashes, or control characters cannot
// close the quoted string and inject additional statements. A single pass keeps the
// mapping order-independent (the backslash branch never re-matches its own output).
const escapeLiteralLexical: (value: string) => string = Str.replaceAllWith(/[\\"\n\r\t\b\f]/g, (ch) =>
  Match.value(ch).pipe(
    Match.when("\\", () => "\\\\"),
    Match.when('"', () => '\\"'),
    Match.when("\n", () => "\\n"),
    Match.when("\r", () => "\\r"),
    Match.when("\t", () => "\\t"),
    Match.when("\b", () => "\\b"),
    Match.when("\f", () => "\\f"),
    Match.orElse(() => ch)
  )
);

// Encode a single out-of-grammar character into a `_uXXXX` escape. The output only ever
// contains `[A-Za-z0-9_]`, all of which are valid in an N-Triples `BLANK_NODE_LABEL`.
const toBlankNodeEscape = (ch: string): string =>
  pipe(
    Str.codePointAt(0)(ch),
    O.match({
      onNone: () => ch,
      onSome: (code) => `_u${pipe(code.toString(16), Str.toUpperCase, Str.padStart(4, "0"))}`,
    })
  );

// Encode an RDF blank-node label into a deterministic, grammar-safe form. Blank-node
// labels have no in-grammar escape mechanism, so any character outside `[A-Za-z0-9]`
// (including statement delimiters and whitespace) is percent-style encoded, preventing
// raw-label injection while preserving ordinary alphanumeric labels unchanged.
const encodeBlankNodeLabel: (value: string) => string = Str.replaceAllWith(/[^A-Za-z0-9]/g, toBlankNodeEscape);

/**
 * Serialize an RDF term to a deterministic lexical form.
 *
 * **Example** (Serialize named node term)
 *
 * ```ts
 * import { makeNamedNode, serializeTerm } from "@beep/rdf/Rdf"
 *
 * const serialized = serializeTerm(makeNamedNode("https://example.org/x"))
 * console.log(serialized) // "<https://example.org/x>"
 * ```
 *
 * @param term - RDF term.
 * @returns Deterministic term serialization.
 * @category utilities
 * @since 0.0.0
 */
export const serializeTerm = (term: Term): string =>
  Term.match(term, {
    NamedNode: (value) => `<${value.value}>`,
    BlankNode: (value) => `_:${encodeBlankNodeLabel(value.value)}`,
    Literal: (value) =>
      O.isSome(value.language)
        ? `"${escapeLiteralLexical(value.value)}"@${Str.toLowerCase(value.language.value)}`
        : `"${escapeLiteralLexical(value.value)}"^^<${value.datatype.value}>`,
    DefaultGraph: () => "default",
  });

/**
 * Serialize an RDF quad to a deterministic lexical form.
 *
 * **Example** (Serialize RDF quad)
 *
 * ```ts import.meta.vitest name="Serialize RDF quad"
 * import { makeNamedNode, makeLiteral, makeQuad, serializeQuad } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * typeof serializeQuad(quad) // => "string"
 * ```
 *
 * @param quad - RDF quad.
 * @returns Deterministic quad serialization.
 * @category utilities
 * @since 0.0.0
 */
export const serializeQuad = (quad: Quad): string =>
  `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)} ${serializeTerm(quad.object)} ${serializeTerm(quad.graph)} .`;

const byQuadLexicalAscending: Order.Order<Quad> = Order.mapInput(Order.String, serializeQuad);

/**
 * Sort dataset quads by deterministic quad serialization.
 *
 * **Example** (Sort empty dataset quads)
 *
 * ```ts import.meta.vitest name="Sort empty dataset quads"
 * import { makeDataset, sortDatasetQuads } from "@beep/rdf/Rdf"
 *
 * const dataset = makeDataset([])
 * const sorted = sortDatasetQuads(dataset)
 * sorted.length // => 0
 * ```
 *
 * @param dataset - RDF dataset.
 * @returns Sorted quad array.
 * @category utilities
 * @since 0.0.0
 */
export const sortDatasetQuads = (dataset: Dataset): ReadonlyArray<Quad> =>
  A.sort(dataset.quads, byQuadLexicalAscending);

/**
 * Compare datasets by sorted quad serialization.
 *
 * **Example** (Compare empty datasets)
 *
 * ```ts import.meta.vitest name="Compare empty datasets"
 * import { makeDataset, areDatasetsEquivalent } from "@beep/rdf/Rdf"
 *
 * const a = makeDataset([])
 * const b = makeDataset([])
 * areDatasetsEquivalent(a, b) // => true
 * ```
 *
 * @param left - Left dataset.
 * @param right - Right dataset.
 * @returns `true` when both datasets share the same sorted quad serialization.
 * @category utilities
 * @since 0.0.0
 */
export const areDatasetsEquivalent: {
  (right: Dataset): (left: Dataset) => boolean;
  (left: Dataset, right: Dataset): boolean;
} = dual(
  2,
  (left: Dataset, right: Dataset): boolean =>
    pipe(sortDatasetQuads(left), A.map(serializeQuad), A.join("\n")) ===
    pipe(sortDatasetQuads(right), A.map(serializeQuad), A.join("\n"))
);
