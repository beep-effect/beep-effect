import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { lex, locate, references, specifierLiterals } from "../../../effected/workspaces/internal/sourceText.ts";

const runs = { arbitrary: fcRuns(100) };
const stringCodec = S.fromJsonString(S.String);
const Specifier = S.String.check(S.isPattern(/^[a-zA-Z0-9_./:@ -]*$/u));

it.effect.prop("comment removal is idempotent and preserves literals, code, UTF-16 width and line terminators", [Arbitrary.schema(S.String)], ([value]) => Effect.gen(function* () {
  const quoted = yield* S.encodeEffect(stringCodec)(value);
  const text = `/* lead\r\n */const literal = ${quoted}; // tail\u2028process.cwd();`;
  const parsed = lex(text);
  assert.deepStrictEqual(lex(parsed.withoutComments), parsed);
  assert.strictEqual(parsed.withoutComments.length, text.length);
  assert.strictEqual(parsed.code.length, text.length);
  for (const index of A.range(0, text.length - 1)) {
    const char = text[index];
    if (char === "\r" || char === "\n" || char === "\u2028" || char === "\u2029") {
      assert.strictEqual(parsed.withoutComments[index], char);
      assert.strictEqual(parsed.code[index], char);
    }
  }
  assert.deepStrictEqual(specifierLiterals(parsed), []);
  assert.strictEqual(parsed.literals.length, 1);
  assert.strictEqual(parsed.literals[0]?.value, quoted.slice(1, -1));
  const offset = text.lastIndexOf("process");
  assert.deepStrictEqual(references(parsed.code, "process"), [offset]);
  assert.deepStrictEqual(locate(text)(offset), { line: Str.split(/\r\n|[\r\n\u2028\u2029]/u)(text.slice(0, offset)).length, column: 1 });
}), runs);

it.effect.prop("module specifier parse/render/parse preserves cooked values and canonical rendering is idempotent", [Specifier.pipe(S.Array, Arbitrary.schema)], ([values]) => Effect.gen(function* () {
  const render = (specifiers: ReadonlyArray<string>) => Effect.map(Effect.forEach(specifiers, (value) => S.encodeEffect(stringCodec)(value)), (quoted) => A.join(A.map(quoted, (value) => `import ${value};`), "\n"));
  const source = yield* render(values);
  const parsed = A.map(specifierLiterals(lex(source)), (literal) => literal.value);
  assert.deepStrictEqual(parsed, values);
  const canonical = yield* render(parsed);
  assert.deepStrictEqual(A.map(specifierLiterals(lex(canonical)), (literal) => literal.value), parsed);
  assert.strictEqual(yield* render(A.map(specifierLiterals(lex(canonical)), (literal) => literal.value)), canonical);
}), runs);
