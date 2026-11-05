import {
  AcpError,
  AcpInputStreamEndedError,
  AcpProcessExitedError,
  AcpProtocolParseError,
  AcpRequestDiagnostics,
  AcpRequestError,
  AcpTransportError,
} from "@beep/acp/errors";
import { callRpc } from "@beep/acp/internal/shared";
import * as AcpSchema from "@beep/acp/schema";
import { fcRuns } from "@beep/test-utils";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as RpcClientError from "effect/rpc/RpcClientError";
import * as S from "effect/Schema";

const decodeNestedNumberPayload = S.decodeUnknownEffect(S.Struct({ profile: S.Struct({ token: S.Finite }) }));
const decodeUpdateAndEnv = S.decodeUnknownEffect(
  S.Struct({
    update: S.Struct({ used: S.Finite, size: S.Finite }),
    env: S.Record(S.String, S.Finite),
  })
);
const decodeManyNumbers = S.decodeUnknownEffect(
  S.Struct({ a: S.Finite, b: S.Finite, c: S.Finite, d: S.Finite, e: S.Finite })
);
const encodeUnknownJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeRequestErrorJson = S.encodeEffect(S.fromJsonString(AcpRequestError));
const encodeParseErrorJson = S.encodeEffect(S.fromJsonString(AcpProtocolParseError));
const isAcpError = S.is(AcpError);
const SecretPayload = S.Struct({ profile: S.Struct({ token: S.String }) });
const SecretPayloadArbitrary = Arbitrary.schema(SecretPayload);
const SECRET_MARKER = "acp-property-secret:";

const withoutRequestCause = (error: AcpRequestError): AcpRequestError =>
  AcpRequestError.make({
    code: error.code,
    data: error.data,
    errorMessage: error.errorMessage,
    issueCount: error.issueCount,
    issueKinds: error.issueKinds,
    maximumPathDepth: error.maximumPathDepth,
    method: error.method,
    operation: error.operation,
    requestId: error.requestId,
  });

const withoutParseCause = (error: AcpProtocolParseError): AcpProtocolParseError =>
  AcpProtocolParseError.make({
    issueCount: error.issueCount,
    issueKinds: error.issueKinds,
    issueSummary: error.issueSummary,
    maximumPathDepth: error.maximumPathDepth,
    method: error.method,
    operation: error.operation,
    requestId: error.requestId,
  });

const requestDiagnosticsJson = flow(withoutRequestCause, encodeRequestErrorJson);
const parseDiagnosticsJson = flow(withoutParseCause, encodeParseErrorJson);

