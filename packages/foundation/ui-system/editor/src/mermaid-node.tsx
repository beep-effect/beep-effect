/**
 * Read-only Lexical decorator node for Mermaid diagrams.
 *
 * The wire profile carries a diagram as a `code` block with
 * `language="mermaid"` — there is no mermaid node on the wire, and there must
 * not be one: the composer edits diagrams as code. This node exists only for the
 * read-only {@link EditorViewer}, which swaps mermaid code blocks for it before
 * mounting so Lexical owns the rendered diagram like any other decorator.
 *
 * The previous approach hid the `<code>` element and injected a sibling `<div>`
 * next to it to portal the diagram into. That div lives inside the contenteditable
 * subtree Lexical reconciles and owns, so Lexical removed it — leaving the source
 * hidden with nothing in its place. A persisted diagram rendered as a blank gap,
 * and the reader could not even fall back to reading the source. It rendered while
 * streaming (a separate, non-Lexical path) and vanished the moment it persisted.
 *
 * @packageDocumentation \@beep/editor/mermaid-node
 * @since 0.0.0
 */
"use client";

import { $EditorId } from "@beep/identity";
import { ElementFormat } from "@beep/lexical-schema";
import { DecoratorBlockNode } from "@lexical/react/LexicalDecoratorBlockNode";
import { Result } from "effect";
import * as S from "effect/Schema";
import { MermaidView } from "./mermaid-view.tsx";
import type { EditorConfig, ElementFormatType, LexicalEditor, NodeKey, SerializedLexicalNode } from "lexical";
import type { JSX } from "react";

const $I = $EditorId.create("mermaid-node");

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

const decodeSerializedMermaidNode = (input: unknown) => S.decodeUnknownResult(SerializedMermaidNode)(input);

/**
 * Serialized shape of {@link MermaidNode}. Viewer-internal: the wire profile
 * persists a mermaid diagram as a `code` block, never as this type.
 *
 * @example
 * ```ts
 * import { SerializedMermaidNode } from "@beep/editor/mermaid-node"
 *
 * const payload = SerializedMermaidNode.make({
 *   format: "",
 *   version: 1,
 *   source: "graph TD\n  A --> B",
 * })
 *
 * console.log(payload.source) // "graph TD\n  A --> B"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializedMermaidNode extends S.Class<SerializedMermaidNode>($I`SerializedMermaidNode`)(
  {
    type: S.tag("mermaid"),
    version: S.Literal(1),
    format: ElementFormat,
    source: S.String,
  },
  $I.annote("SerializedMermaidNode", {
    description: "Viewer-internal serialized Mermaid decorator node.",
  })
) {}

/**
 * Block-level Lexical decorator node that renders a Mermaid diagram.
 *
 * @example
 * ```tsx
 * import { $createMermaidNode } from "@beep/editor/mermaid-node"
 *
 * console.log($createMermaidNode("graph TD\n  A --> B").getType()) // "mermaid"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export class MermaidNode extends DecoratorBlockNode {
  __source: string;

  constructor(source: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key);
    this.__source = source;
  }

  static override getType(): string {
    return "mermaid";
  }

  static override clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__source, node.__format, node.__key);
  }

  static override importJSON(serializedNode: SerializedLexicalNode & Record<string, unknown>): MermaidNode {
    return $createMermaidNode(
      Result.getOrThrowWith(decodeSerializedMermaidNode(serializedNode), schemaIssueToError).source
    );
  }

  override exportJSON(): SerializedMermaidNode {
    const serialized = super.exportJSON();
    return SerializedMermaidNode.make({
      format: serialized.format,
      version: 1,
      source: this.__source,
    });
  }

  getSource(): string {
    return this.getLatest().__source;
  }

  // The diagram's text content is its source: a copy of the message, or an export
  // to plain text, still yields the diagram the author wrote.
  override getTextContent(): string {
    return this.__source;
  }

  override decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return <MermaidView renderKey={`lexical:${this.getKey()}`} source={this.__source} />;
  }
}

/**
 * Create a Mermaid diagram node.
 *
 * @example
 * ```ts
 * import { $createMermaidNode } from "@beep/editor/mermaid-node"
 *
 * console.log($createMermaidNode("graph TD").getSource()) // "graph TD"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const $createMermaidNode = (source: string): MermaidNode => new MermaidNode(source);

/**
 * Type guard for {@link MermaidNode}.
 *
 * @example
 * ```ts
 * import { $createMermaidNode, $isMermaidNode } from "@beep/editor/mermaid-node"
 *
 * console.log($isMermaidNode($createMermaidNode("graph TD"))) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isMermaidNode = (node: unknown): node is MermaidNode => node instanceof MermaidNode;
