/**
 * Bounded source-cycle observations without private paths or fleet coverage claims.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { TranscriptDiscoveryReport } from "./transcript-discovery.ts";
import type * as Effect from "effect/Effect";
import type { runDiscoveredTranscriptSweep } from "./transcript-discovery.ts";

const $I = $RepoAiMetricsId.create("observation-source-health");
/**
 * One source pass, distinct from unique events and backend delivery.
 * **Example** (Inspecting source observations)
 * ```ts
 * import { ObservationSourceSummary } from "@beep/repo-ai-metrics/observation-source-health"
 * console.log(typeof ObservationSourceSummary.make)
 * ```
 * **Details** Accepted means local durable page acceptance, possibly a replay. Partial tails are explicitly waiting. Root traversal observations are not an atomic snapshot or an independent coverage denominator.
 * @category models
 * @since 0.0.0
 */
export class ObservationSourceSummary extends S.Opaque<ObservationSourceSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    discovery: TranscriptDiscoveryReport,
    acceptedPages: S.Natural,
    acceptedFrames: S.Natural,
    idleFiles: S.Natural,
    partialFiles: S.Natural,
    failedFiles: S.Natural,
  }).pipe(
    $I.annoteSchema("ObservationSourceSummary", {
      description: "Latest source pass observations, not delivery counts.",
    })
  )
) {}
/**
 * Source-cycle result retaining unknown progress after failure or interruption.
 * **Example** (Inspecting cycle alternatives)
 * ```ts
 * import { ObservationSourceCycle } from "@beep/repo-ai-metrics/observation-source-health"
 * console.log(ObservationSourceCycle.cases.Deadline)
 * ```
 * @category models
 * @since 0.0.0
 */
export const ObservationSourceCycle = S.TaggedUnion({
  Completed: { summary: ObservationSourceSummary },
  Paused: {},
  Deadline: {},
  Failed: {},
}).pipe(
  $I.annoteSchema("ObservationSourceCycle", {
    description: "Source work observation with explicit incomplete outcomes.",
  })
);
/**
 * Runtime type for source-cycle results.
 * **Example** See `ObservationSourceCycle`.
 * @category models
 * @since 0.0.0
 */
export type ObservationSourceCycle = typeof ObservationSourceCycle.Type;
/**
 * Source cadence health with independently aged cycle observations.
 * **Example** (Inspecting health alternatives)
 * ```ts
 * import { ObservationSourceHealth } from "@beep/repo-ai-metrics/observation-source-health"
 * console.log(ObservationSourceHealth.cases.NotConfigured)
 * ```
 * **Details** Missing configuration is not an empty population. Idle means completed current traversals whose discovered files are assessed, with no accepted progress, unread backlog, partial tails or failed reads; it is not proof of fleet capture. Staleness must also be evaluated by an external observer after process death.
 * @category models
 * @since 0.0.0
 */
export const ObservationSourceHealth = S.TaggedUnion({
  NotConfigured: {},
  Configured: {
    observedAt: S.Natural,
    running: S.Boolean,
    phase: S.Literals([
      "stopped",
      "starting",
      "paused",
      "scanning",
      "waiting",
      "backlogged",
      "idle",
      "active",
      "excluded",
      "degraded",
      "stale",
      "clock-regression",
    ]),
    lastCycle: S.Option(S.Struct({ startedAt: S.Natural, completedAt: S.Natural, result: ObservationSourceCycle })),
    lastCycleAgeMillis: S.Option(S.Natural),
  },
}).pipe(
  $I.annoteSchema("ObservationSourceHealth", {
    description: "Content-free source runtime state; unknown coverage is preserved.",
  })
);
/**
 * Runtime type for source health.
 * **Example** See `ObservationSourceHealth`.
 * @category models
 * @since 0.0.0
 */
