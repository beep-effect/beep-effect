/**
 * Chat wire contract: the rpc declarations the desktop chat surface speaks to
 * its app sidecar. These are declarations only — handler implementations live
 * in the sidecar (a later increment), and the streaming turns are produced by
 * the assistant-turn kernel behind it.
 *
 * @packageDocumentation
 * @category protocols
 * @since 0.0.0
 */

import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent";
import { SafeDocument } from "@beep/md/Md.safe";
import { LiteralKit } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Thread } from "@beep/workspace-domain";
import { Thread as ThreadUseCases } from "@beep/workspace-use-cases/public";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { ChatActionError } from "./Chat.errors.ts";

/**
 * Lists the threads in a workspace, most recent activity first.
 *
 * **Details**
 *
 * The request payload is a workspace id, the response is the workspace's
 * thread read model array, and all handler-side failures are translated to
 * {@link ChatActionError} before crossing the wire.
 *
 * **Example** (Registered request)
 * ```ts
 * import { ChatRpcs, ListThreadsRpc } from "@beep/agents-use-cases/public"
 *
 * const registered = ChatRpcs.requests.get("ListThreads")
 * console.log(registered === ListThreadsRpc) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ListThreadsRpc = Rpc.make("ListThreads", {
  payload: { workspaceId: WorkspaceIdentity.WorkspaceId },
  success: S.Array(Thread),
  error: ChatActionError,
});

/**
 * Creates a new thread in a workspace.
 *
 * **Details**
 *
 * The payload carries the target workspace and initial title. The sidecar owns
 * persistence and returns the created thread or a client-safe
 * {@link ChatActionError}.
 *
 * **Example** (Registered request)
 * ```ts
 * import { ChatRpcs, CreateThreadRpc } from "@beep/agents-use-cases/public"
 *
 * const registered = ChatRpcs.requests.get("CreateThread")
 * console.log(registered === CreateThreadRpc) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const CreateThreadRpc = Rpc.make("CreateThread", {
  payload: {
    workspaceId: WorkspaceIdentity.WorkspaceId,
    title: S.NonEmptyString.annotateKey({ description: "Initial non-empty title for the new thread." }),
  },
  success: Thread,
  error: ChatActionError,
});

/**
 * Reads the persisted timeline read-model for a thread.
 *
 * **Details**
 *
 * This query reads already-persisted timeline state; assistant turn generation
 * happens through {@link SendMessageRpc} and {@link EditMessageRpc}.
 *
 * **Example** (Registered request)
 * ```ts
 * import { ChatRpcs, GetTimelineRpc } from "@beep/agents-use-cases/public"
 *
 * const registered = ChatRpcs.requests.get("GetTimeline")
 * console.log(registered === GetTimelineRpc) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetTimelineRpc = Rpc.make("GetTimeline", {
  payload: { threadId: WorkspaceIdentity.ThreadId },
  success: ThreadUseCases.ThreadTimeline,
  error: ChatActionError,
});

/**
 * Persistence status of one client-correlated turn request. `accepted` means
 * the user row committed, while terminal `user_persisted` means stream unwind
 * finished without an assistant commit.
 *
 * **Example** (Status membership)
 * ```ts
 * import { TurnRequestStatus } from "@beep/agents-use-cases/public"
 * console.log(TurnRequestStatus.Options.includes("persisted"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurnRequestStatus = LiteralKit([
  "pending",
  "accepted",
  "persisted",
  "user_persisted",
  "not_persisted",
  "unknown",
]).annotate({
  identifier: "TurnRequestStatus",
  description: "Server-side persistence status for one exact chat turn request.",
});

/**
 * Runtime type for {@link TurnRequestStatus}.
 *
 * **Example** (Typed status value)
 * ```ts
 * import type { TurnRequestStatus } from "@beep/agents-use-cases/public"
 * const status: TurnRequestStatus = "persisted"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnRequestStatus = typeof TurnRequestStatus.Type;

/**
 * Reads persistence evidence for one exact client request id.
 *
 * **Example** (Registered request)
 * ```ts
 * import { ChatRpcs, GetTurnRequestStatusRpc } from "@beep/agents-use-cases/public"
 * console.log(ChatRpcs.requests.get("GetTurnRequestStatus") === GetTurnRequestStatusRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetTurnRequestStatusRpc = Rpc.make("GetTurnRequestStatus", {
  payload: { requestId: S.NonEmptyString },
  success: TurnRequestStatus,
  error: ChatActionError,
});

/**
 * Sends a message to a thread and streams the assistant turn back, one
 * rich-text block at a time as each finishes generating.
 *
 * **Details**
 *
 * The declaration marks success as a stream of {@link AssistantBlock} values.
 * Every request failure uses the typed {@link ChatActionError} channel.
 *
 * **Example** (Streaming declaration)
 * ```ts
 * import { ChatRpcs, SendMessageRpc } from "@beep/agents-use-cases/public"
 * import * as RpcSchema from "effect/unstable/rpc/RpcSchema"
 *
 * const registered = ChatRpcs.requests.get("SendMessage")
 * const streamsBlocks =
 *   registered !== undefined && RpcSchema.isStreamSchema(registered.successSchema)
 *
 * console.log(registered === SendMessageRpc, streamsBlocks) // true true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const SendMessageRpc = Rpc.make("SendMessage", {
  payload: { threadId: WorkspaceIdentity.ThreadId, content: SafeDocument, requestId: S.NonEmptyString },
  success: AssistantBlock,
  error: ChatActionError,
  stream: true,
});

/**
 * Edits an existing turn's message and re-streams the regenerated assistant
 * turn back, one rich-text block at a time.
 *
 * **Details**
 *
 * The payload identifies both the thread and the turn being edited. Like
 * {@link SendMessageRpc}, success is a stream and failures are normalized to
 * {@link ChatActionError}.
 *
 * **Example** (Streaming declaration)
 * ```ts
 * import { ChatRpcs, EditMessageRpc } from "@beep/agents-use-cases/public"
 * import * as RpcSchema from "effect/unstable/rpc/RpcSchema"
 *
 * const registered = ChatRpcs.requests.get("EditMessage")
 * const streamsBlocks =
 *   registered !== undefined && RpcSchema.isStreamSchema(registered.successSchema)
 *
 * console.log(registered === EditMessageRpc, streamsBlocks) // true true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const EditMessageRpc = Rpc.make("EditMessage", {
  payload: {
    threadId: WorkspaceIdentity.ThreadId,
    turnId: WorkspaceIdentity.TurnId,
    content: SafeDocument,
    requestId: S.NonEmptyString,
  },
  success: AssistantBlock,
  error: ChatActionError,
  stream: true,
});

/**
 * The chat protocol the desktop chat surface speaks to its app sidecar:
 * thread listing/creation, the timeline read-model, exact request-status
 * reconciliation via {@link GetTurnRequestStatusRpc}, and the two streaming
 * message turns ({@link SendMessageRpc}, {@link EditMessageRpc}).
 *
 * **Example** (Protocol surface)
 * ```ts
 * import { ChatRpcs } from "@beep/agents-use-cases/public"
 *
 * console.log([...ChatRpcs.requests.keys()].sort())
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ChatRpcs = RpcGroup.make(
  ListThreadsRpc,
  CreateThreadRpc,
  GetTimelineRpc,
  GetTurnRequestStatusRpc,
  SendMessageRpc,
  EditMessageRpc
);
