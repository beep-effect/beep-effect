/**
 * Per-editor `@effect/atom` state and Lexical-binding atoms shared across the
 * chat composer surface (send, typeahead, footer). Per the repo atom-first law
 * the composer holds no React hook state: every piece of per-composer state is
 * an `Atom.family` keyed by the `LexicalEditor` instance, so multiple composers
 * on one page never share state and Lexical command/listener registrations are
 * torn down via atom finalizers (never `useEffect`).
 *
 * **Details**
 *
 * The atoms work without a `RegistryProvider` (the default global registry), so
 * the composer still renders in Storybook where no provider is mounted.
 *
 * @packageDocumentation \@beep/editor/chat/atoms
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Atom from "effect/reactivity/Atom";
import * as Str from "effect/String";
import {
  $createParagraphNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
} from "lexical";
import { decodeEditorStateForRuntimeResult } from "../runtime.ts";
import {
  AttachmentPortFailed,
  DEFAULT_MAX_ATTACHMENT_BYTES,
  fileToAttachment,
  revokeAttachment,
} from "./attachment-model.ts";
import { $isInsideCodeBlock, $openCodeFence } from "./code-fence.ts";
import { SEND_MESSAGE_COMMAND } from "./commands.ts";
import { ComposerFeatures } from "./config.ts";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { LexicalEditor } from "lexical";
import type { AttachmentFailure, ComposerAttachment } from "./attachment-model.ts";
import type { AttachmentPort } from "./config.ts";

/**
 * Per-editor resolved {@link ComposerFeatures}. The composer writes the
 * defaults-filled features here; other atoms read `sendOn` and the flags from
 * it. Defaults to {@link ComposerFeatures.make} so an unmounted read is valid.
 *
 * **Example** (Reading send-on policy)
 *
 * ```tsx
 * import { featuresAtom } from "@beep/editor/chat/atoms"
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
  Atom.make<ComposerFeatures>(ComposerFeatures.make({}))
);

/**
 * Per-editor typeahead menu-open state. Tracked as idempotent booleans (not a
 * counter): the typeahead `onOpen` fires on every query change, so a `+1/-1`
 * counter would never rebalance.
 *
 * **Example** (Closing typeahead menus)
 *
 * ```tsx
 * import { menusOpenAtom } from "@beep/editor/chat/atoms"
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
 * **Example** (Reading menu-open flag)
 *
 * ```tsx
 * import { anyMenuOpenAtom } from "@beep/editor/chat/atoms"
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
 * **Example** (Marking typeahead menu)
 *
 * ```ts
 * import { TYPEAHEAD_MENU_ATTRIBUTE } from "@beep/editor/chat/atoms"
 *
 * const menu = document.createElement("div")
 * menu.setAttribute(TYPEAHEAD_MENU_ATTRIBUTE, "editor-1")
 * console.log(menu.getAttribute(TYPEAHEAD_MENU_ATTRIBUTE)) // "editor-1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TYPEAHEAD_MENU_ATTRIBUTE = "data-typeahead-menu";

/**
 * Marks a rendered typeahead container as belonging to `editor`.
 *
 * **Example** (Building menu marker)
 *
 * ```ts
 * import { TYPEAHEAD_MENU_ATTRIBUTE, typeaheadMenuMarker } from "@beep/editor/chat/atoms"
 * import { createEditor } from "lexical"
 *
 * const editor = createEditor()
 * console.log(typeaheadMenuMarker(editor)[TYPEAHEAD_MENU_ATTRIBUTE] === editor.getKey()) // true
 * ```
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
 * **Details**
 *
 * Lexical points the editor root's `aria-activedescendant` at a hardcoded
 * `typeahead-item-${index}`. With two composers on one page both menus emitted the
 * same ids, and `aria-activedescendant` resolves document-wide — first match wins — so
 * a screen reader in one composer could be told about an option belonging to the
 * other composer's menu. The id carries its editor now, and
 * {@link typeaheadActiveDescendant} repoints each editor at its own.
 *
 * **Example** (Scoped option DOM id)
 *
 * ```ts
 * import { typeaheadOptionId } from "@beep/editor/chat/atoms"
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
 * **Example** (Inspecting active descendant)
 *
 * ```ts
 * import { typeaheadActiveDescendant } from "@beep/editor/chat/atoms"
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
 * Whether a typeahead surface is genuinely on screen for `editor`.
 *
 * **Details**
 *
 * {@link menusOpenAtom} is plugin-reported state and can go stale — a menu whose
 * trigger text vanished may never fire `onClose` — so anything that *suppresses*
 * behavior on its behalf, above all Enter-to-send, must confirm against the DOM.
 * Trusting the flag alone let a stale `true` swallow every Enter with no menu
 * visible and no way to send the draft.
 *
 * **Gotchas**
 *
 * Headless Lexical throws from getRootElement; shared non-DOM command tests have no visible menu and must return false.
 *
 * Query only this editor's menu marker. A document-wide menu query lets another composer suppress Enter here.
 *
 * **Example** (Checking menu visibility)
 *
 * ```ts
 * import { isTypeaheadMenuVisible } from "@beep/editor/chat/atoms"
 * import { createEditor } from "lexical"
 *
 * console.log(isTypeaheadMenuVisible(createEditor())) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isTypeaheadMenuVisible = (editor: LexicalEditor): boolean => {
  const root = Result.getOrElse(
    Result.try(() => editor.getRootElement()),
    () => null
  );
  if (root === null) return false;
  return root.ownerDocument.querySelector(`[${TYPEAHEAD_MENU_ATTRIBUTE}="${editor.getKey()}"]`) !== null;
};

/**
 * Per-editor captured attachments. Writable; the composer pushes captured files
 * and revokes object URLs on removal/unmount.
 *
 * **Example** (Rendering attachment chips)
 *
 * ```tsx
 * import { attachmentsAtom } from "@beep/editor/chat/atoms"
 * import { AttachmentChips } from "@beep/editor/chat/attachments"
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
 * Per-editor inline attachment failure. The value is a schema-backed tagged
 * union so rendering can exhaustively distinguish capture validation from a
 * rejected consumer port without exposing raw causes.
 *
 * **Example** (Reading failure tag)
 *
 * ```tsx
 * import { attachmentFailureAtom } from "@beep/editor/chat/atoms"
 * import { useAtomValue } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function AttachmentFailureState() {
 *   const [editor] = useLexicalComposerContext()
 *   const failure = useAtomValue(attachmentFailureAtom(editor))
 *   return <span>{failure._tag}</span>
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const attachmentFailureAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<O.Option<AttachmentFailure>>(O.none())
);

/**
 * Per-editor max captured attachment size in bytes. Seeded from the composer's
 * `maxAttachmentBytes` prop so the capture runtime fns (picker + drag-drop) read
 * the same bound without threading it through React props. Defaults to
 * {@link DEFAULT_MAX_ATTACHMENT_BYTES}.
 *
 * **Example** (Displaying size limit)
 *
 * ```tsx
 * import { maxAttachmentBytesAtom } from "@beep/editor/chat/atoms"
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
 * **Example** (Invoking upload port)
 *
 * ```tsx
 * import { onAttachAtom } from "@beep/editor/chat/atoms"
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
export const onAttachAtom = Atom.family((_editor: LexicalEditor) => Atom.make<AttachmentPort>(() => undefined));

interface AttachmentLifecycle {
  readonly controller: AbortController;
}

// Private mount provenance for the attachment surface. Every Lexical root
// mount gets a fresh controller; pending capture fibers retain that exact
// controller so an older mount can never mutate a later one.
const attachmentLifecycleAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<O.Option<AttachmentLifecycle>>(O.none())
);

const closeAttachmentLifecycle = (
  lifecycle: AttachmentLifecycle,
  outstanding: ReadonlyArray<ComposerAttachment>
): void => {
  if (lifecycle.controller.signal.aborted) return;
  lifecycle.controller.abort();
  for (const attachment of outstanding) revokeAttachment(attachment);
};

/**
 * The composer's `@effect/atom` runtime. Empty-layered: the composer's mutation
 * logic needs no services, only the `FnContext` to read/write the per-editor
 * atoms. Mutations are modeled as {@link Atom.runtime.fn} atoms so the
 * capture/remove *logic* lives in the runtime rather than in component handlers
 * (per the repo atom-first law).
 *
 * **Example** (Defining runtime mutation)
 *
 * ```ts
 * import { composerRuntime } from "@beep/editor/chat/atoms"
 * import * as Effect from "effect/Effect";
 * import * as Atom from "effect/reactivity/Atom";
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
 * logs any tagged {@link AttachmentRejection}s through the runtime, appends the
 * accepted files to {@link attachmentsAtom}, and notifies the per-editor
 * {@link onAttachAtom} upload port. A rejected port rolls back only its batch.
 * The size bound is read from {@link maxAttachmentBytesAtom}. Both the footer
 * picker and the drag-drop binding drive this same path.
 *
 * **Gotchas**
 *
 * Concurrent operations outlive the read lifetime of their FnContext. Use its stable registry for mutations after awaiting the upload port.
 *
 * Append accepted files before notifying the port: capture already created object URLs, and only attachmentsAtom can revoke them. A throwing callback must not strand untracked URLs.
 *
 * Captures are independent concurrent batches. Latest-write-wins would interrupt an older notification after append and prevent rejection rollback.
 *
 * The sweep aborts the exact mount controller before revoking its URLs. A late rejection must neither read a disposed registry, revoke twice, nor update a later composer mount.
 *
 * **Example** (Capturing attachment files)
 *
 * ```tsx
 * import { captureAttachmentsFn } from "@beep/editor/chat/atoms"
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
 * @category atoms
 * @since 0.0.0
 */
