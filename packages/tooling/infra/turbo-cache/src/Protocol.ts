/**
 * The Turborepo remote-cache HTTP protocol (`/v8/artifacts`) over an R2 bucket,
 * with the cache policy applied before any storage access.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraTurboCacheId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Access, ArtifactHash, PrincipalName, permits, TeamSlug } from "./CachePolicy.ts";
import type { ObjectBody, PutOptions, R2Error, R2Object } from "@alchemy.run/cloudflare/R2/BucketTypes";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import type { ArtifactOperation } from "./CachePolicy.ts";

const $I = $InfraTurboCacheId.create("Protocol");

/**
 * One token the Worker accepts: whose it is and what it may do. `token` is an
 * effect because the Worker reads its bound secret at request time.
 *
 * **Example** (Accept a reader credential)
 *
 * ```ts
 * import { Credential } from "@beep/infra-turbo-cache/Protocol"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 *
 * const reader = Credential.make({ team: "beep", principal: "ci-pr", access: "read", token: Effect.succeed(Redacted.make("x")) })
 * console.log(S.is(Credential)(reader)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Credential extends S.Opaque<Credential, { readonly brand: unique symbol }>()(
  S.Struct({
    team: TeamSlug,
    principal: PrincipalName,
    access: Access,
    token: S.declare<Effect.Effect<Redacted.Redacted<string>>>(
      (input: unknown): input is Effect.Effect<Redacted.Redacted<string>> => Effect.isEffect(input)
    ),
  }).pipe($I.annoteSchema("Credential", { description: "One accepted cache token: team, principal, access class." }))
) {}

/**
 * The bucket operations the protocol needs, with the services they require
 * as a parameter: the Worker's R2 client needs Alchemy's `RuntimeContext`, a
 * test double needs nothing.
 *
 * @category models
 * @since 0.0.0
 */
export interface Storage<R = RuntimeContext> {
  readonly get: (key: string) => Effect.Effect<ObjectBody | null, R2Error, R>;
  readonly head: (key: string) => Effect.Effect<R2Object | null, R2Error, R>;
  readonly put: (
    key: string,
    value: ReadableStream | null,
    options?: PutOptions
  ) => Effect.Effect<R2Object, R2Error, R>;
}

type NativeComparison = (a: ArrayBuffer, b: ArrayBuffer) => boolean;

// Workers ship `crypto.subtle.timingSafeEqual`; decoding it once keeps the
// comparison constant-time and fails loudly on a runtime without it.
const NativeCrypto = S.Struct({
  timingSafeEqual: S.declare<NativeComparison>((input: unknown): input is NativeComparison => P.isFunction(input)),
});

class InvalidQueryBody extends S.TaggedError<InvalidQueryBody, { readonly brand: unique symbol }>($I`InvalidQueryBody`)(
  "InvalidQueryBody",
  {},
  $I.annoteError<InvalidQueryBody>("InvalidQueryBody", { description: "The artifact query body is not JSON." })
) {}

const QueryBody = S.Struct({ hashes: S.Array(ArtifactHash) });

const isTeamSlug = S.is(TeamSlug);

/**
 * The protocol endpoint a request addresses; `missing` is everything else.
 *
 * **Example** (Make an artifact route)
 *
 * ```ts
 * import { Route } from "@beep/infra-turbo-cache/Protocol"
 *
 * console.log(Route.cases.artifact.make({ hash: "abc" })._tag) // "artifact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Route = S.TaggedUnion({
  status: {},
  events: {},
  query: {},
  artifact: { hash: ArtifactHash },
  missing: {},
}).pipe($I.annoteSchema("Route", { description: "The cache protocol endpoint a request addresses." }));

/**
 * Runtime type for {@link Route}.
 *
 * @category models
 * @since 0.0.0
 */
export type Route = typeof Route.Type;

const noStore = { "cache-control": "no-store" } as const;

const digest = (value: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));

const refusal = (status: number) => new Response(null, { headers: noStore, status });

const denial = (code: string, message: string) =>
  Response.json({ error: { code, message } }, { headers: noStore, status: 403 });

const forbidden = () => denial("forbidden", "The credential does not authorize this team.");

const readOnly = () => denial("read_only", "The credential may read this team's artifacts but not upload them.");

const artifactResponse = (hit: R2Object, body: ReadableStream | null) => {
  const headers = new Headers({
    ...noStore,
    "content-length": `${hit.size}`,
    "content-type": "application/octet-stream",
    "x-artifact-duration": hit.customMetadata?.duration ?? "0",
  });
  O.map(O.fromNullishOr(hit.customMetadata?.tag), (tag) => headers.set("x-artifact-tag", tag));
  return new Response(body, { headers });
};

