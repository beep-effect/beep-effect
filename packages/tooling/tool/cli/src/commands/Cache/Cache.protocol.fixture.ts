/**
 * Scoped loopback server for native signed-cache conformance fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { O } from "@beep/utils";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Headers from "effect/http/Headers";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerError from "effect/http/HttpServerError";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Num from "effect/Number";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheFixtureArtifactKey, CacheFixtureEvent, CacheFixtureScenario } from "./Cache.protocol.fixture.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheFixtureCredentials } from "./Cache.protocol.fixture.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.protocol.fixture");
const bodyLimit = 2 * 1024 * 1024;
const requestLimit = 100;
const objectLimit = 16;
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const Tag = S.NonEmptyString.check(S.isMaxLength(256)).pipe(
  $I.annoteSchema("ArtifactTag", { description: "Bounded opaque artifact tag preserved by the fixture." })
);
class StoredArtifact extends S.Opaque<StoredArtifact, { readonly brand: unique symbol }>()(
  S.Struct({ body: S.Uint8Array, digest: Sha256Hex, tag: Tag }).pipe(
    $I.annoteSchema("StoredArtifact", {
      description: "Private opaque artifact bytes and tag held only by the fixture server.",
    })
  )
) {}

const fixtureRole = (credentials: CacheFixtureCredentials, bearer: O.Option<string>) =>
  HashMap.get(
    HashMap.make(
      [`Bearer ${Redacted.value(credentials.writer)}`, "writer" as const],
      [`Bearer ${Redacted.value(credentials.reader)}`, "reader" as const]
    ),
    O.getOrElse(bearer, () => "")
  ).pipe(O.getOrElse(() => "unknown" as const));

const validFixtureSelectors = (parts: ReadonlyArray<string>, namespace: string) => {
  const query = new URLSearchParams(O.getOrElse(A.get(parts, 1), () => ""));
  const selectors = A.fromIterable(query.entries());
  return (
    parts.length === 2 &&
    selectors.length === 1 &&
    A.every(selectors, ([name, value]) => name === "teamId" && value === namespace)
  );
};

/**
 * Copy artifact bytes with the first bit flipped; an empty body stays empty.
 *
 * **Example** (Corrupt one byte)
 * ```ts
 * import { corruptCacheArtifactBody } from "@beep/repo-cli/commands/Cache"
 * console.assert(corruptCacheArtifactBody(Uint8Array.of(0))[0] === 1)
 * ```
 *
 * @param bytes - Stored artifact bytes; left unchanged.
 * @returns A corrupted copy with the first bit flipped.
 * @category fixtures
 * @since 0.0.0
 */
export const corruptCacheArtifactBody = (bytes: Uint8Array) => {
  const body = new Uint8Array(bytes);
  if (body.byteLength > 0) {
    const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    view.setUint8(0, view.getUint8(0) ^ 1);
  }
  return body;
};

/**
 * Change the first character of an opaque artifact tag.
 *
 * **Example** (Tamper with a tag)
 * ```ts
 * import { tamperCacheArtifactTag } from "@beep/repo-cli/commands/Cache"
 * console.assert(tamperCacheArtifactTag("Abc") === "Bbc")
 * ```
 *
 * @param tag - Opaque artifact tag as stored.
 * @returns The tag with its first character changed.
 * @category fixtures
 * @since 0.0.0
 */
export const tamperCacheArtifactTag = (tag: string) => `${Str.startsWith("A")(tag) ? "B" : "A"}${Str.slice(1)(tag)}`;

// Truncate artifact bytes while retaining complete HTTP framing so the native
// client must reject the signed payload itself.
const readFaultBody = (stored: StoredArtifact, fault: CacheFixtureScenario["fault"]) =>
  fault === "corrupt-body"
    ? corruptCacheArtifactBody(stored.body)
    : new Uint8Array(
        fault === "truncated-body" ? stored.body.subarray(0, Math.max(0, stored.body.byteLength - 1)) : stored.body
      );

const readFaultTag = (stored: StoredArtifact, fault: CacheFixtureScenario["fault"]) =>
  fault === "missing-tag"
    ? O.none()
    : O.some(fault === "invalid-tag" ? tamperCacheArtifactTag(stored.tag) : stored.tag);

const fixtureHost = "127.0.0.1";
const AddressInUse = S.Struct({ code: S.tag("EADDRINUSE") }).pipe(
  $I.annoteSchema("AddressInUse", { description: "Socket bind failure eligible for a fresh ephemeral-port attempt." })
);
const bindFailure = (cause: unknown) => Effect.fail(new HttpServerError.ServeError({ cause }));

// Let the Node test shim deliver listen/error events without consulting Clock.
const awaitBindEvents = Effect.callback<void>((resume) => {
  const handle = setImmediate(() => resume(Effect.void));
  return Effect.sync(() => clearImmediate(handle));
});