export const captureAttachmentsFn = composerRuntime.fn<{
  readonly editor: LexicalEditor;
  readonly files: ReadonlyArray<File>;
}>()(
  Effect.fnUntraced(function* ({ editor, files }, get) {
    if (A.isReadonlyArrayEmpty(files)) return;
    const registry = get.registry;
    const lifecycle = registry.get(attachmentLifecycleAtom(editor));
    if (O.isNone(lifecycle) || lifecycle.value.controller.signal.aborted) return;
    const onAttach = registry.get(onAttachAtom(editor));
    const maxAttachmentBytes = registry.get(maxAttachmentBytesAtom(editor));
    registry.set(attachmentFailureAtom(editor), O.none());
    const results = A.map(files, (file) => fileToAttachment(file, maxAttachmentBytes));
    const rejections = A.getSomes(A.map(results, Result.getFailure));
    if (A.isReadonlyArrayNonEmpty(rejections)) {
      registry.set(attachmentFailureAtom(editor), O.some(rejections[0]));
      yield* Effect.logWarning("ChatComposer declined attachments during capture", ...rejections);
    }
    const captured = A.getSomes(A.map(results, Result.getSuccess));
    if (A.isReadonlyArrayNonEmpty(captured)) {
      registry.update(attachmentsAtom(editor), (current) => [...current, ...captured]);
      yield* Effect.tryPromise({
        try: () =>
          Promise.resolve().then(() => {
            if (lifecycle.value.controller.signal.aborted) return;
            return onAttach(A.map(captured, (attachment) => attachment.file));
          }),
        catch: (cause) =>
          AttachmentPortFailed.make({
            message: "Files could not be attached. Please try again.",
            cause,
          }),
      }).pipe(
        Effect.catch(
          Effect.fnUntraced(function* (failure) {
            if (lifecycle.value.controller.signal.aborted) return;
            const current = registry.get(attachmentsAtom(editor));
            const rolledBack = A.filter(current, (attachment) =>
              A.some(captured, (candidate) => candidate.id === attachment.id)
            );
            for (const attachment of rolledBack) revokeAttachment(attachment);
            registry.set(
              attachmentsAtom(editor),
              A.filter(current, (attachment) => !A.some(captured, (candidate) => candidate.id === attachment.id))
            );
            registry.set(attachmentFailureAtom(editor), O.some(failure));
            yield* Effect.logError("ChatComposer upload port rejected captured attachments", failure);
          })
        )
      );
    }
  }),
  { concurrent: true }
);

