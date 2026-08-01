/**
 * `ChatComposer`: a feature-flagged, lobehub-style chat input built on the same
 * `@beep/lexical-schema` v1 vocabulary as {@link EditorComposer}. The foundation
 * owns the *mechanism* (which plugins mount, the toolbar / typeahead / attachment
 * / send shell); the app injects *meaning* (slash items, the mention source, the
 * send handler, palette). Disabling every feature reduces it to the minimal
 * editable surface, so the bare `EditorComposer` and existing consumers are
 * untouched — this is additive.
 *
 * Per the repo schema-first + atom-first laws the consumer passes plain
 * objects/functions and `ChatComposer` schematizes internally
 * ({@link ComposerFeatures.make} fills feature defaults), while all per-composer
 * state lives in `@effect/atom` families keyed by the `LexicalEditor` (no React
 * hook state). Send is dispatched as {@link SEND_MESSAGE_COMMAND}: pass `onSend`
 * for a simple callback, or register a higher-priority handler from a `children`
 * plugin. Stop is dispatched as {@link STOP_MESSAGE_COMMAND}.
 *
 * @packageDocumentation \@beep/editor/chat/chat-composer
 * @since 0.0.0
 */
"use client";

import { EditorStateFromJson, SerializedEditorState } from "@beep/lexical-schema";
import { Button } from "@beep/ui/components/button";
import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable";
import { cn } from "@beep/ui/lib/utils";
import { A, O } from "@beep/utils";
import { useAtomInitialValues, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { TRANSFORMERS } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { PaperclipIcon, PaperPlaneRightIcon, StopIcon } from "@phosphor-icons/react";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { useRef } from "react";
import { editorNodes } from "../nodes.ts";
import { editorTheme } from "../theme.ts";
import {
  attachmentsAtom,
  captureAttachmentsFn,
  featuresAtom,
  logEditorErrorFn,
  maxAttachmentBytesAtom,
  onAttachAtom,
  onSendAtom,
  removeAttachmentFn,
  sendBlockedAtom,
  sendCommandBindingAtom,
  unboundSend,
} from "./atoms.ts";
import { DEFAULT_MAX_ATTACHMENT_BYTES, revokeAttachment } from "./attachment-model.ts";
import { AttachmentChips, AttachmentPlugin } from "./attachments.tsx";
import { SEND_MESSAGE_COMMAND, STOP_MESSAGE_COMMAND } from "./commands.ts";
import { ComposerFeatures } from "./config.ts";
import { SendPlugin, useCharacterCount } from "./send.tsx";
import { defaultChatSlashItems } from "./slash-items.tsx";
import { FixedToolbarPlugin } from "./toolbar.tsx";
import { ComboboxAriaPlugin, MentionPlugin, SlashPlugin } from "./typeahead.tsx";
import type { LexicalEditor } from "lexical";
import type { JSX, ReactNode } from "react";
import type { MentionSource, SlashItem } from "./config.ts";

const DEFAULT_ARIA_LABEL = "Message composer";

const EDITABLE_CLASS_NAME =
  "relative block max-h-60 min-h-10 overflow-auto px-3 py-2.5 text-sm leading-6 focus:outline-none";

const PLACEHOLDER_CLASS_NAME =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 px-3 py-2.5 text-sm leading-6 select-none";

/**
 * Props for {@link ChatComposer}. Additive to (not a replacement for) the bare
 * `EditorComposerProps`.
 *
 * Mount-time config: `features`, `onSend`, `onAttach`, and `maxAttachmentBytes`
 * are seeded into the per-editor atom state ONCE at mount (the per-mount config is
 * intentionally stable, like an uncontrolled input's `defaultValue`). To apply new
 * values, change the React `key` to remount — the desktop app remounts per
 * thread/edit-target. A consumer that keeps these props live should either remount
 * on change or, for `onSend`, read any mutable state freshly inside the handler
 * (the seeded handler is invoked by reference at send time).
 *
 * @example
 * ```ts
 * import type { ChatComposerProps } from "@beep/editor/chat"
 *
 * const props: ChatComposerProps = {
 *   placeholder: "Message...",
 *   features: { attachments: false, sendOn: "modifierEnter" },
 * }
 *
 * const sendOn = props.features?.sendOn
 * console.log(sendOn) // "modifierEnter"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export interface ChatComposerProps {
  /**
   * Accessible name for the editable surface. The typeahead plugins promote it
   * to `role="combobox"`, which must be named.
   * @defaultValue "Message composer"
   */
  readonly ariaLabel?: string;
  /** Extra plugins rendered inside the composer context (e.g. app bindings). */
  readonly children?: ReactNode;
  /** Class for the outer composer container. */
  readonly className?: string;
  /**
   * Which plugins mount. Accepts a partial plain object; omitted flags are
   * filled by {@link ComposerFeatures.make}.
   */
  readonly features?: Partial<ComposerFeatures>;
  /** Optional schema-decoded initial editor state. */
  readonly initialState?: SerializedEditorState.Type;
  /** Max captured attachment size in bytes. */
  readonly maxAttachmentBytes?: number;
  /** App-injected `@` mention source. Mentions are skipped if omitted. */
  readonly mentionSource?: MentionSource;
  /**
   * Lexical editor namespace. Give each composer a unique namespace so multiple
   * composers on one page don't collide on `data-lexical-editor` / clipboard.
   * @defaultValue "beep-chat-editor"
   */
  readonly namespace?: string;
  /** Upload-port callback invoked with captured files (drag-drop / paste / picker). */
  readonly onAttach?: (files: ReadonlyArray<File>) => void;
  /**
   * Convenience send handler (registered at low priority for the send command).
   * Receives the editor's CURRENT serialized state (read live at send time, so it
   * never misses content). Return `true` to signal a turn was dispatched — the
   * composer then clears the editor in place (keeping focus) so the user can keep
   * typing. Return `false`/`void` (e.g. empty content or already streaming) to
   * leave the content alone.
   */
  readonly onSend?: (state: SerializedEditorState.Type) => boolean | void;
  /** Called with the schema-decoded state on every content change. */
  readonly onSerializedChange?: (state: SerializedEditorState.Type) => void;
  /** Stop handler invoked while `streaming`. */
  readonly onStop?: () => void;
  /** Placeholder shown only on the empty state. */
  readonly placeholder?: string;
  /** Disables the send button (e.g. empty content). */
  readonly sendDisabled?: boolean;
  /** Send button label. @defaultValue "Send" */
  readonly sendLabel?: string;
  /** The `/` command list; omitted ⇒ {@link defaultChatSlashItems}. */
  readonly slashItems?: ReadonlyArray<SlashItem>;
  /** Whether a turn is in flight; swaps the send button for a stop button. */
  readonly streaming?: boolean;
}

