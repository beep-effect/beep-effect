/**
 * Lexical node classes registered by the editor-00 block.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// cspell:ignore Klass

import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ParagraphNode, TextNode } from "lexical";
import type { Klass, LexicalNode, LexicalNodeReplacement } from "lexical";

/**
 * Lexical node classes registered by the editor block.
 *
 * **Example** (Log registered nodes length)
 *
 * ```ts
 * import { nodes } from "@beep/ui/components/blocks/editor-00/nodes"
 *
 * console.log(nodes.length)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const nodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
  HeadingNode,
  ParagraphNode,
  TextNode,
  QuoteNode,
];
