/**
 * The dispatch table: one cell for every run shape and run outcome, each
 * producing the neutral console document of a report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CauseFoldRule, defaultCauseFolds, FoldFixes, FoldInput, FoldResult, foldCauses } from "./CauseFold.ts";
import { classifyShape } from "./Classify.ts";
import {
  ConsoleDocument,
  ConsoleEntry,
  FailureEntry,
  NoteEntry,
  PointerLine,
  PointerTable,
  RecordPaths,
  RunDelta,
  VerdictLine,
} from "./ConsoleDocument.ts";
import { formatCounts } from "./Format.ts";
import { GateReport } from "./GateReport.ts";
import { ItemKey } from "./ItemKey.ts";
import { optionalSlot } from "./internal/slots.ts";
import { breachLine } from "./Policy.ts";
import { strayOutputNote } from "./StrayOutput.ts";
import { HistoryLabel, ItemKind, RunShape, UnitKind } from "./Vocabulary.ts";
import type { GatePointers } from "./ConsoleDocument.ts";
import type { Item } from "./Item.ts";
import type { ItemOutcome, RunOutcome } from "./Vocabulary.ts";

const $I = $GateReportId.create("Dispatch");

/**
 * Everything a cell needs besides the report: the pointer table, the folding
 * table and its fixes, the record paths and the delta.
 *
 * **Details**
 *
 * Every repo specific arrives here as data. The folding rules default to
 * {@link defaultCauseFolds} and the fixes to none.
 *
 * **Example** (Build an input)
 *
 * ```ts
 * import { ConsoleInput } from "@beep/gate-report/Dispatch";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * console.log(ConsoleInput.make({ report, pointers: {} }).rules.length); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleInput extends S.Opaque<ConsoleInput, { readonly brand: unique symbol }>()(
  S.Struct({
    report: GateReport,
    pointers: PointerTable,
    rules: S.Array(CauseFoldRule).pipe(S.withConstructorDefault(Effect.succeed(defaultCauseFolds))),
    fixes: FoldFixes.pipe(S.withConstructorDefault(Effect.succeed({}))),
    paths: optionalSlot(RecordPaths),
    delta: optionalSlot(RunDelta),
  }).pipe(
    $I.annoteSchema("ConsoleInput", {
      description: "A report and the caller-supplied pointers, folding table, record paths and delta.",
    })
  )
) {}

/**
 * What a cell receives: the input and the report's items after cause folding.
 *
 * **Example** (Build a context)
 *
 * ```ts
 * import { FoldResult } from "@beep/gate-report/CauseFold";
 * import { CellContext, ConsoleInput } from "@beep/gate-report/Dispatch";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({}),
 * });
 * const context = CellContext.make({ input: ConsoleInput.make({ report, pointers: {} }), fold: FoldResult.make({ folds: [], rest: [] }) });
 * console.log(context.fold.rest.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CellContext extends S.Opaque<CellContext, { readonly brand: unique symbol }>()(
  S.Struct({
    input: ConsoleInput,
    fold: FoldResult,
  }).pipe(
    $I.annoteSchema("CellContext", {
      description: "The console input and the report's items after cause folding.",
    })
  )
) {}

/**
 * One dispatch cell: a context to a console document.
 *
 * @category models
 * @since 0.0.0
 */
export type Cell = (context: CellContext) => ConsoleDocument;

/**
 * The dispatch table type: a cell for every shape and outcome.
 *
 * @category models
 * @since 0.0.0
 */
export type DispatchTable = { readonly [Shape in RunShape]: { readonly [Outcome in RunOutcome]: Cell } };

const isFault = (item: Item): boolean => ItemKey.guards.FaultKey(item.key);

const itemTitle = (item: Item): string => A.join(A.append(item.path, item.name), " > ");

const soleItemScope = (report: GateReport): string =>
  pipe(
    A.findFirst(report.items, (item) => !isFault(item)),
    O.map((item) => `${report.subject} > ${itemTitle(item)}`),
    O.getOrElse(() => report.subject)
  );

