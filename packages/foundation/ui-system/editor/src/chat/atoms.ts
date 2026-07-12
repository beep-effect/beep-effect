/**
 * Per-editor `@effect/atom` state and Lexical-binding atoms shared across the
 * chat composer surface (send, typeahead, footer). Per the repo atom-first law
 * the composer holds no React hook state: every piece of per-composer state is
 * an `Atom.family` keyed by the `LexicalEditor` instance, so multiple composers
 * on one page never share state and Lexical command/listener registrations are
 * torn down via atom finalizers (never `useEffect`).
 *
 * The atoms work without a `RegistryProvider` (the default global registry), so
 * the composer still renders in Storybook where no provider is mounted.
 *
 * @packageDocumentation \@beep/editor/chat/atoms
 * @since 0.0.0
 */

import { SerializedEditorState } from "@beep/lexical-schema";
import { A, O } from "@beep/utils";
import { Effect, Layer, Result } from "effect";
import { dual } from "effect/Function";
import { Atom } from "effect/unstable/reactivity";
import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
} from "lexical";
import {
  AttachmentPortFailed,
  DEFAULT_MAX_ATTACHMENT_BYTES,
  fileToAttachment,
  revokeAttachment,
} from "./attachment-model.ts";
import { $isInsideCodeBlock, $openCodeFence } from "./code-fence.ts";
import { SEND_MESSAGE_COMMAND } from "./commands.ts";
import { ComposerFeatures } from "./config.ts";
import type { LexicalEditor } from "lexical";
import type { ComposerAttachment } from "./attachment-model.ts";

/**
 * Per-editor resolved {@link ComposerFeatures}. The composer writes the
 * defaults-filled features here; other atoms read `sendOn` and the flags from
 * it. Defaults to {@link ComposerFeatures.make} so an unmounted read is valid.
 *
 * @example
 * ```tsx
 * import { featuresAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function SendPolicyLabel() {
 *   const [editor] = useLexicalComposerContext()
 *   const features = useAtomValue(featuresAtom(editor))
 *   return <span>{features.sendOn}</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const featuresAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<ComposerFeatures>(ComposerFeatures.make())
);

/**
 * Per-editor typeahead menu-open state. Tracked as idempotent booleans (not a
 * counter): the typeahead `onOpen` fires on every query change, so a `+1/-1`
 * counter would never rebalance.
 *
 * @example
 * ```tsx
 * import { menusOpenAtom } from "@beep/editor/chat"
 * import { useAtomSet } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function CloseMenusButton() {
 *   const [editor] = useLexicalComposerContext()
 *   const setMenusOpen = useAtomSet(menusOpenAtom(editor))
 *   return <button onClick={() => setMenusOpen({ slash: false, mention: false })}>Close menus</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const menusOpenAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<{ readonly slash: boolean; readonly mention: boolean }>({ slash: false, mention: false })
);

/**
 * Per-editor derived flag: whether any typeahead menu is open. Subscribes to
 * {@link menusOpenAtom}.
 *
 * @example
 * ```tsx
 * import { anyMenuOpenAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function TypeaheadState() {
 *   const [editor] = useLexicalComposerContext()
 *   const menuOpen = useAtomValue(anyMenuOpenAtom(editor))
 *   return <span aria-live="polite">{menuOpen ? "Menu open" : "No menu"}</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const anyMenuOpenAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    const menus = get(menusOpenAtom(editor));
    return menus.slash || menus.mention;
  })
);

/**
 * Marks the rendered typeahead option container. Lexical's own menu anchor
 * already carries `role="listbox"`, so the portal must not add a second one (a
 * listbox nested in a listbox is an invalid ARIA hierarchy); this attribute
 * gives DOM queries a handle on the real menu without re-introducing the role.
 *
 * @category constants
 * @since 0.0.0
 */
export const TYPEAHEAD_MENU_ATTRIBUTE = "data-typeahead-menu";

