import {
  CacheFixtureCredentials,
  CacheFixtureEvent,
  CacheFixtureScenario,
  makeCacheProtocolFixture,
} from "@beep/repo-cli/commands/Cache";
import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, notDeepStrictEqual } from "@effect/vitest/utils";
import { Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import { FetchHttpClient, Headers, HttpClient, HttpClientRequest } from "effect/http";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const FixtureEventsJson = CacheFixtureEvent.pipe(S.Array, S.fromJsonString);

const reader = "fixture-reader-only";
const writer = "fixture-writer-only";
const credentials = CacheFixtureCredentials.make({
  namespace: "team_protocol_fixture",
  reader: Redacted.make(reader),
  writer: Redacted.make(writer),
});
const artifactHash = "0123456789abcdef";
const otherArtifactHash = "abcdef0123456789";
const tag = "opaque-fixture-tag";
const ReadFault = CacheFixtureScenario.fields.fault.pick(["missing-tag", "invalid-tag", "corrupt-body", "none"]);
const bytes = new TextEncoder().encode("complete fixture artifact");
const endpoint = (url: string, hash = artifactHash) => `${url}/v8/artifacts/${hash}?teamId=${credentials.namespace}`;
const get = (url: string) => HttpClient.get(url, { headers: { authorization: `Bearer ${reader}` } });
const put = (url: string, body = bytes, capability = writer, signature = tag) =>
  HttpClientRequest.put(url).pipe(
    HttpClientRequest.setHeaders({ authorization: `Bearer ${capability}`, "x-artifact-tag": signature }),
    HttpClientRequest.bodyUint8Array(body),
    HttpClient.execute
  );

it.layer(Layer.mergeAll(NodeCrypto.layer, FetchHttpClient.layer), { timeout: "20 seconds" })(
  "native protocol fixture server",
  (it) => {
    it.effect("returns supervisor copies without mutating stored bytes or adding wire events", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        (yield* fixture.artifactBytes(artifactHash).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        const uploaded = yield* put(endpoint(fixture.url));
        yield* uploaded.text;
        const before = yield* fixture.events;
        const copy = yield* fixture.artifactBytes(artifactHash);
        copy[0] = 0;
        expect(yield* fixture.artifactBytes(artifactHash)).toEqual(bytes);
        expect(yield* fixture.events).toEqual(before);
        const downloaded = yield* get(endpoint(fixture.url));
        expect(new Uint8Array(yield* downloaded.arrayBuffer)).toEqual(bytes);
      })
    );
    it.effect("round trips opaque bytes and tags, including zero-byte objects", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        const status = yield* get(`${fixture.url}/v8/artifacts/status?teamId=${credentials.namespace}`);
        expect(status.status).toBe(200);
        assertSome(Headers.get(status.headers, "content-type"), "application/json");
        yield* status.text;
        for (const [hash, body] of [
          [artifactHash, bytes],
          [otherArtifactHash, new Uint8Array()],
        ] satisfies ReadonlyArray<readonly [string, Uint8Array]>) {
          const uploaded = yield* put(endpoint(fixture.url, hash), body);
          expect(uploaded.status).toBe(200);
          expect(yield* uploaded.text).toBe("");
          const downloaded = yield* get(endpoint(fixture.url, hash));
          expect(new Uint8Array(yield* downloaded.arrayBuffer)).toEqual(body);
          assertSome(Headers.get(downloaded.headers, "x-artifact-tag"), tag);
          const head = yield* HttpClient.head(endpoint(fixture.url, hash), {
            headers: { authorization: `Bearer ${reader}` },
          });
          expect(head.status).toBe(200);
          expect((yield* head.arrayBuffer).byteLength).toBe(0);
          assertSome(Headers.get(head.headers, "content-length"), `${body.byteLength}`);
        }
      })
    );

    it.effect("labels unsupported optional events and batch routes explicitly", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        for (const route of ["/v8/artifacts/events", "/v8/artifacts"]) {
          const response = yield* HttpClient.post(`${fixture.url}${route}?teamId=${credentials.namespace}`, {
            headers: { authorization: `Bearer ${reader}` },
          });
          expect(response.status).toBe(404);
        }
        expect(A.map(yield* fixture.events, (event) => event.operation)).toEqual(["events", "batch"]);
      })
    );

    it.effect("denies reader writes, unknown bearers and namespace selection without changing storage", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        yield* put(endpoint(fixture.url));
        expect((yield* put(endpoint(fixture.url), bytes, reader)).status).toBe(403);
        expect((yield* put(endpoint(fixture.url), bytes, "unknown-fixture-bearer")).status).toBe(401);
        expect((yield* HttpClient.get(endpoint(fixture.url))).status).toBe(401);
        for (const query of [
          "teamId=other",
          "teamId=",
          `teamId=${credentials.namespace}&teamId=${credentials.namespace}`,
          `teamId=${credentials.namespace}&slug=other`,
        ])
          expect((yield* get(`${fixture.url}/v8/artifacts/${artifactHash}?${query}`)).status).toBe(403);
        const restored = yield* get(endpoint(fixture.url));
        expect(new Uint8Array(yield* restored.arrayBuffer)).toEqual(bytes);
      })
    );

    it.effect("distinguishes misses, malformed keys and absent upload tags", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        expect((yield* get(endpoint(fixture.url))).status).toBe(404);
        for (const hash of ["", "not-a-hash", "%252e%252e", Str.repeat(129)("a")])
          expect((yield* get(endpoint(fixture.url, hash))).status).toBe(400);
        expect((yield* put(endpoint(fixture.url), bytes, writer, "")).status).toBe(400);
        expect((yield* get(endpoint(fixture.url))).status).toBe(404);
      })
    );

    it.effect("accepts identical retries and atomically rejects conflicting concurrent writes", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        const first = new TextEncoder().encode("first complete object");
        const second = new TextEncoder().encode("second complete object");
        const uploaded = yield* Effect.all([put(endpoint(fixture.url), first), put(endpoint(fixture.url), second)], {
          concurrency: 2,
        });
        expect(A.filter(uploaded, (r) => r.status === 200)).toHaveLength(1);
        expect(A.filter(uploaded, (r) => r.status === 409)).toHaveLength(1);
        const downloaded = yield* get(endpoint(fixture.url));
        const winner = new Uint8Array(yield* downloaded.arrayBuffer);
        expect(winner).toEqual(A.getUnsafe(uploaded, 0).status === 200 ? first : second);
        expect((yield* put(endpoint(fixture.url), winner)).status).toBe(200);
        expect((yield* put(endpoint(fixture.url), winner, writer, "different-tag")).status).toBe(409);
      })
    );

    it.effect("injects read faults without modifying the stored object", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        yield* put(endpoint(fixture.url));
        for (const fault of ReadFault.literals) {
          yield* fixture.setScenario(CacheFixtureScenario.make({ id: fault, fault }));
          const response = yield* get(endpoint(fixture.url));
          const body = new Uint8Array(yield* response.arrayBuffer);
          expect(response.status).toBe(200);
          expect(body.byteLength).toBe(bytes.byteLength);
          if (fault === "corrupt-body") expect(body).not.toEqual(bytes);
          else expect(body).toEqual(bytes);
          const responseTag = Headers.get(response.headers, "x-artifact-tag");
          const expectTag = () => assertSome(responseTag, tag);
          Match.value(fault).pipe(
            Match.when("missing-tag", () => assertNone(responseTag)),
            Match.when("invalid-tag", () => notDeepStrictEqual(responseTag, O.some(tag))),
            Match.orElse(expectTag)
          );
        }
        const events = yield* fixture.events;
        const encoded = yield* S.encodeEffect(FixtureEventsJson)(events);
        expect(yield* S.decodeEffect(FixtureEventsJson)(encoded)).toEqual(events);
        for (const secret of [reader, writer, tag, "complete fixture artifact"]) expect(encoded).not.toContain(secret);
        expect(events).toHaveLength(5);
        expect(A.map(events, (event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
      })
    );

    it.effect("distinguishes unavailable and throttled reads from misses without changing storage", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        yield* put(endpoint(fixture.url));
        for (const fault of ["unavailable", "throttled"] as const) {
          yield* fixture.setScenario(CacheFixtureScenario.make({ id: fault, fault }));
          for (const hash of [artifactHash, otherArtifactHash]) {
            const read = yield* get(endpoint(fixture.url, hash));
            const head = yield* HttpClient.head(endpoint(fixture.url, hash), {
              headers: { authorization: `Bearer ${reader}` },
            });
            expect(read.status).toBe(fault === "unavailable" ? 503 : 429);
            expect(head.status).toBe(read.status);
            expect((yield* read.arrayBuffer).byteLength).toBe(0);
            assertNone(Headers.get(read.headers, "x-artifact-tag"));
          }
          // Failure injection cannot bypass authorization or namespace checks.
          expect((yield* HttpClient.get(endpoint(fixture.url))).status).toBe(401);
          expect((yield* get(`${fixture.url}/v8/artifacts/${artifactHash}?teamId=foreign`)).status).toBe(403);
        }
        yield* fixture.setScenario(CacheFixtureScenario.make({ id: "recovery", fault: "none" }));
        const recovered = yield* get(endpoint(fixture.url));
        expect(new Uint8Array(yield* recovered.arrayBuffer)).toEqual(bytes);
        expect((yield* get(endpoint(fixture.url, otherArtifactHash))).status).toBe(404);
        const failures = A.filter(yield* fixture.events, (event) => event.status === 429 || event.status === 503);
        expect(failures).toHaveLength(8);
        assertTrue(A.every(failures, (event) => O.isNone(event.digest) && event.bytes === 0 && !event.tagPresent));
      })
    );

    it.effect("truncates transferred bytes while preserving opaque tags and the complete stored object", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        yield* put(endpoint(fixture.url));
        yield* put(endpoint(fixture.url, otherArtifactHash), new Uint8Array());
        yield* fixture.setScenario(CacheFixtureScenario.make({ id: "truncated", fault: "truncated-body" }));
        const response = yield* get(endpoint(fixture.url));
        expect(response.status).toBe(200);
        expect(new Uint8Array(yield* response.arrayBuffer)).toEqual(bytes.subarray(0, bytes.byteLength - 1));
        assertSome(Headers.get(response.headers, "x-artifact-tag"), tag);
        const empty = yield* get(endpoint(fixture.url, otherArtifactHash));
        expect((yield* empty.arrayBuffer).byteLength).toBe(0);
        yield* fixture.setScenario(CacheFixtureScenario.make({ id: "recovery", fault: "none" }));
        const recovered = yield* get(endpoint(fixture.url));
        expect(new Uint8Array(yield* recovered.arrayBuffer)).toEqual(bytes);
        const events = yield* fixture.events;
        expect(A.getUnsafe(events, 2).digest).not.toEqual(A.getUnsafe(events, 0).digest);
        expect(A.getUnsafe(events, 4).digest).toEqual(A.getUnsafe(events, 0).digest);
      })
    );

    it.effect("bounds request evidence and refuses further work", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        const responses = yield* Effect.forEach(A.range(1, 102), () => get(endpoint(fixture.url)), { concurrency: 4 });
        expect(A.filter(responses, (r) => r.status === 404)).toHaveLength(100);
        expect(A.filter(responses, (r) => r.status === 429)).toHaveLength(2);
        expect(yield* fixture.events).toHaveLength(101);
      })
    );

    it.effect("rejects oversized uploads without replacing prior bytes", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        yield* put(endpoint(fixture.url));
        const rejected = yield* put(endpoint(fixture.url), new Uint8Array(2 * 1024 * 1024 + 1));
        expect(rejected.status).toBe(413);
        const restored = yield* get(endpoint(fixture.url));
        expect(new Uint8Array(yield* restored.arrayBuffer)).toEqual(bytes);
      })
    );

    it.effect("caps stored objects and rejects incorrect upload content type", () =>
      Effect.gen(function* () {
        const fixture = yield* makeCacheProtocolFixture(credentials);
        const wrongType = yield* HttpClientRequest.put(endpoint(fixture.url)).pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${writer}`, "x-artifact-tag": tag }),
          HttpClientRequest.bodyText("not an artifact"),
          HttpClient.execute
        );
        expect(wrongType.status).toBe(415);
        const responses = yield* Effect.forEach(
          A.range(0, 16),
          (n) => put(endpoint(fixture.url, `0123456789abcdef${n}`)),
          { concurrency: 2 }
        );
        expect(A.filter(responses, (r) => r.status === 200)).toHaveLength(16);
        expect(A.filter(responses, (r) => r.status === 429)).toHaveLength(1);
      })
    );

    it.effect("refuses overlapping capabilities and releases the listening socket with its scope", () =>
      Effect.gen(function* () {
        const duplicate = CacheFixtureCredentials.make({ ...credentials, writer: credentials.reader });
        (yield* makeCacheProtocolFixture(duplicate).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
        const url = yield* makeCacheProtocolFixture(credentials).pipe(
          Effect.map((fixture) => fixture.url),
          Effect.scoped
        );
        (yield* get(endpoint(url)).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      })
    );
  }
);
