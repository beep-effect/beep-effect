/**
 * Where workstation-scoped, repository-partitioned agent state lives: one
 * directory under the beep state root per store, one JSON Lines file per
 * checkout repository inside it, on any Git host. Shared by the PR-session
 * registry, the session stores and the fleet state.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { XdgBase } from "@beep/xdg/XdgBase";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("internal/state/WorkstationState");

/**
 * Host of a Git remote: a lower-cased DNS name. `github.com` is one value
 * among many; a self-hosted GitLab host is another.
 *
 * **Example** (Check hosts)
 *
 * ```ts
 * import { GitHost } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GitHost)("gitlab.example.com")) // true
 * console.log(S.is(GitHost)("GitHub.com")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GitHost = S.NonEmptyString.check(
  S.isPattern(
    /^[a-z0-9.-]+$/u,
    $I.annote("GitHostCheck", {
      title: "Git host",
      description: "A lower-cased DNS name of a Git remote host.",
      message: "Expected a lower-cased Git host name",
    })
  )
).pipe($I.annoteSchema("GitHost", { description: "Lower-cased DNS name of a Git remote host." }));

/**
 * Decoded host accepted by {@link GitHost}.
 *
 * **Example** (Annotate a host)
 *
 * ```ts
 * import type { GitHost } from "@beep/repo-cli/test/SharedInternals"
 *
 * const host: GitHost = "github.com"
 * console.log(host) // "github.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GitHost = typeof GitHost.Type;

/**
 * One owner or repository-name segment of a remote path, with GitHub's
 * character set: letters, digits, `_`, `.` and `-`.
 *
 * **Example** (Check segments)
 *
 * ```ts
 * import { RepositorySegment } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RepositorySegment)("beep-effect")) // true
 * console.log(S.is(RepositorySegment)("group/subgroup")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RepositorySegment = S.NonEmptyString.check(
  S.isPattern(
    /^[A-Za-z0-9_.-]+$/u,
    $I.annote("RepositorySegmentCheck", {
      title: "Repository segment",
      description: "Owner or repository name of a Git remote path.",
      message: "Expected an owner or repository name",
    })
  )
).pipe($I.annoteSchema("RepositorySegment", { description: "Owner or repository name of a Git remote path." }));

/**
 * Decoded segment accepted by {@link RepositorySegment}.
 *
 * **Example** (Annotate a segment)
 *
 * ```ts
 * import type { RepositorySegment } from "@beep/repo-cli/test/SharedInternals"
 *
 * const owner: RepositorySegment = "beep-effect"
 * console.log(owner) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RepositorySegment = typeof RepositorySegment.Type;

/**
 * The canonical home of a checkout, read from its origin fetch URL on any Git
 * host. It keys every workstation state file; it never names a GitHub API
 * target (that is `PrRepository`).
 *
 * **Details**
 *
 * The encoded shape is `{ host, owner, name }`, the shape GitHub-keyed rows
 * already carry, so those rows decode unchanged.
 *
 * **Example** (Construct a GitLab checkout identity)
 *
 * ```ts
 * import { CheckoutRepository } from "@beep/repo-cli/test/SharedInternals"
 *
 * const repository = CheckoutRepository.make({ host: "gitlab.example.com", owner: "team", name: "app" })
 * console.log(repository.host) // "gitlab.example.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutRepository extends S.Opaque<CheckoutRepository, { readonly brand: unique symbol }>()(
  S.Struct({ host: GitHost, owner: RepositorySegment, name: RepositorySegment }).pipe(
    $I.annoteSchema("CheckoutRepository", {
      description: "Canonical home of a checkout, from its origin fetch URL; keys workstation state.",
    })
  )
) {}

/**
 * Encoded checkout identity: the plain `{ host, owner, name }` record the
 * state-file helpers key by. Any repository identity with those fields fits.
 *
 * **Example** (Type a plain key)
 *
 * ```ts
 * import type { CheckoutRepositoryKey } from "@beep/repo-cli/test/SharedInternals"
 *
 * const key: CheckoutRepositoryKey = { host: "github.com", owner: "beep-effect", name: "beep-effect" }
 * console.log(key.owner) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CheckoutRepositoryKey = typeof CheckoutRepository.Encoded;

const lowerCasedRepository = (host: string, owner: string, name: string) =>
  CheckoutRepository.makeOption({
    host: Str.toLowerCase(host),
    owner: Str.toLowerCase(owner),
    name: Str.toLowerCase(name),
  });

const SCP_REMOTE = /^(?:[^@/\s]+@)?([^:/\s]+):([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/u;
const URL_REMOTE = /^(?:ssh|https?):\/\/(?:[^@/\s]+@)?([^:/\s]+)(?::\d+)?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/u;

const fromRemoteMatch = (match: RegExpMatchArray): O.Option<CheckoutRepository> =>
  pipe(
    O.all({
      host: O.fromUndefinedOr(match[1]),
      owner: O.fromUndefinedOr(match[2]),
      name: O.fromUndefinedOr(match[3]),
    }),
    O.flatMap(({ host, owner, name }) => lowerCasedRepository(host, owner, name))
  );

/**
 * Parse a remote URL into the checkout identity, on any host.
 *
 * **Details**
 *
 * Accepts the SSH scp form (`git@host:owner/name.git`), `ssh://[user@]host[:port]/owner/name.git`
 * and `http(s)://[user@]host/owner/name.git`; the `.git` suffix and a trailing slash are optional.
 * Host, owner and name are lower-cased. A local path, a nested group path
 * (`group/subgroup/name`) or any other spelling yields `O.none()`.
 *
 * **Example** (Three spellings)
 *
 * ```ts
 * import { checkoutRepositoryFromRemoteUrl } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(checkoutRepositoryFromRemoteUrl("git@GitLab.example.com:Team/App.git"))?.host)
 * // "gitlab.example.com"
 * console.log(O.getOrNull(checkoutRepositoryFromRemoteUrl("ssh://git@gitlab.example.com:2222/team/app.git"))?.name)
 * // "app"
 * console.log(O.isNone(checkoutRepositoryFromRemoteUrl("/srv/git/app.git"))) // true
 * ```
 *
 * @param url - A configured remote URL.
 * @returns The lower-cased identity, or `O.none()` when the URL names none.
 * @category parsing
 * @since 0.0.0
 */
