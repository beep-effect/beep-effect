/**
 * The query services behind the planned `gate` command family: show a run's
 * record, and show one item of it in full. Services only; the command tree
 * lives in the repo CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { formatDuration } from "@beep/gate-report/Format";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { Item } from "@beep/gate-report/Item";
import { Position } from "@beep/gate-report/Scalars";
import { ItemOutcome } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import {
  GateName,
  RecordLocation,
  RecordTarget,
  RepoRelativeDir,
  RunId,
  recordLocation,
} from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GateRecordReadError } from "@beep/repo-gate-record/GateRecordFile";
import type { GateRecordStoreShape } from "@beep/repo-gate-record/GateRecordStore";

const $I = $RepoGateRunId.create("GateQueries");

/**
 * Which run of a gate: a package's latest run, or a root run by id, the
 * newest when no id is given.
 *
 * **Example** (Address the newest root run)
 *
 * ```ts
 * import { RunScope } from "@beep/repo-gate-run/GateQueries";
 *
 * console.log(RunScope.cases.RootRun.make({})._tag); // RootRun
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunScope = S.TaggedUnion({
  PackageRun: { packageDir: RepoRelativeDir },
  RootRun: { runId: S.OptionFromOptionalKey(RunId).pipe(S.withConstructorDefault(Effect.succeedNone)) },
}).pipe(
  $I.annoteSchema("RunScope", {
    description: "A package's latest run, or a root run by id (the newest when none is given).",
  })
);

/**
 * Type of {@link RunScope}.
 *
 * @category models
 * @since 0.0.0
 */
export type RunScope = typeof RunScope.Type;

/**
 * A run to show: the gate and the run's scope.
 *
 * **Example** (Ask for a package's test run)
 *
 * ```ts
 * import { RunQuery, RunScope } from "@beep/repo-gate-run/GateQueries";
 *
 * const query = RunQuery.make({ gate: "test", scope: RunScope.cases.PackageRun.make({ packageDir: "packages/glob" }) });
 * console.log(query.gate); // test
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RunQuery extends S.Opaque<RunQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: GateName,
    scope: RunScope,
  }).pipe(
    $I.annoteSchema("RunQuery", {
      description: "A run to show: its gate and scope.",
    })
  )
) {}

/**
 * Which item of a run: by its position among the run's failing and warning
 * items, as the console lists them, or by text its title or unit contains.
 *
 * **Example** (Select the first listed item)
 *
 * ```ts
 * import { ItemSelector } from "@beep/repo-gate-run/GateQueries";
 *
 * console.log(ItemSelector.cases.ByPosition.make({ position: 1 }).position); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ItemSelector = S.TaggedUnion({
  ByPosition: { position: Position },
  ByText: { text: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("ItemSelector", {
    description: "An item by its one-based position among listed items, or by text in its title or unit.",
  })
);

/**
 * Type of {@link ItemSelector}.
 *
 * @category models
 * @since 0.0.0
 */
export type ItemSelector = typeof ItemSelector.Type;

