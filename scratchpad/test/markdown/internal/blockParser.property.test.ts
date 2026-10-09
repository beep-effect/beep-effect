import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown } from "../../../effected/markdown/Markdown.ts";
import { Mdast } from "../../../effected/markdown/Mdast.ts";
import { BlockParseOptions, parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  words: S.Array(S.Literals(["alpha", "beta", "gamma", "delta"])),
  marker: S.Literals(["-", "+", "*"]),
  heading: S.Literals(["#", "##", "###"]),
  dialect: S.Literals(["commonmark", "gfm"]),
});

describe("blockParser properties", () => {
  it.effect.prop("BlockParseOptions schema round-trips without failure", [Arbitrary.schema(BlockParseOptions)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(BlockParseOptions)(value);
    const decoded = yield* S.decodeEffect(BlockParseOptions)(encoded);
    assert.ok(S.toEquivalence(BlockParseOptions)(value, decoded));
  }), runs);
  it.effect.prop("canonical rendering is idempotent and parse/stringify preserves block content and marker spelling", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
    const text = sample.words.length === 0 ? "alpha" : sample.words.join(" ");
    const source = `${sample.heading} ${text}\n\n${sample.marker} ${text}\n\n> ${text}\n`;
    const first = parseBlocks(source, { dialect: sample.dialect });
    const rendered = yield* Markdown.stringify(first.root);
    const reparsed = parseBlocks(rendered, { dialect: sample.dialect });
    assert.strictEqual(yield* Markdown.stringify(reparsed.root), rendered);
    // Source positions describe each rendering, so compare trees after the
    // mdast boundary synthesizes sentinel positions for every node.
    const unpositioned = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(unpositioned);
      if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "position").map(([key, item]) => [key, unpositioned(item)]));
      return value;
    };
    assert.deepStrictEqual(unpositioned(Mdast.toMdast(reparsed.root)), unpositioned(Mdast.toMdast(first.root)));
    assert.ok(rendered.startsWith(`${sample.heading} ${text}`));
    assert.ok(rendered.includes(`${sample.marker} ${text}`));
    assert.strictEqual(first.root.position.end.offset, source.length);
    for (const inline of first.rawInlines) {
      for (const segment of inline.segments) {
        assert.strictEqual(inline.text.slice(segment.textOffset, segment.textOffset + segment.length), source.slice(segment.sourceOffset, segment.sourceOffset + segment.length));
      }
    }
  }), runs);
});
