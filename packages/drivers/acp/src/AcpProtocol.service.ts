/**
 * Patched ACP JSON-RPC transport primitives.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Deferred, Effect, HashMap, HashSet, Inspectable, Match, Queue, Ref, Stream, Tuple } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcClientError from "effect/unstable/rpc/RpcClientError";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import type * as Cause from "effect/Cause";
import type * as Scope from "effect/Scope";
import type * as Stdio from "effect/Stdio";
import type * as RpcMessage from "effect/unstable/rpc/RpcMessage";

const $I = $AcpId.create("protocol");
const isAcpError = S.is(AcpError.AcpError);
const isAcpRequestError = S.is(AcpError.AcpRequestError);
const ACP_PROTOCOL_QUEUE_CAPACITY = 1_024;
const ACP_PROTOCOL_DISCONNECT_QUEUE_CAPACITY = 16;
const ACP_STDIO_CLIENT_ID = 0;
type MinimalReadonlySet<T> = Iterable<T> & {
  readonly entries: () => IterableIterator<[T, T]>;
  readonly forEach: (callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void, thisArg?: unknown) => void;
  readonly has: (value: T) => boolean;
  readonly keys: () => IterableIterator<T>;
  readonly size: number;
  readonly values: () => IterableIterator<T>;
};

const singleValueSetIterator = <A>(value: A): IterableIterator<A> => {
  let isDone = false;
  const iterator: IterableIterator<A> = {
    [Symbol.iterator]: () => iterator,
    next: () => {
      if (isDone) {
        return {
          done: true,
          value: undefined,
        };
      }
      isDone = true;
      return {
        done: false,
        value,
      };
    },
  };
  return iterator;
};
const ACP_STDIO_CLIENT_IDS = {
  [Symbol.iterator]: () => singleValueSetIterator(ACP_STDIO_CLIENT_ID),
  entries: () => singleValueSetIterator<[number, number]>([ACP_STDIO_CLIENT_ID, ACP_STDIO_CLIENT_ID]),
  forEach: (callbackfn, thisArg?: unknown) => {
    callbackfn.call(thisArg, ACP_STDIO_CLIENT_ID, ACP_STDIO_CLIENT_ID, ACP_STDIO_CLIENT_IDS);
  },
  has: (value) => value === ACP_STDIO_CLIENT_ID,
  keys: () => singleValueSetIterator(ACP_STDIO_CLIENT_ID),
  size: 1,
  values: () => singleValueSetIterator(ACP_STDIO_CLIENT_ID),
} satisfies MinimalReadonlySet<number> as unknown as ReadonlySet<number>;

const AcpProtocolLogDirection = LiteralKit(["incoming", "outgoing"]);
type AcpProtocolLogDirection = typeof AcpProtocolLogDirection.Type;
const AcpProtocolLogStage = LiteralKit(["raw", "decoded", "decode_failed"]);
type AcpProtocolLogStage = typeof AcpProtocolLogStage.Type;
type AcpProtocolLogEventMember<T extends AcpProtocolLogDirection> = {
  readonly direction: T;
  readonly payload: unknown;
  readonly stage: AcpProtocolLogStage;
};

/**
 * Structured log event emitted by the ACP protocol adapter.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AcpProtocolLogEvent } from "@beep/acp/protocol"
 *
 * const event = S.decodeUnknownSync(AcpProtocolLogEvent)({
 *   direction: "incoming",
 *   stage: "raw",
 *   payload: "{}"
 * })
 * console.log(event.direction)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const AcpProtocolLogEvent = AcpProtocolLogDirection.mapMembers(
  Tuple.evolve([
    (literal: S.Literal<"incoming">) =>
      S.Class<AcpProtocolLogEventMember<"incoming">>($I`AcpProtocolLogIncomingEvent`)(
        {
          direction: S.tag(literal.literal),
          payload: S.Unknown,
          stage: AcpProtocolLogStage,
        },
        $I.annote("AcpProtocolLogIncomingEvent", {
          description: "Structured incoming log event emitted by the ACP protocol adapter.",
        })
      ),
    (literal: S.Literal<"outgoing">) =>
      S.Class<AcpProtocolLogEventMember<"outgoing">>($I`AcpProtocolLogOutgoingEvent`)(
        {
          direction: S.tag(literal.literal),
          payload: S.Unknown,
          stage: AcpProtocolLogStage,
        },
        $I.annote("AcpProtocolLogOutgoingEvent", {
          description: "Structured outgoing log event emitted by the ACP protocol adapter.",
        })
      ),
  ])
).pipe(
  $I.annoteSchema("AcpProtocolLogEvent", {
    description: "Structured log event emitted by the ACP protocol adapter.",
  }),
  S.toTaggedUnion("direction")
);

/**
 * Structured log event emitted by the ACP protocol adapter.
 *
 * @example
 * ```ts
 * import type { AcpProtocolLogEvent } from "@beep/acp/protocol"
 *
 * const event: AcpProtocolLogEvent = {
 *   direction: "incoming",
 *   stage: "raw",
 *   payload: "{}"
 * }
 * console.log(event.stage)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpProtocolLogEvent = typeof AcpProtocolLogEvent.Type;

/**
 * Schema-backed ACP protocol logging flags.
 *
 * @example
 * ```ts
 * import { AcpProtocolLoggingOptions } from "@beep/acp/protocol"
 *
 * const options = AcpProtocolLoggingOptions.make({ logIncoming: true })
 * console.log(options.logIncoming)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpProtocolLoggingOptions extends S.Class<AcpProtocolLoggingOptions>($I`AcpProtocolLoggingOptions`)(
  {
    logIncoming: S.optionalKey(S.Boolean),
    logOutgoing: S.optionalKey(S.Boolean),
  },
  $I.annote("AcpProtocolLoggingOptions", {
    description: "Schema-backed ACP protocol logging flags.",
  })
) {}

/**
 * Schema for notifications decoded from the ACP peer stream.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AcpIncomingNotification } from "@beep/acp/protocol"
 *
 * const notification = S.decodeUnknownSync(AcpIncomingNotification)({
 *   _tag: "ExtNotification",
 *   method: "x/custom",
 *   params: { ok: true }
 * })
 * console.log(notification.method)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AcpIncomingNotification = S.TaggedUnion({
  SessionUpdate: {
    method: S.Literal(CLIENT_METHODS.session_update),
    params: AcpSchema.SessionNotification,
  },
  ElicitationComplete: {
    method: S.Literal(CLIENT_METHODS.session_elicitation_complete),
    params: AcpSchema.ElicitationCompleteNotification,
  },
  ExtNotification: {
    method: S.String,
    params: S.Unknown,
  },
}).pipe(
  $I.annoteSchema("AcpIncomingNotification", {
    description: "Schema for notifications decoded from the ACP peer stream.",
  })
);

/**
 * Type for {@link AcpIncomingNotification}.
 *
 * @example
 * ```ts
 * import type { AcpIncomingNotification } from "@beep/acp/protocol"
 *
 * const tagOf = (notification: AcpIncomingNotification) => notification._tag
 * console.log(tagOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpIncomingNotification = typeof AcpIncomingNotification.Type;

/**
 * Options used to create the patched ACP protocol.
 *
 * @example
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import type { AcpPatchedProtocolOptions } from "@beep/acp/protocol"
 *
 * const methods = HashSet.empty<string>()
 * const hasServerMethods = (options: Omit<AcpPatchedProtocolOptions, "stdio">) =>
 *   HashSet.size(options.serverRequestMethods) >= HashSet.size(methods)
 * console.log(hasServerMethods)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export interface AcpPatchedProtocolOptions extends AcpProtocolLoggingOptions {
  readonly logger?: (event: AcpProtocolLogEvent) => Effect.Effect<void>;
  readonly onExtRequest?: (method: string, params: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
  readonly onNotification?: (notification: AcpIncomingNotification) => Effect.Effect<void, AcpError.AcpError>;
  readonly onTermination?: (error: AcpError.AcpError) => Effect.Effect<void>;
  readonly serverRequestMethods: HashSet.HashSet<string>;
  readonly stdio: Stdio.Stdio;
  readonly terminationError?: Effect.Effect<AcpError.AcpError>;
}

/**
 * Runtime protocol handles used by ACP clients and agents.
 *
 * @example
 * ```ts
 * import type { AcpPatchedProtocol } from "@beep/acp/protocol"
 *
 * const notificationsOf = (protocol: AcpPatchedProtocol) => protocol.incoming
 * console.log(notificationsOf)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export interface AcpPatchedProtocol {
  readonly clientProtocol: RpcClient.Protocol["Service"];
  readonly incoming: Stream.Stream<AcpIncomingNotification>;
  readonly notify: {
    (method: string, payload: unknown): Effect.Effect<void, AcpError.AcpError>;
    (method: string): (payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  };
  readonly request: {
    (method: string, payload: unknown): Effect.Effect<unknown, AcpError.AcpError>;
    (method: string): (payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
  };
  readonly serverProtocol: RpcServer.Protocol["Service"];
}

const decodeSessionUpdate = S.decodeUnknownEffect(AcpSchema.SessionNotification);
const decodeElicitationComplete = S.decodeUnknownEffect(AcpSchema.ElicitationCompleteNotification);
const parserFactory = RpcSerialization.ndJsonRpc();
const textDecoder = new TextDecoder();

const textFromWire = (value: string | Uint8Array): string => (P.isString(value) ? value : textDecoder.decode(value));

/**
 * Builds the patched ACP protocol over an Effect `Stdio` transport.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Stdio } from "effect"
 * import * as HashSet from "effect/HashSet"
 * import { makeAcpPatchedProtocol } from "@beep/acp/protocol"
 *
 * const program = Effect.flatMap(Effect.service(Stdio.Stdio), (stdio) =>
 *   makeAcpPatchedProtocol({
 *     stdio,
 *     serverRequestMethods: HashSet.empty()
 *   }).pipe(Effect.map((protocol) => typeof protocol.request))
 * )
 * console.log(program)
 * ```
 *
 * @effects Allocates scoped protocol queues, forks transport fibers, and reads
 * from or writes to the supplied `Stdio` streams when the returned Effect runs.
 * @category constructors
 * @since 0.0.0
 */
