import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Toml, TomlDocument, TomlFormat } from "@beep/toml";
import { parseExpressions } from "@beep/toml/internal/parser";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  count: S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })),
  enabled: S.Boolean,
  values: S.Array(S.Int.check(S.isBetween({ minimum: -1000, maximum: 1000 }))),
  nested: S.Struct({
    "quoted.key": S.Array(S.Literals(["a", "'", '"', "\\", "\n", "\t", "😀"])),
    child: S.Array(S.Struct({ enabled: S.Boolean })),
  }),
});
it.effect.prop(
  "parser fidelity, formatter idempotence and README byte-exact CST reconstruction",
  [Arbitrary.schema(Sample), Arbitrary.schema(S.Literals(["\n", "\r\n"]))],
  ([value, eol]) =>
    Effect.gen(function* () {
      const serialized = yield* Toml.stringify(value);
      const text = `\uFEFF# leading${eol}${Str.replaceAll("\n", eol)(serialized)}${eol}  # trailing${eol}\t`;
      const parsed = yield* Toml.parse(text);
      const stringify3 = yield* Toml.stringify(parsed);
      const parsed1 = yield* Toml.parse(stringify3);
      assert.deepStrictEqual(parsed1, parsed);
      const expressions = parseExpressions(text);
      const reconstructed = A.join(
        A.map(expressions, (expression) => Str.slice(expression.offset, expression.offset + expression.length)(text)),
        ""
      );
      assert.strictEqual(reconstructed, text);
      assert.deepStrictEqual(parseExpressions(reconstructed), expressions);
      assert.strictEqual((yield* TomlDocument.parse(text)).stringify(), text);
      const formatted = TomlFormat.formatToString(text);
      assert.strictEqual(TomlFormat.formatToString(formatted), formatted);
      const parsed2 = yield* Toml.parse(formatted);
      assert.deepStrictEqual(parsed2, parsed);
    }),
  runs
);
