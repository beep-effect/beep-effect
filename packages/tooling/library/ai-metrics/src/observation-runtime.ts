/**
 * Scoped delivery scheduling cadence and content-free health observations.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { NativeScheduleOutcome, ObservationLagSummary } from "./native-schedule.ts";
import { ObservationControlError } from "./observation-control.ts";
import {
  ObservationSourceCycle,
  ObservationSourceHealth,
  renderObservationSourceMetrics,
  summarizeObservationSources,
} from "./observation-source-health.ts";
import { TranscriptIntakeStats } from "./transcript-intake.ts";
import type { NativeScheduleTick } from "./native-schedule.ts";
import type { ObservationSourceSummary } from "./observation-source-health.ts";
import type { makeObservationWorker } from "./observation-worker.ts";
import type { runDiscoveredTranscriptSweep } from "./transcript-discovery.ts";

const $I = $RepoAiMetricsId.create("observation-runtime");
const delay = S.Int.check(S.isBetween({ minimum: 100, maximum: 60000 }));
/**
 * Explicit cadence, cooperative cycle deadline and health freshness bound.
 * **Example** (Inspecting runtime policy)
 * ```ts
 * import { ObservationRuntimePolicy } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(typeof ObservationRuntimePolicy.make)
 * ```
 * **Details** A delay follows each completed cycle; slow work never creates catch-up jobs. Freshness must exceed one cycle deadline plus its delay. Hard process limits and an external stale-heartbeat observer remain deployment requirements.
 * @category models
 * @since 0.0.0
 */
export class ObservationRuntimePolicy extends S.Opaque<ObservationRuntimePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    intervalMillis: delay,
    cycleTimeoutMillis: delay,
    staleAfterMillis: S.Int.check(S.isBetween({ minimum: 300, maximum: 180000 })),
  })
    .check(
      S.makeFilter((p) => p.staleAfterMillis > p.intervalMillis + p.cycleTimeoutMillis, {
        identifier: "ObservationRuntimeFreshness",
        message: "Freshness must exceed cycle timeout plus cadence",
      })
    )
    .pipe(
      $I.annoteSchema("ObservationRuntimePolicy", {
        description: "Bounded sequential scheduling cadence and freshness.",
      })
    )
) {}
/**
 * Counts observed in one bounded delivery scheduling pass.
 * **Example** (Inspecting pass observations)
 * ```ts
 * import { ObservationPassSummary } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(typeof ObservationPassSummary.make)
 * ```
 * **Details** These are pass observations, not unique events, totals or fleet denominators. sent counts sender invocations, including attempts that received refusal or uncertain replies. No event ID, endpoint, path, payload or exception is included.
 * @category models
 * @since 0.0.0
 */
export class ObservationPassSummary extends S.Opaque<ObservationPassSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    examined: S.Natural,
    sent: S.Natural,
    visible: S.Natural,
    missing: S.Natural,
    mismatch: S.Natural,
    held: S.Natural,
    failed: S.Natural,
    unhealthy: S.Boolean,
    lag: S.Option(ObservationLagSummary).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ObservationPassSummary", {
      description: "One pass observation counts, not delivery population counts.",
    })
  )
) {}
/**
 * Latest bounded cycle result, preserving unknown work after deadlines.
 * **Example** (Inspecting result constructors)
 * ```ts
 * import { ObservationCycleResult } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(ObservationCycleResult.cases.Deadline)
 * ```
 * **Details** Deadline and Failed do not assert zero progress: durable work may already have committed. Paused does not claim an empty queue. Retained totals include reconstructed pages and duplicate occurrences, not undelivered unique events.
 * @category models
 * @since 0.0.0
 */
export const ObservationCycleResult = S.TaggedUnion({
  Completed: { summary: ObservationPassSummary, retained: TranscriptIntakeStats },
  Paused: {},
  Deadline: {},
  Failed: {},
}).pipe($I.annoteSchema("ObservationCycleResult", { description: "Latest native runtime cycle result." }));
const Cycle = S.Struct({ startedAt: S.Natural, completedAt: S.Natural, result: ObservationCycleResult });
/**
 * Fresh in-process health for the native scheduling loop.
 * **Example** (Inspecting health construction)
 * ```ts
 * import { ObservationRuntimeHealth } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(typeof ObservationRuntimeHealth.make)
 * ```
 * **Details** idle means the last pass observed no candidates and its starting snapshot had no retained pages; scanning denotes a bounded pass over retained pages without an event outcome; source coverage and expected activity remain unknown. Stopped and stale are distinct from idle. Cycle times are wall-clock observations; a backward clock is explicit. Restart resets this volatile snapshot and never synthesizes persisted counts. An external consumer must independently age any serialized snapshot, because a dead process cannot update itself.
 * @category models
 * @since 0.0.0
 */
