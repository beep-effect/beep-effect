import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownEdit } from "@beep/markdown/MarkdownEdit";
import * as Subject from "@beep/markdown/MarkdownFormat";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { normalizeHtml } from "./support/normalizeHtml.ts";
import { renderOracleHtml } from "./support/oracle.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("MarkdownFormat schema property floor", () => {
  roundTrips("CodeBlockStyle", Subject.CodeBlockStyle);
  roundTrips("MarkdownFormattingOptions", Subject.MarkdownFormattingOptions);
  roundTrips("MarkdownModificationErrorCode", Subject.MarkdownModificationErrorCode);
  roundTrips("MarkdownModificationError", Subject.MarkdownModificationError);
});

describe("MarkdownFormat surgical fidelity", () => {
  it.effect.prop(
    "modify preserves every source byte outside the selected node",
    [Arbitrary.schema(S.String)],
    ([replacement]) =>
      Effect.gen(function* () {
        const prefix = "<!-- keep spacing -->\r\n\r\n# Heading\r\n\r\n";
        const suffix = "\r\n\r\n<!-- tail   -->\r\n";
        const source = `${prefix}original${suffix}`;
        const document = yield* MarkdownDocument.parse(source);
        const paragraph = document.find("paragraph");
        assertDefined(paragraph);
        const edits = yield* Subject.MarkdownFormat.modify(document, paragraph, replacement);
        assert.strictEqual(edits.length, 1);
        const [edit] = edits;
        assertDefined(edit);
        assert.strictEqual(edit.offset, prefix.length);
        assert.strictEqual(edit.length, "original".length);
        const output = MarkdownEdit.applyAll(source, edits);
        assert.strictEqual(Str.substring(0, prefix.length)(output), prefix);
        assert.strictEqual(Str.substring(output.length - suffix.length)(output), suffix);
        const modifyToString2 = yield* Subject.MarkdownFormat.modifyToString(document, paragraph, replacement);
        assert.strictEqual(modifyToString2, output);
      }),
    runs
  );
});

// `format` was split into per-node formatters and its guards into small
// predicates; this differential pins the conservative contract — a format
// pass never changes what the document renders to — against commonmark.js
// 0.31.2, with a fixed seed and a high run count.
describe("MarkdownFormat against the reference implementation", () => {
  const Line = S.Literals([
    "",
    "",
    "* item *em* and _em_",
    "- item **strong** __strong__",
    "+ item",
    "  * nested",
    "1. ordered",
    "# Title *em*",
    "## Title __b__ ##",
    "Setext",
    "======",
    "Under",
    "------",
    "***",
    "___",
    "- - -",
    "```",
    "~~~js",
    "    indented code",
    "> quoted *x*",
    "> - quoted item",
    "text with *a*_b_ and **c**d",
    "*a* *b* **c****d**",
    "a_b_c *x*y",
  ]);
  const document = Arbitrary.schema(S.Array(Line).check(S.isMaxLength(14))).pipe(
    Arbitrary.map((lines) => `${A.join(lines, "\n")}\n`)
  );
  const options = Arbitrary.schema(
    S.Struct({
      headingStyle: S.optionalKey(S.Literals(["atx", "setext"])),
      bulletChar: S.optionalKey(S.Literals(["-", "*", "+"])),
      emphasisChar: S.optionalKey(S.Literals(["*", "_"])),
      fenceChar: S.optionalKey(S.Literals(["`", "~"])),
      thematicBreakChar: S.optionalKey(S.Literals(["-", "*", "_"])),
      codeBlockStyle: S.optionalKey(S.Literals(["fenced", "indented"])),
    })
  );
  const oracle = (markdown: string): string => normalizeHtml(renderOracleHtml(markdown));

  it.prop(
    "a format pass never changes what the document renders to",
    [document, options],
    ([source, requested]) => {
      const formatted = Subject.MarkdownFormat.formatToString(source, undefined, {
        ...requested,
        dialect: "commonmark",
      });
      assert.strictEqual(
        oracle(formatted),
        oracle(source),
        `source: ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(source), identity)}\nformatted: ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(formatted), identity)}`
      );
      return true;
    },
    { arbitrary: { ...fcRuns(2000), seed: 0x666d74, size: 14 } }
  );
});
