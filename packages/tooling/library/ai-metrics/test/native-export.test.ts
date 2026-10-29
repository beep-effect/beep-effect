import { encodeNativeTraceBatch, NativeExportInput } from "@beep/repo-ai-metrics/native-export";
import { NativeTraceMetadata, NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Protobuf from "protobufjs";

const id = (char: string) => Sha256Hex.make(Str.repeat(64)(char));
const wire = Protobuf.parse(`syntax="proto3";
message Value { string string_value=1; bool bool_value=2; int64 int_value=3; }
message Attribute { string key=1; Value value=2; }
message Resource { repeated Attribute attributes=1; }
message Span { bytes trace_id=1; bytes span_id=2; bytes parent_span_id=4; string name=5; int32 kind=6; fixed64 start_time_unix_nano=7; fixed64 end_time_unix_nano=8; repeated Attribute attributes=9; }
message ScopeSpans { repeated Span spans=2; }
message ResourceSpans { Resource resource=1; repeated ScopeSpans scope_spans=2; }
message Request { repeated ResourceSpans resource_spans=1; }`).root.lookupType("Request");
const Attribute = S.Struct({
  key: S.String,
  value: S.Struct({
    stringValue: S.optionalKey(S.String),
    intValue: S.optionalKey(S.String),
    boolValue: S.optionalKey(S.Boolean),
  }),
});
const Decoded = S.Struct({
  resourceSpans: S.Tuple([
    S.Struct({
      resource: S.Struct({ attributes: S.Array(Attribute) }),
      scopeSpans: S.Tuple([
        S.Struct({
          spans: S.Array(
            S.Struct({
              traceId: S.Uint8Array,
              spanId: S.Uint8Array,
              parentSpanId: S.optionalKey(S.Uint8Array),
              name: S.String,
              startTimeUnixNano: S.String,
              endTimeUnixNano: S.String,
              attributes: S.Array(Attribute),
            })
          ),
        }),
      ]),
    }),
  ]),
});
const read = (body: Uint8Array) => S.decodeUnknownEffect(Decoded)(wire.toObject(wire.decode(body), { longs: String }));
const attribute = (attrs: ReadonlyArray<typeof Attribute.Type>, key: string) =>
  A.findFirst(attrs, (attr) => attr.key === key).pipe(O.map((attr) => attr.value));
const fixture = Effect.fn("NativeExportTest.fixture")(function* () {
  const body = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: Str.repeat(32)("1"),
                spanId: Str.repeat(16)("2"),
                parentSpanId: Str.repeat(16)("3"),
                name: "claude_code.llm_request",
                startTimeUnixNano: "1793000000000000001",
                endTimeUnixNano: "1793000000000000019",
                attributes: [
                  { key: "input_tokens", value: { intValue: "10" } },
                  { key: "output_tokens", value: { intValue: "5" } },
                  { key: "cache_read_tokens", value: { intValue: "100" } },
                  { key: "cache_creation_tokens", value: { intValue: "20" } },
                  { key: "model", value: { stringValue: "approved-model" } },
                  { key: "session.id", value: { stringValue: "private-session" } },
                  { key: "input.value", value: { stringValue: "private-prompt" } },
                  { key: "user.email", value: { stringValue: "private-email" } },
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
      routeId: id("a"),
      hashSalt: Redacted.make("synthetic-export-salt"),
      contentType: "application/json",
      body: new TextEncoder().encode(body),
      approvedModels: ["approved-model"],
      usageConvention: "claude-code",
    })
  );
  const span = batch.spans[0];
  if (span === undefined) return yield* Effect.die("Invalid fixture");
  const input = NativeExportInput.make({
    hostId: id("b"),
    namespaceId: batch.namespaceId,
    project: "synthetic-foundation",
    acceptedAtMillis: 1793100000000,
    spans: [span],
  });
  const encode = (span: NativeTraceMetadata) =>
    encodeNativeTraceBatch(NativeExportInput.make({ ...input, spans: [span] }));
  return { input, span, encode };
});
it.effect("encodes native Claude identity/time and cache-inclusive totals without retaining private fields", () =>
  Effect.gen(function* () {
    const { input, span } = yield* fixture();
    expect(span.kind).toBe("LLM");
    const encoded = yield* encodeNativeTraceBatch(input);
    expect(yield* encodeNativeTraceBatch(input)).toEqual(encoded);
    const decoded = yield* read(encoded.body);
    const row = decoded.resourceSpans[0].scopeSpans[0].spans[0];
    expect(row).toMatchObject({
      name: "agent.llm",
      startTimeUnixNano: "1793000000000000001",
      endTimeUnixNano: "1793000000000000019",
    });
    if (row === undefined) return;
    expect(Uint8Array.from(row.traceId)).toEqual(new Uint8Array(16).fill(17));
    expect(Uint8Array.from(row.spanId)).toEqual(new Uint8Array(8).fill(34));
    expect(Uint8Array.from(row.parentSpanId ?? [])).toEqual(new Uint8Array(8).fill(51));
    for (const [key, value] of [
      ["prompt", "130"],
      ["completion", "5"],
      ["total", "135"],
      ["prompt_details.cache_read", "100"],
      ["prompt_details.cache_write", "20"],
    ])
      expect(attribute(row.attributes, `llm.token_count.${key}`)).toEqual(O.some({ intValue: value }));
    expect(attribute(row.attributes, "ai_metrics.source_start_time_unix_nano")).toEqual(
      O.some({ stringValue: "1793000000000000001" })
    );
    expect(attribute(row.attributes, "ai_metrics.source_end_time_unix_nano")).toEqual(
      O.some({ stringValue: "1793000000000000019" })
    );
    expect(attribute(row.attributes, "llm.provider")).toEqual(O.none());
    expect(attribute(row.attributes, "llm.model_name")).toEqual(O.some({ stringValue: "approved-model" }));
    expect(attribute(row.attributes, "ai_metrics.duration_known")).toEqual(O.some({ boolValue: true }));
    const text = new TextDecoder().decode(encoded.body);
    expect(text).not.toContain("private-");
    expect(text).not.toContain("claude_code.llm_request");
    expect(encoded.eventIds).toEqual([span.eventId]);
  }).pipe(provideScopedLayer(NodeServices.layer))
);
it.effect("keeps inclusive OpenInference counts separate and refuses invalid cache breakdowns", () =>
  Effect.gen(function* () {
    const { span, encode } = yield* fixture();
    for (const invalid of [false, true]) {
      const encoded = yield* encode(
        NativeTraceMetadata.make({
          ...span,
          usage: { ...span.usage, convention: "openinference", input: O.some(invalid ? 10 : 130) },
        })
      );
      const row = (yield* read(encoded.body)).resourceSpans[0].scopeSpans[0].spans[0];
      if (row === undefined) return;
      expect(attribute(row.attributes, "llm.token_count.prompt")).toEqual(
        invalid ? O.none() : O.some({ intValue: "130" })
      );
      expect(attribute(row.attributes, "llm.token_count.total")).toEqual(
        invalid ? O.none() : O.some({ intValue: "135" })
      );
    }
  }).pipe(provideScopedLayer(NodeServices.layer))
);
it.effect("does not manufacture missing counts, overflow totals, provider identity or durations", () =>
  Effect.gen(function* () {
    const { span, encode } = yield* fixture();
    for (const variant of [
      NativeTraceMetadata.make({ ...span, usage: { ...span.usage, cacheRead: O.none() } }),
      NativeTraceMetadata.make({ ...span, usage: { ...span.usage, input: O.some(Number.MAX_SAFE_INTEGER) } }),
      NativeTraceMetadata.make({ ...span, usage: { ...span.usage, convention: "unknown" } }),
      NativeTraceMetadata.make({ ...span, kind: "AGENT" }),
      NativeTraceMetadata.make({
        ...span,
        usage: {
          ...span.usage,
          convention: "openinference",
          input: O.some(Number.MAX_SAFE_INTEGER),
          cacheRead: O.some(Number.MAX_SAFE_INTEGER),
          cacheWrite: O.some(Number.MAX_SAFE_INTEGER),
        },
      }),
    ]) {
      const row = (yield* read((yield* encode(variant)).body)).resourceSpans[0].scopeSpans[0].spans[0];
      if (row === undefined) return;
      expect(attribute(row.attributes, "llm.token_count.prompt")).toEqual(O.none());
      expect(attribute(row.attributes, "llm.token_count.total")).toEqual(O.none());
    }
    const noTime = NativeTraceMetadata.make({
      ...span,
      startTimeUnixNano: O.none(),
      endTimeUnixNano: O.none(),
      durationKnown: false,
      modelName: O.none(),
    });
    const row = (yield* read((yield* encode(noTime)).body)).resourceSpans[0].scopeSpans[0].spans[0];
    if (row === undefined) return;
    expect(row.startTimeUnixNano).toBe("1793100000000000000");
    expect(row.endTimeUnixNano).toBe(row.startTimeUnixNano);
    expect(attribute(row.attributes, "ai_metrics.duration_known")).toEqual(O.some({ boolValue: false }));
    expect(attribute(row.attributes, "ai_metrics.time_basis")).toEqual(O.some({ stringValue: "intake_observation" }));
    expect(attribute(row.attributes, "llm.model_name")).toEqual(O.none());
    expect(attribute(row.attributes, "ai_metrics.source_start_time_unix_nano")).toEqual(O.none());
    expect(attribute(row.attributes, "ai_metrics.source_end_time_unix_nano")).toEqual(O.none());
  }).pipe(provideScopedLayer(NodeServices.layer))
);

