import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../TomlDateTime.ts";
import { raise } from "./diagnostics.ts";

/**
 * The result of a scan: the decoded value and the position after the token.
 *
 * @category models
 * @since 0.0.0
 */
export interface ScanResult<T> {
  readonly end: number;
  readonly value: T;
}

/**
 * A classified TOML scalar represented by a primitive or a TOML datetime value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScalarValue =
  | number
  | bigint
  | boolean
  | TomlOffsetDateTime
  | TomlLocalDateTime
  | TomlLocalDate
  | TomlLocalTime;

const NUL = "\u0000";
const TAB = "\t";
const LF = "\n";
const CR = "\r";
const SPACE = " ";
const QUOTE = '"';
const HASH = "#";
const APOSTROPHE = "'";
const COMMA = ",";
const HYPHEN = "-";
const BACKSLASH = "\\";
const RIGHT_BRACKET = "]";
const RIGHT_BRACE = "}";
const LOWER_U = "u";
const UPPER_U = "U";
const LOWER_X = "x";

const codeLabel = (code: number): string => `U+${pipe(code.toString(16), Str.toUpperCase, Str.padStart(4, "0"))}`;

const isControlChar = (code: string | undefined): boolean =>
  code !== undefined && (code <= "\u0008" || (code >= "\n" && code <= "\u001f") || code === "\u007f");

const raiseControlChar = (source: string, i: number, where: string): never =>
  raise(
    "ControlCharacterInString",
    `control character ${codeLabel(pipe(source, Str.charCodeAt(i), O.getOrElse(constant(Number.NaN))))} in ${where}`,
    i,
    1
  );

const stepSingleLineChar = (source: string, i: number, pos: number, form: "basic" | "literal"): number => {
  const code = source[i];
  if (code === LF || (code === CR && source[i + 1] === LF)) {
    return raise("UnterminatedString", `${form} string not closed before end of line`, pos, i - pos);
  }
  if (code === CR) {
    return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
  }
  if (isControlChar(code)) {
    return raiseControlChar(source, i, `${form} string`);
  }
  return i + 1;
};

const pastNewline = (source: string, i: number): number => {
  if (source[i] === LF) {
    return i + 1;
  }
  if (source[i + 1] === LF) {
    return i + 2;
  }
  return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
};

const stepMultilineChar = (source: string, i: number, form: "basic" | "literal"): number => {
  const code = source[i];
  if (code === LF || code === CR) {
    return pastNewline(source, i);
  }
  if (isControlChar(code)) {
    return raiseControlChar(source, i, `multiline ${form} string`);
  }
  return i + 1;
};

const scanUntil = (
  source: string,
  start: number,
  isEnd: (code: string | undefined) => boolean,
  step: (i: number) => number
): number => {
  let i = start;
  while (i < source.length && !isEnd(source[i])) {
    i = step(i);
  }
  return i;
};

const delimiterRunEnd = (source: string, i: number, delimiter: string): number => {
  let runEnd = i;
  while (runEnd < source.length && source[runEnd] === delimiter) {
    runEnd += 1;
  }
  return runEnd;
};

const isDigit = (code: string | undefined): boolean => code !== undefined && code >= "0" && code <= "9";

const BARE_KEY_CHARACTER = /^[A-Za-z0-9_-]$/;

/**
 * Whether the one-character string `char` is a bare-key character: `[A-Za-z0-9_-]`.
 *
 * **Example** (Recognize bare-key characters)
 *
 * ```ts
 * import { isBareKeyChar } from "@beep/toml/internal/scanner"
 *
 * console.log(isBareKeyChar("a")) // true
 * console.log(isBareKeyChar(" ")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBareKeyChar = (char: string): boolean => BARE_KEY_CHARACTER.test(char);

/**
 * The number of code units to skip for a single leading U+FEFF BOM.
 *
 * **Example** (Skip a leading byte order mark)
 *
 * ```ts
 * import { skipBom } from "@beep/toml/internal/scanner"
 *
 * console.log(skipBom("\uFEFFtitle = 1")) // 1
 * console.log(skipBom("title = 1")) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const skipBom = (source: string): number =>
  pipe(source, Str.charCodeAt(0), O.getOrElse(constant(Number.NaN))) === 0xfeff ? 1 : 0;

/**
 * Reject a document carrying U+FFFD REPLACEMENT CHARACTER.
 *
 * **Details**
 *
 * TOML requires a valid UTF-8 document, but this engine receives an already-decoded JS
 * string — after Node's lossy utf8 decode, U+FFFD is the only surviving
 * evidence of a malformed byte sequence. The grammar technically admits
 * U+FFFD inside strings and comments, so this trades away a pathological
 * legal character to honor the encoding rule the toml-test corpus pins
 * (invalid/encoding/bad-utf8-in-string.toml, bad-utf8-in-comment.toml,
 * bad-codepoint.toml and friends).
 *
 * **Example** (Validate decoded Unicode input)
 *
 * ```ts
 * import { assertValidUnicode } from "@beep/toml/internal/scanner"
 *
 * assertValidUnicode("title = 'café'")
 * console.log("valid Unicode") // valid Unicode
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const assertValidUnicode = (source: string): void => {
  const index = Str.indexOf("�")(source);
  if (O.isSome(index)) {
    raise(
      "InvalidUtf8",
      "invalid UTF-8: U+FFFD REPLACEMENT CHARACTER marks a malformed byte sequence in the decoded input",
      index.value,
      1
    );
  }
};

/**
 * Skip spaces and tabs; returns the position of the first other character.
 *
 * **Example** (Find the first non-whitespace character)
 *
 * ```ts
 * import { scanWhitespace } from "@beep/toml/internal/scanner"
 *
 * console.log(scanWhitespace(" \tkey", 0)) // 2
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanWhitespace: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  let i = pos;
  while (i < source.length) {
    const code = source[i];
    if (code !== SPACE && code !== TAB) {
      break;
    }
    i += 1;
  }
  return i;
});

/**
 * Consume one `\n` or `\r\n` newline.
 *
 * **Gotchas**
 *
 * A lone `\r` throws BareCarriageReturn;
 * no newline at `pos` returns `pos` unchanged.
 *
 * **Example** (Consume a Windows newline)
 *
 * ```ts
 * import { scanNewline } from "@beep/toml/internal/scanner"
 *
 * console.log(scanNewline("\r\nkey", 0)) // 2
 * console.log(scanNewline("key", 0)) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanNewline: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  const code = source[pos];
  if (code === LF) {
    return pos + 1;
  }
  if (code === CR) {
    if (source[pos + 1] === LF) {
      return pos + 2;
    }
    return raise("BareCarriageReturn", "carriage return not followed by a line feed", pos, 1);
  }
  return pos;
});

/**
 * Scan a comment starting at `#` through end of line or EOF. The value
 * excludes the `#`; control characters other than tab are rejected.
 *
 * **Example** (Read comment text without its marker)
 *
 * ```ts
 * import { scanComment } from "@beep/toml/internal/scanner"
 *
 * const result = scanComment("# note\nkey", 0)
 * console.log(result.value) //  note
 * console.log(result.end) // 6
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanComment: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  const end = scanUntil(
    source,
    pos + 1,
    (code) => code === LF || code === CR,
    (i) => {
      const code = source[i];
      return isControlChar(code)
        ? raise(
            "ControlCharacterInComment",
            `control character ${codeLabel(pipe(source, Str.charCodeAt(i), O.getOrElse(constant(Number.NaN))))} in comment`,
            i,
            1
          )
        : i + 1;
    }
  );
  return { value: Str.slice(pos + 1, end)(source), end };
});

/**
 * Scan a run of bare-key characters; the value may be empty.
 *
 * **Example** (Read a bare key before its separator)
 *
 * ```ts
 * import { scanBareKey } from "@beep/toml/internal/scanner"
 *
 * const result = scanBareKey("server_name = 1", 0)
 * console.log(result.value) // server_name
 * console.log(result.end) // 11
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanBareKey: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  let i = pos;
  while (i < source.length && isBareKeyChar(Str.slice(i, i + 1)(source))) {
    i += 1;
  }
  return { value: Str.slice(pos, i)(source), end: i };
});

const simpleEscape = Match.type<string | undefined>().pipe(
  Match.when("b", () => "\b"),
  Match.when("t", () => "\t"),
  Match.when("n", () => "\n"),
  Match.when("f", () => "\f"),
  Match.when("r", () => "\r"),
  Match.when("e", () => "\u001b"),
  Match.when(QUOTE, () => '"'),
  Match.when(BACKSLASH, () => "\\"),
  Match.orElse(() => undefined)
);

const HEX_DIGITS = /^[0-9A-Fa-f]+$/;

const ESCAPE_LETTERS = { 2: "x", 4: "u", 8: "U" } as const;

const decodeUnicodeEscape: {
  (source: string, backslash: number, width: 2 | 4 | 8): { readonly codePoint: number; readonly end: number };
  (backslash: number, width: 2 | 4 | 8): (source: string) => { readonly codePoint: number; readonly end: number };
} = dual(
  3,
  (source: string, backslash: number, width: 2 | 4 | 8): { readonly codePoint: number; readonly end: number } => {
    const start = backslash + 2;
    const hex = Str.slice(start, start + width)(source);
    if (hex.length < width || !HEX_DIGITS.test(hex)) {
      return raise(
        "InvalidUnicodeEscape",
        `\\${ESCAPE_LETTERS[width]} escape requires ${width} hexadecimal digits`,
        backslash,
        width + 2
      );
    }
    const codePoint = Number.parseInt(hex, 16);
    if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
      return raise(
        "InvalidUnicodeEscape",
        `${codeLabel(codePoint)} is not a Unicode scalar value`,
        backslash,
        width + 2
      );
    }
    return { codePoint, end: start + width };
  }
);

const unicodeEscapeWidth = (code: string | undefined): 2 | 4 | 8 | undefined =>
  code === LOWER_X ? 2 : code === LOWER_U ? 4 : code === UPPER_U ? 8 : undefined;

const decodeEscape = (source: string, backslash: number): ScanResult<string> | undefined => {
  const next = source[backslash + 1];
  const mapped = simpleEscape(next);
  if (mapped !== undefined) {
    return { value: mapped, end: backslash + 2 };
  }
  const width = unicodeEscapeWidth(next);
  if (width === undefined) {
    return undefined;
  }
  const decoded = decodeUnicodeEscape(source, backslash, width);
  return { value: String.fromCodePoint(decoded.codePoint), end: decoded.end };
};

const requireBasicEscape = (source: string, backslash: number): ScanResult<string> =>
  decodeEscape(source, backslash) ??
  raise("InvalidEscape", `invalid escape sequence \\${source[backslash + 1]}`, backslash, 2);

/**
 * Scan a single-line basic string starting at the opening `"`.
 *
 * **Example** (Decode a basic string escape)
 *
 * ```ts
 * import { scanBasicString } from "@beep/toml/internal/scanner"
 *
 * const result = scanBasicString('"hello\\tworld"', 0)
 * console.log(JSON.stringify(result.value)) // "hello\tworld"
 * console.log(result.end) // 14
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanBasicString: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  let out = "";
  let chunkStart = pos + 1;
  let i = pos + 1;
  while (i < source.length) {
    const code = source[i];
    if (code === QUOTE) {
      return { value: out + Str.slice(chunkStart, i)(source), end: i + 1 };
    }
    if (code !== BACKSLASH) {
      i = stepSingleLineChar(source, i, pos, "basic");
      continue;
    }
    if (i + 1 >= source.length) {
      break;
    }
    const escape = requireBasicEscape(source, i);
    out += Str.slice(chunkStart, i)(source) + escape.value;
    i = escape.end;
    chunkStart = i;
  }
  return raise("UnterminatedString", "unterminated basic string", pos, source.length - pos);
});

/**
 * Scan a single-line literal string starting at the opening `'`.
 *
 * **Example** (Preserve literal string backslashes)
 *
 * ```ts
 * import { scanLiteralString } from "@beep/toml/internal/scanner"
 *
 * const result = scanLiteralString("'C:\\tmp'", 0)
 * console.log(result.value) // C:\tmp
 * console.log(result.end) // 8
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanLiteralString: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  const close = scanUntil(
    source,
    pos + 1,
    (code) => code === APOSTROPHE,
    (i) => stepSingleLineChar(source, i, pos, "literal")
  );
  if (close < source.length) {
    return { value: Str.slice(pos + 1, close)(source), end: close + 1 };
  }
  return raise("UnterminatedString", "unterminated literal string", pos, source.length - pos);
});

const skipLeadingNewline: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  if (source[pos] === LF) {
    return pos + 1;
  }
  if (source[pos] === CR && source[pos + 1] === LF) {
    return pos + 2;
  }
  return pos;
});

const skipLineEndingTrim: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  let i = pos;
  while (i < source.length) {
    const code = source[i];
    if (code === SPACE || code === TAB) {
      i += 1;
      continue;
    }
    if (code === LF || code === CR) {
      i = pastNewline(source, i);
      continue;
    }
    break;
  }
  return i;
});

const raiseUnterminatedMultilineBasic = (source: string, pos: number): never =>
  raise("UnterminatedString", "unterminated multiline basic string", pos, source.length - pos);

const closeMultilineBasic = (source: string, prefix: string, runStart: number): ScanResult<string> => {
  const runEnd = delimiterRunEnd(source, runStart, QUOTE);
  const contentQuotes = Math.min(runEnd - runStart - 3, 2);
  return { value: prefix + Str.slice(runStart, runStart + contentQuotes)(source), end: runStart + contentQuotes + 3 };
};

const lineEndingBackslash = (source: string, backslash: number, pos: number): ScanResult<string> => {
  const probe = scanWhitespace(source, backslash + 1);
  if (probe >= source.length) {
    return raiseUnterminatedMultilineBasic(source, pos);
  }
  const probeCode = source[probe];
  if (probeCode === LF || (probeCode === CR && source[probe + 1] === LF)) {
    return { value: "", end: skipLineEndingTrim(source, probe) };
  }
  return raise("InvalidEscape", `invalid escape sequence \\${source[backslash + 1]}`, backslash, probe - backslash + 1);
};

/**
 * Scan a multiline basic string starting at the opening `"""`.
 *
 * **Example** (Trim the opening multiline newline)
 *
 * ```ts
 * import { scanMultilineBasicString } from "@beep/toml/internal/scanner"
 *
 * const result = scanMultilineBasicString('"""\nhello"""', 0)
 * console.log(result.value) // hello
 * console.log(result.end) // 12
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanMultilineBasicString: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  let i = skipLeadingNewline(source, pos + 3);
  let out = "";
  let chunkStart = i;
  while (i < source.length) {
    const code = source[i];
    if (code === QUOTE && delimiterRunEnd(source, i, QUOTE) - i >= 3) {
      return closeMultilineBasic(source, out + Str.slice(chunkStart, i)(source), i);
    }
    if (code !== BACKSLASH) {
      i = stepMultilineChar(source, i, "basic");
      continue;
    }
    const escape = decodeEscape(source, i) ?? lineEndingBackslash(source, i, pos);
    out += Str.slice(chunkStart, i)(source) + escape.value;
    i = escape.end;
    chunkStart = i;
  }
  return raiseUnterminatedMultilineBasic(source, pos);
});

/**
 * Scan a multiline literal string starting at the opening `'''`.
 *
 * **Example** (Read a multiline literal string)
 *
 * ```ts
 * import { scanMultilineLiteralString } from "@beep/toml/internal/scanner"
 *
 * const result = scanMultilineLiteralString("'''\nhello'''", 0)
 * console.log(result.value) // hello
 * console.log(result.end) // 12
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanMultilineLiteralString: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  const contentStart = skipLeadingNewline(source, pos + 3);
  let i = contentStart;
  while (i < source.length) {
    const code = source[i];
    if (code === APOSTROPHE) {
      const runEnd = delimiterRunEnd(source, i, APOSTROPHE);
      const run = runEnd - i;
      if (run < 3) {
        i = runEnd;
        continue;
      }
      const contentQuotes = Math.min(run - 3, 2);
      return { value: Str.slice(contentStart, i + contentQuotes)(source), end: i + contentQuotes + 3 };
    }
    i = stepMultilineChar(source, i, "literal");
  }
  return raise("UnterminatedString", "unterminated multiline literal string", pos, source.length - pos);
});

const isTokenSpace = (code: string | undefined): boolean =>
  code === SPACE || code === TAB || code === LF || code === CR;

const isTokenTerminator = (code: string | undefined): boolean =>
  isTokenSpace(code) || code === COMMA || code === RIGHT_BRACKET || code === RIGHT_BRACE || code === HASH;

const scanTokenSpan: {
  (source: string, pos: number): number;
  (pos: number): (source: string) => number;
} = dual(2, (source: string, pos: number): number => {
  let i = pos;
  while (i < source.length) {
    const code = source[i];
    if (code === NUL) {
      return raise("InvalidCharacter", "NUL character in document", i, 1);
    }
    if (isTokenTerminator(code)) {
      break;
    }
    i += 1;
  }
  return i;
});

const OFFSET_DATE_TIME =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?([Zz]|[+-][0-9]{2}:[0-9]{2})$/;
const LOCAL_DATE_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?$/;
const LOCAL_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const LOCAL_TIME = /^([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?$/;

/**
 * Scan a non-string scalar value token.
 *
 * **Details**
 *
 * Stops at whitespace, newlines, `,`,
 * `]`, `}` and `#` — with one extension: a token that scanned as a full
 * date followed by a single space and a digit continues through the time
 * part, so `1979-05-27 07:32:00Z` is one token.
 *
 * **Example** (Keep a space-separated datetime together)
 *
 * ```ts
 * import { scanValueToken } from "@beep/toml/internal/scanner"
 *
 * const result = scanValueToken("1979-05-27 07:32:00Z # note", 0)
 * console.log(result.value) // 1979-05-27 07:32:00Z
 * console.log(result.end) // 20
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanValueToken: {
  (source: string, pos: number): ScanResult<string>;
  (pos: number): (source: string) => ScanResult<string>;
} = dual(2, (source: string, pos: number): ScanResult<string> => {
  let end = scanTokenSpan(source, pos);
  if (LOCAL_DATE.test(Str.slice(pos, end)(source)) && source[end] === SPACE && isDigit(source[end + 1])) {
    end = scanTokenSpan(source, end + 1);
  }
  return { value: Str.slice(pos, end)(source), end };
});

const INTEGER_DEC = /^[+-]?(?:0|[1-9](?:_?[0-9])*)$/;
const INTEGER_HEX = /^0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*$/;
const INTEGER_OCT = /^0o[0-7](?:_?[0-7])*$/;
const INTEGER_BIN = /^0b[01](?:_?[01])*$/;
const FLOAT =
  /^[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*(?:[eE][+-]?[0-9](?:_?[0-9])*)?|[eE][+-]?[0-9](?:_?[0-9])*)$/;
const FLOAT_SPECIAL = /^[+-]?(?:inf|nan)$/;

const NUMERIC_LOOKING = /^[+-]?[0-9.]/;

const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);
const MAX_SAFE_BIG = BigInt(2) ** BigInt(53) - BigInt(1);

const narrowInteger: {
  (big: bigint, token: string, offset: number): number | bigint;
  (token: string, offset: number): (big: bigint) => number | bigint;
} = dual(3, (big: bigint, token: string, offset: number): number | bigint => {
  if (big < INT64_MIN || big > INT64_MAX) {
    return raise("IntegerOutOfRange", `${token} does not fit in a signed 64-bit integer`, offset, token.length);
  }
  return big >= -MAX_SAFE_BIG && big <= MAX_SAFE_BIG ? Number(big) : big;
});

const decodeDecimalInteger: {
  (token: string, offset: number): number | bigint;
  (offset: number): (token: string) => number | bigint;
} = dual(2, (token: string, offset: number): number | bigint => {
  let digits = Str.replace(/_/g, "")(token);
  if (Str.startsWith("+")(digits)) {
    digits = Str.slice(1)(digits);
  }
  return narrowInteger(BigInt(digits), token, offset);
});

const decodePrefixedInteger: {
  (token: string, offset: number): number | bigint;
  (offset: number): (token: string) => number | bigint;
} = dual(2, (token: string, offset: number): number | bigint =>
  narrowInteger(BigInt(Str.replace(/_/g, "")(token)), token, offset)
);

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInNonFebruaryMonthAlternatingWithParityFlipAtAugust = (month: number): number =>
  30 + ((month + Math.floor(month / 8)) % 2);

const validateDate: {
  (year: number, month: number, day: number, offset: number, length: number): void;
  (month: number, day: number, offset: number, length: number): (year: number) => void;
} = dual(5, (year: number, month: number, day: number, offset: number, length: number): void => {
  if (month < 1 || month > 12) {
    raise("InvalidDateTime", `month ${month} is out of range 1-12`, offset, length);
  }
  const max =
    month === 2 ? (isLeapYear(year) ? 29 : 28) : daysInNonFebruaryMonthAlternatingWithParityFlipAtAugust(month);
  if (day < 1 || day > max) {
    raise("InvalidDateTime", `day ${day} does not exist in month ${month} of ${year}`, offset, length);
  }
});

const validateTime: {
  (hour: number, minute: number, second: number, offset: number, length: number): void;
  (minute: number, second: number, offset: number, length: number): (hour: number) => void;
} = dual(5, (hour: number, minute: number, second: number, offset: number, length: number): void => {
  if (hour > 23) {
    raise("InvalidDateTime", `hour ${hour} is out of range 0-23`, offset, length);
  }
  if (minute > 59) {
    raise("InvalidDateTime", `minute ${minute} is out of range 0-59`, offset, length);
  }
  if (second > 60) {
    raise("InvalidDateTime", `second ${second} is out of range 0-60`, offset, length);
  }
});

const decodeNanosecond = (fraction: string | undefined): number =>
  fraction === undefined ? 0 : Number(Str.slice(0, 9)(`${fraction}000000000`));

const localDateTimeFields = (
  match: RegExpExecArray,
  offset: number,
  length: number
): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly nanosecond: number;
} => {
  const [, y = "", mo = "", d = "", h = "", mi = "", s, fraction] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s === undefined ? 0 : Number(s);
  validateDate(year, month, day, offset, length);
  validateTime(hour, minute, second, offset, length);
  return { year, month, day, hour, minute, second, nanosecond: decodeNanosecond(fraction) };
};

const decodeOffsetMinutes: {
  (text: string, offset: number, length: number): number;
  (offset: number, length: number): (text: string) => number;
} = dual(3, (text: string, offset: number, length: number): number => {
  if (text === "Z" || text === "z") {
    return 0;
  }
  const hh = Number(Str.slice(1, 3)(text));
  const mm = Number(Str.slice(4, 6)(text));
  if (hh > 23) {
    raise("InvalidDateTime", `offset hour ${hh} is out of range 0-23`, offset, length);
  }
  if (mm > 59) {
    raise("InvalidDateTime", `offset minute ${mm} is out of range 0-59`, offset, length);
  }
  const total = hh * 60 + mm;
  if (total === 0) {
    return 0;
  }
  return text[0] === HYPHEN ? -total : total;
});

const decodeOffsetDateTime = (match: RegExpExecArray, offset: number, length: number): TomlOffsetDateTime => {
  const fields = localDateTimeFields(match, offset, length);
  const offsetMinutes = decodeOffsetMinutes(match[8] ?? "", offset, length);
  return TomlOffsetDateTime.make({ ...fields, offsetMinutes });
};

const decodeLocalDate = (match: RegExpExecArray, offset: number, length: number): TomlLocalDate => {
  const [, y = "", mo = "", d = ""] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  validateDate(year, month, day, offset, length);
  return TomlLocalDate.make({ year, month, day });
};

const decodeLocalTime = (match: RegExpExecArray, offset: number, length: number): TomlLocalTime => {
  const [, h = "", mi = "", s, fraction] = match;
  const hour = Number(h);
  const minute = Number(mi);
  const second = s === undefined ? 0 : Number(s);
  validateTime(hour, minute, second, offset, length);
  return TomlLocalTime.make({ hour, minute, second, nanosecond: decodeNanosecond(fraction) });
};

const classifyDateTime = (token: string, offset: number, length: number): ScalarValue | undefined => {
  const offsetDateTime = OFFSET_DATE_TIME.exec(token);
  if (offsetDateTime !== null) {
    return decodeOffsetDateTime(offsetDateTime, offset, length);
  }
  const localDateTime = LOCAL_DATE_TIME.exec(token);
  if (localDateTime !== null) {
    return TomlLocalDateTime.make(localDateTimeFields(localDateTime, offset, length));
  }
  const localDate = LOCAL_DATE.exec(token);
  if (localDate !== null) {
    return decodeLocalDate(localDate, offset, length);
  }
  const localTime = LOCAL_TIME.exec(token);
  return localTime === null ? undefined : decodeLocalTime(localTime, offset, length);
};

const decodeSpecialFloat = (token: string): number => {
  if (Str.endsWith("nan")(token)) {
    return Number.NaN;
  }
  return token[0] === HYPHEN ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
};

const classifyNumber = (token: string, offset: number, length: number): number | bigint => {
  if (INTEGER_DEC.test(token)) {
    return decodeDecimalInteger(token, offset);
  }
  if (INTEGER_HEX.test(token) || INTEGER_OCT.test(token) || INTEGER_BIN.test(token)) {
    return decodePrefixedInteger(token, offset);
  }
  if (FLOAT.test(token)) {
    return Number(Str.replace(/_/g, "")(token));
  }
  if (FLOAT_SPECIAL.test(token)) {
    return decodeSpecialFloat(token);
  }
  if (NUMERIC_LOOKING.test(token)) {
    return raise("InvalidNumber", `${token} is not a valid TOML number or date-time`, offset, length);
  }
  return raise("InvalidValue", `${token} is not a valid TOML value`, offset, length);
};

/**
 * Classify a scanned value token: booleans, the four datetime
 * shapes (validated against the Gregorian calendar and clock ranges before
 * construction), integers across four radixes with int64 range checking and
 * number/bigint narrowing, and floats including the special spellings.
 *
 * **Example** (Classify booleans and integer widths)
 *
 * ```ts
 * import { classifyValueToken } from "@beep/toml/internal/scanner"
 *
 * console.log(classifyValueToken("true", 0)) // true
 * console.log(classifyValueToken("0x2a", 0)) // 42
 * console.log(typeof classifyValueToken("9223372036854775807", 0)) // bigint
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const classifyValueToken: {
  (token: string, offset: number): ScalarValue;
  (offset: number): (token: string) => ScalarValue;
} = dual(2, (token: string, offset: number): ScalarValue => {
  if (token === "true") {
    return true;
  }
  if (token === "false") {
    return false;
  }
  const length = Math.max(token.length, 1);
  return classifyDateTime(token, offset, length) ?? classifyNumber(token, offset, length);
});
