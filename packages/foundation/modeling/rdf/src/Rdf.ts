/**
 * RDF/JS-aligned value families for `@beep/rdf`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RdfId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Order, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { IRI } from "./Iri.ts";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata.ts";

const $I = $RdfId.create("rdf");

const decodeBlankNodeResult = S.decodeUnknownResult(S.NonEmptyString);

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
    S.isPattern(/^[A-Za-z][A-Za-z0-9._-]*$/, {
      identifier: $I`PrefixLabelPatternCheck`,
      title: "Prefix Label Pattern",
      description: "A prefixed-name label used in RDF namespace bindings.",
      message: "Prefix labels must begin with an ASCII letter and then use letters, digits, dot, underscore, or hyphen",
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

/**
 * Prefix label used by RDF namespace bindings.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { PrefixLabel } from "@beep/rdf/Rdf"
 *
 * const decoded = S.decodeUnknownSync(PrefixLabel)("schema")
 * console.log(decoded) // "schema"
 * ```
 *
 * @since 0.0.0
 * @category models
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
      equivalenceBasis: "Exact string equality.",
    }),
  })
);

/**
 * Type for {@link PrefixLabel}.
 *
 * @example
 * ```ts
 * import type { PrefixLabel } from "@beep/rdf/Rdf"
 *
 * const acceptPrefixLabel = (value: PrefixLabel) => value
 * console.log(acceptPrefixLabel)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PrefixLabel = typeof PrefixLabel.Type;

/**
 * CURIE-style compact IRI expression.
 *
 * @example
 * ```ts
 * import { Curie } from "@beep/rdf/Rdf"
 *
 * console.log(Curie)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const Curie = S.String.check(CurieChecks).pipe(
  S.brand("Curie"),
  $I.annoteSchema("Curie", {
    description: "CURIE-style compact IRI expression.",
    semanticSchemaMetadata: curieMetadata,
  })
);

/**
 * Type for {@link Curie}.
 *
 * @example
 * ```ts
 * import type { Curie } from "@beep/rdf/Rdf"
 *
 * const acceptCurie = (value: Curie) => value
 * console.log(acceptCurie)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Curie = typeof Curie.Type;

/**
 * RDF literal language tag.
 *
 * @example
 * ```ts
 * import { LanguageTag } from "@beep/rdf/Rdf"
 *
 * console.log(LanguageTag)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import type { LanguageTag } from "@beep/rdf/Rdf"
 *
 * const acceptLanguageTag = (value: LanguageTag) => value
 * console.log(acceptLanguageTag)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type LanguageTag = typeof LanguageTag.Type;

/**
 * RDF named node value.
 *
 * @example
 * ```ts
 * import { NamedNode } from "@beep/rdf/Rdf"
 *
 * console.log(NamedNode)
 * ```
 *
 * @since 0.0.0
 * @category models
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
) {}

/**
 * RDF blank node value.
 *
 * @example
 * ```ts
 * import { BlankNode } from "@beep/rdf/Rdf"
 *
 * console.log(BlankNode)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class BlankNode extends S.Class<BlankNode>($I`BlankNode`)(
  {
    termType: S.tag("BlankNode"),
    value: S.String.check(BlankNodeLabelChecks),
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
 * @example
 * ```ts
 * import { Literal } from "@beep/rdf/Rdf"
 *
 * console.log(Literal)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class Literal extends S.Class<Literal>($I`Literal`)(
  {
    termType: S.tag("Literal"),
    value: S.String,
    language: S.OptionFromOptionalKey(LanguageTag),
    datatype: NamedNode,
  },
  $I.annote("Literal", {
    description: "RDF literal value aligned with RDF/JS.",
    semanticSchemaMetadata: literalMetadata,
  })
) {}

/**
 * RDF default graph term.
 *
 * @example
 * ```ts
 * import { DefaultGraph } from "@beep/rdf/Rdf"
 *
 * console.log(DefaultGraph)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class DefaultGraph extends S.Class<DefaultGraph>($I`DefaultGraph`)(
  {
    termType: S.tag("DefaultGraph"),
    value: S.Literal(""),
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

/**
 * RDF term union.
 *
 * @example
 * ```ts
 * import { Term } from "@beep/rdf/Rdf"
 *
 * console.log(Term)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const Term = S.Union([NamedNode, BlankNode, Literal, DefaultGraph]).pipe(
  S.toTaggedUnion("termType"),
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
 * Type for {@link Term}.
 *
 * @example
 * ```ts
 * import type { Term } from "@beep/rdf/Rdf"
 *
 * const acceptTerm = (value: Term) => value
 * console.log(acceptTerm)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Term = typeof Term.Type;

/**
 * RDF subject term union.
 *
 * @example
 * ```ts
 * import { Subject } from "@beep/rdf/Rdf"
 *
 * console.log(Subject)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const Subject = S.Union([NamedNode, BlankNode]).pipe(
  S.toTaggedUnion("termType"),
  $I.annoteSchema("Subject", {
    description: "RDF subject term union.",
  })
);

/**
 * Type for {@link Subject}.
 *
 * @example
 * ```ts
 * import type { Subject } from "@beep/rdf/Rdf"
 *
 * const acceptSubject = (value: Subject) => value
 * console.log(acceptSubject)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Subject = typeof Subject.Type;

/**
 * RDF object term union.
 *
 * @example
 * ```ts
 * import { ObjectTerm } from "@beep/rdf/Rdf"
 *
 * console.log(ObjectTerm)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const ObjectTerm = S.Union([NamedNode, BlankNode, Literal]).pipe(
  S.toTaggedUnion("termType"),
  $I.annoteSchema("ObjectTerm", {
    description: "RDF object term union.",
  })
);

/**
 * Type for {@link ObjectTerm}.
 *
 * @example
 * ```ts
 * import type { ObjectTerm } from "@beep/rdf/Rdf"
 *
 * const acceptObjectTerm = (value: ObjectTerm) => value
 * console.log(acceptObjectTerm)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ObjectTerm = typeof ObjectTerm.Type;

/**
 * RDF graph term union.
 *
 * @example
 * ```ts
 * import { GraphTerm } from "@beep/rdf/Rdf"
 *
 * console.log(GraphTerm)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const GraphTerm = S.Union([NamedNode, BlankNode, DefaultGraph]).pipe(
  S.toTaggedUnion("termType"),
  $I.annoteSchema("GraphTerm", {
    description: "RDF graph term union.",
  })
);

/**
 * Type for {@link GraphTerm}.
 *
 * @example
 * ```ts
 * import type { GraphTerm } from "@beep/rdf/Rdf"
 *
 * const acceptGraphTerm = (value: GraphTerm) => value
 * console.log(acceptGraphTerm)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type GraphTerm = typeof GraphTerm.Type;

/**
 * RDF quad value aligned with RDF/JS.
 *
 * @example
 * ```ts
 * import { Quad } from "@beep/rdf/Rdf"
 *
 * console.log(Quad)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import { Dataset } from "@beep/rdf/Rdf"
 *
 * console.log(Dataset)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class Dataset extends S.Class<Dataset>($I`Dataset`)(
  {
    quads: S.Array(Quad),
  },
  $I.annote("Dataset", {
    description: "Dataset wrapper for RDF quads.",
    semanticSchemaMetadata: datasetMetadata,
  })
) {}

/**
 * Prefix-to-namespace binding for RDF compaction and expansion.
 *
 * @example
 * ```ts
 * import { NamespaceBinding } from "@beep/rdf/Rdf"
 *
 * console.log(NamespaceBinding)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import { PrefixMap } from "@beep/rdf/Rdf"
 *
 * console.log(PrefixMap)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const PrefixMap = S.Record(PrefixLabel, IRI).pipe(
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
 * @example
 * ```ts
 * import type { PrefixMap } from "@beep/rdf/Rdf"
 *
 * const acceptPrefixMap = (value: PrefixMap) => value
 * console.log(acceptPrefixMap)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PrefixMap = typeof PrefixMap.Type;

const decodeNamedNodeResult = S.decodeUnknownResult(NamedNode);
const decodeLiteralResult = S.decodeUnknownResult(Literal);

/**
 * Build a named node from an IRI string.
 *
 * @example
 * ```typescript
 * import { makeNamedNode } from "@beep/rdf/Rdf"
 *
 * const node = makeNamedNode("https://schema.org/Person")
 * console.log(node.termType) // "NamedNode"
 * console.log(node.value) // "https://schema.org/Person"
 * ```
 *
 * @param value - Named node IRI.
 * @returns Decoded named node.
 * @since 0.0.0
 * @category utilities
 */
