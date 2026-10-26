/**
 * Tag refs through GitHub's Git Database API.
 *
 * **Details**
 *
 * Creates, moves, resolves, lists and deletes tag refs, and finds the highest
 * version-shaped tag with `@beep/semver`. Annotated tags are dereferenced to
 * the commit they point at.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubId } from "@beep/identity/packages";
import { SemVer } from "@beep/semver";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constant, dual, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import { PageOptions } from "./Rest.ts";

const $I = $GithubId.create("GitTag");

/** How many annotated-tag dereferences to follow before giving up. */
const MAX_TAG_PEEL = 5;

const TagName = S.Struct({ name: S.String }).pipe(
  $I.annoteSchema("TagName", { description: "The tag name inspected before semver candidate selection." })
);
const TagEntry = S.Struct({ name: S.String, commit: S.Struct({ sha: S.String }) }).pipe(
  $I.annoteSchema("TagEntry", { description: "The name and nested commit SHA selected from a GitHub tag page entry." })
);

/**
 * A tag and the commit it ultimately points at.
 *
 * **Example** (Construct a resolved tag reference)
 *
 * ```ts
 * import { TagRef } from "@beep/github/GitTag";
 *
 * const tag = TagRef.make({ tag: "v1.2.3", sha: "abc123" });
 * console.log(tag.sha) // abc123
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TagRef extends S.Opaque<TagRef, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The tag name, without `refs/tags/`. */
    tag: S.NonEmptyString.pipe($I.annoteKey("TagRef.tag", { description: "The tag name, without `refs/tags/`." })),
    /** The **commit** sha, with annotated tags already dereferenced. */
    sha: S.String.pipe(
      $I.annoteKey("TagRef.sha", { description: "The **commit** sha, with annotated tags already dereferenced." })
    ),
  }).pipe($I.annoteSchema("TagRef", { description: "A tag and the commit it ultimately points at." }))
) {}

/**
 * A tag whose name carries a version.
 *
 * **Example** (Decode a tag with its parsed version)
 *
 * ```ts
 * import { SemverTag } from "@beep/github/GitTag";
 * import * as S from "effect/Schema";
 *
 * const tag = S.decodeUnknownSync(SemverTag)({
 *   tag: "v1.2.3", sha: "abc123",
 *   version: { major: 1, minor: 2, patch: 3, prerelease: [], build: [] },
 * });
 * console.log(tag.version.toString()) // 1.2.3
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SemverTag extends S.Opaque<SemverTag, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The tag name as GitHub has it. */
    tag: S.NonEmptyString.pipe($I.annoteKey("SemverTag.tag", { description: "The tag name as GitHub has it." })),
    /** The commit sha. */
    sha: S.String.pipe($I.annoteKey("SemverTag.sha", { description: "The commit sha." })),
    /** The version read out of the name. */
    version: SemVer.pipe($I.annoteKey("SemverTag.version", { description: "The version read out of the name." })),
  }).pipe($I.annoteSchema("SemverTag", { description: "A tag whose name carries a version." }))
) {}

