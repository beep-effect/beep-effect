/**
 * ACP agent service and agent-side layer constructors (protocol generation 2).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A, thunkEffectVoid } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as ErrorReporter from "effect/ErrorReporter";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import { AGENT_METHODS, CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import * as AcpProtocol from "./AcpProtocol.service.ts";
import * as AcpRpcs from "./AcpRpc.models.ts";
import {
  callRpc,
  dispatchExtRequest,
  isolateNotificationHandler,
  makeExtensionRegistrars,
  runHandler,
} from "./internal/shared.ts";
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";
import type { ExtNotificationHandler, ExtRequestHandler } from "./internal/shared.ts";

const $I = $AcpId.create("agent");

type AcpProtocolLoggingFields = typeof AcpProtocol.AcpProtocolLoggingOptions.Encoded;

type AcpRequestHandler<Request, Response> = AcpProtocol.AcpRequestHandler<Request, Response>;

type AcpCancelHandler = (notification: AcpSchema.CancelSessionNotification) => Effect.Effect<void, AcpError.AcpError>;

/**
 * Options for constructing an ACP agent service.
 *
 * **Example** (Options with logIncoming flag)
 *
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
export interface AcpAgentOptions extends AcpProtocolLoggingFields {
  readonly logger?: (event: AcpProtocol.AcpProtocolLogEvent) => Effect.Effect<void>;
}

/**
 * Service shape implemented by the generation-2 ACP agent driver.
 *
 * **Details**
 *
 * Core request handlers receive the decoded request and an `AcpRequestContext` that carries the
 * method and the JSON-RPC id exactly as the client sent it. Registering a handler replaces the
 * previous one for that method; `handleCancel` handlers accumulate. A method without a handler
 * answers `-32601` (method not found).
 *
 * **Gotchas**
 *
 * The agent serves generation 2 only. Generation-1 methods (`authenticate`, `session/load`,
 * `session/set_mode`, client `fs/*` and `terminal/*`) are not part of this surface.
 *
 * **Example** (Access raw notifications stream)
 *
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
    /** Sends `session/request_permission` and waits for the client's decision. */
    readonly requestPermission: (
      payload: AcpSchema.RequestPermissionRequest
    ) => Effect.Effect<AcpSchema.RequestPermissionResponse, AcpError.AcpError>;
    /** Sends `elicitation/create` to request structured user input. */
    readonly elicit: (
      payload: AcpSchema.CreateElicitationRequest
    ) => Effect.Effect<AcpSchema.CreateElicitationResponse, AcpError.AcpError>;
    /** Sends a `session/update` notification. */
    readonly sessionUpdate: (payload: AcpSchema.UpdateSessionNotification) => Effect.Effect<void, AcpError.AcpError>;
    /** Sends an `elicitation/complete` notification. */
    readonly elicitationComplete: (
      payload: AcpSchema.CompleteElicitationNotification
    ) => Effect.Effect<void, AcpError.AcpError>;
    /** Sends an `mcp/message` request to an MCP server the client hosts (`serverId`). */
    readonly messageMcp: (
      payload: AcpSchema.MessageMcpRequest
    ) => Effect.Effect<AcpSchema.MessageMcpResponse, AcpError.AcpError>;
    /** Sends an ACP extension request to the client. */
    readonly extRequest: (method: string, payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
    /** Sends an ACP extension notification to the client. */
    readonly extNotification: (method: string, payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  };
  /** Registers the `auth/login` handler. */
  readonly handleAuthenticate: (
    handler: AcpRequestHandler<AcpSchema.LoginAuthRequest, AcpSchema.LoginAuthResponse>
  ) => Effect.Effect<void>;
  /** Adds a `session/cancel` notification handler; every registered handler runs, each isolated. */
  readonly handleCancel: (handler: AcpCancelHandler) => Effect.Effect<void>;
  /** Registers the `session/close` handler. */
  readonly handleCloseSession: (
    handler: AcpRequestHandler<AcpSchema.CloseSessionRequest, AcpSchema.CloseSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `session/new` handler. */
  readonly handleCreateSession: (
    handler: AcpRequestHandler<AcpSchema.NewSessionRequest, AcpSchema.NewSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `session/delete` handler. */
  readonly handleDeleteSession: (
    handler: AcpRequestHandler<AcpSchema.DeleteSessionRequest, AcpSchema.DeleteSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `providers/disable` handler. */
  readonly handleDisableProvider: (
    handler: AcpRequestHandler<AcpSchema.DisableProviderRequest, AcpSchema.DisableProviderResponse>
  ) => Effect.Effect<void>;
  /** Registers the `session/fork` handler. */
  readonly handleForkSession: (
    handler: AcpRequestHandler<AcpSchema.ForkSessionRequest, AcpSchema.ForkSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `initialize` handler. */
  readonly handleInitialize: (
    handler: AcpRequestHandler<AcpSchema.InitializeRequest, AcpSchema.InitializeResponse>
  ) => Effect.Effect<void>;
  /** Registers the `providers/list` handler. */
  readonly handleListProviders: (
    handler: AcpRequestHandler<AcpSchema.ListProvidersRequest, AcpSchema.ListProvidersResponse>
  ) => Effect.Effect<void>;
  /** Registers the `session/list` handler. */
  readonly handleListSessions: (
    handler: AcpRequestHandler<AcpSchema.ListSessionsRequest, AcpSchema.ListSessionsResponse>
  ) => Effect.Effect<void>;
  /**
   * Registers the handler for `session/resume` requests that replay from the start
   * (`replayFrom: { type: "start" }`), the generation-2 form of loading a session.
   */
  readonly handleLoadSession: (
    handler: AcpRequestHandler<AcpSchema.ResumeSessionRequest, AcpSchema.ResumeSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `auth/logout` handler. */
  readonly handleLogout: (
    handler: AcpRequestHandler<AcpSchema.LogoutAuthRequest, AcpSchema.LogoutAuthResponse>
  ) => Effect.Effect<void>;
  /**
   * Registers the handler for `mcp/message` notifications the client sends for an active MCP
   * request; it replaces the previous one.
   */
  readonly handleMcpNotification: (
    handler: (notification: AcpSchema.MessageMcpNotification) => Effect.Effect<void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /** Registers the `session/prompt` handler. */
  readonly handlePrompt: (
    handler: AcpRequestHandler<AcpSchema.PromptRequest, AcpSchema.PromptResponse>
  ) => Effect.Effect<void>;
  /** Registers the handler for `session/resume` requests that do not replay from the start. */
  readonly handleResumeSession: (
    handler: AcpRequestHandler<AcpSchema.ResumeSessionRequest, AcpSchema.ResumeSessionResponse>
  ) => Effect.Effect<void>;
  /** Registers the `providers/set` handler. */
  readonly handleSetProvider: (
    handler: AcpRequestHandler<AcpSchema.SetProviderRequest, AcpSchema.SetProviderResponse>
  ) => Effect.Effect<void>;
  /** Registers the `session/set_config_option` handler. */
  readonly handleSetSessionConfigOption: (
    handler: AcpRequestHandler<AcpSchema.SetSessionConfigOptionRequest, AcpSchema.SetSessionConfigOptionResponse>
  ) => Effect.Effect<void>;
  readonly raw: {
    /** Stream of inbound ACP notifications observed on the connection. */
    readonly notifications: Stream.Stream<AcpProtocol.AcpIncomingNotification>;
    /** Sends a raw JSON-RPC request. */
    readonly request: (method: string, payload: unknown) => Effect.Effect<unknown, AcpError.AcpError>;
    /** Sends a raw JSON-RPC notification. */
    readonly notify: (method: string, payload: unknown) => Effect.Effect<void, AcpError.AcpError>;
  };
}

/**
 * Context service tag for an ACP agent.
 *
 * **Example** (Effect service for agent)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
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
  readonly closeSession?: AcpRequestHandler<AcpSchema.CloseSessionRequest, AcpSchema.CloseSessionResponse>;
  readonly createSession?: AcpRequestHandler<AcpSchema.NewSessionRequest, AcpSchema.NewSessionResponse>;
  readonly deleteSession?: AcpRequestHandler<AcpSchema.DeleteSessionRequest, AcpSchema.DeleteSessionResponse>;
  readonly disableProvider?: AcpRequestHandler<AcpSchema.DisableProviderRequest, AcpSchema.DisableProviderResponse>;
  readonly forkSession?: AcpRequestHandler<AcpSchema.ForkSessionRequest, AcpSchema.ForkSessionResponse>;
  readonly initialize?: AcpRequestHandler<AcpSchema.InitializeRequest, AcpSchema.InitializeResponse>;
  readonly listProviders?: AcpRequestHandler<AcpSchema.ListProvidersRequest, AcpSchema.ListProvidersResponse>;
  readonly listSessions?: AcpRequestHandler<AcpSchema.ListSessionsRequest, AcpSchema.ListSessionsResponse>;
  readonly loadSession?: AcpRequestHandler<AcpSchema.ResumeSessionRequest, AcpSchema.ResumeSessionResponse>;
  readonly login?: AcpRequestHandler<AcpSchema.LoginAuthRequest, AcpSchema.LoginAuthResponse>;
  readonly logout?: AcpRequestHandler<AcpSchema.LogoutAuthRequest, AcpSchema.LogoutAuthResponse>;
  readonly prompt?: AcpRequestHandler<AcpSchema.PromptRequest, AcpSchema.PromptResponse>;
  readonly resumeSession?: AcpRequestHandler<AcpSchema.ResumeSessionRequest, AcpSchema.ResumeSessionResponse>;
  readonly setProvider?: AcpRequestHandler<AcpSchema.SetProviderRequest, AcpSchema.SetProviderResponse>;
  readonly setSessionConfigOption?: AcpRequestHandler<
    AcpSchema.SetSessionConfigOptionRequest,
    AcpSchema.SetSessionConfigOptionResponse
  >;
}

type AcpCoreHandlerKey = keyof AcpCoreAgentRequestHandlers;
type AcpCoreHandler<K extends AcpCoreHandlerKey> = NonNullable<AcpCoreAgentRequestHandlers[K]>;

interface AcpRpcHandlerOptions {
  readonly requestId: RpcMessage.RequestId;
}

const decodeCancelNotification = S.decodeUnknownEffect(AcpSchema.CancelSessionNotification);

const replaysFromStart = (request: AcpSchema.ResumeSessionRequest): boolean =>
  O.exists(O.fromNullishOr(request.replayFrom), (replayFrom) => replayFrom.type === "start");

const selectResumeHandler = (
  handlers: AcpCoreAgentRequestHandlers,
  request: AcpSchema.ResumeSessionRequest
): AcpCoreAgentRequestHandlers["resumeSession"] =>
  replaysFromStart(request)
    ? (handlers.loadSession ?? handlers.resumeSession)
    : (handlers.resumeSession ?? handlers.loadSession);

interface AcpAgentServerOptions {
  readonly coreHandlers: Ref.Ref<AcpCoreAgentRequestHandlers>;
  readonly serverProtocol: RpcServer.Protocol["Service"];
}

const serveAgentRpcs = Effect.fnUntraced(function* ({ coreHandlers, serverProtocol }: AcpAgentServerOptions) {
  const serve =
    <Request, Response>(
      method: string,
      select: (
        handlers: AcpCoreAgentRequestHandlers,
        request: Request
      ) => AcpRequestHandler<Request, Response> | undefined
    ) =>
    (payload: Request, { requestId }: AcpRpcHandlerOptions) =>
      Ref.get(coreHandlers).pipe(
        Effect.flatMap((handlers) =>
          runHandler({
            context: AcpProtocol.AcpRequestContext.make({ method, requestId }),
            handler: select(handlers, payload),
            method,
            payload,
          })
        )
      );

  const handlerLayer = AcpRpcs.AgentRpcs.toLayer(
    AcpRpcs.AgentRpcs.of({
      [AGENT_METHODS.initialize]: serve(AGENT_METHODS.initialize, ({ initialize }) => initialize),
      [AGENT_METHODS.auth_login]: serve(AGENT_METHODS.auth_login, ({ login }) => login),
      [AGENT_METHODS.auth_logout]: serve(AGENT_METHODS.auth_logout, ({ logout }) => logout),
      [AGENT_METHODS.session_new]: serve(AGENT_METHODS.session_new, ({ createSession }) => createSession),
      [AGENT_METHODS.session_list]: serve(AGENT_METHODS.session_list, ({ listSessions }) => listSessions),
      [AGENT_METHODS.session_fork]: serve(AGENT_METHODS.session_fork, ({ forkSession }) => forkSession),
      [AGENT_METHODS.session_resume]: serve(AGENT_METHODS.session_resume, selectResumeHandler),
      [AGENT_METHODS.session_close]: serve(AGENT_METHODS.session_close, ({ closeSession }) => closeSession),
      [AGENT_METHODS.session_delete]: serve(AGENT_METHODS.session_delete, ({ deleteSession }) => deleteSession),
      [AGENT_METHODS.providers_list]: serve(AGENT_METHODS.providers_list, ({ listProviders }) => listProviders),
      [AGENT_METHODS.providers_set]: serve(AGENT_METHODS.providers_set, ({ setProvider }) => setProvider),
      [AGENT_METHODS.providers_disable]: serve(
        AGENT_METHODS.providers_disable,
        ({ disableProvider }) => disableProvider
      ),
      [AGENT_METHODS.session_set_config_option]: serve(
        AGENT_METHODS.session_set_config_option,
        ({ setSessionConfigOption }) => setSessionConfigOption
      ),
      [AGENT_METHODS.session_prompt]: serve(AGENT_METHODS.session_prompt, ({ prompt }) => prompt),
    })
  );

  const scope = yield* Effect.scope;
  // decision: handler-defects-answer-their-own-request
  const serverContext = yield* Layer.buildWithScope(Layer.merge(handlerLayer, ErrorReporter.layer([])), scope);
  yield* RpcServer.make(AcpRpcs.AgentRpcs, { disableFatalDefects: true }).pipe(
    Effect.provideService(RpcServer.Protocol, serverProtocol),
    Effect.provide(serverContext),
    Effect.forkScoped
  );
});

/**
 * Constructs a generation-2 ACP agent from an Effect `Stdio` transport.
 *
 * **Details**
 *
 * Typed outbound requests use numeric JSON-RPC ids starting at `RPC_REQUEST_ID_START`
 * (`2 ** 30`), which stay inside the signed 32-bit range; raw extension requests count up from
 * `1`. Inbound ids are answered verbatim and never collide with pending outbound ids.
 *
 * **Example** (Make agent from Stdio)
 *
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
  const coreHandlers = yield* Ref.make<AcpCoreAgentRequestHandlers>({});
  const cancelHandlers = yield* Ref.make<ReadonlyArray<AcpCancelHandler>>([]);
  const extRequestHandlers = yield* Ref.make(HashMap.empty<string, ExtRequestHandler>());
  const extNotificationHandlers = yield* Ref.make(HashMap.empty<string, ExtNotificationHandler>());
  const unknownExtRequestHandler = yield* Ref.make(O.none<AcpProtocol.AcpUnknownExtRequestHandler>());
  const unknownExtNotificationHandler = yield* Ref.make(O.none<AcpProtocol.AcpUnknownExtNotificationHandler>());

  const runCancelHandlers = (notification: AcpSchema.CancelSessionNotification) =>
    Ref.get(cancelHandlers).pipe(
      Effect.flatMap((handlers) =>
        Effect.forEach(handlers, (handler) => isolateNotificationHandler(handler(notification)), {
          concurrency: 1,
          discard: true,
        })
      )
    );

  const runExtNotification = (method: string, params: unknown) =>
    Effect.all([Ref.get(extNotificationHandlers), Ref.get(unknownExtNotificationHandler)], { concurrency: 1 }).pipe(
      Effect.flatMap(([handlers, unknownHandler]) =>
        pipe(
          HashMap.get(handlers, method),
          O.map((handler) => handler(params)),
          O.orElse(() => O.map(unknownHandler, (handler) => handler(method, params))),
          O.getOrElse(thunkEffectVoid)
        )
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
    onNotification: AcpProtocol.AcpIncomingNotification.match({
      SessionUpdate: thunkEffectVoid,
      ElicitationComplete: thunkEffectVoid,
      ExtNotification: ({ method, params }) =>
        method === AGENT_METHODS.session_cancel
          ? decodeCancelNotification(params).pipe(
              Effect.mapError((error) =>
                AcpError.AcpProtocolParseError.fromSchemaError(
                  "decode-notification-payload",
                  AGENT_METHODS.session_cancel,
                  error
                )
              ),
              Effect.flatMap(runCancelHandlers)
            )
          : runExtNotification(method, params),
    }),
    onExtRequest: dispatchExtRequest({ extRequestHandlers, unknownExtRequestHandler }),
  });

  yield* serveAgentRpcs({ coreHandlers, serverProtocol: transport.serverProtocol });

  let nextRpcRequestId = AcpProtocol.RPC_REQUEST_ID_START;
  const rpc = yield* RpcClient.make(AcpRpcs.ClientRpcs, {
    generateRequestId: () => RpcMessage.RequestId(nextRpcRequestId++),
  }).pipe(Effect.provideService(RpcClient.Protocol, transport.clientProtocol));

  const register = <K extends AcpCoreHandlerKey>(key: K) =>
    Effect.fn($I`AcpAgent_handleCoreRequest`, { attributes: { "acp.handler": key } })((handler: AcpCoreHandler<K>) =>
      Ref.update(coreHandlers, (handlers): AcpCoreAgentRequestHandlers => ({ ...handlers, [key]: handler }))
    );

  const handleCancel = Effect.fn($I`AcpAgent_handleCancel`)((handler: AcpCancelHandler) =>
    Ref.update(cancelHandlers, A.append(handler))
  );

  const handleMcpNotification = Effect.fn($I`AcpAgent_handleMcpNotification`)(
    (handler: (notification: AcpSchema.MessageMcpNotification) => Effect.Effect<void, AcpError.AcpError>) =>
      extensionRegistrars.handleExtNotification(AGENT_METHODS.mcp_message, AcpSchema.MessageMcpNotification, handler)
  );

  const extensionRegistrars = makeExtensionRegistrars({
    extNotificationHandlers,
    extRequestHandlers,
    namePrefix: "AcpAgent",
    unknownExtNotificationHandler,
    unknownExtRequestHandler,
  });

  return AcpAgent.of({
    ...extensionRegistrars,
    raw: {
      notifications: transport.incoming,
      request: transport.request,
      notify: transport.notify,
    },
    client: {
      requestPermission: flow(
        rpc[CLIENT_METHODS.session_request_permission],
        callRpc(CLIENT_METHODS.session_request_permission)
      ),
      elicit: flow(rpc[CLIENT_METHODS.elicitation_create], callRpc(CLIENT_METHODS.elicitation_create)),
      sessionUpdate: transport.notify(CLIENT_METHODS.session_update),
      elicitationComplete: transport.notify(CLIENT_METHODS.elicitation_complete),
      messageMcp: flow(rpc[CLIENT_METHODS.mcp_message], callRpc(CLIENT_METHODS.mcp_message)),
      extRequest: transport.request,
      extNotification: transport.notify,
    },
    handleInitialize: register("initialize"),
    handleAuthenticate: register("login"),
    handleLogout: register("logout"),
    handleCreateSession: register("createSession"),
    handleLoadSession: register("loadSession"),
    handleListSessions: register("listSessions"),
    handleForkSession: register("forkSession"),
    handleResumeSession: register("resumeSession"),
    handleCloseSession: register("closeSession"),
    handleDeleteSession: register("deleteSession"),
    handleListProviders: register("listProviders"),
    handleSetProvider: register("setProvider"),
    handleDisableProvider: register("disableProvider"),
    handleSetSessionConfigOption: register("setSessionConfigOption"),
    handlePrompt: register("prompt"),
    handleCancel,
    handleMcpNotification,
  });
});

/**
 * Transport plus agent options accepted by {@link layer}.
 *
 * **Example** (Configuring an ACP agent layer)
 *
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
 * **Example** (Layer over Stdio transport)
 *
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
 * **Example** (Layer from Stdio service)
 *
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
