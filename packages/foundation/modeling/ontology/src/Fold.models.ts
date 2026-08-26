/**
 * Schema-first models for the identity-backed ontology fold.
 *
 * The fold accepts triples-as-tuples whose endpoints are schema handles,
 * known CURIEs, absolute IRIs, or typed literals, and assembles them into a
 * predicate-open {@link AssembledOntology}: subject/predicate/object facts
 * with a reverse marker, never enumerated relation fields.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CoreVocab, expandOption, expandPredicate } from "@beep/identity";
import { $OntologyId } from "@beep/identity/packages";
import { IRI } from "@beep/rdf/Iri";
import { LanguageTag } from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { registryPrefix } from "./internal/Fold.ts";
import type { Curie, Predicate } from "@beep/identity";

const $I = $OntologyId.create("Fold");

/**
 * Absolute IRI literal accepted at tuple endpoints.
 *
 * **Example** (Usage)
 * ```ts
 * import type { AbsoluteIri } from "@beep/ontology"
 *
 * const iri: AbsoluteIri = "https://schema.org/CreativeWork"
 * console.log(iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AbsoluteIri =
  | `${"http" | "https"}://${string}`
  | `urn:${string}`
  | `mailto:${string}`
  | `did:${string}`
  | `tag:${string}`
  | IRI;

/**
 * Effect schema handle accepted at tuple endpoints.
 *
 * Handles resolve through their owned identity annotations during assembly.
 *
 * **Example** (Usage)
 * ```ts
 * import type { SchemaHandle } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const handle: SchemaHandle = S.String
 * console.log(typeof handle.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SchemaHandle = S.Top;

/**
 * Tuple subject: a schema handle, known CURIE, or absolute IRI literal.
 *
 * **Example** (Usage)
 * ```ts
 * import type { Subject } from "@beep/ontology"
 *
 * const subject: Subject = "skos:Concept"
 * console.log(subject)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Subject = SchemaHandle | Curie<CoreVocab> | AbsoluteIri;

/**
 * Scalar payload accepted inside a typed literal object.
 *
 * **Example** (Usage)
 * ```ts
 * import type { LiteralScalar } from "@beep/ontology"
 *
 * const scalar: LiteralScalar = 42
 * console.log(scalar)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LiteralScalar = string | number | boolean;

/**
 * Typed literal object accepted at tuple object positions.
 *
 * Bare strings are always terms (CURIEs or absolute IRIs); literal values
 * must ride this wrapper, so the grammar never guesses.
 *
 * **Example** (Usage)
 * ```ts
 * import type { TypedLiteral } from "@beep/ontology"
 *
 * const literal: TypedLiteral = { value: "Claim", language: "en" }
 * console.log(literal.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypedLiteral = {
  readonly value: LiteralScalar;
  readonly datatype?: Curie<CoreVocab> | AbsoluteIri | undefined;
  readonly language?: string | undefined;
};

/**
 * Tuple object: a subject endpoint or a typed literal.
 *
 * **Example** (Usage)
 * ```ts
 * import type { TupleObject } from "@beep/ontology"
 *
 * const object: TupleObject = { value: true }
 * console.log(object)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TupleObject = Subject | TypedLiteral;

/**
 * Relational fact as a `[Subject, Predicate, Object]` tuple.
 *
 * The predicate is the composer's closed CURIE literal type, optionally
 * reverse-marked with `^` (SPARQL inverse-path syntax).
 *
 * **Example** (Usage)
 * ```ts
 * import type { Triple } from "@beep/ontology"
 *
 * const triple: Triple = ["https://ns.beep.sh/patent/Claim", "rdfs:subClassOf", "owl:Thing"]
 * console.log(triple[1])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Triple = readonly [Subject, Predicate<CoreVocab>, TupleObject];

/**
 * Input payload accepted by the ontology fold entrypoint.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OntologyFoldInput } from "@beep/ontology"
 *
 * const input: OntologyFoldInput = { label: "Patent Core", schemas: [], triples: [] }
 * console.log(input.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyFoldInput = {
  readonly label: string;
  readonly schemas: ReadonlyArray<SchemaHandle>;
  readonly triples: ReadonlyArray<Triple>;
};

const isIriValue = S.is(IRI);

const isAbsoluteIri = (value: string): boolean => O.isNone(registryPrefix(CoreVocab, value)) && isIriValue(value);

const isKnownCurie = (value: string): boolean => O.isSome(expandOption(value, CoreVocab));

const isTermString = (value: string): boolean => isKnownCurie(value) || isAbsoluteIri(value);

const isKnownPredicate = (value: string): boolean => expandPredicate(value) !== undefined;

/**
 * Guard for schema handles at tuple endpoints.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { isSchemaHandle } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * isSchemaHandle(S.String) // => true
 * isSchemaHandle("skos:Concept") // => false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isSchemaHandle = (value: unknown): value is SchemaHandle => P.hasProperty(value, "ast");

const TermString = S.String.check(
  S.makeFilter(isTermString, {
    identifier: $I`TermStringCheck`,
    title: "Term String",
    description: "A known CURIE or absolute IRI term string.",
    message: "Term strings must be known CURIEs or absolute IRIs.",
  })
).pipe(
  $I.annoteSchema("TermString", {
    description: "Known CURIE or absolute IRI accepted at tuple endpoints.",
  })
);

const PredicateString = S.String.check(
  S.makeFilter(isKnownPredicate, {
    identifier: $I`PredicateStringCheck`,
    title: "Predicate String",
    description: "A known borrowed predicate CURIE, optionally reverse-marked.",
    message: "Predicates must be known CURIEs, optionally prefixed with ^.",
  })
).pipe(
  $I.annoteSchema("PredicateString", {
    description: "Closed predicate CURIE accepted at tuple predicate positions.",
  })
);

const SchemaHandleValue = S.declare(isSchemaHandle, {
  identifier: $I`SchemaHandleValue`,
  title: "Schema Handle",
  description: "An Effect Schema class or schema handle.",
});

const TypedLiteralValue = S.Struct({
  value: S.Union([S.String, S.Finite, S.Boolean]),
  datatype: S.optionalKey(TermString),
  language: S.optionalKey(LanguageTag),
})
  .check(
    S.makeFilter((literal) => literal.datatype === undefined || literal.language === undefined, {
      identifier: $I`TypedLiteralExclusivityCheck`,
      title: "Typed Literal Exclusivity",
      description: "RDF literals carry a language tag or an explicit datatype, never both.",
      message: "Typed literals cannot carry both language and datatype.",
    })
  )
  .pipe(
    $I.annoteSchema("TypedLiteralValue", {
      description: "Typed literal wrapper accepted at tuple object positions.",
    })
  );

const SubjectValue = S.Union([SchemaHandleValue, TermString]);
const ObjectValue = S.Union([SchemaHandleValue, TermString, TypedLiteralValue]);

/**
 * Runtime schema for one relational fact tuple.
 *
 * The tuple grammar is itself schema-validated — the ontology definition is
 * an instance of schema-is-truth, not an exception.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { TripleValue } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(TripleValue)(["skos:Concept", "rdfs:seeAlso", "owl:Thing"])
 * decoded._tag // => "Some"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TripleValue = S.Tuple([SubjectValue, PredicateString, ObjectValue]).pipe(
  $I.annoteSchema("TripleValue", {
    description: "Schema-validated relational fact tuple.",
  })
);

/**
 * Runtime type for {@link TripleValue}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { TripleValue } from "@beep/ontology"
 *
 * const decoded: TripleValue = ["skos:Concept", "rdfs:seeAlso", "http://www.w3.org/2002/07/owl#Thing"]
 * console.log(decoded[1])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TripleValue = typeof TripleValue.Type;

/**
 * SKOS classification marker recorded on assembled classes.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { SkosClassification } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(SkosClassification)("concept") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkosClassification = LiteralKit(["concept", "conceptScheme"]).pipe(
  $I.annoteSchema("SkosClassification", {
    description: "SKOS classification marker driving @type emission.",
  })
);

/**
 * Runtime type for {@link SkosClassification}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { SkosClassification } from "@beep/ontology"
 *
 * const marker: SkosClassification = "conceptScheme"
 * console.log(marker)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SkosClassification = typeof SkosClassification.Type;

/**
 * Predicate kind inferred from the schema AST at fold time.
 *
 * Scalar-valued keys become datatype predicates; schema-valued keys become
 * object predicates. The kind is inferred, never declared.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { AssembledPredicateKind } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(AssembledPredicateKind)("datatype") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AssembledPredicateKind = LiteralKit(["datatype", "object"]).pipe(
  $I.annoteSchema("AssembledPredicateKind", {
    description: "Inferred predicate kind for assembled field predicates.",
  })
);

/**
 * Runtime type for {@link AssembledPredicateKind}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { AssembledPredicateKind } from "@beep/ontology"
 *
 * const kind: AssembledPredicateKind = "object"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AssembledPredicateKind = typeof AssembledPredicateKind.Type;

/**
 * Resolved literal payload carried by an assembled fact object.
 *
 * **Example** (Usage)
 * ```ts
 * import { FactLiteral } from "@beep/ontology"
 * import * as O from "effect/Option"
 *
 * const literal = FactLiteral.make({ value: "Claim", datatypeIri: O.none(), language: O.none() })
 * console.log(literal.value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FactLiteral extends S.Class<FactLiteral>($I`FactLiteral`)(
  {
    value: S.Union([S.String, S.Finite, S.Boolean]),
    datatypeIri: S.OptionFromOptionalKey(IRI),
    language: S.OptionFromOptionalKey(LanguageTag),
  },
  $I.annote("FactLiteral", {
    description: "Resolved typed literal carried by an assembled fact.",
  })
) {}

/**
 * Resolved object position of an assembled fact: an IRI or a literal.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { FactObject } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(FactObject)("https://schema.org/CreativeWork") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FactObject = S.Union([IRI, FactLiteral]).pipe(
  $I.annoteSchema("FactObject", {
    description: "Resolved fact object: IRI reference or typed literal.",
  })
);

/**
 * Runtime type for {@link FactObject}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { FactObject } from "@beep/ontology"
 * import { FactLiteral } from "@beep/ontology"
 * import * as O from "effect/Option"
 *
 * const object: FactObject = FactLiteral.make({ value: 1, datatypeIri: O.none(), language: O.none() })
 * console.log(object)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FactObject = typeof FactObject.Type;

/**
 * One assembled relational fact with resolved IRIs.
 *
 * The assembled model is predicate-open: every relation is a fact record,
 * never an enumerated field.
 *
 * **Example** (Usage)
 * ```ts
 * import { AssembledFact } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const fact = S.decodeUnknownSync(AssembledFact)({
 *   subjectIri: "https://ns.beep.sh/patent/Claim",
 *   predicateIri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
 *   object: "http://www.w3.org/2002/07/owl#Thing",
 *   reverse: false,
 * })
 * console.log(fact.predicateIri)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AssembledFact extends S.Class<AssembledFact>($I`AssembledFact`)(
  {
    subjectIri: IRI,
    predicateIri: IRI,
    object: FactObject,
    reverse: S.Boolean,
  },
  $I.annote("AssembledFact", {
    description: "Assembled subject/predicate/object fact with a reverse marker.",
  })
) {}

/**
 * One assembled field predicate with its inferred kind.
 *
 * **Example** (Usage)
 * ```ts
 * import { AssembledPredicate } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const predicate = S.decodeUnknownSync(AssembledPredicate)({
 *   key: "prefLabel",
 *   term: "skos:prefLabel",
 *   termIri: "http://www.w3.org/2004/02/skos/core#prefLabel",
 *   kind: "datatype",
 *   reverse: false,
 * })
 * console.log(predicate.kind)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AssembledPredicate extends S.Class<AssembledPredicate>($I`AssembledPredicate`)(
  {
    key: S.NonEmptyString,
    term: S.NonEmptyString,
    termIri: IRI,
    kind: AssembledPredicateKind,
    description: S.OptionFromOptionalKey(S.NonEmptyString),
    rangeIri: S.OptionFromOptionalKey(IRI),
    reverse: S.Boolean,
  },
  $I.annote("AssembledPredicate", {
    description: "Assembled field predicate with inferred datatype/object kind.",
  })
) {}

/**
 * One assembled ontology class with its field predicates.
 *
 * **Example** (Usage)
 * ```ts
 * import { AssembledClass } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const assembled = S.decodeUnknownSync(AssembledClass)({
 *   name: "Claim",
 *   iri: "https://ns.beep.sh/patent/Claim",
 *   curie: "beep:patent/Claim",
 *   predicates: [],
 * })
 * console.log(assembled.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AssembledClass extends S.Class<AssembledClass>($I`AssembledClass`)(
  {
    name: S.NonEmptyString,
    iri: IRI,
    curie: S.NonEmptyString,
    description: S.OptionFromOptionalKey(S.NonEmptyString),
    skos: S.OptionFromOptionalKey(SkosClassification),
    predicates: S.Array(AssembledPredicate),
  },
  $I.annote("AssembledClass", {
    description: "Assembled ontology class with collected field predicates.",
  })
) {}

/**
 * Warning codes surfaced by the SKOS integrity gate.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { OntologyWarningCode } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(OntologyWarningCode)("missingConceptScheme") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OntologyWarningCode = LiteralKit([
  "missingConceptScheme",
  "missingPrefLabel",
  "relatedDuplicatesHierarchy",
]).pipe(
  $I.annoteSchema("OntologyWarningCode", {
    description: "Stable warning code emitted by the SKOS integrity gate.",
  })
);

/**
 * Runtime type for {@link OntologyWarningCode}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OntologyWarningCode } from "@beep/ontology"
 *
 * const code: OntologyWarningCode = "missingPrefLabel"
 * console.log(code)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyWarningCode = typeof OntologyWarningCode.Type;

/**
 * Observable warning attached to an assembled ontology.
 *
 * Warnings never fail the fold; hard SKOS integrity violations become typed
 * {@link OntologyAssemblyError} failures instead.
 *
 * **Example** (Usage)
 * ```ts
 * import { OntologyValidationWarning } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const warning = S.decodeUnknownSync(OntologyValidationWarning)({
 *   code: "missingPrefLabel",
 *   message: "SKOS concept has no preferred label.",
 * })
 * console.log(warning.code)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class OntologyValidationWarning extends S.Class<OntologyValidationWarning>($I`OntologyValidationWarning`)(
  {
    code: OntologyWarningCode,
    message: S.NonEmptyString,
    subjectIri: S.OptionFromOptionalKey(IRI),
  },
  $I.annote("OntologyValidationWarning", {
    description: "Observable SKOS gate warning on an assembled ontology.",
  })
) {}

/**
 * The assembled, deterministic result of an ontology fold.
 *
 * **Example** (Usage)
 * ```ts
 * import { AssembledOntology } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * const assembled = S.decodeUnknownSync(AssembledOntology)({
 *   label: "Patent Core",
 *   baseIri: "https://ns.beep.sh/patent",
 *   prefix: "beep",
 *   classes: [],
 *   facts: [],
 *   warnings: [],
 * })
 * console.log(assembled.label)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AssembledOntology extends S.Class<AssembledOntology>($I`AssembledOntology`)(
  {
    label: S.NonEmptyString,
    baseIri: IRI,
    prefix: S.NonEmptyString,
    classes: S.Array(AssembledClass),
    facts: S.Array(AssembledFact),
    warnings: S.Array(OntologyValidationWarning),
  },
  $I.annote("AssembledOntology", {
    description: "Predicate-open assembled ontology with observable warnings.",
  })
) {}

/**
 * Failure reasons for the ontology fold's diagnostics ledger.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { OntologyAssemblyErrorReason } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(OntologyAssemblyErrorReason)("unknownTerm") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OntologyAssemblyErrorReason = LiteralKit([
  "missingClassAnnotation",
  "unresolvedHandle",
  "unknownTerm",
  "unsupportedFieldAst",
  "invalidTriple",
  "invalidLabel",
  "reservedPrefix",
  "skosIntegrity",
]).pipe(
  $I.annoteSchema("OntologyAssemblyErrorReason", {
    description: "Closed failure-reason domain for the ontology fold.",
  })
);

/**
 * Runtime type for {@link OntologyAssemblyErrorReason}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { OntologyAssemblyErrorReason } from "@beep/ontology"
 *
 * const reason: OntologyAssemblyErrorReason = "unresolvedHandle"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyAssemblyErrorReason = typeof OntologyAssemblyErrorReason.Type;

/**
 * Typed assembly failure raised by the ontology fold's gate.
 *
 * **Example** (Usage)
 * ```ts
 * import { OntologyAssemblyError } from "@beep/ontology"
 * import * as O from "effect/Option"
 *
 * const error = OntologyAssemblyError.make({
 *   reason: "unknownTerm",
 *   message: "Unknown predicate CURIE: nope:term",
 *   term: O.some("nope:term"),
 *   field: O.none(),
 *   identifier: O.none(),
 *   subjectIri: O.none(),
 *   objectIri: O.none(),
 * })
 * console.log(error.reason)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class OntologyAssemblyError extends S.TaggedError<OntologyAssemblyError>($I`OntologyAssemblyError`)(
  "OntologyAssemblyError",
  {
    reason: OntologyAssemblyErrorReason,
    message: S.NonEmptyString,
    term: S.OptionFromOptionalKey(S.NonEmptyString),
    field: S.OptionFromOptionalKey(S.NonEmptyString),
    identifier: S.OptionFromOptionalKey(S.NonEmptyString),
    subjectIri: S.OptionFromOptionalKey(IRI),
    objectIri: S.OptionFromOptionalKey(IRI),
  },
  $I.annoteError<OntologyAssemblyError>("OntologyAssemblyError", {
    description: "Typed diagnostics-ledger failure for the ontology fold.",
  })
) {}

/**
 * Derived guard for {@link AssembledFact} literal objects.
 *
 * **Example** (Usage)
 * ```ts import.meta.vitest name="Usage"
 * import { FactLiteral, isFactLiteral } from "@beep/ontology"
 * import * as O from "effect/Option"
 *
 * const literal = FactLiteral.make({ value: 1, datatypeIri: O.none(), language: O.none() })
 * isFactLiteral(literal) // => true
 * isFactLiteral("https://schema.org/CreativeWork") // => false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isFactLiteral = S.is(FactLiteral);
