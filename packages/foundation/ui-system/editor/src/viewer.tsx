/**
 * Read-only viewer rendering a `@beep/lexical-schema` serialized editor
 * state.
 *
 * @packageDocumentation \@beep/editor/viewer
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { SerializedEditorState } from "@beep/lexical-schema";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { Effect, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { MermaidNode } from "./mermaid-node.tsx";
import { editorNodes } from "./nodes.ts";
import { editorTheme } from "./theme.ts";
import type { JSX } from "react";

const $I = $EditorId.create("viewer");

const onError = (error: Error) => Effect.runSync(Effect.logError(error));

const MERMAID_LANGUAGE = "mermaid";

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

const encodeEditorState = S.encodeUnknownResult(SerializedEditorState);
const encodeJson = S.encodeUnknownResult(S.UnknownFromJsonString);

interface SerializedNodeLike {
  readonly children?: ReadonlyArray<SerializedNodeLike> | undefined;
  readonly language?: null | string | undefined;
  readonly text?: string | undefined;
  readonly type?: string | undefined;
}

/** The source a code block holds, the way Lexical's own `getTextContent` reads it. */
const nodeSource = (node: SerializedNodeLike): string => {
  if (node.type === "linebreak") return "\n";
  if (node.type === "tab") return "\t";
  if (P.isString(node.text)) return node.text;
  return node.children === undefined ? "" : node.children.map(nodeSource).join("");
};

/**
 * Swap mermaid code blocks for the decorator node before Lexical mounts.
 *
 * The wire profile keeps a diagram as a `code` block with `language="mermaid"`
 * (the composer edits diagrams as code, and that must not change), so the swap
 * happens here, on the read-only side, against the state this viewer is about to
 * render and never serializes back.
 *
 * Rendering it as a real Lexical node is the point: the previous decorator hid
 * the `<code>` and injected a sibling `<div>` into the contenteditable subtree to
 * portal into. Lexical owns and reconciles that subtree, so it removed the div —
 * and the diagram rendered as a blank gap with its source hidden behind it. It
 * rendered while streaming (a separate path) and disappeared once it persisted.
 */
const decorateMermaid = (node: SerializedNodeLike): SerializedNodeLike =>
  node.type === "code" && node.language === MERMAID_LANGUAGE
    ? ({ type: "mermaid", version: 1, format: "", source: nodeSource(node) } as SerializedNodeLike)
    : node.children === undefined
      ? node
      : { ...node, children: node.children.map(decorateMermaid) };

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
  // `initialConfig.editorState` is read once, when Lexical constructs the
  // editor: a viewer that stays mounted while its `state` prop changes would go
  // on rendering the message it was first given. Keying the composer by the
  // encoded state remounts it exactly when the content differs — the JSON string
  // is the same value the config consumes, so this costs nothing extra and needs
  // no effect to reconcile.
  const wire = Result.getOrThrowWith(encodeEditorState(state), schemaIssueToError);
  const encoded = Result.getOrThrowWith(encodeJson(wire), schemaIssueToError);
  const decorated = Result.getOrThrowWith(
    encodeJson({ ...wire, root: decorateMermaid(wire.root) }),
    schemaIssueToError
  );
  return (
    <LexicalComposer
      key={encoded}
      initialConfig={{
        namespace: "beep-editor-viewer",
        editable: false,
        theme: editorTheme,
        nodes: [...editorNodes, MermaidNode],
        editorState: decorated,
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
    </LexicalComposer>
  );
}
