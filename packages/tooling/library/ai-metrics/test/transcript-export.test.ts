import { PhoenixConfigInput } from "@beep/phoenix";
import { DeliveryLedgerConfig } from "@beep/repo-ai-metrics/delivery-ledger";
import {
  makeNativeDelivery,
  NativeDeliveryPolicy,
  NativeDeliveryRequest,
  nativeDeliveryTargetId,
} from "@beep/repo-ai-metrics/native-delivery";
import { makeNativeReadback } from "@beep/repo-ai-metrics/native-readback";
import { makeNativeDeliveryScheduler, NativeSchedulePolicy } from "@beep/repo-ai-metrics/native-schedule";
import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { encodeTranscriptTraceBatch, TranscriptExportInput } from "@beep/repo-ai-metrics/transcript-export";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import {
  readTranscriptPage,
  TranscriptFrame,
  TranscriptMetadata,
  TranscriptPageInput,
} from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import * as Protobuf from "protobufjs";

const layer = Layer.merge(makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver }), NodeCrypto.layer);
const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const wire = Protobuf.parse(`syntax="proto3";
message Value {string string_value=1; bool bool_value=2; int64 int_value=3;}
message Attr {string key=1; Value value=2;}
message Status {int32 code=3;}
message Span {bytes trace_id=1; bytes span_id=2; bytes parent_span_id=4; string name=5; fixed64 start_time_unix_nano=7; fixed64 end_time_unix_nano=8; repeated Attr attributes=9; Status status=15;}
message Scope {string name=1;string version=2;}
message ScopeSpans {Scope scope=1;repeated Span spans=2;}
message ResourceSpans {repeated ScopeSpans scope_spans=2;}
message Request {repeated ResourceSpans resource_spans=1;}`).root.lookupType("Request");
const Attr = S.Struct({
  key: S.String,
  value: S.Struct({
    stringValue: S.optionalKey(S.String),
    intValue: S.optionalKey(S.String),
    boolValue: S.optionalKey(S.Boolean),
  }),
});
const Span = S.Struct({
  traceId: S.Uint8Array,
  spanId: S.Uint8Array,
  parentSpanId: S.optionalKey(S.Uint8Array),
  name: S.String,
  startTimeUnixNano: S.String,
  endTimeUnixNano: S.String,
  status: S.Struct({ code: S.optionalKey(S.Int) }),
  attributes: S.Array(Attr),
});
const Decoded = S.Struct({
  resourceSpans: S.Tuple([
    S.Struct({
      scopeSpans: S.Tuple([S.Struct({ scope: S.Struct({ name: S.String, version: S.String }), spans: S.Array(Span) })]),
    }),
  ]),
});
const decode = (bytes: Uint8Array) =>
  S.decodeUnknownEffect(Decoded)(wire.toObject(wire.decode(bytes), { longs: String }));
const attr = (span: typeof Span.Type, key: string) =>
  O.map(
    A.findFirst(span.attributes, (a) => a.key === key),
    (a) => a.value
  );
