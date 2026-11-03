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
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
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

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
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
    for (const eventId of eventIds) {
      yield* ledger.recordVisibility(
        DeliveryVisibility.make({
          eventId,
          attemptId: attempt.attemptId,
          payloadDigest: attempt.payloadDigest,
          observedAt: 0,
        })
      );
    }
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
        const seal1 = yield* f.retention.seal(0);
        assertNone(seal1);
        yield* TestClock.adjust("60 seconds");
        const seal2 = yield* f.retention.seal(0);
        assertNone(seal2);
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
        const seal3 = yield* f.retention.seal(0);
        expect(seal3).toEqual(sealed);
        const receipt4 = yield* f.native.receipt(original.page.receiptId);
        assertNone(receipt4);
        const current = yield* f.retention.window;
        expect(current).toMatchObject({ epoch: 1, totals: { visible: 1, eventObservations: 1 } });
        const observedAgain = yield* f.native.acceptBatch(batch);
        expect(observedAgain.page.receiptId).not.toBe(original.page.receiptId);
        expect(observedAgain.page.evidenceEpoch).toBe(1);
        const readNewEvents5 = yield* f.native.readNewEvents(observedAgain.page.receiptId);
        assertSome(readNewEvents5, batch.spans);
        const reopened = yield* makeNativeIntakeJournal(f.intakeConfig);
        const acceptBatch6 = yield* reopened.acceptBatch(batch);
        expect(acceptBatch6).toEqual(observedAgain);
        yield* f.visible(
          observedAgain.page.receiptId,
          A.map(batch.spans, (s) => s.eventId)
        );
        yield* TestClock.adjust("60 seconds");
        yield* f.reclaimer.reclaim(observedAgain.page.receiptId);
        const next = yield* f.retention.seal(1);
        assertTrue(next._tag === "Some");
        expect(next.value.record.epoch).toBe(1);
        assertTrue(sealed._tag === "Some");
        assertSome(next.value.record.previousDigest, sealed.value.digest);
        const window7 = yield* f.retention.window;
        expect(window7).toMatchObject({
          epoch: 2,
          totals: { visible: 2, eventObservations: 2, pages: 2 },
        });
        expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("conflict");
        const sql = yield* SqlClient.SqlClient;
        const value8 = yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery`;
        expect(value8).toEqual([{ n: 1 }]);
        const value9 = yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`;
        expect(value9).toEqual([{ n: 8 }]);
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
      for (const page of pages) {
        yield* f.reclaimer.expire(page.id);
      }
      const seal10 = yield* f.retention.seal(0);
      expect(seal10).toMatchObject({
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
      const window11 = yield* f.retention.window;
      expect(window11).toMatchObject({
        epoch: 1,
        totals: { pending: 1, acceptedUnverified: 1, visible: 1, rejected: 1, unresolved: 1 },
      });
      const value12 = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`;
      expect(value12).toEqual([{ n: 0 }]);
      const value13 = yield* sql`PRAGMA integrity_check`;
      expect(value13).toEqual([{ integrity_check: "ok" }]);
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
      const acceptBatch14 = yield* f.native.acceptBatch(batch);
      expect(acceptBatch14).toEqual(receipt);
      for (const span of batch.spans) {
        const state1 = yield* f.ledger.state(span.eventId);
        expect(state1).toMatchObject({ _tag: "Some", value: { state: "visible" } });
      }
      yield* sql`DROP TRIGGER window_failure`;
      const seal15 = yield* f.retention.seal(0);
      expect(seal15).toMatchObject({ _tag: "Some", value: { record: { epoch: 0 } } });
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
      const readCursor16 = yield* intake.readCursor("codex", page.cursor.pathHash);
      assertSome(readCursor16, page.cursor);
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
      const batch17 = yield* f.batch();
      expect((yield* f.native.acceptBatch(batch17).pipe(Effect.flip)).reason).toBe("storage");
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
        const batch95 = yield* f.batch(spanId);
        const acceptBatch18 = yield* f.native.acceptBatch(batch95);
        receipts.push(acceptBatch18);
      }
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) {
        yield* f.reclaimer.expire(receipt.page.receiptId);
      }
      const sealed = yield* f.retention.seal(0);
      expect(sealed).toMatchObject({
        _tag: "Some",
        value: { record: { totals: { pages: 33, pending: 33, eventObservations: 33, nativeAcceptedOccurrences: 33 } } },
      });
      const restore19 = yield* f.retention.restore(O.getOrThrow(sealed).digest);
      expect(restore19).toBe("restored");
      for (const receipt of receipts) {
        const receipt2 = yield* f.native.receipt(receipt.page.receiptId);
        assertSome(receipt2, receipt);
      }
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses a retirement above its work bound without deleting evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 1);
      const batch20 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch20);
      const batch21 = yield* f.batch("2");
      const second = yield* f.native.acceptBatch(batch21);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.reclaimer.expire(second.page.receiptId);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("capacity");
      const receipt22 = yield* f.native.receipt(first.page.receiptId);
      assertSome(receipt22, first);
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
      const acceptBatch23 = yield* f.native.acceptBatch(batch);
      expect(acceptBatch23).toEqual(receipt);
      for (const span of batch.spans) {
        const state3 = yield* f.ledger.state(span.eventId);
        expect(state3).toMatchObject({ _tag: "Some", value: { state: "visible" } });
      }
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
      const seal24 = yield* f.retention.seal(0);
      const sealed = O.getOrThrow(seal24);
      const value25 = yield* sql`SELECT * FROM observation_delivery_queries`;
      expect(value25).toHaveLength(0);
      const reopened = yield* makeEvidenceRetention(f.intakeConfig, f.ledgerConfig, f.retentionPolicy);
      const restore26 = yield* reopened.restore(sealed.digest);
      expect(restore26).toBe("restored");
      const value27 = yield* sql`SELECT * FROM observation_delivery_queries`;
      expect(value27).toEqual(queries);
      const window28 = yield* reopened.window;
      expect(window28).toEqual(before);
      const receipt29 = yield* f.native.receipt(receipt.page.receiptId);
      assertSome(receipt29, receipt);
      const readDisposition30 = yield* base.readDisposition(receipt.page.receiptId);
      expect(readDisposition30).toEqual(disposition);
      const state31 = yield* f.ledger.state(O.getOrThrow(A.head(batch.spans)).eventId);
      expect(state31).toMatchObject({
        _tag: "Some",
        value: { state: "visible" },
      });
      const value32 = yield* sql`SELECT * FROM observation_delivery_results`;
      expect(value32).toEqual(outcomes);
      const value33 = yield* sql`SELECT * FROM observation_delivery_attempt_events`;
      expect(value33).toEqual(memberships);
      const value34 = yield* sql`SELECT * FROM observation_delivery_attempts`;
      expect(value34).toEqual(reservations);
      const batch35 = yield* f.batch("2");
      const newer = yield* f.native.acceptBatch(batch35);
      const restore36 = yield* reopened.restore(sealed.digest);
      expect(restore36).toBe("already-restored");
      const receipt37 = yield* f.native.receipt(newer.page.receiptId);
      assertSome(receipt37, newer);
      expect((yield* reopened.restore(id("f")).pipe(Effect.flip)).reason).toBe("conflict");
      const value38 = yield* sql`PRAGMA integrity_check`;
      expect(value38).toEqual([{ integrity_check: "ok" }]);
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
      const seal39 = yield* f.retention.seal(0);
      const sealed = O.getOrThrow(seal39);
      const batch40 = yield* f.batch("2");
      const newer = yield* f.native.acceptBatch(batch40);
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("conflict");
      const receipt41 = yield* f.native.receipt(newer.page.receiptId);
      assertSome(receipt41, newer);
      const window42 = yield* f.retention.window;
      expect(window42).toMatchObject({ epoch: 1 });
      const sql = yield* SqlClient.SqlClient;
      const snapshot = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      // Even absent current facts cannot conceal an intervening accepted page.
      yield* sql`DELETE FROM observation_intake_pages`;
      yield* sql`DELETE FROM observation_native_events`;
      yield* sql`DELETE FROM observation_native_receipts`;
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("conflict");
      const value43 = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      expect(value43).toEqual(snapshot);
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
      const seal44 = yield* f.retention.seal(0);
      const sealed = O.getOrThrow(seal44);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_evidence_recovery_rows SET digest=${id("f")} WHERE ordinal=(SELECT MAX(ordinal) FROM observation_evidence_recovery_rows)`;
      expect((yield* f.retention.restore(sealed.digest).pipe(Effect.flip)).reason).toBe("storage");
      const window45 = yield* f.retention.window;
      expect(window45).toMatchObject({ epoch: 1 });
      const value46 = yield* sql`SELECT count(*) AS n FROM observation_delivery_visibility`;
      expect(value46).toEqual([{ n: 0 }]);
      const receipt47 = yield* f.native.receipt(receipt.page.receiptId);
      assertNone(receipt47);
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
      const receipt48 = yield* f.native.receipt(receipt.page.receiptId);
      assertSome(receipt48, receipt);
      const window49 = yield* f.retention.window;
      expect(window49).toMatchObject({ epoch: 0 });
      const sql = yield* SqlClient.SqlClient;
      const value50 = yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`;
      expect(value50).toEqual([{ n: 0 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("preserves the previous recovery generation when the next snapshot exceeds its bound", () =>
    Effect.gen(function* () {
      const f = yield* fixture(4, 4, true, 64, 8);
      const batch51 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch51);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.retention.seal(0);
      const sql = yield* SqlClient.SqlClient;
      const snapshot = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      const rows = yield* sql`SELECT * FROM observation_evidence_recovery_rows ORDER BY ordinal`;
      const batch52 = yield* f.batch("2");
      const second = yield* f.native.acceptBatch(batch52);
      const batch53 = yield* f.batch("3");
      const third = yield* f.native.acceptBatch(batch53);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(second.page.receiptId);
      yield* f.reclaimer.expire(third.page.receiptId);
      expect((yield* f.retention.seal(1).pipe(Effect.flip)).reason).toBe("capacity");
      const window54 = yield* f.retention.window;
      expect(window54).toMatchObject({ epoch: 1 });
      const value55 = yield* sql`SELECT payload,digest FROM observation_evidence_recovery`;
      expect(value55).toEqual(snapshot);
      const value56 = yield* sql`SELECT * FROM observation_evidence_recovery_rows ORDER BY ordinal`;
      expect(value56).toEqual(rows);
      const receipt57 = yield* f.native.receipt(second.page.receiptId);
      assertSome(receipt57, second);
      const receipt58 = yield* f.native.receipt(third.page.receiptId);
      assertSome(receipt58, third);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses retirement when the recovery byte budget is exhausted", () =>
    Effect.gen(function* () {
      const f = yield* fixture(8, 8, true, 64, 4096, 4096);
      const receipts = [];
      for (const digit of ["1", "2", "3", "4"]) {
        const batch9 = yield* f.batch(digit);
        const acceptBatch4 = yield* f.native.acceptBatch(batch9);
        receipts.push(acceptBatch4);
      }
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) {
        yield* f.reclaimer.expire(receipt.page.receiptId);
      }
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("capacity");
      const window59 = yield* f.retention.window;
      expect(window59).toMatchObject({ epoch: 0 });
      for (const receipt of receipts) {
        const receipt5 = yield* f.native.receipt(receipt.page.receiptId);
        assertSome(receipt5, receipt);
      }
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
      const seal60 = yield* f.retention.seal(0);
      const sealed = O.getOrThrow(seal60);
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
      const window61 = yield* f.retention.window;
      expect(window61).toMatchObject({ epoch: 1 });
      const value62 = yield* sql`SELECT count(*) AS n FROM observation_delivery_events`;
      expect(value62).toEqual([{ n: 0 }]);
      const restore63 = yield* f.retention.restore(sealed.digest);
      expect(restore63).toBe("restored");
      const receipt64 = yield* f.native.receipt(receipt.page.receiptId);
      assertSome(receipt64, receipt);
    })
  )
);
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ page_count: S.Natural })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses retirement atomically when SQLite cannot allocate the recovery copy", () =>
    Effect.gen(function* () {
      const f = yield* fixture(40, 40, true);
      const receipts = [];
      for (let index = 1; index <= 33; index += 1) {
        const batch10 = yield* f.batch(Str.padStart(16, "0")(index.toString(16)));
        const acceptBatch7 = yield* f.native.acceptBatch(batch10);
        receipts.push(acceptBatch7);
      }
      yield* TestClock.adjust("24 hours");
      for (const receipt of receipts) {
        yield* f.reclaimer.expire(receipt.page.receiptId);
      }
      const sql = yield* SqlClient.SqlClient;
      // Remove free pages and inject a physical allocation ceiling at current size.
      yield* sql`VACUUM`;
      const count = yield* sql`PRAGMA page_count`.pipe(Effect.flatMap(decodeArguments));
      yield* sql.unsafe(`PRAGMA max_page_count = ${count[0].page_count}`);
      expect((yield* f.retention.seal(0).pipe(Effect.flip)).reason).toBe("storage");
      const window65 = yield* f.retention.window;
      expect(window65).toMatchObject({ epoch: 0 });
      for (const receipt of receipts) {
        const receipt8 = yield* f.native.receipt(receipt.page.receiptId);
        assertSome(receipt8, receipt);
      }
      const value66 = yield* sql`SELECT count(*) AS n FROM observation_evidence_recovery_rows`;
      expect(value66).toEqual([{ n: 0 }]);
      const value67 = yield* sql`PRAGMA integrity_check`;
      expect(value67).toEqual([{ integrity_check: "ok" }]);
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
        const pipe68 = yield* f.ledger.registerPage(receipt.page.receiptId).pipe(Effect.flip);
        expect(pipe68).toMatchObject({
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
        const seal69 = yield* f.retention.seal(0);
        const sealed = O.getOrThrow(seal69);
        expect(sealed.record.totals).toMatchObject({
          eventObservations: 0,
          unenrolledReferences: 2,
          unenrolledNativeEvents: 2,
          pending: 0,
          expiredPages: 1,
        });
        const value70 = yield* sql`SELECT * FROM observation_native_events`;
        expect(value70).toHaveLength(0);
        const restore71 = yield* f.retention.restore(sealed.digest);
        expect(restore71).toBe("restored");
        const value72 = yield* sql`SELECT * FROM observation_native_events ORDER BY event_id`;
        expect(value72).toEqual(index);
        const base = yield* makeTranscriptIntakeJournal(f.intakeConfig);
        const readDisposition73 = yield* base.readDisposition(receipt.page.receiptId);
        expect(readDisposition73).toEqual(disposition);
      })
  )
);
const decodeArguments2 = S.decodeUnknownEffect(S.Tuple([S.Struct({ hash: Sha256Hex })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("counts duplicate never-enrolled references separately and refuses index corruption before seal", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3, 4, true, 64, 4096, 16777216, 1);
      const batch74 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch74);
      yield* f.ledger.registerPage(first.page.receiptId);
      const batch = yield* f.batch("2");
      const owner = yield* f.native.acceptBatch(batch);
      const duplicate = yield* f.native.acceptBatch(
        NativeTraceBatch.make({ ...batch, spans: [...batch.spans, ...batch.spans] })
      );
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      yield* f.reclaimer.expire(owner.page.receiptId);
      const expire75 = yield* f.reclaimer.expire(duplicate.page.receiptId);
      expect(expire75).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 1 },
      });
      const sql = yield* SqlClient.SqlClient;
      const original =
        yield* sql`SELECT payload_hash AS hash FROM observation_native_events WHERE receipt_id=${owner.page.receiptId}`.pipe(
          Effect.flatMap(decodeArguments2)
        );
      yield* sql`UPDATE observation_native_events SET payload_hash=${id("f")} WHERE receipt_id=${owner.page.receiptId}`;
      const pipe76 = yield* f.retention.seal(0).pipe(Effect.flip);
      expect(pipe76).toMatchObject({ reason: "storage" });
      expect((yield* f.retention.window).epoch).toBe(0);
      yield* sql`UPDATE observation_native_events SET payload_hash=${original[0].hash} WHERE receipt_id=${owner.page.receiptId}`;
      const seal77 = yield* f.retention.seal(0);
      expect(seal77).toMatchObject({
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
      const batch78 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch78);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(first.page.receiptId);
      const next = yield* f.batch("2");
      const pipe79 = yield* f.native.acceptBatch(next).pipe(Effect.flip);
      expect(pipe79).toMatchObject({ reason: "capacity" });
      const seal80 = yield* f.retention.seal(0);
      expect(seal80).toMatchObject({ _tag: "Some" });
      expect((yield* f.native.acceptBatch(next)).newEvents).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("expires never-enrolled transcript references and preserves the accepted source cursor", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 4, true, 64, 4096, 16777216, 1);
      const batch81 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch81);
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
      const expire82 = yield* f.reclaimer.expire(receipt.receiptId);
      expect(expire82).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 1, states: { pending: 0 } },
      });
      const seal83 = yield* f.retention.seal(0);
      expect(seal83).toMatchObject({
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
      const readCursor84 = yield* intake.readCursor("codex", page.cursor.pathHash);
      assertSome(readCursor84, page.cursor);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses transcript admission without advancing its cursor when terminal capacity is full", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2, 1, true);
      const batch85 = yield* f.batch("1");
      const first = yield* f.native.acceptBatch(batch85);
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
      const pipe86 = yield* intake.acceptPage(page, O.none()).pipe(Effect.flip);
      expect(pipe86).toMatchObject({ reason: "capacity" });
      const readCursor87 = yield* intake.readCursor("codex", page.cursor.pathHash);
      assertNone(readCursor87);
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
      const batch88 = yield* f.batch();
      const receipt = yield* f.native.acceptBatch(batch88);
      yield* f.ledger.registerPage(receipt.page.receiptId);
      yield* TestClock.adjust("24 hours");
      yield* f.reclaimer.expire(receipt.page.receiptId);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`DELETE FROM observation_delivery_events`;
      const pipe89 = yield* f.retention.seal(0).pipe(Effect.flip);
      expect(pipe89).toMatchObject({ reason: "storage" });
      expect((yield* f.retention.window).epoch).toBe(0);
      const receipt90 = yield* f.native.receipt(receipt.page.receiptId);
      assertSome(receipt90, receipt);
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
        const pipe91 = yield* f.retention.seal(0).pipe(Effect.flip);
        expect(pipe91).toMatchObject({ reason: "storage" });
        expect((yield* f.retention.window).epoch).toBe(0);
        yield* sql`INSERT INTO observation_delivery_events(event_id,receipt_id,payload_hash) VALUES(${member.event_id},${member.receipt_id},${member.payload_hash})`;
        const [legacy] =
          yield* sql`SELECT json_remove(payload,'$.enrolledOwnership') AS payload FROM observation_page_dispositions WHERE receipt_id=${receipt.receiptId}`.pipe(
            Effect.flatMap(decodeArguments4)
          );
        yield* sql`UPDATE observation_page_dispositions SET payload=${legacy.payload},digest=${yield* hashPublicTextSha256(legacy.payload)} WHERE receipt_id=${receipt.receiptId}`;
        const readDisposition92 = yield* intake.readDisposition(receipt.receiptId);
        expect(readDisposition92).toMatchObject({
          _tag: "Some",
          value: { states: { pending: 1 } },
        });
        const pipe93 = yield* f.retention.seal(0).pipe(Effect.flip);
        expect(pipe93).toMatchObject({ reason: "configuration" });
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
      const expire94 = yield* guarded.expire(receipt.page.receiptId);
      expect(expire94).toMatchObject({
        _tag: "Some",
        value: { unenrolledReferences: 32, unenrolledNativeOwnership: { count: 32 } },
      });
      // One registration lookup and one independent cached-page integrity lookup.
      expect(registrationReads).toBe(2);
    })
  )
);
