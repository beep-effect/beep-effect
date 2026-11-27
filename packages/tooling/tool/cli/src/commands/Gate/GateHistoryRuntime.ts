/**
 * Gate run history on the repo CLI's task path: where the store is, which
 * branch a run is recorded under, the history slot a gate run reads under
 * its deadline, and the ingest that runs after the console is printed.
 *
 * **Details**
 *
 * The store is one SQLite file per repository,
 * `$XDG_STATE_HOME/beep/gate-history/<repository-key>.sqlite`, keyed by the
 * canonical `origin` URL (decision `store-path-and-repository-key`). It is
 * opened only by the CLI under Bun, never inside a Vitest process: the
 * automatic setting is off when `VITEST` is set, and `BEEP_GATE_HISTORY=off`
 * turns it off anywhere. `BEEP_GATE_HISTORY_FILE` names another file, which
 * does not turn history on inside Vitest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateHistoryError, HistoryConfig } from "@beep/gate-report/History";
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import {
  repositoryKeyFromCommonDir,
  repositoryKeyFromOrigin,
  STORE_DIRECTORY,
  storeFileName,
} from "@beep/repo-gate-run/GateHistoryLocation";
import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistorySqliteOptions, layerSqlite } from "@beep/repo-gate-run/GateHistorySqlite";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import { AppDirs } from "@beep/xdg/AppDirs";
import { Xdg } from "@beep/xdg/Xdg";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GateReport } from "@beep/gate-report/GateReport";

const $I = $RepoCliId.create("commands/Gate/GateHistoryRuntime");

/**
 * **Details**
 *
 * `HistoryAuto` resolves the repository's store file and the checkout's
 * branch, and is off inside Vitest or with `BEEP_GATE_HISTORY=off`.
 * `HistoryOff` keeps none. `HistoryAt` names the file, the configuration
 * and, optionally, the scope instead of asking git.
 *
 * **Example** (Keep no history)
 *
 * ```ts
 * import { HistorySetting } from "@beep/repo-cli/commands/Gate"
 *
 * console.log(HistorySetting.cases.HistoryOff.make({})._tag) // HistoryOff
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HistorySetting = S.TaggedUnion({
  HistoryAuto: {},
  HistoryOff: {},
  HistoryAt: {
    filename: S.NonEmptyString,
    config: HistoryConfig,
    scope: S.OptionFromOptionalKey(HistoryScope).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
}).pipe(
  $I.annoteSchema("HistorySetting", {
    description: "Whether a gate run keeps history: resolved automatically, off, or at a named file and scope.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type HistorySetting = typeof HistorySetting.Type;

/**
 * A resolved history: the store's file and configuration, and the scope runs
 * are recorded under.
 *
 * **Example** (A resolved history)
 *
 * ```ts
 * import { HistoryConfig } from "@beep/gate-report/History"
 * import { GateHistoryTarget } from "@beep/repo-cli/commands/Gate"
 * import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord"
 *
 * const target = GateHistoryTarget.make({
 *   filename: "/home/alice/.local/state/beep/gate-history/github.com__acme__app.sqlite",
 *   config: HistoryConfig.make({}),
 *   scope: HistoryScope.make({ branch: "feature/a" }),
 * })
 * console.log(target.scope.branch) // feature/a
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GateHistoryTarget extends S.Opaque<GateHistoryTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    filename: S.NonEmptyString,
    config: HistoryConfig,
    scope: HistoryScope,
  }).pipe(
    $I.annoteSchema("GateHistoryTarget", {
      description: "The history store file and configuration a gate run uses, and the branch it records under.",
    })
  )
) {}

const OFF_VALUES = ["0", "off", "false", "no"];

const envValue = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(
    Effect.map(flow(O.map(Str.trim), O.filter(Str.isNonEmpty))),
    Effect.orElseSucceed(O.none<string>)
  );

const repositoryKey = Effect.fnUntraced(function* (repoRoot: string) {
  const git = yield* Git;
  const origin = yield* git.remoteUrl(repoRoot).pipe(Effect.orElseSucceed(O.none<string>));
  const fromOrigin = O.flatMap(origin, repositoryKeyFromOrigin);
  if (O.isSome(fromOrigin)) return fromOrigin.value;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commonDir = yield* git.commonDir(repoRoot);
  const real = yield* fs.realPath(path.resolve(repoRoot, commonDir));
  const digest = yield* Layer.build(Digest.layerWebCrypto);
  return yield* Effect.provideContext(repositoryKeyFromCommonDir(real), digest);
});

const stateDirectory = Effect.fnUntraced(function* () {
  const dirs = yield* Layer.build(AppDirs.layer({ namespace: "beep" }).pipe(Layer.provide(Xdg.layer)));
  return yield* Effect.provideContext(
    Effect.flatMap(AppDirs, (appDirs) => appDirs.ensureState),
    dirs
  );
});

const autoFile = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const vitest = yield* envValue("VITEST");
  if (O.isSome(vitest)) return O.none<string>();
  const named = yield* envValue("BEEP_GATE_HISTORY_FILE");
  if (O.isSome(named)) return named;
  const key = yield* repositoryKey(repoRoot);
  const state = yield* stateDirectory();
  const directory = path.join(state, STORE_DIRECTORY);
  yield* fs.makeDirectory(directory, { recursive: true });
  return O.some(path.join(directory, storeFileName(key)));
});

const checkoutScope = Effect.fnUntraced(function* (repoRoot: string) {
  const git = yield* Git;
  const head = yield* Effect.option(git.revParse(repoRoot, "HEAD"));
  if (O.isNone(head)) return O.none<HistoryScope>();
  const branch = yield* git.currentBranch(repoRoot).pipe(Effect.orElseSucceed(O.none<string>));
  const recorded = O.getOrElse(branch, constant(`detached@${head.value}`));
  return HistoryScope.makeOption({ branch: recorded, head });
});

const autoTarget = Effect.fnUntraced(function* (repoRoot: string) {
  const switched = yield* envValue("BEEP_GATE_HISTORY");
  if (O.exists(switched, (value) => A.contains(OFF_VALUES, Str.toLowerCase(value)))) {
    return O.none<GateHistoryTarget>();
  }
  const file = yield* autoFile(repoRoot);
  if (O.isNone(file)) return O.none<GateHistoryTarget>();
  const scope = yield* checkoutScope(repoRoot);
  return O.map(scope, (found) =>
    GateHistoryTarget.make({ filename: file.value, config: HistoryConfig.make({}), scope: found })
  );
});

const namedTarget = Effect.fnUntraced(function* (
  repoRoot: string,
  setting: typeof HistorySetting.cases.HistoryAt.Type
) {
  const scope = O.isSome(setting.scope) ? setting.scope : yield* checkoutScope(repoRoot);
  return O.map(scope, (found) =>
    GateHistoryTarget.make({ filename: setting.filename, config: setting.config, scope: found })
  );
});

/**
 * Resolve where a gate run keeps history, if anywhere.
 *
 * **Details**
 *
 * Resolution never fails a gate run: outside a git checkout, without a state
 * directory, or on any other failure there is no history and the run
 * renders as before.
 *
 * **Gotchas**
 *
 * A detached checkout records under `detached@<commit>`, so it never joins a branch's series.
 *
 * **Example** (Keep no history)
 *
 * ```ts
 * import { HistorySetting, resolveHistoryTarget } from "@beep/repo-cli/commands/Gate"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveHistoryTarget("/repo", HistorySetting.cases.HistoryOff.make({})))) // true
 * ```
 *
 * @param repoRoot - the repository root the gate run records under
 * @param setting - automatic, off, or a named file and scope
 * @returns the store file, configuration and scope, or none
 * @category use-cases
 * @since 0.0.0
 */
