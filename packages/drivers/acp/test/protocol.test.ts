// Transport tests for `@beep/acp/protocol`: wire framing, id correlation, writer acknowledgement,
// handler isolation and termination. Behaviour cases port t3code effect-acp `protocol.test.ts`
// (31dcc7c513); the escaped-key, frame-decoder and property suites are beep-specific.
import * as AcpError from "@beep/acp/errors";
import { runHandler } from "@beep/acp/internal/shared";
import * as AcpJson from "@beep/acp/json";
import * as AcpProtocol from "@beep/acp/protocol";
import * as AcpSchema from "@beep/acp/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A, currentHostPlatform } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Fiber from "effect/Fiber";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as MutableRef from "effect/MutableRef";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as References from "effect/References";
import * as Result from "effect/Result";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import {
  encodeJsonl,
  jsonRpcNotification,
  jsonRpcRequest,
  jsonRpcResponse,
  makeChildStdio,
  makeInMemoryStdio,
  makeTerminationError,
} from "./helpers.ts";

const decodeAcpIncomingNotification = S.decodeEffect(AcpProtocol.AcpIncomingNotification);
const decodeAcpProtocolLogEvent = S.decodeEffect(AcpProtocol.AcpProtocolLogEvent);

const SessionCancelNotification = jsonRpcNotification("session/cancel", AcpSchema.CancelSessionNotification);
const SessionUpdateNotification = jsonRpcNotification("session/update", AcpSchema.UpdateSessionNotification);
const ElicitationCompleteNotification = jsonRpcNotification(
  "elicitation/complete",
  AcpSchema.CompleteElicitationNotification
);
const LegacyElicitationCompleteNotification = jsonRpcNotification(
  "session/elicitation/complete",
  AcpSchema.CompleteElicitationNotification
);
const RequestPermissionResponse = jsonRpcResponse(AcpSchema.RequestPermissionResponse);
const ExtRequest = jsonRpcRequest("x/test", S.Struct({ hello: S.String }));
const ExtResponse = jsonRpcResponse(S.Struct({ ok: S.Boolean }));
const InnerRequest = jsonRpcRequest("x/inner", S.Struct({ from: S.String }));
const OuterResponse = jsonRpcResponse(S.Struct({ inner: S.Struct({ ok: S.Boolean }) }));
const JsonRpcErrorResponse = S.Struct({
  error: S.Struct({ code: S.Finite, message: S.String }),
  id: S.Finite,
  jsonrpc: S.tag("2.0"),
});
const decodeSessionCancelNotification = S.decodeEffect(AcpJson.fromJsonText(SessionCancelNotification));
const decodeExtRequest = S.decodeEffect(AcpJson.fromJsonText(ExtRequest));
const decodeInnerRequest = S.decodeEffect(AcpJson.fromJsonText(InnerRequest));
const decodeOuterResponse = S.decodeEffect(AcpJson.fromJsonText(OuterResponse));
const decodeJsonRpcErrorResponse = S.decodeEffect(AcpJson.fromJsonText(JsonRpcErrorResponse));
const decodeRequestPermissionResponse = S.decodeEffect(AcpJson.fromJsonText(RequestPermissionResponse));
const encodeSessionCancelNotification = S.encodeEffect(AcpJson.fromJsonText(SessionCancelNotification));
const encodeRequestPermissionResponse = S.encodeEffect(AcpJson.fromJsonText(RequestPermissionResponse));
const encodeUnknownJsonText = S.encodeUnknownEffect(AcpJson.fromJsonText(S.Unknown));
const SessionCancelNotificationArbitrary = Arbitrary.schema(SessionCancelNotification);
const RequestPermissionResponseArbitrary = Arbitrary.schema(RequestPermissionResponse);
const AcpProtocolLogEventArbitrary = Arbitrary.schema(AcpProtocol.AcpProtocolLogEvent);
const AcpProtocolLoggingOptionsArbitrary = Arbitrary.schema(AcpProtocol.AcpProtocolLoggingOptions);
const AcpIncomingNotificationArbitrary = Arbitrary.schema(AcpProtocol.AcpIncomingNotification);
const AcpRequestContextArbitrary = Arbitrary.schema(AcpProtocol.AcpRequestContext);
const AcpErrorArbitrary = Arbitrary.schema(AcpError.AcpError).pipe(
  Arbitrary.filter((error) =>
    AcpError.AcpError.match(error, {
      AcpInputStreamEndedError: () => true,
      AcpProcessExitedError: (failure) => O.isNone(failure.cause),
      AcpProtocolParseError: (failure) => O.isNone(failure.cause),
      AcpRequestError: (failure) => O.isNone(failure.cause),
      AcpSpawnError: (failure) => O.isNone(failure.cause),
      AcpTransportError: (failure) => O.isNone(failure.cause),
    })
  )
);
const childProcessProtocolTestTimeout = 30_000;
const decodeJsonWithHostParser = S.decodeUnknownEffect(S.fromJsonString(S.Json));
const encoder = new TextEncoder();

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const assertEncodedRoundTrip = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  value: Codec["Type"],
  options: { readonly compareDecoded?: boolean } = {}
): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  if (options.compareDecoded !== false) {
    assertTrue(S.toEquivalence(schema)(decoded, value));
  }
  assert.deepEqual(encode(schema, decoded), encoded);
};

const jsonLine = Effect.fnUntraced(function* (value: unknown) {
  return encoder.encode(`${yield* encodeUnknownJsonText(value)}\n`);
});

const usageUpdate = (used: number) => ({
  sessionId: "session-1",
  update: { sessionUpdate: "usage_update", size: 100, used },
});

const spawnBunScript = Effect.fn("AcpProtocolTest.spawnBunScript")(function* (script: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* spawner.spawn(
    ChildProcess.make("bun", ["-e", script], {
      shell: currentHostPlatform === "win32",
      stderr: "inherit",
      stdin: "pipe",
      stdout: "pipe",
    })
  );
});

const terminatedDefectOf = (message: RpcMessage.FromServerEncoded) => {
  if (message._tag !== "ClientProtocolError" || message.error.reason._tag !== "RpcClientDefect") {
    return assert.fail("expected a ClientProtocolError carrying an RpcClientDefect");
  }
  assert.equal(message.error.reason.message, "ACP protocol terminated.");
  return message.error.reason.cause;
};

const expectFailure = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.match({
      onFailure: (error) => error,
      onSuccess: () => assert.fail("expected the effect to fail"),
    })
  );

it.effect.prop(
  "round-trips schema-derived JSON-RPC notifications and responses through JSON boundaries",
  [SessionCancelNotificationArbitrary, RequestPermissionResponseArbitrary],
  Effect.fnUntraced(function* ([cancelNotification, permissionResponse]) {
    const encodedCancelNotification = yield* encodeSessionCancelNotification(cancelNotification);
    const decodedCancelNotification = yield* decodeSessionCancelNotification(encodedCancelNotification);
    assert.equal(yield* encodeSessionCancelNotification(decodedCancelNotification), encodedCancelNotification);

    const encodedPermissionResponse = yield* encodeRequestPermissionResponse(permissionResponse);
    const decodedPermissionResponse = yield* decodeRequestPermissionResponse(encodedPermissionResponse);
    assert.equal(yield* encodeRequestPermissionResponse(decodedPermissionResponse), encodedPermissionResponse);
  }),
  { arbitrary: fcRuns(25) }
);

// Node 24 (V8 12.8 through 13.7) `JSON.parse` resolves an escaped one-character object key through
// an existing map transition whenever the raw source prefix matches it, so once any object shaped
// `{ " ": …, "\\": … }` exists in the isolate, `{" ":0,"\u0000":1}` decodes with a "\\" key. The
// property above found this on 2026-09-11 (replay
// `[0,"5464242726500343",5009,3,[0,0,0,0,0,0],"PropertyError"]`); this pins the shrunk shape.
it.effect(
  "keeps escaped _meta keys after the host materialised a backslash key at the same position",
  Effect.fnUntraced(function* () {
    assert.deepEqual(yield* decodeJsonWithHostParser('{" ":0,"\\\\":0}'), { " ": 0, "\\": 0 });
    const notification = {
      jsonrpc: "2.0" as const,
      method: "session/cancel" as const,
      params: {
        _meta: {
          "9z({": { " ": -8.82839006083749e-189, "\u0000": { "<b^~+3>": [], ",i": 1.3931731468853144e287 } },
        },
        sessionId: "session-1",
      },
    };
    const encoded = yield* encodeSessionCancelNotification(notification);
    const decoded = yield* decodeSessionCancelNotification(encoded);
    assert.equal(yield* encodeSessionCancelNotification(decoded), encoded);
    assert.deepEqual(decoded.params._meta, notification.params._meta);
  })
);

it.effect(
  "keeps handwritten ACP schema encoded shapes byte-identical",
  Effect.fnUntraced(function* () {
    assert.deepEqual(
      encode(AcpError.AcpRequestError, AcpError.AcpRequestError.parseError("Parse error", { issue: "bad" })),
      {
        _tag: "AcpRequestError",
        code: -32700,
        data: { issue: "bad" },
        errorMessage: "Parse error",
      }
    );
    assert.deepEqual(encode(AcpError.AcpRequestError, AcpError.AcpRequestError.methodNotFound("x/test")), {
      _tag: "AcpRequestError",
      code: -32601,
      errorMessage: "Method not found: x/test",
    });
    assert.deepEqual(encode(AcpError.AcpProcessExitedError, AcpError.AcpProcessExitedError.make({ code: O.some(7) })), {
      _tag: "AcpProcessExitedError",
      code: 7,
    });
    assert.deepEqual(encode(AcpError.AcpProcessExitedError, AcpError.AcpProcessExitedError.make({})), {
      _tag: "AcpProcessExitedError",
    });
    assert.deepEqual(
      encode(AcpError.AcpProtocolParseError, AcpError.AcpProtocolParseError.make({ operation: "decode-wire-message" })),
      {
        _tag: "AcpProtocolParseError",
        operation: "decode-wire-message",
      }
    );
    assert.deepEqual(
      encode(AcpError.AcpTransportError, AcpError.AcpTransportError.make({ detail: O.some("stream closed") })),
      {
        _tag: "AcpTransportError",
        detail: "stream closed",
      }
    );
    assert.deepEqual(encode(AcpError.AcpInputStreamEndedError, AcpError.AcpInputStreamEndedError.make({})), {
      _tag: "AcpInputStreamEndedError",
    });
    assert.deepEqual(
      encode(AcpProtocol.AcpRequestContext, AcpProtocol.AcpRequestContext.make({ method: "x/test", requestId: 0 })),
      { method: "x/test", requestId: 0 }
    );
    assert.deepEqual(encode(AcpProtocol.AcpProtocolLoggingOptions, AcpProtocol.AcpProtocolLoggingOptions.make({})), {});
    assert.deepEqual(
      encode(AcpProtocol.AcpProtocolLoggingOptions, AcpProtocol.AcpProtocolLoggingOptions.make({ logIncoming: true })),
      {
        logIncoming: true,
      }
    );
    assert.deepEqual(
      encode(
        AcpProtocol.AcpProtocolLogEvent,
        yield* decodeAcpProtocolLogEvent({
          direction: "incoming",
          payload: "{}",
          stage: "raw",
        })
      ),
      {
        direction: "incoming",
        payload: "{}",
        stage: "raw",
      }
    );
    assert.deepEqual(
      encode(
        AcpProtocol.AcpIncomingNotification,
        yield* decodeAcpIncomingNotification({
          _tag: "ExtNotification",
          method: "x/custom",
          params: { ok: true },
        })
      ),
      {
        _tag: "ExtNotification",
        method: "x/custom",
        params: { ok: true },
      }
    );
  })
);