const fixture = Effect.fn("TranscriptExportTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const salt = "synthetic-reconstruction-salt";
  const intake = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1048576,
    maxDatabasePages: 512,
  });
  const journal = yield* makeTranscriptIntakeJournal(intake);
  const read = Effect.fn("TranscriptExportTest.read")(function* (name: string, text: string) {
    const path = `${dir}/${name}.jsonl`;
    yield* fs.writeFileString(path, text);
    return yield* readTranscriptPage(
      TranscriptPageInput.make({
        path,
        source: "claude",
        hashSalt: Redacted.make(salt),
        cursor: O.none(),
        maxBytes: 8192,
        maxLineBytes: 2048,
        maxFrames: 32,
      })
    );
  });
  const record = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    type: "assistant",
    timestamp: "2020-01-02T10:00:00.123456789+02:00",
    sessionId: "private-session",
    message: {
      id: "private-message",
      model: "private-model",
      content: "private-prompt",
      usage: { input_tokens: 11, output_tokens: 5, cache_read_input_tokens: 8, cache_creation_input_tokens: 2 },
    },
  });
  yield* journal.acceptPage(yield* read("rejected", "invalid-private-json\n"), O.none());
  const page = yield* read("accepted", `${record}\ninvalid-private-json\n${record}\n`);
  const receipt = yield* journal.acceptPage(page, O.none());
  const frames = A.filter(page.frames, (f) => f._tag === "Accepted");
  const input = TranscriptExportInput.make({
    hostId: intake.hostId,
    namespaceId: intake.namespaceId,
    project: "synthetic-reconstructed",
    evidenceEpoch: receipt.evidenceEpoch,
    acceptedAtMillis: receipt.acceptedAt,
    cursor: page.cursor,
    frames,
  });
  const context = yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }));
  const server = Context.get(context, HttpServer.HttpServer);
  const origin = HttpServer.formatAddress(server.address);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  const policy = NativeDeliveryPolicy.make({
    endpoint: Redacted.make(`${origin}/v1/traces`),
    project: input.project,
    timeoutMillis: 2000,
  });
  const config = DeliveryLedgerConfig.make({
    targetId: yield* nativeDeliveryTargetId(policy),
    maxEvents: 16,
    maxAttempts: 32,
    maxAttemptsPerEvent: 8,
  });
  const sender = yield* makeNativeDelivery(intake, config, policy).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const reader = yield* makeNativeReadback(intake, config, policy, PhoenixConfigInput.make({ baseUrl: origin })).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  const posts = yield* Ref.make(0);
  const stored = yield* Ref.make<ReadonlyArray<typeof Span.Type>>([]);
  const mode = yield* Ref.make("valid");
  const sql = yield* SqlClient.SqlClient;
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method === "POST") {
        const bytes = new Uint8Array(yield* request.arrayBuffer);
        const raw = new TextDecoder().decode(bytes);
        for (const value of [
          "private-prompt",
          "private-session",
          "private-message",
          "private-model",
          salt,
          dir,
          "invalid-private-json",
        ])
          expect(raw).not.toContain(value);
        expect((yield* sql`SELECT attempt_id FROM observation_delivery_attempts`).length).toBeGreaterThan(0);
        const decoded = yield* decode(bytes);
        yield* Ref.update(stored, (rows) => [...rows, ...decoded.resourceSpans[0].scopeSpans[0].spans]);
        yield* Ref.update(posts, (n) => n + 1);
        return HttpServerResponse.uint8Array(new Uint8Array(), { contentType: "application/x-protobuf" });
      }
      const current = yield* Ref.get(mode);
      const query = decodeURIComponent(request.url);
      const span = A.findFirst(yield* Ref.get(stored), (row) => Str.includes(Hex.encode(row.spanId))(query));
      if (O.isNone(span) || current === "missing")
        return yield* HttpServerResponse.json({ data: [], next_cursor: null });
      const row = span.value;
      const attributes = R.fromEntries(
        A.map(
          A.filter(row.attributes, (a) => a.key !== "openinference.span.kind"),
          (a) =>
            [a.key, a.value.stringValue ?? a.value.boolValue ?? Number(a.value.intValue)] satisfies readonly [
              string,
              string | boolean | number,
            ]
        )
      );
      return yield* HttpServerResponse.json({
        data: [
          {
            context: { trace_id: Hex.encode(row.traceId), span_id: Hex.encode(row.spanId) },
            name: row.name,
            parent_id: current === "parent" ? Str.repeat(16)("1") : null,
            span_kind: "CHAIN",
            status_code: "UNSET",
            start_time: "2020-01-02T08:00:00.123456+00:00",
            end_time: "2020-01-02T08:00:00.123456+00:00",
            attributes:
              current === "invented-total"
                ? { ...attributes, "llm.token_count.total": 16 }
                : current === "invented-route"
                  ? { ...attributes, "ai_metrics.route_id": id("f") }
                  : attributes,
          },
        ],
        next_cursor: null,
      });
    })
  );
  const selection = NativeDeliveryRequest.make({
    receiptId: receipt.receiptId,
    attemptId: id("b"),
    offset: 0,
    limit: 512,
  });
  const reopen = () =>
    makeNativeDeliveryScheduler(
      intake,
      config,
      NativeSchedulePolicy.make({
        maxEvents: 1,
        retryDelayMillis: 100,
        maxRetryDelayMillis: 200,
        reconcileDelayMillis: 100,
        tickTimeoutMillis: 2000,
      }),
      sender,
      reader
    );
  return { input, page, frames, receipt, sender, reader, selection, posts, mode, sql, reopen };
});

