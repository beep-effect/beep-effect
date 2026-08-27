/**
 * Character-level scan functions over a TOML source string, plus value-token
 * classification.
 *
 * **Details**
 *
 * Every scan function is pure and stateless — `(source, pos)` in,
 * {@link ScanResult} out — and every malformed input throws
 * {@link RawTomlError} with the offset of the offending character. Nothing
 * here recurses. The classification regexes are the grammar reference's G4/G5
 * literals, copied verbatim. Datetime range validation happens **before**
 * constructing the {@link TomlOffsetDateTime} classes so the diagnostic carries the
 * token's offset instead of a schema check message.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../TomlDateTime.ts";
import type { TomlErrorCodeRaw } from "./diagnostics.ts";
import { RawTomlError } from "./diagnostics.ts";

/**
 * The result of a scan: the decoded value and the position after the token.
 *
 * @see {@link scanBareKey} for a typical producer of this shape.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface ScanResult<T> {
	readonly value: T;
	readonly end: number;
}

/**
 * A classified TOML scalar: string, number, bigint, boolean, or one of the
 * four date-time classes.
 *
 * @see {@link classifyValueToken} for the function that produces this union.
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type ScalarValue =
	| string
	| number
	| bigint
	| boolean
	| TomlOffsetDateTime
	| TomlLocalDateTime
	| TomlLocalDate
	| TomlLocalTime;

const NUL = 0x00;
const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;
const QUOTE = 0x22;
const HASH = 0x23;
const APOSTROPHE = 0x27;
const COMMA = 0x2c;
const HYPHEN = 0x2d;
const BACKSLASH = 0x5c;
const RIGHT_BRACKET = 0x5d;
const RIGHT_BRACE = 0x7d;
const LOWER_U = 0x75;
const UPPER_U = 0x55;
const LOWER_X = 0x78;
const BOM = 0xfeff;

const raise = (code: TomlErrorCodeRaw, message: string, offset: number, length: number): never => {
	throw new RawTomlError({ code, message, offset, length });
};

/** `U+XXXX` display form of a char code. */
const codeLabel = (code: number): string => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

/** TOML control characters (tab excluded): U+0000-U+0008, U+000A-U+001F, U+007F. */
const isControlChar = (code: number): boolean => code <= 0x08 || (code >= 0x0a && code <= 0x1f) || code === 0x7f;

const isDigit = (code: number): boolean => code >= 0x30 && code <= 0x39;

/**
 * Whether `code` is a bare-key character: `[A-Za-z0-9_-]`.
 *
 * **Example** (Test a letter and a space)
 *
 * ```ts
 * import { isBareKeyChar } from "../../../toml/internal/scanner.ts"
 *
 * console.log(isBareKeyChar("a".charCodeAt(0))) // true
 * console.log(isBareKeyChar(" ".charCodeAt(0))) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isBareKeyChar = (code: number): boolean =>
	(code >= 0x61 && code <= 0x7a) || (code >= 0x41 && code <= 0x5a) || isDigit(code) || code === 0x5f || code === HYPHEN;

/**
 * The number of code units to skip for a single leading U+FEFF BOM.
 *
 * **Example** (Skip a leading BOM)
 *
 * ```ts
 * import { skipBom } from "../../../toml/internal/scanner.ts"
 *
 * console.log(skipBom("\uFEFFhi")) // 1
 * console.log(skipBom("hi")) // 0
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const skipBom = (source: string): number => (source.charCodeAt(0) === BOM ? 1 : 0);

/**
 * Reject a document carrying U+FFFD REPLACEMENT CHARACTER. TOML requires
 * a valid UTF-8 document, but this engine receives an already-decoded JS
 * string — after Node's lossy utf8 decode, U+FFFD is the only surviving
 * evidence of a malformed byte sequence. The grammar technically admits
 * U+FFFD inside strings and comments, so this trades away a pathological
 * legal character to honor the encoding rule the toml-test corpus pins
 * (invalid/encoding/bad-utf8-in-string.toml, bad-utf8-in-comment.toml,
 * bad-codepoint.toml and friends).
 *
 * **Gotchas**
 *
 * A document whose only "illegal" character is a U+FFFD that would be legal
 * TOML still fails `InvalidUtf8`.
 *
 * **Example** (Reject a replacement character)
 *
 * ```ts
 * import { isRawTomlError } from "../../../toml/internal/diagnostics.ts"
 * import { assertValidUnicode } from "../../../toml/internal/scanner.ts"
 *
 * assertValidUnicode("ok")
 * try {
 *   assertValidUnicode("bad \uFFFD")
 * } catch (error) {
 *   console.log(isRawTomlError(error) && error.diagnostic.code) // "InvalidUtf8"
 * }
 * ```
 *
 * @throws A {@link RawTomlError} with code `InvalidUtf8` when U+FFFD is present.
 * @internal
 * @category assertions
 * @since 0.0.0
 */
