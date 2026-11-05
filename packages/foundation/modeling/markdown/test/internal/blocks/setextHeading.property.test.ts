import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "@beep/markdown";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value))
    return R.map(
      R.filter(value, (_, key) => key !== "position"),
      semantic
    );
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(
  Arbitrary.schema,
  Arbitrary.map((items) => `word ${A.join(items, " ")}`)
);

const styles = Arbitrary.schema(S.Literals(["===", "---"]));
const sourceOf = (text: string, style: string) => `${text}\n${style}\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

describe("setextHeading parser properties", () => {
  it.effect.prop(
    "parse/stringify preserves all semantic fields and stabilizes",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const parsed = yield* Markdown.parse(source);
        const serialized = yield* Markdown.stringify(parsed);
        const reparsed = yield* Markdown.parse(serialized);
        assert.deepStrictEqual(semantic(reparsed), semantic(parsed));
        const stringify1 = yield* Markdown.stringify(reparsed);
        assert.strictEqual(stringify1, serialized);
      }),
    runs
  );
  it.effect.prop(
    "format is idempotent and keeps parsed content",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const once = MarkdownFormat.formatToString(source, undefined, options);
        assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
        const parsed2 = yield* Markdown.parse(once);
        const argument = semantic(Mdast.toMdast(parsed2));
        const parsed1 = yield* Markdown.parse(source);
        assert.deepStrictEqual(argument, semantic(Mdast.toMdast(parsed1)));
      }),
    runs
  );
  it.effect.prop(
    "README edit fidelity keeps surrounding bytes exact",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const prefix = "<!-- before  keep spacing -->\n\n";
        const suffix = "\n<!-- after\tkeep tabs -->\n";
        const block = sourceOf(text, style);
        const source = `${prefix}${block}${suffix}`;
        const parsed = yield* Markdown.parse(source);
        const first = parsed.children[1];
        assert.ok(first !== undefined);
        if (first !== undefined) {
          assert.strictEqual(first.position.start.offset, prefix.length);
          assert.ok(Str.slice(first.position.start.offset, first.position.end.offset)(source).length > 0);
        }
        const formatted = MarkdownFormat.formatToString(source, undefined, options);
        assert.ok(Str.startsWith(prefix)(formatted));
        assert.ok(Str.endsWith(suffix)(formatted));
        const parsed3 = yield* Markdown.parse(formatted);
        assert.deepStrictEqual(semantic(Mdast.toMdast(parsed3)), semantic(Mdast.toMdast(parsed)));
      }),
    runs
  );
});
