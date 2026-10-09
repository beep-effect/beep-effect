/**
 * Counts-only output of the mail-tagging commands: the state summary and the
 * JSON line plus table every command prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import {
  FilingLedgerRecord,
  TaggingRunReport,
  TaggingUndoReport,
  TagLedgerRecord,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  activeTagEntries,
  BackfillCheckpointStore,
  completedFilings,
  FilingLedger,
  pendingFilingIntents,
  TagLedger,
} from "@beep/law-practice-use-cases/MailTagging";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";

const $I = $PracticeMailTaggingId.create("PracticeMailTagging.report");

/**
 * Counts read from the ledgers and the checkpoint, without touching a
 * provider.
 *
 * **Example** (Describe an empty state directory)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MailTaggingStateSummary } from "@/PracticeMailTagging.report"
 *
 * const summary = MailTaggingStateSummary.make({
 *   tagged: 0,
 *   undone: 0,
 *   filed: 0,
 *   pendingIntents: 0,
 *   abandoned: 0,
 *   processed: 0,
 *   lastCheckpointAt: O.none()
 * })
 * console.log(summary.tagged) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailTaggingStateSummary extends S.Class<MailTaggingStateSummary>($I`MailTaggingStateSummary`)(
  {
    tagged: S.Natural.annotateKey({
      description: "Tag-ledger entries no undo has retired.",
    }),
    undone: S.Natural.annotateKey({
      description: "Tag-ledger entries an undo retired.",
    }),
    filed: S.Natural.annotateKey({
      description: "Attachments the filing ledger records as stored.",
    }),
    pendingIntents: S.Natural.annotateKey({
      description: "Filing intents with no completion or abandonment yet.",
    }),
    abandoned: S.Natural.annotateKey({
      description: "Filing intents abandoned because their name was taken.",
    }),
    processed: S.Natural.annotateKey({
      description: "Messages the checkpoint counts as processed.",
    }),
    lastCheckpointAt: S.OptionFromNullOr(S.DateTimeUtcFromString).annotateKey({
      description: "Received instant of the last checkpointed message; none before the first page.",
    }),
  },
  $I.annote("MailTaggingStateSummary", {
    description: "Counts read from the mail-tagging ledgers and checkpoint.",
  })
) {}

const appliedLines: (records: ReadonlyArray<TagLedgerRecord>) => number = flow(
  A.filter(TagLedgerRecord.guards.TagApplied),
  A.length
);

const abandonedLines: (records: ReadonlyArray<FilingLedgerRecord>) => number = flow(
  A.filter(FilingLedgerRecord.guards.FilingAbandoned),
  A.length
);

/**
 * Reads the ledgers and the checkpoint and counts them.
 *
 * **When to use**
 *
 * Use to see what the job has done so far before a dry run, and after an
 * apply or an undo, without a mailbox or Box call.
 *
 * **Example** (Reference the state read)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { readMailTaggingStateSummary } from "@/PracticeMailTagging.report"
 *
 * console.log(Effect.isEffect(readMailTaggingStateSummary)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readMailTaggingStateSummary: Effect.Effect<
  MailTaggingStateSummary,
  MailTaggingStateError,
  TagLedger | FilingLedger | BackfillCheckpointStore
> = Effect.gen(function* () {
  const tags = yield* Effect.flatMap(TagLedger, (ledger) => ledger.records);
  const filings = yield* Effect.flatMap(FilingLedger, (ledger) => ledger.records);
  const checkpoint = yield* Effect.flatMap(BackfillCheckpointStore, (store) => store.load);
  const tagged = activeTagEntries(tags).length;
  return MailTaggingStateSummary.make({
    tagged,
    undone: appliedLines(tags) - tagged,
    filed: completedFilings(filings).length,
    pendingIntents: pendingFilingIntents(filings).length,
    abandoned: abandonedLines(filings),
    processed: O.match(checkpoint, { onNone: () => 0, onSome: (saved) => saved.processed }),
    lastCheckpointAt: O.flatMap(checkpoint, (saved) => saved.lastReceivedAt),
  });
}).pipe(Effect.withSpan("PracticeMailTagging.readStateSummary"));

type Row = readonly [label: string, value: string | number | boolean];

const prefixed =
  (prefix: string) =>
  (counts: Readonly<Record<string, number>>): ReadonlyArray<Row> =>
    A.map(R.toEntries(counts), ([key, count]): Row => [`${prefix} ${key}`, count]);

const runReportRows = (report: TaggingRunReport): ReadonlyArray<Row> => [
  ["run", report.runId],
  ["mode", report.mode],
  ["wrote", report.wrote],
  ["scanned", report.scanned],
  ["matched", report.matched],
  ...prefixed("unmatched")(report.unmatched),
  ["already tagged", report.alreadyTagged],
  ["undone skipped", report.undoneSkipped],
  ["repaired", report.repaired],
  ...A.map(report.categoryAdds, (add): Row => [`added ${add.category}`, add.count]),
  ["attachments filed", report.attachmentsFiled],
  ["attachments deduped", report.attachmentsDeduped],
  ["attachments reconciled", report.attachmentsReconciled],
  ...prefixed("attachments skipped")(report.attachmentsSkipped),
];

const undoReportRows = (report: TaggingUndoReport): ReadonlyArray<Row> => [
  ["run", report.runId],
  ["undoes", report.originalRunId],
  ["mode", report.mode],
  ["wrote", report.wrote],
  ["ledger entries", report.entries],
  ["messages restored", report.messagesRestored],
  ["messages missing", report.messagesMissing],
  ["categories removed", report.categoriesRemoved],
];

const stateSummaryRows = (summary: MailTaggingStateSummary): ReadonlyArray<Row> => [
  ["tagged", summary.tagged],
  ["undone", summary.undone],
  ["filed", summary.filed],
  ["pending intents", summary.pendingIntents],
  ["abandoned", summary.abandoned],
  ["processed", summary.processed],
  ["last checkpoint", O.match(summary.lastCheckpointAt, { onNone: () => "none", onSome: DateTime.formatIso })],
];

const labelWidth = (rows: ReadonlyArray<Row>): number =>
  A.reduce(rows, 0, (width, [label]) => Num.max(width, Str.length(label)));

const renderRows = (rows: ReadonlyArray<Row>): string => {
  const width = labelWidth(rows);
  return A.join(
    A.map(rows, ([label, value]) => `${Str.padEnd(width)(label)}  ${value}`),
    "\n"
  );
};

// One JSON line first, so `head -n 1` is machine-readable, then the table.
const printer =
  <A>(encode: (value: A) => Effect.Effect<string, S.SchemaError>, rows: (value: A) => ReadonlyArray<Row>) =>
  (value: A): Effect.Effect<void> =>
    Effect.flatMap(Effect.orDie(encode(value)), (json) => Console.log(`${json}\n${renderRows(rows(value))}`));

const encodeRunReport = S.encodeEffect(S.fromJsonString(TaggingRunReport));
const encodeUndoReport = S.encodeEffect(S.fromJsonString(TaggingUndoReport));
const encodeStateSummary = S.encodeEffect(S.fromJsonString(MailTaggingStateSummary));

/**
 * Prints one run report on standard output: a JSON line, then a table.
 *
 * **Gotchas**
 *
 * The per-category counts name matter categories. That is fine on the
 * terminal of an attended run, and it is why `watch` logs totals instead of
 * printing this.
 *
 * **Example** (Print an empty dry-run report)
 *
 * ```ts
 * import { TaggingRunId, emptyTaggingRunReport } from "@beep/law-practice-domain/values/MailTagging"
 * import * as Effect from "effect/Effect"
 * import { printRunReport } from "@/PracticeMailTagging.report"
 *
 * const program = printRunReport(emptyTaggingRunReport("dry-run", TaggingRunId.make("tag-0001")))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param report - Counts of one tagging pass.
 * @returns An effect that writes the JSON line and the table.
 * @category formatting
 * @since 0.0.0
 */
