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
import { Document } from "@beep/md/Md.model";
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
 * @remarks
 * The request payload is a workspace id, the response is the workspace's
 * thread read model array, and all handler-side failures are translated to
 * {@link ChatActionError} before crossing the wire.
 *
 * @example
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
 * @remarks
 * The payload carries the target workspace and initial title. The sidecar owns
 * persistence and returns the created thread or a client-safe
 * {@link ChatActionError}.
 *
 * @example
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
 * @remarks
 * This query reads already-persisted timeline state; assistant turn generation
 * happens through {@link SendMessageRpc} and {@link EditMessageRpc}.
 *
 * @example
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
 * Sends a message to a thread and streams the assistant turn back, one
 * rich-text block at a time as each finishes generating.
 *
 * @remarks
 * The declaration marks success as a stream of {@link AssistantBlock} values.
 * Every request failure uses the typed {@link ChatActionError} channel.
 *
 * @example
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
  payload: { threadId: WorkspaceIdentity.ThreadId, content: Document },
  success: AssistantBlock,
  error: ChatActionError,
  stream: true,
});

/**
 * Edits an existing turn's message and re-streams the regenerated assistant
 * turn back, one rich-text block at a time.
 *
 * @remarks
 * The payload identifies both the thread and the turn being edited. Like
 * {@link SendMessageRpc}, success is a stream and failures are normalized to
 * {@link ChatActionError}.
 *
 * @example
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
    content: Document,
  },
  success: AssistantBlock,
  error: ChatActionError,
  stream: true,
});

/**
 * The chat protocol the desktop chat surface speaks to its app sidecar:
 * thread listing/creation, the timeline read-model, and the two streaming
 * message turns ({@link SendMessageRpc}, {@link EditMessageRpc}).
 *
 * @example
 * ```ts
 * import { ChatRpcs } from "@beep/agents-use-cases/public"
 *
 * console.log([...ChatRpcs.requests.keys()].sort())
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ChatRpcs = RpcGroup.make(ListThreadsRpc, CreateThreadRpc, GetTimelineRpc, SendMessageRpc, EditMessageRpc);
