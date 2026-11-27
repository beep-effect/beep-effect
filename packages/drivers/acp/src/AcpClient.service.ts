/**
 * ACP client service and child-process layer constructors.
 *
 * **Details**
 *
 * The client speaks both ACP generations. By default it negotiates: `initialize` carries the
 * generation-2 fields and the generation-1 `clientCapabilities`/`clientInfo`, and the shape of the
 * reply (not its `protocolVersion`) decides the generation of the connection. Every agent method,
 * session update and peer request is projected onto the normalized `@beep/acp/compat` surface, so
 * callers see one shape whichever generation the agent speaks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as ErrorReporter from "effect/ErrorReporter";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableRef from "effect/MutableRef";
import * as Ref from "effect/Ref";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import { AGENT_METHODS, CLIENT_METHODS, V1_AGENT_METHODS, V1_CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import * as Compat from "./AcpCompat.models.ts";
import * as AcpProtocol from "./AcpProtocol.service.ts";
import * as AcpRpcs from "./AcpRpc.models.ts";
import * as AcpStderr from "./AcpStderr.models.ts";
import * as Normalize from "./internal/normalize.ts";
import {
  callRpc,
  dispatchExtRequest,
  isolateNotificationHandler,
  makeExtensionRegistrars,
  runHandler,
} from "./internal/shared.ts";
import { makeChildStdio, makeTerminationError } from "./internal/stdio.ts";
import type { LazyArg } from "effect/Function";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as RpcClientError from "effect/rpc/RpcClientError";
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";
import type * as V2 from "./_generated/schema.gen.ts";
import type { ExtNotificationHandler, ExtRequestHandler } from "./internal/shared.ts";

const $I = $AcpId.create("client");
const ACP_CLIENT_PENDING_NOTIFICATION_CAPACITY = 256;

/**
 * Builds the typed ACP process-exit error used by child-process transports.
 *
 * **Example** (Make termination error)
 *
 * ```ts
 * import { makeTerminationError } from "@beep/acp/client"
 * import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
 * const toTerminationError = (handle: ChildProcessSpawner.ChildProcessHandle) => makeTerminationError(handle)
 * console.log(toTerminationError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export { makeTerminationError } from "./internal/stdio.ts";

const AcpClientProtocolGenerationBase = LiteralKit(["negotiate", "v1", "v2"]);

/**
 * **Details**
 *
 * - `negotiate` (the default) sends an initialize request both generations understand and takes
 *   the generation from the shape of the reply.
 * - `v1` sends a pure generation-1 initialize (`protocolVersion: 1`) and fixes generation 1.
 * - `v2` sends a pure generation-2 initialize and fixes generation 2.
 *
 * **Example** (Check a generation mode)
 *
 * ```ts
 * import { AcpClientProtocolGeneration } from "@beep/acp/client"
 *
 * console.log(AcpClientProtocolGeneration.is.v1("v1")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AcpClientProtocolGeneration = AcpClientProtocolGenerationBase.pipe(
  $I.annoteSchema("AcpClientProtocolGeneration", {
    description: "How the ACP client picks the protocol generation of a connection.",
  }),
  SchemaUtils.withLiteralKitStatics(AcpClientProtocolGenerationBase)
);

/**
 * **Example** (Pin generation 1)
 *
 * ```ts
 * import type { AcpClientProtocolGeneration } from "@beep/acp/client"
 *
 * const mode: AcpClientProtocolGeneration = "v1"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AcpClientProtocolGeneration = typeof AcpClientProtocolGeneration.Type;

type AcpProtocolLoggingFields = typeof AcpProtocol.AcpProtocolLoggingOptions.Encoded;

/**
 * Options for constructing an ACP client service.
 *
 * **Details**
 *
 * - `protocolGeneration` picks negotiation or a pinned generation; it defaults to `negotiate`.
 * - `transformStdout` rewrites the child's stdout before parsing (child-process layer only), for
 *   example to strip a startup banner. A failure in it ends the connection with that error.
 * - `transformSessionUpdate` rewrites each normalized `session/update` before it reaches
 *   `raw.notifications` and the session-update handlers.
 * - `onTermination` runs after pending prompts failed with the terminal error.
 * - `onIncomingRequest`, `onOutgoingResponse` and `onOutgoingResponseFailure` observe requests
 *   from the agent and the responses written to it.
 *
 * **Example** (Create client options)
 *
 * ```ts
 * import type { AcpClientOptions } from "@beep/acp/client"
 *
 * const options: AcpClientOptions = { logOutgoing: true, protocolGeneration: "v1" }
 * console.log(options.protocolGeneration)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpClientOptions extends AcpProtocolLoggingFields {
  readonly logger?: (event: AcpProtocol.AcpProtocolLogEvent) => Effect.Effect<void>;
  readonly onIncomingRequest?: AcpProtocol.AcpPatchedProtocolOptions["onIncomingRequest"];
  readonly onOutgoingResponse?: AcpProtocol.AcpPatchedProtocolOptions["onOutgoingResponse"];
  readonly onOutgoingResponseFailure?: AcpProtocol.AcpPatchedProtocolOptions["onOutgoingResponseFailure"];
  readonly onTermination?: AcpProtocol.AcpPatchedProtocolOptions["onTermination"];
  readonly protocolGeneration?: AcpClientProtocolGeneration;
  readonly transformSessionUpdate?: (notification: Compat.SessionNotification) => Compat.SessionNotification;
  readonly transformStdout?: (
    stdout: ChildProcessSpawner.ChildProcessHandle["stdout"]
  ) => AcpProtocol.AcpStdio["stdin"];
}

type AcpClientRaw = {
  readonly notifications: Stream.Stream<AcpProtocol.AcpIncomingNotification>;
  readonly request: AcpProtocol.AcpPatchedProtocol["request"];
  readonly notify: AcpProtocol.AcpPatchedProtocol["notify"];
};

type AcpResult<A> = Effect.Effect<A, AcpError.AcpError>;
type NotificationHandler<A> = (notification: A) => AcpResult<void>;
type Handler<Request, Response> = AcpProtocol.AcpRequestHandler<Request, Response>;

/**
 * Agent methods of the ACP client, typed against the normalized `@beep/acp/compat` surface.
 *
 * **Details**
 *
 * On a generation-1 connection `deleteSession` and the provider methods fail locally with
 * `methodNotFound`; on a generation-2 connection `setSessionModel` and `setSessionMode` do.
 * A generation-2 `prompt` resolves when the agent reports the idle `state_update` that ends the
 * turn, and a second prompt on the same session fails while one is running. A prompt block that
 * is a delivered `UnknownContent` is sent as the original block in its `raw`; one that carries no
 * content block fails locally with `invalidParams`.
 *
 * **Example** (Read the prompt method)
 *
 * ```ts
 * import type { AcpClientAgent } from "@beep/acp/client"
 *
 * const promptOf = (agent: AcpClientAgent) => agent.prompt
 * console.log(promptOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AcpClientAgent {
  readonly authenticate: (payload: Compat.AuthenticateRequest) => AcpResult<Compat.AuthenticateResponse>;
  readonly cancel: (payload: Compat.CancelNotification) => AcpResult<void>;
  readonly closeSession: (payload: Compat.CloseSessionRequest) => AcpResult<Compat.CloseSessionResponse>;
  readonly createSession: (payload: Compat.NewSessionRequest) => AcpResult<Compat.NewSessionResponse>;
  readonly deleteSession: (payload: Compat.DeleteSessionRequest) => AcpResult<Compat.DeleteSessionResponse>;
  readonly disableProvider: (payload: Compat.DisableProviderRequest) => AcpResult<Compat.DisableProviderResponse>;
  readonly forkSession: (payload: Compat.ForkSessionRequest) => AcpResult<Compat.ForkSessionResponse>;
  readonly initialize: (payload: Compat.InitializeRequest) => AcpResult<Compat.InitializeResponse>;
  readonly listProviders: (payload: Compat.ListProvidersRequest) => AcpResult<Compat.ListProvidersResponse>;
  readonly listSessions: (payload: Compat.ListSessionsRequest) => AcpResult<Compat.ListSessionsResponse>;
  /** Generation 1 `session/load`; generation 2 `session/resume` replaying from the start. */
  readonly loadSession: (payload: Compat.LoadSessionRequest) => AcpResult<Compat.LoadSessionResponse>;
  readonly logout: (payload: Compat.LogoutRequest) => AcpResult<Compat.LogoutResponse>;
  /** Sends an `mcp/message` notification, from the MCP server the client hosts, for an active request. */
  readonly notifyMcp: (payload: Compat.MessageMcpNotification) => AcpResult<void>;
  readonly prompt: (payload: Compat.PromptRequest) => AcpResult<Compat.PromptResponse>;
  readonly resumeSession: (payload: Compat.ResumeSessionRequest) => AcpResult<Compat.ResumeSessionResponse>;
  readonly setProvider: (payload: Compat.SetProviderRequest) => AcpResult<Compat.SetProviderResponse>;
  readonly setSessionConfigOption: (
    payload: Compat.SetSessionConfigOptionRequest
  ) => AcpResult<Compat.SetSessionConfigOptionResponse>;
  /** Selects a session mode on generation-1 agents; generation 2 uses config options. */
  readonly setSessionMode: (payload: Compat.SetSessionModeRequest) => AcpResult<Compat.SetSessionModeResponse>;
  /** Legacy `session/set_model`, generation 1 only. */
  readonly setSessionModel: (payload: Compat.SetSessionModelRequest) => AcpResult<Compat.SetSessionModelResponse>;
}