/**
 * Marks a rendered typeahead container as belonging to `editor`.
 *
 * @category constants
 * @since 0.0.0
 */
export const typeaheadMenuMarker = (editor: LexicalEditor): Record<string, string> => ({
  [TYPEAHEAD_MENU_ATTRIBUTE]: editor.getKey(),
});

/**
 * The DOM id of a typeahead option, scoped to its editor.
 *
 * Lexical points the editor root's `aria-activedescendant` at a hardcoded
 * `typeahead-item-${index}`. With two composers on one page both menus emitted the
 * same ids, and `aria-activedescendant` resolves document-wide — first match wins — so
 * a screen reader in one composer could be told about an option belonging to the
 * other composer's menu. The id carries its editor now, and
 * {@link typeaheadActiveDescendant} repoints each editor at its own.
 *
 * @example
 * ```ts
 * import { typeaheadOptionId } from "@beep/editor/chat"
 * import { createEditor } from "lexical"
 *
 * console.log(typeaheadOptionId(createEditor(), 0).startsWith("typeahead-item-"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const typeaheadOptionId: {
  (index: number): (editor: LexicalEditor) => string;
  (editor: LexicalEditor, index: number): string;
} = dual(2, (editor: LexicalEditor, index: number): string => `typeahead-item-${editor.getKey()}-${index}`);

/**
 * Points an editor's `aria-activedescendant` at the option it has actually
 * highlighted, overriding the document-wide id Lexical writes.
 *
 * @example
 * ```ts
 * import { typeaheadActiveDescendant } from "@beep/editor/chat"
 *
 * console.log(typeof typeaheadActiveDescendant)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const typeaheadActiveDescendant: {
  (selectedIndex: number | null): (editor: LexicalEditor) => void;
  (editor: LexicalEditor, selectedIndex: number | null): void;
} = dual(2, (editor: LexicalEditor, selectedIndex: number | null): void => {
  const root = editor.getRootElement();
  if (root === null) return;
  if (selectedIndex === null) {
    root.removeAttribute("aria-activedescendant");
    return;
  }
  root.setAttribute("aria-activedescendant", typeaheadOptionId(editor, selectedIndex));
});

/**
 * Whether a typeahead listbox is genuinely on screen for `editor`: an option row
 * is rendered inside the typeahead container.
 *
 * {@link menusOpenAtom} is plugin-reported state and can go stale — a menu whose
 * trigger text vanished may never fire `onClose` — so anything that *suppresses*
 * behavior on its behalf, above all Enter-to-send, must confirm against the DOM.
 * Trusting the flag alone let a stale `true` swallow every Enter with no menu
 * visible and no way to send the draft.
 *
 * @example
 * ```ts
 * import { isTypeaheadMenuVisible } from "@beep/editor/chat"
 * import type { LexicalEditor } from "lexical"
 *
 * declare const editor: LexicalEditor
 * console.log(typeof isTypeaheadMenuVisible(editor)) // "boolean"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isTypeaheadMenuVisible = (editor: LexicalEditor): boolean => {
  const root = editor.getRootElement();
  if (root === null) return false;
  // Scoped to THIS editor. A document-wide query let a menu open in another
  // composer on the page suppress Enter here, which is the same silent
  // dead-Enter this predicate exists to prevent.
  return (
    root.ownerDocument.querySelector(`[${TYPEAHEAD_MENU_ATTRIBUTE}="${editor.getKey()}"] [role="option"]`) !== null
  );
};

/**
 * Per-editor captured attachments. Writable; the composer pushes captured files
 * and revokes object URLs on removal/unmount.
 *
 * @example
 * ```tsx
 * import { AttachmentChips, attachmentsAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function AttachmentPreview() {
 *   const [editor] = useLexicalComposerContext()
 *   const attachments = useAtomValue(attachmentsAtom(editor))
 *   return <AttachmentChips attachments={attachments} onRemove={() => undefined} />
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const attachmentsAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<ReadonlyArray<ComposerAttachment>>([])
);

/**
 * Per-editor max captured attachment size in bytes. Seeded from the composer's
 * `maxAttachmentBytes` prop so the capture runtime fns (picker + drag-drop) read
 * the same bound without threading it through React props. Defaults to
 * {@link DEFAULT_MAX_ATTACHMENT_BYTES}.
 *
 * @example
 * ```tsx
 * import { maxAttachmentBytesAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function AttachmentLimit() {
 *   const [editor] = useLexicalComposerContext()
 *   const maxBytes = useAtomValue(maxAttachmentBytesAtom(editor))
 *   return <span>{Math.round(maxBytes / 1024 / 1024)} MB</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const maxAttachmentBytesAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<number>(DEFAULT_MAX_ATTACHMENT_BYTES)
);

/**
 * Per-editor upload-port callback. The composer seeds the consumer's `onAttach`
 * here (once per mount); {@link captureAttachmentsFn} reads it after capture
 * validation and notifies the app with accepted files only. Defaults to a no-op
 * so an unseeded read is valid (e.g. in Storybook with no provider).
 *
 * @example
 * ```tsx
 * import { onAttachAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function NotifyAttachPort({ files }: { readonly files: ReadonlyArray<File> }) {
 *   const [editor] = useLexicalComposerContext()
 *   const onAttach = useAtomValue(onAttachAtom(editor))
 *   return <button onClick={() => onAttach(files)}>Notify upload port</button>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const onAttachAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<(files: ReadonlyArray<File>) => void>(() => undefined)
);

/**
 * The composer's `@effect/atom` runtime. Empty-layered: the composer's mutation
 * logic needs no services, only the `FnContext` to read/write the per-editor
 * atoms. Mutations are modeled as {@link Atom.runtime.fn} atoms so the
 * capture/remove *logic* lives in the runtime rather than in component handlers
 * (per the repo atom-first law).
 *
 * @example
 * ```ts
 * import { composerRuntime } from "@beep/editor/chat"
 * import { Effect } from "effect"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * type WriteValue<A> = A extends Atom.Writable<unknown, infer W> ? W : never
 *
 * const noopComposerMutation = composerRuntime.fn<{ readonly editorId: string }>()(() => Effect.void)
 * const writeValue: WriteValue<typeof noopComposerMutation> = { editorId: "composer-1" }
 *
 * console.log(writeValue.editorId) // "composer-1"
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerRuntime = Atom.runtime(Layer.empty);

/**
 * Capture-attachments mutation, modeled as a runtime `fn` atom. Writing
 * `{ editor, files }` runs the capture pipeline entirely inside the runtime: it
 * decodes each file through {@link fileToAttachment} (a `Result` per file),
 * logs any tagged {@link AttachmentRejection}s through the runtime, notifies the
 * per-editor {@link onAttachAtom} upload-port with accepted files only, then
 * appends the captured attachments to {@link attachmentsAtom}. The size bound is
 * read from {@link maxAttachmentBytesAtom}. Both the footer picker and the
 * drag-drop binding drive this same path.
 *
 * @example
 * ```tsx
 * import { captureAttachmentsFn } from "@beep/editor/chat"
 * import { useAtomSet } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function CaptureFilesButton({ files }: { readonly files: ReadonlyArray<File> }) {
 *   const [editor] = useLexicalComposerContext()
 *   const capture = useAtomSet(captureAttachmentsFn)
 *   return <button onClick={() => capture({ editor, files })}>Attach files</button>
 * }
 * ```
 *
 * @effects Invokes the per-editor upload-port callback with accepted files and
 * appends successfully decoded attachments to {@link attachmentsAtom}; rejected
 * files are logged.
 *
 * @category atoms
 * @since 0.0.0
 */
