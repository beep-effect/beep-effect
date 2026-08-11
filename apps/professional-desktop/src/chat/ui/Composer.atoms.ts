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
import { A, O } from "@beep/utils";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
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
import type { SerializedEditorState } from "@beep/lexical-schema";
import type * as Md from "@beep/md/Md.model";
import type { SafeDocument } from "@beep/md/Md.safe";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

/**
 * Classifies a persisted general document before it is projected into Lexical.
 * Any safety violation — trusted raw nodes, an unsafe URL, invalid scalar
 * text, duplicate footnote definitions — yields a refusal that gates sending
 * until the draft is edited into safe content.
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
      get.mount(updateDraft);
      return (state: SerializedEditorState): void => get.set(updateDraft, state);
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
      get.mount(composerNoticeAtom);
      get.mount(submit);
      return (state: SerializedEditorState): boolean => {
        const decision = composerPolicy.decideSend({
          gateOpen: O.isSome(get.once(gateAtom)),
          seed,
          state,
          turnActive: get.once(turnActiveAtom),
        });
        return ComposerSendDecision.match(decision, {
          gated: () => false,
          refuse: ({ notice }) => {
            get.set(composerNoticeAtom, notice);
            return false;
          },
          unsafe: ({ refusal }) => {
            get.set(composerSafetyRefusalAtoms(threadId), O.some(refusal));
            return false;
          },
          send: ({ content }) => {
            get.set(composerSafetyRefusalAtoms(threadId), O.none());
            get.set(submit, content);
            return true;
          },
        });
      };
    })
  )
);

// Stable stop handler backed by a runtime action.
const composerStopHandlerAtom = Atom.make((get) => {
  get.mount(stopComposerAtom);
  return (): void => get.set(stopComposerAtom, void 0);
});

// Stable edit-cancellation handler backed by a runtime action.
const composerCancelEditHandlerAtom = Atom.make((get) => {
  get.mount(cancelComposerEditAtom);
  return (): void => get.set(cancelComposerEditAtom, void 0);
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
