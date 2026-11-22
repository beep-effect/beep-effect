/**
 * The neutral console document a dispatch cell produces, and the data a
 * caller supplies to render it: the budget, the pointer table, the record
 * paths and the delta.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Location } from "./Item.ts";
import { optionalSlot } from "./internal/slots.ts";
import { Count, DurationMs, Text } from "./Scalars.ts";
import { FailureKind, HistoryLabel, RunReason } from "./Vocabulary.ts";

const $I = $GateReportId.create("ConsoleDocument");

/**
 * The size limits of one console: total characters, characters per line and
 * diff lines per failure entry.
 *
 * **Details**
 *
 * The model holds no default; the caller supplies the budget (the agent
 * default is 8,000 characters, 240 per line and 12 diff lines). The total
 * must hold eight full lines, so the fixed frame (two verdict lines, the cap,
 * delta, path and pointer lines) always fits. A line is at least 40
 * characters, room for a whole cap line.
 *
 * **Example** (Build the agent budget)
 *
 * ```ts
 * import { ConsoleBudget } from "@beep/gate-report/ConsoleDocument";
 *
 * const budget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });
 * console.log(budget.maxLineChars); // 240
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleBudget extends S.Opaque<ConsoleBudget, { readonly brand: unique symbol }>()(
  S.Struct({
    maxChars: S.Int.check(S.isBetween({ minimum: 328, maximum: 1_000_000 })),
    maxLineChars: S.Int.check(S.isBetween({ minimum: 40, maximum: 10_000 })),
    maxDiffLines: S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 })),
  })
    .check(
      S.makeFilter((budget) => budget.maxChars >= 8 * (budget.maxLineChars + 1), {
        identifier: "ConsoleBudgetHoldsTheFrame",
        title: "Console Budget Holds The Frame",
        description: "The total budget holds eight full lines.",
        message: "maxChars must be at least eight times (maxLineChars + 1)",
      })
    )
    .pipe(
      $I.annoteSchema("ConsoleBudget", {
        description: "The size limits of one console: total characters, characters per line, diff lines per entry.",
      })
    )
) {}

/**
 * The repo commands one gate's pointer line names, by outcome.
 *
 * **Details**
 *
 * `failure` is required; the others fall back to it. The model never names a
 * command itself: the caller supplies every string.
 *
 * **Example** (Build pointers)
 *
 * ```ts
 * import { GatePointers } from "@beep/gate-report/ConsoleDocument";
 *
 * const pointers = GatePointers.make({ failure: "beep gate show test" });
 * console.log(pointers.failure); // beep gate show test
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GatePointers extends S.Opaque<GatePointers, { readonly brand: unique symbol }>()(
  S.Struct({
    failure: Text,
    flaky: optionalSlot(Text),
    policy: optionalSlot(Text),
    warnings: optionalSlot(Text),
    interrupted: optionalSlot(Text),
  }).pipe(
    $I.annoteSchema("GatePointers", {
      description: "The commands one gate's pointer line names: failure, flaky, policy, warnings, interrupted.",
    })
  )
) {}

/**
 * The pointer table: gate name to its pointers.
 *
 * **Details**
 *
 * Replaces upstream's footer strings, which named MCP tools. A gate missing
 * from the table renders no pointer line.
 *
 * **Example** (Build a table)
 *
 * ```ts
 * import { GatePointers, PointerTable } from "@beep/gate-report/ConsoleDocument";
 * import * as S from "effect/Schema";
 *
 * const table = { test: GatePointers.make({ failure: "beep gate show test" }) };
 * console.log(S.is(PointerTable)(table)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PointerTable = S.Record(S.String, GatePointers).pipe(
  $I.annoteSchema("PointerTable", {
    description: "Gate name to the commands its pointer line names.",
  })
);

/**
 * Type of {@link PointerTable}.
 *
 * @category models
 * @since 0.0.0
 */
export type PointerTable = typeof PointerTable.Type;

