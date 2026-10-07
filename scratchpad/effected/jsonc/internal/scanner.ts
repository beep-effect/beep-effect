// JSONC scanner (lexer): converts a JSONC string into a stream of tokens.
//
// Private implementation. The scanner is internal: there is no public
// tokenizer surface. Reference: Microsoft's jsonc-parser scanner design (MIT).
//
// Line/character tracking is intentionally dropped here: the `Jsonc` facade
// derives `line`/`character` from a token `offset` against the source text
// when it materializes a `JsoncParseErrorDetail`, so the scanner only needs to
// track offsets.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/jsonc/internal/scanner");

/**
 * Token kinds produced by the scanner.
 *
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
 * import { SyntaxKind } from "@beep/scratchpad/effected/jsonc/internal/scanner"
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
]).annotate(
  $I.annote("SyntaxKind", {
    description: "Token kinds produced by the JSONC scanner.",
  })
);

/**
 * The union of scanner token kind literals.
 *
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
 * import { createScanner, ScanError } from "@beep/scratchpad/effected/jsonc/internal/scanner"
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
]).annotate(
  $I.annote("ScanError", {
    description: "Lexical error codes the JSONC scanner attaches to a token.",
  })
);

/**
 * The union of scanner error code literals.
 *
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
  /** Advance the cursor to the next token and return its {@link SyntaxKind}. */
  readonly scan: () => SyntaxKind;
  /** Return the current token's {@link SyntaxKind} without advancing. */
  readonly getToken: () => SyntaxKind;
  /** Return the decoded string value of the current token. */
  readonly getTokenValue: () => string;
  /** Return the zero-based character offset where the current token begins. */
  readonly getTokenOffset: () => number;
  /** Return the character length of the current token. */
  readonly getTokenLength: () => number;
  /** Return the {@link ScanError} for the current token, or `"None"`. */
  readonly getTokenError: () => ScanError;
}

const isWhitespace = (ch: number): boolean =>
  ch === 0x20 || ch === 0x09 || ch === 0x0b || ch === 0x0c || ch === 0xa0 || ch === 0xfeff;

const isLineBreak = (ch: number): boolean => ch === 0x0a || ch === 0x0d || ch === 0x2028 || ch === 0x2029;

const isDigit = (ch: number): boolean => ch >= 0x30 && ch <= 0x39;

const isLowerAlpha = (ch: number): boolean => ch >= 0x61 && ch <= 0x7a;

const isTriviaKind = S.is(SyntaxKind.pick(["Trivia", "LineBreak", "LineComment", "BlockComment"]));

/** The single-character escapes JSON defines, keyed by the escaped code unit. */
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