export const assertValidUnicode = (source: string): void => {
	const index = source.indexOf("�");
	if (index !== -1) {
		raise(
			"InvalidUtf8",
			"invalid UTF-8: U+FFFD REPLACEMENT CHARACTER marks a malformed byte sequence in the decoded input",
			index,
			1,
		);
	}
};

/**
 * Skip spaces and tabs; returns the position of the first other character.
 *
 * **Example** (Advance past indentation)
 *
 * ```ts
 * import { scanWhitespace } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanWhitespace("  x", 0)) // 2
 * console.log(scanWhitespace("x", 0)) // 0
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanWhitespace = (source: string, pos: number): number => {
	let i = pos;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code !== SPACE && code !== TAB) {
			break;
		}
		i += 1;
	}
	return i;
};

/**
 * Consume one `\n` or `\r\n` newline. A lone `\r` throws BareCarriageReturn;
 * no newline at `pos` returns `pos` unchanged.
 *
 * **Example** (Consume LF and leave other characters)
 *
 * ```ts
 * import { isRawTomlError } from "../../../toml/internal/diagnostics.ts"
 * import { scanNewline } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanNewline("\n", 0)) // 1
 * console.log(scanNewline("\r\n", 0)) // 2
 * console.log(scanNewline("a", 0)) // 0
 * try {
 *   scanNewline("\r", 0)
 * } catch (error) {
 *   console.log(isRawTomlError(error) && error.diagnostic.code) // "BareCarriageReturn"
 * }
 * ```
 *
 * @throws A {@link RawTomlError} with code `BareCarriageReturn` for a lone CR.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanNewline = (source: string, pos: number): number => {
	const code = source.charCodeAt(pos);
	if (code === LF) {
		return pos + 1;
	}
	if (code === CR) {
		if (source.charCodeAt(pos + 1) === LF) {
			return pos + 2;
		}
		return raise("BareCarriageReturn", "carriage return not followed by a line feed", pos, 1);
	}
	return pos;
};

/**
 * Scan a comment starting at `#` through end of line or EOF. The value
 * excludes the `#`; control characters other than tab are rejected.
 *
 * **Example** (Scan a comment body)
 *
 * ```ts
 * import { scanComment } from "../../../toml/internal/scanner.ts"
 *
 * const scanned = scanComment("# hi\n", 0)
 * console.log(scanned.value) // " hi"
 * console.log(scanned.end) // 4
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanComment = (source: string, pos: number): ScanResult<string> => {
	let i = pos + 1;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === LF || code === CR) {
			break;
		}
		if (isControlChar(code)) {
			return raise("ControlCharacterInComment", `control character ${codeLabel(code)} in comment`, i, 1);
		}
		i += 1;
	}
	return { value: source.slice(pos + 1, i), end: i };
};

/**
 * Scan a run of bare-key characters; the value may be empty.
 *
 * **Gotchas**
 *
 * An empty result is not itself an error — the parser decides whether an
 * empty bare key is legal at that position.
 *
 * **Example** (Scan a name and an empty run)
 *
 * ```ts
 * import { scanBareKey } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanBareKey("name =", 0)) // { value: "name", end: 4 }
 * console.log(scanBareKey(" =", 0)) // { value: "", end: 0 }
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanBareKey = (source: string, pos: number): ScanResult<string> => {
	let i = pos;
	while (i < source.length && isBareKeyChar(source.charCodeAt(i))) {
		i += 1;
	}
	return { value: source.slice(pos, i), end: i };
};

/** The decoded character for a simple escape code, or undefined. */
const simpleEscape = (code: number): string | undefined => {
	switch (code) {
		case 0x62:
			return "\b";
		case 0x74:
			return "\t";
		case 0x6e:
			return "\n";
		case 0x66:
			return "\f";
		case 0x72:
			return "\r";
		case 0x65:
			return "\u001b";
		case QUOTE:
			return '"';
		case BACKSLASH:
			return "\\";
		default:
			return undefined;
	}
};

