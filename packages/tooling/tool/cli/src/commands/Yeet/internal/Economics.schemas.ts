/**
 * Schemas for the `yeet economics` surface: the `yeet-economics/v1` report
 * document, the normalized attempt model its fold consumes, and the command
 * options (time-to-certainty A3, rulings 73–75).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Runtime } from "effect";
import * as S from "effect/Schema";
import { YeetAttemptTerminationReason } from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetFailureKind, YeetLaneStatus, YeetOutcome } from "./Verdict.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Economics.schemas");

/**
 * Schema version of the economics report document (ruling 73).
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_ECONOMICS_SCHEMA_VERSION = "yeet-economics/v1";

/**
 * The percentile estimator every economics percentile uses (ruling 75).
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_ECONOMICS_PERCENTILE_ESTIMATOR = "nearest-rank ceil(p*n)-1";

/**
 * The rounding every economics millisecond figure uses (ruling 75): half
 * rounds up, not to even as the A1 script's `round` does.
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_ECONOMICS_ROUNDING = "Math.round";

// Plain non-negative integer counts: the report is derived, never decoded from
// operator input, so an unbranded count keeps the fold free of brand casts.
const EconomicsCount = S.Int.check(S.isGreaterThanOrEqualTo(0));
const OptionalMs = S.OptionFromNullOr(S.Int);
const OptionalString = S.OptionFromNullOr(S.String);

/**
 * One key of a count mix and how many observations carried it.
 *
 * **Details**
 *
 * Every mix in the report is an array of these rows sorted by count
 * descending, then key, so the document is deterministic.
 *
 * **Example** (Count one outcome)
 *
 * ```ts
 * import { EconomicsCountRow } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsCountRow.make({ key: "success", count: 3 }).count) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsCountRow extends S.Class<EconomicsCountRow>($I`EconomicsCountRow`)(
  {
    key: S.String,
    count: EconomicsCount,
  },
  $I.annote("EconomicsCountRow", {
    description: "One key of a count mix and how many observations carried it; mixes sort by count desc, then key.",
  })
) {}

/**
 * Whether a verdict lane is an outer wrapper lane or an inner lane a wrapper
 * ran (ruling 74).
 *
 * **Example** (Recognise an inner lane)
 *
 * ```ts
 * import { EconomicsLaneKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsLaneKind.is.inner("inner")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsLaneKind = LiteralKit(["wrapper", "inner"]).pipe(
  $I.annoteSchema("EconomicsLaneKind", {
    description: "Lane population: an outer wrapper lane or an inner lane recorded under a wrapper (ruling 74).",
  })
);

/**
 * Lane population: an outer wrapper lane or an inner lane.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsLaneKind = typeof EconomicsLaneKind.Type;

/**
 * Timing economics of one lane identity `(id, label, phase)` within one
 * population.
 *
 * **Details**
 *
 * An observation is a lane carrying a non-negative `durationMs`. `sharePct` is
 * the row's time as a percentage of its own population's time, never of both
 * populations; `statusMix` counts the statuses of this row's observations.
 *
 * **Example** (Describe a measured wrapper lane)
 *
 * ```ts
 * import { EconomicsLaneRow } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = EconomicsLaneRow.make({
 *   id: "full:pre-push",
 *   label: "full:pre-push",
 *   phase: "full",
 *   attempts: 1,
 *   executions: 1,
 *   p50DurationMs: O.some(60000),
 *   p95DurationMs: O.some(60000),
 *   totalDurationMs: 60000,
 *   sharePct: O.some(100),
 *   statusMix: [],
 * })
 * console.log(row.totalDurationMs) // 60000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsLaneRow extends S.Class<EconomicsLaneRow>($I`EconomicsLaneRow`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    attempts: EconomicsCount,
    executions: EconomicsCount,
    p50DurationMs: OptionalMs,
    p95DurationMs: OptionalMs,
    totalDurationMs: EconomicsCount,
    sharePct: S.OptionFromNullOr(S.Finite),
    statusMix: S.Array(EconomicsCountRow),
  },
  $I.annote("EconomicsLaneRow", {
    description:
      "Nearest-rank p50/p95, total and population share of one lane identity's duration-bearing observations.",
  })
) {}

/**
 * One lane population's rows and totals, with its own denominator (ruling 74).
 *
 * **Details**
 *
 * `attemptElapsedMs` sums every attempt's elapsed time (a missing value counts
 * as zero); `accountedPct` is the population's lane time as a percentage of it.
 *
 * **Example** (An empty population)
 *
 * ```ts
 * import { EconomicsLanePopulation } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const population = EconomicsLanePopulation.make({
 *   rows: [],
 *   executions: 0,
 *   totalDurationMs: 0,
 *   attemptElapsedMs: 0,
 *   accountedPct: O.none(),
 * })
 * console.log(population.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsLanePopulation extends S.Class<EconomicsLanePopulation>($I`EconomicsLanePopulation`)(
  {
    rows: S.Array(EconomicsLaneRow),
    executions: EconomicsCount,
    totalDurationMs: EconomicsCount,
    attemptElapsedMs: S.Int,
    accountedPct: S.OptionFromNullOr(S.Finite),
  },
  $I.annote("EconomicsLanePopulation", {
    description:
      "Lane rows of one population (total desc, then id, label) and that population's own totals and accounted share.",
  })
) {}

/**
 * Outcome, mode and failure-kind mixes over a set of attempts.
 *
 * **Details**
 *
 * A missing outcome, mode or failure kind counts as `unknown`; the
 * failure-kind mix covers non-success attempts only.
 *
 * **Example** (An empty mix)
 *
 * ```ts
 * import { EconomicsAttemptMix } from "@beep/repo-cli/test/Yeet"
 *
 * const mix = EconomicsAttemptMix.make({ outcomeMix: [], modeMix: [], failureKindMix: [] })
 * console.log(mix.outcomeMix.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAttemptMix extends S.Class<EconomicsAttemptMix>($I`EconomicsAttemptMix`)(
  {
    outcomeMix: S.Array(EconomicsCountRow),
    modeMix: S.Array(EconomicsCountRow),
    failureKindMix: S.Array(EconomicsCountRow),
  },
  $I.annote("EconomicsAttemptMix", {
    description:
      "Outcome, mode, and non-success failure-kind mixes over a set of attempts; missing values are unknown.",
  })
) {}

/**
 * Attempt mixes over every attempt and over the comparable subset.
 *
 * **Details**
 *
 * An attempt is comparable when its mode is `verify`, `repair` or `publish`
 * and it is not a scheduler lock bounce (ruling 75).
 *
 * **Example** (Two empty mixes)
 *
 * ```ts
 * import { EconomicsAttemptMix, EconomicsAttempts } from "@beep/repo-cli/test/Yeet"
 *
 * const empty = EconomicsAttemptMix.make({ outcomeMix: [], modeMix: [], failureKindMix: [] })
 * console.log(EconomicsAttempts.make({ all: empty, comparable: empty }).all.modeMix.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAttempts extends S.Class<EconomicsAttempts>($I`EconomicsAttempts`)(
  {
    all: EconomicsAttemptMix,
    comparable: EconomicsAttemptMix,
  },
  $I.annote("EconomicsAttempts", {
    description:
      "Attempt mixes over the whole union and over the comparable (verify/repair/publish, no bounce) subset.",
  })
) {}

/**
 * First actionable failure economics over red attempts (M2, ruling 74).
 *
 * **Details**
 *
 * The walk covers one population: the inner lanes when any inner lane failed,
 * otherwise the wrappers. The first failed lane with a duration ends the walk;
 * its start offset is the sum of the non-negative durations before it and its
 * completion offset adds its own duration. `receiptProxyMix` classifies every
 * red attempt with the A1 script's seven proxy classes.
 *
 * **Example** (No red attempts)
 *
 * ```ts
 * import { EconomicsFirstFailure } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const firstFailure = EconomicsFirstFailure.make({
 *   redAttempts: 0,
 *   attemptsWithReconstructableOuterFailure: 0,
 *   attemptsWithoutReconstructableOuterFailure: 0,
 *   startOffsetP50Ms: O.none(),
 *   startOffsetP95Ms: O.none(),
 *   completionOffsetP50Ms: O.none(),
 *   completionOffsetP95Ms: O.none(),
 *   actionableLaneMix: [],
 *   receiptProxyMix: [],
 * })
 * console.log(O.isNone(firstFailure.completionOffsetP50Ms)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsFirstFailure extends S.Class<EconomicsFirstFailure>($I`EconomicsFirstFailure`)(
  {
    redAttempts: EconomicsCount,
    attemptsWithReconstructableOuterFailure: EconomicsCount,
    attemptsWithoutReconstructableOuterFailure: EconomicsCount,
    startOffsetP50Ms: OptionalMs,
    startOffsetP95Ms: OptionalMs,
    completionOffsetP50Ms: OptionalMs,
    completionOffsetP95Ms: OptionalMs,
    actionableLaneMix: S.Array(EconomicsCountRow),
    receiptProxyMix: S.Array(EconomicsCountRow),
  },
  $I.annote("EconomicsFirstFailure", {
    description:
      "Red attempts, reconstructable first-failure offsets walked over one lane population, actionable lanes, and receipt-proxy classes.",
  })
) {}

/**
 * Red-to-green episode summary for one cut (M1, ruling 75).
 *
 * **Details**
 *
 * `closedEpisodes`, the percentiles and both minute totals cover the closed
 * episodes this cut keeps. The censoring counts are shared by both cuts: a
 * left-censored episode started at or before its journal's compaction cutoff,
 * a right-censored streak was still red at the end of its journal.
 * `closedEpisodesOver24hExcluded` is set on the 24-hour cut only.
 *
 * **Example** (An empty summary)
 *
 * ```ts
 * import { EconomicsEpisodeSummary } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const summary = EconomicsEpisodeSummary.make({
 *   label: "uncut",
 *   closedEpisodes: 0,
 *   p50Ms: O.none(),
 *   p95Ms: O.none(),
 *   totalEpisodeSpanMinutes: 0,
 *   measuredAttemptMachineMinutes: 0,
 *   leftCensoredEpisodesExcluded: 0,
 *   leftCensoredObservedAttempts: 0,
 *   rightCensoredStreaks: 0,
 *   rightCensoredRedAttempts: 0,
 *   closedEpisodesOver24hExcluded: O.none(),
 * })
 * console.log(summary.closedEpisodes) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsEpisodeSummary extends S.Class<EconomicsEpisodeSummary>($I`EconomicsEpisodeSummary`)(
  {
    label: S.String,
    closedEpisodes: EconomicsCount,
    p50Ms: OptionalMs,
    p95Ms: OptionalMs,
    totalEpisodeSpanMinutes: S.Finite,
    measuredAttemptMachineMinutes: S.Finite,
    leftCensoredEpisodesExcluded: EconomicsCount,
    leftCensoredObservedAttempts: EconomicsCount,
    rightCensoredStreaks: EconomicsCount,
    rightCensoredRedAttempts: EconomicsCount,
    closedEpisodesOver24hExcluded: S.OptionFromNullOr(EconomicsCount),
  },
  $I.annote("EconomicsEpisodeSummary", {
    description:
      "Closed red-to-green episode count, span percentiles and minute totals for one cut, plus the shared censoring counts.",
  })
) {}

/**
 * Red-to-green episodes over comparable attempts, cut at 24 hours and uncut.
 *
 * **Example** (Read the comparable cut)
 *
 * ```ts
 * import { EconomicsEpisodeSummary, EconomicsRedToGreen } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const summary = (label: string) =>
 *   EconomicsEpisodeSummary.make({
 *     label,
 *     closedEpisodes: 0,
 *     p50Ms: O.none(),
 *     p95Ms: O.none(),
 *     totalEpisodeSpanMinutes: 0,
 *     measuredAttemptMachineMinutes: 0,
 *     leftCensoredEpisodesExcluded: 0,
 *     leftCensoredObservedAttempts: 0,
 *     rightCensoredStreaks: 0,
 *     rightCensoredRedAttempts: 0,
 *     closedEpisodesOver24hExcluded: O.none(),
 *   })
 * const redToGreen = EconomicsRedToGreen.make({ comparable24h: summary("comparable24h"), uncut: summary("uncut") })
 * console.log(redToGreen.comparable24h.label) // "comparable24h"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsRedToGreen extends S.Class<EconomicsRedToGreen>($I`EconomicsRedToGreen`)(
  {
    comparable24h: EconomicsEpisodeSummary,
    uncut: EconomicsEpisodeSummary,
  },
  $I.annote("EconomicsRedToGreen", {
    description: "Red-to-green episode summaries: closed episodes of at most 24 hours, and every closed episode.",
  })
) {}

/**
 * Journaled starts, starts without a terminal row, and terminal reasons (M5).
 *
 * **Example** (No terminations)
 *
 * ```ts
 * import { EconomicsTerminations } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsTerminations.make({ starts: 0, startsWithoutFinish: 0, reasonMix: [] }).starts) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsTerminations extends S.Class<EconomicsTerminations>($I`EconomicsTerminations`)(
  {
    starts: EconomicsCount,
    startsWithoutFinish: EconomicsCount,
    reasonMix: S.Array(EconomicsCountRow),
  },
  $I.annote("EconomicsTerminations", {
    description: "Distinct started attempts, those with no terminal row, and the mix of abnormal termination reasons.",
  })
) {}

/**
 * Whether the unchanged-fingerprint metric could be measured.
 *
 * **Example** (Recognise a measured metric)
 *
 * ```ts
 * import { EconomicsFingerprintClassification } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsFingerprintClassification.is.measured("measured")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsFingerprintClassification = LiteralKit(["measured", "unmeasurable"]).pipe(
  $I.annoteSchema("EconomicsFingerprintClassification", {
    description: "M4 is measured when at least one attempt carries a diff fingerprint, otherwise unmeasurable.",
  })
);

/**
 * Whether the unchanged-fingerprint metric could be measured.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsFingerprintClassification = typeof EconomicsFingerprintClassification.Type;

/**
 * Red attempts whose next attempt went green on the same diff fingerprint (M4).
 *
 * **Example** (Nothing carried a fingerprint)
 *
 * ```ts
 * import { EconomicsUnchangedFingerprint } from "@beep/repo-cli/test/Yeet"
 *
 * const m4 = EconomicsUnchangedFingerprint.make({
 *   classification: "unmeasurable",
 *   attemptsWithFingerprint: 0,
 *   failedUnchangedFingerprintThenGreen: 0,
 * })
 * console.log(m4.classification) // "unmeasurable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsUnchangedFingerprint extends S.Class<EconomicsUnchangedFingerprint>(
  $I`EconomicsUnchangedFingerprint`
)(
  {
    classification: EconomicsFingerprintClassification,
    attemptsWithFingerprint: EconomicsCount,
    failedUnchangedFingerprintThenGreen: EconomicsCount,
  },
  $I.annote("EconomicsUnchangedFingerprint", {
    description:
      "Within one run, red attempts whose next attempt is green with the same diff fingerprint, and how many attempts carry one.",
  })
) {}

/**
 * Loader counts one journal contributes; the report sums them over every
 * journal.
 *
 * **Details**
 *
 * `journalsObserved` and `unreadableJournals` are 0 or 1 per journal. `starts`
 * counts distinct started attempts, `startsWithoutFinish` those without a
 * terminal row, and `verdictsWithoutStart` terminal rows without a start.
 *
 * **Example** (A clean journal)
 *
 * ```ts
 * import { EconomicsJournalDiagnostics } from "@beep/repo-cli/test/Yeet"
 *
 * const diagnostics = EconomicsJournalDiagnostics.make({
 *   journalsObserved: 1,
 *   unreadableJournals: 0,
 *   invalidRows: 0,
 *   compactionReceipts: 0,
 *   duplicateStartedRowsDeduplicated: 0,
 *   duplicateFinishedRowsDeduplicated: 0,
 *   orphanVerdictFilesAdded: 0,
 *   unkeyedVerdictFiles: 0,
 *   starts: 2,
 *   startsWithoutFinish: 0,
 *   verdictsWithoutStart: 0,
 * })
 * console.log(diagnostics.starts) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsJournalDiagnostics extends S.Class<EconomicsJournalDiagnostics>($I`EconomicsJournalDiagnostics`)(
  {
    journalsObserved: EconomicsCount,
    unreadableJournals: EconomicsCount,
    invalidRows: EconomicsCount,
    compactionReceipts: EconomicsCount,
    duplicateStartedRowsDeduplicated: EconomicsCount,
    duplicateFinishedRowsDeduplicated: EconomicsCount,
    orphanVerdictFilesAdded: EconomicsCount,
    unkeyedVerdictFiles: EconomicsCount,
    starts: EconomicsCount,
    startsWithoutFinish: EconomicsCount,
    verdictsWithoutStart: EconomicsCount,
  },
  $I.annote("EconomicsJournalDiagnostics", {
    description:
      "Per-journal loader counts: readability, invalid and duplicate rows, orphan verdicts, and start joins.",
  })
) {}

/**
 * Loader diagnostics over every journal in scope.
 *
 * **Example** (Diagnostics of an empty scope)
 *
 * ```ts
 * import { EconomicsDiagnostics } from "@beep/repo-cli/test/Yeet"
 *
 * const diagnostics = EconomicsDiagnostics.make({
 *   journalsObserved: 0,
 *   unreadableJournals: 0,
 *   invalidRows: 0,
 *   compactionReceipts: 0,
 *   duplicateStartedRowsDeduplicated: 0,
 *   duplicateFinishedRowsDeduplicated: 0,
 *   orphanVerdictFilesAdded: 0,
 *   unkeyedVerdictFiles: 0,
 *   starts: 0,
 *   startsWithoutFinish: 0,
 *   verdictsWithoutStart: 0,
 *   leftCensoredJournals: 0,
 *   finishedAttempts: 0,
 *   verdictV2Attempts: 0,
 *   verdictOtherAttempts: 0,
 * })
 * console.log(diagnostics.finishedAttempts) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsDiagnostics extends EconomicsJournalDiagnostics.extend<EconomicsDiagnostics>(
  $I`EconomicsDiagnostics`
)(
  {
    leftCensoredJournals: EconomicsCount,
    finishedAttempts: EconomicsCount,
    verdictV2Attempts: EconomicsCount,
    verdictOtherAttempts: EconomicsCount,
  },
  $I.annote("EconomicsDiagnostics", {
    description:
      "Summed journal loader counts plus compaction-censored journals, terminal attempts, and verdict schema versions.",
  })
) {}

/**
 * The attempt window, loader diagnostics, and the estimator the report used.
 *
 * **Example** (Data quality of an empty scope)
 *
 * ```ts
 * import { EconomicsDataQuality, EconomicsDiagnostics } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const quality = EconomicsDataQuality.make({
 *   attemptWindowStartUtc: O.none(),
 *   attemptWindowEndUtc: O.none(),
 *   diagnostics: EconomicsDiagnostics.make({
 *     journalsObserved: 0,
 *     unreadableJournals: 0,
 *     invalidRows: 0,
 *     compactionReceipts: 0,
 *     duplicateStartedRowsDeduplicated: 0,
 *     duplicateFinishedRowsDeduplicated: 0,
 *     orphanVerdictFilesAdded: 0,
 *     unkeyedVerdictFiles: 0,
 *     starts: 0,
 *     startsWithoutFinish: 0,
 *     verdictsWithoutStart: 0,
 *     leftCensoredJournals: 0,
 *     finishedAttempts: 0,
 *     verdictV2Attempts: 0,
 *     verdictOtherAttempts: 0,
 *   }),
 *   percentileEstimator: "nearest-rank ceil(p*n)-1",
 *   rounding: "Math.round",
 * })
 * console.log(quality.rounding) // "Math.round"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsDataQuality extends S.Class<EconomicsDataQuality>($I`EconomicsDataQuality`)(
  {
    attemptWindowStartUtc: OptionalString,
    attemptWindowEndUtc: OptionalString,
    diagnostics: EconomicsDiagnostics,
    percentileEstimator: S.Literal(YEET_ECONOMICS_PERCENTILE_ESTIMATOR),
    rounding: S.Literal(YEET_ECONOMICS_ROUNDING),
  },
  $I.annote("EconomicsDataQuality", {
    description:
      "Attempt window, loader diagnostics, and the estimator: nearest rank at index clamp(ceil(p*n)-1, 0, n-1), Math.round rounding (not half-to-even).",
  })
) {}

/**
 * Which journals a report read: the current checkout, one branch's run, or
 * the fleet of sibling checkouts.
 *
 * **Example** (Recognise the fleet scope)
 *
 * ```ts
 * import { EconomicsScopeKind } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(EconomicsScopeKind.is.fleet("fleet")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EconomicsScopeKind = LiteralKit(["checkout", "branch", "fleet"]).pipe(
  $I.annoteSchema("EconomicsScopeKind", {
    description: "Economics report scope: the current checkout, one branch's run directory, or the sibling fleet.",
  })
);

/**
 * Which journals a report read.
 *
 * @category models
 * @since 0.0.0
 */