describe("ACP errors", () => {
  it.effect("callRpc keeps the method and the client error without deriving the message from the cause", () =>
    Effect.gen(function* () {
      const rootCause = new Error("connection details that must not become the public message");
      const failure = RpcClientError.RpcClientError.make({
        reason: RpcClientError.RpcClientDefect.make({ message: rootCause.message, cause: rootCause }),
      });

      const error = yield* Effect.fail(failure).pipe(callRpc("session/new"), Effect.flip);

      if (error._tag !== "AcpTransportError") {
        return assert.fail("expected a transport error");
      }
      assert.deepStrictEqual(error.operation, O.some("call-rpc"));
      assert.deepStrictEqual(error.method, O.some("session/new"));
      assert.strictEqual(O.getOrThrow(error.cause), failure);
      assert.strictEqual(error.message, "ACP transport operation call-rpc failed for method session/new.");
      assert.notInclude(error.message, rootCause.message);
    })
  );

  it.effect("callRpc fails with the ACP error that an RPC client defect carries", () =>
    Effect.gen(function* () {
      const original = AcpTransportError.make({ detail: O.some("Sign in to the agent.") });
      const failure = RpcClientError.RpcClientError.make({
        reason: RpcClientError.RpcClientDefect.make({ message: "ACP protocol terminated.", cause: original }),
      });

      const pipe1 = yield* callRpc(Effect.fail(failure), "initialize").pipe(Effect.flip);
      assert.strictEqual(pipe1, original);
    })
  );

  it.effect("callRpc correlates a protocol error with the method", () =>
    Effect.gen(function* () {
      const error = yield* Effect.fail(AcpSchema.Error.make({ code: -32602, message: "Invalid params" })).pipe(
        callRpc("session/prompt"),
        Effect.flip
      );

      if (error._tag !== "AcpRequestError") {
        return assert.fail("expected a request error");
      }
      assert.strictEqual(error.code, -32602);
      assert.strictEqual(error.errorMessage, "Invalid params");
      assert.deepStrictEqual(error.method, O.some("session/prompt"));
    })
  );

  it("names the transport operation and method without deriving the message from the cause", () => {
    const rootCause = new Error("connection details that must not become the public message");
    const error = AcpTransportError.make({
      cause: O.some(rootCause),
      method: O.some("session/new"),
      operation: O.some("call-rpc"),
    });

    assert.strictEqual(error.message, "ACP transport operation call-rpc failed for method session/new.");
    assert.notInclude(error.message, rootCause.message);
  });

  it("includes the authored detail but not the cause in the transport message", () => {
    const cause = new Error("connection refused at a private endpoint");
    const error = AcpTransportError.make({
      cause: O.some(cause),
      detail: O.some("ACP replay did not consume all frames."),
    });

    assert.strictEqual(error.message, "ACP transport operation failed: ACP replay did not consume all frames.");
    assert.deepStrictEqual(error.cause, O.some(cause));
  });

  it("gives a bare transport error a non-empty message", () => {
    assert.strictEqual(AcpTransportError.make({}).message, "ACP transport operation failed.");
    assert.strictEqual(
      AcpTransportError.make({ detail: O.some(""), method: O.some("") }).message,
      "ACP transport operation failed."
    );
  });

  it("describes process exits by signal, code and stderr excerpt", () => {
    assert.strictEqual(AcpProcessExitedError.make({}).message, "ACP process exited");
    assert.strictEqual(AcpProcessExitedError.make({ code: O.some(7) }).message, "ACP process exited with code 7");
    assert.strictEqual(
      AcpProcessExitedError.make({ code: O.some(7), signal: O.some("SIGTERM"), pid: O.some(42) }).message,
      "ACP process exited after signal SIGTERM"
    );
    assert.strictEqual(
      AcpProcessExitedError.make({ code: O.some(1), stderr: O.some("  auth failed\n") }).message,
      "ACP process exited with code 1\nauth failed"
    );
    assert.strictEqual(
      AcpProcessExitedError.make({ code: O.some(1), stderr: O.some(" \n ") }).message,
      "ACP process exited with code 1"
    );
  });

  it("reports an ended input stream as its own union member", () => {
    const error = AcpInputStreamEndedError.make({});

    assert.strictEqual(error.message, "ACP input stream ended.");
    assert.isTrue(isAcpError(error));
    assert.isTrue(AcpError.guards.AcpInputStreamEndedError(error));
  });

  it("preserves structured extension handler failures behind stable request errors", () => {
    const cause = AcpTransportError.make({
      cause: O.some(new Error("private transport diagnostics")),
      operation: O.some("read-input-stream"),
    });
    const error = AcpRequestError.fromExtensionHandlerError(cause, "x/test");

    assert.strictEqual(error.code, -32603);
    assert.deepStrictEqual(error.method, O.some("x/test"));
    assert.deepStrictEqual(error.operation, O.some("handle-extension-request"));
    assert.deepStrictEqual(error.cause, O.some(cause));
    assert.strictEqual(error.message, "ACP extension request handler failed for method 'x/test'");
    assert.notInclude(error.message, cause.message);
    assert.deepStrictEqual(error.toProtocolError(), {
      code: -32603,
      message: "ACP extension request handler failed for method 'x/test'",
    });
  });

  it("passes request errors through handler mapping and supports the data-last form", () => {
    const original = AcpRequestError.invalidParams("bad params");
    const failure = AcpProtocolParseError.make({ operation: "decode-wire-message" });
    const mapped = AcpRequestError.fromCoreHandlerError("session/new")(failure);

    assert.strictEqual(AcpRequestError.fromCoreHandlerError(original, "session/new"), original);
    assert.strictEqual(AcpRequestError.fromExtensionHandlerError("x/test")(original), original);
    assert.strictEqual(mapped.code, -32603);
    assert.strictEqual(mapped.message, "ACP request handler failed for method 'session/new'");
    assert.deepStrictEqual(mapped.operation, O.some("handle-request"));
    assert.deepStrictEqual(mapped.cause, O.some(failure));
  });

  it("correlates protocol errors with their request and keeps the payload as the default cause", () => {
    const payload = { code: -32601, message: "Method not found" };
    const correlated = AcpRequestError.fromProtocolError(
      payload,
      AcpRequestDiagnostics.make({ method: O.some("session/new"), requestId: O.some(1_073_741_824) })
    );
    const bare = AcpRequestError.fromProtocolError({ code: -32000, message: "Sign in", data: { url: "x" } });

    assert.strictEqual(correlated.message, "Method not found");
    assert.deepStrictEqual(correlated.method, O.some("session/new"));
    assert.deepStrictEqual(correlated.requestId, O.some(1_073_741_824));
    assert.deepStrictEqual(correlated.operation, O.some("receive-response"));
    assert.deepStrictEqual(correlated.cause, O.some(payload));
    assert.deepStrictEqual(bare.data, O.some({ url: "x" }));
    assertNone(bare.method);
    assert.deepStrictEqual(bare.toProtocolError(), { code: -32000, message: "Sign in", data: { url: "x" } });
  });

  it("builds stable internal errors for extension response failures", () => {
    const encodingCause = AcpProtocolParseError.fromEncodingError("x/test", "req-1", "not serializable");
    const failure = AcpRequestError.fromExtensionResponseFailure("x/test", 2, "peer closed");
    const encoding = AcpRequestError.fromExtensionResponseEncodingError("x/test", "req-1", encodingCause);
    const streaming = AcpRequestError.unsupportedStreamingResponse("x/test", 3);

    assert.strictEqual(failure.message, "Extension request failed");
    assert.deepStrictEqual(failure.operation, O.some("receive-response"));
    assert.deepStrictEqual(failure.requestId, O.some(2));
    assert.strictEqual(encoding.message, "Internal error");
    assert.deepStrictEqual(encoding.operation, O.some("encode-extension-response"));
    assert.deepStrictEqual(encoding.cause, O.some(encodingCause));
    assert.strictEqual(streaming.message, "Streaming extension responses are not supported");
    assert.deepStrictEqual(streaming.operation, O.some("receive-streaming-response"));
    assertNone(streaming.cause);
    for (const error of [failure, encoding, streaming]) {
      assert.strictEqual(error.code, -32603);
      assert.deepStrictEqual(error.method, O.some("x/test"));
    }

    assert.strictEqual(encodingCause.message, "ACP protocol operation 'encode-message' failed for method 'x/test'.");
    assert.deepStrictEqual(encodingCause.requestId, O.some("req-1"));
    assertNone(AcpProtocolParseError.fromEncodingError(undefined, undefined, "boom").method);
  });

  it.effect("keeps invalid extension payload values only in the exact schema cause", () =>
    Effect.gen(function* () {
      const secret = "acp-schema-payload-secret";
      const cause = yield* decodeNestedNumberPayload({ profile: { token: secret } }).pipe(Effect.flip);
      const error = AcpRequestError.invalidExtensionPayload("x/private", cause);

      assert.deepStrictEqual(error.cause, O.some(cause));
      assert.strictEqual(error.code, -32602);
      assert.deepStrictEqual(error.method, O.some("x/private"));
      assert.deepStrictEqual(error.operation, O.some("decode-extension-request-payload"));
      assert.deepStrictEqual(error.maximumPathDepth, O.some(2));
      assert.isTrue(O.getOrElse(error.issueCount, () => 0) > 0);
      assert.include(
        O.getOrElse(error.issueKinds, () => []),
        "Pointer"
      );
      assert.strictEqual(error.message, "Invalid payload for ACP extension method 'x/private'.");
      assert.notInclude(error.message, secret);
      const requestDiagnosticsJson2 = yield* requestDiagnosticsJson(error);
      assert.notInclude(requestDiagnosticsJson2, secret);
      const encodedUnknownJson = yield* encodeUnknownJson(error.toProtocolError());
      assert.notInclude(encodedUnknownJson, secret);
      assert.deepStrictEqual(error.toProtocolError().data, {
        issueCount: O.getOrThrow(error.issueCount),
        issueKinds: O.getOrThrow(error.issueKinds),
        maximumPathDepth: 2,
      });

      const protocolError = AcpProtocolParseError.fromSchemaError("decode-notification-payload", "x/private", cause);
      assert.deepStrictEqual(protocolError.cause, O.some(cause));
      assert.deepStrictEqual(protocolError.method, O.some("x/private"));
      assert.strictEqual(protocolError.operation, "decode-notification-payload");
      assert.deepStrictEqual(protocolError.maximumPathDepth, O.some(2));
      assert.notInclude(protocolError.message, secret);
      const parsedDiagnosticsJson = yield* parseDiagnosticsJson(protocolError);
      assert.notInclude(parsedDiagnosticsJson, secret);
      assert.isFalse("detail" in protocolError);
    })
  );

  it.effect("summarizes schema issues by path without payload values", () =>
    Effect.gen(function* () {
      const secret = "acp-summary-secret";
      const cause = yield* decodeUpdateAndEnv(
        { update: { size: secret }, env: { [`${secret} key`]: secret } },
        { errors: "all" }
      ).pipe(Effect.flip);
      const error = AcpProtocolParseError.fromSchemaError("decode-notification-payload", "session/update", cause);

      assert.deepStrictEqual(
        error.issueSummary,
        O.some("update.used missing, update.size wrong type, env.* wrong type")
      );
      assert.strictEqual(
        error.message,
        "ACP protocol operation 'decode-notification-payload' failed for method 'session/update': update.used missing, update.size wrong type, env.* wrong type."
      );
      assert.notInclude(error.message, secret);
    })
  );

  it.effect("caps the issue summary and counts the hidden entries", () =>
    Effect.gen(function* () {
      const cause = yield* decodeManyNumbers({}, { errors: "all" }).pipe(Effect.flip);
      const error = AcpProtocolParseError.fromSchemaError("decode-wire-message", "x/many", cause);

      assert.deepStrictEqual(error.issueSummary, O.some("a missing, b missing, c missing (+2 more)"));
    })
  );

  it.effect.prop(
    "never echoes schema-derived payload values outside the schema cause",
    [SecretPayloadArbitrary],
    Effect.fnUntraced(function* ([payload]) {
      const secret = `${SECRET_MARKER}${payload.profile.token}`;
      const cause = yield* decodeNestedNumberPayload({ profile: { token: secret } }).pipe(Effect.flip);
      const requestError = AcpRequestError.invalidExtensionPayload("x/private", cause);
      const parseError = AcpProtocolParseError.fromSchemaError("decode-notification-payload", "x/private", cause);

      assert.notInclude(requestError.message, SECRET_MARKER);
      assert.notInclude(parseError.message, SECRET_MARKER);
      const encodedUnknownJson3 = yield* encodeUnknownJson(requestError.toProtocolError());
      assert.notInclude(encodedUnknownJson3, SECRET_MARKER);
      const requestDiagnosticsJson4 = yield* requestDiagnosticsJson(requestError);
      assert.notInclude(requestDiagnosticsJson4, SECRET_MARKER);
      const parsedDiagnosticsJson5 = yield* parseDiagnosticsJson(parseError);
      assert.notInclude(parsedDiagnosticsJson5, SECRET_MARKER);
    }),
    { arbitrary: fcRuns(50) }
  );
});