export const makeNamedNode = (value: string): NamedNode =>
  pipe(
    decodeNamedNodeResult({
      termType: "NamedNode",
      value,
    }),
    Result.getOrThrow
  );

/**
 * Build a blank node from a non-empty label.
 *
 * @example
 * ```typescript
 * import { makeBlankNode } from "@beep/rdf/Rdf"
 *
 * const node = makeBlankNode("b0")
 * console.log(node.termType) // "BlankNode"
 * console.log(node.value) // "b0"
 * ```
 *
 * @param value - Blank node label.
 * @returns Decoded blank node.
 * @since 0.0.0
 * @category utilities
 */
export const makeBlankNode = (value: string): BlankNode =>
  BlankNode.make({
    termType: "BlankNode",
    value: pipe(decodeBlankNodeResult(value), Result.getOrThrow),
  });

/**
 * Optional language settings for {@link makeLiteral}.
 *
 * @example
 * ```ts
 * import type { MakeLiteralOptions } from "@beep/rdf/Rdf"
 *
 * const options: MakeLiteralOptions = { language: "en" }
 * console.log(options)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export class MakeLiteralOptions extends S.Class<MakeLiteralOptions>($I`MakeLiteralOptions`)(
  {
    language: S.optional(S.String),
  },
  $I.annote("MakeLiteralOptions", {
    description: "Optional language settings for makeLiteral.",
  })
) {}

const isMakeLiteralDataFirst = (args: IArguments): boolean => args.length >= 2 && P.isString(args[1]);

const makeLiteralInternal = (value: string, datatype: string, options: MakeLiteralOptions | string = {}): Literal => {
  const language = P.isString(options) ? options : options.language;
  return pipe(
    decodeLiteralResult({
      termType: "Literal",
      value,
      datatype: makeNamedNode(datatype),
      ...O.getSomesStruct({ language: O.fromUndefinedOr(language) }),
    }),
    Result.getOrThrow
  );
};

/**
 * Build an RDF literal.
 *
 * @example
 * ```typescript
 * import { makeLiteral } from "@beep/rdf/Rdf"
 *
 * const lit = makeLiteral("hello", "http://www.w3.org/2001/XMLSchema#string", { language: "en" })
 * console.log(lit.termType) // "Literal"
 * console.log(lit.value) // "hello"
 * ```
 *
 * @param value - Lexical form.
 * @param datatype - Datatype IRI.
 * @param options - Optional literal settings.
 * @returns Decoded RDF literal.
 * @since 0.0.0
 * @category utilities
 */
