/**
 * Runtime-owned application behavior for the desktop chat composer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  draftAtoms,
  draftRevisionAtoms,
  EditTurnRequest,
  editTargetAtom,
  reportDecodeFailureAtom,
  runTurnAtom,
  SendTurnRequest,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { documentSafetyIssues } from "@beep/md/Md.safe";
import { toast } from "@beep/ui/components/sonner";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import {
  ComposerNotice,
  ComposerSafetyRefusal,
  ComposerSendDecision,
  composerDocumentFromEditorState,
  composerPolicy,
  unsafeDocumentMessage,
} from "./ComposerPolicy.ts";
import type { EditTarget } from "@beep/agents-client/Chat.atoms";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import type * as Md from "@beep/md/Md.model";
import type { SafeDocument } from "@beep/md/Md.safe";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

/**
 * Classifies a persisted general document before it is projected into Lexical.
 * Trusted raw nodes, unsafe URLs, invalid scalar text, duplicate footnote
 * definitions, and non-conformant document structures each yield a refusal
 * that gates sending until the draft is edited into safe content.
 *
 * **Example** (Classify legacy RawNormalization gate)
 *
 * ```ts
 * import { prepareComposerDocumentSafetyGate } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as O from "effect/Option"
 *
 * const rawDocument = Md.Document.make({
 *   children: [Md.P.make({ children: [Md.RawHtml.make({ value: "<b>literal</b>" })] })],
 * })
 * console.log(O.getOrThrow(prepareComposerDocumentSafetyGate(rawDocument)).issueCount) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const prepareComposerDocumentSafetyGate = (document: Md.Document): O.Option<ComposerSafetyRefusal> => {
  const issues = documentSafetyIssues(document);
  return A.isReadonlyArrayNonEmpty(issues)
    ? O.some(
        ComposerSafetyRefusal.make({
          issueCount: A.length(issues),
          message: unsafeDocumentMessage(issues),
        })
      )
    : O.none();
};

/**
 * Per-thread, per-seed safety gate. Its initial state is derived from the
 * original persisted `Document`, before Lexical can lossily project trusted raw
 * nodes to plain text.
 *
 * **Example** (Get initial None safety gate)
 *
 * ```ts
 * import { composerDocumentSafetyGateAtoms } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const seed = Md.Document.make({ children: [] })
 * const registry = AtomRegistry.make()
 * const gate = registry.get(composerDocumentSafetyGateAtoms(WorkspaceIdentity.ThreadId.make(1))(seed))
 * console.log(gate._tag) // "None"
 * registry.dispose()
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerDocumentSafetyGateAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make<O.Option<ComposerSafetyRefusal>>(prepareComposerDocumentSafetyGate(seed))
  )
);

// Per-thread safety refusal shown beside the composer. A successful subsequent
// refinement clears it; rejected drafts stay persisted as general documents.
const composerSafetyRefusalAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make<O.Option<ComposerSafetyRefusal>>(O.none())
);

const composerNoticeAtom = professionalBrowserRuntime.fn<ComposerNotice>()(
  Effect.fnUntraced(function* (notice, ctx) {
    yield* ComposerNotice.match(notice, {
      "decode-error": (notice) =>
        Effect.sync(() => {
          ctx.set(reportDecodeFailureAtom, void 0);
          toast.error(notice.message);
        }),
      error: (notice) => Effect.sync(() => toast.error(notice.message)),
      info: (notice) => Effect.sync(() => toast.info(notice.message)),
    });
  })
);

// Untracked draft seed, keyed by thread and failure-driven draft revision.
const composerDraftSeedAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((_revision: number) => Atom.make((get) => get.once(draftAtoms(threadId))))
);

const updateComposerDraftAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    professionalBrowserRuntime.fn<SerializedEditorState>()(
      Effect.fnUntraced(function* (serializedState, ctx) {
        const gateAtom = composerDocumentSafetyGateAtoms(threadId)(seed);
        const document = composerDocumentFromEditorState(seed, serializedState);
        // A gate only opens at seed time; edits can close it once the draft no
        // longer carries a violation, and never open a new one — send-time
        // refinement owns violations introduced while editing.
        const nextGate = O.flatMap(ctx(gateAtom), () => prepareComposerDocumentSafetyGate(document));

        ctx.set(composerSafetyRefusalAtoms(threadId), O.none());
        ctx.set(gateAtom, nextGate);

        // An open gate keeps the original general document in draft storage;
        // only a corrected draft resumes normal persistence.
        if (O.isSome(nextGate)) return;
        const editingThisThread = O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId);
        if (O.isSome(editingThisThread)) return;
        ctx.set(draftAtoms(threadId), A.isReadonlyArrayEmpty(document.children) ? O.none() : O.some(document));
      })
    )
  )
);

const submitComposerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<SafeDocument>()(
    Effect.fnUntraced(function* (content, ctx) {
      const request = O.match(
        O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId),
        {
          onNone: () => SendTurnRequest.make({ threadId, content }),
          onSome: (target) =>
            EditTurnRequest.make({
              threadId,
              turnId: target.turnId,
              content,
            }),
        }
      );
      ctx.set(runTurnAtom, request);
      ctx.set(draftAtoms(threadId), O.none());
      ctx.set(editTargetAtom, O.none());
    })
  )
);

// How long a dispatched send may stay invisible before it counts as dropped.
// An accepted write flips the turn node within milliseconds, so the timeout
// fires only when the dispatch chain never ran at all.
const TURN_DISPATCH_CONFIRM_TIMEOUT = Duration.seconds(2);

/**
 * Dispatches a send through the registry and confirms a turn actually
 * started, restoring the draft when it provably never did.
 *
 * **Details**
 *
 * QA 2026-08-26 P0: the Lexical send binding holds the handler closure as a
 * plain function, so it keeps running after the registry's idle sweep
 * disposes the handler's own atom node — every ctx-bound write inside it is
 * then silently dropped while the editor still clears itself. This helper
 * therefore leans only on primitives that outlive nodes: the registry handle
 * and a detached timer fiber. The turn subscription is armed BEFORE the
 * submit write so a synchronous turn start cannot be missed, and both
 * subscriptions double as keep-alive for the dispatch window so the freshly
 * ensured fn nodes cannot be swept mid-flight.
 *
 * **Example** (Verify dispatch helper type)
 *
 * ```ts
 * import { dispatchTurnWithConfirm } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof dispatchTurnWithConfirm === "function") // true
 * ```
 *
 * @category actions
 * @since 0.0.0
 */
