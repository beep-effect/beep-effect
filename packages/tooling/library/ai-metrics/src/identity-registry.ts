/**
 * Filesystem-derived identity registry for AI metrics canonical roots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Clock, Duration, Effect, FileSystem, MutableHashMap, Order, Path, pipe, Random, Schedule } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { AiMetricsTranscriptSource } from "./models.ts";
import {
  AiMetricsHashSaltStatus,
  hashPrivateIdentifier,
  hashPublicTextSha256,
  resolveAiMetricsHashSaltStatus,
} from "./privacy.ts";
import type { PlatformError } from "effect";

const $I = $RepoAiMetricsId.create("identity-registry");

const identityRegistryVersion = "ai-metrics-identity-registry/v1";
const hashSaltNamespaceMarker = "ai-metrics-hash-salt-namespace/v1";
const identityDirName = "identity";
const registryFileName = "registry.json";
const lockFileName = "registry.lock";
// ~1s of total patience: long enough to outlast a healthy writer's
// read-merge-write, short enough that a lock left by a dead holder surfaces as a
// loud failure rather than a hang.
const lockMaxRetries = 50;
const lockRetryDelay = Duration.millis(20);
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/u;
const gitDirPointerPattern = /^gitdir:\s*(.+)$/mu;
const headRefPattern = /^ref:\s*(.+)$/mu;
const commitShaPattern = /^[0-9a-f]{40}$/u;
const originUrlPattern = /\[remote\s+"origin"\][^[]*?^[ \t]*url[ \t]*=[ \t]*([^\n]+)$/mu;

/**
 * Whether a canonical root is a primary clone or a linked git worktree.
 *
 * **Details**
 *
 * The distinction is load-bearing for snapshot bounding: a linked worktree
 * living inside its parent clone is its own canonical root, so the parent's
 * config snapshot must stop at its boundary rather than walking into it.
 *
 * **Example** (Branching on the root kind)
 *
 * ```ts
 * import { AiMetricsRootKind } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsRootKind.Enum["linked-worktree"]) // "linked-worktree"
 * console.log(AiMetricsRootKind.is["primary-clone"]("linked-worktree")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsRootKind = LiteralKit(["primary-clone", "linked-worktree"]).pipe(
  $I.annoteSchema("AiMetricsRootKind", {
    description: "Whether a canonical AI metrics root is a primary clone or a linked git worktree.",
  })
);

/**
 * Decoded kind literal carried by a canonical AI metrics root.
 *
 * @see {@link AiMetricsRootKind} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsRootKind = typeof AiMetricsRootKind.Type;

/**
 * One canonical root: a clone or linked worktree, identified independently of the data root.
 *
 * **Details**
 *
 * Every identifier is a digest. `cloneIdHash` is the salted digest of the
 * resolved root path and is byte-identical to the `repoRootHash` the forwarder
 * already writes into DuckDB, so derived rows join to registry rows with no
 * migration. `repositoryIdHash` is an unsalted digest of the normalized
 * `origin` URL, which makes the same repository recognizable across clones and
 * machines; `worktreeIdHash` separates linked worktrees that share it.
 *
 * **Example** (Reading a registry row)
 *
 * ```ts
 * import { AiMetricsCanonicalRoot } from "@beep/repo-ai-metrics"
 *
 * const root = AiMetricsCanonicalRoot.make({
 *   cloneIdHash: "clone-hash",
 *   excludedFromParentSnapshot: false,
 *   firstSeenAtEpochMillis: 1,
 *   kind: "primary-clone",
 *   lastSeenAtEpochMillis: 2,
 *   repositoryIdHash: "repository-hash",
 *   rootId: "root-clone-hash",
 *   worktreeIdHash: "worktree-hash"
 * })
 *
 * console.log(root.kind) // primary-clone
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsCanonicalRoot extends S.Class<AiMetricsCanonicalRoot>($I`AiMetricsCanonicalRoot`)(
  {
    cloneIdHash: S.String,
    excludedFromParentSnapshot: S.Boolean,
    firstSeenAtEpochMillis: S.Finite,
    kind: AiMetricsRootKind,
    lastSeenAtEpochMillis: S.Finite,
    parentRootId: S.optionalKey(S.String),
    repositoryIdHash: S.String,
    revision: S.optionalKey(S.String),
    rootId: S.String,
    worktreeIdHash: S.String,
  },
  $I.annote("AiMetricsCanonicalRoot", {
    description: "Clone, repository, worktree, and revision identity for one canonical AI metrics root.",
  })
) {}

/**
 * A machine, root, and agent-brand triple: the source instance producing transcripts.
 *
 * **Details**
 *
 * Hostname is deliberately absent. Reading it would require a `node:` builtin
 * import, which the repo's node-builtin gate forbids in typechecked `src`, so
 * the salted digest of the home directory is the machine proxy — the same value
 * source discovery already records as `homeDirHash`.
 *
 * **Example** (Reading a source instance row)
 *
 * ```ts
 * import { AiMetricsSourceInstance } from "@beep/repo-ai-metrics"
 *
 * const instance = AiMetricsSourceInstance.make({
 *   homeDirHash: "home-hash",
 *   instanceIdHash: "instance-hash",
 *   lastSeenAtEpochMillis: 2,
 *   rootId: "root-clone-hash",
 *   sourceKind: "codex"
 * })
 *
 * console.log(instance.sourceKind) // codex
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsSourceInstance extends S.Class<AiMetricsSourceInstance>($I`AiMetricsSourceInstance`)(
  {
    homeDirHash: S.String,
    instanceIdHash: S.String,
    lastSeenAtEpochMillis: S.Finite,
    rootId: S.String,
    sourceKind: AiMetricsTranscriptSource,
  },
  $I.annote("AiMetricsSourceInstance", {
    description: "One machine, canonical root, and agent brand triple producing AI metrics transcripts.",
  })
) {}

/**
 * The persisted registry of canonical roots and source instances.
 *
 * **Details**
 *
 * `hashSaltStatus` and a salted namespace fingerprint are stamped so a store
 * re-salted between runs is detectable, including rotation between two
 * operator-provided salts. Every digest in the file changes meaning when the
 * salt changes, and a reader that cannot tell would silently treat the same
 * root as two. The fingerprint is optional only for decoding the pre-fingerprint
 * v1 shape; an upsert migrates a populated legacy registry only when a stable
 * identity digest proves continuity with the current namespace.
 *
 * **Example** (An empty registry)
 *
 * ```ts
 * import { AiMetricsIdentityRegistry } from "@beep/repo-ai-metrics"
 *
 * const registry = AiMetricsIdentityRegistry.make({
 *   generatedAtEpochMillis: 1,
 *   hashSaltStatus: "provided",
 *   roots: [],
 *   sourceInstances: []
 * })
 *
 * console.log(registry.registryVersion) // ai-metrics-identity-registry/v1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsIdentityRegistry extends S.Class<AiMetricsIdentityRegistry>($I`AiMetricsIdentityRegistry`)(
  {
    generatedAtEpochMillis: S.Finite,
    hashSaltNamespaceId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hashSaltStatus: AiMetricsHashSaltStatus,
    registryVersion: S.Literal(identityRegistryVersion).pipe(SchemaUtils.withConstantDefault(identityRegistryVersion)),
    roots: S.Array(AiMetricsCanonicalRoot),
    sourceInstances: S.Array(AiMetricsSourceInstance),
  },
  $I.annote("AiMetricsIdentityRegistry", {
    description: "Persisted registry of canonical AI metrics roots and the source instances writing to them.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(AiMetricsIdentityRegistry));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(AiMetricsIdentityRegistry));
}

/**
 * Input for deriving one canonical root's identity.
 *
 * **Example** (Deriving identity for the current clone)
 *
 * ```ts
 * import { AiMetricsCanonicalRootInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsCanonicalRootInput.make({
 *   hashSalt: "salt",
 *   rootPath: "/work/repo"
 * })
 *
 * console.log(input.rootPath) // /work/repo
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsCanonicalRootInput extends S.Class<AiMetricsCanonicalRootInput>($I`AiMetricsCanonicalRootInput`)(
  {
    hashSalt: S.optionalKey(S.String),
    rootPath: S.String,
  },
  $I.annote("AiMetricsCanonicalRootInput", {
    description: "Root path and optional hash salt used to derive one canonical AI metrics root identity.",
  })
) {}

/**
 * Input for merging one root and its source instances into the persisted registry.
 *
 * **Example** (Recording the current run's identity)
 *
 * ```ts
 * import { AiMetricsIdentityRegistryUpsertInput } from "@beep/repo-ai-metrics"
 *
 * const input = AiMetricsIdentityRegistryUpsertInput.make({
 *   dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *   homeDir: "/home/dev",
 *   rootPath: "/work/repo",
 *   sourceKinds: ["codex", "claude"]
 * })
 *
 * console.log(input.sourceKinds.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsIdentityRegistryUpsertInput extends S.Class<AiMetricsIdentityRegistryUpsertInput>(
  $I`AiMetricsIdentityRegistryUpsertInput`
)(
  {
    dataRoot: S.String,
    hashSalt: S.optionalKey(S.String),
    homeDir: S.String,
    rootPath: S.String,
    sourceKinds: S.Array(AiMetricsTranscriptSource).pipe(
      SchemaUtils.withEmptyArrayDefaults<AiMetricsTranscriptSource>()
    ),
  },
  $I.annote("AiMetricsIdentityRegistryUpsertInput", {
    description: "Data root, home directory, root path, and agent brands merged into the AI metrics identity registry.",
  })
) {}

/**
 * Typed failure raised by identity registry helpers.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsIdentityRegistryError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsIdentityRegistryError.make({
 *   cause: "ENOENT",
 *   message: "AI metrics canonical root is not a git root."
 * })
 *
 * console.log(error._tag) // AiMetricsIdentityRegistryError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsIdentityRegistryError extends S.TaggedError<AiMetricsIdentityRegistryError>(
  $I`AiMetricsIdentityRegistryError`
)(
  "AiMetricsIdentityRegistryError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsIdentityRegistryError>("AiMetricsIdentityRegistryError", {
    description: "Typed failure raised while deriving or persisting AI metrics root identity.",
  })
) {}

const byRootId: Order.Order<AiMetricsCanonicalRoot> = Order.mapInput(Order.String, (root) => root.rootId);
const byInstanceIdHash: Order.Order<AiMetricsSourceInstance> = Order.mapInput(
  Order.String,
  (instance) => instance.instanceIdHash
);

const identityRegistryFailure = (message: string) => (cause: unknown) =>
  AiMetricsIdentityRegistryError.make({ cause, message });

const hashPrivate = (value: string, hashSalt: string | undefined) =>
  hashPrivateIdentifier(value, O.fromUndefinedOr(hashSalt)).pipe(
    Effect.mapError(identityRegistryFailure("Failed to hash an AI metrics identity value."))
  );

const hashPublic = (value: string) =>
  hashPublicTextSha256(value).pipe(
    Effect.mapError(identityRegistryFailure("Failed to hash an AI metrics identity value."))
  );

const isAbsolutePath = (value: string): boolean => absolutePathPattern.test(value);

const firstMatch = (pattern: RegExp, content: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(pattern.exec(content)),
    O.flatMapNullishOr((match) => match[1])
  );

const isNotFound = (error: PlatformError.PlatformError): boolean => Eq.equals(error.reason._tag, "NotFound");

// Absence is the only read outcome that honestly means "no file". `Effect.option` would also
// swallow `PermissionDenied` and `BadResource` (what reading a directory yields), so an existing
// but unreadable `registry.json` would decode as an empty registry and the next upsert would
// overwrite it — silently discarding every other canonical root and its `firstSeen` history.
// A decode failure on an existing file already fails loudly; these now agree.
const readFileOption = Effect.fn("AiMetrics.identityRegistry.readFileOption")(function* (
  filePath: string
): Effect.fn.Return<O.Option<string>, AiMetricsIdentityRegistryError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(
    Effect.asSome,
    Effect.catchIf(isNotFound, () => Effect.succeed(O.none<string>())),
    Effect.mapError(identityRegistryFailure("Failed to read an AI metrics identity file."))
  );
});

interface GitRootProbe {
  readonly commonGitDir: string;
  readonly gitDir: string;
  readonly kind: AiMetricsRootKind;
  readonly worktreeName: string;
}

const probeGitRoot = Effect.fn("AiMetrics.identityRegistry.probeGitRoot")(function* (
  rootPath: string
): Effect.fn.Return<GitRootProbe, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const gitPath = pathApi.join(rootPath, ".git");
  const info = yield* fs.stat(gitPath).pipe(Effect.option);

  if (O.isNone(info)) {
    return yield* AiMetricsIdentityRegistryError.make({
      cause: gitPath,
      message: "AI metrics canonical root is not a git root.",
    });
  }

  if (Eq.equals(info.value.type, "Directory")) {
    return { commonGitDir: gitPath, gitDir: gitPath, kind: AiMetricsRootKind.Enum["primary-clone"], worktreeName: "" };
  }

  if (!Eq.equals(info.value.type, "File")) {
    return yield* AiMetricsIdentityRegistryError.make({
      cause: gitPath,
      message: "AI metrics canonical root is not a git root.",
    });
  }

  const pointer = pipe(
    yield* readFileOption(gitPath),
    O.flatMap((content) => firstMatch(gitDirPointerPattern, content)),
    O.map(Str.trim)
  );

  if (O.isNone(pointer)) {
    return yield* AiMetricsIdentityRegistryError.make({
      cause: gitPath,
      message: "AI metrics linked worktree pointer does not name a git directory.",
    });
  }

  const gitDir = isAbsolutePath(pointer.value)
    ? pathApi.resolve(pointer.value)
    : pathApi.resolve(rootPath, pointer.value);

  return {
    commonGitDir: pathApi.dirname(pathApi.dirname(gitDir)),
    gitDir,
    kind: AiMetricsRootKind.Enum["linked-worktree"],
    worktreeName: pathApi.basename(gitDir),
  };
});

const normalizeRemoteUrl = (url: string): string => {
  const withoutHostPrefix = pipe(
    Str.trim(url),
    Str.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//u, ""),
    Str.replace(/^[^/@]+@/u, ""),
    Str.replace(/^([^/:]+):/u, "$1/"),
    Str.replace(/\.git$/u, ""),
    Str.replace(/\/+$/u, "")
  );
  const segments = pipe(withoutHostPrefix, Str.split("/"));

  return pipe(
    A.head(segments),
    O.map((host) => pipe(A.appendAll(A.of(Str.toLowerCase(host)), A.drop(segments, 1)), A.join("/"))),
    O.getOrElse(() => withoutHostPrefix)
  );
};

const resolveRepositoryIdHash = Effect.fn("AiMetrics.identityRegistry.resolveRepositoryIdHash")(function* (
  commonGitDir: string,
  hashSalt: string | undefined
): Effect.fn.Return<string, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> {
  const pathApi = yield* Path.Path;
  const config = yield* readFileOption(pathApi.join(commonGitDir, "config"));
  const originUrl = pipe(
    config,
    O.flatMap((content) => firstMatch(originUrlPattern, content)),
    O.map(Str.trim),
    O.filter((value) => !Str.isEmpty(value))
  );

  return yield* pipe(
    originUrl,
    O.match({
      onNone: () => hashPrivate(commonGitDir, hashSalt),
      onSome: (value) => hashPublic(normalizeRemoteUrl(value)),
    })
  );
});

const resolveRevision = Effect.fn("AiMetrics.identityRegistry.resolveRevision")(function* (
  gitDir: string,
  commonGitDir: string
): Effect.fn.Return<O.Option<string>, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> {
  const pathApi = yield* Path.Path;
  const head = pipe(yield* readFileOption(pathApi.join(gitDir, "HEAD")), O.map(Str.trim));

  if (O.isNone(head)) {
    return O.none<string>();
  }

  if (commitShaPattern.test(head.value)) {
    return O.some(head.value);
  }

  const ref = pipe(firstMatch(headRefPattern, head.value), O.map(Str.trim));
  if (O.isNone(ref)) {
    return O.none<string>();
  }

  const loose = pipe(yield* readFileOption(pathApi.join(commonGitDir, ref.value)), O.map(Str.trim));
  if (O.isSome(loose) && commitShaPattern.test(loose.value)) {
    return loose;
  }

  const packed = yield* readFileOption(pathApi.join(commonGitDir, "packed-refs"));

  return pipe(
    packed,
    O.map(Str.split("\n")),
    O.getOrElse(A.empty<string>),
    A.map((line) => pipe(Str.trim(line), Str.split(/\s+/u))),
    A.findFirst((fields) => Eq.equals(fields[1], ref.value)),
    O.flatMap((fields) =>
      pipe(
        O.fromNullishOr(fields[0]),
        O.filter((sha) => commitShaPattern.test(sha))
      )
    )
  );
});

/**
 * Report whether a directory is a git root distinct from the walk's own scan root.
 *
 * **When to use**
 *
 * Use as the descent boundary for any walk rooted at a clone. A directory that
 * holds a `.git` entry is somebody else's canonical root; walking into it
 * attributes their files to this root and, for a linked worktree holding its own
 * `node_modules`, costs hundreds of thousands of directory entries per run.
 *
 * **Example** (Refusing to descend into a nested worktree)
 *
 * ```ts
 * import { isNestedGitRoot } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = isNestedGitRoot({
 *   dirPath: "/work/repo/.claude/worktrees/wt1",
 *   scanRoot: "/work/repo"
 * }).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((nested: boolean) => console.log(nested)) // true
 * ```
 *
 * @param args - Candidate directory and the root the current walk started from.
 * @returns `true` when `dirPath` is a git root other than `scanRoot`.
 * @category utilities
 * @since 0.0.0
 */
