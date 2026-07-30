/**
 * Composer primitives for `@beep/editor`: an editable Lexical surface wired
 * with the v1 node registration, the `@beep/ui` theme, history, lists, links,
 * and markdown shortcuts.
 *
 * @packageDocumentation \@beep/editor/composer
 * @since 0.0.0
 */
"use client";

import { EditorStateFromJson } from "@beep/lexical-schema";
import { analyzeEditorStateCompatibilityResult } from "@beep/lexical-schema/Lexical.model";
import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable";
import { O } from "@beep/utils";
import { useAtomSet } from "@effect/atom-react";
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
import { Result } from "effect";
import * as S from "effect/Schema";
import { logEditorErrorFn } from "./chat/atoms.ts";
import { editorNodes } from "./nodes.ts";
import { decodeEditorStateForRuntimeResult } from "./runtime.ts";
import { editorTheme } from "./theme.ts";
import { EditorCompatibilityViewer, EditorWireViewer } from "./viewer.tsx";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { JSX } from "react";

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

/**
 * React props for {@link EditorComposer}.
 *
 * @example
 * ```ts
 * import type { EditorComposerProps } from "@beep/editor/composer"
 *
 * const props: EditorComposerProps = { placeholder: "Draft response" }
 * console.log(props.placeholder) // "Draft response"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EditorComposerProps {
  /** Optional class for the editable content container. */
  readonly className?: string | undefined;
  /**
   * Optional schema-decoded initial editor state. Lexical reads it once; change
   * the component `key` to replace it after mount.
   */
  readonly initialState?: SerializedEditorState.Type | undefined;
  /**
   * Called with the schema-decoded state on every content change; states
   * that fail the v1 schema are logged and skipped.
   */
  readonly onSerializedChange?: ((state: SerializedEditorState.Type) => void) | undefined;
  /** Composer placeholder text. */
  readonly placeholder?: string | undefined;
}

/**
 * React props for {@link EditorWireComposer}.
 *
 * @example
 * ```ts
 * import type { EditorWireComposerProps } from "@beep/editor/composer"
 *
 * const props: EditorWireComposerProps = {
 *   input: { root: { type: "root", version: 1, children: [] } },
 * }
 * console.log(typeof props.input) // "object"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EditorWireComposerProps extends Omit<EditorComposerProps, "initialState"> {
  /** Unknown persisted input admitted before any editable Lexical surface mounts. */
  readonly input: unknown;
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
  const logEditorError = useAtomSet(logEditorErrorFn);
  const runtimeInitialState = O.flatMap(O.fromUndefinedOr(initialState), (state) =>
    Result.getSuccess(decodeEditorStateForRuntimeResult(state))
  );
  if (initialState !== undefined && O.isNone(runtimeInitialState)) {
    return <EditorWireViewer input={initialState} className={className} />;
  }

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "beep-editor",
        theme: editorTheme,
        nodes: [...editorNodes],
        ...O.getSomesStruct({
          editorState: O.map(runtimeInitialState, S.encodeSync(EditorStateFromJson)),
        }),
        onError: (error) => logEditorError(error),
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
            Result.match(decodeEditorStateForRuntimeResult(nextEditorState.toJSON()), {
              onSuccess: onSerializedChange,
              onFailure: (error) =>
                logEditorError({
                  message: "EditorComposer produced out-of-schema state",
                  error,
                }),
            });
          }}
        />
      )}
    </LexicalComposer>
  );
}

/**
 * Editable admission surface for persisted Lexical wire. Compatible v1 input
 * mounts {@link EditorComposer}; future/extension wire remains escaped and
 * read-only, so incompatible content can never reach a load or save callback.
 * A changed compatible `input` remounts the inner editor with its canonical
 * encoded state.
 *
 * @example
 * ```tsx
 * import { EditorWireComposer } from "@beep/editor/composer"
 *
 * const wire = { root: { type: "root", version: 1, children: [] } }
 * const editor = <EditorWireComposer input={wire} placeholder="Draft" />
 * console.log(editor.type.name) // "EditorWireComposer"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EditorWireComposer({
  input,
  className,
  onSerializedChange,
  placeholder,
}: EditorWireComposerProps): JSX.Element {
  return Result.match(analyzeEditorStateCompatibilityResult(input), {
    onFailure: () => <EditorWireViewer input={input} className={className} />,
    onSuccess: (result) =>
      O.match(result.state, {
        onNone: () => <EditorCompatibilityViewer result={result} className={className} />,
        onSome: (initialState) => {
          const encodedInitialState = S.encodeSync(EditorStateFromJson)(initialState);
          return (
            <EditorComposer
              key={encodedInitialState}
              initialState={initialState}
              {...O.getSomesStruct({
                className: O.fromUndefinedOr(className),
                onSerializedChange: O.fromUndefinedOr(onSerializedChange),
                placeholder: O.fromUndefinedOr(placeholder),
              })}
            />
          );
        },
      }),
  });
}
