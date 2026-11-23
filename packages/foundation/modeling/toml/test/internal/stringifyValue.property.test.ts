import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { parseExpressions } from "@beep/toml/internal/parser";
import { buildValue } from "@beep/toml/internal/semantic";
import { renderInlineValue, renderKey, stringifyValue } from "@beep/toml/internal/stringifyValue";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Text = S.String.check(
  S.makeFilter((text) => text.isWellFormed(), {
    identifier: "WellFormedText",
    description: "TOML strings contain Unicode scalar values.",
  })
);
const Integer = S.Int.check(S.isBetween({ minimum: -1_000_000, maximum: 1_000_000 }));
const Row = S.Struct({ label: Text, count: Integer, enabled: S.Boolean });
const Document = S.Struct({
  title: Text,
  flags: S.Array(S.Boolean),
  mixed: S.Array(S.Union([Text, Integer, Row])),
  nested: S.Struct({ settings: Row }),
  rows: S.Array(Row),
});
const parse = (text: string) => buildValue(parseExpressions(text));
const decodeValue = S.decodeUnknownEffect(S.Struct({ value: S.Unknown }));

describe("stringifyValue property floor", () => {
  it.effect.prop(
    "renderKey preserves decoded keys and has stable canonical spelling",
    [Arbitrary.schema(Text), Arbitrary.schema(Text)],
    ([key, value]) =>
      Effect.sync(() => {
        const text = `${renderKey(key)} = ${renderInlineValue(value)}\n`;
        const parsed = parse(text);
        assert.deepStrictEqual(parsed, { [key]: value });
        assert.strictEqual(stringifyValue(parsed, "\n"), text);
        assert.deepStrictEqual(parse(stringifyValue(parsed, "\n")), parsed);
      }),
    runs
  );

  it.effect.prop(
    "renderInlineValue preserves nested values and is idempotent after parsing",
    [Arbitrary.schema(Document)],
    ([value]) =>
      Effect.gen(function* () {
        const fragment = renderInlineValue(value);
        const decoded = yield* decodeValue(parse(`value = ${fragment}\n`));
        assert.deepStrictEqual(decoded.value, value);
        assert.strictEqual(renderInlineValue(decoded.value), fragment);
        const reparsed = yield* decodeValue(parse(`value = ${renderInlineValue(decoded.value)}\n`));
        assert.deepStrictEqual(reparsed.value, decoded.value);
      }),
    runs
  );

  it.effect.prop(
    "stringifyValue is canonical and preserves document values with both newline styles",
    [Arbitrary.schema(Document), Arbitrary.schema(S.Literals(["\n", "\r\n"]))],
    ([value, newline]) =>
      Effect.sync(() => {
        const text = stringifyValue(value, newline);
        const parsed = parse(text);
        assert.deepStrictEqual(parsed, value);
        assert.strictEqual(stringifyValue(newline)(parsed), text);
        assert.deepStrictEqual(parse(stringifyValue(parsed, newline)), parsed);
      }),
    runs
  );
});
