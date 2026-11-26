import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { BlockParseOptions, parseBlocks } from "@beep/markdown/internal/blockParser";
import { Markdown } from "@beep/markdown/Markdown";
import { Mdast } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";
import { renderOracleHtml } from "../support/oracle.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  words: S.Array(S.Literals(["alpha", "beta", "gamma", "delta"])),
  marker: S.Literals(["-", "+", "*"]),
  heading: S.Literals(["#", "##", "###"]),
  dialect: S.Literals(["commonmark", "gfm"]),
});

const unpositioned = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, unpositioned);
  if (P.isObject(value))
    return R.map(
      R.filter(value, (_, key) => key !== "position"),
      unpositioned
    );
  return value;
};

describe("blockParser properties", () => {
  it.effect.prop(
    "BlockParseOptions schema round-trips without failure",
    [Arbitrary.schema(BlockParseOptions)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(BlockParseOptions)(value);
        const decoded = yield* S.decodeEffect(BlockParseOptions)(encoded);
        assert.ok(S.toEquivalence(BlockParseOptions)(value, decoded));
      }),
    runs
  );
  it.effect.prop(
    "canonical rendering is idempotent and parse/stringify preserves block content and marker spelling",
    [Arbitrary.schema(Sample)],
    ([sample]) =>
      Effect.gen(function* () {
        const text = sample.words.length === 0 ? "alpha" : A.join(sample.words, " ");
        const source = `${sample.heading} ${text}\n\n${sample.marker} ${text}\n\n> ${text}\n`;
        const first = parseBlocks(source, { dialect: sample.dialect });
        const rendered = yield* Markdown.stringify(first.root);
        const reparsed = parseBlocks(rendered, { dialect: sample.dialect });
        const stringify1 = yield* Markdown.stringify(reparsed.root);
        assert.strictEqual(stringify1, rendered);
        assert.deepStrictEqual(
          unpositioned(Mdast.toMdast(reparsed.root)),
          unpositioned(Mdast.toMdast(first.root)),
          "source positions describe each rendering, so trees compare after the mdast boundary synthesizes sentinel positions"
        );
        assert.isTrue(Str.startsWith(`${sample.heading} ${text}`)(rendered));
        assert.isTrue(Str.includes(`${sample.marker} ${text}`)(rendered));
        assert.strictEqual(first.root.position.end.offset, source.length);
        for (const inline of first.rawInlines) {
          for (const segment of inline.segments) {
            assert.strictEqual(
              Str.slice(segment.textOffset, segment.textOffset + segment.length)(inline.text),
              Str.slice(segment.sourceOffset, segment.sourceOffset + segment.length)(source)
            );
          }
        }
      }),
    runs
  );
});

// decision: oracle-empty-paragraph-corrected
const correctOracleDefect = Str.replaceAll("<p></p>", "");

// decision: commonmark-js-differential-oracle
const renderOurs = (markdown: string): string | undefined => {
  const result = Markdown.parseResult(markdown, { dialect: "commonmark" });
  return Result.isFailure(result) ? undefined : normalizeHtml(renderHtml(result.success));
};

const leafish = Arbitrary.schema(
  S.Array(
    S.Literals([
      "",
      "   ",
      "text",
      "more text",
      "-",
      "- ",
      "-\titem",
      "-     five",
      "*  two",
      "+ plus",
      "1. one",
      "2. two",
      "10) ten",
      "1234567890. long",
      "  - nested",
      "```",
      "```js meta data",
      "``` a`b",
      "~~~ info",
      "   ```",
      "    ```",
      "\t~~~",
      "    indented code",
      "\tindented tab",
      "<script>",
      "</script>",
      "<pre x>",
      "<!--",
      "-->",
      "<?php",
      "?>",
      "<!DOCTYPE html>",
      "<![CDATA[",
      "]]>",
      "<div>",
      "<custom-tag>",
      "</custom-tag>",
      "[a]: /url",
      "[a]:",
      "/next-line",
      '"title"',
      "[b]: <> 'x'",
      "[c]: /u 'unterminated",
      "===",
      "---",
      "***",
      "> quote",
      "#",
      "###### six",
    ])
  ).check(S.isMaxLength(14))
).pipe(Arbitrary.map((lines) => `${A.join(lines, "\n")}\n`));

describe("blockParser differential oracle: commonmark.js 0.31.2", () => {
  it.prop(
    "agrees with the reference implementation on leaf-construct-dense documents",
    [leafish],
    ([markdown]) => {
      const ours = renderOurs(markdown);
      if (ours !== undefined) {
        const oracle = correctOracleDefect(normalizeHtml(renderOracleHtml(markdown)));
        assert.strictEqual(
          ours,
          oracle,
          `disagreement on input:\n${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(markdown), identity)}`
        );
      }
      return true;
    },
    { arbitrary: { ...fcRuns(2000), seed: 0x6c6561, size: 14 } }
  );
});
