/**
 * `beep models` — check every routing surface against one operator manifest.
 *
 * **Details**
 *
 * Slice 1 is read-only. `check` reports drift and exits non-zero on it,
 * `catalog` prints the assembled layered catalog, and `init` seeds a manifest
 * only when none exists. No subcommand writes a projection target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A, O, pipe, Str } from "@beep/utils";
import { Config, Console, Effect, FileSystem, Match, Path } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { CatalogSnapshot } from "./Models.catalog.schemas.ts";
import { ModelsCommandError } from "./Models.errors.ts";
import { ModelsCheckReport } from "./Models.report.schemas.ts";
import { seedModelsManifest } from "./Models.seed.ts";
import {
  defaultManifestRelativePath,
  ModelsCatalog,
  ModelsCheck,
  ModelsLive,
  ModelsManifestStore,
} from "./Models.service.ts";
import type { DriftFinding } from "./Models.report.schemas.ts";

const encodeReport = S.encodeUnknownEffect(ModelsCheckReport);
const encodeSnapshot = S.encodeUnknownEffect(CatalogSnapshot);

const homeFlag = Flag.String("home").pipe(
  Flag.optional,
  Flag.withDescription("Operator home directory the $HOME targets resolve against (default: $HOME)")
);
const repoFlag = Flag.String("repo").pipe(
  Flag.optional,
  Flag.withDescription("Repo checkout the repo targets resolve against (default: the enclosing checkout)")
);
const manifestFlag = Flag.String("manifest").pipe(
  Flag.optional,
  Flag.withDescription("Routing manifest path (default: $HOME/.config/beep/models.yaml)")
);
const jsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Print the schema-encoded report or catalog snapshot")
);
const reportDirFlag = Flag.String("report-dir").pipe(
  Flag.optional,
  Flag.withDescription("Write models-report.md and models-report.json into this directory")
);
const offlineFlag = Flag.Boolean("offline").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip the upstream fetch and assemble from the local overlays alone")
);

const modelsFlags = {
  home: homeFlag,
  repo: repoFlag,
  manifest: manifestFlag,
  json: jsonFlag,
  reportDir: reportDirFlag,
  offline: offlineFlag,
};

// Every subcommand takes the same flag set, so the three runners share one
// named shape rather than three copies of the same literal.
interface ModelsCommandFlags {
  readonly home: O.Option<string>;
  readonly json: boolean;
  readonly manifest: O.Option<string>;
  readonly offline: boolean;
  readonly repo: O.Option<string>;
  readonly reportDir: O.Option<string>;
}

interface ResolvedPaths {
  readonly home: string;
  readonly manifestPath: string;
  readonly repo: string;
}

const resolvePaths = Effect.fnUntraced(function* (
  flags: Pick<ModelsCommandFlags, "home" | "manifest" | "repo">
): Effect.fn.Return<ResolvedPaths, ModelsCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const home = yield* pipe(
    flags.home,
    O.match({
      onNone: () =>
        Config.String("HOME").pipe(
          Effect.mapError(() => ModelsCommandError.make({ message: "HOME is unset; pass --home <dir> explicitly." }))
        ),
      onSome: Effect.succeed,
    })
  );
  const repo = yield* pipe(
    flags.repo,
    O.match({
      onNone: () => findRepoRoot().pipe(ModelsCommandError.mapError("Failed to locate the repo checkout root")),
      onSome: Effect.succeed,
    })
  );

  return {
    home,
    repo,
    manifestPath: O.getOrElse(flags.manifest, () => path.join(home, defaultManifestRelativePath)),
  };
});

const renderFinding = (entry: DriftFinding): string =>
  `models: ${entry.kind} ${entry.targetId} [${entry.locator._tag}] ${entry.path}` +
  pipe(
    entry.current,
    O.map((current) => ` current=${JSON.stringify(current)}`),
    O.getOrElse(() => "")
  ) +
  ` expected=${JSON.stringify(entry.expected)}`;

// An offline run leaves `diff` empty on purpose, so the counts would read as
// "catalog stable" to an operator. Say which of the two it is.
const renderCatalogDiff = (report: ModelsCheckReport): string =>
  Match.value(report.diffScope).pipe(
    Match.when("suppressed-offline", () => "catalog diff: suppressed (offline run)"),
    Match.when(
      "full",
      () =>
        `catalog diff: ${A.length(report.diff.added)} added, ${A.length(report.diff.removed)} removed, ` +
        `${A.length(report.diff.levelsChanged)} effort ladder(s) changed`
    ),
    Match.exhaustive
  );

const renderReportMarkdown = (report: ModelsCheckReport): string =>
  pipe(
    [
      "# Model Routing Check",
      "",
      `Catalog: ${report.catalog.modelCount} model(s) from ${A.join(report.catalog.sources, ", ")}`,
      renderCatalogDiff(report),
      `Unbound Codex candidates (propose only): ${A.join(report.candidates, ", ")}`,
      `Drift: ${report.hasDrift ? "yes" : "no"} (${A.length(report.findings)} finding(s))`,
      "",
      "| Target | Locator | Kind | Current | Expected |",
      "| --- | --- | --- | --- | --- |",
      ...A.map(
        report.findings,
        (entry) =>
          `| ${entry.targetId} | ${entry.locator._tag} | ${entry.kind} | ${pipe(
            entry.current,
            O.getOrElse(() => "—")
          )} | ${Str.slice(0, 60)(entry.expected)} |`
      ),
    ],
    A.join("\n")
  );

const writeReports = Effect.fnUntraced(function* (
  reportDir: O.Option<string>,
  report: ModelsCheckReport
): Effect.fn.Return<void, ModelsCommandError, FileSystem.FileSystem | Path.Path> {
  if (O.isNone(reportDir)) {
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const encoded = yield* encodeReport(report).pipe(
    ModelsCommandError.mapError("Failed to encode the models check report")
  );

  yield* fs
    .makeDirectory(reportDir.value, { recursive: true })
    .pipe(ModelsCommandError.mapError(`Failed to create ${reportDir.value}`));
  yield* fs
    .writeFileString(path.join(reportDir.value, "models-report.json"), formatJsonValue(encoded))
    .pipe(ModelsCommandError.mapError("Failed to write models-report.json"));
  yield* fs
    .writeFileString(path.join(reportDir.value, "models-report.md"), `${renderReportMarkdown(report)}\n`)
    .pipe(ModelsCommandError.mapError("Failed to write models-report.md"));
});

const runCheck = Effect.fnUntraced(function* (flags: ModelsCommandFlags) {
  const paths = yield* resolvePaths(flags);
  const check = yield* ModelsCheck;
  const report = yield* check.run({
    home: paths.home,
    repo: paths.repo,
    manifestPath: paths.manifestPath,
    offline: flags.offline,
  });

  if (flags.json) {
    const encoded = yield* encodeReport(report).pipe(
      ModelsCommandError.mapError("Failed to encode the models check report")
    );
    yield* Console.log(formatJsonValue(encoded));
  } else {
    yield* Effect.forEach(report.findings, (entry) => Console.log(renderFinding(entry)), { discard: true });
    yield* Console.log(
      `models: ${A.length(report.findings)} finding(s) across ${report.catalog.modelCount} catalog model(s) ` +
        `from ${A.join(report.catalog.sources, ", ")}`
    );
    yield* Console.log(`models: ${renderCatalogDiff(report)}`);
    yield* Effect.forEach(
      report.candidates,
      (id) => Console.log(`models: candidate ${id} (routable Codex model without a manifest binding; propose only)`),
      { discard: true }
    );
  }

  yield* writeReports(flags.reportDir, report);

  if (report.hasDrift) {
    return yield* failWithReportedExit(`models: drift detected in ${A.length(report.findings)} locator(s).`);
  }
});

const runCatalog = Effect.fnUntraced(function* (flags: ModelsCommandFlags) {
  const paths = yield* resolvePaths(flags);
  const catalog = yield* ModelsCatalog;
  const snapshot = yield* catalog
    .snapshot({ home: paths.home, offline: flags.offline })
    .pipe(Effect.mapError(ModelsCommandError.fromInternal));

  if (flags.json) {
    const encoded = yield* encodeSnapshot(snapshot).pipe(
      ModelsCommandError.mapError("Failed to encode the catalog snapshot")
    );
    return yield* Console.log(formatJsonValue(encoded));
  }

  yield* Effect.forEach(
    snapshot.models,
    (model) =>
      Console.log(
        `models: ${model.id} origin=${model.origin} levels=${A.join(model.levels, "|")} ` +
          `proxy=${model.availability.proxy} codex=${model.availability.codexCli} ` +
          `grok=${model.availability.grokCli} cursor=${model.availability.cursor}`
      ),
    { discard: true }
  );
  yield* Console.log(`models: ${snapshot.summary.modelCount} model(s) from ${A.join(snapshot.summary.sources, ", ")}`);
});

const runInit = Effect.fnUntraced(function* (flags: ModelsCommandFlags) {
  const paths = yield* resolvePaths(flags);
  const store = yield* ModelsManifestStore;
  const written = yield* store
    .init(paths.manifestPath, seedModelsManifest)
    .pipe(Effect.mapError(ModelsCommandError.fromInternal));

  yield* Console.log(`models: seeded ${written}`);
});

const failWithModelsError = Effect.fnUntraced(function* (error: ModelsCommandError) {
  const message = `models: ${error.message}`;
  yield* Console.error(message);
  return yield* failWithReportedExit(message);
});

const checkCommand = Command.make(
  "check",
  modelsFlags,
  Effect.fn(runCheck, Effect.catchTag("ModelsCommandError", failWithModelsError))
).pipe(Command.withDescription("Report routing drift for every declared target and exit non-zero on drift"));

const catalogCommand = Command.make(
  "catalog",
  modelsFlags,
  Effect.fn(runCatalog, Effect.catchTag("ModelsCommandError", failWithModelsError))
).pipe(Command.withDescription("Print the layered model catalog assembled for this box"));

const initCommand = Command.make(
  "init",
  modelsFlags,
  Effect.fn(runInit, Effect.catchTag("ModelsCommandError", failWithModelsError))
).pipe(Command.withDescription("Seed the routing manifest when none exists; never overwrites one"));

/**
 * The `beep models` command group.
 *
 * **Details**
 *
 * The bare group runs `check`, which is the default a timer or a pre-push hook
 * wants. Every subcommand takes the same flags so a scripted invocation can
 * move between them without rewriting its argument list.
 *
 * **Example** (Inspect the command identity)
 *
 * ```ts
 * import { modelsCommand } from "@beep/repo-cli/commands/Models"
 *
 * console.log(modelsCommand.name) // "models"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const modelsCommand = Command.make(
  "models",
  modelsFlags,
  Effect.fn(runCheck, Effect.catchTag("ModelsCommandError", failWithModelsError))
).pipe(
  Command.withDescription("Check every routing surface against the operator model manifest"),
  Command.withSubcommands([checkCommand, catalogCommand, initCommand]),
  Command.provide(ModelsLive)
);