export const makeLiteral: {
  (value: string, datatype: string): Literal;
  (value: string, datatype: string, options: MakeLiteralOptions): Literal;
  (value: string, datatype: string, language: string): Literal;
  (datatype: string): (value: string) => Literal;
  (datatype: string, options: MakeLiteralOptions): (value: string) => Literal;
} = dual(isMakeLiteralDataFirst, makeLiteralInternal);

/**
 * Object and optional graph settings for {@link makeQuad}.
 *
 * @example
 * ```ts
 * import type { MakeQuadOptions } from "@beep/rdf/Rdf"
 *
 * const acceptOptions = (options: MakeQuadOptions) => options
 * console.log(acceptOptions)
 * ```
 *
 * @since 0.0.0
 * @category utilities
 */
export class MakeQuadOptions extends S.Class<MakeQuadOptions>($I`MakeQuadOptions`)(
  {
    object: ObjectTerm,
    graph: S.optional(GraphTerm),
  },
  $I.annote("MakeQuadOptions", {
    description: "Object and optional graph settings for makeQuad.",
  })
) {}

const isMakeQuadOptions = (input: ObjectTerm | MakeQuadOptions): input is MakeQuadOptions =>
  P.hasProperty(input, "object");

const makeDefaultGraph = (): DefaultGraph =>
  DefaultGraph.make({
    termType: "DefaultGraph",
    value: "",
  });

/**
 * Build an RDF quad.
 *
 * @example
 * ```typescript
 * import { makeNamedNode, makeLiteral, makeQuad } from "@beep/rdf/Rdf"
 *
 * const subject = makeNamedNode("https://example.org/alice")
 * const predicate = makeNamedNode("https://schema.org/name")
 * const object = makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * const quad = makeQuad(subject, predicate, object)
 * console.log(quad.subject.value) // "https://example.org/alice"
 * ```
 *
 * @param subject - Subject term.
 * @param predicate - Predicate term.
 * @param options - Object term or object/graph settings.
 * @returns Decoded quad.
 * @since 0.0.0
 * @category utilities
 */