export const isNestedGitRoot: (args: {
  readonly dirPath: string;
  readonly scanRoot: string;
}) => Effect.Effect<boolean, never, FileSystem.FileSystem | Path.Path> = Effect.fn("AiMetrics.isNestedGitRoot")(
  function* ({ dirPath, scanRoot }) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;

    if (Eq.equals(pathApi.resolve(dirPath), pathApi.resolve(scanRoot))) {
      return false;
    }

    return yield* fs.exists(pathApi.join(dirPath, ".git")).pipe(Effect.orElseSucceed(() => false));
  }
);

/**
 * Derive one canonical root's identity from the filesystem alone.
 *
 * **Details**
 *
 * Reads `.git` (directory for a primary clone, pointer file for a linked
 * worktree), the common git directory's `config` for the `origin` URL, and
 * `HEAD` plus loose refs and `packed-refs` for the revision. No subprocess is
 * spawned, so the package keeps its zero-subprocess surface.
 *
 * **Gotchas**
 *
 * `repositoryIdHash` falls back to a salted digest of the common git directory
 * when the clone has no `origin` remote, which makes that clone's repository
 * identity local rather than global. A rewritten remote URL likewise re-keys the
 * repository. Exact identity would require shelling out to `git`; that is a
 * deliberate non-goal. `revision` is omitted rather than faked when `HEAD`
 * cannot be resolved, and dirty-tree state is never recorded.
 *
 * **Example** (Identifying the clone a run is writing from)
 *
 * ```ts
 * import { AiMetricsCanonicalRootInput, makeAiMetricsCanonicalRoot } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = makeAiMetricsCanonicalRoot(
 *   AiMetricsCanonicalRootInput.make({ hashSalt: "salt", rootPath: "/work/repo" })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((root) => console.log(root.kind)) // primary-clone
 * ```
 *
 * @param input - Root path and optional hash salt.
 * @returns The canonical root row for `rootPath`.
 * @category constructors
 * @since 0.0.0
 */
