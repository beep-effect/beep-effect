/**
 * The typed GitHub transport service: one route-keyed request, paginated
 * reads, owned GraphQL documents and rate-limit observation, plus the layers
 * and test doubles that provide it.
 *
 * **Details**
 *
 * This module imports `@octokit/core` and nothing heavier. Token and
 * configuration layers live here; the GitHub App layer lives in `GitHubApp`,
 * so a consumer that only authenticates with a token never links the JWT
 * signer. `layerTest` and `layerFixture` are the in-memory doubles, and the
 * fixture double pages through the same engine the live client uses.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { getSomesStruct } from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { GitHubError } from "./GitHubError.ts";
import { GitHubGraphQLError } from "./GraphQL.ts";
import { FetchFunction, makeTransport, RetryPolicySchema } from "./internal/octokit.ts";
import { fromArray, paginate } from "./internal/paginate.ts";
import { RateLimitSnapshot, RetryPolicy } from "./Resilience.ts";
import type * as Redacted from "effect/Redacted";
import type { GraphQLDocument } from "./GraphQL.ts";
import type * as Rest from "./Rest.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $GithubId.create("GitHubClient");

class FixtureError extends S.TaggedError<FixtureError, { readonly brand: unique symbol }>($I`FixtureError`)(
  "FixtureError",
  {
    message: S.String.pipe(
      $I.annoteKey("FixtureError.message", {
        description: "The requested route or GraphQL document missing from the fixture.",
      })
    ),
  },
  $I.annoteError<FixtureError>("FixtureError", {
    description: "A GitHubClient fixture has no response for the requested operation.",
  })
) {}

/** GitHub's own maximum page size, and the default this package requests. */
const DEFAULT_PER_PAGE = 100;

/**
 * The typed GitHub transport: one request, one paginated read, one GraphQL
 * document, and whatever the rate-limit headers last said.
 *
 * **Details**
 *
 * Every member is an `Effect`, a `Stream`, or a function returning one — the
 * rule that keeps `Layer.mock` and `layerTest(Partial<Shape>)` useful. That
 * includes `rateLimit`, which is an `Effect`-valued property rather than a
 * getter for exactly this reason.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface GitHubClientShape {
  /** Run an owned GraphQL document and decode its answer. */
  readonly graphql: {
    <A, V extends Record<string, unknown>>(
      document: GraphQLDocument<A, V>,
      variables: V
    ): Effect.Effect<A, GitHubGraphQLError>;
    <A, V extends Record<string, unknown>>(
      variables: V
    ): (document: GraphQLDocument<A, V>) => Effect.Effect<A, GitHubGraphQLError>;
  };

  /**
   * Collect every page of a paginating route, honoring {@link PageOptions}.
   *
   * **Gotchas**
   *
   * Handing this a non-paginating route is a compile error.
   */
  readonly paginate: {
    <R extends Rest.PaginatingRoute>(
      route: R,
      params: Rest.Params<R>,
      options?: PageOptions
    ): Effect.Effect<ReadonlyArray<Rest.Item<R>>, GitHubError>;
    <R extends Rest.PaginatingRoute>(
      params: Rest.Params<R>,
      options?: PageOptions
    ): (route: R) => Effect.Effect<ReadonlyArray<Rest.Item<R>>, GitHubError>;
  };

  /**
   * The same traversal as a `Stream`, for when the caller decides where to stop.
   *
   * **Details**
   *
   * Lazy in requests: a downstream `Stream.take` stops the walk rather than
   * filtering pages that were already fetched.
   */
  readonly paginateStream: {
    <R extends Rest.PaginatingRoute>(
      route: R,
      params: Rest.Params<R>,
      options?: PageOptions
    ): Stream.Stream<Rest.Item<R>, GitHubError>;
    <R extends Rest.PaginatingRoute>(
      params: Rest.Params<R>,
      options?: PageOptions
    ): (route: R) => Stream.Stream<Rest.Item<R>, GitHubError>;
  };

  /**
   * What GitHub's rate-limit headers said on the most recent response.
   *
   * **Gotchas**
   *
   * Observation, not policy: **nothing here throttles on your behalf.** The
   * client retries a rate-limited failure with GitHub's own advised delay, and
   * a caller that wants to pace itself proactively reads this.
   */
  readonly rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>;
  /**
   * One request. The route types both the parameters and the returned `data`.
   *
   * **Example** (Read the default branch with a typed request)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Effect from "effect/Effect";
   *
   * const defaultBranch = Effect.gen(function* () {
   *   const client = yield* GitHubClient;
   *   const repo = yield* client.request("GET /repos/{owner}/{repo}", { owner: "o", repo: "r" });
   *   return repo.default_branch; // string — no cast, no hand-written interface
   * });
   *
   * console.log(Effect.isEffect(defaultBranch)) // true
   * ```
   */
  readonly request: {
    <R extends Rest.Route>(route: R, params: Rest.Params<R>): Effect.Effect<Rest.Data<R>, GitHubError>;
    <R extends Rest.Route>(params: Rest.Params<R>): (route: R) => Effect.Effect<Rest.Data<R>, GitHubError>;
  };

  /**
   * A route GitHub does not describe in its OpenAPI schema, or one whose live
   * shape differs from it.
   *
   * **Details**
   *
   * The `schema` is **mandatory**. This is an escape hatch from the route
   * table, never from typing: the payload still arrives decoded, and a shape
   * mismatch fails as `kind: "decode"` rather than surfacing as a value nobody
   * checked. The attestations read uses it, because pinning
   * `X-GitHub-Api-Version` puts the response on a contract the generated types
   * do not describe.
   */
  readonly requestDecoded: {
    <A, I>(
      route: string,
      params: Record<string, unknown> & Rest.RequestExtras.Encoded,
      schema: S.Codec<A, I>
    ): Effect.Effect<A, GitHubError>;
    <A, I>(
      params: Record<string, unknown> & Rest.RequestExtras.Encoded,
      schema: S.Codec<A, I>
    ): (route: string) => Effect.Effect<A, GitHubError>;
  };
}

