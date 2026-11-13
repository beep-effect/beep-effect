/**
 * Contradiction-candidate schema factories.
 *
 * **Details**
 *
 * A binding builds the vocabulary once, then each stage over the classes the
 * previous stages produced: belief references, belief pairs, proposals,
 * assessments, candidate content, behavior and arbitraries. Each stage returns
 * plain annotated schemas; the binding declares its own `S.Opaque` classes over
 * them, so every class keeps a nominal type and the caller's identities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicsId } from "@beep/identity/packages";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { P, R } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as DateTime from "effect/DateTime";
import * as Eq from "effect/Equal";
import { constFalse, dual, flow, identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import { Confidence } from "../EvidenceSpan/index.ts";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import type { FieldSchema, IdentityConfig, KeyedFieldSchema, SchemaIdentity } from "../Factory/index.ts";

const TrimmedText = S.String.pipe(S.decodeTo(S.NonEmptyString, SchemaTransformation.trim()));

/**
 * Maximum evidence identifiers retained on either side of one contradiction.
 *
 * **Example** (Print max evidence count)
 *
 * ```ts
 * import { CONTRADICTION_EVIDENCE_SET_MAX_COUNT } from "@beep/epistemics/Contradiction"
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
 * **Example** (Print detector max length)
 *
 * ```ts
 * import { CONTRADICTION_DETECTOR_MAX_LENGTH } from "@beep/epistemics/Contradiction"
 *
 * console.log(CONTRADICTION_DETECTOR_MAX_LENGTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_DETECTOR_MAX_LENGTH = 256;

/**
 * Maximum length accepted for a detector-supplied proposal rationale.
 *
 * **Example** (Print rationale max length)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH } from "@beep/epistemics/Contradiction"
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
 * **Example** (Print fact max bytes)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_FACT_MAX_BYTES } from "@beep/epistemics/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_FACT_MAX_BYTES) // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_FACT_MAX_BYTES = 64 * 1_024;

/**
 * Maximum proposals retained for one contradiction candidate.
 *
 * **Example** (Print proposal max count)
 *
 * ```ts
 * import { CONTRADICTION_PROPOSAL_MAX_COUNT } from "@beep/epistemics/Contradiction"
 *
 * console.log(CONTRADICTION_PROPOSAL_MAX_COUNT) // 32
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_PROPOSAL_MAX_COUNT = 32;

/**
 * Maximum normalized length accepted for a contradiction review reason.
 *
 * **Example** (Print reason max length)
 *
 * ```ts
 * import { CONTRADICTION_REVIEW_REASON_MAX_LENGTH } from "@beep/epistemics/Contradiction"
 *
 * console.log(CONTRADICTION_REVIEW_REASON_MAX_LENGTH) // 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_REVIEW_REASON_MAX_LENGTH = 2_000;

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

const isBoundedProposalFact = (fact: S.JsonObject): boolean => {
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

  // A fact the canonical digest owner refuses, such as one holding an unpaired
  // surrogate, has no canonical UTF-8 to measure, so it is out of bounds: the
  // check stays total and the schema fails typed instead of throwing.
  return pipe(
    JsoncFingerprint.canonicalizeResult(fact),
    Result.map((canonical) => utf8ToBytes(canonical).byteLength <= CONTRADICTION_PROPOSAL_FACT_MAX_BYTES),
    Result.getOrElse(constFalse)
  );
};

const validIntervalIsOrdered = Order.isLessThan(DateTime.Order);

type ValidIntervalCheckAnnotations = {
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
};

type ValidInterval = {
  readonly validFrom: DateTime.Utc;
  readonly validTo: O.Option<DateTime.Utc>;
};

/**
 * Build the shared half-open valid-interval filter for contradiction payloads.
 *
 * **Details**
 *
 * Every contradiction-shaped payload (resolution proposal, candidate content,
 * triage submission command) carries the same `validFrom`/`validTo` interval
 * invariant; this factory is the single source for that check.
 *
 * **Example** (Build an interval check)
 *
 * ```ts
 * import { makeValidIntervalCheck } from "@beep/epistemics/Contradiction"
 *
 * const check = makeValidIntervalCheck({
 *   identifier: "ExampleValidIntervalCheck",
 *   title: "Example Valid Interval",
 *   description: "Checks the example interval ordering.",
 * })
 * console.log(typeof check) // "object"
 * ```
 *
 * @param annotations - Identifier, title, and description for the filter.
 * @returns The half-open valid-interval filter.
 * @category utilities
 * @since 0.0.0
 */
export const makeValidIntervalCheck = (annotations: ValidIntervalCheckAnnotations) =>
  S.makeFilter(
    ({ validFrom, validTo }: ValidInterval) =>
      O.match(validTo, {
        onNone: () => true,
        onSome: (upperBound) => validIntervalIsOrdered(validFrom, upperBound),
      }),
    {
      ...annotations,
      message: "Expected validFrom to be earlier than validTo when validTo is present.",
    }
  );

const $I = $EpistemicsId.create("Contradiction/Contradiction.model");

const BeliefVersionRefShapeSchema = S.Struct({
  edgeVersionId: S.Union([S.String, S.Finite]),
  logicalKey: S.String,
  version: S.Finite,
}).pipe(
  $I.annoteSchema("BeliefVersionRefShape", {
    description: "Fields of any bound belief version reference read by contradiction checks and seals.",
  })
);