export const makeQuad: {
  (subject: Subject, predicate: NamedNode, object: ObjectTerm): Quad;
  (subject: Subject, predicate: NamedNode, options: MakeQuadOptions): Quad;
  (predicate: NamedNode, object: ObjectTerm): (subject: Subject) => Quad;
  (predicate: NamedNode, options: MakeQuadOptions): (subject: Subject) => Quad;
} = dual(3, (subject: Subject, predicate: NamedNode, input: ObjectTerm | MakeQuadOptions): Quad => {
  const options = isMakeQuadOptions(input) ? input : { object: input };
  return Quad.make({
    subject,
    predicate,
    object: options.object,
    graph: options.graph ?? makeDefaultGraph(),
  });
});

/**
 * Build a dataset from quads.
 *
 * @example
 * ```typescript
 * import { makeNamedNode, makeLiteral, makeQuad, makeDataset } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * const dataset = makeDataset([quad])
 * console.log(dataset.quads.length) // 1
 * ```
 *
 * @param quads - Input quads.
 * @returns Decoded dataset.
 * @since 0.0.0
 * @category utilities
 */
export const makeDataset = (quads: ReadonlyArray<Quad>): Dataset => Dataset.make({ quads: A.fromIterable(quads) });

/**
 * Serialize an RDF term to a deterministic lexical form.
 *
 * @example
 * ```typescript
 * import { makeNamedNode, serializeTerm } from "@beep/rdf/Rdf"
 *
 * const serialized = serializeTerm(makeNamedNode("https://example.org/x"))
 * console.log(serialized) // "<https://example.org/x>"
 * ```
 *
 * @param term - RDF term.
 * @returns Deterministic term serialization.
 * @since 0.0.0
 * @category utilities
 */
export const serializeTerm = (term: Term): string =>
  Term.match(term, {
    NamedNode: (value) => `<${value.value}>`,
    BlankNode: (value) => `_:${value.value}`,
    Literal: (value) =>
      O.isSome(value.language)
        ? `"${value.value}"@${Str.toLowerCase(value.language.value)}`
        : `"${value.value}"^^<${value.datatype.value}>`,
    DefaultGraph: () => "default",
  });

/**
 * Serialize an RDF quad to a deterministic lexical form.
 *
 * @example
 * ```typescript
 * import { makeNamedNode, makeLiteral, makeQuad, serializeQuad } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
 * )
 * console.log(typeof serializeQuad(quad)) // "string"
 * ```
 *
 * @param quad - RDF quad.
 * @returns Deterministic quad serialization.
 * @since 0.0.0
 * @category utilities
 */
export const serializeQuad = (quad: Quad): string =>
  `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)} ${serializeTerm(quad.object)} ${serializeTerm(quad.graph)} .`;

const byQuadLexicalAscending: Order.Order<Quad> = Order.mapInput(Order.String, serializeQuad);

/**
 * Sort dataset quads by deterministic quad serialization.
 *
 * @example
 * ```typescript
 * import { makeDataset, sortDatasetQuads } from "@beep/rdf/Rdf"
 *
 * const dataset = makeDataset([])
 * const sorted = sortDatasetQuads(dataset)
 * console.log(sorted.length) // 0
 * ```
 *
 * @param dataset - RDF dataset.
 * @returns Sorted quad array.
 * @since 0.0.0
 * @category utilities
 */
export const sortDatasetQuads = (dataset: Dataset): ReadonlyArray<Quad> =>
  A.sort(dataset.quads, byQuadLexicalAscending);

/**
 * Compare datasets by sorted quad serialization.
 *
 * @example
 * ```typescript
 * import { makeDataset, areDatasetsEquivalent } from "@beep/rdf/Rdf"
 *
 * const a = makeDataset([])
 * const b = makeDataset([])
 * console.log(areDatasetsEquivalent(a, b)) // true
 * ```
 *
 * @param left - Left dataset.
 * @param right - Right dataset.
 * @returns `true` when both datasets share the same sorted quad serialization.
 * @since 0.0.0
 * @category utilities
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
