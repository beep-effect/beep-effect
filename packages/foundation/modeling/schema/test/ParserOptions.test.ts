import { ParserOptions, ParserOptionsError } from "@beep/schema/ParserOptions";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeParserOptionsEffect = S.decodeEffect(ParserOptions);

describe("ParserOptions", () => {
  it("decodes defaults that match the original parser options behavior", () => {
    const options = ParserOptions.new();

    expect(options).toBeInstanceOf(ParserOptions);
    expect(options.objectMode).toBe(true);
    expect(options.delimiter).toBe(",");
    expect(options.ignoreEmpty).toBe(false);
    assertSome(options.quote, '"');
    assertNone(options.escape);
    assertSome(options.escapeChar, '"');
    assertNone(options.comment);
    expect(options.supportsComments).toBe(false);
    expect(options.ltrim).toBe(false);
    expect(options.rtrim).toBe(false);
    expect(options.trim).toBe(false);
    assertNone(options.headers);
    expect(options.renameHeaders).toBe(false);
    expect(options.strictColumnHandling).toBe(false);
    expect(options.discardUnmappedColumns).toBe(false);
    expect(options.carriageReturn).toBe("\r");
    expect(options.encoding).toBe("utf8");
    expect(options.limitRows).toBe(false);
    expect(options.maxRows).toBe(0);
    expect(options.skipLines).toBe(0);
    expect(options.skipRows).toBe(0);
    expect(options.escapedDelimiter).toBe(",");
    expect(options.NEXT_TOKEN_REGEXP).toBeInstanceOf(RegExp);
    expect(options.NEXT_TOKEN_REGEXP.test(",")).toBe(true);
  });

  it("derives computed fields from explicit input", () => {
    const options = ParserOptions.new({
      comment: "#",
      delimiter: "|",
      escape: "\\",
      maxRows: 5,
      quote: null,
      rtrim: true,
    });

    assertSome(options.comment, "#");
    expect(options.supportsComments).toBe(true);
    expect(options.escapedDelimiter).toBe("\\|");
    assertSome(options.escapeChar, "\\");
    expect(options.limitRows).toBe(true);
    expect(options.rtrim).toBe(true);
    expect(options.NEXT_TOKEN_REGEXP.test("|")).toBe(true);
  });

  it.effect(
    "still supports direct schema decoding from unknown input",
    Effect.fnUntraced(function* () {
      const options = yield* decodeParserOptionsEffect({
        delimiter: ";",
        headers: true,
        quote: null,
      });

      expect(options).toBeInstanceOf(ParserOptions);
      expect(options.delimiter).toBe(";");
      assertSome(options.headers, true);
      assertNone(options.escapeChar);
    })
  );

  it("wraps invalid delimiter input in ParserOptionsError", () => {
    expect(() => ParserOptions.new({ delimiter: "::" })).toThrow(ParserOptionsError);
    expect(() => ParserOptions.new({ delimiter: "::" })).toThrow("delimiter option must be one character long");
  });
});
