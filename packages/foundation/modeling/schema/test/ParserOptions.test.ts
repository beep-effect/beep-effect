import { ParserOptions, ParserOptionsError } from "@beep/schema/ParserOptions";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("ParserOptions", () => {
  it("decodes defaults that match the original parser options behavior", () => {
    const options = ParserOptions.new();

    expect(options).toBeInstanceOf(ParserOptions);
    expect(options.objectMode).toBe(true);
    expect(options.delimiter).toBe(",");
    expect(options.ignoreEmpty).toBe(false);
    expect(options.quote).toEqual(O.some('"'));
    expect(options.escape).toEqual(O.none());
    expect(options.escapeChar).toEqual(O.some('"'));
    expect(options.comment).toEqual(O.none());
    expect(options.supportsComments).toBe(false);
    expect(options.ltrim).toBe(false);
    expect(options.rtrim).toBe(false);
    expect(options.trim).toBe(false);
    expect(options.headers).toEqual(O.none());
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

    expect(options.comment).toEqual(O.some("#"));
    expect(options.supportsComments).toBe(true);
    expect(options.escapedDelimiter).toBe("\\|");
    expect(options.escapeChar).toEqual(O.some("\\"));
    expect(options.limitRows).toBe(true);
    expect(options.rtrim).toBe(true);
    expect(options.NEXT_TOKEN_REGEXP.test("|")).toBe(true);
  });

  it("still supports direct schema decoding from unknown input", () => {
    const options = S.decodeSync(ParserOptions)({
      delimiter: ";",
      headers: true,
      quote: null,
    });

    expect(options).toBeInstanceOf(ParserOptions);
    expect(options.delimiter).toBe(";");
    expect(options.headers).toEqual(O.some(true));
    expect(options.escapeChar).toEqual(O.none());
  });

  it("wraps invalid delimiter input in ParserOptionsError", () => {
    expect(() => ParserOptions.new({ delimiter: "::" })).toThrow(ParserOptionsError);
    expect(() => ParserOptions.new({ delimiter: "::" })).toThrow("delimiter option must be one character long");
  });
});