export const makeAcpPatchedProtocol = Effect.fn($I`makeAcpPatchedProtocol`)(function* (
  options: AcpPatchedProtocolOptions
): Effect.fn.Return<AcpPatchedProtocol, never, Scope.Scope> {
  const parser = parserFactory.makeUnsafe();
  const serverQueue = yield* Queue.bounded<RpcMessage.FromClientEncoded>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const clientQueue = yield* Queue.bounded<RpcMessage.FromServerEncoded>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const notificationQueue = yield* Queue.bounded<AcpIncomingNotification>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const disconnects = yield* Queue.bounded<number>(ACP_PROTOCOL_DISCONNECT_QUEUE_CAPACITY);
  const outgoing = yield* Queue.bounded<string | Uint8Array, Cause.Done>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const nextRequestId = yield* Ref.make(BigInt(1));
  const terminationHandled = yield* Ref.make(false);
  const extPending = yield* Ref.make(HashMap.empty<string, Deferred.Deferred<unknown, AcpError.AcpError>>());

  const logProtocol = Effect.fn($I`logProtocol`)((event: AcpProtocolLogEvent) => {
    if (event.direction === "incoming" && options.logIncoming !== true) {
      return Effect.void;
    }
    if (event.direction === "outgoing" && options.logOutgoing !== true) {
      return Effect.void;
    }
    return options.logger?.(event) ?? Effect.logDebug("ACP protocol event").pipe(Effect.annotateLogs({ event }));
  });

  const offerOutgoing = Effect.fn($I`offerOutgoing`)(function* (
    message: RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded
  ) {
    yield* logProtocol({
      direction: "outgoing",
      payload: message,
      stage: "decoded",
    });

    const encoded = yield* Effect.try({
      try: () => parser.encode(message),
      catch: (cause) =>
        AcpError.AcpProtocolParseError.make({
          cause,
          detail: "Failed to encode ACP message",
        }),
    });

    if (encoded !== undefined && (!P.isString(encoded) || encoded.length > 0)) {
      yield* logProtocol({
        direction: "outgoing",
        payload: textFromWire(encoded),
        stage: "raw",
      });

      yield* Queue.offer(outgoing, encoded).pipe(Effect.asVoid);
    }
  });

  const resolveExtPending = Effect.fn($I`resolveExtPending`)(
    (requestId: string, onFound: (deferred: Deferred.Deferred<unknown, AcpError.AcpError>) => Effect.Effect<void>) =>
      Ref.modify(extPending, (pending) => {
        const deferred = HashMap.get(pending, requestId);
        if (O.isNone(deferred)) {
          return [Effect.void, pending] as const;
        }
        return [onFound(deferred.value), HashMap.remove(pending, requestId)] as const;
      }).pipe(Effect.flatten)
  );

  const removeExtPending = Effect.fn($I`removeExtPending`)((requestId: string) =>
    Ref.update(extPending, (pending) => HashMap.remove(pending, requestId))
  );

  const completeExtPendingFailure = Effect.fn($I`completeExtPendingFailure`)(
    (requestId: string, error: AcpError.AcpError) =>
      resolveExtPending(requestId, (deferred) => Deferred.fail(deferred, error))
  );

  const completeExtPendingSuccess = Effect.fn($I`completeExtPendingSuccess`)((requestId: string, value: unknown) =>
    resolveExtPending(requestId, (deferred) => Deferred.succeed(deferred, value))
  );

  const failAllExtPending = Effect.fn($I`failAllExtPending`)((error: AcpError.AcpError) =>
    Ref.getAndSet(extPending, HashMap.empty()).pipe(
      Effect.flatMap((pending) =>
        Effect.forEach(HashMap.values(pending), (deferred) => Deferred.fail(deferred, error), {
          discard: true,
        })
      )
    )
  );

  const dispatchNotification = Effect.fn($I`dispatchNotification`)((notification: AcpIncomingNotification) =>
    Queue.offer(notificationQueue, notification).pipe(
      Effect.andThen(
        options.onNotification !== undefined ? options.onNotification(notification).pipe(Effect.ignore) : Effect.void
      ),
      Effect.asVoid
    )
  );

  const emitClientProtocolError = Effect.fn($I`emitClientProtocolError`)((error: AcpError.AcpError) =>
    Queue.offer(clientQueue, {
      _tag: "ClientProtocolError",
      error: RpcClientError.RpcClientError.make({
        reason: RpcClientError.RpcClientDefect.make({
          cause: error,
          message: error.message,
        }),
      }),
    }).pipe(Effect.asVoid)
  );

  const handleTermination = Effect.fn($I`handleTermination`)(
    (classification: Effect.Effect<AcpError.AcpError | undefined>) =>
      Ref.modify(terminationHandled, (handled) => {
        if (handled) {
          return [Effect.void, true] as const;
        }
        return [
          Effect.gen(function* () {
            yield* Queue.offer(disconnects, 0);
            const error = yield* classification;
            if (error === undefined) {
              return;
            }
            yield* failAllExtPending(error);
            yield* emitClientProtocolError(error);
            if (options.onTermination !== undefined) {
              yield* options.onTermination(error);
            }
          }),
          true,
        ] as const;
      }).pipe(Effect.flatten)
  );

  const respondWithSuccess = Effect.fn($I`respondWithSuccess`)((requestId: string, value: unknown) =>
    offerOutgoing({
      _tag: "Exit",
      exit: {
        _tag: "Success",
        value,
      },
      requestId,
    })
  );

  const respondWithError = Effect.fn($I`respondWithError`)((requestId: string, error: AcpError.AcpRequestError) =>
    offerOutgoing({
      _tag: "Exit",
      exit: {
        _tag: "Failure",
        cause: [
          {
            _tag: "Fail",
            error: error.toProtocolError(),
          },
        ],
      },
      requestId,
    })
  );

  const handleExtRequest = Effect.fn($I`handleExtRequest`)((message: RpcMessage.RequestEncoded) => {
    if (options.onExtRequest === undefined) {
      return respondWithError(message.id, AcpError.AcpRequestError.methodNotFound(message.tag));
    }
    return options.onExtRequest(message.tag, message.payload).pipe(
      Effect.matchEffect({
        onFailure: (error) => respondWithError(message.id, normalizeToRequestError(error)),
        onSuccess: (value) => respondWithSuccess(message.id, value),
      })
    );
  });

  const handleRequestEncoded = Effect.fn($I`handleRequestEncoded`)((message: RpcMessage.RequestEncoded) => {
    if (message.id === "") {
      if (message.tag === CLIENT_METHODS.session_update) {
        return decodeSessionUpdate(message.payload).pipe(
          Effect.map(
            (params) =>
              ({
                _tag: "SessionUpdate",
                method: CLIENT_METHODS.session_update,
                params,
              }) satisfies AcpIncomingNotification
          ),
          Effect.mapError((cause) =>
            AcpError.AcpProtocolParseError.make({
              cause,
              detail: `Invalid ${CLIENT_METHODS.session_update} notification payload`,
            })
          ),
          Effect.flatMap(dispatchNotification)
        );
      }
      if (message.tag === CLIENT_METHODS.session_elicitation_complete) {
        return decodeElicitationComplete(message.payload).pipe(
          Effect.map(
            (params) =>
              ({
                _tag: "ElicitationComplete",
                method: CLIENT_METHODS.session_elicitation_complete,
                params,
              }) satisfies AcpIncomingNotification
          ),
          Effect.mapError((cause) =>
            AcpError.AcpProtocolParseError.make({
              cause,
              detail: `Invalid ${CLIENT_METHODS.session_elicitation_complete} notification payload`,
            })
          ),
          Effect.flatMap(dispatchNotification)
        );
      }
      return dispatchNotification({
        _tag: "ExtNotification",
        method: message.tag,
        params: message.payload,
      });
    }

    if (!HashSet.has(options.serverRequestMethods, message.tag)) {
      return handleExtRequest(message).pipe(
        Effect.catch(() => respondWithError(message.id, AcpError.AcpRequestError.internalError())),
        Effect.asVoid
      );
    }

    return Queue.offer(serverQueue, message).pipe(Effect.asVoid);
  });

  const handleExitEncoded = Effect.fn($I`handleExitEncoded`)((message: RpcMessage.ResponseExitEncoded) =>
    Ref.get(extPending).pipe(
      Effect.flatMap((pending) => {
        if (!HashMap.has(pending, message.requestId)) {
          return Queue.offer(clientQueue, message).pipe(Effect.asVoid);
        }
        if (message.exit._tag === "Success") {
          return completeExtPendingSuccess(message.requestId, message.exit.value);
        }
        const failure = A.findFirst(message.exit.cause, (entry) => entry._tag === "Fail");
        if (O.isSome(failure) && isProtocolError(failure.value.error)) {
          return completeExtPendingFailure(
            message.requestId,
            AcpError.AcpRequestError.fromProtocolError(failure.value.error)
          );
        }
        return completeExtPendingFailure(
          message.requestId,
          AcpError.AcpRequestError.internalError("Extension request failed")
        );
      })
    )
  );
  const offerClientMessage = Effect.fn($I`offerClientMessage`)((message: RpcMessage.FromServerEncoded) =>
    Queue.offer(clientQueue, message).pipe(Effect.asVoid)
  );

  const offerServerMessage = Effect.fn($I`offerServerMessage`)((message: RpcMessage.FromClientEncoded) =>
    Queue.offer(serverQueue, message).pipe(Effect.asVoid)
  );

  const routeDecodedMessage = Effect.fn($I`routeDecodedMessage`)(
    Match.type<RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded>().pipe(
      Match.tagsExhaustive({
        Request: handleRequestEncoded,
        Exit: handleExitEncoded,
        Chunk: (message) =>
          Ref.get(extPending).pipe(
            Effect.flatMap((pending) =>
              HashMap.has(pending, message.requestId)
                ? completeExtPendingFailure(
                    message.requestId,
                    AcpError.AcpRequestError.internalError("Streaming extension responses are not supported")
                  )
                : offerClientMessage(message)
            )
          ),
        Defect: offerClientMessage,
        ClientProtocolError: offerClientMessage,
        Pong: offerClientMessage,
        Ack: offerServerMessage,
        Interrupt: offerServerMessage,
        Ping: offerServerMessage,
        Eof: offerServerMessage,
      })
    )
  );

  yield* options.stdio.stdin.pipe(
    Stream.runForEach((data) =>
      logProtocol({
        direction: "incoming",
        payload: textFromWire(data),
        stage: "raw",
      }).pipe(
        Effect.flatMap(() =>
          Effect.try({
            try: () =>
              parser.decode(data) as ReadonlyArray<RpcMessage.FromClientEncoded | RpcMessage.FromServerEncoded>,
            catch: (cause) =>
              AcpError.AcpProtocolParseError.make({
                cause,
                detail: "Failed to decode ACP wire message",
              }),
          })
        ),
        Effect.tap((messages) =>
          logProtocol({
            direction: "incoming",
            payload: messages,
            stage: "decoded",
          })
        ),
        Effect.tapErrorTag("AcpProtocolParseError", (error) =>
          logProtocol({
            direction: "incoming",
            payload: {
              cause: error.cause,
              detail: error.detail,
            },
            stage: "decode_failed",
          })
        ),
        Effect.flatMap((messages) =>
          Effect.forEach(messages, routeDecodedMessage, {
            discard: true,
          })
        )
      )
    ),
    Effect.matchEffect({
      onFailure: (error) => {
        const normalized: AcpError.AcpError = isAcpError(error)
          ? error
          : AcpError.AcpTransportError.make({
              cause: error,
              detail: Inspectable.toStringUnknown(error, 0),
            });
        return handleTermination(Effect.succeed(normalized));
      },
      onSuccess: () =>
        handleTermination(
          options.terminationError ??
            Effect.succeed(
              AcpError.AcpTransportError.make({
                cause: "ACP input stream ended",
                detail: "ACP input stream ended",
              })
            )
        ),
    }),
    Effect.forkScoped
  );

  yield* Stream.fromQueue(outgoing).pipe(Stream.run(options.stdio.stdout()), Effect.forkScoped);

  const clientProtocol = RpcClient.Protocol.of({
    run: Effect.fn($I`AcpClient_Protocol_run`)((_clientId, f) =>
      Stream.fromQueue(clientQueue).pipe(
        Stream.runForEach((message) => f(message)),
        Effect.forever
      )
    ),
    send: Effect.fn($I`AcpClient_Protocol_send`)((_clientId, request) =>
      offerOutgoing(request).pipe(Effect.mapError(toRpcClientError))
    ),
    supportsAck: true,
    supportsTransferables: false,
  });

  const serverProtocol = RpcServer.Protocol.of({
    clientIds: Effect.succeed(ACP_STDIO_CLIENT_IDS),
    disconnects,
    end: Effect.fn($I`AcpServer_Protocol_end`)((_clientId) => Queue.end(outgoing)),
    initialMessage: Effect.succeedNone,
    run: Effect.fn($I`AcpServer_Protocol_run`)((f) =>
      Stream.fromQueue(serverQueue).pipe(
        Stream.runForEach((message) => f(0, message)),
        Effect.forever
      )
    ),
    send: Effect.fn($I`AcpServer_Protocol_send`)((_clientId, response) => offerOutgoing(response).pipe(Effect.orDie)),
    supportsAck: true,
    supportsSpanPropagation: true,
    supportsTransferables: false,
  });

  const sendNotificationEffect = Effect.fn($I`sendNotification`)(function* (method: string, payload: unknown) {
    yield* offerOutgoing({
      _tag: "Request",
      headers: [],
      id: "",
      payload,
      tag: method,
    });
  });

  function sendNotification(method: string, payload: unknown): Effect.Effect<void, AcpError.AcpError>;
  function sendNotification(method: string): (payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  function sendNotification(
    method: string,
    payload?: unknown
  ): Effect.Effect<void, AcpError.AcpError> | ((payload: unknown) => Effect.Effect<void, AcpError.AcpError>) {
    if (arguments.length === 1) {
      return (curriedPayload: unknown) => sendNotificationEffect(method, curriedPayload);
    }
    return sendNotificationEffect(method, payload);
  }

  const sendRequestEffect = Effect.fn($I`sendRequest`)(function* (method: string, payload: unknown) {
    const requestId = yield* Ref.modify(nextRequestId, (current) => [current, current + BigInt(1)] as const);
    const requestIdString = String(requestId);
    const deferred = yield* Deferred.make<unknown, AcpError.AcpError>();
    yield* Ref.update(extPending, (pending) => HashMap.set(pending, requestIdString, deferred));
    yield* offerOutgoing({
      _tag: "Request",
      headers: [],
      id: requestIdString,
      payload,
      tag: method,
    }).pipe(Effect.catch((error) => removeExtPending(requestIdString).pipe(Effect.andThen(Effect.fail(error)))));
    return yield* Deferred.await(deferred).pipe(Effect.onInterrupt(() => removeExtPending(requestIdString)));
  });

  function sendRequest(method: string, payload: unknown): Effect.Effect<unknown, AcpError.AcpError>;
  function sendRequest(method: string): (payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
  function sendRequest(
    method: string,
    payload?: unknown
  ): Effect.Effect<unknown, AcpError.AcpError> | ((payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>) {
    if (arguments.length === 1) {
      return (curriedPayload: unknown) => sendRequestEffect(method, curriedPayload);
    }
    return sendRequestEffect(method, payload);
  }

  return {
    clientProtocol,
    get incoming() {
      return Stream.fromQueue(notificationQueue);
    },
    notify: sendNotification,
    request: sendRequest,
    serverProtocol,
  } satisfies AcpPatchedProtocol;
});

function isProtocolError(value: unknown): value is { code: number; message: string; data?: unknown } {
  return (
    P.isObject(value) && "code" in value && P.isNumber(value.code) && "message" in value && P.isString(value.message)
  );
}

function normalizeToRequestError(error: AcpError.AcpError): AcpError.AcpRequestError {
  return isAcpRequestError(error) ? error : AcpError.AcpRequestError.internalError(error.message);
}

function toRpcClientError(error: AcpError.AcpError): RpcClientError.RpcClientError {
  return RpcClientError.RpcClientError.make({
    reason: RpcClientError.RpcClientDefect.make({
      cause: error,
      message: error.message,
    }),
  });
}
