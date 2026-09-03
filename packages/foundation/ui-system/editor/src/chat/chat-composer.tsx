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

import { EditorStateFromJson } from "@beep/lexical-schema";
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
import { PaperclipIcon } from "@phosphor-icons/react/Paperclip";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/PaperPlaneRight";
import { StopIcon } from "@phosphor-icons/react/Stop";
import { Result } from "effect";
import * as S from "effect/Schema";
import { useRef } from "react";
import { editorNodes } from "../nodes.ts";
import { decodeEditorStateForRuntimeResult } from "../runtime.ts";
import { editorTheme } from "../theme.ts";
import { EditorWireViewer } from "../viewer.tsx";
import {
  attachmentSweepBindingAtom,
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
import { DEFAULT_MAX_ATTACHMENT_BYTES } from "./attachment-model.ts";
import { AttachmentChips, AttachmentFailureNotice, AttachmentPlugin } from "./attachments.tsx";
import { SEND_MESSAGE_COMMAND, STOP_MESSAGE_COMMAND } from "./commands.ts";
import { ComposerFeatures, SlashItems } from "./config.ts";
import { SendPlugin, useCharacterCount } from "./send.tsx";
import { defaultChatSlashItems } from "./slash-items.tsx";
import { FixedToolbarPlugin } from "./toolbar.tsx";
import { ComboboxAriaPlugin, MentionPlugin, SlashPlugin } from "./typeahead.tsx";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { LexicalEditor } from "lexical";
import type { JSX, ReactNode } from "react";
import type { AttachmentPort, MentionSource, SendPort, SlashItem } from "./config.ts";

const DEFAULT_ARIA_LABEL = "Message composer";

const EDITABLE_CLASS_NAME =
  "relative block max-h-60 min-h-10 overflow-auto px-3 py-2.5 text-sm leading-6 focus:outline-none";

const PLACEHOLDER_CLASS_NAME =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 px-3 py-2.5 text-sm leading-6 select-none";

/**
 * Immutable per-mount configuration for {@link ChatComposer}. The object is
 * decoded/defaulted once and seeded into atoms owned by the Lexical editor; use
 * a new React `key` when a different mount configuration is required.
 *
 * **Example** (Disable attachments in config)
 *
 * ```ts import.meta.vitest name="Disable attachments in config"
 * import type { ChatComposerMountConfig } from "@beep/editor/chat/chat-composer"
 *
 * const mountConfig: ChatComposerMountConfig = {
 *   features: { attachments: false },
 *   maxAttachmentBytes: 5_000_000,
 * }
 * mountConfig.features?.attachments // => false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface ChatComposerMountConfig {
  /** Which optional composer plugins mount. */
  readonly features?: Partial<ComposerFeatures> | undefined;
  /** Maximum attachment size accepted by the capture boundary. */
  readonly maxAttachmentBytes?: number | undefined;
  /** Promise-compatible consumer attachment port. */
  readonly onAttach?: AttachmentPort | undefined;
  /** Consumer send port invoked with the live decoded editor state. */
  readonly onSend?: SendPort | undefined;
}

/**
 * Props for {@link ChatComposer}. Additive to (not a replacement for) the bare
 * `EditorComposerProps`.
 *
 * **Details**
 *
 * `namespace`, `initialState`, and all fields in `mountConfig` are read ONCE at
 * mount (intentionally stable, like an uncontrolled input's `defaultValue`).
 * Change the React `key` to apply new values — the desktop app remounts per
 * thread/edit-target. A consumer that keeps an `onSend` closure live may instead
 * read mutable state freshly inside the seeded handler.
 *
 * **Example** (Props with sendOn feature)
 *
 * ```ts import.meta.vitest name="Props with sendOn feature"
 * import type { ChatComposerProps } from "@beep/editor/chat/chat-composer"
 *
 * const props: ChatComposerProps = {
 *   placeholder: "Message...",
 *   mountConfig: {
 *     features: { attachments: false, sendOn: "modifierEnter" },
 *   },
 * }
 *
 * const sendOn = props.mountConfig?.features?.sendOn
 * sendOn // => "modifierEnter"
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
   * Optional schema-decoded initial editor state. Lexical reads it once; change
   * the component `key` to replace it after mount.
   */
  readonly initialState?: SerializedEditorState.Type;
  /** App-injected `@` mention source. Mentions are skipped if omitted. */
  readonly mentionSource?: MentionSource;
  /** Immutable config seeded once for the lifetime of this composer mount. */
  readonly mountConfig?: ChatComposerMountConfig;
  /**
   * Lexical editor namespace. Give each composer a unique namespace so multiple
   * composers on one page don't collide on `data-lexical-editor` / clipboard.
   * Lexical reads it once; change the component `key` to replace it after mount.
   * @defaultValue "beep-chat-editor"
   */
  readonly namespace?: string;
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

// fallow-ignore-next-line complexity -- cognitive 12 = pre-existing hook/JSX tax (five hook bindings plus the streaming/attachment conditionals); this branch's change here was a one-line shrink-0 flex class and added no branching
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
    <div className="border-border flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
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
      <AttachmentFailureNotice />
      {/* min-h-0 flex column: when a height-capped consumer squeezes the
          composer, the editable (overflow-auto, so its flex minimum is zero)
          is the region that shrinks and scrolls — never the toolbar or the
          footer, which keep their content height. */}
      <div className="relative flex min-h-0 flex-col">
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