export class ObservationRuntimeHealth extends S.Opaque<ObservationRuntimeHealth, { readonly brand: unique symbol }>()(
  S.Struct({
    observedAt: S.Natural,
    running: S.Boolean,
    phase: S.Literals([
      "stopped",
      "starting",
      "paused",
      "idle",
      "scanning",
      "active",
      "degraded",
      "stale",
      "clock-regression",
    ]),
    lastCycle: S.Option(Cycle),
    lastCycleAgeMillis: S.Option(S.Natural),
    sourceCoverage: S.tag("unknown"),
    sources: ObservationSourceHealth.pipe(
      S.withConstructorDefault(Effect.succeed(ObservationSourceHealth.cases.NotConfigured.make({})))
    ),
  }).pipe(
    $I.annoteSchema("ObservationRuntimeHealth", {
      description: "Native runtime health with explicit freshness and coverage limits.",
    })
  )
) {}
/**
 * Refusal to run a second native cadence owner.
 * **Example** (Inspecting a runtime refusal)
 * ```ts
 * import { ObservationRuntimeError } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(ObservationRuntimeError.make({reason:"busy"}).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationRuntimeError extends S.TaggedError<ObservationRuntimeError, { readonly brand: unique symbol }>(
  $I`ObservationRuntimeError`
)(
  "ObservationRuntimeError",
  { reason: S.tag("busy") },
  $I.annote("ObservationRuntimeError", { description: "A scheduling loop already owns this runtime." })
) {}
const unhealthyOutcome = NativeScheduleOutcome.match({
  Failed: () => true,
  Reconciled: ({ result }) => result._tag !== "Visible",
  Sent: ({ result }) => result._tag !== "Recorded" || result.outcome._tag !== "Accepted",
  Held: ({ reason }) => reason === "permanent-refusal" || reason === "attempt-limit" || reason === "clock-regression",
});
const summarize = (tick: typeof NativeScheduleTick.cases.Complete.Type) =>
  ObservationPassSummary.make({
    lag: tick.lag,
    examined: tick.outcomes.length,
    sent: A.filter(tick.outcomes, (o) => o._tag === "Sent").length,
    visible: A.filter(tick.outcomes, (o) => o._tag === "Reconciled" && o.result._tag === "Visible").length,
    missing: A.filter(tick.outcomes, (o) => o._tag === "Reconciled" && o.result._tag === "Missing").length,
    mismatch: A.filter(tick.outcomes, (o) => o._tag === "Reconciled" && o.result._tag === "Mismatch").length,
    held: A.filter(tick.outcomes, (o) => o._tag === "Held").length,
    failed: A.filter(tick.outcomes, (o) => o._tag === "Failed").length,
    unhealthy: A.some(tick.outcomes, unhealthyOutcome),
  });
const RuntimeState = S.Struct({ running: S.Boolean, startedAt: S.Natural, lastCycle: S.Option(Cycle) }).pipe(
  $I.annoteSchema("RuntimeState", { description: "Volatile delivery loop ownership and latest cycle observation." })
);
const cycleTiming = (
  now: number,
  startedAt: number,
  lastCycle: O.Option<Pick<typeof Cycle.Type, "startedAt" | "completedAt">>
) => {
  const reference = O.match(lastCycle, { onNone: () => startedAt, onSome: (cycle) => cycle.completedAt });
  const regression = now < reference || O.exists(lastCycle, (cycle) => cycle.completedAt < cycle.startedAt);
  return {
    elapsed: now - reference,
    regression,
    age: O.isSome(lastCycle) && !regression ? O.some(now - reference) : O.none<number>(),
  };
};
const temporalPhase = (
  running: boolean,
  timing: ReturnType<typeof cycleTiming>,
  staleAfterMillis: number,
  hasCycle: boolean
): O.Option<ObservationRuntimeHealth["phase"]> => {
  if (!running) return O.some("stopped");
  if (timing.regression) return O.some("clock-regression");
  if (timing.elapsed > staleAfterMillis) return O.some("stale");
  if (!hasCycle) return O.some("starting");
  return O.none();
};
const completedDeliveryPhase = (
  result: typeof ObservationCycleResult.cases.Completed.Type
): ObservationRuntimeHealth["phase"] => {
  if (result.summary.unhealthy) return "degraded";
  if (result.summary.examined > 0) return "active";
  return result.retained.pages > 0 ? "scanning" : "idle";
};
const deliveryResultPhase = ObservationCycleResult.match({
  Completed: completedDeliveryPhase,
  Paused: (): ObservationRuntimeHealth["phase"] => "paused",
  Deadline: (): ObservationRuntimeHealth["phase"] => "degraded",
  Failed: (): ObservationRuntimeHealth["phase"] => "degraded",
});
const degradedSources = (summary: ObservationSourceSummary) =>
  summary.failedFiles > 0 ||
  A.some(summary.discovery.roots, (root) => root.read.failed > 0) ||
  A.some(
    summary.discovery.roots,
    (root) => root.state === "unavailable" || root.state === "changed" || root.state === "overflow"
  );
const completedSourcePhase = (
  summary: ObservationSourceSummary
): typeof ObservationSourceHealth.cases.Configured.Type.phase => {
  const roots = summary.discovery.roots;
  if (degradedSources(summary)) return "degraded";
  if (A.every(roots, (root) => root.state === "retired")) return "excluded";
  if (A.some(roots, (root) => root.state === "scanning" || root.state === "pending" || root.read.pending > 0))
    return "scanning";
  if (A.some(roots, (root) => root.read.partial > 0)) return "waiting";
  if (A.some(roots, (root) => root.read.backlogged > 0)) return "backlogged";
  if (A.some(roots, (root) => root.read.accepted > 0)) return "active";
  return "idle";
};
const sourceResultPhase = ObservationSourceCycle.match({
  Completed: ({ summary }) => completedSourcePhase(summary),
  Paused: (): typeof ObservationSourceHealth.cases.Configured.Type.phase => "paused",
  Deadline: (): typeof ObservationSourceHealth.cases.Configured.Type.phase => "degraded",
  Failed: (): typeof ObservationSourceHealth.cases.Configured.Type.phase => "degraded",
});
const configuredSourceHealth = (
  now: number,
  current: typeof RuntimeState.Type,
  policy: ObservationRuntimePolicy,
  lastCycle: typeof ObservationSourceHealth.cases.Configured.Type.lastCycle
) => {
  const timing = cycleTiming(now, current.startedAt, lastCycle);
  const phase = O.getOrElse(temporalPhase(current.running, timing, policy.staleAfterMillis, O.isSome(lastCycle)), () =>
    O.match(lastCycle, { onNone: (): "starting" => "starting", onSome: (cycle) => sourceResultPhase(cycle.result) })
  );
  return ObservationSourceHealth.cases.Configured.make({
    observedAt: now,
    running: current.running,
    phase,
    lastCycle,
    lastCycleAgeMillis: timing.age,
  });
};
/**
 * Construct a sequential scoped scheduling loop without implicitly resuming intake.
 * **Example** (Inspecting the runtime factory)
 * ```ts
 * import { makeObservationRuntime } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(typeof makeObservationRuntime)
 * ```
 * **Details** Construction starts nothing. run owns one loop until interrupted; a second run fails without queuing. The native cycle observes control, retained metadata totals and the bounded native tick. Optional explicit source work runs in an independent sequential loop with its own cadence/deadline, so slow discovery cannot block native scheduling. Both loops share one owner and one pause/drain finalizer; source health keeps unconfigured and unknown states explicit. Expected failures/deadlines produce content-free degraded observations and allow the next delayed cycle. Unexpected defects terminate the loop. Scope/interruption cleanup marks stopped and pauses/drains the worker; it never resumes admission. This factory does not install a service, expose a listener, reclaim payloads, infer source identity or release the recovery hold.
 * @category services
 * @since 0.0.0
 */
