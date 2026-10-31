import { it } from "@beep/test-runner";
import { makeCapAssertion } from "@beep/utils/Number";
import { setOwnProperty } from "@beep/utils/Record";
import { makeTextDecodeTo } from "@beep/utils/Schema";
import { lineCharacterAt, lineCharacterIndex } from "@beep/utils/Text";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const sample = "ab\r\ncd\re\nf\u2028g\u2029h";

describe("Text.lineCharacterAt", () => {
  it("counts LF, CR and CRLF by default and ignores Unicode separators", () => {
    expect(lineCharacterAt(sample, 0)).toEqual({ line: 0, character: 0 });
    expect(lineCharacterAt(sample, 4)).toEqual({ line: 1, character: 0 });
    expect(lineCharacterAt(sample, 7)).toEqual({ line: 2, character: 0 });
    expect(lineCharacterAt(sample, 9)).toEqual({ line: 3, character: 0 });
    expect(lineCharacterAt(sample, 12)).toEqual({ line: 3, character: 3 });
  });

  it("counts LS and PS when unicodeSeparators is set", () => {
    expect(lineCharacterAt(sample, 11, { unicodeSeparators: true })).toEqual({ line: 4, character: 0 });
    expect(lineCharacterAt(13, { unicodeSeparators: true })(sample)).toEqual({ line: 5, character: 0 });
  });

  it("keeps the CRLF lookahead inside the prefix only when asked", () => {
    expect(lineCharacterAt(sample, 3)).toEqual({ line: 1, character: -1 });
    expect(lineCharacterAt(sample, 3, { crlfLookahead: "prefix" })).toEqual({ line: 1, character: 0 });
  });

  it("clamps the scan to the text length", () => {
    expect(lineCharacterAt("a\nb", 10)).toEqual({ line: 1, character: 8 });
  });
});

describe("Text.lineCharacterIndex", () => {
  it("preserves both CRLF rules and Unicode separator grammars for arbitrary lookup order", () => {
    for (const unicodeSeparators of [false, true]) {
      for (const crlfLookahead of ["text", "prefix"] as const) {
        const grammar = { unicodeSeparators, crlfLookahead };
        for (const text of ["", sample, "\r\n\r\n", "\r\r\n\n", "\u2028\u2029", "😀\r\n𐀀\n"]) {
          const position = lineCharacterIndex(text, grammar);
          for (let offset = text.length + 2; offset >= -2; offset -= 0.5) {
            expect(position(offset)).toEqual(lineCharacterAt(text, offset, grammar));
          }
          for (const offset of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
            expect(position(offset)).toEqual(lineCharacterAt(text, offset, grammar));
          }
        }
      }
    }
  });

  it("keeps independent source indexes and snapshots the selected grammar", () => {
    const grammar = { unicodeSeparators: true };
    const first = lineCharacterIndex("a\u2028b", grammar);
    const second = lineCharacterIndex("a\r\nb");
    grammar.unicodeSeparators = false;
    expect(first(2)).toEqual({ line: 1, character: 0 });
    expect(second(2)).toEqual({ line: 1, character: -1 });
    expect(first(0)).toEqual({ line: 0, character: 0 });
    expect(second(3)).toEqual({ line: 1, character: 0 });
    expect(lineCharacterIndex()("a\r\nb")(2)).toEqual({ line: 1, character: -1 });
    expect(lineCharacterIndex({ crlfLookahead: "prefix" })("a\r\nb")(2)).toEqual({ line: 1, character: 0 });
  });
});

describe("Number.makeCapAssertion", () => {
  const assertCap = makeCapAssertion("@beep/example", (message) => new RangeError(message));

  it("passes positive safe integers through in both call forms", () => {
    expect(assertCap("maxDepth", 1)).toBe(1);
    expect(assertCap(256)("maxDepth")).toBe(256);
    expect(makeCapAssertion((message: string) => new Error(message))("@beep/curried")("cap", 3)).toBe(3);
  });

  it("throws the built error for every invalid cap", () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assertCap("maxDepth", value)).toThrow(
        new RangeError(`@beep/example internal cap maxDepth must be a positive integer, received ${value}`)
      );
    }
  });
});

describe("Record.setOwnProperty", () => {
  it("assigns plain keys and defines __proto__ as own data", () => {
    const target: Record<string, unknown> = {};
    setOwnProperty(target, "port", 3000);
    setOwnProperty("__proto__", { polluted: true })(target);

    expect(R.keys(target)).toEqual(["port", "__proto__"]);
    expect(Object.getPrototypeOf(target)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(target, "__proto__")).toEqual({
      configurable: true,
      enumerable: true,
      value: { polluted: true },
      writable: true,
    });
  });
});

describe("Schema.makeTextDecodeTo", () => {
  const seen: Array<string | undefined> = [];
  const fromJson = makeTextDecodeTo((options?: string) => {
    seen.push(options);
    return S.fromJsonString(S.Unknown);
  });
  const Config = S.Struct({ port: S.Finite });
  const Port = S.Int.check(S.isBetween({ minimum: 1, maximum: 65535 }));

  it("composes the text codec with the target in both call forms", () => {
    expect(Result.getOrThrow(S.decodeResult(fromJson(Config, "first"))('{"port":3000}'))).toEqual({ port: 3000 });
    expect(Result.getOrThrow(S.decodeResult(fromJson("second")(Config))('{"port":8080}'))).toEqual({ port: 8080 });
    expect(Result.getOrThrow(S.decodeResult(fromJson()(Config))('{"port":1}'))).toEqual({ port: 1 });
    expect(seen).toEqual(["first", "second", undefined]);
  });

  it.prop("decodes every TCP port written as JSON text", [Arbitrary.schema(Port)], ([port]) => {
    expect(Result.getOrThrow(S.decodeResult(fromJson(Config))(`{"port":${port}}`))).toEqual({ port });
  });

  it.effect("rejects text that fails the target schema", () =>
    Effect.gen(function* () {
      const error = yield* S.decodeEffect(fromJson(Config))('{"port":"x"}').pipe(Effect.flip);
      assertInstanceOf(error, S.SchemaError);
    })
  );
});
