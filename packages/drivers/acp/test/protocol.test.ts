import { Client as AcpClient, Errors as AcpError, Protocol as AcpProtocol, Schema as AcpSchema } from "@beep/acp";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import {
  encodeJsonl,
  jsonRpcNotification,
  jsonRpcRequest,
  jsonRpcResponse,
  makeChildStdio,
  makeInMemoryStdio,
  makeTerminationError,
} from "./helpers.ts";

const SessionCancelNotification = jsonRpcNotification("session/cancel", AcpSchema.CancelNotification);
const SessionUpdateNotification = jsonRpcNotification("session/update", AcpSchema.SessionNotification);
const ElicitationCompleteNotification = jsonRpcNotification(
  "session/elicitation/complete",
  AcpSchema.ElicitationCompleteNotification
);
const RequestPermissionRequest = jsonRpcRequest("session/request_permission", AcpSchema.RequestPermissionRequest);
const RequestPermissionResponse = jsonRpcResponse(AcpSchema.RequestPermissionResponse);
const ExtRequest = jsonRpcRequest("x/test", Schema.Struct({ hello: Schema.String }));
const ExtResponse = jsonRpcResponse(Schema.Struct({ ok: Schema.Boolean }));
const decodeSessionCancelNotification = Schema.decodeEffect(Schema.fromJsonString(SessionCancelNotification));
const decodeExtRequest = Schema.decodeEffect(Schema.fromJsonString(ExtRequest));
const decodeRequestPermissionResponse = Schema.decodeEffect(Schema.fromJsonString(RequestPermissionResponse));
const encodeSessionCancelNotification = Schema.encodeEffect(Schema.fromJsonString(SessionCancelNotification));
const encodeRequestPermissionResponse = Schema.encodeEffect(Schema.fromJsonString(RequestPermissionResponse));
const SessionCancelNotificationArbitrary = Schema.toArbitrary(SessionCancelNotification)(fc);
const RequestPermissionResponseArbitrary = Schema.toArbitrary(RequestPermissionResponse)(fc);
const AcpProtocolLogEventArbitrary = Schema.toArbitrary(AcpProtocol.AcpProtocolLogEvent)(fc);
const AcpProtocolLoggingOptionsArbitrary = Schema.toArbitrary(AcpProtocol.AcpProtocolLoggingOptions)(fc);
const AcpIncomingNotificationArbitrary = Schema.toArbitrary(AcpProtocol.AcpIncomingNotification)(fc);
const AcpErrorArbitrary = Schema.toArbitrary(AcpError.AcpError)(fc).filter((error) =>
  AcpError.AcpError.match(error, {
    AcpProcessExitedError: (failure) => O.isNone(failure.cause),
    AcpProtocolParseError: (failure) => O.isNone(failure.cause),
    AcpRequestError: () => true,
    AcpSpawnError: (failure) => O.isNone(failure.cause),
    AcpTransportError: (failure) => O.isNone(failure.cause),
  })
);
const childProcessProtocolTestTimeout = 30_000;
const mockPeerPath = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(import.meta.dirname, "fixtures/acp-mock-peer.ts")
);

const encode = <Codec extends Schema.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(Schema.encodeResult(schema)(value));

const decode = <Codec extends Schema.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(Schema.decodeUnknownResult(schema)(value));

const assertEncodedRoundTrip = <Codec extends Schema.Codec<unknown, unknown>>(
  schema: Codec,
  value: Codec["Type"],
  options: { readonly compareDecoded?: boolean } = {}
): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  if (options.compareDecoded !== false) {
    assert.isTrue(Schema.toEquivalence(schema)(decoded, value));
  }
  assert.deepEqual(encode(schema, decoded), encoded);
};

const makeHandle = Effect.fn("AcpProtocolTest.makeHandle")(function* (env?: Record<string, string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const path = yield* Path.Path;
  const command = ChildProcess.make("bun", ["run", yield* mockPeerPath], {
    cwd: path.join(import.meta.dirname, ".."),
    extendEnv: true,
    shell: process.platform === "win32",
    stdin: "pipe",
    stderr: "inherit",
    stdout: "pipe",
    ...O.getSomesStruct({ env: O.fromUndefinedOr(env) }),
  });
  return yield* spawner.spawn(command);
});

it("round-trips schema-derived JSON-RPC notifications and responses through JSON boundaries", () =>
  fc.assert(
    fc.property(
      SessionCancelNotificationArbitrary,
      RequestPermissionResponseArbitrary,
      (cancelNotification, permissionResponse) => {
        const encodedCancelNotification = Effect.runSync(encodeSessionCancelNotification(cancelNotification));
        const decodedCancelNotification = Effect.runSync(decodeSessionCancelNotification(encodedCancelNotification));
        assert.equal(
          Effect.runSync(encodeSessionCancelNotification(decodedCancelNotification)),
          encodedCancelNotification
        );

        const encodedPermissionResponse = Effect.runSync(encodeRequestPermissionResponse(permissionResponse));
        const decodedPermissionResponse = Effect.runSync(decodeRequestPermissionResponse(encodedPermissionResponse));
        assert.equal(
          Effect.runSync(encodeRequestPermissionResponse(decodedPermissionResponse)),
          encodedPermissionResponse
        );
      }
    ),
    fcRuns(25)
  ));