const soleUnitScope = (report: GateReport): string =>
  pipe(
    A.findFirst(report.units, (unit) => !UnitKind.is.package(unit.kind)),
    O.map((unit) => unit.id),
    O.orElse(() => O.map(A.head(report.items), (item) => item.unit)),
    O.map((unit) => `${report.subject} ${unit}`),
    O.getOrElse(() => report.subject)
  );

const workspaceScope = (report: GateReport): string =>
  `${report.subject} (${A.filter(report.units, (unit) => UnitKind.is.package(unit.kind)).length} packages)`;

const scopeOf = (shape: RunShape, report: GateReport): string =>
  RunShape.match(shape, {
    item: () => (ItemKind.is.diagnostic(report.itemKind) ? soleUnitScope(report) : soleItemScope(report)),
    unit: () => soleUnitScope(report),
    package: () => report.subject,
    workspace: () => workspaceScope(report),
  });

const verdictOf = (context: CellContext, scope: string): VerdictLine => {
  const report = context.input.report;
  return VerdictLine.make({
    gate: report.gate,
    scope,
    reason: report.reason,
    counts: formatCounts({ totals: report.totals, itemKind: report.itemKind }),
    durationMs: report.durationMs,
  });
};

const firstLine = (text: string): string => A.headNonEmpty(Str.split(text, "\n"));

const toEntry = (item: Item): FailureEntry =>
  FailureEntry.make({
    unit: item.unit,
    path: item.path,
    name: item.name,
    location: item.location,
    code: O.orElse(item.code, () => item.rule),
    label: item.label,
    failureKind: O.filter(item.failureKind, (kind) => kind !== "assertion"),
    message: O.map(item.detail, (detail) => firstLine(detail.message)),
    diff: pipe(
      O.flatMap(item.detail, (detail) => detail.diff),
      O.map((diff) => Str.split(diff, "\n")),
      O.getOrElse((): ReadonlyArray<string> => [])
    ),
  });

const entriesWith =
  (outcome: ItemOutcome) =>
  (context: CellContext): ReadonlyArray<ConsoleEntry> =>
    A.map(
      A.filter(context.fold.rest, (item) => item.outcome === outcome),
      toEntry
    );

const EMPTY_RUN =
  "Nothing collected. An empty run usually means a wrong working directory, a filter that matched nothing, or a load-time error; verify before trusting it.";

const emptyRunNote = (context: CellContext): ReadonlyArray<ConsoleEntry> =>
  context.input.report.totals.collected === 0 ? [NoteEntry.make({ lines: [EMPTY_RUN] })] : [];

const failingEntries = (context: CellContext): ReadonlyArray<ConsoleEntry> => [
  ...emptyRunNote(context),
  ...entriesWith("failed")(context),
];

const cancelledEntries = (context: CellContext): ReadonlyArray<ConsoleEntry> => [
  NoteEntry.make({ lines: ["The run was cancelled before it finished; the counts cover what ran."] }),
  ...entriesWith("failed")(context),
];

const breachEntries = (context: CellContext): ReadonlyArray<ConsoleEntry> =>
  pipe(
    context.input.report.policy,
    O.map((policy) => A.map(policy.breaches, (breach) => NoteEntry.make({ lines: [breachLine(breach)] }))),
    O.getOrElse((): ReadonlyArray<ConsoleEntry> => [])
  );

const strayEntries = (context: CellContext): ReadonlyArray<ConsoleEntry> =>
  pipe(
    context.input.report.strayOutput,
    O.flatMap((stray) => A.match(strayOutputNote(stray), { onEmpty: O.none, onNonEmpty: O.some })),
    O.map((lines) => [NoteEntry.make({ lines })]),
    O.getOrElse((): ReadonlyArray<ConsoleEntry> => [])
  );