export const captureAttachmentsFn = composerRuntime.fn<{
  readonly editor: LexicalEditor;
  readonly files: ReadonlyArray<File>;
}>()(
  Effect.fnUntraced(function* ({ editor, files }, get) {
    if (A.isReadonlyArrayEmpty(files)) return;
    const results = A.map(files, (file) => fileToAttachment(file, get(maxAttachmentBytesAtom(editor))));
    // Surface (rather than silently drop) why a file was declined; the failure
    // channel is the whole reason `fromFile` returns `Result` not `O.Option`.
    const rejections = A.getSomes(A.map(results, Result.getFailure));
    if (A.isReadonlyArrayNonEmpty(rejections)) {
      yield* Effect.logWarning("ChatComposer declined attachments during capture", ...rejections);
    }
    const captured = A.getSomes(A.map(results, Result.getSuccess));
    if (A.isReadonlyArrayNonEmpty(captured)) {
      // Append BEFORE notifying: `fileToAttachment` has already minted object
      // URLs for these files, and only `attachmentsAtom` knows how to revoke
      // them. Notifying first meant a throwing consumer callback took the append
      // down with it, stranding every URL it had just created — invisible to
      // removal, send, and the unmount sweep alike.
      //
      // `FnContext.set` writes a value (no updater form), so the append reads the
      // current attachments via `get` and writes the concatenated array.
      get.set(attachmentsAtom(editor), [...get(attachmentsAtom(editor)), ...captured]);
      yield* Effect.try({
        try: () => get(onAttachAtom(editor))(A.map(captured, (attachment) => attachment.file)),
        catch: (cause) => AttachmentPortFailed.make({ message: String(cause) }),
      }).pipe(
        Effect.tapError((failure) =>
          Effect.logError("ChatComposer upload port rejected captured attachments", failure)
        ),
        Effect.ignore
      );
    }
  })
);

