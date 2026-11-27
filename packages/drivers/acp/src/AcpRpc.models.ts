/**
 * ACP RPC groups for the technical driver.
 *
 * **Details**
 *
 * - `AgentRpcs` / `ClientRpcs` are the generation-2 groups an agent serves and a client serves.
 *   The generation-2 agent (`@beep/acp/agent`) uses them.
 * - `CompatAgentRpcs` / `CompatClientRpcs` are the dual-generation groups the client
 *   (`@beep/acp/client`) uses. Their payloads and results are unions over both generations, and
 *   they add the generation-1 methods (`authenticate`, `logout`, `session/load`,
 *   `session/set_mode`, `fs/*`, `terminal/*`) and the legacy method names that neither pinned
 *   schema lists (`LEGACY_AGENT_METHODS`, `LEGACY_CLIENT_METHODS`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
import { AGENT_METHODS, CLIENT_METHODS, V1_AGENT_METHODS, V1_CLIENT_METHODS } from "./_generated/meta.gen.ts";
import * as AcpSchema from "./_generated/schema.gen.ts";
import * as AcpSchemaV1 from "./_generated/schema-v1.gen.ts";
import * as AcpCompat from "./AcpCompat.models.ts";
import { OpenPromptAcknowledgement } from "./internal/normalize.ts";

/**
 * Agent methods that neither pinned schema lists but older generation-1 agents still serve.
 *
 * **Example** (Read the legacy set-model method)
 *
 * ```ts
 * import { LEGACY_AGENT_METHODS } from "@beep/acp/rpc"
 *
 * console.log(LEGACY_AGENT_METHODS.session_set_model) // "session/set_model"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEGACY_AGENT_METHODS = {
  session_set_model: "session/set_model",
} as const;

/**
 * Client methods that neither pinned schema lists but native agents still call.
 *
 * **Details**
 *
 * `session/elicitation` and `_session/elicitation` are the pre-1.21 elicitation requests (they
 * expect the nested `LegacyElicitationResponse`), and `session/elicitation/complete` is the
 * pre-1.21 name of the `elicitation/complete` notification.
 *
 * **Example** (Read the legacy elicitation methods)
 *
 * ```ts
 * import { LEGACY_CLIENT_METHODS } from "@beep/acp/rpc"
 *
 * console.log(LEGACY_CLIENT_METHODS.session_elicitation_complete) // "session/elicitation/complete"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEGACY_CLIENT_METHODS = {
  session_elicitation: "session/elicitation",
  unstable_session_elicitation: "_session/elicitation",
  session_elicitation_complete: "session/elicitation/complete",
} as const;

const InitializeRpc = Rpc.make(AGENT_METHODS.initialize, {
  payload: AcpSchema.InitializeRequest,
  success: AcpSchema.InitializeResponse,
  error: AcpSchema.Error,
});

const LoginRpc = Rpc.make(AGENT_METHODS.auth_login, {
  payload: AcpSchema.LoginAuthRequest,
  success: AcpSchema.LoginAuthResponse,
  error: AcpSchema.Error,
});

const LogoutRpc = Rpc.make(AGENT_METHODS.auth_logout, {
  payload: AcpSchema.LogoutAuthRequest,
  success: AcpSchema.LogoutAuthResponse,
  error: AcpSchema.Error,
});

const NewSessionRpc = Rpc.make(AGENT_METHODS.session_new, {
  payload: AcpSchema.NewSessionRequest,
  success: AcpSchema.NewSessionResponse,
  error: AcpSchema.Error,
});

const ListSessionsRpc = Rpc.make(AGENT_METHODS.session_list, {
  payload: AcpSchema.ListSessionsRequest,
  success: AcpSchema.ListSessionsResponse,
  error: AcpSchema.Error,
});

const ForkSessionRpc = Rpc.make(AGENT_METHODS.session_fork, {
  payload: AcpSchema.ForkSessionRequest,
  success: AcpSchema.ForkSessionResponse,
  error: AcpSchema.Error,
});

const ResumeSessionRpc = Rpc.make(AGENT_METHODS.session_resume, {
  payload: AcpSchema.ResumeSessionRequest,
  success: AcpSchema.ResumeSessionResponse,
  error: AcpSchema.Error,
});

const CloseSessionRpc = Rpc.make(AGENT_METHODS.session_close, {
  payload: AcpSchema.CloseSessionRequest,
  success: AcpSchema.CloseSessionResponse,
  error: AcpSchema.Error,
});

const DeleteSessionRpc = Rpc.make(AGENT_METHODS.session_delete, {
  payload: AcpSchema.DeleteSessionRequest,
  success: AcpSchema.DeleteSessionResponse,
  error: AcpSchema.Error,
});

const ListProvidersRpc = Rpc.make(AGENT_METHODS.providers_list, {
  payload: AcpSchema.ListProvidersRequest,
  success: AcpSchema.ListProvidersResponse,
  error: AcpSchema.Error,
});

const SetProviderRpc = Rpc.make(AGENT_METHODS.providers_set, {
  payload: AcpSchema.SetProviderRequest,
  success: AcpSchema.SetProviderResponse,
  error: AcpSchema.Error,
});

const DisableProviderRpc = Rpc.make(AGENT_METHODS.providers_disable, {
  payload: AcpSchema.DisableProviderRequest,
  success: AcpSchema.DisableProviderResponse,
  error: AcpSchema.Error,
});

const PromptRpc = Rpc.make(AGENT_METHODS.session_prompt, {
  payload: AcpSchema.PromptRequest,
  success: AcpSchema.PromptResponse,
  error: AcpSchema.Error,
});

const SetSessionConfigOptionRpc = Rpc.make(AGENT_METHODS.session_set_config_option, {
  payload: AcpSchema.SetSessionConfigOptionRequest,
  success: AcpSchema.SetSessionConfigOptionResponse,
  error: AcpSchema.Error,
});

/**
 * RPC group served by generation-2 ACP agents.
 *
 * **Example** (List the agent methods)
 *
 * ```ts
 * import { AgentRpcs } from "@beep/acp/rpc"
 *
 * console.log([...AgentRpcs.requests.keys()])
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const AgentRpcs = RpcGroup.make(
  InitializeRpc,
  LoginRpc,
  LogoutRpc,
  NewSessionRpc,
  ListSessionsRpc,
  ForkSessionRpc,
  ResumeSessionRpc,
  CloseSessionRpc,
  DeleteSessionRpc,
  ListProvidersRpc,
  SetProviderRpc,
  DisableProviderRpc,
  PromptRpc,
  SetSessionConfigOptionRpc
);

const RequestPermissionRpc = Rpc.make(CLIENT_METHODS.session_request_permission, {
  payload: AcpSchema.RequestPermissionRequest,
  success: AcpSchema.RequestPermissionResponse,
  error: AcpSchema.Error,
});

const ElicitationRpc = Rpc.make(CLIENT_METHODS.elicitation_create, {
  payload: AcpSchema.CreateElicitationRequest,
  success: AcpSchema.CreateElicitationResponse,
  error: AcpSchema.Error,
});

const MessageMcpRpc = Rpc.make(CLIENT_METHODS.mcp_message, {
  payload: AcpSchema.MessageMcpRequest,
  success: AcpSchema.MessageMcpResponse,
  error: AcpSchema.Error,
});

/**
 * RPC group served by generation-2 ACP clients.
 *
 * **Example** (List the client methods)
 *
 * ```ts
 * import { ClientRpcs } from "@beep/acp/rpc"
 *
 * console.log([...ClientRpcs.requests.keys()])
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ClientRpcs = RpcGroup.make(RequestPermissionRpc, ElicitationRpc, MessageMcpRpc);

const CompatInitializeRpc = Rpc.make(AGENT_METHODS.initialize, {
  // decision: raw-payloads-for-initialize-and-elicitation
  payload: S.Unknown,
  success: S.Union([AcpSchema.InitializeResponse, AcpSchemaV1.InitializeResponse]),
  error: AcpSchema.Error,
});

const CompatAuthenticateV1Rpc = Rpc.make(V1_AGENT_METHODS.authenticate, {
  payload: AcpSchemaV1.AuthenticateRequest,
  success: AcpSchemaV1.AuthenticateResponse,
  error: AcpSchemaV1.Error,
});

const CompatLogoutV1Rpc = Rpc.make(V1_AGENT_METHODS.logout, {
  payload: AcpSchemaV1.LogoutRequest,
  success: AcpSchemaV1.LogoutResponse,
  error: AcpSchemaV1.Error,
});

// decision: dual-generation-union-order
const CompatNewSessionRpc = Rpc.make(AGENT_METHODS.session_new, {
  payload: S.Union([AcpCompat.NewSessionRequest, AcpSchema.NewSessionRequest, AcpSchemaV1.NewSessionRequest]),
  success: S.Union([AcpCompat.NewSessionResponse, AcpSchema.NewSessionResponse]),
  error: AcpSchema.Error,
});

const CompatLoadSessionV1Rpc = Rpc.make(V1_AGENT_METHODS.session_load, {
  payload: S.Union([AcpSchemaV1.LoadSessionRequest, AcpCompat.LoadSessionRequest]),
  success: AcpCompat.LoadSessionResponse,
  error: AcpSchemaV1.Error,
});

const CompatListSessionsRpc = Rpc.make(AGENT_METHODS.session_list, {
  payload: S.Union([AcpSchema.ListSessionsRequest, AcpSchemaV1.ListSessionsRequest]),
  success: S.Union([AcpSchemaV1.ListSessionsResponse, AcpSchema.ListSessionsResponse]),
  error: AcpSchema.Error,
});

const CompatForkSessionRpc = Rpc.make(AGENT_METHODS.session_fork, {
  payload: S.Union([AcpCompat.ForkSessionRequest, AcpSchema.ForkSessionRequest, AcpSchemaV1.ForkSessionRequest]),
  success: S.Union([AcpCompat.ForkSessionResponse, AcpSchema.ForkSessionResponse]),
  error: AcpSchema.Error,
});

const CompatResumeSessionRpc = Rpc.make(AGENT_METHODS.session_resume, {
  payload: S.Union([AcpCompat.ResumeSessionRequest, AcpSchema.ResumeSessionRequest, AcpSchemaV1.ResumeSessionRequest]),
  success: S.Union([AcpCompat.ResumeSessionResponse, AcpSchema.ResumeSessionResponse]),
  error: AcpSchema.Error,
});

const CompatCloseSessionRpc = Rpc.make(AGENT_METHODS.session_close, {
  payload: S.Union([AcpSchema.CloseSessionRequest, AcpSchemaV1.CloseSessionRequest]),
  success: S.Union([AcpSchema.CloseSessionResponse, AcpSchemaV1.CloseSessionResponse]),
  error: AcpSchema.Error,
});

// decision: dual-generation-union-order
const CompatPromptRpc = Rpc.make(AGENT_METHODS.session_prompt, {
  payload: S.Union([AcpSchema.PromptRequest, AcpSchemaV1.PromptRequest, AcpCompat.PromptRequest]),
  success: S.Union([AcpCompat.PromptResponse, OpenPromptAcknowledgement]),
  error: AcpSchema.Error,
});

const CompatSetSessionConfigOptionRpc = Rpc.make(AGENT_METHODS.session_set_config_option, {
  payload: S.Union([AcpSchema.SetSessionConfigOptionRequest, AcpSchemaV1.SetSessionConfigOptionRequest]),
  success: S.Union([AcpSchemaV1.SetSessionConfigOptionResponse, AcpSchema.SetSessionConfigOptionResponse]),
  error: AcpSchema.Error,
});

const CompatSetSessionModelRpc = Rpc.make(LEGACY_AGENT_METHODS.session_set_model, {
  payload: AcpCompat.SetSessionModelRequest,
  success: AcpCompat.SetSessionModelResponse,
  error: AcpSchemaV1.Error,
});

const CompatSetSessionModeRpc = Rpc.make(V1_AGENT_METHODS.session_set_mode, {
  payload: AcpSchemaV1.SetSessionModeRequest,
  success: AcpSchemaV1.SetSessionModeResponse,
  error: AcpSchemaV1.Error,
});

/**
 * Dual-generation RPC group the client uses to call an agent of either generation.
 *
 * **Details**
 *
 * `initialize` sends an untyped negotiating payload and decodes either generation's result.
 * Generation-2 methods (`auth/login`, `auth/logout`, `session/delete`, `providers/*`) sit next to
 * the generation-1 methods (`authenticate`, `logout`, `session/load`, `session/set_mode`) and the
 * legacy `session/set_model`; shared methods accept and decode both generations' shapes.
 *
 * **Example** (Check for the legacy set-model method)
 *
 * ```ts
 * import { CompatAgentRpcs } from "@beep/acp/rpc"
 *
 * console.log(CompatAgentRpcs.requests.has("session/set_model")) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CompatAgentRpcs = RpcGroup.make(
  CompatInitializeRpc,
  CompatSetSessionModelRpc,
  CompatSetSessionModeRpc,
  LoginRpc,
  CompatAuthenticateV1Rpc,
  LogoutRpc,
  CompatLogoutV1Rpc,
  CompatNewSessionRpc,
  CompatLoadSessionV1Rpc,
  CompatListSessionsRpc,
  CompatForkSessionRpc,
  CompatResumeSessionRpc,
  CompatCloseSessionRpc,
  DeleteSessionRpc,
  ListProvidersRpc,
  SetProviderRpc,
  DisableProviderRpc,
  CompatPromptRpc,
  CompatSetSessionConfigOptionRpc
);

const CompatRequestPermissionRpc = Rpc.make(CLIENT_METHODS.session_request_permission, {
  payload: S.Union([AcpSchema.RequestPermissionRequest, AcpSchemaV1.RequestPermissionRequest]),
  success: S.Union([AcpSchema.RequestPermissionResponse, AcpSchemaV1.RequestPermissionResponse]),
  error: AcpSchema.Error,
});

const CompatElicitationRpc = Rpc.make(CLIENT_METHODS.elicitation_create, {
  // decision: raw-payloads-for-initialize-and-elicitation
  payload: S.Unknown,
  success: S.Union([AcpSchema.CreateElicitationResponse, AcpSchemaV1.CreateElicitationResponse]),
  error: AcpSchema.Error,
});

const CompatLegacyElicitationRpc = Rpc.make(LEGACY_CLIENT_METHODS.session_elicitation, {
  payload: AcpSchema.CreateElicitationRequest,
  success: AcpCompat.LegacyElicitationResponse,
  error: AcpSchema.Error,
});

const CompatUnstableLegacyElicitationRpc = Rpc.make(LEGACY_CLIENT_METHODS.unstable_session_elicitation, {
  payload: AcpSchema.CreateElicitationRequest,
  success: AcpCompat.LegacyElicitationResponse,
  error: AcpSchema.Error,
});

const ReadTextFileV1Rpc = Rpc.make(V1_CLIENT_METHODS.fs_read_text_file, {
  payload: AcpSchemaV1.ReadTextFileRequest,
  success: AcpSchemaV1.ReadTextFileResponse,
  error: AcpSchemaV1.Error,
});

const WriteTextFileV1Rpc = Rpc.make(V1_CLIENT_METHODS.fs_write_text_file, {
  payload: AcpSchemaV1.WriteTextFileRequest,
  success: AcpSchemaV1.WriteTextFileResponse,
  error: AcpSchemaV1.Error,
});

const CreateTerminalV1Rpc = Rpc.make(V1_CLIENT_METHODS.terminal_create, {
  payload: AcpSchemaV1.CreateTerminalRequest,
  success: AcpSchemaV1.CreateTerminalResponse,
  error: AcpSchemaV1.Error,
});

const TerminalOutputV1Rpc = Rpc.make(V1_CLIENT_METHODS.terminal_output, {
  payload: AcpSchemaV1.TerminalOutputRequest,
  success: AcpSchemaV1.TerminalOutputResponse,
  error: AcpSchemaV1.Error,
});

const ReleaseTerminalV1Rpc = Rpc.make(V1_CLIENT_METHODS.terminal_release, {
  payload: AcpSchemaV1.ReleaseTerminalRequest,
  success: AcpSchemaV1.ReleaseTerminalResponse,
  error: AcpSchemaV1.Error,
});

const WaitForTerminalExitV1Rpc = Rpc.make(V1_CLIENT_METHODS.terminal_wait_for_exit, {
  payload: AcpSchemaV1.WaitForTerminalExitRequest,
  success: AcpSchemaV1.WaitForTerminalExitResponse,
  error: AcpSchemaV1.Error,
});

const KillTerminalV1Rpc = Rpc.make(V1_CLIENT_METHODS.terminal_kill, {
  payload: AcpSchemaV1.KillTerminalRequest,
  success: AcpSchemaV1.KillTerminalResponse,
  error: AcpSchemaV1.Error,
});

/**
 * Dual-generation RPC group the client serves for agents of either generation.
 *
 * **Details**
 *
 * Generation-2 requests (`session/request_permission`, `elicitation/create`, `mcp/message`), the legacy
 * nested elicitation requests (`session/elicitation`, `_session/elicitation`), and the
 * generation-1 client file-system and terminal requests (`fs/*`, `terminal/*`).
 *
 * **Example** (Check for the generation-1 file read)
 *
 * ```ts
 * import { CompatClientRpcs } from "@beep/acp/rpc"
 *
 * console.log(CompatClientRpcs.requests.has("fs/read_text_file")) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CompatClientRpcs = RpcGroup.make(
  CompatRequestPermissionRpc,
  CompatElicitationRpc,
  CompatLegacyElicitationRpc,
  CompatUnstableLegacyElicitationRpc,
  MessageMcpRpc,
  ReadTextFileV1Rpc,
  WriteTextFileV1Rpc,
  CreateTerminalV1Rpc,
  TerminalOutputV1Rpc,
  ReleaseTerminalV1Rpc,
  WaitForTerminalExitV1Rpc,
  KillTerminalV1Rpc
);
