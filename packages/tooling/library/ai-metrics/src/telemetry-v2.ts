/**
 * Canonical telemetry-v2 lifecycle and evidence vocabularies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as Order from "effect/Order";

const $I = $RepoAiMetricsId.create("telemetry-v2");

/**
 * Orthogonal lifecycle state of a coding-agent session.
 *
 * **Example** (Represent a blocked session without changing its phase)
 *
 * ```ts
 * import { LifecycleState } from "@beep/repo-ai-metrics"
 *
 * console.log(LifecycleState.Enum.waiting) // "waiting"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LifecycleState = LiteralKit([
  "queued",
  "active",
  "waiting",
  "idle",
  "recovering",
  "terminal",
  "unknown",
]).pipe(
  $I.annoteSchema("LifecycleState", {
    description: "State of a coding-agent session, independent of its active work phase and terminal outcome.",
  })
);

/**
 * Decoded telemetry-v2 lifecycle state.
 *
 * @see {@link LifecycleState} for the runtime schema and exhaustive helpers.
 * @category models
 * @since 0.0.0
 */
export type LifecycleState = typeof LifecycleState.Type;

/**
 * Phase of work a coding-agent session is actively performing.
 *
 * **Example** (Distinguish phase from lifecycle state)
 *
 * ```ts
 * import { ActivePhase } from "@beep/repo-ai-metrics"
 *
 * console.log(ActivePhase.Enum.verification) // "verification"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ActivePhase = LiteralKit([
  "orchestration",
  "planning",
  "inference",
  "tool-preparation",
  "tool-execution",
  "result-processing",
  "hook-policy",
  "compaction",
  "verification",
  "review",
  "publication",
  "none",
  "unknown",
]).pipe(
  $I.annoteSchema("ActivePhase", {
    description: "Active work phase, recorded independently of lifecycle state and wait attribution.",
  })
);

/**
 * Decoded telemetry-v2 active phase.
 *
 * @see {@link ActivePhase} for the runtime schema and exhaustive helpers.
 * @category models
 * @since 0.0.0
 */
export type ActivePhase = typeof ActivePhase.Type;

/**
 * Reason a session is waiting, with `none` kept distinct from an unknown wait.
 *
 * **Details**
 *
 * The first five cases preserve the hook-pulse/v1 vocabulary. The additional
 * cases cover queueing, coordination, and external dependencies needed by
 * telemetry-v2 and later Yeet checkpoints without collapsing plan approval
 * and tool permission into one generic approval.
 *
 * **Example** (Keep no-wait separate from unattributed waiting)
 *
 * ```ts
 * import { WaitReason } from "@beep/repo-ai-metrics"
 *
 * console.log(WaitReason.Enum.none) // "none"
 * console.log(WaitReason.Enum.unknown) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WaitReason = LiteralKit([
  "plan-approval",
  "tool-permission",
  "idle-input",
  "none",
  "unknown",
  "elicitation",
  "queue",
  "subagent-join",
  "external-async",
  "backoff",
  "rate-limit",
  "lock",
  "scheduler",
  "transport",
]).pipe(
  $I.annoteSchema("WaitReason", {
    description: "Bounded reason a coding-agent session or operator lane is waiting.",
  })
);

/**
 * Decoded telemetry-v2 wait reason.
 *
 * @see {@link WaitReason} for the runtime schema and exhaustive helpers.
 * @category models
 * @since 0.0.0
 */
export type WaitReason = typeof WaitReason.Type;

/**
 * Semantic outcome of a terminal session, independent of how it was observed.
 *
 * **Gotchas**
 *
 * Tombstoning is deliberately absent. A tombstone is reconstruction
 * provenance, represented by {@link EvidenceTier}, not a semantic outcome.
 *
 * **Example** (Represent a reconstructed interruption)
 *
 * ```ts
 * import { EvidenceTier, TerminalOutcome } from "@beep/repo-ai-metrics"
 *
 * console.log(TerminalOutcome.Enum.interrupted) // "interrupted"
 * console.log(EvidenceTier.Enum.reconstructed) // "reconstructed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TerminalOutcome = LiteralKit([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
  "declined",
  "timed-out",
  "abandoned",
  "none",
  "unknown",
]).pipe(
  $I.annoteSchema("TerminalOutcome", {
    description: "Semantic terminal outcome, independent of terminal evidence provenance.",
  })
);

/**
 * Decoded telemetry-v2 terminal outcome.
 *
 * @see {@link TerminalOutcome} for the runtime schema and exhaustive helpers.
 * @category models
 * @since 0.0.0
 */
export type TerminalOutcome = typeof TerminalOutcome.Type;