it.effect("labels retired local history and current-epoch duplicate scope without changing source identity", () =>
  Effect.gen(function* () {
    const { input } = yield* fixture();
    const original = yield* read((yield* encodeNativeTraceBatch(input)).body);
    const encoded = yield* encodeNativeTraceBatch(NativeExportInput.make({ ...input, evidenceEpoch: 2 }));
    const decoded = yield* read(encoded.body);
    const first = original.resourceSpans[0].scopeSpans[0].spans[0];
    const next = decoded.resourceSpans[0].scopeSpans[0].spans[0];
    if (first === undefined || next === undefined) return yield* Effect.die("Missing fixture span");
    expect(next.traceId).toEqual(first.traceId);
    expect(next.spanId).toEqual(first.spanId);
    expect(next.startTimeUnixNano).toBe(first.startTimeUnixNano);
    expect(attribute(next.attributes, "ai_metrics.local_evidence_epoch")).toEqual(O.some({ intValue: "2" }));
    expect(attribute(next.attributes, "ai_metrics.duplicate_detection_scope")).toEqual(
      O.some({ stringValue: "current_epoch" })
    );
    expect(attribute(next.attributes, "ai_metrics.prior_local_history_retired")).toEqual(O.some({ boolValue: true }));
    expect(attribute(first.attributes, "ai_metrics.local_evidence_epoch")).toEqual(O.none());
  }).pipe(provideScopedLayer(NodeServices.layer))
);

