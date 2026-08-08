/**
 * Validated option models for every `beep qa` subcommand.
 *
 * Flags arrive already coerced by the CLI parser; these schemas are the second
 * gate that turns them into domain values (`RoundNumber`, `CollectorBindPort`,
 * `CaptureLane`) so a handler never works with a bare number that happens to be
 * negative.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CaptureLane, CollectorBindPort, ExtractionRuleSet, RoundNumber } from "@beep/qa-capture";
import { SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Qa/Qa.schemas");

/**
 * Default playwright capture harness spawned by lane A.
 *
 * **Example** (Default scenario path value)
 *
 * ```ts
 * import { DEFAULT_SCENARIO_PATH } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 *
 * console.log(DEFAULT_SCENARIO_PATH) // ".beep/qa-capture.mjs"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SCENARIO_PATH = ".beep/qa-capture.mjs";

/**
 * Round artifact budget in mebibytes.
 *
 * **Example** (BudgetMib schema validation)
 *
 * ```ts
 * import { BudgetMib } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BudgetMib)(20)) // true
 * console.log(S.is(BudgetMib)(0)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BudgetMib = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`BudgetMibMinimumCheck`,
    title: "Budget Mib Minimum",
    description: "Artifact budgets are at least one mebibyte.",
    message: "Expected a positive artifact budget in mebibytes",
  })
).pipe(
  $I.annoteSchema("BudgetMib", {
    description: "Round artifact budget in mebibytes.",
  })
);

/**
 * Auto-stop duration of a lane B recording, in seconds.
 *
 * **Example** (DurationSeconds schema check)
 *
 * ```ts
 * import { DurationSeconds } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DurationSeconds)(45)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DurationSeconds = S.Int.check(
  S.isGreaterThan(0, {
    identifier: $I`DurationSecondsMinimumCheck`,
    title: "Duration Seconds Minimum",
    description: "Recording durations are at least one second.",
    message: "Expected a positive recording duration in seconds",
  })
).pipe(
  $I.annoteSchema("DurationSeconds", {
    description: "Auto-stop duration of a lane B recording, in seconds.",
  })
);

/**
 * Validated options accepted by `beep qa record`.
 *
 * **Example** (Construct QaRecordOptions)
 *
 * ```ts
 * import { QaRecordOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as O from "effect/Option"
 *
 * const options = QaRecordOptions.make({
 *   app: O.some("storybook"),
 *   beacon: true,
 *   budgetMb: 20,
 *   cursor: true,
 *   duration: O.none(),
 *   lane: "playwright",
 *   port: 43117,
 *   round: O.none(),
 *   scenario: ".beep/qa-capture.mjs",
 *   url: O.none()
 * })
 * console.log(options.lane) // "playwright"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaRecordOptions extends S.Class<QaRecordOptions>($I`QaRecordOptions`)(
  {
    app: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
    beacon: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    budgetMb: BudgetMib.pipe(SchemaUtils.withKeyDefaults(20)),
    cursor: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)),
    duration: S.Option(DurationSeconds).pipe(SchemaUtils.withNoneDefault),
    lane: CaptureLane.pipe(SchemaUtils.withKeyDefaults(CaptureLane.Enum.playwright)),
    port: CollectorBindPort.pipe(SchemaUtils.withKeyDefaults(43117)),
    round: S.Option(RoundNumber).pipe(SchemaUtils.withNoneDefault),
    scenario: S.String.pipe(SchemaUtils.withKeyDefaults(DEFAULT_SCENARIO_PATH)),
    url: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("QaRecordOptions", {
    description: "Validated options accepted by `beep qa record`.",
  })
) {}

/**
 * Validated options accepted by `beep qa extract`.
 *
 * **Example** (Construct QaExtractOptions)
 *
 * ```ts
 * import { QaExtractOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as O from "effect/Option"
 *
 * const options = QaExtractOptions.make({
 *   budgetMb: O.none(),
 *   dryRun: true,
 *   rules: O.none(),
 *   session: O.none()
 * })
 * console.log(options.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaExtractOptions extends S.Class<QaExtractOptions>($I`QaExtractOptions`)(
  {
    budgetMb: S.Option(BudgetMib).pipe(SchemaUtils.withNoneDefault),
    dryRun: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
    rules: S.Option(ExtractionRuleSet).pipe(SchemaUtils.withNoneDefault),
    session: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("QaExtractOptions", {
    description: "Validated options accepted by `beep qa extract`.",
  })
) {}

/**
 * Validated options accepted by `beep qa report`.
 *
 * **Example** (Construct QaReportOptions)
 *
 * ```ts
 * import { QaReportOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as O from "effect/Option"
 *
 * const options = QaReportOptions.make({ session: O.none() })
 * console.log(O.isNone(options.session)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaReportOptions extends S.Class<QaReportOptions>($I`QaReportOptions`)(
  {
    session: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("QaReportOptions", {
    description: "Validated options accepted by `beep qa report`.",
  })
) {}

/**
 * Validated options accepted by `beep qa mark`.
 *
 * **Example** (Construct QaMarkOptions)
 *
 * ```ts
 * import { QaMarkOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as O from "effect/Option"
 *
 * const options = QaMarkOptions.make({ data: O.none(), label: "gesture:sash-drag" })
 * console.log(options.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaMarkOptions extends S.Class<QaMarkOptions>($I`QaMarkOptions`)(
  {
    data: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
    label: S.String.check(
      S.isMinLength(1, {
        identifier: $I`QaMarkLabelNonEmptyCheck`,
        title: "Qa Mark Label Non Empty",
        description: "Marker labels must not be empty.",
        message: "Expected a non-empty marker label",
      })
    ),
  },
  $I.annote("QaMarkOptions", {
    description: "Validated options accepted by `beep qa mark`.",
  })
) {}

/**
 * Validated options accepted by `beep qa judge-pack`.
 *
 * **Example** (Construct QaJudgePackOptions)
 *
 * ```ts
 * import { QaJudgePackOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import * as O from "effect/Option"
 *
 * const options = QaJudgePackOptions.make({ round: 3, surface: O.none() })
 * console.log(options.round) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgePackOptions extends S.Class<QaJudgePackOptions>($I`QaJudgePackOptions`)(
  {
    round: RoundNumber,
    surface: S.Option(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("QaJudgePackOptions", {
    description: "Validated options accepted by `beep qa judge-pack`.",
  })
) {}

/**
 * Validated options accepted by `beep qa judge-ingest`.
 *
 * **Example** (Construct QaJudgeIngestOptions)
 *
 * ```ts
 * import { QaJudgeIngestOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 *
 * const options = QaJudgeIngestOptions.make({ from: "judge-stdout.txt", round: 3 })
 * console.log(options.from)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeIngestOptions extends S.Class<QaJudgeIngestOptions>($I`QaJudgeIngestOptions`)(
  {
    from: S.String,
    round: RoundNumber,
  },
  $I.annote("QaJudgeIngestOptions", {
    description: "Validated options accepted by `beep qa judge-ingest`.",
  })
) {}

/**
 * Validated options accepted by `beep qa judge-lint`.
 *
 * **Example** (Construct QaJudgeLintOptions)
 *
 * ```ts
 * import { QaJudgeLintOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 *
 * const options = QaJudgeLintOptions.make({ round: 3 })
 * console.log(options.round) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaJudgeLintOptions extends S.Class<QaJudgeLintOptions>($I`QaJudgeLintOptions`)(
  {
    round: RoundNumber,
  },
  $I.annote("QaJudgeLintOptions", {
    description: "Validated options accepted by `beep qa judge-lint`.",
  })
) {}

/**
 * Decode raw `beep qa record` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaRecordOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaRecordOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaRecordOptions = S.decodeUnknownEffect(QaRecordOptions);

/**
 * Decode raw `beep qa extract` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaExtractOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaExtractOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaExtractOptions = S.decodeUnknownEffect(QaExtractOptions);

/**
 * Decode raw `beep qa report` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaReportOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaReportOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaReportOptions = S.decodeUnknownEffect(QaReportOptions);

/**
 * Decode raw `beep qa mark` flags and arguments.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaMarkOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaMarkOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaMarkOptions = S.decodeUnknownEffect(QaMarkOptions);

/**
 * Decode raw `beep qa judge-pack` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaJudgePackOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaJudgePackOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaJudgePackOptions = S.decodeUnknownEffect(QaJudgePackOptions);

/**
 * Decode raw `beep qa judge-ingest` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaJudgeIngestOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaJudgeIngestOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaJudgeIngestOptions = S.decodeUnknownEffect(QaJudgeIngestOptions);

/**
 * Decode raw `beep qa judge-lint` flags.
 *
 * **Example** (Decode returns Effect)
 *
 * ```ts
 * import { decodeQaJudgeLintOptions } from "@beep/repo-cli/commands/Qa/Qa.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeQaJudgeLintOptions({}))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeQaJudgeLintOptions = S.decodeUnknownEffect(QaJudgeLintOptions);