it.prop(
  "round-trips handwritten ACP schemas through encoded form",
  [
    AcpProtocolLogEventArbitrary,
    AcpProtocolLoggingOptionsArbitrary,
    AcpIncomingNotificationArbitrary,
    AcpRequestContextArbitrary,
    AcpErrorArbitrary,
  ],
  ([event, options, notification, context, error]) => {
    assertEncodedRoundTrip(AcpProtocol.AcpProtocolLogEvent, event);
    assertEncodedRoundTrip(AcpProtocol.AcpProtocolLoggingOptions, options);
    assertEncodedRoundTrip(AcpProtocol.AcpIncomingNotification, notification);
    assertEncodedRoundTrip(AcpProtocol.AcpRequestContext, context);
    assertEncodedRoundTrip(AcpError.AcpError, error);
  },
  { arbitrary: fcRuns(25) }
);

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp protocol", (it) => {
  it.effect(
    "emits exact JSON-RPC notifications and decodes inbound session/update and both elicitation completions",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const notifications = yield* Deferred.make<ReadonlyArray<AcpProtocol.AcpIncomingNotification>>();
      yield* transport.incoming.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.flatMap((notificationChunk) => Deferred.succeed(notifications, notificationChunk)),
        Effect.forkScoped
      );

      yield* transport.notify("session/cancel", { sessionId: "session-1" });
      const outbound = yield* Queue.take(output);
      // A JSON-RPC notification carries no `id`; Grok CLI drops frames that do.
      assert.equal(outbound, '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"session-1"}}\n');
      assert.deepEqual(yield* decodeSessionCancelNotification(outbound), {
        jsonrpc: "2.0",
        method: "session/cancel",
        params: {
          sessionId: "session-1",
        },
      });

      yield* Queue.offer(
        input,
        yield* encodeJsonl(SessionUpdateNotification, {
          jsonrpc: "2.0",
          method: "session/update",
          params: usageUpdate(10),
        })
      );
      yield* Queue.offer(
        input,
        yield* encodeJsonl(ElicitationCompleteNotification, {
          jsonrpc: "2.0",
          method: "elicitation/complete",
          params: { elicitationId: "elicitation-1" },
        })
      );
      yield* Queue.offer(
        input,
        yield* encodeJsonl(LegacyElicitationCompleteNotification, {
          jsonrpc: "2.0",
          method: "session/elicitation/complete",
          params: { elicitationId: "elicitation-2" },
        })
      );

      const [update, completion, legacyCompletion] = yield* Deferred.await(notifications);
      assert.equal(update?._tag, "SessionUpdate");
      assert.include(completion, { _tag: "ElicitationComplete", method: "elicitation/complete" });
      assert.include(legacyCompletion, { _tag: "ElicitationComplete", method: "session/elicitation/complete" });
    })
  );

  it.effect(
    "decodes escaped _meta keys on inbound frames after the host materialised a backslash key",
    Effect.fnUntraced(function* () {
      assert.deepEqual(yield* decodeJsonWithHostParser('{"beep-acp-regression":0,"\\\\":0}'), {
        "beep-acp-regression": 0,
        "\\": 0,
      });
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      const notifications = yield* Deferred.make<ReadonlyArray<AcpProtocol.AcpIncomingNotification>>();
      yield* transport.incoming.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.flatMap((notificationChunk) => Deferred.succeed(notifications, notificationChunk)),
        Effect.forkScoped
      );
      const meta = { "beep-acp-regression": 0, "\n": true };
      yield* Queue.offer(
        input,
        yield* encodeJsonl(SessionUpdateNotification, {
          jsonrpc: "2.0",
          method: "session/update",
          params: { ...usageUpdate(10), _meta: meta },
        })
      );
      const [update] = yield* Deferred.await(notifications);
      assert.equal(update?._tag, "SessionUpdate");
      if (update?._tag === "SessionUpdate") {
        assert.deepEqual(update.params._meta, meta);
      }
    })
  );

  it.effect(
    "terminates when a callback on the reader dies",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const termination = yield* Deferred.make<AcpError.AcpError>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        transformSessionUpdate: () => {
          throw new Error("normalizer bug");
        },
        onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
      });

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "session/update", params: usageUpdate(1) }));

      const error = yield* Deferred.await(termination);
      if (error._tag !== "AcpTransportError") {
        return assert.fail("expected a transport error");
      }
      assertSome(error.operation, "read-input-stream");
    })
  );

  it.effect(
    "logs outgoing notifications without an id or headers when logOutgoing is enabled",
    Effect.fnUntraced(function* () {
      const { stdio } = yield* makeInMemoryStdio();
      const events = A.empty<AcpProtocol.AcpProtocolLogEvent>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        logOutgoing: true,
        logger: (event) =>
          Effect.sync(() => {
            A.appendInPlace(events, event);
          }),
      });

      yield* transport.notify("session/cancel", { sessionId: "session-1" });

      assert.deepEqual(events, [
        {
          direction: "outgoing",
          stage: "decoded",
          payload: {
            _tag: "Notification",
            tag: "session/cancel",
            payload: {
              sessionId: "session-1",
            },
          },
        },
        {
          direction: "outgoing",
          stage: "raw",
          payload: '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"session-1"}}\n',
        },
      ]);
    })
  );

  it.effect(
    "logs decode failures without copying the cause or wire payload",
    Effect.fnUntraced(function* () {
      const secret = "acp-wire-secret-sentinel";
      const { stdio, input } = yield* makeInMemoryStdio();
      const events = A.empty<AcpProtocol.AcpProtocolLogEvent>();
      const termination = yield* Deferred.make<AcpError.AcpError>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        logIncoming: true,
        logger: (event) =>
          Effect.sync(() => {
            A.appendInPlace(events, event);
          }),
        onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
      });

      yield* Queue.offer(input, encoder.encode(`{"secret":"${secret}"\n`));
      yield* Deferred.await(termination);

      const event = A.findFirst(events, ({ stage }) => stage === "decode_failed");
      assertSome(event, {
        direction: "incoming",
        stage: "decode_failed",
        payload: {
          operation: "decode-wire-message",
        },
      });
      assert.notInclude(yield* event.pipe(O.getOrUndefined, encodeUnknownJsonText), secret);
    })
  );

  it.effect(
    "fails notification and request encoding through the declared ACP error channel",
    Effect.fnUntraced(function* () {
      const { stdio } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const bigintError = yield* transport.notify("x/test", 1n).pipe(Effect.flip);
      if (bigintError._tag !== "AcpProtocolParseError") {
        return assert.fail("expected a protocol parse error");
      }
      assert.equal(bigintError.operation, "encode-message");
      assertSome(bigintError.method, "x/test");
      bigintError.cause.pipe(O.isSome, assertTrue);
      assert.equal(bigintError.message, "ACP protocol operation 'encode-message' failed for method 'x/test'.");

      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const circularError = yield* transport.notify("x/test", circular).pipe(Effect.flip);
      if (circularError._tag !== "AcpProtocolParseError") {
        return assert.fail("expected a protocol parse error");
      }
      assert.equal(circularError.operation, "encode-message");
      assertSome(circularError.method, "x/test");

      const requestError = yield* expectFailure(transport.request("x/request", 1n));
      if (requestError._tag !== "AcpProtocolParseError") {
        return assert.fail("expected a protocol parse error");
      }
      assert.equal(requestError.operation, "encode-message");
      assertSome(requestError.method, "x/request");
      assertSome(requestError.requestId, 1);
    })
  );

  it.effect(
    "supports generic extension requests over the patched transport",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
      const outbound = yield* Queue.take(output);
      assert.deepEqual(yield* decodeExtRequest(outbound), {
        jsonrpc: "2.0",
        id: 1,
        method: "x/test",
        params: {
          hello: "world",
        },
        headers: [],
      });

      yield* Queue.offer(input, yield* encodeJsonl(ExtResponse, { jsonrpc: "2.0", id: 1, result: { ok: true } }));

      assert.deepEqual(yield* Fiber.join(response), { ok: true });
    })
  );

  it.effect(
    "does not correlate a string response id with a numeric extension request id",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
      yield* Queue.take(output);
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: "1", result: { ok: false } }));
      yield* Effect.yieldNow;
      assert.isUndefined(response.pollUnsafe());

      yield* Queue.offer(input, yield* encodeJsonl(ExtResponse, { jsonrpc: "2.0", id: 1, result: { ok: true } }));
      assert.deepEqual(yield* Fiber.join(response), { ok: true });
    })
  );

  it.effect(
    "correlates extension response errors with the originating request",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const response = yield* transport.request("x/private", { hello: "world" }).pipe(Effect.forkScoped);
      yield* Queue.take(output);
      yield* Queue.offer(
        input,
        yield* jsonLine({
          jsonrpc: "2.0",
          id: 1,
          error: {
            _tag: "Cause",
            code: -32602,
            message: "Invalid params",
            data: [{ _tag: "Fail", error: { code: -32602, message: "Invalid params", data: { field: "hello" } } }],
          },
        })
      );

      const error = yield* response.pipe(Fiber.join, expectFailure);
      if (error._tag !== "AcpRequestError") {
        return assert.fail("expected a request error");
      }
      assert.equal(error.code, -32602);
      assert.equal(error.errorMessage, "Invalid params");
      assertSome(error.method, "x/private");
      assertSome(error.requestId, 1);
      assertSome(error.operation, "receive-response");
    })
  );

  it.effect(
    "answers an extension request whose handler also dies as an internal error",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onExtRequest: () =>
          Effect.fail(AcpError.AcpRequestError.invalidParams("bad params")).pipe(
            Effect.ensuring(Effect.die("cleanup bug"))
          ),
      });

      yield* Queue.offer(
        input,
        yield* encodeJsonl(ExtRequest, {
          jsonrpc: "2.0",
          id: 9,
          method: "x/test",
          params: { hello: "world" },
          headers: [],
        })
      );

      const response = yield* decodeJsonRpcErrorResponse(yield* Queue.take(output));
      assert.equal(response.id, 9);
      assert.equal(response.error.code, -32603);
    })
  );

  it.effect(
    "preserves zero-valued ids for inbound core client requests",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const observed = yield* Deferred.make<readonly [AcpError.AcpRequestId, string]>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("session/request_permission"),
        onIncomingRequest: (requestId, method) => Deferred.succeed(observed, [requestId, method]).pipe(Effect.asVoid),
      });
      const inboundRequest = yield* Deferred.make<unknown>();

      yield* transport.serverProtocol
        .run((_clientId, message) => Deferred.succeed(inboundRequest, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const params = {
        sessionId: "session-1",
        title: "Allow mock action",
        subject: {
          type: "tool_call",
          toolCall: {
            toolCallId: "tool-1",
            title: "Allow mock action",
          },
        },
        options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
      };
      yield* Queue.offer(
        input,
        yield* jsonLine({ jsonrpc: "2.0", id: 0, method: "session/request_permission", params, headers: [] })
      );

      assert.deepEqual(yield* Deferred.await(inboundRequest), {
        _tag: "Request",
        id: 0,
        tag: "session/request_permission",
        payload: params,
        headers: [],
      });
      assert.deepEqual(yield* Deferred.await(observed), [0, "session/request_permission"]);

      yield* transport.serverProtocol.send(0, {
        _tag: "Exit",
        requestId: 0,
        exit: {
          _tag: "Success",
          value: {
            outcome: {
              outcome: "selected",
              optionId: "allow",
            },
          },
        },
      });

      assert.deepEqual(yield* decodeRequestPermissionResponse(yield* Queue.take(output)), {
        jsonrpc: "2.0",
        id: 0,
        result: {
          outcome: {
            outcome: "selected",
            optionId: "allow",
          },
        },
      });
    })
  );

  it.effect(
    "acknowledges outgoing responses and reports encoding failures by request id",
    Effect.fnUntraced(function* () {
      const { stdio } = yield* makeInMemoryStdio();
      const acknowledged = yield* Deferred.make<AcpError.AcpRequestId>();
      const failed = yield* Deferred.make<readonly [AcpError.AcpRequestId, AcpError.AcpError]>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onOutgoingResponse: (requestId) => Deferred.succeed(acknowledged, requestId).pipe(Effect.asVoid),
        onOutgoingResponseFailure: (requestId, error) =>
          Deferred.succeed(failed, [requestId, error]).pipe(Effect.asVoid),
      });

      yield* transport.serverProtocol.send(0, {
        _tag: "Exit",
        requestId: "success-1",
        exit: { _tag: "Success", value: { ok: true } },
      });
      assert.equal(yield* Deferred.await(acknowledged), "success-1");

      const circular: { self?: unknown } = {};
      circular.self = circular;
      yield* transport.serverProtocol
        .send(0, {
          _tag: "Exit",
          requestId: "failure-1",
          exit: { _tag: "Success", value: circular },
        })
        .pipe(Effect.exit);
      const [requestId, error] = yield* Deferred.await(failed);
      assert.equal(requestId, "failure-1");
      assert.instanceOf(error, AcpError.AcpProtocolParseError);
    })
  );

  it.effect(
    "acknowledges a response only after the stdout write completes",
    Effect.fnUntraced(function* () {
      const writeStarted = yield* Deferred.make<void>();
      const releaseWrite = yield* Deferred.make<void>();
      const acknowledged = yield* Deferred.make<AcpError.AcpRequestId>();
      const stdio = Stdio.make({
        args: Effect.succeed([]),
        stdin: Stream.never,
        stdout: () =>
          Sink.forEach(() =>
            Deferred.succeed(writeStarted, undefined).pipe(Effect.andThen(Deferred.await(releaseWrite)))
          ),
        stderr: () => Sink.drain,
      });
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onOutgoingResponse: (requestId) => Deferred.succeed(acknowledged, requestId).pipe(Effect.asVoid),
      });
      const sendFiber = yield* transport.serverProtocol
        .send(0, {
          _tag: "Exit",
          requestId: "held-write",
          exit: { _tag: "Success", value: { ok: true } },
        })
        .pipe(Effect.forkScoped);

      yield* Deferred.await(writeStarted);
      assert.isUndefined(sendFiber.pollUnsafe());
      assert.isFalse(yield* Deferred.isDone(acknowledged));
      yield* Deferred.succeed(releaseWrite, undefined);
      yield* Fiber.join(sendFiber);
      assert.equal(yield* Deferred.await(acknowledged), "held-write");
    })
  );

  it.effect(
    "fails current, queued, and future responses when the stdout writer fails",
    Effect.fnUntraced(function* () {
      const writeStarted = yield* Deferred.make<void>();
      const releaseFailure = yield* Deferred.make<void>();
      const failures = yield* Queue.unbounded<AcpError.AcpRequestId>();
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      const stdio = Stdio.make({
        args: Effect.succeed([]),
        stdin: Stream.never,
        stdout: () =>
          Sink.forEach(() =>
            Deferred.succeed(writeStarted, undefined).pipe(
              Effect.andThen(Deferred.await(releaseFailure)),
              Effect.andThen(Effect.die("stdout failed"))
            )
          ),
        stderr: () => Sink.drain,
      });
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onOutgoingResponseFailure: (requestId) => Queue.offer(failures, requestId).pipe(Effect.asVoid),
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });
      const send = (requestId: string) =>
        transport.serverProtocol
          .send(0, {
            _tag: "Exit",
            requestId,
            exit: { _tag: "Success", value: { ok: true } },
          })
          .pipe(Effect.exit);
      const current = yield* send("current").pipe(Effect.forkScoped);
      yield* Deferred.await(writeStarted);
      const queued = yield* send("queued").pipe(Effect.forkScoped);
      yield* Effect.yieldNow;
      assert.isUndefined(current.pollUnsafe());
      assert.isUndefined(queued.pollUnsafe());
      yield* Deferred.succeed(releaseFailure, undefined);
      assert.instanceOf(yield* Deferred.await(terminated), AcpError.AcpTransportError);
      yield* Fiber.join(current);
      yield* Fiber.join(queued);
      yield* send("future");

      assertTrue(
        Equal.equals(HashSet.fromIterable(yield* Queue.takeN(failures, 3)), HashSet.make("current", "queued", "future"))
      );
    })
  );

  it.effect(
    "atomically rejects an admitted response when the writer closes before queue offer",
    Effect.fnUntraced(function* () {
      const admitted = yield* Deferred.make<void>();
      const releaseAdmission = yield* Deferred.make<void>();
      const failures = yield* Queue.unbounded<AcpError.AcpRequestId>();
      const protocolReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const stdio = Stdio.make({
        args: Effect.succeed([]),
        stdin: Stream.never,
        stdout: () => Sink.drain,
        stderr: () => Sink.drain,
      });
      // The protocol lives in its own layer scope, held open by this fiber; interrupting it closes the
      // writer while a response is admitted but not yet queued.
      const protocolOwner = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onOutgoingResponseFailure: (requestId) => Queue.offer(failures, requestId).pipe(Effect.asVoid),
        testHooks: {
          onOutgoingWriteAdmitted: () =>
            Deferred.succeed(admitted, undefined).pipe(Effect.andThen(Deferred.await(releaseAdmission))),
        },
      }).pipe(
        Effect.flatMap((transport) => Deferred.succeed(protocolReady, transport)),
        Layer.effectDiscard,
        Layer.launch,
        Effect.forkScoped
      );
      const transport = yield* Deferred.await(protocolReady);
      const send = (requestId: string) =>
        transport.serverProtocol
          .send(0, {
            _tag: "Exit",
            requestId,
            exit: { _tag: "Success", value: { ok: true } },
          })
          .pipe(Effect.exit);
      const admittedSend = yield* send("admitted").pipe(Effect.forkScoped);

      yield* Deferred.await(admitted);
      yield* Fiber.interrupt(protocolOwner);
      yield* Deferred.succeed(releaseAdmission, undefined);
      yield* Fiber.join(admittedSend);
      yield* send("future");

      assert.deepEqual(yield* Queue.takeN(failures, 2), ["admitted", "future"]);
    })
  );

  it.effect(
    "drops agent-internal JSON-RPC responses with non-numeric request ids",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      const clientSeen = yield* Queue.unbounded<RpcMessage.FromServerEncoded>();
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(clientSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);
      const notifications = yield* Deferred.make<ReadonlyArray<AcpProtocol.AcpIncomingNotification>>();
      yield* transport.incoming.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.flatMap((notificationChunk) => Deferred.succeed(notifications, notificationChunk)),
        Effect.forkScoped
      );

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: "skills-reload", result: { reloaded: true } }));
      yield* Queue.offer(
        input,
        yield* encodeJsonl(SessionUpdateNotification, {
          jsonrpc: "2.0",
          method: "session/update",
          params: usageUpdate(5),
        })
      );

      const [update] = yield* Deferred.await(notifications);
      assert.equal(update?._tag, "SessionUpdate");
      assert.equal(yield* Queue.size(clientSeen), 0);
    })
  );

  it.effect(
    "cleans up interrupted extension requests before a late response arrives",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const drained = yield* Deferred.make<void>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () => Deferred.succeed(drained, undefined).pipe(Effect.asVoid),
      });
      const lateResponse = yield* Queue.unbounded<unknown>();

      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(lateResponse, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
      assert.deepEqual(yield* decodeExtRequest(yield* Queue.take(output)), {
        jsonrpc: "2.0",
        id: 1,
        method: "x/test",
        params: {
          hello: "world",
        },
        headers: [],
      });

      yield* Fiber.interrupt(response);
      yield* Queue.offer(input, yield* encodeJsonl(ExtResponse, { jsonrpc: "2.0", id: 1, result: { ok: true } }));

      yield* Queue.offer(input, encoder.encode('{"jsonrpc":"2.0","method":"x/after","params":{}}\n'));
      yield* Deferred.await(drained);
      assert.equal(yield* Queue.size(lateResponse), 0);
    })
  );

  it.effect(
    "does not treat intentional serverProtocol.end as a transport failure",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const terminations = yield* Ref.make(0);
      const writerExit = yield* Deferred.make<boolean>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onTermination: () => Ref.update(terminations, (count) => count + 1),
        testHooks: {
          onOutgoingWriterExit: (intentionalEnd) => Deferred.succeed(writerExit, intentionalEnd).pipe(Effect.asVoid),
        },
      });

      yield* transport.serverProtocol.end(0);
      assertTrue(yield* Deferred.await(writerExit));
      assert.equal(yield* Ref.get(terminations), 0);

      yield* Queue.end(input);
    })
  );

  for (const operation of ["request", "notification"] as const) {
    it.effect(
      `rejects a ${operation} if the connection ends while its logger is running`,
      Effect.fnUntraced(function* () {
        const { stdio, input, output } = yield* makeInMemoryStdio();
        const writeStarted = yield* Deferred.make<void>();
        const releaseWrite = yield* Deferred.make<void>();
        const terminated = yield* Deferred.make<AcpError.AcpError>();
        const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
          stdio,
          serverRequestMethods: HashSet.empty(),
          logOutgoing: true,
          logger: (event) =>
            event.stage === "raw"
              ? Deferred.succeed(writeStarted, undefined).pipe(Effect.andThen(Deferred.await(releaseWrite)))
              : Effect.void,
          onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
        });
        const send = yield* (
          operation === "request"
            ? transport.request("x/test", { hello: "world" })
            : transport.notify("session/cancel", { sessionId: "session-1" })
        ).pipe(Effect.forkScoped);

        yield* Deferred.await(writeStarted);
        yield* Queue.end(input);
        const error = yield* Deferred.await(terminated);
        yield* Deferred.succeed(releaseWrite, undefined);

        assert.strictEqual(yield* send.pipe(Fiber.join, expectFailure), error);
        assert.equal(yield* Queue.size(output), 0);
      })
    );
  }

  it.effect(
    "fails requests, notifications and responses at once after the connection ended",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });

      yield* Queue.end(input);
      const error = yield* Deferred.await(terminated);
      assert.instanceOf(error, AcpError.AcpInputStreamEndedError);

      assert.strictEqual(yield* expectFailure(transport.request("x/test", { hello: "world" })), error);
      assert.strictEqual(yield* expectFailure(transport.notify("session/cancel", { sessionId: "session-1" })), error);
      const clientSend = yield* expectFailure(
        transport.clientProtocol.send(0, { _tag: "Request", id: 5, tag: "x/test", payload: {}, headers: [] })
      );
      assert.equal(clientSend.reason._tag, "RpcClientDefect");
      assert.strictEqual(clientSend.reason.cause, error);
      assert.equal(yield* Queue.size(output), 0);
    })
  );

  it.effect(
    "never forwards @effect/rpc/Interrupt to the peer",
    Effect.fnUntraced(function* () {
      const { stdio, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      yield* transport.clientProtocol.send(0, { _tag: "Interrupt", requestId: AcpProtocol.RPC_REQUEST_ID_START });
      yield* transport.notify("session/cancel", { sessionId: "session-1" });

      assert.equal(
        yield* Queue.take(output),
        '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"session-1"}}\n'
      );
      assert.equal(yield* Queue.size(output), 0);
    })
  );

  it.effect(
    "keeps answering after more than 1,024 notifications nobody drains",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const handled = yield* Ref.make(0);
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () => Ref.update(handled, (count) => count + 1),
        onExtRequest: () => Effect.succeed({ ok: true }),
      });

      const notificationCount = 1_100;
      const lines = A.makeBy(notificationCount, (index) => `{"jsonrpc":"2.0","method":"x/note","params":${index}}\n`);
      yield* Queue.offer(
        input,
        encoder.encode(`${A.join(lines, "")}{"jsonrpc":"2.0","id":77,"method":"x/test","params":{"hello":"world"}}\n`)
      );

      assert.deepEqual(yield* S.decodeEffect(AcpJson.fromJsonText(ExtResponse))(yield* Queue.take(output)), {
        jsonrpc: "2.0",
        id: 77,
        result: { ok: true },
      });
      assert.equal(yield* Ref.get(handled), notificationCount);
      // The undrained buffer slides and keeps only a short tail: the 32 newest notifications.
      const [oldestKept] = yield* transport.incoming.pipe(Stream.take(1), Stream.runCollect);
      assert.deepEqual(oldestKept, { _tag: "ExtNotification", method: "x/note", params: notificationCount - 32 });
    })
  );

  it.effect(
    "lets an extension request handler await an outbound request on the same connection",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const protocolReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const contexts = yield* Queue.unbounded<AcpProtocol.AcpRequestContext>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onExtRequest: (_method, _params, context) =>
          Queue.offer(contexts, context).pipe(
            Effect.andThen(Deferred.await(protocolReady)),
            Effect.flatMap((protocol) => protocol.request("x/inner", { from: String(context.requestId) })),
            Effect.map((inner) => ({ inner }))
          ),
      });
      yield* Deferred.succeed(protocolReady, transport);

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: "outer-1", method: "x/outer", params: {} }));
      assert.deepEqual(yield* decodeInnerRequest(yield* Queue.take(output)), {
        jsonrpc: "2.0",
        id: 1,
        method: "x/inner",
        params: { from: "outer-1" },
        headers: [],
      });
      const context = yield* Queue.take(contexts);
      assert.equal(context.method, "x/outer");
      assert.equal(context.requestId, "outer-1");

      yield* Queue.offer(input, yield* encodeJsonl(ExtResponse, { jsonrpc: "2.0", id: 1, result: { ok: true } }));
      assert.deepEqual(yield* decodeOuterResponse(yield* Queue.take(output)), {
        jsonrpc: "2.0",
        id: "outer-1",
        result: { inner: { ok: true } },
      });
    })
  );

  it.effect(
    "skips whitespace-only lines instead of terminating",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const terminated = yield* Ref.make(false);
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onTermination: () => Ref.set(terminated, true),
      });

      yield* Queue.offer(input, encoder.encode('\n   \n\t\r\n{"jsonrpc":"2.0","method":"x/after-blank","params":1}\n'));
      const [notification] = yield* transport.incoming.pipe(Stream.take(1), Stream.runCollect);
      assert.deepEqual(notification, { _tag: "ExtNotification", method: "x/after-blank", params: 1 });
      assert.isFalse(yield* Ref.get(terminated));
    })
  );

  it.effect(
    "fails pending extension requests with the propagated exit code",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        terminationError: Effect.succeed(AcpError.AcpProcessExitedError.make({ code: O.some(0) })),
        serverRequestMethods: HashSet.empty(),
      });

      const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
      yield* Queue.take(output);
      yield* Queue.end(input);

      const error = yield* response.pipe(Fiber.join, expectFailure);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail("expected a process exit error");
      }
      assertSome(error.code, 0);
    })
  );

  it.effect(
    "propagates the real child exit code when the input stream ends",
    Effect.fnUntraced(function* () {
      const handle = yield* spawnBunScript("process.exit(7)");
      const firstMessage = yield* Deferred.make<RpcMessage.FromServerEncoded>();
      const termination = yield* Deferred.make<AcpError.AcpError>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: makeChildStdio(handle),
        terminationError: makeTerminationError(handle),
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
      });

      yield* transport.clientProtocol
        .run(0, (message) => Deferred.succeed(firstMessage, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const defectCause = terminatedDefectOf(yield* Deferred.await(firstMessage));
      const exitError = yield* Deferred.await(termination);
      if (exitError._tag !== "AcpProcessExitedError") {
        return assert.fail("expected a process exit error");
      }
      assertSome(exitError.code, 7);
      assertSome(exitError.pid, handle.pid);
      assertNone(exitError.signal);
      assert.strictEqual(defectCause, exitError);
    }),
    childProcessProtocolTestTimeout
  );

  it.effect(
    "does not emit a second process-exit error after a decode failure",
    Effect.fnUntraced(function* () {
      const handle = yield* spawnBunScript('process.stdout.write("{not-json}\\n"); process.exit(23)');
      const terminationCalls = yield* Ref.make(0);
      const terminationObserved = yield* Deferred.make<void>();
      const firstMessage = yield* Deferred.make<RpcMessage.FromServerEncoded>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: makeChildStdio(handle),
        terminationError: makeTerminationError(handle),
        serverRequestMethods: HashSet.empty(),
        onTermination: () =>
          Ref.update(terminationCalls, (count) => count + 1).pipe(
            Effect.andThen(Deferred.succeed(terminationObserved, undefined))
          ),
      });

      yield* transport.clientProtocol
        .run(0, (message) => Deferred.succeed(firstMessage, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const defectCause = terminatedDefectOf(yield* Deferred.await(firstMessage));
      yield* Deferred.await(terminationObserved);
      assert.equal(yield* Ref.get(terminationCalls), 1);
      assert.instanceOf(defectCause, AcpError.AcpProtocolParseError);
      assert.include(defectCause, { operation: "decode-wire-message" });

      assert.equal(yield* handle.exitCode, 23);
      assert.equal(yield* Ref.get(terminationCalls), 1);
    }),
    childProcessProtocolTestTimeout
  );
});