interface ComposerBodyProps {
  readonly ariaLabel: string;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly features: ComposerFeatures;
  readonly maxAttachmentBytes: number;
  readonly mentionSource?: MentionSource;
  readonly onAttach?: AttachmentPort;
  readonly onSend?: SendPort;
  readonly onSerializedChange?: (state: SerializedEditorState.Type) => void;
  readonly onStop?: () => void;
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
  onSend: SendPort | undefined,
  onAttach: AttachmentPort | undefined
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

// fallow-ignore-next-line complexity -- cognitive 14 = pre-existing hook/prop-fanout tax (15 props and three hook bindings); this branch did not change this function at all — its edits in this file were two one-line flex classes in ComposerFooter and ComposerSurface
function ComposerBody({
  ariaLabel,
  features: initialFeatures,
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
  useComposerRuntimeBindings(editor, initialFeatures, maxAttachmentBytes, onSend, onAttach);
  const features = useAtomValue(featuresAtom(editor));

  return (
    <div
      data-slot="chat-composer"
      className={cn(
        "bg-card text-card-foreground focus-within:border-ring/60 flex flex-col overflow-hidden rounded-lg border transition-colors",
        className
      )}
    >
      {children}
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

interface SerializedChangePluginProps {
  readonly onSerializedChange: ComposerFeaturePluginsProps["onSerializedChange"];
}

function SerializedChangePlugin({ onSerializedChange }: SerializedChangePluginProps): JSX.Element | null {
  const logEditorError = useAtomSet(logEditorErrorFn);
  return O.match(O.fromUndefinedOr(onSerializedChange), {
    onNone: () => null,
    onSome: (changeSink) => (
      <OnChangePlugin
        ignoreSelectionChange={true}
        onChange={(nextEditorState) =>
          Result.match(decodeEditorStateForRuntimeResult(nextEditorState.toJSON()), {
            onSuccess: changeSink,
            onFailure: (error) =>
              logEditorError({
                message: "ChatComposer produced out-of-schema state",
                error,
              }),
          })
        }
      />
    ),
  });
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
      <SerializedChangePlugin onSerializedChange={onSerializedChange} />
      {features.slash ? <SlashPlugin items={slashItems} /> : null}
      {features.mentions && mentionSource !== undefined ? <MentionPlugin source={mentionSource} /> : null}
      {features.attachments ? <AttachmentPlugin /> : null}
      {features.slash || (features.mentions && mentionSource !== undefined) ? <ComboboxAriaPlugin /> : null}
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

// Tracks the Lexical root lifetime so async attachment work cannot escape its
// composer mount.
function AttachmentSweep({ editor }: { readonly editor: LexicalEditor }): null {
  useAtomMount(attachmentSweepBindingAtom(editor));
  return null;
}

/**
 * The feature-flagged chat composer.
 *
 * **Example** (Composer with onSend config)
 *
 * ```tsx
 * import { ChatComposer } from "@beep/editor/chat/chat-composer"
 *
 * function SupportReplyBox() {
 *   return (
 *     <ChatComposer
 *       placeholder="Message..."
 *       mountConfig={{ onSend: (state) => state.root.children.length > 0 }}
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
export function ChatComposer(props: ChatComposerProps): JSX.Element {
  const {
    ariaLabel = DEFAULT_ARIA_LABEL,
    mountConfig,
    initialState,
    placeholder,
    className,
    namespace = "beep-chat-editor",
    onSerializedChange,
    slashItems = defaultChatSlashItems,
    mentionSource,
    onStop,
    streaming = false,
    sendDisabled = false,
    sendLabel = "Send",
    children,
  } = props;
  const resolved = ComposerFeatures.make(mountConfig?.features ?? {});
  const resolvedMaxAttachmentBytes = mountConfig?.maxAttachmentBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  const resolvedOnAttach = mountConfig?.onAttach;
  const resolvedOnSend = mountConfig?.onSend;
  const resolvedSlashItems = O.getOrElse(S.decodeOption(SlashItems)(slashItems), () => defaultChatSlashItems);
  const runtimeInitialState = O.flatMap(O.fromUndefinedOr(initialState), (state) =>
    Result.getSuccess(decodeEditorStateForRuntimeResult(state))
  );
  // Lexical config errors log through the Effect runtime (no runSync here).
  const logEditorError = useAtomSet(logEditorErrorFn);
  if (initialState !== undefined && O.isNone(runtimeInitialState)) {
    return <EditorWireViewer input={initialState} className={className} />;
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace,
        theme: editorTheme,
        nodes: [...editorNodes],
        ...O.getSomesStruct({
          editorState: O.map(runtimeInitialState, S.encodeSync(EditorStateFromJson)),
        }),
        onError: (error) => logEditorError(error),
      }}
    >
      <ComposerBody
        ariaLabel={ariaLabel}
        features={resolved}
        slashItems={resolvedSlashItems}
        maxAttachmentBytes={resolvedMaxAttachmentBytes}
        placeholder={placeholder ?? "Message…"}
        streaming={streaming}
        sendDisabled={sendDisabled}
        sendLabel={sendLabel}
        {...O.getSomesStruct({
          className: O.fromUndefinedOr(className),
          onSerializedChange: O.fromUndefinedOr(onSerializedChange),
          mentionSource: O.fromUndefinedOr(mentionSource),
          onAttach: O.fromUndefinedOr(resolvedOnAttach),
          onSend: O.fromUndefinedOr(resolvedOnSend),
          onStop: O.fromUndefinedOr(onStop),
          children: O.fromUndefinedOr(children),
        })}
      />
    </LexicalComposer>
  );
}
