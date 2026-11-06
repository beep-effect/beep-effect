import { CommandNeutralizer } from "@beep/github-commands";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { commandLines, isCommand, isDotNetWhitespace, LINE_BREAK } from "./helpers/runnerCommands.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const ZWSP = String.fromCodePoint(0x200b);

/** Every string up to `length` over `alphabet`, as a lazily built list. */
const strings = (alphabet: ReadonlyArray<string>, length: number): ReadonlyArray<string> => {
  let level: ReadonlyArray<string> = [""];
  const all: Array<string> = [""];
  for (let i = 0; i < length; i++) {
    level = A.flatMap(level, (prefix) => A.map(alphabet, (ch) => `${prefix}${ch}`));
    for (const item of level) all.push(item);
  }
  return all;
};

describe("CommandNeutralizer: the runner's two parsers", () => {
  it("returns a quiet BOM-prefixed line unchanged", () => {
    const line = "\uFEFF::error::x";
    assert.isFalse(isCommand(line));
    assert.deepStrictEqual(CommandNeutralizer.lines(line), [line]);
    assert.strictEqual(CommandNeutralizer.text(line), line);
  });

  it("neutralizes commands after every oracle whitespace code point, retaining stream line breaks", () => {
    const whitespace = [
      "\t",
      "\n",
      "\v",
      "\f",
      "\r",
      " ",
      "\u0085",
      "\u00A0",
      "\u1680",
      "\u2000",
      "\u2001",
      "\u2002",
      "\u2003",
      "\u2004",
      "\u2005",
      "\u2006",
      "\u2007",
      "\u2008",
      "\u2009",
      "\u200A",
      "\u2028",
      "\u2029",
      "\u202F",
      "\u205F",
      "\u3000",
    ];
    for (const ch of whitespace) {
      const line = `${ch}::error::x`;
      assert.isTrue(isDotNetWhitespace(ch), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(ch), identity));
      assert.isTrue(isCommand(line), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(ch), identity));
      const expected = ch === "\r" || ch === "\n" ? ["", `${ZWSP}::error::x`] : [`${ZWSP}${line}`];
      const out = CommandNeutralizer.lines(line);
      assert.deepStrictEqual(out, expected, Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(ch), identity));
      for (const outputLine of out)
        assert.isFalse(isCommand(outputLine), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(ch), identity));
      assert.strictEqual(
        CommandNeutralizer.text(line),
        A.join(expected, "\n"),
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(ch), identity)
      );
    }
  });

  it("the oracle itself flags what each parser reads, and nothing else (mutation controls)", () => {
    for (const command of [
      "::error::x",
      "  ::add-mask::x",
      "\u0085::x",
      "　 ::x",
      "prefix ##[add-mask]secret",
      "##[group]x",
      "x##[y",
    ]) {
      assert.isTrue(isCommand(command), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(command), identity));
    }
    for (const quiet of ["## Heading", "a :: b", ": :x", `${ZWSP}::x`, `##${ZWSP}[x`, "# [x]", "##", "#[x]", "﻿::x"]) {
      assert.isFalse(isCommand(quiet), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(quiet), identity));
    }
  });

  it("a V2 line gets a zero-width space in front, behind whatever whitespace it had", () => {
    for (const line of ["::error::x", "  ::add-mask::x", "\t::x", " ::x", "\u0085::x", " ::x"]) {
      const [out] = CommandNeutralizer.lines(line);
      assert.strictEqual(
        out,
        `${ZWSP}${line}`,
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(line), identity)
      );
      assert.isFalse(isCommand(out ?? ""), Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(line), identity));
    }
  });

  it("the legacy form is broken at EVERY occurrence, wherever it sits, and a bare ## is left alone", () => {
    assert.deepStrictEqual(CommandNeutralizer.lines("a ##[x] b ##[y]"), [`a ##${ZWSP}[x] b ##${ZWSP}[y]`]);
    assert.deepStrictEqual(CommandNeutralizer.lines("prefix ##[add-mask]secret"), [`prefix ##${ZWSP}[add-mask]secret`]);
    for (const bare of ["## Heading", "a ## b", "##", "###", "## [link]", "#[x]", "# #[x]", "##x[y]"]) {
      assert.deepStrictEqual(
        CommandNeutralizer.lines(bare),
        [bare],
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(bare), identity)
      );
    }
  });

  it("splits at CR, LF and CRLF, as the runner does, so a lone CR starts a line", () => {
    const out = CommandNeutralizer.lines("a\r::error::x\r\n##[group]y\n  ::add-mask::z\rplain\r\n ::w\n\u0085::n");
    assert.strictEqual(out.length, 7);
    assert.deepStrictEqual(A.filter(out, isCommand), []);
    assert.deepStrictEqual(CommandNeutralizer.lines("no command\nhere: ::"), ["no command", "here: ::"]);
  });

  it("text joins the neutralized lines with a line feed", () => {
    assert.strictEqual(CommandNeutralizer.text("a\r\n::b\rc"), `a\n${ZWSP}::b\nc`);
    assert.strictEqual(CommandNeutralizer.text(""), "");
  });

  it("is idempotent", () => {
    for (const text of ["::error::x\n a ##[b]\n##[c]", "plain", "::a::##[b]##[c]", "x\r\n::y", "##[", "##[[ ##[#[x"]) {
      const once = CommandNeutralizer.text(text);
      assert.strictEqual(
        CommandNeutralizer.text(once),
        once,
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
      );
    }
  });
});

