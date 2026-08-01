/**
 * Contradiction-candidate value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { TrimmedNonEmptyText } from "@beep/schema/CommonTextSchemas";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { PosInt } from "@beep/schema/Int";
import { JsonObject } from "@beep/schema/Json";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import { P, R } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DateTime, flow, identity, Order, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Confidence } from "../EvidenceSpan/index.ts";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import { LogicalEdgeKey } from "../LogicalEdgeIdentity/index.ts";
import type { JsonObject as JsonObjectValue } from "@beep/schema/Json";

const $I = $EpistemicDomainId.create("values/Contradiction/Contradiction.model");

/**
 * Digest identifying one contradiction candidate independent of submission
 * order.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionCandidateKey.is("a".repeat(64)))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateKey = Sha256Hex.pipe(
  S.brand("ContradictionCandidateKey"),
  $I.annoteSchema("ContradictionCandidateKey", {
    description: "SHA-256 digest identifying one canonical contradiction candidate and match basis.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionCandidateKey}.
 *
 * @example
 * ```ts
 * import type { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const keys: ReadonlyArray<ContradictionCandidateKey> = []
 * console.log(keys.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateKey = typeof ContradictionCandidateKey.Type;

/**
 * Caller-owned idempotency key for one contradiction submission receipt.
 *
 * @example
 * ```ts
 * import { ContradictionReceiptKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionReceiptKey.is("b".repeat(64)))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionReceiptKey = Sha256Hex.pipe(
  S.brand("ContradictionReceiptKey"),
  $I.annoteSchema("ContradictionReceiptKey", {
    description: "Caller-owned SHA-256 idempotency key for one contradiction-submission receipt.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionReceiptKey}.
 *
 * @example
 * ```ts
 * import type { ContradictionReceiptKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const keys: ReadonlyArray<ContradictionReceiptKey> = []
 * console.log(keys.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReceiptKey = typeof ContradictionReceiptKey.Type;

/**
 * Digest of the immutable payload stored under a candidate identity.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest = ContradictionCandidateDigest.make(Str.repeat(64)("a"))
 * console.log(ContradictionCandidateDigest.is(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionCandidateDigest = Sha256Hex.pipe(
  S.brand("ContradictionCandidateDigest"),
  $I.annoteSchema("ContradictionCandidateDigest", {
    description: "SHA-256 digest guarding the complete immutable payload stored for a contradiction candidate.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionCandidateDigest}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionCandidateDigest,
 *   type ContradictionCandidateDigest as CandidateDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest: CandidateDigestValue = ContradictionCandidateDigest.make(Str.repeat(64)("a"))
 * console.log(ContradictionCandidateDigest.is(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionCandidateDigest = typeof ContradictionCandidateDigest.Type;

/**
 * Digest of the exact evidence sets used as a contradiction match basis.
 *
 * @example
 * ```ts
 * import { ContradictionEvidenceDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest = ContradictionEvidenceDigest.make(Str.repeat(64)("b"))
 * console.log(ContradictionEvidenceDigest.is(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionEvidenceDigest = Sha256Hex.pipe(
  S.brand("ContradictionEvidenceDigest"),
  $I.annoteSchema("ContradictionEvidenceDigest", {
    description: "Order-independent SHA-256 digest of the exact evidence ids in one contradiction basis.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionEvidenceDigest}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionEvidenceDigest,
 *   type ContradictionEvidenceDigest as EvidenceDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest: EvidenceDigestValue = ContradictionEvidenceDigest.make(Str.repeat(64)("b"))
 * console.log(ContradictionEvidenceDigest.is(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionEvidenceDigest = typeof ContradictionEvidenceDigest.Type;

/**
 * Stable proposal identifier persisted before human review.
 *
 * @example
 * ```ts
 * import { ContradictionProposalId } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const proposalId = ContradictionProposalId.make(Str.repeat(64)("c"))
 * console.log(ContradictionProposalId.is(proposalId)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalId = Sha256Hex.pipe(
  S.brand("ContradictionProposalId"),
  $I.annoteSchema("ContradictionProposalId", {
    description: "Stable SHA-256 identifier for one persisted contradiction resolution proposal.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionProposalId}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionProposalId,
 *   type ContradictionProposalId as ProposalIdValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const proposalId: ProposalIdValue = ContradictionProposalId.make(Str.repeat(64)("c"))
 * console.log(ContradictionProposalId.is(proposalId)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalId = typeof ContradictionProposalId.Type;

/**
 * Digest guarding the complete authority-changing content of a proposal.
 *
 * @example
 * ```ts
 * import { ContradictionProposalDigest } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest = ContradictionProposalDigest.make(Str.repeat(64)("d"))
 * console.log(ContradictionProposalDigest.is(digest)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ContradictionProposalDigest = Sha256Hex.pipe(
  S.brand("ContradictionProposalDigest"),
  $I.annoteSchema("ContradictionProposalDigest", {
    description: "SHA-256 digest binding a proposal id to its losing belief, replacement, validity, and rationale.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ContradictionProposalDigest}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionProposalDigest,
 *   type ContradictionProposalDigest as ProposalDigestValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Str from "effect/String"
 *
 * const digest: ProposalDigestValue = ContradictionProposalDigest.make(Str.repeat(64)("d"))
 * console.log(ContradictionProposalDigest.is(digest)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionProposalDigest = typeof ContradictionProposalDigest.Type;

/**
 * Exact immutable edge version observed as one side of a contradiction.
 *
 * @example
 * ```ts
 * import { BeliefVersionRef } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(BeliefVersionRef.fields.version !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BeliefVersionRef extends S.Class<BeliefVersionRef>($I`BeliefVersionRef`)(
  {
    edgeVersionId: EpistemicIdentity.EdgeVersionId.annotateKey({
      description: "Immutable edge-version row observed by the detector.",
    }),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Logical lineage containing the observed edge version.",
    }),
    version: PosInt.annotateKey({
      description: "Optimistic logical version observed by the detector.",
    }),
  },
  $I.annote("BeliefVersionRef", {
    description: "Exact immutable edge version observed as one side of a contradiction candidate.",
  })
) {}

const encodeBeliefRef = (ref: BeliefVersionRef): string =>
  A.join([ref.logicalKey, `${ref.edgeVersionId}`, `${ref.version}`], ":");

const beliefRefOrder = Order.mapInput(Order.String, encodeBeliefRef);
const beliefRefComesBefore = Order.isLessThan(beliefRefOrder);
const edgeVersionIdEquivalent = S.toEquivalence(BeliefVersionRef.fields.edgeVersionId);
const beliefsAreDistinct = ({ left, right }: { readonly left: BeliefVersionRef; readonly right: BeliefVersionRef }) =>
  !edgeVersionIdEquivalent(left.edgeVersionId, right.edgeVersionId);

class ContradictionBeliefPairStruct extends S.Class<ContradictionBeliefPairStruct>($I`ContradictionBeliefPairStruct`)(
  {
    left: BeliefVersionRef.annotateKey({ description: "Belief presented on the left side of a submission." }),
    right: BeliefVersionRef.annotateKey({ description: "Belief presented on the right side of a submission." }),
  },
  $I.annote("ContradictionBeliefPairStruct", {
    description: "Structural contradiction belief pair before distinctness is checked.",
  })
) {}

const DistinctBeliefPairCheck = S.makeFilter(beliefsAreDistinct, {
  identifier: $I`DistinctBeliefPairCheck`,
  title: "Distinct Contradiction Belief Pair",
  description: "Checks that the two sides reference different immutable edge-version rows.",
  message: "Expected left and right to reference different edge versions.",
});

const contradictionBeliefPairStructArbitrary = S.toArbitraryLazy(ContradictionBeliefPairStruct);
const ContradictionBeliefPairSchema = ContradictionBeliefPairStruct.mapFields(identity)
  .check(DistinctBeliefPairCheck)
  .annotate({
    toArbitrary: () => (fc) => contradictionBeliefPairStructArbitrary(fc).filter(beliefsAreDistinct),
  });

/**
 * Submission-order pair of exact conflicting belief versions.
 *
 * Public submissions may present either side first. Persisted candidates use
 * {@link CanonicalContradictionBeliefPair} after
 * {@link canonicalizeContradiction} has kept each evidence set attached to its
 * corresponding belief.
 *
 * @example
 * ```ts
 * import { ContradictionBeliefPair } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionBeliefPair.fields.left !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionBeliefPair extends S.Class<ContradictionBeliefPair>($I`ContradictionBeliefPair`)(
  ContradictionBeliefPairSchema,
  $I.annote("ContradictionBeliefPair", {
    description: "Submission-order pair of exact conflicting belief versions.",
  })
) {}

const CanonicalBeliefPairCheck = S.makeFilter(
  ({ left, right }: ContradictionBeliefPair) => beliefRefComesBefore(left, right),
  {
    identifier: $I`CanonicalBeliefPairCheck`,
    title: "Canonical Contradiction Belief Pair",
    description: "Checks that a persisted contradiction pair is ordered by its stable encoded belief references.",
    message: "Expected the distinct left belief reference to sort before the right belief reference.",
  }
);

const beliefVersionRefArbitrary = S.toArbitraryLazy(BeliefVersionRef);

const CanonicalContradictionBeliefPairSchema = ContradictionBeliefPair.mapFields(identity)
  .check(DistinctBeliefPairCheck)
  .check(CanonicalBeliefPairCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(beliefVersionRefArbitrary(fc), beliefVersionRefArbitrary(fc))
        .filter(([left, right]) => beliefsAreDistinct({ left, right }))
        .map(([left, right]) =>
          pipe(
            beliefRefComesBefore(left, right),
            Bool.match({
              onFalse: () => ContradictionBeliefPair.make({ left: right, right: left }),
              onTrue: () => ContradictionBeliefPair.make({ left, right }),
            })
          )
        ),
  });

/**
 * Canonically ordered pair persisted inside a contradiction candidate.
 *
 * @example
 * ```ts
 * import { CanonicalContradictionBeliefPair } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CanonicalContradictionBeliefPair.fields.left !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class CanonicalContradictionBeliefPair extends S.Class<CanonicalContradictionBeliefPair>(
  $I`CanonicalContradictionBeliefPair`
)(
  CanonicalContradictionBeliefPairSchema,
  $I.annote("CanonicalContradictionBeliefPair", {
    description: "Checked canonical ordering of the immutable belief-version pair persisted in a candidate.",
  })
) {}

/**
 * Evidence and detector revision that form the repeatable match basis.
 *
 * @example
 * ```ts
 * import { ContradictionMatchBasis } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionMatchBasis.fields.evidenceDigest !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
const ContradictionMatchBasisKindBase = LiteralKit(["same-source-overlap", "independent-evidence"]);

/**
 * Bounded semantic basis on which a detector may assert a contradiction.
 *
 * @example
 * ```ts
 * import { ContradictionMatchBasisKind } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const kind = ContradictionMatchBasisKind.Enum["independent-evidence"]
 * console.log(ContradictionMatchBasisKind.is["independent-evidence"](kind)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionMatchBasisKind = ContradictionMatchBasisKindBase.pipe(
  $I.annoteSchema("ContradictionMatchBasisKind", {
    description: "Whether a contradiction is grounded in overlapping source text or independent evidence.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionMatchBasisKindBase)
);

/**
 * Runtime type for {@link ContradictionMatchBasisKind}.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionMatchBasisKind,
 *   type ContradictionMatchBasisKind as MatchBasisKindValue,
 * } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const kind: MatchBasisKindValue = ContradictionMatchBasisKind.Enum["independent-evidence"]
 * console.log(ContradictionMatchBasisKind.is["independent-evidence"](kind)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionMatchBasisKind = typeof ContradictionMatchBasisKind.Type;

const evidenceIdEquivalence = S.toEquivalence(EpistemicIdentity.EvidenceId);
const evidenceIdArbitrary = S.toArbitraryLazy(EpistemicIdentity.EvidenceId);
const evidenceIdOrder = Order.mapInput(Order.String, (evidenceId: EpistemicIdentity.EvidenceId) => `${evidenceId}`);
const hasUniqueEvidenceIds = (ids: ReadonlyArray<EpistemicIdentity.EvidenceId>): boolean =>
  Eq.equals(A.length(A.dedupeWith(ids, evidenceIdEquivalence)), A.length(ids));

/**
 * Maximum evidence identifiers retained on either side of one contradiction.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_EVIDENCE_SET_MAX_COUNT } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_EVIDENCE_SET_MAX_COUNT) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_EVIDENCE_SET_MAX_COUNT = 32;

/**
 * Maximum UTF-16 length accepted for a contradiction detector identity.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_DETECTOR_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_DETECTOR_MAX_LENGTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_DETECTOR_MAX_LENGTH = 256;

const ContradictionDetectorIdentity = S.NonEmptyString.check(
  S.isMaxLength(CONTRADICTION_DETECTOR_MAX_LENGTH, {
    identifier: $I`ContradictionDetectorIdentityMaximumLengthCheck`,
    title: "Contradiction Detector Identity Maximum Length",
    description: "Checks that a contradiction detector identity contains at most 256 UTF-16 code units.",
    message: "Expected contradiction detector identity to contain at most 256 UTF-16 code units.",
  })
).pipe(
  $I.annoteSchema("ContradictionDetectorIdentity", {
    description: "Non-empty stable detector identity containing at most 256 UTF-16 code units.",
  })
);

const UniqueNonEmptyEvidenceIds = S.NonEmptyArray(EpistemicIdentity.EvidenceId)
  .check(
    S.isMaxLength(CONTRADICTION_EVIDENCE_SET_MAX_COUNT, {
      identifier: $I`UniqueNonEmptyEvidenceIdsMaximumLengthCheck`,
      title: "Contradiction Evidence Set Maximum Count",
      description: "Checks that either side of one contradiction retains at most 32 evidence identifiers.",
      message: "Expected at most 32 EvidenceIds in either contradiction evidence set.",
    })
  )
  .check(
    S.makeFilter(hasUniqueEvidenceIds, {
      identifier: $I`UniqueNonEmptyEvidenceIdsCheck`,
      title: "Unique Non-Empty Evidence IDs",
      description: "Checks that an evidence set contains at least one id and never repeats an id.",
      message: "Expected every EvidenceId in the non-empty evidence set to be unique.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(evidenceIdArbitrary(fc), fc.array(evidenceIdArbitrary(fc), { maxLength: 7 }))
        .map(([head, tail]) => A.dedupeWith([head, ...tail], evidenceIdEquivalence)),
  })
  .pipe(
    $I.annoteSchema("UniqueNonEmptyEvidenceIds", {
      description: "A non-empty side-specific contradiction evidence set containing no repeated EvidenceId.",
    })
  );

class ContradictionMatchBasisStruct extends S.Class<ContradictionMatchBasisStruct>($I`ContradictionMatchBasisStruct`)(
  {
    detector: ContradictionDetectorIdentity.annotateKey({
      description: "Stable detector or caller name; it identifies provenance, not authority.",
    }),
    detectorVersion: SemanticVersion.annotateKey({
      description: "Version of the detector semantics that produced this basis.",
    }),
    evidenceDigest: ContradictionEvidenceDigest.annotateKey({
      description: "Digest binding the exact side-specific evidence sets.",
    }),
    kind: ContradictionMatchBasisKind.annotateKey({
      description: "Typed semantic basis for the match.",
    }),
    leftEvidenceIds: UniqueNonEmptyEvidenceIds.annotateKey({
      description: "Evidence grounding the first canonical belief.",
    }),
    rightEvidenceIds: UniqueNonEmptyEvidenceIds.annotateKey({
      description: "Evidence grounding the second canonical belief.",
    }),
  },
  $I.annote("ContradictionMatchBasisStruct", {
    description: "Internal structural base for a contradiction candidate match basis.",
  })
) {}

const evidenceSetsAreDisjoint = ({ leftEvidenceIds, rightEvidenceIds }: ContradictionMatchBasisStruct): boolean =>
  A.every(leftEvidenceIds, (leftId) =>
    A.every(rightEvidenceIds, (rightId) => Bool.not(evidenceIdEquivalence(leftId, rightId)))
  );

const IndependentEvidenceSetsCheck = S.makeFilter(
  (basis: ContradictionMatchBasisStruct) =>
    ContradictionMatchBasisKind.$match(basis.kind, {
      "independent-evidence": () => evidenceSetsAreDisjoint(basis),
      "same-source-overlap": () => true,
    }),
  {
    identifier: $I`IndependentEvidenceSetsCheck`,
    title: "Independent Contradiction Evidence Sets",
    description: "Checks that independent-evidence candidates never reuse one EvidenceId on both sides.",
    message: "Expected left and right evidence sets to be disjoint for an independent-evidence match.",
  }
);

const contradictionMatchBasisStructArbitrary = S.toArbitraryLazy(ContradictionMatchBasisStruct);

const ContradictionMatchBasisSchema = ContradictionMatchBasisStruct.mapFields(identity)
  .check(IndependentEvidenceSetsCheck)
  .annotate({
    toArbitrary: () => (fc) => {
      const evidenceIdSeeds = fc.uniqueArray(fc.integer({ min: 2, max: 1_073_741_823 }), { maxLength: 7 });

      return fc
        .tuple(contradictionMatchBasisStructArbitrary(fc), evidenceIdSeeds, evidenceIdSeeds)
        .map(([basis, leftSeeds, rightSeeds]) =>
          ContradictionMatchBasisKind.$match(basis.kind, {
            "independent-evidence": () =>
              ContradictionMatchBasisStruct.make({
                ...basis,
                leftEvidenceIds: [
                  EpistemicIdentity.EvidenceId.make(1),
                  ...A.map(leftSeeds, (seed) => EpistemicIdentity.EvidenceId.make(seed * 2 - 1)),
                ],
                rightEvidenceIds: [
                  EpistemicIdentity.EvidenceId.make(2),
                  ...A.map(rightSeeds, (seed) => EpistemicIdentity.EvidenceId.make(seed * 2)),
                ],
              }),
            "same-source-overlap": () => basis,
          })
        );
    },
  });

/**
 * Evidence and detector revision that form the repeatable match basis.
 *
 * @example
 * ```ts
 * import { ContradictionMatchBasis } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionMatchBasis.fields.kind !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionMatchBasis extends S.Class<ContradictionMatchBasis>($I`ContradictionMatchBasis`)(
  ContradictionMatchBasisSchema,
  $I.annote("ContradictionMatchBasis", {
    description: "Exact evidence pair and detector revision supporting a contradiction candidate.",
  })
) {}

/**
 * Maximum length accepted for a detector-supplied proposal rationale.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH = 2_000;

/**
 * Maximum canonical UTF-8 bytes accepted for one replacement fact.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_PROPOSAL_FACT_MAX_BYTES } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_FACT_MAX_BYTES) // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_FACT_MAX_BYTES = 64 * 1_024;

const CONTRADICTION_PROPOSAL_FACT_MAX_DEPTH = 32;
const CONTRADICTION_PROPOSAL_FACT_MAX_NODES = 4_096;

type ProposalFactNode = {
  readonly depth: number;
  readonly value: S.Json;
};

const proposalFactObjectEntries = (value: S.Json): ReadonlyArray<readonly [string, S.Json]> =>
  P.isObject(value) ? R.toEntries(value as R.ReadonlyRecord<string, S.Json>) : A.empty();

const proposalFactTextCodeUnits = (value: S.Json, objectEntries: ReadonlyArray<readonly [string, S.Json]>): number =>
  (P.isString(value) ? Str.length(value) : 0) + A.reduce(objectEntries, 0, (total, [key]) => total + Str.length(key));

const proposalFactChildren = (
  value: S.Json,
  objectEntries: ReadonlyArray<readonly [string, S.Json]>
): ReadonlyArray<S.Json> =>
  A.isArray(value) ? (value as ReadonlyArray<S.Json>) : A.map(objectEntries, ([, child]) => child);

const isBoundedProposalFact = (fact: JsonObjectValue): boolean => {
  const pending: Array<ProposalFactNode> = [{ depth: 0, value: fact }];
  let cursor = 0;
  let minimumTextCodeUnits = 0;

  while (cursor < A.length(pending)) {
    const current = A.getUnsafe(pending, cursor);
    if (current.depth > CONTRADICTION_PROPOSAL_FACT_MAX_DEPTH) {
      return false;
    }
    cursor += 1;

    const objectEntries = proposalFactObjectEntries(current.value);
    minimumTextCodeUnits += proposalFactTextCodeUnits(current.value, objectEntries);
    if (minimumTextCodeUnits > CONTRADICTION_PROPOSAL_FACT_MAX_BYTES) {
      return false;
    }

    const children = proposalFactChildren(current.value, objectEntries);
    if (A.length(pending) + A.length(children) > CONTRADICTION_PROPOSAL_FACT_MAX_NODES) {
      return false;
    }
    pending.push(...A.map(children, (value) => ({ depth: current.depth + 1, value })));
  }

  return utf8ToBytes(canonicalJson(fact)).byteLength <= CONTRADICTION_PROPOSAL_FACT_MAX_BYTES;
};

const ContradictionProposalFact = JsonObject.check(
  S.makeFilter(isBoundedProposalFact, {
    identifier: $I`ContradictionProposalFactBoundsCheck`,
    title: "Bounded Contradiction Proposal Fact",
    description:
      "Checks replacement facts before digesting: at most 64 KiB canonical UTF-8, 4,096 JSON nodes, and 32 levels.",
    message: "Expected a bounded contradiction proposal fact.",
  })
).pipe(
  $I.annoteSchema("ContradictionProposalFact", {
    description: "JSON-safe replacement fact bounded before canonicalization, hashing, persistence, and display.",
  })
);

const ContradictionProposalRationale = TrimmedNonEmptyText.check(
  S.isMaxLength(CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH, {
    identifier: $I`ContradictionProposalRationaleMaximumLengthCheck`,
    title: "Contradiction Proposal Rationale Maximum Length",
    description: "Checks that a detector-supplied proposal rationale contains at most 2,000 characters.",
    message: "Expected contradiction proposal rationale to contain at most 2,000 characters.",
  })
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .string({ minLength: 1, maxLength: CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH })
        .map(Str.trim)
        .filter(Str.isNonEmpty),
  })
  .pipe(
    $I.annoteSchema("ContradictionProposalRationale", {
      description: "Trimmed non-empty detector-supplied proposal rationale containing at most 2,000 characters.",
    })
  );

class ContradictionResolutionProposalStruct extends S.Class<ContradictionResolutionProposalStruct>(
  $I`ContradictionResolutionProposalStruct`
)(
  {
    fact: ContradictionProposalFact.annotateKey({
      description: "Immutable JSON-safe replacement fact proposed for the losing lineage.",
    }),
    losingBelief: BeliefVersionRef.annotateKey({
      description: "Exact persisted belief version whose logical lineage the proposal would replace.",
    }),
    proposalDigest: ContradictionProposalDigest.annotateKey({
      description: "Digest guarding every authority-changing proposal field.",
    }),
    proposalId: ContradictionProposalId.annotateKey({
      description: "Stable proposal identifier selected by public review.",
    }),
    rationale: ContradictionProposalRationale.annotateKey({
      description: "Detector-supplied rationale presented to the reviewer.",
    }),
    validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the proposed replacement.",
    }),
    validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound of the replacement, when known.",
    }),
  },
  $I.annote("ContradictionResolutionProposalStruct", {
    description: "Structural contradiction proposal before its half-open valid interval is checked.",
  })
) {}

const validIntervalIsOrdered = Order.isLessThan(DateTime.Order);
const contradictionResolutionProposalStructArbitrary = S.toArbitraryLazy(ContradictionResolutionProposalStruct);
const ContradictionResolutionProposalSchema = ContradictionResolutionProposalStruct.mapFields(identity)
  .check(
    S.makeFilter(
      ({ validFrom, validTo }) =>
        O.match(validTo, {
          onNone: () => true,
          onSome: (upperBound) => validIntervalIsOrdered(validFrom, upperBound),
        }),
      {
        identifier: $I`ContradictionResolutionProposalValidIntervalCheck`,
        title: "Contradiction Resolution Proposal Valid Interval",
        description: "Checks that a closed proposal validity interval is a non-empty forward half-open range.",
        message: "Expected validFrom to be earlier than validTo when validTo is present.",
      }
    )
  )
  .annotate({
    toArbitrary: () => (fc) =>
      contradictionResolutionProposalStructArbitrary(fc).map((proposal) =>
        ContradictionResolutionProposalStruct.make({
          ...proposal,
          validTo: O.filter(proposal.validTo, (upperBound) => validIntervalIsOrdered(proposal.validFrom, upperBound)),
        })
      ),
  });

/**
 * Human-reviewable replacement proposed for one conflicting lineage.
 *
 * @example
 * ```ts
 * import { ContradictionResolutionProposal } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionResolutionProposal.fields.proposalDigest !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionResolutionProposal extends S.Class<ContradictionResolutionProposal>(
  $I`ContradictionResolutionProposal`
)(
  ContradictionResolutionProposalSchema,
  $I.annote("ContradictionResolutionProposal", {
    description: "Human-reviewable replacement proposed for one conflicting logical lineage.",
  })
) {}

const contradictionProposalIdEquivalence = S.toEquivalence(ContradictionProposalId);
const contradictionProposalArbitrary = S.toArbitraryLazy(ContradictionResolutionProposal);
const proposalsShareId = (self: ContradictionResolutionProposal, that: ContradictionResolutionProposal): boolean =>
  contradictionProposalIdEquivalence(self.proposalId, that.proposalId);
const hasUniqueProposalIds = (proposals: ReadonlyArray<ContradictionResolutionProposal>): boolean =>
  Eq.equals(A.length(A.dedupeWith(proposals, proposalsShareId)), A.length(proposals));

/**
 * Maximum proposals retained for one contradiction candidate.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_PROPOSAL_MAX_COUNT } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_MAX_COUNT) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_MAX_COUNT = 32;

const UniqueNonEmptyContradictionProposals = S.NonEmptyArray(ContradictionResolutionProposal)
  .check(
    S.isMaxLength(CONTRADICTION_PROPOSAL_MAX_COUNT, {
      identifier: $I`UniqueNonEmptyContradictionProposalsMaximumLengthCheck`,
      title: "Contradiction Proposal Maximum Count",
      description: "Checks that one candidate retains at most 32 human-reviewable proposals.",
      message: "Expected at most 32 contradiction proposals.",
    })
  )
  .check(
    S.makeFilter(hasUniqueProposalIds, {
      identifier: $I`UniqueNonEmptyContradictionProposalsCheck`,
      title: "Unique Non-Empty Contradiction Proposals",
      description: "Checks that an assessment has at least one proposal and never repeats a proposal id.",
      message: "Expected every proposalId in the non-empty proposal collection to be unique.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(contradictionProposalArbitrary(fc), fc.array(contradictionProposalArbitrary(fc), { maxLength: 7 }))
        .map(([head, tail]) => A.dedupeWith([head, ...tail], proposalsShareId)),
  })
  .pipe(
    $I.annoteSchema("UniqueNonEmptyContradictionProposals", {
      description: "A non-empty contradiction proposal collection containing no repeated proposal identifier.",
    })
  );

/**
 * Detector confidence and explicit human-reviewable resolution proposals.
 *
 * @example
 * ```ts
 * import { ContradictionAssessment } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionAssessment.fields.proposals !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionAssessment extends S.Class<ContradictionAssessment>($I`ContradictionAssessment`)(
  {
    confidence: Confidence.annotateKey({
      description: "Detector confidence that the two exact belief versions contradict.",
    }),
    proposals: UniqueNonEmptyContradictionProposals.annotateKey({
      description: "One or more explicit supersession proposals presented for human review.",
    }),
  },
  $I.annote("ContradictionAssessment", {
    description: "Detector confidence paired with explicit human-reviewable supersession proposals.",
  })
) {}

const ContradictionDispositionStatusBase = LiteralKit(["rejected", "superseded"]);

/**
 * Slice-local disposition vocabulary for contradiction review.
 *
 * Absence of a disposition means unresolved; a recorded disposition either
 * rejects the candidate or records the atomic supersession it caused.
 *
 * @example
 * ```ts
 * import { ContradictionDispositionStatus } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionDispositionStatus.Enum.superseded)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContradictionDispositionStatus = ContradictionDispositionStatusBase.pipe(
  $I.annoteSchema("ContradictionDispositionStatus", {
    description: "Recorded outcomes of human contradiction review; unresolved is represented by absence.",
  }),
  SchemaUtils.withLiteralKitStatics(ContradictionDispositionStatusBase)
);

/**
 * Runtime type for {@link ContradictionDispositionStatus}.
 *
 * @example
 * ```ts
 * import type { ContradictionDispositionStatus } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const status: ContradictionDispositionStatus = "rejected"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionStatus = typeof ContradictionDispositionStatus.Type;

/**
 * Maximum normalized length accepted for a contradiction review reason.
 *
 * @example
 * ```ts
 * import { CONTRADICTION_REVIEW_REASON_MAX_LENGTH } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(CONTRADICTION_REVIEW_REASON_MAX_LENGTH) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_REVIEW_REASON_MAX_LENGTH = 2_000;

/**
 * Normalized human rationale attached to a contradiction review decision.
 *
 * Review text is trimmed before validation, must remain non-empty, and is
 * capped at 2,000 characters so immutable authority records stay bounded while
 * still allowing a multi-paragraph explanation.
 *
 * @example
 * ```ts
 * import { ContradictionReviewReason } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const reason = Result.getOrThrow(
 *   S.decodeUnknownResult(ContradictionReviewReason)("  The passages address different issues.  ")
 * )
 * console.log(reason) // "The passages address different issues."
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ContradictionReviewReason = TrimmedNonEmptyText.check(
  S.isMaxLength(CONTRADICTION_REVIEW_REASON_MAX_LENGTH, {
    identifier: $I`ContradictionReviewReasonMaximumLengthCheck`,
    title: "Contradiction Review Reason Maximum Length",
    description: "Checks that a normalized contradiction review reason contains at most 2,000 characters.",
    message: "Expected contradiction review reason to contain at most 2,000 characters",
  })
).pipe(
  $I.annoteSchema("ContradictionReviewReason", {
    description: "Trimmed non-empty human review rationale containing at most 2,000 characters.",
  })
);

/**
 * Runtime type for {@link ContradictionReviewReason}.
 *
 * @example
 * ```ts
 * import type { ContradictionReviewReason } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const reason: ContradictionReviewReason = "The evidence concerns a different period."
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionReviewReason = typeof ContradictionReviewReason.Type;

const ContradictionDispositionDecisionBase = ContradictionDispositionStatusBase.toTaggedUnion("status")({
  rejected: {
    reason: ContradictionReviewReason.annotateKey({
      description: "Normalized bounded reason the candidate was rejected.",
    }),
  },
  superseded: {
    formerEdgeVersionId: EpistemicIdentity.EdgeVersionId.annotateKey({
      description: "Open edge version replaced by the approved correction.",
    }),
    proposalDigest: ContradictionProposalDigest.annotateKey({
      description: "Persisted proposal digest verified immediately before supersession.",
    }),
    proposalId: ContradictionProposalId.annotateKey({
      description: "Persisted proposal selected by the reviewer.",
    }),
    reason: ContradictionReviewReason.annotateKey({
      description: "Normalized bounded reason the supersession was approved.",
    }),
    replacementEdgeVersionId: EpistemicIdentity.EdgeVersionId.annotateKey({
      description: "Edge version atomically inserted as the replacement.",
    }),
  },
});

/**
 * Typed durable outcome of a contradiction review.
 *
 * @example
 * ```ts
 * import { ContradictionDispositionDecision } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const decision = ContradictionDispositionDecision.cases.rejected.make({
 *   reason: "The detector compared different legal issues."
 * })
 * console.log(decision.status)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ContradictionDispositionDecision = ContradictionDispositionDecisionBase.pipe(
  $I.annoteSchema("ContradictionDispositionDecision", {
    description: "Typed durable outcome of rejecting a candidate or atomically superseding one belief.",
  })
);

/**
 * Runtime type for {@link ContradictionDispositionDecision}.
 *
 * @example
 * ```ts
 * import type { ContradictionDispositionDecision } from "@beep/epistemic-domain/values/Contradiction"
 *
 * const decision: ContradictionDispositionDecision = {
 *   reason: "Not a contradiction.",
 *   status: "rejected"
 * }
 * console.log(decision.status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContradictionDispositionDecision = typeof ContradictionDispositionDecision.Type;

const sortEvidenceIds = A.sort(evidenceIdOrder);

const encodeEvidenceIds = flow(
  sortEvidenceIds,
  A.map((id: EpistemicIdentity.EvidenceId) => `${id}`),
  A.join(",")
);

const sha256Hex = (value: string): string => bytesToHex(sha256(utf8ToBytes(value)));

const evidenceDigestForSides = (
  leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>,
  rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
): ContradictionEvidenceDigest =>
  ContradictionEvidenceDigest.make(
    sha256Hex(
      A.join(["v3", `left:${encodeEvidenceIds(leftEvidenceIds)}`, `right:${encodeEvidenceIds(rightEvidenceIds)}`], "|")
    )
  );

const bindEvidenceSides = (
  matchBasis: ContradictionMatchBasis,
  leftEvidenceIds: ContradictionMatchBasis["leftEvidenceIds"],
  rightEvidenceIds: ContradictionMatchBasis["rightEvidenceIds"]
): ContradictionMatchBasis =>
  pipe(
    {
      leftEvidenceIds: sortEvidenceIds(leftEvidenceIds),
      rightEvidenceIds: sortEvidenceIds(rightEvidenceIds),
    },
    ({ leftEvidenceIds: canonicalLeftEvidenceIds, rightEvidenceIds: canonicalRightEvidenceIds }) =>
      ContradictionMatchBasis.make({
        ...matchBasis,
        evidenceDigest: evidenceDigestForSides(canonicalLeftEvidenceIds, canonicalRightEvidenceIds),
        leftEvidenceIds: canonicalLeftEvidenceIds,
        rightEvidenceIds: canonicalRightEvidenceIds,
      })
  );

class CanonicalizedContradiction extends S.Class<CanonicalizedContradiction>($I`CanonicalizedContradiction`)(
  {
    matchBasis: ContradictionMatchBasis,
    pair: CanonicalContradictionBeliefPair,
  },
  $I.annote("CanonicalizedContradiction", {
    description: "Canonical belief pair with evidence that remains bound to its corresponding side.",
  })
) {}

type CanonicalizeContradiction = {
  (matchBasis: ContradictionMatchBasis): (pair: ContradictionBeliefPair) => CanonicalizedContradiction;
  (pair: ContradictionBeliefPair, matchBasis: ContradictionMatchBasis): CanonicalizedContradiction;
};

/**
 * Put a belief pair and its side-bound evidence into canonical order.
 *
 * Reversing both input beliefs yields byte-identical output and swaps the
 * evidence arrays with them, so symmetric candidate identity never detaches
 * evidence from the belief it grounds.
 *
 * @example
 * ```ts
 * import { canonicalizeContradiction } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(typeof canonicalizeContradiction)
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const canonicalizeContradiction: CanonicalizeContradiction = dual(
  2,
  (pair: ContradictionBeliefPair, matchBasis: ContradictionMatchBasis): CanonicalizedContradiction =>
    pipe(
      beliefRefComesBefore(pair.left, pair.right),
      Bool.match({
        onFalse: () =>
          CanonicalizedContradiction.make({
            matchBasis: bindEvidenceSides(matchBasis, matchBasis.rightEvidenceIds, matchBasis.leftEvidenceIds),
            pair: CanonicalContradictionBeliefPair.make({ left: pair.right, right: pair.left }),
          }),
        onTrue: () =>
          CanonicalizedContradiction.make({
            matchBasis: bindEvidenceSides(matchBasis, matchBasis.leftEvidenceIds, matchBasis.rightEvidenceIds),
            pair: CanonicalContradictionBeliefPair.make({ left: pair.left, right: pair.right }),
          }),
      })
    )
);

type ContradictionEvidenceDigestFn = {
  (
    rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
  ): (leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>) => ContradictionEvidenceDigest;
  (
    leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>,
    rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
  ): ContradictionEvidenceDigest;
};

/**
 * Digest the exact side-specific evidence-id sets of one match basis.
 *
 * Each partition remains bound to its named side. Canonicalize the belief pair
 * and match basis together when presentation-order-independent identity is
 * required.
 *
 * @example
 * ```ts
 * import {
 *   ContradictionEvidenceDigest,
 *   contradictionEvidenceDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * const digest = contradictionEvidenceDigest(
 *   [Epistemic.EvidenceId.make(1)],
 *   [Epistemic.EvidenceId.make(2)]
 * )
 * console.log(ContradictionEvidenceDigest.is(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionEvidenceDigest: ContradictionEvidenceDigestFn = dual(
  2,
  (
    leftEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>,
    rightEvidenceIds: ReadonlyArray<EpistemicIdentity.EvidenceId>
  ): ContradictionEvidenceDigest => evidenceDigestForSides(leftEvidenceIds, rightEvidenceIds)
);

type ContradictionCandidateKeyFn = {
  (matchBasis: ContradictionMatchBasis): (pair: ContradictionBeliefPair) => ContradictionCandidateKey;
  (pair: ContradictionBeliefPair, matchBasis: ContradictionMatchBasis): ContradictionCandidateKey;
};

/**
 * Compute the duplicate-suppression key for a canonical contradiction basis.
 *
 * @example
 * ```ts
 * import { contradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(typeof contradictionCandidateKey)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateKey: ContradictionCandidateKeyFn = dual(
  2,
  (pair: ContradictionBeliefPair, matchBasis: ContradictionMatchBasis): ContradictionCandidateKey => {
    const normalized = canonicalizeContradiction(pair, matchBasis);
    const canonical = A.join(
      [
        "v1",
        encodeBeliefRef(normalized.pair.left),
        encodeBeliefRef(normalized.pair.right),
        normalized.matchBasis.kind,
        normalized.matchBasis.evidenceDigest,
        normalized.matchBasis.detector,
        normalized.matchBasis.detectorVersion,
      ],
      "|"
    );
    return ContradictionCandidateKey.make(sha256Hex(canonical));
  }
);

/**
 * Digest-bearing proposal content before its digest is attached.
 *
 * @example
 * ```ts
 * import { ContradictionProposalContent } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionProposalContent.fields.losingBelief !== undefined) // true
 * console.log(ContradictionProposalContent.fields.rationale !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionProposalContent extends S.Class<ContradictionProposalContent>(
  $I`ContradictionProposalContent`
)(
  {
    fact: ContradictionProposalFact.annotateKey({
      description: "Immutable JSON-safe replacement fact covered by the proposal digest.",
    }),
    losingBelief: BeliefVersionRef.annotateKey({
      description: "Exact persisted belief version whose logical lineage the proposal would replace.",
    }),
    proposalId: ContradictionProposalId.annotateKey({
      description: "Stable proposal identifier covered by the proposal digest.",
    }),
    rationale: ContradictionProposalRationale.annotateKey({
      description: "Detector-supplied rationale covered by the proposal digest.",
    }),
    validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound covered by the proposal digest.",
    }),
    validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound covered by the proposal digest, when known.",
    }),
  },
  $I.annote("ContradictionProposalContent", {
    description: "Complete authority-changing proposal content covered by its digest.",
  })
) {}

const encodeProposalContent = S.encodeResult(ContradictionProposalContent.mapFields(identity));

/**
 * Compute the digest a public proposal selection must echo.
 *
 * @example
 * ```ts
 * import {
 *   BeliefVersionRef,
 *   ContradictionProposalId,
 *   contradictionProposalDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity"
 * import { PosInt } from "@beep/schema/Int"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import * as Str from "effect/String"
 *
 * const digest = contradictionProposalDigest({
 *   fact: { amount: "125" },
 *   losingBelief: BeliefVersionRef.make({
 *     edgeVersionId: Epistemic.EdgeVersionId.make(1),
 *     logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
 *     version: PosInt.make(1),
 *   }),
 *   proposalId: ContradictionProposalId.make(Str.repeat(64)("b")),
 *   rationale: "The signed amendment controls.",
 *   validFrom: DateTime.makeUnsafe(0),
 *   validTo: O.none(),
 * })
 *
 * console.log(Result.isSuccess(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionProposalDigest = (
  content: ContradictionProposalContent
): Result.Result<ContradictionProposalDigest, S.SchemaError> =>
  Result.map(encodeProposalContent(content), (encoded) =>
    ContradictionProposalDigest.make(sha256Hex(`v1\n${canonicalJson(encoded)}`))
  );

/**
 * Structural candidate content before its validity interval is checked.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateContent } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionCandidateContent.fields.validFrom !== undefined) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
class ContradictionCandidateContentStruct extends S.Class<ContradictionCandidateContentStruct>(
  $I`ContradictionCandidateContentStruct`
)(
  {
    assessment: ContradictionAssessment.annotateKey({
      description: "Detector confidence and resolution proposals covered by the candidate digest.",
    }),
    matchBasis: ContradictionMatchBasis.annotateKey({
      description: "Evidence and detector revision covered by the candidate digest.",
    }),
    pair: CanonicalContradictionBeliefPair.annotateKey({
      description: "Canonical conflicting belief pair covered by the candidate digest.",
    }),
    validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound covered by the candidate digest.",
    }),
    validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound covered by the candidate digest, when known.",
    }),
  },
  $I.annote("ContradictionCandidateContentStruct", {
    description: "Structural candidate payload before its half-open valid interval is checked.",
  })
) {}

const contradictionCandidateContentStructArbitrary = S.toArbitraryLazy(ContradictionCandidateContentStruct);
const ContradictionCandidateContentSchema = ContradictionCandidateContentStruct.mapFields(identity)
  .check(
    S.makeFilter(
      ({ validFrom, validTo }) =>
        O.match(validTo, {
          onNone: () => true,
          onSome: (upperBound) => validIntervalIsOrdered(validFrom, upperBound),
        }),
      {
        identifier: $I`ContradictionCandidateContentValidIntervalCheck`,
        title: "Contradiction Candidate Valid Interval",
        description: "Checks that a closed candidate validity interval is a non-empty forward half-open range.",
        message: "Expected validFrom to be earlier than validTo when validTo is present.",
      }
    )
  )
  .annotate({
    toArbitrary: () => (fc) =>
      contradictionCandidateContentStructArbitrary(fc).map((candidate) =>
        ContradictionCandidateContentStruct.make({
          ...candidate,
          validTo: O.filter(candidate.validTo, (upperBound) => validIntervalIsOrdered(candidate.validFrom, upperBound)),
        })
      ),
  });

/**
 * Immutable candidate payload with a validated half-open validity interval.
 *
 * @example
 * ```ts
 * import { ContradictionCandidateContent } from "@beep/epistemic-domain/values/Contradiction"
 *
 * console.log(ContradictionCandidateContent.fields.validFrom !== undefined)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class ContradictionCandidateContent extends S.Class<ContradictionCandidateContent>(
  $I`ContradictionCandidateContent`
)(
  ContradictionCandidateContentSchema,
  $I.annote("ContradictionCandidateContent", {
    description: "Complete immutable candidate payload covered by its collision-guard digest.",
  })
) {}

const encodeCandidateContent = S.encodeResult(ContradictionCandidateContent.mapFields(identity));

/**
 * Compute the immutable candidate payload digest used to reject key collisions.
 *
 * @example
 * ```ts
 * import {
 *   BeliefVersionRef,
 *   ContradictionAssessment,
 *   CanonicalContradictionBeliefPair,
 *   ContradictionMatchBasis,
 *   ContradictionProposalDigest,
 *   ContradictionProposalId,
 *   ContradictionResolutionProposal,
 *   contradictionCandidateDigest,
 *   contradictionEvidenceDigest,
 * } from "@beep/epistemic-domain/values/Contradiction"
 * import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { LogicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity"
 * import { PosInt } from "@beep/schema/Int"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import * as Str from "effect/String"
 *
 * const leftEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(1)]
 * const rightEvidenceIds: readonly [Epistemic.EvidenceId] = [Epistemic.EvidenceId.make(2)]
 * const validFrom = DateTime.makeUnsafe(0)
 * const left = BeliefVersionRef.make({
 *   edgeVersionId: Epistemic.EdgeVersionId.make(1),
 *   logicalKey: LogicalEdgeKey.make(Str.repeat(64)("a")),
 *   version: PosInt.make(1),
 * })
 * const right = BeliefVersionRef.make({
 *   edgeVersionId: Epistemic.EdgeVersionId.make(2),
 *   logicalKey: LogicalEdgeKey.make(Str.repeat(64)("b")),
 *   version: PosInt.make(1),
 * })
 * const proposal = ContradictionResolutionProposal.make({
 *   fact: { amount: "125" },
 *   losingBelief: left,
 *   proposalDigest: ContradictionProposalDigest.make(Str.repeat(64)("c")),
 *   proposalId: ContradictionProposalId.make(Str.repeat(64)("d")),
 *   rationale: "The signed amendment controls.",
 *   validFrom,
 *   validTo: O.none(),
 * })
 * const digest = contradictionCandidateDigest({
 *   assessment: ContradictionAssessment.make({
 *     confidence: Confidence.make(0.95),
 *     proposals: [proposal],
 *   }),
 *   matchBasis: ContradictionMatchBasis.make({
 *     detector: "example-detector",
 *     detectorVersion: "0.0.0",
 *     evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
 *     kind: "independent-evidence",
 *     leftEvidenceIds,
 *     rightEvidenceIds,
 *   }),
 *   pair: CanonicalContradictionBeliefPair.make({ left, right }),
 *   validFrom,
 *   validTo: O.none(),
 * })
 *
 * console.log(Result.isSuccess(digest)) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const contradictionCandidateDigest = (
  content: ContradictionCandidateContent
): Result.Result<ContradictionCandidateDigest, S.SchemaError> =>
  Result.map(encodeCandidateContent(content), (encoded) =>
    ContradictionCandidateDigest.make(sha256Hex(`v1\n${canonicalJson(encoded)}`))
  );
