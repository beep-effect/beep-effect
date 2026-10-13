import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "../../../../effected/markdown/index.ts";
import { CellContent, RawCell, RowSource, ScannedRow } from "../../../../effected/markdown/internal/blocks/table.ts";

const runs = { arbitrary: fcRuns(100) };
// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value)) return R.map(R.filter(value, (_, key) => key !== "position"), semantic);
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(Arbitrary.schema, Arbitrary.map((items) => `word ${A.join(items, " ")}`));

const styles = Arbitrary.schema(S.Literals(["---", ":---", "---:", ":---:"]));
const sourceOf = (text: string, style: string) => `| ${text} | other |\n| ${style} | --- |\n| body | tail |\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

describe("table parser properties", () => {
  it.effect("scanner models retain text provenance, cell boundaries and optional scan status", () => Effect.gen(function* () {
    const source = { text: "  a\\|b | tail |\n", segments: [{ textOffset: 0, sourceOffset: 10, length: 15 }] };
    const cell = { start: 0, contentStart: 2, end: 6 };
    const row = { cells: [cell], paragraphOffset: 0 };
    const content = { text: "a|b", segments: [
      { textOffset: 0, sourceOffset: 12, length: 1 },
      { textOffset: 1, sourceOffset: 14, length: 2 },
    ] };
    assert.deepStrictEqual(yield* S.decodeEffect(RowSource)(source), source);
    assert.deepStrictEqual(yield* S.decodeEffect(RawCell)(cell), cell);
    assert.deepStrictEqual(yield* S.decodeEffect(ScannedRow)(row), row);
    assert.deepStrictEqual(yield* S.decodeEffect(ScannedRow)({ ...row, complete: false }), { ...row, complete: false });
    assert.deepStrictEqual(yield* S.decodeEffect(CellContent)(content), content);
    assert.deepStrictEqual(yield* S.encodeEffect(RowSource)(source), source);
    assert.deepStrictEqual(yield* S.encodeEffect(CellContent)(content), content);
    assert.isFalse(S.is(ScannedRow)({ ...row, complete: null }));
    assert.isFalse(S.is(RawCell)({ ...cell, end: Infinity }));
    assert.isFalse(S.is(RowSource)({ ...source, segments: [{ textOffset: 0, sourceOffset: "10", length: 15 }] }));
  }));
  it.effect("escaped cell text keeps its original source span", () => Effect.gen(function* () {
    const source = "| a\\|b | tail |\n| --- | --- |\n| c | d |\n";
    const root = yield* Markdown.parse(source);
    const table = root.children[0];
    assert.ok(table?.type === "table");
    if (table?.type === "table") {
      const cell = table.children[0]?.children[0];
      assert.ok(cell !== undefined);
      if (cell !== undefined) {
        assert.strictEqual(cell.position.start.offset, 2);
        assert.strictEqual(cell.position.end.offset, 6);
        assert.strictEqual(source.slice(cell.position.start.offset, cell.position.end.offset), "a\\|b");
        const text = cell.children[0];
        assert.strictEqual(text?.type === "text" ? text.value : undefined, "a|b");
      }
    }
  }));
  it.effect.prop("parse/stringify preserves all semantic fields and stabilizes", [words, styles], ([text, style]) => Effect.gen(function* () {
    const source = sourceOf(text, style);
    const parsed = yield* Markdown.parse(source);
    const serialized = yield* Markdown.stringify(parsed);
    const reparsed = yield* Markdown.parse(serialized);
    assert.deepStrictEqual(semantic(reparsed), semantic(parsed));
    assert.strictEqual(yield* Markdown.stringify(reparsed), serialized);
  }), runs);
  it.effect.prop("format is idempotent and keeps parsed content", [words, styles], ([text, style]) => Effect.gen(function* () {
    const source = sourceOf(text, style);
    const once = MarkdownFormat.formatToString(source, undefined, options);
    assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
    assert.deepStrictEqual(semantic(Mdast.toMdast(yield* Markdown.parse(once))), semantic(Mdast.toMdast(yield* Markdown.parse(source))));
  }), runs);
  it.effect.prop("README edit fidelity keeps surrounding bytes exact", [words, styles], ([text, style]) => Effect.gen(function* () {
    const prefix = "<!-- before  keep spacing -->\n\n";
    const suffix = "\n<!-- after\tkeep tabs -->\n";
    const block = sourceOf(text, style);
    const source = `${prefix}${block}${suffix}`;
    const parsed = yield* Markdown.parse(source);
    const first = parsed.children[1];
    assert.ok(first !== undefined);
    if (first !== undefined) {
      assert.strictEqual(first.position.start.offset, prefix.length);
      assert.ok(source.slice(first.position.start.offset, first.position.end.offset).length > 0);
    }
    const formatted = MarkdownFormat.formatToString(source, undefined, options);
    assert.ok(formatted.startsWith(prefix));
    assert.ok(formatted.endsWith(suffix));
    assert.deepStrictEqual(semantic(Mdast.toMdast(yield* Markdown.parse(formatted))), semantic(Mdast.toMdast(parsed)));
  }), runs);

});