/**
 * An item to show: the run and the selector.
 *
 * **Example** (Ask for the first item of a run)
 *
 * ```ts
 * import { ItemQuery, ItemSelector, RunQuery, RunScope } from "@beep/repo-gate-run/GateQueries";
 *
 * const query = ItemQuery.make({
 *   run: RunQuery.make({ gate: "check", scope: RunScope.cases.RootRun.make({}) }),
 *   selector: ItemSelector.cases.ByPosition.make({ position: 1 }),
 * });
 * console.log(query.selector._tag); // ByPosition
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ItemQuery extends S.Opaque<ItemQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    run: RunQuery,
    selector: ItemSelector,
  }).pipe(
    $I.annoteSchema("ItemQuery", {
      description: "An item to show: its run and its selector.",
    })
  )
) {}

/**
 * A run as shown: where its record and log are, and the record.
 *
 * **Example** (Build a run view)
 *
 * ```ts
 * import { GateRecord } from "@beep/gate-report/GateRecord";
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { RecordLocation } from "@beep/repo-gate-record/GatePaths";
 * import { RunView } from "@beep/repo-gate-run/GateQueries";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * const view = RunView.make({
 *   location: RecordLocation.make({ record: ".beep/gates/test/r1.json", log: ".beep/gates/test/r1.log" }),
 *   record: GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report }),
 * });
 * console.log(view.record.report.runId); // r1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RunView extends S.Opaque<RunView, { readonly brand: unique symbol }>()(
  S.Struct({
    location: RecordLocation,
    record: GateRecord,
  }).pipe(
    $I.annoteSchema("RunView", {
      description: "A shown run: its record and log location and its record.",
    })
  )
) {}

/**
 * An item as shown: its run's location and id, the item, and its full text.
 *
 * **Example** (Build an item view)
 *
 * ```ts
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 * import { RecordLocation } from "@beep/repo-gate-record/GatePaths";
 * import { ItemView, itemLines } from "@beep/repo-gate-run/GateQueries";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "adds" }),
 *   unit: "src/a.test.ts", path: [], name: "adds", outcome: "failed",
 * });
 * const view = ItemView.make({
 *   location: RecordLocation.make({ record: ".beep/gates/test/r1.json", log: ".beep/gates/test/r1.log" }),
 *   runId: "r1",
 *   item,
 *   lines: itemLines(item),
 * });
 * console.log(view.lines[1]); // outcome: failed
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ItemView extends S.Opaque<ItemView, { readonly brand: unique symbol }>()(
  S.Struct({
    location: RecordLocation,
    runId: S.String,
    item: Item,
    lines: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ItemView", {
      description: "A shown item: its run's location and id, the item and its full text.",
    })
  )
) {}

/**
 * Why a query found nothing: the gate has no root runs, or no item matches.
 *
 * **Example** (Match a reason)
 *
 * ```ts
 * import { QueryMiss } from "@beep/repo-gate-run/GateQueries";
 *
 * console.log(QueryMiss.is["no-item"]("no-item")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QueryMiss = LiteralKit(["no-runs", "no-item"]).pipe(
  $I.annoteSchema("QueryMiss", {
    description: "Why a gate query found nothing: no root runs, or no matching item.",
  })
);

/**
 * Type of {@link QueryMiss}.
 *
 * @category models
 * @since 0.0.0
 */
export type QueryMiss = typeof QueryMiss.Type;

/**
 * A gate query found nothing to show.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GateQueryError } from "@beep/repo-gate-run/GateQueries";
 *
 * console.log(GateQueryError.make({ miss: "no-runs", message: "the test gate has no root runs" }).miss); // no-runs
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateQueryError extends S.TaggedError<GateQueryError, { readonly brand: unique symbol }>(
  $I`GateQueryError`
)(
  "GateQueryError",
  { miss: QueryMiss, message: S.String },
  $I.annoteError<GateQueryError>("GateQueryError", {
    description: "A gate query found nothing to show: no root runs, or no matching item.",
  })
) {}

const titleOf = (item: Item): string => A.join(A.append(item.path, item.name), " > ");

const section = (label: string, text: O.Option<string>): ReadonlyArray<string> =>
  O.match(text, {
    onNone: () => [],
    onSome: (value) => [`${label}:`, ...A.map(Str.split(value, "\n"), (line) => `  ${line}`)],
  });

const field = (label: string, value: O.Option<string>): ReadonlyArray<string> =>
  A.fromOption(O.map(value, (text) => `${label}: ${text}`));

/**
 * An item's full text: its unit and title, outcome, location, code, rule,
 * label, signature, attempts and duration, and its whole message, diff and
 * stack, unbounded.
 *
 * **Example** (Show a passed item)
 *
 * ```ts
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 * import { itemLines } from "@beep/repo-gate-run/GateQueries";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "adds" }),
 *   unit: "src/a.test.ts", path: [], name: "adds", outcome: "passed",
 * });
 * console.log(itemLines(item)[1]); // outcome: passed
 * ```
 *
 * @param item - the recorded item to show
 * @returns every field the item carries, with its message, diff and stack whole
 * @category projections
 * @since 0.0.0
 */
export const itemLines = (item: Item): ReadonlyArray<string> => [
  `${item.unit} > ${titleOf(item)}`,
  `outcome: ${item.outcome}${pipe(
    item.failureKind,
    O.map((kind) => ` (${kind})`),
    O.getOrElse(() => "")
  )}`,
  ...field(
    "location",
    O.map(item.location, (location) => `${location.file}:${location.line}:${location.column}`)
  ),
  ...field("code", item.code),
  ...field("rule", item.rule),
  ...field("label", item.label),
  ...field("signature", item.signature),
  ...field("attempts", O.map(item.attempts, A.join(", "))),
  ...field("duration", O.map(item.durationMs, formatDuration)),
  ...section(
    "message",
    O.map(item.detail, (detail) => detail.message)
  ),
  ...section(
    "diff",
    O.flatMap(item.detail, (detail) => detail.diff)
  ),
  ...section(
    "stack",
    O.flatMap(item.detail, (detail) => detail.stack)
  ),
];