const HEX_DIGITS = /^[0-9A-Fa-f]+$/;

const ESCAPE_LETTERS = { 2: "x", 4: "u", 8: "U" } as const;

/**
 * Decode a `\xHH` / `\uXXXX` / `\UXXXXXXXX` escape at `backslash`. The code
 * point must be a Unicode scalar value: surrogates and values above U+10FFFF
 * are errors. `\xHH` (TOML 1.1) covers U+0000–U+00FF — the escape is a
 * grammar-sibling of `basic-unescaped`, so the decoded character bypasses the
 * control-character ban by design.
 */
const decodeUnicodeEscape = (
	source: string,
	backslash: number,
	width: 2 | 4 | 8,
): { readonly codePoint: number; readonly end: number } => {
	const start = backslash + 2;
	const hex = source.slice(start, start + width);
	if (hex.length < width || !HEX_DIGITS.test(hex)) {
		return raise(
			"InvalidUnicodeEscape",
			`\\${ESCAPE_LETTERS[width]} escape requires ${width} hexadecimal digits`,
			backslash,
			width + 2,
		);
	}
	const codePoint = Number.parseInt(hex, 16);
	if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
		return raise("InvalidUnicodeEscape", `${codeLabel(codePoint)} is not a Unicode scalar value`, backslash, width + 2);
	}
	return { codePoint, end: start + width };
};

/** The escape width for a unicode-style escape letter, or undefined. */
const unicodeEscapeWidth = (code: number): 2 | 4 | 8 | undefined =>
	code === LOWER_X ? 2 : code === LOWER_U ? 4 : code === UPPER_U ? 8 : undefined;

/**
 * Scan a single-line basic string starting at the opening `"`.
 *
 * **Example** (Decode a basic string)
 *
 * ```ts
 * import { isRawTomlError } from "../../../toml/internal/diagnostics.ts"
 * import { scanBasicString } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanBasicString('"Alice"', 0)) // { value: "Alice", end: 7 }
 * try {
 *   scanBasicString('"unterminated', 0)
 * } catch (error) {
 *   console.log(isRawTomlError(error) && error.diagnostic.code) // "UnterminatedString"
 * }
 * ```
 *
 * @throws A {@link RawTomlError} for unterminated strings, invalid escapes, or control characters.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanBasicString = (source: string, pos: number): ScanResult<string> => {
	let out = "";
	let chunkStart = pos + 1;
	let i = pos + 1;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === QUOTE) {
			return { value: out + source.slice(chunkStart, i), end: i + 1 };
		}
		if (code === BACKSLASH) {
			if (i + 1 >= source.length) {
				break;
			}
			out += source.slice(chunkStart, i);
			const next = source.charCodeAt(i + 1);
			const mapped = simpleEscape(next);
			const width = unicodeEscapeWidth(next);
			if (mapped !== undefined) {
				out += mapped;
				i += 2;
			} else if (width !== undefined) {
				const decoded = decodeUnicodeEscape(source, i, width);
				out += String.fromCodePoint(decoded.codePoint);
				i = decoded.end;
			} else {
				return raise("InvalidEscape", `invalid escape sequence \\${source[i + 1] ?? ""}`, i, 2);
			}
			chunkStart = i;
			continue;
		}
		if (code === LF || (code === CR && source.charCodeAt(i + 1) === LF)) {
			return raise("UnterminatedString", "basic string not closed before end of line", pos, i - pos);
		}
		if (code === CR) {
			return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
		}
		if (isControlChar(code)) {
			return raise("ControlCharacterInString", `control character ${codeLabel(code)} in basic string`, i, 1);
		}
		i += 1;
	}
	return raise("UnterminatedString", "unterminated basic string", pos, source.length - pos);
};

/**
 * Scan a single-line literal string starting at the opening `'`.
 *
 * **Example** (Decode a literal string)
 *
 * ```ts
 * import { scanLiteralString } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanLiteralString("'Alice'", 0)) // { value: "Alice", end: 7 }
 * ```
 *
 * @throws A {@link RawTomlError} for unterminated strings or control characters.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanLiteralString = (source: string, pos: number): ScanResult<string> => {
	let i = pos + 1;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === APOSTROPHE) {
			return { value: source.slice(pos + 1, i), end: i + 1 };
		}
		if (code === LF || (code === CR && source.charCodeAt(i + 1) === LF)) {
			return raise("UnterminatedString", "literal string not closed before end of line", pos, i - pos);
		}
		if (code === CR) {
			return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
		}
		if (isControlChar(code)) {
			return raise("ControlCharacterInString", `control character ${codeLabel(code)} in literal string`, i, 1);
		}
		i += 1;
	}
	return raise("UnterminatedString", "unterminated literal string", pos, source.length - pos);
};

/** Skip a newline immediately after a multiline opening delimiter. */
const skipLeadingNewline = (source: string, pos: number): number => {
	if (source.charCodeAt(pos) === LF) {
		return pos + 1;
	}
	if (source.charCodeAt(pos) === CR && source.charCodeAt(pos + 1) === LF) {
		return pos + 2;
	}
	return pos;
};

