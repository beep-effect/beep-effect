/**
 * Desktop chat surface atoms.
 *
 * Ports the chat client state graph onto the {@link ChatRpcs} wire contract:
 * a thread list, per-thread timeline reads, thread creation, persisted composer
 * drafts, and a streaming assistant turn driver. The atoms are browser-targeted
 * (they use `globalThis.localStorage` and a browser-aware default protocol) and
 * require a live rpc server to resolve — type-check and lint are the gates here.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */
import { AssistantBlock, ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent";
import { ChatActionError, ChatRpcs } from "@beep/agents-use-cases/public";
import { $AgentsClientId } from "@beep/identity/packages";
import { Document } from "@beep/md/Md.model";
import { SafeDocument } from "@beep/md/Md.safe";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { A, O, P, Str } from "@beep/utils";
import { Cause, Clock, Config, Duration, Effect, Match, Metric, Random, Stream } from "effect";
import { constant } from "effect/Function";
import * as S from "effect/Schema";
import { KeyValueStore } from "effect/unstable/persistence";
import { AsyncResult, Atom, AtomRegistry, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { HttpChatProtocolLive } from "./Chat.layer.ts";
import { ClientObservabilityLive } from "./ClientObservability.ts";
import type { TurnRequestStatus } from "@beep/agents-use-cases/public";
import type { Layer } from "effect";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";

const $I = $AgentsClientId.create("Chat.atoms");

type WorkspaceId = WorkspaceIdentity.WorkspaceId;
type ThreadId = WorkspaceIdentity.ThreadId;

const StreamingTurnReconciliation = LiteralKit(["timeline", "receipt"]).pipe(
  $I.annoteSchema("StreamingTurnReconciliation", {
    description: "Evidence that controls when a locally retained turn may retire.",
  })
);
type StreamingTurnReconciliation = typeof StreamingTurnReconciliation.Type;

// Ambient telemetry (logger/tracer/metrics are fiber-runtime concerns, not
// typed services) rides every atom runtime via the global layer; this is what
// threads the client span context onto outgoing rpc envelopes so webview spans
// join the sidecar's `RpcServer.*` spans into one trace. Env-gated: collapses to
// Layer.empty without an OTLP endpoint, so tests/dev without a collector are
// unaffected (see ClientObservability.ts).
Atom.runtime.addGlobalLayer(ClientObservabilityLive);

/**
 * Default HTTP protocol for browser and non-IPC desktop chat sessions.
 *
 * @category layers
 * @since 0.0.0
 */
export { HttpChatProtocolLive } from "./Chat.layer.ts";

/**
 * Writable transport selector consumed by {@link ChatClient}.
 *
 * **Details**
 *
 * Apps that own a non-HTTP transport set this atom before mounting chat atoms;
 * otherwise the client keeps the default HTTP protocol. Professional Desktop
 * uses this to swap in its Tauri IPC protocol only after the shell confirms the
 * sidecar was spawned in IPC mode.
 *
 * **Gotchas**
 *
 * Set this before mounting chat query atoms. Already-mounted queries keep the
 * runtime they were created with until their atom lifetime is refreshed.
 *
 * **Example** (Set HTTP protocol layer)
 *
 * ```ts
 * import { chatProtocolLayerAtom, HttpChatProtocolLive } from "@beep/agents-client"
 * import { Layer } from "effect"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const registry = AtomRegistry.make()
 * registry.set(chatProtocolLayerAtom, HttpChatProtocolLive)
 *
 * console.log(Layer.isLayer(registry.get(chatProtocolLayerAtom))) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const chatProtocolLayerAtom: Atom.Writable<Layer.Layer<RpcClient.Protocol>> = Atom.make(HttpChatProtocolLive);

/**
 * Flattened rpc client for {@link ChatRpcs}, integrated with atom reactivity.
 * Exposes `query`/`runtime`/the flat client used by the atoms below.
 *
 * **Gotchas**
 *
 * `ChatClient.query(...)` builds an atom. The RPC request is not sent until the
 * query atom is mounted by the atom runtime, so protocol replacement via
 * {@link chatProtocolLayerAtom} must happen before the visible chat surface
 * mounts.
 *
 * **Example** (Build serializable threads query)
 *
 * ```ts
 * import { ChatClient } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * const workspaceId = S.decodeUnknownSync(Workspace.WorkspaceId)(1)
 * const threads = ChatClient.query("ListThreads", { workspaceId }, { reactivityKeys: ["threads"] })
 *
 * console.log(Atom.isSerializable(threads)) // true
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class ChatClient extends AtomRpc.Service<ChatClient>()("ChatClient", {
  group: ChatRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
}) {}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

// Thread lists key on both a per-workspace key (invalidated when that
// workspace's threads change) and a shared `threads` key (invalidated by a turn,
// which only knows its threadId — not its workspaceId — yet still bumps the
// thread's `lastActivityAt`/title and so must refresh every visible list).
const THREADS_KEY = "threads" as const;
const workspaceThreadsKey = (workspaceId: WorkspaceId) => `${THREADS_KEY}:${workspaceId}`;

/**
 * The thread list for a workspace, refetched whenever a thread or turn mutates.
 *
 * **Details**
 *
 * The atom keys both the workspace-specific list and the shared `threads`
 * invalidation key. A streamed turn only knows its thread id, but it can still
 * change the owning thread title or last activity in any visible workspace list.
 *
 * **Example** (Create workspace threads atom)
 *
 * ```ts
 * import { threadsAtoms } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * const workspaceId = S.decodeUnknownSync(Workspace.WorkspaceId)(1)
 * const atom = threadsAtoms(workspaceId)
 *
 * console.log(Atom.isSerializable(atom)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const threadsAtoms = Atom.family((workspaceId: WorkspaceId) =>
  ChatClient.query(
    "ListThreads",
    { workspaceId },
    {
      reactivityKeys: [THREADS_KEY, workspaceThreadsKey(workspaceId)],
    }
  )
);

/**
 * The user's explicit thread selection — none means "follow the list".
 *
 * **Example** (Set selected thread option)
 *
 * ```ts
 * import { selectedThreadAtom } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const registry = AtomRegistry.make()
 * console.log(O.isNone(registry.get(selectedThreadAtom))) // true
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * registry.set(selectedThreadAtom, O.some(threadId))
 *
 * console.log(O.isSome(registry.get(selectedThreadAtom))) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
// Kept alive because the selection outlives the view that shows it. Every
// subscriber lives inside the chat surface, which the desktop unmounts when the
// user switches to Ontology, Vault sync, or Home — so the selection dropped to
// zero listeners, and 30 seconds later the registry's idle sweep reset it to
// `O.none()`. That default means "follow the list", so the user came back to the
// most-recently-updated thread instead of the one they had open, with no error
// and nothing to explain it. Anything they typed next went to the wrong
// conversation. Under 30 seconds the same trip preserved the selection, which is
// what made it look intermittent.
export const selectedThreadAtom = Atom.keepAlive(Atom.make<O.Option<ThreadId>>(O.none()));

const timelineKey = (threadId: ThreadId) => `timeline:${threadId}`;

/**
 * The persisted timeline read-model per thread, refetched whenever a turn
 * completes.
 *
 * **Example** (Create thread timeline atom)
 *
 * ```ts
 * import { threadTimelineAtoms } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const atom = threadTimelineAtoms(threadId)
 *
 * console.log(Atom.isSerializable(atom)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const threadTimelineAtoms = Atom.family((threadId: ThreadId) =>
  ChatClient.query("GetTimeline", { threadId }, { reactivityKeys: [timelineKey(threadId)] })
);

/**
 * Write payload for {@link createThreadAtom}.
 *
 * **Details**
 *
 * The shape mirrors the `CreateThread` RPC payload while keeping the atom write
 * contract structural for app callers.
 *
 * **Example** (Make create-thread payload)
 *
 * ```ts
 * import { CreateThreadAtomInput } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * const workspaceId = Workspace.WorkspaceId.make(1)
 * const request = CreateThreadAtomInput.make({ workspaceId, title: "Inbox" })
 *
 * console.log(request.title) // "Inbox"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CreateThreadAtomInput extends S.Class<CreateThreadAtomInput>($I`CreateThreadAtomInput`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace where the thread is created.",
    }),
    title: S.String.annotateKey({
      description: "Initial thread title.",
    }),
  },
  $I.annote("CreateThreadAtomInput", {
    description: "Write payload for the client thread-creation atom.",
  })
) {}

/**
 * Creates a thread in a workspace and focuses it.
 *
 * **Details**
 *
 * This is a write-only runtime atom. Writing the payload calls `CreateThread`,
 * invalidates the affected thread-list keys, then stores the returned thread id
 * in {@link selectedThreadAtom}.
 *
 * **Example** (Type create-thread write value)
 *
 * ```ts
 * import { createThreadAtom, CreateThreadAtomInput } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * type WriteValue<A> = A extends Atom.Writable<unknown, infer W> ? W : never
 *
 * const workspaceId = Workspace.WorkspaceId.make(1)
 * const request: WriteValue<typeof createThreadAtom> = CreateThreadAtomInput.make({ workspaceId, title: "Inbox" })
 *
 * console.log(request.title) // "Inbox"
 * ```
 *
 * @effects
 * - Calls the `CreateThread` RPC through {@link ChatClient}.
 * - Invalidates the shared and workspace-scoped thread-list keys.
 * - Updates {@link selectedThreadAtom} with the created thread id.
 * @category atoms
 * @since 0.0.0
 */
export const createThreadAtom = ChatClient.runtime.fn<CreateThreadAtomInput>()(
  Effect.fn("createThread")(function* (input, ctx) {
    const client = yield* ChatClient;
    const thread = yield* Reactivity.mutation(client("CreateThread", input), [
      THREADS_KEY,
      workspaceThreadsKey(input.workspaceId),
    ]);
    ctx.set(selectedThreadAtom, O.some(thread.id));
  })
);

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

// drafts persist in localStorage so unsent composer content survives restarts
const draftsRuntime = Atom.runtime(KeyValueStore.layerStorage(() => globalThis.localStorage));

/**
 * Unsent composer content per thread, persisted in localStorage.
 *
 * **Details**
 *
 * The atom stores `Option<Document>` with `null`/`Option` wire conversion, so a
 * missing `draft:{threadId}` key and an explicitly cleared draft both read as
 * `Option.none`. Reading or writing this atom requires the browser
 * `localStorage` runtime.
 *
 * **Example** (Write draft document option)
 *
 * ```ts
 * import { draftAtoms } from "@beep/agents-client"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * type WriteValue<A> = A extends Atom.Writable<unknown, infer W> ? W : never
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const draftAtom = draftAtoms(threadId)
 * const draft: WriteValue<typeof draftAtom> = O.some(
 *   Document.make({ children: [P.make({ children: [Text.make({ value: "Draft reply" })] })] })
 * )
 *
 * console.log(O.isSome(draft)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const draftAtoms = Atom.family((threadId: ThreadId) =>
  Atom.kvs({
    runtime: draftsRuntime,
    key: `draft:${threadId}`,
    schema: S.OptionFromNullOr(Document),
    defaultValue: O.none,
  })
);

/**
 * Bumped whenever a thread's draft is replaced from outside the editor.
 *
 * **Details**
 *
 * The composer seeds its editor from the draft at mount and then owns the
 * content, so restoring a draft is invisible until the composer remounts. It
 * keys itself on this revision: submitting cleared the editor before the request
 * was accepted, so a rejected send simply destroyed what the user had written —
 * the draft is put back and the editor re-seeded from it.
 *
 * **Example** (Read initial draft revision)
 *
 * ```ts
 * import { draftRevisionAtoms } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const registry = AtomRegistry.make()
 *
 * console.log(registry.get(draftRevisionAtoms(threadId))) // 0
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const draftRevisionAtoms = Atom.family((_threadId: ThreadId) => Atom.make(0));

// ---------------------------------------------------------------------------
// Streaming turn
// ---------------------------------------------------------------------------

/**
 * A locally rendered assistant turn: optimistic user content plus the assistant
 * blocks appended as each finishes streaming.
 *
 * **Details**
 *
 * Active turns live in {@link streamingTurnAtom}; completed turns whose durable
 * refresh fails move to the per-thread {@link unreconciledTurnAtoms} collection.
 *
 * **Example** (Build streaming turn model)
 *
 * ```ts
 * import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent"
 * import { StreamingTurn } from "@beep/agents-client"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const threadId = S.decodeUnknownSync(WorkspaceIdentity.ThreadId)(10)
 * const userContent = Document.make({ children: [P.make({ children: [Text.make({ value: "Explain atoms" })] })] })
 * const block = S.decodeUnknownSync(AssistantBlock)({
 *   type: "paragraph",
 *   children: [{ type: "text", text: "Atoms keep UI state explicit." }],
 * })
 *
 * const turn = StreamingTurn.make({
 *   threadId,
 *   userContent,
 *   blocks: [block],
 * })
 *
 * console.log(turn.blocks.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StreamingTurn extends S.Class<StreamingTurn>($I`StreamingTurn`)(
  {
    /** The thread this turn belongs to. */
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description: "Thread this locally rendered turn belongs to.",
    }),
    /** Exact request receipt used to retire uncertain local turns safely. */
    requestId: S.Option(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Client request id used for exact persistence reconciliation when available.",
    }),
    /** Optimistic rendering of the just-sent user message. */
    userContent: Document.annotateKey({
      description: "Optimistic rendering of the just-sent user message.",
    }),
    /** For edits: hide this turn and everything after it while rendered locally. */
    truncateFrom: S.Option(WorkspaceIdentity.TurnId).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Turn id to truncate from while an edit-regenerate turn is rendered locally.",
    }),
    /** Evidence that controls when the local turn may retire. */
    reconciliation: StreamingTurnReconciliation.pipe(
      S.withConstructorDefault(Effect.succeed(StreamingTurnReconciliation.Enum.timeline))
    ).annotateKey({
      description: "Timeline fallbacks retire on refresh; receipt fallbacks remain until exact evidence resolves.",
    }),
    /** Assistant blocks appended as they stream in. */
    blocks: S.Array(AssistantBlock).annotateKey({
      description: "Assistant blocks appended as they stream in.",
    }),
  },
  $I.annote("StreamingTurn", {
    description:
      "An assistant turn rendered locally while blocks stream, its timeline refresh is pending, or receipt evidence is uncertain.",
  })
) {}

