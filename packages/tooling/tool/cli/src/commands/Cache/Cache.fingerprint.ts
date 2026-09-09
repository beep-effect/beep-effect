/**
 * Observed native toolchain and computation configuration identities.
 * @packageDocumentation
 * @since 0.0.0
 */

import { CacheTaskConfiguration } from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { Duration, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configStringOption } from "../../internal/cli/EnvConfig.ts";
import { hashFileSha256, readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCaptured } from "../../internal/process/index.ts";
import { resolveCacheTurboBinary } from "./Cache.census.ts";
import {
  CacheCensusDefinition,
  CacheCensusNode,
  CacheCensusReport,
  CacheCensusSource,
  CacheCommandError,
  CacheComputationConfiguration,
  CacheExecutablePin,
  CacheLiveIdentity,
  CacheToolchainSnapshot,
} from "./Cache.schemas.ts";
import type { CacheActivationProjection, CacheQualificationKey } from "@beep/repo-configs/cache";

const captureVersion = Effect.fn("CacheFingerprint.captureVersion")(function* (
  root: string,
  command: string,
  args: ReadonlyArray<string>
) {
  const searchPath = yield* configStringOption("PATH").pipe(
    Effect.flatMap(Effect.fromOption(() => CacheCommandError.new("Toolchain discovery requires PATH.")))
  );
  const result = yield* runCaptured({
    command,
    args,
    cwd: root,
    source: "stdout",
    bound: OutputBound.make({ maxChars: 16384, truncatedNotice: "[version output exceeds limit]" }),
    timeout: Duration.seconds(10),
    extendEnv: false,
    env: { PATH: searchPath, LANG: "C", LC_ALL: "C", TURBO_TELEMETRY_DISABLED: "1" },
  });
  if (result.exitCode !== 0 || result.truncated)
    return yield* CacheCommandError.new("Tool fingerprint subprocess failed or exceeded its capture bound.");
  return yield* S.decodeEffect(S.NonEmptyString)(Str.trim(result.output));
}, CacheCommandError.mapError("Cannot observe tool version."));

const fingerprintExecutable = Effect.fn("CacheFingerprint.executable")(function* (root: string, executable: string) {
  const version = yield* captureVersion(root, executable, ["--version"]);
  const sha256 = yield* hashFileSha256(executable, (cause) =>
    CacheCommandError.new("Cannot hash an installed executable.", cause)
  );
  return CacheExecutablePin.make({ version, sha256 });
});

const toDefinition = (node: CacheCensusNode): CacheCensusDefinition =>
  CacheCensusDefinition.make({
    id: node.id,
    command: node.command,
    commandDigest: node.commandDigest,
    dependencies: A.sort(node.dependencies, Order.String),
    configuration: node.configuration,
  });

