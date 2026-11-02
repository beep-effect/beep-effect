import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback";
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
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as Protobuf from "protobufjs";

const sqlLayer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const proto = Protobuf.parse(
  `syntax="proto3"; message Value { oneof value { string string_value=1; bool bool_value=2; int64 int_value=3; } } message Attr { string key=1; Value value=2; } message Span { repeated Attr attributes=9; } message Scope { repeated Span spans=2; } message Resource { repeated Scope scope_spans=2; } message Request { repeated Resource resource_spans=1; }`
).root.lookupType("Request");
const attribute = S.Struct({
  key: S.String,
  value: S.Struct({
    stringValue: S.optionalKey(S.String),
    boolValue: S.optionalKey(S.Boolean),
    intValue: S.optionalKey(S.String),
  }),
});
const requestSchema = S.Struct({
  resourceSpans: S.Array(
    S.Struct({ scopeSpans: S.Array(S.Struct({ spans: S.Array(S.Struct({ attributes: S.Array(attribute) })) })) })
  ),
});
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeUnionValue = S.decodeUnknownEffect(S.Union([S.String, S.Finite, S.Boolean]));

const responseStartTimes: Readonly<Record<string, string>> = {
  "point-rounded": "2026-10-26T07:33:20.000001+00:00",
  reversed: "2026-10-26T07:33:20.000001+00:00",
  submicro: "2026-10-26T07:33:20.000000870+00:00",
  rounded: "2026-10-26T07:33:20.000001+00:00",
  "beyond-precision": "2026-10-26T07:33:20.000002+00:00",
  carry: "2026-10-26T07:33:21+00:00",
};
const responseEndTimes: Readonly<Record<string, string>> = {
  "point-split": "2026-10-26T07:33:20.000001+00:00",
  "point-rounded": "2026-10-26T07:33:20.000001+00:00",
  reversed: "2026-10-26T07:33:20+00:00",
  rounded: "2026-10-26T07:33:20.100001+00:00",
  carry: "2026-10-26T07:33:21.100000+00:00",
};
const fixtureKeys: Readonly<Record<string, string | boolean>> = {
  "ai_metrics.synthetic": true,
  "ai_metrics.fixture.surface": "cli",
  "ai_metrics.fixture.provenance": "declared_synthetic_fixture",
};
const changedAttributes = (current: string, attrs: Readonly<Record<string, string | number | boolean>>) =>
  Match.value(current).pipe(
    Match.when("tokens", () => ({ ...attrs, "llm.token_count.total": 136 })),
    Match.when("extra", () => ({ ...attrs, "llm.provider": "invented" })),
    Match.when("time", () => ({ ...attrs, "ai_metrics.source_start_time_unix_nano": "1793000000000000002" })),
    Match.orElse(() => attrs)
  );
const decodeWireAttributes = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const decoded = yield* Effect.try(() => proto.toObject(proto.decode(bytes), { longs: String })).pipe(
    Effect.flatMap(S.decodeUnknownEffect(requestSchema))
  );
  const span = decoded.resourceSpans[0]?.scopeSpans[0]?.spans[0];
  if (span === undefined) return yield* Effect.die("Invalid synthetic wire");
  const entries = yield* Effect.forEach(
    A.filter(span.attributes, (attr) => attr.key !== "openinference.span.kind"),
    ({ key, value }) =>
      Effect.gen(function* () {
        const scalar = yield* decodeUnionValue(
          value.stringValue ?? (value.intValue !== undefined ? Number(value.intValue) : value.boolValue)
        );
        return [key, scalar] satisfies readonly [string, string | number | boolean];
      })
  );
  return R.fromEntries(entries);
});
const responseRow = (
  current: string,
  attrs: Readonly<Record<string, string | number | boolean>>,
  event: { readonly traceId: string; readonly spanId: string }
) => {
  const changed = changedAttributes(current, attrs);
  const injected = R.get(fixtureKeys, current);
  return {
    context: { trace_id: event.traceId, span_id: event.spanId },
    name: "agent.llm",
    parent_id: null,
    span_kind: "LLM",
    status_code: "UNSET",
    start_time: O.getOrElse(R.get(responseStartTimes, current), () => "2026-10-26T07:33:20+00:00"),
    end_time: O.getOrElse(R.get(responseEndTimes, current), () => "2026-10-26T07:33:20.100000+00:00"),
    attributes: O.isSome(injected) ? { ...changed, [current]: injected.value } : changed,
  };
};