export const makeAiMetricsCanonicalRoot: (
  input: AiMetricsCanonicalRootInput
) => Effect.Effect<AiMetricsCanonicalRoot, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> =
  Effect.fn("AiMetrics.makeAiMetricsCanonicalRoot")(function* (input) {
    const pathApi = yield* Path.Path;
    const nowEpochMillis = yield* Clock.currentTimeMillis;
    const rootPath = pathApi.resolve(input.rootPath);
    const probe = yield* probeGitRoot(rootPath);
    const cloneIdHash = yield* hashPrivate(rootPath, input.hashSalt);
    const isLinkedWorktree = AiMetricsRootKind.is["linked-worktree"](probe.kind);
    const parentRootId = isLinkedWorktree
      ? O.some(`root-${yield* hashPrivate(pathApi.dirname(probe.commonGitDir), input.hashSalt)}`)
      : O.none<string>();
    const revision = yield* resolveRevision(probe.gitDir, probe.commonGitDir);

    return AiMetricsCanonicalRoot.make({
      cloneIdHash,
      excludedFromParentSnapshot: isLinkedWorktree,
      firstSeenAtEpochMillis: nowEpochMillis,
      kind: probe.kind,
      lastSeenAtEpochMillis: nowEpochMillis,
      ...O.getSomesStruct({ parentRootId }),
      repositoryIdHash: yield* resolveRepositoryIdHash(probe.commonGitDir, input.hashSalt),
      ...O.getSomesStruct({ revision }),
      rootId: `root-${cloneIdHash}`,
      worktreeIdHash: yield* hashPrivate(`${probe.commonGitDir} ${probe.worktreeName}`, input.hashSalt),
    });
  });

