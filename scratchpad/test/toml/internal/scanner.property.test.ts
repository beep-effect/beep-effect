import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Toml } from "../../../effected/toml/Toml.ts";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../../../effected/toml/TomlDateTime.ts";
import {
  classifyValueToken, scanBareKey, scanBasicString, scanComment, scanLiteralString,
  scanMultilineBasicString, scanMultilineLiteralString, scanNewline, scanValueToken, scanWhitespace,
} from "../../../effected/toml/internal/scanner.ts";

const runs = { arbitrary: fcRuns(100) };
const Characters = S.Array(S.Literals(["a", "b", " ", "\t", "\n", "\r", "\"", "\\", "😀", "\u0000"]));
const LiteralCharacters = S.Array(S.Literals(["a", "b", " ", "\t", "\\", "\"", "😀"]));
const JsonString = S.fromJsonString(S.String);

const calendarFidelity = <T extends TomlLocalDate | TomlLocalTime | TomlLocalDateTime | TomlOffsetDateTime>(name: string, schema: S.Codec<T>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.sync(() => {
    const text = value.toString();
    const token = scanValueToken(`${text} # date`, 0);
    assert.deepStrictEqual(token, { value: text, end: text.length });
    const parsed = classifyValueToken(token.value, 0);
    assert.deepStrictEqual(parsed, value);
    assert.strictEqual(parsed.toString(), text);
    assert.deepStrictEqual(classifyValueToken(parsed.toString(), 0), parsed);
  }), runs);
};
calendarFidelity("local dates classify faithfully and render idempotently", TomlLocalDate);
calendarFidelity("local times classify faithfully and render idempotently", TomlLocalTime);
calendarFidelity("local date-times classify faithfully and render idempotently", TomlLocalDateTime);
calendarFidelity("offset date-times classify faithfully and render idempotently", TomlOffsetDateTime);

it.effect.prop("basic string parsers preserve decoded content after canonical re-encoding", [Arbitrary.schema(Characters)],
  ([characters]) => Effect.gen(function* () {
    const value = characters.join("");
    const encoded = yield* S.encodeEffect(JsonString)(value);
    const basic = scanBasicString(encoded, 0);
    assert.deepStrictEqual(basic, { value, end: encoded.length });
    const reencoded = yield* S.encodeEffect(JsonString)(basic.value);
    assert.deepStrictEqual(scanBasicString(reencoded, 0), basic);
    const multiline = `"""${encoded.slice(1, -1)}"""`;
    assert.deepStrictEqual(scanMultilineBasicString(multiline, 0), { value, end: multiline.length });
    const canonical = yield* Toml.stringify({ value });
    assert.deepStrictEqual(yield* Toml.parse(canonical), { value });
    assert.strictEqual(yield* Toml.stringify(yield* Toml.parse(canonical)), canonical);
  }), runs);

it.effect.prop("literal string scanning is faithful and canonical rendering is idempotent", [Arbitrary.schema(LiteralCharacters)],
  ([characters]) => Effect.sync(() => {
    const value = characters.join("");
    const literal = `'${value}'`;
    const parsed = scanLiteralString(literal, 0);
    assert.deepStrictEqual(parsed, { value, end: literal.length });
    assert.deepStrictEqual(scanLiteralString(`'${parsed.value}'`, 0), parsed);
    const multiline = `'''\n${value}\nsecond'''`;
    const decoded = scanMultilineLiteralString(multiline, 0);
    assert.deepStrictEqual(decoded, { value: `${value}\nsecond`, end: multiline.length });
    assert.deepStrictEqual(scanMultilineLiteralString(`'''\n${decoded.value}'''`, 0), decoded);
  }), runs);

it.effect.prop("bare keys, comments, whitespace and newlines have stable token boundaries",
  [Arbitrary.schema(S.Literals(["a", "Z", "0", "_", "-"]).pipe(S.Array)), Arbitrary.schema(LiteralCharacters), Arbitrary.schema(S.Literals(["\n", "\r\n"]))],
  ([keyCharacters, commentCharacters, newline]) => Effect.sync(() => {
    const key = `a${keyCharacters.join("")}`;
    assert.deepStrictEqual(scanBareKey(`${key}=1`, 0), { value: key, end: key.length });
    const comment = commentCharacters.join("");
    const scanned = scanComment(`#${comment}${newline}`, 0);
    assert.deepStrictEqual(scanned, { value: comment, end: comment.length + 1 });
    assert.deepStrictEqual(scanComment(`#${scanned.value}${newline}`, 0), scanned);
    const spaces = " \t".repeat(keyCharacters.length);
    const end = scanWhitespace(`${spaces}${key}`, 0);
    assert.strictEqual(end, spaces.length);
    assert.strictEqual(scanWhitespace(`${spaces}${key}`, end), end);
    assert.strictEqual(scanNewline(`${newline}${key}`, 0), newline.length);
    assert.strictEqual(scanNewline(`${newline}${key}`, newline.length), newline.length);
  }), runs);

it.effect.prop("scalar classification survives canonical stringify and re-scanning",
  [Arbitrary.schema(S.Union([S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })), S.Boolean]))],
  ([value]) => Effect.gen(function* () {
    const text = String(value);
    const token = scanValueToken(`${text} # trailing`, 0);
    assert.deepStrictEqual(token, { value: text, end: text.length });
    assert.strictEqual(classifyValueToken(token.value, 0), value);
    const encoded = yield* Toml.stringify({ value });
    const start = encoded.indexOf("=") + 2;
    const canonical = scanValueToken(encoded, start);
    assert.strictEqual(classifyValueToken(canonical.value, start), value);
    assert.strictEqual(yield* Toml.stringify(yield* Toml.parse(encoded)), encoded);
  }), runs);
