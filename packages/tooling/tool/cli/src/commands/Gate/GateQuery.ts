/**
 * The gate query commands: `beep gate show <gate>` prints a run's record
 * (its verdict, totals, units, listed items and the record and log paths)
 * and `beep gate item <gate> <selector>` prints one item in full. Both read
 * through the gate-run library's `GateQueries` service.
 *
 * **Details**
 *
 * Which record: the package of `--dir` (relative to the repository root),
 * else the package the working directory is, else the repository root's newest run of the gate, or the
 * root run `--run` names. A selector that is a whole number is the item's
 * position among the listed items; anything else matches text in the item's
 * title or unit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { VerdictLine } from "@beep/gate-report/ConsoleDocument";
import { formatCounts } from "@beep/gate-report/Format";
import { verdictText } from "@beep/gate-report/PlainText";
import { $RepoCliId } from "@beep/identity/packages";
import { GateName, RunId } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { findRepoRoot, locatePackage } from "@beep/repo-gate-record/PackageLocation";
import { GateQueries, ItemQuery, ItemSelector, listedItems, RunQuery, RunScope } from "@beep/repo-gate-run/GateQueries";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { GateNotAPackage } from "./GateRuntime.ts";
import type { Unit } from "@beep/gate-report/GateReport";
import type { Item } from "@beep/gate-report/Item";
import type { ItemView, RunView } from "@beep/repo-gate-run/GateQueries";

const $I = $RepoCliId.create("commands/Gate/GateQuery");

/**
 * **Example** (Look at the newest root run)
 *
 * ```ts
 * import { QueryWhere } from "@beep/repo-cli/commands/Gate"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(QueryWhere.make({ dir: O.none(), run: O.none() }).dir)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QueryWhere extends S.Opaque<QueryWhere, { readonly brand: unique symbol }>()(
  S.Struct({
    dir: S.Option(S.String),
    run: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("QueryWhere", {
      description: "The package directory and the root run id a gate query was given, each optional.",
    })
  )
) {}

/**
 * **Example** (Describe a package query)
 *
 * ```ts
 * import { ResolvedRunQuery } from "@beep/repo-cli/commands/Gate"
 * import { RunQuery, RunScope } from "@beep/repo-gate-run/GateQueries"
 *
 * const resolved = ResolvedRunQuery.make({
 *   repoRoot: "/repo",
 *   query: RunQuery.make({ gate: "test", scope: RunScope.cases.PackageRun.make({ packageDir: "packages/a" }) }),
 * })
 * console.log(resolved.query.gate) // test
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedRunQuery extends S.Opaque<ResolvedRunQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    repoRoot: S.NonEmptyString,
    query: RunQuery,
  }).pipe(
    $I.annoteSchema("ResolvedRunQuery", {
      description: "The repository root a gate query reads under, and the run it shows.",
    })
  )
) {}

const decodeGate = S.decodeUnknownEffect(GateName);
const decodeRunId = S.decodeUnknownEffect(RunId);

const packageQuery = (gate: GateName, dir: string) =>
  Effect.flatMap(locatePackage(dir), (located) =>
    Effect.fromOption(located).pipe(
      Effect.mapBoth({
        onFailure: () => GateNotAPackage.make({ dir }),
        onSuccess: (found) =>
          ResolvedRunQuery.make({
            repoRoot: found.repoRoot,
            query: RunQuery.make({ gate, scope: RunScope.cases.PackageRun.make({ packageDir: found.packageDir }) }),
          }),
      })
    )
  );

const rootQuery = Effect.fnUntraced(function* (gate: GateName, cwd: string, run: O.Option<string>) {
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    Effect.flatMap(Effect.fromOption),
    Effect.mapError(() => GateNotAPackage.make({ dir: cwd }))
  );
  const runId = yield* Effect.transposeOption(O.map(run, decodeRunId));
  return ResolvedRunQuery.make({
    repoRoot,
    query: RunQuery.make({ gate, scope: RunScope.cases.RootRun.make({ runId }) }),
  });
});

/**
 * Resolve which record a query shows.
 *
 * **Gotchas**
 *
 * A relative `--dir` is repository-relative, as the console's pointer prints it.
 *
 * **Example** (Resolve the working directory's record)
 *
 * ```ts
 * import { QueryWhere, resolveRunQuery } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(resolveRunQuery("test", QueryWhere.make({ dir: O.none(), run: O.none() })))) // true
 * ```
 *
 * @param gate - Which gate's record to read: `test` or `check`.
 * @param where - The `--dir` and `--run` values given.
 * @returns The repository root and the run query.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveRunQuery = Effect.fn("Gate.resolveRunQuery")(function* (gate: string, where: QueryWhere) {
  const path = yield* Path.Path;
  const name = yield* decodeGate(gate);
  const cwd = path.resolve(process.cwd());
  if (O.isSome(where.run)) return yield* rootQuery(name, cwd, where.run);
  if (O.isSome(where.dir)) {
    const base = yield* findRepoRoot(cwd);
    return yield* packageQuery(
      name,
      path.resolve(
        O.getOrElse(base, () => cwd),
        where.dir.value
      )
    );
  }
  const here = yield* locatePackage(cwd);
  return yield* O.match(here, {
    onNone: () => rootQuery(name, cwd, O.none()),
    onSome: () => packageQuery(name, cwd),
  });
});

/**
 * Parse an item selector: a whole number is a position among the listed
 * items, anything else is text to match.
 *
 * **Example** (Select by position and by text)
 *
 * ```ts
 * import { itemSelectorOf } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(itemSelectorOf("2")._tag, itemSelectorOf("adds")._tag) // ByPosition ByText
 * ```
 *
 * @param text - What the user typed after the gate name.
 * @returns `ByPosition` for a whole number from 1, `ByText` otherwise.
 * @category utilities
 * @since 0.0.0
 */