const startFixtureServer = Effect.fn("CacheFixture.startServer")(function* <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  maxRequestBodySize: number
) {
  const server = yield* BunHttpServer.make({ port: 0, hostname: fixtureHost, maxRequestBodySize });
  // Node's Bun.serve test shim reports asynchronous listen errors at reload.
  yield* awaitBindEvents;
  yield* server.serve(app);
  return server;
});

const makeFixtureServer = Effect.fn("CacheFixture.makeServer")(
  <E, R>(app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>, maxRequestBodySize: number) =>
    startFixtureServer(app, maxRequestBodySize).pipe(
      Effect.catchDefect(bindFailure),
      Effect.retry({ times: 8, while: (error) => S.is(AddressInUse)(error.cause) })
    )
);

/**
 * Serve an HTTP app on an ephemeral 127.0.0.1 port for the caller's scope and return its URL.
 *
 * **Details**
 * A bind that loses an ephemeral-port race (`EADDRINUSE`) retries on a fresh
 * port, so concurrent fixtures and fault proxies never share a listener.
 *
 * **Example** (Reference the loopback server)
 * ```ts
 * import { serveCacheLoopback } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof serveCacheLoopback === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const serveCacheLoopback = Effect.fn("Cache.serveLoopback")(function* <E, R>(
  app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  maxRequestBodySize: number
) {
  const server = yield* makeFixtureServer(app, maxRequestBodySize);
  return HttpServer.formatAddress(server.address);
});

const readFixtureBody = Effect.fn("CacheFixture.readBody")(function* (request: HttpServerRequest.HttpServerRequest) {
  const contentLength = Headers.get(request.headers, "content-length").pipe(O.flatMap(Num.parse));
  if (O.exists(contentLength, Num.isGreaterThan(bodyLimit))) return Result.fail(413);
  const body = yield* request.arrayBuffer.pipe(Effect.result);
  if (Result.isFailure(body)) return Result.fail(400);
  const bytes = new Uint8Array(body.success);
  return bytes.byteLength > bodyLimit ? Result.fail(413) : Result.succeed(bytes);
});

/**
 * Start a bounded local fixture whose lifetime is owned by the caller's scope.
 *
 * **Details**
 * Tags are opaque: the server never receives an artifact signing key. Distinct
 * HTTP capabilities authorize writes; repeated identical writes are idempotent,
 * while conflicting writes fail atomically. The returned events contain only
 * sanitized metadata. Callers must still isolate readers and protect receipts.
 * This server itself establishes no qualification or production trust authority.
 *
 * **Example** (Scope a fixture)
 * ```ts
 * import { CacheFixtureCredentials, makeCacheProtocolFixture } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted"
 * const fixture = makeCacheProtocolFixture(CacheFixtureCredentials.make({
 *   namespace: "team_example", reader: Redacted.make("read-only"), writer: Redacted.make("write-only")
 * })).pipe(Effect.scoped)
 * console.assert(typeof fixture === "object")
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const makeCacheProtocolFixture = Effect.fn("Cache.makeProtocolFixture")(function* (
  credentials: CacheFixtureCredentials
) {
  if (Redacted.value(credentials.reader) === Redacted.value(credentials.writer))
    return yield* CacheCommandError.new("Fixture reader and writer capabilities must differ.");
  const artifacts = yield* Ref.make(HashMap.empty<string, StoredArtifact>());
  const events = yield* Ref.make(A.empty<CacheFixtureEvent>());
  const sequence = yield* Ref.make(0);
  const scenario = yield* Ref.make(CacheFixtureScenario.make({ id: "initial", fault: "none" }));
  const makeReply = (
    id: number,
    current: CacheFixtureScenario,
    role: CacheFixtureEvent["role"],
    requestTag: O.Option<string>
  ) =>
    Effect.fn("CacheFixture.reply")(function* (
      status: number,
      operation: CacheFixtureEvent["operation"],
      artifact: O.Option<string> = O.none(),
      body = new Uint8Array(),
      tag: O.Option<string> = O.none()
    ) {
      const event = CacheFixtureEvent.make({
        sequence: S.Natural.make(id),
        scenario: current,
        operation,
        role,
        status,
        artifact,
        digest: O.isSome(artifact) && status === 200 ? O.some(yield* hashBytes(body)) : O.none(),
        bytes: S.Natural.make(body.byteLength),
        tagPresent: O.isSome(tag),
        requestTagSha256: O.isSome(requestTag)
          ? O.some(yield* hashBytes(new TextEncoder().encode(requestTag.value)))
          : O.none(),
      });
      yield* Ref.update(events, (all) => (all.length < requestLimit + 1 ? A.append(all, event) : all));
      return HttpServerResponse.uint8Array(operation === "put" ? new Uint8Array() : body, {
        status,
        contentType: operation === "status" ? "application/json" : "application/octet-stream",
        headers: {
          "x-fixture-event": `${id}`,
          "x-artifact-duration": "0",
          ...O.getSomesStruct({ "x-artifact-tag": tag }),
        },
      });
    });
  const putArtifact = Effect.fn("CacheFixture.putArtifact")(function* (
    request: HttpServerRequest.HttpServerRequest,
    key: string,
    role: CacheFixtureEvent["role"],
    reply: ReturnType<typeof makeReply>
  ) {
    if (role !== "writer") return yield* reply(403, "put", O.some(key));
    if (!O.contains("application/octet-stream")(Headers.get(request.headers, "content-type")))
      return yield* reply(415, "put", O.some(key));
    const tag = Headers.get(request.headers, "x-artifact-tag");
    if (O.isNone(tag) || !S.is(Tag)(tag.value)) return yield* reply(400, "put", O.some(key));
    const body = yield* readFixtureBody(request);
    if (Result.isFailure(body)) return yield* reply(body.failure, "put", O.some(key));
    const bytes = body.success;
    const stored = StoredArtifact.make({ body: bytes, digest: yield* hashBytes(bytes), tag: tag.value });
    const status = yield* Ref.modify(artifacts, (all) => {
      const prior = HashMap.get(all, key);
      if (O.isSome(prior))
        return [prior.value.digest === stored.digest && prior.value.tag === stored.tag ? 200 : 409, all];
      if (HashMap.size(all) >= objectLimit) return [429, all];
      return [200, HashMap.set(all, key, stored)];
    });
    return yield* reply(status, "put", O.some(key), stored.body, O.some(stored.tag));
  });
  const readArtifact = Effect.fn("CacheFixture.readArtifact")(function* (
    request: HttpServerRequest.HttpServerRequest,
    key: string,
    current: CacheFixtureScenario,
    reply: ReturnType<typeof makeReply>
  ) {
    if (request.method !== "GET" && request.method !== "HEAD") return yield* reply(405, "rejected", O.some(key));
    const operation = request.method === "GET" ? "get" : "head";
    if (current.fault === "unavailable") return yield* reply(503, operation, O.some(key));
    if (current.fault === "throttled") return yield* reply(429, operation, O.some(key));
    const stored = HashMap.get(yield* Ref.get(artifacts), key);
    if (O.isNone(stored)) return yield* reply(404, operation, O.some(key));
    const body = readFaultBody(stored.value, current.fault);
    const tag = readFaultTag(stored.value, current.fault);
    return yield* reply(200, operation, O.some(key), body, tag);
  });
  const routeRequest = Effect.fn("CacheFixture.routeRequest")(function* (
    request: HttpServerRequest.HttpServerRequest,
    role: CacheFixtureEvent["role"],
    current: CacheFixtureScenario,
    reply: ReturnType<typeof makeReply>
  ) {
    // Avoid introducing additional URL normalization at this boundary.
    const parts = Str.split(request.url, "?");
    const pathname = A.head(parts).pipe(O.getOrThrow);
    if (!validFixtureSelectors(parts, credentials.namespace)) return yield* reply(403, "rejected");
    if (pathname === "/v8/artifacts/status" && request.method === "GET")
      return yield* reply(200, "status", O.none(), new TextEncoder().encode('{"status":"enabled"}'));
    if (pathname === "/v8/artifacts/events") return yield* reply(404, "events");
    if (pathname === "/v8/artifacts") return yield* reply(404, "batch");
    if (!Str.startsWith("/v8/artifacts/")(pathname)) return yield* reply(404, "rejected");
    const key = Str.slice("/v8/artifacts/".length)(pathname);
    if (!S.is(CacheFixtureArtifactKey)(key)) return yield* reply(400, "rejected");
    return yield* request.method === "PUT"
      ? putArtifact(request, key, role, reply)
      : readArtifact(request, key, current, reply);
  });
  const app = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const current = yield* Ref.get(scenario);
    const id = yield* Ref.updateAndGet(sequence, (n) => Math.min(n + 1, requestLimit + 1));
    const bearer = Headers.get(request.headers, "authorization");
    const role = fixtureRole(credentials, bearer);
    const reply = makeReply(id, current, role, Headers.get(request.headers, "x-artifact-tag"));
    if (id > requestLimit) return yield* reply(429, "rejected");
    if (role === "unknown") return yield* reply(401, "rejected");
    return yield* routeRequest(request, role, current, reply);
  });
  return {
    url: yield* serveCacheLoopback(app, bodyLimit),
    events: Ref.get(events),
    // Supervisor-only observation; HTTP readers cannot access this capability.
    artifactBytes: (key: CacheFixtureArtifactKey) =>
      Ref.get(artifacts).pipe(
        Effect.flatMap((all) =>
          HashMap.get(all, key).pipe(
            Effect.fromOption(() => CacheCommandError.new("Requested fixture artifact has not been uploaded."))
          )
        ),
        Effect.map((artifact) => new Uint8Array(artifact.body))
      ),
    setScenario: (value: CacheFixtureScenario) => Ref.set(scenario, value),
  };
}, CacheCommandError.mapError("Cannot run isolated cache protocol fixture."));
