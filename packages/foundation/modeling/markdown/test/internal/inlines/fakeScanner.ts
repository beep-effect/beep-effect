import { makeInlineNode } from "@beep/markdown/internal/inlineNode";
import { matchFrom, unitAt } from "@beep/markdown/internal/patterns";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import type { InlineNode } from "@beep/markdown/internal/inlineNode";
import type { InlineScanner } from "@beep/markdown/internal/inlineTypes";

/**
 * A scanner over `subject` at offset 0 that links nothing, recording each
 * appended node's value in `emitted`.
 *
 * @category testing
 * @since 0.0.0
 */
export const fakeScanner = (subject: string): InlineScanner & { readonly emitted: Array<string> } => {
  const emitted: Array<string> = [];
  const scanner: InlineScanner & { readonly emitted: Array<string> } = {
    emitted,
    subject,
    pos: 0,
    refmap: HashMap.empty(),
    footnoteLabels: HashSet.empty(),
    delimiters: undefined,
    brackets: undefined,
    peek: () => unitAt(subject, scanner.pos),
    match: (pattern) => matchFrom(scanner, pattern),
    matchAhead: () => undefined,
    hasAhead: () => false,
    closingBacktickRun: dual(2, (_from: number, _length: number): number | undefined => undefined),
    append: (node) => {
      emitted.push(node.value);
    },
    appendText: dual(3, (value: string, from: number, to: number): InlineNode => {
      emitted.push(value);
      return makeInlineNode("text", from, to, value);
    }),
    lastChild: () => undefined,
    unputText: () => false,
    trimTrailingSpaces: () => 0,
    removeDelimiter: () => {},
    addBracket: dual(3, (_node: InlineNode, _index: number, _image: boolean): void => {}),
    removeBracket: () => {},
    deactivateLinkOpeners: () => {},
    processEmphasis: () => {},
  };
  return scanner;
};
