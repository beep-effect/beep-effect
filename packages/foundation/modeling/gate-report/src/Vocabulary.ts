/**
 * The closed sets of the gate report model: item outcomes, run reasons, run
 * outcomes and shapes, failure kinds, history labels, and the kinds of items
 * and units a gate produces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Order from "effect/Order";

const $I = $GateReportId.create("Vocabulary");

/**
 * The outcome of one item: a test case, a diagnostic or a step.
 *
 * **Details**
 *
 * Widens upstream `TestState` with `warned`; upstream `pending` folds into
 * `skipped`.
 *
 * **Example** (Match an item outcome)
 *
 * ```ts
 * import { ItemOutcome } from "@beep/gate-report/Vocabulary";
 *
 * const word = ItemOutcome.match("warned", {
 *   passed: () => "ok",
 *   failed: () => "red",
 *   warned: () => "amber",
 *   skipped: () => "grey",
 * });
 * console.log(word); // amber
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ItemOutcome = LiteralKit(["passed", "failed", "warned", "skipped"]).pipe(
  $I.annoteSchema("ItemOutcome", {
    description: "The outcome of one item: passed, failed, warned or skipped.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ItemOutcome = typeof ItemOutcome.Type;

/**
 * Why a run ended; its capitalised form is the verdict word.
 *
 * **Details**
 *
 * Widens upstream `TestRunReason` with `errored`; upstream `interrupted`
 * becomes `cancelled`.
 *
 * **Example** (Read the run reasons)
 *
 * ```ts
 * import { RunReason } from "@beep/gate-report/Vocabulary";
 *
 * console.log(RunReason.literals); // ["passed", "failed", "errored", "cancelled"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunReason = LiteralKit(["passed", "failed", "errored", "cancelled"]).pipe(
  $I.annoteSchema("RunReason", {
    description: "Why a run ended: passed, failed, errored or cancelled.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RunReason = typeof RunReason.Type;

const reasonOrder: Order.Order<RunReason> = Order.mapInput(Order.Number, (reason: RunReason) =>
  O.getOrElse(
    A.findFirstIndex(RunReason.literals, (literal) => literal === reason),
    () => 0
  )
);

/**
 * The worst of some run reasons, from the best to the worst: passed,
 * failed, errored, cancelled.
 *
 * **Details**
 *
 * The order of {@link RunReason}'s literals. Runs folded into one report
 * keep the worst reason among them; no reason at all is `passed`.
 *
 * **Example** (Keep the worse reason)
 *
 * ```ts
 * import { worstReason } from "@beep/gate-report/Vocabulary";
 *
 * console.log(worstReason(["failed", "errored", "passed"])); // errored
 * console.log(worstReason([])); // passed
 * ```
 *
 * @param reasons - The reasons of the runs folded together.
 * @returns The worst of them, or `passed` when there is none.
 * @category domain-logic
 * @since 0.0.0
 */
export const worstReason = (reasons: ReadonlyArray<RunReason>): RunReason =>
  A.reduce(reasons, "passed" as RunReason, Order.max(reasonOrder));

