import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { parse } from "yaml";
import { Yaml } from "../../../effected/yaml/Yaml.ts";
import { foldScalarLine, foldRenderedScalar, renderBlockFolded, renderBlockLiteral, renderSingleQuotedMultiline } from "../../../effected/yaml/internal/fold.ts";

const runs = { arbitrary: fcRuns(100) };
const words = S.Literals(["alpha", "beta", "gamma", "delta"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((parts) => `word ${A.join(parts, " ")} end`));
const blockValue = S.Literals(["alpha", "beta gamma", "'quote'", "é", " more", "\tmore", ""]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("\n")));
const quotedValue = S.Literals(["alpha", "beta gamma", "'quote'", "é", ""]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("\n")));
const width = Arbitrary.schema(S.Literals([8, 12, 20, 40]));

it.effect.prop("logical-line folding preserves the scalar and stabilizes after parse and re-render", [words, width], ([value, columns]) => Effect.gen(function* () {
  const rendered = foldScalarLine(value, "  ", columns, 0);
  assert.strictEqual(foldScalarLine(rendered, "  ", columns, 0), rendered);
  const parsed = yield* Yaml.parse(`${rendered}\n`);
  assert.strictEqual(parsed, value);
  assert.strictEqual(parse(`${rendered}\n`), value);
  const string = yield* S.decodeUnknownEffect(S.String)(parsed);
  assert.strictEqual(foldScalarLine(string, "  ", columns, 0), rendered);
  assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
}), runs);

it.effect.prop("rendered folding is idempotent and value-faithful for plain, double, folded, literal and single styles", [words, width], ([value, columns]) => Effect.gen(function* () {
  const styles = [value, `"${value}"`, `'${value}'`, renderBlockLiteral(value, "  "), renderBlockFolded(value, "  ")];
  for (const style of styles) {
    const source = yield* Effect.fromNullishOr(style);
    const rendered = foldRenderedScalar(source, "  ", columns);
    assert.strictEqual(foldRenderedScalar(rendered, "  ", columns), rendered);
    const parsed = yield* Yaml.parse(`${rendered}\n`);
    assert.strictEqual(parsed, value);
    assert.strictEqual(parse(`${rendered}\n`), value);
    assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
  }
}), runs);

it.effect.prop("literal and folded block formatting preserve more-indented content and stabilize canonically", [blockValue], ([value]) => Effect.gen(function* () {
  for (const render of [renderBlockLiteral, renderBlockFolded]) {
    const rendered = render(value, "  ", "keep");
    const parsed = yield* Yaml.parse(`${rendered}\n`);
    assert.strictEqual(parsed, value);
    assert.strictEqual(parse(`${rendered}\n`), value);
    const string = yield* S.decodeUnknownEffect(S.String)(parsed);
    assert.strictEqual(render(string, "  ", "keep"), rendered);
    assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
  }
}), runs);

it.effect.prop("single-quoted multiline formatting preserves quotes and newline runs and stabilizes canonically", [quotedValue], ([value]) => Effect.gen(function* () {
  const rendered = renderSingleQuotedMultiline(value, "  ");
  assert.isNotNull(rendered);
  const source = yield* Effect.fromNullishOr(rendered);
  const parsed = yield* Yaml.parse(`${source}\n`);
  assert.strictEqual(parsed, value);
  assert.strictEqual(parse(`${source}\n`), value);
  const string = yield* S.decodeUnknownEffect(S.String)(parsed);
  assert.strictEqual(renderSingleQuotedMultiline(string, "  "), source);
  assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(parsed)), parsed);
}), runs);