/** Skip whitespace and newlines after a line-ending backslash's newline. */
const skipLineEndingTrim = (source: string, pos: number): number => {
	let i = pos;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === SPACE || code === TAB || code === LF) {
			i += 1;
			continue;
		}
		if (code === CR) {
			if (source.charCodeAt(i + 1) === LF) {
				i += 2;
				continue;
			}
			return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
		}
		break;
	}
	return i;
};

/**
 * Scan a multiline basic string starting at the opening `"""`.
 *
 * **Example** (Decode a multiline basic string)
 *
 * ```ts
 * import { scanMultilineBasicString } from "../../../toml/internal/scanner.ts"
 *
 * const scanned = scanMultilineBasicString('"""\\nhello"""', 0)
 * console.log(scanned.value) // "hello"
 * ```
 *
 * @throws A {@link RawTomlError} for unterminated strings, invalid escapes, or control characters.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanMultilineBasicString = (source: string, pos: number): ScanResult<string> => {
	let i = skipLeadingNewline(source, pos + 3);
	let out = "";
	let chunkStart = i;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === QUOTE) {
			let runEnd = i;
			while (runEnd < source.length && source.charCodeAt(runEnd) === QUOTE) {
				runEnd += 1;
			}
			const run = runEnd - i;
			if (run < 3) {
				// one or two quotes are content
				i = runEnd;
				continue;
			}
			// closing delimiter, greedy: up to two quotes immediately before it are content
			const contentQuotes = Math.min(run - 3, 2);
			return { value: out + source.slice(chunkStart, i + contentQuotes), end: i + contentQuotes + 3 };
		}
		if (code === BACKSLASH) {
			out += source.slice(chunkStart, i);
			const next = source.charCodeAt(i + 1);
			const mapped = simpleEscape(next);
			if (mapped !== undefined) {
				out += mapped;
				i += 2;
				chunkStart = i;
				continue;
			}
			const width = unicodeEscapeWidth(next);
			if (width !== undefined) {
				const decoded = decodeUnicodeEscape(source, i, width);
				out += String.fromCodePoint(decoded.codePoint);
				i = decoded.end;
				chunkStart = i;
				continue;
			}
			// line-ending backslash: only whitespace may sit between it and the newline
			let probe = i + 1;
			while (probe < source.length) {
				const probeCode = source.charCodeAt(probe);
				if (probeCode !== SPACE && probeCode !== TAB) {
					break;
				}
				probe += 1;
			}
			if (probe >= source.length) {
				break;
			}
			const probeCode = source.charCodeAt(probe);
			if (probeCode === LF || (probeCode === CR && source.charCodeAt(probe + 1) === LF)) {
				i = skipLineEndingTrim(source, probe);
				chunkStart = i;
				continue;
			}
			return raise("InvalidEscape", `invalid escape sequence \\${source[i + 1] ?? ""}`, i, probe - i + 1);
		}
		if (code === LF) {
			i += 1;
			continue;
		}
		if (code === CR) {
			if (source.charCodeAt(i + 1) === LF) {
				i += 2;
				continue;
			}
			return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
		}
		if (isControlChar(code)) {
			return raise("ControlCharacterInString", `control character ${codeLabel(code)} in multiline basic string`, i, 1);
		}
		i += 1;
	}
	return raise("UnterminatedString", "unterminated multiline basic string", pos, source.length - pos);
};

/**
 * Scan a multiline literal string starting at the opening `'''`.
 *
 * **Example** (Decode a multiline literal string)
 *
 * ```ts
 * import { scanMultilineLiteralString } from "../../../toml/internal/scanner.ts"
 *
 * const scanned = scanMultilineLiteralString("'''\\nhello'''", 0)
 * console.log(scanned.value) // "hello"
 * ```
 *
 * @throws A {@link RawTomlError} for unterminated strings or control characters.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanMultilineLiteralString = (source: string, pos: number): ScanResult<string> => {
	const contentStart = skipLeadingNewline(source, pos + 3);
	let i = contentStart;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === APOSTROPHE) {
			let runEnd = i;
			while (runEnd < source.length && source.charCodeAt(runEnd) === APOSTROPHE) {
				runEnd += 1;
			}
			const run = runEnd - i;
			if (run < 3) {
				i = runEnd;
				continue;
			}
			const contentQuotes = Math.min(run - 3, 2);
			return { value: source.slice(contentStart, i + contentQuotes), end: i + contentQuotes + 3 };
		}
		if (code === LF) {
			i += 1;
			continue;
		}
		if (code === CR) {
			if (source.charCodeAt(i + 1) === LF) {
				i += 2;
				continue;
			}
			return raise("BareCarriageReturn", "carriage return not followed by a line feed", i, 1);
		}
		if (isControlChar(code)) {
			return raise(
				"ControlCharacterInString",
				`control character ${codeLabel(code)} in multiline literal string`,
				i,
				1,
			);
		}
		i += 1;
	}
	return raise("UnterminatedString", "unterminated multiline literal string", pos, source.length - pos);
};

/** Scan one raw token span; NUL anywhere is a lex error. */
const scanTokenSpan = (source: string, pos: number): number => {
	let i = pos;
	while (i < source.length) {
		const code = source.charCodeAt(i);
		if (code === NUL) {
			return raise("InvalidCharacter", "NUL character in document", i, 1);
		}
		if (
			code === SPACE ||
			code === TAB ||
			code === LF ||
			code === CR ||
			code === COMMA ||
			code === RIGHT_BRACKET ||
			code === RIGHT_BRACE ||
			code === HASH
		) {
			break;
		}
		i += 1;
	}
	return i;
};