export const resolveHistoryTarget = Effect.fn("Gate.resolveHistoryTarget")(
  function* (repoRoot: string, setting: HistorySetting) {
    return yield* HistorySetting.match(setting, {
      HistoryAuto: () => autoTarget(repoRoot),
      HistoryOff: () => Effect.succeedNone,
      HistoryAt: (named) => namedTarget(repoRoot, named),
    });
  },
  (effect) => Effect.flatMap(Layer.build(Git.layer), (git) => Effect.provideContext(effect, git)),
  Effect.scoped,
  Effect.orElseSucceed(O.none<GateHistoryTarget>)
);

const sqliteStoreFor = (target: GateHistoryTarget): Layer.Layer<GateHistoryStore> =>
  layerSqlite(GateHistorySqliteOptions.make({ filename: target.filename, config: target.config }));

/**
 * Which history store backs a resolved target.
 *
 * **Details**
 *
 * The default is the SQLite store, which loads its driver by dynamic import on
 * first use. A test provides another backend, such as one in-memory store
 * shared by several runs, without changing how a gate run resolves or uses
 * its history.
 *
 * **Example** (Back history with an in-memory store)
 *
 * ```ts
 * import { HistoryStoreBackend } from "@beep/repo-cli/commands/Gate"
 * import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.provideService(Effect.void, HistoryStoreBackend, () => GateHistoryStore.layerMemory())
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const HistoryStoreBackend: Context.Reference<(target: GateHistoryTarget) => Layer.Layer<GateHistoryStore>> =
  Context.Reference<(target: GateHistoryTarget) => Layer.Layer<GateHistoryStore>>($I`HistoryStoreBackend`, {
    defaultValue: constant(sqliteStoreFor),
  });

/**
 * The history store for a resolved target, from {@link HistoryStoreBackend}:
 * the SQLite store at the target's file unless a backend is provided.
 *
 * **Example** (A store layer)
 *
 * ```ts
 * import { HistoryConfig } from "@beep/gate-report/History"
 * import { GateHistoryTarget, historyStoreLayer } from "@beep/repo-cli/commands/Gate"
 * import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord"
 * import * as Layer from "effect/Layer"
 *
 * const target = GateHistoryTarget.make({ filename: ":memory:", config: HistoryConfig.make({}), scope: HistoryScope.make({ branch: "a" }) })
 * console.log(Layer.isLayer(historyStoreLayer(target))) // true
 * ```
 *
 * @param target - the store file, configuration and scope
 * @returns a layer providing the store the backend gives for the target
 * @category layers
 * @since 0.0.0
 */
