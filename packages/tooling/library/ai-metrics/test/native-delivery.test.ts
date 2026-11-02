import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const fixture = Effect.fn("NativeDeliveryTest.fixture")(function* (timeoutMillis = 2000) {
  const salt = "synthetic-delivery-salt";
  const intakeConfig = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const native = yield* makeNativeIntakeJournal(intakeConfig);
  const body = yield* encodeJsonValue({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: Str.repeat(32)("1"),
                spanId: Str.repeat(16)("2"),
                name: "private-synthetic-command",
                attributes: [{ key: "input.value", value: { stringValue: "private-prompt" } }],
              },
            ],
          },
        ],
      },
    ],
  });
  const batch = yield* projectNativeTraceRequest(
    NativeTraceRequest.make({
      routeId: id("c"),
      hashSalt: Redacted.make(salt),
      contentType: "application/json",
      body: new TextEncoder().encode(body),
      approvedModels: [],
      usageConvention: "unknown",
    })
  );
  const receipt = yield* native.acceptBatch(batch);
  const context = yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }));
  const server = Context.get(context, HttpServer.HttpServer);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(`${HttpServer.formatAddress(server.address)}/v1/traces`),
    project: "synthetic-proof",
    timeoutMillis,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 16,
  });
  const worker = yield* makeNativeDelivery(intakeConfig, config, policy).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const calls = yield* Ref.make(0);
  const received = yield* Deferred.make<void>();
  const sql = yield* SqlClient.SqlClient;
  const first = batch.spans[0];
  if (first === undefined) return yield* Effect.die("Invalid synthetic fixture");
  const serve = <E, R>(reply: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    server.serve(
      Effect.gen(function* () {
        yield* Ref.update(calls, (n) => n + 1);
        const attempts = yield* sql`SELECT attempt_id FROM observation_delivery_attempts`;
        expect(attempts.length).toBeGreaterThan(0);
        const request = yield* HttpServerRequest.HttpServerRequest;
        expect(request.headers["content-type"]).toBe("application/x-protobuf");
        const wire = new TextDecoder().decode(yield* request.arrayBuffer);
        expect(wire).not.toContain("private-prompt");
        expect(wire).not.toContain("private-synthetic-command");
        expect(wire).toContain("synthetic-proof");
        yield* Deferred.succeed(received, undefined);
        return yield* reply;
      }).pipe(Effect.scoped)
    );
  const send = (char = "d") =>
    worker.send(
      NativeDeliveryRequest.make({ receiptId: receipt.page.receiptId, attemptId: id(char), offset: 0, limit: 512 })
    );
  return {
    ...worker,
    serve,
    sendRequest: worker.send,
    send,
    calls,
    received,
    first,
    sql,
    receipt,
    intakeConfig,
    config,
    policy,
    client,
  };
});
const response = (body = new Uint8Array(), status = 200, contentType = "application/x-protobuf") =>
  Effect.succeed(HttpServerResponse.uint8Array(body, { status, contentType }));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("commits before socket I/O, records full acknowledgment, and never resends an existing attempt", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.serve(response());
      expect(yield* f.send()).toMatchObject({ _tag: "Recorded", outcome: { _tag: "Accepted" } });
      expect(yield* f.send()).toEqual({ _tag: "ExistingAttempt", attemptId: id("d") });
      expect(yield* Ref.get(f.calls)).toBe(1);
      expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({
        value: { state: "accepted-unverified", attempts: 1 },
      });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("retains partial batch evidence instead of inventing an accepted event subset", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.serve(response(new Uint8Array([10, 2, 8, 1])));
      expect(yield* f.send()).toMatchObject({ outcome: { _tag: "Partial", rejectedCount: 1 } });
      expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({
        value: { state: "unresolved", ambiguousAttempts: 1 },
      });
    })
  )
);
for (const status of [503, 400, 302])
  it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect(`preserves explicit HTTP ${status} without automatic retries or redirects`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.serve(
          Effect.succeed(
            HttpServerResponse.text("private-server-detail", {
              status,
              headers: { location: Redacted.value(f.policy.endpoint) },
            })
          )
        );
        const result = yield* f.send();
        expect(result).toMatchObject({
          _tag: "Recorded",
          outcome: { _tag: status === 503 ? "Retryable" : status === 400 ? "Rejected" : "Unknown" },
        });
        expect(yield* Ref.get(f.calls)).toBe(1);
        const facts = yield* f.sql`SELECT payload FROM observation_delivery_results`;
        expect(yield* encodeJsonValue(facts)).not.toContain("private-server-detail");
      })
    )
  );
