/**
 * Composer primitives for `@beep/editor`: an editable Lexical surface wired
 * with the v1 node registration, the `@beep/ui` theme, history, lists, links,
 * and markdown shortcuts.
 *
 * @packageDocumentation \@beep/editor/composer
 * @since 0.0.0
 */
"use client";

import { EditorStateFromJson, SerializedEditorState } from "@beep/lexical-schema";
import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable";
import { O } from "@beep/utils";
import { TRANSFORMERS } from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";
import { editorNodes } from "./nodes.ts";
import { editorTheme } from "./theme.ts";
import type { JSX } from "react";

const onError = (error: Error) => {
  Effect.runSync(Effect.logError(error));
};

/**
 * The markdown shortcut transformers registered by {@link EditorComposer} —
 * exported so apps can compose their own plugin stacks.
 *
 * @example
 * ```ts
 * import { markdownTransformers } from "@beep/editor/composer"
 *
 * console.log(markdownTransformers.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const markdownTransformers = TRANSFORMERS;

interface EditorComposerProps {
  /** Optional class for the editable content container. */
  readonly className?: string;
  /** Optional schema-decoded initial editor state. */
  readonly initialState?: SerializedEditorState.Type;
  /**
   * Called with the schema-decoded state on every content change; states
   * that fail the v1 schema are logged and skipped.
   */
  readonly onSerializedChange?: (state: SerializedEditorState.Type) => void;
  /** Composer placeholder text. */
  readonly placeholder?: string;
}

/**
 * Editable Lexical composer over the `@beep/lexical-schema` v1 node
 * vocabulary with markdown shortcuts.
 *
 * @example
 * ```tsx
 * import { EditorComposer } from "@beep/editor/composer"
 *
 * function DraftEditor() {
 *   return (
 *     <EditorComposer
 *       placeholder="Draft response"
 *       onSerializedChange={(state) => console.log(state.root.type)}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EditorComposer({
  initialState,
  placeholder,
  className,
  onSerializedChange,
}: EditorComposerProps): JSX.Element {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "beep-editor",
        theme: editorTheme,
        nodes: [...editorNodes],
        ...O.getSomesStruct({
          editorState: O.map(O.fromUndefinedOr(initialState), S.encodeSync(EditorStateFromJson)),
        }),
        onError,
      }}
    >
      {/* Non-flex wrapper: Lexical warns when the content editable's direct
          parent computes to flex/inline-flex (Chrome focus quirks); `relative`
          also anchors the absolute placeholder overlay to the editable box. */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              placeholder={placeholder ?? "Start typing ..."}
              {...O.getSomesStruct({ className: O.fromUndefinedOr(className) })}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={[...markdownTransformers]} />
      {onSerializedChange === undefined ? null : (
        <OnChangePlugin
          ignoreSelectionChange={true}
          onChange={(nextEditorState) => {
            const exit = Effect.runSyncExit(S.decodeUnknownEffect(SerializedEditorState)(nextEditorState.toJSON()));
            Exit.match(exit, {
              onSuccess: onSerializedChange,
              onFailure: (cause) =>
                Effect.runSync(Effect.logError("EditorComposer produced out-of-schema state", cause)),
            });
          }}
        />
      )}
    </LexicalComposer>
  );
}
