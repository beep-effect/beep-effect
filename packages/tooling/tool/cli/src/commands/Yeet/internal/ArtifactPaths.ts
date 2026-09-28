/**
 * Shared Yeet artifact path helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { hostname, userInfo } from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Path, pipe } from "effect";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { repoRunArtifactId, repoRunSafeArtifactName } from "../../../internal/repo-run/RepoRunArtifacts.ts";
import { perUserRuntimeRoot } from "../../../internal/repo-run/RuntimeRoot.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import type * as Crypto from "effect/Crypto";
import type { RepoRunContext } from "../../../internal/repo-run/RepoRun.models.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ArtifactPaths");

const RepositoryOriginProtocol = LiteralKit(["https:", "ssh:", "git:"]).pipe(
  $I.annoteSchema("RepositoryOriginProtocol", {
    description: "Git remote protocols whose repository identity can be canonicalized.",
  })
);

type RepositoryOriginProtocol = typeof RepositoryOriginProtocol.Type;

class CanonicalRepositoryOrigin extends S.Class<CanonicalRepositoryOrigin>($I`CanonicalRepositoryOrigin`)(
  {
    authority: S.String,
    repositoryPath: S.String,
  },
  $I.annote("CanonicalRepositoryOrigin", {
    description: "Canonical host authority and owner/repository path for a Git remote.",
  })
) {}

const isRepositoryOriginProtocol = S.is(RepositoryOriginProtocol);
const parseRepositoryUrl = O.liftThrowable((value: string) => new URL(value));

const defaultPortForProtocol = (protocol: RepositoryOriginProtocol): string =>
  RepositoryOriginProtocol.$match(protocol, {
    "https:": () => "443",
    "ssh:": () => "22",
    "git:": () => "9418",
  });

const canonicalRepositoryPath = (pathname: string): O.Option<string> => {
  const normalized = pipe(pathname, Str.trim, Str.replace(/^\/+|\/+$/gu, ""), Str.replace(/\.git$/iu, ""));
  const segments = pipe(Str.split(normalized, "/"), A.filter(Str.isNonEmpty));
  return A.length(segments) >= 2 ? O.some(A.join(segments, "/")) : O.none();
};

const canonicalRepositoryOriginFromUrl = (value: string): O.Option<CanonicalRepositoryOrigin> =>
  pipe(
    parseRepositoryUrl(value),
    O.flatMap((url) => {
      if (!isRepositoryOriginProtocol(url.protocol)) {
        return O.none();
      }
      const hostname = Str.toLowerCase(url.hostname);
      if (!Str.isNonEmpty(hostname)) {
        return O.none();
      }
      const authority =
        Str.isNonEmpty(url.port) && !Str.Equivalence(url.port, defaultPortForProtocol(url.protocol))
          ? `${hostname}:${url.port}`
          : hostname;
      return pipe(
        canonicalRepositoryPath(url.pathname),
        O.map((repositoryPath) => CanonicalRepositoryOrigin.make({ authority, repositoryPath }))
      );
    })
  );

const canonicalRepositoryOriginFromScp = (value: string): O.Option<CanonicalRepositoryOrigin> =>
  pipe(
    Str.match(/^git@([^/:\s]+):(.+)$/u)(value),
    O.flatMap((match) =>
      O.all({
        hostname: A.get(match, 1),
        pathname: A.get(match, 2),
      })
    ),
    O.flatMap(({ hostname, pathname }) =>
      pipe(
        canonicalRepositoryPath(pathname),
        O.map((repositoryPath) =>
          CanonicalRepositoryOrigin.make({ authority: Str.toLowerCase(hostname), repositoryPath })
        )
      )
    )
  );

const renderCanonicalRepositoryOrigin = (origin: CanonicalRepositoryOrigin): string =>
  `${origin.authority}/${origin.repositoryPath}`;

const canonicalRepositoryIdentity = (repositoryIdentity: string): string => {
  const trimmed = Str.trim(repositoryIdentity);
  return pipe(
    canonicalRepositoryOriginFromScp(trimmed),
    O.orElse(() => canonicalRepositoryOriginFromUrl(trimmed)),
    O.map(renderCanonicalRepositoryOrigin),
    O.getOrElse(() => trimmed)
  );
};

/**
 * Convert an arbitrary branch or step name into a stable artifact file segment.
 *
 * **Example** (Sanitize branch name segment)
 *
 * ```ts
 * import { safeArtifactName } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 *
 * console.log(safeArtifactName("feature/status work"))
 * ```
 *
 * @param value - Branch, package, or step name to sanitize.
 * @returns A non-empty artifact-safe path segment.
 * @category utilities
 * @since 0.0.0
 */