it.layer(Layer.fresh(layer), { excludeTestServices: true })((it) =>
  it.effect(
    "encodes stable separate occurrences, nanosecond points and non-additive usage without private content",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const encoded = yield* encodeTranscriptTraceBatch(f.input);
        expect(yield* encodeTranscriptTraceBatch(f.input)).toEqual(encoded);
        const scope = (yield* decode(encoded.body)).resourceSpans[0].scopeSpans[0];
        expect(scope.scope.version).toBe("transcript-export/v1");
        expect(scope.spans).toHaveLength(2);
        const first = scope.spans[0];
        const second = scope.spans[1];
        const frame = f.frames[0];
        if (first === undefined || second === undefined || frame === undefined)
          return yield* Effect.die("Invalid synthetic spans");
        expect(first.traceId).not.toEqual(second.traceId);
        expect(first.spanId).not.toEqual(second.spanId);
        expect(first.parentSpanId).toBeUndefined();
        expect(first.startTimeUnixNano).toBe("1577952000123456789");
        expect(first.endTimeUnixNano).toBe(first.startTimeUnixNano);
        expect(attr(first, "ai_metrics.stream")).toEqual(O.some({ stringValue: "reconstructed" }));
        expect(attr(first, "ai_metrics.usage.basis")).toEqual(O.some({ stringValue: "message" }));
        expect(attr(first, "ai_metrics.usage.additive")).toEqual(O.some({ boolValue: false }));
        expect(attr(first, "ai_metrics.usage.input")).toEqual(O.some({ intValue: "11" }));
        expect(attr(first, "ai_metrics.usage.cache_read")).toEqual(O.some({ intValue: "8" }));
        expect(attr(first, "llm.token_count.total")).toEqual(O.none());
        expect(attr(first, "session.id")).toEqual(attr(second, "session.id"));
        expect(attr(first, "session.id")).not.toEqual(O.none());
        expect(encoded.eventIds).toEqual(A.map(f.frames, (frame) => frame.occurrenceId));
        expect(
          yield* encodeTranscriptTraceBatch(TranscriptExportInput.make({ ...f.input, namespaceId: id("f") })).pipe(
            Effect.flip
          )
        ).toMatchObject({ reason: "namespace" });
        expect(
          yield* encodeTranscriptTraceBatch(TranscriptExportInput.make({ ...f.input, frames: [frame, frame] })).pipe(
            Effect.flip
          )
        ).toMatchObject({ reason: "identity" });
      }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(layer), { excludeTestServices: true })((it) =>
  it.effect("commits delivery once and requires exact reconstructed read-back before visibility", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const event = f.frames[0];
      if (event === undefined) return yield* Effect.die("Missing fixture frame");
      expect(yield* f.sender.send(f.selection)).toMatchObject({ _tag: "Recorded", outcome: { _tag: "Accepted" } });
      expect(yield* f.sender.send(f.selection)).toMatchObject({ _tag: "ExistingAttempt" });
      expect(yield* Ref.get(f.posts)).toBe(1);
      for (const mode of ["missing", "invented-total", "invented-route", "parent"]) {
        yield* Ref.set(f.mode, mode);
        expect(yield* f.reader.reconcile(f.selection, event.occurrenceId)).toMatchObject({
          _tag: mode === "missing" ? "Missing" : "Mismatch",
        });
        expect(yield* f.sender.ledger.state(event.occurrenceId)).toMatchObject({
          value: { state: "accepted-unverified" },
        });
      }
      yield* Ref.set(f.mode, "valid");
      expect(yield* f.reader.reconcile(f.selection, event.occurrenceId)).toMatchObject({ _tag: "Visible" });
      expect(yield* f.sender.ledger.state(event.occurrenceId)).toMatchObject({ value: { state: "visible" } });
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(layer), { excludeTestServices: true })((it) =>
  it.effect(
    "schedules past rejected pages, resumes occurrences after restart and never resends accepted missing records",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        for (const frame of f.frames) {
          const scheduler = yield* f.reopen();
          expect(yield* scheduler.tick).toMatchObject({
            _tag: "Complete",
            outcomes: [{ _tag: "Sent", eventId: frame.occurrenceId }],
          });
        }
        expect(yield* Ref.get(f.posts)).toBe(2);
        yield* Effect.sleep(120);
        yield* Ref.set(f.mode, "missing");
        const scheduler = yield* f.reopen();
        for (let n = 0; n < 3; n++) yield* scheduler.tick;
        expect(yield* Ref.get(f.posts)).toBe(2);
        for (const frame of f.frames)
          expect(yield* f.sender.ledger.state(frame.occurrenceId)).toMatchObject({
            value: { state: "accepted-unverified", attempts: 1 },
          });
      }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(layer), { excludeTestServices: true })((it) =>
  it.effect("refuses empty selection and retained-payload corruption before reserving or sending", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(
        yield* f.sender.send(NativeDeliveryRequest.make({ ...f.selection, offset: 2 })).pipe(Effect.flip)
      ).toMatchObject({ reason: "empty-selection" });
      yield* f.sql`UPDATE observation_intake_pages SET payload=payload||' ' WHERE receipt_id=${f.receipt.receiptId}`;
      expect(yield* f.sender.send(f.selection).pipe(Effect.flip)).toMatchObject({ reason: "storage" });
      expect(yield* Ref.get(f.posts)).toBe(0);
      expect(yield* f.sql`SELECT attempt_id FROM observation_delivery_attempts`).toEqual([]);
    }).pipe(Effect.scoped)
  )
);

