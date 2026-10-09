import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AST as OracleAST } from "minimatch";
import { AST, ASTError, ExtglobType } from "../../../effected/glob/internal/ast.ts";

const runs = { arbitrary: fcRuns(100) };
const atoms = Arbitrary.schema(S.Literals(["a", "b", ".", "*", "?", "[ab]", "[[:alpha:]]", "\\*", "\\@", "\\", "[", "]"]));
const pattern = Arbitrary.schema(ExtglobType).pipe(Arbitrary.flatMap((op) =>
  S.Literals(["a", "b", "*", "?", "[ab]", "."]).pipe(S.Array, Arbitrary.schema,
    Arbitrary.map((parts) => `${op}(a|${parts.join("|")})`))));
const patterns = Arbitrary.schema(S.Boolean).pipe(Arbitrary.flatMap((nested) =>
  pattern.pipe(Arbitrary.map((text) => nested ? `a+(${text}|b)c` : text))));

describe("AST property floor", () => {
  it.effect.prop("ExtglobType encode/decode identity", [Arbitrary.schema(ExtglobType)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ExtglobType)(value);
    const decoded = yield* S.decodeEffect(ExtglobType)(encoded);
    assert.strictEqual(decoded, value);
  }), runs);
  it.effect.prop("ASTError encode/decode identity", [Arbitrary.schema(ASTError)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(ASTError)(value);
    const decoded = yield* S.decodeEffect(ASTError)(encoded);
    assert.isTrue(S.toEquivalence(ASTError)(decoded, value));
  }), runs);
  it.effect.prop("parse/stringify fidelity and formatting idempotence", [patterns], ([text]) => Effect.sync(() => {
    const tree = AST.fromGlob(text);
    const rendered = tree.toString();
    assert.strictEqual(AST.fromGlob(rendered).toString(), rendered);
    assert.deepStrictEqual(AST.fromGlob(rendered).toJSON(), tree.toJSON());
    const source = tree.toRegExpSource();
    assert.deepStrictEqual(tree.toRegExpSource(), source);

  }), runs);
  it.effect.prop("compiled matching preserves minimatch dialect fidelity", [patterns, S.Literals(["a", "b", "c", "."]).pipe(S.Array, Arbitrary.schema), Arbitrary.schema(S.Boolean)], ([text, chars, dot]) => Effect.sync(() => {
    const candidate = chars.join("");
    const actual = AST.fromGlob(text, { dot }).toMMPattern();
    const expected = OracleAST.fromGlob(text, { dot }).toMMPattern();
    assert.strictEqual(typeof actual === "string" ? actual === candidate : actual.test(candidate),
      typeof expected === "string" ? expected === candidate : expected.test(candidate));
  }), runs);
  it.effect.prop("literal and wildcard parser round trips", [atoms], ([text]) => Effect.sync(() => {
    const tree = AST.fromGlob(text);
    assert.deepStrictEqual(AST.fromGlob(tree.toString()).toJSON(), tree.toJSON());
    assert.deepStrictEqual(AST.fromGlob(tree.toString()).toRegExpSource(), tree.toRegExpSource());
  }), runs);
});