// G5 classification regexes (anchored). TOML 1.1 makes seconds optional:
// `partial-time = time-hour ":" time-minute [ ":" time-second [ time-secfrac ] ]`
// — time-secfrac nests INSIDE the optional seconds group, so `07:32` is valid
// but `07:32.5` is not. The regexes nest accordingly; they must never chain
// the seconds and fraction groups as independent optionals.
const OFFSET_DATE_TIME =
	/^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?([Zz]|[+-][0-9]{2}:[0-9]{2})$/;
const LOCAL_DATE_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?$/;
const LOCAL_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const LOCAL_TIME = /^([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]+))?)?$/;

/**
 * Scan a non-string scalar value token. Stops at whitespace, newlines, `,`,
 * `]`, `}` and `#` — with the G5 extension: a token that scanned as a full
 * date followed by a single space and a digit continues through the time
 * part, so `1979-05-27 07:32:00Z` is one token.
 *
 * **Gotchas**
 *
 * TOML 1.1 makes seconds optional (`07:32` is valid) but `07:32.5` is not —
 * the fraction nests inside the optional seconds group. A date plus space plus
 * digit continues through the time so offset date-times with a space separator
 * stay one token.
 *
 * **Example** (Scan a space-separated offset date-time)
 *
 * ```ts
 * import { scanValueToken } from "../../../toml/internal/scanner.ts"
 *
 * console.log(scanValueToken("1979-05-27 07:32:00Z", 0).value) // "1979-05-27 07:32:00Z"
 * console.log(scanValueToken("07:32", 0).value) // "07:32"
 * ```
 *
 * @see {@link classifyValueToken} to turn the scanned token into a scalar.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const scanValueToken = (source: string, pos: number): ScanResult<string> => {
	let end = scanTokenSpan(source, pos);
	if (
		LOCAL_DATE.test(source.slice(pos, end)) &&
		source.charCodeAt(end) === SPACE &&
		isDigit(source.charCodeAt(end + 1))
	) {
		end = scanTokenSpan(source, end + 1);
	}
	return { value: source.slice(pos, end), end };
};

// G4 classification regexes (anchored, copied verbatim from the grammar reference).
const INTEGER_DEC = /^[+-]?(?:0|[1-9](?:_?[0-9])*)$/;
const INTEGER_HEX = /^0x[0-9A-Fa-f](?:_?[0-9A-Fa-f])*$/;
const INTEGER_OCT = /^0o[0-7](?:_?[0-7])*$/;
const INTEGER_BIN = /^0b[01](?:_?[01])*$/;
const FLOAT =
	/^[+-]?(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*(?:[eE][+-]?[0-9](?:_?[0-9])*)?|[eE][+-]?[0-9](?:_?[0-9])*)$/;
const FLOAT_SPECIAL = /^[+-]?(?:inf|nan)$/;

/** A token that starts number-shaped fails as InvalidNumber, not InvalidValue. */
const NUMERIC_LOOKING = /^[+-]?[0-9.]/;

