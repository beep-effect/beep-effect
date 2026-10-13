import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { ActionInput, inputVariable } from "../../effected/github-actions/ActionInput.ts";
const runs = { arbitrary: fcRuns(100) };
const JsonList = S.String.pipe(S.Array, S.fromJsonString);
const Json = S.fromJsonString(S.Json);
const read = <A>(config: Config.Config<A>, text: string) => Effect.provideService(config, ConfigProvider.ConfigProvider, ActionInput.provider({ value: text }));
describe("ActionInput parser and formatter properties", () => {
  it.effect.prop("runner-variable derivation preserves spaces, dashes and case and is stable", [Arbitrary.schema(S.String)], ([name]) => Effect.sync(() => {
    const variable = inputVariable(name);
    assert.strictEqual(variable, `INPUT_${name.replaceAll(" ", "_").toUpperCase()}`);
    assert.strictEqual(ActionInput.variable(name), variable);
    assert.strictEqual(inputVariable(variable.slice(6)), variable);
  }), runs);
  it.effect.prop("JSON lists preserve each string through parse/stringify/parse", [Arbitrary.schema(S.String.pipe(S.Array))], ([values]) => Effect.gen(function* () {
    const parsed = yield* read(ActionInput.list("value"), yield* S.encodeEffect(JsonList)(values));
    assert.deepStrictEqual(parsed, values);
    const reparsed = yield* read(ActionInput.list("value"), yield* S.encodeEffect(JsonList)(parsed));
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(yield* S.encodeEffect(JsonList)(reparsed), yield* S.encodeEffect(JsonList)(parsed));
  }), runs);
  it.effect.prop("schema input preserves JSON values through its JSON boundary", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
    const parsed = yield* read(ActionInput.schema("value", S.Json), yield* S.encodeEffect(Json)(value));
    assert.isTrue(S.toEquivalence(S.Json)(parsed, value));
    const reparsed = yield* read(ActionInput.schema("value", S.Json), yield* S.encodeEffect(Json)(parsed));
    assert.isTrue(S.toEquivalence(S.Json)(reparsed, parsed));
  }), runs);
  it.effect.prop("line trimming and removal of blanks is idempotent and faithful", [Arbitrary.schema(S.String)], ([raw]) => Effect.gen(function* () {
    const parsed = yield* read(ActionInput.lines("value"), `\n${raw}\nanchor\n`);
    const formatted = parsed.join("\n");
    const reparsed = yield* read(ActionInput.lines("value"), formatted);
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(reparsed.join("\n"), formatted);
    assert.deepStrictEqual(parsed, `${raw}\nanchor`.split("\n").map((line) => line.trim()).filter((line) => line !== ""));
  }), runs);
  it.effect.prop("pairs preserve separators within values and canonicalize whitespace and comments", [Arbitrary.schema(S.String)], ([raw]) => Effect.gen(function* () {
    const value = raw.replaceAll(/[\r\n#]/g, "").trim();
    const parsed = yield* read(ActionInput.pairs("value"), ` # comment\n key = ${value}\nanchor=x`);
    assert.deepStrictEqual(parsed, { key: value, anchor: "x" });
    const formatted = Object.entries(parsed).map(([key, item]) => `${key}=${item}`).join("\n");
    const reparsed = yield* read(ActionInput.pairs("value"), formatted);
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(Object.entries(reparsed).map(([key, item]) => `${key}=${item}`).join("\n"), formatted);
  }), runs);
  it.effect.prop("boolean and integer parsers preserve canonical string fidelity", [Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Int)], ([boolean, integer]) => Effect.gen(function* () {
    const parsedBoolean = yield* read(ActionInput.boolean("value"), String(boolean));
    const parsedInteger = yield* read(ActionInput.integer("value"), String(integer));
    assert.strictEqual(parsedBoolean, boolean);
    assert.strictEqual(parsedInteger, integer);
    assert.strictEqual(yield* read(ActionInput.boolean("value"), String(parsedBoolean)), parsedBoolean);
    assert.strictEqual(yield* read(ActionInput.integer("value"), String(parsedInteger)), parsedInteger);
  }), runs);
});

it.effect.prop("string and redacted accessors preserve nonempty input bytes", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
  const nonempty = `anchor${value}`;
  const parsed = yield* read(ActionInput.string("value"), nonempty);
  const secret = yield* read(ActionInput.redacted("value"), nonempty);
  assert.strictEqual(parsed, nonempty);
  assert.strictEqual(Redacted.value(secret), parsed);
  assert.strictEqual(yield* read(ActionInput.string("value"), parsed), parsed);
}), runs);
it.effect.prop("literal parsing preserves canonical spelling and repeats faithfully", [Arbitrary.schema(S.Literals(["Linux", "Windows", "macOS"]))], ([value]) => Effect.gen(function* () {
  const config = ActionInput.literals("value", ["Linux", "Windows", "macOS"]);
  const parsed = yield* read(config, value);
  assert.strictEqual(parsed, value);
  assert.strictEqual(yield* read(config, String(parsed)), parsed);
}), runs);
it.effect.prop("text lists canonicalize comments and bullets with stable formatting", [Arbitrary.schema(S.String)], ([raw]) => Effect.gen(function* () {
  const item = `item=${raw.replaceAll(/[\r\n,]/g, "").trim()}`;
  const parsed = yield* read(ActionInput.list("value"), `# comment\n- ${item}\n* anchor`);
  assert.deepStrictEqual(parsed, [item, "anchor"]);
  const formatted = yield* S.encodeEffect(JsonList)(parsed);
  const reparsed = yield* read(ActionInput.list("value"), formatted);
  assert.deepStrictEqual(reparsed, parsed);
  assert.strictEqual(yield* S.encodeEffect(JsonList)(reparsed), formatted);
}), runs);