// The items the console lists, failing and warning ones in record order; skipped and passed items
// never shift a position.
const listed = (record: GateRecord): ReadonlyArray<Item> =>
  A.filter(record.report.items, (item) => ItemOutcome.is.failed(item.outcome) || ItemOutcome.is.warned(item.outcome));

const select = (record: GateRecord, selector: ItemSelector): O.Option<Item> =>
  ItemSelector.match(selector, {
    ByPosition: (byPosition) => A.get(listed(record), byPosition.position - 1),
    ByText: (byText) =>
      A.findFirst(listed(record), (item) =>
        A.some([titleOf(item), item.unit], (text) => Str.includes(byText.text)(text))
      ),
  });

/**
 * The query services' operations.
 *
 * **Details**
 *
 * `showRun` reads a package's record, or a root run's (the newest when no
 * id is given). `showItem` selects one item of that run among its failing
 * and warning items and returns it with its full text.
 *
 * **Example** (Use the shape)
 *
 * ```ts
 * import type { GateQueriesShape } from "@beep/repo-gate-run/GateQueries";
 *
 * const show = (queries: GateQueriesShape) => queries.showRun;
 * console.log(typeof show); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateQueriesShape {
  readonly showItem: (query: ItemQuery) => Effect.Effect<ItemView, GateRecordReadError | GateQueryError>;
  readonly showRun: (query: RunQuery) => Effect.Effect<RunView, GateRecordReadError | GateQueryError>;
}

const makeQueries = (store: GateRecordStoreShape): GateQueriesShape => {
  const targetOf = (query: RunQuery) =>
    RunScope.match(query.scope, {
      PackageRun: (scope) =>
        Effect.succeed(RecordTarget.cases.PackageTarget.make({ packageDir: scope.packageDir, gate: query.gate })),
      RootRun: (scope) =>
        pipe(
          scope.runId,
          O.match({
            onSome: (runId) => Effect.succeed(runId),
            onNone: () =>
              Effect.flatMap(store.listRuns(query.gate), (runs) =>
                Effect.fromOption(A.head(runs)).pipe(
                  Effect.mapError(() =>
                    GateQueryError.make({ miss: "no-runs", message: `the ${query.gate} gate has no root runs` })
                  )
                )
              ),
          }),
          Effect.map((runId) => RecordTarget.cases.RootTarget.make({ gate: query.gate, runId }))
        ),
    });

  const showRun = Effect.fn("GateQueries.showRun")(function* (query: RunQuery) {
    const target = yield* targetOf(query);
    const record = yield* store.readRecord(target);
    return RunView.make({ location: recordLocation(target), record });
  });

  const showItem = Effect.fn("GateQueries.showItem")(function* (query: ItemQuery) {
    const view = yield* showRun(query.run);
    const item = yield* Effect.fromOption(select(view.record, query.selector)).pipe(
      Effect.mapError(() => GateQueryError.make({ miss: "no-item", message: "no listed item matches the selector" }))
    );
    return ItemView.make({ location: view.location, runId: view.record.report.runId, item, lines: itemLines(item) });
  });

  return { showRun, showItem };
};

/**
 * The query services.
 *
 * **Example** (Provide the queries over the memory store)
 *
 * ```ts
 * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
 * import { GateQueries } from "@beep/repo-gate-run/GateQueries";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(GateQueries.layer.pipe(Layer.provide(GateRecordStore.layerMemory)))); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateQueries extends Context.Service<GateQueries, GateQueriesShape>()($I`GateQueries`) {
  /**
   * The queries over the record store.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { GateQueries } from "@beep/repo-gate-run/GateQueries";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateQueries.layer)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GateQueries, never, GateRecordStore> = Layer.effect(
    GateQueries,
    GateRecordStore.use((store) => Effect.succeed(GateQueries.of(makeQueries(store))))
  );
}
