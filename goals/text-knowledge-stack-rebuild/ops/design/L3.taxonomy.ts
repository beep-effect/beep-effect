/**
 * L3 taxonomy and alignments: SSSOM mapping sets with a typed confidence
 * signal, the gUFO audit over the typed subset, and the mapping coherence
 * check.
 *
 * Target home: `@beep/ontology` (foundation/modeling). The confidence signal
 * reuses `makeSignal` and `Measurement` from `@beep/epistemics`, an
 * ontology -> epistemics edge the report's DAG does not list (see the index
 * header).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// Ruling 6: makeSignal and Measurement move to @beep/schema in P4; until then they are read from epistemics.
import { Measurement, makeSignal } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { SpdxExpression } from "@beep/spdx/SpdxExpression";
import * as S from "effect/Schema";
import { CanonicalHashSet, GufoClassType, Term, TermIri } from "./L0.identity.ts";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L3.taxonomy");

/**
 * SKOS mapping relations an SSSOM row may assert.
 *
 * **Details**
 *
 * In P5 this replaces `@beep/ontology` `SkosMappingKind` (exactMatch,
 * closeMatch): SSSOM needs all five relations, and the consumers of the
 * unprefixed spellings (`SemanticFoundation.models.ts`, `TaxonomyLoader`) migrate
 * to the prefixed ones in the same PR.
 */
export const MappingPredicate = LiteralKit([
  "skos:exactMatch",
  "skos:closeMatch",
  "skos:broadMatch",
  "skos:narrowMatch",
  "skos:relatedMatch",
]).pipe(
  $I.annoteSchema("MappingPredicate", { description: "SSSOM predicate_id restricted to SKOS mapping relations." })
);

/** Decoded type of {@link MappingPredicate}. */
export type MappingPredicate = typeof MappingPredicate.Type;

/** SEMAPV justifications an SSSOM row may carry. */
export const MappingJustification = LiteralKit([
  "semapv:ManualMappingCuration",
  "semapv:LexicalMatching",
  "semapv:LogicalReasoning",
  "semapv:SemanticSimilarityThresholdMatching",
  "semapv:UnspecifiedMatching",
]).pipe($I.annoteSchema("MappingJustification", { description: "SSSOM mapping_justification values." }));

/** Decoded type of {@link MappingJustification}. */
export type MappingJustification = typeof MappingJustification.Type;

/** Mapping confidence as a typed signal: a measurement, or absent with a reason; never a defaulted number. */
export const MappingConfidence = makeSignal(Measurement).pipe(
  $I.annoteSchema("MappingConfidence", { description: "Present measurement or Absent{reason}." })
);

/** Decoded type of {@link MappingConfidence}. */
export type MappingConfidence = typeof MappingConfidence.Type;

/** One SSSOM mapping row. */
export class Mapping extends S.Opaque<Mapping, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: TermIri,
    predicate: MappingPredicate,
    object: TermIri,
    justification: MappingJustification,
    confidence: MappingConfidence,
  }).pipe($I.annoteSchema("Mapping", { description: "An SSSOM row between two registry terms." }))
) {}

/** An SSSOM mapping set: identified, versioned, licensed, a set of rows. */
export class MappingSet extends S.Opaque<MappingSet, { readonly brand: unique symbol }>()(
  S.Struct({
    id: TermIri.annotateKey({ description: "mapping_set_id." }),
    version: S.NonEmptyString.annotateKey({ description: "mapping_set_version." }),
    license: SpdxExpression.FromString.annotateKey({ description: "license, as an SPDX expression (@beep/spdx)." }),
    mappings: S.HashSet(Mapping),
  }).pipe($I.annoteSchema("MappingSet", { description: "An SSSOM mapping set." }))
) {}

/** The typed hierarchy the audit reads: registry terms and their asserted specializations. */
export class TypedHierarchy extends S.Opaque<TypedHierarchy, { readonly brand: unique symbol }>()(
  S.Struct({
    terms: S.HashMap(TermIri, Term),
    specializes: S.HashMap(TermIri, CanonicalHashSet(TermIri)).annotateKey({
      description: "Direct supertypes of each class term.",
    }),
  }).pipe($I.annoteSchema("TypedHierarchy", { description: "Terms and specialization edges for the gUFO audit." }))
) {}

/** A gUFO audit finding over the typed subset (L3-3: sound on typed terms, silent on untyped ones). */
export const OntoViolation = S.TaggedUnion({
  RoleWithoutKind: { term: TermIri },
  RigidSpecializesAntiRigid: {
    term: TermIri,
    supertype: TermIri,
    termType: GufoClassType,
    supertypeType: GufoClassType,
  },
  RelatorUndermediated: { term: TermIri, mediates: CanonicalHashSet(TermIri) },
}).pipe($I.annoteSchema("OntoViolation", { description: "A violated gUFO typing constraint." }));

/** Decoded type of {@link OntoViolation}. */
export type OntoViolation = typeof OntoViolation.Type;

/** A mapping-set coherence finding (L3-2). */
export const MappingIncoherence = S.TaggedUnion({
  DisjointUpperTypes: { subject: TermIri, objects: CanonicalHashSet(TermIri) },
  ConflictingPredicates: { subject: TermIri, object: TermIri, predicates: S.HashSet(MappingPredicate) },
}).pipe($I.annoteSchema("MappingIncoherence", { description: "A mapping set that is not coherent." }));

/** Decoded type of {@link MappingIncoherence}. */
export type MappingIncoherence = typeof MappingIncoherence.Type;

/** Audit one term against the typed hierarchy; untyped terms yield no finding. */
export declare const audit: (hierarchy: TypedHierarchy) => (term: Term) => ReadonlyArray<OntoViolation>;

/** Check a mapping set for coherence against the typed hierarchy's disjoint upper types. */
export declare const checkMappingCoherence: (
  hierarchy: TypedHierarchy
) => (set: MappingSet) => ReadonlyArray<MappingIncoherence>;