const fixture = Effect.fn("NativeReadbackTest.fixture")(function* (fraction = "000000001", durationNano = 100000000) {
  const sql = yield* SqlClient.SqlClient;
  const context = yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }));
  const server = Context.get(context, HttpServer.HttpServer);
  const origin = HttpServer.formatAddress(server.address);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  const salt = "synthetic-readback-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(`${origin}/v1/traces`),
    project: "synthetic",
    timeoutMillis: 2000,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 16,
    maxAttemptsPerEvent: 8,
  });
  const native = yield* makeNativeIntakeJournal(intake);
  const body = yield* encodeJsonValue({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: Str.repeat(32)("1"),
                spanId: Str.repeat(16)("2"),
                name: "claude_code.llm_request",
                startTimeUnixNano: `1793000000${fraction}`,
                endTimeUnixNano: (BigInt(`1793000000${fraction}`) + BigInt(durationNano)).toString(),
                attributes: [
                  { key: "input_tokens", value: { intValue: "10" } },
                  { key: "output_tokens", value: { intValue: "5" } },
                  { key: "cache_read_tokens", value: { intValue: "100" } },
                  { key: "cache_creation_tokens", value: { intValue: "20" } },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const batch = yield* projectNativeTraceRequest(
    NativeTraceRequest.make({
      routeId: id("b"),
      hashSalt: Redacted.make(salt),
      contentType: "application/json",
      body: new TextEncoder().encode(body),
      usageConvention: "claude-code",
      approvedModels: [],
    })
  );
  const event = batch.spans[0];
  if (event === undefined) return yield* Effect.die("Invalid fixture");
  const receipt = yield* native.acceptBatch(batch);
  const sender = yield* makeNativeDelivery(intake, config, policy).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const backend = PhoenixConfigInput.make({ baseUrl: origin });
  const reader = yield* makeNativeReadback(intake, config, policy, backend).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const stored = yield* Ref.make<Readonly<Record<string, string | number | boolean>>>({});
  const mode = yield* Ref.make("valid");
  const reads = yield* Ref.make(0);
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method === "POST") {
        const bytes = new Uint8Array(yield* request.arrayBuffer);
        yield* Ref.set(stored, yield* decodeWireAttributes(bytes));
        return HttpServerResponse.uint8Array(new Uint8Array(), { contentType: "application/x-protobuf" });
      }
      yield* Ref.update(reads, (n) => n + 1);
      expect(request.url).toContain("/v1/projects/synthetic/spans?");
      expect(request.url).toContain("limit=2");
      const current = yield* Ref.get(mode);
      const attrs = yield* Ref.get(stored);
      const row = responseRow(current, attrs, event);
      return yield* HttpServerResponse.json({
        data: current === "missing" ? [] : current === "duplicate" ? [row, row] : [row],
        next_cursor: null,
      });
    })
  );
  const selection = NativeDeliveryRequest.make({
    receiptId: receipt.page.receiptId,
    attemptId: id("d"),
    offset: 0,
    limit: 512,
  });
  const reconcile = () => reader.reconcile(selection, event.eventId);
  return { sql, sender, selection, reconcile, reader, event, mode, reads, intake, config, policy, backend, client };
});
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "verifies the original wire metadata before persisting visible and does not downgrade historical proof",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.sender.send(f.selection);
        for (const mode of [
          "missing",
          "tokens",
          "extra",
          "time",
          "ai_metrics.synthetic",
          "ai_metrics.fixture.surface",
          "ai_metrics.fixture.provenance",
        ]) {
          yield* Ref.set(f.mode, mode);
          expect(yield* f.reconcile()).toMatchObject({ _tag: mode === "missing" ? "Missing" : "Mismatch" });
          expect(yield* f.sender.ledger.state(f.event.eventId)).toMatchObject({
            value: { state: "accepted-unverified" },
          });
        }
        yield* Ref.set(f.mode, "valid");
        expect(yield* f.reconcile()).toMatchObject({ _tag: "Visible" });
        expect(yield* f.sender.ledger.state(f.event.eventId)).toMatchObject({ value: { state: "visible" } });
        yield* Ref.set(f.mode, "missing");
        expect(yield* f.reconcile()).toMatchObject({ _tag: "Missing" });
        expect(yield* f.sender.ledger.state(f.event.eventId)).toMatchObject({ value: { state: "visible" } });
      })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses duplicate query rows, invalid attempts and failed visibility writes", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(yield* f.reconcile().pipe(Effect.flip)).toMatchObject({ reason: "unknown-attempt" });
      expect(yield* Ref.get(f.reads)).toBe(0);
      yield* f.sender.send(f.selection);
      expect(
        yield* f.reader
          .reconcile(NativeDeliveryRequest.make({ ...f.selection, offset: 1 }), f.event.eventId)
          .pipe(Effect.flip)
      ).toMatchObject({ reason: "attempt-mismatch" });
      expect(yield* Ref.get(f.reads)).toBe(0);
      yield* Ref.set(f.mode, "duplicate");
      expect(yield* f.reconcile().pipe(Effect.flip)).toMatchObject({ reason: "ambiguous" });
      yield* Ref.set(f.mode, "valid");
      yield* f.sql`CREATE TRIGGER synthetic_visibility_failure BEFORE INSERT ON observation_delivery_visibility BEGIN SELECT RAISE(ABORT,'synthetic'); END`;
      expect(yield* f.reconcile().pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect(yield* f.sender.ledger.state(f.event.eventId)).toMatchObject({ value: { state: "accepted-unverified" } });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("binds a separately declared backend into the immutable target and refuses drift", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const changed = NativeDeliveryPolicy.make({
        ...f.policy,
        readbackOrigin: O.some(Redacted.make("https://phoenix.example")),
      });
      expect(yield* nativeDeliveryTargetId(changed)).not.toBe(f.config.targetId);
      expect(
        yield* makeNativeReadback(f.intake, f.config, changed, f.backend).pipe(
          Effect.provideService(HttpClient.HttpClient, f.client),
          Effect.flip
        )
      ).toMatchObject({ reason: "configuration" });
      expect(yield* Ref.get(f.reads)).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("accepts backend microsecond rounding only with exact nanosecond metadata and rejects larger drift", () =>
    Effect.gen(function* () {
      const f = yield* fixture("000000870");
      yield* f.sender.send(f.selection);
      for (const mode of ["beyond-precision", "submicro", "time"]) {
        yield* Ref.set(f.mode, mode);
        expect(yield* f.reconcile()).toMatchObject({ _tag: "Mismatch" });
      }
      yield* Ref.set(f.mode, "rounded");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Visible" });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses a full microsecond shift for an already aligned timestamp", () =>
    Effect.gen(function* () {
      const f = yield* fixture("000000000");
      yield* f.sender.send(f.selection);
      yield* Ref.set(f.mode, "rounded");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Mismatch" });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("accepts microsecond rounding across the next second while preserving exact event time", () =>
    Effect.gen(function* () {
      const f = yield* fixture("999999870");
      yield* f.sender.send(f.selection);
      yield* Ref.set(f.mode, "carry");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Visible" });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("never invents a duration by rounding the same point in different directions", () =>
    Effect.gen(function* () {
      const f = yield* fixture("000000870", 0);
      yield* f.sender.send(f.selection);
      yield* Ref.set(f.mode, "point-split");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Mismatch" });
      yield* Ref.set(f.mode, "point-rounded");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Visible" });
    })
  )
);
it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses inverted stored endpoints even inside each endpoint's rounding bucket", () =>
    Effect.gen(function* () {
      const f = yield* fixture("000000870", 10);
      yield* f.sender.send(f.selection);
      yield* Ref.set(f.mode, "reversed");
      expect(yield* f.reconcile()).toMatchObject({ _tag: "Mismatch" });
    })
  )
);
