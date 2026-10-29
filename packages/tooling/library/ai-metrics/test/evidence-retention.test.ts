import {
  DeliveryAttempt,
  DeliveryLedgerConfig,
  DeliveryOutcome,
  DeliveryVisibility,
  makeDeliveryLedger,
} from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceRetentionPolicy, makeEvidenceRetention } from "@beep/repo-ai-metrics/evidence-retention";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceBatch, NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
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
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const fixture = Effect.fn("EvidenceRetentionTest.fixture")(function* (
  maxPages = 2,
  maxDispositions = 4,
  expiry = false,
  maxRecords = 64,
  maxRecoveryRows = 4096,
  maxRecoveryBytes = 16777216,
  maxEvents = 64
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
    maxAttempts: 64,
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
  const batch = Effect.fn("EvidenceRetentionTest.batch")(function* (digit = "1") {
    const body = yield* encodeJsonValue({
      resourceSpans: [
        {
          scopeSpans: [
            { spans: [{ traceId: Str.repeat(32)("1"), spanId: digit.length === 16 ? digit : Str.repeat(16)(digit) }] },
          ],
        },
      ],
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
  const visible = Effect.fn("EvidenceRetentionTest.visible")(function* (
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
  const retentionPolicy = EvidenceRetentionPolicy.make({
    minEpochMillis: 60_000,
    minAttemptQuietMillis: 60_000,
    maxRecords,
    maxRecoveryRows,
    maxRecoveryBytes,
    deadlineMillis: 10000,
  });
  const retention = yield* makeEvidenceRetention(intakeConfig, ledgerConfig, retentionPolicy);
  return {
    salt,
    intakeConfig,
    ledgerConfig,
    policy,
    native,
    ledger,
    reclaimer,
    batch,
    visible,
    retention,
    retentionPolicy,
  };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect(
    "retires verified evidence atomically, reuses ledger capacity and explicitly scopes native replay to a new epoch",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(1, 1);
        const batch = yield* f.batch();
        const original = yield* f.native.acceptBatch(batch);
        yield* f.visible(
          original.page.receiptId,
          A.map(batch.spans, (s) => s.eventId)
        );
        assertNone(yield* f.retention.seal(0));
        yield* TestClock.adjust("60 seconds");
        assertNone(yield* f.retention.seal(0));
        yield* f.reclaimer.reclaim(original.page.receiptId);
        const sealed = yield* f.retention.seal(0);
        expect(sealed).toMatchObject({
          _tag: "Some",
          value: {
            record: {
              epoch: 0,
              totals: {
                pages: 1,
                visible: 1,
                eventObservations: 1,
                attempts: 1,
                nativeAcceptedOccurrences: 1,
                verifiedPages: 1,
                expiredPages: 0,
              },
            },
          },
        });
        expect(yield* f.retention.seal(0)).toEqual(sealed);
        assertNone(yield* f.native.receipt(original.page.receiptId));
        const current = yield* f.retention.window;
        expect(current).toMatchObject({ epoch: 1, totals: { visible: 1, eventObservations: 1 } });
        const observedAgain = yield* f.native.acceptBatch(batch);
        expect(observedAgain.page.receiptId).not.toBe(original.page.receiptId);
        expect(observedAgain.page.evidenceEpoch).toBe(1);
        assertSome(yield* f.native.readNewEvents(observedAgain.page.receiptId), batch.spans);
        const reopened = yield* makeNativeIntakeJournal(f.intakeConfig);
        expect(yield* reopened.acceptBatch(batch)).toEqual(observedAgain);
        yield* f.visible(
          observedAgain.page.receiptId,
          A.map(batch.spans, (s) => s.eventId)
        );
        yield* TestClock.adjust("60 seconds");
        yield* f.reclaimer.reclaim(observedAgain.page.receiptId);
        const next = yield* f.retention.seal(1);
        assertTrue(O.isSome(next));
        expect(next.value.record.epoch).toBe(1);
        assertTrue(O.isSome(sealed));
        assertSome(next.value.record.previousDigest, sealed.value.digest);
        expect(yield* f.retention.window).toMatchObject({
          epoch: 2,
          totals: { visible: 2, eventObservations: 2, pages: 2 },
        });
        expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("conflict");
        const sql = yield* SqlClient.SqlClient;
        expect(yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery`).toEqual([{ n: 1 }]);
        expect(yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`).toEqual([{ n: 8 }]);
      })
  )
);
const decodeIdRecordRows = S.decodeUnknownEffect(S.Array(S.Struct({ id: Sha256Hex })));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("retains all five retired state counts and keeps current absence distinct from prior evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture(8, 8, true);
      const register = Effect.fnUntraced(function* (digit: string) {
        const batch = yield* f.batch(digit);
        const receipt = yield* f.native.acceptBatch(batch);
        yield* f.ledger.registerPage(receipt.page.receiptId);
        return O.getOrThrow(A.head(batch.spans)).eventId;
      });
      const prepare = Effect.fnUntraced(function* (digit: string) {
        const eventId = yield* register(digit);
        const attemptId = id(digit);
        yield* f.ledger.prepareAttempt(
          DeliveryAttempt.make({ attemptId, eventIds: [eventId], payloadDigest: id("e") })
        );
        return DeliveryVisibility.make({ eventId, attemptId, payloadDigest: id("e"), observedAt: 0 });
      });
      yield* register("1"); // Pending: admitted without a delivery attempt.
      const accepted = yield* prepare("2");
      yield* f.ledger.recordOutcome(accepted.attemptId, DeliveryOutcome.cases.Accepted.make({}));
      const visible = yield* prepare("3");
      yield* f.ledger.recordVisibility(visible);
      const rejected = yield* prepare("4");
      yield* f.ledger.recordOutcome(rejected.attemptId, DeliveryOutcome.cases.Rejected.make({ status: 400 }));
      yield* prepare("5"); // Unresolved: prepared without a terminal outcome.
      yield* TestClock.adjust("24 hours");
      const sql = yield* SqlClient.SqlClient;
      const pages = yield* sql`SELECT receipt_id AS id FROM observation_intake_pages`.pipe(
        Effect.flatMap(decodeIdRecordRows)
      );
      for (const page of pages) yield* f.reclaimer.expire(page.id);
      expect(yield* f.retention.seal(0)).toMatchObject({
        _tag: "Some",
        value: {
          record: {
            totals: {
              pending: 1,
              acceptedUnverified: 1,
              visible: 1,
              rejected: 1,
              unresolved: 1,
              eventObservations: 5,
              expiredPages: 5,
            },
          },
        },
      });
      expect(yield* f.retention.window).toMatchObject({
        epoch: 1,
        totals: { pending: 1, acceptedUnverified: 1, visible: 1, rejected: 1, unresolved: 1 },
      });
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_events`).toEqual([{ n: 0 }]);
      expect(yield* sql`PRAGMA integrity_check`).toEqual([{ integrity_check: "ok" }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("restores detailed evidence if the window checkpoint write fails", () =>
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
      yield* sql`CREATE TRIGGER window_failure BEFORE UPDATE ON observation_evidence_window BEGIN SELECT RAISE(ABORT,'synthetic checkpoint failure'); END`;
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* f.retention.window).epoch).toBe(0);
      expect(yield* f.native.acceptBatch(batch)).toEqual(receipt);
      for (const span of batch.spans)
        expect(yield* f.ledger.state(span.eventId)).toMatchObject({ _tag: "Some", value: { state: "visible" } });
      yield* sql`DROP TRIGGER window_failure`;
      expect(yield* f.retention.seal(0)).toMatchObject({ _tag: "Some", value: { record: { epoch: 0 } } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("preserves transcript progress and verifies content addresses after a window transition", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/events.jsonl`;
      const line = '{"type":"response_item","payload":{"type":"message"}}\n';
      yield* fs.writeFileString(path, line);
      const intake = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const input = TranscriptPageInput.make({
        path,
        source: "codex",
        hashSalt: Redacted.make(f.salt),
        cursor: O.none(),
        maxBytes: 512,
        maxLineBytes: 256,
        maxFrames: 1,
      });
      const page = yield* readTranscriptPage(input);
      const receipt = yield* intake.acceptPage(page, O.none());
      const ids = A.map(
        A.filter(page.frames, (f) => f._tag === "Accepted"),
        (f) => f.occurrenceId
      );
      yield* f.visible(receipt.receiptId, ids);
      yield* TestClock.adjust("60 seconds");
      yield* f.reclaimer.reclaim(receipt.receiptId);
      yield* f.retention.seal(0);
      assertSome(yield* intake.readCursor("codex", page.cursor.pathHash), page.cursor);
      expect((yield* intake.acceptPage(page, O.none()).pipe(Effect.flip)).reason).toBe("stale-cursor");
      yield* fs.writeFileString(path, line + line);
      const second = yield* readTranscriptPage(TranscriptPageInput.make({ ...input, cursor: O.some(page.cursor) }));
      const accepted = yield* intake.acceptPage(second, O.some(page.cursor));
      expect(accepted.evidenceEpoch).toBe(1);
      yield* f.ledger.registerPage(accepted.receiptId);
      expect((yield* f.retention.window).totals.transcriptFrameOccurrences).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses corrupt checkpoints and immutable retention-policy drift", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(
        (yield* makeEvidenceRetention(
          f.intakeConfig,
          f.ledgerConfig,
          EvidenceRetentionPolicy.make({ ...f.retentionPolicy, maxRecords: 16 })
        ).pipe(Effect.flip)).reason
      ).toBe("configuration");
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_evidence_window SET payload=payload || ' '`;
      expect((yield* f.native.acceptBatch(yield* f.batch()).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* f.native.stats).pages).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("accounts for N+1 records across bounded query pages", () =>
    Effect.gen(function* () {
      const f = yield* fixture(40, 40, true);
      const receipts = [];
      for (let index = 1; index <= 33; index += 1) {
        const spanId = Str.padStart(16, "0")(index.toString(16));
        receipts.push(yield* f.native.acceptBatch(yield* f.batch(spanId)));
      }
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) yield* f.reclaimer.expire(receipt.page.receiptId);
      const sealed = yield* f.retention.seal(0);
      expect(sealed).toMatchObject({
        _tag: "Some",
        value: { record: { totals: { pages: 33, pending: 33, eventObservations: 33, nativeAcceptedOccurrences: 33 } } },
      });
      expect(yield* f.retention.restore(O.getOrThrow(sealed).digest)).toBe("restored");
      for (const receipt of receipts) assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses a retirement above its work bound without deleting evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 1);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      const second = yield* f.native.acceptBatch(yield* f.batch("2"));
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.reclaimer.expire(second.page.receiptId);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("capacity");
      assertSome(yield* f.native.receipt(first.page.receiptId), first);
      expect((yield* f.retention.window).epoch).toBe(0);
    })
  )
);
const isStringRows = S.is(S.Array(S.String));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back an interrupted retirement at its bounded deadline", () =>
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
      const boundary = yield* Deferred.make<void>();
      const proxy = new Proxy(sql, {
        apply(target, receiver, parameters) {
          const fragments: unknown = parameters[0];
          if (
            isStringRows(fragments) &&
            Str.includes("DELETE FROM observation_delivery_visibility")(fragments[0] ?? "")
          )
            return Deferred.succeed(boundary, undefined).pipe(Effect.andThen(Effect.never));
          return Reflect.apply(target, receiver, parameters);
        },
      });
      const guarded = yield* makeEvidenceRetention(f.intakeConfig, f.ledgerConfig, f.retentionPolicy).pipe(
        Effect.provideService(SqlClient.SqlClient, proxy)
      );
      const running = yield* guarded.seal(0).pipe(Effect.forkChild);
      yield* Deferred.await(boundary);
      yield* TestClock.adjust("10 seconds");
      expect((yield* Fiber.join(running).pipe(Effect.flip)).reason).toBe("deadline");
      expect((yield* f.retention.window).epoch).toBe(0);
      expect(yield* f.native.acceptBatch(batch)).toEqual(receipt);
      for (const span of batch.spans)
        expect(yield* f.ledger.state(span.eventId)).toMatchObject({ _tag: "Some", value: { state: "visible" } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("restores all compact facts and the predecessor window after reopening, with idempotent recovery", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      const attempt = yield* f.visible(
        receipt.page.receiptId,
        A.map(batch.spans, (s) => s.eventId)
      );
      yield* f.ledger.recordOutcome(attempt.attemptId, DeliveryOutcome.cases.Accepted.make({}));
      yield* TestClock.adjust("60 seconds");
      yield* f.reclaimer.reclaim(receipt.page.receiptId);
      const before = yield* f.retention.window;
      const sql = yield* SqlClient.SqlClient;
      // Retention must preserve auxiliary query reservations in its logical
      // recovery snapshot, then release their capacity with the retired epoch.
      const eventId = O.getOrThrow(A.head(batch.spans)).eventId;
      yield* sql`INSERT INTO observation_delivery_queries(event_id,attempt_id,query_count,recorded_at,digest) VALUES(${eventId},${attempt.attemptId},3,100,${id("f")})`;
      const queries = yield* sql`SELECT * FROM observation_delivery_queries`;
      const outcomes = yield* sql`SELECT * FROM observation_delivery_results`;
      const memberships = yield* sql`SELECT * FROM observation_delivery_attempt_events`;
      const reservations = yield* sql`SELECT * FROM observation_delivery_attempts`;
      const base = yield* makeTranscriptIntakeJournal(f.intakeConfig);
      const disposition = yield* base.readDisposition(receipt.page.receiptId);
      const sealed = O.getOrThrow(yield* f.retention.seal(0));
      expect(yield* sql`SELECT * FROM observation_delivery_queries`).toHaveLength(0);
      const reopened = yield* makeEvidenceRetention(f.intakeConfig, f.ledgerConfig, f.retentionPolicy);
      expect(yield* reopened.restore(sealed.digest)).toBe("restored");
      expect(yield* sql`SELECT * FROM observation_delivery_queries`).toEqual(queries);
      expect(yield* reopened.window).toEqual(before);
      assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
      expect(yield* base.readDisposition(receipt.page.receiptId)).toEqual(disposition);
      expect(yield* f.ledger.state(O.getOrThrow(A.head(batch.spans)).eventId)).toMatchObject({
        _tag: "Some",
        value: { state: "visible" },
      });
      expect(yield* sql`SELECT * FROM observation_delivery_results`).toEqual(outcomes);
      expect(yield* sql`SELECT * FROM observation_delivery_attempt_events`).toEqual(memberships);
      expect(yield* sql`SELECT * FROM observation_delivery_attempts`).toEqual(reservations);
      const newer = yield* f.native.acceptBatch(yield* f.batch("2"));
      expect(yield* reopened.restore(sealed.digest)).toBe("already-restored");
      assertSome(yield* f.native.receipt(newer.page.receiptId), newer);
      expect((yield* reopened.restore(id("f")).pipe(Effect.flip)).reason).toBe("conflict");
      expect(yield* sql`PRAGMA integrity_check`).toEqual([{ integrity_check: "ok" }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses restore after newer admission and preserves the new receipt and recovery copy", () =>
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
      const sealed = O.getOrThrow(yield* f.retention.seal(0));
      const newer = yield* f.native.acceptBatch(yield* f.batch("2"));
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("conflict");
      assertSome(yield* f.native.receipt(newer.page.receiptId), newer);
      expect(yield* f.retention.window).toMatchObject({ epoch: 1 });
      const sql = yield* SqlClient.SqlClient;
      const snapshot = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      // Even absent current facts cannot conceal an intervening accepted page.
      yield* sql`DELETE FROM observation_intake_pages`;
      yield* sql`DELETE FROM observation_native_events`;
      yield* sql`DELETE FROM observation_native_receipts`;
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("conflict");
      expect(yield* sql`SELECT payload,digest FROM observation_evidence_recovery`).toEqual(snapshot);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back a partially restored copy when the final row checksum is damaged", () =>
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
      const sealed = O.getOrThrow(yield* f.retention.seal(0));
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_evidence_recovery_rows SET digest=${id("f")} WHERE ordinal=(SELECT MAX(ordinal) FROM observation_evidence_recovery_rows)`;
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* f.retention.window).toMatchObject({ epoch: 1 });
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_visibility`).toEqual([{ n: 0 }]);
      assertNone(yield* f.native.receipt(receipt.page.receiptId));
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses retirement when the recovery row budget cannot retain all facts", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, false, 64, 1);
      const batch = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch);
      yield* f.visible(
        receipt.page.receiptId,
        A.map(batch.spans, (s) => s.eventId)
      );
      yield* TestClock.adjust("60 seconds");
      yield* f.reclaimer.reclaim(receipt.page.receiptId);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("capacity");
      assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
      expect(yield* f.retention.window).toMatchObject({ epoch: 0 });
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`).toEqual([{ n: 0 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("preserves the previous recovery generation when the next snapshot exceeds its bound", () =>
    Effect.gen(function* () {
      const f = yield* fixture(4, 4, true, 64, 8);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.retention.seal(0);
      const sql = yield* SqlClient.SqlClient;
      const snapshot = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      const rows = yield* sql`SELECT * FROM observation_evidence_recovery_rows ORDER BY ordinal`;
      const second = yield* f.native.acceptBatch(yield* f.batch("2"));
      const third = yield* f.native.acceptBatch(yield* f.batch("3"));
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(second.page.receiptId);
      yield* f.reclaimer.expire(third.page.receiptId);
      expect((yield* f.retention.seal(1).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* f.retention.window).toMatchObject({ epoch: 1 });
      expect(yield* sql`SELECT payload,digest FROM observation_evidence_recovery`).toEqual(snapshot);
      expect(yield* sql`SELECT * FROM observation_evidence_recovery_rows ORDER BY ordinal`).toEqual(rows);
      assertSome(yield* f.native.receipt(second.page.receiptId), second);
      assertSome(yield* f.native.receipt(third.page.receiptId), third);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses retirement when the recovery byte budget is exhausted", () =>
    Effect.gen(function* () {
      const f = yield* fixture(8, 8, true, 64, 4096, 4096);
      const receipts = [];
      for (const digit of ["1", "2", "3", "4"]) receipts.push(yield* f.native.acceptBatch(yield* f.batch(digit)));
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) yield* f.reclaimer.expire(receipt.page.receiptId);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* f.retention.window).toMatchObject({ epoch: 0 });
      for (const receipt of receipts) assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back a restore deadline after rows have been inserted and permits retry", () =>
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
      const sealed = O.getOrThrow(yield* f.retention.seal(0));
      const sql = yield* SqlClient.SqlClient;
      const boundary = yield* Deferred.make<void>();
      const proxy = new Proxy(sql, {
        apply(target, receiver, parameters) {
          const fragments: unknown = parameters[0];
          if (isStringRows(fragments) && Str.includes("UPDATE observation_evidence_window")(fragments[0] ?? ""))
            return Deferred.succeed(boundary, undefined).pipe(Effect.andThen(Effect.never));
          return Reflect.apply(target, receiver, parameters);
        },
      });
      const guarded = yield* makeEvidenceRetention(f.intakeConfig, f.ledgerConfig, f.retentionPolicy).pipe(
        Effect.provideService(SqlClient.SqlClient, proxy)
      );
      const running = yield* guarded.restore(sealed.digest).pipe(Effect.forkChild);
      yield* Deferred.await(boundary);
      yield* TestClock.adjust("10 seconds");
      expect((yield* Fiber.join(running).pipe(Effect.flip)).reason).toBe("deadline");
      expect(yield* f.retention.window).toMatchObject({ epoch: 1 });
      expect(yield* sql`SELECT count(*) AS n FROM observation_delivery_events`).toEqual([{ n: 0 }]);
      expect(yield* f.retention.restore(sealed.digest)).toBe("restored");
      assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
    })
  )
);
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ page_count: S.Natural })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses retirement atomically when SQLite cannot allocate the recovery copy", () =>
    Effect.gen(function* () {
      const f = yield* fixture(40, 40, true);
      const receipts = [];
      for (let index = 1; index <= 33; index += 1)
        receipts.push(yield* f.native.acceptBatch(yield* f.batch(Str.padStart(16, "0")(index.toString(16)))));
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) yield* f.reclaimer.expire(receipt.page.receiptId);
      const sql = yield* SqlClient.SqlClient;
      // Remove free pages and inject a physical allocation ceiling at current size.
      yield* sql`VACUUM`;
      const count = yield* sql`PRAGMA page_count`.pipe(Effect.flatMap(decodeArguments));
      yield* sql.unsafe(`PRAGMA max_page_count = ${count[0].page_count}`);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* f.retention.window).toMatchObject({ epoch: 0 });
      for (const receipt of receipts) assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
      expect(yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`).toEqual([{ n: 0 }]);
      expect(yield* sql`PRAGMA integrity_check`).toEqual([{ integrity_check: "ok" }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect(
    "expires an oversized first batch, retires never-enrolled ownership and restores exact compact evidence",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(2, 4, true, 64, 4096, 16777216, 1);
        const one = yield* f.batch("1");
        const two = yield* f.batch("2");
        const batch = NativeTraceBatch.make({ ...one, spans: [...one.spans, ...two.spans] });
        const receipt = yield* f.native.acceptBatch(batch);
        expect(yield* f.ledger.registerPage(receipt.page.receiptId).pipe(Effect.flip)).toMatchObject({
          reason: "capacity",
        });
        yield* TestClock.adjust("24 hours");
        const disposition = yield* f.reclaimer.expire(receipt.page.receiptId);
        expect(disposition).toMatchObject({
          _tag: "Some",
          value: { unenrolledReferences: 2, unenrolledNativeOwnership: { count: 2 }, states: { pending: 0 } },
        });
        const sql = yield* SqlClient.SqlClient;
        const index = yield* sql`SELECT * FROM observation_native_events ORDER BY event_id`;
        const sealed = O.getOrThrow(yield* f.retention.seal(0));
        expect(sealed.record.totals).toMatchObject({
          eventObservations: 0,
          unenrolledReferences: 2,
          unenrolledNativeEvents: 2,
          pending: 0,
          expiredPages: 1,
        });
        expect(yield* sql`SELECT * FROM observation_native_events`).toHaveLength(0);
        expect(yield* f.retention.restore(sealed.digest)).toBe("restored");
        expect(yield* sql`SELECT * FROM observation_native_events ORDER BY event_id`).toEqual(index);
        const base = yield* makeTranscriptIntakeJournal(f.intakeConfig);
        expect(yield* base.readDisposition(receipt.page.receiptId)).toEqual(disposition);
      })
  )
);
const decodeArguments2 = S.decodeUnknownEffect(S.Tuple([S.Struct({ hash: Sha256Hex })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("counts duplicate never-enrolled references separately and refuses index corruption before seal", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3, 4, true, 64, 4096, 16777216, 1);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      yield* f.ledger.registerPage(first.page.receiptId);
      const batch = yield* f.batch("2");
      const owner = yield* f.native.acceptBatch(batch);
      const duplicate = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans] })
      );
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.reclaimer.expire(owner.page.receiptId);
      expect(yield* f.reclaimer.expire(duplicate.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 1 },
      });
      const sql = yield* SqlClient.SqlClient;
      const original =
        yield* sql`SELECT payload_hash AS hash FROM observation_native_events WHERE receipt_id=${owner.page.receiptId}`.pipe(
          Effect.flatMap(decodeArguments2)
        );
      yield* sql`UPDATE observation_native_events SET payload_hash=${id("f")} WHERE receipt_id=${owner.page.receiptId}`;
      expect(yield* f.retention.seal(0).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect((yield* f.retention.window).epoch).toBe(0);
      yield* sql`UPDATE observation_native_events SET payload_hash=${original[0].hash} WHERE receipt_id=${owner.page.receiptId}`;
      expect(yield* f.retention.seal(0)).toMatchObject({
        _tag: "Some",
        value: {
          record: {
            totals: {
              eventObservations: 1,
              pending: 1,
              unenrolledReferences: 2,
              unenrolledNativeEvents: 1,
              expiredPages: 3,
            },
          },
        },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("reserves disposition capacity before native admission and releases it only after seal", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1, 1, true);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      const next = yield* f.batch("2");
      expect(yield* f.native.acceptBatch(next).pipe(Effect.flip)).toMatchObject({ reason: "capacity" });
      expect(yield* f.retention.seal(0)).toMatchObject({ _tag: "Some" });
      expect((yield* f.native.acceptBatch(next)).newEvents).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("expires never-enrolled transcript references and preserves the accepted source cursor", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 64, 4096, 16777216, 1);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      yield* f.ledger.registerPage(first.page.receiptId);
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/events.jsonl`;
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
      yield* f.reclaimer.expire(first.page.receiptId);
      expect(yield* f.reclaimer.expire(receipt.receiptId)).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 1, states: { pending: 0 } },
      });
      expect(yield* f.retention.seal(0)).toMatchObject({
        _tag: "Some",
        value: {
          record: {
            totals: {
              eventObservations: 1,
              unenrolledReferences: 1,
              unenrolledNativeEvents: 0,
              transcriptFrameOccurrences: 1,
            },
          },
        },
      });
      assertSome(yield* intake.readCursor("codex", page.cursor.pathHash), page.cursor);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses transcript admission without advancing its cursor when terminal capacity is full", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 1, true);
      const first = yield* f.native.acceptBatch(yield* f.batch("1"));
      const fs = yield* FileSystem.FileSystem;
      const path = `${yield* fs.makeTempDirectoryScoped()}/events.jsonl`;
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
      expect(yield* intake.acceptPage(page, O.none()).pipe(Effect.flip)).toMatchObject({ reason: "capacity" });
      assertNone(yield* intake.readCursor("codex", page.cursor.pathHash));
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.retention.seal(0);
      expect((yield* intake.acceptPage(page, O.none())).evidenceEpoch).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("holds retired payload evidence if registered membership is corrupted after expiry", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1, 2, true);
      const receipt = yield* f.native.acceptBatch(yield* f.batch());
      yield* f.ledger.registerPage(receipt.page.receiptId);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(receipt.page.receiptId);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM observation_delivery_events`;
      expect(yield* f.retention.seal(0).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect((yield* f.retention.window).epoch).toBe(0);
      assertSome(yield* f.native.receipt(receipt.page.receiptId), receipt);
    })
  )
);
const decodeArguments3 = S.decodeUnknownEffect(
  S.Tuple([S.Struct({ event_id: Sha256Hex, receipt_id: Sha256Hex, payload_hash: Sha256Hex })])
);
const decodeArguments4 = S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect(
    "detects lost pending transcript membership after disposal and preserves readable legacy dispositions",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture(2, 4, true);
        const fs = yield* FileSystem.FileSystem;
        const path = `${yield* fs.makeTempDirectoryScoped()}/events.jsonl`;
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
        yield* f.ledger.registerPage(receipt.receiptId);
        yield* TestClock.adjust("24 hours");
        yield* f.reclaimer.expire(receipt.receiptId);
        const sql = yield* SqlClient.SqlClient;
        const [member] = yield* sql`SELECT event_id,receipt_id,payload_hash FROM observation_delivery_events`.pipe(
          Effect.flatMap(decodeArguments3)
        );
        yield* sql`DELETE FROM observation_delivery_events`;
        expect(yield* f.retention.seal(0).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
        expect((yield* f.retention.window).epoch).toBe(0);
        yield* sql`INSERT INTO observation_delivery_events(event_id,receipt_id,payload_hash) VALUES(${member.event_id},${member.receipt_id},${member.payload_hash})`;
        const [legacy] =
          yield* sql`SELECT json_remove(payload,'$.enrolledOwnership') AS payload FROM observation_page_dispositions WHERE receipt_id=${receipt.receiptId}`.pipe(
            Effect.flatMap(decodeArguments4)
          );
        yield* sql`UPDATE observation_page_dispositions SET payload=${legacy.payload},digest=${yield* hashPublicTextSha256(legacy.payload)} WHERE receipt_id=${receipt.receiptId}`;
        expect(yield* intake.readDisposition(receipt.receiptId)).toMatchObject({
          _tag: "Some",
          value: { states: { pending: 1 } },
        });
        expect(yield* f.retention.seal(0).pipe(Effect.flip)).toMatchObject({ reason: "configuration" });
        expect((yield* f.retention.window).epoch).toBe(0);
      })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("attempts registration once per owner while expiring a larger un-enrollable batch", () =>
    Effect.gen(function* () {
      const f = yield* fixture(1, 2, true, 64, 4096, 16777216, 1);
      const batches = yield* Effect.forEach(A.range(1, 32), (n) => f.batch(Str.padStart(16, "0")(n.toString(16))));
      const first = O.getOrThrow(A.head(batches));
      const receipt = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...first, spans: A.flatMap(batches, (b) => b.spans) })
      );
      yield* TestClock.adjust("24 hours");
      const sql = yield* SqlClient.SqlClient;
      let registrationReads = 0;
      const proxy = new Proxy(sql, {
        apply(target, receiver, parameters) {
          const fragments: unknown = parameters[0];
          if (
            isStringRows(fragments) &&
            Str.startsWith("SELECT events FROM observation_delivery_pages WHERE receipt_id=")(fragments[0] ?? "")
          )
            registrationReads += 1;
          return Reflect.apply(target, receiver, parameters);
        },
      });
      const guarded = yield* makePayloadReclaimer(
        f.intakeConfig,
        f.ledgerConfig,
        PayloadRetentionPolicy.make({
          minAgeMillis: 60000,
          minAttemptQuietMillis: 60000,
          maxDispositions: 2,
          expireAfterMillis: O.some(86400000),
        })
      ).pipe(Effect.provideService(SqlClient.SqlClient, proxy));
      expect(yield* guarded.expire(receipt.page.receiptId)).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 32, unenrolledNativeOwnership: { count: 32 } },
      });
      // One registration lookup and one independent cached-page integrity lookup.
      expect(registrationReads).toBe(2);
    })
  )
);
