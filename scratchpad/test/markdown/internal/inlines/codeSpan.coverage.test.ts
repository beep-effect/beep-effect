import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { codeSpanConstruct } from "../../../../effected/markdown/internal/inlines/codeSpan.ts";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { makeInlineNode } from "../../../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../../../effected/markdown/internal/inlineTypes.ts";

const scannerFor = (subject: string): InlineScanner => {
  const scanner: InlineScanner = {
    subject, pos: 0, refmap: HashMap.empty(), footnoteLabels: HashSet.empty(),
    delimiters: undefined, brackets: undefined,
    peek: () => O.getOrElse(Str.charCodeAt(subject, scanner.pos), () => -1),
    match: (pattern) => {
      const matched = pattern.exec(subject.slice(scanner.pos));
      if (matched === null || matched.index !== 0) return undefined;
      const value = matched[0];
      scanner.pos += value.length;
      return value;
    },
    matchAhead: () => undefined, hasAhead: () => false,
    closingBacktickRun: () => undefined, append: () => {},
    appendText: (value, from, to) => makeInlineNode("text", from, to, value),
    lastChild: () => undefined, unputText: () => false, trimTrailingSpaces: () => 0,
    removeDelimiter: () => {}, addBracket: () => {}, removeBracket: () => {},
    deactivateLinkOpeners: () => {}, processEmphasis: () => {},
  };
  return scanner;
};

it.effect("refuses a non-backtick without advancing or emitting text", () => Effect.sync(() => {
  const scanner = scannerFor("ordinary");
  const emitted: string[] = [];
  scanner.appendText = (value, from, to) => { emitted.push(value); return makeInlineNode("text", from, to, value); };
  assert.strictEqual(codeSpanConstruct.parse(scanner), false);
  assert.strictEqual(scanner.pos, 0);
  assert.deepStrictEqual(emitted, []);
}));
