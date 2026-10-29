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
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
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

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver });
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
  if (first === undefined || second === undefined) return yield* Effect.die("Invalid synthetic fixture");
  return { ledger, intakeConfig, config, accepted, first, second, prepare, salt, eventIds };
});
const accepted = DeliveryOutcome.cases.Accepted.make({});
const retryable = DeliveryOutcome.cases.Retryable.make({ status: 503 });
const rejected = DeliveryOutcome.cases.Rejected.make({ status: 400 });
const unknown = DeliveryOutcome.cases.Unknown.make({ reason: "timed-out" });

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("registers verified canonical native and transcript events while excluding malformed frames", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      assertNone(yield* f.ledger.state(f.first));
      expect(yield* f.ledger.unregisteredPages).toEqual([f.accepted.page.receiptId]);
      expect(yield* f.ledger.registerPage(f.accepted.page.receiptId)).toBe(2);
      expect(yield* f.ledger.registerPage(f.accepted.page.receiptId)).toBe(2);
      expect(yield* f.ledger.unregisteredPages).toEqual([]);
      expect(yield* f.ledger.state(f.first)).toMatchObject({ _tag: "Some", value: { state: "pending", attempts: 0 } });
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
      expect(yield* f.ledger.registerPage(receipt.receiptId)).toBe(1);
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
      for (const event of f.eventIds)
        expect(yield* f.ledger.state(event)).toMatchObject({
          value: { state: "unresolved", ambiguousAttempts: 1, acknowledgedAttempts: 0 },
        });
      yield* f.prepare("2", [f.first]);
      yield* f.ledger.recordOutcome(id("2"), accepted);
      expect(yield* f.ledger.state(f.first)).toMatchObject({
        value: { state: "accepted-unverified", ambiguousAttempts: 1, acknowledgedAttempts: 1 },
      });
      expect(yield* f.ledger.state(f.second)).toMatchObject({ value: { state: "unresolved" } });
      const proof = DeliveryVisibility.make({
        eventId: f.second,
        attemptId: id("1"),
        payloadDigest: id("d"),
        observedAt: 100,
      });
      expect(yield* f.ledger.recordVisibility(proof)).toEqual(proof);
      expect(yield* f.ledger.recordVisibility(DeliveryVisibility.make({ ...proof, observedAt: 101 }))).toEqual(proof);
      expect(yield* f.ledger.state(f.second)).toMatchObject({ value: { state: "visible", attempts: 1 } });
      yield* f.prepare("3", [f.first]);
      yield* f.ledger.recordOutcome(id("3"), rejected);
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "accepted-unverified" } });
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
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "pending" } });
      yield* f.prepare("2");
      yield* f.ledger.recordOutcome(id("2"), rejected);
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "rejected" } });
      yield* f.prepare("3");
      yield* f.ledger.recordOutcome(id("3"), unknown);
      yield* f.prepare("4");
      yield* f.ledger.recordOutcome(id("4"), rejected);
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "unresolved", ambiguousAttempts: 1 } });
      yield* f.prepare("5");
      const reopened = yield* makeDeliveryLedger(f.intakeConfig, f.config);
      expect(yield* reopened.state(f.first)).toMatchObject({
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
      expect(yield* f.prepare("1", A.reverse(f.eventIds))).toEqual(attempt);
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
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`).toEqual([{ n: 1 }]);
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_results`).toEqual([{ n: 1 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses bounded event enrollment atomically and preserves durable input for later reconciliation", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1);
      expect((yield* f.ledger.registerPage(f.accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("capacity");
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_events`).toEqual([{ n: 0 }]);
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_pages`).toEqual([{ n: 0 }]);
      expect(yield* sql`SELECT count(*) AS n FROM observation_intake_pages`).toEqual([{ n: 1 }]);
      assertNone(yield* f.ledger.state(f.first));
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
      expect(yield* f.prepare("1", [f.first])).toEqual(original);
      expect((yield* f.prepare("3").pipe(Effect.flip)).reason).toBe("capacity");
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`).toEqual([{ n: 2 }]);
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_attempt_events`).toEqual([{ n: 2 }]);
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
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_events`).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_enrollment_failure`;
      yield* f.ledger.registerPage(f.accepted.page.receiptId);
      yield* sql`CREATE TRIGGER synthetic_attempt_failure BEFORE INSERT ON observation_delivery_attempt_events BEGIN SELECT RAISE(ABORT,'private-fixture'); END`;
      expect((yield* f.prepare("1").pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_attempts`).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_attempt_failure`;
      yield* f.prepare("1");
      yield* sql`CREATE TRIGGER synthetic_outcome_failure BEFORE INSERT ON observation_delivery_results BEGIN SELECT RAISE(ABORT,'private-fixture'); END`;
      expect((yield* f.ledger.recordOutcome(id("1"), accepted).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "unresolved" } });
      yield* sql`DROP TRIGGER synthetic_outcome_failure`;
      yield* f.ledger.recordOutcome(id("1"), accepted);
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "accepted-unverified" } });
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
      expect(yield* f.ledger.state(f.first)).toMatchObject({ value: { state: "unresolved", attempts: 1 } });
    })
  )
);