const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
const MAX_SAFE_BIG = 2n ** 53n - 1n;

/** Range-check against int64 and narrow to number when within 2^53-1. */
const narrowInteger = (big: bigint, token: string, offset: number): number | bigint => {
	if (big < INT64_MIN || big > INT64_MAX) {
		return raise("IntegerOutOfRange", `${token} does not fit in a signed 64-bit integer`, offset, token.length);
	}
	return big >= -MAX_SAFE_BIG && big <= MAX_SAFE_BIG ? Number(big) : big;
};

const decodeDecimalInteger = (token: string, offset: number): number | bigint => {
	let digits = token.replace(/_/g, "");
	if (digits.startsWith("+")) {
		digits = digits.slice(1);
	}
	return narrowInteger(BigInt(digits), token, offset);
};

const decodePrefixedInteger = (token: string, offset: number): number | bigint =>
	narrowInteger(BigInt(token.replace(/_/g, "")), token, offset);

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const validateDate = (year: number, month: number, day: number, offset: number, length: number): void => {
	if (month < 1 || month > 12) {
		raise("InvalidDateTime", `month ${month} is out of range 1-12`, offset, length);
	}
	const max = month === 2 && isLeapYear(year) ? 29 : (MONTH_LENGTHS[month - 1] ?? 0);
	if (day < 1 || day > max) {
		raise("InvalidDateTime", `day ${day} does not exist in month ${month} of ${year}`, offset, length);
	}
};

const validateTime = (hour: number, minute: number, second: number, offset: number, length: number): void => {
	if (hour > 23) {
		raise("InvalidDateTime", `hour ${hour} is out of range 0-23`, offset, length);
	}
	if (minute > 59) {
		raise("InvalidDateTime", `minute ${minute} is out of range 0-59`, offset, length);
	}
	if (second > 60) {
		raise("InvalidDateTime", `second ${second} is out of range 0-60`, offset, length);
	}
};

/** Right-pad or truncate fractional-second digits to exactly nine → nanoseconds. */
const decodeNanosecond = (fraction: string | undefined): number =>
	fraction === undefined ? 0 : Number(`${fraction}000000000`.slice(0, 9));

/** Decode `Z` / `z` / `[+-]hh:mm` to signed minutes, validating hh and mm. */
const decodeOffsetMinutes = (text: string, offset: number, length: number): number => {
	if (text === "Z" || text === "z") {
		return 0;
	}
	const hh = Number(text.slice(1, 3));
	const mm = Number(text.slice(4, 6));
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
	return text.charCodeAt(0) === HYPHEN ? -total : total;
};

