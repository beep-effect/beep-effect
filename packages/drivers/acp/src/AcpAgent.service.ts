/**
 * ACP agent service and agent-side layer constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A, thunkEffectVoid } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Context, Effect, flow, HashMap, HashSet, Layer, Ref, Stdio } from "effect";
import * as S from "effect/Schema";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcMessage from "effect/unstable/rpc/RpcMessage";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { AGENT_METHODS, CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import * as AcpProtocol from "./AcpProtocol.service.ts";
import * as AcpRpcs from "./AcpRpc.models.ts";
import * as AcpTerminal from "./AcpTerminal.models.ts";
import { callRpc, makeExtensionRegistrars, runHandler } from "./internal/shared.ts";
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";

const $I = $AcpId.create("agent");

/**
 * Options for constructing an ACP agent service.
 *
 * @example
 * ```ts
 * import type { AcpAgentOptions } from "@beep/acp/agent"
 *
 * const options: AcpAgentOptions = { logIncoming: true }
 * console.log(options.logIncoming)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpAgentOptions extends AcpProtocol.AcpProtocolLoggingOptions {
  readonly logger?: (event: AcpProtocol.AcpProtocolLogEvent) => Effect.Effect<void>;
}

/**
 * Service shape implemented by the ACP agent driver.
 *
 * @example
 * ```ts
 * import type { AcpAgentShape } from "@beep/acp/agent"
 *
 * const notificationsOf = (agent: AcpAgentShape) => agent.raw.notifications
 * console.log(notificationsOf)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AcpAgentShape extends AcpProtocol.AcpExtensionRegistrars {
  readonly client: {
    /**
     * Requests client permission for an operation.
     * @see https://agentclientprotocol.com/protocol/schema#session/request_permission
     */
    readonly requestPermission: (
      payload: AcpSchema.RequestPermissionRequest
    ) => Effect.Effect<AcpSchema.RequestPermissionResponse, AcpError.AcpError>;
    /**
     * Requests structured user input from the client.
     * @see https://agentclientprotocol.com/protocol/schema#session/elicitation
     */
    readonly elicit: (
      payload: AcpSchema.ElicitationRequest
    ) => Effect.Effect<AcpSchema.ElicitationResponse, AcpError.AcpError>;
    /**
     * Requests file contents from the client.
     * @see https://agentclientprotocol.com/protocol/schema#fs/read_text_file
     */
    readonly readTextFile: (
      payload: AcpSchema.ReadTextFileRequest
    ) => Effect.Effect<AcpSchema.ReadTextFileResponse, AcpError.AcpError>;
    /**
     * Writes a text file through the client.
     * @see https://agentclientprotocol.com/protocol/schema#fs/write_text_file
     */
    readonly writeTextFile: (
      payload: AcpSchema.WriteTextFileRequest
    ) => Effect.Effect<AcpSchema.WriteTextFileResponse, AcpError.AcpError>;
    /**
     * Creates a terminal on the client side.
     * @see https://agentclientprotocol.com/protocol/schema#terminal/create
     */
    readonly createTerminal: (
      payload: AcpSchema.CreateTerminalRequest
    ) => Effect.Effect<AcpTerminal.AcpTerminal, AcpError.AcpError>;
    /**
     * Sends a `session/update` notification to the client.
     * @see https://agentclientprotocol.com/protocol/schema#session/update
     */
    readonly sessionUpdate: (payload: AcpSchema.SessionNotification) => Effect.Effect<void, AcpError.AcpError>;
    /**
     * Sends a `session/elicitation/complete` notification to the client.
     * @see https://agentclientprotocol.com/protocol/schema#session/elicitation/complete
     */
    readonly elicitationComplete: (
      payload: AcpSchema.ElicitationCompleteNotification
    ) => Effect.Effect<void, AcpError.AcpError>;
    /**
     * Sends an ACP extension request to the client.
     * @see https://agentclientprotocol.com/protocol/extensibility
     */
    readonly extRequest: (method: string, payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
    /**
     * Sends an ACP extension notification to the client.
     * @see https://agentclientprotocol.com/protocol/extensibility
     */
    readonly extNotification: (method: string, payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  };
  /**
   * Registers a handler for `authenticate`.
   * @see https://agentclientprotocol.com/protocol/schema#authenticate
   */
  readonly handleAuthenticate: (
    handler: (
      request: AcpSchema.AuthenticateRequest
    ) => Effect.Effect<AcpSchema.AuthenticateResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `session/cancel`.
   * @see https://agentclientprotocol.com/protocol/schema#session/cancel
   */
  readonly handleCancel: (
    handler: (notification: AcpSchema.CancelNotification) => Effect.Effect<void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleCloseSession: (
    handler: (
      request: AcpSchema.CloseSessionRequest
    ) => Effect.Effect<AcpSchema.CloseSessionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleCreateSession: (
    handler: (request: AcpSchema.NewSessionRequest) => Effect.Effect<AcpSchema.NewSessionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleForkSession: (
    handler: (request: AcpSchema.ForkSessionRequest) => Effect.Effect<AcpSchema.ForkSessionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `initialize`.
   * @see https://agentclientprotocol.com/protocol/schema#initialize
   */
  readonly handleInitialize: (
    handler: (request: AcpSchema.InitializeRequest) => Effect.Effect<AcpSchema.InitializeResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleListSessions: (
    handler: (
      request: AcpSchema.ListSessionsRequest
    ) => Effect.Effect<AcpSchema.ListSessionsResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleLoadSession: (
    handler: (request: AcpSchema.LoadSessionRequest) => Effect.Effect<AcpSchema.LoadSessionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleLogout: (
    handler: (request: AcpSchema.LogoutRequest) => Effect.Effect<AcpSchema.LogoutResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handlePrompt: (
    handler: (request: AcpSchema.PromptRequest) => Effect.Effect<AcpSchema.PromptResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleResumeSession: (
    handler: (
      request: AcpSchema.ResumeSessionRequest
    ) => Effect.Effect<AcpSchema.ResumeSessionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleSetSessionConfigOption: (
    handler: (
      request: AcpSchema.SetSessionConfigOptionRequest
    ) => Effect.Effect<AcpSchema.SetSessionConfigOptionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly handleSetSessionModel: (
    handler: (
      request: AcpSchema.SetSessionModelRequest
    ) => Effect.Effect<AcpSchema.SetSessionModelResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly raw: {
    /**
     * Stream of inbound ACP notifications observed on the connection.
     */
    readonly notifications: Stream.Stream<AcpProtocol.AcpIncomingNotification>;
    /**
     * Sends a generic ACP extension request.
     * @see https://agentclientprotocol.com/protocol/extensibility
     */
    readonly request: (method: string, payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
    /**
     * Sends a generic ACP extension notification.
     * @see https://agentclientprotocol.com/protocol/extensibility
     */
    readonly notify: (method: string, payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  };
}

/**
 * Context service tag for an ACP agent.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { AcpAgent } from "@beep/acp/agent"
 *
 * const program = Effect.service(AcpAgent).pipe(
 *   Effect.map((agent) => typeof agent.client.requestPermission)
 * )
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AcpAgent extends Context.Service<AcpAgent, AcpAgentShape>()($I`AcpAgent`) {}

interface AcpCoreAgentRequestHandlers {
  authenticate?: (
    request: AcpSchema.AuthenticateRequest
  ) => Effect.Effect<AcpSchema.AuthenticateResponse, AcpError.AcpError>;
  closeSession?: (
    request: AcpSchema.CloseSessionRequest
  ) => Effect.Effect<AcpSchema.CloseSessionResponse, AcpError.AcpError>;
  createSession?: (
    request: AcpSchema.NewSessionRequest
  ) => Effect.Effect<AcpSchema.NewSessionResponse, AcpError.AcpError>;
  forkSession?: (
    request: AcpSchema.ForkSessionRequest
  ) => Effect.Effect<AcpSchema.ForkSessionResponse, AcpError.AcpError>;
  initialize?: (request: AcpSchema.InitializeRequest) => Effect.Effect<AcpSchema.InitializeResponse, AcpError.AcpError>;
  listSessions?: (
    request: AcpSchema.ListSessionsRequest
  ) => Effect.Effect<AcpSchema.ListSessionsResponse, AcpError.AcpError>;
  loadSession?: (
    request: AcpSchema.LoadSessionRequest
  ) => Effect.Effect<AcpSchema.LoadSessionResponse, AcpError.AcpError>;
  logout?: (request: AcpSchema.LogoutRequest) => Effect.Effect<AcpSchema.LogoutResponse, AcpError.AcpError>;
  prompt?: (request: AcpSchema.PromptRequest) => Effect.Effect<AcpSchema.PromptResponse, AcpError.AcpError>;
  resumeSession?: (
    request: AcpSchema.ResumeSessionRequest
  ) => Effect.Effect<AcpSchema.ResumeSessionResponse, AcpError.AcpError>;
  setSessionConfigOption?: (
    request: AcpSchema.SetSessionConfigOptionRequest
  ) => Effect.Effect<AcpSchema.SetSessionConfigOptionResponse, AcpError.AcpError>;
  setSessionModel?: (
    request: AcpSchema.SetSessionModelRequest
  ) => Effect.Effect<AcpSchema.SetSessionModelResponse, AcpError.AcpError>;
}

const decodeCancelNotification = S.decodeUnknownEffect(AcpSchema.CancelNotification);

/**
 * Constructs an ACP agent from an Effect `Stdio` transport.
 *
 * @example
 * ```ts
 * import type * as Stdio from "effect/Stdio"
 * import { make } from "@beep/acp/agent"
 *
 * const fromStdio = (stdio: Stdio.Stdio) => make(stdio)
 * console.log(fromStdio)
 * ```
 *
 * @effects Builds agent and client RPC handlers, registers scoped protocol
 * fibers, dispatches cancel and extension handlers, and communicates through
 * the supplied `Stdio` transport when the returned Effect runs.
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn($I`AcpAgent_make`)(function* (
  stdio: Stdio.Stdio,
  options: AcpAgentOptions = {}
): Effect.fn.Return<AcpAgentShape, never, Scope.Scope> {
  const coreHandlers: AcpCoreAgentRequestHandlers = {};
  const cancelHandlers: Array<(notification: AcpSchema.CancelNotification) => Effect.Effect<void, AcpError.AcpError>> =
    [];
  const extRequestHandlers = yield* Ref.make(
    HashMap.empty<string, (params: unknown) => Effect.Effect<unknown, AcpError.AcpError>>()
  );
  const extNotificationHandlers = yield* Ref.make(
    HashMap.empty<string, (params: unknown) => Effect.Effect<void, AcpError.AcpError>>()
  );
  const unknownExtRequestHandler = yield* Ref.make(
    O.none<(method: string, params: unknown) => Effect.Effect<unknown, AcpError.AcpError>>()
  );
  const unknownExtNotificationHandler = yield* Ref.make(
    O.none<(method: string, params: unknown) => Effect.Effect<void, AcpError.AcpError>>()
  );

  const runUnknownExtNotification = (method: string, params: unknown) =>
    Ref.get(unknownExtNotificationHandler).pipe(
      Effect.flatMap(
        O.match({
          onNone: thunkEffectVoid,
          onSome: (handler) => handler(method, params),
        })
      )
    );

  const runUnknownExtRequest = (method: string, params: unknown) =>
    Ref.get(unknownExtRequestHandler).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.fail(AcpError.AcpRequestError.methodNotFound(method)),
          onSome: (handler) => handler(method, params),
        })
      )
    );

  const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
    stdio,
    serverRequestMethods: HashSet.fromIterable(AcpRpcs.AgentRpcs.requests.keys()),
    ...O.getSomesStruct({
      logger: O.fromUndefinedOr(options.logger),
      logIncoming: O.fromUndefinedOr(options.logIncoming),
      logOutgoing: O.fromUndefinedOr(options.logOutgoing),
    }),
    onNotification: (notification) =>
      AcpProtocol.AcpIncomingNotification.match(notification, {
        SessionUpdate: thunkEffectVoid,
        ElicitationComplete: thunkEffectVoid,
        ExtNotification: (value) => {
          if (value.method === AGENT_METHODS.session_cancel) {
            return decodeCancelNotification(value.params).pipe(
              Effect.mapError((error) =>
                AcpError.AcpProtocolParseError.new(
                  error,
                  `Invalid ${AGENT_METHODS.session_cancel} notification payload`
                )
              ),
              Effect.flatMap((decoded) =>
                Effect.forEach(cancelHandlers, (handler) => handler(decoded), {
                  discard: true,
                })
              )
            );
          }

          return Ref.get(extNotificationHandlers).pipe(
            Effect.flatMap((handlers) =>
              O.match(HashMap.get(handlers, value.method), {
                onNone: () => runUnknownExtNotification(value.method, value.params),
                onSome: (handler) => handler(value.params),
              })
            )
          );
        },
      }),
    onExtRequest: (method, params) =>
      Ref.get(extRequestHandlers).pipe(
        Effect.flatMap((handlers) =>
          O.match(HashMap.get(handlers, method), {
            onNone: () => runUnknownExtRequest(method, params),
            onSome: (handler) => handler(params),
          })
        )
      ),
  });

  const agentHandlerLayer = AcpRpcs.AgentRpcs.toLayer(
    AcpRpcs.AgentRpcs.of({
      [AGENT_METHODS.initialize]: (payload) =>
        runHandler({ handler: coreHandlers.initialize, method: AGENT_METHODS.initialize, payload }),
      [AGENT_METHODS.authenticate]: (payload) =>
        runHandler({ handler: coreHandlers.authenticate, method: AGENT_METHODS.authenticate, payload }),
      [AGENT_METHODS.logout]: (payload) =>
        runHandler({ handler: coreHandlers.logout, method: AGENT_METHODS.logout, payload }),
      [AGENT_METHODS.session_new]: (payload) =>
        runHandler({ handler: coreHandlers.createSession, method: AGENT_METHODS.session_new, payload }),
      [AGENT_METHODS.session_load]: (payload) =>
        runHandler({ handler: coreHandlers.loadSession, method: AGENT_METHODS.session_load, payload }),
      [AGENT_METHODS.session_list]: (payload) =>
        runHandler({ handler: coreHandlers.listSessions, method: AGENT_METHODS.session_list, payload }),
      [AGENT_METHODS.session_fork]: (payload) =>
        runHandler({ handler: coreHandlers.forkSession, method: AGENT_METHODS.session_fork, payload }),
      [AGENT_METHODS.session_resume]: (payload) =>
        runHandler({ handler: coreHandlers.resumeSession, method: AGENT_METHODS.session_resume, payload }),
      [AGENT_METHODS.session_close]: (payload) =>
        runHandler({ handler: coreHandlers.closeSession, method: AGENT_METHODS.session_close, payload }),
      [AGENT_METHODS.session_set_model]: (payload) =>
        runHandler({ handler: coreHandlers.setSessionModel, method: AGENT_METHODS.session_set_model, payload }),
      [AGENT_METHODS.session_set_config_option]: (payload) =>
        runHandler({
          handler: coreHandlers.setSessionConfigOption,
          method: AGENT_METHODS.session_set_config_option,
          payload,
        }),
      [AGENT_METHODS.session_prompt]: (payload) =>
        runHandler({ handler: coreHandlers.prompt, method: AGENT_METHODS.session_prompt, payload }),
    })
  );

  const scope = yield* Effect.scope;
  const agentHandlerContext = yield* Layer.buildWithScope(agentHandlerLayer, scope);
  yield* RpcServer.make(AcpRpcs.AgentRpcs).pipe(
    Effect.provideService(RpcServer.Protocol, transport.serverProtocol),
    Effect.provide(agentHandlerContext),
    Effect.forkScoped
  );

  let nextRpcRequestId = 2 ** 32;
  const rpc = yield* RpcClient.make(AcpRpcs.ClientRpcs, {
    generateRequestId: () => RpcMessage.RequestId(String(nextRpcRequestId++)),
  }).pipe(Effect.provideService(RpcClient.Protocol, transport.clientProtocol));

  const handleInitialize = Effect.fn($I`AcpAgent_handleInitialize`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["initialize"]>) =>
      Effect.sync(() => {
        coreHandlers.initialize = handler;
      })
  );
  const handleAuthenticate = Effect.fn($I`AcpAgent_handleAuthenticate`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["authenticate"]>) =>
      Effect.sync(() => {
        coreHandlers.authenticate = handler;
      })
  );
  const handleLogout = Effect.fn($I`AcpAgent_handleLogout`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["logout"]>) =>
      Effect.sync(() => {
        coreHandlers.logout = handler;
      })
  );
  const handleCreateSession = Effect.fn($I`AcpAgent_handleCreateSession`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["createSession"]>) =>
      Effect.sync(() => {
        coreHandlers.createSession = handler;
      })
  );
  const handleLoadSession = Effect.fn($I`AcpAgent_handleLoadSession`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["loadSession"]>) =>
      Effect.sync(() => {
        coreHandlers.loadSession = handler;
      })
  );
  const handleListSessions = Effect.fn($I`AcpAgent_handleListSessions`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["listSessions"]>) =>
      Effect.sync(() => {
        coreHandlers.listSessions = handler;
      })
  );
  const handleForkSession = Effect.fn($I`AcpAgent_handleForkSession`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["forkSession"]>) =>
      Effect.sync(() => {
        coreHandlers.forkSession = handler;
      })
  );
  const handleResumeSession = Effect.fn($I`AcpAgent_handleResumeSession`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["resumeSession"]>) =>
      Effect.sync(() => {
        coreHandlers.resumeSession = handler;
      })
  );
  const handleCloseSession = Effect.fn($I`AcpAgent_handleCloseSession`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["closeSession"]>) =>
      Effect.sync(() => {
        coreHandlers.closeSession = handler;
      })
  );
  const handleSetSessionModel = Effect.fn($I`AcpAgent_handleSetSessionModel`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["setSessionModel"]>) =>
      Effect.sync(() => {
        coreHandlers.setSessionModel = handler;
      })
  );
  const handleSetSessionConfigOption = Effect.fn($I`AcpAgent_handleSetSessionConfigOption`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["setSessionConfigOption"]>) =>
      Effect.sync(() => {
        coreHandlers.setSessionConfigOption = handler;
      })
  );
  const handlePrompt = Effect.fn($I`AcpAgent_handlePrompt`)(
    (handler: NonNullable<AcpCoreAgentRequestHandlers["prompt"]>) =>
      Effect.sync(() => {
        coreHandlers.prompt = handler;
      })
  );
  const handleCancel = Effect.fn($I`AcpAgent_handleCancel`)(
    (handler: (notification: AcpSchema.CancelNotification) => Effect.Effect<void, AcpError.AcpError>) =>
      Effect.sync(() => {
        A.appendInPlace(cancelHandlers, handler);
      })
  );
  const { handleExtNotification, handleExtRequest, handleUnknownExtNotification, handleUnknownExtRequest } =
    makeExtensionRegistrars({
      extNotificationHandlers,
      extRequestHandlers,
      namePrefix: "AcpAgent",
      unknownExtNotificationHandler,
      unknownExtRequestHandler,
    });

  return AcpAgent.of({
    raw: {
      notifications: transport.incoming,
      request: transport.request,
      notify: transport.notify,
    },
    client: {
      requestPermission: flow(rpc[CLIENT_METHODS.session_request_permission], callRpc),
      elicit: flow(rpc[CLIENT_METHODS.session_elicitation], callRpc),
      readTextFile: flow(rpc[CLIENT_METHODS.fs_read_text_file], callRpc),
      writeTextFile: flow(rpc[CLIENT_METHODS.fs_write_text_file], callRpc),
      createTerminal: (payload) =>
        callRpc(rpc[CLIENT_METHODS.terminal_create](payload)).pipe(
          Effect.map((response) =>
            AcpTerminal.makeTerminal({
              sessionId: payload.sessionId,
              terminalId: response.terminalId,
              output: callRpc(
                rpc[CLIENT_METHODS.terminal_output]({
                  sessionId: payload.sessionId,
                  terminalId: response.terminalId,
                })
              ),
              waitForExit: callRpc(
                rpc[CLIENT_METHODS.terminal_wait_for_exit]({
                  sessionId: payload.sessionId,
                  terminalId: response.terminalId,
                })
              ),
              kill: callRpc(
                rpc[CLIENT_METHODS.terminal_kill]({
                  sessionId: payload.sessionId,
                  terminalId: response.terminalId,
                })
              ),
              release: callRpc(
                rpc[CLIENT_METHODS.terminal_release]({
                  sessionId: payload.sessionId,
                  terminalId: response.terminalId,
                })
              ),
            })
          )
        ),
      sessionUpdate: transport.notify(CLIENT_METHODS.session_update),
      elicitationComplete: transport.notify(CLIENT_METHODS.session_elicitation_complete),
      extRequest: transport.request,
      extNotification: transport.notify,
    },
    handleInitialize,
    handleAuthenticate,
    handleLogout,
    handleCreateSession,
    handleLoadSession,
    handleListSessions,
    handleForkSession,
    handleResumeSession,
    handleCloseSession,
    handleSetSessionModel,
    handleSetSessionConfigOption,
    handlePrompt,
    handleCancel,
    handleUnknownExtRequest,
    handleUnknownExtNotification,
    handleExtRequest,
    handleExtNotification,
  });
});

/**
 * Transport plus agent options accepted by {@link layer}.
 *
 * @example
 * ```ts
 * import type * as Stdio from "effect/Stdio"
 * import type { AcpAgentLayerOptions } from "@beep/acp/agent"
 *
 * const fromStdio = (stdio: Stdio.Stdio): AcpAgentLayerOptions => ({ stdio, logIncoming: true })
 * console.log(fromStdio)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpAgentLayerOptions extends AcpAgentOptions {
  readonly stdio: Stdio.Stdio;
}

/**
 * Constructs a layer for an ACP agent over the provided transport.
 *
 * @example
 * ```ts
 * import type * as Stdio from "effect/Stdio"
 * import { layer } from "@beep/acp/agent"
 *
 * const fromStdio = (stdio: Stdio.Stdio) => layer({ stdio })
 * console.log(fromStdio)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = ({ stdio, ...options }: AcpAgentLayerOptions): Layer.Layer<AcpAgent> =>
  Layer.effect(AcpAgent, make(stdio, options));

/**
 * Constructs a layer that reads its transport from the `Stdio` service.
 *
 * @example
 * ```ts
 * import { layerStdio } from "@beep/acp/agent"
 *
 * const live = layerStdio()
 * console.log(live)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerStdio = (options: AcpAgentOptions = {}): Layer.Layer<AcpAgent, never, Stdio.Stdio> =>
  Layer.effect(
    AcpAgent,
    Effect.flatMap(Effect.service(Stdio.Stdio), (stdio) => make(stdio, options))
  );
