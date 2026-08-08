/**
 * Node registration for the `@beep/lexical-schema` v1 vocabulary.
 *
 * `CodeHighlightNode` is intentionally NOT registered: without the prism
 * highlight extension, code blocks keep plain text/tab/linebreak children,
 * which is exactly the wire profile `@beep/lexical-schema` persists.
 *
 * cspell:ignore Klass
 *
 * @packageDocumentation \@beep/editor/nodes
 * @since 0.0.0
 */

import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { LineBreakNode, ParagraphNode, TabNode, TextNode } from "lexical";
import { ArtifactRefNode } from "./artifact-ref-node.tsx";
import { YouTubeNode } from "./youtube-node.tsx";
import type { Klass, LexicalNode, LexicalNodeReplacement } from "lexical";

/**
 * The Lexical node classes matching the `@beep/lexical-schema` v1 union.
 *
 * **Example** (Import and length check)
 *
 * ```ts
 * import { editorNodes } from "@beep/editor/nodes"
 *
 * console.log(editorNodes.length > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const editorNodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
  TextNode,
  TabNode,
  LineBreakNode,
  ParagraphNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  YouTubeNode,
  ArtifactRefNode,
];
