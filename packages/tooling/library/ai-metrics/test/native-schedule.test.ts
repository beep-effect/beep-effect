import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeNativeReadback, NativeReadbackResult } from "@beep/repo-ai-metrics/native-readback";
import {
  IdempotentReplayPolicy,
  makeNativeDeliveryScheduler,
  NativeSchedulePolicy,
} from "@beep/repo-ai-metrics/native-schedule";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const schedulePolicy = NativeSchedulePolicy.make({
  maxEvents: 1,
  retryDelayMillis: 100,
  maxRetryDelayMillis: 400,
  reconcileDelayMillis: 100,
  tickTimeoutMillis: 1000,
});
const fixture = Effect.fn("NativeScheduleTest.fixture")(function* (
  count = 1,
  sourceTime: O.Option<string> = O.none(),
  endOnly?: boolean
) {
  const salt = "synthetic-schedule-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1048576,
    maxDatabasePages: 256,
  });
  const native = yield* makeNativeIntakeJournal(intake);
  const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: Array.from({ length: count }, (_, index) => ({
              traceId: Str.repeat(32)("1"),
              spanId: Str.padStart(16, "0")((index + 1).toString(16)),
              name: "private-synthetic-command",
              ...(O.isSome(sourceTime)
                ? { [endOnly === true ? "endTimeUnixNano" : "startTimeUnixNano"]: sourceTime.value }
                : {}),
              attributes: [{ key: "input.value", value: { stringValue: "private-prompt" } }],
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
  if (O.isSome(sourceTime))
    expect(batch.spans[0]?.[endOnly === true ? "endTimeUnixNano" : "startTimeUnixNano"]).toEqual(sourceTime);
  const receipt = yield* native.acceptBatch(batch);
  const context = yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }));
  const server = Context.get(context, HttpServer.HttpServer);
  const origin = HttpServer.formatAddress(server.address);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(`${origin}/v1/traces`),
    project: "synthetic-proof",
    timeoutMillis: 2000,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 32,
    maxAttemptsPerEvent: 8,
  });
  const sender = yield* makeNativeDelivery(intake, config, policy).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const reader = yield* makeNativeReadback(intake, config, policy, PhoenixConfigInput.make({ baseUrl: origin })).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const posts = yield* Ref.make(0);
  const reads = yield* Ref.make(0);
  const status = yield* Ref.make(200);
  const readStatus = yield* Ref.make(200);
  const hang = yield* Ref.make(false);
  const entered = yield* Deferred.make<void>();
  const sql = yield* SqlClient.SqlClient;
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "POST") {
        yield* Ref.update(reads, (n) => n + 1);
        return yield* HttpServerResponse.json({ data: [], next_cursor: null }, { status: yield* Ref.get(readStatus) });
      }
      const wire = new TextDecoder().decode(yield* request.arrayBuffer);
      expect(wire).not.toContain("private-prompt");
      expect(wire).not.toContain("private-synthetic-command");
      expect((yield* sql`SELECT attempt_id FROM observation_delivery_attempts`).length).toBeGreaterThan(0);
      yield* Ref.update(posts, (n) => n + 1);
      yield* Deferred.succeed(entered, undefined);
      // Keep the server-side request finite so graceful server shutdown can drain
      // even when the client has deliberately interrupted its wait.
      if (yield* Ref.get(hang)) yield* Effect.sleep(1000);
      return HttpServerResponse.uint8Array(new Uint8Array(), {
        status: yield* Ref.get(status),
        contentType: "application/x-protobuf",
      });
    })
  );
  const reopen = (p = schedulePolicy) => makeNativeDeliveryScheduler(intake, config, p, sender, reader);
  return {
    intake,
    salt,
    native,
    receipt,
    batch,
    sender,
    reader,
    sql,
    config,
    posts,
    reads,
    status,
    readStatus,
    hang,
    entered,
    reopen,
  };
});