export const safeArtifactName: (value: string) => string = repoRunSafeArtifactName;

const artifactNameHash = Effect.fnUntraced(function* (value: string) {
  return Str.takeLeft(12)(
    yield* sha256Hex(value).pipe(Effect.mapError(YeetCommandError.new("Failed to hash proof coordinator identity.")))
  );
});

const effectiveUserId = (): number => userInfo().uid;

// Locks keep their historical scoped leaf directly under the invariant
// platform base, so launcher environment and transient runtime-directory probes
// cannot split sibling sessions across coordinators.
const proofCoordinatorRuntimeRoot = Effect.fnUntraced(function* (): Effect.fn.Return<
  string,
  never,
  FileSystem.FileSystem | Path.Path
> {
  return (yield* perUserRuntimeRoot()).root;
});

const proofCoordinatorDirectoryName = Effect.fnUntraced(function* () {
  return `beep-yeet-proof-locks-${yield* artifactNameHash(hostname())}-uid-${effectiveUserId()}`;
});

/**
 * Resolve the machine-local coordinator path for one repository identity.
 *
 * **Details**
 *
 * Recognized Git remotes first normalize to a lowercase host plus repository
 * path. Equivalent SCP, SSH, HTTPS, and Git URLs therefore share a lock. The
 * normalized identity is hashed before it reaches the path, so a
 * credential-bearing remote URL never appears in a filename. Lock files live
 * under the invariant platform base with no environment-dependent or fallible
 * root choice. The namespace includes opaque machine identity plus the
 * effective UID.
 *
 * **Example** (Share a coordinator across checkouts)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { proofCoordinatorLockPath } from "@beep/repo-cli/test/Yeet"
 *
 * const lock = proofCoordinatorLockPath("git@github.com:acme/repo.git").pipe(
 *   Effect.map((path) => path.endsWith(".lock"))
 * )
 * ```
 *
 * @param repositoryIdentity - Stable remote identity shared by sibling clones.
 * @returns Machine-local proof coordinator lock path.
 * @category utilities
 * @since 0.0.0
 */
export const proofCoordinatorLockPath = Effect.fn("Yeet.proofCoordinatorLockPath")(function* (
  repositoryIdentity: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const runtimeRoot = yield* proofCoordinatorRuntimeRoot();
  return path.join(
    runtimeRoot,
    yield* proofCoordinatorDirectoryName(),
    `${yield* artifactNameHash(canonicalRepositoryIdentity(repositoryIdentity))}.lock`
  );
});

/**
 * Return the stable Yeet run id for a repo run context.
 *
 * **Example** (Derive run id from context)
 *
 * ```ts
 * import { runIdForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { RepoRunContext } from "@beep/repo-cli/internal/repo-run"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/status-work",
 *   cwd: "/repo",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: "/repo",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const program = runIdForContext(context).pipe(Effect.map((id) => id.startsWith("feature-status-work-")))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the current branch.
 * @returns Sanitized run id for branch-scoped Yeet artifacts.
 * @category utilities
 * @since 0.0.0
 */
export const runIdForContext = (context: RepoRunContext) =>
  repoRunArtifactId(context.branch).pipe(
    Effect.mapError(YeetCommandError.new("Failed to derive run artifact identity."))
  );

/**
 * Resolve the Yeet artifact directory for a repo run context.
 *
 * **Example** (Resolve artifact directory path)
 *
 * ```ts
 * import { artifactDirForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(artifactDirForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying `repoRoot` and `packetDir`.
 * @returns Absolute Yeet artifact directory path.
 * @category utilities
 * @since 0.0.0
 */
export const artifactDirForContext = Effect.fn("Yeet.artifactDirForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.isAbsolute(context.packetDir) ? context.packetDir : path.join(context.repoRoot, context.packetDir);
});

