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
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
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
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";

const sqlLayer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const schedulePolicy = NativeSchedulePolicy.make({
  maxEvents: 1,
  retryDelayMillis: 100,
  maxRetryDelayMillis: 400,
  reconcileDelayMillis: 100,
  tickTimeoutMillis: 1000,
});
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

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
  const body = yield* encodeJsonValue({
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
  const build1 = yield* Layer.build(NodeHttpClient.layerNodeHttp);
  const client = Context.get(build1, HttpClient.HttpClient);
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
  // A hung POST waits on this gate rather than on real time, so its response can never land
  // before the test has observed what it is checking (deadline, interruption, admission).
  const gate = yield* Latch.make();
  const sql = yield* SqlClient.SqlClient;
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "POST") {
        yield* Ref.update(reads, (n) => n + 1);
        return yield* HttpServerResponse.json({ data: [], next_cursor: null }, { status: yield* Ref.get(readStatus) });
      }
      const argument = new TextDecoder();
      const arrayBuffer1 = yield* request.arrayBuffer;
      const wire = argument.decode(arrayBuffer1);
      expect(wire).not.toContain("private-prompt");
      expect(wire).not.toContain("private-synthetic-command");
      expect((yield* sql`SELECT attempt_id FROM observation_delivery_attempts`).length).toBeGreaterThan(0);
      yield* Ref.update(posts, (n) => n + 1);
      yield* Deferred.succeed(entered, undefined);
      if (yield* Ref.get(hang)) {
        yield* gate.await;
      }
      return HttpServerResponse.uint8Array(new Uint8Array(), {
        status: yield* Ref.get(status),
        contentType: "application/x-protobuf",
      });
    })
  );
  // Open the gate on scope close, before server shutdown, so a stalled request always drains,
  // even when an assertion fails while the request is held.
  yield* Effect.addFinalizer(() => Effect.asVoid(gate.open));
  const release = Ref.set(hang, false).pipe(Effect.andThen(gate.open), Effect.asVoid);
  // Every tick runs under a TestClock seeded at the current time. Only the test moves its wall time
  // or fires its sleeps, so neither delay windows nor the tick deadline follow host load.
  const clock = yield* TestClock.make({ warningDelay: "30 seconds" });
  const currentTimeMillis2 = yield* Clock.currentTimeMillis;
  yield* clock.setTime(currentTimeMillis2);
  const pin = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provideService(effect, Clock.Clock, clock);
  const reopen = (p = schedulePolicy) =>
    Effect.map(makeNativeDeliveryScheduler(intake, config, p, sender, reader), (scheduler) => ({
      tick: pin(scheduler.tick),
    }));
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
    release,
    entered,
    clock,
    pin,
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

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("visits each event once per tick when the event budget exceeds the backlog", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen(NativeSchedulePolicy.make({ ...schedulePolicy, maxEvents: 2 }));
      const tick = yield* scheduler.tick;
      assertTrue(tick._tag === "Complete");
      expect(tick.outcomes).toHaveLength(1);
      const got = yield* Ref.get(f.posts);
      expect(got).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("holds a candidate whose prior attempt is later than the current clock", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen();
      const tick3 = yield* scheduler.tick;
      expect(tick3).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      yield* f.clock.adjust(-60000);
      const regressed = yield* scheduler.tick;
      expect(regressed).toMatchObject({ outcomes: [{ reason: "clock-regression" }] });
      const got4 = yield* Ref.get(f.posts);
      expect(got4).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rejects replay qualification for another target before persisting a schedule", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const pipe5 = yield* f.reopen(replayPolicy(id("e"))).pipe(Effect.flip);
      expect(pipe5).toMatchObject({ reason: "configuration" });
      const value6 = yield* f.sql`SELECT name FROM sqlite_master WHERE name='observation_native_schedule'`;
      expect(value6).toHaveLength(0);
      const got7 = yield* Ref.get(f.posts);
      expect(got7).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("preserves the replay delay and never retries a failed query", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen(replayPolicy(f.config.targetId, 400));
      const tick = scheduler.tick;
      yield* tick;
      yield* f.clock.adjust(120);
      const tick8 = yield* tick;
      expect(tick8).toMatchObject({ outcomes: [{ _tag: "Reconciled", result: { _tag: "Missing" } }] });
      yield* Ref.set(f.readStatus, 503);
      yield* f.clock.adjust(300);
      const tick9 = yield* tick;
      expect(tick9).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "readback" }] });
      const got10 = yield* Ref.get(f.posts);
      expect(got10).toBe(1);
      yield* Ref.set(f.readStatus, 200);
      const tick11 = yield* tick;
      expect(tick11).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* f.clock.adjust(120);
      const tick12 = yield* tick;
      expect(tick12).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      const got13 = yield* Ref.get(f.posts);
      expect(got13).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
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
      const tick = f.pin(scheduler.tick);
      yield* tick;
      yield* f.clock.adjust(120);
      const tick14 = yield* tick;
      expect(tick14).toMatchObject({ outcomes: [{ _tag: "Reconciled", result: { _tag: "Mismatch" } }] });
      const got15 = yield* Ref.get(f.posts);
      expect(got15).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("bounds qualified replays across scheduler reconstruction without erasing acceptance", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const policy = replayPolicy(f.config.targetId);
      yield* Effect.gen(function* () {
        const reconstructed = yield* f.reopen(policy);
        const tick16 = yield* reconstructed.tick;
        expect(tick16).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
        yield* f.clock.adjust(120);
      }).pipe(Effect.replicateEffect(8, { discard: true }));
      const scheduler = yield* f.reopen(policy);
      const tick17 = yield* scheduler.tick;
      expect(tick17).toMatchObject({ outcomes: [{ _tag: "Held", reason: "attempt-limit" }] });
      const got18 = yield* Ref.get(f.posts);
      expect(got18).toBe(8);
      const state19 = yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"));
      expect(state19).toMatchObject({
        value: { state: "accepted-unverified", attempts: 8 },
      });
      const pipe20 = yield* f.reopen().pipe(Effect.flip);
      expect(pipe20).toMatchObject({ reason: "configuration" });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reconciles then replays an interrupted attempt under explicit qualification", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const policy = replayPolicy(f.config.targetId);
      const scheduler = yield* f.reopen(policy);
      yield* Ref.set(f.hang, true);
      const first = yield* scheduler.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.entered);
      yield* Fiber.interrupt(first);
      const state21 = yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"));
      expect(state21).toMatchObject({
        value: { state: "unresolved", attempts: 1 },
      });
      yield* f.release;
      yield* f.clock.adjust(120);
      const restarted = yield* f.reopen(policy);
      const tick22 = yield* restarted.tick;
      expect(tick22).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      const got23 = yield* Ref.get(f.posts);
      expect(got23).toBe(2);
      const got24 = yield* Ref.get(f.reads);
      expect(got24).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
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
      const tick25 = yield* scheduler.tick;
      expect(tick25).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      yield* f.clock.adjust(120);
      const tick26 = yield* scheduler.tick;
      expect(tick26).toMatchObject({ outcomes: [{ _tag: "Sent" }] });
      const got27 = yield* Ref.get(f.posts);
      expect(got27).toBe(2);
      const got28 = yield* Ref.get(f.reads);
      expect(got28).toBe(1);
      const attempts = yield* f.sql`SELECT payload FROM observation_delivery_attempts ORDER BY sequence`;
      expect(attempts).toHaveLength(2);
      const rows = yield* f.sql`SELECT attempt_id FROM observation_delivery_attempts ORDER BY sequence`;
      const value29 = yield* S.decodeUnknownEffect(Sha256Hex)(rows[0]?.attempt_id);
      const first = yield* f.sender.ledger.attempt(value29);
      const value30 = yield* S.decodeUnknownEffect(Sha256Hex)(rows[1]?.attempt_id);
      const repeated = yield* f.sender.ledger.attempt(value30);
      if (O.isNone(first) || O.isNone(repeated)) {
        return yield* Effect.die("Missing test attempt");
      }
      expect(first.value.payloadDigest).toBe(repeated.value.payloadDigest);
      expect(first.value.attemptId).not.toBe(repeated.value.attemptId);
      const state31 = yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"));
      expect(state31).toMatchObject({
        value: { state: "accepted-unverified", attempts: 2 },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("samples unresolved source and acceptance age without calling missing timestamps zero", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen();
      const tick = yield* scheduler.tick;
      assertTrue(tick._tag === "Complete");
      assertTrue(tick.lag._tag === "Some");
      expect(tick.lag.value).toMatchObject({ sampledEvents: 1, unknownSourceTimes: 1 });
      assertNone(tick.lag.value.maxSourceAgeMillis);
      expect(O.getOrElse(tick.lag.value.maxAcceptedAgeMillis, () => -1)).toBeGreaterThanOrEqual(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reports historical source age separately from newly accepted age", () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const f = yield* fixture(1, O.some(`${now - 60000}000000`));
      const tick = yield* (yield* f.reopen()).tick;
      if (tick._tag !== "Complete" || O.isNone(tick.lag)) {
        return yield* Effect.die("Missing age sample");
      }
      expect(O.getOrElse(tick.lag.value.maxSourceAgeMillis, () => -1)).toBeGreaterThanOrEqual(60000);
      expect(O.getOrElse(tick.lag.value.maxAcceptedAgeMillis, () => 60000)).toBeLessThan(60000);
      expect(tick.lag.value.unknownSourceTimes).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reports a future source clock without fabricating zero lag", () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const f = yield* fixture(1, O.some(`${now + 60000}000000`));
      const tick = yield* (yield* f.reopen()).tick;
      assertTrue(tick._tag === "Complete");
      assertTrue(tick.lag._tag === "Some");
      expect(tick.lag.value).toMatchObject({ sourceClockRegressions: 1, unknownSourceTimes: 0 });
      assertNone(tick.lag.value.maxSourceAgeMillis);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
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
      assertTrue(tick._tag === "Complete");
      assertTrue(tick.lag._tag === "Some");
      expect(tick.lag.value).toMatchObject({ sampledEvents: 1, unknownSourceTimes: 0 });
      assertSome(tick.lag.value.maxSourceAgeMillis, 1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reconstructs a prior multi-event attempt in source order rather than sorted identity order", () =>
    Effect.gen(function* () {
      const f = yield* fixture(5);
      const ids = A.map(f.batch.spans, (span) => span.eventId);
      expect(ids).not.toEqual(A.sort(ids, Order.String));
      yield* f.pin(
        f.sender.send(
          NativeDeliveryRequest.make({ receiptId: f.receipt.page.receiptId, attemptId: id("e"), offset: 0, limit: 5 })
        )
      );
      yield* f.clock.adjust(120);
      const scheduler = yield* f.reopen();
      const tick32 = yield* scheduler.tick;
      expect(tick32).toMatchObject({
        _tag: "Complete",
        outcomes: [{ _tag: "Reconciled", eventId: ids[0], result: { _tag: "Missing" } }],
      });
      const got33 = yield* Ref.get(f.posts);
      expect(got33).toBe(1);
      const got34 = yield* Ref.get(f.reads);
      expect(got34).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("resumes the durable scan after reconstruction and queries accepted events without resending", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3);
      for (const span of f.batch.spans) {
        const scheduler = yield* f.reopen();
        const tick35 = yield* scheduler.tick;
        expect(tick35).toMatchObject({
          _tag: "Complete",
          outcomes: [{ _tag: "Sent", eventId: span.eventId, result: { outcome: { _tag: "Accepted" } } }],
        });
      }
      const got36 = yield* Ref.get(f.posts);
      expect(got36).toBe(3);
      yield* f.clock.adjust(120);
      const reopened = yield* f.reopen();
      const tick37 = yield* reopened.tick;
      expect(tick37).toMatchObject({
        _tag: "Complete",
        wrapped: true,
        outcomes: [{ _tag: "Reconciled", result: { _tag: "Missing" } }],
      });
      const got38 = yield* Ref.get(f.posts);
      expect(got38).toBe(3);
      const got39 = yield* Ref.get(f.reads);
      expect(got39).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("backs off retryable replies and reserves a fresh attempt only after the delay", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* Ref.set(f.status, 503);
      const scheduler = yield* f.reopen(
        NativeSchedulePolicy.make({ ...schedulePolicy, retryDelayMillis: 400, maxRetryDelayMillis: 400 })
      );
      const tick = scheduler.tick;
      const tick40 = yield* tick;
      expect(tick40).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Retryable" } } }] });
      const tick41 = yield* tick;
      expect(tick41).toMatchObject({ outcomes: [{ _tag: "Held", reason: "retry-delay" }] });
      const got42 = yield* Ref.get(f.posts);
      expect(got42).toBe(1);
      yield* f.clock.adjust(420);
      yield* Ref.set(f.status, 200);
      const tick43 = yield* tick;
      expect(tick43).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Accepted" } } }] });
      const attempts = yield* f.sql`SELECT attempt_id FROM observation_delivery_attempts`;
      expect(attempts).toHaveLength(2);
      expect(attempts[0]).not.toEqual(attempts[1]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("does not let a permanent refusal starve the next event", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2);
      const scheduler = yield* f.reopen();
      yield* Ref.set(f.status, 400);
      const tick44 = yield* scheduler.tick;
      expect(tick44).toMatchObject({ outcomes: [{ result: { outcome: { _tag: "Rejected" } } }] });
      yield* Ref.set(f.status, 200);
      const tick45 = yield* scheduler.tick;
      expect(tick45).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: f.batch.spans[1]?.eventId }] });
      const tick46 = yield* scheduler.tick;
      expect(tick46).toMatchObject({ outcomes: [{ _tag: "Held", reason: "permanent-refusal" }] });
      const got47 = yield* Ref.get(f.posts);
      expect(got47).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("advances only one claim before a deadline and recovers uncertainty by read-back", () =>
    Effect.gen(function* () {
      const f = yield* fixture(3);
      const policy = NativeSchedulePolicy.make({ ...schedulePolicy, maxEvents: 3, tickTimeoutMillis: 400 });
      const scheduler = yield* f.reopen(policy);
      yield* Ref.set(f.hang, true);
      // The deadline fires only when the test clock passes it, here while the first send is
      // stalled on the server, so host load cannot make it fire early or late.
      const stalled = yield* scheduler.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.entered);
      yield* f.clock.adjust(400);
      const join48 = yield* Fiber.join(stalled);
      expect(join48).toEqual({ _tag: "Deadline" });
      const got49 = yield* Ref.get(f.posts);
      expect(got49).toBe(1);
      yield* f.release;
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
      const got50 = yield* Ref.get(f.posts);
      expect(got50).toBe(3);
      const got51 = yield* Ref.get(f.reads);
      expect(got51).toBe(1);
      const state52 = yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"));
      expect(state52).toMatchObject({
        value: { state: "unresolved", attempts: 1 },
      });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses concurrent ticks and releases admission after interruption", () =>
    Effect.gen(function* () {
      const f = yield* fixture(2);
      const scheduler = yield* f.reopen();
      yield* Ref.set(f.hang, true);
      const first = yield* scheduler.tick.pipe(Effect.forkChild);
      yield* Deferred.await(f.entered);
      const pipe53 = yield* scheduler.tick.pipe(Effect.flip);
      expect(pipe53).toMatchObject({ reason: "busy" });
      yield* Fiber.interrupt(first);
      yield* f.release;
      const tick54 = yield* scheduler.tick;
      expect(tick54).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: f.batch.spans[1]?.eventId }] });
      const got55 = yield* Ref.get(f.posts);
      expect(got55).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses policy drift and cursor tampering before any network work", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const scheduler = yield* f.reopen();
      const pipe56 = yield* f.reopen(NativeSchedulePolicy.make({ ...schedulePolicy, maxEvents: 2 })).pipe(Effect.flip);
      expect(pipe56).toMatchObject({ reason: "configuration" });
      yield* f.sql`UPDATE observation_native_schedule SET span_index=8 WHERE singleton=1`;
      const pipe57 = yield* scheduler.tick.pipe(Effect.flip);
      expect(pipe57).toMatchObject({ reason: "storage" });
      const got58 = yield* Ref.get(f.posts);
      expect(got58).toBe(0);
      const got59 = yield* Ref.get(f.reads);
      expect(got59).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
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
      yield* f.pin(journal.acceptPage(page, O.none()));
      const frame = page.frames[0];
      const native = f.batch.spans[0];
      if (frame === undefined || frame._tag !== "Accepted" || native === undefined) {
        return yield* Effect.die("Invalid synthetic events");
      }
      expect(frame.occurrenceId).not.toBe(native.eventId);
      const first = yield* f.reopen();
      const tick60 = yield* first.tick;
      expect(tick60).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: native.eventId }] });
      const restarted = yield* f.reopen();
      const tick61 = yield* restarted.tick;
      expect(tick61).toMatchObject({ outcomes: [{ _tag: "Sent", eventId: frame.occurrenceId }] });
      const got62 = yield* Ref.get(f.posts);
      expect(got62).toBe(2);
    })
  )
);

