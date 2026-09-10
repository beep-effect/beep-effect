import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofEnvProfile,
  ProofEpoch,
  ProofFact,
  ProofInputDigest,
  ProofInputSource,
  ProofLedgerFactRow,
  ProofLedgerRow,
  ProofLedgerShadowRow,
  ProofMissReason,
  ProofOutcome,
  ProofProvenance,
  ProofReuseDecision,
  ProofReuseHit,
  ProofReuseMiss,
  ProofStage,
} from "@beep/repo-cli/test/Yeet";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeProofLedgerFactRowJson = S.decodeEffect(S.fromJsonString(ProofLedgerFactRow));
const decodeProofLedgerShadowRowJson = S.decodeEffect(S.fromJsonString(ProofLedgerShadowRow));
const decodeUnknownProofLedgerRowResult = S.decodeUnknownResult(ProofLedgerRow);
const encodeProofLedgerRowResult = S.encodeResult(ProofLedgerRow);
const encodeUnknownProofLedgerFactRowJson = S.encodeUnknownEffect(S.fromJsonString(ProofLedgerFactRow));
const encodeUnknownProofLedgerShadowRowJson = S.encodeUnknownEffect(S.fromJsonString(ProofLedgerShadowRow));
const isProofLedgerFactRow = S.is(ProofLedgerFactRow);
const isProofLedgerShadowRow = S.is(ProofLedgerShadowRow);

const epoch = ProofEpoch.make({
  lockfileDigest: "lock-digest",
  bunVersion: "1.4.0",
  nodeVersion: "24",
  rootTurboConfigDigest: "turbo-digest",
  rootTsconfigDigest: "tsconfig-digest",
  policyPackVersion: "0.1.0",
  digest: "epoch-digest",
});

const input = ProofInputDigest.make({
  laneId: "coverage",
  laneClass: "cli-runnable",
  commandDigest: "command-digest",
  envProfile: "local",
  inputDigest: "input-digest",
  inputSource: "turbo-task-hash",
  epochDigest: epoch.digest,
  key: "proof-key",
});

const provenance = ProofProvenance.make({
  runId: "run-1",
  attemptId: "attempt-1",
  originKey: "origin-1",
  tier: "full",
  stage: "pre-push",
  headSha: "88fa371cb0",
  hostedRunId: null,
});

const fact = ProofFact.make({
  schemaVersion: PROOF_FACT_SCHEMA_VERSION,
  key: input,
  epoch,
  outcome: "passed",
  durationMs: 1_200,
  provenance,
  recordedAt: "2026-09-03T12:00:00.000Z",
  expiresAt: "2026-10-03T12:00:00.000Z",
});

const hit = ProofReuseHit.make({ key: input.key, factRecordedAt: fact.recordedAt });
const miss = ProofReuseMiss.make({ key: input.key, reason: "no-fact" });
const factRow = ProofLedgerFactRow.make({ schemaVersion: PROOF_FACT_SCHEMA_VERSION, fact });
const shadowRow = ProofLedgerShadowRow.make({
  schemaVersion: PROOF_FACT_SCHEMA_VERSION,
  attemptId: "attempt-2",
  decision: hit,
  observed: "failed",
  recordedAt: "2026-09-03T12:05:00.000Z",
});

const assertRoundTrip = Effect.fn("ProofFactTest.assertRoundTrip")(function* <Schema extends S.Constraint>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);

  expect(S.is(schema)(decoded)).toBe(true);
  expect(decoded).toStrictEqual(value);
});

const assertRejects = Effect.fn("ProofFactTest.assertRejects")(function* <Schema extends S.Constraint>(
  schema: Schema,
  value: unknown
) {
  const exit = yield* S.decodeUnknownEffect(schema)(value).pipe(Effect.exit);
  expect(Exit.isFailure(exit)).toBe(true);
});

describe("ProofFact schemas", () => {
  it("round-trips schema-derived arbitrary ledger rows", () => {
    const arbitrary = Arbitrary.schema(ProofLedgerRow);
    const equivalent = S.toEquivalence(ProofLedgerRow);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([value]) =>
            equivalent(
              Result.getOrThrow(
                decodeUnknownProofLedgerRowResult(Result.getOrThrow(encodeProofLedgerRowResult(value)))
              ),
              value
            ),
          fcRuns(20)
        )
      )._tag
    ).toBe("Passed");
  });

  it.effect("round-trips every schema and derives a working S.is guard", () =>
    Effect.gen(function* () {
      yield* assertRoundTrip(ProofEnvProfile, "local");
      yield* assertRoundTrip(ProofStage, "pre-push");
      yield* assertRoundTrip(ProofOutcome, "passed");
      yield* assertRoundTrip(ProofInputSource, "turbo-task-hash");
      yield* assertRoundTrip(ProofEpoch, epoch);
      yield* assertRoundTrip(ProofInputDigest, input);
      yield* assertRoundTrip(ProofProvenance, provenance);
      yield* assertRoundTrip(ProofFact, fact);
      yield* assertRoundTrip(ProofMissReason, "no-fact");
      yield* assertRoundTrip(ProofReuseHit, hit);
      yield* assertRoundTrip(ProofReuseMiss, miss);
      yield* assertRoundTrip(ProofReuseDecision, hit);
      yield* assertRoundTrip(ProofReuseDecision, miss);
      yield* assertRoundTrip(ProofLedgerFactRow, factRow);
      yield* assertRoundTrip(ProofLedgerShadowRow, shadowRow);
      yield* assertRoundTrip(ProofLedgerRow, factRow);
      yield* assertRoundTrip(ProofLedgerRow, shadowRow);
    })
  );

  it.effect("rejects every bad literal-domain fixture", () =>
    Effect.gen(function* () {
      yield* assertRejects(ProofEnvProfile, "preview");
      yield* assertRejects(ProofStage, "deployment");
      yield* assertRejects(ProofOutcome, "pending");
      yield* assertRejects(ProofInputSource, "git-tree");
      yield* assertRejects(ProofMissReason, "stale");
      yield* assertRejects(ProofReuseDecision, { kind: "maybe", key: "proof-key" });
      yield* assertRejects(ProofLedgerRow, { kind: "tombstone", schemaVersion: PROOF_FACT_SCHEMA_VERSION });
      yield* assertRejects(ProofLedgerFactRow, {
        kind: "fact",
        schemaVersion: "proof-fact/v2",
        fact,
      });
      yield* assertRejects(ProofFact, { ...fact, durationMs: -1 });
    })
  );

  it.effect("decodes fact and shadow rows from JSON text", () =>
    Effect.gen(function* () {
      const factJson = yield* encodeUnknownProofLedgerFactRowJson(factRow);
      const shadowJson = yield* encodeUnknownProofLedgerShadowRowJson(shadowRow);

      const decodedFact = yield* decodeProofLedgerFactRowJson(factJson);
      const decodedShadow = yield* decodeProofLedgerShadowRowJson(shadowJson);

      expect(isProofLedgerFactRow(decodedFact)).toBe(true);
      expect(isProofLedgerShadowRow(decodedShadow)).toBe(true);
      expect(decodedFact).toStrictEqual(factRow);
      expect(decodedShadow).toStrictEqual(shadowRow);
    })
  );
});
