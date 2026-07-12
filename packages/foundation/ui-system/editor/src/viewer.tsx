/**
 * Read-only viewer rendering a `@beep/lexical-schema` serialized editor
 * state.
 *
 * @packageDocumentation \@beep/editor/viewer
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { EditorStateFromJson, SerializedEditorState } from "@beep/lexical-schema";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { MermaidCodeDecoratorPlugin } from "./mermaid-code-decorator-plugin.tsx";
import { editorNodes } from "./nodes.ts";
import { editorTheme } from "./theme.ts";
import type { JSX } from "react";

const $I = $EditorId.create("viewer");

const onError = (error: Error) => Effect.runSync(Effect.logError(error));

class EditorViewerProps extends S.Class<EditorViewerProps>($I`EditorViewerProps`)(
  {
    /** Optional class for the read-only content container. */
    className: S.optionalKey(S.String).annotateKey({
      description: "Optional class for the read-only content container.",
    }),
    /** The schema-decoded editor state to render. */
    state: SerializedEditorState.annotateKey({
      description: "The schema-decoded editor state to render.",
    }),
  },
  $I.annote("EditorViewerProps", {
    description: "Props for the EditorViewer component.",
  })
) {}

/**
 * Read-only Lexical viewer over the `@beep/lexical-schema` v1 node
 * vocabulary — the render side of the schema → viewer pipeline.
 *
 * @example
 * ```tsx
 * import { EditorViewer } from "@beep/editor/viewer"
 * import type { SerializedEditorState } from "@beep/lexical-schema"
 *
 * function ReadOnlyPreview({ state }: { readonly state: SerializedEditorState.Type }) {
 *   return <EditorViewer state={state} className="prose max-w-none" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EditorViewer({ state, className }: EditorViewerProps): JSX.Element {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: "beep-editor-viewer",
        editable: false,
        theme: editorTheme,
        nodes: [...editorNodes],
        editorState: S.encodeSync(EditorStateFromJson)(state),
        onError,
      }}
    >
      {/* Non-flex wrapper: Lexical warns when the content editable's direct
          parent computes to flex/inline-flex (Chrome focus quirks), and the
          viewer mounts inside arbitrary (often flex) message layouts. */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={<ContentEditable className={className ?? "relative block px-1 focus:outline-none"} />}
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <MermaidCodeDecoratorPlugin />
    </LexicalComposer>
  );
}