/**
 * The actively streaming assistant turn rendered outside the durable timeline.
 *
 * **Details**
 *
 * The atom is cleared when generation stops. If the post-completion timeline
 * refresh fails, the completed value moves to {@link unreconciledTurnAtoms}
 * before this active slot is cleared.
 *
 * **Example** (Set active streaming turn)
 *
 * ```ts
 * import { AssistantBlock } from "@beep/agents-domain/values/AssistantContent"
 * import { streamingTurnAtom, StreamingTurn } from "@beep/agents-client"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const userContent = Document.make({ children: [P.make({ children: [Text.make({ value: "Hi" })] })] })
 * const block = S.decodeUnknownSync(AssistantBlock)({ type: "paragraph", children: [{ type: "text", text: "Hello" }] })
 * const registry = AtomRegistry.make()
 *
 * registry.set(
 *   streamingTurnAtom,
 *   O.some(StreamingTurn.make({ threadId, userContent, blocks: [block] }))
 * )
 *
 * console.log(O.isSome(registry.get(streamingTurnAtom))) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const streamingTurnAtom = Atom.make<O.Option<StreamingTurn>>(O.none());

/**
 * Per-thread completed local replies awaiting a durable timeline refresh.
 * Kept alive across thread/view unmounts so a transient read failure cannot
 * erase the only visible copy of a completed reply.
 *
 * **Example** (Read unreconciled turns length)
 *
 * ```ts
 * import { unreconciledTurnAtoms } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 * const registry = AtomRegistry.make()
 * console.log(registry.get(unreconciledTurnAtoms(Workspace.ThreadId.make(1))).length)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const unreconciledTurnAtoms = Atom.family((_threadId: ThreadId) =>
  Atom.keepAlive(Atom.make<ReadonlyArray<StreamingTurn>>([]))
);

/**
 * The latest failed assistant turn, surfaced for app/UI-layer toast handling.
 *
 * **Example** (Set turn error message)
 *
 * ```ts
 * import { turnErrorAtom } from "@beep/agents-client"
 * import { ChatActionError } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const registry = AtomRegistry.make()
 * registry.set(turnErrorAtom, O.some(ChatActionError.new("thread not found")))
 *
 * console.log(O.getOrThrow(registry.get(turnErrorAtom)).message) // "thread not found"
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const turnErrorAtom = Atom.make<O.Option<ChatActionError>>(O.none());

const fallbackTurnErrorMessage = "Assistant turn failed" as const;

const messageFromUnknownError = (error: unknown): string => {
  const message = P.hasProperty(error, "message") && P.isString(error.message) ? Str.trim(error.message) : Str.empty;
  return Str.isNonEmpty(message) ? message : fallbackTurnErrorMessage;
};

const toTurnError = (error: unknown): ChatActionError =>
  S.is(ChatActionError)(error) ? error : ChatActionError.new(messageFromUnknownError(error));

/**
 * When set, the composer is editing an existing turn's message.
 *
 * **Example** (Make edit target model)
 *
 * ```ts
 * import { EditTarget } from "@beep/agents-client"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const turnId = S.decodeUnknownSync(Workspace.TurnId)(20)
 * const content = Document.make({ children: [P.make({ children: [Text.make({ value: "Revised prompt" })] })] })
 * const target = EditTarget.make({ threadId, turnId, content })
 *
 * console.log(target.content.children.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EditTarget extends S.Class<EditTarget>($I`EditTarget`)(
  {
    threadId: WorkspaceIdentity.ThreadId.annotateKey({
      description:
        "Thread the edited turn belongs to. Edit state is global, so without this a thread change mid-edit submitted the old thread's turn id against the new thread.",
    }),
    turnId: WorkspaceIdentity.TurnId.annotateKey({
      description: "Turn being edited.",
    }),
    content: Document.annotateKey({
      description: "Replacement user content for the edited turn.",
    }),
  },
  $I.annote("EditTarget", {
    description: "When set, the composer is editing an existing turn's message.",
  })
) {}

/**
 * The turn currently being edited, if any.
 *
 * **Example** (Set edit target option)
 *
 * ```ts
 * import { editTargetAtom, EditTarget } from "@beep/agents-client"
 * import { Document, P, Text } from "@beep/md/Md.model"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const threadId = S.decodeUnknownSync(Workspace.ThreadId)(10)
 * const turnId = S.decodeUnknownSync(Workspace.TurnId)(20)
 * const content = Document.make({ children: [P.make({ children: [Text.make({ value: "Edit me" })] })] })
 * const registry = AtomRegistry.make()
 *
 * registry.set(editTargetAtom, O.some(EditTarget.make({ threadId, turnId, content })))
 *
 * console.log(O.isSome(registry.get(editTargetAtom))) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const editTargetAtom = Atom.make<O.Option<EditTarget>>(O.none());

// client-perceived quality metrics — exported through the same OTLP layer
const perceivedLatency = Metric.timer("ui_turn_perceived_latency", {
  description: "Send action to first streamed block, as the user experiences it",
  boundaries: [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000],
});
const decodeFailures = Metric.counter("ui_editor_decode_failures_total", {
  description: "Composer editor states that failed schema decode",
  incremental: true,
});
const turnAttempts = Metric.counter("ui_turn_attempts_total", { incremental: true });
const turnCompleted = Metric.counter("ui_turn_completed_total", { incremental: true });
const turnFailed = Metric.counter("ui_turn_failed_total", { incremental: true });
const turnCancelled = Metric.counter("ui_turn_cancelled_total", { incremental: true });
const turnZeroBlock = Metric.counter("ui_turn_zero_block_total", { incremental: true });
const turnBlocks = Metric.counter("ui_turn_blocks_total", { incremental: true });
const turnDuration = Metric.timer("ui_turn_duration", {
  boundaries: [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 60000],
});

/**
 * Composer content failing schema decode is a bug — count and log it.
 *
 * **Details**
 *
 * UI code writes `void 0` to this atom when editor-state decoding fails. The
 * atom does not store the bad payload; it records telemetry so malformed editor
 * states are visible without leaking document content into logs.
 *
 * **Example** (Write decode failure undefined)
 *
 * ```ts
 * import { reportDecodeFailureAtom } from "@beep/agents-client"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * type WriteValue<A> = A extends Atom.Writable<unknown, infer W> ? W : never
 *
 * const write: WriteValue<typeof reportDecodeFailureAtom> = undefined
 *
 * console.log(write) // undefined
 * ```
 *
 * @effects
 * - Increments `ui_editor_decode_failures_total`.
 * - Emits an error log without including the failed editor payload.
 * @category atoms
 * @since 0.0.0
 */