export const itemSelectorOf = (text: string): ItemSelector =>
  pipe(
    O.liftPredicate(text, (value) => /^\d+$/u.test(value)),
    O.flatMap(Num.parse),
    O.flatMap((position) => ItemSelector.cases.ByPosition.makeOption({ position })),
    O.getOrElse(() => ItemSelector.cases.ByText.make({ text }))
  );

/**
 * Run a query against the record store at a repository root.
 *
 * **Example** (Provide the queries)
 *
 * ```ts
 * import { withQueries } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(withQueries("/repo")(Effect.void))) // true
 * ```
 *
 * @param repoRoot - The repository root the records live under.
 * @returns A function that provides the query service to a program.
 * @category use-cases
 * @since 0.0.0
 */
export const withQueries =
  (repoRoot: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    GateQueries.layer.pipe(
      Layer.provide(GateRecordStore.layer(repoRoot)),
      Layer.build,
      Effect.flatMap((context) => Effect.provide(effect, context)),
      Effect.scoped
    );

const titleOf = (item: Item): string => A.join(A.append(item.path, item.name), " > ");

const kindOf = (item: Item): string =>
  pipe(
    item.failureKind,
    O.map((kind) => `${item.outcome}, ${kind}`),
    O.getOrElse(() => item.outcome)
  );

const unitLine =
  (units: ReadonlyArray<Unit>) =>
  (unit: Unit): string => {
    const children = A.filter(units, (child) => O.contains(child.parent, unit.id)).length;
    return children === 0 ? `  ${unit.id} (${unit.kind})` : `  ${unit.id} (${unit.kind}, ${children} files)`;
  };

/**
 * The lines `beep gate show` prints for a run: the verdict, the run id, the
 * top-level units with their file counts, the listed items numbered as
 * `beep gate item` selects them, and the record and log paths.
 *
 * **Example** (Read the paths of a shown run)
 *
 * ```ts
 * import { runViewLines } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(typeof runViewLines) // function
 * ```
 *
 * @param view - The shown run.
 * @returns The lines, without newlines.
 * @category utilities
 * @since 0.0.0
 */
export const runViewLines = (view: RunView): ReadonlyArray<string> => {
  const report = view.record.report;
  const listed = listedItems(view.record);
  const topUnits = A.filter(report.units, (unit) => O.isNone(unit.parent));
  return [
    verdictText(
      VerdictLine.make({
        gate: report.gate,
        scope: report.subject,
        reason: report.reason,
        counts: formatCounts({ totals: report.totals, itemKind: report.itemKind }),
        durationMs: report.durationMs,
      })
    ),
    `run: ${report.runId}`,
    `units: ${topUnits.length}`,
    ...A.map(topUnits, unitLine(report.units)),
    `listed items: ${listed.length}`,
    ...A.map(listed, (item, index) => `  ${index + 1}. ${item.unit} > ${titleOf(item)} [${kindOf(item)}]`),
    `record: ${view.location.record}`,
    `log: ${view.location.log}`,
  ];
};

/**
 * The lines `beep gate item` prints: the run and record the item came from,
 * then the item in full (location, attempts, message, diff and stack).
 *
 * **Example** (Read an item view's printer)
 *
 * ```ts
 * import { itemViewLines } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(typeof itemViewLines) // function
 * ```
 *
 * @param view - The shown item.
 * @returns The lines, without newlines.
 * @category utilities
 * @since 0.0.0
 */
export const itemViewLines = (view: ItemView): ReadonlyArray<string> => [
  `run: ${view.runId} (record: ${view.location.record})`,
  ...view.lines,
];

/**
 * Show one run's record.
 *
 * **Example** (Show the newest root test run)
 *
 * ```ts
 * import { QueryWhere, showRunLines } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(showRunLines("test", QueryWhere.make({ dir: O.none(), run: O.none() })))) // true
 * ```
 *
 * @param gate - Which gate's record to read: `test` or `check`.
 * @param where - The `--dir` and `--run` values given.
 * @returns The lines `beep gate show` prints.
 * @category use-cases
 * @since 0.0.0
 */
export const showRunLines = Effect.fn("Gate.showRunLines")(function* (gate: string, where: QueryWhere) {
  const resolved = yield* resolveRunQuery(gate, where);
  const view = yield* GateQueries.use((queries) => queries.showRun(resolved.query)).pipe(
    withQueries(resolved.repoRoot)
  );
  return runViewLines(view);
});

/**
 * Show one item of a run in full.
 *
 * **Example** (Show the first listed check item)
 *
 * ```ts
 * import { QueryWhere, showItemLines } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(showItemLines("check", "1", QueryWhere.make({ dir: O.none(), run: O.none() })))) // true
 * ```
 *
 * @param gate - Which gate's record to read: `test` or `check`.
 * @param selector - A position among the listed items, or text to match.
 * @param where - The `--dir` and `--run` values given.
 * @returns The lines `beep gate item` prints.
 * @category use-cases
 * @since 0.0.0
 */
export const showItemLines = Effect.fn("Gate.showItemLines")(function* (
  gate: string,
  selector: string,
  where: QueryWhere
) {
  const resolved = yield* resolveRunQuery(gate, where);
  const view = yield* GateQueries.use((queries) =>
    queries.showItem(ItemQuery.make({ run: resolved.query, selector: itemSelectorOf(selector) }))
  ).pipe(withQueries(resolved.repoRoot));
  return itemViewLines(view);
});
