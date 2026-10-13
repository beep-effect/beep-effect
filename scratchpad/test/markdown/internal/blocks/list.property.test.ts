import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "../../../../effected/markdown/index.ts";

const runs = { arbitrary: fcRuns(100) };
// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value)) return R.map(R.filter(value, (_, key) => key !== "position"), semantic);
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(Arbitrary.schema, Arbitrary.map((items) => `word ${A.join(items, " ")}`));

const styles = Arbitrary.schema(S.Literals(["-", "+", "*", "1.", "3)"]));
const sourceOf = (text: string, style: string) => `${style} ${text}\n${style} second item\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

describe("list parser properties", () => {
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
