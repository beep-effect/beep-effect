/**
 * Versioned, metadata-only root identity observed through Git itself.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "./privacy.ts";
import type { AiMetricsCanonicalRootInput } from "./identity-registry.ts";

const $I = $RepoAiMetricsId.create("git-root-evidence");
const UnknownReason = LiteralKit([
  "not-observed",
  "missing-hash-salt",
  "git-unavailable",
  "probe-failed",
  "timed-out",
  "not-a-checkout-root",
]).pipe($I.annoteSchema("UnknownReason", { description: "Why an owning-clone identity has not been established." }));

/**
 * Current Git identity evidence, separate from the legacy checkout-path IDs.
 *
 * **Details**
 *
 * Physical identities are scoped to a hash namespace and host. No path, remote URL, revision text or salt is stored.
 *
 * **Example** (Construct the unknown AI metrics git root evidence case)
 *
 * ```ts
 * import { AiMetricsGitRootEvidence } from "@beep/repo-ai-metrics/git-root-evidence"
 * console.log(AiMetricsGitRootEvidence.cases.Unknown.make({ reason: "not-observed" })._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsGitRootEvidence = S.TaggedUnion({
  Unknown: { reason: UnknownReason },
  Observed: {
    version: S.tag("git-root-evidence/v2"),
    observedAtEpochMillis: S.Natural,
    hashSaltNamespaceId: Sha256Hex,
    owningCloneIdHash: Sha256Hex,
    worktreeIdHash: Sha256Hex,
    repositoryIdHash: Sha256Hex,
    repositoryIdentityScope: S.Literals(["remote", "local-clone"]),
    linkedWorktree: S.Boolean,
  },
}).pipe(
  $I.annoteSchema("AiMetricsGitRootEvidence", {
    description: "Explicit observation status and versioned repository, owning-clone and worktree identities.",
  })
);

/**
 * Runtime type of {@link AiMetricsGitRootEvidence}.
 *
 * **Details**
 *
 * Inferred from the evidence schema.
 *
 * **Example** (Annotate an optional AI metrics git root evidence)
 *
 * ```ts
 * import type { AiMetricsGitRootEvidence } from "@beep/repo-ai-metrics/git-root-evidence"
 * const value: AiMetricsGitRootEvidence | undefined = undefined
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsGitRootEvidence = typeof AiMetricsGitRootEvidence.Type;

class GitProbeResult extends S.Opaque<GitProbeResult, { readonly brand: unique symbol }>()(
  S.Struct({ exitCode: S.Int, output: S.String }).pipe(
    $I.annoteSchema("GitProbeResult", { description: "Bounded private Git probe output, never persisted or reported." })
  )
) {}

const unknown = (reason: typeof UnknownReason.Type): AiMetricsGitRootEvidence =>
  AiMetricsGitRootEvidence.cases.Unknown.make({ reason });

// Git's remote identity excludes transport credentials, query and fragment.
// SCP-style SSH and ordinary SSH/HTTPS URLs share host/path identity. A custom
// port remains significant; host aliases are never guessed to be equivalent.
const remoteIdentity = (remote: string): O.Option<string> => {
  const trimmed = Str.trim(remote);
  if (Str.includes("://")(trimmed)) {
    return pipe(
      S.decodeOption(S.URLFromString)(trimmed),
      O.filter((url) => url.hostname.length > 0 && A.contains(["ssh:", "https:", "http:", "git:"], url.protocol)),
      O.map(
        (url) =>
          `${Str.toLowerCase(url.hostname)}${url.port === "" ? "" : `:${url.port}`}/${pipe(url.pathname, Str.replace(/^\/+|\/+$/gu, ""), Str.replace(/\.git$/u, ""))}`
      )
    );
  }
  const scp = Str.match(/^(?:[^@/]+@)?([^/:]+):(.+)$/u)(trimmed);
  return pipe(
    scp,
    O.flatMap((match) => O.all([A.get(match, 1), A.get(match, 2)])),
    O.map(
      ([host, path]) =>
        `${Str.toLowerCase(host)}/${pipe(path, Str.replace(/[?#].*$/u, ""), Str.replace(/\/+$/u, ""), Str.replace(/\.git$/u, ""))}`
    )
  );
};
const decodeArgumentsOption = S.decodeUnknownOption(S.Tuple([S.String, S.String, S.String]));

/**
 * Observe root identity without changing historical registry or event IDs.
 *
 * **Details**
 *
 * Uses a five-second bounded read-only Git probe. Missing process service or salt yields explicit unknown evidence. Errors never expose probe output or private paths.
 *
 * **Example** (Build a synthetic Git root observation effect)
 *
 * ```ts
 * import { observeAiMetricsGitRoot } from "@beep/repo-ai-metrics/git-root-evidence"
 * import { AiMetricsCanonicalRootInput } from "@beep/repo-ai-metrics/identity-registry"
 * const program = observeAiMetricsGitRoot(AiMetricsCanonicalRootInput.make({ rootPath: "/tmp/synthetic-repo", hashSalt: "synthetic-salt" }))
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const observeAiMetricsGitRoot = Effect.fn("AiMetrics.observeGitRoot")(function* (
  input: AiMetricsCanonicalRootInput
) {
  const hashSalt = O.fromUndefinedOr(input.hashSalt).pipe(O.filter((salt) => Str.trim(salt).length > 0));
  if (O.isNone(hashSalt)) return unknown("missing-hash-salt");
  const spawner = yield* Effect.serviceOption(ChildProcessSpawner.ChildProcessSpawner);
  if (O.isNone(spawner)) return unknown("git-unavailable");
  const probe = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.realPath(path.resolve(input.rootPath));
    const readGit = (args: ReadonlyArray<string>) =>
      Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* spawner.value.spawn(
            ChildProcess.make("git", args, {
              cwd: root,
              stderr: "ignore",
              extendEnv: true,
              env: {
                GIT_OPTIONAL_LOCKS: "0",
                GIT_DIR: undefined,
                GIT_COMMON_DIR: undefined,
                GIT_WORK_TREE: undefined,
                GIT_INDEX_FILE: undefined,
                GIT_OBJECT_DIRECTORY: undefined,
                GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
              },
            })
          );
          const bytes = yield* handle.stdout.pipe(Stream.flattenIterable, Stream.take(16385), Stream.runCollect);
          if (bytes.length > 16384) return O.none<GitProbeResult>();
          const output = yield* Effect.try(() =>
            new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes))
          );
          return O.some(GitProbeResult.make({ exitCode: yield* handle.exitCode, output }));
        })
      );
    const observeIdentity = Effect.fnUntraced(function* (gitDir: string, commonDir: string) {
      // --local limits this identity to repository configuration, rather than a
      // globally configured fallback remote. A missing origin is local identity.
      const remote = yield* readGit(["config", "--local", "--get", "remote.origin.url"]);
      if (O.isNone(remote) || (remote.value.exitCode !== 0 && remote.value.exitCode !== 1))
        return unknown("probe-failed");
      const identity = remote.value.exitCode === 0 ? remoteIdentity(remote.value.output) : O.none<string>();
      const owningCloneIdHash = yield* hashPrivateIdentifier(`owning-clone/v2:${commonDir}`, hashSalt);
      const repositoryIdHash = O.isSome(identity)
        ? yield* hashPublicTextSha256(`repository-remote/v2:${identity.value}`)
        : yield* hashPrivateIdentifier(`repository-local/v2:${commonDir}`, hashSalt);
      return AiMetricsGitRootEvidence.cases.Observed.make({
        observedAtEpochMillis: yield* Clock.currentTimeMillis,
        hashSaltNamespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", hashSalt),
        owningCloneIdHash,
        worktreeIdHash: yield* hashPrivateIdentifier(`worktree/v2:${gitDir}`, hashSalt),
        repositoryIdHash,
        repositoryIdentityScope: O.isSome(identity) ? "remote" : "local-clone",
        linkedWorktree: gitDir !== commonDir,
      });
    });
    const paths = yield* readGit([
      "-c",
      "core.fsmonitor=false",
      "rev-parse",
      "--path-format=absolute",
      "--show-toplevel",
      "--absolute-git-dir",
      "--git-common-dir",
    ]);
    if (O.isNone(paths) || paths.value.exitCode !== 0) return unknown("probe-failed");
    const output = paths.value.output;
    const lines = Str.split(Str.replace(/\r?\n$/u, "")(output), "\n");
    const parsed = decodeArgumentsOption(lines);
    if (O.isNone(parsed)) return unknown("probe-failed");
    const [top, gitDir, commonDir] = yield* Effect.forEach(parsed.value, (value) => fs.realPath(value));
    if (top !== root) return unknown("not-a-checkout-root");
    if (gitDir === undefined || commonDir === undefined) return unknown("probe-failed");
    return yield* observeIdentity(gitDir, commonDir);
  });
  return yield* probe.pipe(
    Effect.orElseSucceed(() => unknown("probe-failed")),
    Effect.timeoutOption("5 seconds"),
    Effect.map(O.getOrElse(() => unknown("timed-out")))
  );
});