/**
 * The change since the previous run of the same gate and subject.
 *
 * **Details**
 *
 * The model renders the slot; the history goal fills it. `scopeDiffers` is
 * set when the two runs did not check the same units, so items in units only
 * one of them checked were not counted; it defaults to `false`.
 *
 * **Example** (Build a delta)
 *
 * ```ts
 * import { RunDelta } from "@beep/gate-report/ConsoleDocument";
 *
 * console.log(RunDelta.make({ fixed: 2, stillFailing: 1, new: 0 }).fixed); // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RunDelta extends S.Opaque<RunDelta, { readonly brand: unique symbol }>()(
  S.Struct({
    fixed: Count,
    stillFailing: Count,
    new: Count,
    scopeDiffers: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("RunDelta", {
      description:
        "Items fixed, still failing and newly failing since the previous run, and whether the runs checked different units.",
    })
  )
) {}

/**
 * Where the run's record and raw log were written, by repository-relative
 * path, with the log's size.
 *
 * **Example** (Build record paths)
 *
 * ```ts
 * import { RecordPaths } from "@beep/gate-report/ConsoleDocument";
 *
 * const paths = RecordPaths.make({ record: "a/report.json", log: "a/report.log", logBytes: 2048 });
 * console.log(paths.logBytes); // 2048
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RecordPaths extends S.Opaque<RecordPaths, { readonly brand: unique symbol }>()(
  S.Struct({
    record: Text,
    log: Text,
    logBytes: Count,
  }).pipe(
    $I.annoteSchema("RecordPaths", {
      description: "The repository-relative record and log paths of a run, with the log's size in bytes.",
    })
  )
) {}

/**
 * The verdict line: gate, scope, verdict, counts and duration, with the delta
 * as a suffix on a green run.
 *
 * **Example** (Build a verdict line)
 *
 * ```ts
 * import { VerdictLine } from "@beep/gate-report/ConsoleDocument";
 *
 * const verdict = VerdictLine.make({ gate: "test", scope: "@beep/glob", reason: "passed", counts: "3/3 passed", durationMs: 10 });
 * console.log(verdict.reason); // passed
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class VerdictLine extends S.Opaque<VerdictLine, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    scope: Text,
    reason: RunReason,
    counts: S.String,
    durationMs: DurationMs,
    delta: optionalSlot(RunDelta),
  }).pipe(
    $I.annoteSchema("VerdictLine", {
      description: "The verdict line: gate, scope, verdict word, counts, duration and an optional delta suffix.",
    })
  )
) {}

/**
 * One failing or warning item as the console shows it.
 *
 * **Details**
 *
 * Widens upstream `FailureRecord`: `modulePath`, `suitePath` and `testName`
 * become the unit, the path segments, the item name and the location. Only
 * the first message line and the diff lines are carried, never a stack.
 *
 * **Example** (Build an entry)
 *
 * ```ts
 * import { FailureEntry } from "@beep/gate-report/ConsoleDocument";
 *
 * const entry = FailureEntry.make({ unit: "src/a.test.ts", path: ["math"], name: "adds", diff: [] });
 * console.log(entry._tag); // FailureEntry
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FailureEntry extends S.Opaque<FailureEntry, { readonly brand: unique symbol }>()(
  S.TaggedStruct("FailureEntry", {
    unit: Text,
    path: S.Array(S.String),
    name: S.String,
    location: optionalSlot(Location),
    code: optionalSlot(Text),
    label: optionalSlot(HistoryLabel),
    failureKind: optionalSlot(FailureKind),
    message: optionalSlot(S.String),
    diff: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("FailureEntry", {
      description: "One failing or warning item as the console shows it.",
    })
  )
) {}

/**
 * A note in the entries section: an empty-run warning, a policy breach, a
 * cancellation or stray output.
 *
 * **Example** (Build a note)
 *
 * ```ts
 * import { NoteEntry } from "@beep/gate-report/ConsoleDocument";
 *
 * console.log(NoteEntry.make({ lines: ["coverage lines 72% < 80%"] }).lines.length); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NoteEntry extends S.Opaque<NoteEntry, { readonly brand: unique symbol }>()(
  S.TaggedStruct("NoteEntry", {
    lines: S.String.pipe(S.NonEmptyArray),
  }).pipe(
    $I.annoteSchema("NoteEntry", {
      description: "A note in the entries section of a console document.",
    })
  )
) {}

/**
 * An entry of the console document: a failure entry or a note.
 *
 * **Example** (Guard an entry)
 *
 * ```ts
 * import { ConsoleEntry, NoteEntry } from "@beep/gate-report/ConsoleDocument";
 *
 * console.log(ConsoleEntry.guards.NoteEntry(NoteEntry.make({ lines: ["x"] }))); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConsoleEntry = S.Union([FailureEntry, NoteEntry]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ConsoleEntry", {
    description: "An entry of the console document: a failure entry or a note.",
  })
);

/**
 * Type of {@link ConsoleEntry}.
 *
 * @category models
 * @since 0.0.0
 */