/**
 * Per-editor attachment lifetime and object-URL sweep.
 *
 * **Details**
 *
 * Lexical reports every root-element transition synchronously, including the
 * current root when the binding mounts. Each non-null root installs a fresh
 * abort controller consumed by {@link captureAttachmentsFn}; a null transition
 * aborts that exact mount before revoking its outstanding object URLs and
 * clearing attachment state. The registry finalizer retains only closure state,
 * so registry disposal performs the same idempotent sweep without reading or
 * writing a disposed registry.
 *
 * **Example** (Mounting lifetime sweep)
 *
 * ```tsx
 * import { attachmentSweepBindingAtom } from "@beep/editor/chat/atoms"
 * import { useAtomMount } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 *
 * function AttachmentLifetime() {
 *   const [editor] = useLexicalComposerContext()
 *   useAtomMount(attachmentSweepBindingAtom(editor))
 *   return null
 * }
 * ```
 *
 * @effects Aborts the mount-lifetime signal retained by pending attachment-port
 * work, revokes outstanding object URLs, and clears the per-editor attachment
 * collection on teardown.
 * @category atoms
 * @since 0.0.0
 */
export const attachmentSweepBindingAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    const lifecycleAtom = attachmentLifecycleAtom(editor);
    get.mount(lifecycleAtom);
    let lifecycle = O.none<AttachmentLifecycle>();
    let latest = get.once(attachmentsAtom(editor));
    get.subscribe(attachmentsAtom(editor), (next) => {
      latest = next;
    });
    const unregisterRootListener = editor.registerRootListener((rootElement) => {
      if (O.isSome(lifecycle)) closeAttachmentLifecycle(lifecycle.value, latest);
      lifecycle = O.none();
      get.set(lifecycleAtom, lifecycle);
      get.set(attachmentsAtom(editor), []);
      get.set(attachmentFailureAtom(editor), O.none());
      if (rootElement === null) return;
      lifecycle = O.some({ controller: new AbortController() });
      get.set(lifecycleAtom, lifecycle);
    });
    get.addFinalizer(() => {
      unregisterRootListener();
      if (O.isSome(lifecycle)) closeAttachmentLifecycle(lifecycle.value, latest);
    });
    return undefined;
  }).pipe(Atom.setIdleTTL(0))
);

