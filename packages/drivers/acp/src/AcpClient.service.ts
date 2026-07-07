/**
 * ACP client service and child-process layer constructors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AcpId } from "@beep/identity";
import { A, thunkEffectVoid } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Context, Effect, flow, HashMap, HashSet, Layer, Match, Ref } from "effect";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcMessage from "effect/unstable/rpc/RpcMessage";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { AGENT_METHODS, CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpError from "./Acp.errors.ts";
import * as AcpProtocol from "./AcpProtocol.service.ts";
import * as AcpRpcs from "./AcpRpc.models.ts";
import { callRpc, makeExtensionRegistrars, runHandler } from "./internal/shared.ts";
import { makeChildStdio, makeTerminationError } from "./internal/stdio.ts";
import type * as Scope from "effect/Scope";
import type * as Stdio from "effect/Stdio";
import type * as Stream from "effect/Stream";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type * as AcpSchema from "./_generated/schema.gen.ts";
import type { AcpPatchedProtocol } from "./AcpProtocol.service.ts";

const $I = $AcpId.create("client");
const ACP_CLIENT_PENDING_NOTIFICATION_CAPACITY = 256;

/**
 * Builds the typed ACP process-exit error used by child-process transports.
 *
 * @example
 * ```ts
 * import { makeTerminationError } from "@beep/acp/client"
 * import type { ChildProcessSpawner } from "effect/unstable/process"
 *
 * const toTerminationError = (handle: ChildProcessSpawner.ChildProcessHandle) => makeTerminationError(handle)
 * console.log(toTerminationError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export { makeTerminationError } from "./internal/stdio.ts";

/**
 * Options for constructing an ACP client service.
 *
 * @example
 * ```ts
 * import type { AcpClientOptions } from "@beep/acp/client"
 *
 * const options: AcpClientOptions = { logOutgoing: true }
 * console.log(options.logOutgoing)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpClientOptions extends AcpProtocol.AcpProtocolLoggingOptions {
  readonly logger?: (event: AcpProtocol.AcpProtocolLogEvent) => Effect.Effect<void>;
}

type AcpClientRaw = {
  readonly notifications: Stream.Stream<AcpProtocol.AcpIncomingNotification>;
  readonly request: AcpPatchedProtocol["request"];
  readonly notify: AcpPatchedProtocol["notify"];
};

/**
 * Service shape implemented by the ACP client driver.
 *
 * @example
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
  readonly agent: {
    /**
     * Initializes the ACP session and negotiates capabilities.
     * @see https://agentclientprotocol.com/protocol/schema#initialize
     */
    readonly initialize: (
      payload: AcpSchema.InitializeRequest
    ) => Effect.Effect<AcpSchema.InitializeResponse, AcpError.AcpError>;
    /**
     * Performs ACP authentication when the agent requires it.
     * @see https://agentclientprotocol.com/protocol/schema#authenticate
     */
    readonly authenticate: (
      payload: AcpSchema.AuthenticateRequest
    ) => Effect.Effect<AcpSchema.AuthenticateResponse, AcpError.AcpError>;
    /**
     * Logs out the current ACP identity.
     * @see https://agentclientprotocol.com/protocol/schema#logout
     */
    readonly logout: (payload: AcpSchema.LogoutRequest) => Effect.Effect<AcpSchema.LogoutResponse, AcpError.AcpError>;
    /**
     * Starts a new ACP session.
     * @see https://agentclientprotocol.com/protocol/schema#session/new
     */
    readonly createSession: (
      payload: AcpSchema.NewSessionRequest
    ) => Effect.Effect<AcpSchema.NewSessionResponse, AcpError.AcpError>;
    /**
     * Loads a previously saved ACP session.
     * @see https://agentclientprotocol.com/protocol/schema#session/load
     */
    readonly loadSession: (
      payload: AcpSchema.LoadSessionRequest
    ) => Effect.Effect<AcpSchema.LoadSessionResponse, AcpError.AcpError>;
    /**
     * Lists available ACP sessions.
     * @see https://agentclientprotocol.com/protocol/schema#session/list
     */
    readonly listSessions: (
      payload: AcpSchema.ListSessionsRequest
    ) => Effect.Effect<AcpSchema.ListSessionsResponse, AcpError.AcpError>;
    /**
     * Forks an ACP session.
     * @see https://agentclientprotocol.com/protocol/schema#session/fork
     */
    readonly forkSession: (
      payload: AcpSchema.ForkSessionRequest
    ) => Effect.Effect<AcpSchema.ForkSessionResponse, AcpError.AcpError>;
    /**
     * Resumes an ACP session.
     * @see https://agentclientprotocol.com/protocol/schema#session/resume
     */
    readonly resumeSession: (
      payload: AcpSchema.ResumeSessionRequest
    ) => Effect.Effect<AcpSchema.ResumeSessionResponse, AcpError.AcpError>;
    /**
     * Closes an ACP session.
     * @see https://agentclientprotocol.com/protocol/schema#session/close
     */
    readonly closeSession: (
      payload: AcpSchema.CloseSessionRequest
    ) => Effect.Effect<AcpSchema.CloseSessionResponse, AcpError.AcpError>;
    /**
     * Selects the active model for a session.
     * @see https://agentclientprotocol.com/protocol/schema#session/set_model
     */
    readonly setSessionModel: (
      payload: AcpSchema.SetSessionModelRequest
    ) => Effect.Effect<AcpSchema.SetSessionModelResponse, AcpError.AcpError>;
    /**
     * Updates a session configuration option.
     * @see https://agentclientprotocol.com/protocol/schema#session/set_config_option
     */
    readonly setSessionConfigOption: (
      payload: AcpSchema.SetSessionConfigOptionRequest
    ) => Effect.Effect<AcpSchema.SetSessionConfigOptionResponse, AcpError.AcpError>;
    /**
     * Sends a prompt turn to the agent.
     * @see https://agentclientprotocol.com/protocol/schema#session/prompt
     */
    readonly prompt: (payload: AcpSchema.PromptRequest) => Effect.Effect<AcpSchema.PromptResponse, AcpError.AcpError>;
    /**
     * Sends a real ACP `session/cancel` notification.
     * @see https://agentclientprotocol.com/protocol/schema#session/cancel
     */
    readonly cancel: (payload: AcpSchema.CancelNotification) => Effect.Effect<void, AcpError.AcpError>;
  };
  /**
   * Registers a handler for `terminal/create`.
   * @see https://agentclientprotocol.com/protocol/schema#terminal/create
   */
  readonly handleCreateTerminal: (
    handler: (
      request: AcpSchema.CreateTerminalRequest
    ) => Effect.Effect<AcpSchema.CreateTerminalResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `session/elicitation`.
   * @see https://agentclientprotocol.com/protocol/schema#session/elicitation
   */
  readonly handleElicitation: (
    handler: (request: AcpSchema.ElicitationRequest) => Effect.Effect<AcpSchema.ElicitationResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `session/elicitation/complete`.
   * @see https://agentclientprotocol.com/protocol/schema#session/elicitation/complete
   */
  readonly handleElicitationComplete: (
    handler: (notification: AcpSchema.ElicitationCompleteNotification) => Effect.Effect<void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `fs/read_text_file`.
   * @see https://agentclientprotocol.com/protocol/schema#fs/read_text_file
   */
  readonly handleReadTextFile: (
    handler: (
      request: AcpSchema.ReadTextFileRequest
    ) => Effect.Effect<AcpSchema.ReadTextFileResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `session/request_permission`.
   * @see https://agentclientprotocol.com/protocol/schema#session/request_permission
   */
  readonly handleRequestPermission: (
    handler: (
      request: AcpSchema.RequestPermissionRequest
    ) => Effect.Effect<AcpSchema.RequestPermissionResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `session/update`.
   * @see https://agentclientprotocol.com/protocol/schema#session/update
   */
  readonly handleSessionUpdate: (
    handler: (notification: AcpSchema.SessionNotification) => Effect.Effect<void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `terminal/kill`.
   * @see https://agentclientprotocol.com/protocol/schema#terminal/kill
   */
  readonly handleTerminalKill: (
    handler: (
      request: AcpSchema.KillTerminalRequest
    ) => Effect.Effect<AcpSchema.KillTerminalResponse | void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `terminal/output`.
   * @see https://agentclientprotocol.com/protocol/schema#terminal/output
   */
  readonly handleTerminalOutput: (
    handler: (
      request: AcpSchema.TerminalOutputRequest
    ) => Effect.Effect<AcpSchema.TerminalOutputResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `terminal/release`.
   * @see https://agentclientprotocol.com/protocol/schema#terminal/release
   */
  readonly handleTerminalRelease: (
    handler: (
      request: AcpSchema.ReleaseTerminalRequest
    ) => Effect.Effect<AcpSchema.ReleaseTerminalResponse | void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `terminal/wait_for_exit`.
   * @see https://agentclientprotocol.com/protocol/schema#terminal/wait_for_exit
   */
  readonly handleTerminalWaitForExit: (
    handler: (
      request: AcpSchema.WaitForTerminalExitRequest
    ) => Effect.Effect<AcpSchema.WaitForTerminalExitResponse, AcpError.AcpError>
  ) => Effect.Effect<void>;
  /**
   * Registers a handler for `fs/write_text_file`.
   * @see https://agentclientprotocol.com/protocol/schema#fs/write_text_file
   */
  readonly handleWriteTextFile: (
    handler: (
      request: AcpSchema.WriteTextFileRequest
    ) => Effect.Effect<AcpSchema.WriteTextFileResponse | void, AcpError.AcpError>
  ) => Effect.Effect<void>;
  readonly raw: AcpClientRaw;
}

/**
 * Context service tag for an ACP client.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
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
  createTerminal?: (
    request: AcpSchema.CreateTerminalRequest
  ) => Effect.Effect<AcpSchema.CreateTerminalResponse, AcpError.AcpError>;
  elicitation?: (
    request: AcpSchema.ElicitationRequest
  ) => Effect.Effect<AcpSchema.ElicitationResponse, AcpError.AcpError>;
  readTextFile?: (
    request: AcpSchema.ReadTextFileRequest
  ) => Effect.Effect<AcpSchema.ReadTextFileResponse, AcpError.AcpError>;
  requestPermission?: (
    request: AcpSchema.RequestPermissionRequest
  ) => Effect.Effect<AcpSchema.RequestPermissionResponse, AcpError.AcpError>;
  terminalKill?: (
    request: AcpSchema.KillTerminalRequest
  ) => Effect.Effect<AcpSchema.KillTerminalResponse | void, AcpError.AcpError>;
  terminalOutput?: (
    request: AcpSchema.TerminalOutputRequest
  ) => Effect.Effect<AcpSchema.TerminalOutputResponse, AcpError.AcpError>;
  terminalRelease?: (
    request: AcpSchema.ReleaseTerminalRequest
  ) => Effect.Effect<AcpSchema.ReleaseTerminalResponse | void, AcpError.AcpError>;
  terminalWaitForExit?: (
    request: AcpSchema.WaitForTerminalExitRequest
  ) => Effect.Effect<AcpSchema.WaitForTerminalExitResponse, AcpError.AcpError>;
  writeTextFile?: (
    request: AcpSchema.WriteTextFileRequest
  ) => Effect.Effect<AcpSchema.WriteTextFileResponse | void, AcpError.AcpError>;
}

interface AcpNotificationHandlers {
  readonly elicitationComplete: BufferedNotificationHandler<AcpSchema.ElicitationCompleteNotification>;
  readonly sessionUpdate: BufferedNotificationHandler<AcpSchema.SessionNotification>;
}

interface BufferedNotificationHandler<A> {
  readonly handlers: Array<(notification: A) => Effect.Effect<void, AcpError.AcpError>>;
  readonly pending: Array<A>;
}

/**
 * Constructs an ACP client from an Effect `Stdio` transport.
 *
 * @example
 * ```ts
 * import type * as Stdio from "effect/Stdio"
 * import { make } from "@beep/acp/client"
 *
 * const fromStdio = (stdio: Stdio.Stdio) => make(stdio)
 * console.log(fromStdio)
 * ```
 *
 * @effects Builds client and server RPC handlers, registers scoped protocol
 * fibers, buffers inbound notifications, and communicates through the supplied
 * `Stdio` transport when the returned Effect runs.
 * @category constructors
 * @since 0.0.0
 */
export const make = Effect.fn($I`AcpClient_make`)(function* (
  stdio: Stdio.Stdio,
  options: AcpClientOptions = {},
  terminationError?: Effect.Effect<AcpError.AcpError>
): Effect.fn.Return<AcpClientShape, never, Scope.Scope> {
  const coreHandlers: AcpCoreRequestHandlers = {};
  const notificationHandlers: AcpNotificationHandlers = {
    sessionUpdate: { handlers: [], pending: [] },
    elicitationComplete: { handlers: [], pending: [] },
  };
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

  const logNotificationHandlerFailure = (method: string) => (error: AcpError.AcpError) =>
    Effect.logWarning("ACP client notification handler failed").pipe(
      Effect.annotateLogs({
        errorMessage: error.message,
        errorTag: error._tag,
        method,
      })
    );

  const runNotificationHandlers = <A>(method: string, registration: BufferedNotificationHandler<A>, notification: A) =>
    Effect.forEach(
      registration.handlers,
      (handler) =>
        handler(notification).pipe(
          Effect.tapError(logNotificationHandlerFailure(method)),
          Effect.catch(thunkEffectVoid)
        ),
      {
        discard: true,
      }
    );

  const bufferNotification = <A>(registration: BufferedNotificationHandler<A>, notification: A) =>
    Effect.sync(() => {
      if (registration.pending.length >= ACP_CLIENT_PENDING_NOTIFICATION_CAPACITY) {
        registration.pending.splice(0, registration.pending.length - ACP_CLIENT_PENDING_NOTIFICATION_CAPACITY + 1);
      }
      A.appendInPlace(registration.pending, notification);
    });

  const flushBufferedNotifications = <A>(method: string, registration: BufferedNotificationHandler<A>) =>
    Effect.suspend(() => {
      if (registration.handlers.length === 0 || registration.pending.length === 0) {
        return Effect.void;
      }
      const pending = A.spliceInPlace(registration.pending, 0, A.length(registration.pending));
      return Effect.forEach(pending, (notification) => runNotificationHandlers(method, registration, notification), {
        discard: true,
      });
    });

  const dispatchNotification = Match.type<AcpProtocol.AcpIncomingNotification>().pipe(
    Match.tagsExhaustive({
      SessionUpdate: (value) => {
        if (notificationHandlers.sessionUpdate.handlers.length === 0) {
          return bufferNotification(notificationHandlers.sessionUpdate, value.params);
        }
        return runNotificationHandlers(value.method, notificationHandlers.sessionUpdate, value.params);
      },
      ElicitationComplete: (value) => {
        if (notificationHandlers.elicitationComplete.handlers.length === 0) {
          return bufferNotification(notificationHandlers.elicitationComplete, value.params);
        }
        return runNotificationHandlers(value.method, notificationHandlers.elicitationComplete, value.params);
      },
      ExtNotification: (value) =>
        Ref.get(extNotificationHandlers).pipe(
          Effect.flatMap((handlers) =>
            O.match(HashMap.get(handlers, value.method), {
              onNone: () => runUnknownExtNotification(value.method, value.params),
              onSome: (handler) => handler(value.params),
            })
          )
        ),
    })
  );

  const dispatchExtRequest = (method: string, params: unknown) =>
    Ref.get(extRequestHandlers).pipe(
      Effect.flatMap((handlers) =>
        O.match(HashMap.get(handlers, method), {
          onNone: () => runUnknownExtRequest(method, params),
          onSome: (handler) => handler(params),
        })
      )
    );

  const transport = yield* AcpProtocol.makeAcpPatchedProtocol({
    stdio: stdio,
    serverRequestMethods: HashSet.fromIterable(AcpRpcs.ClientRpcs.requests.keys()),
    ...O.getSomesStruct({
      terminationError: O.fromUndefinedOr(terminationError),
      logIncoming: O.fromUndefinedOr(options.logIncoming),
      logOutgoing: O.fromUndefinedOr(options.logOutgoing),
      logger: O.fromUndefinedOr(options.logger),
    }),
    onNotification: dispatchNotification,
    onExtRequest: dispatchExtRequest,
  });

  const clientHandlerLayer = AcpRpcs.ClientRpcs.toLayer(
    AcpRpcs.ClientRpcs.of({
      [CLIENT_METHODS.session_request_permission]: (payload) =>
        runHandler({
          handler: coreHandlers.requestPermission,
          method: CLIENT_METHODS.session_request_permission,
          payload,
        }),
      [CLIENT_METHODS.session_elicitation]: (payload) =>
        runHandler({
          handler: coreHandlers.elicitation,
          method: CLIENT_METHODS.session_elicitation,
          payload,
        }),
      [CLIENT_METHODS.fs_read_text_file]: (payload) =>
        runHandler({
          handler: coreHandlers.readTextFile,
          method: CLIENT_METHODS.fs_read_text_file,
          payload,
        }),
      [CLIENT_METHODS.fs_write_text_file]: (payload) =>
        runHandler({
          handler: coreHandlers.writeTextFile,
          method: CLIENT_METHODS.fs_write_text_file,
          payload,
        }).pipe(Effect.map((result) => result ?? {})),
      [CLIENT_METHODS.terminal_create]: (payload) =>
        runHandler({
          handler: coreHandlers.createTerminal,
          method: CLIENT_METHODS.terminal_create,
          payload,
        }),
      [CLIENT_METHODS.terminal_output]: (payload) =>
        runHandler({
          handler: coreHandlers.terminalOutput,
          method: CLIENT_METHODS.terminal_output,
          payload,
        }),
      [CLIENT_METHODS.terminal_wait_for_exit]: (payload) =>
        runHandler({
          handler: coreHandlers.terminalWaitForExit,
          method: CLIENT_METHODS.terminal_wait_for_exit,
          payload,
        }),
      [CLIENT_METHODS.terminal_kill]: (payload) =>
        runHandler({
          handler: coreHandlers.terminalKill,
          method: CLIENT_METHODS.terminal_kill,
          payload,
        }).pipe(Effect.map((result) => result ?? {})),
      [CLIENT_METHODS.terminal_release]: (payload) =>
        runHandler({
          handler: coreHandlers.terminalRelease,
          method: CLIENT_METHODS.terminal_release,
          payload,
        }).pipe(Effect.map((result) => result ?? {})),
    })
  );

  const scope = yield* Effect.scope;
  const clientHandlerContext = yield* Layer.buildWithScope(clientHandlerLayer, scope);
  yield* RpcServer.make(AcpRpcs.ClientRpcs).pipe(
    Effect.provideService(RpcServer.Protocol, transport.serverProtocol),
    Effect.provide(clientHandlerContext),
    Effect.forkScoped
  );

  let nextRpcRequestId = BigInt(1) << BigInt(32);
  const rpc = yield* RpcClient.make(AcpRpcs.AgentRpcs, {
    generateRequestId: () => RpcMessage.RequestId(nextRpcRequestId++),
  }).pipe(Effect.provideService(RpcClient.Protocol, transport.clientProtocol));

  const handleRequestPermission = Effect.fn($I`AcpClient_handleRequestPermission`)(
    (handler: NonNullable<AcpCoreRequestHandlers["requestPermission"]>) =>
      Effect.sync(() => {
        coreHandlers.requestPermission = handler;
      })
  );
  const handleElicitation = Effect.fn($I`AcpClient_handleElicitation`)(
    (handler: NonNullable<AcpCoreRequestHandlers["elicitation"]>) =>
      Effect.sync(() => {
        coreHandlers.elicitation = handler;
      })
  );
  const handleReadTextFile = Effect.fn($I`AcpClient_handleReadTextFile`)(
    (handler: NonNullable<AcpCoreRequestHandlers["readTextFile"]>) =>
      Effect.sync(() => {
        coreHandlers.readTextFile = handler;
      })
  );
  const handleWriteTextFile = Effect.fn($I`AcpClient_handleWriteTextFile`)(
    (handler: NonNullable<AcpCoreRequestHandlers["writeTextFile"]>) =>
      Effect.sync(() => {
        coreHandlers.writeTextFile = handler;
      })
  );
  const handleCreateTerminal = Effect.fn($I`AcpClient_handleCreateTerminal`)(
    (handler: NonNullable<AcpCoreRequestHandlers["createTerminal"]>) =>
      Effect.sync(() => {
        coreHandlers.createTerminal = handler;
      })
  );
  const handleTerminalOutput = Effect.fn($I`AcpClient_handleTerminalOutput`)(
    (handler: NonNullable<AcpCoreRequestHandlers["terminalOutput"]>) =>
      Effect.sync(() => {
        coreHandlers.terminalOutput = handler;
      })
  );
  const handleTerminalWaitForExit = Effect.fn($I`AcpClient_handleTerminalWaitForExit`)(
    (handler: NonNullable<AcpCoreRequestHandlers["terminalWaitForExit"]>) =>
      Effect.sync(() => {
        coreHandlers.terminalWaitForExit = handler;
      })
  );
  const handleTerminalKill = Effect.fn($I`AcpClient_handleTerminalKill`)(
    (handler: NonNullable<AcpCoreRequestHandlers["terminalKill"]>) =>
      Effect.sync(() => {
        coreHandlers.terminalKill = handler;
      })
  );
  const handleTerminalRelease = Effect.fn($I`AcpClient_handleTerminalRelease`)(
    (handler: NonNullable<AcpCoreRequestHandlers["terminalRelease"]>) =>
      Effect.sync(() => {
        coreHandlers.terminalRelease = handler;
      })
  );
  const handleSessionUpdate = Effect.fn($I`AcpClient_handleSessionUpdate`)(function* (
    handler: (notification: AcpSchema.SessionNotification) => Effect.Effect<void, AcpError.AcpError>
  ) {
    A.appendInPlace(notificationHandlers.sessionUpdate.handlers, handler);
    yield* flushBufferedNotifications(CLIENT_METHODS.session_update, notificationHandlers.sessionUpdate);
  });
  const handleElicitationComplete = Effect.fn($I`AcpClient_handleElicitationComplete`)(function* (
    handler: (notification: AcpSchema.ElicitationCompleteNotification) => Effect.Effect<void, AcpError.AcpError>
  ) {
    A.appendInPlace(notificationHandlers.elicitationComplete.handlers, handler);
    yield* flushBufferedNotifications(
      CLIENT_METHODS.session_elicitation_complete,
      notificationHandlers.elicitationComplete
    );
  });
  const { handleExtNotification, handleExtRequest, handleUnknownExtNotification, handleUnknownExtRequest } =
    makeExtensionRegistrars({
      extNotificationHandlers,
      extRequestHandlers,
      namePrefix: "AcpClient",
      unknownExtNotificationHandler,
      unknownExtRequestHandler,
    });

  return AcpClient.of({
    raw: {
      notifications: transport.incoming,
      request: transport.request,
      notify: transport.notify,
    },
    agent: {
      initialize: flow(rpc[AGENT_METHODS.initialize], callRpc),
      authenticate: flow(rpc[AGENT_METHODS.authenticate], callRpc),
      logout: flow(rpc[AGENT_METHODS.logout], callRpc),
      createSession: flow(rpc[AGENT_METHODS.session_new], callRpc),
      loadSession: flow(rpc[AGENT_METHODS.session_load], callRpc),
      listSessions: flow(rpc[AGENT_METHODS.session_list], callRpc),
      forkSession: flow(rpc[AGENT_METHODS.session_fork], callRpc),
      resumeSession: flow(rpc[AGENT_METHODS.session_resume], callRpc),
      closeSession: flow(rpc[AGENT_METHODS.session_close], callRpc),
      setSessionModel: flow(rpc[AGENT_METHODS.session_set_model], callRpc),
      setSessionConfigOption: flow(rpc[AGENT_METHODS.session_set_config_option], callRpc),
      prompt: flow(rpc[AGENT_METHODS.session_prompt], callRpc),
      cancel: transport.notify(AGENT_METHODS.session_cancel),
    },
    handleRequestPermission,
    handleElicitation,
    handleReadTextFile,
    handleWriteTextFile,
    handleCreateTerminal,
    handleTerminalOutput,
    handleTerminalWaitForExit,
    handleTerminalKill,
    handleTerminalRelease,
    handleSessionUpdate,
    handleElicitationComplete,
    handleUnknownExtRequest,
    handleUnknownExtNotification,
    handleExtRequest,
    handleExtNotification,
  });
});

/**
 * Constructs an ACP client layer backed by a spawned child process.
 *
 * @example
 * ```ts
 * import type { ChildProcessSpawner } from "effect/unstable/process"
 * import { layerChildProcess } from "@beep/acp/client"
 *
 * const fromHandle = (handle: ChildProcessSpawner.ChildProcessHandle) => layerChildProcess(handle)
 * console.log(fromHandle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerChildProcess = (
  handle: ChildProcessSpawner.ChildProcessHandle,
  options: AcpClientOptions = {}
): Layer.Layer<AcpClient> => {
  const stdio = makeChildStdio(handle);
  const terminationError = makeTerminationError(handle);
  return Layer.effect(AcpClient, make(stdio, options, terminationError));
};