export const dispatchTurnWithConfirm: {
  <A>(
    threadId: WorkspaceIdentity.ThreadId,
    content: SafeDocument,
    submit: Atom.Writable<A, SafeDocument>,
    timeout?: Duration.Input
  ): (registry: AtomRegistry.AtomRegistry) => void;
  <A>(
    registry: AtomRegistry.AtomRegistry,
    threadId: WorkspaceIdentity.ThreadId,
    content: SafeDocument,
    submit: Atom.Writable<A, SafeDocument>,
    timeout?: Duration.Input
  ): void;
} = dual(
  (args) => AtomRegistry.isAtomRegistry(args[0]),
  <A>(
    registry: AtomRegistry.AtomRegistry,
    threadId: WorkspaceIdentity.ThreadId,
    content: SafeDocument,
    submit: Atom.Writable<A, SafeDocument>,
    timeout: Duration.Input = TURN_DISPATCH_CONFIRM_TIMEOUT
  ): void => {
    let sawTurnTransition = false;
    const unsubscribeTurn = registry.subscribe(
      runTurnAtom,
      (result) => {
        // A freshly created node can notify once with its Initial value; only a
        // real state transition counts as the turn starting.
        if (!AsyncResult.isInitial(result)) {
          sawTurnTransition = true;
        }
      },
      { immediate: false }
    );
    const unsubscribeSubmit = registry.subscribe(submit, () => void 0, { immediate: false });
    registry.set(submit, content);
    Effect.runFork(
      Effect.andThen(
        Effect.sleep(timeout),
        Effect.sync(() => {
          unsubscribeTurn();
          unsubscribeSubmit();
          if (sawTurnTransition || registry.get(turnActiveAtom)) return;
          registry.set(draftAtoms(threadId), O.some(content));
          registry.set(draftRevisionAtoms(threadId), registry.get(draftRevisionAtoms(threadId)) + 1);
          toast.error("The message could not be sent. Your draft was restored. Try again.");
        })
      )
    );
  }
);

const stopComposerAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(runTurnAtom, Atom.Interrupt);
  })
);

const cancelComposerEditAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(editTargetAtom, O.none());
  })
);