/**
 * Read a version out of a tag name.
 *
 * **Details**
 *
 * The default covers the three shapes `@effected/workspaces`' `ReleaseTag`
 * produces: `v1.2.3`, `pkg@v1.2.3` and
 * `@scope/pkg@1.2.3`. Taking the substring after the **last** `@` is what makes
 * the scoped form work, since the scope itself contains one.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type VersionFromTag = (tag: string) => O.Option<string>;

/**
 * The default {@link VersionFromTag}.
 *
 * **Example** (Extract a scoped package version and detect absence)
 *
 * ```ts
 * import { versionFromTag } from "@beep/github/GitTag";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrElse(versionFromTag("@scope/pkg@v1.2.3"), () => "missing")) // 1.2.3
 * console.log(O.isNone(versionFromTag("v"))) // true
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const versionFromTag: VersionFromTag = (tag) => {
  const at = pipe(tag, Str.lastIndexOf("@"), O.getOrElse(constant(-1)));
  const candidate = at > 0 ? Str.slice(at + 1)(tag) : tag;
  const stripped = Str.startsWith("v")(candidate) ? Str.slice(1)(candidate) : candidate;
  return stripped === "" ? O.none() : O.some(stripped);
};

/**
 * How to pick the newest version-shaped tag.
 *
 * **Details**
 *
 * A non-data service option record: `extract` is a function and `page` a
 * `PageOptions` value, so both are declared with their `Encoded` side equal to
 * their `Type` side and callers pass them as they are.
 *
 * **Example** (Consider prereleases under one prefix)
 *
 * ```ts
 * import { LatestSemverOptions } from "@beep/github/GitTag";
 *
 * const options = LatestSemverOptions.make({ prefix: "pkg@", includePrerelease: true });
 * console.log(options.prefix) // pkg@
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class LatestSemverOptions extends S.Opaque<LatestSemverOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Override the tag-name → version convention. */
    extract: S.optionalKey(S.declare((input: unknown): input is VersionFromTag => P.isFunction(input))).pipe(
      $I.annoteKey("LatestSemverOptions.extract", { description: "Override the tag-name to version convention." })
    ),
    /** Consider prereleases too. Off by default: `1.0.0-rc.1` is not the latest release. */
    includePrerelease: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("LatestSemverOptions.includePrerelease", {
        description: "Consider prereleases too; off by default because 1.0.0-rc.1 is not the latest release.",
      })
    ),
    /** How far to walk. */
    page: S.optionalKey(PageOptions.pipe(S.toType)).pipe(
      $I.annoteKey("LatestSemverOptions.page", { description: "How far to walk the tag pages." })
    ),
    /** Only consider tags starting with this. */
    prefix: S.optionalKey(S.String).pipe(
      $I.annoteKey("LatestSemverOptions.prefix", { description: "Only consider tags starting with this." })
    ),
  }).pipe($I.annoteSchema("LatestSemverOptions", { description: "How to pick the newest version-shaped tag." }))
) {}

/**
 * Companion types for {@link LatestSemverOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LatestSemverOptions {
  /**
   * The plain options shape accepted by `GitTag.latestSemver`, so a caller can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LatestSemverOptions.Encoded;
}

/**
 * Tag refs in GitHub's Git Database API.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface GitTagShape {
  /** Create a tag ref at `sha`. Fails `alreadyExists` when it is already there. */
  readonly create: {
    (tag: string, sha: string): Effect.Effect<void, GitHubError, Repo>;
    (sha: string): (tag: string) => Effect.Effect<void, GitHubError, Repo>;
  };
  /** Delete the tag ref. */
  readonly delete: (tag: string) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * The newest version-shaped tag.
   *
   * **Gotchas**
   *
   * Parsing and comparison are both synchronous in `@beep/semver`
   * (`parseResult`, `compare`), so this is a single pass over the page stream
   * with no extra round trips.
   *
   * **"Newest" means highest version, not most recent.** That is the right
   * answer for a single-versioned repository and the wrong instrument for a
   * **monorepo publishing independently versioned packages**, where version
   * ordering and recency are unrelated: a `pkg-a@2.0.0` tag outranks a
   * `pkg-b@1.4.0` cut yesterday, so the result can sit several releases behind
   * the actual head and never move. Nothing about the failure is visible —
   * a stale-but-plausible tag comes back. In a monorepo, filter by the
   * package's tag prefix (see {@link LatestSemverOptions}) so the comparison
   * runs within one version line, or order by tagged-commit date instead.
   */
  readonly latestSemver: (
    options?: LatestSemverOptions.Encoded
  ) => Effect.Effect<O.Option<SemverTag>, GitHubError, Repo>;
  /** Every tag, in GitHub's order. `prefix` filters client-side. */
  readonly list: (options?: {
    readonly prefix?: string | undefined;
    readonly page?: PageOptions | undefined;
  }) => Effect.Effect<ReadonlyArray<TagRef>, GitHubError, Repo>;
  /**
   * The commit a tag points at, dereferencing annotated tags.
   *
   * **Details**
   *
   * Fails typed past five levels of nesting rather than looping.
   */
  readonly resolve: (tag: string) => Effect.Effect<string, GitHubError, Repo>;
  /** Point `tag` at `sha`, creating it if needed. */
  readonly upsert: {
    (tag: string, sha: string): Effect.Effect<void, GitHubError, Repo>;
    (sha: string): (tag: string) => Effect.Effect<void, GitHubError, Repo>;
  };
}

