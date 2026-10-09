import { assert, it, vi } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import { InlineCode, Position, Text } from "../../../effected/markdown/MarkdownNode.ts";
import { parseInlines } from "../../../effected/markdown/internal/inlineParser.ts";
import { isGuardExceeded } from "../../../effected/markdown/internal/carriers.ts";
import { MAX_NESTING_DEPTH } from "../../../effected/markdown/internal/limits.ts";
import * as Registry from "../../../effected/markdown/internal/inlineRegistry.ts";
import { appendChild, makeInlineNode } from "../../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../../effected/markdown/internal/inlineTypes.ts";

const position = (start: number, end: number) => Position.make({ start: { line: 1, column: start + 1, offset: start }, end: { line: 1, column: end + 1, offset: end } });
const drive = (text: string, exercise: (scanner: InlineScanner) => void) => {
  const spy = vi.spyOn(Registry, "inlineDialect").mockReturnValue({
    byTrigger: HashMap.empty(), postprocess: [],
    text: { name: "test-scanner", triggers: [], parse: (scanner) => { exercise(scanner); scanner.pos = scanner.subject.length; return true; } },
  });
  try {
    return parseInlines({ text, startOffset: 0, segments: [{ textOffset: 0, sourceOffset: 0, length: text.length }] }, HashMap.empty(), position);
  } finally { spy.mockRestore(); }
};

it.effect("matches ahead with observable cursor movement and preserves a failed search cursor", () => Effect.sync(() => {
  const nodes = drive("abc xyz", (scanner) => {
    assert.strictEqual(scanner.matchAhead(/xyz/), "xyz");
    assert.strictEqual(scanner.pos, 7);
    assert.strictEqual(scanner.matchAhead(/absent/), undefined);
    assert.strictEqual(scanner.pos, 7);
    assert.strictEqual(scanner.peek(), -1);
    scanner.appendText("xyz", 4, 7);
  });
  assert.deepStrictEqual(nodes, [Text.make({ value: "xyz", position: position(4, 7) })]);
}));

it.effect("unputs atomically, trims empty and non-text tails and retains exact surviving spans", () => Effect.sync(() => {
  const nodes = drive("abcdef", (scanner) => {
    assert.strictEqual(scanner.unputText(0), true);
    assert.strictEqual(scanner.unputText(1), false);
    assert.strictEqual(scanner.trimTrailingSpaces(), 0);
    scanner.append(makeInlineNode("inlineCode", 0, 1, "x"));
    assert.strictEqual(scanner.unputText(1), false);
    assert.strictEqual(scanner.trimTrailingSpaces(), 0);
    scanner.appendText("  ", 1, 3);
    assert.strictEqual(scanner.trimTrailingSpaces(), 2);
    assert.strictEqual(scanner.lastChild()?.type, "inlineCode");
    scanner.appendText("ab", 1, 3);
    scanner.appendText("cd", 3, 5);
    assert.strictEqual(scanner.unputText(5), false);
    assert.strictEqual(scanner.lastChild()?.value, "cd");
    assert.strictEqual(scanner.unputText(3), true);
    assert.strictEqual(scanner.lastChild()?.value, "a");
    assert.strictEqual(scanner.lastChild()?.end, 2);
    assert.strictEqual(scanner.unputText(1), true);
    scanner.appendText("", 5, 5);
    scanner.removeBracket();
    assert.strictEqual(scanner.brackets, undefined);
  });
  assert.deepStrictEqual(nodes, [InlineCode.make({ value: "x", position: position(0, 1) })]);
}));

it.effect("materializes optional metadata defaults for every reference and link kind", () => Effect.sync(() => {
  const nodes = drive("x", (scanner) => {
    for (const kind of ["link", "image", "linkReference", "imageReference", "footnoteReference", "emphasis", "strong", "break"] as const) {
      const node = makeInlineNode(kind, 0, 0);
      if (kind === "emphasis" || kind === "strong" || kind === "link" || kind === "linkReference") {
        appendChild(node, makeInlineNode("text", 0, 1, "x"));
      }
      scanner.append(node);
    }
  });
  assert.strictEqual(nodes.length, 8);
  const [link, image, reference, imageReference, footnote] = nodes;
  assert.strictEqual(link?.type === "link" ? link.url : undefined, "");
  assert.strictEqual(image?.type === "image" ? image.url : undefined, "");
  for (const node of [reference, imageReference]) {
    assert.strictEqual(node?.type === "linkReference" || node?.type === "imageReference" ? node.identifier : undefined, "");
    assert.strictEqual(node?.type === "linkReference" || node?.type === "imageReference" ? node.referenceType : undefined, "shortcut");
  }
  assert.strictEqual(footnote?.type === "footnoteReference" ? footnote.identifier : undefined, "");
}));

