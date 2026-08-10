/**
 * Low-level obs-websocket v5 protocol service.
 *
 * Speaks the `obswebsocket.json` subprotocol over an Effect
 * {@link Socket.Socket}: performs the Hello → Identify → Identified handshake
 * inside scoped acquisition (including SHA256 challenge authentication),
 * correlates requests to responses through a `Ref<HashMap<requestId, Deferred>>`
 * (mirroring `@beep/acp`'s protocol adapter), publishes events through a
 * sliding PubSub, and fails all in-flight requests on disconnect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { $ObsId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { O } from "@beep/utils";
import {
  Cause,
  Context,
  Deferred,
  Duration,
  Effect,
  flow,
  HashMap,
  Layer,
  Match,
  PubSub,
  Redacted,
  Ref,
  Stream,
} from "effect";
import * as S from "effect/Schema";
import { Socket } from "effect/unstable/socket";
import { ObsError } from "./Obs.errors.ts";
import { resolveObsConfig } from "./Obs.models.ts";
import {
  decodeObsIncomingMessageJson,
  encodeObsOutgoingMessageJson,
  OBS_RPC_VERSION,
  ObsIdentify,
  ObsIdentifyMessage,
  ObsIncomingMessage,
  ObsRecordStateChangedData,
  ObsRecordStateChangedEvent,
  ObsRequestEnvelope,
  ObsRequestMessage,
  ObsUnknownEvent,
} from "./ObsProtocol.models.ts";
import type { UnknownRecord } from "@beep/schema";
import type * as Scope from "effect/Scope";
import type { ObsConfig, ObsConfigInputOptions } from "./Obs.models.ts";
import type {
  ObsAuthChallenge,
  ObsEvent,
  ObsEventEnvelope,
  ObsHello,
  ObsIdentified,
  ObsOutgoingMessage,
  ObsRequestResponseEnvelope,
  ObsRequestType,
} from "./ObsProtocol.models.ts";

const $I = $ObsId.create("ObsProtocol.service");

const OBS_EVENT_PUBSUB_CAPACITY = 256;
// obs-websocket closes the session with WebSocketCloseCode
// AuthenticationFailed (4009) when the Identify authentication string is
// rejected — a reachability-independent failure the driver must not retry.
const OBS_CLOSE_CODE_AUTHENTICATION_FAILED = 4009;
const OBS_WEBSOCKET_SUBPROTOCOL = "obswebsocket.json";
const OBS_WEBSOCKET_CONFIG_HINT =
  "Ensure OBS Studio is running with the WebSocket server enabled — Tools → WebSocket Server Settings in OBS, " +
  'or set "server_enabled": true in ~/.config/obs-studio/plugin_config/obs-websocket/config.json.';

const webSocketUrl = (config: ObsConfig): string => `ws://${config.host}:${config.port}`;

type PendingRequests = HashMap.HashMap<string, Deferred.Deferred<O.Option<UnknownRecord>, ObsError>>;

/**
 * Input for {@link computeObsAuthentication}.
 *
 * **Example** (Make authentication options)
 *
 * ```ts
 * import { ComputeObsAuthenticationOptions } from "@beep/obs"
 *
 * const options = ComputeObsAuthenticationOptions.make({
 *   challenge: "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=",
 *   password: "supersecretpassword",
 *   salt: "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI="
 * })
 * console.log(options.challenge)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComputeObsAuthenticationOptions extends S.Class<ComputeObsAuthenticationOptions>(
  $I`ComputeObsAuthenticationOptions`
)(
  {
    challenge: S.String.pipe(
      $I.annoteKey("ComputeObsAuthenticationOptions.challenge", {
        description: "Base64 challenge string from the obs-websocket Hello message.",
      })
    ),
    password: S.String.pipe(
      $I.annoteKey("ComputeObsAuthenticationOptions.password", {
        description: "Plain obs-websocket password (unwrap Redacted at the call site).",
      })
    ),
    salt: S.String.pipe(
      $I.annoteKey("ComputeObsAuthenticationOptions.salt", {
        description: "Base64 salt string from the obs-websocket Hello message.",
      })
    ),
  },
  $I.annote("ComputeObsAuthenticationOptions", {
    description: "Input for computing the obs-websocket Identify authentication string.",
  })
) {}

const ComputeObsAuthentication = Fn({
  input: ComputeObsAuthenticationOptions,
  output: S.String,
}).pipe(
  $I.annoteSchema("ComputeObsAuthentication", {
    description: "Schema-backed builder for the obs-websocket Identify authentication string.",
  })
);

/**
 * Compute the obs-websocket `Identify` authentication string:
 * `base64(sha256(base64(sha256(password + salt)) + challenge))`.
 *
 * **Example** (Compute authentication string)
 *
 * ```ts
 * import { computeObsAuthentication } from "@beep/obs"
 *
 * const authentication = computeObsAuthentication({
 *   challenge: "+IxH4CnCiqpX1rM9scsNynZzbOe4KhDeYcTNS3PDaeY=",
 *   password: "supersecretpassword",
 *   salt: "lM1GncleQOaCu9lT1yeUZhFYnqhsLLP1G5lAGo3ixaI="
 * })
 * console.log(authentication)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const computeObsAuthentication: (options: ComputeObsAuthenticationOptions) => string =
  ComputeObsAuthentication.implementSync((options) => {
    const secret = createHash("sha256").update(`${options.password}${options.salt}`).digest("base64");
    return createHash("sha256").update(`${secret}${options.challenge}`).digest("base64");
  });

const socketFailureToObsError = (config: ObsConfig): ((error: Socket.SocketError) => ObsError) => {
  const toError: (reason: Socket.SocketErrorReason) => ObsError = Match.type<Socket.SocketErrorReason>().pipe(
    Match.tagsExhaustive({
      SocketOpenError: (reason) =>
        ObsError.fromUnknown(
          "connect",
          `Could not connect to obs-websocket at ${webSocketUrl(config)}. ${OBS_WEBSOCKET_CONFIG_HINT}`,
          { cause: reason.cause }
        ),
      SocketCloseError: (reason) =>
        ObsError.make({
          closeCode: O.some(reason.code),
          message: `obs-websocket connection closed (${reason.message}).`,
          // Close 4009 means the server was reachable and rejected the
          // credentials: tag it "authenticate" so connect-keyed spawn/retry
          // predicates surface it immediately instead of relaunching OBS.
          operation: reason.code === OBS_CLOSE_CODE_AUTHENTICATION_FAILED ? "authenticate" : "connect",
        }),
      SocketReadError: (reason) =>
        ObsError.fromUnknown("connect", "Reading from the obs-websocket connection failed.", {
          cause: reason.cause,
        }),
      SocketWriteError: (reason) =>
        ObsError.fromUnknown("connect", "Writing to the obs-websocket connection failed.", {
          cause: reason.cause,
        }),
    })
  );
  return (error) => toError(error.reason);
};

/**
 * Runtime shape exposed by the {@link ObsProtocol} service.
 *
 * **Example** (Take first protocol event)
 *
 * ```ts
 * import type { ObsProtocolShape } from "@beep/obs"
 * import { Stream } from "effect"
 *
 * const eventsOf = (protocol: ObsProtocolShape) => Stream.take(protocol.events, 1)
 * console.log(eventsOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ObsProtocolShape {
  /**
   * Driver events published by the server, as a Stream. Each run of the
   * stream subscribes from that point on.
   */
  readonly events: Stream.Stream<ObsEvent>;
  /**
   * The `Hello` payload received during the handshake.
   */
  readonly hello: ObsHello;
  /**
   * The `Identified` payload that completed the handshake.
   */
  readonly identified: ObsIdentified;
  /**
   * Send one obs-websocket request and await its correlated response data.
   * Fails with {@link ObsError} carrying `requestStatusCode` when the server
   * reports a non-success `RequestStatus`.
   */
  readonly request: (
    requestType: ObsRequestType,
    requestData?: UnknownRecord | undefined
  ) => Effect.Effect<O.Option<UnknownRecord>, ObsError>;
  /**
   * Subscribe to driver events ahead of triggering an action, so no event
   * can be missed between trigger and first stream pull.
   */
  readonly subscribeEvents: Effect.Effect<PubSub.Subscription<ObsEvent>, never, Scope.Scope>;
}

