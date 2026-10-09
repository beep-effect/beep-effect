import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { scanDelims } from "../../../../effected/markdown/internal/inlines/emphasis.ts";
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

it.effect("classifies a leading unmatched low surrogate without looking before the source", () => Effect.sync(() => {
  const scanner = scannerFor("\udc00*a");
  scanner.pos = 1;
  assertSome(scanDelims(scanner, 42), { numdelims: 1, canOpen: true, canClose: true });
  assert.strictEqual(scanner.pos, 1);
}));
