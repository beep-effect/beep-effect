/**
 * The `runs` and `undo` programs: list the runs in the write journal, and
 * take one run's writes back.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import {
  applyDocketUndo,
  DocketRunId,
  dryRunDocketUndo,
  latestDocketRun,
  planDocketUndo,
  readDocketJournal,
  readDocketStateFile,
  summarizeDocketRuns,
} from "@beep/law-practice-server/DocketIntake";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DocketIntakeCommandError } from "./Errors.ts";
import type { DocketJournalEntry } from "@beep/law-practice-server/DocketIntake";
import type { DocketIntakeAppConfig } from "./Config.ts";

const $I = $DocketIntakeId.create("Undo");

/**
 * The run an undo is for: a run id, or `latest` for the newest run in the
 * journal.
 *
 * **Example** (Check run selectors)
 *
 * ```ts
 * import { DocketRunSelector } from "../../src/Undo.ts"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocketRunSelector)("latest")) // true
 * console.log(S.is(DocketRunSelector)("run-20300109T100000123Z")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketRunSelector = S.Union([S.Literal("latest"), DocketRunId]).pipe(
  $I.annoteSchema("DocketRunSelector", {
    description: "Run to undo: a run id, or `latest` for the newest run in the journal.",
  })
);

/**
 * Type of {@link DocketRunSelector}.
 *
 * **Example** (Type a selector)
 *
 * ```ts
 * import type { DocketRunSelector } from "../../src/Undo.ts"
 *
 * const selector: DocketRunSelector = "latest"
 * console.log(selector)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketRunSelector = typeof DocketRunSelector.Type;

const isRunId = S.is(DocketRunId);

// The run the selector names, which must have lines in the journal: undoing a run id that was
// mistyped would otherwise report nothing done and look like success.
const resolveRun = (
  entries: ReadonlyArray<DocketJournalEntry>,
  selector: DocketRunSelector
): Effect.Effect<DocketRunId, DocketIntakeCommandError> =>
  Effect.fromOption(
    isRunId(selector)
      ? O.liftPredicate(selector, (runId) => A.some(entries, (entry) => entry.runId === runId))
      : latestDocketRun(entries)
  ).pipe(Effect.mapError(() => DocketIntakeCommandError.failed(`no run ${selector} in the journal`)));

// Read the journal, resolve the run and plan its undo against the mailbox.
const planRun = Effect.fnUntraced(function* (config: DocketIntakeAppConfig, selector: DocketRunSelector) {
  const entries = yield* readDocketJournal(config.stateDirectory);
  const runId = yield* resolveRun(entries, selector);
  const state = yield* readDocketStateFile(config.stateDirectory);
  return { plan: yield* planDocketUndo({ entries, mailbox: config.mailbox, runId, state }), state };
});

/**
 * Plan the undo of one run and report what it would do, writing nothing and
 * taking no lock.
 *
 * **Example** (Reference the dry-run undo)
 *
 * ```ts
 * import { undoDryRun } from "../../src/Undo.ts"
 *
 * console.log(undoDryRun)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const undoDryRun = Effect.fn("DocketIntakeApp.undoDryRun")(function* (
  config: DocketIntakeAppConfig,
  selector: DocketRunSelector
) {
  const { plan, state } = yield* planRun(config, selector);
  return dryRunDocketUndo(plan, state);
});

/**
 * Undo one run: delete its provisional entries, unmark its messages and
 * clear them from the ledger. The caller holds the state lock.
 *
 * **Example** (Reference the undo)
 *
 * ```ts
 * import { undoRun } from "../../src/Undo.ts"
 *
 * console.log(undoRun)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const undoRun = Effect.fn("DocketIntakeApp.undoRun")(function* (
  config: DocketIntakeAppConfig,
  selector: DocketRunSelector
) {
  const { plan } = yield* planRun(config, selector);
  const report = yield* applyDocketUndo({ mailbox: config.mailbox, plan });
  yield* Effect.logInfo("docket intake run undone", {
    deleted: report.deleted,
    gone: report.gone,
    kept: report.kept,
    runId: report.runId,
    unmarked: report.unmarked,
  });
  return report;
});

/**
 * The runs in the journal with their counts, newest first.
 *
 * **Example** (Reference the run listing)
 *
 * ```ts
 * import { listRuns } from "../../src/Undo.ts"
 *
 * console.log(listRuns)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const listRuns = Effect.fn("DocketIntakeApp.listRuns")(function* (config: DocketIntakeAppConfig) {
  return summarizeDocketRuns(yield* readDocketJournal(config.stateDirectory));
});
