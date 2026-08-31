/**
 * Read-only viewer rendering a `@beep/lexical-schema` serialized editor
 * state.
 *
 * @packageDocumentation \@beep/editor/viewer
 * @since 0.0.0
 */
"use client";

import { SerializedEditorState } from "@beep/lexical-schema";
import { analyzeEditorStateCompatibilityResult } from "@beep/lexical-schema/Lexical.model";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { O } from "@beep/utils";
import { useAtomSet } from "@effect/atom-react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { logEditorErrorFn } from "./chat/atoms.ts";
import { CodeBlockNode } from "./code-block-node.tsx";
import { MermaidNode } from "./mermaid-node.tsx";
import { editorNodes } from "./nodes.ts";
import { decodeEditorStateForRuntimeResult } from "./runtime.ts";
import { editorTheme } from "./theme.ts";
import type { LexicalCompatibilityResult } from "@beep/lexical-schema/Lexical.model";
import type { JSX } from "react";

const MERMAID_LANGUAGE = "mermaid";

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

const encodeEditorState = S.encodeUnknownResult(SerializedEditorState);
const encodeJson = UnknownFromJsonString.encodeUnknownResult;

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

/**
 * React props for {@link EditorViewer}. This is intentionally a plain component
 * boundary: `state` has already been decoded by {@link SerializedEditorState}.
 *
 * **Example** (Build props with className)
 *
 * ```ts import.meta.vitest name="Build props with className"
 * import type { EditorViewerProps } from "@beep/editor/viewer"
 *
 * const withProse = (state: EditorViewerProps["state"]): EditorViewerProps => ({
 *   state,
 *   className: "prose",
 * })
 * typeof withProse // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EditorViewerProps {
  /** Optional class for the read-only content container. */
  readonly className?: string | undefined;
  /** The schema-decoded editor state to render. */
  readonly state: SerializedEditorState.Type;
}

/**
 * React props for {@link EditorCompatibilityViewer}.
 *
 * **Example** (Minimal result-only props)
 *
 * ```ts import.meta.vitest name="Minimal result-only props"
 * import type { EditorCompatibilityViewerProps } from "@beep/editor/viewer"
 *
 * const withoutExtraClasses = (
 *   result: EditorCompatibilityViewerProps["result"]
 * ): EditorCompatibilityViewerProps => ({ result })
 * typeof withoutExtraClasses // => "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EditorCompatibilityViewerProps {
  /** Optional class for either the rich viewer or inert wire fallback. */
  readonly className?: string | undefined;
  /** Lossless wire plus its optional strict semantic state. */
  readonly result: LexicalCompatibilityResult;
}

/**
 * React props for {@link EditorWireViewer}.
 *
 * **Example** (Props with wire input)
 *
 * ```ts import.meta.vitest name="Props with wire input"
 * import type { EditorWireViewerProps } from "@beep/editor/viewer"
 *
 * const props: EditorWireViewerProps = {
 *   input: {
 *     root: {
 *       type: "root", version: 1,
 *       children: [{
 *         type: "paragraph", version: 1, children: [],
 *         direction: null, format: "", indent: 0
 *       }]
 *     }
 *   },
 * }
 * typeof props.input // => "object"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EditorWireViewerProps {
  /** Optional class for either the rich viewer or inert wire fallback. */
  readonly className?: string | undefined;
  /** Unknown persisted input admitted through the lossless + strict decoders. */
  readonly input: unknown;
}

function EditorReadOnlyFallback({
  className,
  input,
  message,
  testId,
}: {
  readonly className?: string | undefined;
  readonly input: unknown;
  readonly message: string;
  readonly testId: string;
}): JSX.Element {
  return (
    <div className={className} data-testid={testId}>
      <p className="mb-1 text-xs text-muted-foreground">{message}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-sm">
        {Result.getOrElse(encodeJson(input), () => "Document content is unavailable.")}
      </pre>
    </div>
  );
}

/**
 * Read-only Lexical viewer over the `@beep/lexical-schema` v1 node
 * vocabulary — the render side of the schema → viewer pipeline.
 *
 * **Example** (Read-only preview component)
 *
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
  const logEditorError = useAtomSet(logEditorErrorFn);
  const runtimeState = decodeEditorStateForRuntimeResult(state);
  if (Result.isFailure(runtimeState)) {
    return (
      <EditorReadOnlyFallback
        className={className}
        input={state}
        message="Rich formatting is unavailable because this document is not compatible with the current editor."
        testId="editor-runtime-refusal"
      />
    );
  }

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
  const { encoded, decorated } = encodeOnce(runtimeState.success);
  return (
    <LexicalComposer
      key={encoded}
      initialConfig={{
        namespace: "beep-editor-viewer",
        editable: false,
        theme: editorTheme,
        nodes: [...editorNodes, MermaidNode, CodeBlockNode],
        editorState: decorated,
        onError: (error) => logEditorError(error),
      }}
    >
      {/* Non-flex wrapper: Lexical warns when the content editable's direct
          parent computes to flex/inline-flex (Chrome focus quirks), and the
          viewer mounts inside arbitrary (often flex) message layouts. */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable aria-label="Document" className={className ?? "relative block px-1 focus:outline-none"} />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
    </LexicalComposer>
  );
}

/**
 * Renders a strict compatible state through {@link EditorViewer};
 * runtime-incompatible wire, including empty roots and future extensions,
 * falls back to escaped JSON in a read-only `<pre>`. Unknown content is
 * preserved and visible without asking Lexical to execute unsupported node
 * behavior.
 *
 * **Example** (Forward-compatible preview)
 *
 * ```tsx
 * import { EditorCompatibilityViewer } from "@beep/editor/viewer"
 * import type { LexicalCompatibilityResult } from "@beep/lexical-schema/Lexical.model"
 *
 * function ForwardCompatiblePreview({ result }: { readonly result: LexicalCompatibilityResult }) {
 *   return <EditorCompatibilityViewer result={result} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EditorCompatibilityViewer({ result, className }: EditorCompatibilityViewerProps): JSX.Element {
  return O.match(result.state, {
    onSome: (state) => <EditorViewer state={state} className={className} />,
    onNone: () => (
      <EditorReadOnlyFallback
        className={className}
        input={result.wire}
        message="Rich formatting is unavailable in this version. Showing the preserved read-only document."
        testId="editor-compatibility-fallback"
      />
    ),
  });
}

/**
 * Admits unknown persisted Lexical wire through the lossless compatibility
 * decoder before rendering. Compatible v1 input uses {@link EditorViewer};
 * empty-root and future/extension wire is preserved as escaped read-only JSON,
 * and malformed non-wire input is refused without mounting Lexical.
 *
 * **Example** (Render from wire input)
 *
 * ```tsx
 * import { EditorWireViewer } from "@beep/editor/viewer"
 *
 * const wire = {
 *   root: {
 *     type: "root", version: 1,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   }
 * }
 * const preview = <EditorWireViewer input={wire} />
 * console.log(preview.type.name) // "EditorWireViewer"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EditorWireViewer({ input, className }: EditorWireViewerProps): JSX.Element {
  return Result.match(analyzeEditorStateCompatibilityResult(input), {
    onFailure: () => (
      <EditorReadOnlyFallback
        className={className}
        input={input}
        message="Rich formatting is unavailable because this value is not a valid editor document."
        testId="editor-wire-refusal"
      />
    ),
    onSuccess: (result) => <EditorCompatibilityViewer result={result} className={className} />,
  });
}