export const reportDecodeFailureAtom = ChatClient.runtime.fn<void>()(
  Effect.fn("reportDecodeFailure")(function* () {
    yield* Metric.update(decodeFailures, 1);
    yield* Effect.logError("composer editor state failed schema decode");
  })
);

/**
 * A request to send a brand-new user message to a thread.
 *
 * **Example** (Make send turn request)
 *
 * ```ts
 * import { SendTurnRequest } from "@beep/agents-client"
 * import { Md } from "@beep/md"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const threadId = Result.getOrThrow(S.decodeUnknownResult(Workspace.ThreadId)(10))
 * const content = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * const request = SendTurnRequest.make({ threadId, content })
 *
 * console.log(request._tag) // "send"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SendTurnRequest extends S.TaggedClass<SendTurnRequest>("SendTurnRequest")("send", {
  threadId: WorkspaceIdentity.ThreadId.annotateKey({
    description: "Thread receiving the new user message.",
  }),
  content: SafeDocument.annotateKey({
    description: "User content to append as a new message.",
  }),
}) {}

/**
 * A request to edit an existing turn's message and regenerate from there.
 *
 * **Example** (Make edit turn request)
 *
 * ```ts
 * import { EditTurnRequest } from "@beep/agents-client"
 * import { Md } from "@beep/md"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const threadId = Result.getOrThrow(S.decodeUnknownResult(Workspace.ThreadId)(10))
 * const turnId = Result.getOrThrow(S.decodeUnknownResult(Workspace.TurnId)(20))
 * const content = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Try again")])))
 * const request = EditTurnRequest.make({ threadId, turnId, content })
 *
 * console.log(request._tag) // "edit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EditTurnRequest extends S.TaggedClass<EditTurnRequest>("EditTurnRequest")("edit", {
  threadId: WorkspaceIdentity.ThreadId.annotateKey({
    description: "Thread containing the turn to edit.",
  }),
  turnId: WorkspaceIdentity.TurnId.annotateKey({
    description: "Turn whose user message is replaced before regenerating.",
  }),
  content: SafeDocument.annotateKey({
    description: "Replacement user content for the edited turn.",
  }),
}) {}

/**
 * A turn the user wants to run: a fresh send or an edit-regenerate.
 *
 * **Example** (Match send turn request)
 *
 * ```ts
 * import { SendTurnRequest, TurnRequest } from "@beep/agents-client"
 * import { Md } from "@beep/md"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const threadId = Result.getOrThrow(S.decodeUnknownResult(Workspace.ThreadId)(10))
 * const content = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * const request = SendTurnRequest.make({ threadId, content })
 * const label = TurnRequest.match(request, {
 *   send: () => "new turn",
 *   edit: () => "edit turn",
 * })
 *
 * console.log(label) // "new turn"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurnRequest = S.Union([SendTurnRequest, EditTurnRequest]).pipe(
  S.annotate({ description: "A composer submission: either a new turn to send or an existing turn to edit." }),
  S.toTaggedUnion("_tag")
);

/**
 * Runtime type for {@link TurnRequest}.
 *
 * **Example** (Annotate send as TurnRequest)
 *
 * ```ts
 * import { SendTurnRequest } from "@beep/agents-client"
 * import type { TurnRequest } from "@beep/agents-client"
 * import { Md } from "@beep/md"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const threadId = Result.getOrThrow(S.decodeUnknownResult(Workspace.ThreadId)(10))
 * const content = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Hello")])))
 * const request: TurnRequest = SendTurnRequest.make({ threadId, content })
 *
 * console.log(request._tag) // "send"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurnRequest = typeof TurnRequest.Type;

// How hard the client chases the receipt the server records after a turn stops
// or fails. Exhaustion keeps the prompt in a non-sendable reconciliation state;
// only an explicit `not_persisted` receipt may restore a sendable draft.
const TURN_RECEIPT_POLL_ATTEMPTS = 8;
const TURN_RECEIPT_POLL_INTERVAL = Duration.millis(150);
// The interval is real wall-clock time between receipt reads. Tests set
// `BEEP_TURN_RECEIPT_POLL_INTERVAL` to a few millis so a starved CI runner
// cannot stretch eight polls past their timeout; production keeps the default.
const turnReceiptPollInterval = Config.duration("BEEP_TURN_RECEIPT_POLL_INTERVAL").pipe(
  Config.withDefault(TURN_RECEIPT_POLL_INTERVAL),
  Effect.orElseSucceed(constant(TURN_RECEIPT_POLL_INTERVAL))
);
const isUncertainTurnRequestStatus = (status: O.Option<TurnRequestStatus>): boolean =>
  O.isNone(status) || O.exists(status, (value) => value === "pending" || value === "accepted" || value === "unknown");
const terminalAssistantBlock = (text: "(failed)" | "(stopped)"): AssistantBlock =>
  ParagraphBlock.make({ children: [TextInline.make({ text })] });

// Cleanup from an interrupted fn node can overlap the replacement invocation.
// A generation guard keeps the old finalizer from clearing or restoring state
// owned by the newer turn.
const turnGenerationAtom = Atom.keepAlive(Atom.make(0));

/**
 * Drives one assistant turn: fires the streaming rpc, appends blocks into
 * {@link streamingTurnAtom} as they arrive, and on completion invalidates the
 * thread's timeline key (plus the workspace thread list) so the persisted turn
 * and any derived title refetch. Records a perceived-latency timer (send → first
 * block) and a decode-failure counter as client-side quality signals.
 *
 * **Gotchas**
 *
 * Interrupt-cleanup lesson (hard-won, ported verbatim): user-cancel arrives as
 * an `Atom.Interrupt` write, which refreshes this fn node's Lifetime BEFORE the
 * fiber unwinds. By the time `Effect.onInterrupt` runs, the `ctx` passed to the
 * fn is already disposed, so `ctx.set(...)` writes are silently dropped. Cleanup
 * on interrupt must therefore go through the `AtomRegistry` and `Reactivity`
 * services — which outlive the node — via `registry.set(streamingTurnAtom, ...)`
 * and `reactivity.invalidateUnsafe(turnKeys)`. The error path
 * (`Effect.tapError`) still runs on the live fiber, so it may use `ctx.set`.
 *
 * **Example** (Type run-turn write value)
 *
 * ```ts
 * import { runTurnAtom, SendTurnRequest, TurnRequest } from "@beep/agents-client"
 * import { Md } from "@beep/md"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * type WriteValue<A> = A extends Atom.Writable<unknown, infer W> ? W : never
 *
 * const threadId = Result.getOrThrow(S.decodeUnknownResult(Workspace.ThreadId)(10))
 * const content = Result.getOrThrow(Md.refineSafeDocument(Md.make([Md.p("Summarize this")])))
 * const request: WriteValue<typeof runTurnAtom> = SendTurnRequest.make({ threadId, content })
 * const mode = TurnRequest.match(request, {
 *   send: () => "stream a new assistant turn",
 *   edit: () => "regenerate from an edited turn",
 * })
 *
 * console.log(mode) // "stream a new assistant turn"
 * ```
 *
 * @effects
 * - Calls `SendMessage` or `EditMessage` through {@link ChatClient}.
 * - Writes optimistic state to {@link streamingTurnAtom} while blocks arrive.
 * - Clears {@link turnErrorAtom} on start and writes it on failure.
 * - Invalidates timeline and thread-list keys after completion or interrupt.
 * - Records perceived-latency metrics for the first streamed block.
 * @category atoms
 * @since 0.0.0
 */
