/**
 * Observe the pinned qualification runtime and its declared-pin refusal.
 * This read-only control grants no task qualification or remote-cache access.
 * Run with the repository's pinned Bun from the repository root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  CacheCensusSource,
  CacheCommandError,
  CacheToolchainSnapshot,
  hashCacheToolchain,
} from "@beep/repo-cli/commands/Cache";
import {
  CacheRuntimeFileGuards,
  CacheRuntimeProcess,
  collectCacheToolchain,
  readCacheExperimentBytes,
} from "@beep/repo-cli/test/Cache";
import {
  AdmissionRequest,
  MemoryStatsLive,
  noAdmissionOriginGate,
  withQualityAdmission,
} from "@beep/repo-cli/test/RepoRun";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("research/current-runtime-profile-control");
class CurrentRuntimeControl extends S.Opaque<CurrentRuntimeControl, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-current-runtime-profile-control/v1"),
    recordedAt: S.DateTimeUtcFromString,
    authority: S.tag("runtime-observation-only"),
    qualified: S.tag(false),
    sourceHead: GitObjectId,
    sourceState: S.tag("working-tree-bound"),
    sourceFiles: S.Array(CacheCensusSource).check(S.isMinLength(1), S.isMaxLength(16)),
    profile: S.tag("local-linux-x64-bun1.4.4"),
    bun: CacheToolchainSnapshot.fields.bun,
    node: CacheToolchainSnapshot.fields.node,
    turbo: CacheToolchainSnapshot.fields.turbo,
    biome: CacheToolchainSnapshot.fields.biome,
    toolchainDigest: Sha256Hex,
    dependenciesDigest: Sha256Hex,
    startupLinkerObserved: S.tag(true),
    declaredMismatch: S.Struct({
      declaration: S.tag("1.4.2"),
      actualBun: S.tag("1.4.4"),
      diagnosticMatched: S.tag(true),
      fixtureRemoved: S.tag(true),
    }),
  }).pipe(
    $I.annoteSchema("CurrentRuntimeControl", {
      description:
        "Actual current binary/dependency/linker observation and declared-pin refusal; no qualification or activation.",
    })
  )
) {}
const digest = S.decodeEffect(Sha256HexFromBytes);
const sourcePaths = [
  "packages/tooling/tool/cli/src/commands/Cache/Cache.schemas.ts",
  "packages/tooling/tool/cli/src/commands/Cache/Cache.fingerprint.ts",
  "packages/tooling/tool/cli/src/commands/Cache/Cache.dependencies.ts",
  "packages/tooling/tool/cli/src/commands/Cache/Cache.linker.ts",
  "packages/tooling/tool/cli/src/commands/Cache/Cache.census.ts",
  "packages/tooling/tool/cli/test/cache-census.test.ts",
  "goals/turborepo-quality-cache-adoption/research/current-runtime-profile-control.ts",
];
const sameSources = S.toEquivalence(S.Array(CacheCensusSource));
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = process.cwd();
  const sources = Effect.forEach(
    sourcePaths,
    Effect.fn("CurrentRuntimeControl.source")(function* (relative) {
      return CacheCensusSource.make({
        path: relative,
        sha256: yield* readCacheExperimentBytes(root, relative).pipe(Effect.flatMap(digest)),
      });
    }),
    { concurrency: 2 }
  );
  const revision = CacheRuntimeProcess.runCapturedStreams({
    command: "/usr/bin/git",
    args: ["rev-parse", "HEAD"],
    cwd: root,
    extendEnv: false,
    env: { PATH: "/usr/bin" },
    bound: CacheRuntimeProcess.OutputBound.make({ maxChars: 256, truncatedNotice: "revision capture exceeded bound" }),
  }).pipe(
    Effect.flatMap((captured) =>
      captured.exitCode === 0 && !captured.truncated
        ? S.decodeEffect(GitObjectId)(Str.trim(captured.stdout))
        : CacheCommandError.new("Cannot read the current source revision.")
    )
  );
  const observed = yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "current pinned runtime profile control",
    }),
    noAdmissionOriginGate,
    Effect.gen(function* () {
      const sourceHead = yield* revision;
      const sourceFiles = yield* sources;
      const fixture = yield* Effect.scoped(
        Effect.gen(function* () {
          const directory = yield* fs.makeTempDirectoryScoped({ prefix: "cache-runtime-pin-" });
          yield* fs.symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
          yield* CacheRuntimeFileGuards.writeContainedFileString(directory, ".bun-version", "1.4.2\n");
          const refused = yield* collectCacheToolchain(directory).pipe(Effect.exit);
          if (
            !Exit.isFailure(refused) ||
            !Str.includes("The observed Bun runtime differs from the repository .bun-version pin.")(
              Cause.pretty(refused.cause)
            )
          )
            return yield* CacheCommandError.new("The actual declared-runtime mismatch reached a different result.");
          return directory;
        })
      );
      if (yield* fs.exists(fixture)) return yield* CacheCommandError.new("The declared-pin fixture was not removed.");
      const toolchain = yield* collectCacheToolchain(root);
      if (
        toolchain.profile !== "local-linux-x64-bun1.4.4" ||
        toolchain.bun.version !== "1.4.4" ||
        O.isNone(toolchain.runtimeLinker)
      )
        return yield* CacheCommandError.new(
          "The control did not observe the current pinned runtime and startup linkage."
        );
      const dependencies = yield* toolchain.installedDependencies.pipe(
        Effect.fromOption(() => CacheCommandError.new("The current dependency tree was not observed."))
      );
      const toolchainDigest = yield* hashCacheToolchain(toolchain);
      if ((yield* revision) !== sourceHead || !sameSources(sourceFiles, yield* sources))
        return yield* CacheCommandError.new("Runtime-control source changed during observation.");
      return CurrentRuntimeControl.make({
        recordedAt: yield* DateTime.now,
        sourceHead,
        sourceFiles,
        bun: toolchain.bun,
        node: toolchain.node,
        turbo: toolchain.turbo,
        biome: toolchain.biome,
        toolchainDigest,
        dependenciesDigest: dependencies.sha256,
        declaredMismatch: { declaration: "1.4.2", actualBun: "1.4.4", diagnosticMatched: true, fixtureRemoved: true },
      });
    })
  );
  const output = path.join(root, ".beep/producer-upload");
  yield* fs.makeDirectory(output, { recursive: true });
  yield* CacheRuntimeFileGuards.writeContainedFileString(
    output,
    "current-runtime-profile-control.json",
    yield* S.encodeEffect(S.fromJsonString(CurrentRuntimeControl, { space: 2 }))(observed)
  );
  yield* Effect.logInfo(
    "Current pinned runtime observed; declared-pin mismatch refused and fixture removed. No qualification granted."
  );
});
const base = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const services = Layer.mergeAll(base, FsUtilsLive.pipe(Layer.provide(base)), MemoryStatsLive.pipe(Layer.provide(base)));
NodeRuntime.runMain(program.pipe(Effect.provide(services)));