export const makeObservationRuntime = Effect.fn("AiMetrics.makeObservationRuntime")(function* <E = never, R = never>(
  worker: Pick<Effect.Success<ReturnType<typeof makeObservationWorker>>, "status" | "stats" | "tick" | "pause">,
  policy: ObservationRuntimePolicy,
  sourceWork: O.Option<{
    readonly poll: Effect.Effect<Effect.Success<ReturnType<typeof runDiscoveredTranscriptSweep>>, E, R>;
    readonly policy: ObservationRuntimePolicy;
  }> = O.none()
) {
  const owner = yield* Semaphore.make(1);
  const state = yield* Ref.make(RuntimeState.make({ running: false, startedAt: 0, lastCycle: O.none() }));
  const sourceState = yield* Ref.make<
    O.Option<{ readonly startedAt: number; readonly completedAt: number; readonly result: ObservationSourceCycle }>
  >(O.none());
  const sourceLoop = O.isNone(sourceWork)
    ? Effect.never
    : Effect.gen(function* () {
        const startedAt = yield* Clock.currentTimeMillis;
        const observed = yield* Effect.gen(function* () {
          const control = yield* worker.status;
          if (control.closed) return ObservationSourceCycle.cases.Failed.make({});
          if (!control.accepting) return ObservationSourceCycle.cases.Paused.make({});
          return ObservationSourceCycle.cases.Completed.make({
            summary: summarizeObservationSources(yield* sourceWork.value.poll),
          });
        }).pipe(
          Effect.orElseSucceed(
            (error): ObservationSourceCycle =>
              S.is(ObservationControlError)(error) && error.reason === "paused"
                ? ObservationSourceCycle.cases.Paused.make({})
                : ObservationSourceCycle.cases.Failed.make({})
          ),
          Effect.timeoutOption(sourceWork.value.policy.cycleTimeoutMillis)
        );
        yield* Ref.set(
          sourceState,
          O.some({
            startedAt,
            completedAt: yield* Clock.currentTimeMillis,
            result: O.getOrElse(observed, () => ObservationSourceCycle.cases.Deadline.make({})),
          })
        );
      }).pipe(Effect.andThen(Effect.sleep(sourceWork.value.policy.intervalMillis)), Effect.forever);
  const cycle = Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    const observed = yield* Effect.gen(function* () {
      const control = yield* worker.status;
      if (control.closed) return ObservationCycleResult.cases.Failed.make({});
      if (!control.accepting) return ObservationCycleResult.cases.Paused.make({});
      const retained = yield* worker.stats;
      const tick = yield* worker.tick;
      return tick._tag === "Deadline"
        ? ObservationCycleResult.cases.Deadline.make({})
        : ObservationCycleResult.cases.Completed.make({ summary: summarize(tick), retained });
    }).pipe(
      Effect.orElseSucceed((error): typeof ObservationCycleResult.Type =>
        S.is(ObservationControlError)(error) && error.reason === "paused"
          ? ObservationCycleResult.cases.Paused.make({})
          : ObservationCycleResult.cases.Failed.make({})
      ),
      Effect.timeoutOption(policy.cycleTimeoutMillis)
    );
    const completedAt = yield* Clock.currentTimeMillis;
    const result = O.getOrElse(observed, () => ObservationCycleResult.cases.Deadline.make({}));
    yield* Ref.update(state, (s) => ({ ...s, lastCycle: O.some({ startedAt, completedAt, result }) }));
  });
  const run = owner
    .withPermitsIfAvailable(1)(
      Effect.acquireUseRelease(
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((startedAt) =>
            Ref.set(state, { running: true, startedAt, lastCycle: O.none() }).pipe(
              Effect.andThen(Ref.set(sourceState, O.none()))
            )
          )
        ),
        () =>
          Effect.all([cycle.pipe(Effect.andThen(Effect.sleep(policy.intervalMillis)), Effect.forever), sourceLoop], {
            concurrency: 2,
            discard: true,
          }),
        () => Ref.update(state, (s) => ({ ...s, running: false })).pipe(Effect.andThen(worker.pause), Effect.orDie)
      )
    )
    .pipe(Effect.flatMap(() => Effect.fail(ObservationRuntimeError.make({}))));
  const health = Effect.gen(function* () {
    const current = yield* Ref.get(state);
    const now = yield* Clock.currentTimeMillis;
    const timing = cycleTiming(now, current.startedAt, current.lastCycle);
    const phase = O.getOrElse(
      temporalPhase(current.running, timing, policy.staleAfterMillis, O.isSome(current.lastCycle)),
      () =>
        O.match(current.lastCycle, {
          onNone: (): "starting" => "starting",
          onSome: (cycle) => deliveryResultPhase(cycle.result),
        })
    );
    const sources = O.isSome(sourceWork)
      ? configuredSourceHealth(now, current, sourceWork.value.policy, yield* Ref.get(sourceState))
      : ObservationSourceHealth.cases.NotConfigured.make({});
    return ObservationRuntimeHealth.make({
      observedAt: now,
      running: current.running,
      phase,
      lastCycle: current.lastCycle,
      lastCycleAgeMillis: timing.age,
      sources,
    });
  });
  return { run, health };
});