export const checkoutRepositoryFromRemoteUrl = (url: string): O.Option<CheckoutRepository> => {
  const trimmed = Str.trim(url);
  return pipe(
    Str.match(URL_REMOTE)(trimmed),
    O.orElse(() => Str.match(SCP_REMOTE)(trimmed)),
    O.flatMap(fromRemoteMatch)
  );
};

/**
 * Codec between the `host/owner/name` spelling and a {@link CheckoutRepository}.
 *
 * **Details**
 *
 * Decoding lower-cases the text; a spelling without exactly three non-empty
 * segments fails. Encoding writes `host/owner/name`.
 *
 * **Example** (Decode a slug)
 *
 * ```ts
 * import { CheckoutRepositorySlug } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(CheckoutRepositorySlug)("GitLab.example.com/team/app")
 * console.log(O.getOrNull(decoded)?.host) // "gitlab.example.com"
 * console.log(O.isNone(S.decodeUnknownOption(CheckoutRepositorySlug)("team/app"))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckoutRepositorySlug = S.String.pipe(
  S.decodeTo(
    CheckoutRepository,
    SchemaTransformation.transform({
      decode: (slug: string): CheckoutRepositoryKey => {
        const [host, ...path] = Str.split(Str.toLowerCase(Str.trim(slug)), "/");
        return { host, owner: O.getOrElse(A.head(path), () => ""), name: A.join(A.drop(path, 1), "/") };
      },
      encode: (repository: CheckoutRepositoryKey): string =>
        `${repository.host}/${repository.owner}/${repository.name}`,
    })
  ),
  $I.annoteSchema("CheckoutRepositorySlug", {
    description: "The host/owner/name spelling of a checkout repository.",
  })
);

/**
 * Resolve a store's directory: an explicit override variable first, then
 * `$XDG_STATE_HOME/beep/<store>`, then `$HOME/.local/state/beep/<store>`.
 *
 * **Details**
 *
 * The state home resolves through `@beep/xdg` `XdgBase.require("state")`:
 * `$XDG_STATE_HOME` and `$HOME` count only when they hold an absolute path,
 * and without either the effect fails with a `ConfigError` naming `HOME`.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { resolveWorkstationStateDir } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveWorkstationStateDir({ override: "BEEP_SESSION_STATE_ROOT", store: "sessions" }))) // true
 * ```
 *
 * @param options - The override environment variable and the store name under the beep root.
 * @returns The absolute directory the store lives in.
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorkstationStateDir = Effect.fn("WorkstationState.resolveDir")(function* (options: {
  readonly override: string;
  readonly store: string;
}) {
  const configured = yield* Config.option(Config.String(options.override));
  if (O.isSome(configured) && Str.isNonEmpty(Str.trim(configured.value))) return configured.value;
  const stateHome = yield* XdgBase.require("state");
  return `${stateHome}/beep/${options.store}`;
});

const delimiterAmbiguous = (segment: string): boolean =>
  Str.includes("__")(segment) || Str.startsWith("_")(segment) || Str.endsWith("_")(segment);

const stateKeySegment = (segment: string): string =>
  delimiterAmbiguous(segment) ? Str.replaceAll("_", "%5F")(segment) : segment;

/**
 * The key every per-repository state file and directory shares:
 * `host__owner__name`, distinct for every distinct repository.
 *
 * **Details**
 *
 * A segment that could blur the `__` delimiter (one containing `__`, or
 * starting or ending with `_`) has each `_` written as `%5F`, so
 * `team__app/repo` and `team/app__repo` get different keys. Segments cannot
 * contain `%`, so an escaped key never equals a plain one, and every other
 * repository, GitHub's included, keeps its plain `host__owner__name` key.
 *
 * **Example** (Key a plain and an ambiguous repository)
 *
 * ```ts
 * import { checkoutRepositoryStateKey } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(checkoutRepositoryStateKey({ host: "github.com", owner: "beep-effect", name: "beep-effect" }))
 * // "github.com__beep-effect__beep-effect"
 * console.log(checkoutRepositoryStateKey({ host: "gitlab.example.com", owner: "team", name: "app__repo" }))
 * // "gitlab.example.com__team__app%5F%5Frepo"
 * ```
 *
 * @param repository - The repository the state belongs to.
 * @returns The state key, with no local data in it.
 * @category formatting
 * @since 0.0.0
 */