export type ObservationSourceHealth = typeof ObservationSourceHealth.Type;
/**
 * Summarize safe reader outcomes without retaining private candidate declarations.
 * **Example** (Inspecting the summarizer)
 * ```ts
 * import { summarizeObservationSources } from "@beep/repo-ai-metrics/observation-source-health"
 * console.log(typeof summarizeObservationSources)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const summarizeObservationSources = (pass: Effect.Success<ReturnType<typeof runDiscoveredTranscriptSweep>>) =>
  ObservationSourceSummary.make({
    discovery: pass.discovery,
    acceptedPages: A.filter(pass.sweep.outcomes, (o) => o._tag === "Accepted").length,
    acceptedFrames: A.reduce(pass.sweep.outcomes, 0, (n, o) => n + (o._tag === "Accepted" ? o.receipt.frames : 0)),
    idleFiles: A.filter(pass.sweep.outcomes, (o) => o._tag === "Idle" && !o.waitingForPartialLine).length,
    partialFiles: A.filter(
      pass.sweep.outcomes,
      (o) => (o._tag === "Idle" || o._tag === "Accepted") && o.waitingForPartialLine
    ).length,
    failedFiles: A.filter(pass.sweep.outcomes, (o) => o._tag === "Failed").length,
  });
/**
 * Render source gauges using only fixed names and enumerated state labels.
 * **Example** (Rendering no configured discovery)
 * ```ts
 * import { ObservationSourceHealth, renderObservationSourceMetrics } from "@beep/repo-ai-metrics/observation-source-health"
 * console.log(renderObservationSourceMetrics(ObservationSourceHealth.cases.NotConfigured.make({})))
 * ```
 * **Details** Never label paths, source IDs or content. Missing counts after failure/deadline remain omitted. Latest-pass gauges are not lifetime totals. Root state counts concern declared roots only.
 * @category utilities
 * @since 0.0.0
 */
export const renderObservationSourceMetrics = (health: ObservationSourceHealth): string => {
  const gauge = (name: string, help: string, value: number) =>
    `# HELP beep_observation_sources_${name} ${help}\n# TYPE beep_observation_sources_${name} gauge\nbeep_observation_sources_${name} ${value}`;
  let lines = [
    gauge("configured", "Whether explicit source discovery is configured.", health._tag === "Configured" ? 1 : 0),
  ];
  if (health._tag === "Configured") {
    lines = A.appendAll(lines, [
      gauge("running", "Whether the shared runtime owner is running.", health.running ? 1 : 0),
      gauge("observed_timestamp_seconds", "Time this source health was observed.", health.observedAt / 1000),
      `# HELP beep_observation_sources_phase Current source cycle phase.\n# TYPE beep_observation_sources_phase gauge\nbeep_observation_sources_phase{phase="${health.phase}"} 1`,
    ]);
    if (O.isSome(health.lastCycle)) {
      const cycle = health.lastCycle.value;
      lines = A.append(
        lines,
        gauge(
          "cycle_completed_timestamp_seconds",
          "Time the latest source cycle completed, including failure.",
          cycle.completedAt / 1000
        )
      );
      if (cycle.result._tag === "Completed") {
        const s = cycle.result.summary;
        lines = A.appendAll(lines, [
          gauge(
            "pass_accepted_pages",
            "Locally accepted page observations in the latest pass, not deliveries.",
            s.acceptedPages
          ),
          gauge(
            "pass_accepted_frames",
            "Accepted frame occurrences in the latest pass, not unique events.",
            s.acceptedFrames
          ),
          gauge("pass_idle_files", "Selected files with no accepted progress or partial tail.", s.idleFiles),
          gauge("pass_partial_files", "Selected files waiting for a complete line.", s.partialFiles),
          gauge("pass_failed_files", "Failed selected source operations in this pass.", s.failedFiles),
          gauge(
            "active_helpers",
            "Helpers active at the latest completed source observation.",
            s.discovery.activeHelpers
          ),
          gauge("pass_operations", "Directory operations consumed during this pass.", s.discovery.operations),
        ]);
        lines = A.appendAll(lines, [
          gauge(
            "cycle_pending_files",
            "Discovered file observations not yet assessed in current root cycles.",
            A.reduce(s.discovery.roots, 0, (n, r) => n + r.read.pending)
          ),
          gauge(
            "cycle_partial_files",
            "File observations with incomplete tails in current root cycles.",
            A.reduce(s.discovery.roots, 0, (n, r) => n + r.read.partial)
          ),
          gauge(
            "cycle_failed_files",
            "Failed file observations in current root cycles.",
            A.reduce(s.discovery.roots, 0, (n, r) => n + r.read.failed)
          ),
          gauge(
            "cycle_backlogged_files",
            "Assessed file observations with unread bytes beyond the bounded page.",
            A.reduce(s.discovery.roots, 0, (n, r) => n + r.read.backlogged)
          ),
          gauge(
            "cycle_assessed_files",
            "File observations assessed in current root cycles, not fleet sources.",
            A.reduce(s.discovery.roots, 0, (n, r) => n + r.read.assessed)
          ),
        ]);
        lines = A.appendAll(lines, [
          "# HELP beep_observation_sources_roots Declared roots by observed traversal state.\n# TYPE beep_observation_sources_roots gauge",
          ...A.map(
            TranscriptDiscoveryReport.fields.roots.value.fields.state.literals,
            (state) =>
              `beep_observation_sources_roots{state="${state}"} ${A.filter(s.discovery.roots, (r) => r.state === state).length}`
          ),
        ]);
      }
    }
  }
  return `${A.join(lines, "\n")}\n`;
};
