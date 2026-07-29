/**
 * Attachment capture plugins + UI for the chat composer: a drag-drop / paste
 * binding, the capture plugin, and the chip/thumbnail strip. Per the packet's
 * Attachment contract this layer is app-agnostic *capture only* — it never
 * performs transport or persistence. The composer hands captured `File`s to the
 * app's `onAttach` upload-port callback; sending attachments on the turn payload
 * is a separately-gated cross-slice extension.
 *
 * The pure {@link ComposerAttachment} model + capture validation live in
 * `./attachment-model.ts` (no atom/React deps) so the per-editor atom layer
 * (`./atoms.ts`) can reuse them without a circular import back through here. This
 * file owns only the atom binding (`@effect/atom`, no `useEffect`) and the React
 * components.
 *
 * @packageDocumentation \@beep/editor/chat/attachments
 * @since 0.0.0
 */

import { cn } from "@beep/ui/lib/utils";
import { A, N, O } from "@beep/utils";
import { useAtom, useAtomMount, useAtomSet } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { FileIcon, XIcon } from "@phosphor-icons/react";
import { Atom } from "effect/unstable/reactivity";
import { COMMAND_PRIORITY_LOW } from "lexical";
import { attachmentFailureAtom, captureAttachmentsFn } from "./atoms.ts";
import { AttachmentFailure, isImageAttachment } from "./attachment-model.ts";
import type { LexicalEditor } from "lexical";
import type { JSX } from "react";
import type { ComposerAttachment } from "./attachment-model.ts";

/**
 * Per-editor binding that registers the Lexical `DRAG_DROP_PASTE` command and
 * drives captured files through the shared {@link captureAttachmentsFn} runtime
 * mutation (via the registry on its `AtomContext`), so drag-drop and the footer
 * picker share one capture path. Keyed by the `LexicalEditor` instance; the
 * registration is torn down via the atom finalizer on unmount.
 *
 * @category atoms
 * @since 0.0.0
 */
const dragDropBindingAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    get.addFinalizer(
      editor.registerCommand(
        DRAG_DROP_PASTE,
        (files) => {
          if (A.isReadonlyArrayNonEmpty(files)) get.registry.set(captureAttachmentsFn, { editor, files });
          return true;
        },
        COMMAND_PRIORITY_LOW
      )
    );
    return undefined;
  })
);

/**
 * Drag-drop / paste capture plugin. Mount inside a `LexicalComposer`; captured
 * files are driven through the per-editor {@link captureAttachmentsFn} runtime
 * mutation and the default node insertion is suppressed (the editor has no
 * attachment node — capture is out-of-band). The plugin also keeps
 * {@link captureAttachmentsFn} mounted (via `useAtomSet`) so the registry never
 * interrupts the capture fiber dispatched from the drag-drop binding.
 *
 * @example
 * ```tsx
 * import { AttachmentPlugin } from "@beep/editor/chat/attachments"
 *
 * function CaptureBinding() {
 *   return <AttachmentPlugin />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function AttachmentPlugin(): null {
  const [editor] = useLexicalComposerContext();
  // Keep the capture mutation mounted so the fiber dispatched by the drag-drop
  // binding (and the footer picker) is never interrupted by the registry.
  useAtomSet(captureAttachmentsFn);
  useAtomMount(dragDropBindingAtom(editor));
  return null;
}

const attachmentFailureMessage = AttachmentFailure.match({
  AttachmentInvalidMimeType: ({ filename }) => `${filename} has an unsupported or missing file type.`,
  AttachmentPortFailed: ({ message }) => message,
  AttachmentTooLarge: ({ filename, maxBytes }) =>
    `${filename} is larger than the ${N.round(maxBytes / (1024 * 1024), 1)} MB attachment limit. Choose a smaller file.`,
});

/**
 * Inline, dismissible attachment failure for the current composer. Failures are
 * schema-backed and rendered exhaustively; raw upload-port defects remain in
 * structured logs and are never interpolated into the DOM.
 *
 * @example
 * ```tsx
 * import { AttachmentFailureNotice } from "@beep/editor/chat/attachments"
 *
 * function ComposerFailures() {
 *   return <AttachmentFailureNotice />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function AttachmentFailureNotice(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [failure, setFailure] = useAtom(attachmentFailureAtom(editor));

  return O.match(failure, {
    onNone: () => null,
    onSome: (value) => (
      <div
        className="mx-3 mt-2 flex items-center justify-between gap-2 rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
        role="alert"
      >
        <span>{attachmentFailureMessage(value)}</span>
        <button
          type="button"
          aria-label="Dismiss attachment error"
          className="rounded-sm p-0.5 hover:bg-destructive/10"
          onClick={() => setFailure(O.none())}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    ),
  });
}

/**
 * The captured-attachment chip strip with per-item remove controls and image
 * thumbnails.
 *
 * @example
 * ```tsx
 * import { AttachmentChips } from "@beep/editor/chat/attachments"
 * import type { ComposerAttachment } from "@beep/editor/chat/attachment-model"
 *
 * function CapturedFiles({ attachments }: { readonly attachments: ReadonlyArray<ComposerAttachment> }) {
 *   return <AttachmentChips attachments={attachments} onRemove={(id) => console.log(id)} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function AttachmentChips({
  attachments,
  onRemove,
  className,
}: {
  readonly attachments: ReadonlyArray<ComposerAttachment>;
  readonly onRemove: (id: string) => void;
  readonly className?: string;
}): JSX.Element | null {
  if (A.isReadonlyArrayEmpty(attachments)) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2 px-3 pt-2", className)}>
      {A.map(attachments, (attachment) => (
        <li
          key={attachment.id}
          className="bg-muted/60 text-foreground flex max-w-56 items-center gap-2 rounded-md border py-1 pr-1 pl-2 text-xs"
        >
          {isImageAttachment(attachment) ? (
            <img src={attachment.objectUrl} alt={attachment.filename} className="size-7 rounded object-cover" />
          ) : (
            <FileIcon className="size-5 shrink-0" />
          )}
          <span className="truncate">{attachment.filename}</span>
          <button
            type="button"
            aria-label={`Remove ${attachment.filename}`}
            className="hover:bg-background/80 text-muted-foreground hover:text-foreground rounded-sm p-0.5"
            onClick={() => onRemove(attachment.id)}
          >
            <XIcon className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
