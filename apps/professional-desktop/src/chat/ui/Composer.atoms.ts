/**
 * Runtime-owned application behavior for the desktop chat composer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  draftAtoms,
  EditTurnRequest,
  editTargetAtom,
  reportDecodeFailureAtom,
  runTurnAtom,
  SendTurnRequest,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { editorStateToDocument } from "@beep/lexical-schema";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { LiteralKit } from "@beep/schema";
import { toast } from "@beep/ui/components/sonner";
import { A, O, Str } from "@beep/utils";
import { Effect, Tuple } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type * as Md from "@beep/md/Md.model";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const MAX_MESSAGE_CHARACTERS = 16_000;

const $I = $ProfessionalDesktopId.create("chat/ui/Composer.atoms");

class ComposerDecodeErrorNotice extends S.Class<ComposerDecodeErrorNotice>($I`ComposerDecodeErrorNotice`)(
  {
    kind: S.tag("decode-error"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerDecodeErrorNotice", {
    description: "A composer schema projection failure that must also update decode-failure telemetry.",
  })
) {}

class ComposerErrorNotice extends S.Class<ComposerErrorNotice>($I`ComposerErrorNotice`)(
  {
    kind: S.tag("error"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerErrorNotice", {
    description: "An operator-safe composer refusal rendered as an error toast.",
  })
) {}

class ComposerInfoNotice extends S.Class<ComposerInfoNotice>($I`ComposerInfoNotice`)(
  {
    kind: S.tag("info"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerInfoNotice", {
    description: "A non-failing composer notice rendered as an informational toast.",
  })
) {}

const ComposerNoticeKind = LiteralKit(["decode-error", "error", "info"]).pipe(
  $I.annoteSchema("ComposerNoticeKind", {
    description: "Exhaustive composer notification variants.",
  })
);

const ComposerNotice = ComposerNoticeKind.mapMembers(
  Tuple.evolve([() => ComposerDecodeErrorNotice, () => ComposerErrorNotice, () => ComposerInfoNotice])
)
  .annotate(
    $I.annote("ComposerNotice", {
      description: "Typed notification commands emitted by the composer state machine.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

type ComposerNotice = typeof ComposerNotice.Type;

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

/**
 * Untracked draft seed, keyed by thread and failure-driven draft revision.
 *
 * @example
 * ```ts
 * import { composerDraftSeedAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerDraftSeedAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerDraftSeedAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((_revision: number) => Atom.make((get) => get.once(draftAtoms(threadId))))
);

const updateComposerDraftAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<SerializedEditorState>()(
    Effect.fnUntraced(function* (serializedState, ctx) {
      const editingThisThread = O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId);
      if (O.isSome(editingThisThread)) return;
      const document = editorStateToDocument(serializedState);
      ctx.set(draftAtoms(threadId), A.isReadonlyArrayEmpty(document.children) ? O.none() : O.some(document));
    })
  )
);

const submitComposerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<Md.Document>()(
    Effect.fnUntraced(function* (content, ctx) {
      const request = O.match(
        O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId),
        {
          onNone: () => SendTurnRequest.make({ threadId, content }),
          onSome: (target) => EditTurnRequest.make({ threadId, turnId: target.turnId, content }),
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

const reportAttachmentsAtom = professionalBrowserRuntime.fn<ReadonlyArray<File>>()(
  Effect.fnUntraced(function* (files) {
    const count = A.length(files);
    yield* Effect.sync(() =>
      toast.info(
        `Captured ${count} attachment${count === 1 ? "" : "s"} — sending attachments to the model isn't wired yet.`
      )
    );
  })
);

/**
 * Stable editor-change handler that delegates draft projection and state writes
 * to the professional atom runtime.
 *
 * @example
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
  Atom.make((get) => {
    const updateDraft = updateComposerDraftAtoms(threadId);
    get.mount(updateDraft);
    return (state: SerializedEditorState): void => get.set(updateDraft, state);
  })
);

/**
 * Stable send handler. Synchronous refusal decisions satisfy the editor
 * contract; notices and accepted state transitions execute through runtime
 * atoms.
 *
 * @example
 * ```ts
 * import { composerSendHandlerAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSendHandlerAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSendHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make((get) => {
    const submit = submitComposerAtoms(threadId);
    get.mount(composerNoticeAtom);
    get.mount(submit);
    return (state: SerializedEditorState): boolean => {
      if (get.once(turnActiveAtom)) {
        get.set(
          composerNoticeAtom,
          ComposerNotice.cases.info.make({
            message: "A reply is still streaming — wait for it to finish, or press Stop.",
          })
        );
        return false;
      }
      const content = editorStateToDocument(state);
      if (A.isReadonlyArrayEmpty(content.children)) {
        get.set(
          composerNoticeAtom,
          ComposerNotice.cases["decode-error"].make({
            message: "This message could not be prepared for sending. Your draft has been kept.",
          })
        );
        return false;
      }
      const length = Str.length(renderPlainTextUnsafe(content));
      if (length > MAX_MESSAGE_CHARACTERS) {
        get.set(
          composerNoticeAtom,
          ComposerNotice.cases.error.make({
            message: `Message is ${length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARACTERS.toLocaleString()}.`,
          })
        );
        return false;
      }
      get.set(submit, content);
      return true;
    };
  })
);

/**
 * Stable stop handler backed by a runtime action.
 *
 * @example
 * ```ts
 * import { composerStopHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerStopHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerStopHandlerAtom = Atom.make((get) => {
  get.mount(stopComposerAtom);
  return (): void => get.set(stopComposerAtom, void 0);
});

/**
 * Stable edit-cancellation handler backed by a runtime action.
 *
 * @example
 * ```ts
 * import { composerCancelEditHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerCancelEditHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerCancelEditHandlerAtom = Atom.make((get) => {
  get.mount(cancelComposerEditAtom);
  return (): void => get.set(cancelComposerEditAtom, void 0);
});

/**
 * Stable attachment handler backed by a runtime notification effect.
 *
 * @example
 * ```ts
 * import { composerAttachmentHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerAttachmentHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerAttachmentHandlerAtom = Atom.make((get) => {
  get.mount(reportAttachmentsAtom);
  return (files: ReadonlyArray<File>): void => get.set(reportAttachmentsAtom, files);
});