const connectWith = Effect.fn($I`connectWith`)(function* (
  socket: Socket.Socket,
  config: ObsConfig
): Effect.fn.Return<ObsProtocolShape, ObsError, Scope.Scope> {
  const pending = yield* Ref.make<PendingRequests>(HashMap.empty());
  const eventsPubSub = yield* PubSub.sliding<ObsEvent>(OBS_EVENT_PUBSUB_CAPACITY);
  const helloDeferred = yield* Deferred.make<ObsHello, ObsError>();
  const identifiedDeferred = yield* Deferred.make<ObsIdentified, ObsError>();
  const nextRequestId = yield* Ref.make(1);
  const write = yield* socket.writer;
  const normalizeSocketFailure = socketFailureToObsError(config);

  const sendMessage = Effect.fn($I`sendMessage`)((message: ObsOutgoingMessage) =>
    encodeObsOutgoingMessageJson(message).pipe(
      Effect.flatMap(write),
      Effect.mapError((cause) => ObsError.fromUnknown("send", "Failed to send an obs-websocket message.", { cause }))
    )
  );

  const removePending = Effect.fn($I`removePending`)((requestId: string) =>
    Ref.update(pending, (map) => HashMap.remove(map, requestId))
  );

  const failAllPending = Effect.fn($I`failAllPending`)((error: ObsError) =>
    Ref.getAndSet(pending, HashMap.empty()).pipe(
      Effect.flatMap((map) =>
        Effect.forEach(HashMap.values(map), (deferred) => Deferred.fail(deferred, error), {
          discard: true,
        })
      )
    )
  );

  const authenticatedIdentify = (challenge: ObsAuthChallenge): Effect.Effect<ObsIdentify, ObsError> =>
    O.match(config.password, {
      onNone: () =>
        Effect.fail(
          ObsError.make({
            message:
              "obs-websocket requires authentication but no password is configured. " +
              "Provide ObsConfigInput.password (for example from OBS_WEBSOCKET_PASSWORD).",
            operation: "authenticate",
          })
        ),
      onSome: (password) =>
        Effect.succeed(
          ObsIdentify.make({
            authentication: O.some(
              computeObsAuthentication({
                challenge: challenge.challenge,
                password: Redacted.value(password),
                salt: challenge.salt,
              })
            ),
            eventSubscriptions: config.eventSubscriptions,
            rpcVersion: OBS_RPC_VERSION,
          })
        ),
    });

  const buildIdentify = (hello: ObsHello): Effect.Effect<ObsIdentify, ObsError> =>
    O.match(hello.authentication, {
      onNone: () =>
        Effect.succeed(
          ObsIdentify.make({
            authentication: O.none(),
            eventSubscriptions: config.eventSubscriptions,
            rpcVersion: OBS_RPC_VERSION,
          })
        ),
      onSome: authenticatedIdentify,
    });

  const handleHello = Effect.fn($I`handleHello`)(function* (hello: ObsHello) {
    yield* Deferred.succeed(helloDeferred, hello);
    yield* buildIdentify(hello).pipe(
      Effect.flatMap((identify) => sendMessage(ObsIdentifyMessage.make({ d: identify }))),
      Effect.catch((error) => Deferred.fail(identifiedDeferred, error).pipe(Effect.asVoid))
    );
  });

  const handleIdentified = Effect.fn($I`handleIdentified`)((identified: ObsIdentified) =>
    Deferred.succeed(identifiedDeferred, identified).pipe(Effect.asVoid)
  );

  const publishEvent = Effect.fn($I`publishEvent`)((event: ObsEvent) =>
    PubSub.publish(eventsPubSub, event).pipe(Effect.asVoid)
  );

  const unknownEventFromEnvelope = (envelope: ObsEventEnvelope): ObsUnknownEvent =>
    ObsUnknownEvent.make({
      eventData: envelope.eventData,
      eventIntent: envelope.eventIntent,
      eventType: envelope.eventType,
    });

  const handleEvent = Effect.fn($I`handleEvent`)((envelope: ObsEventEnvelope) =>
    envelope.eventType === "RecordStateChanged"
      ? ObsRecordStateChangedData.decodeEffect(O.getOrElse(envelope.eventData, (): UnknownRecord => ({}))).pipe(
          Effect.matchEffect({
            onFailure: (cause) =>
              Effect.logWarning("Failed to decode RecordStateChanged event data; passing through unmodeled.").pipe(
                Effect.annotateLogs({ cause }),
                Effect.andThen(publishEvent(unknownEventFromEnvelope(envelope)))
              ),
            onSuccess: (data) =>
              publishEvent(
                ObsRecordStateChangedEvent.make({
                  outputActive: data.outputActive,
                  outputPath: data.outputPath,
                  outputState: data.outputState,
                })
              ),
          })
        )
      : publishEvent(unknownEventFromEnvelope(envelope))
  );

  const responseToExit = (envelope: ObsRequestResponseEnvelope) =>
    Effect.fnUntraced(function* (deferred: Deferred.Deferred<O.Option<UnknownRecord>, ObsError>) {
      if (envelope.requestStatus.result) {
        yield* Deferred.succeed(deferred, envelope.responseData);
        return;
      }
      yield* Deferred.fail(
        deferred,
        ObsError.make({
          message: `obs-websocket request ${envelope.requestType} failed with RequestStatus code ${envelope.requestStatus.code}${O.match(
            envelope.requestStatus.comment,
            { onNone: () => "", onSome: (comment) => `: ${comment}` }
          )}.`,
          operation: "request",
          requestStatusCode: O.some(envelope.requestStatus.code),
          requestStatusComment: envelope.requestStatus.comment,
          requestType: O.some(envelope.requestType),
        })
      );
    });

  const handleResponse = Effect.fn($I`handleResponse`)((envelope: ObsRequestResponseEnvelope) =>
    Ref.modify(pending, (map) => {
      const deferred = HashMap.get(map, envelope.requestId);
      if (O.isNone(deferred)) {
        return [
          Effect.logWarning("Dropping obs-websocket response with no pending request.").pipe(
            Effect.annotateLogs({ requestId: envelope.requestId, requestType: envelope.requestType })
          ),
          map,
        ] as const;
      }
      return [responseToExit(envelope)(deferred.value), HashMap.remove(map, envelope.requestId)] as const;
    }).pipe(Effect.flatten)
  );

  const routeMessage = ObsIncomingMessage.match({
    0: (message) => handleHello(message.d),
    2: (message) => handleIdentified(message.d),
    5: (message) => handleEvent(message.d),
    7: (message) => handleResponse(message.d),
  });

  const onMessage = Effect.fn($I`onMessage`)((text: string) =>
    decodeObsIncomingMessageJson(text).pipe(
      Effect.matchEffect({
        onFailure: (cause) =>
          Effect.logWarning("Ignoring unrecognized obs-websocket frame.").pipe(Effect.annotateLogs({ cause })),
        onSuccess: routeMessage,
      })
    )
  );

  const handleDisconnect = Effect.fn($I`handleDisconnect`)(function* (error: ObsError) {
    yield* failAllPending(error);
    yield* Deferred.fail(helloDeferred, error);
    yield* Deferred.fail(identifiedDeferred, error);
  });

  yield* socket.runString(onMessage).pipe(
    Effect.flatMap(() =>
      handleDisconnect(
        ObsError.make({
          message: "obs-websocket connection ended.",
          operation: "connect",
        })
      )
    ),
    Effect.catch(flow(normalizeSocketFailure, handleDisconnect)),
    Effect.catchCause((cause) =>
      handleDisconnect(
        ObsError.make({
          message: `obs-websocket transport failed unexpectedly: ${Cause.pretty(cause)}`,
          operation: "connect",
        })
      )
    ),
    Effect.forkScoped
  );

  const identified = yield* Deferred.await(identifiedDeferred).pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(config.connectTimeoutMillis),
      orElse: () =>
        Effect.fail(
          ObsError.make({
            message:
              `Timed out after ${config.connectTimeoutMillis}ms waiting for the obs-websocket handshake at ` +
              `${webSocketUrl(config)}. ${OBS_WEBSOCKET_CONFIG_HINT}`,
            operation: "connect",
          })
        ),
    })
  );
  const hello = yield* Deferred.await(helloDeferred);

  const request = Effect.fn($I`request`)(function* (
    requestType: ObsRequestType,
    requestData?: UnknownRecord | undefined
  ): Effect.fn.Return<O.Option<UnknownRecord>, ObsError> {
    const requestId = yield* Ref.modify(nextRequestId, (current) => [`beep-obs-${current}`, current + 1] as const);
    const deferred = yield* Deferred.make<O.Option<UnknownRecord>, ObsError>();
    yield* Ref.update(pending, (map) => HashMap.set(map, requestId, deferred));
    yield* sendMessage(
      ObsRequestMessage.make({
        d: ObsRequestEnvelope.make({
          requestData: O.fromUndefinedOr(requestData),
          requestId,
          requestType,
        }),
      })
    ).pipe(Effect.catch((error) => removePending(requestId).pipe(Effect.andThen(Effect.fail(error)))));
    return yield* Deferred.await(deferred).pipe(Effect.onInterrupt(() => removePending(requestId)));
  });

  return {
    events: Stream.fromPubSub(eventsPubSub),
    hello,
    identified,
    request,
    subscribeEvents: PubSub.subscribe(eventsPubSub),
  } satisfies ObsProtocolShape;
});