/**
 * The run outcome that selects a dispatch cell column.
 *
 * **Details**
 *
 * Widens upstream `RunOutcome` with `warnings-only` and `interrupted`;
 * `threshold-violation` becomes `policy-violation`.
 *
 * **Example** (Guard a run outcome)
 *
 * ```ts
 * import { RunOutcome } from "@beep/gate-report/Vocabulary";
 *
 * console.log(RunOutcome.is["policy-violation"]("policy-violation")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunOutcome = LiteralKit([
  "all-pass",
  "some-fail",
  "warnings-only",
  "policy-violation",
  "interrupted",
]).pipe(
  $I.annoteSchema("RunOutcome", {
    description: "The classified outcome of a run, the column of the dispatch table.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RunOutcome = typeof RunOutcome.Type;

/**
 * How much a run covered, the row of the dispatch table.
 *
 * **Details**
 *
 * Upstream `single-test`, `single-file`, `single-project` and `workspace`
 * become `item`, `unit`, `package` and `workspace`.
 *
 * **Example** (Read the run shapes)
 *
 * ```ts
 * import { RunShape } from "@beep/gate-report/Vocabulary";
 *
 * console.log(RunShape.literals); // ["item", "unit", "package", "workspace"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunShape = LiteralKit(["item", "unit", "package", "workspace"]).pipe(
  $I.annoteSchema("RunShape", {
    description: "How much a run covered: one item, one unit, one package or the workspace.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RunShape = typeof RunShape.Type;

/**
 * **Details**
 *
 * `assertion` is an ordinary failure; the other four each keep their own
 * total and never yield an `all-pass` outcome.
 *
 * **Example** (Guard a failure kind)
 *
 * ```ts
 * import { FailureKind } from "@beep/gate-report/Vocabulary";
 *
 * console.log(FailureKind.is.timeout("timeout")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FailureKind = LiteralKit(["assertion", "timeout", "load", "hook", "unhandled"]).pipe(
  $I.annoteSchema("FailureKind", {
    description: "Why a failed item failed: assertion, timeout, load, hook or unhandled.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type FailureKind = typeof FailureKind.Type;

/**
 * The history label a history service attaches to a failing item.
 *
 * **Details**
 *
 * The model renders the label slot; the history goal computes the values.
 * Upstream `new-failure` corresponds to `introduced-on-lane`.
 *
 * **Example** (Read the labels in dominance order)
 *
 * ```ts
 * import { HistoryLabel } from "@beep/gate-report/Vocabulary";
 *
 * console.log(HistoryLabel.literals[0]); // introduced-on-lane
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HistoryLabel = LiteralKit(["introduced-on-lane", "red-on-main", "persistent", "flaky", "recovered"]).pipe(
  $I.annoteSchema("HistoryLabel", {
    description: "The history label attached to a failing item, listed in footer dominance order.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type HistoryLabel = typeof HistoryLabel.Type;

/**
 * **Example** (Guard an item kind)
 *
 * ```ts
 * import { ItemKind } from "@beep/gate-report/Vocabulary";
 *
 * console.log(ItemKind.is.diagnostic("diagnostic")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ItemKind = LiteralKit(["test", "diagnostic", "step"]).pipe(
  $I.annoteSchema("ItemKind", {
    description: "The kind of item a gate produces: test cases, diagnostics or steps.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ItemKind = typeof ItemKind.Type;

/**
 * The kind of unit a gate was asked to cover.
 *
 * **Example** (Guard a unit kind)
 *
 * ```ts
 * import { UnitKind } from "@beep/gate-report/Vocabulary";
 *
 * console.log(UnitKind.is.file("file")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnitKind = LiteralKit(["package", "file", "job"]).pipe(
  $I.annoteSchema("UnitKind", {
    description: "The kind of unit a gate covers: a package, a file or a CI job.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type UnitKind = typeof UnitKind.Type;

/**
 * The severity of a diagnostic, aligned with SARIF result levels.
 *
 * **Example** (Guard a severity)
 *
 * ```ts
 * import { Severity } from "@beep/gate-report/Vocabulary";
 *
 * console.log(Severity.is.warning("warning")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Severity = LiteralKit(["error", "warning", "note"]).pipe(
  $I.annoteSchema("Severity", {
    description: "The severity of a diagnostic: error, warning or note.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type Severity = typeof Severity.Type;

/**
 * **Example** (Read the coverage metrics)
 *
 * ```ts
 * import { CoverageMetric } from "@beep/gate-report/Vocabulary";
 *
 * console.log(CoverageMetric.literals.length); // 4
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoverageMetric = LiteralKit(["lines", "branches", "functions", "statements"]).pipe(
  $I.annoteSchema("CoverageMetric", {
    description: "The coverage metric a coverage policy breach names.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CoverageMetric = typeof CoverageMetric.Type;

/**
 * **Example** (Guard a stream)
 *
 * ```ts
 * import { OutputStream } from "@beep/gate-report/Vocabulary";
 *
 * console.log(OutputStream.is.stderr("stderr")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OutputStream = LiteralKit(["stdout", "stderr"]).pipe(
  $I.annoteSchema("OutputStream", {
    description: "The output stream a stray line was written to.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type OutputStream = typeof OutputStream.Type;
