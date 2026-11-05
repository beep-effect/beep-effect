import {
  DeliveryAttempt,
  DeliveryLedgerConfig,
  DeliveryOutcome,
  DeliveryVisibility,
  makeDeliveryLedger,
} from "@beep/repo-ai-metrics/delivery-ledger";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const fixture = Effect.fn("DeliveryLedgerTest.fixture")(function* (
  maxEvents = 16,
  maxAttempts = 16,
  maxAttemptsPerEvent = 8
) {
  const salt = "synthetic-delivery-ledger-salt";
  const intakeConfig = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const config = DeliveryLedgerConfig.make({ targetId: id("b"), maxEvents, maxAttempts, maxAttemptsPerEvent });
  const native = yield* makeNativeIntakeJournal(intakeConfig);
  const body = yield* encodeJsonValue({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: A.map(["1", "2"], (digit) => ({
              traceId: Str.repeat(32)("1"),
              spanId: Str.repeat(16)(digit),
              name: "private-synthetic-source",
            })),
          },
        ],
      },
    ],
  });
  const batch = yield* projectNativeTraceRequest(
    NativeTraceRequest.make({
      routeId: id("c"),
      hashSalt: Redacted.make(salt),
      contentType: "application/json",
      body: new TextEncoder().encode(body),
      approvedModels: [],
      usageConvention: "unknown",
    })
  );
  const accepted = yield* native.acceptBatch(batch);
  const ledger = yield* makeDeliveryLedger(intakeConfig, config);
  const eventIds = A.map(batch.spans, (span) => span.eventId);
  const prepare = (char: string, selected = eventIds) =>
    ledger.prepareAttempt(DeliveryAttempt.make({ attemptId: id(char), eventIds: selected, payloadDigest: id("d") }));
  const first = eventIds[0];
  const second = eventIds[1];
  if (first === undefined || second === undefined) {
    return yield* Effect.die("Invalid synthetic fixture");
  }
  return { ledger, intakeConfig, config, accepted, first, second, prepare, salt, eventIds };
});
const accepted = DeliveryOutcome.cases.Accepted.make({});
const retryable = DeliveryOutcome.cases.Retryable.make({ status: 503 });
const rejected = DeliveryOutcome.cases.Rejected.make({ status: 400 });
const unknown = DeliveryOutcome.cases.Unknown.make({ reason: "timed-out" });

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses to read an outcome for an attempt that was never reserved", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const error = yield* f.ledger.readOutcome(id("f")).pipe(Effect.flip);
      expect(error.reason).toBe("unknown-attempt");
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("registers verified canonical native and transcript events while excluding malformed frames", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const state1 = yield* f.ledger.state(f.first);
      assertNone(state1);
      const unregisteredPages2 = yield* f.ledger.unregisteredPages;
      expect(unregisteredPages2).toEqual([f.accepted.page.receiptId]);
      const registerPage3 = yield* f.ledger.registerPage(f.accepted.page.receiptId);
      expect(registerPage3).toBe(2);
      const registerPage4 = yield* f.ledger.registerPage(f.accepted.page.receiptId);
      expect(registerPage4).toBe(2);
      const unregisteredPages5 = yield* f.ledger.unregisteredPages;
      expect(unregisteredPages5).toEqual([]);
      const state6 = yield* f.ledger.state(f.first);
      expect(state6).toMatchObject({ _tag: "Some", value: { state: "pending", attempts: 0 } });
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/synthetic.jsonl`;
      yield* fs.writeFileString(
        path,
        '{"type":"response_item","payload":{"type":"message","content":"private-prompt"}}\ninvalid-private-line\n'
      );
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(f.salt),
          cursor: O.none(),
          maxBytes: 1024,
          maxLineBytes: 256,
          maxFrames: 4,
        })
      );
      const journal = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const receipt = yield* journal.acceptPage(page, O.none());
      const registerPage7 = yield* f.ledger.registerPage(receipt.receiptId);
      expect(registerPage7).toBe(1);
      const sql = yield* SqlClient.SqlClient;
      const events = yield* sql`SELECT event_id,receipt_id,payload_hash FROM observation_delivery_events`;
      expect(events).toHaveLength(3);
      const json = yield* encodeJsonValue(events);
      expect(json).not.toContain("private");
      expect(json).not.toContain(path);
      expect((yield* f.ledger.registerPage(id("f")).pipe(Effect.flip)).reason).toBe("unknown-page");
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("keeps every partially acknowledged event unresolved and resolves only positively evidenced events", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      yield* f.prepare("1");
      yield* f.ledger.recordOutcome(id("1"), DeliveryOutcome.cases.Partial.make({ rejectedCount: 1 }));
      for (const event of f.eventIds) {
        const state2 = yield* f.ledger.state(event);
        expect(state2).toMatchObject({
          value: { state: "unresolved", ambiguousAttempts: 1, acknowledgedAttempts: 0 },
        });
      }
      yield* f.prepare("2", [f.first]);
      yield* f.ledger.recordOutcome(id("2"), accepted);
      const state8 = yield* f.ledger.state(f.first);
      expect(state8).toMatchObject({
        value: { state: "accepted-unverified", ambiguousAttempts: 1, acknowledgedAttempts: 1 },
      });
      const state9 = yield* f.ledger.state(f.second);
      expect(state9).toMatchObject({ value: { state: "unresolved" } });
      const proof = DeliveryVisibility.make({
        eventId: f.second,
        attemptId: id("1"),
        payloadDigest: id("d"),
        observedAt: 100,
      });
      const recordVisibility10 = yield* f.ledger.recordVisibility(proof);
      expect(recordVisibility10).toEqual(proof);
      const recordVisibility11 = yield* f.ledger.recordVisibility(
        DeliveryVisibility.make({ ...proof, observedAt: 101 })
      );
      expect(recordVisibility11).toEqual(proof);
      const state12 = yield* f.ledger.state(f.second);
      expect(state12).toMatchObject({ value: { state: "visible", attempts: 1 } });
      yield* f.prepare("3", [f.first]);
      yield* f.ledger.recordOutcome(id("3"), rejected);
      const state13 = yield* f.ledger.state(f.first);
      expect(state13).toMatchObject({ value: { state: "accepted-unverified" } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("does not erase a lost acknowledgment or unfinished attempt with a later rejection", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      yield* f.prepare("1");
      yield* f.ledger.recordOutcome(id("1"), retryable);
      const state14 = yield* f.ledger.state(f.first);
      expect(state14).toMatchObject({ value: { state: "pending" } });
      yield* f.prepare("2");
      yield* f.ledger.recordOutcome(id("2"), rejected);
      const state15 = yield* f.ledger.state(f.first);
      expect(state15).toMatchObject({ value: { state: "rejected" } });
      yield* f.prepare("3");
      yield* f.ledger.recordOutcome(id("3"), unknown);
      yield* f.prepare("4");
      yield* f.ledger.recordOutcome(id("4"), rejected);
      const state16 = yield* f.ledger.state(f.first);
      expect(state16).toMatchObject({ value: { state: "unresolved", ambiguousAttempts: 1 } });
      yield* f.prepare("5");
      const reopened = yield* makeDeliveryLedger(f.intakeConfig, f.config);
      const state17 = yield* reopened.state(f.first);
      expect(state17).toMatchObject({
        value: { state: "unresolved", ambiguousAttempts: 2, attempts: 5 },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("deduplicates exact attempt and outcome writes but rejects contradictory evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      const attempt = yield* f.prepare("1");
      const prepare18 = yield* f.prepare("1", A.reverse(f.eventIds));
      expect(prepare18).toEqual(attempt);
      expect(
        (yield* f.ledger.prepareAttempt(DeliveryAttempt.make({ ...attempt, payloadDigest: id("e") })).pipe(Effect.flip))
          .reason
      ).toBe("conflict");
      expect(
        (yield* f.ledger
          .recordOutcome(id("1"), DeliveryOutcome.cases.Partial.make({ rejectedCount: 3 }))
          .pipe(Effect.flip)).reason
      ).toBe("invalid-outcome");
      yield* f.ledger.recordOutcome(id("1"), accepted);
      yield* f.ledger.recordOutcome(id("1"), accepted);
      expect((yield* f.ledger.recordOutcome(id("1"), rejected).pipe(Effect.flip)).reason).toBe("conflict");
      expect((yield* f.ledger.recordOutcome(id("f"), accepted).pipe(Effect.flip)).reason).toBe("unknown-attempt");
      expect(
        (yield* f.ledger
          .recordVisibility(
            DeliveryVisibility.make({ eventId: f.first, attemptId: id("1"), payloadDigest: id("f"), observedAt: 100 })
          )
          .pipe(Effect.flip)).reason
      ).toBe("conflict");
      const sql = yield* SqlClient.SqlClient;
      const value19 = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`;
      expect(value19).toEqual([{ n: 1 }]);
      const value20 = yield* sql`SELECT count(*) AS n FROM observation_delivery_results`;
      expect(value20).toEqual([{ n: 1 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses bounded event enrollment atomically and preserves durable input for later reconciliation", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1);
      expect((yield* f.ledger.registerPage(f.accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("capacity");
      const sql = yield* SqlClient.SqlClient;
      const value21 = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`;
      expect(value21).toEqual([{ n: 0 }]);
      const value22 = yield* sql`SELECT count(*) AS n FROM observation_delivery_pages`;
      expect(value22).toEqual([{ n: 0 }]);
      const value23 = yield* sql`SELECT count(*) AS n FROM observation_intake_pages`;
      expect(value23).toEqual([{ n: 1 }]);
      const state24 = yield* f.ledger.state(f.first);
      assertNone(state24);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("bounds attempts globally and per event while exact retries remain readable at capacity", () =>
    Effect.gen(function* () {
      const f = yield* fixture(16, 2, 1);
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      const original = yield* f.prepare("1", [f.first]);
      expect((yield* f.prepare("2", [f.first]).pipe(Effect.flip)).reason).toBe("capacity");
      expect((yield* f.prepare("3", [f.second, id("f")]).pipe(Effect.flip)).reason).toBe("unknown-event");
      yield* f.prepare("2", [f.second]);
      const prepare25 = yield* f.prepare("1", [f.first]);
      expect(prepare25).toEqual(original);
      expect((yield* f.prepare("3").pipe(Effect.flip)).reason).toBe("capacity");
      const sql = yield* SqlClient.SqlClient;
      const value26 = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`;
      expect(value26).toEqual([{ n: 2 }]);
      const value27 = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempt_events`;
      expect(value27).toEqual([{ n: 2 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back failed page enrollment and failed attempt membership without losing the original intake", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER synthetic_enrollment_failure BEFORE INSERT ON observation_delivery_pages BEGIN SELECT RAISE(ABORT,'private-fixture'); END`;
      expect((yield* f.ledger.registerPage(f.accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
      const value28 = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`;
      expect(value28).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_enrollment_failure`;
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      yield* sql`CREATE TRIGGER synthetic_attempt_failure BEFORE INSERT ON observation_delivery_attempt_events BEGIN SELECT RAISE(ABORT,'private-fixture'); END`;
      expect((yield* f.prepare("1").pipe(Effect.flip)).reason).toBe("storage");
      const value29 = yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`;
      expect(value29).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_attempt_failure`;
      yield* f.prepare("1");
      yield* sql`CREATE TRIGGER synthetic_outcome_failure BEFORE INSERT ON observation_delivery_results BEGIN SELECT RAISE(ABORT,'private-fixture'); END`;
      expect((yield* f.ledger.recordOutcome(id("1"), accepted).pipe(Effect.flip)).reason).toBe("storage");
      const state30 = yield* f.ledger.state(f.first);
      expect(state30).toMatchObject({ value: { state: "unresolved" } });
      yield* sql`DROP TRIGGER synthetic_outcome_failure`;
      yield* f.ledger.recordOutcome(id("1"), accepted);
      const state31 = yield* f.ledger.state(f.first);
      expect(state31).toMatchObject({ value: { state: "accepted-unverified" } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("fails closed on altered receipt evidence and on target or bound drift", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      yield* f.prepare("1");
      yield* f.ledger.recordOutcome(id("1"), accepted);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_delivery_results SET payload=payload || ' '`;
      expect((yield* f.ledger.state(f.first).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* f.ledger.recordOutcome(id("1"), accepted).pipe(Effect.flip)).reason).toBe("storage");
      expect(
        (yield* makeDeliveryLedger(f.intakeConfig, DeliveryLedgerConfig.make({ ...f.config, targetId: id("f") })).pipe(
          Effect.flip
        )).reason
      ).toBe("configuration");
      expect(
        (yield* makeDeliveryLedger(f.intakeConfig, DeliveryLedgerConfig.make({ ...f.config, maxAttempts: 1 })).pipe(
          Effect.flip
        )).reason
      ).toBe("configuration");
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("grants exactly one send reservation and refuses conflicting reuse", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      const attempt = DeliveryAttempt.make({ attemptId: id("e"), eventIds: f.eventIds, payloadDigest: id("d") });
      const claims = yield* Effect.forEach([0, 1, 2, 3], () => f.ledger.reserveSend(attempt), { concurrency: 4 });
      expect(A.filter(claims, (claimed) => claimed)).toHaveLength(1);
      expect(
        (yield* f.ledger.reserveSend(DeliveryAttempt.make({ ...attempt, payloadDigest: id("f") })).pipe(Effect.flip))
          .reason
      ).toBe("conflict");
      const state32 = yield* f.ledger.state(f.first);
      expect(state32).toMatchObject({ value: { state: "unresolved", attempts: 1 } });
    })
  )
);
