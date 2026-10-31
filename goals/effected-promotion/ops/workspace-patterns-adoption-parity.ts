/**
 * Workspace-pattern reader adoption parity (4-A2, reuse-ledger #146, #148, #149, #150).
 *
 * 4-A2 promotes `@beep/repo-workspaces` `internal/patterns` to the public `WorkspacePatterns` leaf and moves the
 * five repo-cli pattern readers onto it: `Quality/ChangesetGraph.ts` and `Quality/Tasks.ts` read the root's
 * patterns through `WorkspacePatterns.read(repoRoot)` (a non-empty `pnpm-workspace.yaml` `packages:` list first,
 * else the root `package.json` `workspaces` field in either shape), `TsconfigSync/TsconfigSync.plan.ts` builds the
 * canonical syncpack sources from the same read, and `CreatePackage/CreatePackage.command.ts` projects the root
 * manifest it already holds through `WorkspacePatterns.fromManifest` (it edits that field, so the manifest is the
 * document that matters there). `CreatePackage/ConfigUpdater.ts` carried no pattern reader: its share of the
 * three `code-duplication` suppression comments covered the positional `applyJsoncModification`
 * wrapper the three files copied, which is inlined onto the `internal/cli/Jsonc.ts` facade.
 *
 * Oracle, as the wave-4 plan names it (pattern-literal parity over the live repository):
 *
 * 1. **Pattern parity.** The two retired reader shapes are frozen below and run over the live root: the strict
 *    `LenientManifest` + `WorkspacesField` read that `ChangesetGraph.workspacePatternsFrom` and
 *    `QualityTasks.workspacePatternsFromPackageJson` shared, and the `@beep/repo-utils`
 *    `readPackageJsonFile` + `workspaceGlobsFrom` read that CreatePackage and TsconfigSync shared (repo-utils keeps
 *    those exports until 4-A3). Both are compared with the kit's `WorkspacePatterns.read(repoRoot)` and
 *    `WorkspacePatterns.fromManifest(rootManifest)`. The gate is four byte-identical lists.
 * 2. **Derived surfaces.** For every reader, what it derives from the patterns is recomputed with frozen copies of
 *    the retired code over the legacy and the kit lists: the ChangesetGraph `:(glob)<pattern>/package.json`
 *    pathspecs, the Quality tasks' candidate directories and matched package directories (the `<base>/*` readdir
 *    expansion, every other pattern literal), TsconfigSync's canonical syncpack `source` list (checked against the
 *    committed `syncpack.config.ts`), and CreatePackage's segment-wise coverage verdict for every matched package
 *    directory. The gate is that every derived surface is identical between the legacy and the kit lists.
 * 3. **CLI check outputs.** `beep tsconfig-sync --check`, `beep quality changeset-graph` and a
 *    `beep create-package … --dry-run --skip-lockfile` probe are run and their stdout and exit codes fingerprinted.
 *    Run the script once before the switch (`--out`), then after it with `--before <baseline.json>`: every
 *    fingerprint must match.
 *
 * Nothing here runs in CI; the reports ride in `research/` and the PR body.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/workspace-patterns-adoption-parity.ts [--out <report.json>] [--before <baseline.json>]
 *
 * Exit status is non-zero when a list or surface disagrees, or a CLI fingerprint differs from the baseline.
 */
import * as NodeURL from "node:url";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import { StringListField, WorkspacesField } from "@beep/package-json/ManifestFields";
import { readPackageJsonFile, workspaceGlobsFrom } from "@beep/repo-utils";
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/workspace-patterns-adoption-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const fingerprint = (lines: ReadonlyArray<string>): string => sha256(A.join(lines, "\n"));

// --- the retired readers, frozen from 92db2438c1 ----------------------------------------------------------------

// `ChangesetGraph.workspacePatternsFrom` / `QualityTasks.workspacePatternsFromPackageJson`: a present `workspaces`
// must decode as `WorkspacesField`; a string array is the list, the object form contributes its optional `packages`.
const decodeWorkspaces = S.decodeUnknownEffect(WorkspacesField);
const isWorkspacePatternList = S.is(StringListField);
const legacyStrictPatterns = Effect.fn("legacyStrictPatterns")(function* (text: string) {
  const manifest = yield* LenientManifest.parse(text);
  if (P.isUndefined(manifest.workspaces)) return A.empty<string>();
  const workspaces = yield* decodeWorkspaces(manifest.workspaces);
  return isWorkspacePatternList(workspaces) ? workspaces : (workspaces.packages ?? A.empty<string>());
});