// One bad update must not end a session whose later updates are fine; each distinct failure is
// warned about once per connection, with structural diagnostics only. The tests in this suite run
// interleaved, so each one counts only the warnings about its own payloads.
const capturedWarnings = A.empty<unknown>();
const warningCollector = Logger.make(({ fiber, logLevel }) => {
  if (logLevel === "Warn") {
    A.appendInPlace(capturedWarnings, fiber.getRef(References.CurrentLogAnnotations));
  }
});
const warningsAbout = (issue: string) =>
  A.filter(
    capturedWarnings,
    (annotations) =>
      P.hasProperty(annotations, "issueSummary") &&
      P.isString(annotations.issueSummary) &&
      Str.includes(issue)(annotations.issueSummary)
  );

// A response no outstanding request can claim (no id, `id: null`, or an id this side never
// issued) is dropped, but a hung call must still leave something to diagnose.
it.layer(Logger.layer([warningCollector]), { timeout: "10 seconds" })("effect-acp uncorrelated responses", (it) => {
  it.effect(
    "warns and drops late extension replies and never-issued or completed integer ids",
    Effect.fnUntraced(function* () {
      const sentinel = "acp-orphan-integer-sentinel";
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const drained = yield* Deferred.make<void>();
      const seen = yield* Queue.unbounded<RpcMessage.FromServerEncoded>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () => Deferred.succeed(drained, undefined).pipe(Effect.asVoid),
      });
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(seen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);
      const extension = yield* transport.request("x/test", {}).pipe(Effect.forkScoped);
      yield* Queue.take(output);
      yield* Fiber.interrupt(extension);
      yield* transport.clientProtocol.send(0, { _tag: "Request", id: 7, tag: "x/test", payload: {}, headers: [] });
      yield* transport.clientProtocol.send(0, { _tag: "Request", id: 8, tag: "x/test", payload: {}, headers: [] });
      yield* transport.clientProtocol.send(0, { _tag: "Interrupt", requestId: 8 });
      yield* Queue.offer(
        input,
        encoder.encode('{"jsonrpc":"2.0","id":7,"chunk":true,"result":[1]}\n{"jsonrpc":"2.0","id":7,"result":2}\n')
      );
      assert.equal((yield* Queue.take(seen))._tag, "Chunk");
      assert.equal((yield* Queue.take(seen))._tag, "Exit");
      for (const id of [1, 999, 7, 8]) {
        yield* Queue.offer(
          input,
          encoder.encode(`{"jsonrpc":"2.0","id":${id},"error":{"code":-32000,"message":"${sentinel}"}}\n`)
        );
      }
      yield* Queue.offer(input, encoder.encode('{"jsonrpc":"2.0","method":"x/after","params":{}}\n'));
      yield* Deferred.await(drained);
      assert.equal(yield* Queue.size(seen), 0);
      const warnings = A.filter(
        capturedWarnings,
        (annotations) => P.hasProperty(annotations, "errorMessage") && annotations.errorMessage === sentinel
      );
      assert.lengthOf(warnings, 4);
      A.forEach([1, 999, 7, 8], (requestId, index) =>
        assert.include(warnings[index], { requestId, messageTag: "Exit", code: -32000 })
      );
    })
  );

  it.effect(
    "warns with the error code and message when a response matches no outstanding request",
    Effect.fnUntraced(function* () {
      const sentinel = "acp-uncorrelated-response-sentinel";
      const { stdio, input } = yield* makeInMemoryStdio();
      const notifications = yield* Queue.unbounded<AcpProtocol.AcpIncomingNotification>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: (notification) => Queue.offer(notifications, notification).pipe(Effect.asVoid),
      });

      const frames = [
        `{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"${sentinel}"}}`,
        `{"jsonrpc":"2.0","error":{"_tag":"Defect","code":-32603,"message":"${sentinel}"}}`,
        `{"jsonrpc":"2.0","id":"agent-7","error":{"code":-32000,"message":"${sentinel}"}}`,
        // effect's own encoder writes a server-level `Defect` with this id.
        `{"jsonrpc":"2.0","id":-32603,"error":{"_tag":"Defect","code":1,"message":"${sentinel}"}}`,
        '{"jsonrpc":"2.0","method":"x/after","params":{}}',
      ];
      yield* Queue.offer(
        input,
        encoder.encode(
          A.join(
            A.map(frames, (frame) => `${frame}\n`),
            ""
          )
        )
      );
      // The reader routes frames in order, so every response was handled once this arrives.
      yield* Queue.take(notifications);

      const warnings = A.filter(
        capturedWarnings,
        (annotations) => P.hasProperty(annotations, "errorMessage") && annotations.errorMessage === sentinel
      );
      assert.lengthOf(warnings, 4);
      const [parseError, idlessDefect, unknownId, effectDefect] = warnings;
      assert.include(parseError, { code: -32700, messageTag: "Exit" });
      assert.notProperty(parseError, "requestId");
      assert.include(idlessDefect, { code: -32603, messageTag: "Exit" });
      assert.notProperty(idlessDefect, "requestId");
      assert.include(unknownId, { code: -32000, messageTag: "Exit", requestId: "agent-7" });
      assert.include(effectDefect, { code: 1, messageTag: "Exit", requestId: -32603 });
    })
  );
});