export const printRunReport: (report: TaggingRunReport) => Effect.Effect<void> = printer(
  encodeRunReport,
  runReportRows
);

/**
 * Prints one undo report on standard output: a JSON line, then a table.
 *
 * **Example** (Print an undo report)
 *
 * ```ts
 * import { TaggingRunId, TaggingUndoReport } from "@beep/law-practice-domain/values/MailTagging"
 * import * as Effect from "effect/Effect"
 * import { printUndoReport } from "@/PracticeMailTagging.report"
 *
 * const program = printUndoReport(
 *   TaggingUndoReport.make({
 *     mode: "dry-run",
 *     runId: TaggingRunId.make("undo-0001"),
 *     originalRunId: TaggingRunId.make("tag-0001"),
 *     entries: 0,
 *     messagesRestored: 0,
 *     messagesMissing: 0,
 *     categoriesRemoved: 0,
 *     wrote: false
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param report - Counts of one undo.
 * @returns An effect that writes the JSON line and the table.
 * @category formatting
 * @since 0.0.0
 */
export const printUndoReport: (report: TaggingUndoReport) => Effect.Effect<void> = printer(
  encodeUndoReport,
  undoReportRows
);

/**
 * Prints the state summary on standard output: a JSON line, then a table.
 *
 * **Example** (Print an empty state summary)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { MailTaggingStateSummary, printStateSummary } from "@/PracticeMailTagging.report"
 *
 * const program = printStateSummary(
 *   MailTaggingStateSummary.make({
 *     tagged: 0,
 *     undone: 0,
 *     filed: 0,
 *     pendingIntents: 0,
 *     abandoned: 0,
 *     processed: 0,
 *     lastCheckpointAt: O.none()
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param summary - Counts read from the ledgers and the checkpoint.
 * @returns An effect that writes the JSON line and the table.
 * @category formatting
 * @since 0.0.0
 */
export const printStateSummary: (summary: MailTaggingStateSummary) => Effect.Effect<void> = printer(
  encodeStateSummary,
  stateSummaryRows
);
