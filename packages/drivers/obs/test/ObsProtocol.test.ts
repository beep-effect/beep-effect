import {
  computeObsAuthentication,
  decodeObsOutgoingMessageJson,
  encodeObsIncomingMessageJson,
  ObsAuthChallenge,
  ObsError,
  ObsEventEnvelope,
  ObsEventMessage,
  ObsHello,
  ObsHelloMessage,
  ObsIdentified,
  ObsIdentifiedMessage,
  ObsProtocol,
  ObsRecordStateChangedEvent,
  ObsRequestResponseEnvelope,
  ObsRequestResponseMessage,
  ObsRequestStatus,
  ObsUnknownEvent,
  resolveObsConfig,
} from "@beep/obs";
import { A, O, P, pipe, Str } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, PubSub, Queue, Redacted, Ref, Stream } from "effect";
import { Socket } from "effect/unstable/socket";
import type { ObsIdentify, ObsIncomingMessage, ObsRequestEnvelope } from "@beep/obs";
import type { UnknownRecord } from "@beep/schema";
import type * as Cause from "effect/Cause";

const textDecoder = new TextDecoder();

// Challenge, salt, and password from the obs-websocket protocol.md
// "Creating an authentication string" walkthrough. The expected string was
// cross-verified against an independent SHA256 reference implementation:
// base64(sha256(base64(sha256(password + salt)) + challenge)). (The Identify
// example message in protocol.md carries an authentication string from a
// different session and does not correspond to this challenge/salt pair.)
const DOC_CHALLENGE = "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY="; // gitleaks:allow — public protocol.md doc value
const DOC_SALT = "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI="; // gitleaks:allow — public protocol.md doc value
const DOC_PASSWORD = "supersecretpassword";
const DOC_AUTHENTICATION = "1Ct943GAT+6YQUUX47Ia/ncufilbe6+oD6lY+5kaCu4="; // gitleaks:allow — public protocol.md doc value

type EmitMessage = (message: ObsIncomingMessage) => Effect.Effect<void>;

type FakeObsServerOptions = {
  readonly authentication?: ObsAuthChallenge | undefined;
  readonly onRequest?: ((envelope: ObsRequestEnvelope, emit: EmitMessage) => Effect.Effect<void>) | undefined;
  /**
   * When set, the server answers Identify by closing the connection with this
   * code instead of Identified — how obs-websocket rejects bad credentials
   * (close code 4009).
   */
  readonly rejectIdentifyWithCloseCode?: number | undefined;
};

/**
 * In-memory obs-websocket server faked through `Socket.make`: emits Hello on
 * open, answers Identify with Identified, records every client frame, and
 * routes Request envelopes to the test-supplied responder.
 */
const makeFakeObsServer = Effect.fnUntraced(function* (options?: FakeObsServerOptions | undefined) {
  const incoming = yield* Queue.unbounded<string, Cause.Done>();
  const sentFrames = yield* Ref.make(A.empty<string>());
  const identifies = yield* Ref.make(A.empty<ObsIdentify>());

  const emitMessage: EmitMessage = (message) =>
    encodeObsIncomingMessageJson(message).pipe(
      Effect.flatMap((frame) => Queue.offer(incoming, frame)),
      Effect.asVoid,
      Effect.orDie
    );

  const hello = ObsHello.make({
    authentication: O.fromUndefinedOr(options?.authentication),
    obsStudioVersion: O.some("32.1.2"),
    obsWebSocketVersion: "5.5.2",
    rpcVersion: 1,
  });

  const identifyResponse =
    options?.rejectIdentifyWithCloseCode === undefined
      ? emitMessage(ObsIdentifiedMessage.make({ d: ObsIdentified.make({ negotiatedRpcVersion: 1 }) }))
      : Queue.end(incoming).pipe(Effect.asVoid);

  const handleClientFrame = (text: string): Effect.Effect<void> =>
    decodeObsOutgoingMessageJson(text).pipe(
      Effect.flatMap((message) =>
        message.op === 1
          ? Ref.update(identifies, A.append(message.d)).pipe(Effect.andThen(identifyResponse))
          : (options?.onRequest?.(message.d, emitMessage) ?? Effect.void)
      ),
      Effect.orDie
    );

  const socket = Socket.make({
    runRaw: (handler, opts) =>
      Effect.suspend(() => opts?.onOpen ?? Effect.void).pipe(
        Effect.andThen(emitMessage(ObsHelloMessage.make({ d: hello }))),
        Effect.andThen(
          Stream.fromQueue(incoming).pipe(
            Stream.runForEach((frame) => {
              const result = handler(frame);
              return Effect.isEffect(result) ? Effect.asVoid(result) : Effect.void;
            })
          )
        ),
        Effect.andThen(
          Effect.fail(
            Socket.SocketError.make({
              reason: Socket.SocketCloseError.make({ code: options?.rejectIdentifyWithCloseCode ?? 1006 }),
            })
          )
        )
      ),
    writer: Effect.succeed((chunk) => {
      if (Socket.isCloseEvent(chunk)) {
        return Queue.end(incoming).pipe(Effect.asVoid);
      }
      const text = P.isString(chunk) ? chunk : textDecoder.decode(chunk);
      return Ref.update(sentFrames, A.append(text)).pipe(Effect.andThen(handleClientFrame(text)));
    }),
  });

  return {
    emitMessage,
    end: Queue.end(incoming).pipe(Effect.asVoid),
    identifies: Ref.get(identifies),
    sentFrames: Ref.get(sentFrames),
    socket,
  };
});