const replayPolicy = (targetId: Sha256Hex, minimumDelayMillis = 100) =>
  NativeSchedulePolicy.make({
    ...schedulePolicy,
    maxRetryDelayMillis: 100,
    idempotentReplay: O.some(
      IdempotentReplayPolicy.make({ targetId, qualificationDigest: id("f"), minimumDelayMillis })
    ),
  });

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("rejects replay qualification for another target before persisting a schedule", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(yield* f.reopen(replayPolicy(id("e"))).pipe(Effect.flip)).toMatchObject({ reason: "configuration" });
      expect(yield* f.sql`SELECT name FROM sqlite_master WHERE name='observation_native_schedule'`).toHaveLength(0);
      expect(yield* Ref.get(f.posts)).toBe(0);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("preserves the replay delay and never retries a failed query", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen(replayPolicy(f.config.targetId, 400));
      yield* scheduler.tick;
      yield* Effect.sleep(120);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Reconciled", result: { _tag: "Missing" } }] });
      yield* Ref.set(f.readStatus, 503);
      yield* Effect.sleep(300);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "readback" }] });
      expect(yield* Ref.get(f.posts)).toBe(1);
      yield* Ref.set(f.readStatus, 200);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* Effect.sleep(120);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("never replays a mismatched backend record even with qualification", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* makeNativeDeliveryScheduler(
        f.intake,
        f.config,
        replayPolicy(f.config.targetId),
        f.sender,
        {
          reconcile: (_request, eventId) => Effect.succeed(NativeReadbackResult.cases.Mismatch.make({ eventId })),
        }
      );
      yield* scheduler.tick;
      yield* Effect.sleep(120);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Reconciled", result: { _tag: "Mismatch" } }] });
      expect(yield* Ref.get(f.posts)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("bounds qualified replays across scheduler reconstruction without erasing acceptance", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const policy = replayPolicy(f.config.targetId);
      for (let attempt = 0; attempt < 8; attempt++) {
        const scheduler = yield* f.reopen(policy);
        expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
        yield* Effect.sleep(120);
      }
      const scheduler = yield* f.reopen(policy);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Held", reason: "attempt-limit" }] });
      expect(yield* Ref.get(f.posts)).toBe(8);
      expect(yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"))).toMatchObject({
        value: { state: "accepted-unverified", attempts: 8 },
      });
      expect(yield* f.reopen().pipe(Effect.flip)).toMatchObject({ reason: "configuration" });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("reconciles then replays an interrupted attempt under explicit qualification", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const policy = replayPolicy(f.config.targetId);
      const scheduler = yield* f.reopen(policy);
      yield* Ref.set(f.hang, true);
      const first = yield* scheduler.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.entered);
      yield* Fiber.interrupt(first);
      expect(yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"))).toMatchObject({
        value: { state: "unresolved", attempts: 1 },
      });
      yield* Ref.set(f.hang, false);
      yield* Effect.sleep(120);
      const restarted = yield* f.reopen(policy);
      expect(yield* restarted.tick).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
      expect(yield* Ref.get(f.reads)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("retries an accepted-but-missing event only under target-bound idempotent qualification", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const policy = NativeSchedulePolicy.make({
        ...schedulePolicy,
        idempotentReplay: O.some(
          IdempotentReplayPolicy.make({
            targetId: f.config.targetId,
            qualificationDigest: id("f"),
            minimumDelayMillis: 100,
          })
        ),
      });
      const scheduler = yield* f.reopen(policy);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      yield* Effect.sleep(120);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
      expect(yield* Ref.get(f.reads)).toBe(1);
      const attempts = yield* f.sql`SELECT payload FROM observation_delivery_attempts ORDER BY sequence`;
      expect(attempts).toHaveLength(2);
      const rows = yield* f.sql`SELECT attempt_id FROM observation_delivery_attempts ORDER BY sequence`;
      const first = yield* f.sender.ledger.attempt(yield* S.decodeUnknownEffect(Sha256Hex)(rows[0]?.attempt_id));
      const repeated = yield* f.sender.ledger.attempt(yield* S.decodeUnknownEffect(Sha256Hex)(rows[1]?.attempt_id));
      if (O.isNone(first) || O.isNone(repeated)) return yield* Effect.die("Missing test attempt");
      expect(first.value.payloadDigest).toBe(repeated.value.payloadDigest);
      expect(first.value.attemptId).not.toBe(repeated.value.attemptId);
      expect(yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"))).toMatchObject({
        value: { state: "accepted-unverified", attempts: 2 },
      });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("samples unresolved source and acceptance age without calling missing timestamps zero", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen();
      const tick = yield* scheduler.tick;
      expect(tick).toMatchObject({
        lag: { value: { sampledEvents: 1, unknownSourceTimes: 1, maxSourceAgeMillis: O.none() } },
      });
      if (tick._tag !== "Complete" || O.isNone(tick.lag)) return yield* Effect.die("Missing age sample");
      expect(O.getOrElse(tick.lag.value.maxAcceptedAgeMillis, () => -1)).toBeGreaterThanOrEqual(0);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("reports historical source age separately from newly accepted age", () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const f = yield* fixture(1, O.some(`${now - 60000}000000`));
      const tick = yield* (yield* f.reopen()).tick;
      if (tick._tag !== "Complete" || O.isNone(tick.lag)) return yield* Effect.die("Missing age sample");
      expect(O.getOrElse(tick.lag.value.maxSourceAgeMillis, () => -1)).toBeGreaterThanOrEqual(60000);
      expect(O.getOrElse(tick.lag.value.maxAcceptedAgeMillis, () => 60000)).toBeLessThan(60000);
      expect(tick.lag.value.unknownSourceTimes).toBe(0);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("reports a future source clock without fabricating zero lag", () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const f = yield* fixture(1, O.some(`${now + 60000}000000`));
      expect(yield* (yield* f.reopen()).tick).toMatchObject({
        lag: { value: { sourceClockRegressions: 1, unknownSourceTimes: 0, maxSourceAgeMillis: O.none() } },
      });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("uses an end-only timestamp and floors nanoseconds before numeric conversion", () =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      const observedAt = 1793000000001;
      const tick = yield* Effect.gen(function* () {
        const f = yield* fixture(1, O.some("1793000000000999999"), true);
        return yield* (yield* f.reopen()).tick;
      }).pipe(
        Effect.provideService(Clock.Clock, {
          sleep: (duration) => clock.sleep(duration),
          monotonicTimeNanos: clock.monotonicTimeNanos,
          monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
          currentTimeNanos: Effect.succeed(BigInt(observedAt) * 1000000n),
          currentTimeNanosUnsafe: () => BigInt(observedAt) * 1000000n,
          currentTimeMillis: Effect.succeed(observedAt),
          currentTimeMillisUnsafe: () => observedAt,
        })
      );
      expect(tick).toMatchObject({
        lag: { value: { sampledEvents: 1, unknownSourceTimes: 0, maxSourceAgeMillis: O.some(1) } },
      });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("reconstructs a prior multi-event attempt in source order rather than sorted identity order", () =>
    Effect.gen(function* () {
      const f = yield* fixture(5);
      const ids = A.map(f.batch.spans, (span) => span.eventId);
      expect(ids).not.toEqual(A.sort(ids, Order.String));
      yield* f.sender.send(
        NativeDeliveryRequest.make({ receiptId: f.receipt.page.receiptId, attemptId: id("e"), offset: 0, limit: 5 })
      );
      yield* Effect.sleep(120);
      const scheduler = yield* f.reopen();
      expect(yield* scheduler.tick).toMatchObject({
        _tag: "Complete",
        outcomes: [{ _tag: "Reconciled", eventId: ids[0], result: { _tag: "Missing" } }],
      });
      expect(yield* Ref.get(f.posts)).toBe(1);
      expect(yield* Ref.get(f.reads)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("resumes the durable scan after reconstruction and queries accepted events without resending", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3);
      for (const span of f.batch.spans) {
        const scheduler = yield* f.reopen();
        expect(yield* scheduler.tick).toMatchObject({
          _tag: "Complete",
          outcomes: [{ _tag: "Sent", eventId: span.eventId, result: { outcome: { _tag: "Accepted" } } }],
        });
      }
      expect(yield* Ref.get(f.posts)).toBe(3);
      yield* Effect.sleep(120);
      const reopened = yield* f.reopen();
      expect(yield* reopened.tick).toMatchObject({
        _tag: "Complete",
        wrapped: true,
        outcomes: [{ _tag: "Reconciled", result: { _tag: "Missing" } }],
      });
      expect(yield* Ref.get(f.posts)).toBe(3);
      expect(yield* Ref.get(f.reads)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("backs off retryable replies and reserves a fresh attempt only after the delay", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* Ref.set(f.status, 503);
      const scheduler = yield* f.reopen(
        NativeSchedulePolicy.make({ ...schedulePolicy, retryDelayMillis: 400, maxRetryDelayMillis: 400 })
      );
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Retryable" } } }] });
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Held", reason: "retry-delay" }] });
      expect(yield* Ref.get(f.posts)).toBe(1);
      yield* Effect.sleep(420);
      yield* Ref.set(f.status, 200);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Accepted" } } }] });
      const attempts = yield* f.sql`SELECT attempt_id FROM observation_delivery_attempts`;
      expect(attempts).toHaveLength(2);
      expect(attempts[0]).not.toEqual(attempts[1]);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("does not let a permanent refusal starve the next event", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2);
      const scheduler = yield* f.reopen();
      yield* Ref.set(f.status, 400);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Rejected" } } }] });
      yield* Ref.set(f.status, 200);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: f.batch.spans[1]?.eventId }] });
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Held", reason: "permanent-refusal" }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("advances only one claim before a deadline and recovers uncertainty by read-back", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3);
      // Allow real SQLite/protobuf work under parallel host load, while the
      // deliberate one-second server stall still exceeds the bounded deadline.
      const policy = NativeSchedulePolicy.make({ ...schedulePolicy, maxEvents: 3, tickTimeoutMillis: 400 });
      const scheduler = yield* f.reopen(policy);
      yield* Ref.set(f.hang, true);
      expect(yield* scheduler.tick).toEqual({ _tag: "Deadline" });
      expect(yield* Ref.get(f.posts)).toBe(1);
      yield* Ref.set(f.hang, false);
      const reopened = yield* f.reopen(policy);
      const result = yield* reopened.tick;
      expect(result).toMatchObject({
        _tag: "Complete",
        outcomes: [
          { _tag: "Sent", eventId: f.batch.spans[1]?.eventId },
          { _tag: "Sent", eventId: f.batch.spans[2]?.eventId },
          { _tag: "Reconciled", eventId: f.batch.spans[0]?.eventId, result: { _tag: "Missing" } },
        ],
      });
      expect(yield* Ref.get(f.posts)).toBe(3);
      expect(yield* Ref.get(f.reads)).toBe(1);
      expect(yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"))).toMatchObject({
        value: { state: "unresolved", attempts: 1 },
      });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("refuses concurrent ticks and releases admission after interruption", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2);
      const scheduler = yield* f.reopen();
      yield* Ref.set(f.hang, true);
      const first = yield* scheduler.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.entered);
      expect(yield* scheduler.tick.pipe(Effect.flip)).toMatchObject({ reason: "busy" });
      yield* Fiber.interrupt(first);
      yield* Ref.set(f.hang, false);
      expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: f.batch.spans[1]?.eventId }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("refuses policy drift and cursor tampering before any network work", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen();
      expect(
        yield* f.reopen(NativeSchedulePolicy.make({ ...schedulePolicy, maxEvents: 2 })).pipe(Effect.flip)
      ).toMatchObject({ reason: "configuration" });
      yield* f.sql`UPDATE observation_native_schedule SET span_index=8 WHERE singleton=1`;
      expect(yield* scheduler.tick.pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect(yield* Ref.get(f.posts)).toBe(0);
      expect(yield* Ref.get(f.reads)).toBe(0);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("fairly schedules native and reconstructed pages with separate event identities", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();
      const path = `${dir}/synthetic.jsonl`;
      yield* fs.writeFileString(
        path,
        '{"type":"response_item","payload":{"type":"message","content":"private-prompt"}}\n'
      );
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(f.salt),
          cursor: O.none(),
          maxBytes: 1024,
          maxLineBytes: 512,
          maxFrames: 10,
        })
      );
      const journal = yield* makeTranscriptIntakeJournal(f.intake);
      yield* journal.acceptPage(page, O.none());
      const frame = page.frames[0];
      const native = f.batch.spans[0];
      if (frame === undefined || frame._tag !== "Accepted" || native === undefined)
        return yield* Effect.die("Invalid synthetic events");
      expect(frame.occurrenceId).not.toBe(native.eventId);
      const first = yield* f.reopen();
      expect(yield* first.tick).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: native.eventId }] });
      const restarted = yield* f.reopen();
      expect(yield* restarted.tick).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: frame.occurrenceId }] });
      expect(yield* Ref.get(f.posts)).toBe(2);
    }).pipe(Effect.scoped)
  )
);