export type ConsoleEntry = typeof ConsoleEntry.Type;

/**
 * One folded cause: a diagnostic code, how many items it stands for, the
 * cause and the caller-supplied fix command.
 *
 * **Example** (Build a fold line)
 *
 * ```ts
 * import { FoldLine } from "@beep/gate-report/ConsoleDocument";
 *
 * const fold = FoldLine.make({ code: "TS6305", count: 701, cause: "upstream declarations are not built" });
 * console.log(fold.count); // 701
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FoldLine extends S.Opaque<FoldLine, { readonly brand: unique symbol }>()(
  S.Struct({
    code: Text,
    count: Count,
    cause: S.String,
    fix: optionalSlot(Text),
  }).pipe(
    $I.annoteSchema("FoldLine", {
      description: "A cascade of diagnostics with one cause, folded to one line.",
    })
  )
) {}

/**
 * The cap: how many entries and folds the budget left in the record only.
 *
 * **Example** (Build a cap)
 *
 * ```ts
 * import { CapLine } from "@beep/gate-report/ConsoleDocument";
 *
 * console.log(CapLine.make({ dropped: 4 }).dropped); // 4
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CapLine extends S.Opaque<CapLine, { readonly brand: unique symbol }>()(
  S.Struct({
    dropped: Count,
  }).pipe(
    $I.annoteSchema("CapLine", {
      description: "How many entries and folds the console budget left in the record only.",
    })
  )
) {}

/**
 * The pointer line: the commands to run next.
 *
 * **Example** (Build a pointer line)
 *
 * ```ts
 * import { PointerLine } from "@beep/gate-report/ConsoleDocument";
 *
 * console.log(PointerLine.make({ commands: ["beep gate show test"] }).commands[0]); // beep gate show test
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PointerLine extends S.Opaque<PointerLine, { readonly brand: unique symbol }>()(
  S.Struct({
    commands: Text.pipe(S.NonEmptyArray),
  }).pipe(
    $I.annoteSchema("PointerLine", {
      description: "The commands the console points to next.",
    })
  )
) {}

/**
 * The neutral console document: verdict, entries, folds, cap, delta, path and
 * pointer, in the order the console prints them.
 *
 * **Details**
 *
 * A green document holds the verdict alone, with the delta as its suffix. A
 * renderer prints the verdict line first and again last. The library maps the
 * same document onto terminal blocks; {@link ConsoleDocument} itself names no
 * renderer.
 *
 * **Example** (Build a green document)
 *
 * ```ts
 * import { ConsoleDocument, VerdictLine } from "@beep/gate-report/ConsoleDocument";
 *
 * const document = ConsoleDocument.make({
 *   verdict: VerdictLine.make({ gate: "test", scope: "@beep/glob", reason: "passed", counts: "3/3 passed", durationMs: 10 }),
 *   entries: [],
 *   folds: [],
 * });
 * console.log(document.entries.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleDocument extends S.Opaque<ConsoleDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    verdict: VerdictLine,
    entries: S.Array(ConsoleEntry),
    folds: S.Array(FoldLine),
    cap: optionalSlot(CapLine),
    delta: optionalSlot(RunDelta),
    path: optionalSlot(RecordPaths),
    pointer: optionalSlot(PointerLine),
  }).pipe(
    $I.annoteSchema("ConsoleDocument", {
      description: "The neutral console document of one gate run.",
    })
  )
) {}