it.effect("memoizes forward absence without hiding earlier matches after a cursor rewind", () => Effect.sync(() => {
  const nodes = drive("ab`cd`ef``g``", (scanner) => {
    scanner.pos = 5;
    assert.strictEqual(scanner.hasAhead("ab"), false);
    scanner.pos = 6;
    assert.strictEqual(scanner.hasAhead("ab"), false);
    scanner.pos = 0;
    assert.strictEqual(scanner.hasAhead("ab"), true);
    scanner.pos = 5;
    assert.strictEqual(scanner.hasAhead("missing"), false);
    scanner.pos = 0;
    assert.strictEqual(scanner.hasAhead("missing"), false);
    assert.strictEqual(scanner.closingBacktickRun(0, 3), undefined);
    assert.strictEqual(scanner.closingBacktickRun(3, 1), 5);
    assert.strictEqual(scanner.closingBacktickRun(6, 1), undefined);
    assert.strictEqual(scanner.closingBacktickRun(0, 2), 8);
    scanner.appendText("ab", 0, 2);
  });
  assert.deepStrictEqual(nodes, [Text.make({ value: "ab", position: position(0, 2) })]);
}));

it.effect("supports the curried parser call with identical output and source positions", () => Effect.sync(() => {
  const source = { text: "*x*", startOffset: 4, segments: [{ textOffset: 0, sourceOffset: 4, length: 3 }] };
  assert.deepStrictEqual(parseInlines(HashMap.empty(), position)(source), parseInlines(source, HashMap.empty(), position));
}));

it.effect("trims a surviving text tail and preserves non-space tails", () => Effect.sync(() => {
  const nodes = drive("a  ", (scanner) => {
    scanner.appendText("a  ", 0, 3);
    assert.strictEqual(scanner.trimTrailingSpaces(), 2);
    assert.strictEqual(scanner.lastChild()?.value, "a");
    assert.strictEqual(scanner.lastChild()?.end, 1);
    assert.strictEqual(scanner.trimTrailingSpaces(), 0);
  });
  assert.deepStrictEqual(nodes, [Text.make({ value: "a", position: position(0, 1) })]);
}));

it.effect("deactivates link openers around active image brackets and pops spent brackets", () => Effect.sync(() => {
  const nodes = drive("x", (scanner) => {
    const text = scanner.appendText("x", 0, 1);
    scanner.addBracket(text, 0, false);
    const link = scanner.brackets;
    scanner.addBracket(text, 0, true);
    assert.strictEqual(link?.bracketAfter, true);
    scanner.deactivateLinkOpeners();
    assert.strictEqual(link?.active, false);
    assert.strictEqual(scanner.brackets?.active, true);
    scanner.deactivateLinkOpeners();
    scanner.removeBracket();
    scanner.removeBracket();
    assert.strictEqual(scanner.brackets, undefined);
  });
  assert.deepStrictEqual(nodes, [Text.make({ value: "x", position: position(0, 1) })]);
}));

it.effect("preserves an image reference's non-empty alternative text", () => Effect.sync(() => {
  const nodes = drive("alt", (scanner) => {
    const node = makeInlineNode("imageReference", 0, 3, "alt");
    node.data.identifier = "id";
    node.data.label = "ID";
    node.data.referenceType = "full";
    scanner.append(node);
  });
  const [node] = nodes;
  assert.strictEqual(node?.type === "imageReference" ? node.alt : undefined, "alt");
  assert.strictEqual(node?.type === "imageReference" ? node.identifier : undefined, "id");
  assert.strictEqual(node?.type === "imageReference" ? node.label : undefined, "ID");
}));

it.effect("retains unmatched delimiters and pairs asymmetric delimiter runs", () => Effect.sync(() => {
  for (const text of ["*", "a*", "_a*", "*a**", "**a*", "***a** b*", "*a***", "~~", "a~~", "~~a~", "a*b**c*", "*a _b* c_", "_a *b_ c*", "**a*b**c*", "***a***", "a***b**c*", "*a* *", "~~a~~ ~~"]) {
    const source = { text, startOffset: 0, segments: [{ textOffset: 0, sourceOffset: 0, length: text.length }] };
    const nodes = parseInlines(source, HashMap.empty(), position, "gfm");
    assert.strictEqual(nodes.length > 0, true);
    assert.strictEqual(nodes[0]?.position.start.offset, 0);
    assert.strictEqual(nodes[nodes.length - 1]?.position.end.offset, text.length);
  }
}));


it.effect("reports the exact source offset and actual depth when inline nesting exceeds the guard", () => Effect.gen(function* () {
  const result = yield* Effect.result(Effect.try({ try: () => drive("x", (scanner) => {
    const outer = makeInlineNode("emphasis", 0, 1);
    scanner.append(outer);
    let parent = outer;
    for (let depth = 1; depth <= MAX_NESTING_DEPTH; depth += 1) {
      const child = makeInlineNode("emphasis", 0, 1);
      appendChild(parent, child);
      parent = child;
    }
    appendChild(parent, makeInlineNode("text", 0, 1, "x"));
  }), catch: (error) => isGuardExceeded(error) ? error : undefined }));
  assertFailure(Result.mapError(result, (error) => isGuardExceeded(error) ? { reason: error.reason, limit: error.limit, actual: error.actual, offset: error.offset } : undefined), { reason: "NestingDepthExceeded", limit: MAX_NESTING_DEPTH, actual: MAX_NESTING_DEPTH + 1, offset: 0 });
}));