/**
 * Remove-attachment mutation, modeled as a runtime `fn` atom. Writing
 * `{ editor, id }` revokes the removed attachment's object URL (if found) and
 * filters it out of {@link attachmentsAtom}, entirely inside the runtime.
 *
 * @example
 * ```tsx
 * import { removeAttachmentFn } from "@beep/editor/chat"
 * import { useAtomSet } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function RemoveAttachmentButton({ id }: { readonly id: string }) {
 *   const [editor] = useLexicalComposerContext()
 *   const remove = useAtomSet(removeAttachmentFn)
 *   return <button onClick={() => remove({ editor, id })}>Remove</button>
 * }
 * ```
 *
 * @effects Revokes the removed attachment's object URL before writing the
 * filtered attachment list back to {@link attachmentsAtom}.
 *
 * @category atoms
 * @since 0.0.0
 */
export const removeAttachmentFn = composerRuntime.fn<{
  readonly editor: LexicalEditor;
  readonly id: string;
}>()(({ editor, id }, get) =>
  Effect.sync(() => {
    const previous = get(attachmentsAtom(editor));
    O.match(
      A.findFirst(previous, (attachment) => attachment.id === id),
      { onNone: () => undefined, onSome: revokeAttachment }
    );
    get.set(
      attachmentsAtom(editor),
      A.filter(previous, (attachment) => attachment.id !== id)
    );
  })
);

/**
 * Lexical editor-error sink, modeled as a runtime `fn` atom so the failure logs
 * through the Effect runtime rather than `Effect.runSync` in the editor's config
 * callback. `ChatComposer` wires `initialConfig.onError` to dispatch this via
 * `useAtomSet`, so editor errors are observed (not swallowed) while staying
 * within the atom-first law.
 *
 * @example
 * ```tsx
 * import { logEditorErrorFn } from "@beep/editor/chat"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * function LexicalErrorProbe() {
 *   const logEditorError = useAtomSet(logEditorErrorFn)
 *   return <button onClick={() => logEditorError("probe")}>Report editor error</button>
 * }
 * ```
 *
 * @effects Logs Lexical editor errors through the composer's Effect runtime.
 *
 * @category atoms
 * @since 0.0.0
 */