/**
 * Provenance tier ordered from strongest direct observation to unknown.
 *
 * **Details**
 *
 * `reconstructed` is weaker than an ordinary derivation and stronger than a
 * heuristic. It identifies transcript or lease reconciliation that recovers a
 * record absent from the first-person channel.
 *
 * **Example** (Inspect the weakest-link order)
 *
 * ```ts
 * import { EvidenceTier } from "@beep/repo-ai-metrics"
 *
 * console.log(EvidenceTier.Options)
 * // ["observed", "derived", "reconstructed", "heuristic", "unknown"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvidenceTier = LiteralKit(["observed", "derived", "reconstructed", "heuristic", "unknown"]).pipe(
  $I.annoteSchema("EvidenceTier", {
    description: "Weakest-link provenance tier carried by every telemetry-v2 fact and aggregate.",
  })
);

/**
 * Decoded telemetry-v2 evidence tier.
 *
 * @see {@link EvidenceTier} for the runtime schema and strongest-to-weakest order.
 * @category models
 * @since 0.0.0
 */
export type EvidenceTier = typeof EvidenceTier.Type;

const evidenceTierRank = EvidenceTier.$match({
  observed: () => 0,
  derived: () => 1,
  reconstructed: () => 2,
  heuristic: () => 3,
  unknown: () => 4,
});
const evidenceTierOrder = Order.mapInput(Num.Order, evidenceTierRank);

/**
 * Return the weakest evidence tier in an input collection.
 *
 * **Details**
 *
 * An empty collection has no weaker ancestor and therefore returns
 * `observed`. Callers combine that identity value with the tier of the value
 * being derived.
 *
 * **Example** (Prevent an evidence-tier upgrade)
 *
 * ```ts
 * import { weakestEvidenceTier } from "@beep/repo-ai-metrics"
 *
 * console.log(weakestEvidenceTier(["observed", "reconstructed", "derived"]))
 * // "reconstructed"
 * ```
 *
 * @param tiers - Evidence tiers contributing to a derived value.
 * @returns The weakest tier present, or `observed` for the empty identity case.
 * @category utilities
 * @since 0.0.0
 */
export const weakestEvidenceTier = (tiers: ReadonlyArray<EvidenceTier>): EvidenceTier =>
  A.reduce(tiers, EvidenceTier.Enum.observed, Order.max(evidenceTierOrder));

/**
 * Bounded policy reason an enumerated ingest subject was intentionally skipped.
 *
 * **Details**
 *
 * The initial vocabulary contains only the reason exercised by the first real
 * schema-only workstation manifest. Operational reasons are added only when a
 * real ingest path demonstrates them; unreachable sources are never encoded as
 * skips.
 *
 * **Example** (Label a schema-only inventory pass)
 *
 * ```ts
 * import { SkipReason } from "@beep/repo-ai-metrics"
 *
 * console.log(SkipReason.Enum["dry-run"]) // "dry-run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkipReason = LiteralKit(["dry-run"]).pipe(
  $I.annoteSchema("SkipReason", {
    description: "Bounded policy reason for intentionally skipping an enumerated ingest subject.",
  })
);

/**
 * Decoded telemetry-v2 ingest skip reason.
 *
 * @see {@link SkipReason} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type SkipReason = typeof SkipReason.Type;

/**
 * Experimental role used to exclude metrics-system work from default baselines.
 *
 * **Example** (Select production sessions)
 *
 * ```ts
 * import { InstrumentClass } from "@beep/repo-ai-metrics"
 *
 * console.log(InstrumentClass.Enum.production) // "production"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InstrumentClass = LiteralKit(["production", "spike", "meta"]).pipe(
  $I.annoteSchema("InstrumentClass", {
    description: "Experimental role controlling inclusion in default effectiveness baselines.",
  })
);

/**
 * Decoded telemetry-v2 instrument class.
 *
 * @see {@link InstrumentClass} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type InstrumentClass = typeof InstrumentClass.Type;

/**
 * Confidentiality taint carried from source evidence through derived records.
 *
 * **Example** (Keep an uninspected source honest)
 *
 * ```ts
 * import { OipTaint } from "@beep/repo-ai-metrics"
 *
 * console.log(OipTaint.Enum.unknown) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OipTaint = LiteralKit(["clear", "tainted", "unknown"]).pipe(
  $I.annoteSchema("OipTaint", {
    description: "OIP confidentiality taint propagated from source evidence into telemetry-v2 outputs.",
  })
);

/**
 * Decoded telemetry-v2 OIP confidentiality taint.
 *
 * @see {@link OipTaint} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type OipTaint = typeof OipTaint.Type;

const oipTaintRank = OipTaint.$match({
  clear: () => 0,
  unknown: () => 1,
  tainted: () => 2,
});
const oipTaintOrder = Order.mapInput(Num.Order, oipTaintRank);

/**
 * Propagate the most restrictive OIP taint through a derived value.
 *
 * **Example** (Preserve taint through aggregation)
 *
 * ```ts
 * import { combineOipTaints } from "@beep/repo-ai-metrics"
 *
 * console.log(combineOipTaints(["clear", "tainted"])) // "tainted"
 * ```
 *
 * @param taints - Taints carried by contributing evidence.
 * @returns `tainted` when any input is tainted, otherwise `unknown` when any input is unknown.
 * @category utilities
 * @since 0.0.0
 */
export const combineOipTaints = (taints: ReadonlyArray<OipTaint>): OipTaint =>
  A.reduce(taints, OipTaint.Enum.clear, Order.max(oipTaintOrder));