it.layer(Logger.layer([warningCollector]), { timeout: "10 seconds" })("effect-acp notification decoding", (it) => {
  it.effect(
    "drops a session/update that fails to decode and keeps reading",
    Effect.fnUntraced(function* () {
      const secret = "acp-core-notification-secret-sentinel";
      const { stdio, input } = yield* makeInMemoryStdio();
      const events = A.empty<AcpProtocol.AcpProtocolLogEvent>();
      const terminated = yield* Ref.make(false);
      let transformCalls = 0;
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        logIncoming: true,
        logger: (event) =>
          Effect.sync(() => {
            A.appendInPlace(events, event);
          }),
        transformSessionUpdate: (notification) => {
          transformCalls += 1;
          return notification;
        },
        onTermination: () => Ref.set(terminated, true),
      });
      const received = yield* Deferred.make<AcpProtocol.AcpIncomingNotification>();
      yield* transport.incoming.pipe(
        Stream.runForEach((notification) => Deferred.succeed(received, notification)),
        Effect.forkScoped
      );

      const malformed = {
        sessionId: "session-1",
        update: { sessionUpdate: "usage_update", cost: { amount: 1, currency: secret } },
      };
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "session/update", params: malformed }));
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "session/update", params: malformed }));
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "session/update", params: usageUpdate(10) }));

      const notification = yield* Deferred.await(received);
      assert.equal(notification._tag, "SessionUpdate");
      assert.deepEqual(notification.params, usageUpdate(10));
      assert.isFalse(yield* Ref.get(terminated));
      assert.equal(transformCalls, 1);

      const decodeFailures = A.filter(events, ({ stage }) => stage === "decode_failed");
      assert.lengthOf(decodeFailures, 2);
      assert.include(decodeFailures[0]?.payload, {
        method: "session/update",
        operation: "decode-notification-payload",
      });
      const warnings = warningsAbout("update.used missing");
      assert.lengthOf(warnings, 1);
      assert.include(yield* encodeUnknownJsonText(warnings[0]), "update.used missing");
      assert.include(yield* encodeUnknownJsonText(decodeFailures[0]?.payload), "update.used missing");
      assert.notInclude(yield* encodeUnknownJsonText({ decodeFailures, capturedWarnings }), secret);
    })
  );

  it.effect(
    "warns once about one decode failure that the peer repeats at new array indices",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const dispatched = yield* Deferred.make<void>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () => Deferred.succeed(dispatched, undefined).pipe(Effect.asVoid),
      });

      // Each update carries one malformed command, at a new index every time.
      const command = { name: "a", description: "d" };
      for (const index of A.range(1, 40)) {
        const availableCommands = A.append(
          A.makeBy(index, () => command),
          { name: 1, description: "d" }
        );
        yield* Queue.offer(
          input,
          yield* jsonLine({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
              sessionId: "session-1",
              update: { sessionUpdate: "available_commands_update", availableCommands },
            },
          })
        );
      }
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "session/update", params: usageUpdate(10) }));

      yield* Deferred.await(dispatched);
      assert.lengthOf(warningsAbout("update.availableCommands"), 1);
    })
  );
});

