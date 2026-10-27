/**
 * Patched ACP JSON-RPC transport primitives.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FiberSet from "effect/FiberSet";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as P from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcClientError from "effect/rpc/RpcClientError";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";
import * as AcpSchemaV1 from "./_generated/schema-v1.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import * as AcpCompat from "./AcpCompat.models.ts";
import { fromJsonText } from "./AcpJson.codec.ts";
import { makeNdJsonRpcFrameDecoder } from "./internal/jsonrpc.ts";
import { isolateNotificationHandler } from "./internal/shared.ts";
import type * as Duration from "effect/Duration";
import type * as PlatformError from "effect/PlatformError";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import type * as Scope from "effect/Scope";
import type * as Stdio from "effect/Stdio";
import type { AcpInboundMessage, AcpWireMessage } from "./internal/jsonrpc.ts";

const $I = $AcpId.create("protocol");

const isAcpSchemaError = S.is(AcpSchema.Error);
const isAcpError = S.is(AcpError.AcpError);
const isProcessExited = S.is(AcpError.AcpProcessExitedError);
// Typed Effect RPC ids are allocated as non-negative safe integers (effect's default counter starts
// at 0, this package's at `RPC_REQUEST_ID_START`); anything else is not an RpcClient response.
// effect's own encoder writes a server-level `Defect` with the id -32603.
const isEffectRpcRequestId = S.is(S.Int.check(S.isGreaterThanOrEqualTo(0)));

// CSF-017: every peer-fed queue is bounded. Notifications slide (dropping the oldest unread one)
// instead of suspending, so a consumer that never drains `incoming` cannot stall the reader. No
// production consumer reads `incoming`, so it keeps only a short tail (upstream parity: 32).
const ACP_PROTOCOL_QUEUE_CAPACITY = 1_024;
const ACP_PROTOCOL_NOTIFICATION_CAPACITY = 32;
const ACP_PROTOCOL_DISCONNECT_QUEUE_CAPACITY = 16;
// Inbound extension requests run on their own fibers so a handler can await an outbound request
// whose response the reader still has to deliver. Past the bound, a new extension request is
// answered with an error instead of parking the reader: a parked reader could never deliver the
// responses that would free a permit.
const ACP_PROTOCOL_EXT_REQUEST_CONCURRENCY = 64;
// Notification handlers that sent a request released the reader and finish in the background. The
// bound keeps a peer from growing them without limit; past it, the handler's request fails.
const ACP_PROTOCOL_DETACHED_NOTIFICATION_HANDLERS = 64;
// Distinct notification decode failures warned about per connection. Array indices are folded out
// of the dedupe key, so one defect repeated at new indices stays one kind; the cap bounds the rest.
const ACP_PROTOCOL_DECODE_WARNING_KINDS = 64;
const DECODE_FAILURE_INDEX_SEGMENT = /(?<=^|[.\s])\d+(?=[.\s…]|$)/g;
// A peer that closes stdout but keeps running would otherwise hold every caller until it exits.
const ACP_PROTOCOL_TERMINATION_CLASSIFICATION_TIMEOUT: Duration.Input = "5 seconds";
const ACP_STDIO_CLIENT_ID = 0;

/**
 * First id allocated to typed Effect RPC requests.
 *
 * **Details**
 *
 * Typed RPC ids count up from here once per connection. The value stays inside signed int32,
 * because some ACP SDKs (the Kotlin SDK decodes ids as `Int`) do not answer larger ids, and far
 * above extension request ids, which count up from 1. The protocol forwards only responses with
 * non-negative safe-integer ids to the RPC client.
 *
 * **Example** (Allocate the first typed RPC id)
 *
 * ```ts
 * import { RPC_REQUEST_ID_START } from "@beep/acp/protocol"
 *
 * console.log(RPC_REQUEST_ID_START) // 1073741824
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RPC_REQUEST_ID_START = 2 ** 30;

/**
 * Identity of an inbound ACP request, passed to request and extension handlers.
 *
 * **Details**
 *
 * `requestId` is the JSON-RPC id exactly as the peer sent it, so the number `1` and the string
 * `"1"` stay distinct.
 *
 * **Example** (Make a request context)
 *
 * ```ts
 * import { AcpRequestContext } from "@beep/acp/protocol"
 *
 * const context = AcpRequestContext.make({ method: "x/ping", requestId: 7 })
 * console.log(context.requestId) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AcpRequestContext extends S.Opaque<AcpRequestContext, { readonly brand: unique symbol }>()(
  S.Struct({
    method: S.String.annotateKey({
      description: "ACP method named by the inbound request.",
    }),
    requestId: AcpError.AcpRequestId.annotateKey({
      description: "JSON-RPC id of the inbound request, exactly as the peer sent it.",
    }),
  }).pipe(
    $I.annoteSchema("AcpRequestContext", {
      description: "Identity of an inbound ACP request, passed to request and extension handlers.",
    })
  )
) {}

/**
 * Handler for an inbound ACP request.
 *
 * **Example** (Echo handler)
 *
 * ```ts
 * import type { AcpRequestHandler } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect"
 *
 * const echo: AcpRequestHandler<string, string> = (request, context) =>
 *   Effect.succeed(`${context.method}: ${request}`)
 * console.log(echo)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type AcpRequestHandler<Request, Response> = (
  request: Request,
  context: AcpRequestContext
) => Effect.Effect<Response, AcpError.AcpError>;

/**
 * Fallback handler for ACP extension requests.
 *
 * **Example** (Fallback request handler)
 *
 * ```ts
 * import type { AcpUnknownExtRequestHandler } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect";
 * const handler: AcpUnknownExtRequestHandler = (method, params, context) =>
 *   Effect.succeed({ method, params, requestId: context.requestId })
 * console.log(handler)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type AcpUnknownExtRequestHandler = (
  method: string,
  params: unknown,
  context: AcpRequestContext
) => Effect.Effect<unknown, AcpError.AcpError>;

/**
 * Fallback handler for ACP extension notifications.
 *
 * **Example** (Fallback notification handler)
 *
 * ```ts
 * import type { AcpUnknownExtNotificationHandler } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect";
 * const handler: AcpUnknownExtNotificationHandler = (method) => Effect.sync(() => console.log(method))
 * console.log(handler)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type AcpUnknownExtNotificationHandler = (
  method: string,
  params: unknown
) => Effect.Effect<void, AcpError.AcpError>;

/**
 * Common ACP extension-handler registration surface shared by agents and clients.
 *
 * **Example** (Register extension request)
 *
 * ```ts
 * import type { AcpExtensionRegistrars } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 *
 * const registerPing = (registrars: AcpExtensionRegistrars) =>
 *   registrars.handleExtRequest("x/ping", S.Struct({ message: S.String }), ({ message }, context) =>
 *     Effect.succeed({ ok: message, requestId: context.requestId })
 *   )
 *
 * console.log(registerPing)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export interface AcpExtensionRegistrars {
  readonly handleExtNotification: <A, I>(
    method: string,
    payload: S.Codec<A, I>,
    handler: (payload: A) => Effect.Effect<void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleExtRequest: <A, I>(
    method: string,
    payload: S.Codec<A, I>,
    handler: AcpRequestHandler<A, unknown>
  ) => Effect.Effect<void>;
  readonly handleUnknownExtNotification: (handler: AcpUnknownExtNotificationHandler) => Effect.Effect<void>;
  readonly handleUnknownExtRequest: (handler: AcpUnknownExtRequestHandler) => Effect.Effect<void>;
}

/**
 * Standard I/O transport accepted by the ACP protocol.
 *
 * **Details**
 *
 * It is an Effect `Stdio` whose input stream may also fail with a classified `AcpError`, so a
 * process adapter can end the connection with, for example, an `AcpProcessExitedError` that
 * carries the peer's stderr tail. Every `Stdio.Stdio` is an `AcpStdio`.
 *
 * **Example** (Widen an Effect Stdio)
 *
 * ```ts
 * import type { AcpStdio } from "@beep/acp/protocol"
 * import type * as Stdio from "effect/Stdio"
 *
 * const widen = (stdio: Stdio.Stdio): AcpStdio => stdio
 * console.log(widen)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export type AcpStdio = Omit<Stdio.Stdio, "stdin"> & {
  readonly stdin: Stream.Stream<Uint8Array, PlatformError.PlatformError | AcpError.AcpError>;
};

/**
 * Callbacks that let tests observe the protocol's outgoing writer.
 *
 * **Details**
 *
 * `onOutgoingWriteAdmitted` runs after a response is admitted to the writer and before it is
 * queued. `onOutgoingWriterExit` runs when the writer completes, with whether the completion was
 * an intentional `serverProtocol.end`.
 *
 * **Example** (Observe writer exit)
 *
 * ```ts
 * import type { AcpPatchedProtocolTestHooks } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect"
 *
 * const hooks: AcpPatchedProtocolTestHooks = {
 *   onOutgoingWriterExit: (intentionalEnd) => Effect.sync(() => console.log(intentionalEnd)),
 * }
 * console.log(hooks)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export interface AcpPatchedProtocolTestHooks {
  readonly onOutgoingWriteAdmitted?: () => Effect.Effect<void>;
  readonly onOutgoingWriterExit?: (intentionalEnd: boolean) => Effect.Effect<void>;
}

/**
 * Re-export of the child-process termination classifier.
 *
 * **Details**
 *
 * A signal exit becomes `AcpProcessExitedError` with `signal`, an exit code becomes
 * `AcpProcessExitedError` with `code`, and any other exit-status failure becomes an
 * `AcpTransportError` for `read-process-exit-status`. Each error keeps the process id. Pass the
 * result as `terminationError` so an ended input stream reports how the peer process ended.
 *
 * **Example** (Classify a child process exit)
 *
 * ```ts
 * import { makeTerminationError } from "@beep/acp/protocol"
 * import * as Effect from "effect/Effect"
 * import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
 *
 * const error = makeTerminationError({
 *   exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(7)),
 *   pid: ChildProcessSpawner.ProcessId(42),
 * })
 * console.log(error)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export { makeTerminationError } from "./internal/stdio.ts";

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

const AcpProtocolLogDirectionBase = LiteralKit(["incoming", "outgoing"]);
const AcpProtocolLogDirection = AcpProtocolLogDirectionBase.pipe(
  $I.annoteSchema("AcpProtocolLogDirection", {
    description: "Direction of an ACP protocol log event.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpProtocolLogDirectionBase)
);
type AcpProtocolLogDirection = typeof AcpProtocolLogDirection.Type;
const AcpProtocolLogStageBase = LiteralKit(["raw", "decoded", "decode_failed"]);
const AcpProtocolLogStage = AcpProtocolLogStageBase.pipe(
  $I.annoteSchema("AcpProtocolLogStage", {
    description: "Processing stage represented by an ACP protocol log event.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpProtocolLogStageBase)
);
type AcpProtocolLogStage = typeof AcpProtocolLogStage.Type;
type AcpProtocolLogEventMember<T extends AcpProtocolLogDirection> = {
  readonly direction: T;
  readonly payload: unknown;
  readonly stage: AcpProtocolLogStage;
};

/**
 * Structured log event emitted by the ACP protocol adapter.
 *
 * **Details**
 *
 * A `decode_failed` event carries only structural diagnostics (operation, method, request id and
 * schema issue counts), never the wire payload or the failure cause.
 *
 * **Example** (Create event from unknown)
 *
 * ```ts
 * import { AcpProtocolLogEvent } from "@beep/acp/protocol"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownOption(AcpProtocolLogEvent)({
 *   direction: "incoming",
 *   stage: "raw",
 *   payload: "{}"
 * })
 * console.log(O.isSome(event))
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const AcpProtocolLogEvent = pipe(
  AcpProtocolLogDirection.mapMembers(
    Tuple.evolve([
      (literal: S.Literal<"incoming">) =>
        S.Class<AcpProtocolLogEventMember<"incoming">>($I`AcpProtocolLogIncomingEvent`)(
          {
            direction: S.tag(literal.literal).annotateKey({
              description: "Incoming ACP protocol log-event direction.",
            }),
            payload: S.Unknown.annotateKey({
              description: "Raw or decoded ACP protocol payload observed at this stage.",
            }),
            stage: AcpProtocolLogStage.annotateKey({
              description: "Processing stage for the incoming ACP protocol payload.",
            }),
          },
          $I.annote("AcpProtocolLogIncomingEvent", {
            description: "Structured incoming log event emitted by the ACP protocol adapter.",
          })
        ),
      (literal: S.Literal<"outgoing">) =>
        S.Class<AcpProtocolLogEventMember<"outgoing">>($I`AcpProtocolLogOutgoingEvent`)(
          {
            direction: S.tag(literal.literal).annotateKey({
              description: "Outgoing ACP protocol log-event direction.",
            }),
            payload: S.Unknown.annotateKey({
              description: "Raw or decoded ACP protocol payload observed at this stage.",
            }),
            stage: AcpProtocolLogStage.annotateKey({
              description: "Processing stage for the outgoing ACP protocol payload.",
            }),
          },
          $I.annote("AcpProtocolLogOutgoingEvent", {
            description: "Structured outgoing log event emitted by the ACP protocol adapter.",
          })
        ),
    ])
  ),
  $I.annoteSchema("AcpProtocolLogEvent", {
    description: "Structured log event emitted by the ACP protocol adapter.",
  }),
  S.toTaggedUnion("direction")
);

/**
 * Structured log event emitted by the ACP protocol adapter.
 *
 * **Example** (Typed log event value)
 *
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
 * **Example** (Make logging options)
 *
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
export class AcpProtocolLoggingOptions extends S.Opaque<AcpProtocolLoggingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    logIncoming: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether incoming ACP protocol payloads should be logged.",
    }),
    logOutgoing: S.optionalKey(S.Boolean).annotateKey({
      description: "Whether outgoing ACP protocol payloads should be logged.",
    }),
  }).pipe(
    $I.annoteSchema("AcpProtocolLoggingOptions", {
      description: "Schema-backed ACP protocol logging flags.",
    })
  )
) {}

type AcpProtocolLoggingFields = typeof AcpProtocolLoggingOptions.Encoded;

// --- Incoming notification payloads --------------------------------------------------------------
// The accepted `session/update` params and `elicitation/complete` method names live here so the
// notification union can widen (generation 1 and compat shapes) in one place.
//
// `session/update` params decode as generation 2 first, then generation 1. The generation-2
// members are open structs, so an idle `state_update` that carries the prompt `error` some agents
// report keeps it (as JSON) instead of failing. The compat member is listed last: it is what a
// client's `transformSessionUpdate` returns, so dispatched notifications carry either the decoded
// wire shape or the normalized one.
const AcpSessionUpdateParams = S.Union([
  AcpSchema.UpdateSessionNotification,
  AcpSchemaV1.SessionNotification,
  AcpCompat.SessionNotification,
]);
type AcpSessionUpdateParams = typeof AcpSessionUpdateParams.Type;

const AcpElicitationCompleteMethodBase = LiteralKit([
  CLIENT_METHODS.elicitation_complete,
  "session/elicitation/complete",
]);
const AcpElicitationCompleteMethod = AcpElicitationCompleteMethodBase.pipe(
  $I.annoteSchema("AcpElicitationCompleteMethod", {
    description: "Method names accepted for the ACP elicitation-complete notification.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpElicitationCompleteMethodBase)
);

const AcpSessionUpdateNotification = S.TaggedStruct("SessionUpdate", {
  method: S.tag(CLIENT_METHODS.session_update).annotateKey({
    description: "ACP `session/update` method name.",
  }),
  params: AcpSessionUpdateParams.annotateKey({
    description: "Decoded ACP session update notification payload.",
  }),
});

const AcpElicitationCompleteNotification = S.TaggedStruct("ElicitationComplete", {
  method: AcpElicitationCompleteMethod.annotateKey({
    description: "ACP elicitation-complete method name (`elicitation/complete` or the legacy session-scoped name).",
  }),
  params: AcpSchema.CompleteElicitationNotification.annotateKey({
    description: "Decoded ACP elicitation-complete notification payload.",
  }),
});

const AcpExtensionNotification = S.TaggedStruct("ExtNotification", {
  method: S.String.annotateKey({
    description: "ACP extension notification method name.",
  }),
  params: S.Unknown.annotateKey({
    description: "ACP extension notification payload.",
  }),
});

/**
 * Schema for notifications decoded from the ACP peer stream.
 *
 * **Example** (Decode extension notification)
 *
 * ```ts
 * import { AcpIncomingNotification } from "@beep/acp/protocol"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const notification = S.decodeUnknownOption(AcpIncomingNotification)({
 *   _tag: "ExtNotification",
 *   method: "x/custom",
 *   params: { ok: true }
 * })
 * console.log(O.map(notification, ({ _tag }) => _tag))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AcpIncomingNotification = pipe(
  S.Union([AcpSessionUpdateNotification, AcpElicitationCompleteNotification, AcpExtensionNotification]),
  $I.annoteSchema("AcpIncomingNotification", {
    description: "Schema for notifications decoded from the ACP peer stream.",
  }),
  S.toTaggedUnion("_tag")
);

/**
 * Type for {@link AcpIncomingNotification}.
 *
 * **Example** (Extract notification tag)
 *
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
 * **Details**
 *
 * - `serverRequestMethods` names the inbound requests handed to `serverProtocol` (the typed
 *   RpcServer); every other inbound request goes to `onExtRequest` on its own fiber.
 * - `onIncomingRequest` observes every inbound request before it is routed.
 * - `transformSessionUpdate` rewrites a decoded `session/update` before it is dispatched.
 * - `onOutgoingResponse` runs after a response was written to stdout;
 *   `onOutgoingResponseFailure` runs when a response could not be encoded or written.
 * - `terminationError` classifies an ended input stream; it defaults to
 *   `AcpInputStreamEndedError`. When it reports an `AcpProcessExitedError`, a broken stdin or
 *   stdout pipe also ends the connection with that exit, since a child's pipes break when it
 *   exits.
 *
 * **Example** (Inspect server request methods)
 *
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
export interface AcpPatchedProtocolOptions extends AcpProtocolLoggingFields {
  readonly logger?: (event: AcpProtocolLogEvent) => Effect.Effect<void>;
  readonly onExtRequest?: (
    method: string,
    params: unknown,
    context: AcpRequestContext
  ) => Effect.Effect<unknown, AcpError.AcpError>;
  readonly onIncomingRequest?: (
    requestId: AcpError.AcpRequestId,
    method: string,
    payload: unknown
  ) => Effect.Effect<void>;
  readonly onNotification?: (notification: AcpIncomingNotification) => Effect.Effect<void, AcpError.AcpError>;
  readonly onOutgoingResponse?: (requestId: AcpError.AcpRequestId) => Effect.Effect<void>;
  readonly onOutgoingResponseFailure?: (
    requestId: AcpError.AcpRequestId,
    error: AcpError.AcpError
  ) => Effect.Effect<void>;
  readonly onTermination?: (error: AcpError.AcpError) => Effect.Effect<void>;
  readonly serverRequestMethods: HashSet.HashSet<string>;
  readonly stdio: AcpStdio;
  readonly terminationError?: Effect.Effect<AcpError.AcpError>;
  readonly testHooks?: AcpPatchedProtocolTestHooks;
  readonly transformSessionUpdate?: (notification: AcpSessionUpdateParams) => AcpSessionUpdateParams;
}

/**
 * Runtime protocol handles used by ACP clients and agents.
 *
 * **Details**
 *
 * `request` sends an extension request with a numeric id counting up from 1 and waits for the
 * correlated response. `notify` sends a JSON-RPC notification without an `id`. Both fail at once
 * with the terminal error after the connection ended. `incoming` replays only the 32 most recent
 * decoded notifications that nobody has read yet.
 *
 * **Example** (Access incoming stream)
 *
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

interface AcpPendingRequest {
  readonly deferred: Deferred.Deferred<unknown, AcpError.AcpError>;
  readonly method: string;
}

type AcpAcknowledgement = Deferred.Deferred<void, AcpError.AcpError>;

interface AcpOutgoingWrite {
  readonly acknowledgement: O.Option<AcpAcknowledgement>;
  readonly payload: string | Uint8Array;
}

interface AcpOutgoingWriterState {
  readonly intentionalEnd: boolean;
  readonly outstandingAcknowledgements: HashSet.HashSet<AcpAcknowledgement>;
  readonly terminalError: O.Option<AcpError.AcpError>;
}

interface AcpNotificationDispatch {
  // Identifies the connection whose reader waits, so a request sent on another connection does
  // not release it.
  readonly connection: symbol;
  // Completed when the handler finishes or first sends a request on its connection.
  readonly readerReleased: Deferred.Deferred<void>;
}

// Set while a notification handler runs. `RpcClient` forks the send of a typed call with the
// caller's context, so a request the handler sends, directly or through a typed client, sees it.
const CurrentNotificationDispatch = Context.Reference<O.Option<AcpNotificationDispatch>>(
  $I`CurrentNotificationDispatch`,
  { defaultValue: O.none }
);

const decodeSessionUpdate = S.decodeUnknownEffect(AcpSessionUpdateParams);

// An idle `state_update` is what ends a generation-2 prompt, so it must not be dropped because an
// optional field fails strict decoding: `usage` and `error` are unstable in the v2 draft and agents
// report partial or newer shapes. Such an idle is re-decoded without those two fields.
const IdleStateUpdateEnvelope = S.StructWithRest(
  S.Struct({
    update: S.StructWithRest(S.Struct({ sessionUpdate: S.tag("state_update"), state: S.tag("idle") }), [
      S.Record(S.String, S.Unknown),
    ]),
  }),
  [S.Record(S.String, S.Unknown)]
);
const isIdleStateUpdateEnvelope = S.is(IdleStateUpdateEnvelope);
const withoutUnstableIdleFields = (envelope: typeof IdleStateUpdateEnvelope.Type) => ({
  ...envelope,
  update: Struct.omit(envelope.update, ["usage", "error"]),
});
const decodeElicitationComplete = S.decodeUnknownEffect(AcpSchema.CompleteElicitationNotification);
const isElicitationCompleteMethod = S.is(AcpElicitationCompleteMethod);
const JsonRpcNotificationFrame = S.Struct({
  jsonrpc: S.tag("2.0"),
  method: S.String,
  params: S.Unknown,
});
const encodeJsonRpcNotification = S.encodeUnknownEffect(fromJsonText(JsonRpcNotificationFrame));
const parserFactory = RpcSerialization.ndJsonRpc();
const textDecoder = new TextDecoder();

const textFromWire = (value: string | Uint8Array): string => (P.isString(value) ? value : textDecoder.decode(value));

const decodeFailureDiagnostics = (error: AcpError.AcpProtocolParseError) => ({
  operation: error.operation,
  ...O.getSomesStruct({
    issueCount: error.issueCount,
    issueKinds: error.issueKinds,
    issueSummary: error.issueSummary,
    maximumPathDepth: error.maximumPathDepth,
    method: error.method,
    requestId: error.requestId,
  }),
});

const outgoingMethodOf = (message: AcpWireMessage): O.Option<string> =>
  message._tag === "Request" ? O.some(message.tag) : O.none();

const outgoingRequestIdOf = (message: AcpWireMessage): O.Option<AcpError.AcpRequestId> =>
  Match.value(message).pipe(
    Match.tag("Request", ({ id }): O.Option<AcpError.AcpRequestId> => O.some(id)),
    Match.tag(
      "Exit",
      "Chunk",
      "Ack",
      "Interrupt",
      ({ requestId }): O.Option<AcpError.AcpRequestId> => O.some(requestId)
    ),
    Match.orElse(O.none<AcpError.AcpRequestId>),
    O.filter((requestId) => requestId !== "")
  );

type ExitCauseEntry = Extract<RpcMessage.ExitEncoded<unknown, unknown>, { readonly _tag: "Failure" }>["cause"][number];

const protocolDefectOf = (entry: ExitCauseEntry): O.Option<AcpSchema.Error> =>
  entry._tag === "Die" && isAcpSchemaError(entry.defect) ? O.some(entry.defect) : O.none();

const protocolFailureOf = (entry: ExitCauseEntry): O.Option<AcpSchema.Error> =>
  entry._tag === "Fail" && isAcpSchemaError(entry.error) ? O.some(entry.error) : O.none();

const protocolFailureOfCause = (cause: ReadonlyArray<ExitCauseEntry>): O.Option<AcpSchema.Error> =>
  O.flatMap(
    A.findFirst(cause, (entry) => entry._tag === "Fail"),
    protocolFailureOf
  );

type AcpInboundResponse = RpcMessage.ResponseChunkEncoded | RpcMessage.ResponseExitEncoded;

// Structural diagnostics for a dropped response: its id when it has one, and the code and message
// of its protocol error. The error data stays out of the log.
const uncorrelatedResponseAnnotations = (message: AcpInboundResponse) => {
  const error =
    message._tag === "Exit" && message.exit._tag === "Failure"
      ? protocolFailureOfCause(message.exit.cause)
      : O.none<AcpSchema.Error>();
  return {
    messageTag: message._tag,
    ...O.getSomesStruct({
      code: O.map(error, ({ code }) => code),
      errorMessage: O.map(error, ({ message }) => message),
      requestId: outgoingRequestIdOf(message),
    }),
  };
};

// Effect RPC's JSON-RPC codec reads a standard JSON-RPC error object inside a `Cause` envelope
// whose data is not a cause array as a defect. A single defect that is a protocol error object is
// the peer's typed failure, so it is restored to a `Fail` entry.
const normalizeAcpJsonRpcError: (message: AcpInboundMessage) => AcpInboundMessage =
  Match.type<AcpInboundMessage>().pipe(
    Match.tag("Exit", (message): AcpInboundMessage => {
      if (message.exit._tag !== "Failure" || A.length(message.exit.cause) !== 1) {
        return message;
      }
      return O.match(O.flatMap(A.head(message.exit.cause), protocolDefectOf), {
        onNone: () => message,
        onSome: (error) => ({ ...message, exit: { _tag: "Failure", cause: [{ _tag: "Fail", error }] } }),
      });
    }),
    Match.orElse((message): AcpInboundMessage => message)
  );

// An ACP request carries only JSON-RPC members. A typed RPC call also has effect trace ids and
// headers, which a strict peer rejects as unknown members and which would leak internal span ids.
const toAcpWireRequest: (message: AcpWireMessage) => AcpWireMessage = Match.type<AcpWireMessage>().pipe(
  Match.tag(
    "Request",
    ({ id, isNotification, payload, tag }): AcpWireMessage => ({
      _tag: "Request",
      headers: [],
      id,
      payload,
      tag,
      ...O.getSomesStruct({ isNotification: O.fromUndefinedOr(isNotification) }),
    })
  ),
  Match.orElse((message): AcpWireMessage => message)
);

/**
 * Builds the patched ACP protocol over an ACP `Stdio` transport.
 *
 * **Details**
 *
 * - After the connection ends, every send, request and notification fails at once with the
 *   terminal error, pending extension requests fail with it, and running extension request
 *   handlers are interrupted. `terminationError` classifies the end; a classification still
 *   running after 5 seconds (a peer that closed stdout but has not exited) falls back to
 *   `AcpInputStreamEndedError`. A broken pipe (an output writer failure, or an input stream
 *   failure that is not already an `AcpError`) is classified the same way: a reported process
 *   exit wins, so a child that exits ends the connection with its exit status whichever pipe
 *   noticed first; otherwise the pipe's `AcpTransportError` stands.
 * - A response acknowledges only after its bytes reach stdout; a writer failure fails every
 *   current, queued and future response and ends the connection. A send still waiting for room in
 *   the full output queue fails with the writer's error.
 * - An undecodable `session/update` or elicitation-complete notification is logged with
 *   structural diagnostics only and dropped; the connection keeps reading. Each distinct failure
 *   (array indices folded together) is warned about once, for at most 64 kinds per connection.
 * - Failing or dying notification handlers are isolated. A dying extension request handler is
 *   answered with an internal error.
 * - Notification handlers start one at a time in arrival order, and the reader waits for each one
 *   before it routes the next message, so a response never overtakes the notifications sent
 *   before it. A handler that sends a request on the same connection releases the reader at that
 *   point, because only the reader can deliver the response; the handler then finishes in the
 *   background, concurrently with later handlers. At most 64 handlers wait on the peer like this;
 *   past that, the handler's request fails with an `AcpTransportError`. A handler must not wait
 *   for a later inbound message any other way.
 * - Inbound extension requests run on their own fibers, so a handler may await an outbound
 *   request on the same connection. At most 64 run at once; a request beyond that is answered at
 *   once with an internal error (`-32603`) and the reader keeps reading.
 * - A typed request the RPC server rejects, such as one that reuses an in-flight id, is logged
 *   and skipped; the server keeps answering later requests.
 * - Outbound requests carry only JSON-RPC members (`jsonrpc`, `method`, `params`, `id`): effect
 *   trace ids and headers stay in-process. Outbound `@effect/rpc/Interrupt` messages are dropped;
 *   ACP has no such method.
 * - A peer error response fails only the request with its id, as an `AcpRequestError`. An error
 *   object tagged `Defect` is not read as an effect-rpc defect, which would fail every in-flight
 *   typed call. A response with no id, `id: null`, or no request in flight for its id is dropped
 *   with a warning that carries its id, error code and message. This includes ids never issued,
 *   typed requests already answered by an `Exit` or interrupted locally, and cancelled extension
 *   requests. Chunks keep a typed request in flight.
 *
 * **Example** (Build protocol over stdio)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as Stdio from "effect/Stdio";
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
  const encoder = parserFactory.makeUnsafe();
  // Inbound frames bypass the effect ndjson parser: `JSON.parse` on V8 12.8 through 13.7 (Node 24,
  // Electron 36 and 37) resolves an escaped object key through an existing map transition whenever
  // the raw source prefix matches it, turning `_meta` keys such as "\n" into "\\". The package
  // reader keeps native parsing for texts without escaped keys and reads the rest strictly.
  const decodeFrames = makeNdJsonRpcFrameDecoder();
  const serverQueue = yield* Queue.bounded<RpcMessage.FromClientEncoded>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const clientQueue = yield* Queue.bounded<RpcMessage.FromServerEncoded>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const notificationQueue = yield* Queue.sliding<AcpIncomingNotification>(ACP_PROTOCOL_NOTIFICATION_CAPACITY);
  const disconnects = yield* Queue.bounded<number>(ACP_PROTOCOL_DISCONNECT_QUEUE_CAPACITY);
  const outgoing = yield* Queue.bounded<AcpOutgoingWrite, AcpError.AcpError | Cause.Done>(ACP_PROTOCOL_QUEUE_CAPACITY);
  const writerState = yield* Ref.make<AcpOutgoingWriterState>({
    intentionalEnd: false,
    outstandingAcknowledgements: HashSet.empty(),
    terminalError: O.none(),
  });
  const nextRequestId = yield* Ref.make(1);
  const warnedDecodeFailures = MutableHashSet.empty<string>();
  const terminationHandled = yield* Ref.make(false);
  const terminationFailure = yield* Deferred.make<never, AcpError.AcpError>();
  // Keyed by the raw JSON-RPC id: HashMap equality keeps the number 1 and the string "1" apart.
  const extPending = yield* Ref.make(HashMap.empty<AcpError.AcpRequestId, AcpPendingRequest>());
  const rpcPending = yield* Ref.make(HashSet.empty<AcpError.AcpRequestId>());
  const extRequestFibers = yield* FiberSet.make<void>();
  const extRequestPermits = yield* Semaphore.make(ACP_PROTOCOL_EXT_REQUEST_CONCURRENCY);
  const notificationHandlerFibers = yield* FiberSet.make<void>();
  const detachedNotificationHandlers = yield* Semaphore.make(ACP_PROTOCOL_DETACHED_NOTIFICATION_HANDLERS);
  const connection = Symbol($I`connection`);

  const ensureActive = Ref.get(terminationHandled).pipe(
    Effect.flatMap((terminated) => (terminated ? Deferred.await(terminationFailure) : Effect.void))
  );

  const logProtocol = Effect.fn($I`logProtocol`)((event: AcpProtocolLogEvent) => {
    const emit = () =>
      options.logger?.(event) ?? Effect.logDebug("ACP protocol event").pipe(Effect.annotateLogs({ event }));
    return AcpProtocolLogEvent.match(event, {
      incoming: () => (options.logIncoming === true ? emit() : Effect.void),
      outgoing: () => (options.logOutgoing === true ? emit() : Effect.void),
    });
  });

  // --- Outgoing writer --------------------------------------------------------------------------

  const removeAcknowledgement = (acknowledgement: AcpAcknowledgement) =>
    Ref.update(writerState, (state) => ({
      ...state,
      outstandingAcknowledgements: HashSet.remove(state.outstandingAcknowledgements, acknowledgement),
    }));

  // Admission is atomic with the writer's terminal state, so a response admitted while the writer
  // closes is failed together with the rest instead of waiting forever for an acknowledgement.
  const admitOutgoing = (acknowledgement: O.Option<AcpAcknowledgement>) =>
    Ref.modify(writerState, (state): readonly [O.Option<AcpError.AcpError>, AcpOutgoingWriterState] =>
      O.isSome(state.terminalError)
        ? [state.terminalError, state]
        : [
            O.none(),
            O.match(acknowledgement, {
              onNone: () => state,
              onSome: (pending) => ({
                ...state,
                outstandingAcknowledgements: HashSet.add(state.outstandingAcknowledgements, pending),
              }),
            }),
          ]
    ).pipe(Effect.flatMap(O.match({ onNone: () => Effect.void, onSome: Effect.fail })));

  // A rejected offer reports the writer's terminal error when there is one, so a send that waited
  // for room in the full queue fails like every other send after a writer failure.
  const rejectedWriteError = Ref.get(writerState).pipe(
    Effect.flatMap(({ terminalError }) =>
      Effect.fail(
        O.getOrElse(terminalError, () =>
          AcpError.AcpTransportError.make({
            detail: O.some("The ACP output queue was closed before accepting a message"),
          })
        )
      )
    )
  );

  const enqueueOutgoing = Effect.fn($I`enqueueOutgoing`)((write: AcpOutgoingWrite) =>
    Queue.offer(outgoing, write).pipe(
      Effect.flatMap((accepted) => (accepted ? Effect.void : rejectedWriteError)),
      Effect.tapError((error) =>
        O.match(write.acknowledgement, {
          onNone: () => Effect.void,
          onSome: (acknowledgement) =>
            removeAcknowledgement(acknowledgement).pipe(Effect.andThen(Deferred.fail(acknowledgement, error))),
        })
      ),
      Effect.asVoid
    )
  );

  // A notification handler that sends a request awaits a response only this connection's reader
  // can deliver, so the reader stops waiting for that handler, which then holds a detached slot
  // until it finishes.
  const detachNotificationHandler = Effect.fnUntraced(function* (dispatch: AcpNotificationDispatch, method: string) {
    if (yield* Deferred.isDone(dispatch.readerReleased)) {
      return;
    }
    if (!(yield* Semaphore.takeIfAvailable(detachedNotificationHandlers, 1))) {
      return yield* AcpError.AcpTransportError.make({
        detail: O.some("Too many ACP notification handlers are already waiting for the peer"),
        method: O.some(method),
      });
    }
    // Another fiber of the same handler, or the handler's own completion, may have released the
    // reader first; the slot then goes back at once.
    if (!(yield* Deferred.succeed(dispatch.readerReleased, undefined))) {
      yield* Semaphore.release(detachedNotificationHandlers, 1);
    }
  });

  const releaseNotificationReader = (method: string) =>
    Effect.flatMap(
      Effect.service(CurrentNotificationDispatch),
      O.match({
        onNone: () => Effect.void,
        onSome: (dispatch) =>
          dispatch.connection === connection ? detachNotificationHandler(dispatch, method) : Effect.void,
      })
    );

  // Encodes one outbound message; `none` when the encoder produced nothing to write.
  const encodeOutgoing = Effect.fn($I`encodeOutgoing`)(function* (message: AcpWireMessage) {
    const encoded = yield* Effect.try({
      try: () => encoder.encode(message),
      catch: (cause) =>
        AcpError.AcpProtocolParseError.fromEncodingError(
          O.getOrUndefined(outgoingMethodOf(message)),
          O.getOrUndefined(outgoingRequestIdOf(message)),
          cause
        ),
    });
    if (encoded === undefined || (P.isString(encoded) && encoded.length === 0)) {
      return O.none<string | Uint8Array>();
    }
    if (options.logOutgoing === true) {
      yield* logProtocol({ direction: "outgoing", payload: textFromWire(encoded), stage: "raw" });
    }
    return O.some(encoded);
  });

  // Hands an encoded message to the writer; a response waits for the writer's acknowledgement.
  const writeOutgoing = Effect.fn($I`writeOutgoing`)(function* (message: AcpWireMessage, encoded: string | Uint8Array) {
    yield* ensureActive;
    const acknowledgement =
      message._tag === "Exit" ? O.some(yield* Deferred.make<void, AcpError.AcpError>()) : O.none<AcpAcknowledgement>();
    yield* admitOutgoing(acknowledgement);
    if (options.testHooks?.onOutgoingWriteAdmitted !== undefined) {
      yield* options.testHooks.onOutgoingWriteAdmitted();
    }
    yield* enqueueOutgoing({ acknowledgement, payload: encoded });
    if (O.isSome(acknowledgement)) {
      yield* Deferred.await(acknowledgement.value);
    }
    if (message._tag === "Exit" && options.onOutgoingResponse !== undefined) {
      yield* options.onOutgoingResponse(message.requestId);
    }
  });

  const offerOutgoing = Effect.fn($I`offerOutgoing`)(function* (outbound: AcpWireMessage) {
    // RpcClient emits `@effect/rpc/Interrupt` when a pending typed call is interrupted. ACP has no
    // such method and agents log it as an error, so it never reaches the wire.
    if (outbound._tag === "Interrupt") {
      return;
    }
    if (outbound._tag === "Request") {
      yield* releaseNotificationReader(outbound.tag);
    }
    const message = toAcpWireRequest(outbound);
    yield* ensureActive;
    yield* logProtocol({ direction: "outgoing", payload: message, stage: "decoded" });
    const encoded = yield* encodeOutgoing(message);
    if (O.isSome(encoded)) {
      yield* writeOutgoing(message, encoded.value);
    }
  });

  // --- Extension request bookkeeping ------------------------------------------------------------

  const resolveExtPending = (
    requestId: AcpError.AcpRequestId,
    onFound: (pending: AcpPendingRequest) => Effect.Effect<void>
  ) =>
    Ref.modify(extPending, (pending) =>
      O.match(HashMap.get(pending, requestId), {
        onNone: () => [Effect.void, pending] as const,
        onSome: (found) => [onFound(found), HashMap.remove(pending, requestId)] as const,
      })
    ).pipe(Effect.flatten);

  const removeExtPending = (requestId: AcpError.AcpRequestId) =>
    Ref.update(extPending, (pending) => HashMap.remove(pending, requestId));

  const completeExtPendingFailure = (requestId: AcpError.AcpRequestId, error: AcpError.AcpError) =>
    resolveExtPending(requestId, ({ deferred }) => Deferred.fail(deferred, error).pipe(Effect.asVoid));

  const completeExtPendingSuccess = (requestId: AcpError.AcpRequestId, value: unknown) =>
    resolveExtPending(requestId, ({ deferred }) => Deferred.succeed(deferred, value).pipe(Effect.asVoid));

  const failAllExtPending = (error: AcpError.AcpError) =>
    Ref.getAndSet(extPending, HashMap.empty()).pipe(
      Effect.flatMap((pending) =>
        Effect.forEach(HashMap.values(pending), ({ deferred }) => Deferred.fail(deferred, error), {
          discard: true,
        })
      )
    );

  // --- Termination ------------------------------------------------------------------------------

  const emitClientProtocolError = (error: AcpError.AcpError) =>
    Queue.offer(clientQueue, {
      _tag: "ClientProtocolError",
      error: RpcClientError.RpcClientError.make({
        reason: RpcClientError.RpcClientDefect.make({
          cause: error,
          message: "ACP protocol terminated.",
        }),
      }),
    }).pipe(Effect.asVoid);

  const classifyTermination = (classification: Effect.Effect<AcpError.AcpError>, fallback: AcpError.AcpError) =>
    Queue.offer(disconnects, ACP_STDIO_CLIENT_ID).pipe(
      Effect.andThen(classification),
      Effect.timeoutOrElse({
        duration: ACP_PROTOCOL_TERMINATION_CLASSIFICATION_TIMEOUT,
        orElse: () => Effect.succeed(fallback),
      })
    );

  const reportTermination = Effect.fnUntraced(function* (error: AcpError.AcpError) {
    // Typed handlers stop through `disconnects`; extension handlers stop here.
    yield* FiberSet.clear(extRequestFibers);
    yield* emitClientProtocolError(error);
    if (options.onTermination !== undefined) {
      yield* options.onTermination(error);
    }
  });

  const handleTermination = Effect.fn($I`handleTermination`)(function* (
    classification: Effect.Effect<AcpError.AcpError>,
    fallback: AcpError.AcpError = AcpError.AcpInputStreamEndedError.make({})
  ) {
    const first = yield* Ref.modify(terminationHandled, (handled) => [!handled, true] as const);
    if (!first) {
      return;
    }
    // Every later send waits on `terminationFailure`, so it settles even when this fiber is
    // interrupted while classifying; the fallback (the plain ended-input error, or the transport
    // failure that ended the connection) then stands in.
    yield* Effect.uninterruptibleMask((restore) =>
      restore(classifyTermination(classification, fallback)).pipe(
        Effect.exit,
        Effect.map(
          Exit.match({
            onFailure: () => fallback,
            onSuccess: (error): AcpError.AcpError => error,
          })
        ),
        Effect.tap((error) => Deferred.fail(terminationFailure, error).pipe(Effect.andThen(failAllExtPending(error)))),
        Effect.flatMap((error) => restore(reportTermination(error)))
      )
    );
  });

  // A child's pipes break when it exits, so the writer's stdin sink and the reader's stdout stream
  // can fail before the ended stdout reports the exit status, and the first of them ends the
  // connection. With a classifier, such a pipe failure therefore resolves to the peer's exit when
  // the classifier reports one, so the terminal error does not depend on which side noticed first.
  // Any other classification, and a classification past the timeout, keep the pipe failure.
  const terminateWithPipeFailure = (failure: AcpError.AcpTransportError) =>
    handleTermination(
      O.match(O.fromUndefinedOr(options.terminationError), {
        onNone: () => Effect.succeed<AcpError.AcpError>(failure),
        onSome: Effect.map((classified): AcpError.AcpError => (isProcessExited(classified) ? classified : failure)),
      }),
      failure
    );

  // --- Responses --------------------------------------------------------------------------------

  const respondWithSuccess = (requestId: AcpError.AcpRequestId, value: unknown) =>
    offerOutgoing({
      _tag: "Exit",
      exit: { _tag: "Success", value },
      requestId,
    });

  const respondWithError = (requestId: AcpError.AcpRequestId, error: AcpError.AcpRequestError) =>
    offerOutgoing({
      _tag: "Exit",
      exit: { _tag: "Failure", cause: [{ _tag: "Fail", error: error.toProtocolError() }] },
      requestId,
    });

  const answerExtensionHandlerFailure = (message: RpcMessage.RequestEncoded, cause: Cause.Cause<AcpError.AcpError>) =>
    // A defect wins over a typed failure: the handler is broken, so the peer gets a generic error.
    O.match(Cause.hasDies(cause) ? O.none() : Cause.findErrorOption(cause), {
      onNone: () =>
        Effect.logError(`ACP extension request handler failed for '${message.tag}'`, cause).pipe(
          Effect.andThen(
            respondWithError(
              message.id,
              AcpError.AcpRequestError.internalError(
                `ACP extension request handler failed for method '${message.tag}'`,
                undefined,
                AcpError.AcpRequestDiagnostics.make({
                  cause: cause.pipe(Cause.squash, O.some),
                  method: O.some(message.tag),
                  operation: O.some("handle-extension-request"),
                })
              )
            )
          )
        ),
      onSome: (error) =>
        respondWithError(message.id, AcpError.AcpRequestError.fromExtensionHandlerError(error, message.tag)),
    });

  const handleExtRequest = Effect.fn($I`handleExtRequest`)((message: RpcMessage.RequestEncoded) =>
    options.onExtRequest === undefined
      ? respondWithError(message.id, AcpError.AcpRequestError.methodNotFound(message.tag))
      : options
          .onExtRequest(
            message.tag,
            message.payload,
            AcpRequestContext.make({ method: message.tag, requestId: message.id })
          )
          .pipe(
            Effect.matchCauseEffect({
              onFailure: (cause) => answerExtensionHandlerFailure(message, cause),
              onSuccess: (value) => respondWithSuccess(message.id, value),
            })
          )
  );

  const answerExtRequest = (message: RpcMessage.RequestEncoded) =>
    handleExtRequest(message).pipe(
      Effect.catchTag("AcpProtocolParseError", (error) =>
        Effect.logWarning(error).pipe(
          Effect.annotateLogs({ method: message.tag, operation: error.operation, requestId: message.id }),
          Effect.andThen(
            respondWithError(
              message.id,
              AcpError.AcpRequestError.fromExtensionResponseEncodingError(message.tag, message.id, error)
            )
          )
        )
      ),
      // The response could not be delivered because the connection ended; termination already
      // reported that to every observer.
      Effect.catchCause((cause) => Effect.logDebug("ACP extension response was not delivered", cause))
    );

  // Answered on the reader: the response only waits for the writer, never for the reader.
  const rejectSaturatedExtRequest = (message: RpcMessage.RequestEncoded) =>
    Effect.logWarning("Rejected an ACP extension request: too many are already running").pipe(
      Effect.annotateLogs({
        limit: ACP_PROTOCOL_EXT_REQUEST_CONCURRENCY,
        method: message.tag,
        requestId: message.id,
      }),
      Effect.andThen(
        respondWithError(
          message.id,
          AcpError.AcpRequestError.internalError(
            "Too many concurrent ACP extension requests",
            undefined,
            AcpError.AcpRequestDiagnostics.make({
              method: O.some(message.tag),
              operation: O.some("handle-extension-request"),
              requestId: O.some(message.id),
            })
          )
        )
      ),
      Effect.catchCause((cause) => Effect.logDebug("ACP extension response was not delivered", cause))
    );

  // The reader never waits for a permit. Permits come back only when running handlers finish, and
  // a handler that awaits an outbound request needs the reader to deliver its response.
  const forkExtRequest = Effect.fn($I`forkExtRequest`)(function* (message: RpcMessage.RequestEncoded) {
    if (!(yield* Semaphore.takeIfAvailable(extRequestPermits, 1))) {
      return yield* rejectSaturatedExtRequest(message);
    }
    yield* answerExtRequest(message).pipe(
      Effect.ensuring(Semaphore.release(extRequestPermits, 1)),
      FiberSet.run(extRequestFibers)
    );
  });

  // --- Incoming notifications -------------------------------------------------------------------

  // The handler runs on its own fiber and the reader waits until it finishes or sends a request on
  // this connection (`detachNotificationHandler`). Handlers therefore start in arrival order, and a
  // handler that needs the reader to deliver a response never blocks it.
  const runNotificationHandler = Effect.fnUntraced(function* (handler: Effect.Effect<void, AcpError.AcpError>) {
    const readerReleased = yield* Deferred.make<void>();
    yield* handler.pipe(
      // A failing or dying handler must not stop the reader, or every later message on the
      // connection goes unanswered.
      isolateNotificationHandler,
      Effect.provideService(CurrentNotificationDispatch, O.some({ connection, readerReleased })),
      Effect.ensuring(
        Deferred.succeed(readerReleased, undefined).pipe(
          // Already released: the handler had detached, so its slot goes back.
          Effect.flatMap((completedHere) =>
            completedHere ? Effect.void : Semaphore.release(detachedNotificationHandlers, 1)
          )
        )
      ),
      FiberSet.run(notificationHandlerFibers)
    );
    yield* Deferred.await(readerReleased);
  });

  const dispatchNotification = (notification: AcpIncomingNotification) =>
    Queue.offer(notificationQueue, notification).pipe(
      Effect.andThen(
        O.match(O.fromUndefinedOr(options.onNotification), {
          onNone: () => Effect.void,
          // Suspended, so a handler that throws while building its effect dies on its own fiber.
          onSome: (onNotification) => runNotificationHandler(Effect.suspend(() => onNotification(notification))),
        })
      ),
      Effect.asVoid
    );

  const markDecodeFailureWarned = (key: string) =>
    Effect.sync(() => {
      if (
        MutableHashSet.has(warnedDecodeFailures, key) ||
        MutableHashSet.size(warnedDecodeFailures) >= ACP_PROTOCOL_DECODE_WARNING_KINDS
      ) {
        return false;
      }
      MutableHashSet.add(warnedDecodeFailures, key);
      return true;
    });

  const decodeFailureKind = (method: string, issueSummary: O.Option<string>) =>
    `${method}\n${pipe(
      issueSummary,
      O.getOrElse(() => ""),
      Str.replaceAll(DECODE_FAILURE_INDEX_SEGMENT, "*")
    )}`;

  // A notification has no reply to fail, so one the schema rejects is logged and dropped. Ending
  // the connection over it would kill a working session because one update, possibly from a newer
  // spec, did not parse. An agent repeats a bad shape on every update, so each distinct failure is
  // warned about once per connection, up to a bounded number of kinds.
  const dropUndecodableNotification = (method: string) => (cause: S.SchemaError) => {
    const error = AcpError.AcpProtocolParseError.fromSchemaError("decode-notification-payload", method, cause);
    const diagnostics = decodeFailureDiagnostics(error);
    return logProtocol({ direction: "incoming", payload: diagnostics, stage: "decode_failed" }).pipe(
      Effect.andThen(markDecodeFailureWarned(decodeFailureKind(method, error.issueSummary))),
      Effect.flatMap((firstOfItsKind) =>
        firstOfItsKind
          ? Effect.logWarning("Dropped an ACP notification that failed to decode").pipe(
              Effect.annotateLogs(diagnostics)
            )
          : Effect.void
      )
    );
  };

  const dispatchSessionUpdate = (params: AcpSessionUpdateParams) =>
    dispatchNotification({
      _tag: "SessionUpdate",
      method: CLIENT_METHODS.session_update,
      params: options.transformSessionUpdate === undefined ? params : options.transformSessionUpdate(params),
    });

  const salvageIdleStateUpdate = (payload: unknown, cause: S.SchemaError) =>
    isIdleStateUpdateEnvelope(payload)
      ? decodeSessionUpdate(withoutUnstableIdleFields(payload)).pipe(
          Effect.matchEffect({
            onFailure: () => dropUndecodableNotification(CLIENT_METHODS.session_update)(cause),
            onSuccess: (params) =>
              Effect.logWarning("Kept an ACP idle state_update without its undecodable usage or error").pipe(
                Effect.andThen(dispatchSessionUpdate(params))
              ),
          })
        )
      : dropUndecodableNotification(CLIENT_METHODS.session_update)(cause);

  const handleIncomingNotification = (message: RpcMessage.RequestEncoded) => {
    if (message.tag === CLIENT_METHODS.session_update) {
      return decodeSessionUpdate(message.payload).pipe(
        Effect.matchEffect({
          onFailure: (cause) => salvageIdleStateUpdate(message.payload, cause),
          onSuccess: dispatchSessionUpdate,
        })
      );
    }
    const method = message.tag;
    if (isElicitationCompleteMethod(method)) {
      return decodeElicitationComplete(message.payload).pipe(
        Effect.matchEffect({
          onFailure: dropUndecodableNotification(method),
          onSuccess: (params) => dispatchNotification({ _tag: "ElicitationComplete", method, params }),
        })
      );
    }
    return dispatchNotification({ _tag: "ExtNotification", method, params: message.payload });
  };

  // --- Inbound routing --------------------------------------------------------------------------

  const handleRequestEncoded = Effect.fn($I`handleRequestEncoded`)((message: RpcMessage.RequestEncoded) => {
    if (message.id === "") {
      return handleIncomingNotification(message);
    }
    const observeIncoming =
      options.onIncomingRequest === undefined
        ? Effect.void
        : options.onIncomingRequest(message.id, message.tag, message.payload);
    return observeIncoming.pipe(
      Effect.andThen(
        HashSet.has(options.serverRequestMethods, message.tag)
          ? Queue.offer(serverQueue, message).pipe(Effect.asVoid)
          : forkExtRequest(message)
      )
    );
  });

  // A response with no id, `id: null`, or no request in flight for its id is dropped with a warning.
  // This includes ids never issued, typed requests already answered by an `Exit` or interrupted
  // locally, and cancelled extension requests. Chunks keep a typed request in flight. The warning
  // also leaves a trace when the peer answers without a usable id (for example, a parse-error reply).
  const forwardToRpcClient = Effect.fn($I`forwardToRpcClient`)(function* (message: AcpInboundResponse) {
    const claimed = yield* Ref.modify(rpcPending, (pending) => [
      isEffectRpcRequestId(message.requestId) && HashSet.has(pending, message.requestId),
      message._tag === "Exit" && P.isNumber(message.requestId) ? HashSet.remove(pending, message.requestId) : pending,
    ]);
    if (claimed) {
      yield* Queue.offer(clientQueue, message);
    } else {
      yield* Effect.logWarning("Dropped an ACP response that matches no outstanding request").pipe(
        Effect.annotateLogs(uncorrelatedResponseAnnotations(message))
      );
    }
  });

  const settlePendingExit = (message: RpcMessage.ResponseExitEncoded, pending: AcpPendingRequest) =>
    Match.value(message.exit).pipe(
      Match.tag("Success", (exit) => completeExtPendingSuccess(message.requestId, exit.value)),
      Match.tag("Failure", (exit) =>
        completeExtPendingFailure(
          message.requestId,
          O.match(protocolFailureOfCause(exit.cause), {
            onNone: () =>
              AcpError.AcpRequestError.fromExtensionResponseFailure(pending.method, message.requestId, exit.cause),
            onSome: (error) =>
              AcpError.AcpRequestError.fromProtocolError(
                error,
                AcpError.AcpRequestDiagnostics.make({
                  cause: O.some(exit.cause),
                  method: O.some(pending.method),
                  requestId: O.some(message.requestId),
                })
              ),
          })
        )
      ),
      Match.exhaustive
    );

  const handleExitEncoded = Effect.fn($I`handleExitEncoded`)((message: RpcMessage.ResponseExitEncoded) =>
    Ref.get(extPending).pipe(
      Effect.flatMap((pending) =>
        O.match(HashMap.get(pending, message.requestId), {
          onNone: () => forwardToRpcClient(message),
          onSome: (found) => settlePendingExit(message, found),
        })
      )
    )
  );

  const handleChunkEncoded = Effect.fn($I`handleChunkEncoded`)((message: RpcMessage.ResponseChunkEncoded) =>
    Ref.get(extPending).pipe(
      Effect.flatMap((pending) =>
        O.match(HashMap.get(pending, message.requestId), {
          onNone: () => forwardToRpcClient(message),
          onSome: ({ method }) =>
            completeExtPendingFailure(
              message.requestId,
              AcpError.AcpRequestError.unsupportedStreamingResponse(method, message.requestId)
            ),
        })
      )
    )
  );

  // ACP has no effect-rpc control plane, so a peer frame decodes only to a request, a chunk or an
  // exit. A peer `Eof` would end our writer, an `Interrupt` would stop a typed handler, and a
  // `Defect` would fail every in-flight typed call; none of them can reach the RPC server or client.
  const routeDecodedMessage: (message: AcpInboundMessage) => Effect.Effect<void, AcpError.AcpError> =
    Match.type<AcpInboundMessage>().pipe(
      Match.tag("Request", handleRequestEncoded),
      Match.tag("Exit", handleExitEncoded),
      Match.tag("Chunk", handleChunkEncoded),
      Match.exhaustive
    );

  // --- Reader -----------------------------------------------------------------------------------

  const readChunk = (data: Uint8Array) =>
    (options.logIncoming === true
      ? logProtocol({ direction: "incoming", payload: textFromWire(data), stage: "raw" })
      : Effect.void
    ).pipe(
      Effect.andThen(
        Effect.fromResult(decodeFrames(data)).pipe(
          Effect.mapBoth({
            onFailure: (cause) =>
              AcpError.AcpProtocolParseError.make({ cause: O.some(cause), operation: "decode-wire-message" }),
            onSuccess: A.map(normalizeAcpJsonRpcError),
          })
        )
      ),
      Effect.tap((messages) => logProtocol({ direction: "incoming", payload: messages, stage: "decoded" })),
      Effect.tapErrorTag("AcpProtocolParseError", (error) =>
        logProtocol({ direction: "incoming", payload: decodeFailureDiagnostics(error), stage: "decode_failed" })
      ),
      Effect.flatMap((messages) => Effect.forEach(messages, routeDecodedMessage, { discard: true }))
    );

  // An AcpError (one a stdout transform raised, for instance) ends the connection as it is; any
  // other failure is a broken stdout pipe, which the peer's exit may explain.
  const terminateReader = (cause: Cause.Cause<unknown>) => {
    const failure = O.getOrElse(Cause.findErrorOption(cause), () => Cause.squash(cause));
    return isAcpError(failure)
      ? failure.pipe(Effect.succeed, handleTermination)
      : terminateWithPipeFailure(
          AcpError.AcpTransportError.make({ cause: O.some(failure), operation: O.some("read-input-stream") })
        );
  };

  yield* options.stdio.stdin.pipe(
    Stream.runForEach(readChunk),
    // Anything that ends the reader, including a defect in a callback it runs, terminates the
    // connection so pending requests fail instead of hanging.
    Effect.matchCauseEffect({
      onFailure: terminateReader,
      onSuccess: () =>
        handleTermination(options.terminationError ?? Effect.succeed(AcpError.AcpInputStreamEndedError.make({}))),
    }),
    Effect.forkScoped
  );

  // --- Writer -----------------------------------------------------------------------------------

  const failOutgoingWrites = (error: AcpError.AcpError) =>
    Ref.modify(writerState, (state) => {
      const terminalError = O.getOrElse(state.terminalError, () => error);
      return [
        Tuple.make(terminalError, state.outstandingAcknowledgements),
        { ...state, outstandingAcknowledgements: HashSet.empty(), terminalError: O.some(terminalError) },
      ] as const;
    }).pipe(
      Effect.flatMap(([terminalError, acknowledgements]) =>
        Effect.forEach(acknowledgements, (acknowledgement) => Deferred.fail(acknowledgement, terminalError), {
          concurrency: "unbounded",
          discard: true,
        })
      ),
      Effect.andThen(Queue.fail(outgoing, error)),
      // A failed queue stays open for draining, and senders parked on it would wait forever for a
      // writer that is gone. Shutting it down resumes them with a rejected offer, which
      // `enqueueOutgoing` reports as the writer's terminal error.
      Effect.andThen(Queue.shutdown(outgoing)),
      Effect.asVoid
    );

  const completeOutgoingWrites = Ref.getAndUpdate(writerState, (state) => ({
    ...state,
    outstandingAcknowledgements: HashSet.empty<AcpAcknowledgement>(),
  })).pipe(
    Effect.flatMap(({ outstandingAcknowledgements }) =>
      Effect.forEach(outstandingAcknowledgements, (acknowledgement) => Deferred.succeed(acknowledgement, undefined), {
        concurrency: "unbounded",
        discard: true,
      })
    )
  );

  const acknowledgeOutgoingWrite = (acknowledgement: AcpAcknowledgement) =>
    removeAcknowledgement(acknowledgement).pipe(
      Effect.andThen(Deferred.succeed(acknowledgement, undefined)),
      Effect.asVoid
    );

  const failWriter = (detail: string, cause: unknown, terminate: boolean) => {
    const error = AcpError.AcpTransportError.make({ cause: O.some(cause), detail: O.some(detail) });
    return failOutgoingWrites(error).pipe(Effect.andThen(terminate ? terminateWithPipeFailure(error) : Effect.void));
  };

  const handleWriterExit = (exit: Exit.Exit<void, unknown>) =>
    Exit.match(exit, {
      onFailure: (cause) =>
        Cause.hasInterruptsOnly(cause)
          ? failWriter("The ACP output writer was interrupted while closing", cause, false)
          : failWriter("Failed to write an outgoing ACP message", cause, true),
      onSuccess: () =>
        Ref.get(writerState).pipe(
          Effect.flatMap(({ intentionalEnd }) =>
            (intentionalEnd
              ? completeOutgoingWrites
              : failWriter("ACP output writer ended before the protocol closed", "Output writer ended", true)
            ).pipe(
              Effect.andThen(
                options.testHooks?.onOutgoingWriterExit === undefined
                  ? Effect.void
                  : options.testHooks.onOutgoingWriterExit(intentionalEnd)
              )
            )
          )
        ),
    });

  yield* Stream.fromQueue(outgoing).pipe(
    Stream.flatMap((write) =>
      Stream.make(write.payload).pipe(
        Stream.concat(
          O.match(write.acknowledgement, {
            onNone: () => Stream.empty,
            onSome: (acknowledgement) =>
              acknowledgement.pipe(acknowledgeOutgoingWrite, Stream.fromEffect, Stream.drain),
          })
        )
      )
    ),
    Stream.run(options.stdio.stdout()),
    Effect.onExit(handleWriterExit),
    Effect.forkScoped
  );

  // --- Protocols --------------------------------------------------------------------------------

  // Each run loop is the only consumer of its queue. A message the RPC server or client rejects
  // (RpcServer answers a request that reuses an in-flight id with an interrupt) must not end the
  // loop, or every later message goes unanswered and the full queue parks the reader.
  const skipRejectedMessage = (side: string, message: AcpWireMessage) => (cause: Cause.Cause<unknown>) =>
    Effect.logWarning(`The ACP RPC ${side} skipped an inbound message it rejected`, cause).pipe(
      Effect.annotateLogs({
        messageTag: message._tag,
        ...O.getSomesStruct({ method: outgoingMethodOf(message), requestId: outgoingRequestIdOf(message) }),
      })
    );

  const clientProtocol = RpcClient.Protocol.of({
    run: Effect.fn($I`AcpClient_Protocol_run`)((_clientId, f) =>
      Stream.fromQueue(clientQueue).pipe(
        Stream.runForEach((message) => f(message).pipe(Effect.catchCause(skipRejectedMessage("client", message)))),
        Effect.forever
      )
    ),
    send: Effect.fn($I`AcpClient_Protocol_send`)((_clientId, request) =>
      Effect.gen(function* () {
        if (request._tag === "Request") {
          yield* Ref.update(rpcPending, HashSet.add(request.id));
        } else if (request._tag === "Interrupt") {
          yield* Ref.update(rpcPending, HashSet.remove(request.requestId));
        }
        yield* offerOutgoing(request).pipe(
          Effect.onExit((exit) =>
            request._tag === "Request" && Exit.isFailure(exit)
              ? Ref.update(rpcPending, HashSet.remove(request.id))
              : Effect.void
          )
        );
      }).pipe(
        Effect.mapError((error) =>
          RpcClientError.RpcClientError.make({
            reason: RpcClientError.RpcClientDefect.make({
              cause: error,
              message: "Failed to send ACP protocol message.",
            }),
          })
        )
      )
    ),
    supportsAck: true,
    supportsTransferables: false,
    codecFor: parserFactory.codecFor,
  });

  const serverProtocol = RpcServer.Protocol.of({
    clientIds: Effect.succeed(ACP_STDIO_CLIENT_IDS),
    disconnects,
    end: Effect.fn($I`AcpServer_Protocol_end`)((_clientId) =>
      Ref.update(writerState, (state) => ({ ...state, intentionalEnd: true })).pipe(
        Effect.andThen(Queue.end(outgoing)),
        Effect.asVoid
      )
    ),
    initialMessage: Effect.succeedNone,
    run: Effect.fn($I`AcpServer_Protocol_run`)((f) =>
      Stream.fromQueue(serverQueue).pipe(
        Stream.runForEach((message) =>
          f(ACP_STDIO_CLIENT_ID, message).pipe(Effect.catchCause(skipRejectedMessage("server", message)))
        ),
        Effect.forever
      )
    ),
    send: Effect.fn($I`AcpServer_Protocol_send`)((_clientId, response) =>
      offerOutgoing(response).pipe(
        Effect.tapError((error) =>
          response._tag === "Exit" && options.onOutgoingResponseFailure !== undefined
            ? options.onOutgoingResponseFailure(response.requestId, error)
            : Effect.void
        ),
        Effect.orDie
      )
    ),
    supportsAck: true,
    supportsNotifications: true,
    supportsSpanPropagation: true,
    supportsTransferables: false,
    codecFor: parserFactory.codecFor,
  });

  // --- Raw requests and notifications -----------------------------------------------------------

  // JSON-RPC notifications carry no `id`. Encoding a Request without `isNotification` emits one,
  // which real agents (Grok CLI) read as a malformed request and silently drop.
  const sendNotificationEffect = Effect.fn($I`sendNotification`)(function* (method: string, payload: unknown) {
    yield* ensureActive;
    yield* logProtocol({
      direction: "outgoing",
      payload: { _tag: "Notification", payload, tag: method },
      stage: "decoded",
    });
    const encoded = yield* encodeJsonRpcNotification({ jsonrpc: "2.0", method, params: payload }).pipe(
      Effect.mapError((cause) => AcpError.AcpProtocolParseError.fromEncodingError(method, undefined, cause)),
      Effect.map((text) => `${text}\n`)
    );
    if (options.logOutgoing === true) {
      yield* logProtocol({ direction: "outgoing", payload: encoded, stage: "raw" });
    }
    yield* ensureActive;
    // FIFO queue admission keeps wire order: a session/prompt sent after session/cancel cannot
    // overtake it.
    yield* enqueueOutgoing({ acknowledgement: O.none(), payload: encoded });
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
    yield* ensureActive;
    const requestId = yield* Ref.getAndUpdate(nextRequestId, (current) => current + 1);
    const deferred = yield* Deferred.make<unknown, AcpError.AcpError>();
    // Every exit removes the pending entry, including an interruption while the request waits for
    // room in the output queue; a settled entry was already removed by the response.
    return yield* Effect.acquireUseRelease(
      Ref.update(extPending, (pending) => HashMap.set(pending, requestId, { deferred, method })),
      () =>
        offerOutgoing({
          _tag: "Request",
          headers: [],
          id: requestId,
          payload,
          tag: method,
        }).pipe(Effect.andThen(Deferred.await(deferred))),
      () => removeExtPending(requestId)
    );
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
