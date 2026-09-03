import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofEpoch,
  ProofFact,
  ProofInputDigest,
  ProofLedger,
  ProofLedgerShadowRow,
  ProofProvenance,
  ProofReuseHit,
  ProofReuseMiss,
  proofLedgerPathForCheckout,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { constFalse } from "effect/Function";
import * as Str from "effect/String";
import type { ProofChangedPackageTripwire, ProofLedgerShape } from "@beep/repo-cli/test/Yeet";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const NOW = DateTime.makeUnsafe("2026-09-03T12:30:00.000Z");

const epoch = (digest = "epoch-1"): ProofEpoch =>
  ProofEpoch.make({
    lockfileDigest: "lock-digest",
    bunVersion: "1.4.0",
    nodeVersion: "24",
    rootTurboConfigDigest: "turbo-digest",
    rootTsconfigDigest: "tsconfig-digest",
    policyPackVersion: "0.1.0",
    digest,
  });

const input = (overrides: Partial<Parameters<typeof ProofInputDigest.make>[0]> = {}): ProofInputDigest =>
  ProofInputDigest.make({
    laneId: "coverage",
    laneClass: "cli-runnable",
    commandDigest: "command-digest",
    envProfile: "local",
    inputDigest: "input-digest",
    inputSource: "turbo-task-hash",
    epochDigest: "epoch-1",
    key: "proof-key",
    ...overrides,
  });

const fact = (overrides: Partial<Parameters<typeof ProofFact.make>[0]> = {}): ProofFact =>
  ProofFact.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    key: input(),
    epoch: epoch(),
    outcome: "passed",
    durationMs: 1_200,
    provenance: ProofProvenance.make({
      runId: "run-1",
      attemptId: "attempt-1",
      originKey: "origin-1",
      tier: "full",
      stage: "pre-push",
      headSha: "88fa371cb0",
      hostedRunId: null,
    }),
    recordedAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  });

