import { DeliveryHttpReply, interpretDeliveryHttpReply } from "@beep/repo-ai-metrics/delivery-response";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Protobuf from "protobufjs";

const wire = Protobuf.parse(
  'syntax="proto3"; message Response { Partial partial_success=1; } message Partial { int64 rejected_spans=1; string error_message=2; }'
).root.lookupType("Response");
const jsonReply = (body: string, status = 200) =>
  DeliveryHttpReply.make({
    status,
    body: new TextEncoder().encode(body),
    requestContentType: "application/json",
    responseContentType: "application/json",
    sentSpans: 2,
  });
const protoReply = (body: Uint8Array) =>
  DeliveryHttpReply.make({
    status: 200,
    body,
    requestContentType: "application/x-protobuf",
    responseContentType: "application/x-protobuf",
    sentSpans: 2,
  });
it.effect("distinguishes full and partial 200 replies in both encodings without retaining server text", () =>
  Effect.gen(function* () {
    for (const body of [
      "{}",
      '{"partialSuccess":{}}',
      '{"partialSuccess":{"rejectedSpans":"0","errorMessage":"private-warning"}}',
    ])
      expect(yield* interpretDeliveryHttpReply(jsonReply(body))).toEqual({ _tag: "Accepted" });
    expect(yield* interpretDeliveryHttpReply(protoReply(new Uint8Array()))).toEqual({ _tag: "Accepted" });
    for (const rejected of [1, 2]) {
      expect(
        yield* interpretDeliveryHttpReply(
          jsonReply(`{"partialSuccess":{"rejectedSpans":"${rejected}","errorMessage":"private-response"}}`)
        )
      ).toEqual({ _tag: "Partial", rejectedCount: rejected });
      expect(
        yield* interpretDeliveryHttpReply(
          protoReply(
            wire.encode({ partialSuccess: { rejectedSpans: rejected, errorMessage: "private-response" } }).finish()
          )
        )
      ).toEqual({ _tag: "Partial", rejectedCount: rejected });
    }
  })
);
it.effect("keeps malformed, mismatched and impossible successful replies unknown", () =>
  Effect.gen(function* () {
    for (const body of [
      "",
      "private-garbage",
      '{"partialSuccess":{"rejectedSpans":-1}}',
      '{"partialSuccess":{"rejectedSpans":1.5}}',
      '{"partialSuccess":{"rejectedSpans":"999"}}',
      '{"partialSuccess":{"rejectedSpans":"3"}}',
      '{"partialSuccess":null}',
      "null",
      "[]",
    ])
      expect(yield* interpretDeliveryHttpReply(jsonReply(body))).toEqual({
        _tag: "Unknown",
        reason: "invalid-response",
      });
    for (const body of [
      new Uint8Array([255]),
      wire.encode({ partialSuccess: { rejectedSpans: -1 } }).finish(),
      wire.encode({ partialSuccess: { rejectedSpans: 3 } }).finish(),
    ])
      expect(yield* interpretDeliveryHttpReply(protoReply(body))).toEqual({
        _tag: "Unknown",
        reason: "invalid-response",
      });
    expect(
      yield* interpretDeliveryHttpReply(DeliveryHttpReply.make({ ...jsonReply("{}"), body: new Uint8Array([255]) }))
    ).toEqual({ _tag: "Unknown", reason: "invalid-response" });
    expect(
      yield* interpretDeliveryHttpReply(DeliveryHttpReply.make({ ...jsonReply("{}"), responseContentType: "other" }))
    ).toEqual({ _tag: "Unknown", reason: "invalid-response" });
    expect(
      yield* interpretDeliveryHttpReply(
        DeliveryHttpReply.make({ ...jsonReply("{}"), responseContentType: "application/x-protobuf" })
      )
    ).toEqual({ _tag: "Unknown", reason: "invalid-response" });
    expect(S.is(DeliveryHttpReply)({ ...jsonReply("{}"), body: new Uint8Array(65537) })).toBe(false);
  })
);
it.effect("classifies retryable and permanent HTTP refusals without trusting error response bodies", () =>
  Effect.gen(function* () {
    for (const status of [429, 502, 503, 504])
      expect(yield* interpretDeliveryHttpReply(jsonReply("private-error", status))).toEqual({
        _tag: "Retryable",
        status,
      });
    for (const status of [400, 401, 403, 404, 413, 415, 422, 500, 501])
      expect(yield* interpretDeliveryHttpReply(jsonReply("private-error", status))).toEqual({
        _tag: "Rejected",
        status,
      });
    for (const status of [201, 202, 204, 301, 302, 307])
      expect(yield* interpretDeliveryHttpReply(jsonReply("{}", status))).toEqual({
        _tag: "Unknown",
        reason: "invalid-response",
      });
  })
);