const effectFrameParser = RpcSerialization.ndJsonRpc().makeUnsafe();

// Inbound ids pass through verbatim, so effect's own ndjson decoder output is the parity oracle for
// the package frame decoder.
const oracle = (line: string): ReadonlyArray<unknown> => effectFrameParser.decode(`${line}\n`);

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp frame decoder parity", (it) => {
  it.effect(
    "routes every JSON-RPC frame kind exactly like effect's ndjson serializer",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("session/request_permission"),
      });
      const serverSeen = yield* Queue.unbounded<unknown>();
      for (const id of [6, 8, 9, 11]) {
        yield* transport.clientProtocol.send(0, { _tag: "Request", id, tag: "x/test", payload: {}, headers: [] });
      }
      const clientSeen = yield* Queue.unbounded<unknown>();
      yield* transport.serverProtocol
        .run((_clientId, message) => Queue.offer(serverSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(clientSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      // `@effect/rpc/*` control frames and `Defect`-tagged errors deliberately diverge from the
      // oracle; see the hardening suite and the edge cases below.
      const serverFrames = [
        '{"jsonrpc":"2.0","id":7,"method":"session/request_permission","params":{"sessionId":"s","toolCall":{"toolCallId":"t","title":"x"},"options":[]}}',
      ];
      for (const line of serverFrames) {
        yield* Queue.offer(input, encoder.encode(`${line}\n`));
        assert.deepEqual([yield* Queue.take(serverSeen)], oracle(line));
      }

      const clientFrames = [
        '{"jsonrpc":"2.0","id":6,"result":{"ok":true}}',
        '{"jsonrpc":"2.0","id":8,"error":{"code":-32000,"message":"boom","data":{"k":1}}}',
        '{"jsonrpc":"2.0","id":9,"error":{"_tag":"Cause","code":-32602,"message":"bad","data":[{"_tag":"Fail","error":{"code":-32602,"message":"bad"}},{"_tag":"Die","defect":"x"}]}}',
        '{"jsonrpc":"2.0","id":11,"chunk":true,"result":[1,2]}',
      ];
      for (const line of clientFrames) {
        yield* Queue.offer(input, encoder.encode(`${line}\n`));
        assert.deepEqual([yield* Queue.take(clientSeen)], oracle(line));
      }
    })
  );

  it.effect(
    "splits batch frames and reassembles UTF-8 fragmented across chunks",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      const notifications = yield* Queue.unbounded<AcpProtocol.AcpIncomingNotification>();
      yield* transport.incoming.pipe(
        Stream.runForEach((notification) => Queue.offer(notifications, notification)),
        Effect.forkScoped
      );

      yield* Queue.offer(
        input,
        encoder.encode(
          '[{"jsonrpc":"2.0","method":"x/one","params":1},{"jsonrpc":"2.0","method":"x/two","params":2}]\n'
        )
      );
      assert.deepEqual(yield* Queue.take(notifications), { _tag: "ExtNotification", method: "x/one", params: 1 });
      assert.deepEqual(yield* Queue.take(notifications), { _tag: "ExtNotification", method: "x/two", params: 2 });

      const bytes = encoder.encode('{"jsonrpc":"2.0","method":"x/utf8","params":{"text":"😀é"}}\n');
      // Cut inside the four-byte emoji, then again right before the newline.
      const insideEmoji = bytes.indexOf(0xf0) + 2;
      yield* Queue.offer(input, bytes.slice(0, insideEmoji));
      yield* Queue.offer(input, bytes.slice(insideEmoji, bytes.length - 1));
      yield* Queue.offer(input, bytes.slice(bytes.length - 1));
      assert.deepEqual(yield* Queue.take(notifications), {
        _tag: "ExtNotification",
        method: "x/utf8",
        params: { text: "😀é" },
      });
    })
  );

  it.effect(
    "terminates with a parse error when a frame exceeds the buffer limit",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const termination = yield* Deferred.make<AcpError.AcpError>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
      });

      yield* Queue.offer(input, new Uint8Array(16 * 1024 * 1024 + 1).fill(0x20));

      assert.include(expectParseTermination(yield* Deferred.await(termination)), {
        _tag: "MaxBufferSizeExceeded",
        maxBufferSize: 16 * 1024 * 1024,
      });
    })
  );
});