/**
 * How a client layer is built.
 *
 * **Details**
 *
 * Service options rather than wire data: `fetch` is a function and `token` a
 * `Redacted`, so nothing here is ever decoded from JSON. Every field's encoded
 * side equals its decoded side, and the layers take
 * {@link GitHubClientOptions.Encoded} so a caller passes an object literal.
 *
 * **Example** (Describe a token client)
 *
 * ```ts
 * import { GitHubClientOptions } from "@beep/github/GitHubClient";
 * import * as Redacted from "effect/Redacted";
 *
 * const options = GitHubClientOptions.make({ token: Redacted.make("example-token"), retry: "off" });
 * console.log(options.retry) // off
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitHubClientOptions extends S.Opaque<GitHubClientOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A GitHub Enterprise API root, e.g. `https://github.acme.com/api/v3`. */
    baseUrl: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitHubClientOptions.baseUrl", {
        description: "A GitHub Enterprise API root, e.g. `https://github.acme.com/api/v3`.",
      })
    ),
    /**
     * A replacement for the global `fetch`.
     *
     * **Details**
     *
     * octokit's own documented hook. It is the seam a test drives the **real**
     * request path through — classification, header capture, retry and
     * pagination all exercised against canned HTTP responses instead of against
     * a hand-written double of this service.
     */
    fetch: S.optionalKey(FetchFunction).pipe(
      $I.annoteKey("GitHubClientOptions.fetch", { description: "A replacement for the global `fetch`." })
    ),
    /** Retry behavior. Defaults to {@link RetryPolicy.default}; `"off"` disables it. */
    retry: S.optionalKey(S.Union([RetryPolicySchema, S.Literal("off")])).pipe(
      $I.annoteKey("GitHubClientOptions.retry", {
        description: 'Retry behavior. Defaults to RetryPolicy.default; "off" disables it.',
      })
    ),
    /** The token every request authenticates with. */
    token: S.Redacted(S.String).pipe(
      $I.annoteKey("GitHubClientOptions.token", { description: "The token every request authenticates with." })
    ),
    /** Appended to octokit's own user agent. */
    userAgent: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitHubClientOptions.userAgent", { description: "Appended to octokit's own user agent." })
    ),
  }).pipe($I.annoteSchema("GitHubClientOptions", { description: "How a GitHub client layer is built." }))
) {}

