/**
 * The plain-text projection of a console document under a budget: the agent
 * console, line by line, with every console law applied.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { verdictWord } from "./Classify.ts";
import { CapLine, ConsoleDocument, ConsoleEntry } from "./ConsoleDocument.ts";
import { formatBytes, formatDuration } from "./Format.ts";
import { stripEscapes } from "./internal/escapes.ts";
import type {
  ConsoleBudget,
  FailureEntry,
  FoldLine,
  PointerLine,
  RecordPaths,
  RunDelta,
  VerdictLine,
} from "./ConsoleDocument.ts";
import type { Location } from "./Item.ts";

const ELLIPSIS = "...";

// Escapes go first, so what they styled is what counts against the line and the budget.
const oneLine: (text: string) => string = flow(stripEscapes, Str.replace(/[\u0000-\u001f\u007f]/gu, " "));

const cut = (text: string, room: number): string =>
  text.length <= room ? text : `${Str.takeLeft(text, room - ELLIPSIS.length)}${ELLIPSIS}`;

const fitLine =
  (budget: ConsoleBudget) =>
  (text: string): string =>
    cut(oneLine(text), budget.maxLineChars);

/**
 * The delta phrase: `since last run: F fixed, S still failing, N new`.
 *
 * **Example** (Render a delta)
 *
 * ```ts
 * import { RunDelta } from "@beep/gate-report/ConsoleDocument";
 * import { deltaText } from "@beep/gate-report/PlainText";
 *
 * console.log(deltaText(RunDelta.make({ fixed: 2, stillFailing: 1, new: 0 })));
 * // since last run: 2 fixed, 1 still failing, 0 new
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const deltaText = (delta: RunDelta): string =>
  `since last run: ${delta.fixed} fixed, ${delta.stillFailing} still failing, ${delta.new} new`;

const verdictHead = (verdict: VerdictLine): string => `${verdict.gate} ${verdict.scope}`;

const verdictResult = (verdict: VerdictLine): string =>
  `: ${verdictWord(verdict.reason)}, ${verdict.counts} (${formatDuration(verdict.durationMs)})`;

const deltaSuffix = (verdict: VerdictLine): string =>
  pipe(
    verdict.delta,
    O.map((delta) => `; ${deltaText(delta)}`),
    O.getOrElse(() => "")
  );

/**
 * The verdict line's text.
 *
 * **Example** (Render a verdict)
 *
 * ```ts
 * import { VerdictLine } from "@beep/gate-report/ConsoleDocument";
 * import { verdictText } from "@beep/gate-report/PlainText";
 *
 * console.log(verdictText(VerdictLine.make({ gate: "test", scope: "@beep/glob", reason: "passed", counts: "3/3 passed", durationMs: 1200 })));
 * // test @beep/glob: PASSED, 3/3 passed (1.2s)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const verdictText = (verdict: VerdictLine): string =>
  `${verdictHead(verdict)}${verdictResult(verdict)}${deltaSuffix(verdict)}`;

const MIN_HEAD = ELLIPSIS.length + 1;

const fitVerdict =
  (budget: ConsoleBudget) =>
  (verdict: VerdictLine): string => {
    const max = budget.maxLineChars;
    const result = oneLine(verdictResult(verdict));
    const withDelta = `${result}${oneLine(deltaSuffix(verdict))}`;
    const tail = withDelta.length + MIN_HEAD <= max ? withDelta : result;
    const head = oneLine(verdictHead(verdict));
    return tail.length + MIN_HEAD <= max ? `${cut(head, max - tail.length)}${tail}` : cut(`${head}${tail}`, max);
  };

const locationText = (location: Location): string => `${location.file}:${location.line}:${location.column}`;

const suffix = (value: O.Option<string>, render: (text: string) => string): string =>
  pipe(
    value,
    O.map(render),
    O.getOrElse(() => "")
  );

const entryHeader = (entry: FailureEntry): string => {
  const where = pipe(
    entry.location,
    O.map(locationText),
    O.getOrElse(() => entry.unit)
  );
  const title = A.join(A.append(entry.path, entry.name), " > ");
  return `- ${where}${suffix(entry.code, (code) => ` ${code}`)}${title === "" ? "" : ` > ${title}`}${suffix(
    entry.label,
    (label) => ` [${label}]`
  )}${suffix(entry.failureKind, (kind) => ` (${kind})`)}`;
};

const failureLines = (entry: FailureEntry, budget: ConsoleBudget): ReadonlyArray<string> => [
  entryHeader(entry),
  ...A.fromOption(O.map(entry.message, (message) => `  ${message}`)),
  ...A.map(A.take(entry.diff, budget.maxDiffLines), (line) => `  ${line}`),
];

const entryLines = (entry: ConsoleEntry, budget: ConsoleBudget): ReadonlyArray<string> =>
  ConsoleEntry.match(entry, {
    FailureEntry: (failure) => failureLines(failure, budget),
    NoteEntry: (note) => note.lines,
  });

/**
 * A fold line's text: code, count, cause and fix.
 *
 * **Example** (Render a fold)
 *
 * ```ts
 * import { FoldLine } from "@beep/gate-report/ConsoleDocument";
 * import { foldText } from "@beep/gate-report/PlainText";
 * import * as O from "effect/Option";
 *
 * console.log(foldText(FoldLine.make({ code: "TS6305", count: 701, cause: "upstream declarations are not built", fix: O.some("bun run build") })));
 * // TS6305 x701: upstream declarations are not built. Fix: bun run build
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const foldText = (fold: FoldLine): string =>
  `${fold.code} x${fold.count}: ${fold.cause}.${suffix(fold.fix, (fix) => ` Fix: ${fix}`)}`;

const capText = (cap: CapLine): string => `${ELLIPSIS} ${cap.dropped} more in the record`;

const pathText = (paths: RecordPaths): string =>
  `record: ${paths.record} | log: ${paths.log} (${formatBytes(paths.logBytes)})`;

const pointerText = (pointer: PointerLine): string => `next: ${A.join(pointer.commands, "; ")}`;

const size = (lines: ReadonlyArray<string>): number => A.reduce(lines, 0, (total, line) => total + line.length + 1);

const tail = (document: ConsoleDocument): ReadonlyArray<string> => [
  ...A.fromOption(O.map(document.cap, capText)),
  ...A.fromOption(O.map(document.delta, deltaText)),
  ...A.fromOption(O.map(document.path, pathText)),
  ...A.fromOption(O.map(document.pointer, pointerText)),
];

const render = (document: ConsoleDocument, budget: ConsoleBudget): ReadonlyArray<string> => {
  const verdict = fitVerdict(budget)(document.verdict);
  const body = A.map(
    [
      ...A.flatMap(document.entries, (entry) => entryLines(entry, budget)),
      ...A.map(document.folds, foldText),
      ...tail(document),
    ],
    fitLine(budget)
  );
  return A.isReadonlyArrayNonEmpty(body) ? [verdict, ...body, verdict] : [verdict];
};

type Kept = { readonly entries: ReadonlyArray<ConsoleEntry>; readonly folds: ReadonlyArray<FoldLine> };

const keepWithin = (document: ConsoleDocument, budget: ConsoleBudget, room: number): Kept => {
  const line = fitLine(budget);
  const foldSizes = A.map(document.folds, (fold) => size([line(foldText(fold))]));
  const keptFolds = keepPrefix(document.folds, foldSizes, room);
  const left = room - size(A.map(keptFolds, (fold) => line(foldText(fold))));
  const entrySizes = A.map(document.entries, (entry) => size(A.map(entryLines(entry, budget), line)));
  return { entries: keepPrefix(document.entries, entrySizes, left), folds: keptFolds };
};

const keepPrefix = <V>(values: ReadonlyArray<V>, sizes: ReadonlyArray<number>, room: number): ReadonlyArray<V> => {
  const running = A.scan(sizes, 0, (total, next) => total + next);
  const count = A.filter(A.drop(running, 1), (total) => total <= room).length;
  return A.take(values, count);
};

// What the cap counts: failure entries and folds, the blocks that stand for items in the record.
// A note (an empty-run warning, a breach, stray output) is not in the record, so dropping one
// adds nothing to the cap.
const recordBlocks = (blocks: Kept): number =>
  A.filter(blocks.entries, ConsoleEntry.guards.FailureEntry).length + blocks.folds.length;

const capOf = (dropped: number): O.Option<CapLine> => (dropped > 0 ? CapLine.makeOption({ dropped }) : O.none());

/**
 * Fit a document to a budget: keep the longest prefix of folds that fits,
 * then the longest prefix of entries that fits in the room left, and record
 * in the cap how many failure entries and folds were dropped. A dropped note
 * is not counted: it stands for nothing in the record.
 *
 * **Details**
 *
 * Folds are kept before entries, since one fold line stands for many items;
 * an entry may still fit in the room the dropped folds leave.
 * The frame (both verdict lines, the cap, delta, path and pointer lines) is
 * reserved first; a {@link ConsoleBudget} always holds it. A cap the document
 * already holds counts entries an earlier fit dropped: it is kept and new
 * drops add to it, so fitting a fitted document changes nothing.
 *
 * **Example** (Fit a green document)
 *
 * ```ts
 * import { ConsoleBudget, ConsoleDocument, VerdictLine } from "@beep/gate-report/ConsoleDocument";
 * import { fitDocument } from "@beep/gate-report/PlainText";
 * import * as O from "effect/Option";
 *
 * const document = ConsoleDocument.make({
 *   verdict: VerdictLine.make({ gate: "test", scope: "@beep/glob", reason: "passed", counts: "3/3 passed", durationMs: 10 }),
 *   entries: [],
 *   folds: [],
 * });
 * const budget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });
 * console.log(O.isNone(fitDocument({ document, budget }).cap)); // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const fitDocument = (input: {
  readonly document: ConsoleDocument;
  readonly budget: ConsoleBudget;
}): ConsoleDocument => {
  const budget = input.budget;
  const prior = pipe(
    input.document.cap,
    O.map((cap) => cap.dropped),
    O.getOrElse(() => 0)
  );
  const document = ConsoleDocument.make({ ...input.document, cap: capOf(prior) });
  if (size(render(document, budget)) <= budget.maxChars) return document;
  const blocks = recordBlocks(document);
  const frame = ConsoleDocument.make({ ...document, entries: [], folds: [], cap: capOf(prior + blocks) });
  const kept = keepWithin(document, budget, budget.maxChars - size(render(frame, budget)));
  return ConsoleDocument.make({ ...document, ...kept, cap: capOf(prior + blocks - recordBlocks(kept)) });
};

/**
 * Project a document to the plain-text lines of the agent console.
 *
 * **Details**
 *
 * The order is the verdict line, the entries, the fold lines, the cap line,
 * the delta line, the path line, the pointer line and the verdict line again.
 * A green document is the verdict line alone. Every line has its control
 * characters replaced and is cut to the line limit with `...`; the verdict
 * line is cut in its gate and scope first, so the verdict word, counts and
 * duration stay whenever they fit the line limit, and the delta suffix goes
 * before them. The whole projection, newlines included, stays within the
 * budget, and projecting a document {@link fitDocument} already fitted keeps
 * its cap.
 *
 * **Example** (Project a green document)
 *
 * ```ts
 * import { ConsoleBudget, ConsoleDocument, VerdictLine } from "@beep/gate-report/ConsoleDocument";
 * import { projectLines } from "@beep/gate-report/PlainText";
 *
 * const document = ConsoleDocument.make({
 *   verdict: VerdictLine.make({ gate: "test", scope: "@beep/glob", reason: "passed", counts: "3/3 passed", durationMs: 10 }),
 *   entries: [],
 *   folds: [],
 * });
 * const budget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });
 * console.log(projectLines({ document, budget })); // ["test @beep/glob: PASSED, 3/3 passed (10ms)"]
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectLines = (input: {
  readonly document: ConsoleDocument;
  readonly budget: ConsoleBudget;
}): ReadonlyArray<string> => render(fitDocument(input), input.budget);