const respondSuccess = (
  envelope: ObsRequestEnvelope,
  emit: EmitMessage,
  responseData: O.Option<UnknownRecord>
): Effect.Effect<void> =>
  emit(
    ObsRequestResponseMessage.make({
      d: ObsRequestResponseEnvelope.make({
        requestId: envelope.requestId,
        requestStatus: ObsRequestStatus.make({ code: 100, result: true }),
        requestType: envelope.requestType,
        responseData,
      }),
    })
  );

describe("computeObsAuthentication", () => {
  it("reproduces the documented obs-websocket authentication vector", () => {
    expect(computeObsAuthentication({ challenge: DOC_CHALLENGE, password: DOC_PASSWORD, salt: DOC_SALT })).toBe(
      DOC_AUTHENTICATION
    );
  });
});

describe("ObsProtocol.connectWith", () => {
  it.effect(
    "completes the handshake without authentication and identifies with the configured subscriptions",
    Effect.fnUntraced(function* () {
      const server = yield* makeFakeObsServer();
      const protocol = yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());

      expect(protocol.identified.negotiatedRpcVersion).toBe(1);
      expect(O.isNone(protocol.hello.authentication)).toBe(true);

      const identifies = yield* server.identifies;
      const identify = A.head(identifies);
      assert(O.isSome(identify));
      expect(identify.value.eventSubscriptions).toBe(79);
      expect(identify.value.rpcVersion).toBe(1);
      expect(O.isNone(identify.value.authentication)).toBe(true);
    })
  );

  it.effect(
    "answers an authentication challenge with the derived authentication string",
    Effect.fnUntraced(function* () {
      const server = yield* makeFakeObsServer({
        authentication: ObsAuthChallenge.make({ challenge: DOC_CHALLENGE, salt: DOC_SALT }),
      });
      const protocol = yield* ObsProtocol.connectWith(
        server.socket,
        resolveObsConfig({ password: O.some(Redacted.make(DOC_PASSWORD)) })
      );

      expect(protocol.identified.negotiatedRpcVersion).toBe(1);
      const identifies = yield* server.identifies;
      const identify = A.head(identifies);
      assert(O.isSome(identify));
      const authentication = identify.value.authentication;
      assert(O.isSome(authentication));
      expect(authentication.value).toBe(DOC_AUTHENTICATION);
    })
  );

  it.effect(
    "fails the handshake actionably when authentication is required but no password is configured",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.scoped(
        Effect.gen(function* () {
          const server = yield* makeFakeObsServer({
            authentication: ObsAuthChallenge.make({ challenge: DOC_CHALLENGE, salt: DOC_SALT }),
          });
          return yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());
        })
      ).pipe(Effect.flip);

      assert(ObsError.is(error));
      // "authenticate", not "connect": the server was reachable, so the
      // spawn-and-retry recovery in Obs.connectAndMake must not engage.
      expect(error.operation).toBe("authenticate");
      expect(pipe(error.message, Str.includes("password"))).toBe(true);
    })
  );

  it.effect(
    "tags a close-4009 handshake rejection as an authentication failure",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.scoped(
        Effect.gen(function* () {
          const server = yield* makeFakeObsServer({
            authentication: ObsAuthChallenge.make({ challenge: DOC_CHALLENGE, salt: DOC_SALT }),
            rejectIdentifyWithCloseCode: 4009,
          });
          return yield* ObsProtocol.connectWith(
            server.socket,
            resolveObsConfig({ password: O.some(Redacted.make("wrong-password")) })
          );
        })
      ).pipe(Effect.flip);

      assert(ObsError.is(error));
      expect(error.operation).toBe("authenticate");
      assert(O.isSome(error.closeCode));
      expect(error.closeCode.value).toBe(4009);
    })
  );

  it.effect(
    "correlates concurrent requests by requestId even when responses arrive out of order",
    Effect.fnUntraced(function* () {
      const buffered = yield* Ref.make(A.empty<ObsRequestEnvelope>());
      const server = yield* makeFakeObsServer({
        onRequest: (envelope, emit) =>
          Ref.modify(buffered, (list) => {
            const next = A.append(list, envelope);
            return A.length(next) === 2
              ? ([O.some(next), A.empty<ObsRequestEnvelope>()] as const)
              : ([O.none<ReadonlyArray<ObsRequestEnvelope>>(), next] as const);
          }).pipe(
            Effect.flatMap(
              O.match({
                onNone: () => Effect.void,
                onSome: (envelopes) =>
                  Effect.forEach(
                    A.reverse(envelopes),
                    (entry) => respondSuccess(entry, emit, O.some({ echoedRequestType: entry.requestType })),
                    { discard: true }
                  ),
              })
            )
          ),
      });
      const protocol = yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());

      const [first, second] = yield* Effect.all([protocol.request("GetVersion"), protocol.request("GetRecordStatus")], {
        concurrency: 2,
      });

      assert(O.isSome(first));
      expect(first.value).toEqual({ echoedRequestType: "GetVersion" });
      assert(O.isSome(second));
      expect(second.value).toEqual({ echoedRequestType: "GetRecordStatus" });
    })
  );

  it.effect(
    "fails a request with status context when the server reports a failed RequestStatus",
    Effect.fnUntraced(function* () {
      const server = yield* makeFakeObsServer({
        onRequest: (envelope, emit) =>
          emit(
            ObsRequestResponseMessage.make({
              d: ObsRequestResponseEnvelope.make({
                requestId: envelope.requestId,
                requestStatus: ObsRequestStatus.make({
                  code: 608,
                  comment: O.some("Parameter: sceneName"),
                  result: false,
                }),
                requestType: envelope.requestType,
              }),
            })
          ),
      });
      const protocol = yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());

      const error = yield* protocol.request("SetCurrentProgramScene", { sceneName: "missing" }).pipe(Effect.flip);

      assert(ObsError.is(error));
      expect(error.operation).toBe("request");
      assert(O.isSome(error.requestStatusCode));
      expect(error.requestStatusCode.value).toBe(608);
      assert(O.isSome(error.requestStatusComment));
      expect(error.requestStatusComment.value).toBe("Parameter: sceneName");
      assert(O.isSome(error.requestType));
      expect(error.requestType.value).toBe("SetCurrentProgramScene");
    })
  );

  it.effect(
    "decodes RecordStateChanged events and passes unknown events through losslessly",
    Effect.fnUntraced(function* () {
      const server = yield* makeFakeObsServer();
      const protocol = yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());
      const subscription = yield* protocol.subscribeEvents;

      yield* server.emitMessage(
        ObsEventMessage.make({
          d: ObsEventEnvelope.make({
            eventData: O.some({
              outputActive: true,
              outputPath: null,
              outputState: "OBS_WEBSOCKET_OUTPUT_STARTED",
            }),
            eventIntent: 64,
            eventType: "RecordStateChanged",
          }),
        })
      );
      yield* server.emitMessage(
        ObsEventMessage.make({
          d: ObsEventEnvelope.make({
            eventData: O.some({ studioModeEnabled: true }),
            eventIntent: 1,
            eventType: "StudioModeStateChanged",
          }),
        })
      );

      const first = yield* PubSub.take(subscription);
      assert(ObsRecordStateChangedEvent.is(first));
      expect(first.outputState).toBe("OBS_WEBSOCKET_OUTPUT_STARTED");
      expect(first.outputActive).toBe(true);
      expect(O.isNone(first.outputPath)).toBe(true);

      const second = yield* PubSub.take(subscription);
      assert(ObsUnknownEvent.is(second));
      expect(second.eventType).toBe("StudioModeStateChanged");
      assert(O.isSome(second.eventData));
      expect(second.eventData.value).toEqual({ studioModeEnabled: true });
    })
  );

  it.effect(
    "fails all in-flight requests when the connection drops",
    Effect.fnUntraced(function* () {
      const received = yield* Deferred.make<void>();
      const server = yield* makeFakeObsServer({
        onRequest: () => Deferred.succeed(received, undefined).pipe(Effect.asVoid),
      });
      const protocol = yield* ObsProtocol.connectWith(server.socket, resolveObsConfig());

      const fiber = yield* protocol.request("GetVersion").pipe(Effect.forkChild);
      yield* Deferred.await(received);
      yield* server.end;

      const error = yield* Fiber.join(fiber).pipe(Effect.flip);
      assert(ObsError.is(error));
      assert(O.isSome(error.closeCode));
      expect(error.closeCode.value).toBe(1006);
    })
  );
});
