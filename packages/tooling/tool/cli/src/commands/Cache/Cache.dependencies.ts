/**
 * Bounded installed dependency snapshots and independent integrity checks.
 * @packageDocumentation
 * @since 0.0.0
 */
import { NonNegativeInt } from "@beep/schema";
import { Config, Duration, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { collectCacheCensus } from "./Cache.census.ts";
import {
  CacheDependencyLink,
  CacheDependencyMaterialization,
  CacheDependencyTree,
} from "./Cache.dependencies.schemas.ts";
import { CacheCommandError, CacheExecutablePin } from "./Cache.schemas.ts";
import type { CacheCensusWorkspace } from "./Cache.schemas.ts";

const tools = ["bash", "cp", "find", "tar", "sha256sum", "awk"];
const countFields = S.Tuple([NonNegativeInt, NonNegativeInt, NonNegativeInt, NonNegativeInt, NonNegativeInt]);
const bound = OutputBound.make({ maxChars: 512 * 1024, truncatedNotice: "[dependency inspection overflow]" });
const digestScript =
  'set -euo pipefail; /usr/bin/tar --sort=name --format=posix --mtime=@0 --owner=0 --group=0 --numeric-owner --hard-dereference --pax-option=exthdr.name=%d/PaxHeaders/%f,delete=atime,delete=ctime -C "$1" -cf - -- node_modules | /usr/bin/sha256sum';
const countsScript =
  'set -euo pipefail; /usr/bin/find node_modules -printf "%y %s\\n" | /usr/bin/awk \'{ entries++; if ($1 == "f") { files++; bytes += $2 } else if ($1 == "l") { links++ } else if ($1 != "d") { special++ } } END { printf "%.0f %d %d %d %d\\n", bytes, files, links, entries, special }\'';
const capture = Effect.fn("CacheDependencies.capture")(function* (
  root: string,
  command: string,
  args: ReadonlyArray<string>
) {
  const result = yield* runCapturedStreams({
    command,
    args,
    cwd: root,
    extendEnv: false,
    env: { PATH: "/usr/bin", HOME: "/nonexistent", LANG: "C", LC_ALL: "C" },
    bound,
  }).pipe(Effect.timeout(Duration.minutes(15)));
  if (result.exitCode !== 0 || result.truncated || Str.trim(result.stderr) !== "")
    return yield* CacheCommandError.new(`Dependency inspection subprocess failed: ${command}.`);
  return result.stdout;
});
const hash = (file: string) =>
  hashFileSha256(file, (cause) => CacheCommandError.new("Cannot hash dependency evidence.", cause));
const toolPins = Effect.fn("CacheDependencies.toolPins")(function* () {
  return R.fromEntries(
    yield* Effect.forEach(
      tools,
      Effect.fn("CacheDependencies.toolPin")(function* (name) {
        const binary = `/usr/bin/${name}`;
        const version = yield* capture("/", binary, ["--version"]).pipe(
          Effect.map(Str.trim),
          Effect.map(Str.split("\n")),
          Effect.flatMap((lines) =>
            Effect.fromOption(() => CacheCommandError.new("Missing integrity-tool version."))(A.head(lines))
          )
        );
        return Tuple.make(name, CacheExecutablePin.make({ version, sha256: yield* hash(binary) }));
      }),
      { concurrency: 1 }
    )
  );
});
const physicalTree = Effect.fn("CacheDependencies.physicalTree")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(path.resolve(root), "node_modules");
  if ((yield* fs.realPath(target)) !== target || (yield* fs.stat(target)).type !== "Directory")
    return yield* CacheCommandError.new("Dependency node_modules must be a physical directory in its owning root.");
});

