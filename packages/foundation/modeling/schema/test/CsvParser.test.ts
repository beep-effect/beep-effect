import { parseCsvRows } from "@beep/schema/CsvParser";
import { ParserOptions } from "@beep/schema/ParserOptions";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";

describe("parseCsvRows", () => {
  it.effect(
    "parses BOM-prefixed CSV with CRLF and CR row delimiters",
    Effect.fnUntraced(function* () {
      const rows = yield* parseCsvRows("\ufeffa,b\r\nc,d\re,f", ParserOptions.new());

      expect(rows).toEqual([
        ["a", "b"],
        ["c", "d"],
        ["e", "f"],
      ]);
    })
  );

  it.effect(
    "supports curried usage and left or right trimming",
    Effect.fnUntraced(function* () {
      const parseLeftTrimmed = parseCsvRows(ParserOptions.new({ ltrim: true }));
      const leftTrimmed = yield* parseLeftTrimmed("  a,  b\n");
      const rightTrimmed = yield* parseCsvRows("a  ,b  \n", ParserOptions.new({ rtrim: true }));

      expect(leftTrimmed).toEqual([["a", "b"]]);
      expect(rightTrimmed).toEqual([["a", "b"]]);
    })
  );

  it.effect(
    "keeps quoted delimiters, escaped quotes, whitespace padding, and trailing empty cells",
    Effect.fnUntraced(function* () {
      const rows = yield* parseCsvRows(' "a,\\"b" ,c,\nlast,', ParserOptions.new({ escape: "\\", trim: true }));

      expect(rows).toEqual([
        ['a,"b', "c", ""],
        ["last", ""],
      ]);
    })
  );

  it.effect(
    "parses leading empty cells, empty rows, and literal escape characters",
    Effect.fnUntraced(function* () {
      const rows = yield* parseCsvRows(',a\n\n"b\\zc",d', ParserOptions.new({ escape: "\\" }));

      expect(rows).toEqual([["", "a"], [], ["b\\zc", "d"]]);
    })
  );

  it.effect(
    "falls back to unquoted parsing when quotes are disabled",
    Effect.fnUntraced(function* () {
      const rows = yield* parseCsvRows('"literal",value', ParserOptions.new({ quote: null }));

      expect(rows).toEqual([['"literal"', "value"]]);
    })
  );

  it.effect(
    "skips comments, drops empty rows, and supports comments without a final newline",
    Effect.fnUntraced(function* () {
      const rows = yield* parseCsvRows(
        "# skipped\n \nvalue\n# trailing",
        ParserOptions.new({ comment: "#", ignoreEmpty: true })
      );

      expect(rows).toEqual([["value"]]);
    })
  );

  it.effect(
    "rejects missing closing quotes",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(parseCsvRows('"unterminated', ParserOptions.new()));

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        expect(Cause.pretty(result.cause)).toContain("missing closing quote");
      }
    })
  );

  it.effect(
    "rejects non-whitespace content after a closing quote",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(parseCsvRows('"quoted"x,next', ParserOptions.new()));

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        expect(Cause.pretty(result.cause)).toContain("expected delimiter or newline after closing quote");
      }
    })
  );
});
