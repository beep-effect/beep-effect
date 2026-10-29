import { NativeReadbackResult } from "@beep/repo-ai-metrics/native-readback";
import {
  NativeScheduleOutcome,
  NativeScheduleTick,
  ObservationLagSummary,
} from "@beep/repo-ai-metrics/native-schedule";
import { ObservationControlState } from "@beep/repo-ai-metrics/observation-control";
import {
  makeObservationRuntime,
  ObservationRuntimePolicy,
  renderObservationRuntimeMetrics,
} from "@beep/repo-ai-metrics/observation-runtime";
import { TranscriptDiscoveryReport } from "@beep/repo-ai-metrics/transcript-discovery";
import { TranscriptIntakeError, TranscriptIntakeStats } from "@beep/repo-ai-metrics/transcript-intake";
import { TranscriptSweepReport } from "@beep/repo-ai-metrics/transcript-sweep";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const policy = ObservationRuntimePolicy.make({ intervalMillis: 100, cycleTimeoutMillis: 200, staleAfterMillis: 400 });
const fixture = Effect.fn("ObservationRuntimeTest.fixture")(function* (accepting = true, retainedPages = 0) {
  const control = yield* Ref.make(
    ObservationControlState.make({ accepting, active: 0, maintenance: false, closed: false })
  );
  const calls = yield* Ref.make(0);
  const fail = yield* Ref.make(false);
  const hang = yield* Ref.make(false);
  const crash = yield* Ref.make(false);
  const nextTick = yield* Ref.make<typeof NativeScheduleTick.Type>(
    NativeScheduleTick.cases.Complete.make({ wrapped: false, outcomes: [] })
  );
  const entered = yield* Deferred.make<void>();
  const pauses = yield* Ref.make(0);
  const stats = Ref.get(fail).pipe(
    Effect.flatMap((failed) =>
      failed
        ? Effect.fail(TranscriptIntakeError.make({ reason: "storage" }))
        : Effect.succeed(
            TranscriptIntakeStats.make({
              pages: retainedPages,
              payloadBytes: retainedPages * 100,
              frames: retainedPages,
            })
          )
    )
  );
  const worker = {
    status: Ref.get(control),
    stats,
    tick: Effect.gen(function* () {
      yield* Ref.update(calls, (n) => n + 1);
      yield* Deferred.succeed(entered, undefined);
      if (yield* Ref.get(crash)) return yield* Effect.die("synthetic-runtime-defect");
      if (yield* Ref.get(hang)) return yield* Effect.never;
      return yield* Ref.get(nextTick);
    }),
    pause: Ref.update(pauses, (n) => n + 1).pipe(
      Effect.andThen(Ref.updateAndGet(control, (s) => ObservationControlState.make({ ...s, accepting: false })))
    ),
  };
  const runtime = yield* makeObservationRuntime(worker, policy);
  return { runtime, worker, control, calls, fail, hang, crash, nextTick, entered, pauses };
});
const waitForCycle = Effect.fn("ObservationRuntimeTest.waitForCycle")(function* (
  runtime: Effect.Success<ReturnType<typeof makeObservationRuntime>>
) {
  while (O.isNone((yield* runtime.health).lastCycle)) yield* Effect.sleep(5);
  return yield* runtime.health;
});
const clockAt = Effect.fn("ObservationRuntimeTest.clockAt")(function* (now: number) {
  const clock = yield* Clock.Clock;
  return { ...clock, currentTimeMillis: Effect.succeed(now), currentTimeMillisUnsafe: () => now } satisfies Clock.Clock;
});

