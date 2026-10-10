import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import { makeInlineNode } from "../../../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../../../effected/markdown/internal/inlineTypes.ts";
import { strikethroughConstruct } from "../../../../effected/markdown/internal/inlines/strikethrough.ts";

it.effect("rejects a cursor without a tilde run without emitting text or moving the cursor", () => Effect.sync(() => {
  const emitted: string[] = [];
  const scanner: InlineScanner = {
    subject: "plain", pos: 0, refmap: HashMap.empty(), footnoteLabels: HashSet.empty(), delimiters: undefined, brackets: undefined,
    peek: () => scanner.subject.charCodeAt(scanner.pos),
    match: () => undefined, matchAhead: () => undefined, hasAhead: () => false, closingBacktickRun: () => undefined,
    append: (node) => { emitted.push(node.value); },
    appendText: (value, from, to) => { emitted.push(value); return makeInlineNode("text", from, to, value); },
    lastChild: () => undefined, unputText: () => false, trimTrailingSpaces: () => 0,
    removeDelimiter: () => {}, addBracket: () => {}, removeBracket: () => {}, deactivateLinkOpeners: () => {}, processEmphasis: () => {},
  };
  assert.strictEqual(strikethroughConstruct.parse(scanner), false);
  assert.strictEqual(scanner.pos, 0);
  assert.deepStrictEqual(emitted, []);
  assert.strictEqual(scanner.delimiters, undefined);
}));