const gauge = (name: string, description: string, value: number) =>
  `# HELP beep_observation_${name} ${description}\n# TYPE beep_observation_${name} gauge\nbeep_observation_${name} ${value}`;
const lagMetrics = (lag: ObservationLagSummary) => {
  let lines = [
    gauge(
      "delivery_pass_age_sampled_events",
      "Unresolved events aged before their operation in this pass, not a fleet denominator.",
      lag.sampledEvents
    ),
    gauge(
      "delivery_pass_unknown_source_times",
      "Age samples without a known source timestamp.",
      lag.unknownSourceTimes
    ),
    gauge(
      "delivery_pass_accepted_clock_regressions",
      "Sampled acceptance times later than observation time.",
      lag.acceptedClockRegressions
    ),
    gauge(
      "delivery_pass_source_clock_regressions",
      "Sampled source times later than observation time.",
      lag.sourceClockRegressions
    ),
  ];
  if (O.isSome(lag.maxAcceptedAgeMillis))
    lines = A.append(
      lines,
      gauge(
        "delivery_pass_max_accepted_age_seconds",
        "Maximum sampled unresolved age since local acceptance, not whole-journal oldest age.",
        lag.maxAcceptedAgeMillis.value / 1000
      )
    );
  if (O.isSome(lag.maxSourceAgeMillis))
    lines = A.append(
      lines,
      gauge(
        "delivery_pass_max_source_age_seconds",
        "Maximum sampled unresolved source age; includes historical replay and is not fleet lag.",
        lag.maxSourceAgeMillis.value / 1000
      )
    );
  return lines;
};
const completedCycleMetrics = ({ summary, retained }: typeof ObservationCycleResult.cases.Completed.Type) => {
  let lines = [
    gauge(
      "retained_pages",
      "Pages retained at the start of this completed pass, not undelivered events.",
      retained.pages
    ),
    gauge(
      "retained_payload_bytes",
      "Metadata payload bytes retained at the start of this completed pass.",
      retained.payloadBytes
    ),
    gauge("retained_occurrences", "Retained occurrences including duplicates, not unique events.", retained.frames),
    gauge("delivery_pass_examined", "Events examined in the latest completed pass.", summary.examined),
    gauge(
      "delivery_pass_send_calls",
      "Send calls observed in the latest pass, not confirmed deliveries.",
      summary.sent
    ),
    gauge("delivery_pass_visible", "Positive read-back results in the latest pass.", summary.visible),
    gauge("delivery_pass_missing", "Missing read-back results in the latest pass.", summary.missing),
    gauge("delivery_pass_mismatch", "Mismatched read-back results in the latest pass.", summary.mismatch),
    gauge("delivery_pass_held", "Held events observed in the latest pass.", summary.held),
    gauge("delivery_pass_failed", "Failed operations observed in the latest pass.", summary.failed),
  ];
  if (O.isSome(summary.lag)) lines = A.appendAll(lines, lagMetrics(summary.lag.value));
  return lines;
};
/**
 * Render bounded metadata-only gauges for one runtime observation.
 * **Example** (Inspecting the renderer)
 * ```ts
 * import { renderObservationRuntimeMetrics } from "@beep/repo-ai-metrics/observation-runtime"
 * console.log(typeof renderObservationRuntimeMetrics)
 * ```
 * **Details** Names and phase labels are fixed; no host, route, event, model or private string becomes a label. Latest-pass counts are gauges, never cumulative counters. Missing retained/pass observations are omitted rather than reported as zero. An exporter must combine scrape availability with observation/cycle timestamp freshness; a preserved text file is not proof of a running process. This does not install an exporter or claim fleet coverage.
 * @param health - A point-in-time runtime health observation.
 * @returns Fixed-label Prometheus gauges preserving missing observations.
 * @category utilities
 * @since 0.0.0
 */
export const renderObservationRuntimeMetrics = (health: ObservationRuntimeHealth): string => {
  let lines = [
    gauge("runtime_running", "Whether this observation reports an owned runtime loop.", health.running ? 1 : 0),
    gauge(
      "health_observed_timestamp_seconds",
      "Wall clock when this health observation was read.",
      health.observedAt / 1000
    ),
    gauge("source_coverage_known", "Whether this runtime establishes fleet source coverage.", 0),
    `# HELP beep_observation_runtime_phase Current delivery loop phase, not fleet delivery health.\n# TYPE beep_observation_runtime_phase gauge\nbeep_observation_runtime_phase{phase="${health.phase}"} 1`,
  ];
  if (O.isSome(health.lastCycle)) {
    const cycle = health.lastCycle.value;
    lines = A.append(
      lines,
      gauge(
        "cycle_completed_timestamp_seconds",
        "Completion time of the latest cycle, including failure.",
        cycle.completedAt / 1000
      )
    );
    if (cycle.result._tag === "Completed") lines = A.appendAll(lines, completedCycleMetrics(cycle.result));
  }
  return `${A.join(lines, "\n")}\n${renderObservationSourceMetrics(health.sources)}`;
};