const inTempRepo = Effect.fn("ProofLedgerTest.inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

const withLedger = <Value, Failure, Requirements>(
  root: string,
  use: (ledger: ProofLedgerShape) => Effect.Effect<Value, Failure, Requirements>,
  tripwire: ProofChangedPackageTripwire = constFalse
) =>
  Effect.gen(function* () {
    const ledger = yield* ProofLedger;
    return yield* use(ledger);
  }).pipe(Effect.provideServiceEffect(ProofLedger, ProofLedger.make(root, tripwire)));

describe("ProofLedger", () => {
  it.live("returns no-fact for an empty checkout ledger", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const decision = yield* ledger.lookup(input(), NOW);
          expect(decision).toStrictEqual(ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" }));
          expect(yield* ledger.malformedRows).toBe(0);
          expect(yield* ledger.expire(NOW)).toBe(0);
          expect(yield* ledger.disagreements).toStrictEqual([]);
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("records a passed fact and returns a reuse hit", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* ledger.record(fact());

          const decision = yield* ledger.lookup(input(), NOW);
          expect(decision).toStrictEqual(
            ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" })
          );

          const ledgerPath = yield* proofLedgerPathForCheckout(root);
          const contents = yield* fs.readFileString(ledgerPath);
          expect(Str.endsWith("\n")(contents)).toBe(true);
          expect(A.length(Str.split(contents, "\n"))).toBe(2);
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("returns prior-failed for the latest exact failed fact", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          yield* ledger.record(fact());
          yield* ledger.record(fact({ outcome: "failed", recordedAt: "2026-09-03T12:10:00.000Z" }));

          expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "proof-key", reason: "prior-failed" })
          );
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("returns expired and counts logical expiration without rewriting history", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          yield* ledger.record(fact({ expiresAt: "2026-09-03T12:15:00.000Z" }));
          expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "proof-key", reason: "expired" })
          );

          yield* ledger.record(fact({ key: input({ key: "invalid-expiry" }), expiresAt: "not-a-date" }));
          yield* ledger.record(fact({ key: input({ key: "active" }), expiresAt: "2026-09-03T13:00:00.000Z" }));
          expect(yield* ledger.expire(NOW)).toBe(2);
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("classifies epoch, profile, and inconsistent-key misses", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          yield* ledger.record(fact());

          expect(yield* ledger.lookup(input({ key: "epoch-key", epochDigest: "epoch-2" }), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "epoch-key", reason: "epoch-changed" })
          );
          expect(yield* ledger.lookup(input({ key: "profile-key", envProfile: "pr-posture" }), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "profile-key", reason: "profile-mismatch" })
          );
          expect(yield* ledger.lookup(input({ key: "inconsistent-key" }), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "inconsistent-key", reason: "no-fact" })
          );
          expect(yield* ledger.lookup(input({ key: "new-input", inputDigest: "changed-input" }), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "new-input", reason: "no-fact" })
          );

          yield* ledger.record(
            fact({
              key: input({ commandDigest: "corrupt-command", key: "colliding-key" }),
            })
          );
          expect(yield* ledger.lookup(input({ key: "colliding-key" }), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "colliding-key", reason: "no-fact" })
          );

          yield* ledger.record(
            fact({
              epoch: epoch("stored-epoch"),
              key: input({ epochDigest: "different-epoch", key: "inconsistent-epoch" }),
            })
          );
          expect(
            yield* ledger.lookup(input({ epochDigest: "different-epoch", key: "inconsistent-epoch" }), NOW)
          ).toStrictEqual(ProofReuseMiss.make({ key: "inconsistent-epoch", reason: "no-fact" }));
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("refuses undeclared inputs and caller-owned changed-package tripwires before reading", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* withLedger(root, (ledger) =>
          Effect.gen(function* () {
            expect(yield* ledger.lookup(input({ inputSource: "undeclared" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "proof-key", reason: "undeclared-inputs" })
            );
          })
        );
        yield* withLedger(
          root,
          (ledger) =>
            Effect.gen(function* () {
              expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
                ProofReuseMiss.make({ key: "proof-key", reason: "changed-package-tripwire" })
              );
            }),
          () => true
        );
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("records shadow rows and returns only hit-versus-failed disagreements", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const disagreement = ProofLedgerShadowRow.make({
            schemaVersion: PROOF_FACT_SCHEMA_VERSION,
            attemptId: "attempt-1",
            decision: ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" }),
            observed: "failed",
            recordedAt: "2026-09-03T12:31:00.000Z",
          });
          yield* ledger.recordShadow(disagreement);
          yield* ledger.recordShadow(
            ProofLedgerShadowRow.make({
              schemaVersion: PROOF_FACT_SCHEMA_VERSION,
              attemptId: "attempt-2",
              decision: ProofReuseHit.make({
                key: "proof-key",
                factRecordedAt: "2026-09-03T12:00:00.000Z",
              }),
              observed: "passed",
              recordedAt: "2026-09-03T12:32:00.000Z",
            })
          );
          yield* ledger.recordShadow(
            ProofLedgerShadowRow.make({
              schemaVersion: PROOF_FACT_SCHEMA_VERSION,
              attemptId: "attempt-3",
              decision: ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" }),
              observed: "failed",
              recordedAt: "2026-09-03T12:33:00.000Z",
            })
          );

          expect(yield* ledger.disagreements).toStrictEqual([disagreement]);
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("counts malformed terminated rows and ignores an unterminated append tail", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* ledger.record(fact());
          const ledgerPath = yield* proofLedgerPathForCheckout(root);
          yield* fs.writeFileString(ledgerPath, "malformed\n", { flag: "a" });
          yield* fs.writeFileString(ledgerPath, '{"kind":"shadow"', { flag: "a" });

          expect(yield* ledger.malformedRows).toBe(1);
          expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
            ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" })
          );

          const recoveredFact = fact({
            key: input({ key: "recovered-key" }),
            recordedAt: "2026-09-03T12:40:00.000Z",
          });
          yield* ledger.record(recoveredFact);
          expect(yield* ledger.lookup(input({ key: "recovered-key" }), NOW)).toStrictEqual(
            ProofReuseHit.make({ key: "recovered-key", factRecordedAt: "2026-09-03T12:40:00.000Z" })
          );
          expect(yield* ledger.malformedRows).toBe(2);
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("treats a wholly unterminated first row as in-flight rather than malformed", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const ledgerPath = yield* proofLedgerPathForCheckout(root);
          yield* fs.makeDirectory(yield* Effect.map(Path.Path, (path) => path.dirname(ledgerPath)), {
            recursive: true,
          });
          yield* fs.writeFileString(ledgerPath, '{"kind":"fact"');

          expect(yield* ledger.malformedRows).toBe(0);
          expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
            ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" })
          );
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails with a typed error when the ledger path is not a readable regular file", () =>
    inTempRepo((root) =>
      withLedger(root, (ledger) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const ledgerPath = yield* proofLedgerPathForCheckout(root);
          yield* fs.makeDirectory(ledgerPath, { recursive: true });

          const error = yield* ledger.malformedRows.pipe(Effect.flip);
          expect(error._tag).toBe("YeetCommandError");
          expect(error.message).toContain("not a readable regular file");
        })
      )
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