/**
 * Remove-attachment mutation, modeled as a runtime `fn` atom. Writing
 * `{ editor, id }` revokes the removed attachment's object URL (if found) and
 * filters it out of {@link attachmentsAtom}, entirely inside the runtime.
 *
 * **Example** (Removing one attachment)
 *
 * ```tsx
 * import { removeAttachmentFn } from "@beep/editor/chat/atoms"
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
 * Lexical editor-error sink, modeled as a runtime `fn` atom so failures log
 * through the Effect runtime rather than being run directly in React render or
 * callback code. Editor surfaces dispatch this via `useAtomSet`, so errors are
 * observed without leaving the atom-first boundary.
 *
 * **Example** (Logging editor errors)
 *
 * ```tsx
 * import { logEditorErrorFn } from "@beep/editor/chat/atoms"
 * import { useAtomSet } from "@effect/atom-react"
 *
 * function LexicalErrorProbe() {
 *   const logEditorError = useAtomSet(logEditorErrorFn)
 *   return <button onClick={() => logEditorError("probe")}>Report editor error</button>
 * }
 * ```
 *
 * @effects Logs Lexical editor errors through the composer's Effect runtime.
 * @category atoms
 * @since 0.0.0
 */
export const logEditorErrorFn = composerRuntime.fn<unknown>()((error) =>
  Effect.logError("Editor runtime error", error)
);

