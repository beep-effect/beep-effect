import * as Zlib from "node:zlib";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import { makeNativeHttpIntake, NativeHttpPolicy, renderNativeHttpMetrics } from "@beep/repo-ai-metrics/native-http";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as Protobuf from "protobufjs";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const fixture = Effect.fn("NativeHttpTest.fixture")(function* (maxPages = 16, bodyTimeoutMillis = 2000) {
  const salt = "synthetic-native-http-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const intake = yield* makeNativeHttpIntake(
    config,
    NativeHttpPolicy.make({
      routeId: Sha256Hex.make(Str.repeat(64)("b")),
      hashSalt: Redacted.make(salt),
      approvedModels: [],
      usageConvention: "claude-code",
      bodyTimeoutMillis,
    })
  );
  const context = yield* Layer.build(Layer.fresh(NodeHttpServer.layerTest));
  const server = Context.get(context, HttpServer.HttpServer);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  yield* server.serve(intake.handler);
  const url = `${HttpServer.formatAddress(server.address)}/v1/traces`;
  const post = Effect.fn("NativeHttpTest.post")(function* (
    body: string | Uint8Array = "{}",
    contentType = "application/json",
    encoding = "identity",
    path = url,
    method: "GET" | "POST" = "POST"
  ) {
    const request = HttpClientRequest.make(method)(path).pipe(
      HttpClientRequest.bodyUint8Array(P.isString(body) ? new TextEncoder().encode(body) : body),
      HttpClientRequest.setHeaders({ "content-type": contentType, "content-encoding": encoding })
    );
    const received = yield* client.execute(request);
    const bytes = new Uint8Array(yield* received.arrayBuffer);
    return {
      status: received.status,
      headers: new Headers(received.headers),
      bytes,
      text: new TextDecoder().decode(bytes),
    };
  });
  return { ...intake, config, url, post, client };
});
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const spanBody = (invalid = false) =>
  encodeJsonValue({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: Str.repeat(32)("1"),
                spanId: Str.repeat(16)("2"),
                name: "synthetic-private-command",
                attributes: [{ key: "input.value", value: { stringValue: "synthetic-private-prompt" } }],
              },
              ...(invalid === true ? [{ traceId: "invalid-private-id" }] : []),
            ],
          },
        ],
      },
    ],
  });