const expectParseTermination = (error: AcpError.AcpError): unknown =>
  AcpError.AcpError.match(error, {
    AcpInputStreamEndedError: () => assert.fail("expected a protocol parse error"),
    AcpProcessExitedError: () => assert.fail("expected a protocol parse error"),
    AcpProtocolParseError: (failure) => O.getOrThrow(failure.cause),
    AcpRequestError: () => assert.fail("expected a protocol parse error"),
    AcpSpawnError: () => assert.fail("expected a protocol parse error"),
    AcpTransportError: () => assert.fail("expected a protocol parse error"),
  });

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp frame decoder edge cases", (it) => {
  it.effect(
    "routes the remaining cause shapes and params-less requests",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("session/request_permission"),
      });
      const serverSeen = yield* Queue.unbounded<unknown>();
      for (const id of [13, 113, 14, 10, 17]) {
        yield* transport.clientProtocol.send(0, { _tag: "Request", id, tag: "x/test", payload: {}, headers: [] });
      }
      const clientSeen = yield* Queue.unbounded<unknown>();
      yield* transport.serverProtocol
        .run((_clientId, message) => Queue.offer(serverSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(clientSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const serverFrames = [
        '{"jsonrpc":"2.0","id":12,"method":"session/request_permission"}',
        '{"jsonrpc":"2.0","id":16,"method":"session/request_permission","params":{},"headers":[["x-trace","1"]]}',
      ];
      for (const line of serverFrames) {
        yield* Queue.offer(input, encoder.encode(`${line}\n`));
        assert.deepEqual([yield* Queue.take(serverSeen)], oracle(line));
      }

      // A response without an id is not a typed RPC response, so it never reaches the RpcClient.
      yield* Queue.offer(input, encoder.encode('{"jsonrpc":"2.0","result":1}\n'));

      // An Interrupt cause entry always materialises its fiberId key, and cause data that is not a
      // cause array degrades to a single Die entry carrying the whole error object.
      yield* Queue.offer(
        input,
        encoder.encode(
          '{"jsonrpc":"2.0","id":13,"error":{"_tag":"Cause","code":1,"message":"stop","data":[{"_tag":"Interrupt"}]}}\n'
        )
      );
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 13,
        exit: { _tag: "Failure", cause: [{ _tag: "Interrupt", fiberId: undefined }] },
      });
      // Effect's JSON RPC codec encodes a missing interrupt fiberId as null; it stays an Interrupt.
      yield* Queue.offer(
        input,
        encoder.encode(
          '{"jsonrpc":"2.0","id":113,"error":{"_tag":"Cause","code":1,"message":"stop","data":[{"_tag":"Interrupt","fiberId":null}]}}\n'
        )
      );
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 113,
        exit: { _tag: "Failure", cause: [{ _tag: "Interrupt", fiberId: null }] },
      });
      // That single Die entry is a protocol-shaped error object, so it is restored to a typed Fail.
      yield* Queue.offer(
        input,
        encoder.encode('{"jsonrpc":"2.0","id":14,"error":{"_tag":"Cause","code":2,"message":"odd","data":"oops"}}\n')
      );
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 14,
        exit: {
          _tag: "Failure",
          cause: [{ _tag: "Fail", error: { _tag: "Cause", code: 2, message: "odd", data: "oops" } }],
        },
      });
      // effect reads a `Defect`-tagged error as a connection-level defect that the RpcClient applies
      // to every in-flight call. From a peer it stays the typed failure of its own request id, and
      // any other `_tag` is an ordinary extra member of the error object.
      yield* Queue.offer(
        input,
        encoder.encode(
          '{"jsonrpc":"2.0","id":10,"error":{"_tag":"Defect","code":-32603,"message":"defect","data":{"boom":true}}}\n'
        )
      );
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 10,
        exit: {
          _tag: "Failure",
          cause: [{ _tag: "Fail", error: { _tag: "Defect", code: -32603, message: "defect", data: { boom: true } } }],
        },
      });
      yield* Queue.offer(
        input,
        encoder.encode('{"jsonrpc":"2.0","id":17,"error":{"_tag":"Other","code":-32000,"message":"tagged"}}\n')
      );
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 17,
        exit: { _tag: "Failure", cause: [{ _tag: "Fail", error: { _tag: "Other", code: -32000, message: "tagged" } }] },
      });
    })
  );

  const terminations: ReadonlyArray<readonly [title: string, frame: Uint8Array, tag: string]> = [
    ["an empty chunk result", encoder.encode('{"jsonrpc":"2.0","id":15,"chunk":true,"result":[]}\n'), "SchemaError"],
    [
      "a line longer than the buffer limit",
      encoder.encode(`${Str.repeat(16 * 1024 * 1024 + 1)(" ")}\n`),
      "MaxBufferSizeExceeded",
    ],
  ];
  for (const [title, frame, tag] of terminations) {
    it.effect(
      `terminates with a parse error on ${title}`,
      Effect.fnUntraced(function* () {
        const { stdio, input } = yield* makeInMemoryStdio();
        const termination = yield* Deferred.make<AcpError.AcpError>();
        yield* AcpProtocol.makeAcpPatchedProtocol({
          stdio,
          serverRequestMethods: HashSet.empty(),
          onTermination: (error) => Deferred.succeed(termination, error).pipe(Effect.asVoid),
        });
        yield* Queue.offer(input, frame);
        assert.include(expectParseTermination(yield* Deferred.await(termination)), { _tag: tag });
      })
    );
  }
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("effect-acp untagged error decoding", (it) => {
  it.effect(
    "surfaces an untagged JSON-RPC error response as a Fail cause entry, never a Die defect",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      for (const id of [8]) {
        yield* transport.clientProtocol.send(0, { _tag: "Request", id, tag: "x/test", payload: {}, headers: [] });
      }
      const clientSeen = yield* Queue.unbounded<unknown>();
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(clientSeen, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      yield* Queue.offer(
        input,
        encoder.encode('{"jsonrpc":"2.0","id":8,"error":{"code":-32000,"message":"boom","data":{"k":1}}}\n')
      );

      // effect rc.117 parity: RpcSerialization maps a plain error object to `Fail`, so ACP
      // consumers receive a typed error on the Cause channel rather than a `Die` defect.
      assert.deepEqual(yield* Queue.take(clientSeen), {
        _tag: "Exit",
        requestId: 8,
        exit: {
          _tag: "Failure",
          cause: [{ _tag: "Fail", error: { code: -32000, message: "boom", data: { k: 1 } } }],
        },
      });
    })
  );
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp dual-generation session updates", (it) => {
  // Raw `session/update` frames: generation-1 and future updates the generation-2 codec rejects.
  const RawSessionUpdateNotification = jsonRpcNotification("session/update", S.Unknown);

  it.effect(
    "decodes generation-1 updates and a generation-2 idle that carries the prompt error",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      const notifications = yield* Deferred.make<ReadonlyArray<AcpProtocol.AcpIncomingNotification>>();
      yield* transport.incoming.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.flatMap((chunk) => Deferred.succeed(notifications, chunk)),
        Effect.forkScoped
      );

      const v1Chunk = { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } };
      const v1ToolCall = { sessionUpdate: "tool_call", toolCallId: "tool-1", title: "Read file" };
      const idle = {
        sessionUpdate: "state_update",
        state: "idle",
        stopReason: "end_turn",
        error: { code: -32603, message: "Internal error" },
      };
      for (const update of [v1Chunk, v1ToolCall, idle]) {
        yield* Queue.offer(
          input,
          yield* encodeJsonl(RawSessionUpdateNotification, {
            jsonrpc: "2.0",
            method: "session/update",
            params: { sessionId: "s-1", update },
          })
        );
      }

      const received = yield* Deferred.await(notifications);
      assert.deepEqual(
        A.map(received, (notification) =>
          notification._tag === "SessionUpdate" ? notification.params.update : assert.fail("expected a session update")
        ),
        [v1Chunk, v1ToolCall, idle]
      );
    })
  );

  it.effect(
    "dispatches the transformed (compat) session update",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        transformSessionUpdate: (notification) => ({
          sessionId: notification.sessionId,
          update: {
            sessionUpdate: "_acp_unknown",
            originalSessionUpdate: notification.update.sessionUpdate,
            raw: null,
          },
        }),
      });
      const notification = yield* Deferred.make<AcpProtocol.AcpIncomingNotification>();
      yield* transport.incoming.pipe(
        Stream.runHead,
        Effect.flatMap((head) => Deferred.succeed(notification, O.getOrThrow(head))),
        Effect.forkScoped
      );

      yield* Queue.offer(
        input,
        yield* encodeJsonl(RawSessionUpdateNotification, {
          jsonrpc: "2.0",
          method: "session/update",
          params: { sessionId: "s-1", update: { sessionUpdate: "timeline_update", entries: [] } },
        })
      );

      assert.deepEqual(yield* Deferred.await(notification), {
        _tag: "SessionUpdate",
        method: "session/update",
        params: {
          sessionId: "s-1",
          update: { sessionUpdate: "_acp_unknown", originalSessionUpdate: "timeline_update", raw: null },
        },
      });
    })
  );
});

// Protocol hardening: reentrancy, bounded concurrency, writer and termination failure paths, and the
// wire shape of typed traffic. Each case pins one review finding on the t3code port.
const WireFrame = S.Struct({
  error: S.optionalKey(S.Struct({ code: S.Finite, message: S.String })),
  id: S.optionalKey(S.Union([S.Finite, S.String])),
  method: S.optionalKey(S.String),
  result: S.optionalKey(S.Unknown),
});
const decodeWireFrame = S.decodeEffect(AcpJson.fromJsonText(WireFrame));
const takeFrame = (output: Queue.Queue<string>) => Queue.take(output).pipe(Effect.flatMap(decodeWireFrame));
const takeFrames = (output: Queue.Queue<string>, count: number) =>
  Effect.forEach(A.range(1, count), () => takeFrame(output));
// Lets every runnable fiber reach its next suspension point.
const settle = Effect.forEach(A.range(1, 20), () => Effect.yieldNow, { discard: true });

class TypedRpcs extends RpcGroup.make(
  Rpc.make("x/typed", { payload: S.Struct({ n: S.Finite }), success: S.Struct({ ok: S.Boolean }) })
) {}

const makeTypedClient = (transport: AcpProtocol.AcpPatchedProtocol) => {
  const nextRequestId = MutableRef.make(AcpProtocol.RPC_REQUEST_ID_START);
  return RpcClient.make(TypedRpcs, {
    generateRequestId: () => nextRequestId.pipe(MutableRef.getAndIncrement, RpcMessage.RequestId),
  }).pipe(Effect.provideService(RpcClient.Protocol, transport.clientProtocol));
};

type TypedClient = Effect.Success<ReturnType<typeof makeTypedClient>>;

const handlerSecret = "acp-typed-handler-secret-sentinel";

class ServerRpcs extends RpcGroup.make(
  Rpc.make("x/slow", { payload: S.Struct({}), success: S.String }),
  Rpc.make("x/fast", { payload: S.Struct({}), success: S.String }),
  Rpc.make("x/boom", { payload: S.Struct({}), success: S.String, error: AcpSchema.Error })
) {}

const serverHandlers = ServerRpcs.toLayer({
  "x/slow": () => Effect.never,
  "x/fast": () => Effect.succeed("fast"),
  "x/boom": (payload) =>
    runHandler({
      context: AcpProtocol.AcpRequestContext.make({ method: "x/boom", requestId: 3 }),
      handler: () => Effect.die(new Error(handlerSecret)),
      method: "x/boom",
      payload,
    }),
});

