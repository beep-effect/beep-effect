/**
 * The markdown code-fence gesture, in a composer where Enter sends.
 *
 * **Details**
 *
 * `@lexical/markdown` already knows how to turn a fence into a code block — but only
 * on keystrokes this composer never lets it see. Its shortcut fires on a trailing
 * space, or on plain Enter; it bails outright when `shiftKey` is held. Here Enter
 * *sends* and Shift+Enter breaks the paragraph, and both are consumed at
 * `COMMAND_PRIORITY_HIGH` long before the markdown plugin's `COMMAND_PRIORITY_LOW`
 * handler runs. So the one gesture everybody uses to open a code block — a triple
 * backtick, a language, Enter — sent the literal backticks as a message instead. The
 * composer has to own the fence itself.
 *
 * @packageDocumentation \@beep/editor/chat/code-fence
 * @since 0.0.0
 */

import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $findMatchingParent } from "@lexical/utils";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { $getSelection, $isParagraphNode, $isRangeSelection, $isTextNode } from "lexical";

const CODE_FENCE_OPENER = /^[ \t]*`{3,}([\w-]+)?[ \t]?$/;

/**
 * Whether the caret sits inside a code block.
 *
 * **Details**
 *
 * Enter belongs to the code block there: a composer that sent the message on Enter
 * inside one would let you write exactly one line of code.
 *
 * **Example** (Caret inside code block)
 *
 * ```ts
 * import { $isInsideCodeBlock } from "@beep/editor/chat/code-fence"
 * import { $createCodeNode, CodeNode } from "@lexical/code"
 * import { createHeadlessEditor } from "@lexical/headless"
 * import { $createTextNode, $getRoot } from "lexical"
 *
 * const editor = createHeadlessEditor({ nodes: [CodeNode] })
 * editor.update(() => {
 *   const code = $createCodeNode("ts")
 *   const text = $createTextNode("const answer = 42")
 *   code.append(text)
 *   $getRoot().append(code)
 *   text.select(text.getTextContentSize(), text.getTextContentSize())
 *   console.log($isInsideCodeBlock()) // true
 * }, { discrete: true })
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const $isInsideCodeBlock = (): boolean => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  return $findMatchingParent(selection.anchor.getNode(), $isCodeNode) !== null;
};

/**
 * Open a code block when the caret ends a paragraph that holds only a fence opener.
 *
 * **Details**
 *
 * Returns whether the fence was taken, so the caller knows Enter is spent.
 *
 * **Gotchas**
 *
 * The caret must be at the end of the opener; mid-line backticks are text being edited and must not be swallowed.
 *
 * Replacing the paragraph intentionally leaves its children behind: the backticks are the input gesture, not code content.
 *
 * **Example** (Open fence from triple backticks)
 *
 * ```ts
 * import { $openCodeFence } from "@beep/editor/chat/code-fence"
 * import { CodeNode } from "@lexical/code"
 * import { createHeadlessEditor } from "@lexical/headless"
 * import { $createParagraphNode, $createTextNode, $getRoot } from "lexical"
 *
 * const editor = createHeadlessEditor({ nodes: [CodeNode] })
 * editor.update(() => {
 *   const paragraph = $createParagraphNode()
 *   const text = $createTextNode("\u0060\u0060\u0060ts")
 *   paragraph.append(text)
 *   $getRoot().append(paragraph)
 *   text.select(text.getTextContentSize(), text.getTextContentSize())
 *   console.log($openCodeFence()) // true
 * }, { discrete: true })
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const $openCodeFence = (): boolean => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const anchorNode = selection.anchor.getNode();
  if (!$isTextNode(anchorNode)) return false;

  const paragraph = anchorNode.getParent();
  if (!$isParagraphNode(paragraph)) return false;

  if (anchorNode.getNextSibling() !== null || selection.anchor.offset !== anchorNode.getTextContentSize()) {
    return false;
  }

  const match = Str.match(CODE_FENCE_OPENER)(paragraph.getTextContent());
  if (O.isNone(match)) return false;

  const code = $createCodeNode(match.value[1]);
  paragraph.replace(code);
  code.select();
  return true;
};