/**
 * Classify a scanned value token per G4-G6: booleans, the four datetime
 * shapes (validated against the Gregorian calendar and clock ranges before
 * construction), integers across four radixes with int64 range checking and
 * number/bigint narrowing, and floats including the special spellings.
 *
 * **Gotchas**
 *
 * Absent seconds materialize as `0` (`07:32` becomes `07:32:00`). Datetime
 * range validation happens before constructing the classes so the diagnostic
 * carries the token offset instead of a schema-check message. `07:32.5` does
 * not match a time.
 *
 * **Example** (Classify a time with optional seconds)
 *
 * ```ts
 * import { TomlLocalTime } from "@beep/scratchpad/toml"
 * import { classifyValueToken } from "../../../toml/internal/scanner.ts"
 *
 * const time = classifyValueToken("07:32", 0)
 * console.log(time instanceof TomlLocalTime) // true
 * console.log(time instanceof TomlLocalTime && time.second) // 0
 * ```
 *
 * @see {@link TomlOffsetDateTime} for offset date-times this function constructs.
 * @see {@link TomlLocalDateTime} for local date-times this function constructs.
 * @see {@link TomlLocalDate} for local dates this function constructs.
 * @see {@link TomlLocalTime} for local times this function constructs.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const classifyValueToken = (token: string, offset: number): ScalarValue => {
	if (token === "true") {
		return true;
	}
	if (token === "false") {
		return false;
	}
	const length = Math.max(token.length, 1);
	let match = OFFSET_DATE_TIME.exec(token);
	if (match !== null) {
		// TOML 1.1 optional seconds: an absent seconds group materializes as 0.
		const [, y = "", mo = "", d = "", h = "", mi = "", s, fraction, offsetText = ""] = match;
		const year = Number(y);
		const month = Number(mo);
		const day = Number(d);
		const hour = Number(h);
		const minute = Number(mi);
		const second = s === undefined ? 0 : Number(s);
		validateDate(year, month, day, offset, length);
		validateTime(hour, minute, second, offset, length);
		const offsetMinutes = decodeOffsetMinutes(offsetText, offset, length);
		return new TomlOffsetDateTime({
			year,
			month,
			day,
			hour,
			minute,
			second,
			nanosecond: decodeNanosecond(fraction),
			offsetMinutes,
		});
	}
	match = LOCAL_DATE_TIME.exec(token);
	if (match !== null) {
		const [, y = "", mo = "", d = "", h = "", mi = "", s, fraction] = match;
		const year = Number(y);
		const month = Number(mo);
		const day = Number(d);
		const hour = Number(h);
		const minute = Number(mi);
		const second = s === undefined ? 0 : Number(s);
		validateDate(year, month, day, offset, length);
		validateTime(hour, minute, second, offset, length);
		return new TomlLocalDateTime({ year, month, day, hour, minute, second, nanosecond: decodeNanosecond(fraction) });
	}
	match = LOCAL_DATE.exec(token);
	if (match !== null) {
		const [, y = "", mo = "", d = ""] = match;
		const year = Number(y);
		const month = Number(mo);
		const day = Number(d);
		validateDate(year, month, day, offset, length);
		return new TomlLocalDate({ year, month, day });
	}
	match = LOCAL_TIME.exec(token);
	if (match !== null) {
		const [, h = "", mi = "", s, fraction] = match;
		const hour = Number(h);
		const minute = Number(mi);
		const second = s === undefined ? 0 : Number(s);
		validateTime(hour, minute, second, offset, length);
		return new TomlLocalTime({ hour, minute, second, nanosecond: decodeNanosecond(fraction) });
	}
	if (INTEGER_DEC.test(token)) {
		return decodeDecimalInteger(token, offset);
	}
	if (INTEGER_HEX.test(token) || INTEGER_OCT.test(token) || INTEGER_BIN.test(token)) {
		return decodePrefixedInteger(token, offset);
	}
	if (FLOAT.test(token)) {
		return Number(token.replace(/_/g, ""));
	}
	if (FLOAT_SPECIAL.test(token)) {
		if (token.endsWith("nan")) {
			return Number.NaN;
		}
		return token.charCodeAt(0) === HYPHEN ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
	}
	if (NUMERIC_LOOKING.test(token)) {
		return raise("InvalidNumber", `${token} is not a valid TOML number or date-time`, offset, length);
	}
	return raise("InvalidValue", `${token} is not a valid TOML value`, offset, length);
};
