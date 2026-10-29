import { Sha256Hex } from "@beep/schema";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Protobuf from "protobufjs";

// Selective OTLP proto v1.9.0 wire shape. Recursive AnyValue bodies stay opaque.
const wireSchema = `syntax = "proto3";
message AnyValue { string string_value = 1; bool bool_value = 2; int64 int_value = 3; double double_value = 4;
  bytes array_value = 5; bytes kvlist_value = 6; bytes bytes_value = 7; }
message KeyValue { string key = 1; AnyValue value = 2; }
message Resource { repeated KeyValue attributes = 1; }
message Status { int32 code = 3; }
message Span { bytes trace_id = 1; bytes span_id = 2; bytes parent_span_id = 4; string name = 5;
  fixed64 start_time_unix_nano = 7; fixed64 end_time_unix_nano = 8; repeated KeyValue attributes = 9; Status status = 15; int32 kind = 6; }
message Scope { string name = 1; string version = 2; }
message ScopeSpans { Scope scope = 1; repeated Span spans = 2; }
message ResourceSpans { Resource resource = 1; repeated ScopeSpans scope_spans = 2; }
message ExportTraceServiceRequest { repeated ResourceSpans resource_spans = 1; }`;

export const nativeTraceWire = Protobuf.parse(wireSchema).root.lookupType("ExportTraceServiceRequest");

/** Encode an already allowlisted string as the OTLP string-value wire field. */
export const otlpStringAttribute = (key: string, stringValue: string) => ({ key, value: { stringValue } });

/** Encode an already validated integer as decimal text for the protobuf int64 field. */
export const otlpIntegerAttribute = (key: string, value: number) => ({ key, value: { intValue: `${value}` } });

/** Encode an already allowlisted boolean as the OTLP boolean-value wire field. */
export const otlpBooleanAttribute = (key: string, boolValue: boolean) => ({ key, value: { boolValue } });

/** Wrap positively projected spans in the shared observation resource envelope. */
export const encodeObservationTraceWire = Effect.fnUntraced(function* (
  project: string,
  hostId: Sha256Hex,
  namespaceId: Sha256Hex,
  version: string,
  spans: ReadonlyArray<unknown>
) {
  return yield* Effect.try(() =>
    nativeTraceWire
      .encode({
        resourceSpans: [
          {
            resource: {
              attributes: [
                otlpStringAttribute("service.name", "beep-agent-observability"),
                otlpStringAttribute("openinference.project.name", project),
                otlpStringAttribute("ai_metrics.host_id", hostId),
                otlpStringAttribute("ai_metrics.namespace_id", namespaceId),
              ],
            },
            scopeSpans: [{ scope: { name: "beep.agent-observation", version }, spans }],
          },
        ],
      })
      .finish()
  );
});

const decodeSha256Hex = S.decodeUnknownEffect(Sha256Hex);

/** Hash the exact emitted bytes; callers translate failures to their safe export error. */
export const hashObservationPayload = Effect.fnUntraced(function* (body: Uint8Array) {
  const crypto = yield* Crypto.Crypto;
  return yield* crypto.digest("SHA-256", body).pipe(Effect.map(Hex.encode), Effect.flatMap(decodeSha256Hex));
});