// CreatePackage / TsconfigSync: `readPackageJsonFile` then `workspaceGlobsFrom(packageJson.workspaces)`.
const legacyRepoUtilsPatterns = Effect.fn("legacyRepoUtilsPatterns")(function* (manifestPath: string) {
  const packageJson = yield* readPackageJsonFile(manifestPath);
  return workspaceGlobsFrom(packageJson.workspaces);
});

// `ChangesetGraph.packageJsonPathspecForWorkspacePattern`.
const normalizePath = Str.replaceAll("\\", "/");
const stripTrailingSlashes = Str.replace(/\/+$/g, "");
const pathspecFor = (pattern: string): string =>
  `:(glob)${pipe(pattern, normalizePath, stripTrailingSlashes)}/package.json`;

// `QualityTasks.workspaceCandidateDirsForPattern` (unchanged by 4-A2; it consumes the pattern list).
const isSafeWorkspacePattern = (pattern: string): boolean =>
  pattern.length > 0 &&
  !Str.startsWith("/")(pattern) &&
  !A.some(Str.split("/")(pattern), (segment) => segment === "..");
const candidateDirsForPattern = Effect.fn("candidateDirsForPattern")(function* (pattern: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!isSafeWorkspacePattern(pattern)) return yield* Effect.fail(`unsafe workspace pattern "${pattern}"`);
  if (Str.endsWith("/*")(pattern)) {
    const base = path.join(repoRoot, Str.slice(0, -2)(pattern));
    const entries = yield* fs.readDirectory(base).pipe(Effect.mapError(() => `unreadable workspace directory ${base}`));
    return A.map(entries, (entry) => path.join(base, entry));
  }
  return [path.join(repoRoot, pattern)];
});
const candidateDirs = Effect.fn("candidateDirs")(function* (patterns: ReadonlyArray<string>) {
  const dirs = yield* Effect.forEach(patterns, candidateDirsForPattern);
  return pipe(A.flatten(dirs), A.dedupe, A.sort(Order.String));
});
const matchedPackageDirs = Effect.fn("matchedPackageDirs")(function* (dirs: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.filter(dirs, (dir) =>
    fs.exists(path.join(dir, "package.json")).pipe(Effect.orElseSucceed(() => false))
  );
});

// `TsconfigSync.plan` `buildCanonicalSyncpackSources` and `readSyncpackSources`.
const canonicalSyncpackSources = (patterns: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.dedupe(["package.json", ...A.map(patterns, (pattern) => `${pattern}/package.json`)]);
const SYNCPACK_SOURCE_ARRAY_PATTERN = /source:\s*\[(?<body>[\s\S]*?)\],/m;
const SYNC_SOURCE_ENTRY_PATTERN = /"([^"]+)"/g;
const committedSyncpackSources = (content: string): ReadonlyArray<string> => {
  const match = SYNCPACK_SOURCE_ARRAY_PATTERN.exec(content);
  return match === null
    ? []
    : A.map([...Str.matchAll(SYNC_SOURCE_ENTRY_PATTERN)(match.groups?.body ?? "")], (entry) => entry[1] ?? "");
};

// `CreatePackage.command` `matchesWorkspacePattern` / `isPathCoveredByWorkspacePatterns`.
const pathSegments: (value: string) => ReadonlyArray<string> = flow(Str.split("/"), A.filter(Str.isNonEmpty));
const matchesWorkspacePattern = (pattern: string, targetPath: string): boolean => {
  const patternSegments = pathSegments(pattern);
  const targetSegments = pathSegments(targetPath);
  if (A.length(patternSegments) !== A.length(targetSegments)) return false;
  return A.every(
    A.zip(patternSegments, targetSegments),
    ([patternSegment, targetSegment]) =>
      Str.Equivalence(patternSegment, "*") || Str.Equivalence(patternSegment, targetSegment)
  );
};
const isCovered = (patterns: ReadonlyArray<string>, targetPath: string): boolean =>
  A.some(patterns, (pattern) => matchesWorkspacePattern(pattern, targetPath));

// --- report schema ---------------------------------------------------------------------------------------------

