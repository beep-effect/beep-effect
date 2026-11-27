/**
 * The history queries of the `gate` command family: list a subject's runs,
 * and show one item's series by branch.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, locatePackage } from "@beep/repo-gate-record/PackageLocation";
import { WORKSPACE_SUBJECT } from "@beep/repo-gate-run/ConsoleDefaults";
import { HistoryItemQuery, HistoryRunsQuery } from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, constFalse } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HistorySetting, historyStoreLayer, resolveHistoryTarget } from "./GateHistoryRuntime.ts";
import type { HistoryItemSeries, HistoryRunView } from "@beep/repo-gate-run/GateHistoryRecord";
import type { GateHistoryTarget } from "./GateHistoryRuntime.ts";

const $I = $RepoCliId.create("commands/Gate/GateHistoryQuery");

/**
 * Which history to read: the package directory (the working directory's
 * package by default, else the workspace runs), one branch or every one,
 * and the history setting.
 *
 * **Example** (Every branch of the working directory's package)
 *
 * ```ts
 * import { HistoryWhere } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(HistoryWhere.make({}).history._tag) // HistoryAuto
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HistoryWhere extends S.Opaque<HistoryWhere, { readonly brand: unique symbol }>()(
  S.Struct({
    dir: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    branch: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    history: HistorySetting.pipe(
      S.withConstructorDefault(Effect.sync(() => HistorySetting.cases.HistoryAuto.make({})))
    ),
  }).pipe(
    $I.annoteSchema("HistoryWhere", {
      description: "The package directory, branch and history setting a history query reads.",
    })
  )
) {}

const at = (instant: DateTime.Utc): string => DateTime.formatIso(instant);

/**
 * The lines of a subject's run list, newest first.
 *
 * **Example** (No runs)
 *
 * ```ts
 * import { historyRunLines } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(historyRunLines([])) // ["no recorded runs"]
 * ```
 *
 * @param runs - the subject's runs, newest first
 * @returns one line per run: id, branch, origin, time, failures, observations and input
 * @category projections
 * @since 0.0.0
 */
export const historyRunLines = (runs: ReadonlyArray<HistoryRunView>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(runs)
    ? ["no recorded runs"]
    : A.map(
        runs,
        (run) =>
          `${run.runId} ${run.branch} ${run.origin} ${at(run.at)}: ${run.failed} failed, ${run.observations} observed over ${run.units} unit(s); input ${run.inputFingerprint}`
      );

const seriesLines = (series: HistoryItemSeries): ReadonlyArray<string> => [
  `${series.title} on ${series.branch} (${series.origin})${series.flaky ? " [flaky]" : ""}`,
  ...A.map(
    series.observations,
    (observation) =>
      `  ${at(observation.at)} ${observation.runId} attempt ${observation.attempt}: ${observation.outcome}; input ${observation.inputFingerprint}`
  ),
];

/**
 * The lines of one item's series, one block per branch and origin.
 *
 * **Example** (No series)
 *
 * ```ts
 * import { itemSeriesLines } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(itemSeriesLines([])) // ["no recorded item matches"]
 * ```
 *
 * @param series - the item's series by branch
 * @returns a header per series, flagged when flaky, and one line per observation
 * @category projections
 * @since 0.0.0
 */
export const itemSeriesLines = (series: ReadonlyArray<HistoryItemSeries>): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(series) ? ["no recorded item matches"] : A.flatMap(series, seriesLines);

const NO_STORE = ["no history store for this checkout"];

const packageDirOf = Effect.fnUntraced(function* (dir: string, root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let at = dir;
  while (Str.startsWith(`${root}${path.sep}`)(at)) {
    const held = yield* fs.exists(path.join(at, "package.json")).pipe(Effect.orElseSucceed(constFalse));
    if (held) return at;
    at = path.dirname(at);
  }
  return dir;
});

const subjectOf = Effect.fnUntraced(function* (where: HistoryWhere) {
  const path = yield* Path.Path;
  const cwd = path.resolve(process.cwd());
  const root = yield* findRepoRoot(cwd);
  const base = O.getOrElse(root, constant(cwd));
  const dir = O.match(where.dir, { onNone: () => cwd, onSome: (relative) => path.resolve(base, relative) });
  const packageDir = yield* packageDirOf(dir, base);
  const located = yield* locatePackage(packageDir);
  return {
    repoRoot: O.getOrElse(
      O.map(located, (found) => found.repoRoot),
      () => base
    ),
    subject: O.getOrElse(
      O.map(located, (found) => found.subject),
      () => WORKSPACE_SUBJECT
    ),
  };
});

const withStore = <A, E>(target: GateHistoryTarget, effect: Effect.Effect<A, E, GateHistoryStore>) =>
  historyStoreLayer(target).pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(effect, context)),
    Effect.scoped
  );

const queryLines = Effect.fnUntraced(function* <E>(
  where: HistoryWhere,
  read: (subject: string) => Effect.Effect<ReadonlyArray<string>, E, GateHistoryStore>
) {
  const { repoRoot, subject } = yield* subjectOf(where);
  const target = yield* resolveHistoryTarget(repoRoot, where.history);
  return yield* O.match(target, {
    onNone: () => Effect.succeed<ReadonlyArray<string>>(NO_STORE),
    onSome: (found) => withStore(found, read(subject)),
  });
});

/**
 * List a subject's recorded runs, newest first, on one branch or every one.
 *
 * **Example** (List the package's history)
 *
 * ```ts
 * import { HistoryWhere, listHistoryLines } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(listHistoryLines("test", HistoryWhere.make({})))) // true
 * ```
 *
 * @param gate - the gate whose runs to list
 * @param where - the package directory, branch and history setting
 * @returns one line per run, newest first
 * @category use-cases
 * @since 0.0.0
 */
export const listHistoryLines = Effect.fn("Gate.listHistoryLines")(function* (gate: string, where: HistoryWhere) {
  return yield* queryLines(where, (subject) =>
    Effect.flatMap(GateHistoryStore, (store) =>
      Effect.map(store.runs(HistoryRunsQuery.make({ gate, subject, branch: where.branch })), historyRunLines)
    )
  );
});

/**
 * Show one item's series by branch: the item whose key fingerprint is the
 * selector, or whose title contains it.
 *
 * **Example** (Show an item's series)
 *
 * ```ts
 * import { HistoryWhere, showSeriesLines } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(showSeriesLines("test", "adds", HistoryWhere.make({})))) // true
 * ```
 *
 * @param gate - the gate the item belongs to
 * @param selector - the item's key fingerprint or text in its title
 * @param where - the package directory and history setting
 * @returns one header per branch and origin, then one line per observation
 * @category use-cases
 * @since 0.0.0
 */
export const showSeriesLines = Effect.fn("Gate.showSeriesLines")(function* (
  gate: string,
  selector: string,
  where: HistoryWhere
) {
  return yield* queryLines(where, (subject) =>
    Effect.flatMap(GateHistoryStore, (store) =>
      Effect.map(store.series(HistoryItemQuery.make({ gate, subject, selector })), itemSeriesLines)
    )
  );
});
