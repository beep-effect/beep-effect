/**
 * The `agent-output-census/v1` report and the baseline file that records one census run.
 *
 * **Details**
 *
 * The report holds aggregates only: counts, character and token totals, shares and fitted constants.
 * Every string in it is a closed literal domain from `census-rules`, an ISO timestamp, or a version tag;
 * no transcript text, command text, path or identifier can be represented. Shares and fitted values are
 * `null` when their denominator is zero.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CalibrationBin,
  CensusOffender,
  CensusRuleVersion,
  FilterHabit,
  LineClass,
  ToolOutputClass,
  TurnClass,
  VerificationKind,
  YeetSubcommand,
} from "./census-rules.ts";

const $I = $RepoAiMetricsId.create("census-report");

const Count = S.Natural.pipe($I.annoteSchema("CensusCount", { description: "A non-negative integer count." }));
const Measure = S.Finite.pipe($I.annoteSchema("CensusMeasure", { description: "A finite measured or fitted value." }));
const OptionalMeasure = S.OptionFromNullOr(Measure);

/**
 * Whether the census ran on the reference repository name or another one.
 *
 * **Details**
 *
 * The repository name is a selection input, not report content, so the report records only whether it was
 * the reference value (`beep-effect`).
 *
 * **Example** (Check the repository selection)
 *
 * ```ts
 * import { CensusRepositorySelection } from "@beep/repo-ai-metrics/census-report"
 * console.log(CensusRepositorySelection.is.reference("reference")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CensusRepositorySelection = LiteralKit(["reference", "other"]).pipe(
  $I.annoteSchema("CensusRepositorySelection", {
    description: "Whether the repository name matched the reference value.",
  })
);

/**
 * Runtime type for {@link CensusRepositorySelection}.
 *
 * **Example** (Type a repository selection)
 *
 * ```ts
 * import type { CensusRepositorySelection } from "@beep/repo-ai-metrics/census-report"
 * const selection: CensusRepositorySelection = "reference"
 * console.log(selection)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CensusRepositorySelection = typeof CensusRepositorySelection.Type;

/**
 * The census window: records with a timestamp within both bounds are counted.
 *
 * **Example** (Decode a window)
 *
 * ```ts
 * import { CensusWindow } from "@beep/repo-ai-metrics/census-report"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * const window = Effect.runSync(
 *   S.decodeUnknownEffect(CensusWindow)({ since: "2026-11-11T11:56:00Z", until: "2026-11-18T11:57:45Z" })
 * )
 * console.log(window.until)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusWindow extends S.Opaque<CensusWindow, { readonly brand: unique symbol }>()(
  S.Struct({ since: S.DateTimeUtcFromString, until: S.DateTimeUtcFromString }).pipe(
    $I.annoteSchema("CensusWindow", { description: "Inclusive lower and upper record-time bounds." })
  )
) {}

/**
 * The Claude Code corpus: absent when its root does not exist, never zero.
 *
 * **Details**
 *
 * `filesScanned` counts the selected files; `contextsActive` the files with an API call in the window, split
 * into `sessions` and `subagents`. `compactionBoundaries` counts compactions inside the window.
 * `oversizedLines` and `oversizedBytes` count lines larger than the transcript page reader's bound in every file
 * opened (scanned or not), which
 * the census still parses. `unreadableFiles` counts transcript files and directories under the root that could not
 * be inspected, listed or read; a non-zero count means the census is incomplete.
 *
 * **Example** (Construct an absent Claude corpus)
 *
 * ```ts
 * import { ClaudeCorpus } from "@beep/repo-ai-metrics/census-report"
 * console.log(ClaudeCorpus.cases.Absent.make({})._tag) // "Absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaudeCorpus = S.TaggedUnion({
  Absent: {},
  Present: {
    filesScanned: Count,
    contextsActive: Count,
    sessions: Count,
    subagents: Count,
    compactionBoundaries: Count,
    oversizedLines: Count,
    oversizedBytes: Count,
    unreadableFiles: Count,
  },
}).pipe($I.annoteSchema("ClaudeCorpus", { description: "Selected and active Claude Code contexts." }));

/**
 * Runtime type for {@link ClaudeCorpus}.
 *
 * **Example** (Type an absent Claude corpus)
 *
 * ```ts
 * import type { ClaudeCorpus } from "@beep/repo-ai-metrics/census-report"
 * const corpus: ClaudeCorpus = { _tag: "Absent" }
 * console.log(corpus._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClaudeCorpus = typeof ClaudeCorpus.Type;

/**
 * The Codex corpus: absent when its root does not exist, never zero.
 *
 * **Details**
 *
 * `filesScanned` counts the selected files and `sessions` the ones whose session belongs to the repository.
 *
 * **Example** (Construct an absent Codex corpus)
 *
 * ```ts
 * import { CodexCorpus } from "@beep/repo-ai-metrics/census-report"
 * console.log(CodexCorpus.cases.Absent.make({})._tag) // "Absent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexCorpus = S.TaggedUnion({
  Absent: {},
  Present: {
    filesScanned: Count,
    sessions: Count,
    oversizedLines: Count,
    oversizedBytes: Count,
    unreadableFiles: Count,
  },
}).pipe($I.annoteSchema("CodexCorpus", { description: "Selected and matched Codex sessions." }));

/**
 * Runtime type for {@link CodexCorpus}.
 *
 * **Example** (Type an absent Codex corpus)
 *
 * ```ts
 * import type { CodexCorpus } from "@beep/repo-ai-metrics/census-report"
 * const corpus: CodexCorpus = { _tag: "Absent" }
 * console.log(corpus._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CodexCorpus = typeof CodexCorpus.Type;

/**
 * The corpus row: what was read, printed before any other table.
 *
 * **Example** (Construct an empty corpus)
 *
 * ```ts
 * import { CensusCorpus, ClaudeCorpus, CodexCorpus } from "@beep/repo-ai-metrics/census-report"
 * const corpus = CensusCorpus.make({ claude: ClaudeCorpus.cases.Absent.make({}), codex: CodexCorpus.cases.Absent.make({}) })
 * console.log(corpus.claude._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusCorpus extends S.Opaque<CensusCorpus, { readonly brand: unique symbol }>()(
  S.Struct({ claude: ClaudeCorpus, codex: CodexCorpus }).pipe(
    $I.annoteSchema("CensusCorpus", { description: "Both harnesses' corpora." })
  )
) {}

/**
 * Token and tool-output totals of one Claude population.
 *
 * **Details**
 *
 * `contextTokens` is input plus cache creation plus cache read: the context each API call read.
 *
 * **Example** (Construct zero Claude totals)
 *
 * ```ts
 * import { ClaudeTotals } from "@beep/repo-ai-metrics/census-report"
 * const totals = ClaudeTotals.make({
 *   apiCalls: 0, inputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, outputTokens: 0,
 *   contextTokens: 0, toolOutputChars: 0, verificationChars: 0,
 * })
 * console.log(totals.apiCalls) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeTotals extends S.Opaque<ClaudeTotals, { readonly brand: unique symbol }>()(
  S.Struct({
    apiCalls: Count,
    inputTokens: Count,
    cacheCreationTokens: Count,
    cacheReadTokens: Count,
    outputTokens: Count,
    contextTokens: Count,
    toolOutputChars: Count,
    verificationChars: Count,
  }).pipe($I.annoteSchema("ClaudeTotals", { description: "One Claude population's API calls and output." }))
) {}

/**
 * Token and tool-output totals of the Codex sessions.
 *
 * **Details**
 *
 * Token counts are each session's cumulative usage at its last token-count record at or before the window end,
 * which can be a record from before the window start.
 * Codex records do not count API calls.
 *
 * **Example** (Construct zero Codex totals)
 *
 * ```ts
 * import { CodexTotals } from "@beep/repo-ai-metrics/census-report"
 * const totals = CodexTotals.make({
 *   inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, toolOutputChars: 0, verificationChars: 0,
 * })
 * console.log(totals.inputTokens) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodexTotals extends S.Opaque<CodexTotals, { readonly brand: unique symbol }>()(
  S.Struct({
    inputTokens: Count,
    cachedInputTokens: Count,
    outputTokens: Count,
    toolOutputChars: Count,
    verificationChars: Count,
  }).pipe($I.annoteSchema("CodexTotals", { description: "Codex token usage and tool output." }))
) {}

/**
 * Totals by harness; a harness whose root is absent has no totals.
 *
 * **Example** (Inspect the totals fields)
 *
 * ```ts
 * import { CensusTotals } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(CensusTotals.fields)) // ["claudeSessions", "claudeSubagents", "codex"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusTotals extends S.Opaque<CensusTotals, { readonly brand: unique symbol }>()(
  S.Struct({
    claudeSessions: S.OptionFromNullOr(ClaudeTotals),
    claudeSubagents: S.OptionFromNullOr(ClaudeTotals),
    codex: S.OptionFromNullOr(CodexTotals),
  }).pipe($I.annoteSchema("CensusTotals", { description: "API calls, context read and tool output by harness." }))
) {}

/**
 * Tool output attributed to one class (or class group) in one harness.
 *
 * **Details**
 *
 * `carriedCharTurns` is each result's characters times the later API calls in its context before the next
 * compaction (Claude only). `shareOfToolOutput` divides by the harness's tool output; `shareOfContextRead`
 * converts carried characters to tokens with the measured chars per token and divides by the context read.
 *
 * **Example** (Construct an empty volume)
 *
 * ```ts
 * import { OutputVolume } from "@beep/repo-ai-metrics/census-report"
 * import * as O from "effect/Option"
 * const volume = OutputVolume.make({
 *   results: 0, chars: 0, carriedCharTurns: 0, filteredResults: 0, persistedResults: 0,
 *   shareOfToolOutput: O.none(), shareOfContextRead: O.none(),
 * })
 * console.log(volume.chars) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OutputVolume extends S.Opaque<OutputVolume, { readonly brand: unique symbol }>()(
  S.Struct({
    results: Count,
    chars: Count,
    carriedCharTurns: Count,
    filteredResults: Count,
    persistedResults: Count,
    shareOfToolOutput: OptionalMeasure,
    shareOfContextRead: OptionalMeasure,
  }).pipe($I.annoteSchema("OutputVolume", { description: "Results, characters and carried cost of one class." }))
) {}

/**
 * One row of where tool output goes: Claude (sessions plus subagents) and Codex.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { ToolOutputRow } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(ToolOutputRow.fields)) // ["toolOutputClass", "claude", "codex"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolOutputRow extends S.Opaque<ToolOutputRow, { readonly brand: unique symbol }>()(
  S.Struct({ toolOutputClass: ToolOutputClass, claude: OutputVolume, codex: OutputVolume }).pipe(
    $I.annoteSchema("ToolOutputRow", { description: "Tool output of one class in both harnesses." })
  )
) {}

/**
 * A group total of where tool output goes.
 *
 * **Example** (Inspect the group fields)
 *
 * ```ts
 * import { ToolOutputGroup } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(ToolOutputGroup.fields)) // ["claude", "codex"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolOutputGroup extends S.Opaque<ToolOutputGroup, { readonly brand: unique symbol }>()(
  S.Struct({ claude: OutputVolume, codex: OutputVolume }).pipe(
    $I.annoteSchema("ToolOutputGroup", { description: "Tool output of a group of classes in both harnesses." })
  )
) {}

/**
 * Where tool output goes: every class, the verification group, and all tool output.
 *
 * **Example** (Inspect the section fields)
 *
 * ```ts
 * import { CensusToolOutput } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(CensusToolOutput.fields)) // ["rows", "verification", "all"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusToolOutput extends S.Opaque<CensusToolOutput, { readonly brand: unique symbol }>()(
  S.Struct({ rows: S.Array(ToolOutputRow), verification: ToolOutputGroup, all: ToolOutputGroup }).pipe(
    $I.annoteSchema("CensusToolOutput", { description: "Tool output by class with group totals." })
  )
) {}

/**
 * Verification output of one kind.
 *
 * **Details**
 *
 * `claudeShareOfVerification` divides by all Claude verification output; `claudeShareOfContextRead` is as in
 * {@link OutputVolume}.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { VerificationKindRow } from "@beep/repo-ai-metrics/census-report"
 * console.log("claudeShareOfVerification" in VerificationKindRow.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerificationKindRow extends S.Opaque<VerificationKindRow, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: VerificationKind,
    claudeChars: Count,
    claudeShareOfVerification: OptionalMeasure,
    claudeShareOfContextRead: OptionalMeasure,
    codexChars: Count,
  }).pipe($I.annoteSchema("VerificationKindRow", { description: "Verification output of one kind." }))
) {}

/**
 * Yeet output by sub-command, both harnesses together.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { YeetSubcommandRow } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(YeetSubcommandRow.fields)) // ["subcommand", "results", "chars"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetSubcommandRow extends S.Opaque<YeetSubcommandRow, { readonly brand: unique symbol }>()(
  S.Struct({ subcommand: YeetSubcommand, results: Count, chars: Count }).pipe(
    $I.annoteSchema("YeetSubcommandRow", { description: "Results and characters of one Yeet sub-command." })
  )
) {}

/**
 * How many runs of one verification kind carried each filter habit.
 *
 * **Example** (Inspect a habit count)
 *
 * ```ts
 * import { FilterHabitCount } from "@beep/repo-ai-metrics/census-report"
 * console.log(FilterHabitCount.make({ habit: "tail", runs: 3 }).runs) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilterHabitCount extends S.Opaque<FilterHabitCount, { readonly brand: unique symbol }>()(
  S.Struct({ habit: FilterHabit, runs: Count }).pipe(
    $I.annoteSchema("FilterHabitCount", { description: "Runs carrying one filter habit." })
  )
) {}

/**
 * Filter habits of one verification kind, both harnesses together.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { FilterHabitRow } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(FilterHabitRow.fields)) // ["kind", "runs", "habits"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilterHabitRow extends S.Opaque<FilterHabitRow, { readonly brand: unique symbol }>()(
  S.Struct({ kind: VerificationKind, runs: Count, habits: S.Array(FilterHabitCount) }).pipe(
    $I.annoteSchema("FilterHabitRow", { description: "Verification runs of one kind and their filter habits." })
  )
) {}

/**
 * Filter habits by kind and over all verification runs.
 *
 * **Example** (Inspect the section fields)
 *
 * ```ts
 * import { CensusFilterHabits } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(CensusFilterHabits.fields)) // ["rows", "allRuns", "allHabits"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusFilterHabits extends S.Opaque<CensusFilterHabits, { readonly brand: unique symbol }>()(
  S.Struct({ rows: S.Array(FilterHabitRow), allRuns: Count, allHabits: S.Array(FilterHabitCount) }).pipe(
    $I.annoteSchema("CensusFilterHabits", { description: "How agents already cut verification output." })
  )
) {}

/**
 * Claude API calls of one turn class.
 *
 * **Details**
 *
 * `resultChars` counts the results of the calls that earned the class: verification runs, digs and CI fetches.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { TurnClassRow } from "@beep/repo-ai-metrics/census-report"
 * console.log("shareOfContextRead" in TurnClassRow.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurnClassRow extends S.Opaque<TurnClassRow, { readonly brand: unique symbol }>()(
  S.Struct({
    turnClass: TurnClass,
    turns: Count,
    shareOfTurns: OptionalMeasure,
    contextTokens: Count,
    shareOfContextRead: OptionalMeasure,
    resultChars: Count,
  }).pipe($I.annoteSchema("TurnClassRow", { description: "API calls and context read of one turn class." }))
) {}

/**
 * How many log digs followed each verification run before the next run.
 *
 * **Example** (Inspect the distribution fields)
 *
 * ```ts
 * import { DigFollowUp } from "@beep/repo-ai-metrics/census-report"
 * console.log("threeOrMore" in DigFollowUp.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DigFollowUp extends S.Opaque<DigFollowUp, { readonly brand: unique symbol }>()(
  S.Struct({
    runs: Count,
    zero: Count,
    one: Count,
    two: Count,
    threeOrMore: Count,
    max: Count,
    mean: OptionalMeasure,
  }).pipe($I.annoteSchema("DigFollowUp", { description: "The distribution of log digs per verification run." }))
) {}

/**
 * What the Claude turns cost.
 *
 * **Example** (Inspect the section fields)
 *
 * ```ts
 * import { CensusTurns } from "@beep/repo-ai-metrics/census-report"
 * console.log("digFollowUp" in CensusTurns.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusTurns extends S.Opaque<CensusTurns, { readonly brand: unique symbol }>()(
  S.Struct({
    turns: Count,
    contextTokens: Count,
    rows: S.Array(TurnClassRow),
    verificationRuns: Count,
    redirectedRuns: Count,
    rerunsNoEdit: Count,
    rerunsSameCommand: Count,
    logDigs: Count,
    ciLogFetches: Count,
    digFollowUp: DigFollowUp,
  }).pipe($I.annoteSchema("CensusTurns", { description: "Turn classes and verification follow-up turns." }))
) {}

/**
 * Characters of one line class.
 *
 * **Example** (Construct a line-class share)
 *
 * ```ts
 * import { LineClassChars } from "@beep/repo-ai-metrics/census-report"
 * import * as O from "effect/Option"
 * console.log(LineClassChars.make({ lineClass: "signal", chars: 10, share: O.some(0.5) }).chars) // 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineClassChars extends S.Opaque<LineClassChars, { readonly brand: unique symbol }>()(
  S.Struct({ lineClass: LineClass, chars: Count, share: OptionalMeasure }).pipe(
    $I.annoteSchema("LineClassChars", { description: "Characters of one line class and their share." })
  )
) {}

/**
 * Line classes of one verification kind's output.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { LineClassKindRow } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(LineClassKindRow.fields)) // ["kind", "totalChars", "classes"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LineClassKindRow extends S.Opaque<LineClassKindRow, { readonly brand: unique symbol }>()(
  S.Struct({ kind: VerificationKind, totalChars: Count, classes: S.Array(LineClassChars) }).pipe(
    $I.annoteSchema("LineClassKindRow", { description: "Line classes of one verification kind." })
  )
) {}

/**
 * One named repeat offender and its share of its scope's output.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { OffenderRow } from "@beep/repo-ai-metrics/census-report"
 * console.log("scopeChars" in OffenderRow.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OffenderRow extends S.Opaque<OffenderRow, { readonly brand: unique symbol }>()(
  S.Struct({ offender: CensusOffender, lines: Count, chars: Count, scopeChars: Count, share: OptionalMeasure }).pipe(
    $I.annoteSchema("OffenderRow", { description: "Lines and characters of one repeat offender." })
  )
) {}

/**
 * What is in the verification output that survives filtering, both harnesses together.
 *
 * **Example** (Inspect the section fields)
 *
 * ```ts
 * import { CensusLineClasses } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(CensusLineClasses.fields)) // ["totalChars", "classes", "byKind", "offenders"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusLineClasses extends S.Opaque<CensusLineClasses, { readonly brand: unique symbol }>()(
  S.Struct({
    totalChars: Count,
    classes: S.Array(LineClassChars),
    byKind: S.Array(LineClassKindRow),
    offenders: S.Array(OffenderRow),
  }).pipe($I.annoteSchema("CensusLineClasses", { description: "Line classes and repeat offenders." }))
) {}

/**
 * Binned chars-per-token ratios of one calibration bin.
 *
 * **Example** (Inspect the bin fields)
 *
 * ```ts
 * import { CalibrationBinRow } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(CalibrationBinRow.fields)) // ["bin", "samples", "median", "p25", "p75"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalibrationBinRow extends S.Opaque<CalibrationBinRow, { readonly brand: unique symbol }>()(
  S.Struct({
    bin: CalibrationBin,
    samples: Count,
    median: OptionalMeasure,
    p25: OptionalMeasure,
    p75: OptionalMeasure,
  }).pipe($I.annoteSchema("CalibrationBinRow", { description: "Chars-per-token quantiles of one result-size bin." }))
) {}

/**
 * Measured chars per token: least squares of context growth on result size.
 *
 * **Details**
 *
 * A sample is a Claude API call that followed exactly one tool result over 3,000 characters; its tokens are
 * the call's context minus the previous call's context and output. The fit is
 * `tokens = intercept + slope * chars`, and `charsPerToken` is `1 / slope`. The binned quantiles keep one number
 * per sample for the length of the run, so that part of memory grows with the sample count.
 *
 * **Example** (Inspect the calibration fields)
 *
 * ```ts
 * import { CensusCalibration } from "@beep/repo-ai-metrics/census-report"
 * console.log("charsPerToken" in CensusCalibration.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusCalibration extends S.Opaque<CensusCalibration, { readonly brand: unique symbol }>()(
  S.Struct({
    samples: Count,
    slope: OptionalMeasure,
    intercept: OptionalMeasure,
    charsPerToken: OptionalMeasure,
    bins: S.Array(CalibrationBinRow),
  }).pipe($I.annoteSchema("CensusCalibration", { description: "The chars-per-token regression." }))
) {}

/**
 * Verification characters per run of one kind, both harnesses together.
 *
 * **Example** (Inspect the row fields)
 *
 * ```ts
 * import { VerificationRunSize } from "@beep/repo-ai-metrics/census-report"
 * console.log(Object.keys(VerificationRunSize.fields)) // ["kind", "runs", "chars", "charsPerRun"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VerificationRunSize extends S.Opaque<VerificationRunSize, { readonly brand: unique symbol }>()(
  S.Struct({ kind: VerificationKind, runs: Count, chars: Count, charsPerRun: OptionalMeasure }).pipe(
    $I.annoteSchema("VerificationRunSize", { description: "Average verification result size of one kind." })
  )
) {}

/**
 * The rows other goals cite.
 *
 * **Details**
 *
 * `filteredRunShare` is the share of verification runs not classified `unfiltered`: piped into a text filter,
 * discarded, or redirected to a file; `logDigsPerRun` the mean log
 * digs after a verification run; `turnsPerVerdict` the run, dig, CI-fetch and no-edit re-run turns per
 * verification run turn.
 *
 * **Example** (Inspect the headline fields)
 *
 * ```ts
 * import { CensusHeadline } from "@beep/repo-ai-metrics/census-report"
 * console.log("turnsPerVerdict" in CensusHeadline.fields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusHeadline extends S.Opaque<CensusHeadline, { readonly brand: unique symbol }>()(
  S.Struct({
    filteredRunShare: OptionalMeasure,
    logDigsPerRun: OptionalMeasure,
    verificationCharsPerRun: S.Array(VerificationRunSize),
    turnsPerVerdict: OptionalMeasure,
  }).pipe($I.annoteSchema("CensusHeadline", { description: "The census rows other goals are judged by." }))
) {}

/**
 * The `agent-output-census/v1` report.
 *
 * **Example** (Check the report version tag)
 *
 * ```ts
 * import { CensusReport } from "@beep/repo-ai-metrics/census-report"
 * console.log(CensusReport.fields.version.schema.literal) // "agent-output-census/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusReport extends S.Opaque<CensusReport, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("agent-output-census/v1"),
    ruleVersion: CensusRuleVersion,
    repository: CensusRepositorySelection,
    window: CensusWindow,
    corpus: CensusCorpus,
    totals: CensusTotals,
    toolOutput: CensusToolOutput,
    verificationByKind: S.Array(VerificationKindRow),
    yeetSubcommands: S.Array(YeetSubcommandRow),
    filterHabits: CensusFilterHabits,
    turns: CensusTurns,
    lineClasses: CensusLineClasses,
    calibration: CensusCalibration,
    headline: CensusHeadline,
  }).pipe(
    $I.annoteSchema("CensusReport", {
      description: "Aggregate census of agent tool output in one window: counts, sizes, shares and fitted constants.",
    })
  )
) {}

/**
 * One tracked census run: the report and when it was recorded.
 *
 * **Example** (Check the baseline version tag)
 *
 * ```ts
 * import { CensusBaselineFile } from "@beep/repo-ai-metrics/census-report"
 * console.log(CensusBaselineFile.fields.version.schema.literal) // "agent-output-census-baseline/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusBaselineFile extends S.Opaque<CensusBaselineFile, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("agent-output-census-baseline/v1"),
    recordedAt: S.DateTimeUtcFromString,
    report: CensusReport,
  }).pipe(
    $I.annoteSchema("CensusBaselineFile", {
      description: "A census run recorded under the standards baseline directory; one file per run.",
    })
  )
) {}

/**
 * The file name a run is recorded under: its window end and its rule version.
 *
 * **Details**
 *
 * Colons and slashes become hyphens so the name is portable; a window end on a whole second drops its
 * milliseconds. Two runs share a name only when they share both, and the command refuses to overwrite.
 *
 * **Example** (Name a baseline file)
 *
 * ```ts
 * import { censusBaselineFileName } from "@beep/repo-ai-metrics/census-report"
 * import * as DateTime from "effect/DateTime"
 * console.log(censusBaselineFileName(DateTime.makeUnsafe("2026-11-18T11:57:45Z"), "census-rules/2026-11-18"))
 * // "2026-11-18T11-57-45Z--census-rules-2026-11-18.json"
 * ```
 *
 * @param until - the window end of the run
 * @param ruleVersion - the rule version of the run
 * @returns A portable `.json` name unique to the window end and rule version.
 * @category utilities
 * @since 0.0.0
 */
export const censusBaselineFileName: {
  (until: DateTime.Utc, ruleVersion: CensusRuleVersion): string;
  (ruleVersion: CensusRuleVersion): (until: DateTime.Utc) => string;
} = dual(
  2,
  (until: DateTime.Utc, ruleVersion: CensusRuleVersion): string =>
    `${pipe(DateTime.formatIso(until), Str.replace(".000Z", "Z"), Str.replaceAll(":", "-"))}--${Str.replaceAll("/", "-")(ruleVersion)}.json`
);