const bearerOf = (request: Request): O.Option<string> =>
  O.fromNullishOr(request.headers.get("authorization")).pipe(
    O.flatMapNullishOr((header) => /^Bearer (?<token>.+)$/u.exec(header)?.groups?.token)
  );

const authenticate = Effect.fn("TurboCache.authenticate")(function* (
  request: Request,
  credentials: ReadonlyArray<Credential>
) {
  const native = yield* S.decodeUnknownEffect(NativeCrypto)(crypto.subtle).pipe(Effect.orDie);
  const bearer = bearerOf(request);
  // Digest even an absent bearer and compare against every credential, so the
  // time a refusal takes does not reveal which teams or tokens exist.
  const presented = yield* digest(O.getOrElse(bearer, () => ""));
  const matches = yield* Effect.forEach(credentials, (credential) =>
    credential.token.pipe(
      Effect.flatMap((value) => value.pipe(Redacted.value, digest)),
      Effect.map((expected) => ({
        credential,
        matches: native.timingSafeEqual.call(crypto.subtle, expected, presented),
      }))
    )
  );
  return O.isNone(bearer)
    ? O.none<Credential>()
    : O.map(
        A.findFirst(matches, ({ matches }) => matches),
        ({ credential }) => credential
      );
});

const queryArtifacts = Effect.fn("TurboCache.query")(function* <R>(
  request: Request,
  bucket: Storage<R>,
  team: TeamSlug
) {
  const parsed = yield* Effect.tryPromise({
    catch: () => InvalidQueryBody.make({}),
    try: () => request.json(),
  }).pipe(Effect.flatMap(S.decodeUnknownEffect(QueryBody)), Effect.option);

  if (O.isNone(parsed)) {
    return refusal(400);
  }

  const hits = yield* Effect.forEach(parsed.value.hashes, (hash) =>
    bucket
      .head(`${team}/${hash}`)
      .pipe(
        Effect.map(
          (hit) =>
            [
              hash,
              hit === null ? null : { size: hit.size, taskDurationMs: Number(hit.customMetadata?.duration ?? "0") },
            ] as const
        )
      )
  );

  return Response.json(R.fromEntries(hits), { headers: noStore });
});

const digits = /^\d+$/u;

const putArtifact = Effect.fn("TurboCache.put")(function* <R>(request: Request, bucket: Storage<R>, key: string) {
  const length = O.fromNullishOr(request.headers.get("content-length"));
  const duration = request.headers.get("x-artifact-duration") ?? "0";
  const tag = O.fromNullishOr(request.headers.get("x-artifact-tag"));

  if (O.isNone(length) || !digits.test(length.value) || !digits.test(duration)) {
    return refusal(400);
  }

  yield* bucket.put(key, request.body, {
    customMetadata: O.match(tag, { onNone: () => ({ duration }), onSome: (value) => ({ duration, tag: value }) }),
    httpMetadata: { contentType: "application/octet-stream" },
  });

  return refusal(200);
});

const readArtifact = Effect.fn("TurboCache.read")(function* <R>(request: Request, bucket: Storage<R>, key: string) {
  if (request.method === "HEAD") {
    const hit = yield* bucket.head(key);
    return hit === null ? refusal(404) : artifactResponse(hit, null);
  }
  const hit = yield* bucket.get(key);
  return hit === null ? refusal(404) : artifactResponse(hit, hit.readable ?? null);
});

const artifactMethods = ["GET", "HEAD", "PUT"];

/**
 * Classify a request by its method and path; anything outside the protocol is
 * `missing` and never reaches authentication.
 *
 * **Example** (Route an artifact upload)
 *
 * ```ts
 * import { routeFor } from "@beep/infra-turbo-cache/Protocol"
 *
 * const route = routeFor(new Request("https://cache.example.test/v8/artifacts/abc?slug=beep", { method: "PUT" }))
 * console.log(route._tag) // "artifact"
 * ```
 *
 * @param request - The incoming web request.
 * @returns The addressed endpoint, or `missing`.
 *
 * @category utilities
 * @since 0.0.0
 */
