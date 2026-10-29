import {
  NativeTraceBatch,
  NativeTraceMetadata,
  NativeTraceRequest,
  projectNativeTraceRequest,
} from "@beep/repo-ai-metrics/native-trace";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Protobuf from "protobufjs";

const routeId = Sha256Hex.make(Str.repeat(64)("a"));
const text = (key: string, stringValue: string) => ({ key, value: { stringValue } });
const count = (key: string, intValue: number | string) => ({ key, value: { intValue } });
const span = {
  traceId: Str.repeat(32)("1"),
  spanId: Str.repeat(16)("2"),
  parentSpanId: Str.repeat(16)("3"),
  name: "private-span-name",
  startTimeUnixNano: "1793000000000000001",
  endTimeUnixNano: "1793000000000000009",
  status: { code: 2, message: "private-exception-message" },
  attributes: [
    text("session.id", "private-session-id"),
    text("openinference.span.kind", "LLM"),
    text("llm.model_name", "claude-opus-5-5"),
    text("model", "claude-opus-5-5"),
    count("input_tokens", "100"),
    count("output_tokens", 20),
    count("cache_read_tokens", 30),
    count("cache_creation_tokens", 40),
    text("input.value", "private-prompt"),
    text("output.value", "private-completion"),
    text("tool.parameters", "private-tool-body"),
    text("user.email", "private-email@example.invalid"),
  ],
  events: [{ name: "private-event", attributes: [text("exception.message", "private-exception")] }],
  links: [{ attributes: [text("secret", "private-link")] }],
};
const envelope = (spans: ReadonlyArray<unknown>) => ({
  resourceSpans: [
    { resource: { attributes: [text("process.command_args", "private-command-line")] }, scopeSpans: [{ spans }] },
  ],
});
const request = (body: Uint8Array, contentType: NativeTraceRequest["contentType"] = "application/json") =>
  NativeTraceRequest.make({
    routeId,
    hashSalt: Redacted.make("synthetic-native-salt"),
    contentType,
    body,
    approvedModels: ["claude-opus-5-5"],
    usageConvention: "claude-code",
  });
const jsonRequest = (value: unknown) =>
  S.encodeEffect(S.fromJsonString(S.Unknown))(value).pipe(
    Effect.map((value) => request(new TextEncoder().encode(value)))
  );