/**
 * Where one checkout's proof facts are read from and appended to (ruling 71).
 *
 * **Details**
 *
 * `originRoot` is the checkout that ran — a primary clone or a linked
 * worktree — and stays the facts' `provenance.originKey`. `ledgerRoot` is the
 * owning clone, so every lane cut from one clone shares one sample and a
 * `yeet sweep --retire` of a lane never deletes it. `ledgerPath` is
 * `<ledgerRoot>/.beep/yeet/proof-ledger.ndjson`, and `ledgerRoot` is the
 * containment root the ledger reads and appends through.
 *
 * **Example** (A lane's ledger lives in its clone)
 *
 * ```ts
 * import { ProofLedgerLocation } from "@beep/repo-cli/test/Yeet"
 *
 * const location = ProofLedgerLocation.make({
 *   originRoot: "/work/repo-worktrees/lane-a",
 *   ledgerRoot: "/work/repo",
 *   ledgerPath: "/work/repo/.beep/yeet/proof-ledger.ndjson",
 * })
 * console.log(location.ledgerRoot) // "/work/repo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofLedgerLocation extends S.Class<ProofLedgerLocation>($I`ProofLedgerLocation`)(
  {
    originRoot: S.NonEmptyString,
    ledgerRoot: S.NonEmptyString,
    ledgerPath: S.NonEmptyString,
  },
  $I.annote("ProofLedgerLocation", {
    description:
      "The checkout that ran, the owning clone whose proof ledger it shares, and that ledger's path (ruling 71).",
  })
) {}

const GITFILE_PREFIX = "gitdir:";

// A linked worktree's `.git` is a one-line file `gitdir: <path>`.
const gitfileTarget = (contents: string): O.Option<string> =>
  pipe(
    Str.trim(contents),
    O.liftPredicate(Str.startsWith(GITFILE_PREFIX)),
    O.map(flow(Str.slice(Str.length(GITFILE_PREFIX)), Str.trim)),
    O.filter(Str.isNonEmpty)
  );

const readGitMetadata = (fs: FileSystem.FileSystem, file: string) =>
  fs.readFileString(file).pipe(Effect.mapError(YeetCommandError.new(`Failed to read Git metadata "${file}".`)));

// Mirrors `git rev-parse --path-format=absolute --git-common-dir` without
// spawning git, then steps from the common dir to the clone that owns it.
const owningCloneRoot = Effect.fnUntraced(function* (
  repoRoot: string
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const originRoot = path.resolve(repoRoot);
  const dotGit = path.join(originRoot, ".git");
  const present = yield* fs
    .exists(dotGit)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to inspect Git metadata "${dotGit}".`)));
  if (!present) {
    return originRoot;
  }
  const info = yield* fs
    .stat(dotGit)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to inspect Git metadata "${dotGit}".`)));
  if (info.type !== "File") {
    return originRoot;
  }
  const target = gitfileTarget(yield* readGitMetadata(fs, dotGit));
  if (O.isNone(target)) {
    return yield* YeetCommandError.make({
      message: `Git metadata "${dotGit}" is a file without a "gitdir:" line.`,
      file: dotGit,
    });
  }
  const gitDir = path.resolve(originRoot, target.value);
  const commonDirFile = path.join(gitDir, "commondir");
  const hasCommonDir = yield* fs
    .exists(commonDirFile)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to inspect Git metadata "${commonDirFile}".`)));
  const commonDir = hasCommonDir ? path.resolve(gitDir, Str.trim(yield* readGitMetadata(fs, commonDirFile))) : gitDir;
  // `<clone>/.git` gives the clone. A common dir with any other name (a bare
  // `<name>.git`, a separated git dir) keeps the ledger inside itself: its
  // parent may hold other repositories, and they must not share one sample.
  return path.basename(commonDir) === ".git" ? path.dirname(commonDir) : commonDir;
});

/**
 * Resolve where a checkout's proof ledger lives: in the owning clone (ruling 71).
 *
 * **Details**
 *
 * Resolution reads the filesystem the way
 * `git rev-parse --path-format=absolute --git-common-dir` does, without
 * spawning git:
 *
 * - `<repoRoot>/.git` is a directory: the checkout is a primary clone and owns
 *   its ledger, at the same path as before ruling 71.
 * - `<repoRoot>/.git` is a `gitdir: <path>` file (a linked worktree): the Git
 *   dir resolves against `repoRoot`, the common dir is that Git dir's
 *   `commondir` file resolved against the Git dir (or the Git dir itself when
 *   there is no such file), and the owning clone follows from the common dir (below).
 * - No `.git` at all: the checkout owns its ledger (test roots, non-git
 *   directories).
 *
 * When the common dir is `<clone>/.git`, the owning clone is its parent, the
 * clone's checkout. A bare or separated common dir (one not named `.git`, such
 * as `/srv/repo.git` or a `--separate-git-dir` target) is itself the ledger
 * root, so `/srv/repo.git` keeps its ledger under `/srv/repo.git/.beep/yeet`:
 * the directory that holds a bare repository may hold others, and they must
 * not share one sample.
 *
 * A `.git` file without a `gitdir:` line, or Git metadata that cannot be read,
 * fails with {@link YeetCommandError}; the verdict path logs that and skips the
 * shadow pass rather than splitting the sample silently.
 *
 * **Example** (Resolve a checkout's ledger location)
 *
 * ```ts
 * import { resolveProofLedgerLocation } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(resolveProofLedgerLocation("/repo"))) // true
 * ```
 *
 * @param repoRoot - Checkout that ran: a primary clone, a linked worktree, or a plain directory.
 * @returns The checkout, its owning clone, and the shared ledger path.
 * @category utilities
 * @since 0.0.0
 */