for (const malformed of [true, false])
  it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
    it.effect(`bounds ${malformed ? "malformed" : "oversize streamed"} responses`, () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.serve(
          malformed
            ? response(new Uint8Array([255]))
            : Effect.succeed(
                HttpServerResponse.stream(
                  Stream.make(new Uint8Array(32768), new Uint8Array(32768), new Uint8Array(1)),
                  { contentType: "application/x-protobuf" }
                )
              )
        );
        expect(yield* f.send()).toMatchObject({ outcome: { _tag: "Unknown", reason: "invalid-response" } });
        expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({ value: { state: "unresolved" } });
      })
    )
  );
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("keeps a lost response unresolved and refuses overlap without consuming an attempt", () =>
    Effect.gen(function* () {
      const f = yield* fixture(100);
      yield* f.serve(Effect.sleep(500).pipe(Effect.andThen(response())));
      const sending = yield* Effect.forkChild(f.send());
      yield* Deferred.await(f.received);
      expect((yield* f.send("e").pipe(Effect.flip)).reason).toBe("busy");
      expect(yield* Fiber.join(sending)).toMatchObject({
        outcome: { _tag: "Unknown", reason: "timed-out" },
      });
      expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({ value: { state: "unresolved", attempts: 1 } });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("records interruption after send and preserves an unresolved attempt if result persistence fails", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.serve(Effect.sleep(1000).pipe(Effect.andThen(response())));
      const sending = yield* Effect.forkChild(f.send());
      yield* Deferred.await(f.received);
      yield* Fiber.interrupt(sending);
      const facts = yield* f.sql`SELECT payload FROM observation_delivery_results`;
      expect(yield* encodeJsonValue(facts)).toContain("interrupted");
      expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({ value: { state: "unresolved" } });
      yield* f.sql`CREATE TRIGGER synthetic_result_failure BEFORE INSERT ON observation_delivery_results BEGIN SELECT RAISE(ABORT,'synthetic'); END`;
      expect((yield* f.send("e").pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* f.ledger.state(f.first.eventId)).toMatchObject({ value: { state: "unresolved", attempts: 2 } });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses unowned destinations and unknown selections before network I/O", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.serve(response());
      expect(
        (yield* f
          .sendRequest(NativeDeliveryRequest.make({ receiptId: id("f"), attemptId: id("d"), offset: 0, limit: 1 }))
          .pipe(Effect.flip)).reason
      ).toBe("unknown-page");
      const mismatch = yield* makeNativeDelivery(
        f.intakeConfig,
        DeliveryLedgerConfig.make({ ...f.config, targetId: id("f") }),
        f.policy
      ).pipe(Effect.provideService(HttpClient.HttpClient, f.client), Effect.flip);
      expect(mismatch).toMatchObject({ reason: "configuration" });
      for (const endpoint of [
        "http://example.com/v1/traces",
        "https://user:password@example.com/v1/traces",
        "https://example.com/v1/traces?token=private",
      ]) {
        expect(
          yield* nativeDeliveryTargetId(
            NativeDeliveryPolicy.make({ ...f.policy, endpoint: Redacted.make(endpoint) })
          ).pipe(Effect.flip)
        ).toMatchObject({ reason: "configuration" });
      }
      expect(yield* Ref.get(f.calls)).toBe(0);
    })
  )
);