describe("CommandNeutralizer: exhaustive over a small alphabet, judged by the independent oracle", () => {
  // Every string up to length 5 over the characters that make or break a command: the colon, the hash, the bracket,
  // ordinary and .NET whitespace (a space, a tab, NEL), the three line break characters and a letter.
  //
  // Length 5 is enough. The longest trigger is three characters (`##[`, or whitespace then `::`), so five holds a
  // one-character line break, a whole trigger and one character before it: every way a trigger meets a single break
  // or what precedes it. A CRLF break with a character before it and a three-character trigger needs six; the CRLF
  // cases in the tests above cover it.
  // Length 6 was 597,871 strings walked by four tests and ran past the CI runner's 5 s test timeout; length 5 is
  // 66,430.
  const ALL = strings([":", "#", "[", " ", "\t", "\u0085", "\r", "\n", "x"], 5);

  it(`no output line is a command, for all ${ALL.length} strings`, () => {
    for (const text of ALL) {
      assert.deepStrictEqual(
        commandLines(CommandNeutralizer.text(text)),
        [],
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
      );
    }
  });

  it("only a zero-width space is added: removing it gives back the input's own lines", () => {
    for (const text of ALL) {
      const out = A.map(CommandNeutralizer.lines(text), (line) => Str.replaceAll(ZWSP, "")(line));
      assert.deepStrictEqual(
        out,
        Str.split(LINE_BREAK)(text),
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
      );
    }
  });

  it("a line the oracle does not read as a command is returned exactly as it was", () => {
    for (const text of ALL) {
      const inputLines = Str.split(LINE_BREAK)(text);
      const out = CommandNeutralizer.lines(text);
      A.forEach(inputLines, (line, index) => {
        if (!isCommand(line))
          assert.strictEqual(
            out[index],
            line,
            Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
          );
      });
    }
  });

  it("is idempotent for every one of them", () => {
    for (const text of ALL) {
      const once = CommandNeutralizer.text(text);
      assert.strictEqual(
        CommandNeutralizer.text(once),
        once,
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
      );
    }
  });

  it("a string that already carries zero-width spaces is still safe", () => {
    for (const text of strings([":", "#", "[", ZWSP, "\n"], 6)) {
      assert.deepStrictEqual(
        commandLines(CommandNeutralizer.text(text)),
        [],
        Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity)
      );
    }
  });
});