export type EconomicsScopeKind = typeof EconomicsScopeKind.Type;

/**
 * The scope a report covers: its kind, the checkout labels it read (paths
 * relative to the projects root), and the branch it narrowed to.
 *
 * **Example** (A checkout scope)
 *
 * ```ts
 * import { EconomicsScope } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const scope = EconomicsScope.make({ kind: "checkout", checkouts: ["beep-effect3"], branch: O.none() })
 * console.log(scope.checkouts) // ["beep-effect3"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsScope extends S.Class<EconomicsScope>($I`EconomicsScope`)(
  {
    kind: EconomicsScopeKind,
    checkouts: S.Array(S.String),
    branch: OptionalString,
  },
  $I.annote("EconomicsScope", {
    description:
      "Report scope kind, the checkout labels read (relative to the projects root), and the narrowed branch.",
  })
) {}

/**
 * The `yeet economics` report: where a checkout's proof minutes went
 * (ruling 73).
 *
 * **Details**
 *
 * Fields shared with the A1 script's `verification-economics/v1` keep its
 * spelling so rows compare by name. Wrapper and inner lanes are separate
 * populations with separate denominators (ruling 74). Nothing here is written
 * to disk; the committed A1 `economics.json` stays owned by the script.
 *
 * **Example** (Check the schema version)
 *
 * ```ts
 * import { YEET_ECONOMICS_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_ECONOMICS_SCHEMA_VERSION) // "yeet-economics/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetEconomicsReport extends S.Class<YeetEconomicsReport>($I`YeetEconomicsReport`)(
  {
    schemaVersion: S.Literal(YEET_ECONOMICS_SCHEMA_VERSION),
    scope: EconomicsScope,
    measurementAsOf: S.String,
    attempts: EconomicsAttempts,
    wrapperLanes: EconomicsLanePopulation,
    innerLanes: EconomicsLanePopulation,
    firstFailure: EconomicsFirstFailure,
    redToGreen: EconomicsRedToGreen,
    terminations: EconomicsTerminations,
    unchangedFingerprint: EconomicsUnchangedFingerprint,
    dataQuality: EconomicsDataQuality,
  },
  $I.annote("YeetEconomicsReport", {
    description:
      "Checkout economics over live attempt journals: attempt mixes, wrapper and inner lane populations, first failure (M2), red-to-green episodes (M1), unchanged fingerprint (M4), terminations (M5), and data quality.",
  })
) {}

/**
 * JSON codec for {@link YeetEconomicsReport}; missing percentiles encode as
 * `null`.
 *
 * **Example** (Reference the codec)
 *
 * ```ts
 * import { YeetEconomicsReportJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetEconomicsReportJson.encode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetEconomicsReportJson = JsonStringCodec(YeetEconomicsReport);

/**
 * Parsed `yeet economics` flags.
 *
 * **Example** (Ask for the fleet as JSON)
 *
 * ```ts
 * import { YeetEconomicsOptions } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const options = YeetEconomicsOptions.make({ json: true, branch: O.none(), fleet: true })
 * console.log(options.fleet) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetEconomicsOptions extends S.Class<YeetEconomicsOptions>($I`YeetEconomicsOptions`)(
  {
    json: S.Boolean,
    branch: OptionalString,
    fleet: S.Boolean,
  },
  $I.annote("YeetEconomicsOptions", {
    description: "Parsed `yeet economics` flags: JSON output, an optional branch narrowing, and the sibling fleet.",
  })
) {}

/**
 * One verdict lane as the economics fold consumes it.
 *
 * **Details**
 *
 * `population` is `inner` when the lane carries `parentLaneId`; a lane from a
 * verdict written before that field existed is a `wrapper` when its id starts
 * with one of the wrapper phase prefixes, and `inner` otherwise (ruling 74).
 *
 * **Example** (An inner lane that failed)
 *
 * ```ts
 * import { EconomicsLane } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const lane = EconomicsLane.make({
 *   id: "quality:coverage",
 *   label: "quality:coverage",
 *   phase: "full",
 *   status: "failed",
 *   durationMs: O.some(1200),
 *   repairCommand: O.none(),
 *   population: "inner",
 * })
 * console.log(lane.population) // "inner"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsLane extends S.Class<EconomicsLane>($I`EconomicsLane`)(
  {
    id: S.String,
    label: S.String,
    phase: S.String,
    status: YeetLaneStatus,
    durationMs: S.OptionFromNullOr(S.Finite),
    repairCommand: OptionalString,
    population: EconomicsLaneKind,
  },
  $I.annote("EconomicsLane", {
    description: "A verdict lane's identity, status, duration, repair command, and wrapper/inner population.",
  })
) {}

/**
 * One terminal attempt, normalized from its journal rows and verdict.
 *
 * **Details**
 *
 * `startedAt` comes from the verdict, then the start row; `endedAt` from the
 * verdict's `endedAt`, then its `createdAt`, then the terminal row's
 * `recordedAt`; `elapsedMs` from the verdict, else `endedAt − startedAt`. A
 * terminated attempt has no verdict, so its `outcome` is none (red) and it
 * has no lanes.
 *
 * **Example** (A green verify attempt)
 *
 * ```ts
 * import { EconomicsAttempt } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const attempt = EconomicsAttempt.make({
 *   checkout: "beep-effect3",
 *   runId: "main-0123456789ab",
 *   attemptId: "attempt-1",
 *   branch: "main",
 *   mode: O.some("verify"),
 *   outcome: O.some("success"),
 *   failureKind: O.none(),
 *   failedStepId: O.none(),
 *   message: "",
 *   startedAt: O.some("2026-09-25T00:00:00.000Z"),
 *   endedAt: O.some("2026-09-25T00:01:00.000Z"),
 *   elapsedMs: O.some(60000),
 *   diffFingerprint: O.none(),
 *   terminationReason: O.none(),
 *   verdictSchemaVersion: O.some("yeet-verdict/v2"),
 *   lanes: [],
 * })
 * console.log(attempt.branch) // "main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsAttempt extends S.Class<EconomicsAttempt>($I`EconomicsAttempt`)(
  {
    checkout: S.String,
    runId: S.String,
    attemptId: S.String,
    branch: S.String,
    mode: OptionalString,
    outcome: S.OptionFromNullOr(YeetOutcome),
    failureKind: S.OptionFromNullOr(YeetFailureKind),
    failedStepId: OptionalString,
    message: S.String,
    startedAt: OptionalString,
    endedAt: OptionalString,
    elapsedMs: S.OptionFromNullOr(S.Finite),
    diffFingerprint: OptionalString,
    terminationReason: S.OptionFromNullOr(YeetAttemptTerminationReason),
    verdictSchemaVersion: OptionalString,
    lanes: S.Array(EconomicsLane),
  },
  $I.annote("EconomicsAttempt", {
    description:
      "One terminal attempt keyed by checkout, run and attempt id, with its resolved timing, outcome, facts, and lanes.",
  })
) {}

/**
 * Everything one run directory's journal contributes to a report.
 *
 * **Details**
 *
 * `cutoff` is the latest compaction cutoff the journal recorded
 * (`terminalEvictionCutoffRecordedAt`, else `oldestEvictedRecordedAt`); an
 * episode starting at or before it is left-censored (ruling 18).
 *
 * **Example** (An empty journal)
 *
 * ```ts
 * import { EconomicsJournal, EconomicsJournalDiagnostics } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const journal = EconomicsJournal.make({
 *   checkout: "beep-effect3",
 *   runId: "main-0123456789ab",
 *   cutoff: O.none(),
 *   attempts: [],
 *   diagnostics: EconomicsJournalDiagnostics.make({
 *     journalsObserved: 1,
 *     unreadableJournals: 0,
 *     invalidRows: 0,
 *     compactionReceipts: 0,
 *     duplicateStartedRowsDeduplicated: 0,
 *     duplicateFinishedRowsDeduplicated: 0,
 *     orphanVerdictFilesAdded: 0,
 *     unkeyedVerdictFiles: 0,
 *     starts: 0,
 *     startsWithoutFinish: 0,
 *     verdictsWithoutStart: 0,
 *   }),
 * })
 * console.log(journal.attempts.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsJournal extends S.Class<EconomicsJournal>($I`EconomicsJournal`)(
  {
    checkout: S.String,
    runId: S.String,
    cutoff: OptionalString,
    attempts: S.Array(EconomicsAttempt),
    diagnostics: EconomicsJournalDiagnostics,
  },
  $I.annote("EconomicsJournal", {
    description: "One run directory's normalized terminal attempts, compaction cutoff, and loader counts.",
  })
) {}

/**
 * What {@link YeetEconomicsReport} journals to read: the checkout root, an
 * optional branch narrowing, and whether to add the sibling fleet.
 *
 * **Example** (Request one branch's run)
 *
 * ```ts
 * import { EconomicsScopeRequest } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const request = EconomicsScopeRequest.make({ repoRoot: "/repo", branch: O.some("main"), fleet: false })
 * console.log(request.fleet) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EconomicsScopeRequest extends S.Class<EconomicsScopeRequest>($I`EconomicsScopeRequest`)(
  {
    repoRoot: S.String,
    branch: OptionalString,
    fleet: S.Boolean,
  },
  $I.annote("EconomicsScopeRequest", {
    description:
      "Checkout root, optional branch narrowing, and fleet flag the economics source resolves journals from.",
  })
) {}

/**
 * Raised when an economics scope resolves to no checkout: the checkout has no
 * `.beep/yeet/runs` and the fleet was not requested.
 *
 * **Details**
 *
 * `yeet economics` turns this into an empty report; the closeout summary
 * turns it into one log line. A bad journal never raises it.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { YeetEconomicsError } from "@beep/repo-cli/test/Yeet"
 *
 * const error = YeetEconomicsError.make({ message: "no .beep/yeet/runs under /repo" })
 * console.log(error._tag) // "YeetEconomicsError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class YeetEconomicsError extends S.TaggedError<YeetEconomicsError>($I`YeetEconomicsError`)(
  "YeetEconomicsError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annoteError<YeetEconomicsError>("YeetEconomicsError", {
    description: "An economics scope resolved to no checkout with attempt journals.",
  })
) {
  override readonly [Runtime.errorExitCode] = 1;
}
