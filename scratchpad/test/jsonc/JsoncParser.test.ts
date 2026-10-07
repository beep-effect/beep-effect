import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import {
  ParseCode,
  ParseFlags,
  ParseTreeResult,
  ParseValueResult,
  parseTree,
  parseValue,
  RawParseError,
  scanErrorToCode,
} from "@beep/scratchpad/effected/jsonc/internal/parser";

const flags = ParseFlags.make({});
const codes = (text: string, options = flags): ReadonlyArray<string> => parseValue(text, options).errors.map((e) => e.code);
const treeCodes = (text: string, options = flags): ReadonlyArray<string> => parseTree(text, options).errors.map((e) => e.code);
const deep = (depth: number): string => `${"[".repeat(depth)}1${"]".repeat(depth)}`;

describe("internal/parser", () => {
  describe("schemas", () => {
    it("ParseFlags defaults to the JSONC convention", () => {
      assert.deepStrictEqual(flags, { disallowComments: false, allowTrailingComma: true, allowEmptyContent: false });
    });

    it("ParseCode, RawParseError and the result structs validate their shapes", () => {
      assert.isTrue(ParseCode.is.ValueExpected("ValueExpected"));
      assert.strictEqual(ParseCode.literals.length, 17);
      assert.deepStrictEqual(RawParseError.make({ code: "CommaExpected", offset: 4, length: 1 }), {
        code: "CommaExpected",
        offset: 4,
        length: 1,
      });
      assert.deepStrictEqual(ParseValueResult.make({ value: 1, errors: [] }), { value: 1, errors: [] });
      assert.deepStrictEqual(ParseTreeResult.make({ root: O.none(), errors: [] }), { root: O.none(), errors: [] });
    });
  });

  describe("scanErrorToCode", () => {
    it("maps every scanner code and treats None as absent", () => {
      assertNone(scanErrorToCode("None"));
      assertSome(scanErrorToCode("UnexpectedEndOfNumber"), "InvalidNumberFormat");
      assertSome(scanErrorToCode("UnexpectedEndOfComment"), "UnexpectedEndOfComment");
      assertSome(scanErrorToCode("UnexpectedEndOfString"), "UnexpectedEndOfString");
      assertSome(scanErrorToCode("InvalidUnicode"), "InvalidUnicode");
      assertSome(scanErrorToCode("InvalidEscapeCharacter"), "InvalidEscapeCharacter");
      assertSome(scanErrorToCode("InvalidCharacter"), "InvalidCharacter");
      assertSome(scanErrorToCode("InvalidSymbol"), "InvalidSymbol");
    });
  });

  describe("parseValue", () => {
    it("is dual", () => {
      assert.deepStrictEqual(pipe("[1]", parseValue(flags)), parseValue("[1]", flags));
    });

    it("decodes every scalar kind", () => {
      assert.deepStrictEqual(parseValue('[1, -2.5, "s", true, false, null]', flags).value, [1, -2.5, "s", true, false, null]);
    });

    it("reports a leading comma as a missing value or property name", () => {
      assert.deepStrictEqual(codes("[,1]"), ["ValueExpected"]);
      assert.deepStrictEqual(codes('{,"a":1}'), ["PropertyNameExpected"]);
    });

    it("reports a missing comma between entries and still recovers both", () => {
      const array = parseValue("[1 2]", flags);
      assert.deepStrictEqual(array.value, [1, 2]);
      assert.deepStrictEqual(array.errors.map((e) => e.code), ["CommaExpected"]);
      assert.deepStrictEqual(parseValue('{"a":1 "b":2}', flags).value, { a: 1, b: 2 });
    });

    it("rejects a trailing comma when allowTrailingComma is off", () => {
      const strict = ParseFlags.make({ allowTrailingComma: false });
      assert.deepStrictEqual(codes("[1,]", strict), ["ValueExpected"]);
      assert.deepStrictEqual(codes('{"a":1,}', strict), ["PropertyNameExpected"]);
      assert.deepStrictEqual(codes("[1,]"), []);
    });

    it("reports missing closers and still returns the recovered container", () => {
      const array = parseValue("[1", flags);
      assert.deepStrictEqual(array.value, [1]);
      assert.deepStrictEqual(array.errors.map((e) => e.code), ["CloseBracketExpected"]);
      const object = parseValue('{"a":1', flags);
      assert.deepStrictEqual(object.value, { a: 1 });
      assert.deepStrictEqual(object.errors.map((e) => e.code), ["CloseBraceExpected"]);
    });

    it("reports a missing colon, a non-string key and a missing value, resynchronizing on the next entry", () => {
      // Recovery stops on the comma, which the loop then reports as a missing
      // property name before continuing with the next entry.
      assert.deepStrictEqual(parseValue('{"a" 1, "b": 2}', flags), {
        value: { b: 2 },
        errors: [
          { code: "ColonExpected", offset: 5, length: 1 },
          { code: "PropertyNameExpected", offset: 6, length: 1 },
        ],
      });
      assert.deepStrictEqual(codes('{1: 2, "b": 3}'), ["PropertyNameExpected", "PropertyNameExpected"]);
      assert.deepStrictEqual(parseValue('{1: 2, "b": 3}', flags).value, { b: 3 });
      assert.deepStrictEqual(codes('{"a": }'), ["ValueExpected"]);
      assert.deepStrictEqual(codes("[@]"), ["InvalidCharacter", "ValueExpected"]);
    });

    it("reports trailing top-level tokens and empty content", () => {
      assert.deepStrictEqual(codes("1 2"), ["EndOfFileExpected"]);
      assert.deepStrictEqual(codes(""), ["ValueExpected"]);
      assert.deepStrictEqual(codes("  // only\n"), ["ValueExpected"]);
      assert.deepStrictEqual(parseValue("", ParseFlags.make({ allowEmptyContent: true })), { value: undefined, errors: [] });
    });

    it("maps scanner errors to parse codes with their token spans", () => {
      assert.deepStrictEqual(parseValue("1.", flags).errors, [{ code: "InvalidNumberFormat", offset: 0, length: 2 }]);
      assert.deepStrictEqual(codes('"abc'), ["UnexpectedEndOfString"]);
      assert.deepStrictEqual(codes("/* open"), ["UnexpectedEndOfComment", "ValueExpected"]);
    });

    it("rejects comments only when disallowComments is set", () => {
      const strict = ParseFlags.make({ disallowComments: true });
      assert.deepStrictEqual(codes("1 // c"), []);
      assert.deepStrictEqual(codes("1 // c", strict), ["InvalidCommentToken"]);
      assert.deepStrictEqual(codes("/* a */ 1 /* b */", strict), ["InvalidCommentToken", "InvalidCommentToken"]);
    });

    it("caps nesting with one deduplicated NestingDepthExceeded error and a bounded placeholder", () => {
      assert.deepStrictEqual(codes(deep(300)), ["NestingDepthExceeded"]);
      assert.deepStrictEqual(codes(`[${deep(300)}, ${deep(300)}]`), ["NestingDepthExceeded"]);
      assert.deepStrictEqual(codes(`${"{\"a\":".repeat(300)}1${"}".repeat(300)}`), ["NestingDepthExceeded"]);
      assert.deepStrictEqual(codes(deep(256)), []);
    });

    it("defines __proto__ as an own data property", () => {
      const value = parseValue('{"__proto__": {"polluted": true}}', flags).value;
      assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
      assert.isTrue(Object.hasOwn(value as object, "__proto__"));
    });
  });

  describe("parseTree", () => {
    it("is dual", () => {
      assert.deepStrictEqual(pipe("[1]", parseTree(flags)), parseTree("[1]", flags));
    });

    it("builds leaves for every scalar kind with tight spans", () => {
      const root = O.getOrThrow(parseTree('[1, "s", true, false, null]', flags).root);
      assert.deepStrictEqual(
        root.children?.map((child) => [child.type, child.value, child.length]),
        [["number", 1, 1], ["string", "s", 3], ["boolean", true, 4], ["boolean", false, 5], ["null", null, 4]]
      );
    });

    it("reports container errors like value mode and keeps partial nodes", () => {
      assert.deepStrictEqual(treeCodes("[,1]"), ["ValueExpected"]);
      assert.deepStrictEqual(treeCodes('{,"a":1}'), ["PropertyNameExpected"]);
      assert.deepStrictEqual(treeCodes("[1 2]"), ["CommaExpected"]);
      assert.deepStrictEqual(treeCodes("[1"), ["CloseBracketExpected"]);
      assert.deepStrictEqual(treeCodes('{"a":1'), ["CloseBraceExpected"]);
      assert.deepStrictEqual(treeCodes("[@]"), ["InvalidCharacter", "ValueExpected"]);
      assert.deepStrictEqual(treeCodes("[1,]", ParseFlags.make({ allowTrailingComma: false })), ["ValueExpected"]);
      assert.deepStrictEqual(treeCodes('{"a":1,}', ParseFlags.make({ allowTrailingComma: false })), ["PropertyNameExpected"]);
    });

    it("keeps a key-only property on a missing colon or value", () => {
      const missingColon = parseTree('{"a" 1}', flags);
      assert.deepStrictEqual(missingColon.errors.map((e) => e.code), ["ColonExpected"]);
      const colonProp = O.getOrThrow(missingColon.root).children?.[0];
      assert.strictEqual(colonProp?.children?.length, 1);
      assert.strictEqual(colonProp?.colonOffset, undefined);

      const missingValue = parseTree('{"a": }', flags);
      assert.deepStrictEqual(missingValue.errors.map((e) => e.code), ["ValueExpected"]);
      const valueProp = O.getOrThrow(missingValue.root).children?.[0];
      assert.strictEqual(valueProp?.children?.length, 1);
      assert.strictEqual(valueProp?.colonOffset, 4);
      assert.deepStrictEqual(treeCodes('{1: 2}'), ["PropertyNameExpected"]);
    });

    it("accepts trailing commas by default in both container kinds", () => {
      const array = parseTree("[1,]", flags);
      assert.deepStrictEqual(array.errors, []);
      assert.strictEqual(O.getOrThrow(array.root).children?.length, 1);
      const object = parseTree('{"a":1,}', flags);
      assert.deepStrictEqual(object.errors, []);
      assert.strictEqual(O.getOrThrow(object.root).children?.length, 1);
    });

    it("spans an unterminated container up to the recovery point", () => {
      const root = O.getOrThrow(parseTree("[1, 2", flags).root);
      assert.strictEqual(root.length, 5);
      const object = O.getOrThrow(parseTree('{"a": 1', flags).root);
      assert.strictEqual(object.length, 7);
    });

    it("reports trailing tokens and empty content, honouring allowEmptyContent", () => {
      assert.deepStrictEqual(treeCodes("1 2"), ["EndOfFileExpected"]);
      assert.deepStrictEqual(treeCodes(""), ["ValueExpected"]);
      const empty = parseTree("", ParseFlags.make({ allowEmptyContent: true }));
      assertNone(empty.root);
      assert.deepStrictEqual(empty.errors, []);
    });

    it("caps nesting with a bounded placeholder node in both container kinds", () => {
      const arrays = parseTree(deep(300), flags);
      assert.deepStrictEqual(arrays.errors.map((e) => e.code), ["NestingDepthExceeded"]);
      assert.strictEqual(O.getOrThrow(arrays.root).type, "array");
      const objects = parseTree(`${"{\"a\":".repeat(300)}1${"}".repeat(300)}`, flags);
      assert.deepStrictEqual(objects.errors.map((e) => e.code), ["NestingDepthExceeded"]);
      assert.strictEqual(O.getOrThrow(objects.root).type, "object");
    });
  });
});