it("keeps handwritten ACP schema encoded shapes byte-identical", () => {
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
    encode(AcpError.AcpProtocolParseError, AcpError.AcpProtocolParseError.make({ detail: "bad json" })),
    {
      _tag: "AcpProtocolParseError",
      detail: "bad json",
    }
  );
  assert.deepEqual(encode(AcpError.AcpTransportError, AcpError.AcpTransportError.make({ detail: "stream closed" })), {
    _tag: "AcpTransportError",
    detail: "stream closed",
  });
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
      AcpProtocol.AcpProtocolLogEvent.fromUnknown({
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
      AcpProtocol.AcpIncomingNotification.fromUnknown({
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
});

it("round-trips handwritten ACP schemas through encoded form", () =>
  fc.assert(
    fc.property(
      AcpProtocolLogEventArbitrary,
      AcpProtocolLoggingOptionsArbitrary,
      AcpIncomingNotificationArbitrary,
      AcpErrorArbitrary,
      (event, options, notification, error) => {
        assertEncodedRoundTrip(AcpProtocol.AcpProtocolLogEvent, event);
        assertEncodedRoundTrip(AcpProtocol.AcpProtocolLoggingOptions, options);
        assertEncodedRoundTrip(AcpProtocol.AcpIncomingNotification, notification);
        assertEncodedRoundTrip(AcpError.AcpError, error);
      }
    ),
    fcRuns(25)
  ));

it.layer(NodeServices.layer)("effect-acp protocol", (it) => {
  it.effect(
    "emits exact JSON-RPC notifications and decodes inbound session/update and elicitation completion",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const notifications = yield* Deferred.make<ReadonlyArray<AcpProtocol.AcpIncomingNotification>>();
      yield* transport.incoming.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.flatMap((notificationChunk) => Deferred.succeed(notifications, notificationChunk)),
        Effect.forkScoped
      );

      yield* transport.notify("session/cancel", { sessionId: "session-1" });
      const outbound = yield* Queue.take(output);
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
          params: {
            sessionId: "session-1",
            update: {
              sessionUpdate: "plan",
              entries: [
                {
                  content: "Inspect repository",
                  priority: "high",
                  status: "in_progress",
                },
              ],
            },
          },
        })
      );

      yield* Queue.offer(
        input,
        yield* encodeJsonl(ElicitationCompleteNotification, {
          jsonrpc: "2.0",
          method: "session/elicitation/complete",
          params: {
            elicitationId: "elicitation-1",
          },
        })
      );

      const [update, completion] = yield* Deferred.await(notifications);
      assert.equal(update?._tag, "SessionUpdate");
      assert.equal(completion?._tag, "ElicitationComplete");
    })
  );

  it.effect(
    "logs outgoing notifications when logOutgoing is enabled",
    Effect.fnUntraced(function* () {
      const { stdio } = yield* makeInMemoryStdio();
      const events: Array<AcpProtocol.AcpProtocolLogEvent> = [];
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
            _tag: "Request",
            id: "",
            tag: "session/cancel",
            payload: {
              sessionId: "session-1",
            },
            headers: [],
          },
        },
        {
          direction: "outgoing",
          stage: "raw",
          payload:
            '{"jsonrpc":"2.0","method":"session/cancel","params":{"sessionId":"session-1"},"id":"","headers":[]}\n',
        },
      ]);
    })
  );

  it.effect(
    "fails notification encoding through the declared ACP error channel",
    Effect.fnUntraced(function* () {
      const { stdio } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });

      const bigintError = yield* transport.notify("x/test", 1n).pipe(Effect.flip);
      assert.instanceOf(bigintError, AcpError.AcpProtocolParseError);
      assert.equal(bigintError.detail, "Failed to encode ACP message");

      const circular: Record<string, unknown> = {};
      circular.self = circular;
      const circularError = yield* transport.notify("x/test", circular).pipe(Effect.flip);
      assert.instanceOf(circularError, AcpError.AcpProtocolParseError);
      assert.equal(circularError.detail, "Failed to encode ACP message");
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

      yield* Queue.offer(
        input,
        yield* encodeJsonl(ExtResponse, {
          jsonrpc: "2.0",
          id: 1,
          result: {
            ok: true,
          },
        })
      );

      const resolved = yield* Fiber.join(response);
      assert.deepEqual(resolved, { ok: true });
    })
  );

  it.effect(
    "preserves zero-valued ids for inbound core client requests",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.make("session/request_permission"),
      });
      const inboundRequest = yield* Deferred.make<unknown>();

      yield* transport.serverProtocol
        .run((_clientId, message) => Deferred.succeed(inboundRequest, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      yield* Queue.offer(
        input,
        yield* encodeJsonl(RequestPermissionRequest, {
          jsonrpc: "2.0",
          id: 0,
          method: "session/request_permission",
          params: {
            sessionId: "session-1",
            toolCall: {
              toolCallId: "tool-1",
              title: "Allow mock action",
            },
            options: [
              {
                optionId: "allow",
                name: "Allow",
                kind: "allow_once",
              },
            ],
          },
          headers: [],
        })
      );

      const message = yield* Deferred.await(inboundRequest);
      assert.deepEqual(message, {
        _tag: "Request",
        id: "0",
        tag: "session/request_permission",
        payload: {
          sessionId: "session-1",
          toolCall: {
            toolCallId: "tool-1",
            title: "Allow mock action",
          },
          options: [
            {
              optionId: "allow",
              name: "Allow",
              kind: "allow_once",
            },
          ],
        },
        headers: [],
      });

      yield* transport.serverProtocol.send(0, {
        _tag: "Exit",
        requestId: "0",
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

      const outbound = yield* Queue.take(output);
      assert.deepEqual(yield* decodeRequestPermissionResponse(outbound), {
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
    "cleans up interrupted extension requests before a late response arrives",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio,
        serverRequestMethods: HashSet.empty(),
      });
      const lateResponse = yield* Deferred.make<unknown>();

      yield* transport.clientProtocol
        .run(0, (message) => Deferred.succeed(lateResponse, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

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

      yield* Fiber.interrupt(response);
      yield* Queue.offer(
        input,
        yield* encodeJsonl(ExtResponse, {
          jsonrpc: "2.0",
          id: 1,
          result: {
            ok: true,
          },
        })
      );

      const message = yield* Deferred.await(lateResponse);
      assert.deepEqual(message, {
        _tag: "Exit",
        requestId: "1",
        exit: {
          _tag: "Success",
          value: {
            ok: true,
          },
        },
      });
    })
  );

  it.effect(
    "propagates the real child exit code when the input stream ends",
    Effect.fnUntraced(function* () {
      const handle = yield* makeHandle({
        ACP_MOCK_EXIT_IMMEDIATELY_CODE: "7",
      });
      assert.isDefined(AcpClient.layerChildProcess({ handle }));
      const firstMessage = yield* Deferred.make<unknown>();
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

      const message = yield* Deferred.await(firstMessage);
      const exitError = yield* Deferred.await(termination);
      assert.instanceOf(exitError, AcpError.AcpProcessExitedError);
      assert.equal(O.getOrThrow((exitError as AcpError.AcpProcessExitedError).code), 7);
      assert.equal(
        (
          message as {
            readonly _tag?: string;
          }
        )._tag,
        "ClientProtocolError"
      );
      const defect = (
        message as {
          readonly error: {
            readonly reason: unknown;
          };
        }
      ).error.reason as {
        readonly _tag: string;
        readonly cause: unknown;
      };
      assert.equal(defect._tag, "RpcClientDefect");
      assert.instanceOf(defect.cause, AcpError.AcpProcessExitedError);
      assert.equal(O.getOrThrow((defect.cause as AcpError.AcpProcessExitedError).code), 7);
    }),
    childProcessProtocolTestTimeout
  );

  it.effect(
    "does not emit a second process-exit error after a decode failure",
    Effect.fnUntraced(function* () {
      const handle = yield* makeHandle({
        ACP_MOCK_MALFORMED_OUTPUT: "1",
        ACP_MOCK_MALFORMED_OUTPUT_EXIT_CODE: "23",
      });
      const terminationCalls = yield* Ref.make(0);
      const firstMessage = yield* Deferred.make<unknown>();
      const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
        stdio: makeChildStdio(handle),
        terminationError: makeTerminationError(handle),
        serverRequestMethods: HashSet.empty(),
        onTermination: () => Ref.update(terminationCalls, (count) => count + 1),
      });

      yield* transport.clientProtocol
        .run(0, (message) => Deferred.succeed(firstMessage, message).pipe(Effect.asVoid))
        .pipe(Effect.forkScoped);

      const message = yield* Deferred.await(firstMessage);
      assert.equal(yield* Ref.get(terminationCalls), 1);
      assert.equal(
        (
          message as {
            readonly _tag?: string;
          }
        )._tag,
        "ClientProtocolError"
      );
      const defect = (
        message as {
          readonly error: {
            readonly reason: unknown;
          };
        }
      ).error.reason as {
        readonly _tag: string;
        readonly cause: unknown;
      };
      assert.equal(defect._tag, "RpcClientDefect");
      assert.instanceOf(defect.cause, AcpError.AcpProtocolParseError);
    }),
    childProcessProtocolTestTimeout
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

      const error = yield* Fiber.join(response).pipe(
        Effect.match({
          onFailure: (error) => error,
          onSuccess: () => assert.fail("Expected request to fail after process exit"),
        })
      );
      assert.instanceOf(error, AcpError.AcpProcessExitedError);
      assert.equal(O.getOrThrow(error.code), 0);
    })
  );
});