const PatternList = S.Struct({ count: S.Finite, patterns: S.Array(S.String) });
const Surface = S.Struct({ count: S.Finite, sha256: S.String });
const DerivedSurfaces = S.Struct({
  changesetGraphPathspecs: Surface,
  tasksCandidateDirs: Surface,
  tasksMatchedPackageDirs: Surface,
  tsconfigSyncSyncpackSources: Surface,
  createPackageCoverage: S.Struct({ dirs: S.Finite, covered: S.Finite, uncovered: S.Array(S.String) }),
});
const CliRun = S.Struct({ command: S.String, exitCode: S.Finite, stdoutSha256: S.String, stdoutLines: S.Finite });
const Comparison = S.Struct({ baseline: S.String, identical: S.Boolean, differing: S.Array(S.String) });
type Comparison = typeof Comparison.Type;
const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  commit: S.optionalKey(S.String),
  patterns: S.Struct({
    legacyStrict: PatternList,
    legacyRepoUtils: PatternList,
    kitRead: PatternList,
    kitFromManifest: PatternList,
    identical: S.Boolean,
  }),
  derived: S.Struct({ legacy: DerivedSurfaces, kit: DerivedSurfaces, identical: S.Boolean }),
  syncpackConfigInSync: S.Boolean,
  cli: S.Array(CliRun),
  comparison: S.optionalKey(Comparison),
});
type Report = typeof Report.Type;
type DerivedSurfaces = typeof DerivedSurfaces.Type;
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class ParityFailed extends S.TaggedError<ParityFailed, { readonly brand: unique symbol }>()("ParityFailed", {
  reasons: S.Array(S.String),
}) {}

const patternList = (patterns: ReadonlyArray<string>) => ({ count: A.length(patterns), patterns });
const surface = (lines: ReadonlyArray<string>) => ({ count: A.length(lines), sha256: fingerprint(lines) });

const derivedFor = Effect.fn("derivedFor")(function* (patterns: ReadonlyArray<string>, syncpackConfig: string) {
  const dirs = yield* candidateDirs(patterns);
  const matched = yield* matchedPackageDirs(dirs);
  // Fingerprint repository-relative paths, so a report recorded in another checkout compares equal.
  const relative = (dir: string): string => Str.slice(repoRoot.length)(dir);
  const relativeDirs = A.map(matched, relative);
  const uncovered = A.filter(relativeDirs, (dir) => !isCovered(patterns, dir));
  const sources = canonicalSyncpackSources(patterns);
  const derived: DerivedSurfaces = {
    changesetGraphPathspecs: surface(A.map(patterns, pathspecFor)),
    tasksCandidateDirs: surface(A.map(dirs, relative)),
    tasksMatchedPackageDirs: surface(relativeDirs),
    tsconfigSyncSyncpackSources: surface(sources),
    createPackageCoverage: {
      dirs: A.length(relativeDirs),
      covered: A.length(relativeDirs) - A.length(uncovered),
      uncovered,
    },
  };
  return { derived, inSync: A.makeEquivalence(Str.Equivalence)(sources, committedSyncpackSources(syncpackConfig)) };
});

// The three `--check`-style commands whose output the adoption must leave byte-identical.
const CLI_RUNS: ReadonlyArray<ReadonlyArray<string>> = [
  ["tsconfig-sync", "--check"],
  ["quality", "changeset-graph"],
  [
    "create-package",
    "parity-probe",
    "--type",
    "library",
    "--family",
    "tooling",
    "--kind",
    "library",
    "--description",
    "4-A2 parity probe",
    "--dry-run",
    "--skip-lockfile",
  ],
];

const runCli = Effect.fn("runCli")(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make("bun", ["run", "packages/tooling/tool/cli/src/bin.ts", "--", ...args], {
    cwd: repoRoot,
    stderr: "ignore",
  });
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const stdout = yield* handle.stdout.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc: string, chunk) => `${acc}${chunk}`
        )
      );
      const exitCode = yield* handle.exitCode;
      const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
      return {
        command: `beep ${A.join(args, " ")}`,
        exitCode: Number(exitCode),
        stdoutSha256: sha256(stdout),
        stdoutLines: A.length(lines),
      };
    })
  );
});