const connect = Effect.fn($I`connect`)(function* (
  configInput?: ObsConfigInputOptions | undefined
): Effect.fn.Return<ObsProtocolShape, ObsError, Scope.Scope | Socket.WebSocketConstructor> {
  const config = resolveObsConfig(configInput);
  const socket = yield* Socket.makeWebSocket(webSocketUrl(config), {
    openTimeout: Duration.millis(config.connectTimeoutMillis),
    protocols: OBS_WEBSOCKET_SUBPROTOCOL,
  });
  return yield* connectWith(socket, config);
});

/**
 * Effect service for the low-level obs-websocket v5 protocol session.
 *
 * **Example** (Build protocol layer)
 *
 * ```ts
 * import { ObsProtocol } from "@beep/obs"
 *
 * const layer = ObsProtocol.makeLayer()
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ObsProtocol extends Context.Service<ObsProtocol, ObsProtocolShape>()($I`ObsProtocol`) {
  /**
   * Open an obs-websocket session over a `WebSocketConstructor`-backed socket
   * and complete the handshake. The session lives until the surrounding scope
   * closes.
   *
   * **Example** (Connect and request version)
   *
   * ```ts
   * import { ObsProtocol } from "@beep/obs"
   * import { Effect } from "effect"
   *
   * const program = Effect.scoped(
   *   Effect.flatMap(ObsProtocol.connect(), (protocol) => protocol.request("GetVersion"))
   * )
   * console.log(program)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly connect = connect;

  /**
   * Complete the obs-websocket handshake over an already-built
   * {@link Socket.Socket}. This is the test seam: pair it with `Socket.make`
   * to drive the protocol against an in-memory fake server.
   *
   * **Example** (Connect with fake socket)
   *
   * ```ts
   * import { ObsProtocol, resolveObsConfig } from "@beep/obs"
   *
   * const connectFake = (socket: Parameters<typeof ObsProtocol.connectWith>[0]) =>
   *   ObsProtocol.connectWith(socket, resolveObsConfig())
   * console.log(connectFake)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly connectWith = connectWith;

  /**
   * Build the protocol layer. Handshake (including authentication) happens
   * during layer acquisition; the layer fails with {@link ObsError} when the
   * server is unreachable, closes early, or rejects authentication.
   *
   * **Details**
   *
   * Provide `Socket.layerWebSocketConstructorGlobal` from
   * `effect/unstable/socket` for the Bun runtime (global `WebSocket`).
   *
   * **Example** (Layer with global WebSocket)
   *
   * ```ts
   * import { ObsProtocol } from "@beep/obs"
   * import { Layer } from "effect"
   * import { Socket } from "effect/unstable/socket"
   *
   * const layer = ObsProtocol.makeLayer().pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config?: ObsConfigInputOptions | undefined
  ): Layer.Layer<ObsProtocol, ObsError, Socket.WebSocketConstructor> =>
    Layer.effect(ObsProtocol, Effect.map(connect(config), ObsProtocol.of));
}
