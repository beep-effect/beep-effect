/**
 * ACP RPC definitions for the technical driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { AGENT_METHODS, CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";

/**
 * RPC definition for `InitializeRpc`.
 *
 * **Example** (Log InitializeRpc method key)
 *
 * ```ts
 * import { InitializeRpc } from "@beep/acp/rpc"
 *
 * const method = InitializeRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const InitializeRpc = Rpc.make(AGENT_METHODS.initialize, {
  payload: AcpSchema.InitializeRequest,
  success: AcpSchema.InitializeResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `AuthenticateRpc`.
 *
 * **Example** (Log AuthenticateRpc method key)
 *
 * ```ts
 * import { AuthenticateRpc } from "@beep/acp/rpc"
 *
 * const method = AuthenticateRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const AuthenticateRpc = Rpc.make(AGENT_METHODS.authenticate, {
  payload: AcpSchema.AuthenticateRequest,
  success: AcpSchema.AuthenticateResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `LogoutRpc`.
 *
 * **Example** (Log LogoutRpc method key)
 *
 * ```ts
 * import { LogoutRpc } from "@beep/acp/rpc"
 *
 * const method = LogoutRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const LogoutRpc = Rpc.make(AGENT_METHODS.logout, {
  payload: AcpSchema.LogoutRequest,
  success: AcpSchema.LogoutResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `NewSessionRpc`.
 *
 * **Example** (Log NewSessionRpc method key)
 *
 * ```ts
 * import { NewSessionRpc } from "@beep/acp/rpc"
 *
 * const method = NewSessionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const NewSessionRpc = Rpc.make(AGENT_METHODS.session_new, {
  payload: AcpSchema.NewSessionRequest,
  success: AcpSchema.NewSessionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `LoadSessionRpc`.
 *
 * **Example** (Log LoadSessionRpc method key)
 *
 * ```ts
 * import { LoadSessionRpc } from "@beep/acp/rpc"
 *
 * const method = LoadSessionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const LoadSessionRpc = Rpc.make(AGENT_METHODS.session_load, {
  payload: AcpSchema.LoadSessionRequest,
  success: AcpSchema.LoadSessionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ListSessionsRpc`.
 *
 * **Example** (Log ListSessionsRpc method key)
 *
 * ```ts
 * import { ListSessionsRpc } from "@beep/acp/rpc"
 *
 * const method = ListSessionsRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ListSessionsRpc = Rpc.make(AGENT_METHODS.session_list, {
  payload: AcpSchema.ListSessionsRequest,
  success: AcpSchema.ListSessionsResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ForkSessionRpc`.
 *
 * **Example** (Log ForkSessionRpc method key)
 *
 * ```ts
 * import { ForkSessionRpc } from "@beep/acp/rpc"
 *
 * const method = ForkSessionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ForkSessionRpc = Rpc.make(AGENT_METHODS.session_fork, {
  payload: AcpSchema.ForkSessionRequest,
  success: AcpSchema.ForkSessionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ResumeSessionRpc`.
 *
 * **Example** (Log ResumeSessionRpc method key)
 *
 * ```ts
 * import { ResumeSessionRpc } from "@beep/acp/rpc"
 *
 * const method = ResumeSessionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ResumeSessionRpc = Rpc.make(AGENT_METHODS.session_resume, {
  payload: AcpSchema.ResumeSessionRequest,
  success: AcpSchema.ResumeSessionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `CloseSessionRpc`.
 *
 * **Example** (Log CloseSessionRpc method key)
 *
 * ```ts
 * import { CloseSessionRpc } from "@beep/acp/rpc"
 *
 * const method = CloseSessionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CloseSessionRpc = Rpc.make(AGENT_METHODS.session_close, {
  payload: AcpSchema.CloseSessionRequest,
  success: AcpSchema.CloseSessionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `PromptRpc`.
 *
 * **Example** (Log PromptRpc method key)
 *
 * ```ts
 * import { PromptRpc } from "@beep/acp/rpc"
 *
 * const method = PromptRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const PromptRpc = Rpc.make(AGENT_METHODS.session_prompt, {
  payload: AcpSchema.PromptRequest,
  success: AcpSchema.PromptResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `SetSessionModelRpc`.
 *
 * **Example** (Log SetSessionModelRpc method key)
 *
 * ```ts
 * import { SetSessionModelRpc } from "@beep/acp/rpc"
 *
 * const method = SetSessionModelRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const SetSessionModelRpc = Rpc.make(AGENT_METHODS.session_set_model, {
  payload: AcpSchema.SetSessionModelRequest,
  success: AcpSchema.SetSessionModelResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `SetSessionConfigOptionRpc`.
 *
 * **Example** (Log SetSessionConfigOptionRpc key)
 *
 * ```ts
 * import { SetSessionConfigOptionRpc } from "@beep/acp/rpc"
 *
 * const method = SetSessionConfigOptionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const SetSessionConfigOptionRpc = Rpc.make(AGENT_METHODS.session_set_config_option, {
  payload: AcpSchema.SetSessionConfigOptionRequest,
  success: AcpSchema.SetSessionConfigOptionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ReadTextFileRpc`.
 *
 * **Example** (Log ReadTextFileRpc method key)
 *
 * ```ts
 * import { ReadTextFileRpc } from "@beep/acp/rpc"
 *
 * const method = ReadTextFileRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ReadTextFileRpc = Rpc.make(CLIENT_METHODS.fs_read_text_file, {
  payload: AcpSchema.ReadTextFileRequest,
  success: AcpSchema.ReadTextFileResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `WriteTextFileRpc`.
 *
 * **Example** (Log WriteTextFileRpc method key)
 *
 * ```ts
 * import { WriteTextFileRpc } from "@beep/acp/rpc"
 *
 * const method = WriteTextFileRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const WriteTextFileRpc = Rpc.make(CLIENT_METHODS.fs_write_text_file, {
  payload: AcpSchema.WriteTextFileRequest,
  success: AcpSchema.WriteTextFileResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `RequestPermissionRpc`.
 *
 * **Example** (Log RequestPermissionRpc method key)
 *
 * ```ts
 * import { RequestPermissionRpc } from "@beep/acp/rpc"
 *
 * const method = RequestPermissionRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const RequestPermissionRpc = Rpc.make(CLIENT_METHODS.session_request_permission, {
  payload: AcpSchema.RequestPermissionRequest,
  success: AcpSchema.RequestPermissionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ElicitationRpc`.
 *
 * **Example** (Log ElicitationRpc method key)
 *
 * ```ts
 * import { ElicitationRpc } from "@beep/acp/rpc"
 *
 * const method = ElicitationRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ElicitationRpc = Rpc.make(CLIENT_METHODS.session_elicitation, {
  payload: AcpSchema.ElicitationRequest,
  success: AcpSchema.ElicitationResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `CreateTerminalRpc`.
 *
 * **Example** (Log CreateTerminalRpc method key)
 *
 * ```ts
 * import { CreateTerminalRpc } from "@beep/acp/rpc"
 *
 * const method = CreateTerminalRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CreateTerminalRpc = Rpc.make(CLIENT_METHODS.terminal_create, {
  payload: AcpSchema.CreateTerminalRequest,
  success: AcpSchema.CreateTerminalResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `TerminalOutputRpc`.
 *
 * **Example** (Log TerminalOutputRpc method key)
 *
 * ```ts
 * import { TerminalOutputRpc } from "@beep/acp/rpc"
 *
 * const method = TerminalOutputRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const TerminalOutputRpc = Rpc.make(CLIENT_METHODS.terminal_output, {
  payload: AcpSchema.TerminalOutputRequest,
  success: AcpSchema.TerminalOutputResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `ReleaseTerminalRpc`.
 *
 * **Example** (Log ReleaseTerminalRpc method key)
 *
 * ```ts
 * import { ReleaseTerminalRpc } from "@beep/acp/rpc"
 *
 * const method = ReleaseTerminalRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ReleaseTerminalRpc = Rpc.make(CLIENT_METHODS.terminal_release, {
  payload: AcpSchema.ReleaseTerminalRequest,
  success: AcpSchema.ReleaseTerminalResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `WaitForTerminalExitRpc`.
 *
 * **Example** (Log WaitForTerminalExitRpc key)
 *
 * ```ts
 * import { WaitForTerminalExitRpc } from "@beep/acp/rpc"
 *
 * const method = WaitForTerminalExitRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const WaitForTerminalExitRpc = Rpc.make(CLIENT_METHODS.terminal_wait_for_exit, {
  payload: AcpSchema.WaitForTerminalExitRequest,
  success: AcpSchema.WaitForTerminalExitResponse,
  error: AcpSchema.Error,
});

/**
 * RPC definition for `KillTerminalRpc`.
 *
 * **Example** (Log KillTerminalRpc method key)
 *
 * ```ts
 * import { KillTerminalRpc } from "@beep/acp/rpc"
 *
 * const method = KillTerminalRpc.key
 * console.log(method)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const KillTerminalRpc = Rpc.make(CLIENT_METHODS.terminal_kill, {
  payload: AcpSchema.KillTerminalRequest,
  success: AcpSchema.KillTerminalResponse,
  error: AcpSchema.Error,
});

/**
 * RPC group served by ACP agents.
 *
 * **Example** (Log first AgentRpcs method)
 *
 * ```ts
 * import { AgentRpcs } from "@beep/acp/rpc"
 *
 * const firstMethod = AgentRpcs.requests.keys().next().value
 * console.log(firstMethod)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const AgentRpcs = RpcGroup.make(
  InitializeRpc,
  AuthenticateRpc,
  LogoutRpc,
  NewSessionRpc,
  LoadSessionRpc,
  ListSessionsRpc,
  ForkSessionRpc,
  ResumeSessionRpc,
  CloseSessionRpc,
  PromptRpc,
  SetSessionModelRpc,
  SetSessionConfigOptionRpc
);

/**
 * RPC group served by ACP clients.
 *
 * **Example** (Log first ClientRpcs method)
 *
 * ```ts
 * import { ClientRpcs } from "@beep/acp/rpc"
 *
 * const firstMethod = ClientRpcs.requests.keys().next().value
 * console.log(firstMethod)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ClientRpcs = RpcGroup.make(
  ReadTextFileRpc,
  WriteTextFileRpc,
  RequestPermissionRpc,
  ElicitationRpc,
  CreateTerminalRpc,
  TerminalOutputRpc,
  ReleaseTerminalRpc,
  WaitForTerminalExitRpc,
  KillTerminalRpc
);