for (const initial of ["accepted", "interrupted"]) {
  it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
    it.effect(`stops qualified replay after permanent refusal while preserving ${initial} history`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const scheduler = yield* f.reopen(replayPolicy(f.config.targetId));
        if (initial === "interrupted") {
          yield* Ref.set(f.hang, true);
          const sending = yield* scheduler.tick.pipe(Effect.forkChild);
          yield* Deferred.await(f.entered);
          yield* Fiber.interrupt(sending);
          yield* Ref.set(f.hang, false);
        } else {
          yield* scheduler.tick;
        }
        yield* Effect.sleep(120);
        yield* Ref.set(f.status, 400);
        expect(yield* scheduler.tick).toMatchObject({
          outcomes: [{ _tag: "Sent", result: { outcome: { _tag: "Rejected" } } }],
        });
        yield* Effect.sleep(120);
        expect(yield* scheduler.tick).toMatchObject({ outcomes: [{ _tag: "Held", reason: "permanent-refusal" }] });
        expect(yield* Ref.get(f.posts)).toBe(2);
        expect(yield* Ref.get(f.reads)).toBe(2);
        expect(yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"))).toMatchObject({
          value: {
            state: initial === "accepted" ? "accepted-unverified" : "unresolved",
            attempts: 2,
          },
        });
      }).pipe(Effect.scoped)
    )
  );
}

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("persists capped read-back delay across reconstruction without more sends", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* (yield* f.reopen()).tick;
      yield* Effect.sleep(120);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* Effect.sleep(120);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* Effect.sleep(120);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* Effect.sleep(110);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* Effect.sleep(220);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* Effect.sleep(220);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* Effect.sleep(420);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      expect(yield* Ref.get(f.reads)).toBe(5);
      expect(yield* Ref.get(f.posts)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("reserves query delay before failed or interrupted read-back", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* (yield* f.reopen()).tick;
      yield* Effect.sleep(120);
      yield* Ref.set(f.readStatus, 503);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "readback" }] });
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* Effect.sleep(120);
      const interrupted = yield* makeNativeDeliveryScheduler(f.intake, f.config, schedulePolicy, f.sender, {
        reconcile: () => Effect.interrupt,
      });
      yield* interrupted.tick.pipe(Effect.exit);
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      expect(yield* Ref.get(f.reads)).toBe(1);
      expect(yield* Ref.get(f.posts)).toBe(1);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(sqlLayer), { excludeTestServices: true })((it) =>
  it.effect("refuses corrupted query reservations without querying or sending", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* (yield* f.reopen()).tick;
      yield* Effect.sleep(120);
      yield* (yield* f.reopen()).tick;
      yield* f.sql`UPDATE observation_delivery_queries SET recorded_at=recorded_at+1`;
      expect(yield* (yield* f.reopen()).tick).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "storage" }] });
      expect(yield* Ref.get(f.reads)).toBe(1);
      expect(yield* Ref.get(f.posts)).toBe(1);
    }).pipe(Effect.scoped)
  )
);
