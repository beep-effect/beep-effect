import {
  DeliveryAttempt,
  DeliveryLedgerConfig,
  DeliveryOutcome,
  DeliveryVisibility,
  makeDeliveryLedger,
} from "@beep/repo-ai-metrics/delivery-ledger";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceBatch, NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import {
  readTranscriptPage,
  TranscriptFrame,
  TranscriptPage,
  TranscriptPageInput,
} from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver });
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const fixture = Effect.fn("ReclamationTest.fixture")(function* (
  maxPages = 2,
  maxDispositions = 4,
  expiry = false,
  maxEvents = 32
) {
  const salt = "synthetic-reclamation-salt";
  const intakeConfig = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const ledgerConfig = DeliveryLedgerConfig.make({
    targetId: id("b"),
    maxEvents,
    maxAttempts: 32,
    maxAttemptsPerEvent: 8,
  });
  const policy = PayloadRetentionPolicy.make({
    minAgeMillis: 60_000,
    minAttemptQuietMillis: 60_000,
    maxDispositions,
    expireAfterMillis: expiry === true ? O.some(86_400_000) : O.none(),
  });
  const native = yield* makeNativeIntakeJournal(intakeConfig);
  const ledger = yield* makeDeliveryLedger(intakeConfig, ledgerConfig);
  const reclaimer = yield* makePayloadReclaimer(intakeConfig, ledgerConfig, policy);
  const batch = Effect.fn("ReclamationTest.batch")(function* (digit = "1") {
    const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
      resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: Str.repeat(32)("1"), spanId: Str.repeat(16)(digit) }] }] }],
    });
    return yield* projectNativeTraceRequest(
      NativeTraceRequest.make({
        routeId: id("c"),
        hashSalt: Redacted.make(salt),
        contentType: "application/json",
        body: new TextEncoder().encode(body),
        approvedModels: [],
        usageConvention: "unknown",
      })
    );
  });
  const visible = Effect.fn("ReclamationTest.visible")(function* (
    receiptId: Sha256Hex,
    eventIds: ReadonlyArray<Sha256Hex>,
    char = "d"
  ) {
    yield* ledger.registerPage(receiptId);
    const attempt = DeliveryAttempt.make({ attemptId: id(char), eventIds, payloadDigest: id("e") });
    yield* ledger.prepareAttempt(attempt);
    for (const eventId of eventIds)
      yield* ledger.recordVisibility(
        DeliveryVisibility.make({
          eventId,
          attemptId: attempt.attemptId,
          payloadDigest: attempt.payloadDigest,
          observedAt: 0,
        })
      );
    return attempt;
  });
  return { salt, intakeConfig, ledgerConfig, policy, native, ledger, reclaimer, batch, visible };
});

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("reuses capacity while retaining replay identity and delivery facts after reopen", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1);
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      const eventIds = A.map(batch.spans, (s) => s.eventId);
      const attempt = yield* f.visible(receipt.page.receiptId, eventIds);
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      yield* TestClock.adjust("60 seconds");
      const disposition = yield* f.reclaimer.reclaim(receipt.page.receiptId);
      expect(disposition).toMatchObject({
        _tag: "Some",
        value: { reason: "backend-verified", verifiedEvents: 1, page: receipt.page },
      });
      expect(yield* f.native.stats).toEqual({ pages: 0, payloadBytes: 0, frames: 0 });
      const reopened = yield* makeNativeIntakeJournal(f.intakeConfig);
      expect(yield* reopened.acceptBatch(batch)).toEqual(receipt);
      expect((yield* reopened.readNewEvents(receipt.page.receiptId).pipe(Effect.flip)).reason).toBe("reclaimed");
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(disposition);
      expect(yield* f.ledger.prepareAttempt(attempt)).toEqual(attempt);
      expect(
        (yield* f.ledger.prepareAttempt(DeliveryAttempt.make({ ...attempt, attemptId: id("f") })).pipe(Effect.flip))
          .reason
      ).toBe("reclaimed");
      for (const eventId of eventIds)
        expect(yield* f.ledger.state(eventId)).toMatchObject({
          _tag: "Some",
          value: { state: "visible", attempts: 1 },
        });
      expect(yield* reopened.acceptBatch(yield* f.batch("2"))).toMatchObject({ newEvents: 1, page: { sequence: 2 } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("retains pending, unresolved, rejected and accepted-unverified payloads", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      yield* f.ledger.registerPage(receipt.page.receiptId);
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      const input = DeliveryAttempt.make({
        attemptId: id("d"),
        eventIds: A.map(batch.spans, (s) => s.eventId),
        payloadDigest: id("e"),
      });
      yield* f.ledger.prepareAttempt(input);
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      yield* f.ledger.recordOutcome(input.attemptId, DeliveryOutcome.cases.Rejected.make({ status: 400 }));
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      const second = DeliveryAttempt.make({ ...input, attemptId: id("f") });
      yield* f.ledger.prepareAttempt(second);
      yield* f.ledger.recordOutcome(second.attemptId, DeliveryOutcome.cases.Accepted.make({}));
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      expect((yield* f.native.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("requires original visibility for duplicate pages and preserves deduplication after reclamation", () =>
    Effect.gen(function* () {
      const f = yield* fixture(4);
      const batch = yield* f.batch();
      const first = yield* f.native.acceptBatch(batch);
      const duplicate = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans] })
      );
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(duplicate.page.receiptId)).toEqual(O.none());
      yield* f.visible(
        first.page.receiptId,
        A.map(batch.spans, (s) => s.eventId)
      );
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(duplicate.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { verifiedEvents: 1 },
      });
      yield* f.reclaimer.reclaim(first.page.receiptId);
      const replay = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans, ...batch.spans] })
      );
      expect(replay).toMatchObject({ newEvents: 0, duplicates: 3, accepted: 3 });
      expect(yield* f.native.readNewEvents(replay.page.receiptId)).toEqual(O.some([]));
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect(
    "rolls back deletion on failure and refuses policy drift, corrupt dispositions and capacity exhaustion",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(2, 1);
        const batch = yield* f.batch();
        const receipt = yield* f.native.acceptBatch(batch);
        yield* f.visible(
          receipt.page.receiptId,
          A.map(batch.spans, (s) => s.eventId)
        );
        yield* TestClock.adjust("60 seconds");
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TRIGGER disposition_failure BEFORE INSERT ON observation_page_dispositions BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`;
        expect((yield* f.reclaimer.reclaim(receipt.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
        expect(yield* f.native.readBatch(receipt.page.receiptId)).toEqual(O.some(batch));
        expect(yield* f.reclaimer.readDisposition(receipt.page.receiptId)).toEqual(O.none());
        yield* sql`DROP TRIGGER disposition_failure`;
        yield* f.reclaimer.reclaim(receipt.page.receiptId);
        expect(
          (yield* makePayloadReclaimer(
            f.intakeConfig,
            f.ledgerConfig,
            PayloadRetentionPolicy.make({ ...f.policy, maxDispositions: 2 })
          ).pipe(Effect.flip)).reason
        ).toBe("configuration");
        const secondBatch = yield* f.batch("2");
        expect(yield* f.native.acceptBatch(secondBatch).pipe(Effect.flip)).toMatchObject({ reason: "capacity" });
        expect((yield* f.native.stats).pages).toBe(0);
        // Exact acknowledged retries remain available at the reservation ceiling.
        expect(yield* f.native.acceptBatch(batch)).toEqual(receipt);
        yield* sql`UPDATE observation_page_dispositions SET payload=payload || ' ' WHERE receipt_id=${receipt.page.receiptId}`;
        expect((yield* f.native.acceptBatch(batch).pipe(Effect.flip)).reason).toBe("storage");
      })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("retains transcript cursor and historical receipt after reclaiming verified metadata", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/synthetic.jsonl`;
      yield* fs.writeFileString(path, '{"type":"response_item","payload":{"type":"message"}}\n');
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(f.salt),
          cursor: O.none(),
          maxBytes: 512,
          maxLineBytes: 256,
          maxFrames: 1,
        })
      );
      const intake = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const receipt = yield* intake.acceptPage(page, O.none());
      const ids = A.map(
        A.filter(page.frames, (frame) => frame._tag === "Accepted"),
        (frame) => frame.occurrenceId
      );
      expect(ids.length).toBe(1);
      yield* f.visible(receipt.receiptId, ids);
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(receipt.receiptId)).toMatchObject({
        _tag: "Some",
        value: { verifiedEvents: 1 },
      });
      expect(yield* intake.readCursor("codex", page.cursor.pathHash)).toEqual(O.some(page.cursor));
      expect(yield* intake.acceptPage(page, O.none())).toEqual(receipt);
      expect((yield* intake.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("waits for a recent send reservation even when an older attempt proved visibility", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      const attempt = yield* f.visible(
        receipt.page.receiptId,
        A.map(batch.spans, (s) => s.eventId)
      );
      yield* TestClock.adjust("60 seconds");
      yield* f.ledger.prepareAttempt(DeliveryAttempt.make({ ...attempt, attemptId: id("f") }));
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toEqual(O.none());
      yield* TestClock.adjust("60 seconds");
      expect(yield* f.reclaimer.reclaim(receipt.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { verifiedEvents: 1 },
      });
      for (const eventId of attempt.eventIds)
        expect(yield* f.ledger.state(eventId)).toMatchObject({
          _tag: "Some",
          value: { state: "visible", attempts: 2, ambiguousAttempts: 2 },
        });
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("refuses reclaimed replay when the retained canonical identity index is damaged", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      yield* f.visible(
        receipt.page.receiptId,
        A.map(batch.spans, (s) => s.eventId)
      );
      yield* TestClock.adjust("60 seconds");
      yield* f.reclaimer.reclaim(receipt.page.receiptId);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM observation_native_events WHERE receipt_id=${receipt.page.receiptId}`;
      expect((yield* f.native.acceptBatch(batch).pipe(Effect.flip)).reason).toBe("storage");
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect(
    "expires mixed delivery states without changing evidence and rejects expired identities in new batches",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(2, 4, true);
        const batches = yield* Effect.forEach(["1", "2", "3", "4", "5"], f.batch);
        const first = batches[0];
        if (first === undefined) return yield* Effect.die("Missing fixture");
        const batch = NativeTraceBatch.make({ ...first, spans: A.flatMap(batches, (b) => b.spans) });
        const receipt = yield* f.native.acceptBatch(batch);
        yield* f.ledger.registerPage(receipt.page.receiptId);
        for (const { span, index } of A.map(batch.spans, (span, index) => ({ span, index }))) {
          if (index === 0) continue;
          const attemptId = id(`${index}`);
          yield* f.ledger.prepareAttempt(
            DeliveryAttempt.make({ attemptId, eventIds: [span.eventId], payloadDigest: id("e") })
          );
          if (index === 1) yield* f.ledger.recordOutcome(attemptId, DeliveryOutcome.cases.Accepted.make({}));
          if (index === 2)
            yield* f.ledger.recordVisibility(
              DeliveryVisibility.make({ eventId: span.eventId, attemptId, payloadDigest: id("e"), observedAt: 0 })
            );
          if (index === 3)
            yield* f.ledger.recordOutcome(attemptId, DeliveryOutcome.cases.Rejected.make({ status: 400 }));
        }
        const states = yield* Effect.forEach(batch.spans, (s) => f.ledger.state(s.eventId));
        expect(yield* f.reclaimer.expire(receipt.page.receiptId)).toEqual(O.none());
        yield* TestClock.adjust("24 hours");
        const disposition = yield* f.reclaimer.expire(receipt.page.receiptId);
        expect(disposition).toMatchObject({
          _tag: "Some",
          value: {
            reason: "retention-expired",
            eventCount: 5,
            states: { pending: 1, acceptedUnverified: 1, visible: 1, rejected: 1, unresolved: 1 },
          },
        });
        expect(yield* Effect.forEach(batch.spans, (s) => f.ledger.state(s.eventId))).toEqual(states);
        expect(yield* f.native.receipt(receipt.page.receiptId)).toEqual(O.some(receipt));
        expect((yield* f.native.acceptBatch(batch).pipe(Effect.flip)).reason).toBe("expired");
        expect((yield* f.native.readNewEvents(receipt.page.receiptId).pipe(Effect.flip)).reason).toBe("expired");
        expect(yield* f.reclaimer.expire(receipt.page.receiptId)).toEqual(disposition);
        const fresh = yield* f.batch("6");
        const mixed = NativeTraceBatch.make({ ...fresh, spans: [...first.spans, ...fresh.spans] });
        const accepted = yield* f.native.acceptBatch(mixed);
        expect(accepted).toMatchObject({
          accepted: 1,
          rejected: 1,
          newEvents: 1,
          duplicates: 0,
          conflictIndices: [],
          expiredIndices: [0],
        });
        expect(yield* f.native.readNewEvents(accepted.page.receiptId)).toEqual(O.some(fresh.spans));
        expect(yield* f.native.acceptBatch(mixed)).toEqual(accepted);
      })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("refuses renewal of a retained duplicate page after its canonical event expires", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3, 4, true);
      const batch = yield* f.batch();
      const first = yield* f.native.acceptBatch(batch);
      const doubled = NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans] });
      const duplicate = yield* f.native.acceptBatch(doubled);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      expect((yield* f.native.acceptBatch(doubled).pipe(Effect.flip)).reason).toBe("expired");
      expect(yield* f.native.receipt(duplicate.page.receiptId)).toEqual(O.some(duplicate));
      expect(yield* f.reclaimer.expire(duplicate.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { eventCount: 1, states: { pending: 1 } },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("requires explicit expiry policy and preserves payload on failed expiry commit", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true);
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      yield* TestClock.adjust("24 hours");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER expiry_failure BEFORE INSERT ON observation_page_dispositions BEGIN SELECT RAISE(ABORT,'synthetic expiry failure'); END`;
      expect((yield* f.reclaimer.expire(receipt.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* f.native.acceptBatch(batch)).toEqual(receipt);
      expect(yield* f.native.readBatch(receipt.page.receiptId)).toEqual(O.some(batch));
      yield* sql`DROP TRIGGER expiry_failure`;
      yield* f.reclaimer.expire(receipt.page.receiptId);
      const reopened = yield* makePayloadReclaimer(f.intakeConfig, f.ledgerConfig, f.policy);
      expect(yield* reopened.readDisposition(receipt.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { reason: "retention-expired" },
      });
      expect(
        (yield* makePayloadReclaimer(
          f.intakeConfig,
          f.ledgerConfig,
          PayloadRetentionPolicy.make({ ...f.policy, expireAfterMillis: O.none() })
        ).pipe(Effect.flip)).reason
      ).toBe("configuration");
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("keeps expiry disabled by default", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const receipt = yield* f.native.acceptBatch(yield* f.batch());
      yield* TestClock.adjust("48 hours");
      expect((yield* f.reclaimer.expire(receipt.page.receiptId).pipe(Effect.flip)).reason).toBe("configuration");
      expect((yield* f.native.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("preserves the transcript cursor and refuses expired exact replay", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true);
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/expiry.jsonl`;
      yield* fs.writeFileString(path, '{"type":"response_item","payload":{"type":"message"}}\n');
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(f.salt),
          cursor: O.none(),
          maxBytes: 512,
          maxLineBytes: 256,
          maxFrames: 1,
        })
      );
      const intake = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const receipt = yield* intake.acceptPage(page, O.none());
      yield* TestClock.adjust("24 hours");
      expect(yield* f.reclaimer.expire(receipt.receiptId)).toMatchObject({
        _tag: "Some",
        value: { eventCount: 1, states: { pending: 1 } },
      });
      expect(yield* intake.readCursor("codex", page.cursor.pathHash)).toEqual(O.some(page.cursor));
      expect((yield* intake.acceptPage(page, O.none()).pipe(Effect.flip)).reason).toBe("expired");
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("delays expiry for recent attempts and retains an immutable snapshot if later visibility arrives", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true);
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      yield* f.ledger.registerPage(receipt.page.receiptId);
      yield* TestClock.adjust("24 hours");
      const span = batch.spans[0];
      if (span === undefined) return yield* Effect.die("Missing fixture span");
      const attempt = DeliveryAttempt.make({ attemptId: id("f"), eventIds: [span.eventId], payloadDigest: id("e") });
      yield* f.ledger.prepareAttempt(attempt);
      expect(yield* f.reclaimer.expire(receipt.page.receiptId)).toEqual(O.none());
      yield* TestClock.adjust("60 seconds");
      const snapshot = yield* f.reclaimer.expire(receipt.page.receiptId);
      expect(snapshot).toMatchObject({ _tag: "Some", value: { states: { unresolved: 1, visible: 0 } } });
      yield* f.ledger.recordVisibility(
        DeliveryVisibility.make({
          eventId: span.eventId,
          attemptId: attempt.attemptId,
          payloadDigest: attempt.payloadDigest,
          observedAt: 86_460_001,
        })
      );
      expect(yield* f.ledger.state(span.eventId)).toMatchObject({ _tag: "Some", value: { state: "visible" } });
      expect(yield* f.reclaimer.readDisposition(receipt.page.receiptId)).toEqual(snapshot);
      expect((yield* f.native.acceptBatch(batch).pipe(Effect.flip)).reason).toBe("expired");
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("expires a retained page without fabricating enrollment after delivery-event capacity is exhausted", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 1);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      const second = yield* f.native.acceptBatch(yield* f.batch("2"));
      expect(yield* f.ledger.registerPage(first.page.receiptId)).toBe(1);
      expect(yield* f.ledger.registerPage(second.page.receiptId).pipe(Effect.flip)).toMatchObject({
        reason: "capacity",
      });
      yield* TestClock.adjust("24 hours");
      expect(yield* f.reclaimer.expire(first.page.receiptId)).toMatchObject({ _tag: "Some" });
      expect(yield* f.reclaimer.expire(second.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: {
          eventCount: 1,
          unenrolledReferences: 1,
          unenrolledNativeOwnership: { count: 1 },
          states: { pending: 0, acceptedUnverified: 0, visible: 0, rejected: 0, unresolved: 0 },
        },
      });
      const base = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      expect((yield* base.stats).pages).toBe(0);
      expect(yield* base.readDisposition(second.page.receiptId)).toMatchObject({ _tag: "Some" });
      expect(yield* f.native.readBatch(second.page.receiptId).pipe(Effect.flip)).toMatchObject({ reason: "expired" });
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("keeps mixed enrolled and never-enrolled populations separate and refuses missing sent membership", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 1);
      const firstBatch = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(firstBatch);
      yield* f.visible(
        first.page.receiptId,
        A.map(firstBatch.spans, (s) => s.eventId)
      );
      const secondBatch = yield* f.batch("2");
      const mixed = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...secondBatch, spans: [...firstBatch.spans, ...secondBatch.spans] })
      );
      yield* TestClock.adjust("24 hours");
      const sql = yield* SqlClient.SqlClient;
      const eventId = O.getOrThrow(A.head(firstBatch.spans)).eventId;
      const membership =
        yield* sql`SELECT event_id,receipt_id,payload_hash FROM observation_delivery_events WHERE event_id=${eventId}`.pipe(
          Effect.flatMap(
            S.decodeUnknownEffect(
              S.Tuple([S.Struct({ event_id: Sha256Hex, receipt_id: Sha256Hex, payload_hash: Sha256Hex })])
            )
          )
        );
      yield* sql`DELETE FROM observation_delivery_events WHERE event_id=${eventId}`;
      expect(yield* f.reclaimer.expire(mixed.page.receiptId).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect(yield* f.native.readBatch(mixed.page.receiptId)).toMatchObject({ _tag: "Some" });
      yield* sql`INSERT INTO observation_delivery_events(event_id,receipt_id,payload_hash) VALUES(${membership[0].event_id},${membership[0].receipt_id},${membership[0].payload_hash})`;
      expect(yield* f.reclaimer.expire(mixed.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: {
          eventCount: 2,
          unenrolledReferences: 1,
          unenrolledNativeOwnership: { count: 1 },
          states: { visible: 1, pending: 0, rejected: 0, unresolved: 0, acceptedUnverified: 0 },
        },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("holds duplicate payload when its registered canonical owner has missing pending membership", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true);
      const batch = yield* f.batch();
      const owner = yield* f.native.acceptBatch(batch);
      yield* f.ledger.registerPage(owner.page.receiptId);
      const duplicate = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans] })
      );
      yield* TestClock.adjust("24 hours");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM observation_delivery_events`;
      expect(yield* f.reclaimer.expire(duplicate.page.receiptId).pipe(Effect.flip)).toMatchObject({
        reason: "storage",
      });
      expect(yield* f.native.readBatch(duplicate.page.receiptId)).toMatchObject({ _tag: "Some" });
      expect(yield* f.reclaimer.readDisposition(duplicate.page.receiptId)).toEqual(O.none());
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("does not let an early capacity refusal hide contradictory transcript identities", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 1);
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/events.jsonl`;
      yield* fs.writeFileString(path, '{"type":"response_item","payload":{"type":"message"}}\n');
      const original = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(f.salt),
          cursor: O.none(),
          maxBytes: 512,
          maxLineBytes: 256,
          maxFrames: 1,
        })
      );
      const frame = O.getOrThrow(A.head(original.frames));
      if (frame._tag !== "Accepted") return yield* Effect.die("Expected fixture frame");
      const page = TranscriptPage.make({
        ...original,
        frames: [
          frame,
          TranscriptFrame.cases.Accepted.make({ ...frame, occurrenceId: id("d") }),
          TranscriptFrame.cases.Accepted.make({ ...frame, contentHash: id("f") }),
        ],
      });
      const intake = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const receipt = yield* intake.acceptPage(page, O.none());
      expect(yield* f.ledger.registerPage(receipt.receiptId).pipe(Effect.flip)).toMatchObject({ reason: "capacity" });
      yield* TestClock.adjust("24 hours");
      expect(yield* f.reclaimer.expire(receipt.receiptId).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect((yield* intake.stats).pages).toBe(1);
      expect(yield* intake.readDisposition(receipt.receiptId)).toEqual(O.none());
    })
  )
);

it.layer(Layer.fresh(sqlLayer))((it) =>
  it.effect("refuses installation over an already overcommitted standalone journal without discarding receipts", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 2, true);
      yield* f.native.acceptBatch(yield* f.batch("1"));
      yield* f.native.acceptBatch(yield* f.batch("2"));
      const sql = yield* SqlClient.SqlClient;
      // Simulate a standalone journal that never installed a retention policy.
      yield* sql`DROP TABLE observation_reclamation_config`;
      expect(
        yield* makePayloadReclaimer(
          f.intakeConfig,
          f.ledgerConfig,
          PayloadRetentionPolicy.make({ ...f.policy, maxDispositions: 1 })
        ).pipe(Effect.flip)
      ).toMatchObject({ reason: "capacity" });
      expect((yield* f.native.stats).pages).toBe(2);
      expect(yield* sql`SELECT name FROM sqlite_master WHERE name='observation_reclamation_config'`).toHaveLength(0);
    })
  )
);