interface FooterProps {
  readonly attachments: boolean;
  readonly characterCount: boolean;
  readonly onStop?: () => void;
  readonly sendDisabled: boolean;
  readonly sendLabel: string;
  readonly streaming: boolean;
}

function ComposerFooter({
  characterCount,
  attachments,
  streaming,
  sendDisabled,
  sendLabel,
  onStop,
}: FooterProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const count = useCharacterCount();
  // A refused send must never be invisible: the composer used to go quietly dead
  // when the editor state failed to decode.
  const sendBlocked = useAtomValue(sendBlockedAtom(editor));
  // The picked files flow into the per-editor capture runtime mutation (which
  // notifies the upload-port and appends captured attachments); the footer holds
  // no capture logic of its own.
  const capture = useAtomSet(captureAttachmentsFn);
  // The hidden <input type="file"> ref is a real DOM element ref, not state:
  // opening the native file dialog requires a real <input> element + `.click()`,
  // which cannot be driven from an atom. The file-capture logic lives in the
  // runtime; only the DOM handle stays in React (the one permitted useRef).
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-border flex items-center justify-between gap-2 border-t px-3 py-2">
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        {characterCount ? (
          <span aria-live="polite">
            {count} {count === 1 ? "character" : "characters"}
          </span>
        ) : null}
        {O.match(sendBlocked, {
          onNone: () => null,
          onSome: (message) => (
            <span className="text-destructive" role="alert">
              {message}
            </span>
          ),
        })}
      </div>
      <div className="flex items-center gap-1">
        {attachments ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const picked = event.target.files;
                if (picked !== null) capture({ editor, files: A.fromIterable(picked) });
                event.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Attach files"
              title="Attach files"
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon />
            </Button>
          </>
        ) : null}
        {streaming ? (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Stop generating"
            data-testid="turn-stop"
            onClick={() => {
              onStop?.();
              editor.dispatchCommand(STOP_MESSAGE_COMMAND, undefined);
            }}
          >
            <StopIcon weight="fill" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            aria-label={sendLabel}
            disabled={sendDisabled}
            onClick={() => editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined)}
          >
            <PaperPlaneRightIcon weight="fill" />
            {sendLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ComposerSurfaceProps {
  // Resolved by `ChatComposer` (defaulted), so the inner surfaces take a name
  // rather than re-deriving the fallback.
  readonly ariaLabel: string;
  readonly features: ComposerFeatures;
  readonly onStop?: () => void;
  readonly placeholder: string;
  readonly sendDisabled: boolean;
  readonly sendLabel: string;
  readonly streaming: boolean;
}

// The visible composer surface: optional toolbar, attachment chips, the editable
// region, and the footer. Split from ComposerBody so the JSX nesting + toolbar
// gate live here and ComposerBody stays a thin assembler.
function ComposerSurface({
  ariaLabel,
  features,
  onStop,
  placeholder,
  sendDisabled,
  sendLabel,
  streaming,
}: ComposerSurfaceProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const attachments = useAtomValue(attachmentsAtom(editor));
  const remove = useAtomSet(removeAttachmentFn);
  return (
    <>
      {features.toolbar ? <FixedToolbarPlugin /> : null}
      <AttachmentChips attachments={attachments} onRemove={(id) => remove({ editor, id })} />
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              // The typeahead plugins promote this root to `role="combobox"`;
              // a combobox named only by `aria-placeholder` has no accessible
              // name, so assistive tech announces an unlabeled control.
              ariaLabel={ariaLabel}
              className={EDITABLE_CLASS_NAME}
              placeholderClassName={PLACEHOLDER_CLASS_NAME}
              placeholder={placeholder}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <ComposerFooter
        characterCount={features.characterCount}
        attachments={features.attachments}
        streaming={streaming}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        {...O.getSomesStruct({ onStop: O.fromUndefinedOr(onStop) })}
      />
    </>
  );
}

interface ComposerBodyProps extends Omit<ChatComposerProps, "ariaLabel" | "initialState"> {
  readonly ariaLabel: string;
  readonly features: ComposerFeatures;
  readonly maxAttachmentBytes: number;
  readonly placeholder: string;
  readonly sendDisabled: boolean;
  readonly sendLabel: string;
  readonly slashItems: ReadonlyArray<SlashItem>;
  readonly streaming: boolean;
}

const unboundAttach = (): void => undefined;

function useComposerRuntimeBindings(
  editor: LexicalEditor,
  features: ComposerFeatures,
  maxAttachmentBytes: number,
  onSend: ((state: SerializedEditorState.Type) => boolean | void) | undefined,
  onAttach: ((files: ReadonlyArray<File>) => void) | undefined
): void {
  // Seed the per-editor config the Lexical bindings + capture runtime read at
  // fire time. The composer remounts by `key` on thread/edit-target changes,
  // so these values are stable for the lifetime of each mount.
  useAtomInitialValues([
    [featuresAtom(editor), features],
    [onSendAtom(editor), { run: onSend ?? unboundSend }],
    [onAttachAtom(editor), onAttach ?? unboundAttach],
    [maxAttachmentBytesAtom(editor), maxAttachmentBytes],
  ]);

  // The registry may sweep nodes that have no listeners or dependents after
  // its idle TTL. These config atoms are read only at fire time, so explicitly
  // mount them for as long as the composer is alive.
  useAtomMount(featuresAtom(editor));
  useAtomMount(onSendAtom(editor));
  useAtomMount(onAttachAtom(editor));
  useAtomMount(maxAttachmentBytesAtom(editor));
}

function ComposerBody({
  ariaLabel,
  features,
  placeholder,
  className,
  onSerializedChange,
  slashItems,
  mentionSource,
  onAttach,
  maxAttachmentBytes,
  onSend,
  onStop,
  streaming,
  sendDisabled,
  sendLabel,
  children,
}: ComposerBodyProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  useComposerRuntimeBindings(editor, features, maxAttachmentBytes, onSend, onAttach);

  return (
    <div
      data-slot="chat-composer"
      className={cn(
        "bg-card text-card-foreground focus-within:border-ring/60 flex flex-col overflow-hidden rounded-lg border transition-colors",
        className
      )}
    >
      <ComposerSurface
        ariaLabel={ariaLabel}
        features={features}
        placeholder={placeholder}
        streaming={streaming}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        {...O.getSomesStruct({ onStop: O.fromUndefinedOr(onStop) })}
      />

      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={[...TRANSFORMERS]} />
      <SendPlugin />
      <ComposerFeaturePlugins
        editor={editor}
        features={features}
        slashItems={slashItems}
        {...O.getSomesStruct({
          mentionSource: O.fromUndefinedOr(mentionSource),
          onSerializedChange: O.fromUndefinedOr(onSerializedChange),
        })}
      />
      <AttachmentSweep editor={editor} />
      {children}
    </div>
  );
}

interface ComposerFeaturePluginsProps {
  readonly editor: LexicalEditor;
  readonly features: ComposerFeatures;
  readonly mentionSource?: MentionSource;
  readonly onSerializedChange?: (state: SerializedEditorState.Type) => void;
  readonly slashItems: ReadonlyArray<SlashItem>;
}

// The feature-gated plugins, split out of ComposerBody so the conditional
// mounting lives in one place (and ComposerBody stays simple): the change sink,
// slash / mention typeahead, attachment capture, combobox ARIA, and the send
// command binding. Always-on plugins (history, lists, links, markdown, send key)
// stay in ComposerBody.
function ComposerFeaturePlugins({
  editor,
  features,
  mentionSource,
  onSerializedChange,
  slashItems,
}: ComposerFeaturePluginsProps): JSX.Element {
  return (
    <>
      {onSerializedChange === undefined ? null : (
        <OnChangePlugin
          ignoreSelectionChange={true}
          onChange={(nextEditorState) =>
            O.match(SerializedEditorState.decodeOption(nextEditorState.toJSON()), {
              onSome: onSerializedChange,
              onNone: () => undefined,
            })
          }
        />
      )}
      {features.slash ? <SlashPlugin items={slashItems} /> : null}
      {features.mentions && mentionSource !== undefined ? <MentionPlugin source={mentionSource} /> : null}
      {features.attachments ? <AttachmentPlugin /> : null}
      {features.slash || features.mentions ? <ComboboxAriaPlugin /> : null}
      <SendCommandBinding editor={editor} />
    </>
  );
}

// Mounts the per-editor SEND_MESSAGE_COMMAND handler that clears the editor in
// place when the consumer's onSend reports a dispatch.
function SendCommandBinding({ editor }: { readonly editor: LexicalEditor }): null {
  useAtomMount(sendCommandBindingAtom(editor));
  return null;
}

// Per-editor finalizer that revokes outstanding object URLs on unmount. Tracks
// the latest captured attachments via subscription and sweeps them at teardown.
const attachmentSweepBindingAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    let latest = get.once(attachmentsAtom(editor));
    get.subscribe(attachmentsAtom(editor), (next) => {
      latest = next;
    });
    get.addFinalizer(() => {
      for (const attachment of latest) revokeAttachment(attachment);
    });
    return undefined;
  })
);