/**
 * Companion types for {@link GitHubClientOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitHubClientOptions {
  /**
   * The plain, unbranded options the client layers accept, so a caller can
   * pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitHubClientOptions.Encoded;
}

const RecordedCallKind = LiteralKit(["request", "requestDecoded", "paginate", "graphql"]).pipe(
  $I.annoteSchema("RecordedCallKind", { description: "Which GitHubClient surface a fixture call used." })
);

/**
 * One call served by {@link GitHubClient.layerFixture}, as recorded in
 * {@link GitHubFixtures}' `requested`.
 *
 * **Example** (Record a request call)
 *
 * ```ts
 * import { RecordedCall } from "@beep/github/GitHubClient";
 *
 * const call = RecordedCall.make({ kind: "request", route: "GET /repos/{owner}/{repo}", params: { owner: "o" } });
 * console.log(call.kind) // request
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RecordedCall extends S.Opaque<RecordedCall, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Which client surface was called. */
    kind: RecordedCallKind.pipe($I.annoteKey("RecordedCall.kind", { description: "Which client surface was called." })),
    /** The params (or GraphQL variables) the call was made with. */
    params: S.Record(S.String, S.Unknown).pipe(
      $I.annoteKey("RecordedCall.params", { description: "The params (or GraphQL variables) the call was made with." })
    ),
    /** The page size asked for; paginated reads only. */
    perPage: S.optionalKey(S.Int).pipe(
      $I.annoteKey("RecordedCall.perPage", { description: "The page size asked for; paginated reads only." })
    ),
    /** The route literal, or the document name for `graphql`. */
    route: S.String.pipe(
      $I.annoteKey("RecordedCall.route", { description: "The route literal, or the document name for `graphql`." })
    ),
  }).pipe($I.annoteSchema("RecordedCall", { description: "One call served by GitHubClient.layerFixture." }))
) {}

type PaginateFixtures = {
  readonly [R in Rest.PaginatingRoute]?: Result.Result<ReadonlyArray<Rest.Item<R>>, GitHubError>;
};

type RequestFixtures = { readonly [R in Rest.Route]?: Result.Result<Rest.Data<R>, GitHubError> };

const PaginateFixturesSchema = S.declare((u: unknown): u is PaginateFixtures => P.isObject(u)).pipe(
  $I.annoteSchema("PaginateFixtures", { description: "Recorded paginated collections, keyed by route." })
);

const RequestFixturesSchema = S.declare((u: unknown): u is RequestFixtures => P.isObject(u)).pipe(
  $I.annoteSchema("RequestFixtures", { description: "Recorded request payloads, keyed by route." })
);

const RateLimitSnapshotValue = RateLimitSnapshot.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("RateLimitSnapshotValue", { description: "A constructed RateLimitSnapshot, kept as is." })
);

const RecordedCalls = S.declare((u: unknown): u is Array<RecordedCall> => A.isArray(u)).pipe(
  $I.annoteSchema("RecordedCalls", { description: "The mutable log a fixture appends each served call to." })
);

const UnstubbedPolicy = LiteralKit(["die", "fail", "empty"]).pipe(
  $I.annoteSchema("UnstubbedPolicy", { description: "What a fixture does for an operation it has no entry for." })
);