export const routeFor = (request: Request): Route => {
  const { pathname } = new URL(request.url);
  const method = request.method;
  if (pathname === "/v8/artifacts/status" && method === "GET") return Route.cases.status.make({});
  if (pathname === "/v8/artifacts/events" && method === "POST") return Route.cases.events.make({});
  if (pathname === "/v8/artifacts" && method === "POST") return Route.cases.query.make({});
  const hash = /^\/v8\/artifacts\/(?<hash>[a-zA-Z0-9_-]+)$/u.exec(pathname)?.groups?.hash;
  return hash === undefined || hash === "status" || hash === "events" || !A.contains(artifactMethods, method)
    ? Route.cases.missing.make({})
    : Route.cases.artifact.make({ hash });
};

/**
 * The policy operation a routed request performs.
 *
 * **Example** (Classify an upload)
 *
 * ```ts
 * import { operationOf, routeFor } from "@beep/infra-turbo-cache/Protocol"
 *
 * const request = new Request("https://cache.example.test/v8/artifacts/abc?slug=beep", { method: "PUT" })
 * const route = routeFor(request)
 * console.log(route._tag === "missing" ? "missing" : operationOf(route, request.method)) // "upload"
 * ```
 *
 * @returns The route's policy operation.
 *
 * @category utilities
 * @since 0.0.0
 */
export const operationOf: {
  (method: string): (route: Exclude<Route, { readonly _tag: "missing" }>) => ArtifactOperation;
  (route: Exclude<Route, { readonly _tag: "missing" }>, method: string): ArtifactOperation;
} = dual(
  2,
  (route: Exclude<Route, { readonly _tag: "missing" }>, method: string): ArtifactOperation =>
    Match.value(route).pipe(
      Match.tagsExhaustive({
        status: (): ArtifactOperation => "status",
        events: (): ArtifactOperation => "events",
        query: (): ArtifactOperation => "query",
        artifact: (): ArtifactOperation => (method === "PUT" ? "upload" : "download"),
      })
    )
);

/**
 * Options for {@link artifactHandler}.
 *
 * @category models
 * @since 0.0.0
 */
export interface ArtifactHandlerOptions<R = RuntimeContext> {
  readonly bucket: Storage<R>;
  readonly credentials: ReadonlyArray<Credential>;
}

/**
 * Serve one Turborepo cache request.
 *
 * **Details**
 *
 * Order matters: an unknown route is `404` before authentication; a missing or
 * unknown bearer is `401`; a token of another team, a repeated or invalid
 * `slug`, or any `teamId` is `403 forbidden`; a `read` token asking to upload
 * is `403 read_only`. Only then does the request touch the bucket, under the
 * `<team>/<hash>` key.
 *
 * **Example** (Refuse an anonymous request before storage)
 *
 * ```ts
 * import { artifactHandler } from "@beep/infra-turbo-cache/Protocol"
 * import * as Effect from "effect/Effect"
 *
 * const untouched = () => Effect.die("storage must not be reached")
 * const handle = artifactHandler({ bucket: { get: untouched, head: untouched, put: untouched }, credentials: [] })
 * const status = handle(new Request("https://cache.example.test/v8/artifacts/abc?slug=beep")).pipe(
 *   Effect.map((response) => response.status)
 * )
 * console.log(Effect.isEffect(status)) // true
 * ```
 *
 * @returns A handler from a web request to the response it serves.
 *
 * @category constructors
 * @since 0.0.0
 */
export const artifactHandler = <R>({ bucket, credentials }: ArtifactHandlerOptions<R>) =>
  Effect.fn("TurboCache.request")(function* (request: Request) {
    const route = routeFor(request);
    if (route._tag === "missing") {
      return refusal(404);
    }

    const credential = yield* authenticate(request, credentials);
    if (O.isNone(credential)) {
      return refusal(401);
    }

    const url = new URL(request.url);
    const slugs = url.searchParams.getAll("slug");
    const team = A.head(slugs);
    if (
      slugs.length !== 1 ||
      O.isNone(team) ||
      !isTeamSlug(team.value) ||
      !Str.Equivalence(credential.value.team, team.value) ||
      url.searchParams.has("teamId")
    ) {
      return forbidden();
    }

    const operation = operationOf(route, request.method);
    if (!permits(credential.value.access, operation)) {
      return readOnly();
    }

    const slug = credential.value.team;
    return yield* Match.value(route).pipe(
      Match.tagsExhaustive({
        status: () => Effect.succeed(Response.json({ status: "enabled" }, { headers: noStore })),
        events: () => Effect.succeed(refusal(204)),
        query: () => queryArtifacts(request, bucket, slug),
        artifact: ({ hash }) =>
          request.method === "PUT"
            ? putArtifact(request, bucket, `${slug}/${hash}`)
            : readArtifact(request, bucket, `${slug}/${hash}`),
      })
    );
  });