/**
 * Stable editor-change handler that delegates draft projection and state writes
 * to the professional atom runtime.
 *
 * **Example** (Verify change handler atoms type)
 *
 * ```ts
 * import { composerSerializedChangeHandlerAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSerializedChangeHandlerAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSerializedChangeHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make((get) => {
      const updateDraft = updateComposerDraftAtoms(threadId)(seed);
      // The editor stores this closure and keeps calling it after the idle
      // sweep may have disposed this atom's node, so dispatch through the
      // registry handle, which outlives the node.
      const registry = get.registry;
      get.mount(updateDraft);
      return (state: SerializedEditorState): void => registry.set(updateDraft, state);
    })
  )
);

// Stable send handler. Synchronous refusal decisions satisfy the editor
// contract; notices and accepted state transitions execute through runtime
// atoms.
const composerSendHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make((get) => {
      const submit = submitComposerAtoms(threadId);
      const gateAtom = composerDocumentSafetyGateAtoms(threadId)(seed);
      // The Lexical send binding keeps running this closure after the idle
      // sweep may have disposed this atom's node; node-bound reads and writes
      // are silently dropped then, so everything inside goes through the
      // registry handle instead (QA 2026-08-26 P0).
      const registry = get.registry;
      get.mount(composerNoticeAtom);
      get.mount(submit);
      return (state: SerializedEditorState): boolean => {
        const decision = composerPolicy.decideSend({
          gateOpen: O.isSome(registry.get(gateAtom)),
          seed,
          state,
          turnActive: registry.get(turnActiveAtom),
        });
        return ComposerSendDecision.match(decision, {
          gated: () => false,
          refuse: ({ notice }) => {
            registry.set(composerNoticeAtom, notice);
            return false;
          },
          unsafe: ({ refusal }) => {
            registry.set(composerSafetyRefusalAtoms(threadId), O.some(refusal));
            return false;
          },
          send: ({ content }) => {
            registry.set(composerSafetyRefusalAtoms(threadId), O.none());
            dispatchTurnWithConfirm(registry, threadId, content, submit);
            return true;
          },
        });
      };
    })
  )
);

// Stable stop handler backed by a runtime action. Registry-dispatched for the
// same zombie-closure reason as the send handler above.
const composerStopHandlerAtom = Atom.make((get) => {
  const registry = get.registry;
  get.mount(stopComposerAtom);
  return (): void => registry.set(stopComposerAtom, void 0);
});

// Stable edit-cancellation handler backed by a runtime action.
const composerCancelEditHandlerAtom = Atom.make((get) => {
  const registry = get.registry;
  get.mount(cancelComposerEditAtom);
  return (): void => registry.set(cancelComposerEditAtom, void 0);
});

// Derives the content to seed the editor with. Editing wins over the draft;
// the draft seeds only on thread / edit-target switches.
const contentToLoadFor = (editTarget: O.Option<EditTarget>, draft: O.Option<Md.Document>): O.Option<Md.Document> =>
  O.match(editTarget, {
    onNone: () => draft,
    onSome: (target) => O.some(target.content),
  });

interface ComposerShellView {
  readonly cancelEdit: () => void;
  readonly composerKey: string;
  readonly contentToLoad: O.Option<Md.Document>;
  readonly isEditing: boolean;
  readonly safetyRefusal: O.Option<ComposerSafetyRefusal>;
  readonly stop: () => void;
  readonly streaming: boolean;
}

/**
 * One read for the composer shell: edit state, streaming flag, seeded content,
 * remount key, refusal banner, and the stable stop/cancel handlers.
 *
 * **Example** (Invoke confirm normalization handler)
 *
 * ```ts
 * import { composerShellAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerShellAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerShellAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make((get): ComposerShellView => {
    // Edit state is global while the composer is per-thread: an edit target from
    // another thread would otherwise seed this composer and submit that thread's
    // turn id against this one.
    const editTarget = O.filter(get(editTargetAtom), (target) => target.threadId === threadId);
    const draftRevision = get(draftRevisionAtoms(threadId));
    const draft = get(composerDraftSeedAtoms(threadId)(draftRevision));
    return {
      cancelEdit: get(composerCancelEditHandlerAtom),
      composerKey: O.match(editTarget, {
        onNone: () => `thread:${threadId}:${draftRevision}`,
        onSome: (target) => `edit:${target.turnId}`,
      }),
      contentToLoad: contentToLoadFor(editTarget, draft),
      isEditing: O.isSome(editTarget),
      safetyRefusal: get(composerSafetyRefusalAtoms(threadId)),
      stop: get(composerStopHandlerAtom),
      streaming: get(turnActiveAtom),
    };
  })
);

interface ComposerSurfaceView {
  readonly onSend: (state: SerializedEditorState) => boolean;
  readonly onSerializedChange: (state: SerializedEditorState) => void;
  readonly safetyGate: O.Option<ComposerSafetyRefusal>;
}

/**
 * One read for the mounted editor surface: the safety gate plus the two
 * stable handlers, all keyed by the same `(threadId, seed)` pair so the
 * component never re-derives the double family application.
 *
 * **Example** (Verify cancel edit handler type)
 *
 * ```ts
 * import { composerSurfaceAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSurfaceAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSurfaceAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make(
      (get): ComposerSurfaceView => ({
        onSend: get(composerSendHandlerAtoms(threadId)(seed)),
        onSerializedChange: get(composerSerializedChangeHandlerAtoms(threadId)(seed)),
        safetyGate: get(composerDocumentSafetyGateAtoms(threadId)(seed)),
      })
    )
  )
);
