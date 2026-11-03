import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionInput, inputVariable } from "@beep/github-actions/ActionInput";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as Config from "effect/Config";

const runs = { arbitrary: fcRuns(100) };
const JsonList = S.String.pipe(S.Array, S.fromJsonString);
const Json = S.fromJsonString(S.Json);
const read = <A>(config: Config.Config<A>, text: string) =>
  Effect.provideService(config, ConfigProvider.ConfigProvider, ActionInput.provider({ value: text }));
describe("ActionInput parser and formatter properties", () => {
  it.effect.prop(
    "runner-variable derivation preserves spaces, dashes and case and is stable",
    [Arbitrary.schema(S.String)],
    ([name]) =>
      Effect.sync(() => {
        const variable = inputVariable(name);
        assert.strictEqual(variable, `INPUT_${pipe(name, Str.replaceAll(" ", "_"), Str.toUpperCase)}`);
        assert.strictEqual(ActionInput.variable(name), variable);
        assert.strictEqual(inputVariable(Str.slice(6)(variable)), variable);
      }),
    runs
  );
  it.effect.prop(
    "JSON lists preserve each string through parse/stringify/parse",
    [Arbitrary.schema(S.String.pipe(S.Array))],
    ([values]) =>
      Effect.gen(function* () {
        const argument = ActionInput.list("value");
        const value2 = yield* S.encodeEffect(JsonList)(values);
        const parsed = yield* read(argument, value2);
        assert.deepStrictEqual(parsed, values);
        const argument1 = ActionInput.list("value");
        const value3 = yield* S.encodeEffect(JsonList)(parsed);
        const reparsed = yield* read(argument1, value3);
        assert.deepStrictEqual(reparsed, parsed);
        const value1 = yield* S.encodeEffect(JsonList)(reparsed);
        const value7 = yield* S.encodeEffect(JsonList)(parsed);
        assert.strictEqual(value1, value7);
      }),
    runs
  );
  it.effect.prop(
    "schema input preserves JSON values through its JSON boundary",
    [Arbitrary.schema(S.Json)],
    ([value]) =>
      Effect.gen(function* () {
        const argument2 = ActionInput.schema("value", S.Json);
        const value4 = yield* S.encodeEffect(Json)(value);
        const parsed = yield* read(argument2, value4);
        assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
        const argument3 = ActionInput.schema("value", S.Json);
        const value5 = yield* S.encodeEffect(Json)(parsed);
        const reparsed = yield* read(argument3, value5);
        assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
      }),
    runs
  );
  it.effect.prop(
    "line trimming and removal of blanks is idempotent and faithful",
    [Arbitrary.schema(S.String)],
    ([raw]) =>
      Effect.gen(function* () {
        const parsed = yield* read(ActionInput.lines("value"), `\n${raw}\nanchor\n`);
        const formatted = A.join(parsed, "\n");
        const reparsed = yield* read(ActionInput.lines("value"), formatted);
        assert.deepStrictEqual(reparsed, parsed);
        assert.strictEqual(A.join(reparsed, "\n"), formatted);
        assert.deepStrictEqual(
          parsed,
          pipe(
            `${raw}\nanchor`,
            Str.split("\n"),
            A.map((line) => Str.trim(line)),
            A.filter((line) => line !== "")
          )
        );
      }),
    runs
  );
  it.effect.prop(
    "pairs preserve separators within values and canonicalize whitespace and comments",
    [Arbitrary.schema(S.String)],
    ([raw]) =>
      Effect.gen(function* () {
        const value = pipe(raw, Str.replaceAll(/[\r\n#]/g, ""), Str.trim);
        const parsed = yield* read(ActionInput.pairs("value"), ` # comment\n key = ${value}\nanchor=x`);
        assert.deepStrictEqual(parsed, { key: value, anchor: "x" });
        const formatted = pipe(
          R.toEntries(parsed),
          A.map(([key, item]) => `${key}=${item}`),
          A.join("\n")
        );
        const reparsed = yield* read(ActionInput.pairs("value"), formatted);
        assert.deepStrictEqual(reparsed, parsed);
        assert.strictEqual(
          pipe(
            R.toEntries(reparsed),
            A.map(([key, item]) => `${key}=${item}`),
            A.join("\n")
          ),
          formatted
        );
      }),
    runs
  );
  it.effect.prop(
    "boolean and integer parsers preserve canonical string fidelity",
    [Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Int)],
    ([boolean, integer]) =>
      Effect.gen(function* () {
        const parsedBoolean = yield* read(ActionInput.boolean("value"), String(boolean));
        const parsedInteger = yield* read(ActionInput.integer("value"), String(integer));
        assert.strictEqual(parsedBoolean, boolean);
        assert.strictEqual(parsedInteger, integer);
        const read2 = yield* read(ActionInput.boolean("value"), String(parsedBoolean));
        assert.strictEqual(read2, parsedBoolean);
        const read3 = yield* read(ActionInput.integer("value"), String(parsedInteger));
        assert.strictEqual(read3, parsedInteger);
      }),
    runs
  );
});

it.effect.prop(
  "string and redacted accessors preserve nonempty input bytes",
  [Arbitrary.schema(S.String)],
  ([value]) =>
    Effect.gen(function* () {
      const nonempty = `anchor${value}`;
      const parsed = yield* read(ActionInput.string("value"), nonempty);
      const secret = yield* read(ActionInput.redacted("value"), nonempty);
      assert.strictEqual(parsed, nonempty);
      assert.strictEqual(Redacted.value(secret), parsed);
      const read4 = yield* read(ActionInput.string("value"), parsed);
      assert.strictEqual(read4, parsed);
    }),
  runs
);
it.effect.prop(
  "literal parsing preserves canonical spelling and repeats faithfully",
  [Arbitrary.schema(S.Literals(["Linux", "Windows", "macOS"]))],
  ([value]) =>
    Effect.gen(function* () {
      const config = ActionInput.literals("value", ["Linux", "Windows", "macOS"]);
      const parsed = yield* read(config, value);
      assert.strictEqual(parsed, value);
      const read5 = yield* read(config, String(parsed));
      assert.strictEqual(read5, parsed);
    }),
  runs
);
it.effect.prop(
  "text lists canonicalize comments and bullets with stable formatting",
  [Arbitrary.schema(S.String)],
  ([raw]) =>
    Effect.gen(function* () {
      const item = `item=${pipe(raw, Str.replaceAll(/[\r\n,]/g, ""), Str.trim)}`;
      const parsed = yield* read(ActionInput.list("value"), `# comment\n- ${item}\n* anchor`);
      assert.deepStrictEqual(parsed, [item, "anchor"]);
      const formatted = yield* S.encodeEffect(JsonList)(parsed);
      const reparsed = yield* read(ActionInput.list("value"), formatted);
      assert.deepStrictEqual(reparsed, parsed);
      const value6 = yield* S.encodeEffect(JsonList)(reparsed);
      assert.strictEqual(value6, formatted);
    }),
  runs
);