const inspectDependencyLink = Effect.fn("CacheDependencies.inspectLink")(function* (
  root: string,
  workspaces: ReadonlyArray<CacheCensusWorkspace>,
  relative: string,
  target: string
) {
  const path = yield* Path.Path;
  if (
    path.isAbsolute(relative) ||
    path.normalize(relative) !== relative ||
    Str.startsWith("../")(relative) ||
    path.isAbsolute(target)
  )
    return yield* CacheCommandError.new("Dependency tree contains an absolute or escaping symlink.");
  const resolved = path.relative(
    path.resolve(root),
    path.resolve(root, "node_modules", path.dirname(relative), target)
  );
  if (Str.startsWith("node_modules/")(resolved))
    return CacheDependencyLink.cases.Internal.make({ path: relative, target });

  const workspace = A.findFirst(workspaces, (row) => row.directory === resolved && row.name === relative);
  if (O.isNone(workspace))
    return yield* CacheCommandError.new("Dependency symlink does not target its declared workspace.");
  return CacheDependencyLink.cases.Workspace.make({ path: relative, target, workspace: workspace.value.directory });
});

/**
 * Inspect a complete dependency view without following its symlinks.
 *
 * **Example** (Plan a bounded tree inspection)
 *
 * ```ts
 * import { inspectCacheDependencyTree } from "@beep/repo-cli/test/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(inspectCacheDependencyTree("/repo", [])))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const inspectCacheDependencyTree = Effect.fn("CacheDependencies.inspect")(function* (
  root: string,
  workspaces: ReadonlyArray<CacheCensusWorkspace>
) {
  const path = yield* Path.Path;
  yield* physicalTree(root);
  const counts = yield* capture(root, "/usr/bin/bash", ["-c", countsScript]).pipe(
    Effect.map(Str.trim),
    Effect.map(Str.split(" ")),
    Effect.flatMap(S.decodeUnknownEffect(S.Array(S.FiniteFromString))),
    Effect.flatMap(S.decodeUnknownEffect(countFields))
  );
  const [bytes, regularFiles, linkCount, entries, special] = counts;
  if (bytes > 16 * 1024 * 1024 * 1024 || regularFiles > 400000 || entries > 600000 || linkCount > 4096 || special !== 0)
    return yield* CacheCommandError.new(
      "Dependency tree exceeded its byte/entry/link bound or contains a special file."
    );
  const encoded = yield* capture(root, "/usr/bin/find", ["node_modules", "-type", "l", "-printf", "%P\\0%l\\0"]);
  const rows = encoded === "" ? [] : A.chunksOf(A.dropRight(Str.split("\0")(encoded), 1), 2);
  const pairs = yield* S.decodeUnknownEffect(S.Array(S.Tuple([S.NonEmptyString, S.NonEmptyString])))(rows);
  if (pairs.length !== linkCount || Str.includes("\ufffd")(encoded))
    return yield* CacheCommandError.new("Dependency link inventory is incomplete or not valid text.");
  const links = yield* Effect.forEach(
    A.sort(pairs, Order.Tuple([Order.String, Order.String])),
    ([relative, target]) => inspectDependencyLink(root, workspaces, relative, target),
    { concurrency: 1 }
  );
  const digest = yield* capture(root, "/usr/bin/bash", [
    "-c",
    digestScript,
    "cache-dependency-digest",
    path.resolve(root),
  ]).pipe(
    Effect.map(Str.trim),
    Effect.map(Str.split(" ")),
    Effect.flatMap((parts) =>
      Effect.fromOption(() => CacheCommandError.new("Missing dependency digest."))(A.head(parts))
    ),
    Effect.flatMap(S.decodeUnknownEffect(CacheDependencyTree.fields.sha256))
  );
  return CacheDependencyTree.make({
    format: "canonical-gnu-tar/v1",
    sha256: digest,
    regularFiles,
    entries,
    bytes,
    links,
  });
}, CacheCommandError.mapError("Cannot inspect the installed dependency tree."));

/**
 * Recheck a retained dependency view and the owning checkout's lockfile binding.
 *
 * **Example** (Reference the integrity verifier)
 *
 * ```ts
 * import { verifyCacheDependencies } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof verifyCacheDependencies === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyCacheDependencies = Effect.fn("CacheDependencies.verify")(function* (
  root: string,
  receipt: CacheDependencyMaterialization
) {
  const path = yield* Path.Path;
  if (
    (yield* hash(path.join(root, "bun.lock"))) !== receipt.lockfileSha256 ||
    (yield* hash(path.join(root, "package.json"))) !== receipt.rootManifestSha256
  )
    return yield* CacheCommandError.new("Dependency materialization has a stale lockfile or root manifest.");
  if (!S.toEquivalence(CacheDependencyMaterialization.fields.tools)(yield* toolPins(), receipt.tools))
    return yield* CacheCommandError.new("Dependency integrity tools differ from the retained pins.");
  const census = yield* collectCacheCensus(root);
  const observed = yield* inspectCacheDependencyTree(receipt.directory, census.workspaces);
  if (!S.toEquivalence(CacheDependencyTree)(observed, receipt.tree))
    return yield* CacheCommandError.new("Retained dependency materialization changed or is incomplete.");
}, CacheCommandError.mapError("Cannot verify dependency materialization."));

/**
 * Copy the full installed tree into a retained private cache directory and verify parity.
 *
 * **Details**
 *
 * Admission covers the copy and repeated content scans. Only a newly allocated
 * directory is removed on failure. The original installation is read-only.
 *
 * **Example** (Plan dependency materialization)
 *
 * ```ts
 * import { materializeCacheDependencies } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(materializeCacheDependencies("/repo")))
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const materializeCacheDependencies = Effect.fn("CacheDependencies.materialize")(function* (root: string) {
  const program = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const home = yield* Config.string("HOME").pipe(Effect.flatMap(S.decodeUnknownEffect(S.NonEmptyString)));
    const parent = path.join(path.resolve(home), ".cache", "beep", "turbo-qualification", "dependencies");
    yield* fs.makeDirectory(parent, { recursive: true });
    const census = yield* collectCacheCensus(root);
    const pins = yield* toolPins();
    const lockfileSha256 = yield* hash(path.join(root, "bun.lock"));
    const rootManifestSha256 = yield* hash(path.join(root, "package.json"));
    yield* Effect.logInfo("Inspecting the installed dependency tree before copying.");
    const tree = yield* inspectCacheDependencyTree(root, census.workspaces);
    const directory = yield* fs.makeTempDirectory({ directory: parent, prefix: "view-" });
    return yield* Effect.gen(function* () {
      yield* Effect.logInfo(`Copying ${tree.regularFiles} dependency files (${tree.bytes} bytes).`);
      yield* capture(root, "/usr/bin/cp", [
        "--archive",
        "--reflink=auto",
        "--no-preserve=ownership",
        "--",
        path.join(root, "node_modules"),
        path.join(directory, "node_modules"),
      ]);
      yield* Effect.logInfo("Verifying dependency copy and source parity.");
      const copied = yield* inspectCacheDependencyTree(directory, census.workspaces);
      const after = yield* inspectCacheDependencyTree(root, census.workspaces);
      if (!S.toEquivalence(CacheDependencyTree)(tree, copied) || !S.toEquivalence(CacheDependencyTree)(tree, after))
        return yield* CacheCommandError.new("Source installation changed or dependency copy differs from its source.");
      const receipt = CacheDependencyMaterialization.make({
        schemaVersion: "cache-dependency-materialization/v1",
        authority: "local-installed-tree-snapshot",
        directory,
        lockfileSha256,
        rootManifestSha256,
        tree,
        tools: pins,
      });
      yield* verifyCacheDependencies(root, receipt);
      return receipt;
    }).pipe(Effect.onError(() => fs.remove(directory, { recursive: true, force: true }).pipe(Effect.ignore)));
  });
  return yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "cache dependency materialization",
    }),
    noAdmissionOriginGate,
    program
  );
}, CacheCommandError.mapError("Cannot materialize installed dependencies."));