/**
 * Why the composer refused to send, if it did.
 *
 * **Details**
 *
 * A send used to be abandoned silently when the editor state failed to decode
 * against the wire schema: Enter and the Send button both did nothing, with no
 * error, no toast, and no log — the composer simply went dead while the draft
 * sat there intact. Whatever the schema gap turns out to be, refusing to send is
 * never allowed to be invisible.
 *
 * **Example** (Showing blocked reason)
 *
 * ```tsx
 * import { sendBlockedAtom } from "@beep/editor/chat/atoms"
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
 * **Example** (Live character count)
 *
 * ```tsx
 * import { characterCountAtom } from "@beep/editor/chat/atoms"
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
  const legacyImeKeyCode = (event as unknown as { readonly keyCode?: number }).keyCode;
  return event.isComposing || legacyImeKeyCode === 229;
};

const shouldSendFromEnter = (event: KeyboardEvent, sendOn: ComposerFeatures["sendOn"]): boolean =>
  sendOn === "enter" ? !event.shiftKey && !event.altKey && !hasCommandModifier(event) : hasCommandModifier(event);

/**
 * Per-editor Enter-to-send key binding. The read fn registers
 * `KEY_ENTER_COMMAND` at `COMMAND_PRIORITY_HIGH` (torn down via the atom
 * finalizer) and applies the configured send policy:
 *
 * **Details**
 *
 * - during IME composition (`isComposing` / keyCode 229), consume the Lexical
 *   command only when a visible menu would otherwise select an option; with no
 *   visible menu, yield to the ordinary composition path,
 * - yield non-IME Enter to a visible typeahead menu for option selection,
 * - `sendOn="enter"` ⇒ plain Enter sends (any modifier inserts a newline),
 * - `sendOn="modifierEnter"` ⇒ Cmd/Ctrl+Enter sends (plain Enter newlines).
 *
 * The send policy is read with `get.once` inside the handler so changing it
 * never re-registers the command. Menu ownership is read from the
 * editor-scoped visible-menu marker at event time.
 *
 * **Gotchas**
 *
 * Enter ownership is ordered: current visible-menu/IME state, then code/fence/newline handling, then send dispatch. Plugin flags can go stale, so menu ownership must be confirmed against the DOM.
 *
 * With a visible menu, IME Enter consumes the Lexical command without preventing native composition; otherwise Lexical's lower-priority handler would select an option. With no visible menu, yield to ordinary composition.
 *
 * Inside a code block Enter stays a newline, allowing multiple code lines; Cmd/Ctrl+Enter sends under either policy so the user can leave the block without a mouse.
 *
 * A fence opener owns Enter before send or newline because the high-priority composer consumes the gesture before the markdown shortcut.
 *
 * For sendOn="enter", Shift+Enter inserts a real paragraph, rather than Lexical's soft break; otherwise subsequent block toggles would consume the whole draft as one paragraph.
 *
 * **Example** (Mounting enter-to-send)
 *
 * ```tsx
 * import { sendKeyBindingAtom } from "@beep/editor/chat/atoms"
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
        // fallow-ignore-next-line complexity -- the Enter handler orders visible-menu and IME, code-block, newline and send ownership (cognitive 11). Owner: @beep/editor. Exit: split when the composer keymap moves to a Lexical command priority table.
        (event) => {
          if (event === null) return false;
          const visibleTypeahead = isTypeaheadMenuVisible(editor);
          if (isImeComposing(event)) return visibleTypeahead;
          if (visibleTypeahead) return false;
          if ($isInsideCodeBlock()) {
            if (!hasCommandModifier(event)) return false;
            event.preventDefault();
            editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined);
            return true;
          }
          if ($openCodeFence()) {
            event.preventDefault();
            return true;
          }
          const sendOn = get.once(featuresAtom(editor)).sendOn;
          if (!shouldSendFromEnter(event, sendOn)) {
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
 * **Example** (Boxing a send handler)
 *
 * ```ts
 * import type { SendHandlerBox } from "@beep/editor/chat/atoms"
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
 * **Details**
 *
 * A send that goes nowhere and says nothing is indistinguishable from a broken
 * app — Enter and the Send button simply stop working, with the draft still
 * sitting there — so the unbound case is made loud at the one place that can
 * detect it.
 *
 * **Example** (Calling unbound sentinel)
 *
 * ```ts import.meta.vitest name="Calling unbound sentinel"
 * import { unboundSend } from "@beep/editor/chat/atoms"
 *
 * unboundSend() // => undefined
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
 * **Example** (Seeding send handler)
 *
 * ```tsx
 * import { onSendAtom } from "@beep/editor/chat/atoms"
 * import { useAtomInitialValues } from "@effect/atom-react"
 * import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
 * import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model"
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
 * **Gotchas**
 *
 * An empty text draft is a no-op for Enter and the Send button; captured attachments currently do not bypass the text-content guard.
 *
 * An unbound handler means onSend was never seeded or its config atom was swept after the registry idle TTL. Expose the blocked-send message rather than silently returning false.
 *
 * After a successful send, revoke captured attachment URLs and empty the chip strip alongside the editor content; the unmount sweep is only the final backstop.
 *
 * **Example** (Mounting send command)
 *
 * ```tsx
 * import { sendCommandBindingAtom } from "@beep/editor/chat/atoms"
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
          const hasContent = editorState.read(() => Str.trim($getRoot().getTextContent()).length > 0);
          const handler = get.once(onSendAtom(editor));
          if (hasContent && handler.run === unboundSend) {
            get.set(sendBlockedAtom(editor), O.some(SEND_UNBOUND_MESSAGE));
            get.set(logEditorErrorFn, "ChatComposer refused to send: no send handler is bound");
            return true;
          }
          const dispatched =
            hasContent &&
            Result.match(decodeEditorStateForRuntimeResult(editorState.toJSON()), {
              onFailure: () => {
                get.set(sendBlockedAtom(editor), O.some(SEND_DECODE_FAILURE_MESSAGE));
                get.set(logEditorErrorFn, "ChatComposer refused to send: editor state failed to decode");
                return false;
              },
              onSuccess: (state) => {
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
