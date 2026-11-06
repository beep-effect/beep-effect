import * as Zlib from "node:zlib";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  encodeManagedControllerObservation,
  ManagedControllerObservation,
} from "@beep/repo-ai-metrics/managed-controller";
import { makeNativeHttpIntake, NativeHttpPolicy, renderNativeHttpMetrics } from "@beep/repo-ai-metrics/native-http";
import * as LaunchFacts from "@beep/repo-ai-metrics/observation-launch-facts";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchIdentity,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchHttpPolicy } from "@beep/repo-ai-metrics/observation-launch-http";
import { makePayloadReclaimer, PayloadRetentionPolicy } from "@beep/repo-ai-metrics/payload-reclamation";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect, vi } from "@effect/vitest";
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
const fixture = Effect.fn("NativeHttpTest.fixture")(function* (
  maxPages = 16,
  bodyTimeoutMillis = 2000,
  managed = false
) {
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
      usageConvention: managed === true ? "unknown" : "claude-code",
      producer: managed === true ? O.some("managed-controller") : O.none(),
      bodyTimeoutMillis,
    }),
    undefined,
    managed === true
      ? ObservationLaunchHttpPolicy.make({
          routes: [{ routeId: Sha256Hex.make(Str.repeat(64)("c")), harness: "grok", surface: "cli" }],
          bodyTimeoutMillis: 1000,
        })
      : undefined
  );
  const context = yield* Layer.build(NodeHttpServer.layerTest.pipe(Layer.fresh));
  const server = Context.get(context, HttpServer.HttpServer);
  const build1 = yield* Layer.build(NodeHttpClient.layerNodeHttp);
  const client = Context.get(build1, HttpClient.HttpClient);
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
    const arrayBuffer2 = yield* received.arrayBuffer;
    const bytes = new Uint8Array(arrayBuffer2);
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
      const spanBody3 = yield* spanBody(true);
      const first = yield* post(spanBody3);
      expect(first.status).toBe(200);
      expect(first.text).toBe(
        '{"partialSuccess":{"rejectedSpans":"1","errorMessage":"Some spans were rejected by local admission"}}'
      );
      const receiptId = yield* S.decodeUnknownEffect(Sha256Hex)(first.headers.get("x-observation-receipt"));
      const stored = yield* journal.receipt(receiptId);
      expect(stored).toMatchObject({ _tag: "Some", value: { accepted: 1, rejected: 1, newEvents: 1 } });
      const stats4 = yield* journal.stats;
      expect(stats4).toMatchObject({ pages: 1, frames: 1 });
      const spanBody5 = yield* spanBody(true);
      const replay = yield* post(spanBody5);
      expect(replay.headers.get("x-observation-receipt")).toBe(receiptId);
      const spanBody6 = yield* spanBody();
      const refused = yield* post(spanBody6);
      expect(refused.status).toBe(503);
      expect(refused.headers.get("retry-after")).toBe("1");
      expect(refused.headers.get("x-observation-receipt")).toBeNull();
      expect((yield* post()).status).toBe(200);
      const stats7 = yield* journal.stats;
      expect(stats7).toMatchObject({ pages: 1 });
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
      const spanBody8 = yield* spanBody();
      const json = yield* post(Zlib.gzipSync(spanBody8), "application/json; charset=utf-8", "gzip");
      expect(json.status).toBe(200);
      expect(json.text).toBe("{}");
      const stats9 = yield* journal.stats;
      expect(stats9).toMatchObject({ pages: 2, frames: 2 });
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
      const stats10 = yield* journal.stats;
      expect(stats10).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("returns retryable refusal when the atomic receipt write fails and recovers on retry", () =>
    Effect.gen(function* () {
      const { post, journal, health } = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON observation_native_receipts BEGIN SELECT RAISE(ABORT, 'private-storage-cause'); END`;
      const spanBody11 = yield* spanBody();
      const refused = yield* post(spanBody11);
      expect(refused.status).toBe(503);
      expect(refused.text).not.toContain("private");
      expect((yield* health).counts.storage).toBe(1);
      expect(refused.headers.get("x-observation-receipt")).toBeNull();
      const stats12 = yield* journal.stats;
      expect(stats12).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
      const value13 = yield* sql`SELECT count(*) AS n FROM observation_native_events`;
      expect(value13).toEqual([{ n: 0 }]);
      yield* sql`DROP TRIGGER synthetic_receipt_failure`;
      const spanBody14 = yield* spanBody();
      expect((yield* post(spanBody14)).status).toBe(200);
      const stats15 = yield* journal.stats;
      expect(stats15).toMatchObject({ pages: 1, frames: 1 });
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
      // Empty probes cannot mutate the journal, even if they arrive before the held body.
      const busy = yield* post().pipe(
        Effect.map((response) => response.status),
        Effect.delay("5 millis"),
        Effect.repeat({ until: (status) => status === 503, times: 19 })
      );
      expect(busy).toBe(503);
      expect((yield* health).counts.overloaded).toBeGreaterThanOrEqual(1);
      yield* pending.end(Str.repeat(262145)(" "));
      const status16 = yield* pending.status;
      expect(status16).toBe(413);
      expect((yield* post()).status).toBe(200);
      const stats17 = yield* journal.stats;
      expect(stats17).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("expires an unfinished upload with no acknowledgment or journal page and releases admission", () =>
    Effect.gen(function* () {
      const { post, journal, url, client, health } = yield* fixture(16, 100);
      const pending = yield* openChunked(url, client);
      const status18 = yield* pending.status;
      expect(status18).toBe(503);
      expect((yield* health).counts.timedOut).toBe(1);
      const stats19 = yield* journal.stats;
      expect(stats19).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
      const spanBody20 = yield* spanBody();
      expect((yield* post(spanBody20)).status).toBe(200);
      const stats21 = yield* journal.stats;
      expect(stats21).toMatchObject({ pages: 1, frames: 1 });
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
      const decodedJsonValue = yield* decodeJsonValue(partial.text);
      expect(decodedJsonValue).toMatchObject({
        partialSuccess: { rejectedSpans: "1" },
      });
      const mixedId = yield* S.decodeUnknownEffect(Sha256Hex)(partial.headers.get("x-observation-receipt"));
      const receipt22 = yield* journal.receipt(mixedId);
      expect(receipt22).toMatchObject({
        _tag: "Some",
        value: { accepted: 1, rejected: 1, newEvents: 1, expiredIndices: [0] },
      });
      expect((yield* post(mixed)).status).toBe(200);
      expect((yield* journal.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) => {
  it.effect("requires actual matching local launch/process/session/finish facts before controller intake", () =>
    Effect.gen(function* () {
      const f = yield* fixture(16, 2000, true);
      const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
      const observed = ManagedControllerObservation.make({
        launchId: id("1"),
        launchRouteId: id("c"),
        processInstanceId: id("2"),
        sourceSessionId: id("3"),
        evidenceId: id("4"),
        startTimeUnixNano: "1793000000000000000",
        endTimeUnixNano: "1793000000100000000",
        elapsedNanos: "100000000",
      });
      const bytes = yield* encodeManagedControllerObservation(observed);
      expect((yield* f.post(bytes, "application/x-protobuf")).status).toBe(400);
      const launches = yield* makeObservationLaunchFacts(f.config);
      const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
      yield* launches.record(
        ObservationLaunchFact.cases.Prepared.make({
          launchId: observed.launchId,
          identity: ObservationLaunchIdentity.make({
            routeId: id("c"),
            harness: "grok",
            surface: "cli",
            root: unknown,
            repository: unknown,
            clone: unknown,
            worktree: unknown,
            task: unknown,
            attempt: unknown,
            evidenceId: id("5"),
          }),
        }),
        0
      );
      yield* launches.record(
        ObservationLaunchFact.cases.Started.make({
          launchId: observed.launchId,
          processInstanceId: observed.processInstanceId,
        }),
        0
      );
      yield* launches.record(
        ObservationLaunchFact.cases.SessionBound.make({
          launchId: observed.launchId,
          sourceSessionId: observed.sourceSessionId,
        }),
        0
      );
      expect((yield* f.post(bytes, "application/x-protobuf")).status).toBe(400);
      yield* launches.record(
        ObservationLaunchFact.cases.Finished.make({ launchId: observed.launchId, outcome: "cancelled" }),
        0
      );
      for (const changed of [
        { ...observed, processInstanceId: id("9") },
        { ...observed, sourceSessionId: id("9") },
        { ...observed, launchRouteId: id("9") },
        { ...observed, launchId: id("9") },
      ]) {
        const wrong = yield* encodeManagedControllerObservation(ManagedControllerObservation.make(changed));
        expect((yield* f.post(wrong, "application/x-protobuf")).status).toBe(400);
      }
      const foreign = ManagedControllerObservation.make({ ...observed, launchId: id("6"), launchRouteId: id("9") });
      yield* launches.record(
        ObservationLaunchFact.cases.Prepared.make({
          launchId: foreign.launchId,
          identity: ObservationLaunchIdentity.make({
            routeId: foreign.launchRouteId,
            harness: "grok",
            surface: "cli",
            root: unknown,
            repository: unknown,
            clone: unknown,
            worktree: unknown,
            task: unknown,
            attempt: unknown,
            evidenceId: id("5"),
          }),
        }),
        0
      );
      yield* launches.record(
        ObservationLaunchFact.cases.Started.make({
          launchId: foreign.launchId,
          processInstanceId: foreign.processInstanceId,
        }),
        0
      );
      yield* launches.record(
        ObservationLaunchFact.cases.SessionBound.make({
          launchId: foreign.launchId,
          sourceSessionId: foreign.sourceSessionId,
        }),
        0
      );
      yield* launches.record(
        ObservationLaunchFact.cases.Finished.make({ launchId: foreign.launchId, outcome: "succeeded" }),
        0
      );
      const foreignBody = yield* encodeManagedControllerObservation(foreign);
      const foreignResponse = yield* f.post(foreignBody, "application/x-protobuf");
      expect(foreignResponse.status).toBe(400);
      const accepted = yield* f.post(bytes, "application/x-protobuf");
      expect(accepted.status).toBe(200);
      expect(accepted.bytes).toHaveLength(0);
      const duplicate = yield* f.post(bytes, "application/x-protobuf");
      expect(duplicate.headers.get("x-observation-receipt")).toBe(accepted.headers.get("x-observation-receipt"));
      const changed = yield* encodeManagedControllerObservation(
        ManagedControllerObservation.make({ ...observed, evidenceId: id("8") })
      );
      expect((yield* f.post(changed, "application/x-protobuf")).bytes.length).toBeGreaterThan(0);
    })
  );
});

const realMakeLaunchFacts = LaunchFacts.makeObservationLaunchFacts;
for (const reason of LaunchFacts.ObservationLaunchFactsError.fields.reason.literals) {
  const expectedStatus = reason === "retired" ? 410 : reason === "conflict" ? 409 : 503;
  const expectedCode = reason === "retired" ? 9 : reason === "conflict" ? 3 : 14;
  const expectedCounter = reason === "retired" ? "expired" : reason === "capacity" ? "capacity" : "storage";
  const expectedMessage =
    reason === "retired"
      ? "Request references expired local acceptance; it cannot be reaccepted"
      : "Local intake refused the request";
  it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect(`returns a content-free native refusal for ${reason} launch-fact read failure`, () =>
      Effect.gen(function* () {
        const read = vi.fn(() => Effect.fail(LaunchFacts.ObservationLaunchFactsError.make({ reason })));
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi
              .spyOn(LaunchFacts, "makeObservationLaunchFacts")
              .mockImplementation((config) =>
                realMakeLaunchFacts(config).pipe(Effect.map((facts) => ({ ...facts, read })))
              )
          ),
          (mock) => Effect.sync(() => mock.mockRestore())
        );
        const f = yield* fixture(16, 2000, true);
        const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
        const observed = ManagedControllerObservation.make({
          launchId: id("1"),
          launchRouteId: id("c"),
          processInstanceId: id("2"),
          sourceSessionId: id("3"),
          evidenceId: id("4"),
          startTimeUnixNano: "1793000000000000000",
          endTimeUnixNano: "1793000000100000000",
          elapsedNanos: "100000000",
        });
        const bytes = yield* encodeManagedControllerObservation(observed);
        const refused = yield* f.post(bytes, "application/x-protobuf");
        expect(read).toHaveBeenCalledTimes(1);
        expect(refused.status).toBe(expectedStatus);
        expect(refused.headers.get("x-observation-receipt")).toBeNull();
        const status = responseType.lookupType("Status");
        expect(status.toObject(status.decode(refused.bytes))).toEqual({
          code: expectedCode,
          message: expectedMessage,
        });
        expect(refused.text).not.toContain("ObservationLaunchFactsError");
        const health = yield* f.health;
        expect(health.counts.accepted).toBe(0);
        expect(health.counts).toMatchObject({ [expectedCounter]: 1 });
        const stats = yield* f.journal.stats;
        expect(stats).toEqual({ pages: 0, frames: 0, payloadBytes: 0 });
      })
    )
  );
}

for (const domain of ["managed-controller-trace/v1:", "managed-controller-canary/v1:"]) {
  it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect("returns retryable503 without partial acceptance when controller identity hashing fails", () =>
      Effect.gen(function* () {
        const f = yield* fixture(16, 2000, true);
        const id = (c: string) => Sha256Hex.make(Str.repeat(64)(c));
        const observed = ManagedControllerObservation.make({
          launchId: id("1"),
          launchRouteId: id("c"),
          processInstanceId: id("2"),
          sourceSessionId: id("3"),
          evidenceId: id("4"),
          startTimeUnixNano: "1793000000000000000",
          endTimeUnixNano: "1793000000100000000",
          elapsedNanos: "100000000",
        });
        const other = ManagedControllerObservation.make({ ...observed, launchId: id("6") });
        const launches = yield* makeObservationLaunchFacts(f.config);
        const unknown = ObservationLaunchIdentity.fields.repository.cases.Unknown.make({});
        yield* Effect.forEach(
          [observed, other],
          Effect.fnUntraced(function* (source) {
            const identity = ObservationLaunchIdentity.make({
              routeId: source.launchRouteId,
              harness: "grok",
              surface: "cli",
              root: unknown,
              repository: unknown,
              clone: unknown,
              worktree: unknown,
              task: unknown,
              attempt: unknown,
              evidenceId: id("5"),
            });
            yield* launches.record(
              ObservationLaunchFact.cases.Prepared.make({ launchId: source.launchId, identity }),
              0
            );
            yield* launches.record(
              ObservationLaunchFact.cases.Started.make({
                launchId: source.launchId,
                processInstanceId: source.processInstanceId,
              }),
              0
            );
            yield* launches.record(
              ObservationLaunchFact.cases.SessionBound.make({
                launchId: source.launchId,
                sourceSessionId: source.sourceSessionId,
              }),
              0
            );
            yield* launches.record(
              ObservationLaunchFact.cases.Finished.make({ launchId: source.launchId, outcome: "succeeded" }),
              0
            );
          })
        );
        const first = yield* encodeManagedControllerObservation(observed);
        const second = yield* encodeManagedControllerObservation(other);
        const mixed = new Uint8Array([...first, ...second]);
        const initialStats = yield* f.journal.stats;
        const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
        let failedCalls = 0;
        const mock = yield* Effect.acquireRelease(
          Effect.sync(() =>
            vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementation((algorithm, data) => {
              if (new TextDecoder().decode(data) === `${domain}${other.launchId}`) {
                failedCalls += 1;
                return Promise.reject(new Error("PRIVATE_CRYPTO_FAILURE"));
              }
              return digest(algorithm, data);
            })
          ),
          (mock) => Effect.sync(() => mock.mockRestore())
        );
        const refused = yield* f.post(mixed, "application/x-protobuf");
        expect(failedCalls).toBe(1);
        expect(refused.status).toBe(503);
        expect(refused.headers.get("x-observation-receipt")).toBeNull();
        const status = responseType.lookupType("Status");
        expect(status.toObject(status.decode(refused.bytes))).toEqual({
          code: 14,
          message: "Local intake refused the request",
        });
        expect(refused.text).not.toContain("PRIVATE_CRYPTO_FAILURE");
        expect(refused.text).not.toContain("AiMetricsPrivacyError");
        const refusedStats = yield* f.journal.stats;
        const health = yield* f.health;
        expect(refusedStats).toEqual(initialStats);
        expect(refusedStats.pages).toBe(0);
        expect(refusedStats.frames).toBe(0);
        expect(health.counts).toMatchObject({ accepted: 0, partial: 0, unavailable: 1 });
        yield* Effect.sync(() => mock.mockRestore());
        const retried = yield* f.post(mixed, "application/x-protobuf");
        expect(retried.status).toBe(200);
        expect(retried.bytes).toHaveLength(0);
        expect(retried.headers.get("x-observation-receipt")).not.toBeNull();
        const retryStats = yield* f.journal.stats;
        expect(retryStats.frames).toBe(2);
      })
    )
  );
}