const identityRegistryPath = (pathApi: Path.Path, dataRoot: string): string =>
  pathApi.join(dataRoot, identityDirName, registryFileName);

const identityRegistryLockPath = (pathApi: Path.Path, dataRoot: string): string =>
  pathApi.join(dataRoot, identityDirName, lockFileName);

/**
 * Token that makes one writer's temporary file and lock claim distinguishable from another's.
 *
 * **Details**
 *
 * A clock reading alone is not enough: two processes starting inside the same
 * millisecond would derive the same name. The random suffix comes from
 * `Random.nextIntBetween`, which resolves through the Effect `Random` service —
 * so a test can seed it, and no `Math.random` or `node:crypto` import is needed
 * (the latter is barred from typechecked `src` by the node-builtin gate).
 */
const writerToken = Effect.fnUntraced(function* () {
  const nowEpochMillis = yield* Clock.currentTimeMillis;
  const entropy = yield* Random.nextIntBetween(0, 0xffffffff);
  return `${nowEpochMillis}-${entropy.toString(16)}`;
});

// Exclusive create: `flag: "wx"` is O_CREAT | O_EXCL, so exactly one writer can
// observe the lock as absent and go on to create it. This is the same idiom the
// Yeet proof lock uses; it lives here rather than being imported because
// `@beep/repo-cli` depends on this package, not the other way round.
const claimRegistryLock = Effect.fnUntraced(function* (lockPath: string, token: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.writeFileString(lockPath, token, { flag: "wx" }).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      Eq.equals(error.reason._tag, "AlreadyExists")
        ? Effect.succeed(false)
        : Effect.fail(identityRegistryFailure("Failed to create the AI metrics identity registry lock.")(error))
    )
  );
});