/**
 * Create, move, resolve, list and delete tag refs through GitHub's Git Database
 * API, and find the newest version-shaped tag.
 *
 * **Details**
 *
 * Provide it with {@link GitTag.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * **Example** (Find the highest version tag with a v prefix)
 *
 * ```ts
 * import { GitTag } from "@beep/github/GitTag";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const latest = Effect.gen(function* () {
 *   const tags = yield* GitTag;
 *   const newest = yield* tags.latestSemver({ prefix: "v" });
 *   return O.map(newest, (tag) => tag.version.toString());
 * });
 * console.log(Effect.isEffect(latest)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitTag extends Context.Service<GitTag, GitTagShape>()($I`GitTag`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Inspect the live service layer)
   *
   * ```ts
   * import { GitTag } from "@beep/github/GitTag";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitTag.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GitTag, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Override a test-double member)
   *
   * ```ts
   * import { GitTag } from "@beep/github/GitTag";
   * import * as Effect from "effect/Effect";
   *
   * const service = GitTag.makeTest({ resolve: () => Effect.succeed("abc123") });
   * console.log(Effect.isEffect(service.resolve("v1.2.3"))) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitTagShape> = {}): GitTagShape => ({
    create: overrides.create ?? (() => unstubbed("create")),
    upsert: overrides.upsert ?? (() => unstubbed("upsert")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    list: overrides.list ?? (() => unstubbed("list")),
    resolve: overrides.resolve ?? (() => unstubbed("resolve")),
    latestSemver: overrides.latestSemver ?? (() => unstubbed("latestSemver")),
  });

  /**
   * {@link GitTag.makeTest} behind a `Layer`.
   *
   * **Example** (Provide an in-memory service layer)
   *
   * ```ts
   * import { GitTag } from "@beep/github/GitTag";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitTag.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitTagShape> = {}): Layer.Layer<GitTag> =>
    Layer.succeed(GitTag, GitTag.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "GitTag" });

const shortTag = (tag: string): string => pipe(tag, Str.replace(/^refs\/tags\//, ""), Str.replace(/^tags\//, ""));

const rejectEmpty: {
  (operation: string, tag: string): Effect.Effect<string, GitHubError>;
  (tag: string): (operation: string) => Effect.Effect<string, GitHubError>;
} = dual(2, (operation: string, tag: string): Effect.Effect<string, GitHubError> => {
  const short = Str.trim(shortTag(tag));
  return short === ""
    ? Effect.fail(GitHubError.rejected(operation, 422, "a tag name is required"))
    : Effect.succeed(short);
});

/** The version a tag name offers under `options`, when it is a candidate at all. */
const candidateVersion = (options: LatestSemverOptions.Encoded | undefined): ((name: string) => O.Option<SemVer>) => {
  const prefix = options?.prefix ?? "";
  const extract = options?.extract ?? versionFromTag;
  const includePrerelease = options?.includePrerelease === true;
  return flow(
    O.liftPredicate((name: string) => Str.startsWith(prefix)(name)),
    O.flatMap(extract),
    O.flatMap((raw) => Result.getSuccess(SemVer.parseResult(raw))),
    O.filter((version) => includePrerelease || version.prerelease.length === 0)
  );
};

/** Whether `version` beats the best tag found so far. */
const outranks = (version: SemVer, best: SemverTag | undefined): boolean =>
  best === undefined || version.compare(best.version) === 1;