const flag = (name: string): O.Option<string> => {
  const index = process.argv.indexOf(name);
  return index === -1 ? O.none() : O.fromNullishOr(process.argv[index + 1]);
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const manifestPath = path.join(repoRoot, "package.json");
  const manifestText = yield* fs.readFileString(manifestPath);
  const syncpackConfig = yield* fs.readFileString(path.join(repoRoot, "syncpack.config.ts"));

  const legacyStrict = yield* legacyStrictPatterns(manifestText);
  const legacyRepoUtils = yield* legacyRepoUtilsPatterns(manifestPath);
  const kitRead = yield* WorkspacePatterns.read(repoRoot);
  const kitFromManifest = WorkspacePatterns.fromManifest(JSON.parse(manifestText));
  const lists = [legacyStrict, legacyRepoUtils, kitRead, kitFromManifest];
  const patternsIdentical = A.every(lists, (list) => A.makeEquivalence(Str.Equivalence)(list, legacyStrict));

  const legacy = yield* derivedFor(legacyRepoUtils, syncpackConfig);
  const kit = yield* derivedFor(kitRead, syncpackConfig);
  const derivedIdentical = JSON.stringify(legacy.derived) === JSON.stringify(kit.derived);

  const cli = yield* Effect.forEach(CLI_RUNS, runCli);

  const commit = yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).pipe(
    Effect.map(Str.trim),
    Effect.map(O.liftPredicate(Str.isNonEmpty)),
    Effect.orElseSucceed(() => O.none<string>())
  );

  const comparison = yield* O.match(flag("--before"), {
    onNone: () => Effect.succeed(O.none<Comparison>()),
    onSome: (baseline) =>
      Effect.gen(function* () {
        const before = yield* decodeReport(yield* fs.readFileString(baseline));
        const differing = A.flatMap(
          [
            ["patterns.legacyStrict", before.patterns.legacyStrict, patternList(legacyStrict)],
            ["patterns.kitRead", before.patterns.kitRead, patternList(kitRead)],
            ["derived.kit", before.derived.kit, kit.derived],
            ["cli", before.cli, cli],
          ] as const,
          ([key, left, right]) => (JSON.stringify(left) === JSON.stringify(right) ? [] : [key])
        );
        return O.some({ baseline, identical: A.isReadonlyArrayEmpty(differing), differing });
      }),
  });

  const report: Report = {
    schemaVersion: 1,
    tool: TOOL,
    ...O.match(commit, { onNone: () => ({}), onSome: (sha) => ({ commit: sha }) }),
    patterns: {
      legacyStrict: patternList(legacyStrict),
      legacyRepoUtils: patternList(legacyRepoUtils),
      kitRead: patternList(kitRead),
      kitFromManifest: patternList(kitFromManifest),
      identical: patternsIdentical,
    },
    derived: { legacy: legacy.derived, kit: kit.derived, identical: derivedIdentical },
    syncpackConfigInSync: legacy.inSync && kit.inSync,
    cli,
    ...O.match(comparison, { onNone: () => ({}), onSome: (value) => ({ comparison: value }) }),
  };

  const json = yield* encodeReport(report);
  yield* O.match(flag("--out"), {
    onNone: () => Console.log(json),
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });
  yield* Console.log(
    `patterns: ${legacyStrict.length} (identical=${patternsIdentical}); derived identical=${derivedIdentical}; matched package dirs=${kit.derived.tasksMatchedPackageDirs.count}; uncovered by CreatePackage=${kit.derived.createPackageCoverage.uncovered.length}; syncpack in sync=${report.syncpackConfigInSync}`
  );
  yield* Console.log(
    A.join(
      A.map(
        cli,
        (run) =>
          `${run.command}: exit ${run.exitCode}, ${run.stdoutLines} stdout lines, ${Str.slice(0, 12)(run.stdoutSha256)}`
      ),
      "; "
    )
  );
  yield* O.match(comparison, {
    onNone: () => Effect.void,
    onSome: (value) =>
      Console.log(
        `baseline ${value.baseline}: identical=${value.identical}${value.identical ? "" : ` differing=${A.join(value.differing, ",")}`}`
      ),
  });

  const reasons = A.getSomes([
    patternsIdentical ? O.none() : O.some("the legacy and kit pattern lists differ"),
    derivedIdentical ? O.none() : O.some("a derived surface differs between the legacy and kit lists"),
    report.syncpackConfigInSync ? O.none() : O.some("syncpack.config.ts sources are not the canonical list"),
    A.isReadonlyArrayEmpty(kit.derived.createPackageCoverage.uncovered)
      ? O.none()
      : O.some(
          `matched package directories uncovered by the patterns: ${A.join(kit.derived.createPackageCoverage.uncovered, ", ")}`
        ),
    ...A.map(
      A.filter(cli, (run) => run.exitCode !== 0),
      (run) => O.some(`${run.command} exited ${run.exitCode}`)
    ),
    O.flatMap(comparison, (value) =>
      value.identical ? O.none() : O.some(`baseline ${value.baseline} differs: ${A.join(value.differing, ", ")}`)
    ),
  ]);
  if (A.isReadonlyArrayNonEmpty(reasons)) return yield* ParityFailed.make({ reasons });
});

// @effect-diagnostics-next-line strictEffectProvide:off -- this is the script's entry point; the one layer is provided once here. Owner: goals/effected-promotion. Exit: the script is deleted with the packet's closeout.
NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
