import { ContradictionCandidate, hasValidSeals } from "@beep/epistemic-domain/entities/Contradiction";
import {
  ContradictionAssessment,
  ContradictionCandidateContent,
  contradictionCandidateDigest,
  contradictionCandidateKey,
} from "@beep/epistemic-domain/values/Contradiction";
import {
  ContradictionDetectionSnapshot,
  canonicalDetectionJson,
  DetectedContradiction,
} from "@beep/epistemic-domain/values/ContradictionDetection";
import {
  ContradictionDetectionLive,
  ContradictionDetectionService,
  SubmitContradictionCandidate,
} from "@beep/epistemic-use-cases/server";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import golden from "./fixtures/contradiction-detection/expected.json" with { type: "json" };
import vectors from "./fixtures/contradiction-detection/snapshots.json" with { type: "json" };

const detect = (snapshot: ContradictionDetectionSnapshot) =>
  ContradictionDetectionService.use((service) => service.detect(snapshot));
const encodedOutput = Effect.fnUntraced(function* (candidates: ReadonlyArray<DetectedContradiction>) {
  return canonicalDetectionJson(yield* S.encodeEffect(S.Array(DetectedContradiction))(candidates));
});
const conformance = Effect.fnUntraced(function* (record: DetectedContradiction, index: number) {
  const wire = yield* S.encodeEffect(DetectedContradiction)(record);
  const decodedEntity = S.decodeUnknownResult(ContradictionCandidate)({
    ...productEntityFixtureInput("EpistemicContradictionCandidate", index + 1),
    ...wire,
    recordedAt: 0,
  });
  const candidate = Result.getOrThrow(decodedEntity);
  assertSuccess(decodedEntity, candidate);
  assertSuccess(hasValidSeals(candidate), true);
  const content = yield* S.decodeEffect(ContradictionCandidateContent)(wire);
  expect(record.candidateKey).toBe(contradictionCandidateKey(content.pair, content.matchBasis));
  assertSuccess(contradictionCandidateDigest(content), record.candidateDigest);
  const submitted = S.decodeResult(SubmitContradictionCandidate)({
    ...wire,
    orgId: 1,
    receiptKey: Str.repeat(64)("a"),
    recordedAt: 0,
    receivedBy: systemPrincipal,
    source: "System",
    schemaVersion: "1.0.0",
  });
  assertSuccess(submitted, Result.getOrThrow(submitted));
  expect(A.length(record.assessment.proposals)).toBe(2);
  const [first, second] = record.assessment.proposals;
  expect(first?.proposalId).not.toBe(second?.proposalId);
  for (const proposal of record.assessment.proposals) {
    expect(proposal.fact).toHaveProperty("subject");
    expect(proposal.fact).toHaveProperty("predicate");
    expect(proposal.fact).toHaveProperty("value");
    expect(proposal.fact).toHaveProperty("polarity");
    const other =
      proposal.losingBelief.edgeVersionId === record.pair.left.edgeVersionId ? record.pair.right : record.pair.left;
    expect(proposal.losingBelief.edgeVersionId).not.toBe(other.edgeVersionId);
  }
});