/**
 * Service shape implemented by the ACP client driver.
 *
 * **Details**
 *
 * Request handlers receive the request and its `AcpRequestContext` (raw JSON-RPC id and
 * method). A missing handler answers `methodNotFound`. Session-update and elicitation-complete
 * notifications that arrive before a handler registers are buffered (at most 256 each, oldest
 * dropped) and replayed to the first handler. The `fs/*` and `terminal/*` handlers serve
 * generation-1 agents only; returning `void` from write, kill and release answers `{}`.
 *
 * **Example** (Access raw notifications)
 *
 * ```ts
 * import type { AcpClientShape } from "@beep/acp/client"
 *
 * const notificationsOf = (client: AcpClientShape) => client.raw.notifications
 * console.log(notificationsOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AcpClientShape extends AcpProtocol.AcpExtensionRegistrars {
  readonly agent: AcpClientAgent;
  readonly handleCreateTerminal: (
    handler: Handler<Compat.CreateTerminalRequest, Compat.CreateTerminalResponse>
  ) => Effect.Effect<void>;
  readonly handleElicitation: (
    handler: Handler<Compat.CreateElicitationRequest, Compat.CreateElicitationResponse>
  ) => Effect.Effect<void>;
  readonly handleElicitationComplete: (
    handler: NotificationHandler<Compat.CompleteElicitationNotification>
  ) => Effect.Effect<void>;
  readonly handleMcpMessage: (
    handler: Handler<Compat.MessageMcpRequest, Compat.MessageMcpResponse>
  ) => Effect.Effect<void>;
  readonly handleReadTextFile: (
    handler: Handler<Compat.ReadTextFileRequest, Compat.ReadTextFileResponse>
  ) => Effect.Effect<void>;
  readonly handleRequestPermission: (
    handler: Handler<Compat.RequestPermissionRequest, Compat.RequestPermissionResponse>
  ) => Effect.Effect<void>;
  readonly handleSessionUpdate: (handler: NotificationHandler<Compat.SessionNotification>) => Effect.Effect<void>;
  readonly handleTerminalKill: (
    handler: Handler<Compat.KillTerminalRequest, Compat.KillTerminalResponse | void>
  ) => Effect.Effect<void>;
  readonly handleTerminalOutput: (
    handler: Handler<Compat.TerminalOutputRequest, Compat.TerminalOutputResponse>
  ) => Effect.Effect<void>;
  readonly handleTerminalRelease: (
    handler: Handler<Compat.ReleaseTerminalRequest, Compat.ReleaseTerminalResponse | void>
  ) => Effect.Effect<void>;
  readonly handleTerminalWaitForExit: (
    handler: Handler<Compat.WaitForTerminalExitRequest, Compat.WaitForTerminalExitResponse>
  ) => Effect.Effect<void>;
  readonly handleWriteTextFile: (
    handler: Handler<Compat.WriteTextFileRequest, Compat.WriteTextFileResponse | void>
  ) => Effect.Effect<void>;
  readonly raw: AcpClientRaw;
}

/**
 * Context service tag for an ACP client.
 *
 * **Example** (Resolve AcpClient service)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { AcpClient } from "@beep/acp/client"
 *
 * const program = Effect.service(AcpClient).pipe(
 *   Effect.map((client) => typeof client.agent.prompt)
 * )
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AcpClient extends Context.Service<AcpClient, AcpClientShape>()($I`AcpClient`) {}

interface AcpCoreRequestHandlers {
  readonly createTerminal?: Handler<Compat.CreateTerminalRequest, Compat.CreateTerminalResponse>;
  readonly elicitation?: Handler<Compat.CreateElicitationRequest, Compat.CreateElicitationResponse>;
  readonly mcpMessage?: Handler<Compat.MessageMcpRequest, Compat.MessageMcpResponse>;
  readonly readTextFile?: Handler<Compat.ReadTextFileRequest, Compat.ReadTextFileResponse>;
  readonly requestPermission?: Handler<Compat.RequestPermissionRequest, Compat.RequestPermissionResponse>;
  readonly terminalKill?: Handler<Compat.KillTerminalRequest, Compat.KillTerminalResponse | void>;
  readonly terminalOutput?: Handler<Compat.TerminalOutputRequest, Compat.TerminalOutputResponse>;
  readonly terminalRelease?: Handler<Compat.ReleaseTerminalRequest, Compat.ReleaseTerminalResponse | void>;
  readonly terminalWaitForExit?: Handler<Compat.WaitForTerminalExitRequest, Compat.WaitForTerminalExitResponse>;
  readonly writeTextFile?: Handler<Compat.WriteTextFileRequest, Compat.WriteTextFileResponse | void>;
}

type CoreHandlers = Ref.Ref<AcpCoreRequestHandlers>;

interface NotificationChannel<A> {
  readonly dispatch: (notification: A) => Effect.Effect<void>;
  readonly register: (handler: NotificationHandler<A>) => Effect.Effect<void>;
}

interface BufferedNotifications<A> {
  readonly handlers: ReadonlyArray<NotificationHandler<A>>;
  readonly pending: ReadonlyArray<A>;
}

type PromptCompletion = Deferred.Deferred<Compat.PromptResponse, AcpError.AcpError>;
type PromptCompletions = HashMap.HashMap<string, PromptCompletion>;
type PromptRegistry = Ref.Ref<PromptCompletions>;

interface AcpClientState {
  readonly coreHandlers: CoreHandlers;
  readonly elicitationCompletions: NotificationChannel<Compat.CompleteElicitationNotification>;
  readonly extNotificationHandlers: Ref.Ref<HashMap.HashMap<string, ExtNotificationHandler>>;
  readonly extRequestHandlers: Ref.Ref<HashMap.HashMap<string, ExtRequestHandler>>;
  readonly generation: MutableRef.MutableRef<Normalize.ProtocolGeneration>;
  readonly mode: AcpClientProtocolGeneration;
  readonly prompts: PromptRegistry;
  readonly sessionUpdates: NotificationChannel<Compat.SessionNotification>;
  readonly unknownExtNotificationHandler: Ref.Ref<O.Option<AcpProtocol.AcpUnknownExtNotificationHandler>>;
  readonly unknownExtRequestHandler: Ref.Ref<O.Option<AcpProtocol.AcpUnknownExtRequestHandler>>;
}

const runNotificationHandlers = <A>(handlers: ReadonlyArray<NotificationHandler<A>>, notification: A) =>
  Effect.forEach(handlers, (handler) => isolateNotificationHandler(handler(notification)), {
    concurrency: 1,
    discard: true,
  });

const appendPending = <A>(pending: ReadonlyArray<A>, notification: A): ReadonlyArray<A> =>
  A.takeRight(A.append(pending, notification), ACP_CLIENT_PENDING_NOTIFICATION_CAPACITY);

const makeNotificationChannel = <A>(): Effect.Effect<NotificationChannel<A>> =>
  Effect.map(
    Ref.make<BufferedNotifications<A>>({ handlers: [], pending: [] }),
    (state): NotificationChannel<A> => ({
      dispatch: (notification) =>
        Ref.modify(state, (current): readonly [ReadonlyArray<NotificationHandler<A>>, BufferedNotifications<A>] =>
          A.isReadonlyArrayEmpty(current.handlers)
            ? [current.handlers, { handlers: current.handlers, pending: appendPending(current.pending, notification) }]
            : [current.handlers, current]
        ).pipe(Effect.flatMap((handlers) => runNotificationHandlers(handlers, notification))),
      register: (handler) =>
        Ref.modify(state, (current): readonly [BufferedNotifications<A>, BufferedNotifications<A>] => {
          const handlers = A.append(current.handlers, handler);
          return [
            { handlers, pending: current.pending },
            { handlers, pending: [] },
          ];
        }).pipe(
          Effect.flatMap(({ handlers, pending }) =>
            Effect.forEach(pending, (notification) => runNotificationHandlers(handlers, notification), {
              concurrency: 1,
              discard: true,
            })
          )
        ),
    })
  );

// decision: t3-parity-prompt-and-method-gates
const initialGeneration = AcpClientProtocolGeneration.match({
  negotiate: (): Normalize.ProtocolGeneration => 2,
  v1: (): Normalize.ProtocolGeneration => 1,
  v2: (): Normalize.ProtocolGeneration => 2,
});

const makeClientState = Effect.fnUntraced(function* (mode: AcpClientProtocolGeneration) {
  return {
    coreHandlers: yield* Ref.make<AcpCoreRequestHandlers>({}),
    elicitationCompletions: yield* makeNotificationChannel<Compat.CompleteElicitationNotification>(),
    extNotificationHandlers: yield* Ref.make(HashMap.empty<string, ExtNotificationHandler>()),
    extRequestHandlers: yield* Ref.make(HashMap.empty<string, ExtRequestHandler>()),
    generation: MutableRef.make(initialGeneration(mode)),
    mode,
    prompts: yield* Ref.make(HashMap.empty<string, PromptCompletion>()),
    sessionUpdates: yield* makeNotificationChannel<Compat.SessionNotification>(),
    unknownExtNotificationHandler: yield* Ref.make(O.none<AcpProtocol.AcpUnknownExtNotificationHandler>()),
    unknownExtRequestHandler: yield* Ref.make(O.none<AcpProtocol.AcpUnknownExtRequestHandler>()),
  } satisfies AcpClientState;
});

const beginPrompt = Effect.fnUntraced(function* (prompts: PromptRegistry, sessionId: string) {
  const completion = yield* Deferred.make<Compat.PromptResponse, AcpError.AcpError>();
  const admitted = yield* Ref.modify(prompts, (current): readonly [boolean, PromptCompletions] =>
    HashMap.has(current, sessionId) ? [false, current] : [true, HashMap.set(current, sessionId, completion)]
  );
  if (!admitted) {
    return yield* AcpError.AcpRequestError.internalError(`ACP session '${sessionId}' already has an active prompt.`);
  }
  return completion;
});

const finishPrompt = (prompts: PromptRegistry, sessionId: string, completion: PromptCompletion) =>
  Ref.update(prompts, (current) =>
    O.exists(HashMap.get(current, sessionId), (registered) => registered === completion)
      ? HashMap.remove(current, sessionId)
      : current
  );

// decision: t3-parity-prompt-and-method-gates
const completePrompt = (prompts: PromptRegistry, notification: Compat.SessionNotification) => {
  const update = notification.update;
  if (!Normalize.isIdleStateUpdate(update)) {
    return Effect.void;
  }
  return Ref.modify(prompts, (current): readonly [O.Option<PromptCompletion>, PromptCompletions] => [
    HashMap.get(current, notification.sessionId),
    HashMap.remove(current, notification.sessionId),
  ]).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.void,
        onSome: (completion) => Deferred.succeed(completion, Normalize.promptResponseFromIdle(update)),
      })
    ),
    Effect.asVoid
  );
};

const failPrompts = (prompts: PromptRegistry, error: AcpError.AcpError) =>
  Ref.getAndSet(prompts, HashMap.empty()).pipe(
    Effect.flatMap((pending) =>
      Effect.forEach(HashMap.values(pending), (completion) => Deferred.fail(completion, error), {
        concurrency: 1,
        discard: true,
      })
    )
  );

const dispatchExtNotification = (state: AcpClientState, method: string, params: unknown) =>
  Effect.all([Ref.get(state.extNotificationHandlers), Ref.get(state.unknownExtNotificationHandler)], {
    concurrency: 1,
  }).pipe(
    Effect.flatMap(([handlers, unknownHandler]) =>
      HashMap.get(handlers, method).pipe(
        O.map((handler) => handler(params)),
        O.orElse(() => O.map(unknownHandler, (handler) => handler(method, params))),
        O.getOrElse(() => Effect.void)
      )
    )
  );

const dispatchSessionUpdate = (state: AcpClientState, notification: Compat.SessionNotification) =>
  completePrompt(state.prompts, notification).pipe(Effect.andThen(state.sessionUpdates.dispatch(notification)));

const isCompatSessionNotification = S.is(Compat.SessionNotification);

const toCompatSessionNotification = (state: AcpClientState, params: Normalize.WireSessionNotification) =>
  isCompatSessionNotification(params)
    ? params
    : Normalize.normalizeSessionNotification(params, MutableRef.get(state.generation));

const dispatchNotification = (state: AcpClientState) =>
  Match.type<AcpProtocol.AcpIncomingNotification>().pipe(
    Match.tag("SessionUpdate", ({ params }) =>
      dispatchSessionUpdate(state, toCompatSessionNotification(state, params))
    ),
    Match.tag("ElicitationComplete", ({ params }) => state.elicitationCompletions.dispatch(params)),
    Match.tag("ExtNotification", ({ method, params }) => dispatchExtNotification(state, method, params)),
    Match.exhaustive
  );

const transformSessionUpdate =
  (state: AcpClientState, options: AcpClientOptions) =>
  (notification: Normalize.WireSessionNotification): Compat.SessionNotification => {
    const normalized = Normalize.normalizeSessionNotification(notification, MutableRef.get(state.generation));
    return O.match(O.fromUndefinedOr(options.transformSessionUpdate), {
      onNone: () => normalized,
      onSome: (transform) => transform(normalized),
    });
  };

const onTermination = (state: AcpClientState, options: AcpClientOptions) => (error: AcpError.AcpError) =>
  failPrompts(state.prompts, error).pipe(
    Effect.andThen(
      O.match(O.fromUndefinedOr(options.onTermination), {
        onNone: () => Effect.void,
        onSome: (hook) => hook(error),
      })
    )
  );

interface MakeClientTransportOptions {
  readonly options: AcpClientOptions;
  readonly state: AcpClientState;
  readonly stdio: AcpProtocol.AcpStdio;
  readonly terminationError: Effect.Effect<AcpError.AcpError> | undefined;
}

const makeClientTransport = ({ options, state, stdio, terminationError }: MakeClientTransportOptions) =>
  AcpProtocol.makeAcpPatchedProtocol({
    stdio,
    serverRequestMethods: HashSet.fromIterable(AcpRpcs.CompatClientRpcs.requests.keys()),
    ...O.getSomesStruct({
      terminationError: O.fromUndefinedOr(terminationError),
      logIncoming: O.fromUndefinedOr(options.logIncoming),
      logOutgoing: O.fromUndefinedOr(options.logOutgoing),
      logger: O.fromUndefinedOr(options.logger),
      onIncomingRequest: O.fromUndefinedOr(options.onIncomingRequest),
      onOutgoingResponse: O.fromUndefinedOr(options.onOutgoingResponse),
      onOutgoingResponseFailure: O.fromUndefinedOr(options.onOutgoingResponseFailure),
    }),
    onExtRequest: dispatchExtRequest(state),
    onNotification: dispatchNotification(state),
    onTermination: onTermination(state, options),
    transformSessionUpdate: transformSessionUpdate(state, options),
  });

interface RpcHandlerOptions {
  readonly requestId: RpcMessage.RequestId;
}

const requestContext = (method: string, requestId: RpcMessage.RequestId) =>
  AcpProtocol.AcpRequestContext.make({ method, requestId });

const serveRequest =
  <A, B>(
    handlers: CoreHandlers,
    method: string,
    select: (registered: AcpCoreRequestHandlers) => Handler<A, B> | undefined
  ) =>
  (payload: A, { requestId }: RpcHandlerOptions) =>
    Effect.flatMap(Ref.get(handlers), (registered) =>
      runHandler({ context: requestContext(method, requestId), handler: select(registered), method, payload })
    );

const orEmptyResponse = <A>(result: A | void): A | {} => result ?? {};

const servePermissionRequest =
  (handlers: CoreHandlers) => (payload: Normalize.WirePermissionRequest, options: RpcHandlerOptions) =>
    serveRequest(
      handlers,
      CLIENT_METHODS.session_request_permission,
      (registered) => registered.requestPermission
    )(
      Normalize.normalizePermissionRequest(
        payload,
        requestContext(CLIENT_METHODS.session_request_permission, options.requestId)
      ),
      options
    );

const serveElicitation = (handlers: CoreHandlers) => (payload: unknown, options: RpcHandlerOptions) =>
  Normalize.decodeElicitationRequest(payload).pipe(
    Effect.mapError((cause) =>
      AcpError.AcpRequestError.invalidExtensionPayload(CLIENT_METHODS.elicitation_create, cause).toProtocolError()
    ),
    Effect.flatMap((request) =>
      serveRequest(
        handlers,
        CLIENT_METHODS.elicitation_create,
        (registered) => registered.elicitation
      )(request, options)
    )
  );

const serveLegacyElicitation =
  (handlers: CoreHandlers, method: string) => (payload: V2.CreateElicitationRequest, options: RpcHandlerOptions) =>
    serveRequest(
      handlers,
      method,
      (registered) => registered.elicitation
    )(payload, options).pipe(Effect.map(Normalize.toLegacyElicitationResponse));

const elicitationAndPermissionHandlers = (handlers: CoreHandlers) => ({
  [CLIENT_METHODS.session_request_permission]: servePermissionRequest(handlers),
  [CLIENT_METHODS.elicitation_create]: serveElicitation(handlers),
  [AcpRpcs.LEGACY_CLIENT_METHODS.session_elicitation]: serveLegacyElicitation(
    handlers,
    AcpRpcs.LEGACY_CLIENT_METHODS.session_elicitation
  ),
  [AcpRpcs.LEGACY_CLIENT_METHODS.unstable_session_elicitation]: serveLegacyElicitation(
    handlers,
    AcpRpcs.LEGACY_CLIENT_METHODS.unstable_session_elicitation
  ),
});

const mcpHandlers = (handlers: CoreHandlers) => ({
  [CLIENT_METHODS.mcp_message]: serveRequest(
    handlers,
    CLIENT_METHODS.mcp_message,
    (registered) => registered.mcpMessage
  ),
});

const fileSystemHandlers = (handlers: CoreHandlers) => ({
  [V1_CLIENT_METHODS.fs_read_text_file]: serveRequest(
    handlers,
    V1_CLIENT_METHODS.fs_read_text_file,
    (registered) => registered.readTextFile
  ),
  [V1_CLIENT_METHODS.fs_write_text_file]: (payload: Compat.WriteTextFileRequest, options: RpcHandlerOptions) =>
    serveRequest(
      handlers,
      V1_CLIENT_METHODS.fs_write_text_file,
      (registered) => registered.writeTextFile
    )(payload, options).pipe(Effect.map(orEmptyResponse)),
});

const terminalHandlers = (handlers: CoreHandlers) => ({
  [V1_CLIENT_METHODS.terminal_create]: serveRequest(
    handlers,
    V1_CLIENT_METHODS.terminal_create,
    (registered) => registered.createTerminal
  ),
  [V1_CLIENT_METHODS.terminal_output]: serveRequest(
    handlers,
    V1_CLIENT_METHODS.terminal_output,
    (registered) => registered.terminalOutput
  ),
  [V1_CLIENT_METHODS.terminal_wait_for_exit]: serveRequest(
    handlers,
    V1_CLIENT_METHODS.terminal_wait_for_exit,
    (registered) => registered.terminalWaitForExit
  ),
  [V1_CLIENT_METHODS.terminal_kill]: (payload: Compat.KillTerminalRequest, options: RpcHandlerOptions) =>
    serveRequest(
      handlers,
      V1_CLIENT_METHODS.terminal_kill,
      (registered) => registered.terminalKill
    )(payload, options).pipe(Effect.map(orEmptyResponse)),
  [V1_CLIENT_METHODS.terminal_release]: (payload: Compat.ReleaseTerminalRequest, options: RpcHandlerOptions) =>
    serveRequest(
      handlers,
      V1_CLIENT_METHODS.terminal_release,
      (registered) => registered.terminalRelease
    )(payload, options).pipe(Effect.map(orEmptyResponse)),
});

const clientRequestHandlersLayer = (handlers: CoreHandlers) =>
  AcpRpcs.CompatClientRpcs.toLayer(
    AcpRpcs.CompatClientRpcs.of({
      ...elicitationAndPermissionHandlers(handlers),
      ...mcpHandlers(handlers),
      ...fileSystemHandlers(handlers),
      ...terminalHandlers(handlers),
    })
  );

// decision: handler-defects-answer-their-own-request
const serveClientRequests = Effect.fnUntraced(function* (
  transport: AcpProtocol.AcpPatchedProtocol,
  handlers: CoreHandlers
) {
  const context = yield* handlers.pipe(clientRequestHandlersLayer, Layer.merge(ErrorReporter.layer([])), Layer.build);
  yield* RpcServer.make(AcpRpcs.CompatClientRpcs, { disableFatalDefects: true }).pipe(
    Effect.provideService(RpcServer.Protocol, transport.serverProtocol),
    Effect.provideContext(context),
    Effect.forkScoped
  );
});

type AgentRpcClient = RpcClient.FromGroup<typeof AcpRpcs.CompatAgentRpcs, RpcClientError.RpcClientError>;

const makeAgentRpcClient = (transport: AcpProtocol.AcpPatchedProtocol) => {
  const nextRequestId = MutableRef.make(AcpProtocol.RPC_REQUEST_ID_START);
  return RpcClient.make(AcpRpcs.CompatAgentRpcs, {
    generateRequestId: () => nextRequestId.pipe(MutableRef.getAndIncrement, RpcMessage.RequestId),
  }).pipe(Effect.provideService(RpcClient.Protocol, transport.clientProtocol));
};

interface AgentMethodContext {
  readonly rpc: AgentRpcClient;
  readonly state: AcpClientState;
  readonly transport: AcpProtocol.AcpPatchedProtocol;
}

const byGeneration = <A, E>(
  state: AcpClientState,
  generation1: LazyArg<Effect.Effect<A, E>>,
  generation2: LazyArg<Effect.Effect<A, E>>
): Effect.Effect<A, E> =>
  Effect.suspend(() => (MutableRef.get(state.generation) === 1 ? generation1() : generation2()));

const failLocally = (method: string) => () => Effect.fail(AcpError.AcpRequestError.methodNotFound(method));

const initializeRequestFor = (mode: AcpClientProtocolGeneration, request: Compat.InitializeRequest) =>
  AcpClientProtocolGeneration.match(mode, {
    negotiate: () => Normalize.toNegotiatingInitializeRequest(request),
    v1: () => Normalize.toV1InitializeRequest(request),
    v2: () => Normalize.toV2InitializeRequest(request),
  });

// decision: generation-from-the-initialize-reply-shape
const recordGeneration = (state: AcpClientState, response: V2.InitializeResponse | Compat.InitializeResponse) =>
  Effect.sync(() => {
    if (AcpClientProtocolGeneration.is.negotiate(state.mode)) {
      MutableRef.set(state.generation, Normalize.isV2InitializeResponse(response) ? 2 : 1);
    }
  });

const connectionMethods = ({ rpc, state }: AgentMethodContext) =>
  ({
    initialize: (payload) =>
      rpc[AGENT_METHODS.initialize](initializeRequestFor(state.mode, payload)).pipe(
        callRpc(AGENT_METHODS.initialize),
        Effect.tap((response) => recordGeneration(state, response)),
        Effect.map(Normalize.normalizeInitializeResponse)
      ),
    authenticate: (payload) =>
      byGeneration(
        state,
        () => rpc[V1_AGENT_METHODS.authenticate](payload).pipe(callRpc(V1_AGENT_METHODS.authenticate)),
        () => rpc[AGENT_METHODS.auth_login](payload).pipe(callRpc(AGENT_METHODS.auth_login))
      ),
    logout: (payload) =>
      byGeneration(
        state,
        () => rpc[V1_AGENT_METHODS.logout](payload).pipe(callRpc(V1_AGENT_METHODS.logout)),
        () => rpc[AGENT_METHODS.auth_logout](payload).pipe(callRpc(AGENT_METHODS.auth_logout))
      ),
  }) satisfies Pick<AcpClientAgent, "initialize" | "authenticate" | "logout">;

const sessionSetupMethods = ({ rpc, state }: AgentMethodContext) =>
  ({
    createSession: (payload) =>
      byGeneration(
        state,
        () => rpc[AGENT_METHODS.session_new](payload),
        () => rpc[AGENT_METHODS.session_new](Normalize.toV2NewSessionRequest(payload))
      ).pipe(callRpc(AGENT_METHODS.session_new), Effect.map(Normalize.normalizeNewSessionResponse)),
    loadSession: (payload) =>
      byGeneration(
        state,
        () => rpc[V1_AGENT_METHODS.session_load](payload).pipe(callRpc(V1_AGENT_METHODS.session_load)),
        () =>
          rpc[AGENT_METHODS.session_resume](Normalize.toV2LoadSessionRequest(payload)).pipe(
            callRpc(AGENT_METHODS.session_resume),
            Effect.map(Normalize.normalizeResumeSessionResponse)
          )
      ),
    resumeSession: (payload) =>
      byGeneration(
        state,
        () => rpc[AGENT_METHODS.session_resume](payload),
        () => rpc[AGENT_METHODS.session_resume](Normalize.toV2ResumeSessionRequest(payload))
      ).pipe(callRpc(AGENT_METHODS.session_resume), Effect.map(Normalize.normalizeResumeSessionResponse)),
    forkSession: (payload) =>
      byGeneration(
        state,
        () => rpc[AGENT_METHODS.session_fork](payload),
        () => rpc[AGENT_METHODS.session_fork](Normalize.toV2ForkSessionRequest(payload))
      ).pipe(callRpc(AGENT_METHODS.session_fork), Effect.map(Normalize.normalizeForkSessionResponse)),
  }) satisfies Pick<AcpClientAgent, "createSession" | "loadSession" | "resumeSession" | "forkSession">;

const sessionManagementMethods = ({ rpc, state }: AgentMethodContext) =>
  ({
    listSessions: (payload) => rpc[AGENT_METHODS.session_list](payload).pipe(callRpc(AGENT_METHODS.session_list)),
    closeSession: (payload) => rpc[AGENT_METHODS.session_close](payload).pipe(callRpc(AGENT_METHODS.session_close)),
    deleteSession: (payload) =>
      byGeneration(state, failLocally(AGENT_METHODS.session_delete), () =>
        rpc[AGENT_METHODS.session_delete](payload).pipe(callRpc(AGENT_METHODS.session_delete))
      ),
    setSessionConfigOption: (payload) =>
      byGeneration(
        state,
        () => rpc[AGENT_METHODS.session_set_config_option](payload),
        () => rpc[AGENT_METHODS.session_set_config_option](Normalize.toV2SetSessionConfigOptionRequest(payload))
      ).pipe(
        callRpc(AGENT_METHODS.session_set_config_option),
        Effect.map(Normalize.normalizeSetSessionConfigOptionResponse)
      ),
  }) satisfies Pick<AcpClientAgent, "listSessions" | "closeSession" | "deleteSession" | "setSessionConfigOption">;

// decision: t3-parity-prompt-and-method-gates
const providerMethods = ({ rpc, state }: AgentMethodContext) =>
  ({
    listProviders: (payload) =>
      byGeneration(state, failLocally(AGENT_METHODS.providers_list), () =>
        rpc[AGENT_METHODS.providers_list](payload).pipe(callRpc(AGENT_METHODS.providers_list))
      ),
    setProvider: (payload) =>
      byGeneration(state, failLocally(AGENT_METHODS.providers_set), () =>
        rpc[AGENT_METHODS.providers_set](payload).pipe(callRpc(AGENT_METHODS.providers_set))
      ),
    disableProvider: (payload) =>
      byGeneration(state, failLocally(AGENT_METHODS.providers_disable), () =>
        rpc[AGENT_METHODS.providers_disable](payload).pipe(callRpc(AGENT_METHODS.providers_disable))
      ),
  }) satisfies Pick<AcpClientAgent, "listProviders" | "setProvider" | "disableProvider">;

const legacyModeMethods = ({ rpc, state }: AgentMethodContext) =>
  ({
    setSessionModel: (payload) =>
      byGeneration(
        state,
        () =>
          rpc[AcpRpcs.LEGACY_AGENT_METHODS.session_set_model](payload).pipe(
            callRpc(AcpRpcs.LEGACY_AGENT_METHODS.session_set_model)
          ),
        failLocally(AcpRpcs.LEGACY_AGENT_METHODS.session_set_model)
      ),
    setSessionMode: (payload) =>
      byGeneration(
        state,
        () => rpc[V1_AGENT_METHODS.session_set_mode](payload).pipe(callRpc(V1_AGENT_METHODS.session_set_mode)),
        failLocally(V1_AGENT_METHODS.session_set_mode)
      ),
  }) satisfies Pick<AcpClientAgent, "setSessionModel" | "setSessionMode">;

const promptGeneration2 = ({ rpc, state }: AgentMethodContext, payload: V2.PromptRequest) =>
  Effect.flatMap(beginPrompt(state.prompts, payload.sessionId), (completion) =>
    rpc[AGENT_METHODS.session_prompt](payload).pipe(
      callRpc(AGENT_METHODS.session_prompt),
      Effect.andThen(Deferred.await(completion)),
      Effect.ensuring(finishPrompt(state.prompts, payload.sessionId, completion))
    )
  );

const toWirePrompt = (payload: Compat.PromptRequest) =>
  Effect.fromOption(Normalize.toWirePromptRequest(payload), () =>
    AcpError.AcpRequestError.invalidParams(
      "ACP prompt content has an unknown block that carries no original content block."
    )
  );

const turnMethods = (context: AgentMethodContext) =>
  ({
    prompt: (payload) =>
      Effect.flatMap(toWirePrompt(payload), (wire) =>
        byGeneration(
          context.state,
          () =>
            context.rpc[AGENT_METHODS.session_prompt](wire).pipe(
              callRpc(AGENT_METHODS.session_prompt),
              Effect.map(Normalize.normalizePromptResponse)
            ),
          () => promptGeneration2(context, wire)
        )
      ),
    cancel: context.transport.notify(AGENT_METHODS.session_cancel),
  }) satisfies Pick<AcpClientAgent, "prompt" | "cancel">;

const mcpMethods = (context: AgentMethodContext) =>
  ({
    notifyMcp: context.transport.notify(AGENT_METHODS.mcp_message),
  }) satisfies Pick<AcpClientAgent, "notifyMcp">;

const makeAgentMethods = (context: AgentMethodContext): AcpClientAgent => ({
  ...connectionMethods(context),
  ...sessionSetupMethods(context),
  ...sessionManagementMethods(context),
  ...providerMethods(context),
  ...legacyModeMethods(context),
  ...turnMethods(context),
  ...mcpMethods(context),
});

const registerCoreHandler =
  <K extends keyof AcpCoreRequestHandlers>(handlers: CoreHandlers, key: K) =>
  (handler: NonNullable<AcpCoreRequestHandlers[K]>): Effect.Effect<void> =>
    Ref.update(handlers, (current): AcpCoreRequestHandlers => ({ ...current, [key]: handler }));

const coreRegistrars = ({ coreHandlers }: AcpClientState) =>
  ({
    handleCreateTerminal: registerCoreHandler(coreHandlers, "createTerminal"),
    handleElicitation: registerCoreHandler(coreHandlers, "elicitation"),
    handleMcpMessage: registerCoreHandler(coreHandlers, "mcpMessage"),
    handleReadTextFile: registerCoreHandler(coreHandlers, "readTextFile"),
    handleRequestPermission: registerCoreHandler(coreHandlers, "requestPermission"),
    handleTerminalKill: registerCoreHandler(coreHandlers, "terminalKill"),
    handleTerminalOutput: registerCoreHandler(coreHandlers, "terminalOutput"),
    handleTerminalRelease: registerCoreHandler(coreHandlers, "terminalRelease"),
    handleTerminalWaitForExit: registerCoreHandler(coreHandlers, "terminalWaitForExit"),
    handleWriteTextFile: registerCoreHandler(coreHandlers, "writeTextFile"),
  }) satisfies Partial<AcpClientShape>;

const notificationRegistrars = (state: AcpClientState, extensions: AcpProtocol.AcpExtensionRegistrars) =>
  ({
    ...extensions,
    handleSessionUpdate: state.sessionUpdates.register,
    handleElicitationComplete: state.elicitationCompletions.register,
  }) satisfies Partial<AcpClientShape>;

/**
 * Constructs an ACP client from an ACP stdio transport.
 *
 * **Details**
 *
 * The optional `terminationError` classifies how the peer ended (the child-process layer passes
 * the exit status). When the connection ends, a pending generation-2 prompt fails with the
 * terminal error before `onTermination` runs.
 *
 * **Example** (Build client from Stdio)
 *
 * ```ts
 * import type * as Stdio from "effect/Stdio"
 * import { make } from "@beep/acp/client"
 *
 * const fromStdio = (stdio: Stdio.Stdio) => make(stdio, { protocolGeneration: "negotiate" })
 * console.log(fromStdio)
 * ```
 *
 * @effects Builds client and server RPC handlers, registers scoped protocol
 * fibers, buffers inbound notifications, and communicates through the supplied
 * stdio transport when the returned Effect runs.
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn($I`AcpClient_make`)(function* (
  stdio: AcpProtocol.AcpStdio,
  options: AcpClientOptions = {},
  terminationError?: Effect.Effect<AcpError.AcpError>
): Effect.fn.Return<AcpClientShape, never, Scope.Scope> {
  const state = yield* makeClientState(options.protocolGeneration ?? AcpClientProtocolGeneration.Enum.negotiate);
  const transport = yield* makeClientTransport({ options, state, stdio, terminationError });
  yield* serveClientRequests(transport, state.coreHandlers);
  const rpc = yield* makeAgentRpcClient(transport);
  const extensions = makeExtensionRegistrars({ ...state, namePrefix: "AcpClient" });

  return AcpClient.of({
    raw: { notifications: transport.incoming, request: transport.request, notify: transport.notify },
    agent: makeAgentMethods({ rpc, state, transport }),
    ...coreRegistrars(state),
    ...notificationRegistrars(state, extensions),
  });
});

/**
 * Child-process handle plus client options accepted by {@link layerChildProcess}.
 *
 * **Details**
 *
 * `stderrTail` is a collector over the same handle's stderr, from
 * `@beep/acp/stderr` `collectStderrTail`. When it is present, an `AcpProcessExitedError` that ends
 * the connection carries its sanitized excerpt. The client never reads the child's stderr itself:
 * without a collector the caller must drain it, or the peer can block on a full pipe.
 *
 * **Example** (Configuring a child-process client)
 *
 * ```ts
 * import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
 * import type { AcpClientChildProcessOptions } from "@beep/acp/client"
 *
 * const fromHandle = (
 *   handle: ChildProcessSpawner.ChildProcessHandle
 * ): AcpClientChildProcessOptions => ({ handle, logOutgoing: true })
 * console.log(fromHandle)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpClientChildProcessOptions extends AcpClientOptions {
  readonly handle: ChildProcessSpawner.ChildProcessHandle;
  readonly stderrTail?: AcpStderr.AcpStderrCollector | undefined;
}

/**
 * Constructs an ACP client layer backed by a spawned child process.
 *
 * **Details**
 *
 * The child's stdout (after `transformStdout`) is the client's input and its stdin the output;
 * the child's exit status classifies the terminal error.
 *
 * **Example** (Layer from process handle)
 *
 * ```ts
 * import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
 * import { layerChildProcess } from "@beep/acp/client"
 *
 * const fromHandle = (handle: ChildProcessSpawner.ChildProcessHandle) => layerChildProcess({ handle })
 * console.log(fromHandle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerChildProcess = ({
  handle,
  stderrTail,
  ...options
}: AcpClientChildProcessOptions): Layer.Layer<AcpClient> => {
  const stdio: AcpProtocol.AcpStdio = {
    ...makeChildStdio(handle),
    stdin: O.match(O.fromUndefinedOr(options.transformStdout), {
      onNone: () => handle.stdout,
      onSome: (transform) => transform(handle.stdout),
    }),
  };
  const terminationError = O.match(O.fromUndefinedOr(stderrTail), {
    onNone: () => makeTerminationError(handle),
    onSome: (collector) => Effect.flatMap(makeTerminationError(handle), AcpStderr.withStderrExcerpt(collector)),
  });
  return Layer.effect(AcpClient, make(stdio, options, terminationError));
};