const lockRetrySchedule = Schedule.recurs(lockMaxRetries).pipe(Schedule.addDelay(() => Effect.succeed(lockRetryDelay)));

/**
 * Run `use` while holding the registry's advisory lock, releasing it on every exit path.
 *
 * **Details**
 *
 * The lock spans the whole read-merge-write. Holding it only across the write
 * would not help: the lost-update window opens at the *read*, because two
 * writers that both read the pre-merge snapshot each compute a merge missing the
 * other's roots, and whichever renames last wins.
 *
 * **Gotchas**
 *
 * Retries are bounded. A holder that died without releasing leaves the file
 * behind, and waiting on it forever would hang every later run; instead the wait
 * expires and the upsert fails with {@link AiMetricsIdentityRegistryError}
 * naming the lock path, so an operator can remove it deliberately. Failing is
 * the only honest option — skipping the upsert would leave a store whose
 * provenance silently does not match its data.
 */
const acquireRegistryLock = Effect.fn("AiMetrics.identityRegistry.acquireRegistryLock")(function* (lockPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const token = yield* writerToken();

  yield* fs
    .makeDirectory(pathApi.dirname(lockPath), { recursive: true })
    .pipe(Effect.mapError(identityRegistryFailure("Failed to create the AI metrics identity registry directory.")));

  const claimed = yield* claimRegistryLock(lockPath, token).pipe(
    // `repeat` re-runs only on success, so a real IO failure surfaces at once
    // instead of being retried as if it were contention.
    Effect.repeat({ schedule: lockRetrySchedule, until: (claimed: boolean) => claimed })
  );

  if (!claimed) {
    return yield* AiMetricsIdentityRegistryError.make({
      cause: lockPath,
      message:
        "Timed out waiting for the AI metrics identity registry lock. Remove the lock file if no other run holds it.",
    });
  }

  return lockPath;
});