export const runTurnAtom = ChatClient.runtime.fn<TurnRequest>()(
  Effect.fn("runTurn")(function* (turn, ctx) {
    const client = yield* ChatClient;
    const reactivity = yield* Reactivity.Reactivity;
    const registry = yield* AtomRegistry.AtomRegistry;
    const requestId = A.join(
      A.map(yield* Effect.all(A.replicate(Random.nextInt, 4)), (value) => `${value}`),
      ":"
    );
    const generation = registry.get(turnGenerationAtom) + 1;
    ctx.set(turnGenerationAtom, generation);
    yield* Effect.annotateCurrentSpan({ turn_kind: turn._tag, thread_id: turn.threadId });
    yield* Metric.update(Metric.withAttributes(turnAttempts, { kind: turn._tag }), 1);
    yield* Effect.logInfo("assistant turn started").pipe(Effect.annotateLogs({ turn: turn._tag }));
    const stream = TurnRequest.match(turn, {
      send: (turn) => client("SendMessage", { threadId: turn.threadId, content: turn.content, requestId }),
      edit: (turn) =>
        client("EditMessage", {
          threadId: turn.threadId,
          turnId: turn.turnId,
          content: turn.content,
          requestId,
        }),
    });
    const makeStreamingTurn = TurnRequest.match(turn, {
      send:
        (turn) =>
        (
          blocks: ReadonlyArray<AssistantBlock>,
          reconciliation: StreamingTurnReconciliation = StreamingTurnReconciliation.Enum.timeline
        ) =>
          StreamingTurn.make({
            threadId: turn.threadId,
            requestId: O.some(requestId),
            userContent: turn.content,
            reconciliation,
            blocks,
          }),
      edit:
        (turn) =>
        (
          blocks: ReadonlyArray<AssistantBlock>,
          reconciliation: StreamingTurnReconciliation = StreamingTurnReconciliation.Enum.timeline
        ) =>
          StreamingTurn.make({
            threadId: turn.threadId,
            requestId: O.some(requestId),
            userContent: turn.content,
            truncateFrom: O.some(turn.turnId),
            reconciliation,
            blocks,
          }),
    });
    // a completed turn changes this thread's timeline and bumps its activity in
    // every workspace list, so invalidate both the timeline and the shared list
    const turnKeys = [timelineKey(turn.threadId), THREADS_KEY];
    const startedAt = yield* Clock.currentTimeMillis;
    const recordDuration = Effect.gen(function* () {
      const endedAt = yield* Clock.currentTimeMillis;
      yield* Metric.update(
        Metric.withAttributes(turnDuration, { kind: turn._tag }),
        Duration.millis(endedAt - startedAt)
      );
    });
    let blocks: ReadonlyArray<AssistantBlock> = [];
    ctx.set(turnErrorAtom, O.none());
    ctx.set(streamingTurnAtom, O.some(makeStreamingTurn(blocks)));
    const pollTurnRequestStatus = Effect.flatMap(turnReceiptPollInterval, (interval) =>
      client("GetTurnRequestStatus", { requestId }).pipe(
        Effect.option,
        Effect.delay(interval),
        Effect.repeat({
          times: TURN_RECEIPT_POLL_ATTEMPTS,
          until: O.exists(
            (status) => status === "persisted" || status === "user_persisted" || status === "not_persisted"
          ),
        })
      )
    );
    const timelineAtom = threadTimelineAtoms(turn.threadId);
    // Reactivity invalidation notifies query atoms, but a function atom can read
    // the previous success before that notification has rebuilt the query node.
    // Subscribe before refreshing and wait for a distinct non-waiting result so
    // this result belongs to the post-turn fetch rather than the cached timeline.
    const refreshTimeline = (
      refresh: () => void
    ): Effect.Effect<void, ChatActionError | RpcClientError.RpcClientError> =>
      Effect.callback((resume) => {
        const previous = registry.get(timelineAtom);
        let refreshStarted = false;
        const cancel = registry.subscribe(
          timelineAtom,
          (result) => {
            if (result.waiting) {
              refreshStarted = true;
              return;
            }
            if (AsyncResult.isInitial(result) || (!refreshStarted && result === previous)) return;
            cancel();
            resume(AsyncResult.isFailure(result) ? Effect.failCause(result.cause) : Effect.void);
          },
          { immediate: false }
        );
        refresh();
        return Effect.sync(cancel);
      });
    const retainTerminalTurn = (text: "(failed)" | "(stopped)", reconciliation: StreamingTurnReconciliation) =>
      Effect.sync(() =>
        registry.set(
          unreconciledTurnAtoms(turn.threadId),
          A.append(
            registry.get(unreconciledTurnAtoms(turn.threadId)),
            makeStreamingTurn([terminalAssistantBlock(text)], reconciliation)
          )
        )
      );
    const reconcileReceiptFallbacks = Effect.gen(function* () {
      const unreconciledAtom = unreconciledTurnAtoms(turn.threadId);
      const snapshot = registry.get(unreconciledAtom);
      const decisions = yield* Effect.forEach(
        snapshot,
        (fallback) => {
          if (fallback.reconciliation === "timeline") {
            return Effect.succeed([fallback, O.some<TurnRequestStatus>("persisted")] as const);
          }
          const requestStatus = fallback.requestId.pipe(
            O.map((fallbackRequestId) =>
              client("GetTurnRequestStatus", { requestId: fallbackRequestId }).pipe(Effect.option)
            ),
            O.getOrElse(() => Effect.succeed(O.none<TurnRequestStatus>()))
          );
          return requestStatus.pipe(Effect.map((status) => [fallback, status] as const));
        },
        { concurrency: 1 }
      );
      yield* Effect.sync(() => {
        const draftAtom = draftAtoms(turn.threadId);
        const currentDraftOccupied = O.map(registry.get(draftAtom), () => true);
        let draftToRestore = O.none<StreamingTurn>();
        const retained = A.filter(registry.get(unreconciledAtom), (fallback) =>
          A.findFirst(decisions, ([candidate]) => candidate === fallback).pipe(
            O.map(([, status]) =>
              status.pipe(
                O.map((status) =>
                  Match.value(status).pipe(
                    Match.whenOr("pending", "accepted", "unknown", () => true),
                    Match.when("not_persisted", () =>
                      currentDraftOccupied.pipe(
                        O.orElse(() => O.map(draftToRestore, () => true)),
                        O.getOrElse(() => {
                          draftToRestore = O.some(fallback);
                          return false;
                        })
                      )
                    ),
                    Match.whenOr("persisted", "user_persisted", () => false),
                    Match.exhaustive
                  )
                ),
                O.getOrElse(() => true)
              )
            ),
            // Preserve fallbacks appended while receipt reads were in flight.
            O.getOrElse(() => true)
          )
        );
        A.forEach(O.toArray(draftToRestore), (fallback) => {
          ctx.set(draftAtom, O.some(fallback.userContent));
          ctx.set(draftRevisionAtoms(fallback.threadId), registry.get(draftRevisionAtoms(fallback.threadId)) + 1);
        });
        ctx.set(unreconciledAtom, retained);
      });
    });
    yield* Reactivity.mutation(
      Stream.runForEach(
        stream,
        Effect.fnUntraced(function* (block) {
          if (A.isReadonlyArrayEmpty(blocks)) {
            const now = yield* Clock.currentTimeMillis;
            yield* Metric.update(
              Metric.withAttributes(perceivedLatency, { kind: turn._tag }),
              Duration.millis(now - startedAt)
            );
          }
          blocks = A.append(blocks, block);
          ctx.set(streamingTurnAtom, O.some(makeStreamingTurn(blocks)));
        })
      ),
      turnKeys
    ).pipe(
      // error policy lives here, in Effect: clear the partial turn and log. The
      // error fiber is still live, so `ctx.set` is safe here.
      Effect.tapError(
        Effect.fnUntraced(function* (error) {
          ctx.set(streamingTurnAtom, O.none());
          const turnError = toTurnError(error);
          ctx.set(turnErrorAtom, O.some(turnError));
          const requestStatus = yield* pollTurnRequestStatus;
          if (O.contains(requestStatus, "not_persisted")) {
            // Give the user back what they wrote only when the server did not
            // commit it. Restoring a durable prompt would make retry duplicate
            // its user row.
            ctx.set(draftAtoms(turn.threadId), O.some(turn.content));
            ctx.set(draftRevisionAtoms(turn.threadId), registry.get(draftRevisionAtoms(turn.threadId)) + 1);
          } else {
            // Reactivity.mutation invalidates only on success. A failed stream
            // may still have committed the user row and a terminal assistant
            // marker, so explicitly refresh those durable states. Preserve a
            // local terminal turn if that read fails too, or if the exact
            // request receipt remains uncertain after bounded polling.
            yield* refreshTimeline(() => reactivity.invalidateUnsafe(turnKeys)).pipe(
              Effect.tap(() =>
                isUncertainTurnRequestStatus(requestStatus)
                  ? retainTerminalTurn("(failed)", StreamingTurnReconciliation.Enum.receipt)
                  : Effect.void
              ),
              Effect.catch(
                Effect.fnUntraced(function* (refreshError) {
                  yield* retainTerminalTurn(
                    "(failed)",
                    isUncertainTurnRequestStatus(requestStatus)
                      ? StreamingTurnReconciliation.Enum.receipt
                      : StreamingTurnReconciliation.Enum.timeline
                  );
                  yield* logRedactedCause(
                    Cause.fail(refreshError),
                    LogRedactedCauseOptions.make({
                      message: "failed assistant turn persisted but the thread could not be refreshed",
                      level: "Warn",
                      attributes: { kind: turn._tag, subsystem: "chat_ui" },
                    })
                  );
                })
              )
            );
          }
          yield* Metric.update(Metric.withAttributes(turnFailed, { kind: turn._tag }), 1);
          yield* logRedactedCause(
            Cause.fail(error),
            LogRedactedCauseOptions.make({
              message: "assistant turn failed",
              level: "Error",
              attributes: { kind: turn._tag, subsystem: "chat_ui" },
            })
          );
        })
      ),
      // defects bypass the typed channel above entirely: without this tap a
      // died turn clears no streaming state, sets no turnErrorAtom, and the
      // send disappears with the composer already emptied. Mirror the failure
      // policy: surface the error, and give the prompt back only when the
      // server provably never persisted it.
      Effect.tapDefect(
        Effect.fnUntraced(function* (defect) {
          ctx.set(streamingTurnAtom, O.none());
          ctx.set(turnErrorAtom, O.some(ChatActionError.new("The reply failed unexpectedly before completing.")));
          const requestStatus = yield* pollTurnRequestStatus;
          if (O.contains(requestStatus, "not_persisted")) {
            ctx.set(draftAtoms(turn.threadId), O.some(turn.content));
            ctx.set(draftRevisionAtoms(turn.threadId), registry.get(draftRevisionAtoms(turn.threadId)) + 1);
          }
          yield* Metric.update(Metric.withAttributes(turnFailed, { kind: turn._tag }), 1);
          yield* logRedactedCause(
            Cause.die(defect),
            LogRedactedCauseOptions.make({
              message: "assistant turn defected",
              level: "Error",
              attributes: { kind: turn._tag, subsystem: "chat_ui" },
            })
          );
        })
      ),
      // user-cancelled (Atom.Interrupt write): drop the partial turn and
      // refetch — the user message persisted before the stream started. The
      // Interrupt write refreshes the fn node BEFORE this fiber unwinds, so
      // `ctx` is already disposed and its writes are silently dropped — go
      // through the registry and reactivity services, which outlive the node.
      //
      // The exact request receipt distinguishes a queued cancellation from a
      // request whose user or assistant row committed. Aggregate timeline growth
      // cannot do that when another window is using the same thread. Restore the
      // prompt only when this request is confirmed not persisted. Missing or
      // unavailable receipt evidence must stay non-sendable because a durable
      // user row must never be duplicated by retry.
      Effect.onInterrupt(() =>
        Metric.update(Metric.withAttributes(turnCancelled, { kind: turn._tag }), 1).pipe(
          Effect.andThen(Effect.logInfo("assistant turn cancelled").pipe(Effect.annotateLogs({ turn: turn._tag }))),
          Effect.andThen(
            pollTurnRequestStatus.pipe(
              Effect.flatMap(
                Effect.fnUntraced(function* (requestStatus) {
                  if (registry.get(turnGenerationAtom) !== generation) return;
                  if (O.contains(requestStatus, "not_persisted")) {
                    registry.set(draftAtoms(turn.threadId), O.some(turn.content));
                    registry.set(
                      draftRevisionAtoms(turn.threadId),
                      registry.get(draftRevisionAtoms(turn.threadId)) + 1
                    );
                    registry.set(
                      turnErrorAtom,
                      O.some(
                        ChatActionError.new("The stopped reply could not be confirmed. Your message was restored.")
                      )
                    );
                    reactivity.invalidateUnsafe(turnKeys);
                  } else {
                    const requestStatusUncertain = isUncertainTurnRequestStatus(requestStatus);
                    if (requestStatusUncertain) {
                      registry.set(
                        turnErrorAtom,
                        O.some(
                          ChatActionError.new(
                            "The stopped reply could not be confirmed. It remains visible until the thread reconciles."
                          )
                        )
                      );
                    }
                    yield* refreshTimeline(() => reactivity.invalidateUnsafe(turnKeys)).pipe(
                      Effect.tap(() =>
                        requestStatusUncertain
                          ? retainTerminalTurn("(stopped)", StreamingTurnReconciliation.Enum.receipt)
                          : Effect.void
                      ),
                      Effect.catch(
                        Effect.fnUntraced(function* (refreshError) {
                          yield* retainTerminalTurn(
                            "(stopped)",
                            requestStatusUncertain
                              ? StreamingTurnReconciliation.Enum.receipt
                              : StreamingTurnReconciliation.Enum.timeline
                          );
                          registry.set(
                            turnErrorAtom,
                            O.some(
                              ChatActionError.new(
                                requestStatusUncertain
                                  ? "The stopped reply could not be confirmed or refreshed."
                                  : "The stopped reply persisted, but the thread could not be refreshed."
                              )
                            )
                          );
                          yield* logRedactedCause(
                            Cause.fail(refreshError),
                            LogRedactedCauseOptions.make({
                              message: "stopped assistant turn persisted but the thread could not be refreshed",
                              level: "Warn",
                              attributes: { kind: turn._tag, subsystem: "chat_ui" },
                            })
                          );
                        })
                      )
                    );
                  }
                  registry.set(streamingTurnAtom, O.none());
                })
              )
            )
          )
        )
      ),
      Effect.ensuring(recordDuration)
    );
    // wait for the refetched timeline before dropping the streamed turn, so the
    // persisted rendering swaps in without a gap.
    //
    // A failure here is a *display* problem — the turn itself already streamed
    // and persisted. Keep the streamed value as the local fallback; activity is
    // derived separately from this fn atom, so a failed refresh neither loses the
    // reply nor leaves the composer/Stop control believing generation continues.
    yield* refreshTimeline(() => ctx.refresh(timelineAtom)).pipe(
      Effect.tap(() =>
        reconcileReceiptFallbacks.pipe(
          Effect.andThen(
            Effect.sync(() => {
              ctx.set(streamingTurnAtom, O.none());
            })
          )
        )
      ),
      Effect.catch(
        Effect.fnUntraced(function* (error) {
          ctx.set(turnErrorAtom, O.some(toTurnError(error)));
          ctx.set(
            unreconciledTurnAtoms(turn.threadId),
            A.append(registry.get(unreconciledTurnAtoms(turn.threadId)), makeStreamingTurn(blocks))
          );
          ctx.set(streamingTurnAtom, O.none());
          yield* logRedactedCause(
            Cause.fail(error),
            LogRedactedCauseOptions.make({
              message: "assistant turn completed but the thread could not be refreshed",
              level: "Warn",
              attributes: { kind: turn._tag, subsystem: "chat_ui" },
            })
          );
        })
      )
    );
    yield* Metric.update(Metric.withAttributes(turnCompleted, { kind: turn._tag }), 1);
    yield* Metric.update(Metric.withAttributes(turnBlocks, { kind: turn._tag }), blocks.length);
    if (A.isReadonlyArrayEmpty(blocks)) {
      yield* Metric.update(Metric.withAttributes(turnZeroBlock, { kind: turn._tag }), 1);
      yield* Effect.logWarning("assistant turn completed without streamed blocks").pipe(
        Effect.annotateLogs({ turn: turn._tag })
      );
    }
    yield* Effect.logInfo("assistant turn complete");
  })
);

/**
 * Whether the assistant turn driver is actively running.
 *
 * **Details**
 *
 * This is intentionally separate from {@link unreconciledTurnAtoms}: completed
 * display fallbacks must not block another send or leave a nonfunctional Stop
 * action.
 *
 * **Example** (Check turnActiveAtom is atom)
 *
 * ```ts
 * import { turnActiveAtom } from "@beep/agents-client"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * console.log(Atom.isAtom(turnActiveAtom)) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const turnActiveAtom = Atom.map(runTurnAtom, AsyncResult.isWaiting);