it.live("distinguishes stopped, paused and idle without implicitly opening intake", () =>
  Effect.gen(function* () {
    const f = yield* fixture(false);
    expect(yield* f.runtime.health).toMatchObject({
      phase: "stopped",
      running: false,
      lastCycle: { _tag: "None" },
      sourceCoverage: "unknown",
    });
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    expect(yield* waitForCycle(f.runtime)).toMatchObject({
      phase: "paused",
      lastCycle: { value: { result: { _tag: "Paused" } } },
    });
    expect(yield* Ref.get(f.calls)).toBe(0);
    yield* Ref.update(f.control, (s) => ObservationControlState.make({ ...s, accepting: true }));
    yield* Effect.sleep(150);
    expect(yield* f.runtime.health).toMatchObject({
      phase: "idle",
      lastCycle: { value: { result: { _tag: "Completed", summary: { examined: 0 }, retained: { pages: 0 } } } },
    });
    yield* Fiber.interrupt(running);
    expect(yield* f.runtime.health).toMatchObject({ phase: "stopped", running: false });
    expect(yield* Ref.get(f.control)).toMatchObject({ accepting: false });
    expect(yield* Ref.get(f.pauses)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("refuses a second loop and makes no overlapping or catch-up cycles after a deadline", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    yield* Ref.set(f.hang, true);
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    yield* Deferred.await(f.entered);
    expect(yield* f.runtime.run.pipe(Effect.flip)).toMatchObject({ reason: "busy" });
    expect(yield* waitForCycle(f.runtime)).toMatchObject({
      phase: "degraded",
      lastCycle: { value: { result: { _tag: "Deadline" } } },
    });
    expect(yield* Ref.get(f.calls)).toBe(1);
    yield* Ref.set(f.hang, false);
    yield* Effect.sleep(150);
    expect(yield* f.runtime.health).toMatchObject({ phase: "idle" });
    expect(yield* Ref.get(f.calls)).toBe(2);
    yield* Fiber.interrupt(running);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("records storage failure without inventing zero counts and recovers on a later cycle", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    yield* Ref.set(f.fail, true);
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    expect(yield* waitForCycle(f.runtime)).toMatchObject({
      phase: "degraded",
      lastCycle: { value: { result: { _tag: "Failed" } } },
    });
    expect(yield* Ref.get(f.calls)).toBe(0);
    yield* Ref.set(f.fail, false);
    yield* Effect.sleep(150);
    expect(yield* f.runtime.health).toMatchObject({ phase: "idle" });
    yield* Fiber.interrupt(running);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("exposes stale and regressed clocks instead of returning a cached healthy observation", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    const initial = yield* waitForCycle(f.runtime);
    if (O.isNone(initial.lastCycle)) return yield* Effect.die("Missing fixture cycle");
    const future = yield* clockAt(initial.lastCycle.value.completedAt + 10000);
    expect(yield* f.runtime.health.pipe(Effect.provideService(Clock.Clock, future))).toMatchObject({
      phase: "stale",
      lastCycleAgeMillis: { value: 10000 },
    });
    const past = yield* clockAt(initial.lastCycle.value.startedAt - 1);
    expect(yield* f.runtime.health.pipe(Effect.provideService(Clock.Clock, past))).toMatchObject({
      phase: "clock-regression",
      lastCycleAgeMillis: { _tag: "None" },
    });
    yield* Fiber.interrupt(running);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("requires a freshness bound longer than cadence plus deadline", () =>
  Effect.gen(function* () {
    expect(
      yield* Effect.result(
        S.decodeEffect(ObservationRuntimePolicy)({
          intervalMillis: 100,
          cycleTimeoutMillis: 200,
          staleAfterMillis: 300,
        })
      )
    ).toMatchObject({ _tag: "Failure" });
  })
);

it.live("reports missing read-back and blocked work as degraded without exposing event identifiers", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const eventId = Sha256Hex.make(Str.repeat(64)("d"));
    yield* Ref.set(
      f.nextTick,
      NativeScheduleTick.cases.Complete.make({
        wrapped: false,
        outcomes: [
          NativeScheduleOutcome.cases.Reconciled.make({
            eventId,
            result: NativeReadbackResult.cases.Missing.make({ eventId }),
          }),
          NativeScheduleOutcome.cases.Held.make({ eventId, reason: "attempt-limit" }),
          NativeScheduleOutcome.cases.Failed.make({ eventId, reason: "readback" }),
        ],
        lag: O.some(
          ObservationLagSummary.make({
            sampledEvents: 2,
            unknownSourceTimes: 1,
            acceptedClockRegressions: 0,
            sourceClockRegressions: 0,
            maxAcceptedAgeMillis: O.some(2000),
            maxSourceAgeMillis: O.some(60000),
          })
        ),
      })
    );
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    const health = yield* waitForCycle(f.runtime);
    expect(health).toMatchObject({
      phase: "degraded",
      lastCycle: { value: { result: { summary: { examined: 3, missing: 1, held: 1, failed: 1, unhealthy: true } } } },
    });
    const metrics = renderObservationRuntimeMetrics(health);
    expect(metrics).toContain('beep_observation_runtime_phase{phase="degraded"} 1');
    expect(metrics).toContain("beep_observation_delivery_pass_missing 1");
    expect(metrics).toContain("beep_observation_delivery_pass_max_source_age_seconds 60");
    expect(metrics).toContain("beep_observation_delivery_pass_max_accepted_age_seconds 2");
    expect(metrics).toContain("beep_observation_delivery_pass_unknown_source_times 1");
    expect(metrics).not.toContain(eventId);
    expect(metrics).not.toContain("_total");
    yield* Fiber.interrupt(running);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("omits unknown counts and terminates on a defect while closing admission", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const before = renderObservationRuntimeMetrics(yield* f.runtime.health);
    expect(before).not.toContain("beep_observation_retained_pages");
    expect(before).not.toContain("beep_observation_delivery_pass_examined");
    expect(before).toContain("beep_observation_source_coverage_known 0");
    yield* Ref.set(f.crash, true);
    expect(Exit.isFailure(yield* Effect.exit(f.runtime.run))).toBe(true);
    expect(yield* f.runtime.health).toMatchObject({ phase: "stopped", running: false, lastCycle: { _tag: "None" } });
    expect(yield* Ref.get(f.control)).toMatchObject({ accepting: false });
    expect(yield* Ref.get(f.pauses)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("source cadence is opt-in and preserves waiting, failure and declared-root evidence independently", () =>
  Effect.gen(function* () {
    const f = yield* fixture(false);
    const rootId = Sha256Hex.make(Str.repeat(64)("e"));
    const report = TranscriptDiscoveryReport.make({
      operations: 1,
      candidates: 0,
      activeHelpers: 0,
      roots: [
        {
          rootId,
          source: "codex",
          state: "complete",
          cycle: 1,
          entries: 1,
          candidates: 1,
          excludedLinks: 0,
          read: { assessed: 1, pending: 0, accepted: 0, idle: 0, partial: 1, backlogged: 0, failed: 0 },
        },
      ],
    });
    const next = yield* Ref.make({
      discovery: report,
      sweep: TranscriptSweepReport.make({ declared: 0, retired: 0, eligible: 0, outcomes: [] }),
    });
    const calls = yield* Ref.make(0);
    const fail = yield* Ref.make(false);
    const poll = Effect.gen(function* () {
      yield* Ref.update(calls, (n) => n + 1);
      if (yield* Ref.get(fail)) return yield* TranscriptIntakeError.make({ reason: "storage" });
      return yield* Ref.get(next);
    });
    const runtime = yield* makeObservationRuntime(f.worker, policy, O.some({ poll, policy }));
    expect((yield* f.runtime.health).sources).toMatchObject({ _tag: "NotConfigured" });
    const running = yield* runtime.run.pipe(Effect.forkChild);
    yield* Effect.sleep(150);
    expect(yield* Ref.get(calls)).toBe(0);
    expect((yield* runtime.health).sources).toMatchObject({ _tag: "Configured", phase: "paused" });
    yield* Ref.update(f.control, (s) => ObservationControlState.make({ ...s, accepting: true }));
    yield* Effect.sleep(150);
    const health = yield* runtime.health;
    expect(health.sources).toMatchObject({ phase: "waiting" });
    const metrics = renderObservationRuntimeMetrics(health);
    expect(metrics).not.toContain(rootId);
    expect(metrics).toContain('beep_observation_sources_roots{state="complete"} 1');
    yield* Ref.set(fail, true);
    yield* Effect.sleep(150);
    const failed = yield* runtime.health;
    expect(failed.sources).toMatchObject({ phase: "degraded", lastCycle: { value: { result: { _tag: "Failed" } } } });
    expect(renderObservationRuntimeMetrics(failed)).not.toContain("beep_observation_sources_pass_accepted_pages");
    expect(yield* Ref.get(f.calls)).toBeGreaterThan(0);
    yield* Fiber.interrupt(running);
    expect((yield* runtime.health).sources).toMatchObject({ phase: "stopped" });
    expect(yield* Ref.get(f.pauses)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("a hung source cannot block native cadence and source deadlines do not invent zero progress", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const runtime = yield* makeObservationRuntime(f.worker, policy, O.some({ poll: Effect.never, policy }));
    const running = yield* runtime.run.pipe(Effect.forkChild);
    yield* Effect.sleep(350);
    expect(yield* Ref.get(f.calls)).toBeGreaterThan(1);
    expect((yield* runtime.health).sources).toMatchObject({
      phase: "degraded",
      lastCycle: { value: { result: { _tag: "Deadline" } } },
    });
    const now = yield* Clock.currentTimeMillis;
    const future = yield* clockAt(now + 2000);
    expect((yield* runtime.health.pipe(Effect.provideService(Clock.Clock, future))).sources).toMatchObject({
      phase: "stale",
    });
    const past = yield* clockAt(now - 2000);
    expect((yield* runtime.health.pipe(Effect.provideService(Clock.Clock, past))).sources).toMatchObject({
      phase: "clock-regression",
    });
    yield* Fiber.interrupt(running);
    expect(yield* Ref.get(f.control)).toMatchObject({ accepting: false });
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);

it.live("reports a bounded empty pass over retained pages as scanning, not idle", () =>
  Effect.gen(function* () {
    const f = yield* fixture(true, 3);
    const running = yield* f.runtime.run.pipe(Effect.forkChild);
    expect(yield* waitForCycle(f.runtime)).toMatchObject({
      phase: "scanning",
      lastCycle: { value: { result: { _tag: "Completed", summary: { examined: 0 }, retained: { pages: 3 } } } },
    });
    yield* Fiber.interrupt(running);
  }).pipe(Effect.scoped, provideScopedLayer(NodeCrypto.layer), Effect.timeout("5 seconds"))
);