/**
 * Fields of any bound belief version reference read by contradiction checks
 * and seals.
 *
 * **Example** (Type a belief reference)
 *
 * ```ts
 * import type { BeliefVersionRefShape } from "@beep/epistemics/Contradiction"
 *
 * const ref: BeliefVersionRefShape = { edgeVersionId: 1, logicalKey: "a".repeat(64), version: 1 }
 * console.log(ref.version)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BeliefVersionRefShape = typeof BeliefVersionRefShapeSchema.Type;

const encodeBeliefRef = (ref: BeliefVersionRefShape): string =>
  A.join([ref.logicalKey, `${ref.edgeVersionId}`, `${ref.version}`], ":");

const beliefRefOrder = Order.mapInput(Order.String, encodeBeliefRef);
const beliefRefComesBefore = Order.isLessThan(beliefRefOrder);

const sha256Hex = (value: string): string => bytesToHex(sha256(utf8ToBytes(value)));

/**
 * Build the id-free contradiction vocabulary: digests, keys, the match-basis
 * kind, bounded text and fact schemas, and the disposition status.
 *
 * **Details**
 *
 * None of these schemas depends on a caller id, but each carries the caller's
 * `$I`, so the binding builds them once and passes them to the later stages.
 *
 * **Example** (Bind the contradiction vocabulary)
 *
 * ```ts
 * import { makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 *
 * const vocabulary = makeContradictionVocabulary({ $I: $ScratchpadId.create("party/Contradiction") })
 * console.log(vocabulary.ContradictionMatchBasisKind.Enum["independent-evidence"])
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionVocabulary = (config: IdentityConfig) => {
  const { $I } = config;

  const ContradictionCandidateKey = Sha256Hex.pipe(
    S.brand("ContradictionCandidateKey"),
    $I.annoteSchema("ContradictionCandidateKey", {
      description: "SHA-256 digest identifying one canonical contradiction candidate and match basis.",
    })
  );

  const ContradictionReceiptKey = Sha256Hex.pipe(
    S.brand("ContradictionReceiptKey"),
    $I.annoteSchema("ContradictionReceiptKey", {
      description: "Caller-owned SHA-256 idempotency key for one contradiction-submission receipt.",
    })
  );

  const ContradictionCandidateDigest = Sha256Hex.pipe(
    S.brand("ContradictionCandidateDigest"),
    $I.annoteSchema("ContradictionCandidateDigest", {
      description: "SHA-256 digest guarding the complete immutable payload stored for a contradiction candidate.",
    })
  );

  const ContradictionEvidenceDigest = Sha256Hex.pipe(
    S.brand("ContradictionEvidenceDigest"),
    $I.annoteSchema("ContradictionEvidenceDigest", {
      description: "Order-independent SHA-256 digest of the exact evidence ids in one contradiction basis.",
    })
  );

  const ContradictionProposalId = Sha256Hex.pipe(
    S.brand("ContradictionProposalId"),
    $I.annoteSchema("ContradictionProposalId", {
      description: "Stable SHA-256 identifier for one persisted contradiction resolution proposal.",
    })
  );

  const ContradictionProposalDigest = Sha256Hex.pipe(
    S.brand("ContradictionProposalDigest"),
    $I.annoteSchema("ContradictionProposalDigest", {
      description: "SHA-256 digest binding a proposal id to its losing belief, replacement, validity, and rationale.",
    })
  );

  const ContradictionMatchBasisKindBase = LiteralKit(["same-source-overlap", "independent-evidence"]);

  const ContradictionMatchBasisKind = ContradictionMatchBasisKindBase.pipe(
    $I.annoteSchema("ContradictionMatchBasisKind", {
      description: "Whether a contradiction is grounded in overlapping source text or independent evidence.",
    }),
    SchemaUtils.withLiteralKitStatics(ContradictionMatchBasisKindBase)
  );

  const ContradictionDetectorIdentity = TrimmedText.check(
    S.isMaxLength(
      CONTRADICTION_DETECTOR_MAX_LENGTH,
      $I.annote("ContradictionDetectorIdentityMaximumLengthCheck", {
        arbitraryConstraint: { patterns: [{ source: "^[a-zA-Z0-9_-]{1,256}$", flags: "" }] },
        title: "Contradiction Detector Identity Maximum Length",
        description: "Checks that a contradiction detector identity contains at most 256 UTF-16 code units.",
        message: "Expected contradiction detector identity to contain at most 256 UTF-16 code units.",
      })
    )
  ).pipe(
    $I.annoteSchema("ContradictionDetectorIdentity", {
      description: "Trimmed non-empty stable detector identity containing at most 256 UTF-16 code units.",
    })
  );

  const ContradictionProposalFact = S.JsonObject.check(
    S.makeFilter(
      isBoundedProposalFact,
      $I.annote("ContradictionProposalFactBoundsCheck", {
        title: "Bounded Contradiction Proposal Fact",
        description:
          "Checks replacement facts before digesting: at most 64 KiB canonical UTF-8, 4,096 JSON nodes, and 32 levels.",
        message: "Expected a bounded contradiction proposal fact.",
      })
    )
  ).pipe(
    $I.annoteSchema("ContradictionProposalFact", {
      description: "JSON-safe replacement fact bounded before canonicalization, hashing, persistence, and display.",
    })
  );

  const ContradictionProposalRationale = TrimmedText.check(
    S.isMaxLength(
      CONTRADICTION_PROPOSAL_RATIONALE_MAX_LENGTH,
      $I.annote("ContradictionProposalRationaleMaximumLengthCheck", {
        arbitraryConstraint: { patterns: [{ source: "^[a-zA-Z0-9_-]{1,2000}$", flags: "" }] },
        title: "Contradiction Proposal Rationale Maximum Length",
        description: "Checks that a detector-supplied proposal rationale contains at most 2,000 characters.",
        message: "Expected contradiction proposal rationale to contain at most 2,000 characters.",
      })
    )
  ).pipe(
    $I.annoteSchema("ContradictionProposalRationale", {
      description: "Trimmed non-empty detector-supplied proposal rationale containing at most 2,000 characters.",
    })
  );

  const ContradictionDispositionStatusBase = LiteralKit(["rejected", "superseded"]);

  const ContradictionDispositionStatus = ContradictionDispositionStatusBase.pipe(
    $I.annoteSchema("ContradictionDispositionStatus", {
      description: "Recorded outcomes of human contradiction review; unresolved is represented by absence.",
    }),
    SchemaUtils.withLiteralKitStatics(ContradictionDispositionStatusBase)
  );

  const ContradictionReviewReason = TrimmedText.check(
    S.isMaxLength(
      CONTRADICTION_REVIEW_REASON_MAX_LENGTH,
      $I.annote("ContradictionReviewReasonMaximumLengthCheck", {
        title: "Contradiction Review Reason Maximum Length",
        description: "Checks that a normalized contradiction review reason contains at most 2,000 characters.",
        message: "Expected contradiction review reason to contain at most 2,000 characters",
      })
    )
  ).pipe(
    $I.annoteSchema("ContradictionReviewReason", {
      description: "Trimmed non-empty human review rationale containing at most 2,000 characters.",
    })
  );

  return {
    ContradictionCandidateKey,
    ContradictionReceiptKey,
    ContradictionCandidateDigest,
    ContradictionEvidenceDigest,
    ContradictionProposalId,
    ContradictionProposalDigest,
    ContradictionMatchBasisKind,
    ContradictionMatchBasisKindBase,
    ContradictionDetectorIdentity,
    ContradictionProposalFact,
    ContradictionProposalRationale,
    ContradictionDispositionStatus,
    ContradictionDispositionStatusBase,
    ContradictionReviewReason,
  };
};

/**
 * The id-free schemas returned by {@link makeContradictionVocabulary}.
 *
 * **Example** (Type a vocabulary parameter)
 *
 * ```ts
 * import type { ContradictionVocabulary } from "@beep/epistemics/Contradiction"
 *
 * const kindsOf = (vocabulary: ContradictionVocabulary) => vocabulary.ContradictionMatchBasisKind.literals
 * console.log(typeof kindsOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContradictionVocabulary = ReturnType<typeof makeContradictionVocabulary>;

/**
 * Build the belief version reference schema over caller-supplied edge-version
 * id, positive-integer and logical edge key schemas.
 *
 * **Details**
 *
 * Returns `BeliefVersionRefSchema`, the annotated struct a binding wraps in its
 * own `S.Opaque` class: the immutable edge-version row, its logical lineage and
 * the optimistic version a detector observed.
 *
 * **Example** (Bind a belief reference to local schemas)
 *
 * ```ts
 * import { makeBeliefVersionRef } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { BeliefVersionRefSchema } = makeBeliefVersionRef({
 *   $I: $ScratchpadId.create("party/Contradiction"),
 *   ids: { edgeVersion: S.String.pipe(S.brand("EdgeVersionId")) },
 *   positiveInt: S.Int.check(S.isGreaterThan(0)),
 *   LogicalEdgeKey: S.String.pipe(S.brand("LogicalEdgeKey"))
 * })
 * console.log(Object.keys(BeliefVersionRefSchema.fields)) // ["edgeVersionId", "logicalKey", "version"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeBeliefVersionRef = <
  EdgeVersionId extends string | number,
  EdgeVersionIdEncoded,
  EdgeVersionIdMake,
  LogicalKey extends string,
  LogicalKeyEncoded,
  LogicalKeyMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly ids: { readonly edgeVersion: KeyedFieldSchema<EdgeVersionId, EdgeVersionIdEncoded, EdgeVersionIdMake> };
  readonly positiveInt: KeyedFieldSchema<number, number>;
  readonly LogicalEdgeKey: KeyedFieldSchema<LogicalKey, LogicalKeyEncoded, LogicalKeyMake>;
}) => {
  const { $I, ids, positiveInt, LogicalEdgeKey } = config;

  const BeliefVersionRefSchema = S.Struct({
    edgeVersionId: ids.edgeVersion.annotateKey({
      description: "Immutable edge-version row observed by the detector.",
    }),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Logical lineage containing the observed edge version.",
    }),
    version: positiveInt.annotateKey({
      description: "Optimistic logical version observed by the detector.",
    }),
  }).pipe(
    $I.annoteSchema("BeliefVersionRef", {
      description: "Exact immutable edge version observed as one side of a contradiction candidate.",
    })
  );

  return { BeliefVersionRefSchema };
};

/**
 * Build the contradiction match basis over a caller-supplied evidence id schema.
 *
 * **Details**
 *
 * Returns `ContradictionMatchBasisStructSchema` (the unchecked struct, used by
 * arbitraries) and `ContradictionMatchBasisSchema`, the checked struct a binding
 * wraps in its own `S.Opaque` class. Each side carries a non-empty, duplicate-free
 * evidence set of at most 32 ids; an independent-evidence basis also requires
 * the two sides to be disjoint.
 *
 * **Example** (Bind a match basis to string evidence ids)
 *
 * ```ts
 * import { makeContradictionMatchBasis, makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/Contradiction")
 * const { ContradictionMatchBasisSchema } = makeContradictionMatchBasis({
 *   $I,
 *   vocabulary: makeContradictionVocabulary({ $I }),
 *   ids: { evidence: S.String.pipe(S.brand("EvidenceId")) }
 * })
 * console.log(Object.keys(ContradictionMatchBasisSchema.fields).length) // 6
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionMatchBasis = <
  EvidenceId extends string | number,
  EvidenceIdEncoded,
  EvidenceIdMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionVocabulary;
  readonly ids: { readonly evidence: KeyedFieldSchema<EvidenceId, EvidenceIdEncoded, EvidenceIdMake> };
}) => {
  const { $I, vocabulary, ids } = config;
  const { ContradictionDetectorIdentity, ContradictionEvidenceDigest, ContradictionMatchBasisKind } = vocabulary;

  const evidenceIdEquivalence = S.toEquivalence(ids.evidence);
  const hasUniqueEvidenceIds = (evidenceIds: ReadonlyArray<EvidenceId>): boolean =>
    Eq.equals(A.length(A.dedupeWith(evidenceIds, evidenceIdEquivalence)), A.length(evidenceIds));

  const UniqueNonEmptyEvidenceIds = S.NonEmptyArray(ids.evidence)
    .check(
      S.isMaxLength(
        CONTRADICTION_EVIDENCE_SET_MAX_COUNT,
        $I.annote("UniqueNonEmptyEvidenceIdsMaximumLengthCheck", {
          title: "Contradiction Evidence Set Maximum Count",
          description: "Checks that either side of one contradiction retains at most 32 evidence identifiers.",
          message: "Expected at most 32 EvidenceIds in either contradiction evidence set.",
        })
      )
    )
    .check(
      S.makeFilter(
        hasUniqueEvidenceIds,
        $I.annote("UniqueNonEmptyEvidenceIdsCheck", {
          title: "Unique Non-Empty Evidence IDs",
          description: "Checks that an evidence set contains at least one id and never repeats an id.",
          message: "Expected every EvidenceId in the non-empty evidence set to be unique.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("UniqueNonEmptyEvidenceIds", {
        description: "A non-empty side-specific contradiction evidence set containing no repeated EvidenceId.",
      })
    );

  const ContradictionMatchBasisStructSchema = S.Struct({
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
  }).pipe(
    $I.annoteSchema("ContradictionMatchBasisStruct", {
      description: "Internal structural base for a contradiction candidate match basis.",
    })
  );

  type MatchBasisFields = typeof ContradictionMatchBasisStructSchema.Type;

  const evidenceSetsAreDisjoint = ({ leftEvidenceIds, rightEvidenceIds }: MatchBasisFields): boolean =>
    A.every(leftEvidenceIds, (leftId) =>
      A.every(rightEvidenceIds, (rightId) => Bool.not(evidenceIdEquivalence(leftId, rightId)))
    );

  const IndependentEvidenceSetsCheck = S.makeFilter(
    (basis: MatchBasisFields) =>
      ContradictionMatchBasisKind.match(basis.kind, {
        "independent-evidence": () => evidenceSetsAreDisjoint(basis),
        "same-source-overlap": () => true,
      }),
    $I.annote("IndependentEvidenceSetsCheck", {
      title: "Independent Contradiction Evidence Sets",
      description: "Checks that independent-evidence candidates never reuse one EvidenceId on both sides.",
      message: "Expected left and right evidence sets to be disjoint for an independent-evidence match.",
    })
  );

  const ContradictionMatchBasisSchema = ContradictionMatchBasisStructSchema.mapFields(identity)
    .check(IndependentEvidenceSetsCheck)
    .pipe(
      $I.annoteSchema("ContradictionMatchBasis", {
        description: "Exact evidence pair and detector revision supporting a contradiction candidate.",
      })
    );

  return { ContradictionMatchBasisStructSchema, ContradictionMatchBasisSchema };
};

/**
 * Build the durable review outcome over a caller-supplied edge-version id
 * schema.
 *
 * **Details**
 *
 * Returns `ContradictionDispositionDecision`: a rejection with its reason, or a
 * supersession naming the selected proposal, its verified digest, and the
 * former and replacement edge versions.
 *
 * **Example** (Bind a disposition decision to string edge-version ids)
 *
 * ```ts
 * import {
 *   makeContradictionDispositionDecision,
 *   makeContradictionVocabulary
 * } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/Contradiction")
 * const { ContradictionDispositionDecision } = makeContradictionDispositionDecision({
 *   $I,
 *   vocabulary: makeContradictionVocabulary({ $I }),
 *   ids: { edgeVersion: S.String.pipe(S.brand("EdgeVersionId")) }
 * })
 * const decision = S.decodeUnknownSync(ContradictionDispositionDecision)({ status: "rejected", reason: "Duplicate." })
 * console.log(decision.status) // "rejected"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionDispositionDecision = <EdgeVersionId extends S.Top>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionVocabulary;
  readonly ids: { readonly edgeVersion: EdgeVersionId };
}) => {
  const { $I, vocabulary, ids } = config;
  const { ContradictionDispositionStatusBase, ContradictionProposalDigest, ContradictionProposalId } = vocabulary;
  const ContradictionReviewReason = vocabulary.ContradictionReviewReason;

  const ContradictionDispositionDecisionBase = ContradictionDispositionStatusBase.toTaggedUnion("status")({
    rejected: {
      reason: ContradictionReviewReason.annotateKey({
        description: "Normalized bounded reason the candidate was rejected.",
      }),
    },
    superseded: {
      formerEdgeVersionId: ids.edgeVersion.annotateKey({
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
      replacementEdgeVersionId: ids.edgeVersion.annotateKey({
        description: "Edge version atomically inserted as the replacement.",
      }),
    },
  });

  const ContradictionDispositionDecision = ContradictionDispositionDecisionBase.pipe(
    $I.annoteSchema("ContradictionDispositionDecision", {
      description: "Typed durable outcome of rejecting a candidate or atomically superseding one belief.",
    })
  );

  return { ContradictionDispositionDecision };
};

/**
 * Build the submission and canonical belief pairs over a caller-bound belief
 * version reference class.
 *
 * **Details**
 *
 * Returns `ContradictionBeliefPairStructSchema` (unchecked, for arbitraries),
 * `ContradictionBeliefPairSchema` (the two sides reference different edge
 * versions) and `CanonicalContradictionBeliefPairSchema` (additionally ordered
 * by the stable encoded belief references). A binding wraps the last two in its
 * own `S.Opaque` classes.
 *
 * **Example** (Bind belief pairs to a local belief reference)
 *
 * ```ts
 * import { makeBeliefVersionRef, makeContradictionBeliefPairs } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/Contradiction")
 * const { BeliefVersionRefSchema } = makeBeliefVersionRef({
 *   $I,
 *   ids: { edgeVersion: S.String.pipe(S.brand("EdgeVersionId")) },
 *   positiveInt: S.Int.check(S.isGreaterThan(0)),
 *   LogicalEdgeKey: S.String.pipe(S.brand("LogicalEdgeKey"))
 * })
 * class BeliefVersionRef extends S.Opaque<BeliefVersionRef, { readonly brand: unique symbol }>()(
 *   BeliefVersionRefSchema
 * ) {}
 * const { ContradictionBeliefPairSchema } = makeContradictionBeliefPairs({ $I, BeliefVersionRef })
 * console.log(Object.keys(ContradictionBeliefPairSchema.fields)) // ["left", "right"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionBeliefPairs = <
  Ref extends BeliefVersionRefShape,
  RefEncoded,
  RefMake,
  RefFields extends RefMake & BeliefVersionRefShape,
  RefFieldsEncoded,
  RefFieldsMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly BeliefVersionRef: FieldSchema<
    Ref,
    RefEncoded,
    RefMake,
    FieldSchema<RefFields, RefFieldsEncoded, RefFieldsMake>
  > & {
    readonly fields: { readonly edgeVersionId: S.Top };
  };
}) => {
  const { $I, BeliefVersionRef } = config;

  const edgeVersionIdEquivalent = S.toEquivalence(BeliefVersionRef.fields.edgeVersionId);
  const beliefsAreDistinct = ({ left, right }: { readonly left: RefFields; readonly right: RefFields }) =>
    !edgeVersionIdEquivalent(left.edgeVersionId, right.edgeVersionId);

  const ContradictionBeliefPairStructSchema = S.Struct({
    left: BeliefVersionRef.annotateKey({ description: "Belief presented on the left side of a submission." }),
    right: BeliefVersionRef.annotateKey({ description: "Belief presented on the right side of a submission." }),
  }).pipe(
    $I.annoteSchema("ContradictionBeliefPairStruct", {
      description: "Structural contradiction belief pair before distinctness is checked.",
    })
  );

  const DistinctBeliefPairCheck = S.makeFilter(
    beliefsAreDistinct,
    $I.annote("DistinctBeliefPairCheck", {
      title: "Distinct Contradiction Belief Pair",
      description: "Checks that the two sides reference different immutable edge-version rows.",
      message: "Expected left and right to reference different edge versions.",
    })
  );

  const ContradictionBeliefPairSchema = ContradictionBeliefPairStructSchema.mapFields(identity)
    .check(DistinctBeliefPairCheck)
    .pipe(
      $I.annoteSchema("ContradictionBeliefPair", {
        description: "Submission-order pair of exact conflicting belief versions.",
      })
    );

  const CanonicalBeliefPairCheck = S.makeFilter(
    ({ left, right }: { readonly left: RefFields; readonly right: RefFields }) =>
      beliefRefComesBefore(BeliefVersionRef.make(left), BeliefVersionRef.make(right)),
    $I.annote("CanonicalBeliefPairCheck", {
      title: "Canonical Contradiction Belief Pair",
      description: "Checks that a persisted contradiction pair is ordered by its stable encoded belief references.",
      message: "Expected the distinct left belief reference to sort before the right belief reference.",
    })
  );

  const CanonicalContradictionBeliefPairSchema = ContradictionBeliefPairSchema.mapFields(identity)
    .check(DistinctBeliefPairCheck)
    .check(CanonicalBeliefPairCheck)
    .pipe(
      $I.annoteSchema("CanonicalContradictionBeliefPair", {
        description: "Checked canonical ordering of the immutable belief-version pair persisted in a candidate.",
      })
    );

  return {
    ContradictionBeliefPairStructSchema,
    ContradictionBeliefPairSchema,
    CanonicalContradictionBeliefPairSchema,
    beliefsAreDistinct,
  };
};

/**
 * Build the resolution proposal and digest-covered proposal content over a
 * caller-bound belief version reference class.
 *
 * **Details**
 *
 * Returns `ContradictionResolutionProposalStructSchema` (unchecked, for
 * arbitraries), `ContradictionResolutionProposalSchema` (a forward half-open
 * validity interval) and `ContradictionProposalContentSchema`, plus
 * `encodeProposalContent`, the encoder the proposal digest seals. A binding
 * wraps the proposal and content schemas in its own `S.Opaque` classes.
 *
 * **Example** (Bind proposals to a local belief reference)
 *
 * ```ts
 * import {
 *   makeBeliefVersionRef,
 *   makeContradictionProposals,
 *   makeContradictionVocabulary
 * } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/Contradiction")
 * const { BeliefVersionRefSchema } = makeBeliefVersionRef({
 *   $I,
 *   ids: { edgeVersion: S.String.pipe(S.brand("EdgeVersionId")) },
 *   positiveInt: S.Int.check(S.isGreaterThan(0)),
 *   LogicalEdgeKey: S.String.pipe(S.brand("LogicalEdgeKey"))
 * })
 * class BeliefVersionRef extends S.Opaque<BeliefVersionRef, { readonly brand: unique symbol }>()(
 *   BeliefVersionRefSchema
 * ) {}
 * const { ContradictionResolutionProposalSchema } = makeContradictionProposals({
 *   $I,
 *   vocabulary: makeContradictionVocabulary({ $I }),
 *   BeliefVersionRef
 * })
 * console.log(Object.keys(ContradictionResolutionProposalSchema.fields).length) // 7
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionProposals = <
  Ref,
  RefEncoded,
  RefMake,
  RefFields,
  RefFieldsEncoded,
  RefFieldsMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionVocabulary;
  readonly BeliefVersionRef: FieldSchema<
    Ref,
    RefEncoded,
    RefMake,
    FieldSchema<RefFields, RefFieldsEncoded, RefFieldsMake>
  >;
}) => {
  const { $I, vocabulary, BeliefVersionRef } = config;
  const {
    ContradictionProposalDigest,
    ContradictionProposalFact,
    ContradictionProposalId,
    ContradictionProposalRationale,
  } = vocabulary;

  const ContradictionResolutionProposalStructSchema = S.Struct({
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
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound of the proposed replacement.",
    }),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound of the replacement, when known.",
    }),
  }).pipe(
    $I.annoteSchema("ContradictionResolutionProposalStruct", {
      description: "Structural contradiction proposal before its half-open valid interval is checked.",
    })
  );

  const ContradictionResolutionProposalSchema = ContradictionResolutionProposalStructSchema.mapFields(identity)
    .check(
      makeValidIntervalCheck(
        $I.annote("ContradictionResolutionProposalValidIntervalCheck", {
          title: "Contradiction Resolution Proposal Valid Interval",
          description: "Checks that a closed proposal validity interval is a non-empty forward half-open range.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ContradictionResolutionProposal", {
        description: "Human-reviewable replacement proposed for one conflicting logical lineage.",
      })
    );

  const ContradictionProposalContentSchema = S.Struct({
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
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound covered by the proposal digest.",
    }),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound covered by the proposal digest, when known.",
    }),
  }).pipe(
    $I.annoteSchema("ContradictionProposalContent", {
      description: "Complete authority-changing proposal content covered by its digest.",
    })
  );

  const encodeProposalContent = S.encodeResult(ContradictionProposalContentSchema.mapFields(identity));

  return {
    ContradictionResolutionProposalStructSchema,
    ContradictionResolutionProposalSchema,
    ContradictionProposalContentSchema,
    encodeProposalContent,
  };
};

/**
 * Build the detector assessment over a caller-bound resolution proposal class.
 *
 * **Details**
 *
 * Returns `ContradictionAssessmentSchema` (detector confidence and one to 32
 * proposals with distinct proposal ids) and `proposalsShareId`, the proposal
 * equivalence the arbitraries deduplicate with. A binding wraps the schema in
 * its own `S.Opaque` class.
 *
 * **Example** (Bind an assessment to a local proposal schema)
 *
 * ```ts
 * import {
 *   makeBeliefVersionRef,
 *   makeContradictionAssessment,
 *   makeContradictionProposals,
 *   makeContradictionVocabulary
 * } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const $I = $ScratchpadId.create("party/Contradiction")
 * const vocabulary = makeContradictionVocabulary({ $I })
 * const { BeliefVersionRefSchema } = makeBeliefVersionRef({
 *   $I,
 *   ids: { edgeVersion: S.String.pipe(S.brand("EdgeVersionId")) },
 *   positiveInt: S.Int.check(S.isGreaterThan(0)),
 *   LogicalEdgeKey: S.String.pipe(S.brand("LogicalEdgeKey"))
 * })
 * const { ContradictionResolutionProposalSchema } = makeContradictionProposals({
 *   $I,
 *   vocabulary,
 *   BeliefVersionRef: BeliefVersionRefSchema
 * })
 * const { ContradictionAssessmentSchema } = makeContradictionAssessment({
 *   $I,
 *   vocabulary,
 *   ContradictionResolutionProposal: ContradictionResolutionProposalSchema
 * })
 * console.log(Object.keys(ContradictionAssessmentSchema.fields)) // ["confidence", "proposals"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionAssessment = <
  Proposal extends { readonly proposalId: ContradictionVocabulary["ContradictionProposalId"]["Type"] },
  ProposalEncoded,
  ProposalMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly vocabulary: ContradictionVocabulary;
  readonly ContradictionResolutionProposal: FieldSchema<Proposal, ProposalEncoded, ProposalMake>;
}) => {
  const { $I, vocabulary, ContradictionResolutionProposal } = config;

  const contradictionProposalIdEquivalence = S.toEquivalence(vocabulary.ContradictionProposalId);
  const proposalsShareId = (self: Proposal, that: Proposal): boolean =>
    contradictionProposalIdEquivalence(self.proposalId, that.proposalId);
  const hasUniqueProposalIds = (proposals: ReadonlyArray<Proposal>): boolean =>
    Eq.equals(A.length(A.dedupeWith(proposals, proposalsShareId)), A.length(proposals));

  const UniqueNonEmptyContradictionProposals = S.NonEmptyArray(ContradictionResolutionProposal)
    .check(
      S.isMaxLength(
        CONTRADICTION_PROPOSAL_MAX_COUNT,
        $I.annote("UniqueNonEmptyContradictionProposalsMaximumLengthCheck", {
          title: "Contradiction Proposal Maximum Count",
          description: "Checks that one candidate retains at most 32 human-reviewable proposals.",
          message: "Expected at most 32 contradiction proposals.",
        })
      )
    )
    .check(
      S.makeFilter(
        hasUniqueProposalIds,
        $I.annote("UniqueNonEmptyContradictionProposalsCheck", {
          title: "Unique Non-Empty Contradiction Proposals",
          description: "Checks that an assessment has at least one proposal and never repeats a proposal id.",
          message: "Expected every proposalId in the non-empty proposal collection to be unique.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("UniqueNonEmptyContradictionProposals", {
        description: "A non-empty contradiction proposal collection containing no repeated proposal identifier.",
      })
    );

  const ContradictionAssessmentSchema = S.Struct({
    confidence: Confidence.annotateKey({
      description: "Detector confidence that the two exact belief versions contradict.",
    }),
    proposals: UniqueNonEmptyContradictionProposals.annotateKey({
      description: "One or more explicit supersession proposals presented for human review.",
    }),
  }).pipe(
    $I.annoteSchema("ContradictionAssessment", {
      description: "Detector confidence paired with explicit human-reviewable supersession proposals.",
    })
  );

  return { ContradictionAssessmentSchema, proposalsShareId };
};

/**
 * Build the canonicalized pair and the digest-covered candidate content over
 * caller-bound assessment, match-basis and canonical-pair classes.
 *
 * **Details**
 *
 * Returns `CanonicalizedContradictionSchema` (a canonical pair with evidence
 * bound to its side), `ContradictionCandidateContentStructSchema` (unchecked),
 * `ContradictionCandidateContentSchema` (a forward half-open validity
 * interval), `ContradictionCandidateIntervalSchema` (the interval fields alone,
 * for arbitraries) and `encodeCandidateContent`, the encoder the candidate
 * digest seals. A binding wraps the canonicalized and content schemas in its own
 * `S.Opaque` classes.
 *
 * **Example** (Inspect the candidate content fields)
 *
 * ```ts
 * import { makeContradictionCandidate } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const { ContradictionCandidateContentSchema } = makeContradictionCandidate({
 *   $I: $ScratchpadId.create("party/Contradiction"),
 *   ContradictionAssessment: S.Struct({ confidence: S.Finite }),
 *   ContradictionMatchBasis: S.Struct({ kind: S.String }),
 *   CanonicalContradictionBeliefPair: S.Struct({ left: S.String, right: S.String })
 * })
 * console.log(Object.keys(ContradictionCandidateContentSchema.fields).length) // 5
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionCandidate = <
  Assessment,
  AssessmentEncoded,
  AssessmentMake,
  AssessmentFields,
  AssessmentFieldsEncoded,
  AssessmentFieldsMake,
  MatchBasis,
  MatchBasisEncoded,
  MatchBasisMake,
  MatchBasisFields,
  MatchBasisFieldsEncoded,
  MatchBasisFieldsMake,
  Pair,
  PairEncoded,
  PairMake,
  PairFields,
  PairFieldsEncoded,
  PairFieldsMake,
>(config: {
  readonly $I: SchemaIdentity;
  readonly ContradictionAssessment: FieldSchema<
    Assessment,
    AssessmentEncoded,
    AssessmentMake,
    FieldSchema<AssessmentFields, AssessmentFieldsEncoded, AssessmentFieldsMake>
  >;
  readonly ContradictionMatchBasis: FieldSchema<
    MatchBasis,
    MatchBasisEncoded,
    MatchBasisMake,
    FieldSchema<MatchBasisFields, MatchBasisFieldsEncoded, MatchBasisFieldsMake>
  >;
  readonly CanonicalContradictionBeliefPair: FieldSchema<
    Pair,
    PairEncoded,
    PairMake,
    FieldSchema<PairFields, PairFieldsEncoded, PairFieldsMake>
  >;
}) => {
  const { $I, ContradictionAssessment, ContradictionMatchBasis, CanonicalContradictionBeliefPair } = config;

  const CanonicalizedContradictionSchema = S.Struct({
    matchBasis: ContradictionMatchBasis,
    pair: CanonicalContradictionBeliefPair,
  }).pipe(
    $I.annoteSchema("CanonicalizedContradiction", {
      description: "Canonical belief pair with evidence that remains bound to its corresponding side.",
    })
  );

  const ContradictionCandidateContentStructSchema = S.Struct({
    assessment: ContradictionAssessment.annotateKey({
      description: "Detector confidence and resolution proposals covered by the candidate digest.",
    }),
    matchBasis: ContradictionMatchBasis.annotateKey({
      description: "Evidence and detector revision covered by the candidate digest.",
    }),
    pair: CanonicalContradictionBeliefPair.annotateKey({
      description: "Canonical conflicting belief pair covered by the candidate digest.",
    }),
    validFrom: S.DateTimeUtcFromMillis.annotateKey({
      description: "Inclusive valid-time lower bound covered by the candidate digest.",
    }),
    validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
      description: "Exclusive valid-time upper bound covered by the candidate digest, when known.",
    }),
  }).pipe(
    $I.annoteSchema("ContradictionCandidateContentStruct", {
      description: "Structural candidate payload before its half-open valid interval is checked.",
    })
  );

  const ContradictionCandidateContentSchema = ContradictionCandidateContentStructSchema.mapFields(identity)
    .check(
      makeValidIntervalCheck(
        $I.annote("ContradictionCandidateContentValidIntervalCheck", {
          title: "Contradiction Candidate Valid Interval",
          description: "Checks that a closed candidate validity interval is a non-empty forward half-open range.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("ContradictionCandidateContent", {
        description: "Complete immutable candidate payload covered by its collision-guard digest.",
      })
    );

  const encodeCandidateContent = S.encodeResult(ContradictionCandidateContentSchema.mapFields(identity));

  const ContradictionCandidateIntervalSchema = ContradictionCandidateContentStructSchema.mapFields(
    ({ assessment, matchBasis, pair, ...fields }) => fields
  );

  return {
    CanonicalizedContradictionSchema,
    ContradictionCandidateContentStructSchema,
    ContradictionCandidateContentSchema,
    ContradictionCandidateIntervalSchema,
    encodeCandidateContent,
  };
};

/**
 * Fields of a match basis read by canonicalization and its evidence digest.
 *
 * **Example** (Type a match basis view)
 *
 * ```ts
 * import type { ContradictionMatchBasisShape } from "@beep/epistemics/Contradiction"
 *
 * const kindOf = (basis: ContradictionMatchBasisShape<number>) => basis.kind
 * console.log(typeof kindOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContradictionMatchBasisShape<EvidenceId> = {
  readonly detector: string;
  readonly detectorVersion: string;
  readonly evidenceDigest: string;
  readonly kind: string;
  readonly leftEvidenceIds: readonly [EvidenceId, ...Array<EvidenceId>];
  readonly rightEvidenceIds: readonly [EvidenceId, ...Array<EvidenceId>];
};

/**
 * Build canonicalization, the evidence digest, the candidate key and the
 * proposal and candidate seals over caller-bound classes.
 *
 * **Details**
 *
 * `canonicalizeContradiction` orders a submission pair by its encoded belief
 * references and keeps each evidence set bound to its side. Evidence ids are
 * sorted with the binding's `evidenceIdOrder` and rendered with template
 * interpolation before hashing, so the binding decides how ids order and a
 * binding's digests never change. The candidate key, proposal digest and
 * candidate digest are lowercase SHA-256 hex digests of versioned encodings.
 *
 * **Example** (Digest two evidence sets)
 *
 * ```ts
 * import { makeContradictionBehavior, makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as Order from "effect/Order"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const vocabulary = makeContradictionVocabulary({ $I: $ScratchpadId.create("party/Contradiction") })
 * const Ref = S.Struct({ edgeVersionId: S.String, logicalKey: S.String, version: S.Finite })
 * const Pair = S.Struct({ left: Ref, right: Ref })
 * const Basis = S.Struct({
 *   detector: S.String,
 *   detectorVersion: S.String,
 *   evidenceDigest: S.String,
 *   kind: S.String,
 *   leftEvidenceIds: S.NonEmptyArray(S.String),
 *   rightEvidenceIds: S.NonEmptyArray(S.String)
 * })
 * const { contradictionEvidenceDigest } = makeContradictionBehavior({
 *   vocabulary,
 *   evidenceIdOrder: Order.String,
 *   BeliefVersionRef: Ref,
 *   ContradictionMatchBasisStruct: Basis,
 *   ContradictionMatchBasis: Basis,
 *   CanonicalContradictionBeliefPair: Pair,
 *   CanonicalizedContradiction: S.Struct({ matchBasis: Basis, pair: Pair }),
 *   encodeProposalContent: (content: object) => Result.succeed(content),
 *   encodeCandidateContent: (content: object) => Result.succeed(content)
 * })
 * console.log(contradictionEvidenceDigest(["a"], ["b"]).length) // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionBehavior = <
  EvidenceId extends string | number,
  RefMake,
  Ref extends BeliefVersionRefShape,
  PairSide extends RefMake,
  CanonicalizedMatchBasis,
  CanonicalizedPair,
  Pair extends CanonicalizedPair,
  MatchBasisMake,
  MatchBasisFields extends ContradictionMatchBasisShape<EvidenceId> & MatchBasisMake,
  MatchBasis extends CanonicalizedMatchBasis,
  Canonicalized extends {
    readonly pair: { readonly left: RefMake; readonly right: RefMake };
    readonly matchBasis: {
      readonly kind: string;
      readonly evidenceDigest: string;
      readonly detector: string;
      readonly detectorVersion: string;
    };
  },
  ProposalContent,
  ProposalContentEncoded,
  CandidateContent,
  CandidateContentEncoded,
>(config: {
  readonly vocabulary: ContradictionVocabulary;
  readonly evidenceIdOrder: Order.Order<EvidenceId>;
  readonly BeliefVersionRef: { readonly make: (input: RefMake) => Ref };
  readonly ContradictionMatchBasisStruct: S.Top & { readonly Type: MatchBasisFields };
  readonly ContradictionMatchBasis: { readonly make: (input: MatchBasisMake) => MatchBasis };
  readonly CanonicalContradictionBeliefPair: {
    readonly make: (input: { readonly left: PairSide; readonly right: PairSide }) => Pair;
  };
  readonly CanonicalizedContradiction: {
    readonly make: (input: {
      readonly matchBasis: CanonicalizedMatchBasis;
      readonly pair: CanonicalizedPair;
    }) => Canonicalized;
  };
  readonly encodeProposalContent: (content: ProposalContent) => Result.Result<ProposalContentEncoded, S.SchemaError>;
  readonly encodeCandidateContent: (content: CandidateContent) => Result.Result<CandidateContentEncoded, S.SchemaError>;
}) => {
  const {
    vocabulary,
    evidenceIdOrder,
    BeliefVersionRef,
    ContradictionMatchBasis,
    CanonicalContradictionBeliefPair,
    CanonicalizedContradiction,
    encodeProposalContent,
    encodeCandidateContent,
  } = config;
  const {
    ContradictionCandidateDigest,
    ContradictionCandidateKey,
    ContradictionEvidenceDigest,
    ContradictionProposalDigest,
  } = vocabulary;

  type EvidenceDigest = typeof ContradictionEvidenceDigest.Type;
  type PairInput = { readonly left: PairSide; readonly right: PairSide };

  const sortEvidenceIds = A.sort(evidenceIdOrder);

  const encodeEvidenceIds = flow(
    sortEvidenceIds,
    A.map((id: EvidenceId) => `${id}`),
    A.join(",")
  );

  const evidenceDigestForSides = (
    leftEvidenceIds: ReadonlyArray<EvidenceId>,
    rightEvidenceIds: ReadonlyArray<EvidenceId>
  ): EvidenceDigest =>
    ContradictionEvidenceDigest.make(
      sha256Hex(
        A.join(
          ["v3", `left:${encodeEvidenceIds(leftEvidenceIds)}`, `right:${encodeEvidenceIds(rightEvidenceIds)}`],
          "|"
        )
      )
    );

  const bindEvidenceSides = (
    matchBasis: MatchBasisFields,
    leftEvidenceIds: MatchBasisFields["leftEvidenceIds"],
    rightEvidenceIds: MatchBasisFields["rightEvidenceIds"]
  ): MatchBasis =>
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

  const canonicalizeContradiction: {
    (matchBasis: MatchBasisFields): (pair: PairInput) => Canonicalized;
    (pair: PairInput, matchBasis: MatchBasisFields): Canonicalized;
  } = dual(
    2,
    (pair: PairInput, matchBasis: MatchBasisFields): Canonicalized =>
      pipe(
        beliefRefComesBefore(BeliefVersionRef.make(pair.left), BeliefVersionRef.make(pair.right)),
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

  const contradictionEvidenceDigest: {
    (rightEvidenceIds: ReadonlyArray<EvidenceId>): (leftEvidenceIds: ReadonlyArray<EvidenceId>) => EvidenceDigest;
    (leftEvidenceIds: ReadonlyArray<EvidenceId>, rightEvidenceIds: ReadonlyArray<EvidenceId>): EvidenceDigest;
  } = dual(
    2,
    (leftEvidenceIds: ReadonlyArray<EvidenceId>, rightEvidenceIds: ReadonlyArray<EvidenceId>): EvidenceDigest =>
      evidenceDigestForSides(leftEvidenceIds, rightEvidenceIds)
  );

  const contradictionCandidateKey: {
    (matchBasis: MatchBasisFields): (pair: PairInput) => typeof ContradictionCandidateKey.Type;
    (pair: PairInput, matchBasis: MatchBasisFields): typeof ContradictionCandidateKey.Type;
  } = dual(2, (pair: PairInput, matchBasis: MatchBasisFields): typeof ContradictionCandidateKey.Type => {
    const normalized = canonicalizeContradiction(pair, matchBasis);
    const canonical = A.join(
      [
        "v1",
        encodeBeliefRef(BeliefVersionRef.make(normalized.pair.left)),
        encodeBeliefRef(BeliefVersionRef.make(normalized.pair.right)),
        normalized.matchBasis.kind,
        normalized.matchBasis.evidenceDigest,
        normalized.matchBasis.detector,
        normalized.matchBasis.detectorVersion,
      ],
      "|"
    );
    return ContradictionCandidateKey.make(sha256Hex(canonical));
  });

  const contradictionProposalDigest = (
    content: ProposalContent
  ): Result.Result<typeof ContradictionProposalDigest.Type, S.SchemaError> =>
    Result.map(encodeProposalContent(content), (encoded) =>
      ContradictionProposalDigest.make(sha256Hex(`v1\n${canonicalJson(encoded)}`))
    );

  const contradictionCandidateDigest = (
    content: CandidateContent
  ): Result.Result<typeof ContradictionCandidateDigest.Type, S.SchemaError> =>
    Result.map(encodeCandidateContent(content), (encoded) =>
      ContradictionCandidateDigest.make(sha256Hex(`v1\n${canonicalJson(encoded)}`))
    );

  return {
    canonicalizeContradiction,
    contradictionEvidenceDigest,
    contradictionCandidateKey,
    contradictionProposalDigest,
    contradictionCandidateDigest,
  };
};

/**
 * Build the contradiction arbitraries over caller-bound classes and an evidence
 * id constructor.
 *
 * **Details**
 *
 * Every arbitrary produces values accepted by the bound class it names: belief
 * pairs reference distinct edge versions and canonical pairs are ordered,
 * independent-evidence bases draw disjoint evidence sets from `makeEvidenceId`
 * (odd seeds left, even seeds right), and proposal and candidate validity
 * intervals are forward half-open.
 *
 * **Example** (Inspect the arbitrary factory)
 *
 * ```ts
 * import { makeContradictionArbitraries } from "@beep/epistemics/Contradiction"
 *
 * console.log(typeof makeContradictionArbitraries) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeContradictionArbitraries = <
  EvidenceId,
  RefMake,
  RefFields extends RefMake,
  Ref extends BeliefVersionRefShape,
  BeliefPair extends { readonly left: RefFields; readonly right: RefFields },
  CandidateAssessment,
  CandidateMatchBasis,
  CandidatePair,
  CanonicalPair extends CandidatePair,
  MatchBasisFields extends { readonly kind: "same-source-overlap" | "independent-evidence" },
  MatchBasis extends CandidateMatchBasis,
  ProposalFields extends ValidInterval,
  Proposal,
  ConfidenceValue,
  Assessment extends CandidateAssessment,
  IntervalFields extends ValidInterval,
  CandidateContent,
>(config: {
  readonly makeEvidenceId: (value: number) => EvidenceId;
  readonly BeliefVersionRef: { readonly make: (input: RefMake) => Ref };
  readonly ContradictionBeliefPairStruct: S.Top & {
    readonly Type: { readonly left: RefFields; readonly right: RefFields };
  };
  readonly beliefsAreDistinct: (pair: { readonly left: RefFields; readonly right: RefFields }) => boolean;
  readonly ContradictionBeliefPair: {
    readonly make: (input: { readonly left: RefFields; readonly right: RefFields }) => BeliefPair;
  };
  readonly CanonicalContradictionBeliefPair: {
    readonly make: (input: { readonly left: RefFields; readonly right: RefFields }) => CanonicalPair;
  };
  readonly ContradictionMatchBasisStruct: S.Top & { readonly Type: MatchBasisFields };
  readonly ContradictionMatchBasis: { readonly make: (input: MatchBasisFields) => MatchBasis };
  readonly ContradictionResolutionProposalStruct: S.Top & { readonly Type: ProposalFields };
  readonly ContradictionResolutionProposal: { readonly make: (input: ProposalFields) => Proposal };
  readonly proposalsShareId: (self: Proposal, that: Proposal) => boolean;
  readonly ContradictionAssessment: {
    readonly fields: { readonly confidence: S.Top & { readonly Type: ConfidenceValue } };
    readonly make: (input: {
      readonly confidence: ConfidenceValue;
      readonly proposals: readonly [Proposal, ...Array<Proposal>];
    }) => Assessment;
  };
  readonly ContradictionCandidateInterval: S.Top & { readonly Type: IntervalFields };
  readonly ContradictionCandidateContent: {
    readonly make: (
      input: IntervalFields & {
        readonly assessment: CandidateAssessment;
        readonly matchBasis: CandidateMatchBasis;
        readonly pair: CandidatePair;
      }
    ) => CandidateContent;
  };
}) => {
  const {
    makeEvidenceId,
    BeliefVersionRef,
    ContradictionBeliefPairStruct,
    beliefsAreDistinct,
    ContradictionBeliefPair,
    CanonicalContradictionBeliefPair,
    ContradictionMatchBasisStruct,
    ContradictionMatchBasis,
    ContradictionResolutionProposalStruct,
    ContradictionResolutionProposal,
    proposalsShareId,
    ContradictionAssessment,
    ContradictionCandidateInterval,
    ContradictionCandidateContent,
  } = config;

  const ContradictionBeliefPairArbitrary = Arbitrary.schema(ContradictionBeliefPairStruct).pipe(
    Arbitrary.filter(beliefsAreDistinct),
    Arbitrary.map((pair) => ContradictionBeliefPair.make(pair))
  );

  const CanonicalContradictionBeliefPairArbitrary = ContradictionBeliefPairArbitrary.pipe(
    Arbitrary.map(({ left, right }) =>
      CanonicalContradictionBeliefPair.make(
        beliefRefComesBefore(BeliefVersionRef.make(left), BeliefVersionRef.make(right))
          ? { left, right }
          : { left: right, right: left }
      )
    )
  );

  const ContradictionMatchBasisArbitrary = Arbitrary.all({
    basis: Arbitrary.schema(ContradictionMatchBasisStruct),
    seeds: Arbitrary.schema(
      S.Struct({
        left: S.Array(S.Int.check(S.isBetween({ minimum: 2, maximum: 1_073_741_823 }))).check(S.isMaxLength(7)),
        right: S.Array(S.Int.check(S.isBetween({ minimum: 2, maximum: 1_073_741_823 }))).check(S.isMaxLength(7)),
      })
    ),
  }).pipe(
    Arbitrary.map(({ basis, seeds }): MatchBasis => {
      // The same per-kind dispatch `ContradictionMatchBasisKind.match` performs, written as its case
      // record so the result stays the bound class type rather than a deferred `Unify` of it.
      const byKind = {
        "same-source-overlap": () => ContradictionMatchBasis.make(basis),
        "independent-evidence": () =>
          ContradictionMatchBasis.make({
            ...basis,
            leftEvidenceIds: [
              makeEvidenceId(1),
              ...A.map(A.dedupe(seeds.left), (seed) => makeEvidenceId(seed * 2 - 1)),
            ],
            rightEvidenceIds: [makeEvidenceId(2), ...A.map(A.dedupe(seeds.right), (seed) => makeEvidenceId(seed * 2))],
          }),
      };
      return byKind[basis.kind]();
    })
  );

  const ContradictionResolutionProposalArbitrary = Arbitrary.schema(ContradictionResolutionProposalStruct).pipe(
    Arbitrary.map((proposal) =>
      ContradictionResolutionProposal.make({
        ...proposal,
        validTo: O.filter(proposal.validTo, (upperBound) => validIntervalIsOrdered(proposal.validFrom, upperBound)),
      })
    )
  );

  const ContradictionAssessmentArbitrary = Arbitrary.all({
    confidence: Arbitrary.schema(ContradictionAssessment.fields.confidence),
    proposals: Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 8 }))).pipe(
      Arbitrary.flatMap((count) => Arbitrary.all(A.replicate(ContradictionResolutionProposalArbitrary, count))),
      Arbitrary.filter(A.isArrayNonEmpty),
      Arbitrary.map((proposals) => A.dedupeWith(proposals, proposalsShareId))
    ),
  }).pipe(Arbitrary.map((assessment) => ContradictionAssessment.make(assessment)));

  const ContradictionCandidateContentArbitrary = Arbitrary.all({
    content: Arbitrary.schema(ContradictionCandidateInterval),
    assessment: ContradictionAssessmentArbitrary,
    matchBasis: ContradictionMatchBasisArbitrary,
    pair: CanonicalContradictionBeliefPairArbitrary,
  }).pipe(
    Arbitrary.map(({ content, ...fields }) =>
      ContradictionCandidateContent.make({
        ...content,
        ...fields,
        validTo: O.filter(content.validTo, (upperBound) => validIntervalIsOrdered(content.validFrom, upperBound)),
      })
    )
  );

  return {
    ContradictionBeliefPairArbitrary,
    CanonicalContradictionBeliefPairArbitrary,
    ContradictionMatchBasisArbitrary,
    ContradictionResolutionProposalArbitrary,
    ContradictionAssessmentArbitrary,
    ContradictionCandidateContentArbitrary,
  };
};