const make = (client: GitHubClient["Service"]): GitTagShape => {
  const create: GitTagShape["create"] = dual(
    2,
    Effect.fn("GitTag.create")(function* (tag: string, sha: string) {
      const { owner, repo } = yield* Repo;
      const short = yield* rejectEmpty("GitTag.create", tag);
      yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
      yield* client.request("POST /repos/{owner}/{repo}/git/refs", {
        owner,
        repo,
        ref: `refs/tags/${short}`,
        sha,
      });
    })
  );

  const reset: {
    (tag: string, sha: string): Effect.Effect<void, GitHubError, Repo>;
    (sha: string): (tag: string) => Effect.Effect<void, GitHubError, Repo>;
  } = dual(
    2,
    Effect.fn("GitTag.reset")(function* (tag: string, sha: string) {
      const { owner, repo } = yield* Repo;
      yield* client.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo,
        ref: `tags/${tag}`,
        sha,
        force: true,
      });
    })
  );

  const listStream = (options?: { readonly page?: PageOptions | undefined }) =>
    Stream.unwrap(
      Effect.map(Repo, ({ owner, repo }) =>
        client.paginateStream("GET /repos/{owner}/{repo}/tags", { owner, repo }, options?.page)
      )
    );

  const list = Effect.fn("GitTag.list")(function* (options?: {
    readonly prefix?: string | undefined;
    readonly page?: PageOptions | undefined;
  }) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, prefix: options?.prefix ?? "" });
    const tags = yield* Stream.runCollect(listStream(options));
    // GitHub has no server-side ref-prefix filter for this endpoint, so the
    // filter is client-side by necessity — which is exactly why latestSemver
    // exists rather than leaving callers to list-then-sort.
    const prefix = options?.prefix;
    const refs = yield* Effect.forEach(tags, (entry) =>
      S.decodeEffect(TagEntry)(entry).pipe(
        Effect.flatMap((validated) => S.decodeEffect(TagRef)({ tag: validated.name, sha: validated.commit.sha })),
        Effect.mapError((error) => GitHubError.decode("GitTag.list", "GitHub returned an unexpected tag", error))
      )
    );
    return A.filter(refs, (entry) => prefix === undefined || Str.startsWith(prefix)(entry.tag));
  });

  return {
    create,
    upsert: dual(
      2,
      Effect.fn("GitTag.upsert")(function* (tag: string, sha: string) {
        const short = yield* rejectEmpty("GitTag.upsert", tag);
        yield* Effect.annotateCurrentSpan({ tag: short });
        yield* create(tag, sha).pipe(Effect.catchIf(GitHubError.hasKind("alreadyExists"), () => reset(short, sha)));
      })
    ),
    delete: Effect.fn("GitTag.delete")(function* (tag: string) {
      const { owner, repo } = yield* Repo;
      const short = yield* rejectEmpty("GitTag.delete", tag);
      yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
      yield* client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo,
        ref: `tags/${short}`,
      });
    }),
    list,
    resolve: Effect.fn("GitTag.resolve")(function* (tag: string) {
      const { owner, repo } = yield* Repo;
      const short = yield* rejectEmpty("GitTag.resolve", tag);
      yield* Effect.annotateCurrentSpan({ owner, repo, tag: short });
      const ref = yield* client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
        owner,
        repo,
        ref: `tags/${short}`,
      });
      let sha = ref.object.sha;
      let type = ref.object.type;
      for (let peeled = 0; type === "tag"; peeled += 1) {
        if (peeled >= MAX_TAG_PEEL) {
          return yield* GitHubError.rejected(
            "GitTag.resolve",
            422,
            `tag ${short} nests deeper than ${MAX_TAG_PEEL} levels`
          );
        }
        const annotated = yield* client.request("GET /repos/{owner}/{repo}/git/tags/{tag_sha}", {
          owner,
          repo,
          tag_sha: sha,
        });
        sha = annotated.object.sha;
        type = annotated.object.type;
      }
      if (type !== "commit") {
        return yield* GitHubError.rejected("GitTag.resolve", 422, `tag ${short} points at a ${type}, not a commit`);
      }
      return sha;
    }),
    latestSemver: Effect.fn("GitTag.latestSemver")(function* (options?: LatestSemverOptions.Encoded) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, prefix: options?.prefix ?? "" });
      const candidate = candidateVersion(options);
      let best: SemverTag | undefined;
      // One pass: parsing and comparison are synchronous; wire validation
      // remains effectful so malformed selected candidates fail typed.
      yield* Stream.runForEach(listStream({ page: options?.page }), (entry) =>
        Effect.gen(function* () {
          const { name } = yield* S.decodeEffect(TagName)(entry);
          const version = candidate(name);
          if (O.isNone(version) || !outranks(version.value, best)) return;
          const validated = yield* S.decodeEffect(TagEntry)(entry);
          best = yield* S.decodeEffect(SemverTag)({ tag: name, sha: validated.commit.sha, version: version.value });
        }).pipe(
          Effect.mapError((error) =>
            GitHubError.decode("GitTag.latestSemver", "GitHub returned an unexpected semver tag", error)
          )
        )
      );
      return O.fromUndefinedOr(best);
    }),
  };
};
