/**
 * Pure, escaping-free node behavior for serialized Lexical state.
 *
 * This module owns the plain-text projection of the node tree — the "signal"
 * read off a node, distinct from the Md ↔ Lexical conversions in
 * `Lexical.codec.ts`. It imports the schema model but carries no schema of its
 * own, so the model classes stay free of behavior statics.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.behavior
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { LexicalNode } from "./Lexical.model.ts";
import type { SerializedEditorState } from "./Lexical.model.ts";

const childText = (children: ReadonlyArray<LexicalNode.Type>): string => A.join(A.map(children, nodeToPlainText), "");

/**
 * Plain-text projection over the full node union (prompt construction,
 * previews).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema/Lexical.model"
 * import { nodeToPlainText } from "@beep/lexical-schema/Lexical.behavior"
 *
 * const node = S.decodeUnknownSync(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(JSON.stringify(nodeToPlainText(node))) // "\"\\n\""
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const nodeToPlainText: (node: LexicalNode.Type) => string = LexicalNode.match({
  text: (node) => node.text,
  tab: () => "\t",
  linebreak: () => "\n",
  "artifact-ref": (node) => `[artifact:${node.artifactId}]\n`,
  root: (node) => childText(node.children),
  paragraph: (node) => `${childText(node.children)}\n`,
  heading: (node) => `${childText(node.children)}\n`,
  quote: (node) => `${childText(node.children)}\n`,
  list: (node) => `${childText(node.children)}\n`,
  listitem: (node) => `- ${childText(node.children)}\n`,
  link: (node) => childText(node.children),
  code: (node) => `\`\`\`\n${childText(node.children)}\n\`\`\`\n`,
  youtube: (node) => `https://www.youtube.com/watch?v=${node.videoID}\n`,
  table: (node) => `${childText(node.children)}\n`,
  tablerow: (node) => `${childText(node.children)}\n`,
  tablecell: (node) => `${Str.trim(childText(node.children))}\t`,
});

/**
 * Plain-text projection of a full editor state.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { SerializedEditorState } from "@beep/lexical-schema/Lexical.model"
 * import { editorStateToPlainText } from "@beep/lexical-schema/Lexical.behavior"
 *
 * const state = S.decodeUnknownSync(SerializedEditorState)({
 *   root: {
 *     type: "root", version: 1, direction: null, format: "", indent: 0,
 *     children: [{
 *       type: "paragraph", version: 1, children: [],
 *       direction: null, format: "", indent: 0
 *     }]
 *   }
 * })
 * console.log(editorStateToPlainText(state)) // ""
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const editorStateToPlainText = (state: SerializedEditorState.Type): string =>
  Str.trim(nodeToPlainText(state.root));
