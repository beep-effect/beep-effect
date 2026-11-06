import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  foldRenderedScalar,
  foldScalarLine,
  renderBlockFolded,
  renderBlockLiteral,
  renderSingleQuotedMultiline,
} from "@beep/yaml/internal/fold";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parse } from "yaml";

/** Adapt an Option-returning renderer to its nullable reading for assertions. */
const nullable =
  <Args extends ReadonlyArray<unknown>>(render: (...args: Args) => O.Option<string>) =>
  (...args: Args): string | null =>
    O.getOrNull(render(...args));

const runs = { arbitrary: fcRuns(100) };
const words = S.Literals(["alpha", "beta", "gamma", "delta", "\tbeta", "alpha\t beta", "gamma \tdelta"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((parts) => `word ${A.join(parts, " ")} end`)
);
const blockValue = S.Literals(["alpha", "beta gamma", "'quote'", "é", " more", "\tmore", ""]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join("\n"))
);
const quotedValue = S.Literals(["alpha", "beta gamma", "'quote'", "é", ""]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join("\n"))
);
const width = Arbitrary.schema(S.Literals([8, 12, 20, 40]));

it.effect.prop(
  "logical-line folding preserves the scalar and stabilizes after parse and re-render",
  [words, width],
  ([value, columns]) =>
    Effect.gen(function* () {
      const rendered = foldScalarLine(value, "  ", columns, 0);
      assert.strictEqual(foldScalarLine(rendered, "  ", columns, 0), rendered);
      const parsed = yield* Yaml.parse(`${rendered}\n`);
      assert.strictEqual(parsed, value);
      assert.strictEqual(parse(`${rendered}\n`), value);
      const string = yield* S.decodeUnknownEffect(S.String)(parsed);
      assert.strictEqual(foldScalarLine(string, "  ", columns, 0), rendered);
      const stringify5 = yield* Yaml.stringify(parsed);
      const parsed1 = yield* Yaml.parse(stringify5);
      assert.deepStrictEqual(parsed1, parsed);
    }),
  runs
);

it.effect.prop(
  "rendered folding is idempotent and value-faithful for plain, double, folded, literal and single styles",
  [words, width],
  ([value, columns]) =>
    Effect.gen(function* () {
      const styles = [
        value,
        `"${value}"`,
        `'${value}'`,
        O.getOrNull(renderBlockLiteral(value, "  ")),
        O.getOrNull(renderBlockFolded(value, "  ")),
      ];
      for (const style of styles) {
        const source = yield* Effect.fromNullishOr(style);
        const rendered = foldRenderedScalar(source, "  ", columns);
        assert.strictEqual(foldRenderedScalar(rendered, "  ", columns), rendered);
        const parsed = yield* Yaml.parse(`${rendered}\n`);
        assert.strictEqual(parsed, value);
        assert.strictEqual(parse(`${rendered}\n`), value);
        const stringify6 = yield* Yaml.stringify(parsed);
        const parsed2 = yield* Yaml.parse(stringify6);
        assert.deepStrictEqual(parsed2, parsed);
      }
    }),
  runs
);

it.effect.prop(
  "literal and folded block formatting preserve more-indented content and stabilize canonically",
  [blockValue],
  ([value]) =>
    Effect.gen(function* () {
      for (const render of [nullable(renderBlockLiteral), nullable(renderBlockFolded)]) {
        const rendered = render(value, "  ", "keep");
        const parsed = yield* Yaml.parse(`${rendered}\n`);
        assert.strictEqual(parsed, value);
        assert.strictEqual(parse(`${rendered}\n`), value);
        const string = yield* S.decodeUnknownEffect(S.String)(parsed);
        assert.strictEqual(render(string, "  ", "keep"), rendered);
        const stringify7 = yield* Yaml.stringify(parsed);
        const parsed3 = yield* Yaml.parse(stringify7);
        assert.deepStrictEqual(parsed3, parsed);
      }
    }),
  runs
);

it.effect.prop(
  "single-quoted multiline formatting preserves quotes and newline runs and stabilizes canonically",
  [quotedValue],
  ([value]) =>
    Effect.gen(function* () {
      const rendered = O.getOrNull(renderSingleQuotedMultiline(value, "  "));
      assert.isNotNull(rendered);
      const source = yield* Effect.fromNullishOr(rendered);
      const parsed = yield* Yaml.parse(`${source}\n`);
      assert.strictEqual(parsed, value);
      assert.strictEqual(parse(`${source}\n`), value);
      const string = yield* S.decodeUnknownEffect(S.String)(parsed);
      assert.strictEqual(O.getOrNull(renderSingleQuotedMultiline(string, "  ")), source);
      const stringify8 = yield* Yaml.stringify(parsed);
      const parsed4 = yield* Yaml.parse(stringify8);
      assert.deepStrictEqual(parsed4, parsed);
    }),
  runs
);