/**
 * A recorded response table for {@link GitHubClient.layerFixture}.
 *
 * **Details**
 *
 * A test-double table rather than wire data: the route-keyed entries hold
 * `Result` values and `requested` is a mutable log the fixture appends to.
 * Every field's encoded side equals its decoded side, and
 * {@link GitHubClient.layerFixture} takes {@link GitHubFixtures.Encoded}, so a
 * suite passes an object literal and keeps its own reference to `requested`.
 *
 * **Example** (Describe an empty fixture table)
 *
 * ```ts
 * import { GitHubFixtures } from "@beep/github/GitHubClient";
 *
 * const fixtures = GitHubFixtures.make({ unstubbed: "empty" });
 * console.log(fixtures.unstubbed) // empty
 * ```
 *
 * @public
 * @category testing
 * @since 0.0.0
 */
export class GitHubFixtures extends S.Opaque<GitHubFixtures, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Keyed by document name; the value is the raw payload to decode. */
    graphql: S.optionalKey(S.Record(S.String, S.Unknown)).pipe(
      $I.annoteKey("GitHubFixtures.graphql", {
        description: "Keyed by document name; the value is the raw payload to decode.",
      })
    ),
    /**
     * Keyed by route; each success contains the whole collection, paged on demand, or a
     * `Result.fail(GitHubError)` the paginated read fails with.
     */
    paginate: S.optionalKey(PaginateFixturesSchema).pipe(
      $I.annoteKey("GitHubFixtures.paginate", {
        description: "Keyed by route; each entry is the whole collection or the failure the read fails with.",
      })
    ),
    /** What `rateLimit` answers. */
    rateLimit: S.optionalKey(RateLimitSnapshotValue).pipe(
      $I.annoteKey("GitHubFixtures.rateLimit", { description: "What `rateLimit` answers." })
    ),
    /**
     * Keyed by route; each success contains that route's complete `data` payload.
     *
     * **Details**
     *
     * A recorded `Result.fail(GitHubError)` is the response: the call fails with it. This
     * is how a suite stubs a 404 (or a rate-limit, or a 422) deliberately,
     * rather than relying on a route's absence to produce one — absence is a
     * wiring mistake and `unstubbed` treats it as such.
     */
    request: S.optionalKey(RequestFixturesSchema).pipe(
      $I.annoteKey("GitHubFixtures.request", {
        description: "Keyed by route; each entry is the route's complete data payload or the failure it answers.",
      })
    ),
    /** Raw responses for schema-decoded routes, keyed by route. */
    requestDecoded: S.optionalKey(S.Record(S.String, S.Unknown)).pipe(
      $I.annoteKey("GitHubFixtures.requestDecoded", {
        description: "Raw responses for schema-decoded routes, keyed by route.",
      })
    ),
    /**
     * Every call the fixture served, in order. Populated as the test runs.
     *
     * **Details**
     *
     * `kind` says which surface was used. A paginated read carries the
     * `perPage` it asked for; `request` and `requestDecoded` carry the
     * **params** they were called with, which is what lets a suite assert that a
     * method sent the right `owner`/`repo`/body rather than only the right
     * route. `graphql` records the document name as `route`.
     */
    requested: S.optionalKey(RecordedCalls).pipe(
      $I.annoteKey("GitHubFixtures.requested", {
        description: "Every call the fixture served, in order. Populated as the test runs.",
      })
    ),
    /**
     * What a route with **no fixture entry** does. Defaults to `"die"`.
     *
     * **Details**
     *
     * A missing fixture is a **test wiring** mistake, not a condition the code
     * under test should handle, so the default kills the fiber rather than
     * entering the error channel — the same treatment an absent `graphql`
     * fixture gets.
     *
     * Prefer `"die"` to `"fail"`: **a typed failure is only loud in code that
     * does not catch.** Code whose methods each catch `GitHubError` and report
     * it — a per-resource sync, say — turns a missing stub into a *different
     * execution path* rather than a failure, and the assertions then fail for a
     * new reason with nothing in any message naming a fixture.
     *
     * - `"die"` — defect naming the route. Loud in every consumer.
     * - `"fail"` — fail with `GitHubError.notFound`. Rarely what you want, since
     *   a recorded failure stubs an error explicitly:
     *   `{ "GET /repos/{owner}/{repo}": Result.fail(GitHubError.notFound("read", "repo")) }`
     *   says which route fails and why, where absence says only "unwired".
     * - `"empty"` — serve no items for a paginated read. Single requests fail
     *   with `GitHubError.notFound`: no value is empty for every response type.
     *
     * `graphql` ignores this and always dies: its payload is decoded against the
     * document's schema, so there is no empty value that would satisfy it.
     */
    unstubbed: S.optionalKey(UnstubbedPolicy).pipe(
      $I.annoteKey("GitHubFixtures.unstubbed", {
        description: 'What a route with no fixture entry does. Defaults to "die".',
      })
    ),
  }).pipe(
    $I.annoteSchema("GitHubFixtures", { description: "A recorded response table for GitHubClient.layerFixture." })
  )
) {}

