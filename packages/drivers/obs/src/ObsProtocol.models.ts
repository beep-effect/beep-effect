/**
 * Schema-first obs-websocket v5 protocol models.
 *
 * Wire reference: obs-websocket `docs/generated/protocol.md` (protocol v5,
 * RPC version 1). Every message rides the base envelope
 * `{ "op": number, "d": object }`; this module models the envelope subset the
 * driver speaks (Hello, Identify, Identified, Event, Request,
 * RequestResponse) plus the request/response payload subset used for QA
 * recording control.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ObsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, UnknownRecord } from "@beep/schema";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $ObsId.create("ObsProtocol.models");

/**
 * The obs-websocket RPC version this driver negotiates.
 *
 * **Example** (Log negotiated RPC version)
 *
 * ```ts
 * import { OBS_RPC_VERSION } from "@beep/obs"
 *
 * console.log(OBS_RPC_VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OBS_RPC_VERSION = 1;

const ObsRequestTypeBase = LiteralKit([
  "GetVersion",
  "GetRecordStatus",
  "StartRecord",
  "StopRecord",
  "SetRecordDirectory",
  "GetRecordDirectory",
  "CreateScene",
  "GetSceneList",
  "SetCurrentProgramScene",
  "CreateInput",
  "GetInputSettings",
  "SetInputSettings",
  "GetSceneItemList",
  "CreateSceneItem",
]);

/**
 * The obs-websocket request-type subset this driver may send.
 *
 * **Example** (Check StartRecord request type)
 *
 * ```ts
 * import { ObsRequestType } from "@beep/obs"
 *
 * console.log(ObsRequestType.is.StartRecord("StartRecord"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObsRequestType = ObsRequestTypeBase.pipe(
  $I.annoteSchema("ObsRequestType", {
    description: "obs-websocket request-type subset used by the QA recording driver.",
  }),
  SchemaUtils.withLiteralKitStatics(ObsRequestTypeBase)
);

/**
 * The obs-websocket request-type subset this driver may send.
 *
 * **Example** (Assign GetVersion request type)
 *
 * ```ts
 * import type { ObsRequestType } from "@beep/obs"
 *
 * const requestType: ObsRequestType = "GetVersion"
 * console.log(requestType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsRequestType = typeof ObsRequestType.Type;

const ObsOutputStateBase = LiteralKit([
  "OBS_WEBSOCKET_OUTPUT_UNKNOWN",
  "OBS_WEBSOCKET_OUTPUT_STARTING",
  "OBS_WEBSOCKET_OUTPUT_STARTED",
  "OBS_WEBSOCKET_OUTPUT_STOPPING",
  "OBS_WEBSOCKET_OUTPUT_STOPPED",
  "OBS_WEBSOCKET_OUTPUT_RECONNECTING",
  "OBS_WEBSOCKET_OUTPUT_RECONNECTED",
  "OBS_WEBSOCKET_OUTPUT_PAUSED",
  "OBS_WEBSOCKET_OUTPUT_RESUMED",
]);

/**
 * obs-websocket `ObsOutputState` enum values.
 *
 * **Example** (Check output started state)
 *
 * ```ts
 * import { ObsOutputState } from "@beep/obs"
 *
 * console.log(ObsOutputState.is.OBS_WEBSOCKET_OUTPUT_STARTED("OBS_WEBSOCKET_OUTPUT_STARTED"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObsOutputState = ObsOutputStateBase.pipe(
  $I.annoteSchema("ObsOutputState", {
    description: "obs-websocket output state reported by output lifecycle events.",
  }),
  SchemaUtils.withLiteralKitStatics(ObsOutputStateBase)
);

/**
 * obs-websocket `ObsOutputState` enum values.
 *
 * **Example** (Assign output started state)
 *
 * ```ts
 * import type { ObsOutputState } from "@beep/obs"
 *
 * const state: ObsOutputState = "OBS_WEBSOCKET_OUTPUT_STARTED"
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsOutputState = typeof ObsOutputState.Type;

/**
 * Authentication challenge carried by the `Hello` message when the
 * obs-websocket server requires a password.
 *
 * **Example** (Make auth challenge payload)
 *
 * ```ts
 * import { ObsAuthChallenge } from "@beep/obs"
 *
 * const challenge = ObsAuthChallenge.make({ challenge: "abc", salt: "def" })
 * console.log(challenge)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsAuthChallenge extends S.Class<ObsAuthChallenge>($I`ObsAuthChallenge`)(
  {
    challenge: S.String.pipe(
      $I.annoteKey("ObsAuthChallenge.challenge", {
        description: "Base64 challenge string issued by the obs-websocket server.",
      })
    ),
    salt: S.String.pipe(
      $I.annoteKey("ObsAuthChallenge.salt", {
        description: "Base64 salt string issued by the obs-websocket server.",
      })
    ),
  },
  $I.annote("ObsAuthChallenge", {
    description: "Authentication challenge carried by the obs-websocket Hello message.",
  })
) {}

/**
 * `Hello` (OpCode 0) payload sent by obs-websocket on connection.
 *
 * **Example** (Make Hello connection payload)
 *
 * ```ts
 * import { ObsHello } from "@beep/obs"
 *
 * const hello = ObsHello.make({ obsWebSocketVersion: "5.5.2", rpcVersion: 1 })
 * console.log(hello.rpcVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsHello extends S.Class<ObsHello>($I`ObsHello`)(
  {
    authentication: S.OptionFromOptionalKey(ObsAuthChallenge).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsHello.authentication", {
        description: "Authentication challenge, present when the server requires a password.",
      })
    ),
    obsStudioVersion: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsHello.obsStudioVersion", {
        description: "OBS Studio version reported by the server, when available.",
      })
    ),
    obsWebSocketVersion: S.String.pipe(
      $I.annoteKey("ObsHello.obsWebSocketVersion", {
        description: "obs-websocket plugin version reported by the server.",
      })
    ),
    rpcVersion: S.Int.pipe(
      $I.annoteKey("ObsHello.rpcVersion", {
        description: "RPC version the server would like to use.",
      })
    ),
  },
  $I.annote("ObsHello", {
    description: "obs-websocket Hello payload sent immediately on client connection.",
  })
) {}

/**
 * `Identify` (OpCode 1) payload sent by the client in response to `Hello`.
 *
 * **Example** (Make Identify client payload)
 *
 * ```ts
 * import { ObsIdentify } from "@beep/obs"
 *
 * const identify = ObsIdentify.make({ rpcVersion: 1, eventSubscriptions: 79 })
 * console.log(identify.eventSubscriptions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsIdentify extends S.Class<ObsIdentify>($I`ObsIdentify`)(
  {
    authentication: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsIdentify.authentication", {
        description: "Authentication string derived from the Hello challenge, when the server requires it.",
      })
    ),
    eventSubscriptions: S.Int.pipe(
      $I.annoteKey("ObsIdentify.eventSubscriptions", {
        description: "EventSubscription bitmask selecting the event categories to receive.",
      })
    ),
    rpcVersion: S.Int.pipe(
      $I.annoteKey("ObsIdentify.rpcVersion", {
        description: "RPC version the client would like the server to use.",
      })
    ),
  },
  $I.annote("ObsIdentify", {
    description: "obs-websocket Identify payload answering the Hello message.",
  })
) {}

/**
 * `Identified` (OpCode 2) payload confirming the session is ready.
 *
 * **Example** (Make Identified session payload)
 *
 * ```ts
 * import { ObsIdentified } from "@beep/obs"
 *
 * const identified = ObsIdentified.make({ negotiatedRpcVersion: 1 })
 * console.log(identified.negotiatedRpcVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsIdentified extends S.Class<ObsIdentified>($I`ObsIdentified`)(
  {
    negotiatedRpcVersion: S.Int.pipe(
      $I.annoteKey("ObsIdentified.negotiatedRpcVersion", {
        description: "RPC version the server settled on for this session.",
      })
    ),
  },
  $I.annote("ObsIdentified", {
    description: "obs-websocket Identified payload confirming a ready session.",
  })
) {}

/**
 * `Event` (OpCode 5) payload describing an OBS event.
 *
 * **Example** (Make Event envelope payload)
 *
 * ```ts
 * import { ObsEventEnvelope } from "@beep/obs"
 *
 * const envelope = ObsEventEnvelope.make({ eventType: "StudioModeStateChanged", eventIntent: 1 })
 * console.log(envelope.eventType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsEventEnvelope extends S.Class<ObsEventEnvelope>($I`ObsEventEnvelope`)(
  {
    eventData: S.OptionFromOptionalKey(UnknownRecord).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsEventEnvelope.eventData", {
        description: "Event payload object, when the event carries data.",
      })
    ),
    eventIntent: S.Int.pipe(
      $I.annoteKey("ObsEventEnvelope.eventIntent", {
        description: "EventSubscription intent bit required to receive this event.",
      })
    ),
    eventType: S.String.pipe(
      $I.annoteKey("ObsEventEnvelope.eventType", {
        description: "obs-websocket event type name.",
      })
    ),
  },
  $I.annote("ObsEventEnvelope", {
    description: "obs-websocket Event payload describing an OBS event.",
  })
) {}

/**
 * `Request` (OpCode 6) payload sent by the client.
 *
 * **Example** (Make Request envelope payload)
 *
 * ```ts
 * import { ObsRequestEnvelope } from "@beep/obs"
 *
 * const envelope = ObsRequestEnvelope.make({ requestType: "GetVersion", requestId: "beep-obs-1" })
 * console.log(envelope.requestId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRequestEnvelope extends S.Class<ObsRequestEnvelope>($I`ObsRequestEnvelope`)(
  {
    requestData: S.OptionFromOptionalKey(UnknownRecord).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsRequestEnvelope.requestData", {
        description: "Request payload object, when the request type takes data.",
      })
    ),
    requestId: S.String.pipe(
      $I.annoteKey("ObsRequestEnvelope.requestId", {
        description: "Client-chosen request correlation id, mirrored back in the response.",
      })
    ),
    requestType: ObsRequestType.pipe(
      $I.annoteKey("ObsRequestEnvelope.requestType", {
        description: "obs-websocket request type to invoke.",
      })
    ),
  },
  $I.annote("ObsRequestEnvelope", {
    description: "obs-websocket Request payload sent by the client.",
  })
) {}

/**
 * `RequestStatus` object carried by every `RequestResponse`.
 *
 * **Example** (Make request status object)
 *
 * ```ts
 * import { ObsRequestStatus } from "@beep/obs"
 *
 * const status = ObsRequestStatus.make({ result: true, code: 100 })
 * console.log(status.result)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRequestStatus extends S.Class<ObsRequestStatus>($I`ObsRequestStatus`)(
  {
    code: S.Int.pipe(
      $I.annoteKey("ObsRequestStatus.code", {
        description: "obs-websocket RequestStatus code (100 on success).",
      })
    ),
    comment: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsRequestStatus.comment", {
        description: "Server-provided failure detail, when available.",
      })
    ),
    result: S.Boolean.pipe(
      $I.annoteKey("ObsRequestStatus.result", {
        description: "Whether the request resulted in RequestStatus::Success.",
      })
    ),
  },
  $I.annote("ObsRequestStatus", {
    description: "obs-websocket RequestStatus object carried by every RequestResponse.",
  })
) {}

/**
 * `RequestResponse` (OpCode 7) payload answering a client request.
 *
 * **Example** (Make RequestResponse envelope)
 *
 * ```ts
 * import { ObsRequestResponseEnvelope, ObsRequestStatus } from "@beep/obs"
 *
 * const envelope = ObsRequestResponseEnvelope.make({
 *   requestType: "GetVersion",
 *   requestId: "beep-obs-1",
 *   requestStatus: ObsRequestStatus.make({ result: true, code: 100 })
 * })
 * console.log(envelope.requestStatus.code)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRequestResponseEnvelope extends S.Class<ObsRequestResponseEnvelope>($I`ObsRequestResponseEnvelope`)(
  {
    requestId: S.String.pipe(
      $I.annoteKey("ObsRequestResponseEnvelope.requestId", {
        description: "Request correlation id mirrored from the originating request.",
      })
    ),
    requestStatus: ObsRequestStatus.pipe(
      $I.annoteKey("ObsRequestResponseEnvelope.requestStatus", {
        description: "Success flag, status code, and optional failure comment.",
      })
    ),
    requestType: S.String.pipe(
      $I.annoteKey("ObsRequestResponseEnvelope.requestType", {
        description: "Request type mirrored from the originating request.",
      })
    ),
    responseData: S.OptionFromOptionalKey(UnknownRecord).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsRequestResponseEnvelope.responseData", {
        description: "Response payload object, when the request type returns data.",
      })
    ),
  },
  $I.annote("ObsRequestResponseEnvelope", {
    description: "obs-websocket RequestResponse payload answering a client request.",
  })
) {}

/**
 * `Hello` base-envelope message (`op: 0`).
 *
 * **Example** (Make Hello op message)
 *
 * ```ts
 * import { ObsHello, ObsHelloMessage } from "@beep/obs"
 *
 * const message = ObsHelloMessage.make({ d: ObsHello.make({ obsWebSocketVersion: "5.5.2", rpcVersion: 1 }) })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsHelloMessage extends S.Class<ObsHelloMessage>($I`ObsHelloMessage`)(
  {
    d: ObsHello.pipe(
      $I.annoteKey("ObsHelloMessage.d", {
        description: "Hello payload data.",
      })
    ),
    op: S.tag(0).pipe(
      $I.annoteKey("ObsHelloMessage.op", {
        description: "obs-websocket Hello OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsHelloMessage", {
    description: "obs-websocket Hello base-envelope message.",
  })
) {}

/**
 * `Identify` base-envelope message (`op: 1`).
 *
 * **Example** (Make Identify op message)
 *
 * ```ts
 * import { ObsIdentify, ObsIdentifyMessage } from "@beep/obs"
 *
 * const message = ObsIdentifyMessage.make({ d: ObsIdentify.make({ rpcVersion: 1, eventSubscriptions: 79 }) })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsIdentifyMessage extends S.Class<ObsIdentifyMessage>($I`ObsIdentifyMessage`)(
  {
    d: ObsIdentify.pipe(
      $I.annoteKey("ObsIdentifyMessage.d", {
        description: "Identify payload data.",
      })
    ),
    op: S.tag(1).pipe(
      $I.annoteKey("ObsIdentifyMessage.op", {
        description: "obs-websocket Identify OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsIdentifyMessage", {
    description: "obs-websocket Identify base-envelope message.",
  })
) {}

/**
 * `Identified` base-envelope message (`op: 2`).
 *
 * **Example** (Make Identified op message)
 *
 * ```ts
 * import { ObsIdentified, ObsIdentifiedMessage } from "@beep/obs"
 *
 * const message = ObsIdentifiedMessage.make({ d: ObsIdentified.make({ negotiatedRpcVersion: 1 }) })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsIdentifiedMessage extends S.Class<ObsIdentifiedMessage>($I`ObsIdentifiedMessage`)(
  {
    d: ObsIdentified.pipe(
      $I.annoteKey("ObsIdentifiedMessage.d", {
        description: "Identified payload data.",
      })
    ),
    op: S.tag(2).pipe(
      $I.annoteKey("ObsIdentifiedMessage.op", {
        description: "obs-websocket Identified OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsIdentifiedMessage", {
    description: "obs-websocket Identified base-envelope message.",
  })
) {}

/**
 * `Event` base-envelope message (`op: 5`).
 *
 * **Example** (Make Event op message)
 *
 * ```ts
 * import { ObsEventEnvelope, ObsEventMessage } from "@beep/obs"
 *
 * const message = ObsEventMessage.make({
 *   d: ObsEventEnvelope.make({ eventType: "StudioModeStateChanged", eventIntent: 1 })
 * })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsEventMessage extends S.Class<ObsEventMessage>($I`ObsEventMessage`)(
  {
    d: ObsEventEnvelope.pipe(
      $I.annoteKey("ObsEventMessage.d", {
        description: "Event payload data.",
      })
    ),
    op: S.tag(5).pipe(
      $I.annoteKey("ObsEventMessage.op", {
        description: "obs-websocket Event OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsEventMessage", {
    description: "obs-websocket Event base-envelope message.",
  })
) {}

/**
 * `Request` base-envelope message (`op: 6`).
 *
 * **Example** (Make Request op message)
 *
 * ```ts
 * import { ObsRequestEnvelope, ObsRequestMessage } from "@beep/obs"
 *
 * const message = ObsRequestMessage.make({
 *   d: ObsRequestEnvelope.make({ requestType: "GetVersion", requestId: "beep-obs-1" })
 * })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRequestMessage extends S.Class<ObsRequestMessage>($I`ObsRequestMessage`)(
  {
    d: ObsRequestEnvelope.pipe(
      $I.annoteKey("ObsRequestMessage.d", {
        description: "Request payload data.",
      })
    ),
    op: S.tag(6).pipe(
      $I.annoteKey("ObsRequestMessage.op", {
        description: "obs-websocket Request OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsRequestMessage", {
    description: "obs-websocket Request base-envelope message.",
  })
) {}

/**
 * `RequestResponse` base-envelope message (`op: 7`).
 *
 * **Example** (Make RequestResponse op message)
 *
 * ```ts
 * import { ObsRequestResponseEnvelope, ObsRequestResponseMessage, ObsRequestStatus } from "@beep/obs"
 *
 * const message = ObsRequestResponseMessage.make({
 *   d: ObsRequestResponseEnvelope.make({
 *     requestType: "GetVersion",
 *     requestId: "beep-obs-1",
 *     requestStatus: ObsRequestStatus.make({ result: true, code: 100 })
 *   })
 * })
 * console.log(message.op)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRequestResponseMessage extends S.Class<ObsRequestResponseMessage>($I`ObsRequestResponseMessage`)(
  {
    d: ObsRequestResponseEnvelope.pipe(
      $I.annoteKey("ObsRequestResponseMessage.d", {
        description: "RequestResponse payload data.",
      })
    ),
    op: S.tag(7).pipe(
      $I.annoteKey("ObsRequestResponseMessage.op", {
        description: "obs-websocket RequestResponse OpCode discriminator.",
      })
    ),
  },
  $I.annote("ObsRequestResponseMessage", {
    description: "obs-websocket RequestResponse base-envelope message.",
  })
) {}

/**
 * Messages the obs-websocket server sends to this client, discriminated by
 * the envelope `op` code.
 *
 * **Example** (Guard incoming message shape)
 *
 * ```ts
 * import { ObsIncomingMessage } from "@beep/obs"
 *
 * console.log(ObsIncomingMessage.is({ op: 2, d: { negotiatedRpcVersion: 1 } }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObsIncomingMessage = S.Union([
  ObsHelloMessage,
  ObsIdentifiedMessage,
  ObsEventMessage,
  ObsRequestResponseMessage,
]).pipe(
  $I.annoteSchema("ObsIncomingMessage", {
    description: "obs-websocket messages sent from the server to this client.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("op"),
      SchemaUtils.withStatics(() => ({ is: schema.is }))
    )
);

/**
 * Messages the obs-websocket server sends to this client.
 *
 * **Example** (Read incoming message op)
 *
 * ```ts
 * import type { ObsIncomingMessage } from "@beep/obs"
 *
 * const opOf = (message: ObsIncomingMessage) => message.op
 * console.log(opOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsIncomingMessage = typeof ObsIncomingMessage.Type;

const ObsOutgoingMessageWithCodecStatics = S.Union([ObsIdentifyMessage, ObsRequestMessage]).pipe(
  $I.annoteSchema("ObsOutgoingMessage", {
    description: "obs-websocket messages sent from this client to the server.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Messages this client sends to the obs-websocket server, discriminated by
 * the envelope `op` code.
 *
 * **Example** (Guard outgoing message shape)
 *
 * ```ts
 * import { ObsOutgoingMessage } from "@beep/obs"
 *
 * console.log(ObsOutgoingMessage.is({ op: 1, d: { rpcVersion: 1, eventSubscriptions: 79 } }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ObsOutgoingMessage = ObsOutgoingMessageWithCodecStatics.pipe(
  S.toTaggedUnion("op"),
  SchemaUtils.withStatics(() => ({ is: ObsOutgoingMessageWithCodecStatics.is }))
);

/**
 * Messages this client sends to the obs-websocket server.
 *
 * **Example** (Read outgoing message op)
 *
 * ```ts
 * import type { ObsOutgoingMessage } from "@beep/obs"
 *
 * const opOf = (message: ObsOutgoingMessage) => message.op
 * console.log(opOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObsOutgoingMessage = typeof ObsOutgoingMessage.Type;

/**
 * Decode a raw obs-websocket JSON text frame into an {@link ObsIncomingMessage}.
 *
 * **Example** (Decode incoming JSON frame)
 *
 * ```ts
 * import { decodeObsIncomingMessageJson } from "@beep/obs"
 *
 * const effect = decodeObsIncomingMessageJson("{\"op\":2,\"d\":{\"negotiatedRpcVersion\":1}}")
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeObsIncomingMessageJson: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<ObsIncomingMessage, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<ObsIncomingMessage, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(ObsIncomingMessage)));

/**
 * Encode an {@link ObsIncomingMessage} into a JSON text frame. Primarily
 * useful for tests that fake the obs-websocket server side.
 *
 * **Example** (Encode incoming JSON frame)
 *
 * ```ts
 * import { encodeObsIncomingMessageJson, ObsIdentified, ObsIdentifiedMessage } from "@beep/obs"
 *
 * const effect = encodeObsIncomingMessageJson(
 *   ObsIdentifiedMessage.make({ d: ObsIdentified.make({ negotiatedRpcVersion: 1 }) })
 * )
 * console.log(effect)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeObsIncomingMessageJson: {
  (options?: SchemaAST.ParseOptions): (input: ObsIncomingMessage) => Effect.Effect<string, S.SchemaError>;
  (input: ObsIncomingMessage, options?: SchemaAST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(
  // Dispatch on the `op` envelope discriminant: every `ObsIncomingMessage` carries
  // one and `ParseOptions` never does.
  (args) => P.hasProperty(args[0], "op"),
  S.encodeEffect(S.fromJsonString(ObsIncomingMessage))
);

/**
 * Decode a raw obs-websocket JSON text frame into an {@link ObsOutgoingMessage}.
 * Primarily useful for tests that fake the obs-websocket server side.
 *
 * **Example** (Decode outgoing JSON frame)
 *
 * ```ts
 * import { decodeObsOutgoingMessageJson } from "@beep/obs"
 *
 * const effect = decodeObsOutgoingMessageJson(
 *   "{\"op\":1,\"d\":{\"rpcVersion\":1,\"eventSubscriptions\":79}}"
 * )
 * console.log(effect)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeObsOutgoingMessageJson: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<ObsOutgoingMessage, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<ObsOutgoingMessage, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(ObsOutgoingMessage)));

/**
 * Encode an {@link ObsOutgoingMessage} into a JSON text frame for the wire.
 *
 * **Example** (Encode outgoing JSON frame)
 *
 * ```ts
 * import { encodeObsOutgoingMessageJson, ObsIdentify, ObsIdentifyMessage } from "@beep/obs"
 *
 * const effect = encodeObsOutgoingMessageJson(
 *   ObsIdentifyMessage.make({ d: ObsIdentify.make({ rpcVersion: 1, eventSubscriptions: 79 }) })
 * )
 * console.log(effect)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeObsOutgoingMessageJson: {
  (options?: SchemaAST.ParseOptions): (input: ObsOutgoingMessage) => Effect.Effect<string, S.SchemaError>;
  (input: ObsOutgoingMessage, options?: SchemaAST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(
  // Dispatch on the `op` envelope discriminant: every `ObsOutgoingMessage` carries
  // one and `ParseOptions` never does.
  (args) => P.hasProperty(args[0], "op"),
  S.encodeEffect(S.fromJsonString(ObsOutgoingMessage))
);

/**
 * `RecordStateChanged` event data payload.
 *
 * **Example** (Make record state data)
 *
 * ```ts
 * import { ObsRecordStateChangedData } from "@beep/obs"
 * import * as O from "effect/Option"
 *
 * const data = ObsRecordStateChangedData.make({
 *   outputActive: true,
 *   outputState: "OBS_WEBSOCKET_OUTPUT_STARTED",
 *   outputPath: O.none()
 * })
 * console.log(data.outputState)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRecordStateChangedData extends S.Class<ObsRecordStateChangedData>($I`ObsRecordStateChangedData`)(
  {
    outputActive: S.Boolean.pipe(
      $I.annoteKey("ObsRecordStateChangedData.outputActive", {
        description: "Whether the record output is active.",
      })
    ),
    outputPath: S.OptionFromNullishOr(S.String).pipe(
      $I.annoteKey("ObsRecordStateChangedData.outputPath", {
        description: "File name for the saved recording when the record output stopped; null otherwise.",
      })
    ),
    outputState: ObsOutputState.pipe(
      $I.annoteKey("ObsRecordStateChangedData.outputState", {
        description: "The specific state of the record output.",
      })
    ),
  },
  $I.annote("ObsRecordStateChangedData", {
    description: "obs-websocket RecordStateChanged event data payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsRecordStateChangedData);
}

/**
 * Typed `RecordStateChanged` driver event. The `STARTED` transition is the
 * recording clock anchor: the driver captures the receipt wall-clock time as
 * `recordStartEpochMs`.
 *
 * **Example** (Make record state event)
 *
 * ```ts
 * import { ObsRecordStateChangedEvent } from "@beep/obs"
 * import * as O from "effect/Option"
 *
 * const event = ObsRecordStateChangedEvent.make({
 *   outputActive: true,
 *   outputState: "OBS_WEBSOCKET_OUTPUT_STARTED",
 *   outputPath: O.none()
 * })
 * console.log(event.eventType)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class ObsRecordStateChangedEvent extends S.Class<ObsRecordStateChangedEvent>($I`ObsRecordStateChangedEvent`)(
  {
    eventType: S.tag("RecordStateChanged").pipe(
      $I.annoteKey("ObsRecordStateChangedEvent.eventType", {
        description: "Discriminator for typed RecordStateChanged driver events.",
      })
    ),
    outputActive: S.Boolean.pipe(
      $I.annoteKey("ObsRecordStateChangedEvent.outputActive", {
        description: "Whether the record output is active.",
      })
    ),
    outputPath: S.OptionFromNullishOr(S.String).pipe(
      $I.annoteKey("ObsRecordStateChangedEvent.outputPath", {
        description: "File name for the saved recording when the record output stopped; none otherwise.",
      })
    ),
    outputState: ObsOutputState.pipe(
      $I.annoteKey("ObsRecordStateChangedEvent.outputState", {
        description: "The specific state of the record output.",
      })
    ),
  },
  $I.annote("ObsRecordStateChangedEvent", {
    description: "Typed obs-websocket RecordStateChanged driver event.",
  })
) {
  static readonly is = S.is(ObsRecordStateChangedEvent);
}

/**
 * Passthrough driver event for obs-websocket event types the driver does not
 * model. Nothing is dropped: the raw envelope fields ride along.
 *
 * **Example** (Make unknown passthrough event)
 *
 * ```ts
 * import { ObsUnknownEvent } from "@beep/obs"
 * import * as O from "effect/Option"
 *
 * const event = ObsUnknownEvent.make({
 *   eventType: "StudioModeStateChanged",
 *   eventIntent: 1,
 *   eventData: O.none()
 * })
 * console.log(event.eventType)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export class ObsUnknownEvent extends S.Class<ObsUnknownEvent>($I`ObsUnknownEvent`)(
  {
    eventData: S.Option(UnknownRecord).pipe(
      $I.annoteKey("ObsUnknownEvent.eventData", {
        description: "Raw event payload object, when the event carried data.",
      })
    ),
    eventIntent: S.Int.pipe(
      $I.annoteKey("ObsUnknownEvent.eventIntent", {
        description: "EventSubscription intent bit required to receive this event.",
      })
    ),
    eventType: S.String.pipe(
      $I.annoteKey("ObsUnknownEvent.eventType", {
        description: "obs-websocket event type name passed through unmodeled.",
      })
    ),
  },
  $I.annote("ObsUnknownEvent", {
    description: "Passthrough driver event for unmodeled obs-websocket event types.",
  })
) {
  static readonly is = S.is(ObsUnknownEvent);
}

/**
 * Driver events published on the protocol event stream: typed
 * `RecordStateChanged` transitions plus lossless unknown-event passthrough.
 *
 * **Example** (Read driver event type)
 *
 * ```ts
 * import type { ObsEvent } from "@beep/obs"
 *
 * const eventTypeOf = (event: ObsEvent) => event.eventType
 * console.log(eventTypeOf)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export const ObsEvent = S.Union([ObsRecordStateChangedEvent, ObsUnknownEvent]).pipe(
  $I.annoteSchema("ObsEvent", {
    description: "Driver events published on the obs-websocket protocol event stream.",
  })
);

/**
 * Driver events published on the protocol event stream.
 *
 * **Example** (Read protocol event type)
 *
 * ```ts
 * import type { ObsEvent } from "@beep/obs"
 *
 * const eventTypeOf = (event: ObsEvent) => event.eventType
 * console.log(eventTypeOf)
 * ```
 *
 * @category events
 * @since 0.0.0
 */
