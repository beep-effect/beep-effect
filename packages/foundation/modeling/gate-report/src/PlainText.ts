/**
 * The plain-text projection of a console document under a budget: the agent
 * console, line by line, with every console law applied.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { verdictWord } from "./Classify.ts";
import { CapLine, ConsoleDocument, ConsoleEntry } from "./ConsoleDocument.ts";
import { formatBytes, formatDuration } from "./Format.ts";
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

const oneLine: (text: string) => string = Str.replace(/[\u0000-\u001f\u007f]/gu, " ");

const fitLine =
  (budget: ConsoleBudget) =>
  (text: string): string => {
    const line = oneLine(text);
    return line.length <= budget.maxLineChars
      ? line
      : `${Str.takeLeft(line, budget.maxLineChars - ELLIPSIS.length)}${ELLIPSIS}`;
  };

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
  `${verdict.gate} ${verdict.scope}: ${verdictWord(verdict.reason)}, ${verdict.counts} (${formatDuration(
    verdict.durationMs
  )})${pipe(
    verdict.delta,
    O.map((delta) => `; ${deltaText(delta)}`),
    O.getOrElse(() => "")
  )}`;

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
  const verdict = verdictText(document.verdict);
  const body = [
    ...A.flatMap(document.entries, (entry) => entryLines(entry, budget)),
    ...A.map(document.folds, foldText),
  ];
  return A.map(
    A.isReadonlyArrayNonEmpty(body) || A.isReadonlyArrayNonEmpty(tail(document))
      ? [verdict, ...body, ...tail(document), verdict]
      : [verdict],
    fitLine(budget)
  );
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

/**
 * Fit a document to a budget: keep the longest prefix of folds that fits,
 * then the longest prefix of entries that fits in the room left, and record how many were dropped in the cap. Any cap
 * the document already held is recomputed.
 *
 * **Details**
 *
 * Folds are kept before entries, since one fold line stands for many items;
 * an entry may still fit in the room the dropped folds leave.
 * The frame (both verdict lines, the cap, delta, path and pointer lines) is
 * reserved first; a {@link ConsoleBudget} always holds it.
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
  const document = ConsoleDocument.make({ ...input.document, cap: O.none() });
  if (size(render(document, budget)) <= budget.maxChars) return document;
  const blocks = document.entries.length + document.folds.length;
  const frame = ConsoleDocument.make({
    ...document,
    entries: [],
    folds: [],
    cap: CapLine.makeOption({ dropped: blocks }),
  });
  const kept = keepWithin(document, budget, budget.maxChars - size(render(frame, budget)));
  return ConsoleDocument.make({
    ...document,
    ...kept,
    cap: CapLine.makeOption({ dropped: blocks - kept.entries.length - kept.folds.length }),
  });
};

/**
 * Project a document to the plain-text lines of the agent console.
 *
 * **Details**
 *
 * The order is the verdict line, the entries, the fold lines, the cap line,
 * the delta line, the path line, the pointer line and the verdict line again.
 * A green document is the verdict line alone. Every line has its control
 * characters replaced and is cut to the line limit with `...`; the whole
 * projection, newlines included, stays within the budget.
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