export const logEditorErrorFn = composerRuntime.fn<unknown>()((error) =>
  Effect.logError("ChatComposer Lexical editor error", error)
);

/**
 * Why the composer refused to send, if it did.
 *
 * A send used to be abandoned silently when the editor state failed to decode
 * against the wire schema: Enter and the Send button both did nothing, with no
 * error, no toast, and no log — the composer simply went dead while the draft
 * sat there intact. Whatever the schema gap turns out to be, refusing to send is
 * never allowed to be invisible.
 *
 * @example
 * ```tsx
 * import { sendBlockedAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 * import * as O from "effect/Option"
 *
 * function SendBlockedNotice() {
 *   const [editor] = useLexicalComposerContext()
 *   const blocked = useAtomValue(sendBlockedAtom(editor))
 *   return <span role="alert">{O.getOrElse(blocked, () => "")}</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const sendBlockedAtom = Atom.family((_editor: LexicalEditor) => Atom.make<O.Option<string>>(O.none()));

const SEND_DECODE_FAILURE_MESSAGE =
  "This message could not be prepared for sending. Please report it — your draft has been kept.";

const SEND_UNBOUND_MESSAGE =
  "This composer is not connected to a conversation. Please report it — your draft has been kept.";

/**
 * Per-editor live character count of the editor's plain text. The read fn
 * registers a Lexical update listener (torn down via the atom finalizer) and
 * pushes the new length with `get.setSelf` on every change.
 *
 * @example
 * ```tsx
 * import { characterCountAtom } from "@beep/editor/chat"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function LiveCharacterCount() {
 *   const [editor] = useLexicalComposerContext()
 *   const count = useAtomValue(characterCountAtom(editor))
 *   return <span>{count}</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const characterCountAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    get.addFinalizer(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => get.setSelf($getRoot().getTextContent().length));
      })
    );
    return editor.getEditorState().read(() => $getRoot().getTextContent().length);
  })
);

const hasCommandModifier = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey;

const isImeComposing = (event: KeyboardEvent): boolean => {
  // Modern browsers set `isComposing`; legacy IME paths can still surface only
  // `keyCode === 229`.
  const legacyKeyCode = (event as unknown as { readonly keyCode?: number }).keyCode;
  return event.isComposing || legacyKeyCode === 229;
};

const shouldSendFromEnter = (event: KeyboardEvent, sendOn: ComposerFeatures["sendOn"]): boolean =>
  sendOn === "enter" ? !event.shiftKey && !event.altKey && !hasCommandModifier(event) : hasCommandModifier(event);

/**
 * Per-editor Enter-to-send key binding. The read fn registers
 * `KEY_ENTER_COMMAND` at `COMMAND_PRIORITY_HIGH` (torn down via the atom
 * finalizer) and applies the configured send policy:
 *
 * - bail when a typeahead menu is open (the lower-priority menu takes Enter),
 * - bail during IME composition (`isComposing` / keyCode 229),
 * - `sendOn="enter"` ⇒ plain Enter sends (any modifier inserts a newline),
 * - `sendOn="modifierEnter"` ⇒ Cmd/Ctrl+Enter sends (plain Enter newlines).
 *
 * The send policy and menu-open flag are read with `get.once` inside the
 * handler so toggling either never re-registers the command.
 *
 * @example
 * ```tsx
 * import { sendKeyBindingAtom } from "@beep/editor/chat"
 * import { useAtomMount } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function EnterToSendBinding() {
 *   const [editor] = useLexicalComposerContext()
 *   useAtomMount(sendKeyBindingAtom(editor))
 *   return null
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const sendKeyBindingAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    get.addFinalizer(
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        // Enter handling is a single priority-ordered interaction state machine:
        // menu ownership, IME composition, newline policy, then send dispatch.
        // Keeping that ordering together makes Lexical command consumption
        // auditable and avoids splitting event ownership across callbacks.
        // fallow-ignore-next-line complexity
        (event) => {
          if (event === null) return false;
          // Yield Enter to a typeahead only when one is *actually* on screen.
          // The open flags are plugin-reported and can go stale (a menu whose
          // trigger vanished may never fire `onClose`); trusting the flag alone
          // let a stale `true` silently swallow every Enter, with no visible
          // menu and no way to send.
          if (get.once(anyMenuOpenAtom(editor)) && isTypeaheadMenuVisible(editor)) return false;
          if (isImeComposing(event)) return false;
          // A code block owns Enter: inside one the keystroke is a newline, or the
          // block the fence just opened could only ever hold a single line. That
          // spends the send gesture, so Cmd/Ctrl+Enter becomes an explicit send here
          // under either policy — otherwise a code block is a keyboard trap you can
          // only escape with the mouse.
          if ($isInsideCodeBlock()) {
            if (!hasCommandModifier(event)) return false;
            event.preventDefault();
            editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined);
            return true;
          }
          // A fence opener takes the keystroke ahead of both send and newline: typing
          // ```ts and pressing Enter is how a code block gets written, and this
          // composer consumes Enter before `@lexical/markdown` can ever see it.
          if ($openCodeFence()) {
            event.preventDefault();
            return true;
          }
          const sendOn = get.once(featuresAtom(editor)).sendOn;
          if (!shouldSendFromEnter(event, sendOn)) {
            // With sendOn="enter" the only newline gesture is Shift+Enter, and
            // Lexical's default maps it to a soft line-break — leaving the whole
            // draft one paragraph, so block toggles (lists/quote/code) swallow
            // everything typed so far. Promote it to a real paragraph break.
            if (sendOn === "enter" && event.shiftKey && !event.altKey && !hasCommandModifier(event)) {
              event.preventDefault();
              editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
              return true;
            }
            return false;
          }
          event.preventDefault();
          editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined);
          return true;
        },
        COMMAND_PRIORITY_HIGH
      )
    );
    return undefined;
  })
);

/**
 * Boxed send handler. Function values are boxed so the backing atom is a
 * writable state atom (a bare function initial value makes `Atom.make` build a
 * derived read atom instead).
 *
 * @example
 * ```ts
 * import type { SendHandlerBox } from "@beep/editor/chat"
 *
 * const sendHandler: SendHandlerBox = {
 *   run: (state) => state.root.type === "root",
 * }
 *
 * const result: ReturnType<SendHandlerBox["run"]> = true
 * console.log(result) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SendHandlerBox {
  readonly run: (state: SerializedEditorState.Type) => boolean | void;
}

/**
 * The `run` installed when no consumer `onSend` is bound. It is a sentinel, not
 * a no-op: {@link sendCommandBindingAtom} compares against it by identity and
 * reports an unbound composer instead of silently discarding the send.
 *
 * A send that goes nowhere and says nothing is indistinguishable from a broken
 * app — Enter and the Send button simply stop working, with the draft still
 * sitting there — so the unbound case is made loud at the one place that can
 * detect it.
 *
 * @example
 * ```ts
 * import { unboundSend } from "@beep/editor/chat"
 *
 * console.log(unboundSend()) // undefined
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const unboundSend = (): void => undefined;

/**
 * Per-editor convenience send handler. `run` receives the editor's current
 * serialized state (read live at send time, so it never sees stale/missed
 * content) and returns `true` to signal a turn was dispatched (the binding then
 * clears the editor in place). The composer writes the consumer's `onSend` here;
 * the default is a no-op that reports no dispatch.
 *
 * @example
 * ```tsx
 * import { onSendAtom } from "@beep/editor/chat"
 * import { useAtomInitialValues } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 * import type { SerializedEditorState } from "@beep/lexical-schema"
 *
 * function SeedSendHandler({
 *   onSend,
 * }: {
 *   readonly onSend: (state: SerializedEditorState.Type) => boolean | void
 * }) {
 *   const [editor] = useLexicalComposerContext()
 *   useAtomInitialValues([[onSendAtom(editor), { run: onSend }]])
 *   return null
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const onSendAtom = Atom.family((_editor: LexicalEditor) => Atom.make<SendHandlerBox>({ run: unboundSend }));

/**
 * Per-editor `SEND_MESSAGE_COMMAND` handler registered at
 * `COMMAND_PRIORITY_LOW`. On send it decodes the editor's CURRENT serialized
 * state and hands it to the per-editor {@link onSendAtom} (so the consumer always
 * receives the live content — no mirror/listener gap); when that reports `true`
 * the editor is cleared in place — `$getRoot().clear()` then a fresh empty
 * paragraph re-selected — keeping focus and a valid selection (`registerRichText`
 * does not handle `CLEAR_EDITOR_COMMAND`). An out-of-schema state is skipped.
 *
 * @example
 * ```tsx
 * import { sendCommandBindingAtom } from "@beep/editor/chat"
 * import { useAtomMount } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function SendCommandBinding() {
 *   const [editor] = useLexicalComposerContext()
 *   useAtomMount(sendCommandBindingAtom(editor))
 *   return null
 * }
 * ```
 *
 * @effects Registers `SEND_MESSAGE_COMMAND`; on successful dispatch it clears
 * editor content, revokes captured attachment URLs, and empties
 * {@link attachmentsAtom}.
 *
 * @category atoms
 * @since 0.0.0
 */