export const resolveProofLedgerLocation = Effect.fn("Yeet.resolveProofLedgerLocation")(function* (
  repoRoot: string
): Effect.fn.Return<ProofLedgerLocation, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const ledgerRoot = yield* owningCloneRoot(repoRoot);
  return ProofLedgerLocation.make({
    originRoot: path.resolve(repoRoot),
    ledgerRoot,
    ledgerPath: path.join(ledgerRoot, ".beep", "yeet", "proof-ledger.ndjson"),
  });
});

/**
 * Resolve the append-only proof ledger path a checkout reads and writes.
 *
 * **Details**
 *
 * The path projection of {@link resolveProofLedgerLocation}: the ledger lives
 * in the owning clone's `.beep/yeet` artifact root, and the clone is the
 * parent of the Git common dir. When the common dir is `<clone>/.git` that is
 * the clone's checkout, so a linked worktree resolves to its clone's ledger
 * and a primary clone to its own; a bare or separated common dir (not named
 * `.git`) resolves to that directory's parent, as
 * `git rev-parse --git-common-dir` implies. It is not scoped to a branch or
 * run because proof facts describe inputs and epochs, not Git refs.
 *
 * **Example** (Resolve a checkout ledger)
 *
 * ```ts
 * import { proofLedgerPathForCheckout } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(proofLedgerPathForCheckout("/repo"))) // true
 * ```
 *
 * @param repoRoot - Checkout that ran: a primary clone, a linked worktree, or a plain directory.
 * @returns Path to `.beep/yeet/proof-ledger.ndjson` in the owning clone.
 * @category utilities
 * @since 0.0.0
 */
export const proofLedgerPathForCheckout = Effect.fn("Yeet.proofLedgerPathForCheckout")(function* (
  repoRoot: string
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  return (yield* resolveProofLedgerLocation(repoRoot)).ledgerPath;
});

/**
 * Resolve a file path inside the current Yeet run directory.
 *
 * **Example** (Resolve run artifact file path)
 *
 * ```ts
 * import { runArtifactPathForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runArtifactPathForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @param fileName - File name within `.beep/yeet/runs/<run-id>/`.
 * @returns Absolute path to the named run artifact.
 * @category utilities
 * @since 0.0.0
 */
export const runArtifactPathForContext = Effect.fn("Yeet.runArtifactPathForContext")(function* (
  context: RepoRunContext,
  fileName: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto | Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const runId = yield* runIdForContext(context);
  return path.join(artifactDir, "runs", runId, fileName);
});

/**
 * Resolve the state artifact path for the current Yeet run.
 *
 * **Example** (Resolve run state.json path)
 *
 * ```ts
 * import { runStatePathForContext } from "@beep/repo-cli/commands/Yeet/internal/ArtifactPaths"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runStatePathForContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param context - Repo run context carrying the artifact directory and branch.
 * @returns Absolute path to the branch-scoped `state.json`.
 * @category utilities
 * @since 0.0.0
 */
export const runStatePathForContext = (
  context: RepoRunContext
): Effect.Effect<string, YeetCommandError, Crypto.Crypto | Path.Path> =>
  runArtifactPathForContext(context, "state.json");
