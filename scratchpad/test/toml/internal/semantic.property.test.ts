import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { parseExpressions } from "../../../effected/toml/internal/parser.ts";
import { analyze, buildValue } from "../../../effected/toml/internal/semantic.ts";
import { renderInlineValue, renderKey, stringifyValue } from "../../../effected/toml/internal/stringifyValue.ts";
import { TomlDocument } from "../../../effected/toml/TomlDocument.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  key: S.String,
  text: S.String,
  count: S.Int.check(S.isBetween({ minimum: -1_000_000, maximum: 1_000_000 })),
  enabled: S.Boolean,
  float: S.Literals(["nan", "-0.0", "inf", "-inf", "1e100", "9223372036854776000.0"]),
  date: S.Literals(["1979-05-27", "07:32:00", "1979-05-27T07:32:00", "1979-05-27T07:32:00Z"]),
  newline: S.Literals(["\n", "\r\n"]),
});
const samples = Arbitrary.schema(Sample).pipe(Arbitrary.filter((sample) => sample.key.isWellFormed() && sample.text.isWellFormed()));
const source = (sample: typeof Sample.Type) => [
  "# preserved leading comment", "",
  `${renderKey(`sample:${sample.key}`)} = ${renderInlineValue(sample.text)} # preserved trailing comment`,
  `count = ${sample.count}`, `wide = ${18_014_398_509_481_984n + BigInt(sample.count)}`,
  `float = ${sample.float}`, `enabled = ${sample.enabled}`, `date = ${sample.date}`,
  "[nested.child]", `items = [${sample.count}, { a.b = ${renderInlineValue(sample.text)} }]`,
  "[[rows]]", `value = ${sample.count}`, "[[rows]]", "value = 2", "# preserved final comment", "",
].join(sample.newline);

const events = (text: string) => {
  const result: Array<readonly [string, ReadonlyArray<string>, number | undefined]> = [];
  analyze(parseExpressions(text), {
    onTableStart: (path) => { result.push(["table", path, undefined]); },
    onArrayTableStart: (path, index) => { result.push(["array", path, index]); },
    onKeyValue: (path) => { result.push(["value", path, undefined]); },
  });
  return result;
};

describe("semantic property floor", () => {
  it.effect.prop("buildValue preserves parsed values through canonical stringify and repeated normalization", [samples], ([sample]) => Effect.sync(() => {
    const parsed = buildValue(parseExpressions(source(sample)));
    const canonical = stringifyValue(parsed, sample.newline);
    const reparsed = buildValue(parseExpressions(canonical));
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(stringifyValue(reparsed, sample.newline), canonical);
  }), runs);

  it.effect.prop("analyze is repeatable, preserves CSTs, and validates the canonical value document", [samples], ([sample]) => Effect.sync(() => {
    const text = source(sample);
    const expressions = parseExpressions(text);
    const before = buildValue(expressions);
    const first = events(text);
    assert.deepStrictEqual(events(text), first);
    analyze()(expressions);
    assert.deepStrictEqual(buildValue(expressions), before);
    const canonical = stringifyValue(before, "\n");
    analyze(parseExpressions(canonical));
    assert.deepStrictEqual(buildValue(parseExpressions(canonical)), before);
    assert.strictEqual(first.filter(([kind]) => kind === "array").length, 2);
  }), runs);

  it.effect.prop("README fidelity: commented CST documents stringify byte-exact and retain semantic values", [samples], ([sample]) => Effect.gen(function* () {
    const text = source(sample);
    const document = yield* TomlDocument.parse(text);
    assert.strictEqual(document.stringify(), text);
    assert.deepStrictEqual(yield* document.toValue(), buildValue(parseExpressions(text)));
    const reparsed = yield* TomlDocument.parse(document.stringify());
    assert.strictEqual(reparsed.stringify(), text);
    assert.deepStrictEqual(yield* reparsed.toValue(), yield* document.toValue());
  }), runs);
});