// Independent response schema verifies protocol field numbers and 64-bit JSON counts.
const responseType = Protobuf.parse(`syntax = "proto3";
message ExportTraceServiceResponse { PartialSuccess partial_success = 1; }
message PartialSuccess { int64 rejected_spans = 1; string error_message = 2; }
message Status { int32 code = 1; string message = 2; }`).root;
const requestType = Protobuf.parse(`syntax = "proto3";
message ExportTraceServiceRequest { repeated ResourceSpans resource_spans = 1; }
message ResourceSpans { repeated ScopeSpans scope_spans = 2; }
message ScopeSpans { repeated Span spans = 2; }
message Span { bytes trace_id = 1; bytes span_id = 2; string name = 5; }`).root.lookupType("ExportTraceServiceRequest");

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("acknowledges committed JSON metadata, partial rejection and exact retry over a real socket", () =>
    Effect.gen(function* () {
      const { post, journal, health } = yield* fixture(1);
      const first = yield* post(yield* spanBody(true));
      expect(first.status).toBe(200);
      expect(first.text).toBe(
        '{"partialSuccess":{"rejectedSpans":"1","errorMessage":"Some spans were rejected by local admission"}}'
      );
      const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(first.headers.get("x-observation-receipt"));
      const stored = yield* journal.receipt(receiptId);
      expect(stored).toMatchObject({ _tag: "Some", value: { accepted: 1, rejected: 1, newEvents: 1 } });
      expect(yield* journal.stats).toMatchObject({ pages: 1, frames: 1 });
      const replay = yield* post(yield* spanBody(true));
      expect(replay.headers.get("x-observation-receipt")).toBe(receiptId);
      const refused = yield* post(yield* spanBody());
      expect(refused.status).toBe(503);
      expect(refused.headers.get("retry-after")).toBe("1");
      expect(refused.headers.get("x-observation-receipt")).toBeNull();
      expect((yield* post()).status).toBe(200);
      expect(yield* journal.stats).toMatchObject({ pages: 1 });
      expect(first.text).not.toContain("private");
      const observation = yield* health;
      expect(observation.counts).toMatchObject({ partial: 2, accepted: 1, capacity: 1 });
      expect(observation.saturated).toBe(false);
      const metrics = renderNativeHttpMetrics(observation);
      expect(metrics).toContain('beep_observation_intake_responses_total{outcome="capacity"} 1');
      expect(metrics).not.toContain(receiptId);
      expect(metrics).not.toContain("private");
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("supports gzip and protobuf with matching full and partial wire responses", () =>
    Effect.gen(function* () {
      const { post, journal } = yield* fixture();
      const empty = yield* post(new Uint8Array(), "application/x-protobuf");
      expect(empty.status).toBe(200);
      expect(empty.bytes.byteLength).toBe(0);
      expect(empty.headers.get("content-type")).toBe("application/x-protobuf");
      const encoded = requestType
        .encode({
          resourceSpans: [
            {
              scopeSpans: [
                {
                  spans: [
                    { traceId: new Uint8Array(16).fill(1), spanId: new Uint8Array(8).fill(2) },
                    { traceId: new Uint8Array(1) },
                  ],
                },
              ],
            },
          ],
        })
        .finish();
      const partial = yield* post(Zlib.gzipSync(encoded), "application/x-protobuf", "gzip");
      expect(partial.status).toBe(200);
      const response = responseType.lookupType("ExportTraceServiceResponse");
      expect(response.toObject(response.decode(partial.bytes), { longs: String })).toEqual({
        partialSuccess: {
          rejectedSpans: "1",
          errorMessage: "Some spans were rejected by local admission",
        },
      });
      const json = yield* post(Zlib.gzipSync(yield* spanBody()), "application/json; charset=utf-8", "gzip");
      expect(json.status).toBe(200);
      expect(json.text).toBe("{}");
      expect(yield* journal.stats).toMatchObject({ pages: 2, frames: 2 });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses malformed, unsupported and compressed oversized bodies without persistence", () =>
    Effect.gen(function* () {
      const { post, journal, url, health } = yield* fixture();
      expect((yield* post("private-garbage")).status).toBe(400);
      expect((yield* post("private-garbage", "application/json", "gzip")).status).toBe(400);
      expect((yield* post("{}", "application/json", "br")).status).toBe(415);
      expect((yield* post("{}", "text/plain")).status).toBe(415);
      expect((yield* post("{}", "application/json", "identity", `${url}/unsupported`)).status).toBe(404);
      expect((yield* post("{}", "application/json", "identity", url, "GET")).status).toBe(405);
      expect((yield* post(Str.repeat(262145)(" "))).status).toBe(413);
      expect((yield* post(Zlib.gzipSync(Str.repeat(1_048_576)(" ")), "application/json", "gzip")).status).toBe(413);
      const invalidProto = yield* post(new Uint8Array([255]), "application/x-protobuf");
      expect((yield* health).counts).toMatchObject({ malformed: 3, unsupported: 2, oversized: 2 });
      expect(invalidProto.status).toBe(400);
      const status = responseType.lookupType("Status");
      expect(status.toObject(status.decode(invalidProto.bytes))).toEqual({
        code: 3,
        message: "Local intake refused the request",
      });
      expect(yield* journal.stats).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("returns retryable refusal when the atomic receipt write fails and recovers on retry", () =>
    Effect.gen(function* () {
      const { post, journal, health } = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON observation_native_receipts BEGIN SELECT RAISE(ABORT, 'private-storage-cause'); END`;
      const refused = yield* post(yield* spanBody());
      expect(refused.status).toBe(503);
      expect(refused.text).not.toContain("private");
      expect((yield* health).counts.storage).toBe(1);
      expect(refused.headers.get("x-observation-receipt")).toBeNull();
      expect(yield* journal.stats).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
      expect(yield* sql`SELECT count(*) AS n FROM observation_native_events`).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_receipt_failure`;
      expect((yield* post(yield* spanBody())).status).toBe(200);
      expect(yield* journal.stats).toMatchObject({ pages: 1, frames: 1 });
    })
  )
);

// The Effect Node client sends a first chunk and waits for a controlled tail.
const openChunked = Effect.fn("NativeHttpTest.openChunked")(function* (url: string, client: HttpClient.HttpClient) {
  const tail = yield* Deferred.make<Uint8Array>();
  const body = Stream.make(new TextEncoder().encode(" ")).pipe(
    Stream.concat(tail.pipe(Deferred.await, Stream.fromEffect))
  );
  const pending = yield* client
    .execute(HttpClientRequest.post(url).pipe(HttpClientRequest.bodyStream(body, { contentType: "application/json" })))
    .pipe(
      Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status))),
      Effect.forkChild
    );
  return {
    end: (value: string) => Deferred.succeed(tail, new TextEncoder().encode(value)),
    status: Fiber.join(pending),
  };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses concurrent admission immediately and enforces streaming size without Content-Length", () =>
    Effect.gen(function* () {
      const { post, journal, url, client, health } = yield* fixture();
      const pending = yield* openChunked(url, client);
      let busy = 0;
      // Empty probes cannot mutate the journal, even if they arrive before the held body.
      for (let attempt = 0; attempt < 20 && busy !== 503; attempt++) {
        yield* Effect.sleep("5 millis");
        busy = (yield* post()).status;
      }
      expect(busy).toBe(503);
      expect((yield* health).counts.overloaded).toBeGreaterThanOrEqual(1);
      yield* pending.end(Str.repeat(262145)(" "));
      expect(yield* pending.status).toBe(413);
      expect((yield* post()).status).toBe(200);
      expect(yield* journal.stats).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("expires an unfinished upload with no acknowledgment or journal page and releases admission", () =>
    Effect.gen(function* () {
      const { post, journal, url, client, health } = yield* fixture(16, 100);
      const pending = yield* openChunked(url, client);
      expect(yield* pending.status).toBe(503);
      expect((yield* health).counts.timedOut).toBe(1);
      expect(yield* journal.stats).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
      expect((yield* post(yield* spanBody())).status).toBe(200);
      expect(yield* journal.stats).toMatchObject({ pages: 1, frames: 1 });
    }).pipe(Effect.timeout("3 seconds"))
  )
);
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("returns permanent expiry refusal and precise partial success for mixed expired and new spans", () =>
    Effect.gen(function* () {
      const { config, post, journal } = yield* fixture();
      const body = yield* spanBody();
      const first = yield* post(body);
      expect(first.status).toBe(200);
      const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(first.headers.get("x-observation-receipt"));
      const accepted = yield* journal.receipt(receiptId);
      if (O.isNone(accepted)) return yield* Effect.die("Missing fixture receipt");
      const reclaimer = yield* makePayloadReclaimer(
        config,
        DeliveryLedgerConfig.make({
          targetId: Sha256Hex.make(Str.repeat(64)("d")),
          maxEvents: 16,
          maxAttempts: 16,
          maxAttemptsPerEvent: 8,
        }),
        PayloadRetentionPolicy.make({
          minAgeMillis: 60_000,
          minAttemptQuietMillis: 60_000,
          maxDispositions: 16,
          expireAfterMillis: O.some(86_400_000),
        })
      );
      const clock = yield* Clock.Clock;
      const now = accepted.value.page.acceptedAt + 86_400_001;
      yield* reclaimer.expire(receiptId).pipe(
        Effect.provideService(Clock.Clock, {
          currentTimeMillis: Effect.succeed(now),
          currentTimeMillisUnsafe: () => now,
          currentTimeNanos: clock.currentTimeNanos,
          currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
          monotonicTimeNanos: clock.monotonicTimeNanos,
          monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
          sleep: (duration) => clock.sleep(duration),
        })
      );
      const expired = yield* post(body);
      expect(expired.status).toBe(410);
      expect(expired.headers.has("retry-after")).toBe(false);
      expect(expired.headers.has("x-observation-receipt")).toBe(false);
      const mixed = yield* encodeJsonValue({
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: A.map(["2", "3"], (digit) => ({
                  traceId: Str.repeat(32)("1"),
                  spanId: Str.repeat(16)(digit),
                  name: "synthetic-private-command",
                  attributes: [{ key: "input.value", value: { stringValue: "synthetic-private-prompt" } }],
                })),
              },
            ],
          },
        ],
      });
      const partial = yield* post(mixed);
      expect(partial.status).toBe(200);
      expect(yield* decodeJsonValue(partial.text)).toMatchObject({
        partialSuccess: { rejectedSpans: "1" },
      });
      const mixedId = yield* S.decodeUnknownEffect(Sha256Hex)(partial.headers.get("x-observation-receipt"));
      expect(yield* journal.receipt(mixedId)).toMatchObject({
        _tag: "Some",
        value: { accepted: 1, rejected: 1, newEvents: 1, expiredIndices: [0] },
      });
      expect((yield* post(mixed)).status).toBe(200);
      expect((yield* journal.stats).pages).toBe(1);
    })
  )
);
