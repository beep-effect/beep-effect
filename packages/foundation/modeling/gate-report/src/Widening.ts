/**
 * The upstream vocabularies the model widens, and the total maps from each
 * onto its widened set. An adapter reading a test runner's states uses them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import type { HistoryLabel, ItemOutcome, RunOutcome, RunReason, RunShape } from "./Vocabulary.ts";

const $I = $GateReportId.create("Widening");

/**
 * Upstream `TestState`, the test states a test runner reports.
 *
 * **Example** (Guard a test state)
 *
 * ```ts
 * import { UpstreamTestState } from "@beep/gate-report/Widening";
 *
 * console.log(UpstreamTestState.is.pending("pending")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamTestState = LiteralKit(["passed", "failed", "skipped", "pending"]).pipe(
  $I.annoteSchema("UpstreamTestState", {
    description: "Upstream TestState: the test states a test runner reports.",
  })
);

/**
 * Type of {@link UpstreamTestState}.
 *
 * @category models
 * @since 0.0.0
 */
export type UpstreamTestState = typeof UpstreamTestState.Type;

/**
 * Map a test state onto an item outcome; `pending` folds into `skipped`.
 *
 * **Example** (Map a pending test)
 *
 * ```ts
 * import { itemOutcomeFromTestState } from "@beep/gate-report/Widening";
 *
 * console.log(itemOutcomeFromTestState("pending")); // skipped
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const itemOutcomeFromTestState: (state: UpstreamTestState) => ItemOutcome = UpstreamTestState.match({
  passed: (): ItemOutcome => "passed",
  failed: (): ItemOutcome => "failed",
  skipped: (): ItemOutcome => "skipped",
  pending: (): ItemOutcome => "skipped",
});

/**
 * Upstream `TestRunReason`, why a test runner says a run ended.
 *
 * **Example** (Guard a run reason)
 *
 * ```ts
 * import { UpstreamRunReason } from "@beep/gate-report/Widening";
 *
 * console.log(UpstreamRunReason.is.interrupted("interrupted")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamRunReason = LiteralKit(["passed", "failed", "interrupted"]).pipe(
  $I.annoteSchema("UpstreamRunReason", {
    description: "Upstream TestRunReason: why a test runner says a run ended.",
  })
);

/**
 * Type of {@link UpstreamRunReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type UpstreamRunReason = typeof UpstreamRunReason.Type;

/**
 * Map a test runner's run reason onto a run reason; `interrupted` becomes
 * `cancelled`.
 *
 * **Example** (Map an interrupted run)
 *
 * ```ts
 * import { runReasonFromUpstream } from "@beep/gate-report/Widening";
 *
 * console.log(runReasonFromUpstream("interrupted")); // cancelled
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const runReasonFromUpstream: (reason: UpstreamRunReason) => RunReason = UpstreamRunReason.match({
  passed: (): RunReason => "passed",
  failed: (): RunReason => "failed",
  interrupted: (): RunReason => "cancelled",
});

/**
 * Upstream `RunShape`.
 *
 * **Example** (Read the upstream shapes)
 *
 * ```ts
 * import { UpstreamRunShape } from "@beep/gate-report/Widening";
 *
 * console.log(UpstreamRunShape.literals.length); // 4
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamRunShape = LiteralKit(["single-test", "single-file", "single-project", "workspace"]).pipe(
  $I.annoteSchema("UpstreamRunShape", {
    description: "Upstream RunShape: single test, single file, single project or workspace.",
  })
);

/**
 * Type of {@link UpstreamRunShape}.
 *
 * @category models
 * @since 0.0.0
 */
export type UpstreamRunShape = typeof UpstreamRunShape.Type;

/**
 * Map an upstream run shape onto a run shape.
 *
 * **Example** (Map a single file)
 *
 * ```ts
 * import { runShapeFromUpstream } from "@beep/gate-report/Widening";
 *
 * console.log(runShapeFromUpstream("single-file")); // unit
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const runShapeFromUpstream: (shape: UpstreamRunShape) => RunShape = UpstreamRunShape.match({
  "single-test": (): RunShape => "item",
  "single-file": (): RunShape => "unit",
  "single-project": (): RunShape => "package",
  workspace: (): RunShape => "workspace",
});

/**
 * Upstream `RunOutcome`.
 *
 * **Example** (Read the upstream outcomes)
 *
 * ```ts
 * import { UpstreamRunOutcome } from "@beep/gate-report/Widening";
 *
 * console.log(UpstreamRunOutcome.literals.length); // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamRunOutcome = LiteralKit(["all-pass", "some-fail", "threshold-violation"]).pipe(
  $I.annoteSchema("UpstreamRunOutcome", {
    description: "Upstream RunOutcome: all pass, some fail or threshold violation.",
  })
);

/**
 * Type of {@link UpstreamRunOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type UpstreamRunOutcome = typeof UpstreamRunOutcome.Type;

/**
 * Map an upstream run outcome onto a run outcome; `threshold-violation`
 * becomes `policy-violation`.
 *
 * **Example** (Map a threshold violation)
 *
 * ```ts
 * import { runOutcomeFromUpstream } from "@beep/gate-report/Widening";
 *
 * console.log(runOutcomeFromUpstream("threshold-violation")); // policy-violation
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const runOutcomeFromUpstream: (outcome: UpstreamRunOutcome) => RunOutcome = UpstreamRunOutcome.match({
  "all-pass": (): RunOutcome => "all-pass",
  "some-fail": (): RunOutcome => "some-fail",
  "threshold-violation": (): RunOutcome => "policy-violation",
});

/**
 * Upstream `TestClassification`.
 *
 * **Example** (Guard a classification)
 *
 * ```ts
 * import { UpstreamClassification } from "@beep/gate-report/Widening";
 *
 * console.log(UpstreamClassification.is.stable("stable")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamClassification = LiteralKit(["stable", "new-failure", "persistent", "flaky", "recovered"]).pipe(
  $I.annoteSchema("UpstreamClassification", {
    description: "Upstream TestClassification: stable, new failure, persistent, flaky or recovered.",
  })
);

/**
 * Type of {@link UpstreamClassification}.
 *
 * @category models
 * @since 0.0.0
 */
export type UpstreamClassification = typeof UpstreamClassification.Type;

/**
 * Map an upstream classification onto a history label; `stable` carries no
 * label and `new-failure` becomes `introduced-on-lane`.
 *
 * **Example** (Map a new failure)
 *
 * ```ts
 * import { historyLabelFromUpstream } from "@beep/gate-report/Widening";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrNull(historyLabelFromUpstream("new-failure"))); // introduced-on-lane
 * ```
 *
 * @category mappers
 * @since 0.0.0
 */
export const historyLabelFromUpstream: (classification: UpstreamClassification) => O.Option<HistoryLabel> =
  UpstreamClassification.match({
    stable: O.none<HistoryLabel>,
    "new-failure": () => O.some<HistoryLabel>("introduced-on-lane"),
    persistent: () => O.some<HistoryLabel>("persistent"),
    flaky: () => O.some<HistoryLabel>("flaky"),
    recovered: () => O.some<HistoryLabel>("recovered"),
  });
