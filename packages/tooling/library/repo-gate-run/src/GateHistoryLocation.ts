/**
 * Where the history store lives: the repository key that names its file, and
 * the file's path under the beep state directory.
 *
 * **Details**
 *
 * One file serves every clone and worktree of a repository. The key is the
 * canonical `origin` URL written as `host__owner__repo`, lower-cased, with
 * the scheme, any credentials and the `.git` suffix dropped; a repository
 * with no origin is keyed by a digest of the real path of its git common
 * directory. The canonicalization ports upstream `canonicalizeGitUrl` and
 * `gitUrlToProjectKey` (`packages/sdk/src/utils/canonicalize-git-url.ts`),
 * which `resolve-project-key-from-cwd.ts` applies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Digest from "effect/crypto/Digest";

const SCHEMES = ["git+ssh://", "git+https://", "ssh://", "https://", "http://"];

const SSH_SHORTHAND = /^(?:[\w.-]+@)?([\w.-]+):(.+)$/u;

const withoutScheme = (url: string): O.Option<string> =>
  pipe(
    A.findFirst(SCHEMES, (scheme) => Str.startsWith(scheme)(url)),
    O.map((scheme) => Str.slice(scheme.length)(url)),
    O.map(Str.replace(/^[^/@]*@/u, ""))
  );

const fromShorthand = (url: string): string =>
  pipe(
    O.fromNullOr(SSH_SHORTHAND.exec(url)),
    O.map((match) => A.join(A.drop(match, 1), "/")),
    O.getOrElse(() => url)
  );

const hostAndPath = (canonical: string): boolean => /^[^/]+\/.*[^/]$/u.test(canonical);

/**
 * The canonical `host/path` of a git remote URL, or none when it names no
 * host and path.
 *
 * **Example** (An SSH remote)
 *
 * ```ts
 * import { canonicalGitUrl } from "@beep/repo-gate-run/GateHistoryLocation";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrNull(canonicalGitUrl("git@github.com:Acme/App.git"))); // github.com/acme/app
 * ```
 *
 * @param url - the remote URL as git prints it
 * @returns the lower-cased host and path without scheme, user or `.git`
 * @category utilities
 * @since 0.0.0
 */
export const canonicalGitUrl: (url: string) => O.Option<string> = flow(
  Str.trim,
  (url) => O.getOrElse(withoutScheme(url), () => fromShorthand(url)),
  Str.replace(/\.git$/u, ""),
  Str.replace(/\/$/u, ""),
  Str.toLowerCase,
  O.liftPredicate(hostAndPath)
);

/**
 * The repository key of a git remote URL: its canonical `host/path` with
 * every `/` written as `__`.
 *
 * **Details**
 *
 * A `_` of the URL is written as `_u`, so no two canonical URLs share a key.
 *
 * **Example** (An HTTPS remote with credentials)
 *
 * ```ts
 * import { repositoryKeyFromOrigin } from "@beep/repo-gate-run/GateHistoryLocation";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrNull(repositoryKeyFromOrigin("https://token@github.com/acme/app.git"))); // github.com__acme__app
 * ```
 *
 * @param url - the `origin` remote URL
 * @returns the key, or none when the URL names no host and path
 * @category utilities
 * @since 0.0.0
 */
export const repositoryKeyFromOrigin: (url: string) => O.Option<string> = flow(
  canonicalGitUrl,
  O.map(flow(Str.replaceAll("_", "_u"), Str.replaceAll("/", "__")))
);

/**
 * The repository key of a repository with no origin: `local__` and the
 * first 16 hex digits of the SHA-256 of the real path of its git common
 * directory.
 *
 * **Example** (A local repository)
 *
 * ```ts
 * import { repositoryKeyFromCommonDir } from "@beep/repo-gate-run/GateHistoryLocation";
 * import * as Digest from "effect/crypto/Digest";
 * import * as Effect from "effect/Effect";
 *
 * const key = await Effect.runPromise(
 *   repositoryKeyFromCommonDir("/home/alice/code/app/.git").pipe(Effect.provide(Digest.layerWebCrypto))
 * );
 * console.log(key.startsWith("local__")); // true
 * ```
 *
 * @param commonDir - the real path of the repository's git common directory
 * @returns the key, computed with the `Digest` service
 * @category utilities
 * @since 0.0.0
 */
export const repositoryKeyFromCommonDir = (commonDir: string): Effect.Effect<string, never, Digest.Digest> =>
  S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(commonDir)).pipe(
    Effect.map((digest) => `local__${Str.slice(0, 16)(digest)}`),
    Effect.orDie
  );

/**
 * The directory under the beep state directory that holds the store files.
 *
 * **Example** (Read the directory name)
 *
 * ```ts
 * import { STORE_DIRECTORY } from "@beep/repo-gate-run/GateHistoryLocation";
 *
 * console.log(STORE_DIRECTORY); // gate-history
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const STORE_DIRECTORY = "gate-history";

/**
 * The store file's name for a repository key.
 *
 * **Example** (A file name)
 *
 * ```ts
 * import { storeFileName } from "@beep/repo-gate-run/GateHistoryLocation";
 *
 * console.log(storeFileName("github.com__acme__app")); // github.com__acme__app.sqlite
 * ```
 *
 * @param repositoryKey - the key {@link repositoryKeyFromOrigin} or {@link repositoryKeyFromCommonDir} produced
 * @returns the file name under {@link STORE_DIRECTORY}
 * @category utilities
 * @since 0.0.0
 */
export const storeFileName = (repositoryKey: string): string => `${repositoryKey}.sqlite`;