export const checkoutRepositoryStateKey = (repository: CheckoutRepositoryKey): string =>
  A.join(A.map([repository.host, repository.owner, repository.name], stateKeySegment), "__");

/**
 * The JSON Lines file name for a repository: `host__owner__name.jsonl` (the
 * {@link checkoutRepositoryStateKey}), with no local data in it.
 *
 * **Example** (Name a file)
 *
 * ```ts
 * import { repositoryJsonLinesFileName } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(repositoryJsonLinesFileName({ host: "github.com", owner: "beep-effect", name: "beep-effect" }))
 * // "github.com__beep-effect__beep-effect.jsonl"
 * ```
 *
 * @param repository - The repository the file is partitioned by.
 * @returns The file name.
 * @category formatting
 * @since 0.0.0
 */
export const repositoryJsonLinesFileName = (repository: CheckoutRepositoryKey): string =>
  `${checkoutRepositoryStateKey(repository)}.jsonl`;

/**
 * Treat a missing state file as empty history and map every other platform
 * failure through the store's own error.
 *
 * **Example** (A missing file reads as no rows)
 *
 * ```ts
 * import { emptyWhenNotFound } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(typeof emptyWhenNotFound) // "function"
 * ```
 *
 * @param onError - Maps a platform error other than NotFound to the store's error.
 * @returns A pipeable that recovers NotFound with an empty array.
 * @category utilities
 * @since 0.0.0
 */
export const emptyWhenNotFound =
  <E>(onError: (error: PlatformError.PlatformError) => E) =>
  <Row, R>(
    read: Effect.Effect<ReadonlyArray<Row>, PlatformError.PlatformError, R>
  ): Effect.Effect<ReadonlyArray<Row>, E, R> =>
    read.pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound" ? Effect.succeed(A.empty<Row>()) : Effect.fail(onError(error))
      )
    );