const serveTypedRequests = Effect.fnUntraced(function* (transport: AcpProtocol.AcpPatchedProtocol) {
  const handlers = yield* Layer.build(serverHandlers);
  yield* RpcServer.make(ServerRpcs, { disableFatalDefects: true }).pipe(
    Effect.provideService(RpcServer.Protocol, transport.serverProtocol),
    Effect.provideContext(handlers),
    Effect.forkScoped
  );
});

it.layer(NodeServices.layer, { timeout: "10 seconds" })("effect-acp protocol hardening", (it) => {
  // A child's stdin pipe breaks when it exits, so the writer can fail before the ended stdout
  // reports the exit status. The writer fails first here and the exit status arrives later.
  it.effect(
    "ends with the peer's exit when the output writer fails before the exit status arrives",
    Effect.fnUntraced(function* () {
      const classifying = yield* Deferred.make<void>();
      const exitReported = yield* Deferred.make<void>();
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: Stdio.make({
          args: Effect.succeed([]),
          stdin: Stream.never,
          stdout: () => Sink.forEach(() => Effect.die("stdin pipe closed")),
          stderr: () => Sink.drain,
        }),
        terminationError: Deferred.succeed(classifying, undefined).pipe(
          Effect.andThen(Deferred.await(exitReported)),
          Effect.as(AcpError.AcpProcessExitedError.make({ code: O.some(3) }))
        ),
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });

      yield* transport.notify("x/test", 1).pipe(Effect.ignore, Effect.forkScoped);
      yield* Deferred.await(classifying);
      yield* Deferred.succeed(exitReported, undefined);

      const error = yield* Deferred.await(terminated);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail(`expected a process exit error, got ${error._tag}`);
      }
      assertSome(error.code, 3);
    })
  );

  it.effect(
    "keeps the output writer's transport failure when the classifier reports no exit",
    Effect.fnUntraced(function* () {
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: Stdio.make({
          args: Effect.succeed([]),
          stdin: Stream.never,
          stdout: () => Sink.forEach(() => Effect.die("stdin pipe closed")),
          stderr: () => Sink.drain,
        }),
        terminationError: Effect.succeed(
          AcpError.AcpTransportError.make({ operation: O.some("read-process-exit-status") })
        ),
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });

      yield* transport.notify("x/test", 1).pipe(Effect.ignore, Effect.forkScoped);

      const error = yield* Deferred.await(terminated);
      if (error._tag !== "AcpTransportError") {
        return assert.fail(`expected a transport error, got ${error._tag}`);
      }
      assertSome(error.detail, "Failed to write an outgoing ACP message");
    })
  );

  it.effect(
    "ends with the peer's exit when the input stream fails instead of ending",
    Effect.fnUntraced(function* () {
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: Stdio.make({
          args: Effect.succeed([]),
          stdin: Stream.fromEffect(Effect.die("stdout pipe broke")),
          stdout: () => Sink.drain,
          stderr: () => Sink.drain,
        }),
        terminationError: Effect.succeed(AcpError.AcpProcessExitedError.make({ code: O.some(9) })),
        serverRequestMethods: HashSet.empty(),
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });

      const error = yield* Deferred.await(terminated);
      if (error._tag !== "AcpProcessExitedError") {
        return assert.fail(`expected a process exit error, got ${error._tag}`);
      }
      assertSome(error.code, 9);
    })
  );

  it.effect(
    "fails senders parked on the full output queue when the stdout writer fails",
    Effect.fnUntraced(function* () {
      const releaseFailure = yield* Deferred.make<void>();
      const terminated = yield* Deferred.make<AcpError.AcpError>();
      const sendCount = 2_100;
      const logged = yield* Ref.make(0);
      const allLogged = yield* Deferred.make<void>();
      const stdio = Stdio.make({
        args: Effect.succeed([]),
        stdin: Stream.never,
        stdout: () =>
          Sink.forEach(() => Deferred.await(releaseFailure).pipe(Effect.andThen(Effect.die("stdout failed")))),
        stderr: () => Sink.drain,
      });
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        logOutgoing: true,
        // Every send logs its raw frame right before it offers it to the output queue.
        logger: (event) =>
          event.stage === "raw"
            ? Ref.updateAndGet(logged, (count) => count + 1).pipe(
                Effect.flatMap((count) =>
                  count === sendCount + 1 ? Deferred.succeed(allLogged, undefined) : Effect.void
                ),
                Effect.asVoid
              )
            : Effect.void,
        onTermination: (error) => Deferred.succeed(terminated, error).pipe(Effect.asVoid),
      });
      const outcome = <A>(send: Effect.Effect<A, AcpError.AcpError>) =>
        send.pipe(Effect.match({ onFailure: O.some, onSuccess: () => O.none<AcpError.AcpError>() }), Effect.forkScoped);

      // The writer holds one chunk and the queue holds 1,024 more; the rest of the sends park.
      const notifications = yield* Effect.forEach(A.range(1, sendCount), (index) =>
        outcome(transport.notify("x/flood", index))
      );
      const request = yield* outcome(transport.request("x/test", { hello: "world" }));
      yield* Deferred.await(allLogged);
      yield* settle;
      yield* Deferred.succeed(releaseFailure, undefined);

      const error = yield* Deferred.await(terminated);
      assert.instanceOf(error, AcpError.AcpTransportError);
      const failures = A.getSomes(yield* Effect.forEach(notifications, Fiber.join));
      assert.isAbove(failures.length, 0);
      for (const failure of failures) {
        assert.strictEqual(failure, error);
      }
      assert.strictEqual(O.getOrThrow(yield* Fiber.join(request)), error);
    })
  );

  it.effect(
    "answers an extension request past the concurrency bound at once instead of parking the reader",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const protocolReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        // Every handler waits on a response that only the reader can deliver.
        onExtRequest: (_method, _params, context) =>
          Deferred.await(protocolReady).pipe(
            Effect.flatMap((protocol) => protocol.request("x/inner", { from: String(context.requestId) })),
            Effect.map((inner) => ({ inner }))
          ),
      });
      yield* Deferred.succeed(protocolReady, transport);

      const outerCount = 65;
      const outer = A.makeBy(
        outerCount,
        (index) => `{"jsonrpc":"2.0","id":"outer-${index}","method":"x/outer","params":{}}\n`
      );
      yield* Queue.offer(input, encoder.encode(A.join(outer, "")));

      const frames = yield* takeFrames(output, outerCount);
      const inner = A.filter(frames, ({ method }) => method === "x/inner");
      assert.lengthOf(inner, 64);
      assert.deepEqual(
        A.filter(frames, ({ error }) => error !== undefined),
        [{ id: "outer-64", error: { code: -32603, message: "Too many concurrent ACP extension requests" } }]
      );

      // The reader kept reading, so every inner response reaches its handler.
      const responses = A.map(inner, ({ id }) => `{"jsonrpc":"2.0","id":${id},"result":{"ok":true}}\n`);
      yield* Queue.offer(input, encoder.encode(A.join(responses, "")));
      const answered = yield* takeFrames(output, 64);
      assert.lengthOf(
        A.filter(answered, ({ result }) => result !== undefined),
        64
      );
    })
  );

  it.effect(
    "keeps the RPC server answering after it rejects a request that reuses an in-flight id",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("x/slow", "x/fast", "x/boom"),
      });
      yield* serveTypedRequests(transport);

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 1, method: "x/slow", params: {} }));
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 1, method: "x/slow", params: {} }));
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 2, method: "x/fast", params: {} }));

      assert.deepEqual(yield* takeFrame(output), { id: 2, result: "fast" });
    })
  );

  it.effect(
    "answers a dying typed request handler with a generic internal error",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("x/slow", "x/fast", "x/boom"),
      });
      yield* serveTypedRequests(transport);

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 3, method: "x/boom", params: {} }));

      const line = yield* Queue.take(output);
      assert.notInclude(line, handlerSecret);
      assert.deepEqual(yield* decodeWireFrame(line), {
        id: 3,
        error: { code: -32603, message: "ACP request handler failed for method 'x/boom'" },
      });
    })
  );

  it.effect(
    "lets a notification handler await a typed request on the same connection",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const clientReady = yield* Deferred.make<TypedClient>();
      const handled = yield* Deferred.make<{ readonly ok: boolean }>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: (notification) =>
          notification._tag === "ExtNotification" && notification.method === "x/mode-changed"
            ? Deferred.await(clientReady).pipe(
                Effect.flatMap((client) => client["x/typed"]({ n: 1 })),
                Effect.flatMap((result) => Deferred.succeed(handled, result)),
                Effect.orDie,
                Effect.asVoid
              )
            : Effect.void,
        onExtRequest: () => Effect.succeed({ ok: true }),
      });
      yield* Deferred.succeed(clientReady, yield* makeTypedClient(transport));

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "x/mode-changed", params: {} }));
      const line = yield* Queue.take(output);
      const typed = yield* decodeWireFrame(line);
      assert.equal(typed.method, "x/typed");

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: typed.id, result: { ok: true } }));
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 99, method: "x/ping", params: {} }));

      assert.deepEqual(yield* Deferred.await(handled), { ok: true });
      assert.deepEqual(yield* takeFrame(output), { id: 99, result: { ok: true } });
      // A real typed call goes on the wire without effect trace ids or headers.
      assert.equal(
        line,
        `{"jsonrpc":"2.0","method":"x/typed","params":{"n":1},"id":${AcpProtocol.RPC_REQUEST_ID_START}}\n`
      );
    })
  );

  it.effect(
    "runs notification handlers in arrival order before routing the next message",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const events = yield* Ref.make<ReadonlyArray<string>>([]);
      const record = (event: string) => Ref.update(events, A.append(event));
      const firstStarted = yield* Deferred.make<void>();
      const releaseFirst = yield* Deferred.make<void>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: (notification) => {
          const step = notification._tag === "ExtNotification" ? String(notification.params) : "other";
          return record(`start-${step}`).pipe(
            Effect.andThen(
              step === "1"
                ? Deferred.succeed(firstStarted, undefined).pipe(Effect.andThen(Deferred.await(releaseFirst)))
                : Effect.void
            ),
            Effect.andThen(record(`end-${step}`))
          );
        },
        onExtRequest: () => record("request").pipe(Effect.as({ ok: true })),
      });

      yield* Queue.offer(
        input,
        encoder.encode(
          '{"jsonrpc":"2.0","method":"x/step","params":1}\n{"jsonrpc":"2.0","method":"x/step","params":2}\n{"jsonrpc":"2.0","id":5,"method":"x/test","params":{}}\n'
        )
      );
      yield* Deferred.await(firstStarted);
      yield* settle;
      assert.deepEqual(yield* Ref.get(events), ["start-1"]);

      yield* Deferred.succeed(releaseFirst, undefined);
      assert.deepEqual(yield* takeFrame(output), { id: 5, result: { ok: true } });
      assert.deepEqual(yield* Ref.get(events), ["start-1", "end-1", "start-2", "end-2", "request"]);
    })
  );

  it.effect(
    "bounds the notification handlers waiting on the peer and keeps reading past the bound",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const protocolReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const failures = yield* Queue.unbounded<AcpError.AcpError>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        // The peer never answers these requests, so each handler keeps waiting.
        onNotification: () =>
          Deferred.await(protocolReady).pipe(
            Effect.flatMap((protocol) => protocol.request("x/inner", {})),
            Effect.tapError((error) => Queue.offer(failures, error)),
            Effect.asVoid
          ),
        onExtRequest: () => Effect.succeed({ ok: true }),
      });
      yield* Deferred.succeed(protocolReady, transport);

      const notifications = A.makeBy(65, (index) => `{"jsonrpc":"2.0","method":"x/ask","params":${index}}\n`);
      yield* Queue.offer(
        input,
        encoder.encode(`${A.join(notifications, "")}{"jsonrpc":"2.0","id":"ping","method":"x/ping","params":{}}\n`)
      );

      const frames = yield* takeFrames(output, 65);
      assert.lengthOf(
        A.filter(frames, ({ method }) => method === "x/inner"),
        64
      );
      assert.deepEqual(frames[64], { id: "ping", result: { ok: true } });
      const failure = yield* Queue.take(failures);
      if (failure._tag !== "AcpTransportError") {
        return assert.fail("expected a transport error");
      }
      assertSome(failure.detail, "Too many ACP notification handlers are already waiting for the peer");
      assertSome(failure.method, "x/inner");
    })
  );

  it.effect(
    "lets a notification handler send several requests in turn on the same connection",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const protocolReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const answers = yield* Deferred.make<ReadonlyArray<unknown>>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        // The first request releases the reader; the second is sent by an already detached handler.
        onNotification: () =>
          Deferred.await(protocolReady).pipe(
            Effect.flatMap((protocol) =>
              Effect.forEach(["x/first", "x/second"], (method) => protocol.request(method, {}))
            ),
            Effect.flatMap((results) => Deferred.succeed(answers, results)),
            Effect.asVoid
          ),
      });
      yield* Deferred.succeed(protocolReady, transport);

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", method: "x/ask", params: {} }));
      const first = yield* takeFrame(output);
      assert.equal(first.method, "x/first");
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: first.id, result: 1 }));
      const second = yield* takeFrame(output);
      assert.equal(second.method, "x/second");
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: second.id, result: 2 }));

      assert.deepEqual(yield* Deferred.await(answers), [1, 2]);
    })
  );

  it.effect(
    "keeps the reader waiting for a notification handler that sends on another connection",
    Effect.fnUntraced(function* () {
      const own = yield* makeInMemoryStdio();
      const other = yield* makeInMemoryStdio();
      const otherReady = yield* Deferred.make<AcpProtocol.AcpPatchedProtocol>();
      const answered = yield* Deferred.make<unknown>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: own.stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () =>
          Deferred.await(otherReady).pipe(
            Effect.flatMap((protocol) => protocol.request("x/elsewhere", {})),
            Effect.flatMap((result) => Deferred.succeed(answered, result)),
            Effect.asVoid
          ),
        onExtRequest: () => Effect.succeed("pong"),
      });
      yield* Deferred.succeed(
        otherReady,
        yield* AcpProtocol.makeAcpPatchedProtocol({ stdio: other.stdio, serverRequestMethods: HashSet.empty() })
      );

      yield* Queue.offer(own.input, yield* jsonLine({ jsonrpc: "2.0", method: "x/ask", params: {} }));
      yield* Queue.offer(own.input, yield* jsonLine({ jsonrpc: "2.0", id: 7, method: "x/ping", params: {} }));
      const elsewhere = yield* takeFrame(other.output);
      assert.equal(elsewhere.method, "x/elsewhere");
      // Another connection's reader delivers that response, so this reader keeps waiting for the
      // handler and the ping behind it stays unanswered.
      yield* settle;
      assert.strictEqual(yield* Queue.size(own.output), 0);

      yield* Queue.offer(other.input, yield* jsonLine({ jsonrpc: "2.0", id: elsewhere.id, result: "there" }));
      assert.equal(yield* Deferred.await(answered), "there");
      assert.deepEqual(yield* takeFrame(own.output), { id: 7, result: "pong" });
    })
  );

  it.effect(
    "removes the pending entry of an extension request interrupted while it is still being sent",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const sending = yield* Deferred.make<void>();
      const drained = yield* Deferred.make<void>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onNotification: () => Deferred.succeed(drained, undefined).pipe(Effect.asVoid),
        logOutgoing: true,
        logger: (event) =>
          event.stage === "raw" ? Deferred.succeed(sending, undefined).pipe(Effect.andThen(Effect.never)) : Effect.void,
      });
      const lateResponse = yield* Queue.unbounded<unknown>();
      yield* transport.clientProtocol
        .run(0, (message) => Queue.offer(lateResponse, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
      yield* Deferred.await(sending);
      yield* Fiber.interrupt(response);
      yield* Queue.offer(input, yield* encodeJsonl(ExtResponse, { jsonrpc: "2.0", id: 1, result: { ok: true } }));

      // The cancelled request cannot claim a late response.
      yield* Queue.offer(input, encoder.encode('{"jsonrpc":"2.0","method":"x/after","params":{}}\n'));
      yield* Deferred.await(drained);
      assert.equal(yield* Queue.size(lateResponse), 0);
    })
  );

  it.effect(
    "writes typed requests with JSON-RPC members only",
    Effect.fnUntraced(function* () {
      const { stdio, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      yield* transport.clientProtocol.send(0, {
        _tag: "Request",
        id: AcpProtocol.RPC_REQUEST_ID_START,
        tag: "session/prompt",
        payload: { sessionId: "session-1" },
        headers: [["x-trace", "1"]],
        traceId: "trace-1",
        spanId: "span-1",
        sampled: true,
      });

      assert.equal(
        yield* Queue.take(output),
        `{"jsonrpc":"2.0","method":"session/prompt","params":{"sessionId":"session-1"},"id":${AcpProtocol.RPC_REQUEST_ID_START}}\n`
      );
    })
  );

  it.effect(
    "reads @effect/rpc/* frames from the peer as ordinary messages and keeps the writer open",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const notifications = yield* Queue.unbounded<AcpProtocol.AcpIncomingNotification>();
      const terminated = yield* Ref.make(false);
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("x/slow", "x/fast", "x/boom"),
        onNotification: (notification) => Queue.offer(notifications, notification).pipe(Effect.asVoid),
        onExtRequest: (method) => Effect.succeed({ method }),
        onTermination: () => Ref.set(terminated, true),
      });
      yield* serveTypedRequests(transport);

      const frames = [
        '{"jsonrpc":"2.0","method":"@effect/rpc/Eof"}',
        '{"jsonrpc":"2.0","method":"@effect/rpc/Ping"}',
        '{"jsonrpc":"2.0","method":"@effect/rpc/Ack","params":{}}',
        '{"jsonrpc":"2.0","method":"@effect/rpc/Interrupt","params":{"requestId":1}}',
        '{"jsonrpc":"2.0","id":"after","method":"@effect/rpc/Ping","params":{}}',
      ];
      yield* Queue.offer(
        input,
        encoder.encode(
          A.join(
            A.map(frames, (frame) => `${frame}\n`),
            ""
          )
        )
      );

      assert.deepEqual(yield* Effect.forEach(A.range(1, 4), () => Queue.take(notifications)), [
        { _tag: "ExtNotification", method: "@effect/rpc/Eof", params: null },
        { _tag: "ExtNotification", method: "@effect/rpc/Ping", params: null },
        { _tag: "ExtNotification", method: "@effect/rpc/Ack", params: {} },
        { _tag: "ExtNotification", method: "@effect/rpc/Interrupt", params: { requestId: 1 } },
      ]);
      assert.deepEqual(yield* takeFrame(output), { id: "after", result: { method: "@effect/rpc/Ping" } });

      // A peer `Eof` no longer ends the writer: sends and typed responses still reach the wire.
      yield* transport.notify("session/cancel", { sessionId: "session-1" });
      assert.equal(
        yield* Queue.take(output),
        '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"session-1"}}\n'
      );
      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 2, method: "x/fast", params: {} }));
      assert.deepEqual(yield* takeFrame(output), { id: 2, result: "fast" });
      assert.isFalse(yield* Ref.get(terminated));
    })
  );

  it.effect(
    "interrupts running extension request handlers when the connection ends",
    Effect.fnUntraced(function* () {
      const { stdio, input } = yield* makeInMemoryStdio();
      const started = yield* Deferred.make<void>();
      const interrupted = yield* Deferred.make<void>();
      yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
        onExtRequest: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.onInterrupt(() => Deferred.succeed(interrupted, undefined))
          ),
      });

      yield* Queue.offer(input, yield* jsonLine({ jsonrpc: "2.0", id: 1, method: "x/long", params: {} }));
      yield* Deferred.await(started);
      yield* Queue.end(input);

      yield* Deferred.await(interrupted);
    })
  );
});