/**
 * Companion types for {@link GitHubFixtures}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitHubFixtures {
  /**
   * The plain, unbranded table {@link GitHubClient.layerFixture} accepts, so a
   * suite can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitHubFixtures.Encoded;
}

const resolvePolicy = (retry: RetryPolicy | "off" | undefined): RetryPolicy =>
  retry === undefined ? RetryPolicy.default : retry === "off" ? RetryPolicy.none : retry;

const perPageOf = (options: PageOptions | undefined): number => options?.perPage ?? DEFAULT_PER_PAGE;

const unstubbed = unstubbedFor({
  service: "GitHubClient",
  hint: "pass an override, or use GitHubClient.layerFixture for recorded responses",
});

/**
 * The typed GitHub API client.
 *
 * **Details**
 *
 * The route is the key. `@octokit/types` generates a map from GitHub's OpenAPI
 * description that carries every endpoint's parameter and response shapes, and
 * `@octokit/core`'s `request` already consumes it — so a caller writes a route
 * literal and gets both sides typed, with no callback, no type parameter to
 * invent, and no cast.
 *
 * Nothing here asks the caller to invent a response type: the route literal is
 * the only thing written, and a mismatch between a route and its parameters is
 * a compile error.
 *
 * **Example** (Read the latest release tag with token authentication)
 *
 * ```ts
 * import { GitHubClient } from "@beep/github/GitHubClient";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
 *
 * const program = Effect.gen(function* () {
 *   const client = yield* GitHubClient;
 *   const release = yield* client.request("GET /repos/{owner}/{repo}/releases/latest", {
 *     owner: "effect-ts",
 *     repo: "effect",
 *   });
 *   return release.tag_name;
 * });
 *
 * const layer = GitHubClient.layerFromToken({ token: Redacted.make("ghp_example") });
 * console.log(Effect.isEffect(program.pipe(Effect.provide(layer)))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitHubClient extends Context.Service<GitHubClient, GitHubClientShape>()($I`GitHubClient`) {
  /**
   * A client authenticated with a token you already hold.
   *
   * **Details**
   *
   * This module imports `@octokit/core` and nothing heavier. A consumer that
   * only ever authenticates with a token never links the GitHub App JWT signer,
   * because the App-authenticated layer lives in `GitHubApp` — a different
   * module — rather than as a third static here.
   *
   * **Example** (Construct a token client layer)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Layer from "effect/Layer";
   * import * as Redacted from "effect/Redacted";
   *
   * const layer = GitHubClient.layerFromToken({ token: Redacted.make("example-token") });
   * console.log(Layer.isLayer(layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFromToken = (options: GitHubClientOptions.Encoded): Layer.Layer<GitHubClient> =>
    Layer.effect(this, makeClientShape(options));

  /**
   * A client authenticated from configuration, `GITHUB_TOKEN` by default.
   *
   * **Details**
   *
   * Reads through the ambient `ConfigProvider`, not `process.env`, so a test
   * provides a provider instead of mutating the environment and a non-Actions
   * consumer can source the token however it likes.
   *
   * Construction fails with core's `ConfigError` when no token is configured.
   *
   * **Example** (Construct a configured client layer)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubClient.layerFromConfig({ name: "MY_TOKEN" }))) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFromConfig = (
    options: Omit<GitHubClientOptions.Encoded, "token"> & { readonly name?: string | undefined } = {}
  ): Layer.Layer<GitHubClient, Config.ConfigError> =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const token = yield* Config.Redacted(options.name ?? "GITHUB_TOKEN");
        return yield* makeClientShape({ ...options, token });
      })
    );

  /**
   * An in-memory double: stub the members a test exercises, and every other
   * member **dies** naming itself.
   *
   * **Gotchas**
   *
   * No member has an honest default. A fabricated response — an empty list, a
   * made-up sha — would leak into the code under test as fact, so the double
   * fails loudly instead, which also makes it proof that a test touches nothing
   * but what it stubbed.
   *
   * For recorded responses that page for real, use
   * {@link GitHubClient.layerFixture}.
   *
   * **Example** (Read test-double rate-limit observation)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const client = GitHubClient.makeTest();
   * console.log(O.isNone(Effect.runSync(client.rateLimit))) // true
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitHubClientShape> = {}): GitHubClientShape => ({
    request: overrides.request ?? (() => unstubbed("request")),
    requestDecoded: overrides.requestDecoded ?? (() => unstubbed("requestDecoded")),
    paginate: overrides.paginate ?? (() => unstubbed("paginate")),
    paginateStream: overrides.paginateStream ?? (() => unstubbed("paginateStream")),
    graphql: overrides.graphql ?? (() => unstubbed("graphql")),
    rateLimit: overrides.rateLimit ?? Effect.succeedNone,
  });

  /**
   * {@link GitHubClient.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a client test double)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GitHubClient.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitHubClientShape> = {}): Layer.Layer<GitHubClient> =>
    Layer.succeed(GitHubClient, GitHubClient.makeTest(overrides));

  /**
   * A double over recorded responses that **pages them for real**.
   *
   * **Details**
   *
   * The recorded-response double in this package. It reimplements no behavior:
   * it builds a `PageSource` over the recorded
   * array and hands it to the same `paginate` engine the live client uses, so
   * `perPage` and `maxPages` cannot behave differently here than in production.
   *
   * `fixtures.requested` is appended to as the test runs, so a suite can assert
   * which routes were walked and at what page size.
   *
   * **Example** (Provide recorded client responses)
   *
   * ```ts
   * import { GitHubClient } from "@beep/github/GitHubClient";
   * import * as Layer from "effect/Layer";
   *
   * const layer = GitHubClient.layerFixture({ paginate: {}, unstubbed: "empty" });
   * console.log(Layer.isLayer(layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFixture = (fixtures: GitHubFixtures.Encoded): Layer.Layer<GitHubClient> =>
    Layer.succeed(GitHubClient, makeFixture(fixtures));
}

/**
 * Builds the live shape over a constructed transport.
 *
 * **Details**
 *
 * Exported for `GitHubApp`, which builds clients of its own — one speaking as
 * the app (JWT), one as an installation, and one unauthenticated for the bot-user
 * lookup that rejects an app JWT. Not part of the public surface.
 *
 * **Example** (Construct a live transport effect)
 *
 * ```ts
 * import { makeClientShape } from "@beep/github/GitHubClient";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(makeClientShape({ retry: "off" }))) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeClientShape = Effect.fn("GitHubClient.makeClientShape")(function* (
  options: Omit<GitHubClientOptions.Encoded, "token"> & { readonly token?: Redacted.Redacted<string> | undefined }
): Effect.fn.Return<GitHubClientShape> {
  const transport = yield* makeTransport({
    retry: resolvePolicy(options.retry),
    ...getSomesStruct({
      token: O.fromUndefinedOr(options.token),
      baseUrl: O.fromUndefinedOr(options.baseUrl),
      userAgent: O.fromUndefinedOr(options.userAgent),
      fetch: O.fromUndefinedOr(options.fetch),
    }),
  });

  const request: GitHubClientShape["request"] = dual(
    2,
    Effect.fn("GitHubClient.request")(function* <R extends Rest.Route>(route: R, params: Rest.Params<R>) {
      yield* Effect.annotateCurrentSpan({ route });
      const response = yield* transport.request<Rest.Data<R>>(route, route, { ...params });
      return response.data;
    })
  );

  const requestDecoded: GitHubClientShape["requestDecoded"] = dual(
    3,
    Effect.fn("GitHubClient.requestDecoded")(function* <A, I>(
      route: string,
      params: Record<string, unknown> & Rest.RequestExtras.Encoded,
      schema: S.Codec<A, I>
    ) {
      yield* Effect.annotateCurrentSpan({ route });
      const response = yield* transport.request<unknown>(route, route, params);
      return yield* S.decodeUnknownEffect(schema)(response.data).pipe(
        Effect.catchTag("SchemaError", (error) =>
          Effect.fail(GitHubError.decode(route, "response did not match its schema", error))
        )
      );
    })
  );

  const paginateStream: GitHubClientShape["paginateStream"] = dual(
    (args) => P.isString(args[0]),
    <R extends Rest.PaginatingRoute>(
      route: R,
      params: Rest.Params<R>,
      options?: PageOptions
    ): Stream.Stream<Rest.Item<R>, GitHubError> =>
      paginate<Rest.Item<R>>(
        () =>
          transport.pageSource<Rest.Item<R>>(route, route, {
            per_page: perPageOf(options),
            ...params,
          }),
        options?.maxPages
      )
  );

  const paginateAll: GitHubClientShape["paginate"] = dual(
    (args) => P.isString(args[0]),
    Effect.fn("GitHubClient.paginate")(function* <R extends Rest.PaginatingRoute>(
      route: R,
      params: Rest.Params<R>,
      options?: PageOptions
    ) {
      yield* Effect.annotateCurrentSpan({ route, perPage: perPageOf(options), maxPages: options?.maxPages ?? -1 });
      return yield* Stream.runCollect(paginateStream(route, params, options));
    })
  );

  const graphql: GitHubClientShape["graphql"] = dual(
    2,
    Effect.fn("GitHubClient.graphql")(function* <A, V extends Record<string, unknown>>(
      document: GraphQLDocument<A, V>,
      variables: V
    ) {
      yield* Effect.annotateCurrentSpan({ document: document.name });
      const raw = yield* transport.graphql(document.name, document.document, document.encodeVariables(variables));
      return yield* document.decode(raw).pipe(
        // Normalized at the boundary: a SchemaError never escapes into
        // application logic.
        Effect.catchTag("SchemaError", (error) =>
          Effect.fail(GitHubGraphQLError.decode(document.name, "response did not match its schema", error))
        )
      );
    })
  );

  return {
    request,
    requestDecoded,
    paginate: paginateAll,
    paginateStream,
    graphql,
    rateLimit: transport.rateLimit,
  };
});

const makeFixture = (fixtures: GitHubFixtures.Encoded): GitHubClientShape => {
  const requested = fixtures.requested;
  const paginateStream: GitHubClientShape["paginateStream"] = dual(
    (args) => P.isString(args[0]),
    <R extends Rest.PaginatingRoute>(
      route: R,
      _params: Rest.Params<R>,
      options?: PageOptions
    ): Stream.Stream<Rest.Item<R>, GitHubError> => {
      // Record BEFORE the existence and error branches, matching every other
      // surface. Recording afterwards meant a stubbed-error or unstubbed
      // paginated read never appeared in `requested`, so a suite could not tell
      // "paginate was never called" from "paginate was called and failed" —
      // which is the one case the error-as-response fixture exists to confirm.
      const perPage = perPageOf(options);
      requested?.push(RecordedCall.make({ kind: "paginate", route, params: { ..._params }, perPage }));

      const recorded: Result.Result<ReadonlyArray<Rest.Item<R>>, GitHubError> | undefined = fixtures.paginate?.[route];
      if (recorded === undefined) {
        return Match.value(fixtures.unstubbed ?? "die").pipe(
          Match.when("fail", () => Stream.fail(GitHubError.notFound("GitHubClient.paginate", `fixture for ${route}`))),
          Match.when("empty", () => Stream.empty),
          Match.when("die", () =>
            Stream.die(FixtureError.make({ message: `GitHubClient.paginate: no fixture for ${route}` }))
          ),
          Match.exhaustive
        );
      }
      if (Result.isFailure(recorded)) return Stream.fail(recorded.failure);
      return paginate<Rest.Item<R>>(() => fromArray(recorded.success, perPage), options?.maxPages);
    }
  );

  // A missing fixture is wiring, not a domain condition — see `unstubbed`.
  const missing: {
    (method: string, route: string): Effect.Effect<never, GitHubError>;
    (route: string): (method: string) => Effect.Effect<never, GitHubError>;
  } = dual(
    2,
    (method: string, route: string): Effect.Effect<never, GitHubError> =>
      Match.value(fixtures.unstubbed ?? "die").pipe(
        Match.when(Match.is("fail", "empty"), () => Effect.fail(GitHubError.notFound(method, `fixture for ${route}`))),
        Match.when("die", () => Effect.die(FixtureError.make({ message: `${method}: no fixture for ${route}` }))),
        Match.exhaustive
      )
  );

  return {
    request: dual(
      2,
      <R extends Rest.Route>(route: R, params: Rest.Params<R>): Effect.Effect<Rest.Data<R>, GitHubError> => {
        requested?.push(RecordedCall.make({ kind: "request", route, params: { ...params } }));
        const data: Result.Result<Rest.Data<R>, GitHubError> | undefined = fixtures.request?.[route];
        if (data === undefined) return missing("GitHubClient.request", route);
        // A recorded Result failure is the response: this is how a suite stubs a
        // 404 deliberately, rather than relying on a route's absence.
        return Effect.fromResult(data);
      }
    ),
    requestDecoded: dual(
      3,
      <A, I>(route: string, params: Record<string, unknown>, schema: S.Codec<A, I>): Effect.Effect<A, GitHubError> => {
        requested?.push(RecordedCall.make({ kind: "requestDecoded", route, params }));
        const data = fixtures.requestDecoded?.[route];
        if (data === undefined) return missing("GitHubClient.requestDecoded", route);
        if (S.is(GitHubError)(data)) return Effect.fail(data);
        return S.decodeUnknownEffect(schema)(data).pipe(
          Effect.catchTag("SchemaError", (error) =>
            Effect.fail(GitHubError.decode(route, "fixture did not match its schema", error))
          )
        );
      }
    ),
    paginate: dual(
      (args) => P.isString(args[0]),
      <R extends Rest.PaginatingRoute>(
        route: R,
        params: Rest.Params<R>,
        options?: PageOptions
      ): Effect.Effect<ReadonlyArray<Rest.Item<R>>, GitHubError> =>
        Stream.runCollect(paginateStream(route, params, options))
    ),
    paginateStream,
    graphql: dual(
      2,
      <A, V extends Record<string, unknown>>(
        document: GraphQLDocument<A, V>,
        variables: V
      ): Effect.Effect<A, GitHubGraphQLError> => {
        requested?.push(RecordedCall.make({ kind: "graphql", route: document.name, params: variables }));
        const raw = fixtures.graphql?.[document.name];
        return raw === undefined
          ? Effect.die(
              FixtureError.make({ message: `GitHubClient.layerFixture: no graphql fixture for ${document.name}` })
            )
          : document
              .decode(raw)
              .pipe(
                Effect.catchTag("SchemaError", (error) =>
                  Effect.fail(GitHubGraphQLError.decode(document.name, "fixture did not match its schema", error))
                )
              );
      }
    ),
    rateLimit: Effect.succeed(O.fromUndefinedOr(fixtures.rateLimit)),
  };
};
