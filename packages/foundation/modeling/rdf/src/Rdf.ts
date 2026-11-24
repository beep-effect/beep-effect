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
import { constant, dual, identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
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
      /^[a-z]+(?:-[a-z0-9]+)*$/,
      $I.annote("LanguageTagPatternCheck", {
        title: "Language Tag Pattern",
        description: "A simple BCP 47-style language tag in the lowercase RDF value space.",
        message: "Language tags must use lowercase alphanumeric subtags separated by hyphens",
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
 * **Example** (Decode language tag)
 *
 * ```ts import.meta.vitest name="Decode language tag"
 * import * as S from "effect/Schema"
 * import { LanguageTag } from "@beep/rdf/Rdf"
 *
 * const tag = S.decodeUnknownSync(LanguageTag)("en-US")
 * tag // => "en-us"
 * ```
 *
 * **Details**
 *
 * Decoding lowercases the tag, because RDF 1.1 places language tags in a
 * lowercase value space: `"x"@EN` and `"x"@en` are one literal.
 *
 * @category models
 * @since 0.0.0
 */
export const LanguageTag = S.String.pipe(
  S.decodeTo(
    S.String.check(LanguageTagChecks).pipe(S.brand("LanguageTag")),
    SchemaTransformation.transform({ decode: Str.toLowerCase, encode: identity })
  ),
  $I.annoteSchema("LanguageTag", {
    description: "RDF literal language tag, lowercased on decode.",
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

const XSD_STRING_IRI = "http://www.w3.org/2001/XMLSchema#string";
const RDF_LANG_STRING_IRI = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";

/**
 * The form of a simple literal, whose datatype is `xsd:string`.
 *
 * **Example** (Decode simple literal form)
 *
 * ```ts import.meta.vitest name="Decode simple literal form"
 * import * as S from "effect/Schema"
 * import { SimpleLiteralForm } from "@beep/rdf/Rdf"
 *
 * S.decodeUnknownSync(SimpleLiteralForm)({ _tag: "Simple" })._tag // => "Simple"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SimpleLiteralForm = S.TaggedStruct("Simple", {}).pipe(
  $I.annoteSchema("SimpleLiteralForm", {
    description: "Form of a simple literal, whose datatype is xsd:string.",
  })
);

/**
 * Type for {@link SimpleLiteralForm}.
 *
 * **Example** (Accept simple literal form type)
 *
 * ```ts
 * import type { SimpleLiteralForm } from "@beep/rdf/Rdf"
 *
 * const form: SimpleLiteralForm = { _tag: "Simple" }
 * console.log(form._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SimpleLiteralForm = typeof SimpleLiteralForm.Type;

const TypedLiteralFormChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      (form: { readonly datatype: { readonly value: string } }) =>
        form.datatype.value !== XSD_STRING_IRI && form.datatype.value !== RDF_LANG_STRING_IRI,
      $I.annote("TypedLiteralFormDatatypeCheck", {
        title: "Typed Literal Datatype",
        description: "A typed literal names neither xsd:string nor rdf:langString.",
        message: "Typed literals must not use xsd:string or rdf:langString; use the Simple or LangTagged form",
      })
    ),
  ],
  $I.annote("TypedLiteralFormChecks", {
    title: "Typed Literal Form",
    description: "Checks for typed literal forms.",
  })
);

/**
 * The form of a typed literal, whose datatype is neither `xsd:string` nor
 * `rdf:langString`.
 *
 * **Example** (Decode typed literal form)
 *
 * ```ts import.meta.vitest name="Decode typed literal form"
 * import * as S from "effect/Schema"
 * import { TypedLiteralForm } from "@beep/rdf/Rdf"
 *
 * const form = S.decodeUnknownSync(TypedLiteralForm)({
 *   _tag: "Typed",
 *   datatype: { termType: "NamedNode", value: "http://www.w3.org/2001/XMLSchema#integer" }
 * })
 * form.datatype.value // => "http://www.w3.org/2001/XMLSchema#integer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypedLiteralForm = S.TaggedStruct("Typed", { datatype: NamedNode }).pipe(
  S.check(TypedLiteralFormChecks),
  $I.annoteSchema("TypedLiteralForm", {
    description: "Form of a typed literal, whose datatype is neither xsd:string nor rdf:langString.",
  })
);

/**
 * Type for {@link TypedLiteralForm}.
 *
 * **Example** (Accept typed literal form type)
 *
 * ```ts
 * import type { TypedLiteralForm } from "@beep/rdf/Rdf"
 *
 * const tagOf = (form: TypedLiteralForm) => form._tag
 * console.log(tagOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypedLiteralForm = typeof TypedLiteralForm.Type;

/**
 * The form of a language-tagged literal, whose datatype is `rdf:langString`.
 *
 * **Example** (Decode language-tagged literal form)
 *
 * ```ts import.meta.vitest name="Decode language-tagged literal form"
 * import * as S from "effect/Schema"
 * import { LangTaggedLiteralForm } from "@beep/rdf/Rdf"
 *
 * S.decodeUnknownSync(LangTaggedLiteralForm)({ _tag: "LangTagged", language: "EN" }).language // => "en"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LangTaggedLiteralForm = S.TaggedStruct("LangTagged", { language: LanguageTag }).pipe(
  $I.annoteSchema("LangTaggedLiteralForm", {
    description: "Form of a language-tagged literal, whose datatype is rdf:langString.",
  })
);

/**
 * Type for {@link LangTaggedLiteralForm}.
 *
 * **Example** (Accept language-tagged literal form type)
 *
 * ```ts
 * import type { LangTaggedLiteralForm } from "@beep/rdf/Rdf"
 *
 * const languageOf = (form: LangTaggedLiteralForm) => form.language
 * console.log(languageOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LangTaggedLiteralForm = typeof LangTaggedLiteralForm.Type;

/**
 * The three cases of an RDF literal: simple, typed and language-tagged.
 *
 * **Example** (Match a literal form)
 *
 * ```ts import.meta.vitest name="Match a literal form"
 * import { LiteralForm } from "@beep/rdf/Rdf"
 *
 * LiteralForm.match({ _tag: "Simple" }, {
 *   Simple: () => "simple",
 *   Typed: () => "typed",
 *   LangTagged: () => "tagged"
 * }) // => "simple"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiteralForm = S.Union([SimpleLiteralForm, TypedLiteralForm, LangTaggedLiteralForm]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LiteralForm", {
    description: "The simple, typed or language-tagged form of an RDF literal.",
  })
);

/**
 * Type for {@link LiteralForm}.
 *
 * **Example** (Accept literal form type)
 *
 * ```ts
 * import type { LiteralForm } from "@beep/rdf/Rdf"
 *
 * const form: LiteralForm = { _tag: "Simple" }
 * console.log(form._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LiteralForm = typeof LiteralForm.Type;

/**
 * A datatype and language pair that names no RDF literal form.
 *
 * **Example** (Construct literal form refusal)
 *
 * ```ts
 * import { LiteralFormRefused } from "@beep/rdf/Rdf"
 * import * as O from "effect/Option"
 *
 * const error = LiteralFormRefused.make({
 *   value: "x",
 *   datatype: "http://www.w3.org/2001/XMLSchema#integer",
 *   language: O.some("en")
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LiteralFormRefused extends S.TaggedError<LiteralFormRefused, { readonly brand: unique symbol }>(
  $I`LiteralFormRefused`
)(
  "LiteralFormRefused",
  {
    value: S.String,
    datatype: S.String,
    language: S.OptionFromOptionalKey(S.String),
  },
  $I.annoteError<LiteralFormRefused>("LiteralFormRefused", {
    description: "A literal whose datatype and language tag name no RDF literal form.",
  })
) {}

/**
 * Engine-shaped literal parts accepted by {@link Literal.fromParts}.
 *
 * **Example** (Construct literal parts)
 *
 * ```ts
 * import { LiteralParts } from "@beep/rdf/Rdf"
 *
 * const parts = LiteralParts.make({ value: "1", datatype: "http://www.w3.org/2001/XMLSchema#integer" })
 * console.log(parts.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LiteralParts extends S.Opaque<LiteralParts, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.String,
    datatype: S.String,
    language: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("LiteralParts", {
      description: "Lexical form, datatype IRI and optional language tag of a literal as an RDF engine reports them.",
    })
  )
) {}

const refuseParts = (parts: typeof LiteralParts.Encoded): LiteralFormRefused =>
  LiteralFormRefused.make({
    value: parts.value,
    datatype: parts.datatype,
    language: O.fromUndefinedOr(parts.language),
  });

const formOfParts = (parts: typeof LiteralParts.Encoded): Result.Result<LiteralForm, LiteralFormRefused> =>
  pipe(
    O.fromUndefinedOr(parts.language),
    O.filter(Str.isNonEmpty),
    O.match({
      onNone: () =>
        Match.value(parts.datatype).pipe(
          Match.when(XSD_STRING_IRI, () => Result.succeed<LiteralForm>({ _tag: "Simple" })),
          Match.when(RDF_LANG_STRING_IRI, () => Result.fail(refuseParts(parts))),
          Match.orElse((datatype) =>
            pipe(
              S.decodeResult(TypedLiteralForm)({
                _tag: "Typed",
                datatype: { termType: "NamedNode", value: datatype },
              }),
              Result.mapError(() => refuseParts(parts))
            )
          )
        ),
      onSome: (language) =>
        parts.datatype === RDF_LANG_STRING_IRI
          ? pipe(
              S.decodeResult(LangTaggedLiteralForm)({ _tag: "LangTagged", language }),
              Result.mapError(() => refuseParts(parts))
            )
          : Result.fail(refuseParts(parts)),
    })
  );

const noLanguage = constant(O.none<LanguageTag>());

/**
 * **Example** (Decode RDF literal)
 *
 * ```ts import.meta.vitest name="Decode RDF literal"
 * import * as S from "effect/Schema"
 * import { Literal } from "@beep/rdf/Rdf"
 *
 * const literal = S.decodeUnknownSync(Literal)({
 *   termType: "Literal",
 *   value: "Alice",
 *   form: { _tag: "LangTagged", language: "en" }
 * })
 * literal.form._tag // => "LangTagged"
 * ```
 *
 * **Details**
 *
 * A simple literal has datatype `xsd:string`, a typed literal names any other
 * datatype except `rdf:langString`, and a language-tagged literal has datatype
 * `rdf:langString`. `Literal.datatypeOf` and `Literal.languageOf` derive the
 * RDF/JS accessors, and `Literal.fromParts` normalizes engine output.
 *
 * @category models
 * @since 0.0.0
 */
export class Literal extends S.Opaque<Literal, { readonly brand: unique symbol }>()(
  S.Struct({
    termType: S.tag("Literal"),
    value: S.String,
    form: LiteralForm,
  }).pipe(
    $I.annoteSchema("Literal", {
      description: "RDF literal value aligned with RDF/JS, with a simple, typed or language-tagged form.",
      semanticSchemaMetadata: literalMetadata,
    })
  )
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);

  static readonly is = S.is(Literal);

  static readonly fromParts = (parts: typeof LiteralParts.Encoded): Result.Result<Literal, LiteralFormRefused> =>
    Result.map(formOfParts(parts), (form) => Literal.make({ termType: "Literal", value: parts.value, form }));

  static readonly typed = (value: string, datatype: string): Literal =>
    Result.getOrThrow(Literal.fromParts({ value, datatype }));

  static readonly langTagged = (value: string, language: string): Literal =>
    Result.getOrThrow(Literal.fromParts({ value, datatype: RDF_LANG_STRING_IRI, language }));

  static readonly datatypeOf = (literal: Literal): NamedNode =>
    LiteralForm.match(literal.form, {
      Simple: () => NamedNode.make({ termType: "NamedNode", value: IRI.make(XSD_STRING_IRI) }),
      Typed: (form) => form.datatype,
      LangTagged: () => NamedNode.make({ termType: "NamedNode", value: IRI.make(RDF_LANG_STRING_IRI) }),
    });

  static readonly languageOf = (literal: Literal): O.Option<LanguageTag> =>
    LiteralForm.match(literal.form, {
      Simple: noLanguage,
      Typed: noLanguage,
      LangTagged: (form) => O.some(form.language),
    });
}

/**
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

const byEncodedQuadLine: Order.Order<typeof Quad.Encoded> = Order.mapInput(Order.String, (quad) =>
  serializeQuadShape(quad)
);

const QuadSet = Quad.pipe(
  S.toEncoded,
  S.Array,
  S.decodeTo(
    S.HashSet(Quad),
    SchemaTransformation.transform({
      decode: HashSet.fromIterable,
      encode: (quads: HashSet.HashSet<typeof Quad.Encoded>): ReadonlyArray<typeof Quad.Encoded> =>
        A.sort(A.fromIterable(quads), byEncodedQuadLine),
    })
  )
);

/**
 * **Example** (Build dataset from quads)
 *
 * ```ts import.meta.vitest name="Build dataset from quads"
 * import * as HashSet from "effect/HashSet"
 * import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/person/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice")
 * )
 * const dataset = makeDataset([quad, quad])
 * HashSet.size(dataset.quads) // => 1
 * ```
 *
 * **Details**
 *
 * The decoded quads are a `HashSet`, so `Equal` on datasets is labelled-set
 * equality. The encoded quads are deduplicated and sorted by each quad's
 * canonical N-Quads line, so one quad set has one wire form.
 *
 * @category models
 * @since 0.0.0
 */
export class Dataset extends S.Opaque<Dataset, { readonly brand: unique symbol }>()(
  S.Struct({
    quads: QuadSet,
  }).pipe(
    $I.annoteSchema("Dataset", {
      description: "Set of RDF quads whose encoded form is sorted by canonical N-Quads line.",
      semanticSchemaMetadata: datasetMetadata,
    })
  )
) {
  static readonly is = S.is(Dataset);
}

/**
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
 * Build a simple RDF literal, whose datatype is `xsd:string`.
 *
 * **Example** (Create simple RDF literal)
 *
 * ```ts import.meta.vitest name="Create simple RDF literal"
 * import { makeLiteral } from "@beep/rdf/Rdf"
 *
 * const lit = makeLiteral("hello")
 * lit.form._tag // => "Simple"
 * lit.value // => "hello"
 * ```
 *
 * **Details**
 *
 * Typed literals use `Literal.typed` and language-tagged literals use
 * `Literal.langTagged`.
 *
 * @param value - Lexical form.
 * @returns Simple RDF literal.
 * @category utilities
 * @since 0.0.0
 */
export const makeLiteral = (value: string): Literal =>
  Literal.make({ termType: "Literal", value, form: { _tag: "Simple" } });

/**
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
 * const object = makeLiteral("Alice")
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
 * import * as HashSet from "effect/HashSet"
 * import { makeNamedNode, makeLiteral, makeQuad, makeDataset } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice")
 * )
 * const dataset = makeDataset([quad])
 * HashSet.size(dataset.quads) // => 1
 * ```
 *
 * @param quads - Input quads; repeated quads collapse.
 * @returns Dataset over the distinct quads.
 * @category utilities
 * @since 0.0.0
 */
export const makeDataset = (quads: Iterable<Quad>): Dataset => Dataset.make({ quads: HashSet.fromIterable(quads) });

const toUchar = (code: number): string => `\\u${pipe(code.toString(16), Str.toUpperCase, Str.padStart(4, "0"))}`;

const escapeLiteralLexical: (value: string) => string = Str.replaceAllWith(/[\u0000-\u001F\u007F"\\]/g, (ch) =>
  Match.value(ch).pipe(
    Match.when("\b", () => "\\b"),
    Match.when("\t", () => "\\t"),
    Match.when("\n", () => "\\n"),
    Match.when("\f", () => "\\f"),
    Match.when("\r", () => "\\r"),
    Match.when('"', () => '\\"'),
    Match.when("\\", () => "\\\\"),
    Match.orElse((other) => pipe(Str.charCodeAt(0)(other), O.map(toUchar), O.getOrElse(constant(other))))
  )
);

const toBlankNodeEscape = (ch: string): string =>
  pipe(
    Str.codePointAt(0)(ch),
    O.map((code) => `_u${pipe(code.toString(16), Str.toUpperCase, Str.padStart(4, "0"))}`),
    O.getOrElse(constant(ch))
  );

const encodeBlankNodeLabel: (value: string) => string = Str.replaceAllWith(/[^A-Za-z0-9]/g, toBlankNodeEscape);

const serializeLiteralShape = (literal: typeof Literal.Encoded): string =>
  Match.value(literal.form).pipe(
    Match.discriminatorsExhaustive("_tag")({
      Simple: () => `"${escapeLiteralLexical(literal.value)}"`,
      Typed: (form) => `"${escapeLiteralLexical(literal.value)}"^^<${form.datatype.value}>`,
      LangTagged: (form) => `"${escapeLiteralLexical(literal.value)}"@${form.language}`,
    })
  );

const serializeTermShape = (term: typeof Term.Encoded): string =>
  Match.value(term).pipe(
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (node) => `<${node.value}>`,
      BlankNode: (node) => `_:${encodeBlankNodeLabel(node.value)}`,
      Literal: serializeLiteralShape,
      DefaultGraph: () => "",
    })
  );

const serializeQuadShape = (quad: typeof Quad.Encoded): string =>
  pipe(
    [
      serializeTermShape(quad.subject),
      serializeTermShape(quad.predicate),
      serializeTermShape(quad.object),
      serializeTermShape(quad.graph),
    ],
    A.filter(Str.isNonEmpty),
    A.join(" "),
    (line) => `${line} .`
  );

/**
 * Serialize an RDF term in canonical N-Triples form.
 *
 * **Example** (Serialize named node term)
 *
 * ```ts import.meta.vitest name="Serialize named node term"
 * import { makeLiteral, makeNamedNode, serializeTerm } from "@beep/rdf/Rdf"
 *
 * serializeTerm(makeNamedNode("https://example.org/x")) // => "<https://example.org/x>"
 * serializeTerm(makeLiteral("a\tb")) // => "\"a\\tb\""
 * ```
 *
 * **Details**
 *
 * Literals use the RDFC-1.0 escape table: `ECHAR` for backspace, tab, line
 * feed, form feed, carriage return, quote and backslash, and `\uXXXX` for the
 * other control characters and DEL. A simple literal prints without
 * `^^<xsd:string>`, a language tag prints lowercase, and the default graph
 * prints as the empty string. Blank-node labels outside `[A-Za-z0-9]` are
 * re-encoded into a grammar-safe form.
 *
 * @param term - RDF term.
 * @returns Canonical term serialization.
 * @category utilities
 * @since 0.0.0
 */
export const serializeTerm = (term: Term): string => serializeTermShape(term);

/**
 * Serialize an RDF quad as one canonical N-Quads line without its newline.
 *
 * **Example** (Serialize RDF quad)
 *
 * ```ts import.meta.vitest name="Serialize RDF quad"
 * import { makeNamedNode, makeLiteral, makeQuad, serializeQuad } from "@beep/rdf/Rdf"
 *
 * const quad = makeQuad(
 *   makeNamedNode("https://example.org/alice"),
 *   makeNamedNode("https://schema.org/name"),
 *   makeLiteral("Alice")
 * )
 * serializeQuad(quad) // => "<https://example.org/alice> <https://schema.org/name> \"Alice\" ."
 * ```
 *
 * **Details**
 *
 * The default graph is omitted, so a default-graph quad prints as an
 * N-Triples statement.
 *
 * @param quad - RDF quad.
 * @returns Canonical quad serialization.
 * @category utilities
 * @since 0.0.0
 */
export const serializeQuad = (quad: Quad): string => serializeQuadShape(quad);
