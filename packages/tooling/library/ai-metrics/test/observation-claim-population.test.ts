import {
  ObservationClaimPopulationRequest,
  readObservationClaimPopulation,
} from "@beep/repo-ai-metrics/observation-claim-population";
import { reconcileObservationCoverage } from "@beep/repo-ai-metrics/observation-coverage";
import { makeObservationClaims } from "@beep/repo-ai-metrics/observation-launch-claims";
import { makeObservationLaunchFacts, ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { claimFixture, claimId, claimSubmission } from "./fixtures/observation-claims.ts";

const layer = Layer.mergeAll(NodeServices.layer, Reactivity.layer);
const request = (harness = "codex-cli", namespaceId = claimId("b")) =>
  S.decodeUnknownEffect(ObservationClaimPopulationRequest)({
    version: "observation-claim-population-request/v1",
    routeIds: [claimId("c")],
    inventory: {
      schemaVersion: "agent-observation-inventory/v1",
      observedAt: "1970-01-01T00:00:01Z",
      populationWindowStart: "1970-01-01T00:00:00Z",
      populationWindowEnd: "1970-01-01T00:00:01Z",
      boundaryEvidenceId: claimId("d"),
      hosts: [{ hostId: claimId("a"), identityNamespaceId: namespaceId }],
      roots: [],
      routes: A.map(["c", "d"], (digit) => ({
        routeId: claimId(digit),
        hostId: claimId("a"),
        harness: digit === "c" ? harness : "claude-desktop",
        surface: digit === "c" ? "cli" : "desktop",
        transport: "managed-launch",
        root: { _tag: "Unknown" },
        capability: { _tag: "Unknown" },
        policy: { _tag: "Included" },
        heartbeat: { _tag: "Unknown" },
        knownLaunches: { _tag: "Enumerated", ids: [claimId("f")], evidenceId: claimId("e") },
        expectedEvents: { _tag: "Enumerated", ids: [claimId("f")], evidenceId: claimId("e") },
      })),
    },
  });
const started = (input: ObservationLaunchSubmission) =>
  ObservationLaunchSubmission.make({
    ...input,
    fact: ObservationLaunchFact.cases.Started.make({ launchId: input.fact.launchId, processInstanceId: claimId("9") }),
  });

it.layer(layer, { timeout: "30 seconds" })("Independent claim populations", (it) => {
  it.effect("publishes claim-cohort launches separately from historical acceptance and unknown telemetry", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const f = yield* claimFixture();
      const claims = yield* makeObservationClaims(f.policy, f.uid);
      const input = claimSubmission();
      yield* claims.runOnce(input, () => Effect.void);
      yield* TestClock.setTime(2000);
      // Started is later than the claim window; the report must explicitly describe a cohort.
      yield* claims.appendObservation(started(input));
      const before = yield* readObservationClaimPopulation(f.policy, yield* request(), f.uid);
      expect(before.evidence.scope).toBe("claims-created-in-window");
      expect(before.rows[0]).toMatchObject({
        claims: [input.fact.launchId],
        started: [input.fact.launchId],
        unresolvedStarts: [],
        receiptedStarts: [],
      });
      expect(reconcileObservationCoverage(before.coverage).routes[0]?.launches).toMatchObject({
        _tag: "Compared",
        expected: 1,
        observed: 0,
        exhaustive: false,
      });
      const sql = yield* SqliteClient.make({ filename: `${f.policy.journalDirectory}/journal.sqlite` });
      const backend = yield* makeObservationLaunchFacts(
        TranscriptIntakeConfig.make({
          hostId: claimId("a"),
          namespaceId: claimId("b"),
          maxPages: 4,
          maxPayloadBytes: 65536,
          maxDatabasePages: 256,
        })
      ).pipe(Effect.provideService(SqlClient.SqlClient, sql));
      yield* claims.reconcile(input.fact.launchId, (submission) =>
        backend.record(submission.fact, submission.evidenceEpoch)
      );
      const after = yield* readObservationClaimPopulation(f.policy, yield* request(), f.uid);
      expect(reconcileObservationCoverage(after.coverage).routes[0]?.launches).toMatchObject({
        _tag: "Compared",
        expected: 1,
        matched: 1,
        exhaustive: false,
      });
      expect(after.coverage.routes[0]?.visibleEvents).toEqual({ _tag: "Unknown" });
      expect(after.coverage.routes[0]?.acceptedEvents).toEqual({ _tag: "Unknown" });
      expect(after.coverage.inventory.routes[0]?.expectedEvents).toEqual({ _tag: "Unknown" });
      expect(after.coverage.inventory.routes[1]?.knownLaunches).toEqual({ _tag: "Unknown" });
      expect(after.evidenceId).not.toBe(before.evidenceId);
    })
  );

  it.effect("keeps uncertain starts unknown and excludes claims at or after the window end", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const f = yield* claimFixture();
      const claims = yield* makeObservationClaims(f.policy, f.uid);
      yield* claims.runOnce(claimSubmission(), () => Effect.void);
      yield* TestClock.setTime(1000);
      yield* claims.runOnce(claimSubmission("2"), () => Effect.void);
      const report = yield* readObservationClaimPopulation(f.policy, yield* request(), f.uid);
      expect(report.rows[0]?.claims).toEqual([claimId("1")]);
      expect(report.rows[0]?.unresolvedStarts).toEqual([claimId("1")]);
      expect(report.coverage.inventory.routes[0]?.knownLaunches).toEqual({ _tag: "Unknown" });
      expect(reconcileObservationCoverage(report.coverage).routes[0]?.launches).toMatchObject({
        _tag: "DenominatorUnknown",
        observed: 0,
      });
    })
  );

  it.effect("enumerates an empty declared cohort only after a complete read and rejects identity mismatches", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const f = yield* claimFixture();
      yield* TestClock.setTime(1000);
      const empty = yield* readObservationClaimPopulation(f.policy, yield* request(), f.uid);
      expect(empty.coverage.inventory.routes[0]?.knownLaunches).toMatchObject({ _tag: "Enumerated", ids: [] });
      expect(empty.coverage.inventory.routes[1]?.knownLaunches).toEqual({ _tag: "Unknown" });
      expect(
        yield* readObservationClaimPopulation(f.policy, yield* request("codex-cli", claimId("f")), f.uid).pipe(
          Effect.flip
        )
      ).toMatchObject({ reason: "boundary" });
      yield* TestClock.setTime(0);
      const claims = yield* makeObservationClaims(f.policy, f.uid);
      yield* claims.runOnce(claimSubmission(), () => Effect.void);
      yield* TestClock.setTime(1000);
      expect(
        yield* readObservationClaimPopulation(f.policy, yield* request("grok"), f.uid).pipe(Effect.flip)
      ).toMatchObject({ reason: "identity" });
      yield* f.fs.writeFileString(`${f.policy.directory}/receipt-0-0.json`, "", { mode: 0o600 });
      expect(yield* readObservationClaimPopulation(f.policy, yield* request(), f.uid).pipe(Effect.flip)).toMatchObject({
        reason: "integrity",
      });
    })
  );

  it.effect("refuses copied claim slots and changing stores without producing a partial population", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(0);
      const f = yield* claimFixture();
      const original = yield* makeObservationClaims(f.policy, f.uid);
      yield* original.runOnce(claimSubmission(), () => Effect.void);
      const count = yield* Ref.make(0);
      const watched = FileSystem.FileSystem.of({
        ...f.fs,
        lstat: Effect.fn("PopulationTest.lstat")(function* (path) {
          if (path === `${f.policy.directory}/claim-1.json`) {
            const n = yield* Ref.updateAndGet(count, (n) => n + 1);
            if (n === 2) yield* original.runOnce(claimSubmission("2"), () => Effect.void).pipe(Effect.orDie);
          }
          return yield* f.fs.lstat(path);
        }),
      });
      const raced = yield* makeObservationClaims(f.policy, f.uid).pipe(
        Effect.provideService(FileSystem.FileSystem, watched)
      );
      expect(yield* raced.snapshotOutboxes.pipe(Effect.flip)).toMatchObject({ reason: "contended" });
      yield* f.fs.writeFileString(
        `${f.policy.directory}/claim-1.json`,
        yield* f.fs.readFileString(`${f.policy.directory}/claim-0.json`),
        { mode: 0o600 }
      );
      expect(yield* original.snapshotOutboxes.pipe(Effect.flip)).toMatchObject({ reason: "integrity" });
    })
  );
  it.effect("reads a full store with a linear descriptor budget", () =>
    Effect.gen(function* () {
      const f = yield* claimFixture(16);
      const writer = yield* makeObservationClaims(f.policy, f.uid);
      for (const digit of A.fromIterable("0123456789abcdef"))
        yield* writer.runOnce(claimSubmission(digit), () => Effect.void);
      const opened = yield* Ref.make(0);
      const watched = FileSystem.FileSystem.of({
        ...f.fs,
        open: Effect.fn("PopulationTest.open")((path, options) =>
          Ref.update(opened, (n) => n + 1).pipe(Effect.andThen(f.fs.open(path, options)))
        ),
      });
      const reader = yield* makeObservationClaims(f.policy, f.uid).pipe(
        Effect.provideService(FileSystem.FileSystem, watched)
      );
      expect(yield* reader.snapshotOutboxes).toHaveLength(16);
      expect(yield* Ref.get(opened)).toBeLessThanOrEqual(160);
    })
  );
});
