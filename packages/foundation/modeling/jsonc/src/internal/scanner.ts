// Ported from microsoft/node-jsonc-parser src/impl/scanner.ts (MIT).

import { $JsoncId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { accumulation } from "./accumulation.ts";

const $I = $JsoncId.create("internal/scanner");

/**
 * **Details**
 *
 * `Trivia` is a run of whitespace, `LineBreak` one line terminator (`\r\n`
 * counts as one), `Unknown` an unrecognized character or symbol and `EOF` the
 * end of input. The kit's `is` guards and `pick` subsets drive the parser's
 * token classification.
 *
 * **Example** (Classify tokens with the kit guards)
 *
 * ```ts
 * import { SyntaxKind } from "@beep/jsonc/internal/scanner"
 *
 * console.log(SyntaxKind.is.OpenBrace("OpenBrace")) // true
 * console.log(SyntaxKind.is.EOF("Comma")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SyntaxKind = LiteralKit([
  "OpenBrace",
  "CloseBrace",
  "OpenBracket",
  "CloseBracket",
  "Comma",
  "Colon",
  "Null",
  "True",
  "False",
  "String",
  "Number",
  "LineComment",
  "BlockComment",
  "LineBreak",
  "Trivia",
  "Unknown",
  "EOF",
]).pipe(
  $I.annoteSchema("SyntaxKind", {
    description: "Token kinds produced by the JSONC scanner.",
  })
);

/**
 * @see {@link SyntaxKind} for the runtime kit and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type SyntaxKind = typeof SyntaxKind.Type;

/**
 * Scanner-level lexical error codes attached to the current token.
 *
 * **Details**
 *
 * `None` marks a clean token. The parser maps every other code to a public
 * `JsoncParseErrorCode` through `scanErrorToCode`.
 *
 * **Example** (Read the error attached to a malformed string token)
 *
 * ```ts
 * import { createScanner, ScanError } from "@beep/jsonc/internal/scanner"
 *
 * const scanner = createScanner('"unterminated')
 * scanner.scan()
 *
 * console.log(ScanError.is.UnexpectedEndOfString(scanner.getTokenError())) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScanError = LiteralKit([
  "None",
  "UnexpectedEndOfComment",
  "UnexpectedEndOfString",
  "UnexpectedEndOfNumber",
  "InvalidUnicode",
  "InvalidEscapeCharacter",
  "InvalidCharacter",
  "InvalidSymbol",
]).pipe(
  $I.annoteSchema("ScanError", {
    description: "Lexical error codes the JSONC scanner attaches to a token.",
  })
);

/**
 * @see {@link ScanError} for the runtime kit and its guards.
 * @category type-level
 * @since 0.0.0
 */
export type ScanError = typeof ScanError.Type;

/**
 * Stateful cursor over JSONC text that produces tokens on demand.
 *
 * **Details**
 *
 * Every getter describes the token most recently returned by `scan`. Before
 * the first `scan` the token is `Unknown` at offset zero.
 *
 * @see {@link createScanner} for the constructor.
 * @category services
 * @since 0.0.0
 */
export interface Scanner {
  /** Return the current token's {@link SyntaxKind} without advancing. */
  readonly getToken: () => SyntaxKind;
  /** Return the {@link ScanError} for the current token, or `"None"`. */
  readonly getTokenError: () => ScanError;
  /** Return the character length of the current token. */
  readonly getTokenLength: () => number;
  /** Return the zero-based character offset where the current token begins. */
  readonly getTokenOffset: () => number;
  /** Return the decoded string value of the current token. */
  readonly getTokenValue: () => string;
  /** Advance the cursor to the next token and return its {@link SyntaxKind}. */
  readonly scan: () => SyntaxKind;
}

const QUOTE = '"';
const BACKSLASH = "\\";
const LINE_FEED = "\n";
const CARRIAGE_RETURN = "\r";
const LINE_SEPARATOR = "\u2028";
const PARAGRAPH_SEPARATOR = "\u2029";
const CONTROL_MAX = "\u001f";
const ASTERISK = "*";
const SLASH = "/";

const CODE_UNIT_NUMBERS_WITHOUT_AN_OPTION_PER_LOOKUP: Readonly<Record<string, number>> = {
  ...R.fromEntries(A.makeBy(128, (code): readonly [string, number] => [String.fromCharCode(code), code])),
  "\u00a0": 0xa0,
  "\ufeff": 0xfeff,
  "\u2028": 0x2028,
  "\u2029": 0x2029,
};

const isWhitespace = (ch: number): boolean =>
  ch === 0x20 || ch === 0x09 || ch === 0x0b || ch === 0x0c || ch === 0xa0 || ch === 0xfeff;

const isLineBreak = (ch: number): boolean => ch === 0x0a || ch === 0x0d || ch === 0x2028 || ch === 0x2029;

const isDigit = (ch: number): boolean => ch >= 0x30 && ch <= 0x39;

const isLowerAlpha = (ch: number): boolean => ch >= 0x61 && ch <= 0x7a;

const isTriviaKind = S.is(SyntaxKind.pick(["Trivia", "LineBreak", "LineComment", "BlockComment"]));

const simpleEscape: (code: number) => O.Option<string> = Match.type<number>().pipe(
  Match.when(0x22, () => O.some('"')),
  Match.when(0x5c, () => O.some("\\")),
  Match.when(0x2f, () => O.some("/")),
  Match.when(0x62, () => O.some("\b")),
  Match.when(0x66, () => O.some("\f")),
  Match.when(0x6e, () => O.some("\n")),
  Match.when(0x72, () => O.some("\r")),
  Match.when(0x74, () => O.some("\t")),
  Match.orElse(() => O.none())
);

const keywordKind: (word: string) => SyntaxKind = Match.type<string>().pipe(
  Match.when("true", (): SyntaxKind => "True"),
  Match.when("false", (): SyntaxKind => "False"),
  Match.when("null", (): SyntaxKind => "Null"),
  Match.orElse((): SyntaxKind => "Unknown")
);

const punctuationMatch: (code: number) => SyntaxKind = Match.type<number>().pipe(
  Match.when(0x7b, (): SyntaxKind => "OpenBrace"),
  Match.when(0x7d, (): SyntaxKind => "CloseBrace"),
  Match.when(0x5b, (): SyntaxKind => "OpenBracket"),
  Match.when(0x5d, (): SyntaxKind => "CloseBracket"),
  Match.when(0x3a, (): SyntaxKind => "Colon"),
  Match.when(0x2c, (): SyntaxKind => "Comma"),
  Match.orElse((): SyntaxKind => "Unknown")
);

const punctuationKindPrecomputedPerCodeUnit: ReadonlyArray<SyntaxKind> = A.makeBy(0x7e, punctuationMatch);

const punctuationKind = (ch: number): SyntaxKind => punctuationKindPrecomputedPerCodeUnit[ch] ?? "Unknown";

/**
 * Create a stateful {@link Scanner} for the given JSONC string.
 *
 * **When to use**
 *
 * Use as the token source for the parser, formatter, navigator and visitor.
 * With `ignoreTrivia` set, whitespace, line breaks and comments are skipped so
 * only structural tokens are returned.
 *
 * **Details**
 *
 * The function is dual: `createScanner(text, ignoreTrivia)` scans at once,
 * while `createScanner(ignoreTrivia)` returns a function awaiting the text so
 * it composes in a `pipe`. The first argument's type selects the form, so the
 * optional flag never makes the call ambiguous.
 *
 * **Example** (Tokenize a document in both calling styles)
 *
 * ```ts
 * import { createScanner } from "@beep/jsonc/internal/scanner"
 * import { pipe } from "effect/Function"
 *
 * const direct = createScanner('{ "a": 1 }', true)
 * console.log(direct.scan()) // "OpenBrace"
 * console.log(direct.scan()) // "String"
 * console.log(direct.getTokenValue()) // "a"
 *
 * const piped = pipe('// note\n1', createScanner())
 * console.log(piped.scan()) // "LineComment"
 * ```
 *
 * @param text - JSONC string to tokenize.
 * @param ignoreTrivia - When `true`, whitespace, line-break and comment tokens
 *   are skipped so only structural tokens are returned.
 * @category constructors
 * @since 0.0.0
 */
export const createScanner: {
  (ignoreTrivia?: boolean): (text: string) => Scanner;
  (text: string, ignoreTrivia?: boolean): Scanner;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, ignoreTrivia?: boolean): Scanner => {
    const len = text.length;
    let pos = 0;
    let tokenOffset = 0;
    let token: SyntaxKind = "Unknown";
    let tokenValue = "";
    let tokenError: ScanError = "None";

    const charAt = (index: number): number =>
      index < len ? (CODE_UNIT_NUMBERS_WITHOUT_AN_OPTION_PER_LOOKUP[Str.slice(index, index + 1)(text)] ?? 0xffff) : 0;

    const scanHexDigits = (count: number): O.Option<number> => {
      let value = 0;
      for (let i = 0; i < count; i++) {
        const ch = charAt(pos);
        if (isDigit(ch)) {
          value = value * 16 + (ch - 0x30);
        } else if (ch >= 0x41 && ch <= 0x46) {
          value = value * 16 + (ch - 0x41 + 10);
        } else if (ch >= 0x61 && ch <= 0x66) {
          value = value * 16 + (ch - 0x61 + 10);
        } else {
          return O.none();
        }
        pos++;
      }
      return O.some(value);
    };

    const skipStringRun = (): void => {
      while (pos < len) {
        const ch = Str.slice(pos, pos + 1)(text);
        if (
          ch === QUOTE ||
          ch === BACKSLASH ||
          ch === LINE_FEED ||
          ch === CARRIAGE_RETURN ||
          ch === LINE_SEPARATOR ||
          ch === PARAGRAPH_SEPARATOR
        )
          return;
        if (ch <= CONTROL_MAX) tokenError = "InvalidCharacter";
        pos++;
      }
    };

    const appendEscapeAfterBackslash = (chunks: Array<string>): void => {
      const escaped = CODE_UNIT_NUMBERS_WITHOUT_AN_OPTION_PER_LOOKUP[Str.slice(pos, pos + 1)(text)] ?? 0xffff;
      pos++;
      const simple = simpleEscape(escaped);
      if (O.isSome(simple)) {
        accumulation.append(chunks, simple.value);
        return;
      }
      if (escaped !== 0x75) {
        tokenError = "InvalidEscapeCharacter";
        return;
      }
      const code = scanHexDigits(4);
      if (O.isSome(code)) {
        accumulation.append(chunks, String.fromCharCode(code.value));
      } else {
        tokenError = "InvalidUnicode";
      }
    };

    const stringTokenEndsAtStopCharacter = (chunks: Array<string>): boolean => {
      if (pos >= len) {
        tokenError = "UnexpectedEndOfString";
        return true;
      }
      const ch = Str.slice(pos, pos + 1)(text);
      if (ch === QUOTE) {
        pos++;
        return true;
      }
      if (ch !== BACKSLASH) {
        tokenError = "UnexpectedEndOfString";
        return true;
      }
      pos++;
      if (pos >= len) {
        tokenError = "UnexpectedEndOfString";
        return true;
      }
      appendEscapeAfterBackslash(chunks);
      return false;
    };

    const scanString = (): string => {
      const chunks: Array<string> = [];
      pos++;
      let done = false;
      while (!done) {
        const start = pos;
        skipStringRun();
        accumulation.append(chunks, Str.substring(start, pos)(text));
        done = stringTokenEndsAtStopCharacter(chunks);
      }
      return A.join(chunks, "");
    };

    const scanDigits = (): void => {
      while (isDigit(charAt(pos))) {
        pos++;
      }
    };

    const scanOptionalFractionFalseWhenDotLacksDigit = (): boolean => {
      if (charAt(pos) !== 0x2e) return true;
      pos++;
      if (!isDigit(charAt(pos))) return false;
      scanDigits();
      return true;
    };

    const scanOptionalExponentFalseWhenLackingDigit = (): boolean => {
      const marker = charAt(pos);
      if (marker !== 0x45 && marker !== 0x65) return true;
      pos++;
      const sign = charAt(pos);
      if (sign === 0x2b || sign === 0x2d) pos++;
      if (!isDigit(charAt(pos))) return false;
      scanDigits();
      return true;
    };

    const scanNumber = (): string => {
      const start = pos;
      if (charAt(pos) === 0x2d) pos++;
      if (charAt(pos) === 0x30) {
        pos++;
      } else {
        scanDigits();
      }
      if (!(scanOptionalFractionFalseWhenDotLacksDigit() && scanOptionalExponentFalseWhenLackingDigit())) {
        tokenError = "UnexpectedEndOfNumber";
      }
      return Str.substring(start, pos)(text);
    };

    const scanLineComment = (): SyntaxKind => {
      pos += 2;
      while (
        pos < len &&
        !isLineBreak(CODE_UNIT_NUMBERS_WITHOUT_AN_OPTION_PER_LOOKUP[Str.slice(pos, pos + 1)(text)] ?? 0xffff)
      ) {
        pos++;
      }
      tokenValue = Str.substring(tokenOffset, pos)(text);
      return "LineComment";
    };

    const scanBlockComment = (): SyntaxKind => {
      pos += 2;
      let closed = false;
      while (pos < len - 1 && !closed) {
        if (text[pos] === ASTERISK && text[pos + 1] === SLASH) {
          pos += 2;
          closed = true;
        } else {
          pos++;
        }
      }
      if (!closed) {
        pos = len;
        tokenError = "UnexpectedEndOfComment";
      }
      tokenValue = Str.substring(tokenOffset, pos)(text);
      return "BlockComment";
    };

    const scanKeyword = (): SyntaxKind => {
      while (isLowerAlpha(charAt(pos))) {
        pos++;
      }
      tokenValue = Str.substring(tokenOffset, pos)(text);
      const kind = keywordKind(tokenValue);
      if (kind === "Unknown") {
        tokenError = "InvalidSymbol";
      }
      return kind;
    };

    const scanUnknown = (error: ScanError): SyntaxKind => {
      pos++;
      tokenValue = Str.substring(tokenOffset, pos)(text);
      tokenError = error;
      return "Unknown";
    };

    const scanPunctuation = (kind: SyntaxKind): SyntaxKind => {
      pos++;
      tokenValue = Str.substring(tokenOffset, pos)(text);
      return kind;
    };

    const scanWhitespace = (): SyntaxKind => {
      do {
        pos++;
      } while (isWhitespace(charAt(pos)));
      tokenValue = Str.substring(tokenOffset, pos)(text);
      return "Trivia";
    };

    const scanLineBreak = (ch: number): SyntaxKind => {
      pos++;
      if (ch === 0x0d && charAt(pos) === 0x0a) {
        pos++;
      }
      tokenValue = Str.substring(tokenOffset, pos)(text);
      return "LineBreak";
    };

    const scanSlash = (): SyntaxKind => {
      const next = charAt(pos + 1);
      if (next === 0x2f) return scanLineComment();
      if (next === 0x2a) return scanBlockComment();
      return scanUnknown("InvalidCharacter");
    };

    const scanValueStart = (ch: number): SyntaxKind => {
      if (ch === 0x22) {
        tokenValue = scanString();
        return "String";
      }
      if (ch === 0x2f) return scanSlash();
      if (isDigit(ch) || (ch === 0x2d && isDigit(charAt(pos + 1)))) {
        tokenValue = scanNumber();
        return "Number";
      }
      if (ch === 0x2d) return scanUnknown("InvalidSymbol");
      if (isLowerAlpha(ch)) return scanKeyword();
      return scanUnknown("InvalidCharacter");
    };

    const scanCore = (): SyntaxKind => {
      tokenValue = "";
      tokenError = "None";
      tokenOffset = pos;
      if (pos >= len) return "EOF";
      const ch = CODE_UNIT_NUMBERS_WITHOUT_AN_OPTION_PER_LOOKUP[Str.slice(pos, pos + 1)(text)] ?? 0xffff;
      if (isWhitespace(ch)) return scanWhitespace();
      if (isLineBreak(ch)) return scanLineBreak(ch);
      const punctuation = punctuationKind(ch);
      if (punctuation !== "Unknown") return scanPunctuation(punctuation);
      return scanValueStart(ch);
    };

    const scan = (): SyntaxKind => {
      token = scanCore();
      while (ignoreTrivia === true && isTriviaKind(token)) {
        token = scanCore();
      }
      return token;
    };

    return {
      scan,
      getToken: () => token,
      getTokenValue: () => tokenValue,
      getTokenOffset: () => tokenOffset,
      getTokenLength: () => pos - tokenOffset,
      getTokenError: () => tokenError,
    };
  }
);
