/**
 * Shared Yeet artifact path helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { repoRunArtifactId, repoRunSafeArtifactName } from "../../../internal/repo-run/RepoRunArtifacts.ts";
import { perUserRuntimeRoot } from "../../../internal/repo-run/RuntimeRoot.ts";
import type { FileSystem } from "effect";
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

const artifactNameHash = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);

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

const proofCoordinatorDirectoryName = (): string =>
  `beep-yeet-proof-locks-${artifactNameHash(hostname())}-uid-${effectiveUserId()}`;

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
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const runtimeRoot = yield* proofCoordinatorRuntimeRoot();
  return path.join(
    runtimeRoot,
    proofCoordinatorDirectoryName(),
    `${artifactNameHash(canonicalRepositoryIdentity(repositoryIdentity))}.lock`
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
 * console.log(runIdForContext(context)) // e.g. "feature-status-work-1a2b3c4d"
 * ```
 *
 * @param context - Repo run context carrying the current branch.
 * @returns Sanitized run id for branch-scoped Yeet artifacts.
 * @category utilities
 * @since 0.0.0
 */
export const runIdForContext = (context: RepoRunContext): string => repoRunArtifactId(context.branch);

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
 * Resolve the checkout-scoped append-only proof ledger path.
 *
 * **Details**
 *
 * The ledger shares Yeet's `.beep/yeet` artifact root but is not scoped to a
 * branch or run because proof facts describe inputs and epochs, not Git refs.
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
 * @param repoRoot - Checkout root that owns the proof history.
 * @returns Path to `.beep/yeet/proof-ledger.ndjson` in that checkout.
 * @category utilities
 * @since 0.0.0
 */
export const proofLedgerPathForCheckout = Effect.fn("Yeet.proofLedgerPathForCheckout")(function* (
  repoRoot: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(repoRoot, ".beep", "yeet", "proof-ledger.ndjson");
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
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "runs", runIdForContext(context), fileName);
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
export const runStatePathForContext = (context: RepoRunContext): Effect.Effect<string, never, Path.Path> =>
  runArtifactPathForContext(context, "state.json");
