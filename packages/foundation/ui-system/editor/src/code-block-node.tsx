/**
 * Read-only Lexical decorator node for code blocks.
 *
 * The wire profile carries code as a `code` block, and the composer edits it as one.
 * This node exists only for the read-only viewer, which swaps code blocks for it
 * before mounting — the same trade the mermaid diagram makes, and for the same
 * reason: a read-only surface can own its rendering completely.
 *
 * It buys two things Lexical's own code rendering could not give:
 *
 * - **Long lines scroll instead of wrapping.** Lexical renders code inside a
 *   contenteditable whose `white-space` is `pre-wrap`, so a long line folded back on
 *   itself. Code that wraps at an arbitrary column is code you have to reassemble in
 *   your head before you can read it.
 * - **The code can be copied.** There was no way to take it, so the only way to use a
 *   snippet the assistant wrote was to select it by hand and hope the selection did
 *   not catch the surrounding prose.
 *
 * @packageDocumentation \@beep/editor/code-block-node
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { ElementFormat } from "@beep/lexical-schema";
import { DecoratorBlockNode } from "@lexical/react/LexicalDecoratorBlockNode";
import { Result } from "effect";
import * as S from "effect/Schema";
import { CodeBlockView } from "./code-block-view.tsx";
import type { EditorConfig, ElementFormatType, LexicalEditor, NodeKey, SerializedLexicalNode } from "lexical";
import type { JSX } from "react";

const $I = $EditorId.create("code-block-node");

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Serialized shape of {@link CodeBlockNode}. Viewer-internal: the wire profile
 * persists code as a `code` block, never as this type.
 *
 * @example
 * ```ts
 * import { SerializedCodeBlockNode } from "@beep/editor"
 *
 * const payload = SerializedCodeBlockNode.make({
 *   format: "",
 *   version: 1,
 *   code: "export {}",
 *   language: "typescript",
 * })
 *
 * console.log(payload.language) // "typescript"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializedCodeBlockNode extends S.Class<SerializedCodeBlockNode>($I`SerializedCodeBlockNode`)(
  {
    type: S.tag("codeblock"),
    version: S.Literal(1),
    format: ElementFormat,
    code: S.String,
    language: S.String,
  },
  $I.annote("SerializedCodeBlockNode", {
    description: "Viewer-internal serialized code-block decorator node.",
  })
) {}

const decodeSerializedCodeBlockNode = (input: unknown) => S.decodeUnknownResult(SerializedCodeBlockNode)(input);

/**
 * Block-level Lexical decorator node that renders a readable, copyable code block.
 *
 * @example
 * ```tsx
 * import { $createCodeBlockNode } from "@beep/editor"
 *
 * console.log($createCodeBlockNode("export {}", "typescript").getType()) // "codeblock"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export class CodeBlockNode extends DecoratorBlockNode {
  __code: string;
  __language: string;

  constructor(code: string, language: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key);
    this.__code = code;
    this.__language = language;
  }

  // fallow-ignore-next-line unused-class-member -- required by Lexical's node contract.
  static override getType(): string {
    return "codeblock";
  }

  // fallow-ignore-next-line unused-class-member -- required by Lexical's node contract.
  static override clone(node: CodeBlockNode): CodeBlockNode {
    return new CodeBlockNode(node.__code, node.__language, node.__format, node.__key);
  }

  // fallow-ignore-next-line unused-class-member -- required by Lexical's node contract.
  static override importJSON(serializedNode: SerializedLexicalNode & Record<string, unknown>): CodeBlockNode {
    const decoded = Result.getOrThrowWith(decodeSerializedCodeBlockNode(serializedNode), schemaIssueToError);
    return $createCodeBlockNode(decoded.code, decoded.language);
  }

  // fallow-ignore-next-line unused-class-member -- called by Lexical serialization.
  override exportJSON(): SerializedCodeBlockNode {
    const serialized = super.exportJSON();
    return SerializedCodeBlockNode.make({
      format: serialized.format,
      version: 1,
      code: this.__code,
      language: this.__language,
    });
  }

  // Copying the message, or exporting it to plain text, still yields the code.
  // fallow-ignore-next-line unused-class-member -- called by Lexical text export.
  override getTextContent(): string {
    return this.__code;
  }

  // fallow-ignore-next-line unused-class-member -- called by Lexical rendering.
  override decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return <CodeBlockView code={this.__code} language={this.__language} />;
  }
}

/**
 * Create a code-block node.
 *
 * @example
 * ```ts
 * import { $createCodeBlockNode } from "@beep/editor"
 *
 * console.log($createCodeBlockNode("export {}", "ts").getTextContent()) // "export {}"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const $createCodeBlockNode = (code: string, language: string): CodeBlockNode =>
  new CodeBlockNode(code, language);

/**
 * Type guard for {@link CodeBlockNode}.
 *
 * @example
 * ```ts
 * import { $createCodeBlockNode, $isCodeBlockNode } from "@beep/editor"
 *
 * console.log($isCodeBlockNode($createCodeBlockNode("x", "ts"))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isCodeBlockNode = (node: unknown): node is CodeBlockNode => node instanceof CodeBlockNode;
