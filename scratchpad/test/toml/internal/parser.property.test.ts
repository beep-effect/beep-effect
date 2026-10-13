import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Toml, TomlDocument, TomlFormat } from "../../../effected/toml/index.ts";
import { parseExpressions } from "../../../effected/toml/internal/parser.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  count: S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })),
  enabled: S.Boolean,
  values: S.Array(S.Int.check(S.isBetween({ minimum: -1000, maximum: 1000 }))),
  nested: S.Struct({
    "quoted.key": S.Array(S.Literals(["a", "'", "\"", "\\", "\n", "\t", "😀"])),
    child: S.Array(S.Struct({ enabled: S.Boolean })),
  }),
});
it.effect.prop("parser fidelity, formatter idempotence and README byte-exact CST reconstruction",
  [Arbitrary.schema(Sample), Arbitrary.schema(S.Literals(["\n", "\r\n"]))],
  ([value, eol]) => Effect.gen(function* () {
    const serialized = yield* Toml.stringify(value);
    const text = `\uFEFF# leading${eol}${serialized.replaceAll("\n", eol)}${eol}  # trailing${eol}\t`;
    const parsed = yield* Toml.parse(text);
    assert.deepStrictEqual(yield* Toml.parse(yield* Toml.stringify(parsed)), parsed);
    const expressions = parseExpressions(text);
    const reconstructed = expressions.map((expression) => text.slice(expression.offset, expression.offset + expression.length)).join("");
    assert.strictEqual(reconstructed, text);
    assert.deepStrictEqual(parseExpressions(reconstructed), expressions);
    assert.strictEqual((yield* TomlDocument.parse(text)).stringify(), text);
    const formatted = TomlFormat.formatToString(text);
    assert.strictEqual(TomlFormat.formatToString(formatted), formatted);
    assert.deepStrictEqual(yield* Toml.parse(formatted), parsed);
  }), runs);
