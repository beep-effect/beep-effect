import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention";
import { ObservationIdentity, ObservationRootBinding } from "@beep/repo-ai-metrics/observation-inventory";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchIdentity,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver });
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const known = (digit: string) => ObservationIdentity.cases.Verified.make({ id: id(digit), evidenceId: id("e") });
const identity = ObservationLaunchIdentity.make({
  routeId: id("8"),
  harness: "codex-cli",
  surface: "cli",
  root: ObservationRootBinding.cases.Verified.make({ rootId: `root-${id("9")}`, evidenceId: id("e") }),
  repository: known("1"),
  clone: known("2"),
  worktree: known("3"),
  task: known("5"),
  attempt: known("6"),
  evidenceId: id("e"),
});
const prepare = (digit = "7") => ObservationLaunchFact.cases.Prepared.make({ launchId: id(digit), identity });
const start = (digit = "7") =>
  ObservationLaunchFact.cases.Started.make({ launchId: id(digit), processInstanceId: id("c") });
const bind = ObservationLaunchFact.cases.SessionBound.make({ launchId: id("7"), sourceSessionId: id("4") });
const finish = (digit = "7") =>
  ObservationLaunchFact.cases.Finished.make({ launchId: id(digit), outcome: "succeeded" });
const fixture = Effect.fn("LaunchFactsTest.fixture")(function* (maxPages = 4, maxPayloadBytes = 131072) {
  const config = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: id("b"),
    maxPages,
    maxPayloadBytes,
    maxDatabasePages: 512,
  });
  const facts = yield* makeObservationLaunchFacts(config);
  const journal = yield* makeTranscriptIntakeJournal(config);
  const retention = yield* makeEvidenceRetention(
    config,
    DeliveryLedgerConfig.make({ targetId: id("d"), maxEvents: 64, maxAttempts: 64, maxAttemptsPerEvent: 8 }),
    EvidenceRetentionPolicy.make({
      minEpochMillis: 60000,
      minAttemptQuietMillis: 60000,
      maxRecords: 64,
      deadlineMillis: 10000,
    })
  );
  return { config, facts, journal, retention };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("retains independent identity and exact lifecycle receipts across reopening", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const first = yield* f.facts.record(prepare(), 0);
      expect((yield* f.facts.read(id("7"), 0)).length).toBe(1);
      expect(first.fact).toEqual(prepare());
      expect(first).toMatchObject({ hostId: id("a"), namespaceId: id("b"), evidenceEpoch: 0 });
      yield* TestClock.adjust(100);
      const started = yield* f.facts.record(start(), 0);
      yield* f.facts.record(bind, 0);
      yield* f.facts.record(finish(), 0);
      const reopened = yield* makeObservationLaunchFacts(f.config);
      expect(yield* reopened.record(prepare(), 0)).toEqual(first);
      expect(yield* reopened.record(start(), 0)).toEqual(started);
      const rows = yield* reopened.read(id("7"), 0);
      expect(rows.length).toBe(4);
      expect(rows[2]?.fact).toEqual(bind);
      expect(yield* f.journal.reservedLaunchBytes).toBe(0);
      expect((yield* f.journal.stats).pages).toBe(0);
      expect((yield* f.journal.stats).payloadBytes).toBeGreaterThan(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("refuses missing preparation, conflicting observations and success without a start", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect((yield* f.facts.record(start(), 0).pipe(Effect.flip)).reason).toBe("conflict");
      yield* f.facts.record(prepare(), 0);
      expect((yield* f.facts.record(bind, 0).pipe(Effect.flip)).reason).toBe("conflict");
      expect((yield* f.facts.record(finish(), 0).pipe(Effect.flip)).reason).toBe("conflict");
      const changed = ObservationLaunchFact.cases.Prepared.make({
        ...prepare(),
        identity: ObservationLaunchIdentity.make({ ...identity, task: known("f") }),
      });
      expect((yield* f.facts.record(changed, 0).pipe(Effect.flip)).reason).toBe("conflict");
      yield* f.facts.record(ObservationLaunchFact.cases.Finished.make({ launchId: id("7"), outcome: "unknown" }), 0);
      expect((yield* f.facts.record(start(), 0).pipe(Effect.flip)).reason).toBe("conflict");
      expect((yield* f.facts.read(id("7"), 0)).length).toBe(2);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("reserves completion bytes and permits exact replay at the launch-count limit", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1, 32768);
      const first = yield* f.facts.record(prepare(), 0);
      expect((yield* f.journal.stats).payloadBytes + (yield* f.journal.reservedLaunchBytes)).toBe(32768);
      expect((yield* f.facts.record(prepare("f"), 0).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* f.facts.record(prepare(), 0)).toEqual(first);
      yield* f.facts.record(start(), 0);
      yield* f.facts.record(bind, 0);
      yield* f.facts.record(finish(), 0);
      expect(yield* f.journal.reservedLaunchBytes).toBe(0);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("holds open launches and reversibly retires closed launch-only epochs", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const prepared = yield* f.facts.record(prepare(), 0);
      yield* TestClock.adjust(60001);
      assertNone(yield* f.retention.seal(0));
      yield* f.facts.record(start(), 0);
      yield* f.facts.record(bind, 0);
      yield* f.facts.record(finish(), 0);
      const sealed = yield* f.retention.seal(0);
      assertTrue(O.isSome(sealed));
      expect(sealed.value.record.totals).toMatchObject({
        pages: 0,
        eventObservations: 0,
        launchPreparations: 1,
        launchStarts: 1,
        launchSessionBindings: 1,
        launchFinishes: 1,
      });
      expect((yield* f.facts.read(id("7"), 0).pipe(Effect.flip)).reason).toBe("retired");
      expect((yield* f.journal.stats).payloadBytes).toBe(0);
      yield* f.retention.restore(sealed.value.digest);
      expect(yield* f.facts.record(prepare(), 0)).toEqual(prepared);
      expect((yield* f.facts.read(id("7"), 0)).length).toBe(4);
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("detects stored tampering and orphaned lifecycle rows", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.facts.record(prepare(), 0);
      yield* f.facts.record(start(), 0);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_launch_facts SET payload_bytes=1 WHERE phase=1`;
      expect((yield* f.facts.read(id("7"), 0).pipe(Effect.flip)).reason).toBe("storage");
      yield* sql`UPDATE observation_launch_facts SET payload_bytes=length(payload) WHERE phase=1`;
      yield* sql`DELETE FROM observation_launch_facts WHERE phase=0`;
      expect((yield* f.facts.read(id("7"), 0).pipe(Effect.flip)).reason).toBe("storage");
    })
  );
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) => {
  it.effect("rejects private fields at the fact decoding boundary", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ObservationLaunchFact)(prepare());
      expect(
        yield* S.decodeUnknownEffect(ObservationLaunchFact, { onExcessProperty: "error" })({
          ...encoded,
          command: "private-synthetic-command",
        }).pipe(Effect.isFailure)
      ).toBe(true);
    })
  );
});
