/**
 * Model-free direct-conflict detection over a caller-populated view snapshot.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  BeliefVersionRef,
  CanonicalContradictionBeliefPair,
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionCandidateContent,
  ContradictionMatchBasis,
  ContradictionProposalContent,
  ContradictionResolutionProposal,
  canonicalizeContradiction,
  contradictionCandidateDigest,
  contradictionCandidateKey,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import {
  ContradictionDetectionSnapshot,
  canonicalDetectionJson,
  DetectedContradiction,
  detectionProposalId,
  ExactNegationConfidence,
  ValueConflictConfidence,
} from "@beep/epistemic-domain/values/ContradictionDetection";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { ContradictionDetectionError } from "./ContradictionDetection.errors.ts";
import { ContradictionDetectionService } from "./ContradictionDetection.service.ts";
import type { ConflictClass, DetectionBelief } from "@beep/epistemic-domain/values/ContradictionDetection";

const classify = (
  left: DetectionBelief,
  right: DetectionBelief,
  singleValued: HashSet.HashSet<string>
): O.Option<ConflictClass> => {
  const equalValue = Equal.equals(canonicalDetectionJson(left.value), canonicalDetectionJson(right.value));
  if (equalValue && !Equal.equals(left.polarity, right.polarity)) return O.some("exact-negation");
  if (
    !equalValue &&
    left.polarity === "asserted" &&
    right.polarity === "asserted" &&
    HashSet.has(singleValued, left.predicate)
  )
    return O.some("value-conflict");
  return O.none();
};
const comparable = (left: DetectionBelief, right: DetectionBelief) =>
  O.getOrElse(O.zipWith(left.modality, right.modality, Equal.equals), () => true);
const proposalOrder = Order.mapInput(Order.String, (proposal: ContradictionResolutionProposal) => proposal.proposalId);
const candidateOrder = Order.mapInput(Order.String, (candidate: DetectedContradiction) => candidate.candidateKey);
const evidenceOrder = Order.mapInput(Order.Number, (id: DetectionBelief["evidenceIds"][number]) => id);
const detectorVersion = SemanticVersion.make("1.0.0");
const rationale = (kind: ConflictClass) =>
  kind === "exact-negation"
    ? "Equal assertions with opposite polarity require human review; this proposal adopts the other assertion."
    : "Unequal asserted values for a declared single-valued predicate require human review; this proposal adopts the other assertion.";

const makeProposal = Effect.fnUntraced(function* (
  losing: DetectionBelief,
  other: DetectionBelief,
  kind: ConflictClass,
  validFrom: DateTime.Utc,
  validTo: O.Option<DateTime.Utc>
) {
  const fact = { subject: other.subject, predicate: other.predicate, value: other.value, polarity: other.polarity };
  const proposalId = yield* Effect.fromResult(detectionProposalId(losing.ref, fact));
  const encodedRef = yield* S.encodeEffect(BeliefVersionRef)(losing.ref);
  const wire = {
    fact,
    losingBelief: encodedRef,
    proposalId,
    rationale: rationale(kind),
    validFrom: DateTime.toEpochMillis(validFrom),
    validTo: O.getOrNull(O.map(validTo, DateTime.toEpochMillis)),
  };
  const content = yield* S.decodeEffect(ContradictionProposalContent)(wire);
  const proposalDigest = yield* Effect.fromResult(contradictionProposalDigest(content));
  return yield* S.decodeEffect(ContradictionResolutionProposal)({ ...wire, proposalDigest });
});
const detectPair = Effect.fnUntraced(function* (
  left: DetectionBelief,
  right: DetectionBelief,
  singleValued: HashSet.HashSet<string>
) {
  if (!comparable(left, right)) return O.none<DetectedContradiction>();
  const kind = classify(left, right, singleValued);
  if (O.isNone(kind)) return O.none<DetectedContradiction>();
  const validFrom = DateTime.max(left.validFrom, right.validFrom);
  const validTo = O.orElse(
    O.zipWith(left.validTo, right.validTo, (a, b) => DateTime.min(a, b)),
    () => O.orElse(left.validTo, () => right.validTo)
  );
  if (O.exists(validTo, (upper) => !Order.isLessThan(DateTime.Order)(validFrom, upper)))
    return O.none<DetectedContradiction>();
  const leftEvidenceIds = A.sort(left.evidenceIds, evidenceOrder);
  const rightEvidenceIds = A.sort(right.evidenceIds, evidenceOrder);
  const overlap = A.some(leftEvidenceIds, (id) => A.contains(rightEvidenceIds, id));
  const matchBasis = yield* S.decodeEffect(ContradictionMatchBasis)({
    detector: `epistemic-contradiction-detection-${kind.value}`,
    detectorVersion,
    evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
    kind: overlap ? "same-source-overlap" : "independent-evidence",
    leftEvidenceIds,
    rightEvidenceIds,
  });
  const pair = yield* S.decodeEffect(ContradictionBeliefPair)({
    left: yield* S.encodeEffect(BeliefVersionRef)(left.ref),
    right: yield* S.encodeEffect(BeliefVersionRef)(right.ref),
  });
  const canonical = canonicalizeContradiction(pair, matchBasis);
  const proposals = A.sort(
    [
      yield* makeProposal(left, right, kind.value, validFrom, validTo),
      yield* makeProposal(right, left, kind.value, validFrom, validTo),
    ],
    proposalOrder
  );
  const assessment = yield* S.decodeEffect(ContradictionAssessment)({
    confidence: kind.value === "exact-negation" ? ExactNegationConfidence : ValueConflictConfidence,
    proposals: yield* S.encodeEffect(S.Array(ContradictionResolutionProposal))(proposals),
  });
  const content = yield* S.decodeEffect(ContradictionCandidateContent)({
    pair: yield* S.encodeEffect(CanonicalContradictionBeliefPair)(canonical.pair),
    matchBasis: yield* S.encodeEffect(ContradictionMatchBasis)(canonical.matchBasis),
    assessment: yield* S.encodeEffect(ContradictionAssessment)(assessment),
    validFrom: DateTime.toEpochMillis(validFrom),
    validTo: O.getOrNull(O.map(validTo, DateTime.toEpochMillis)),
  });
  const candidateKey = contradictionCandidateKey(content.pair, content.matchBasis);
  const candidateDigest = yield* Effect.fromResult(contradictionCandidateDigest(content));
  return O.some(
    yield* S.decodeEffect(DetectedContradiction)({
      ...(yield* S.encodeEffect(ContradictionCandidateContent)(content)),
      candidateKey,
      candidateDigest,
    })
  );
});
const detect = Effect.fn("ContradictionDetection.detect")(
  function* (input: ContradictionDetectionSnapshot) {
    const encoded = yield* S.encodeEffect(ContradictionDetectionSnapshot)(input);
    const snapshot = yield* S.decodeEffect(ContradictionDetectionSnapshot)(encoded);
    const singleValued = HashSet.fromIterable(snapshot.singleValuedPredicates);
    const groups = A.reduce(
      snapshot.beliefs,
      HashMap.empty<string, ReadonlyArray<DetectionBelief>>(),
      (groups, belief) => {
        const key = canonicalDetectionJson([belief.subject, belief.predicate]);
        return HashMap.set(
          groups,
          key,
          A.append(O.getOrElse(HashMap.get(groups, key), A.empty<DetectionBelief>), belief)
        );
      }
    );
    const pairs = pipe(
      groups,
      HashMap.values,
      A.fromIterable,
      A.flatMap((beliefs) =>
        A.flatMap(beliefs, (left, index) => A.map(A.drop(beliefs, index + 1), (right) => Tuple.make(left, right)))
      )
    );
    const emissions = yield* Effect.forEach(pairs, ([left, right]) => detectPair(left, right, singleValued), {
      concurrency: 1,
    });
    const unique = A.reduce(A.getSomes(emissions), HashMap.empty<string, DetectedContradiction>(), (items, candidate) =>
      HashMap.set(items, candidate.candidateKey, candidate)
    );
    return pipe(unique, HashMap.values, A.fromIterable, A.sort(candidateOrder));
  },
  Effect.mapError((cause) => ContradictionDetectionError.make({ cause }))
);

/**
 * Supplies deterministic detection with no clock, network or model requirements.
 *
 * **Example** (Detect an empty snapshot)
 *
 * ```ts import.meta.vitest name="Detect an empty snapshot"
 * import { ContradictionDetectionSnapshot } from "@beep/epistemic-domain/values/ContradictionDetection"
 * import { ContradictionDetectionService, ContradictionDetectionLive } from "@beep/epistemic-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const empty = ContradictionDetectionSnapshot.make({ beliefs: [], singleValuedPredicates: [] })
 * const result = ContradictionDetectionService.use((service) => service.detect(empty)).pipe(Effect.provide(ContradictionDetectionLive))
 * console.log(Effect.runSync(result).length)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionDetectionLive = Layer.succeed(ContradictionDetectionService, { detect });