/** JSON keyword lookup; anything else lowercase-alpha is an invalid symbol. */
const keywordKind: (word: string) => SyntaxKind = Match.type<string>().pipe(
  Match.when("true", (): SyntaxKind => "True"),
  Match.when("false", (): SyntaxKind => "False"),
  Match.when("null", (): SyntaxKind => "Null"),
  Match.orElse((): SyntaxKind => "Unknown")
);

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
 * import { createScanner } from "@beep/scratchpad/effected/jsonc/internal/scanner"
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
  (text: string, ignoreTrivia: boolean = false): Scanner => {
    const len = text.length;
    let pos = 0;
    let tokenOffset = 0;
    let token: SyntaxKind = "Unknown";
    let tokenValue = "";
    let tokenError: ScanError = "None";

    const charAt = (index: number): number => (index < len ? text.charCodeAt(index) : 0);

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

    const scanString = (): string => {
      let chunks = A.empty<string>();
      pos++; // skip opening quote
      let start = pos;
      const finish = (end: number): string => A.join(A.append(chunks, text.substring(start, end)), "");
      while (pos < len) {
        const ch = text.charCodeAt(pos);
        if (ch === 0x22) {
          const value = finish(pos);
          pos++;
          return value;
        }
        if (ch === 0x5c) {
          chunks = A.append(chunks, text.substring(start, pos));
          pos++;
          if (pos >= len) {
            tokenError = "UnexpectedEndOfString";
            start = pos;
            return finish(pos);
          }
          const escaped = text.charCodeAt(pos);
          pos++;
          const simple = simpleEscape(escaped);
          if (O.isSome(simple)) {
            chunks = A.append(chunks, simple.value);
          } else if (escaped === 0x75) {
            const code = scanHexDigits(4);
            if (O.isSome(code)) {
              chunks = A.append(chunks, String.fromCharCode(code.value));
            } else {
              tokenError = "InvalidUnicode";
            }
          } else {
            tokenError = "InvalidEscapeCharacter";
          }
          start = pos;
        } else if (isLineBreak(ch)) {
          tokenError = "UnexpectedEndOfString";
          return finish(pos);
        } else {
          if (ch <= 0x1f) {
            // Unescaped C0 control characters are invalid inside strings (JSON
            // grammar); keep scanning so the token stays intact for recovery.
            tokenError = "InvalidCharacter";
          }
          pos++;
        }
      }
      tokenError = "UnexpectedEndOfString";
      return finish(pos);
    };

    const scanDigits = (): void => {
      while (isDigit(charAt(pos))) {
        pos++;
      }
    };

    const scanNumber = (): string => {
      const start = pos;
      if (charAt(pos) === 0x2d) {
        pos++;
      }
      if (charAt(pos) === 0x30) {
        pos++;
      } else {
        scanDigits();
      }
      if (charAt(pos) === 0x2e) {
        pos++;
        if (!isDigit(charAt(pos))) {
          tokenError = "UnexpectedEndOfNumber";
          return text.substring(start, pos);
        }
        scanDigits();
      }
      if (charAt(pos) === 0x45 || charAt(pos) === 0x65) {
        pos++;
        if (charAt(pos) === 0x2b || charAt(pos) === 0x2d) {
          pos++;
        }
        if (!isDigit(charAt(pos))) {
          tokenError = "UnexpectedEndOfNumber";
          return text.substring(start, pos);
        }
        scanDigits();
      }
      return text.substring(start, pos);
    };

    const scanLineComment = (): SyntaxKind => {
      pos += 2;
      while (pos < len && !isLineBreak(text.charCodeAt(pos))) {
        pos++;
      }
      tokenValue = text.substring(tokenOffset, pos);
      return "LineComment";
    };

    const scanBlockComment = (): SyntaxKind => {
      pos += 2;
      let closed = false;
      while (pos < len - 1 && !closed) {
        if (text.charCodeAt(pos) === 0x2a && text.charCodeAt(pos + 1) === 0x2f) {
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
      tokenValue = text.substring(tokenOffset, pos);
      return "BlockComment";
    };

    const scanKeyword = (): SyntaxKind => {
      while (isLowerAlpha(charAt(pos))) {
        pos++;
      }
      tokenValue = text.substring(tokenOffset, pos);
      const kind = keywordKind(tokenValue);
      if (kind === "Unknown") {
        tokenError = "InvalidSymbol";
      }
      return kind;
    };

    const scanUnknown = (error: ScanError): SyntaxKind => {
      pos++;
      tokenValue = text.substring(tokenOffset, pos);
      tokenError = error;
      return "Unknown";
    };

    const scanPunctuation = (value: string, kind: SyntaxKind): SyntaxKind => {
      pos++;
      tokenValue = value;
      return kind;
    };

    // Single-token scan. Trivia skipping happens in the iterative wrapper below:
    // recursing here per skipped token overflows the stack on comment-heavy or
    // blank-line-heavy documents.
    const scanCore = (): SyntaxKind => {
      tokenValue = "";
      tokenError = "None";
      tokenOffset = pos;

      if (pos >= len) {
        return "EOF";
      }

      const ch = text.charCodeAt(pos);

      if (isWhitespace(ch)) {
        do {
          pos++;
        } while (isWhitespace(charAt(pos)));
        tokenValue = text.substring(tokenOffset, pos);
        return "Trivia";
      }
      if (isLineBreak(ch)) {
        pos++;
        if (ch === 0x0d && charAt(pos) === 0x0a) {
          pos++;
        }
        tokenValue = text.substring(tokenOffset, pos);
        return "LineBreak";
      }
      if (ch === 0x7b) return scanPunctuation("{", "OpenBrace");
      if (ch === 0x7d) return scanPunctuation("}", "CloseBrace");
      if (ch === 0x5b) return scanPunctuation("[", "OpenBracket");
      if (ch === 0x5d) return scanPunctuation("]", "CloseBracket");
      if (ch === 0x3a) return scanPunctuation(":", "Colon");
      if (ch === 0x2c) return scanPunctuation(",", "Comma");
      if (ch === 0x22) {
        tokenValue = scanString();
        return "String";
      }
      if (ch === 0x2f) {
        const next = charAt(pos + 1);
        if (next === 0x2f) return scanLineComment();
        if (next === 0x2a) return scanBlockComment();
        return scanUnknown("InvalidCharacter");
      }
      if (ch === 0x2d) {
        if (isDigit(charAt(pos + 1))) {
          tokenValue = scanNumber();
          return "Number";
        }
        return scanUnknown("InvalidSymbol");
      }
      if (isDigit(ch)) {
        tokenValue = scanNumber();
        return "Number";
      }
      if (isLowerAlpha(ch)) {
        return scanKeyword();
      }
      return scanUnknown("InvalidCharacter");
    };

    const scan = (): SyntaxKind => {
      token = scanCore();
      while (ignoreTrivia && isTriviaKind(token)) {
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
