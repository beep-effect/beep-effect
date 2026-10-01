/**
 * Scoped loopback server for native signed-cache conformance fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Ref } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import { Headers, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
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
const Tag = S.NonEmptyString.check(S.isMaxLength(256)).annotate(
  $I.annote("ArtifactTag", { description: "Bounded opaque artifact tag preserved by the fixture." })
);
class StoredArtifact extends S.Class<StoredArtifact>($I`StoredArtifact`)(
  { body: S.Uint8Array, digest: Sha256Hex, tag: Tag },
  $I.annote("StoredArtifact", { description: "Private opaque artifact bytes and tag held only by the fixture server." })
) {}

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
 * import { Effect } from "effect"
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
  const app = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const current = yield* Ref.get(scenario);
    const id = yield* Ref.updateAndGet(sequence, (n) => Math.min(n + 1, requestLimit + 1));
    const bearer = Headers.get(request.headers, "authorization");
    const role = O.contains(`Bearer ${Redacted.value(credentials.writer)}`)(bearer)
      ? "writer"
      : O.contains(`Bearer ${Redacted.value(credentials.reader)}`)(bearer)
        ? "reader"
        : "unknown";
    const reply = Effect.fn("CacheFixture.reply")(function* (
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
      });
      yield* Ref.update(events, (all) => (all.length < requestLimit + 1 ? A.append(all, event) : all));
      return HttpServerResponse.uint8Array(operation === "put" ? new Uint8Array() : body, {
        status,
        contentType: operation === "status" ? "application/json" : "application/octet-stream",
        headers: {
          "x-fixture-event": `${id}`,
          "x-artifact-duration": "0",
          ...R.getSomes({ "x-artifact-tag": tag }),
        },
      });
    });
    if (id > requestLimit) return yield* reply(429, "rejected");
    if (role === "unknown") return yield* reply(401, "rejected");
    // Avoid introducing additional URL normalization at this boundary.
    const parts = Str.split(request.url, "?");
    const pathname = O.getOrElse(A.head(parts), () => "");
    const query = new URLSearchParams(O.getOrElse(A.get(parts, 1), () => ""));
    const selectors = A.fromIterable(query.entries());
    if (
      parts.length !== 2 ||
      selectors.length !== 1 ||
      !A.every(selectors, ([name, value]) => name === "teamId" && value === credentials.namespace)
    )
      return yield* reply(403, "rejected");
    if (pathname === "/v8/artifacts/status" && request.method === "GET")
      return yield* reply(200, "status", O.none(), new TextEncoder().encode('{"status":"enabled"}'));
    if (pathname === "/v8/artifacts/events") return yield* reply(404, "events");
    if (pathname === "/v8/artifacts") return yield* reply(404, "batch");
    if (!Str.startsWith("/v8/artifacts/")(pathname)) return yield* reply(404, "rejected");
    const key = Str.slice("/v8/artifacts/".length)(pathname);
    if (!S.is(CacheFixtureArtifactKey)(key)) return yield* reply(400, "rejected");
    if (request.method === "PUT") {
      if (role !== "writer") return yield* reply(403, "put", O.some(key));
      if (!O.contains("application/octet-stream")(Headers.get(request.headers, "content-type")))
        return yield* reply(415, "put", O.some(key));
      const tag = Headers.get(request.headers, "x-artifact-tag");
      if (O.isNone(tag) || !S.is(Tag)(tag.value)) return yield* reply(400, "put", O.some(key));
      const body = yield* request.arrayBuffer.pipe(
        Effect.map((buffer) => O.some(new Uint8Array(buffer))),
        Effect.catchTag("HttpServerError", () => Effect.succeedNone)
      );
      if (O.isNone(body)) return yield* reply(400, "put", O.some(key));
      if (body.value.byteLength > bodyLimit) return yield* reply(413, "put", O.some(key));
      const stored = StoredArtifact.make({ body: body.value, digest: yield* hashBytes(body.value), tag: tag.value });
      const status = yield* Ref.modify(artifacts, (all) => {
        const prior = HashMap.get(all, key);
        if (O.isSome(prior))
          return [prior.value.digest === stored.digest && prior.value.tag === stored.tag ? 200 : 409, all];
        if (HashMap.size(all) >= objectLimit) return [429, all];
        return [200, HashMap.set(all, key, stored)];
      });
      return yield* reply(status, "put", O.some(key), stored.body, O.some(stored.tag));
    }
    if (request.method !== "GET" && request.method !== "HEAD") return yield* reply(405, "rejected", O.some(key));
    const operation = request.method === "GET" ? "get" : "head";
    if (current.fault === "unavailable") return yield* reply(503, operation, O.some(key));
    if (current.fault === "throttled") return yield* reply(429, operation, O.some(key));
    const stored = HashMap.get(yield* Ref.get(artifacts), key);
    if (O.isNone(stored)) return yield* reply(404, request.method === "GET" ? "get" : "head", O.some(key));
    // Truncate the transferred artifact, not the HTTP framing. Native clients
    // must reject the incomplete signed payload even after a complete response.
    const body = new Uint8Array(
      current.fault === "truncated-body"
        ? stored.value.body.subarray(0, Math.max(0, stored.value.body.byteLength - 1))
        : stored.value.body
    );
    if (current.fault === "corrupt-body" && body.byteLength > 0) body[0] = (body[0] ?? 0) ^ 1;
    const tag =
      current.fault === "missing-tag"
        ? O.none()
        : O.some(
            current.fault === "invalid-tag"
              ? `${Str.startsWith("A")(stored.value.tag) ? "B" : "A"}${Str.slice(1)(stored.value.tag)}`
              : stored.value.tag
          );
    return yield* reply(200, request.method === "GET" ? "get" : "head", O.some(key), body, tag);
  });
  const server = yield* BunHttpServer.make({ hostname: "127.0.0.1", port: 0, maxRequestBodySize: bodyLimit });
  yield* server.serve(app);
  return {
    url: HttpServer.formatAddress(server.address),
    events: Ref.get(events),
    setScenario: (value: CacheFixtureScenario) => Ref.set(scenario, value),
  };
}, CacheCommandError.mapError("Cannot run isolated cache protocol fixture."));