export const historyStoreLayer = (target: GateHistoryTarget): Layer.Layer<GateHistoryStore> =>
  Layer.unwrap(Effect.map(HistoryStoreBackend, (storeFor) => storeFor(target)));

const isHistoryError = S.is(GateHistoryError);

const failureLine = (cause: Cause.Cause<unknown>): string =>
  pipe(
    Cause.findErrorOption(cause),
    O.filter(isHistoryError),
    O.match({
      onSome: (error) => `${error.reason}: ${error.message}`,
      onNone: () => cause.pipe(Cause.pretty, Str.split("\n"), A.headNonEmpty),
    })
  );

/**
 * Record a report in history after its console was printed.
 *
 * **Details**
 *
 * A failed write leaves the console as printed and the exit code alone: it
 * prints one line on standard error naming the cause, and the call never
 * fails.
 *
 * **Example** (Record after printing)
 *
 * ```ts
 * import { HistoryConfig } from "@beep/gate-report/History"
 * import { GateHistoryTarget, ingestAfterConsole } from "@beep/repo-cli/commands/Gate"
 * import { HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord"
 *
 * const target = GateHistoryTarget.make({ filename: ":memory:", config: HistoryConfig.make({}), scope: HistoryScope.make({ branch: "a" }) })
 * console.log(typeof ingestAfterConsole(target)) // function
 * ```
 *
 * @param target - the scope the run is recorded under
 * @returns a function that records one report and never fails
 * @category use-cases
 * @since 0.0.0
 */
export const ingestAfterConsole = (target: GateHistoryTarget) =>
  Effect.fn("Gate.ingestAfterConsole")(
    function* (report: GateReport) {
      const store = yield* GateHistoryStore;
      yield* store.ingest(report, target.scope);
    },
    Effect.catchCause((cause) => Console.error(`gate history: run not recorded: ${failureLine(cause)}`))
  );