export const sendCommandBindingAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    get.addFinalizer(
      editor.registerCommand(
        SEND_MESSAGE_COMMAND,
        () => {
          const editorState = editor.getEditorState();
          // Nothing to send when the editor has no text content — Enter (or the
          // Send button) on an empty composer is a no-op. (When attachment
          // transport lands, an attachments-present check joins this guard.)
          const hasContent = editorState.read(() => $getRoot().getTextContent().trim().length > 0);
          const handler = get.once(onSendAtom(editor));
          // An unbound handler means the composer's `onSend` was never seeded —
          // or was swept out from under this binding by the registry's idle TTL
          // (see the mount in `ComposerBody`). Either way the send has nowhere
          // to go, and returning a quiet `false` here is what made a composer
          // that had silently stopped sending look like a broken app.
          if (hasContent && handler.run === unboundSend) {
            get.set(sendBlockedAtom(editor), O.some(SEND_UNBOUND_MESSAGE));
            get.set(logEditorErrorFn, "ChatComposer refused to send: no send handler is bound");
            return true;
          }
          const dispatched =
            hasContent &&
            O.match(SerializedEditorState.decodeOption(editorState.toJSON()), {
              // A state the wire schema rejects is a bug in the schema or the
              // editor — never a reason to make the composer quietly stop
              // working. Say so, keep the draft, and leave a log behind.
              onNone: () => {
                get.set(sendBlockedAtom(editor), O.some(SEND_DECODE_FAILURE_MESSAGE));
                get.set(logEditorErrorFn, "ChatComposer refused to send: editor state failed to decode");
                return false;
              },
              onSome: (state) => {
                get.set(sendBlockedAtom(editor), O.none());
                return handler.run(state) === true;
              },
            });
          if (dispatched) {
            editor.update(() => {
              const root = $getRoot();
              root.clear();
              const paragraph = $createParagraphNode();
              root.append(paragraph);
              paragraph.select();
            });
            // Reset the captured attachments alongside the editor content: revoke
            // their object URLs (so they don't leak between sends) and empty the
            // chip strip. The unmount sweep is the final backstop; this keeps the
            // composer consistent turn-to-turn.
            const captured = get.once(attachmentsAtom(editor));
            if (A.isReadonlyArrayNonEmpty(captured)) {
              for (const attachment of captured) revokeAttachment(attachment);
              get.set(attachmentsAtom(editor), []);
            }
          }
          return true;
        },
        COMMAND_PRIORITY_LOW
      )
    );
    return undefined;
  })
);
