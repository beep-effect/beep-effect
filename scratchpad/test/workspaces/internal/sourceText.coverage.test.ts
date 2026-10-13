import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { codePointAt, codePointBefore, isIdentifierChar, lex, locate, references, specifierLiterals } from "../../../effected/workspaces/internal/sourceText.ts";

it.effect("code point helpers preserve paired and isolated surrogates at boundaries", () => Effect.sync(() => {
  assert.strictEqual(codePointAt(1)(["a", "\uD83D", "\uDE00"]), "😀");
  assert.strictEqual(codePointBefore(3)(["a", "\uD83D", "\uDE00"]), "😀");
  assert.isUndefined(codePointAt("", 0));
  assert.isUndefined(codePointBefore("", 0));
  assert.strictEqual(codePointAt("a", 0), "a");
  assert.strictEqual(codePointBefore("a", 1), "a");
  assert.strictEqual(codePointAt("\uD800a", 0), "\uD800");
  assert.strictEqual(codePointBefore("a\uDC00", 2), "\uDC00");
  assert.isFalse(isIdentifierChar(undefined));
  assert.isTrue(isIdentifierChar("𝒙"));
}));

const unchanged = ["/", "/unterminated", "/line\nbreak", '"unterminated', "'line\rnext", '"escape\\', '`escape\\', '`unterminated', "await (x)", "await (", "x++ / 2", "x-- / 2", "x! / 2", "] / 2", "for (const of / 2)", "for (of / 2)", "for (x in of / 2)", "object.if(x) / 2", "obj..return / 2"];
for (const text of unchanged) {
  it.effect(`preserves non-comment source and widths for ${text}`, () => Effect.sync(() => {
    const parsed = lex(text);
    assert.strictEqual(parsed.withoutComments, text);
    assert.strictEqual(parsed.code.length, text.length);
    assert.strictEqual(lex(parsed.withoutComments).withoutComments, parsed.withoutComments);
  }));
}

it.effect("shebang and unterminated comments blank only their own extent", () => Effect.sync(() => {
  assert.deepStrictEqual(lex("#!node\nprocess"), { withoutComments: "      \nprocess", code: "      \nprocess", literals: [] });
  assert.strictEqual(lex("#!node").code, "      ");
  assert.strictEqual(lex("/* open").code, "       ");
  assert.strictEqual(lex("// open").code, "       ");
}));

it.effect("regex, templates and string continuations retain raw text while hiding literal bodies", () => Effect.sync(() => {
  for (const text of ["/a[\\/]b/gi", "++ /a/", "-- /a/", "! /a/", "if (x) /a/", "for await (x of xs) /a/", "for ({} of /a/) {}", "for (const of of /a/) {}"]) {
    assert.strictEqual(lex(text).withoutComments, text);
    assert.notInclude(lex(text).code, "/a/");
  }
  const template = '`a\\\r\nb${{x: 1}.x}c${2}d`';
  assert.strictEqual(lex(template).withoutComments, template);
  assert.include(lex(template).code, "\r\n");
  assert.include(lex(template).code, "{x: 1}");
  assert.deepStrictEqual(lex(template).literals, []);
  const string = '"a\\\r\nb"';
  assert.deepStrictEqual(lex(string).literals, [{ start: 0, value: 'a\\\r\nb' }]);
  assert.strictEqual(lex('`a${1}unterminated').withoutComments, '`a${1}unterminated');
}));

it.effect("reference filtering handles whitespace, optional type keys and optional global access", () => Effect.sync(() => {
  assert.deepStrictEqual(references(" { process ? : string; process : string }", "process"), []);
  assert.deepStrictEqual(references("globalThis ?. process", "process"), [14]);
  assert.deepStrictEqual(references("globalThis . process", "process"), [13]);
  assert.deepStrictEqual(references("process")("...process"), [3]);
}));

it.effect("specifier extraction rejects other callees and cooks out-of-range Unicode without throwing", () => Effect.sync(() => {
  assert.deepStrictEqual(specifierLiterals(lex(' import ( "x" , {}); require ( "y" ); f("z"); obj.require("a");')), [{ start: 10, value: "x" }, { start: 31, value: "y" }]);
  assert.deepStrictEqual(specifierLiterals(lex('import "\\u{110000}";')), [{ start: 7, value: "\\u{110000}" }]);
  assert.deepStrictEqual(locate("a\r\nb\rc\u2028d\u2029e")(0), { line: 1, column: 1 });
  assert.deepStrictEqual(locate("a\r\nb\rc\u2028d\u2029e")(10), { line: 5, column: 2 });
}));