it.effect(
  "settles callers with the ended-input error when classifying the termination dies",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
      stdio,
      serverRequestMethods: HashSet.empty(),
      terminationError: Effect.die("termination classification bug"),
    });

    const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
    yield* Queue.take(output);
    yield* Queue.end(input);

    const error = yield* response.pipe(Fiber.join, expectFailure);
    assert.instanceOf(error, AcpError.AcpInputStreamEndedError);
    assert.strictEqual(yield* expectFailure(transport.notify("session/cancel", { sessionId: "session-1" })), error);
  })
);

// Outside the shared layer: `TestClock.adjust` needs this test's own clock (top-level `it.effect`
// provides a fresh `TestEnv`), not one shared with the interleaved hardening cases.
it.effect(
  "settles callers when classifying the termination outlasts its bound",
  Effect.fnUntraced(function* () {
    const { stdio, input, output } = yield* makeInMemoryStdio();
    const classifying = yield* Deferred.make<void>();
    const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
      stdio,
      serverRequestMethods: HashSet.empty(),
      // A peer that closed stdout but never exits.
      terminationError: Deferred.succeed(classifying, undefined).pipe(Effect.andThen(Effect.never)),
    });

    const response = yield* transport.request("x/test", { hello: "world" }).pipe(Effect.forkScoped);
    yield* Queue.take(output);
    yield* Queue.end(input);
    yield* Deferred.await(classifying);
    // The bound starts with the classification; a second step covers a timer that registers late.
    yield* TestClock.adjust("5 seconds");
    yield* settle;
    yield* TestClock.adjust("5 seconds");

    const error = yield* response.pipe(Fiber.join, expectFailure);
    assert.instanceOf(error, AcpError.AcpInputStreamEndedError);
    assert.strictEqual(yield* expectFailure(transport.notify("session/cancel", { sessionId: "session-1" })), error);
  })
);
