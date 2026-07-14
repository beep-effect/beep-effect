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
import { CodeBlockNode } from "./code-block-node.tsx";
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

/**
 * Swap the remaining code blocks for the code-block node, on the same read-only
 * terms as the diagram above: the wire profile still carries a `code` block, and the
 * composer still edits one.
 *
 * A code block Lexical renders itself cannot do two things a reader needs. Its long
 * lines *wrap*, because the contenteditable's `white-space` is `pre-wrap` — code that
 * folds at an arbitrary column has to be reassembled in the reader's head. And it
 * cannot be copied: the only way to take a snippet the assistant wrote was to select
 * it by hand and hope the selection did not catch the prose around it.
 */
const decorateCode = (node: SerializedNodeLike): SerializedNodeLike =>
  node.type === "code"
    ? ({
        type: "codeblock",
        version: 1,
        format: "",
        code: nodeSource(node),
        language: P.isString(node.language) ? node.language : "",
      } as SerializedNodeLike)
    : node.children === undefined
      ? node
      : { ...node, children: node.children.map(decorateCode) };

/**
 * The encoded forms of a viewer state, computed once and remembered.
 *
 * A transcript re-renders on every streamed block, and this ran on each of them for
 * every message already on screen: the entire history re-serialized, every frame, to
 * produce strings identical to the ones it produced last time. The key is the state
 * object, held weakly — a message that leaves the timeline takes its entry with it.
 */
const encodedStates = new WeakMap<object, { readonly decorated: string; readonly encoded: string }>();

const encodeOnce = (state: SerializedEditorState.Type): { readonly decorated: string; readonly encoded: string } => {
  const cached = encodedStates.get(state);
  if (cached !== undefined) return cached;

  const wire = Result.getOrThrowWith(encodeEditorState(state), schemaIssueToError);
  const encoded = Result.getOrThrowWith(encodeJson(wire), schemaIssueToError);
  const decorated = Result.getOrThrowWith(
    encodeJson({ ...wire, root: decorateCode(decorateMermaid(wire.root)) }),
    schemaIssueToError
  );
  const result = { decorated, encoded };
  encodedStates.set(state, result);
  return result;
};

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
  //
  // Encoded ONCE per state, not once per render. A transcript re-renders on every
  // streamed block, and each render re-encoded every message already on screen — the
  // whole history, serialized again, to produce a string identical to the one it
  // produced last time. The cache is keyed on the state object itself and holds it
  // weakly, so a message that scrolls out of the timeline takes its entry with it.
  const { encoded, decorated } = encodeOnce(state);
  return (
    <LexicalComposer
      key={encoded}
      initialConfig={{
        namespace: "beep-editor-viewer",
        editable: false,
        theme: editorTheme,
        nodes: [...editorNodes, MermaidNode, CodeBlockNode],
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