export type ObsEvent = typeof ObsEvent.Type;

/**
 * `GetVersion` response payload subset.
 *
 * **Example** (Make GetVersion info payload)
 *
 * ```ts
 * import { ObsVersionInfo } from "@beep/obs"
 *
 * const info = ObsVersionInfo.make({
 *   obsVersion: "32.1.2",
 *   obsWebSocketVersion: "5.5.2",
 *   rpcVersion: 1,
 *   availableRequests: [],
 *   supportedImageFormats: [],
 *   platform: "ubuntu",
 *   platformDescription: "Linux"
 * })
 * console.log(info.obsVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsVersionInfo extends S.Class<ObsVersionInfo>($I`ObsVersionInfo`)(
  {
    availableRequests: S.Array(S.String).pipe(
      $I.annoteKey("ObsVersionInfo.availableRequests", {
        description: "RPC requests available for the negotiated RPC version.",
      })
    ),
    obsVersion: S.String.pipe(
      $I.annoteKey("ObsVersionInfo.obsVersion", {
        description: "Current OBS Studio version.",
      })
    ),
    obsWebSocketVersion: S.String.pipe(
      $I.annoteKey("ObsVersionInfo.obsWebSocketVersion", {
        description: "Current obs-websocket plugin version.",
      })
    ),
    platform: S.String.pipe(
      $I.annoteKey("ObsVersionInfo.platform", {
        description: "Platform name, usually windows, macos, or a linux flavor.",
      })
    ),
    platformDescription: S.String.pipe(
      $I.annoteKey("ObsVersionInfo.platformDescription", {
        description: "Human-readable platform description.",
      })
    ),
    rpcVersion: S.Int.pipe(
      $I.annoteKey("ObsVersionInfo.rpcVersion", {
        description: "Latest obs-websocket RPC version available.",
      })
    ),
    supportedImageFormats: S.Array(S.String).pipe(
      $I.annoteKey("ObsVersionInfo.supportedImageFormats", {
        description: "Image formats available in screenshot requests.",
      })
    ),
  },
  $I.annote("ObsVersionInfo", {
    description: "obs-websocket GetVersion response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsVersionInfo);
}

/**
 * `GetRecordStatus` response payload.
 *
 * **Example** (Make GetRecordStatus payload)
 *
 * ```ts
 * import { ObsRecordStatus } from "@beep/obs"
 *
 * const status = ObsRecordStatus.make({
 *   outputActive: false,
 *   outputPaused: false,
 *   outputTimecode: "00:00:00.000",
 *   outputDuration: 0,
 *   outputBytes: 0
 * })
 * console.log(status.outputActive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRecordStatus extends S.Class<ObsRecordStatus>($I`ObsRecordStatus`)(
  {
    outputActive: S.Boolean.pipe(
      $I.annoteKey("ObsRecordStatus.outputActive", {
        description: "Whether the record output is active.",
      })
    ),
    outputBytes: S.Finite.pipe(
      $I.annoteKey("ObsRecordStatus.outputBytes", {
        description: "Number of bytes sent by the record output.",
      })
    ),
    outputDuration: S.Finite.pipe(
      $I.annoteKey("ObsRecordStatus.outputDuration", {
        description: "Current duration in milliseconds for the record output.",
      })
    ),
    outputPaused: S.Boolean.pipe(
      $I.annoteKey("ObsRecordStatus.outputPaused", {
        description: "Whether the record output is paused.",
      })
    ),
    outputTimecode: S.String.pipe(
      $I.annoteKey("ObsRecordStatus.outputTimecode", {
        description: "Current formatted timecode string for the record output.",
      })
    ),
  },
  $I.annote("ObsRecordStatus", {
    description: "obs-websocket GetRecordStatus response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsRecordStatus);
}

/**
 * `StopRecord` response payload. The `outputPath` here is authoritative for
 * the committed recording file.
 *
 * **Example** (Make StopRecord result path)
 *
 * ```ts
 * import { ObsStopRecordResult } from "@beep/obs"
 *
 * const result = ObsStopRecordResult.make({ outputPath: "/tmp/capture.mkv" })
 * console.log(result.outputPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsStopRecordResult extends S.Class<ObsStopRecordResult>($I`ObsStopRecordResult`)(
  {
    outputPath: S.String.pipe(
      $I.annoteKey("ObsStopRecordResult.outputPath", {
        description: "File name for the saved recording (authoritative).",
      })
    ),
  },
  $I.annote("ObsStopRecordResult", {
    description: "obs-websocket StopRecord response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsStopRecordResult);
}

/**
 * `GetRecordDirectory` response payload.
 *
 * **Example** (Make record directory payload)
 *
 * ```ts
 * import { ObsRecordDirectory } from "@beep/obs"
 *
 * const directory = ObsRecordDirectory.make({ recordDirectory: "/tmp" })
 * console.log(directory.recordDirectory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsRecordDirectory extends S.Class<ObsRecordDirectory>($I`ObsRecordDirectory`)(
  {
    recordDirectory: S.String.pipe(
      $I.annoteKey("ObsRecordDirectory.recordDirectory", {
        description: "Directory the record output writes files to.",
      })
    ),
  },
  $I.annote("ObsRecordDirectory", {
    description: "obs-websocket GetRecordDirectory response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsRecordDirectory);
}

/**
 * `CreateScene` response payload. `sceneUuid` is modeled as an `Option`
 * because older servers may omit it.
 *
 * **Example** (Make CreateScene response)
 *
 * ```ts
 * import { ObsCreatedScene } from "@beep/obs"
 *
 * const created = ObsCreatedScene.make({})
 * console.log(created.sceneUuid)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsCreatedScene extends S.Class<ObsCreatedScene>($I`ObsCreatedScene`)(
  {
    sceneUuid: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsCreatedScene.sceneUuid", {
        description: "UUID of the created scene, when the server reports one.",
      })
    ),
  },
  $I.annote("ObsCreatedScene", {
    description: "obs-websocket CreateScene response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsCreatedScene);
}

/**
 * One scene summary entry from `GetSceneList`.
 *
 * **Example** (Make scene summary entry)
 *
 * ```ts
 * import { ObsSceneSummary } from "@beep/obs"
 *
 * const scene = ObsSceneSummary.make({ sceneName: "beep-qa" })
 * console.log(scene.sceneName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsSceneSummary extends S.Class<ObsSceneSummary>($I`ObsSceneSummary`)(
  {
    sceneIndex: S.OptionFromOptionalKey(S.Int).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsSceneSummary.sceneIndex", {
        description: "Position of the scene in the scene list, when reported.",
      })
    ),
    sceneName: S.String.pipe(
      $I.annoteKey("ObsSceneSummary.sceneName", {
        description: "Name of the scene.",
      })
    ),
    sceneUuid: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsSceneSummary.sceneUuid", {
        description: "UUID of the scene, when the server reports one.",
      })
    ),
  },
  $I.annote("ObsSceneSummary", {
    description: "One scene summary entry from obs-websocket GetSceneList.",
  })
) {}

/**
 * `GetSceneList` response payload subset.
 *
 * **Example** (Make GetSceneList payload)
 *
 * ```ts
 * import { ObsSceneList } from "@beep/obs"
 * import * as O from "effect/Option"
 *
 * const list = ObsSceneList.make({ currentProgramSceneName: O.some("beep-qa"), scenes: [] })
 * console.log(list.scenes)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsSceneList extends S.Class<ObsSceneList>($I`ObsSceneList`)(
  {
    currentProgramSceneName: S.OptionFromNullOr(S.String).pipe(
      $I.annoteKey("ObsSceneList.currentProgramSceneName", {
        description: "Current program scene name; none when null (non-main canvas or internal state desync).",
      })
    ),
    scenes: S.Array(ObsSceneSummary).pipe(
      $I.annoteKey("ObsSceneList.scenes", {
        description: "Scenes known to OBS.",
      })
    ),
  },
  $I.annote("ObsSceneList", {
    description: "obs-websocket GetSceneList response payload subset.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsSceneList);
}

/**
 * `CreateInput` response payload. `inputUuid` is modeled as an `Option`
 * because older servers may omit it.
 *
 * **Example** (Make CreateInput response)
 *
 * ```ts
 * import { ObsCreatedInput } from "@beep/obs"
 *
 * const created = ObsCreatedInput.make({ sceneItemId: 1 })
 * console.log(created.sceneItemId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsCreatedInput extends S.Class<ObsCreatedInput>($I`ObsCreatedInput`)(
  {
    inputUuid: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ObsCreatedInput.inputUuid", {
        description: "UUID of the newly created input, when the server reports one.",
      })
    ),
    sceneItemId: S.Int.pipe(
      $I.annoteKey("ObsCreatedInput.sceneItemId", {
        description: "ID of the newly created scene item.",
      })
    ),
  },
  $I.annote("ObsCreatedInput", {
    description: "obs-websocket CreateInput response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsCreatedInput);
}

/**
 * `GetInputSettings` response payload.
 *
 * **Example** (Make input settings info)
 *
 * ```ts
 * import { ObsInputSettingsInfo } from "@beep/obs"
 *
 * const info = ObsInputSettingsInfo.make({
 *   inputKind: "pipewire-screen-capture-source",
 *   inputSettings: {}
 * })
 * console.log(info.inputKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsInputSettingsInfo extends S.Class<ObsInputSettingsInfo>($I`ObsInputSettingsInfo`)(
  {
    inputKind: S.String.pipe(
      $I.annoteKey("ObsInputSettingsInfo.inputKind", {
        description: "The kind of the input.",
      })
    ),
    inputSettings: UnknownRecord.pipe(
      $I.annoteKey("ObsInputSettingsInfo.inputSettings", {
        description: "Settings object for the input (defaults not included).",
      })
    ),
  },
  $I.annote("ObsInputSettingsInfo", {
    description: "obs-websocket GetInputSettings response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsInputSettingsInfo);
}

/**
 * `GetSceneItemList` response payload. Scene items stay as raw records —
 * the driver only inspects them opportunistically.
 *
 * **Example** (Make scene item list)
 *
 * ```ts
 * import { ObsSceneItemList } from "@beep/obs"
 *
 * const list = ObsSceneItemList.make({ sceneItems: [] })
 * console.log(list.sceneItems)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObsSceneItemList extends S.Class<ObsSceneItemList>($I`ObsSceneItemList`)(
  {
    sceneItems: S.Array(UnknownRecord).pipe(
      $I.annoteKey("ObsSceneItemList.sceneItems", {
        description: "Raw scene item records in the scene.",
      })
    ),
  },
  $I.annote("ObsSceneItemList", {
    description: "obs-websocket GetSceneItemList response payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(ObsSceneItemList);
}
