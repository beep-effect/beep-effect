/**
 * Versioned repository-owned vocabulary models for docketing and legal participation.
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRIReference } from "@beep/identity/Iri";
import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ConceptAlignment } from "./ConceptScheme.ts";

const $I = $OntologyId.create("Vocabulary.models");

/**
 * Separates docketing terms, party-holder kinds and contextual legal roles.
 *
 * **Example** (Select legal roles)
 * ```ts
 * import { VocabularySchemeKind } from "@beep/ontology/Vocabulary.models"
 * console.log(VocabularySchemeKind.is["legal-roles"]("legal-roles"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const VocabularySchemeKind = LiteralKit(["docketing", "party-kinds", "legal-roles"]).pipe(
  $I.annoteSchema("VocabularySchemeKind", { description: "Separate repository vocabulary scheme families." })
);
/**
 * The decoded vocabulary scheme family.
 * @category type-level
 * @since 0.0.0
 */
export type VocabularySchemeKind = typeof VocabularySchemeKind.Type;

/**
 * An explicit scheme and version requested by a vocabulary consumer.
 *
 * **Example** (Pin docketing vocabulary)
 * ```ts
 * import { VocabularyPin } from "@beep/ontology/Vocabulary.models"
 * console.log(VocabularyPin.make({ kind: "docketing", version: "1.0.0" }).version)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VocabularyPin extends S.Opaque<VocabularyPin, { readonly brand: unique symbol }>()(
  S.Struct({ kind: VocabularySchemeKind, version: S.NonEmptyString }).pipe(
    $I.annoteSchema("VocabularyPin", { description: "Explicit version selection without a latest alias." })
  )
) {}

/**
 * A descriptive SKOS term with source notes and bounded broader metadata.
 *
 * **Example** (Read a deadline definition)
 * ```ts
 * import { DocketingVocabulary } from "@beep/ontology/Vocabulary.seed"
 * console.log(DocketingVocabulary.concepts[0]?.definition)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VocabularyConcept extends S.Opaque<VocabularyConcept, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: IRIReference,
    notation: S.NonEmptyString,
    prefLabel: S.NonEmptyString,
    definition: S.NonEmptyString,
    broader: S.Array(IRIReference),
    sourceIri: IRIReference,
    sourceNote: S.NonEmptyString,
    alignments: S.Array(ConceptAlignment),
  }).pipe(
    $I.annoteSchema("VocabularyConcept", {
      description: "Repo-owned vocabulary term; no entity or legal-action computation.",
    })
  )
) {}

/**
 * A complete committed vocabulary scheme exposing its consumer version pin.
 *
 * **Example** (Inspect party-kind version)
 * ```ts
 * import { PartyKindVocabulary } from "@beep/ontology/Vocabulary.seed"
 * console.log(PartyKindVocabulary.version)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VocabularySeed extends S.Opaque<VocabularySeed, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: VocabularySchemeKind,
    version: S.NonEmptyString,
    schemeIri: IRIReference,
    title: S.NonEmptyString,
    concepts: S.Array(VocabularyConcept),
  }).pipe(
    $I.annoteSchema("VocabularySeed", { description: "Versioned SKOS seed for a single separate vocabulary family." })
  )
) {}

/**
 * Reasons a vocabulary pin or exact concept lookup cannot be satisfied.
 *
 * **Example** (Recognize an unavailable version)
 * ```ts
 * import { VocabularyFailureReason } from "@beep/ontology/Vocabulary.models"
 * console.log(VocabularyFailureReason.is["version-unpinned"]("version-unpinned"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const VocabularyFailureReason = LiteralKit(["invalid-pin", "version-unpinned", "concept-not-found"]).pipe(
  $I.annoteSchema("VocabularyFailureReason", {
    description: "Typed failure reasons for exact versioned vocabulary admission.",
  })
);
/**
 * The decoded vocabulary lookup failure reason.
 * @category type-level
 * @since 0.0.0
 */
export type VocabularyFailureReason = typeof VocabularyFailureReason.Type;

/**
 * A typed failure retaining the rejected version or notation as diagnostic context.
 *
 * **Example** (Describe an unavailable version)
 * ```ts
 * import { VocabularyError } from "@beep/ontology/Vocabulary.models"
 * console.log(VocabularyError.make({ reason: "version-unpinned", detail: "docketing 2.0.0" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class VocabularyError extends S.TaggedError<VocabularyError, { readonly brand: unique symbol }>(
  $I`VocabularyError`
)(
  "VocabularyError",
  { reason: VocabularyFailureReason, detail: S.String },
  $I.annoteError<VocabularyError>("VocabularyError", { description: "Failed version admission or concept resolution." })
) {}