// Mounts the unmount-sweep binding for the current editor.
function AttachmentSweep({ editor }: { readonly editor: LexicalEditor }): null {
  useAtomMount(attachmentSweepBindingAtom(editor));
  return null;
}

/**
 * The feature-flagged chat composer.
 *
 * @example
 * ```tsx
 * import { ChatComposer } from "@beep/editor/chat"
 *
 * function SupportReplyBox() {
 *   return (
 *     <ChatComposer
 *       placeholder="Message..."
 *       onSend={(state) => state.root.children.length > 0}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
// This component is intentionally the declarative assembly boundary for the
// composer plugins and their optional consumer ports. Extracting the prop
// forwarding would obscure which mount-time values enter the atom-backed body.
// fallow-ignore-next-line complexity -- component assembles plugins and optional consumer ports at one declarative boundary
export function ChatComposer({
  ariaLabel = DEFAULT_ARIA_LABEL,
  features,
  initialState,
  placeholder,
  className,
  namespace = "beep-chat-editor",
  onSerializedChange,
  slashItems = defaultChatSlashItems,
  mentionSource,
  onAttach,
  maxAttachmentBytes = DEFAULT_MAX_ATTACHMENT_BYTES,
  onSend,
  onStop,
  streaming = false,
  sendDisabled = false,
  sendLabel = "Send",
  children,
}: ChatComposerProps): JSX.Element {
  const resolved = ComposerFeatures.make(features ?? {});
  // Lexical config errors log through the Effect runtime (no runSync here).
  const logEditorError = useAtomSet(logEditorErrorFn);

  return (
    <LexicalComposer
      initialConfig={{
        namespace,
        theme: editorTheme,
        nodes: [...editorNodes],
        ...O.getSomesStruct({
          editorState: O.map(O.fromUndefinedOr(initialState), S.encodeSync(EditorStateFromJson)),
        }),
        onError: (error) => logEditorError(error),
      }}
    >
      <ComposerBody
        ariaLabel={ariaLabel}
        features={resolved}
        slashItems={slashItems}
        maxAttachmentBytes={maxAttachmentBytes}
        placeholder={placeholder ?? "Message…"}
        streaming={streaming}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        {...O.getSomesStruct({
          className: O.fromUndefinedOr(className),
          onSerializedChange: O.fromUndefinedOr(onSerializedChange),
          mentionSource: O.fromUndefinedOr(mentionSource),
          onAttach: O.fromUndefinedOr(onAttach),
          onSend: O.fromUndefinedOr(onSend),
          onStop: O.fromUndefinedOr(onStop),
          children: O.fromUndefinedOr(children),
        })}
      />
    </LexicalComposer>
  );
}
