/**
 * The markdown code-fence gesture, in a composer where Enter sends.
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
import { $getSelection, $isParagraphNode, $isRangeSelection, $isTextNode } from "lexical";

/**
 * A paragraph that is nothing but a fence opener: three or more backticks and an
 * optional language. Anything after the language means the line is prose about a
 * fence, not a fence.
 */
const CODE_FENCE_OPENER = /^[ \t]*`{3,}([\w-]+)?[ \t]?$/;

/**
 * Whether the caret sits inside a code block.
 *
 * Enter belongs to the code block there: a composer that sent the message on Enter
 * inside one would let you write exactly one line of code.
 *
 * @example
 * ```ts
 * import { $isInsideCodeBlock } from "@beep/editor/chat"
 *
 * // Inside a Lexical read/update context:
 * const inCode = $isInsideCodeBlock()
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
 * Returns whether the fence was taken, so the caller knows Enter is spent.
 *
 * @example
 * ```ts
 * import { $openCodeFence } from "@beep/editor/chat"
 *
 * // Inside a Lexical update context, on Enter:
 * const opened = $openCodeFence()
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

  // The caret has to be at the very end of the opener. Mid-line, the user is editing
  // text that merely starts with backticks, and swallowing it would be theft.
  if (anchorNode.getNextSibling() !== null || selection.anchor.offset !== anchorNode.getTextContentSize()) {
    return false;
  }

  const match = paragraph.getTextContent().match(CODE_FENCE_OPENER);
  if (match === null) return false;

  // `replace` leaves the children behind, which is what we want: the backticks were
  // the gesture, not content.
  const code = $createCodeNode(match[1]);
  paragraph.replace(code);
  code.select();
  return true;
};