const releaseRegistryLock = (lockPath: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(lockPath).pipe(Effect.ignore));

const withRegistryLock = <A, E, R>(
  lockPath: string,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E | AiMetricsIdentityRegistryError, R | FileSystem.FileSystem | Path.Path> =>
  Effect.acquireUseRelease(acquireRegistryLock(lockPath), () => use, releaseRegistryLock);

/**
 * Read the persisted identity registry, or an empty registry when none exists yet.
 *
 * **Details**
 *
 * A missing registry file is a normal first-run state, not a failure. A file
 * that exists but does not decode *is* a failure: a store whose recorded
 * provenance cannot be read is exactly what this registry exists to prevent.
 *
 * **Example** (Reading the registry beside a data root)
 *
 * ```ts
 * import { readAiMetricsIdentityRegistry } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = readAiMetricsIdentityRegistry(
 *   "/home/dev/.local/state/beep/ai-metrics"
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((registry) => console.log(registry.roots.length))
 * ```
 *
 * @param dataRoot - Resolved AI metrics data root owning `identity/registry.json`.
 * @returns The decoded registry, or an empty one when the file is absent.
 * @category constructors
 * @since 0.0.0
 */
export const readAiMetricsIdentityRegistry: (
  dataRoot: string
) => Effect.Effect<AiMetricsIdentityRegistry, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> =
  Effect.fn("AiMetrics.readAiMetricsIdentityRegistry")(function* (dataRoot) {
    const pathApi = yield* Path.Path;
    const nowEpochMillis = yield* Clock.currentTimeMillis;
    const content = yield* readFileOption(identityRegistryPath(pathApi, dataRoot));

    if (O.isNone(content)) {
      return AiMetricsIdentityRegistry.make({
        generatedAtEpochMillis: nowEpochMillis,
        hashSaltStatus: resolveAiMetricsHashSaltStatus(O.none()),
        roots: A.empty<AiMetricsCanonicalRoot>(),
        sourceInstances: A.empty<AiMetricsSourceInstance>(),
      });
    }

    return yield* AiMetricsIdentityRegistry.decodeJsonEffect(content.value).pipe(
      Effect.mapError(identityRegistryFailure("Failed to decode the AI metrics identity registry."))
    );
  });

const withFirstSeen = (root: AiMetricsCanonicalRoot, firstSeenAtEpochMillis: number): AiMetricsCanonicalRoot =>
  AiMetricsCanonicalRoot.make({
    ...root,
    firstSeenAtEpochMillis,
  });

const legacyRegistryAllSaltedIdentitiesMatch = (
  existing: AiMetricsIdentityRegistry,
  instances: ReadonlyArray<AiMetricsSourceInstance>,
  root: AiMetricsCanonicalRoot
): boolean =>
  A.every(
    existing.roots,
    (existingRoot) =>
      Eq.equals(existingRoot.rootId, root.rootId) || Eq.equals(existingRoot.worktreeIdHash, root.worktreeIdHash)
  ) &&
  A.every(existing.sourceInstances, (existingInstance) =>
    A.some(instances, (instance) => Eq.equals(existingInstance.homeDirHash, instance.homeDirHash))
  );

/**
 * Render an identity registry as the JSON persisted beside the data root.
 *
 * **Example** (Encoding an empty registry)
 *
 * ```ts
 * import { AiMetricsIdentityRegistry, identityRegistryToJson } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const json = Effect.runSync(
 *   identityRegistryToJson(
 *     AiMetricsIdentityRegistry.make({
 *       generatedAtEpochMillis: 1,
 *       hashSaltStatus: "provided",
 *       roots: [],
 *       sourceInstances: []
 *     })
 *   )
 * )
 *
 * console.log(json.includes("ai-metrics-identity-registry/v1")) // true
 * ```
 *
 * @param registry - Registry to encode.
 * @returns The registry's canonical JSON encoding.
 * @category utilities
 * @since 0.0.0
 */
export const identityRegistryToJson: (
  registry: AiMetricsIdentityRegistry
) => Effect.Effect<string, AiMetricsIdentityRegistryError> = Effect.fn("AiMetrics.identityRegistryToJson")(
  function* (registry) {
    return yield* AiMetricsIdentityRegistry.encodeJsonEffect(registry).pipe(
      Effect.mapError(identityRegistryFailure("Failed to encode the AI metrics identity registry as JSON."))
    );
  }
);

/**
 * Read, merge, and promote the registry. Callers must already hold the registry lock.
 *
 * **Gotchas**
 *
 * The temporary file is named per writer. A single fixed `registry.json.tmp`
 * would let one writer promote another's half-written bytes, or lose the rename
 * outright — a failure mode the lock alone does not close, since a stale lock
 * that an operator clears by hand can leave two writers briefly overlapping.
 *
 * A populated registry whose persisted `hashSaltStatus` or namespace fingerprint
 * differs from the current run's is refused, not merged: its digests live in a
 * different pseudonym namespace, so merging would silently break later joins.
 * A legacy populated registry has no fingerprint. It is migrated only when its
 * root, worktree, or home-directory digests match a freshly derived identity;
 * because those digests are salt-dependent, a match proves namespace
 * continuity without persisting or exposing the salt. An unprovable legacy file
 * remains a hard failure and must be rebuilt deliberately.
 */
const mergeAndPersistRegistry = Effect.fnUntraced(function* (args: {
  readonly input: AiMetricsIdentityRegistryUpsertInput;
  readonly instances: ReadonlyArray<AiMetricsSourceInstance>;
  readonly nowEpochMillis: number;
  readonly root: AiMetricsCanonicalRoot;
}): Effect.fn.Return<AiMetricsIdentityRegistry, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> {
  const { input, instances, nowEpochMillis, root } = args;
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  const existing = yield* readAiMetricsIdentityRegistry(input.dataRoot);

  const hashSalt = O.fromUndefinedOr(input.hashSalt);
  const hashSaltStatus = resolveAiMetricsHashSaltStatus(hashSalt);
  const hashSaltNamespaceId = yield* hashPrivateIdentifier(hashSaltNamespaceMarker, hashSalt).pipe(
    Effect.mapError(identityRegistryFailure("Failed to derive the AI metrics hash-salt namespace id."))
  );
  const existingPopulated =
    A.isReadonlyArrayNonEmpty(existing.roots) || A.isReadonlyArrayNonEmpty(existing.sourceInstances);
  const existingNamespaceMatches = pipe(
    existing.hashSaltNamespaceId,
    O.map(Eq.equals(hashSaltNamespaceId)),
    O.getOrElse(() => legacyRegistryAllSaltedIdentitiesMatch(existing, instances, root))
  );
  if (existingPopulated && (!Eq.equals(existing.hashSaltStatus, hashSaltStatus) || !existingNamespaceMatches)) {
    return yield* AiMetricsIdentityRegistryError.make({
      cause: { existing: existing.hashSaltStatus, incoming: hashSaltStatus },
      message:
        `Refusing to merge the AI metrics identity registry across hash-salt namespaces (persisted status: ${existing.hashSaltStatus}, current status: ${hashSaltStatus}; the persisted fingerprint is missing or differs). ` +
        `Digests hashed under different salts are not joinable. Delete ${identityRegistryPath(pathApi, input.dataRoot)} to rebuild the registry in the current namespace, or use a separate data root per salt.`,
    });
  }

  const rootsById = MutableHashMap.fromIterable(
    A.map(existing.roots, (existingRoot) => [existingRoot.rootId, existingRoot] as const)
  );
  MutableHashMap.set(
    rootsById,
    root.rootId,
    withFirstSeen(
      root,
      pipe(
        MutableHashMap.get(rootsById, root.rootId),
        O.map((previous) => previous.firstSeenAtEpochMillis),
        O.getOrElse(() => root.firstSeenAtEpochMillis)
      )
    )
  );

  const instancesById = MutableHashMap.fromIterable(
    A.map(A.appendAll(existing.sourceInstances, instances), (instance) => [instance.instanceIdHash, instance] as const)
  );

  const registry = AiMetricsIdentityRegistry.make({
    generatedAtEpochMillis: nowEpochMillis,
    hashSaltNamespaceId: O.some(hashSaltNamespaceId),
    hashSaltStatus,
    roots: pipe(A.fromIterable(MutableHashMap.values(rootsById)), A.sort(byRootId)),
    sourceInstances: pipe(A.fromIterable(MutableHashMap.values(instancesById)), A.sort(byInstanceIdHash)),
  });

  const content = yield* identityRegistryToJson(registry);
  const registryPath = identityRegistryPath(pathApi, input.dataRoot);
  const registryTmpPath = `${registryPath}.${yield* writerToken()}.tmp`;
  yield* fs
    .makeDirectory(pathApi.dirname(registryPath), { recursive: true })
    .pipe(Effect.mapError(identityRegistryFailure("Failed to create the AI metrics identity registry directory.")));
  yield* fs
    .writeFileString(registryTmpPath, content)
    .pipe(Effect.mapError(identityRegistryFailure("Failed to write the AI metrics identity registry.")));
  yield* fs
    .rename(registryTmpPath, registryPath)
    .pipe(Effect.mapError(identityRegistryFailure("Failed to promote the AI metrics identity registry.")));

  return registry;
});

/**
 * Merge one canonical root and its source instances into the registry and persist it atomically.
 *
 * **Details**
 *
 * The merge is keyed by `rootId` and `instanceIdHash`. `firstSeenAtEpochMillis`
 * survives an upsert; `lastSeenAtEpochMillis` and `revision` are overwritten by
 * the current run. Both arrays are sorted before encoding, so a run that changes
 * nothing but the timestamps produces a byte-stable file. The write goes to a
 * per-writer temporary sibling and is promoted with a rename, the same idiom the
 * config snapshot pointer uses.
 *
 * The whole read-merge-write runs under an advisory lock at
 * `identity/registry.lock`, so concurrent runs — several clones, or a timer
 * firing while an operator runs the command by hand — serialize instead of
 * clobbering each other. Without it two writers both read the pre-merge
 * snapshot and the later rename discards the earlier writer's roots, instances,
 * and `firstSeen` history.
 *
 * **Gotchas**
 *
 * The registry records identity; it does not gate ingest. It is still written
 * before the run's data so a failure here fails the run loudly rather than
 * leaving a store whose provenance cannot be reconstructed.
 *
 * Waiting on the lock is bounded. If a previous holder died without releasing
 * it, the wait expires and this fails with {@link AiMetricsIdentityRegistryError}
 * naming the lock path rather than hanging forever or skipping the upsert.
 * Remove the named file once no run holds it.
 *
 * **Example** (Recording the current run before ingest)
 *
 * ```ts
 * import {
 *   AiMetricsIdentityRegistryUpsertInput,
 *   upsertAiMetricsIdentityRegistry
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const program = upsertAiMetricsIdentityRegistry(
 *   AiMetricsIdentityRegistryUpsertInput.make({
 *     dataRoot: "/home/dev/.local/state/beep/ai-metrics",
 *     homeDir: "/home/dev",
 *     rootPath: "/work/repo",
 *     sourceKinds: ["codex", "claude"]
 *   })
 * ).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((registry) => console.log(registry.sourceInstances.length)) // 2
 * ```
 *
 * @param input - Data root, home directory, root path, and agent brands to record.
 * @returns The registry as persisted, including the merged root.
 * @category services
 * @since 0.0.0
 */
export const upsertAiMetricsIdentityRegistry: (
  input: AiMetricsIdentityRegistryUpsertInput
) => Effect.Effect<AiMetricsIdentityRegistry, AiMetricsIdentityRegistryError, FileSystem.FileSystem | Path.Path> =
  Effect.fn("AiMetrics.upsertAiMetricsIdentityRegistry")(function* (input) {
    const pathApi = yield* Path.Path;
    const nowEpochMillis = yield* Clock.currentTimeMillis;
    const root = yield* makeAiMetricsCanonicalRoot(
      AiMetricsCanonicalRootInput.make({
        ...O.getSomesStruct({ hashSalt: O.fromUndefinedOr(input.hashSalt) }),
        rootPath: input.rootPath,
      })
    );
    // Resolved before hashing, exactly as `makeAiMetricsSourceDiscoveryResult` does. The two
    // digests are joined across the registry and a discovery result, so `/home/dev` and
    // `/home/dev/` have to reach the hash as the same bytes or the join silently finds nothing.
    const homeDir = pathApi.resolve(input.homeDir);
    const homeDirHash = yield* hashPrivate(homeDir, input.hashSalt);
    const rootPath = pathApi.resolve(input.rootPath);
    const instances = yield* Effect.forEach(input.sourceKinds, (sourceKind) =>
      Effect.map(hashPrivate(`${homeDir} ${rootPath} ${sourceKind}`, input.hashSalt), (instanceIdHash) =>
        AiMetricsSourceInstance.make({
          homeDirHash,
          instanceIdHash,
          lastSeenAtEpochMillis: nowEpochMillis,
          rootId: root.rootId,
          sourceKind,
        })
      )
    );

    // Read, merge, and promote under the lock. The read has to be inside it: two
    // writers that both read the pre-merge snapshot each compute a merge missing
    // the other's roots, and the later rename silently discards the earlier one.
    return yield* withRegistryLock(
      identityRegistryLockPath(pathApi, input.dataRoot),
      mergeAndPersistRegistry({ input, instances, nowEpochMillis, root })
    );
  });