it.layer(ContradictionDetectionLive)("Contradiction detection golden vectors", (it) => {
  it.effect(
    "encodes both proposals through the shipped non-empty assessment field",
    Effect.fnUntraced(function* () {
      const snapshot = yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)(A.getUnsafe(vectors, 0).snapshot);
      const record = A.getUnsafe(yield* detect(snapshot), 0);
      const wire: typeof ContradictionAssessment.Encoded = {
        confidence: record.assessment.confidence,
        proposals: yield* S.encodeEffect(ContradictionAssessment.fields.proposals)(record.assessment.proposals),
      };
      const assessment = yield* S.decodeEffect(ContradictionAssessment)(wire);
      expect(A.length(assessment.proposals)).toBe(2);
      expect(A.map(assessment.proposals, (proposal) => proposal.proposalId)).toEqual(
        A.map(record.assessment.proposals, (proposal) => proposal.proposalId)
      );
      S.decodeUnknownResult(ContradictionAssessment)({ ...wire, proposals: [] }).pipe(Result.isFailure, assertTrue);
    })
  );
  for (const [vector, index] of A.map(vectors, (vector, index) => Tuple.make(vector, index))) {
    it.effect(
      vector.name,
      Effect.fnUntraced(function* () {
        const snapshot = yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)(vector.snapshot);
        const records = yield* detect(snapshot);
        expect(A.length(records)).toBe(vector.expectedCount);
        for (const record of records) {
          expect(record.matchBasis.detector).toBe(`epistemic-contradiction-detection-${vector.expectedClass}`);
          expect(record.assessment.confidence).toBe(vector.expectedClass === "exact-negation" ? 1 : 0.9);
        }
        expect(yield* encodedOutput(records)).toBe(A.getUnsafe(golden, index).canonicalOutput);
        yield* Effect.forEach(records, conformance, { concurrency: 1 });
        for (const record of records) {
          for (const proposal of record.assessment.proposals) {
            const other = A.findFirst(
              snapshot.beliefs,
              (belief) => belief.ref.edgeVersionId !== proposal.losingBelief.edgeVersionId
            );
            const assertion = O.getOrThrow(other);
            expect(proposal.fact).toEqual({
              subject: assertion.subject,
              predicate: assertion.predicate,
              value: assertion.value,
              polarity: assertion.polarity,
            });
          }
        }

        yield* TestClock.adjust("1 hour");
        expect(yield* encodedOutput(yield* detect(snapshot))).toBe(yield* encodedOutput(records));
        const permuted = ContradictionDetectionSnapshot.make({
          beliefs: A.reverse(snapshot.beliefs),
          singleValuedPredicates: A.reverse(snapshot.singleValuedPredicates),
        });
        expect(yield* encodedOutput(yield* detect(permuted))).toBe(yield* encodedOutput(records));
      })
    );
  }
  it.effect.prop(
    "schema-derived values preserve negation and permutation invariants",
    [S.String.check(S.isMaxLength(32))],
    Effect.fnUntraced(function* ([value]) {
      const input = A.getUnsafe(vectors, 0).snapshot;
      const snapshot = yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)({
        ...input,
        beliefs: A.map(input.beliefs, (belief) => ({ ...belief, value })),
      });
      const records = yield* detect(snapshot);
      yield* Effect.forEach(records, conformance, { concurrency: 1 });
      const permuted = ContradictionDetectionSnapshot.make({ ...snapshot, beliefs: A.reverse(snapshot.beliefs) });
      expect(A.length(records)).toBe(1);
      expect(yield* encodedOutput(yield* detect(permuted))).toBe(yield* encodedOutput(records));
    }),
    { arbitrary: { seed: 520 } }
  );
  it.effect(
    "groups and sorts multiple candidates independently of input order",
    Effect.fnUntraced(function* () {
      const original = yield* S.encodeEffect(ContradictionDetectionSnapshot)(
        yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)(A.getUnsafe(vectors, 0).snapshot)
      );
      const third = {
        ...A.getUnsafe(original.beliefs, 1),
        ref: { edgeVersionId: 3, logicalKey: Str.repeat(64)("3"), version: 1 },
        evidenceIds: [3],
      };
      const snapshot = yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)({
        ...original,
        beliefs: [...original.beliefs, third],
      });
      const records = yield* detect(snapshot);
      expect(A.length(records)).toBe(2);
      yield* Effect.forEach(records, conformance, { concurrency: 1 });
      expect(A.map(records, (record) => record.candidateKey)).toEqual(
        A.sort(
          A.map(records, (record) => record.candidateKey),
          Order.String
        )
      );
      expect(
        yield* encodedOutput(
          yield* detect(ContradictionDetectionSnapshot.make({ ...snapshot, beliefs: A.reverse(snapshot.beliefs) }))
        )
      ).toBe(yield* encodedOutput(records));
    })
  );
  it.effect(
    "empty input emits nothing",
    Effect.fnUntraced(function* () {
      expect(yield* detect(ContradictionDetectionSnapshot.make({ beliefs: [], singleValuedPredicates: [] }))).toEqual(
        []
      );
    })
  );
  it.effect(
    "returns a typed error for an invalid constructed snapshot",
    Effect.fnUntraced(function* () {
      const valid = yield* S.decodeUnknownEffect(ContradictionDetectionSnapshot)(A.getUnsafe(vectors, 0).snapshot);
      const belief = A.getUnsafe(valid.beliefs, 0);
      const invalid = ContradictionDetectionSnapshot.make(
        { beliefs: [belief, belief], singleValuedPredicates: [] },
        { disableChecks: true }
      );
      const exit = yield* Effect.exit(detect(invalid));
      exit.pipe(Exit.isFailure, assertTrue);
      expect(exit.pipe(Exit.findErrorOption, O.getOrThrow)._tag).toBe("ContradictionDetectionError");
    })
  );
  it("rejects oversized assertion facts before proposing", () => {
    const input = A.getUnsafe(vectors, 0).snapshot;
    const beliefs = A.map(input.beliefs, (belief) => ({ ...belief, value: Str.repeat(65536)("x") }));
    const decoded = S.decodeUnknownResult(ContradictionDetectionSnapshot)({ ...input, beliefs });
    decoded.pipe(Result.isFailure, assertTrue);
  });
});
