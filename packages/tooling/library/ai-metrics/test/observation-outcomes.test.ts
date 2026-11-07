import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention";
import {
  makeObservationAvailability,
  ObservationAvailabilityReceipt,
} from "@beep/repo-ai-metrics/observation-availability";
import { ObservationIdentity, ObservationRootBinding } from "@beep/repo-ai-metrics/observation-inventory";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchIdentity,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { makeObservationOutcomes } from "@beep/repo-ai-metrics/observation-outcomes";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const receiptJson = S.fromJsonString(ObservationAvailabilityReceipt);
const encodeAvailabilityReceipt = S.encodeEffect(receiptJson);
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const config = TranscriptIntakeConfig.make({
  hostId: id("a"),
  namespaceId: id("b"),
  maxPages: 4,
  maxPayloadBytes: 131072,
  maxDatabasePages: 512,
});
const identity = ObservationLaunchIdentity.make({
  routeId: id("8"),
  harness: "muse",
  surface: "cli",
  root: ObservationRootBinding.cases.Unknown.make({}),
  repository: ObservationIdentity.cases.Unknown.make({}),
  clone: ObservationIdentity.cases.Unknown.make({}),
  worktree: ObservationIdentity.cases.Unknown.make({}),
  task: ObservationIdentity.cases.Unknown.make({}),
  attempt: ObservationIdentity.cases.Unknown.make({}),
  evidenceId: id("e"),
});
const prepare = ObservationLaunchFact.cases.Prepared.make({ launchId: id("7"), identity });
const start = ObservationLaunchFact.cases.Started.make({ launchId: id("7"), processInstanceId: id("c") });
const snapshot = (digit = "1", used = 100, observedAt = 0) => ({
  snapshotId: id(digit),
  sourceEvidenceId: id("d"),
  declaredHarness: "muse",
  sourceKind: "registered-proxy-account-status",
  observedAt,
  report: { _tag: "Reported", weekly: { usedPercent: used, reportedResetAt: 259200000 }, session: null },
});
const fixture = Effect.fn("ObservationOutcomesTest.fixture")(function* (limits = config) {
  const quota = yield* makeObservationAvailability(limits);
  const launches = yield* makeObservationLaunchFacts(limits);
  const views = yield* makeObservationOutcomes(limits);
  const journal = yield* makeTranscriptIntakeJournal(limits);
  return { quota, launches, views, journal };
});
const makeRetention = Effect.fn("ObservationOutcomesTest.retention")(() =>
  makeEvidenceRetention(
    config,
    DeliveryLedgerConfig.make({ targetId: id("d"), maxEvents: 64, maxAttempts: 64, maxAttemptsPerEvent: 8 }),
    EvidenceRetentionPolicy.make({
      minEpochMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxRecords: 64,
      deadlineMillis: 10000,
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("reads a separately bound source session through the original launch receipts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.launches.record(prepare, 0);
      yield* f.launches.record(start, 0);
      yield* f.launches.record(
        ObservationLaunchFact.cases.SessionBound.make({ launchId: id("7"), sourceSessionId: id("f") }),
        0
      );
      const pendingRead = yield* f.views.launch(id("7"), 0);
      const pending = O.getOrThrow(pendingRead);
      assertSome(pending.processInstanceId, id("c"));
      assertSome(pending.sourceSessionId, id("f"));
      expect(pending.outcome).toBe("pending");
      yield* f.launches.record(
        ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "succeeded" }),
        0
      );
      const finishedRead = yield* f.views.launch(id("7"), 0);
      const finished = O.getOrThrow(finishedRead);
      assertSome(finished.processInstanceId, id("c"));
      assertSome(finished.sourceSessionId, id("f"));
      expect(finished.outcome).toBe("succeeded");
      expect(finished.model).toBe("unknown");
      expect(finished.nativeRuntime).toBe("unknown");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("maps hash-valid malformed stored receipts to finite storage failure", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.quota.record(snapshot(), 0);
      const sql = yield* SqlClient.SqlClient;
      const payload = "{}";
      const digest = yield* hashPublicTextSha256(payload);
      yield* sql`UPDATE observation_availability_snapshots SET payload=${payload},digest=${digest},payload_bytes=2 WHERE snapshot_id=${id("1")}`;
      const failed = yield* f.quota.read(id("1"), 0).pipe(Effect.flip);
      expect(failed.reason).toBe("storage");
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("refuses a hash-valid receipt whose stored host differs from the journal owner", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receipt = yield* f.quota.record(snapshot(), 0);
      const payload = yield* encodeAvailabilityReceipt(
        ObservationAvailabilityReceipt.make({ ...receipt, hostId: id("c") })
      );
      const digest = yield* hashPublicTextSha256(payload);
      const bytes = new TextEncoder().encode(payload).byteLength;
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_availability_snapshots SET payload=${payload},digest=${digest},payload_bytes=${bytes} WHERE snapshot_id=${id("1")}`;
      const failed = yield* f.views.availability(id("1"), 0).pipe(Effect.flip);
      expect(failed.reason).toBe("storage");
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("keeps a failed process and independent quota report separate", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.launches.record(prepare, 0);
      yield* f.launches.record(start, 0);
      yield* f.launches.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "failed" }), 0);
      yield* f.quota.record(snapshot(), 0);
      const launch = yield* f.views.launch(id("7"), 0);
      expect(O.getOrThrow(launch)).toMatchObject({
        outcome: "failed",
        cause: "unknown",
        model: "unknown",
        nativeRuntime: "unknown",
        population: "unknown",
        transport: "managed-launch",
      });
      assertSome(O.getOrThrow(launch).processInstanceId, id("c"));
      assertNone(O.getOrThrow(launch).sourceSessionId);
      const observed1 = yield* f.views.availability(id("1"), 0);
      const quota = O.getOrThrow(observed1);
      expect(quota).toMatchObject({
        reportedAvailability: "weekly-exhausted",
        currentAvailability: "unknown",
        invocationBinding: "unknown",
      });
      expect(quota.receipt.snapshot.sourceEvidenceId).toBe(id("d"));
      expect((yield* f.journal.stats).frames).toBe(0);
      expect((yield* f.journal.stats).pages).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("does not fabricate a process for a prepared unknown outcome", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const observed2 = yield* f.views.launch(id("7"), 0);
      assertNone(observed2);
      yield* f.launches.record(prepare, 0);
      const observed3 = yield* f.views.launch(id("7"), 0);
      expect(O.getOrThrow(observed3).outcome).toBe("pending");
      yield* f.launches.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" }), 0);
      const observed4 = yield* f.views.launch(id("7"), 0);
      const view = O.getOrThrow(observed4);
      assertNone(view.processInstanceId);
      expect(view.outcome).toBe("unknown");
      expect(view.timeBasis).toBe("intake-observation");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("renders cancellation without converting it to success or usage", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.launches.record(prepare, 0);
      yield* f.launches.record(start, 0);
      yield* TestClock.adjust(100);
      yield* f.launches.record(
        ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "cancelled" }),
        0
      );
      const observed5 = yield* f.views.launch(id("7"), 0);
      const view = O.getOrThrow(observed5);
      expect(view.outcome).toBe("cancelled");
      assertSome(view.terminalObservedAt, 100);
      expect(view.preparedObservedAt).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("rejects out of order facts and conflicting terminal replay", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect((yield* f.launches.record(start, 0).pipe(Effect.flip)).reason).toBe("conflict");
      yield* f.launches.record(prepare, 0);
      const finish = ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" });
      const first = yield* f.launches.record(finish, 0);
      const observed6 = yield* f.launches.record(finish, 0);
      expect(observed6).toEqual(first);
      expect(
        (yield* f.launches
          .record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "failed" }), 0)
          .pipe(Effect.flip)).reason
      ).toBe("conflict");
      const observed7 = yield* f.views.launch(id("7"), 0);
      expect(O.getOrThrow(observed7).outcome).toBe("unknown");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("returns the first durable receipt after lost acknowledgment and reopen", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const first = yield* f.quota.record(snapshot(), 0);
      yield* TestClock.adjust(1000);
      const reopened = yield* makeObservationAvailability(config);
      const observed8 = yield* reopened.record(snapshot(), 0);
      expect(observed8).toEqual(first);
      const observed9 = yield* reopened.read(id("1"), 0);
      assertSome(observed9, first);
      expect(first.acceptedAt).toBe(0);
      expect((yield* f.quota.record(snapshot("1", 99), 0).pipe(Effect.flip)).reason).toBe("conflict");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("does not select the latest snapshot or infer current availability", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* TestClock.adjust(1000);
      yield* f.quota.record(snapshot("1", 100, 1000), 0);
      yield* f.quota.record(snapshot("2", 25, 0), 0);
      const observed10 = yield* f.views.availability(id("1"), 0);
      expect(O.getOrThrow(observed10).reportedAvailability).toBe("weekly-exhausted");
      const observed11 = yield* f.views.availability(id("2"), 0);
      expect(O.getOrThrow(observed11).reportedAvailability).toBe("unknown");
      yield* TestClock.adjust(300000000);
      const observed12 = yield* f.views.availability(id("1"), 0);
      expect(O.getOrThrow(observed12).currentAvailability).toBe("unknown");
      const observed13 = yield* f.views.availability(id("3"), 0);
      assertNone(observed13);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("rejects future capture time without persisting a snapshot", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect((yield* f.quota.record(snapshot("1", 100, 1), 0).pipe(Effect.flip)).reason).toBe("clock");
      const observed14 = yield* f.quota.read(id("1"), 0);
      assertNone(observed14);
      expect((yield* f.journal.stats).payloadBytes).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("rejects credential text and cross-source launch binding at the boundary", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      for (const input of [
        { ...snapshot(), token: "must-not-retain" },
        { ...snapshot(), launchId: id("7") },
        { ...snapshot(), report: { ...snapshot().report, message: "private-error" } },
        snapshot("1", 101),
        snapshot("1", -1),
      ]) {
        expect((yield* f.quota.record(input, 0).pipe(Effect.flip)).reason).toBe("decode");
      }
      expect((yield* f.journal.stats).payloadBytes).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("retains unknown and unavailable reports without inferring auth health", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.quota.record({ ...snapshot(), report: { _tag: "Unknown", reason: "not-reported" } }, 0);
      yield* f.quota.record({ ...snapshot("2"), report: { _tag: "Unavailable", reason: "consumer-refused" } }, 0);
      yield* f.quota.record({ ...snapshot("3"), report: { _tag: "Reported", weekly: null, session: null } }, 0);
      yield* f.quota.record(
        {
          ...snapshot("4"),
          report: { _tag: "Reported", weekly: null, session: { usedPercent: 100, reportedResetAt: null } },
        },
        0
      );
      const observed15 = yield* f.views.availability(id("1"), 0);
      expect(O.getOrThrow(observed15).reportedAvailability).toBe("unknown");
      const observed16 = yield* f.views.availability(id("2"), 0);
      expect(O.getOrThrow(observed16).reportedAvailability).toBe("unknown");
      const observed17 = yield* f.views.availability(id("3"), 0);
      expect(O.getOrThrow(observed17).reportedAvailability).toBe("unknown");
      const observed18 = yield* f.views.availability(id("4"), 0);
      expect(O.getOrThrow(observed18).reportedAvailability).toBe("session-capped");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("shares launch completion budget and permits exact replay at capacity", () =>
    Effect.gen(function* () {
      const f = yield* fixture(TranscriptIntakeConfig.make({ ...config, maxPayloadBytes: 32768 }));
      yield* f.launches.record(prepare, 0);
      expect((yield* f.quota.record(snapshot(), 0).pipe(Effect.flip)).reason).toBe("capacity");
      yield* f.launches.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" }), 0);
      yield* f.quota.record(snapshot(), 0);
      expect((yield* f.journal.stats).payloadBytes).toBeGreaterThan(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("limits count across snapshots but returns an existing receipt at the cap", () =>
    Effect.gen(function* () {
      const f = yield* fixture(TranscriptIntakeConfig.make({ ...config, maxPages: 1 }));
      const first = yield* f.quota.record(snapshot(), 0);
      expect((yield* f.quota.record(snapshot("2"), 0).pipe(Effect.flip)).reason).toBe("capacity");
      const observed19 = yield* f.quota.record(snapshot(), 0);
      expect(observed19).toEqual(first);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("refuses a foreign epoch and detects modified stored metadata", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect((yield* f.quota.record(snapshot(), 1).pipe(Effect.flip)).reason).toBe("retired");
      yield* f.quota.record(snapshot(), 0);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_availability_snapshots SET payload='{}' WHERE snapshot_id=${id("1")}`;
      expect((yield* f.quota.read(id("1"), 0).pipe(Effect.flip)).reason).toBe("storage");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("keeps quota bytes through retirement and restores the original window", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const first = yield* f.quota.record(snapshot(), 0);
      yield* f.launches.record(prepare, 0);
      yield* f.launches.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" }), 0);
      const retention = yield* makeRetention();
      yield* TestClock.adjust(60001);
      const observed21 = yield* retention.seal(0);
      const sealed = O.getOrThrow(observed21);
      const oldRead = yield* f.quota.read(id("1"), 0).pipe(Effect.flip);
      expect(oldRead.reason).toBe("retired");
      const movedRead = yield* f.quota.read(id("1"), 1).pipe(Effect.flip);
      expect(movedRead.reason).toBe("retired");
      expect((yield* f.journal.stats).payloadBytes).toBeGreaterThan(0);
      yield* retention.restore(sealed.digest);
      const restored = yield* f.quota.read(id("1"), 0);
      assertSome(restored, first);
      const observed22 = yield* f.views.launch(id("7"), 0);
      const view = O.getOrThrow(observed22);
      expect(view.outcome).toBe("unknown");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("refuses recovery after a new-window quota acknowledgment", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.launches.record(prepare, 0);
      yield* f.launches.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" }), 0);
      const retention = yield* makeRetention();
      yield* TestClock.adjust(60001);
      const retirement = yield* retention.seal(0);
      const sealed = O.getOrThrow(retirement);
      const acknowledged = yield* f.quota.record(snapshot("2"), 1);
      const refused = yield* retention.restore(sealed.digest).pipe(Effect.flip);
      expect(refused.reason).toBe("conflict");
      expect((yield* f.journal.evidenceWindow).epoch).toBe(1);
      const retained = yield* f.quota.read(id("2"), 1);
      assertSome(retained, acknowledged);
      const missing = yield* f.views.launch(id("7"), 1);
      assertNone(missing);
    })
  );
});
