/**
 * `beep models` — check every routing surface against one operator manifest.
 *
 * **Details**
 *
 * `check` reports drift and exits non-zero on it,
 * `catalog` prints the assembled layered catalog, and `init` seeds a manifest
 * only when none exists. `apply --write` performs journaled owned-field writes; restore rejects native drift.
 * `recover` reconciles publications an interrupted writer left behind, the same
 * reconciliation `apply --write` and `restore` run first.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CatalogSnapshot } from "@beep/ai-sync/ModelCatalog.schemas";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, pipe, Str } from "@beep/utils";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { ModelsApply, ModelsApplyLive } from "./Models.apply.service.ts";
import { ModelsCatalogOptions } from "./Models.catalog.service.ts";
import { ModelsCommandError } from "./Models.errors.ts";
import { bindLocatorModel, modelsReadLocator } from "./Models.locator.service.ts";
import {
  LocatorBinding,
  ModelSyncTarget,
  ModelsEligibilityResult,
  ModelsLocatorWrite,
  TargetId,
} from "./Models.manifest.schemas.ts";
import { ModelsTargetFile, ModelsTargetLocation, resolveTargetPath } from "./Models.paths.ts";
import { expectedLocatorValue, renderGeneratedBlockBody } from "./Models.render.ts";
import { ModelsCheckReport } from "./Models.report.schemas.ts";
import { seedModelsManifest } from "./Models.seed.ts";
import {
  defaultManifestRelativePath,
  filterBindings,
  ModelsCatalog,
  ModelsCheck,
  ModelsCheckOptions,
  ModelsLive,
  ModelsManifestStore,
} from "./Models.service.ts";
import { modelsCheckOnlyFormat, modelsEligibility, modelsWritePreflight } from "./Models.spans.ts";
import type { ModelsRecoveryReport } from "./Models.exchange.schemas.ts";
import type { Locator, ModelsApplyMode, ModelsManifest } from "./Models.manifest.schemas.ts";
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

const adoptFlag = Flag.Boolean("adopt").pipe(
  Flag.withDefault(false),
  Flag.withDescription("init only: rewrite an existing manifest from the bundled seed, keeping a timestamped backup")
);

const modelsFlags = {
  adopt: adoptFlag,
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
  readonly adopt: boolean;
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
          Effect.mapError(() =>
            ModelsCommandError.make({
              message: "HOME is unset; pass --home <dir> explicitly.",
            })
          )
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
      `Manual verification required: ${A.length(A.dedupe(A.map(report.manual, (entry) => entry.targetId)))} target(s)`,
      ...A.map(
        report.manual,
        (entry) =>
          `- ${entry.targetId}: manual verification required; hint=${O.getOrElse(entry.current, () => "<absent>")}`
      ),
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
  yield* writeContainedFileString(
    reportDir.value,
    path.resolve(reportDir.value, "models-report.json"),
    formatJsonValue(encoded)
  ).pipe(ModelsCommandError.mapError("Failed to write models-report.json"));
  yield* writeContainedFileString(
    reportDir.value,
    path.resolve(reportDir.value, "models-report.md"),
    `${renderReportMarkdown(report)}\n`
  ).pipe(ModelsCommandError.mapError("Failed to write models-report.md"));
});

const runCheck = Effect.fnUntraced(function* (flags: ModelsCommandFlags) {
  const paths = yield* resolvePaths(flags);
  const check = yield* ModelsCheck;
  const report = yield* check.run(
    ModelsCheckOptions.make({
      home: paths.home,
      repo: paths.repo,
      manifestPath: paths.manifestPath,
      offline: flags.offline,
    })
  );

  if (flags.json) {
    const encoded = yield* encodeReport(report).pipe(
      ModelsCommandError.mapError("Failed to encode the models check report")
    );
    yield* Console.log(formatJsonValue(encoded));
  } else {
    yield* Effect.forEach(report.findings, (entry) => Console.log(renderFinding(entry)), { discard: true });
    yield* Effect.forEach(
      report.manual,
      (entry) =>
        Console.log(
          `models: ${entry.targetId} [${entry.locator._tag}] manual verification required; hint=${O.getOrElse(entry.current, () => "<absent>")}`
        ),
      { discard: true }
    );
    yield* Console.log(
      `models: ${A.length(A.dedupe(A.map(report.manual, (entry) => entry.targetId)))} manual target(s); ${A.length(report.findings)} finding(s) across ${report.catalog.modelCount} catalog model(s) ` +
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
    .snapshot(ModelsCatalogOptions.make({ home: paths.home, offline: flags.offline }))
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
  if (flags.adopt) {
    const adoption = yield* store
      .adopt(paths.manifestPath, seedModelsManifest)
      .pipe(Effect.mapError(ModelsCommandError.fromInternal));
    yield* Console.log(
      O.match(adoption.backup, {
        onNone: () => `models: seeded ${adoption.file}`,
        onSome: (backup) => `models: adopted the seed into ${adoption.file} (previous manifest kept at ${backup})`,
      })
    );
    return;
  }
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
).pipe(
  Command.withDescription("Seed the routing manifest when none exists; --adopt rewrites an existing one with a backup")
);

const resolveApplyFile = Effect.fnUntraced(function* (paths: ResolvedPaths, target: ModelSyncTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = resolveTargetPath(
    ModelsTargetLocation.make({
      ...paths,
      root: target.root,
      path: target.path,
    })
  );
  if (O.isNone(file))
    return yield* ModelsCommandError.make({
      message: `Target ${target.id} escapes its root.`,
    });
  const exists = yield* fs.exists(file.value).pipe(ModelsCommandError.mapError("Cannot inspect target."));
  if (!exists) {
    yield* fs.readLink(file.value).pipe(
      Effect.option,
      Effect.filterOrFail(O.isNone, () =>
        ModelsCommandError.make({
          message: `Target ${target.id} is a dangling symlink.`,
        })
      )
    );
    if (target.optional) return O.none<string>();
  }
  const root = yield* fs
    .realPath(target.root === "home" ? paths.home : paths.repo)
    .pipe(ModelsCommandError.mapError("Cannot resolve target root."));
  const actual = yield* fs.realPath(file.value).pipe(ModelsCommandError.mapError("Cannot resolve target file."));
  const relative = path.relative(root, actual);
  if (relative === ".." || Str.startsWith(`..${path.sep}`)(relative) || path.isAbsolute(relative))
    return yield* ModelsCommandError.make({
      message: `Target ${target.id} symlink escapes its root.`,
    });
  return O.some(file.value);
});

const renderModelWrite = Effect.fnUntraced(function* (manifest: ModelsManifest, locator: Locator) {
  if (locator._tag === "md-generated-block")
    return ModelsLocatorWrite.make({
      locator,
      expected: renderGeneratedBlockBody(
        filterBindings(manifest, locator.filter),
        manifest.superseded,
        locator.includeSuperseded
      ),
    });
  const binding = A.findFirst(
    manifest.bindings,
    (entry) => entry.role === locator.binding.role && entry.surface === locator.binding.surface
  );
  if (O.isNone(binding))
    return yield* ModelsCommandError.make({
      message: "Unbound model locator.",
    });
  const expected = expectedLocatorValue(binding.value, locator.binding.field, locator.render);
  if (O.isNone(expected))
    return yield* ModelsCommandError.make({
      message: "Unrenderable model locator.",
    });
  return ModelsLocatorWrite.make({
    locator: bindLocatorModel(locator, binding.value.modelId),
    expected: expected.value,
  });
});

const certifyPreviewWrites = (file: string, requests: ReadonlyArray<ModelsLocatorWrite>) =>
  modelsEligibility(file, requests).pipe(
    Effect.filterOrFail(ModelsEligibilityResult.guards.eligible, (result) =>
      ModelsCommandError.make({
        message: `Ineligible native target: ${result._tag === "eligible" ? "Unexpected eligible refusal." : result.message}`,
      })
    )
  );

const previewModelChange = Effect.fnUntraced(function* (
  file: string,
  target: ModelSyncTarget,
  content: string,
  request: ModelsLocatorWrite
) {
  const manual = O.isSome(modelsCheckOnlyFormat(request.locator));
  return request.remove === true
    ? (yield* certifyPreviewWrites(file, [request])).removalsPresent
    : manual
      ? yield* modelsReadLocator(
          ModelsTargetFile.make({ root: target.root, absolutePath: file, content }),
          request.locator
        ).pipe(
          Effect.tap((hint) =>
            Console.log(`models: hint ${target.id} [${request.locator._tag}] ${O.getOrElse(hint, () => "<absent>")}`)
          ),
          Effect.map(
            (current) =>
              O.exists(current, (value) => /^Unsupported (?:shell|YAML|XML|JSON) form/.test(value)) ||
              !O.contains(current, request.expected)
          )
        )
      : yield* modelsReadLocator(
          ModelsTargetFile.make({ root: target.root, absolutePath: file, content }),
          request.locator
        ).pipe(Effect.map((current) => !O.contains(current, request.expected)));
});

const previewModelWrites = Effect.fnUntraced(function* (
  file: string,
  target: ModelSyncTarget,
  writes: ReadonlyArray<ModelsLocatorWrite>
) {
  const fs = yield* FileSystem.FileSystem;
  const certifiable = A.filter(writes, ({ locator }) => O.isNone(modelsCheckOnlyFormat(locator)));
  const content = A.isReadonlyArrayNonEmpty(certifiable)
    ? (yield* certifyPreviewWrites(file, certifiable)).content
    : yield* fs.readFileString(file).pipe(ModelsCommandError.mapError("Cannot preview target."));
  for (const request of writes) {
    const manual = O.isSome(modelsCheckOnlyFormat(request.locator));
    const change = yield* previewModelChange(file, target, content, request);

    yield* Console.log(
      `models: preview ${target.id} [${request.locator._tag}] ${manual ? "manual verification required; recognized drift=" : "change="}${change} expected=${request.remove === true ? "<absent>" : request.expected}`
    );
  }
});

const applyModelTarget = Effect.fnUntraced(function* (
  paths: ResolvedPaths,
  manifest: ModelsManifest,
  target: ModelSyncTarget,
  mode: ModelsApplyMode
) {
  if (mode === "write")
    yield* modelsWritePreflight(target.path, target.locators).pipe(Effect.mapError(ModelsCommandError.fromInternal));
  const file = yield* resolveApplyFile(paths, target);
  if (O.isNone(file)) return;
  const path = yield* Path.Path;
  const writer = yield* ModelsApply;
  const writes = yield* Effect.forEach(target.locators, (locator) => renderModelWrite(manifest, locator), {
    concurrency: 1,
  });
  if (mode === "dry-run" || mode === "check") yield* previewModelWrites(file.value, target, writes);
  const journal = yield* writer
    .apply(file.value, writes, mode, path.join(paths.home, ".config-backups"))
    .pipe(Effect.mapError((error) => ModelsCommandError.make({ message: error.message })));
  yield* Console.log(
    `models: ${mode} ${target.id}; ${A.some(target.locators, (locator) => O.isSome(modelsCheckOnlyFormat(locator))) ? "manual verification required; " : ""}${O.isSome(journal) ? `journal ${journal.value.id}` : "no file written"}`
  );
  if (O.isSome(journal)) yield* Console.log(`models: restore --journal ${journal.value.id}`);
});

const applyCommand = Command.make(
  "apply",
  {
    ...modelsFlags,
    check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
    dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)),
    write: Flag.Boolean("write").pipe(Flag.withDefault(false)),
    target: Flag.String("target").pipe(Flag.optional),
  },
  Effect.fn("ModelsCommand.apply")(function* (flags) {
    if (A.length(A.filter([flags.check, flags.dryRun, flags.write], (value) => value)) > 1)
      return yield* ModelsCommandError.make({
        message: "Choose one of --check, --dry-run, --write.",
      });
    const paths = yield* resolvePaths(flags);
    const store = yield* ModelsManifestStore;
    const manifest = yield* store.load(paths.manifestPath).pipe(Effect.mapError(ModelsCommandError.fromInternal));
    const targets = A.filter(manifest.targets, (target) => O.isNone(flags.target) || target.id === flags.target.value);
    if (A.isReadonlyArrayEmpty(targets))
      return yield* ModelsCommandError.make({
        message: "No manifest target matched.",
      });
    const mode = flags.write ? "write" : flags.check ? "check" : "dry-run";
    const results = yield* Effect.forEach(
      targets,
      (target) =>
        applyModelTarget(paths, manifest, target, mode).pipe(
          Effect.as(true),
          Effect.catchTag("ModelsCommandError", (error) =>
            Console.error(`models: refused ${target.id}: ${error.message}`).pipe(Effect.as(false))
          )
        ),
      { concurrency: 1 }
    );
    if (A.some(results, (success) => !success))
      return yield* ModelsCommandError.make({
        message: "One or more targets refused; see per-target reports.",
      });
  })
).pipe(Command.withDescription("Check or preview owned native fields; --write backs up and journals each replacement"));

const codexPermissionsCommand = Command.make(
  "codex-permissions",
  {
    ...modelsFlags,
    check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
    dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)),
    write: Flag.Boolean("write").pipe(Flag.withDefault(false)),
  },
  Effect.fn("ModelsCommand.codexPermissions")(function* (flags) {
    if (A.length(A.filter([flags.check, flags.dryRun, flags.write], (value) => value)) > 1)
      return yield* ModelsCommandError.make({
        message: "Choose one of --check, --dry-run, --write.",
      });
    const paths = yield* resolvePaths(flags);
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const file = path.join(paths.home, ".codex", "config.toml");
    const actual = yield* fs.realPath(file).pipe(ModelsCommandError.mapError("Cannot resolve Codex config."));
    const home = yield* fs.realPath(paths.home).pipe(ModelsCommandError.mapError("Cannot resolve home."));
    if (Str.startsWith("..")(path.relative(home, actual)) || path.isAbsolute(path.relative(home, actual)))
      return yield* ModelsCommandError.make({
        message: "Codex config resolves outside its home.",
      });
    const writer = yield* ModelsApply;
    const request = ModelsLocatorWrite.make({
      locator: {
        _tag: "toml-top-level-key",
        key: "sandbox_mode",
        binding: LocatorBinding.make({
          role: "codex.heavy",
          surface: "codex-cli",
          field: "model",
        }),
        render: { _tag: "verbatim" },
      },
      expected: "",
      remove: true,
    });
    const mode = flags.write ? "write" : flags.check ? "check" : "dry-run";
    if (mode === "dry-run")
      yield* previewModelWrites(
        file,
        ModelSyncTarget.make({
          id: TargetId.make("home.codex.config"),
          root: "home",
          path: "$HOME/.codex/config.toml",
          optional: false,
          locators: [request.locator],
        }),
        [request]
      );
    const journal = yield* writer
      .apply(file, [request], mode, path.join(paths.home, ".config-backups"))
      .pipe(Effect.mapError(ModelsCommandError.fromInternal));
    yield* Console.log(
      O.match(journal, {
        onNone: () => `models: codex-permissions ${mode} complete; no file written`,
        onSome: (entry) => `models: codex-permissions journal ${entry.id}`,
      })
    );
  })
).pipe(
  Command.withDescription("Detect or remove only legacy Codex sandbox_mode; model pins and native fields survive")
);

const restoreCommand = Command.make(
  "restore",
  {
    ...modelsFlags,
    journal: Flag.String("journal"),
  },
  Effect.fn("ModelsCommand.restore")(function* (flags) {
    const paths = yield* resolvePaths(flags);
    const path = yield* Path.Path;
    const writer = yield* ModelsApply;
    if (!/^models-[\w-]+$/.test(flags.journal))
      return yield* ModelsCommandError.make({
        message: "Pass a journal id, not a file path.",
      });
    const directory = path.join(paths.home, ".config-backups");
    yield* writer
      .restore(path.join(directory, `${flags.journal}.json`), directory)
      .pipe(Effect.mapError(ModelsCommandError.fromInternal));
    yield* Console.log(`models: restored ${flags.journal}`);
  })
).pipe(
  Command.withDescription("Restore a writer backup only when the live file still matches its applied fingerprint")
);

const describeRecovery = (report: ModelsRecoveryReport) =>
  Match.value(report.result).pipe(
    Match.tagsExhaustive({
      recovered: ({ outcome }) => `models: recovered ${report.journal} (${report.role}) to ${outcome}`,
      refused: ({ reason, detail }) =>
        `models: refused recovery ${report.journal} (${report.role}): ${reason}: ${detail}`,
      skipped: ({ reason }) => `models: skipped ${report.journal} (${report.role}): ${reason}`,
    })
  );

const recoverCommand = Command.make(
  "recover",
  modelsFlags,
  Effect.fn("ModelsCommand.recover")(function* (flags) {
    const paths = yield* resolvePaths(flags);
    const path = yield* Path.Path;
    const writer = yield* ModelsApply;
    const reports = yield* writer
      .recover(path.join(paths.home, ".config-backups"))
      .pipe(Effect.mapError(ModelsCommandError.fromInternal));
    const isLegacy = (report: ModelsRecoveryReport) =>
      report.result._tag === "skipped" && report.result.reason === "legacy";
    const legacy = A.filter(reports, isLegacy);
    const decided = A.filter(reports, (report) => !isLegacy(report));
    yield* Effect.forEach(decided, (report) => Console.log(describeRecovery(report)), { discard: true });
    yield* Console.log(
      `models: recover reconciled ${A.length(decided)} publication(s); ${A.length(legacy)} legacy journal(s) left for restore --journal`
    );
    if (A.some(decided, (report) => report.result._tag === "refused"))
      return yield* ModelsCommandError.make({
        message: "One or more interrupted publications were refused; their artifacts are kept.",
      });
  })
).pipe(Command.withDescription("Reconcile interrupted native publications; refuse and keep artifacts on drift"));

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
  Command.withSubcommands([
    checkCommand,
    catalogCommand,
    initCommand,
    applyCommand,
    codexPermissionsCommand,
    restoreCommand,
    recoverCommand,
  ]),
  Command.provide(ModelsApplyLive),
  Command.provide(ModelsLive)
);
