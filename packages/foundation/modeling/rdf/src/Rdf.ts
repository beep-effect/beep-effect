/**
 * RDF/JS-aligned value families for `@beep/rdf`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RdfId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A, R, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Match, Order, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { IRI } from "./Iri.ts";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata/index.ts";

const $I = $RdfId.create("rdf");

const curieMetadata = makeSemanticSchemaMetadata({
  kind: "identifier",
  canonicalName: "Curie",
  overview: "Compact URI expression used with RDF namespace bindings.",
  status: "stable",
  specifications: [
    {
      name: "CURIE Syntax 1.0",
      disposition: "informative",
    },
  ],
  equivalenceBasis: "String equality after explicit prefix expansion.",
});

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
    S.isPattern(/^(?:|[A-Za-z][A-Za-z0-9._-]*)$/, {
      identifier: $I`PrefixLabelPatternCheck`,
      title: "Prefix Label Pattern",
      description: "A prefixed-name label or empty default-prefix label used in RDF namespace bindings.",
      message:
        "Prefix labels must be empty for the default prefix or begin with an ASCII letter and then use letters, digits, dot, underscore, or hyphen",
    }),
  ],
  {
    identifier: $I`PrefixLabelChecks`,
    title: "Prefix Label",
    description: "Checks for RDF prefix labels.",
  }
);

const CurieChecks = S.makeFilterGroup(
  [
    S.isPattern(/^[A-Za-z][A-Za-z0-9._-]*:[^\\s]+$/, {
      identifier: $I`CuriePatternCheck`,
      title: "CURIE Pattern",
      description: "A compact URI expression using a prefix label and a local part.",
      message: "CURIE values must be of the form prefix:suffix without whitespace",
    }),
  ],
  {
    identifier: $I`CurieChecks`,
    title: "CURIE",
    description: "Checks for CURIE syntax.",
  }
);

const LanguageTagChecks = S.makeFilterGroup(
  [
    S.isPattern(/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/, {
      identifier: $I`LanguageTagPatternCheck`,
      title: "Language Tag Pattern",
      description: "A simple BCP 47-style language tag.",
      message: "Language tags must use alphanumeric subtags separated by hyphens",
    }),
  ],
  {
    identifier: $I`LanguageTagChecks`,
    title: "Language Tag",
    description: "Checks for RDF literal language tags.",
  }
);

const BlankNodeLabelChecks = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: $I`BlankNodeLabelNonEmptyCheck`,
      title: "Blank Node Label Non Empty",
      description: "Blank node labels must not be empty.",
      message: "Blank node labels must not be empty",
    }),
    S.isTrimmed({
      identifier: $I`BlankNodeLabelTrimmedCheck`,
      title: "Blank Node Label Trimmed",
      description: "Blank node labels must not contain leading or trailing whitespace.",
      message: "Blank node labels must not contain leading or trailing whitespace",
    }),
  ],
  {
    identifier: $I`BlankNodeLabelChecks`,
    title: "Blank Node Label",
    description: "Checks for blank node labels.",
  }
);

const BlankNodeLabel = S.String.check(BlankNodeLabelChecks).pipe(
  $I.annoteSchema("BlankNodeLabel", {
    description: "Blank node label accepted by RDF/JS blank nodes.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "is"])
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
        R.every(prefixes, (_namespace, prefix) => PrefixLabel.is(prefix)),
      {
        identifier: $I`PrefixMapKeyCheck`,
        title: "Prefix Map Keys",
        description: "Prefix maps must use RDF prefix labels for every key.",
        message:
          "Prefix labels must be empty for the default prefix or begin with an ASCII letter and then use letters, digits, dot, underscore, or hyphen",
      }
    ),
  ],
  {
    identifier: $I`PrefixMapKeyChecks`,
    title: "Prefix Map Keys",
    description: "Checks for RDF prefix map keys.",
  }
);

/**
 * CURIE-style compact IRI expression.
 *
 * **Example** (Decode compact IRI)
 *
 * ```ts import.meta.vitest name="Decode compact IRI"
 * import * as S from "effect/Schema"
 * import { Curie } from "@beep/rdf/Rdf"
 *
 * const compact = S.decodeUnknownSync(Curie)("schema:name")
 * compact // => "schema:name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Curie = S.String.check(CurieChecks).pipe(
  S.brand("Curie"),
  $I.annoteSchema("Curie", {
    description: "CURIE-style compact IRI expression.",
    semanticSchemaMetadata: curieMetadata,
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
);

/**
 * Type for {@link Curie}.
 *
 * **Example** (Accept Curie type)
 *
 * ```ts
 * import type { Curie } from "@beep/rdf/Rdf"
 *
 * const acceptCurie = (value: Curie) => value
 * console.log(acceptCurie)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Curie = typeof Curie.Type;

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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
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
export class NamedNode extends S.Class<NamedNode>($I`NamedNode`)(
  {
    termType: S.tag("NamedNode"),
    value: IRI,
  },
  $I.annote("NamedNode", {
    description: "RDF named node value aligned with RDF/JS.",
    semanticSchemaMetadata: namedNodeMetadata,
  })
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
export class BlankNode extends S.Class<BlankNode>($I`BlankNode`)(
  {
    termType: S.tag("BlankNode"),
    value: BlankNodeLabel,
  },
  $I.annote("BlankNode", {
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
export class Literal extends S.Class<Literal>($I`Literal`)(
  {
    termType: S.tag("Literal"),
    value: S.String,
    language: S.OptionFromOptionalKey(LanguageTag).pipe(SchemaUtils.withNoneDefault),
    datatype: NamedNode,
  },
  $I.annote("Literal", {
    description: "RDF literal value aligned with RDF/JS.",
    semanticSchemaMetadata: literalMetadata,
  })
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
export class DefaultGraph extends S.Class<DefaultGraph>($I`DefaultGraph`)(
  {
    termType: S.tag("DefaultGraph"),
    value: S.tag(""),
  },
  $I.annote("DefaultGraph", {
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
) {}

const TermDefinition = S.Union([NamedNode, BlankNode, Literal, DefaultGraph]);
const TermWithCodecStatics = TermDefinition.pipe(
  $I.annoteSchema("Term", {
    description: "RDF term union aligned with RDF/JS.",
    toArbitrary: () => S.toArbitrary(TermDefinition),
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
  }),
  SchemaUtils.withCodecStatics(["is"])
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
export const Term = TermWithCodecStatics.pipe(
  S.toTaggedUnion("termType"),
  SchemaUtils.withStatics(() => ({ is: TermWithCodecStatics.is }))
);

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
const SubjectWithCodecStatics = SubjectDefinition.pipe(
  (schema) =>
    pipe(
      schema,
      $I.annoteSchema("Subject", {
        description: "RDF subject term union.",
        toArbitrary: () => S.toArbitrary(schema),
      })
    ),
  SchemaUtils.withCodecStatics(["is"])
);

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
export const Subject = SubjectWithCodecStatics.pipe(
  S.toTaggedUnion("termType"),
  SchemaUtils.withStatics(() => ({ is: SubjectWithCodecStatics.is }))
);

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
const ObjectTermWithCodecStatics = ObjectTermDefinition.pipe(
  $I.annoteSchema("ObjectTerm", {
    description: "RDF object term union.",
    toArbitrary: () => S.toArbitrary(ObjectTermDefinition),
  }),
  SchemaUtils.withCodecStatics(["is"])
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
export const ObjectTerm = ObjectTermWithCodecStatics.pipe(
  S.toTaggedUnion("termType"),
  SchemaUtils.withStatics(() => ({ is: ObjectTermWithCodecStatics.is }))
);

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
const GraphTermWithCodecStatics = GraphTermDefinition.pipe(
  $I.annoteSchema("GraphTerm", {
    description: "RDF graph term union.",
    toArbitrary: () => S.toArbitrary(GraphTermDefinition),
  }),
  SchemaUtils.withCodecStatics(["is"])
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
export const GraphTerm = GraphTermWithCodecStatics.pipe(
  S.toTaggedUnion("termType"),
  SchemaUtils.withStatics(() => ({ is: GraphTermWithCodecStatics.is }))
);

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
export class Quad extends S.Class<Quad>($I`Quad`)(
  {
    subject: Subject,
    predicate: NamedNode,
    object: ObjectTerm,
    graph: GraphTerm,
  },
  $I.annote("Quad", {
    description: "RDF quad value aligned with RDF/JS.",
    semanticSchemaMetadata: quadMetadata,
  })
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
export class Dataset extends S.Class<Dataset>($I`Dataset`)(
  {
    quads: S.Array(Quad),
  },
  $I.annote("Dataset", {
    description: "Dataset wrapper for RDF quads.",
    semanticSchemaMetadata: datasetMetadata,
  })
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
export class NamespaceBinding extends S.Class<NamespaceBinding>($I`NamespaceBinding`)(
  {
    prefix: PrefixLabel,
    namespace: IRI,
  },
  $I.annote("NamespaceBinding", {
    description: "Prefix-to-namespace binding for RDF compaction and expansion.",
    semanticSchemaMetadata: namespaceBindingMetadata,
  })
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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"])
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
    value: BlankNodeLabel.decodeUnknownSync(value),
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
export class MakeLiteralOptions extends S.Class<MakeLiteralOptions>($I`MakeLiteralOptions`)(
  {
    language: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("MakeLiteralOptions", {
    description: "Optional language settings for makeLiteral.",
  })
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
export class MakeQuadOptions extends S.Class<MakeQuadOptions>($I`MakeQuadOptions`)(
  {
    object: ObjectTerm,
    graph: GraphTerm.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("MakeQuadOptions", {
    description: "Object and optional graph settings for makeQuad.",
  })
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
export class MakeQuadOptionsInput extends S.Class<MakeQuadOptionsInput>($I`MakeQuadOptionsInput`)(
  {
    object: ObjectTerm,
    graph: GraphTerm.pipe(S.optionalKey),
  },
  $I.annote("MakeQuadOptionsInput", {
    description: "In-memory object and optional graph input accepted by makeQuad.",
  })
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
    O.fromNullishOr(ch.codePointAt(0)),
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