/**
 * The dominant history label among failure entries, in the upstream footer
 * order `introduced-on-lane`, `red-on-main`, `persistent`, `flaky`,
 * `recovered`.
 *
 * **Example** (Pick the dominant label)
 *
 * ```ts
 * import { FailureEntry } from "@beep/gate-report/ConsoleDocument";
 * import { dominantLabel } from "@beep/gate-report/Dispatch";
 * import * as O from "effect/Option";
 *
 * const entry = (label: "flaky" | "persistent") =>
 *   FailureEntry.make({ unit: "a.ts", path: [], name: "x", diff: [], label: O.some(label) });
 * console.log(O.getOrNull(dominantLabel([entry("flaky"), entry("persistent")]))); // persistent
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const dominantLabel = (entries: ReadonlyArray<ConsoleEntry>): O.Option<HistoryLabel> =>
  A.findFirst(HistoryLabel.literals, (label) => A.some(entries, (entry) => isLabelled(entry, label)));

const isLabelled = (entry: ConsoleEntry, label: HistoryLabel): boolean =>
  ConsoleEntry.guards.FailureEntry(entry) && O.exists(entry.label, (present) => present === label);

type PointerChoice = (pointers: GatePointers, entries: ReadonlyArray<ConsoleEntry>) => O.Option<string>;

const failurePointer: PointerChoice = (pointers, entries) =>
  O.flatMap(
    O.filter(dominantLabel(entries), (label) => label === "flaky"),
    () => pointers.flaky
  );

const pointerOf = (
  context: CellContext,
  entries: ReadonlyArray<ConsoleEntry>,
  choose: PointerChoice
): O.Option<PointerLine> =>
  O.map(R.get(context.input.pointers, context.input.report.gate), (pointers) =>
    PointerLine.make({ commands: [O.getOrElse(choose(pointers, entries), () => pointers.failure)] })
  );

const green =
  (shape: RunShape): Cell =>
  (context) =>
    ConsoleDocument.make({
      verdict: VerdictLine.make({
        ...verdictOf(context, scopeOf(shape, context.input.report)),
        delta: context.input.delta,
      }),
      entries: [],
      folds: [],
    });

const red =
  (body: (context: CellContext) => ReadonlyArray<ConsoleEntry>, choose: PointerChoice) =>
  (shape: RunShape): Cell =>
  (context) => {
    const entries = [...body(context), ...strayEntries(context)];
    return ConsoleDocument.make({
      verdict: verdictOf(context, scopeOf(shape, context.input.report)),
      entries,
      folds: context.fold.folds,
      delta: context.input.delta,
      path: context.input.paths,
      pointer: pointerOf(context, entries, choose),
    });
  };

const someFail = red(failingEntries, failurePointer);
const warningsOnly = red(entriesWith("warned"), (pointers) => pointers.warnings);
const policyViolation = red(breachEntries, (pointers) => pointers.policy);
const interrupted = red(cancelledEntries, (pointers) => pointers.interrupted);

const row = (shape: RunShape): { readonly [Outcome in RunOutcome]: Cell } => ({
  "all-pass": green(shape),
  "some-fail": someFail(shape),
  "warnings-only": warningsOnly(shape),
  "policy-violation": policyViolation(shape),
  interrupted: interrupted(shape),
});

/**
 * The dispatch table: four shapes by five outcomes, twenty cells.
 *
 * **Details**
 *
 * The table's type is a total mapped type over {@link RunShape} and
 * {@link RunOutcome}, so adding a member to either fails to compile until its
 * cells exist. The shape picks the verdict scope (the item, the unit, the
 * package or the workspace; a single diagnostic is scoped by its unit, since
 * its name is its message); the outcome picks the body and the pointer. A
 * green cell prints the verdict alone.
 *
 * **Example** (Read a cell)
 *
 * ```ts
 * import { dispatchTable } from "@beep/gate-report/Dispatch";
 *
 * console.log(typeof dispatchTable.package["some-fail"]); // function
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const dispatchTable: DispatchTable = {
  item: row("item"),
  unit: row("unit"),
  package: row("package"),
  workspace: row("workspace"),
};

/**
 * Render a report's console document through its dispatch cell.
 *
 * **Example** (Dispatch a green report)
 *
 * ```ts
 * import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 10, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 3, passed: 3 }),
 * });
 * console.log(dispatch(ConsoleInput.make({ report, pointers: {} })).entries.length); // 0
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const dispatch = (input: ConsoleInput): ConsoleDocument => {
  const report = input.report;
  const fold = foldCauses(FoldInput.make({ items: report.items, rules: input.rules, fixes: input.fixes }));
  return dispatchTable[classifyShape(report)][report.outcome](CellContext.make({ input, fold }));
};