for (const initial of ["accepted", "interrupted"]) {
  it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect(`stops qualified replay after permanent refusal while preserving ${initial} history`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const scheduler = yield* f.reopen(replayPolicy(f.config.targetId));
        if (initial === "interrupted") {
          yield* Ref.set(f.hang, true);
          const sending = yield* scheduler.tick.pipe(Effect.forkChild);
          yield* Deferred.await(f.entered);
          yield* Fiber.interrupt(sending);
          yield* f.release;
        } else {
          yield* scheduler.tick;
        }
        yield* f.clock.adjust(120);
        yield* Ref.set(f.status, 400);
        const tick63 = yield* scheduler.tick;
        expect(tick63).toMatchObject({
          outcomes: [{ _tag: "Sent", result: { outcome: { _tag: "Rejected" } } }],
        });
        yield* f.clock.adjust(120);
        const tick64 = yield* scheduler.tick;
        expect(tick64).toMatchObject({ outcomes: [{ _tag: "Held", reason: "permanent-refusal" }] });
        const got65 = yield* Ref.get(f.posts);
        expect(got65).toBe(2);
        const got66 = yield* Ref.get(f.reads);
        expect(got66).toBe(2);
        const state67 = yield* f.sender.ledger.state(f.batch.spans[0]?.eventId ?? id("0"));
        expect(state67).toMatchObject({
          value: {
            state: initial === "accepted" ? "accepted-unverified" : "unresolved",
            attempts: 2,
          },
        });
      })
    )
  );
}

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("persists capped read-back delay across reconstruction without more sends", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const tick = Effect.flatMap(f.reopen(), (scheduler) => scheduler.tick);
      yield* tick;
      yield* f.clock.adjust(120);
      const tick68 = yield* tick;
      expect(tick68).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      const tick69 = yield* tick;
      expect(tick69).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* f.clock.adjust(120);
      const tick70 = yield* tick;
      expect(tick70).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* f.clock.adjust(120);
      const tick71 = yield* tick;
      expect(tick71).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* f.clock.adjust(110);
      const tick72 = yield* tick;
      expect(tick72).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* f.clock.adjust(220);
      const tick73 = yield* tick;
      expect(tick73).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* f.clock.adjust(220);
      const tick74 = yield* tick;
      expect(tick74).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      yield* f.clock.adjust(420);
      const tick75 = yield* tick;
      expect(tick75).toMatchObject({ outcomes: [{ _tag: "Reconciled" }] });
      const got76 = yield* Ref.get(f.reads);
      expect(got76).toBe(5);
      const got77 = yield* Ref.get(f.posts);
      expect(got77).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reserves query delay before failed or interrupted read-back", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const tick = Effect.flatMap(f.reopen(), (scheduler) => scheduler.tick);
      yield* tick;
      yield* f.clock.adjust(120);
      yield* Ref.set(f.readStatus, 503);
      const tick78 = yield* tick;
      expect(tick78).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "readback" }] });
      const tick79 = yield* tick;
      expect(tick79).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      yield* f.clock.adjust(120);
      const interrupted = yield* makeNativeDeliveryScheduler(f.intake, f.config, schedulePolicy, f.sender, {
        reconcile: () => Effect.interrupt,
      });
      yield* f.pin(interrupted.tick).pipe(Effect.exit);
      const tick80 = yield* tick;
      expect(tick80).toMatchObject({ outcomes: [{ reason: "query-delay" }] });
      const got81 = yield* Ref.get(f.reads);
      expect(got81).toBe(1);
      const got82 = yield* Ref.get(f.posts);
      expect(got82).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses corrupted query reservations without querying or sending", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* (yield* f.reopen()).tick;
      yield* f.clock.adjust(120);
      yield* (yield* f.reopen()).tick;
      yield* f.sql`UPDATE observation_delivery_queries SET recorded_at=recorded_at+1`;
      const tick83 = yield* (yield* f.reopen()).tick;
      expect(tick83).toMatchObject({ outcomes: [{ _tag: "Failed", reason: "storage" }] });
      const got84 = yield* Ref.get(f.reads);
      expect(got84).toBe(1);
      const got85 = yield* Ref.get(f.posts);
      expect(got85).toBe(1);
    })
  )
);
