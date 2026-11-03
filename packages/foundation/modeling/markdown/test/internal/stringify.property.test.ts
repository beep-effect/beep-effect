import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { stringifyTree } from "@beep/markdown/internal/stringify";
import { Paragraph, Root, Text } from "@beep/markdown/MarkdownNode";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";
import { renderOracleHtml } from "../support/oracle.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const prose = Arbitrary.schema(S.String).pipe(
  Arbitrary.map(
    (value) =>
      `word${A.join(
        A.map(Array.from(value), (char) => O.getOrThrow(Str.codePointAt(char, 0)).toString(16)),
        ""
      )}`
  )
);
describe("stringify property floor and README fidelity", () => {
  it.effect.prop(
    "canonical formatting is idempotent and reparsing is render-equivalent in both dialects",
    [prose, prose],
    ([label, content]) =>
      Effect.sync(() => {
        for (const dialect of ["commonmark", "gfm"] as const) {
          const source = `Title ${label}\n===\n\n+ *${content}*\n+ **${label}**\n\n~~~ts\n${content}\n~~~\n\n> [${label}](/${content})\n`;
          const first = parseBlocks(source, { dialect }).root;
          const canonical = stringifyTree(first);
          const second = parseBlocks(canonical, { dialect }).root;
          assert.strictEqual(stringifyTree(second), canonical);
          assert.strictEqual(
            normalizeHtml(renderHtml(second, { gfm: dialect === "gfm" })),
            normalizeHtml(renderHtml(first, { gfm: dialect === "gfm" }))
          );
          assert.include(canonical, `Title ${label}\n===`);
          assert.include(canonical, `+ *${content}*`);
          assert.include(canonical, `~~~ts\n${content}\n~~~`);
          assert.strictEqual(Str.endsWith("\n")(canonical), true);
        }
      }),
    runs
  );
});

// The per-character escapers (canonical and literal) were split into small
// dispatch functions; these differentials pin them against commonmark.js
// 0.31.2 with fixed seeds and high run counts, so the same large input set is
// checked on every run.
describe("text escaping against the reference implementation", () => {
  const Fragment = S.Literals([
    "a",
    "Z",
    "9",
    "1.",
    "2)",
    "_",
    "*",
    "`",
    "~",
    "#",
    ">",
    "-",
    "+",
    "=",
    "[",
    "]",
    "(",
    ")",
    "!",
    "\\",
    "<",
    "&",
    "&amp;",
    "&#35;",
    ";",
    "|",
    ":",
    ".",
    "www.",
    "http:",
    "{",
    " ",
    "\n",
  ]);
  const textValue = Arbitrary.schema(S.Array(Fragment).check(S.isMinLength(1), S.isMaxLength(24))).pipe(
    Arbitrary.map((parts) => A.join(parts, ""))
  );
  const paragraphOf = (value: string, escapeStyle?: "literal"): Root =>
    Root.make({
      children: [
        Paragraph.make({ children: [Text.make({ value, ...(escapeStyle === undefined ? {} : { escapeStyle }) })] }),
      ],
    });
  const ours = (markdown: string): string =>
    normalizeHtml(renderHtml(parseBlocks(markdown, { dialect: "commonmark" }).root));
  const oracle = (markdown: string): string => normalizeHtml(renderOracleHtml(markdown));

  it.prop(
    "canonical escaping renders, under the oracle, to exactly the text the node holds",
    [textValue],
    ([raw]) => {
      // Paragraph parsing strips edge whitespace, so the text sits inside it.
      const value = `x${raw}x`;
      const tree = paragraphOf(value);
      const emitted = stringifyTree(tree);
      assert.strictEqual(
        oracle(emitted),
        normalizeHtml(renderHtml(tree)),
        `emitted: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(emitted), identity)}`
      );
      assert.strictEqual(
        ours(emitted),
        oracle(emitted),
        `emitted: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(emitted), identity)}`
      );
      return true;
    },
    { arbitrary: { ...fcRuns(2000), seed: 0x657363, size: 24 } }
  );

  it.prop(
    "literal escaping keeps the text one paragraph and parses as the oracle parses it",
    [textValue],
    ([raw]) => {
      const emitted = stringifyTree(paragraphOf(`x${raw}x`, "literal"));
      const reparsed = parseBlocks(emitted, { dialect: "commonmark" }).root;
      assert.deepStrictEqual(
        A.map(reparsed.children, (child) => child.type),
        ["paragraph"],
        `emitted: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(emitted), identity)}`
      );
      assert.strictEqual(
        ours(emitted),
        oracle(emitted),
        `emitted: ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(emitted), identity)}`
      );
      return true;
    },
    { arbitrary: { ...fcRuns(2000), seed: 0x6c6974, size: 24 } }
  );
});