it.layer(NodeServices.layer)((it) => {
  it.effect("keeps native IDs, exact times and usage categories while discarding private payloads", () =>
    Effect.gen(function* () {
      const input = yield* jsonRequest(envelope([span]));
      const batch = yield* projectNativeTraceRequest(input);
      expect(batch.rejections).toEqual([]);
      expect(batch.spans).toHaveLength(1);
      expect(batch.spans[0]).toMatchObject({
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: O.some(span.parentSpanId),
        startTimeUnixNano: O.some(span.startTimeUnixNano),
        endTimeUnixNano: O.some(span.endTimeUnixNano),
        durationKnown: true,
        kind: "LLM",
        status: "error",
        modelName: O.some("claude-opus-5-5"),
        usage: {
          convention: "claude-code",
          input: O.some(100),
          output: O.some(20),
          cacheRead: O.some(30),
          cacheWrite: O.some(40),
        },
      });
      const serialized = yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(batch);
      expect(serialized).not.toContain("private-");
      expect(serialized).not.toContain("synthetic-native-salt");
      expect(serialized).not.toContain("input.value");
      expect(yield* projectNativeTraceRequest(input)).toEqual(batch);
      const anotherRoute = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({ ...input, routeId: Sha256Hex.make(Str.repeat(64)("b")) })
      );
      expect(anotherRoute.spans[0]?.eventId).not.toBe(batch.spans[0]?.eventId);
    })
  );

  it.effect("rejects invalid spans individually and never echoes rejected values", () =>
    Effect.gen(function* () {
      const batch = yield* projectNativeTraceRequest(
        yield* jsonRequest(
          envelope([
            { ...span, traceId: "private-invalid-id" },
            { ...span, endTimeUnixNano: "1" },
            { ...span, startTimeUnixNano: "18446744073709551616" },
            { ...span, attributes: [text("session.id", "private-one"), text("session.id", "private-two")] },
            { ...span, attributes: [count("input_tokens", "9007199254740992")] },
            { ...span, startTimeUnixNano: "0xFF" },
            {
              ...span,
              attributes: [{ key: "model", value: { stringValue: "private-model", arrayValue: { values: [] } } }],
            },
            span,
          ])
        )
      );
      expect(batch.spans).toHaveLength(1);
      expect(A.map(batch.rejections, (rejection) => rejection.ordinal)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(batch)).not.toContain("private-");
    })
  );

  it.effect("accepts case-insensitive hexadecimal IDs and preserves the unsigned timestamp boundary", () =>
    Effect.gen(function* () {
      const batch = yield* projectNativeTraceRequest(
        yield* jsonRequest(
          envelope([
            {
              ...span,
              traceId: Str.repeat(16)("AB"),
              spanId: Str.repeat(8)("CD"),
              endTimeUnixNano: "18446744073709551615",
            },
          ])
        )
      );
      expect(batch.spans[0]).toMatchObject({
        traceId: Str.repeat(16)("ab"),
        spanId: Str.repeat(8)("cd"),
        endTimeUnixNano: O.some("18446744073709551615"),
      });
      expect(S.is(NativeTraceMetadata)({ ...batch.spans[0], startTimeUnixNano: O.some("invalid") })).toBe(false);
      expect(S.is(NativeTraceMetadata)({ ...batch.spans[0], durationKnown: false })).toBe(false);
    })
  );

  it.effect("keeps absent measurements unknown, explicit zero usage intact and unapproved model names hashed", () =>
    Effect.gen(function* () {
      const batch = yield* projectNativeTraceRequest(
        yield* jsonRequest(
          envelope([
            {
              traceId: span.traceId,
              spanId: span.spanId,
              startTimeUnixNano: "0",
              endTimeUnixNano: "0",
              attributes: [text("model", "private-custom-model"), count("input_tokens", 0)],
            },
          ])
        )
      );
      expect(batch.spans[0]).toMatchObject({
        startTimeUnixNano: O.none(),
        endTimeUnixNano: O.none(),
        durationKnown: false,
        status: "unset",
        kind: "UNKNOWN",
        modelName: O.none(),
        sessionHash: O.none(),
        usage: { input: O.some(0), output: O.none(), cacheRead: O.none(), cacheWrite: O.none() },
      });
      expect(O.isSome(batch.spans[0]?.modelHash ?? O.none())).toBe(true);
      expect(yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(batch)).not.toContain("private-");
    })
  );

  it.effect("distinguishes OpenInference inclusive prompt counters from Claude native categories", () =>
    Effect.gen(function* () {
      const input = yield* jsonRequest(
        envelope([
          {
            ...span,
            attributes: [
              count("llm.token_count.prompt", 170),
              count("llm.token_count.completion", 20),
              count("llm.token_count.prompt_details.cache_read", 30),
              count("llm.token_count.prompt_details.cache_write", 40),
              count("input_tokens", 100),
            ],
          },
        ])
      );
      const batch = yield* projectNativeTraceRequest(
        NativeTraceRequest.make({ ...input, usageConvention: "openinference" })
      );
      expect(batch.spans[0]?.usage).toEqual({
        convention: "openinference",
        input: O.some(170),
        output: O.some(20),
        cacheRead: O.some(30),
        cacheWrite: O.some(40),
      });
    })
  );

  it.effect("rejects malformed envelopes, invalid UTF-8 and excessive record populations", () =>
    Effect.gen(function* () {
      expect((yield* projectNativeTraceRequest(request(new Uint8Array([255]))).pipe(Effect.flip)).reason).toBe(
        "invalid-envelope"
      );
      expect(
        (yield* projectNativeTraceRequest(request(new Uint8Array([10, 255]), "application/x-protobuf")).pipe(
          Effect.flip
        )).reason
      ).toBe("invalid-envelope");
      const many = {
        resourceSpans: [{ scopeSpans: [{ spans: A.replicate({}, 600) }, { spans: A.replicate({}, 600) }] }],
      };
      expect((yield* projectNativeTraceRequest(yield* jsonRequest(many)).pipe(Effect.flip)).reason).toBe(
        "too-many-spans"
      );
      const input = yield* jsonRequest({});
      expect(
        (yield* projectNativeTraceRequest(NativeTraceRequest.make({ ...input, hashSalt: Redacted.make(" ") })).pipe(
          Effect.flip
        )).reason
      ).toBe("missing-salt");
      expect(S.is(NativeTraceRequest)({ ...input, body: new Uint8Array(262145) })).toBe(false);
      expect((yield* projectNativeTraceRequest(input)).spans).toEqual([]);
    })
  );

  it.effect("decodes real protobuf field numbers and skips nested content-bearing fields", () =>
    Effect.gen(function* () {
      // Independent full-content fixture schema includes fields omitted by the positive decoder.
      const type = Protobuf.parse(`syntax = "proto3";
      message Value { string string_value=1; int64 int_value=3; ArrayValue array_value=5; }
      message ArrayValue { repeated Value values=1; }
      message Attribute { string key=1; Value value=2; }
      message Event { string name=2; repeated Attribute attributes=3; }
      message Status { string message=2; int32 code=3; }
      message Span { bytes trace_id=1; bytes span_id=2; bytes parent_span_id=4; string name=5; fixed64 start_time_unix_nano=7; fixed64 end_time_unix_nano=8; repeated Attribute attributes=9; repeated Event events=11; Status status=15; }
      message Scope { repeated Span spans=2; }
      message Resource { repeated Attribute attributes=1; }
      message Group { Resource resource=1; repeated Scope scope_spans=2; }
      message Request { repeated Group resource_spans=1; }`).root.lookupType("Request");
      const native = {
        ...span,
        traceId: new Uint8Array(16).fill(17),
        spanId: new Uint8Array(8).fill(34),
        parentSpanId: new Uint8Array(8).fill(51),
        attributes: [
          ...span.attributes,
          { key: "private-recursive", value: { arrayValue: { values: [{ stringValue: "private-nested" }] } } },
        ],
      };
      const bytes = type.encode(type.fromObject(envelope([native]))).finish();
      const binary = yield* projectNativeTraceRequest(request(bytes, "application/x-protobuf"));
      const json = yield* projectNativeTraceRequest(yield* jsonRequest(envelope([span])));
      expect(binary.spans).toEqual(json.spans);
      expect(binary.rejections).toEqual([]);
      expect(yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(binary)).not.toContain("private-");
    })
  );
  it.effect("only preserves finite synthetic surface labels on an explicitly enabled fixture route", () =>
    Effect.gen(function* () {
      const original = yield* projectNativeTraceRequest(yield* jsonRequest(envelope([span])));
      for (const surface of ["cli", "desktop", "private-unapproved"]) {
        const input = yield* jsonRequest(
          envelope([{ ...span, attributes: [...span.attributes, text("beep.fixture.surface", surface)] }])
        );
        const disabled = yield* projectNativeTraceRequest(input);
        expect(disabled.spans).toEqual(original.spans);
        expect(yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(disabled)).not.toContain("fixtureSurface");
        const enabled = yield* projectNativeTraceRequest(
          NativeTraceRequest.make({ ...input, syntheticFixtureMetadata: O.some(true) })
        );
        if (surface === "private-unapproved") {
          expect(enabled.spans).toEqual([]);
          expect(enabled.rejections).toEqual([{ ordinal: 0, reason: "invalid-span" }]);
        } else {
          expect(enabled.spans[0]?.fixtureSurface).toEqual(O.some(surface));
          expect(enabled.spans[0]?.eventId).toBe(original.spans[0]?.eventId);
          expect(yield* S.encodeEffect(S.fromJsonString(NativeTraceBatch))(enabled)).not.toContain("private-");
        }
      }
    })
  );
});