/**
 * Observe an explicitly supported runtime matching the repository's bounded Bun pin.
 *
 * **Example** (Plan toolchain observation)
 *
 * ```ts
 * import { collectCacheToolchain } from "@beep/repo-cli/test/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(collectCacheToolchain("/repo")))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const collectCacheToolchain = Effect.fn("CacheFingerprint.toolchain")(function* (root: string) {
  if (process.platform !== "linux" || process.arch !== "x64")
    return yield* CacheCommandError.new("The initial qualification profile requires Linux x64.");
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const libc = yield* captureVersion(root, "getconf", ["GNU_LIBC_VERSION"]);
  const kernel = yield* captureVersion(root, "uname", ["-sr"]);
  const nodePath = yield* captureVersion(root, "node", ["-p", "process.execPath"]);
  const bunPath = yield* captureVersion(root, "bun", ["-p", "process.execPath"]);
  const turboPath = yield* resolveCacheTurboBinary(root);
  const biomePath = path.join(root, "node_modules/@biomejs/cli-linux-x64/biome");
  if (!(yield* fs.exists(biomePath))) return yield* CacheCommandError.new("The glibc Biome binary is not installed.");
  const bun = yield* fingerprintExecutable(root, bunPath);
  const declared = yield* readContainedFileBytesNoFollow(root, ".bun-version", NonNegativeInt.make(128));
  const declaration = yield* declared.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("A regular bounded .bun-version file is required."))
  );
  if (bun.version !== Str.trim(new TextDecoder().decode(declaration)))
    return yield* CacheCommandError.new("The observed Bun runtime differs from the repository .bun-version pin.");
  const profile = yield* S.decodeUnknownEffect(CacheToolchainSnapshot.fields.profile)(
    `local-linux-x64-bun${bun.version}`
  );
  const sources = yield* Effect.forEach(
    [".nvmrc", "bun.lock", "node_modules/turbo/bin/turbo", "node_modules/@biomejs/biome/bin/biome"],
    Effect.fn("CacheFingerprint.toolSource")(function* (relative) {
      return CacheCensusSource.make({
        path: relative,
        sha256: yield* hashFileSha256(path.join(root, relative), (cause) =>
          CacheCommandError.new("Cannot hash a required toolchain declaration.", cause)
        ),
      });
    })
  );
  return CacheToolchainSnapshot.make({
    profile,
    kernel,
    libc,
    bun,
    node: yield* fingerprintExecutable(root, nodePath),
    turbo: yield* fingerprintExecutable(root, turboPath),
    biome: yield* fingerprintExecutable(root, biomePath),
    sources: [
      CacheCensusSource.make({ path: ".bun-version", sha256: yield* S.decodeEffect(Sha256HexFromBytes)(declaration) }),
      ...sources,
    ],
  });
}, CacheCommandError.mapError("Cannot fingerprint the qualification runtime."));

/**
 * Bind an executable computation to all of its configured dependencies, including graph-only nodes.
 *
 * **Example** (Observe a reviewed computation)
 *
 * ```ts
 * import { collectCacheCensus } from "@beep/repo-cli/commands/Cache"
 * import { collectCacheToolchain, fingerprintCacheComputation } from "@beep/repo-cli/test/Cache"
 * import { CacheQualificationKey } from "@beep/repo-configs/cache"
 * import { Effect } from "effect"
 * const observe = Effect.gen(function* () {
 *   const key = CacheQualificationKey.make({
 *     computation: "@beep/identity#lint", layer: "turbo-task-result",
 *     profile: "local-linux-x64-bun1.4.1", epoch: "qualification-v1",
 *   })
 *   return yield* fingerprintCacheComputation(
 *     key, yield* collectCacheCensus("/repo"), yield* collectCacheToolchain("/repo")
 *   )
 * })
 * console.assert(Effect.isEffect(observe))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const fingerprintCacheComputation = Effect.fn("CacheFingerprint.computation")(function* (
  key: CacheQualificationKey,
  census: CacheCensusReport,
  toolchain: CacheToolchainSnapshot
) {
  if (key.profile !== toolchain.profile)
    return yield* CacheCommandError.new("Computation and observed toolchain use different profiles.");
  if (toolchain.profile !== `local-linux-x64-bun${toolchain.bun.version}`)
    return yield* CacheCommandError.new("The observed Bun version differs from its named profile.");
  const target = yield* A.findFirst(census.nodes, (node) => node.id === key.computation && O.isSome(node.command)).pipe(
    Effect.fromOption(() => CacheCommandError.new("A missing or graph-only computation has no executable fingerprint."))
  );
  let pending = target.dependencies;
  let nodes: CacheComputationConfiguration["nodes"] = [toDefinition(target)];
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const id = pending[0];
    pending = A.drop(pending, 1);
    if (A.some(nodes, (node) => node.id === id)) continue;
    const node = yield* A.findFirst(census.nodes, (node) => node.id === id).pipe(
      Effect.fromOption(() => CacheCommandError.new("A computation dependency is missing from the exact census."))
    );
    nodes = A.append(nodes, toDefinition(node));
    pending = A.appendAll(pending, node.dependencies);
  }
  const configuration = CacheComputationConfiguration.make({
    computation: key.computation,
    globalConfiguration: census.globalConfiguration,
    nodes: A.sort(
      nodes,
      Order.mapInput(Order.String, (node: CacheCensusDefinition) => node.id)
    ),
    sources: A.sort(
      A.filter(census.sources, (source) => /(?:^|\/)turbo\.jsonc?$/.test(source.path)),
      Order.mapInput(Order.String, (source: CacheCensusSource) => source.path)
    ),
  });
  const configurationText = yield* S.encodeEffect(S.fromJsonString(CacheComputationConfiguration))(configuration);
  const toolchainText = yield* S.encodeEffect(S.fromJsonString(CacheToolchainSnapshot))(toolchain);
  const configurationDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(configurationText));
  const toolchainDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(toolchainText));
  return CacheLiveIdentity.make({ key, configuration, configurationDigest, toolchain, toolchainDigest });
}, CacheCommandError.mapError("Cannot fingerprint the computation configuration."));

/**
 * Validate and fingerprint an exact single-task cache activation projection.
 *
 * **Details**
 * All decoded configuration fields remain equal except the selected task's
 * cache flag. Both original byte digests and the full disabled configuration
 * digest must match. This predicts configuration identity; it is not runtime
 * evidence and does not mutate the checkout.
 *
 * **Example** (Reference the projection validator)
 *
 * ```ts
 * import { projectCacheActivation } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof projectCacheActivation === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const projectCacheActivation = Effect.fn("CacheFingerprint.projectActivation")(function* (
  key: CacheQualificationKey,
  census: CacheCensusReport,
  toolchain: CacheToolchainSnapshot,
  activation: CacheActivationProjection,
  before: string,
  after: string
) {
  const source = yield* fingerprintCacheComputation(key, census, toolchain);
  if (source.configurationDigest !== activation.sourceConfiguration)
    return yield* CacheCommandError.new("The disabled computation configuration has drifted.");
  const [workspaceName, taskName] = yield* S.decodeUnknownEffect(S.Tuple([S.NonEmptyString, S.NonEmptyString]))(
    Str.split("#")(key.computation)
  );
  const workspace = yield* A.findFirst(census.workspaces, (entry) => entry.name === workspaceName).pipe(
    Effect.fromOption(() => CacheCommandError.new("The activation workspace is missing."))
  );
  if (!A.contains([`${workspace.directory}/turbo.json`, `${workspace.directory}/turbo.jsonc`], activation.path))
    return yield* CacheCommandError.new(
      "Activation must target the selected workspace's inheriting Turbo configuration."
    );
  if (
    activation.before.path === activation.after.path ||
    activation.before.path === activation.path ||
    activation.after.path === activation.path
  )
    return yield* CacheCommandError.new("Activation requires separate immutable before/after artifacts.");
  const sources = A.filter(census.sources, (entry) => entry.path === activation.path);
  if (A.length(sources) !== 1 || !A.every(sources, (entry) => entry.sha256 === activation.before.sha256))
    return yield* CacheCommandError.new("The observed activation source file differs from its reviewed bytes.");
  for (const [text, expected] of A.zip([before, after], [activation.before.sha256, activation.after.sha256])) {
    if ((yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text))) !== expected)
      return yield* CacheCommandError.new("Activation artifact bytes differ from their digests.");
  }
  const disabled = yield* decodeJsoncTextAs(S.JsonObject)(before);
  const enabled = yield* decodeJsoncTextAs(S.JsonObject)(after);
  yield* S.decodeUnknownEffect(S.Tuple([S.Literal("//")]))(disabled.extends);
  const tasks = yield* S.decodeUnknownEffect(S.JsonObject)(disabled.tasks);
  const definition = yield* S.decodeUnknownEffect(S.JsonObject)(tasks[taskName]);
  if (definition.cache !== false)
    return yield* CacheCommandError.new("Activation requires an explicitly disabled source task.");
  const expected = R.set(disabled, "tasks", R.set(tasks, taskName, R.set(definition, "cache", true)));
  if (!S.toEquivalence(S.JsonObject)(expected, enabled))
    return yield* CacheCommandError.new("Activation may change only the selected task's cache flag.");
  const selected = A.filter(census.nodes, (node) => node.id === key.computation);
  if (A.length(selected) !== 1 || A.some(selected, (node) => node.configuration.cache))
    return yield* CacheCommandError.new("Activation requires one disabled executable computation.");
  return yield* fingerprintCacheComputation(
    key,
    CacheCensusReport.make({
      ...census,
      nodes: A.map(census.nodes, (node) =>
        node.id === key.computation
          ? CacheCensusNode.make({
              ...node,
              configuration: CacheTaskConfiguration.make({ ...node.configuration, cache: true }),
            })
          : node
      ),
      sources: A.map(census.sources, (entry) =>
        entry.path === activation.path ? CacheCensusSource.make({ ...entry, sha256: activation.after.sha256 }) : entry
      ),
    }),
    toolchain
  );
}, CacheCommandError.mapError("Cannot validate the reviewed cache activation projection."));