it.layer(Layer.fresh(layer), { excludeTestServices: true })((it) =>
  it.effect("labels missing event time and conflicting sessions without inventing additive usage", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const frame = f.frames[0];
      if (frame === undefined || O.isNone(frame.metadata.usage)) return yield* Effect.die("Invalid synthetic usage");
      for (const basis of ["message", "last-request", "cumulative"] satisfies ReadonlyArray<
        "message" | "last-request" | "cumulative"
      >) {
        const metadata = TranscriptMetadata.make({
          ...frame.metadata,
          sourceTime: O.none(),
          session: { id: frame.metadata.session.id, conflicted: true },
          usage: O.some({ ...frame.metadata.usage.value, basis }),
        });
        const encoded = yield* encodeTranscriptTraceBatch(
          TranscriptExportInput.make({
            ...f.input,
            evidenceEpoch: 1,
            acceptedAtMillis: 1000,
            frames: [TranscriptFrame.cases.Accepted.make({ ...frame, metadata })],
          })
        );
        const span = (yield* decode(encoded.body)).resourceSpans[0].scopeSpans[0].spans[0];
        if (span === undefined) return yield* Effect.die("Missing synthetic output");
        expect(span.startTimeUnixNano).toBe("1000000000");
        expect(span.endTimeUnixNano).toBe(span.startTimeUnixNano);
        expect(attr(span, "ai_metrics.time_basis")).toEqual(O.some({ stringValue: "intake_observation" }));
        expect(attr(span, "ai_metrics.source_start_time_unix_nano")).toEqual(O.none());
        expect(attr(span, "session.id")).toEqual(O.none());
        expect(attr(span, "ai_metrics.session_conflicted")).toEqual(O.some({ boolValue: true }));
        expect(attr(span, "ai_metrics.usage.basis")).toEqual(O.some({ stringValue: basis }));
        expect(attr(span, "ai_metrics.local_evidence_epoch")).toEqual(O.some({ intValue: "1" }));
        expect(attr(span, "llm.token_count.prompt")).toEqual(O.none());
        expect(attr(span, "llm.token_count.total")).toEqual(O.none());
      }
    }).pipe(Effect.scoped)
  )
);