it.effect("exports clear synthetic surface names without asserting real harness coverage", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const original = yield* read((yield* f.encode(f.span)).body);
    const row = original.resourceSpans[0].scopeSpans[0].spans[0];
    if (row === undefined) return yield* Effect.die("Missing fixture span");
    expect(row.name).toBe("agent.llm");
    expect(attribute(row.attributes, "ai_metrics.synthetic")).toEqual(O.none());
    for (const surface of S.Literals(["cli", "desktop"]).literals) {
      const encoded = yield* f.encode(NativeTraceMetadata.make({ ...f.span, fixtureSurface: O.some(surface) }));
      const decoded = yield* read(encoded.body);
      const labelled = decoded.resourceSpans[0].scopeSpans[0].spans[0];
      if (labelled === undefined) return yield* Effect.die("Missing labelled fixture span");
      expect(labelled.name).toBe(`fixture.${surface}.llm`);
      expect(attribute(labelled.attributes, "ai_metrics.synthetic")).toEqual(O.some({ boolValue: true }));
      expect(attribute(labelled.attributes, "ai_metrics.fixture.surface")).toEqual(O.some({ stringValue: surface }));
      expect(attribute(labelled.attributes, "ai_metrics.fixture.provenance")).toEqual(
        O.some({ stringValue: "declared_synthetic_fixture" })
      );
      expect(labelled.traceId).toEqual(row.traceId);
      expect(labelled.spanId).toEqual(row.spanId);
      expect(attribute(labelled.attributes, "session.id")).toEqual(attribute(row.attributes, "session.id"));
    }
  }).pipe(provideScopedLayer(NodeServices.layer))
);
