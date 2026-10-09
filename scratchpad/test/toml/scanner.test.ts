import { assert, describe, it } from "@effect/vitest";
import type { TomlErrorCodeRaw } from "../../effected/toml/internal/diagnostics.ts";
import { isRawTomlError } from "../../effected/toml/internal/diagnostics.ts";
import {
	assertValidUnicode,
	classifyValueToken,
	isBareKeyChar,
	scanBareKey,
	scanBasicString,
	scanComment,
	scanLiteralString,
	scanMultilineBasicString,
	scanMultilineLiteralString,
	scanNewline,
	scanValueToken,
	scanWhitespace,
	skipBom,
} from "../../effected/toml/internal/scanner.ts";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "../../effected/toml/TomlDateTime.ts";

/** Assert `fn` throws a RawTomlError with `code` (and `offset`, when given). */
function assertScanError(fn: () => unknown, code: TomlErrorCodeRaw, offset?: number): void {
	try {
		fn();
	} catch (error) {
		if (!isRawTomlError(error)) {
			throw error;
		}
		assert.strictEqual(error.diagnostic.code, code);
		if (offset !== undefined) {
			assert.strictEqual(error.diagnostic.offset, offset);
		}
		return;
	}
	assert.fail(`expected RawTomlError with code ${code}, but nothing was thrown`);
}

/** Classify `token` and narrow to an expected datetime class. */
function classifyInstance<T>(token: string, ctor: abstract new (...args: never[]) => T): T {
	const value = classifyValueToken(token, 0);
	if (!(value instanceof ctor)) {
		throw new Error(`expected ${JSON.stringify(token)} to classify as a datetime instance`);
	}
	return value;
}

describe("scanner", () => {
	describe("basic string", () => {
		it("scans a plain string and the empty string", () => {
			const plain = scanBasicString('"hello"', 0);
			assert.strictEqual(plain.value, "hello");
			assert.strictEqual(plain.end, 7);
			const empty = scanBasicString('""', 0);
			assert.strictEqual(empty.value, "");
			assert.strictEqual(empty.end, 2);
		});
		it("decodes every simple escape", () => {
			const source = '"\\b\\t\\n\\f\\r\\"\\\\"';
			const result = scanBasicString(source, 0);
			assert.strictEqual(result.value, '\b\t\n\f\r"\\');
			assert.strictEqual(result.end, source.length);
		});
		it("decodes unicode escapes including astral code points", () => {
			assert.strictEqual(scanBasicString('"\\u0041"', 0).value, "A");
			assert.strictEqual(scanBasicString('"\\U0001F600"', 0).value, "\u{1F600}");
		});
		it("decodes the TOML 1.1 escapes: \\e and \\xHH", () => {
			assert.strictEqual(scanBasicString('"\\e[0m"', 0).value, "\u001b[0m");
			assert.strictEqual(scanBasicString('"\\x41\\xff"', 0).value, "Aÿ");
		});
		it("decodes \\xHH control characters preserved unnormalized beside real newlines", () => {
			// Escapes are grammar-siblings of basic-unescaped: the full 0x00-0xFF
			// range is legal, control characters included, and the decoded bytes
			// bypass both the control-character ban and newline normalization.
			assert.strictEqual(scanBasicString('"\\x00"', 0).value, "\u0000");
			assert.strictEqual(scanBasicString('"a\\x0d\\x0ab"', 0).value, "a\r\nb");
			// a real newline beside the escaped CRLF is still consumed as a line
			// ending in a multiline string, while the escaped bytes stay literal
			assert.strictEqual(scanMultilineBasicString('"""\na\\x0d\\x0a\nb"""', 0).value, "a\r\n\nb");
		});
		it("throws UnterminatedString at EOF and on a trailing backslash", () => {
			assertScanError(() => scanBasicString('"abc', 0), "UnterminatedString", 0);
			assertScanError(() => scanBasicString('"a\\', 0), "UnterminatedString", 0);
		});
		it("throws InvalidEscape on an unknown escape", () => {
			assertScanError(() => scanBasicString('"a\\zb"', 0), "InvalidEscape", 2);
		});
		it("throws InvalidUnicodeEscape on surrogates, out-of-range and short hex", () => {
			assertScanError(() => scanBasicString('"\\uD800"', 0), "InvalidUnicodeEscape", 1);
			assertScanError(() => scanBasicString('"\\U00110000"', 0), "InvalidUnicodeEscape", 1);
			assertScanError(() => scanBasicString('"\\u00G0"', 0), "InvalidUnicodeEscape", 1);
			assertScanError(() => scanBasicString('"\\u00"', 0), "InvalidUnicodeEscape", 1);
			assertScanError(() => scanBasicString('"\\xG0"', 0), "InvalidUnicodeEscape", 1);
			assertScanError(() => scanBasicString('"\\x4"', 0), "InvalidUnicodeEscape", 1);
		});
		it("throws ControlCharacterInString on raw control characters including DEL", () => {
			assertScanError(() => scanBasicString('"a\u0001b"', 0), "ControlCharacterInString", 2);
			assertScanError(() => scanBasicString('"a\u007Fb"', 0), "ControlCharacterInString", 2);
		});
		it("allows a raw tab", () => {
			assert.strictEqual(scanBasicString('"a\tb"', 0).value, "a\tb");
		});
		it("throws UnterminatedString on a raw newline", () => {
			assertScanError(() => scanBasicString('"a\nb"', 0), "UnterminatedString", 0);
			assertScanError(() => scanBasicString('"a\r\nb"', 0), "UnterminatedString", 0);
		});
	});

	describe("literal string", () => {
		it("keeps backslashes verbatim with no escape processing", () => {
			const windows = scanLiteralString("'C:\\Users'", 0);
			assert.strictEqual(windows.value, "C:\\Users");
			assert.strictEqual(windows.end, 10);
			assert.strictEqual(scanLiteralString("'a\\nb'", 0).value, "a\\nb");
		});
		it("rejects control characters but allows tab", () => {
			assertScanError(() => scanLiteralString("'a\u0001b'", 0), "ControlCharacterInString", 2);
			assert.strictEqual(scanLiteralString("'a\tb'", 0).value, "a\tb");
		});
		it("throws UnterminatedString at EOF and on a raw newline", () => {
			assertScanError(() => scanLiteralString("'abc", 0), "UnterminatedString", 0);
			assertScanError(() => scanLiteralString("'a\nb'", 0), "UnterminatedString", 0);
		});
	});

	describe("multiline basic string", () => {
		it("trims a newline immediately after the opening delimiter", () => {
			assert.strictEqual(scanMultilineBasicString('"""\nx"""', 0).value, "x");
			assert.strictEqual(scanMultilineBasicString('"""\r\nx"""', 0).value, "x");
		});
		it("preserves CRLF verbatim in the middle", () => {
			assert.strictEqual(scanMultilineBasicString('"""a\r\nb"""', 0).value, "a\r\nb");
			assert.strictEqual(scanMultilineBasicString('"""a\nb"""', 0).value, "a\nb");
		});
		it("trims whitespace across lines after a line-ending backslash", () => {
			assert.strictEqual(scanMultilineBasicString('"""a \\\n   b"""', 0).value, "a b");
			assert.strictEqual(scanMultilineBasicString('"""a \\\r\n   b"""', 0).value, "a b");
			assert.strictEqual(scanMultilineBasicString('"""a \\  \t\n\n\n   b"""', 0).value, "a b");
			assert.strictEqual(scanMultilineBasicString('"""a\\\nb"""', 0).value, "ab");
		});
		it("treats one and two adjacent quotes as content", () => {
			const result = scanMultilineBasicString('"""a"b""c"""', 0);
			assert.strictEqual(result.value, 'a"b""c');
			assert.strictEqual(result.end, 12);
		});
		it("applies the closing-quote-run rule", () => {
			const empty = scanMultilineBasicString('""""""', 0);
			assert.strictEqual(empty.value, "");
			assert.strictEqual(empty.end, 6);
			const one = scanMultilineBasicString('"""a""""', 0);
			assert.strictEqual(one.value, 'a"');
			assert.strictEqual(one.end, 8);
			const two = scanMultilineBasicString('"""a"""""', 0);
			assert.strictEqual(two.value, 'a""');
			assert.strictEqual(two.end, 9);
			const onlyQuotes = scanMultilineBasicString('""""""""', 0);
			assert.strictEqual(onlyQuotes.value, '""');
			assert.strictEqual(onlyQuotes.end, 8);
		});
		it("throws InvalidEscape on a backslash followed by whitespace and non-newline content", () => {
			assertScanError(() => scanMultilineBasicString('"""a \\ b"""', 0), "InvalidEscape", 5);
		});
		it("still decodes escapes", () => {
			assert.strictEqual(scanMultilineBasicString('"""\\u0041\\t"""', 0).value, "A\t");
		});
		it("throws UnterminatedString at EOF and BareCarriageReturn on a lone CR", () => {
			assertScanError(() => scanMultilineBasicString('"""abc""', 0), "UnterminatedString", 0);
			assertScanError(() => scanMultilineBasicString('"""a\rb"""', 0), "BareCarriageReturn", 4);
		});
	});

	describe("multiline literal string", () => {
		it("treats one and two adjacent apostrophes as content", () => {
			const result = scanMultilineLiteralString("'''a'b''c'''", 0);
			assert.strictEqual(result.value, "a'b''c");
			assert.strictEqual(result.end, 12);
		});
		it("trims a newline immediately after the opening delimiter", () => {
			assert.strictEqual(scanMultilineLiteralString("'''\nx'''", 0).value, "x");
			assert.strictEqual(scanMultilineLiteralString("'''\r\nx'''", 0).value, "x");
		});
		it("performs no escape processing", () => {
			assert.strictEqual(scanMultilineLiteralString("'''a\\nb'''", 0).value, "a\\nb");
		});
		it("applies the closing-quote-run rule", () => {
			assert.strictEqual(scanMultilineLiteralString("''''''", 0).value, "");
			const one = scanMultilineLiteralString("'''a''''", 0);
			assert.strictEqual(one.value, "a'");
			assert.strictEqual(one.end, 8);
		});
		it("throws UnterminatedString at EOF and BareCarriageReturn on a lone CR", () => {
			assertScanError(() => scanMultilineLiteralString("'''abc", 0), "UnterminatedString", 0);
			assertScanError(() => scanMultilineLiteralString("'''a\rb'''", 0), "BareCarriageReturn", 4);
		});
	});

	describe("bare key", () => {
		it("scans the full bare-key character set", () => {
			const result = scanBareKey("abc-123_XYZ", 0);
			assert.strictEqual(result.value, "abc-123_XYZ");
			assert.strictEqual(result.end, 11);
		});
		it("stops at dot, whitespace, equals and closing bracket", () => {
			assert.deepStrictEqual(scanBareKey("a.b", 0), { value: "a", end: 1 });
			assert.deepStrictEqual(scanBareKey("a b", 0), { value: "a", end: 1 });
			assert.deepStrictEqual(scanBareKey("a=1", 0), { value: "a", end: 1 });
			assert.deepStrictEqual(scanBareKey("a]", 0), { value: "a", end: 1 });
			assert.deepStrictEqual(scanBareKey("k.v", 2), { value: "v", end: 3 });
		});
		it("classifies bare-key characters by code", () => {
			for (const ch of ["a", "z", "A", "Z", "0", "9", "_", "-"]) {
				assert.isTrue(isBareKeyChar(ch.charCodeAt(0)), `expected ${ch} to be a bare-key char`);
			}
			for (const ch of [".", " ", "\t", "=", "]", "#", '"', "'", "é"]) {
				assert.isFalse(isBareKeyChar(ch.charCodeAt(0)), `expected ${ch} not to be a bare-key char`);
			}
		});
	});

	describe("comment", () => {
		it("scans to end of line or EOF, excluding the hash", () => {
			assert.deepStrictEqual(scanComment("# hello", 0), { value: " hello", end: 7 });
			assert.deepStrictEqual(scanComment("#c\nx", 0), { value: "c", end: 2 });
			assert.deepStrictEqual(scanComment("#c\r\nx", 0), { value: "c", end: 2 });
		});
		it("rejects control characters but allows tab", () => {
			assertScanError(() => scanComment("# a\u0001", 0), "ControlCharacterInComment", 3);
			assert.strictEqual(scanComment("# a\tb", 0).value, " a\tb");
		});
	});

	describe("integers", () => {
		it("decodes decimal integers with signs and underscores", () => {
			assert.strictEqual(classifyValueToken("0", 0), 0);
			assert.strictEqual(classifyValueToken("+99", 0), 99);
			assert.strictEqual(classifyValueToken("-17", 0), -17);
			assert.strictEqual(classifyValueToken("1_000", 0), 1000);
		});
		it("decodes hex, octal and binary integers", () => {
			assert.strictEqual(classifyValueToken("0xDEADbeef", 0), 3735928559);
			assert.strictEqual(classifyValueToken("0o755", 0), 493);
			assert.strictEqual(classifyValueToken("0b1101", 0), 13);
			assert.strictEqual(classifyValueToken("0xdead_beef", 0), 3735928559);
		});
		it("narrows to number up to 2^53-1 and keeps bigint above", () => {
			const safe = classifyValueToken("9007199254740991", 0);
			assert.strictEqual(safe, 9007199254740991);
			assert.strictEqual(typeof safe, "number");
			const big = classifyValueToken("9007199254740993", 0);
			assert.strictEqual(big, 9007199254740993n);
			assert.strictEqual(typeof big, "bigint");
			assert.strictEqual(classifyValueToken("-9007199254740993", 0), -9007199254740993n);
		});
		it("enforces the signed 64-bit range inclusively", () => {
			assert.strictEqual(classifyValueToken("9223372036854775807", 0), 9223372036854775807n);
			assert.strictEqual(classifyValueToken("-9223372036854775808", 0), -9223372036854775808n);
			assert.strictEqual(classifyValueToken("0x7FFFFFFFFFFFFFFF", 0), 9223372036854775807n);
			assertScanError(() => classifyValueToken("9223372036854775808", 0), "IntegerOutOfRange", 0);
			assertScanError(() => classifyValueToken("-9223372036854775809", 0), "IntegerOutOfRange", 0);
			assertScanError(() => classifyValueToken("0xFFFFFFFFFFFFFFFF", 0), "IntegerOutOfRange", 0);
		});
		it("rejects leading zeros and misplaced underscores", () => {
			assertScanError(() => classifyValueToken("05", 3), "InvalidNumber", 3);
			assertScanError(() => classifyValueToken("1__2", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("1_", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("_1", 0), "InvalidValue", 0);
		});
	});

	describe("floats", () => {
		it("decodes plain and exponent forms", () => {
			assert.strictEqual(classifyValueToken("1.0", 0), 1);
			// Number(...) rather than a literal: biome flags 3.1415 as an approximation of pi
			assert.strictEqual(classifyValueToken("3.1415", 0), Number("3.1415"));
			assert.strictEqual(classifyValueToken("-0.01", 0), -0.01);
			assert.strictEqual(classifyValueToken("5e+22", 0), 5e22);
			assert.strictEqual(classifyValueToken("1e06", 0), 1000000);
			assert.strictEqual(classifyValueToken("-2E-2", 0), -0.02);
			assert.strictEqual(classifyValueToken("6.626e-34", 0), 6.626e-34);
		});
		it("decodes underscored floats", () => {
			assert.strictEqual(classifyValueToken("224_617.445_991_228", 0), 224617.445991228);
		});
		it("decodes the special spellings", () => {
			assert.strictEqual(classifyValueToken("inf", 0), Number.POSITIVE_INFINITY);
			assert.strictEqual(classifyValueToken("+inf", 0), Number.POSITIVE_INFINITY);
			assert.strictEqual(classifyValueToken("-inf", 0), Number.NEGATIVE_INFINITY);
			const nan = classifyValueToken("nan", 0);
			assert.isTrue(typeof nan === "number" && Number.isNaN(nan));
			const negNan = classifyValueToken("-nan", 0);
			assert.isTrue(typeof negNan === "number" && Number.isNaN(negNan));
		});
		it("preserves negative zero", () => {
			assert.isTrue(Object.is(classifyValueToken("-0.0", 0), -0));
		});
		it("rejects a dot without digits on both sides", () => {
			assertScanError(() => classifyValueToken(".7", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("7.", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("3.e+20", 0), "InvalidNumber", 0);
		});
	});

	describe("datetimes", () => {
		it("classifies an offset date-time with Z and lowercase separators", () => {
			const zulu = classifyInstance("1979-05-27T07:32:00Z", TomlOffsetDateTime);
			assert.strictEqual(zulu.offsetMinutes, 0);
			assert.strictEqual(zulu.toString(), "1979-05-27T07:32:00Z");
			const lower = classifyInstance("1979-05-27t07:32:00z", TomlOffsetDateTime);
			assert.strictEqual(lower.toString(), "1979-05-27T07:32:00Z");
		});
		it("classifies a space-separated fractional offset date-time with a negative offset", () => {
			const value = classifyInstance("1979-05-27 07:32:00.6-07:00", TomlOffsetDateTime);
			assert.strictEqual(value.nanosecond, 600000000);
			assert.strictEqual(value.offsetMinutes, -420);
			assert.strictEqual(value.toString(), "1979-05-27T07:32:00.6-07:00");
		});
		it("classifies local date-times, dates and times", () => {
			const dt = classifyInstance("1979-05-27T07:32:00", TomlLocalDateTime);
			assert.strictEqual(dt.toString(), "1979-05-27T07:32:00");
			const date = classifyInstance("1979-05-27", TomlLocalDate);
			assert.strictEqual(date.toString(), "1979-05-27");
			const time = classifyInstance("07:32:00.999999999", TomlLocalTime);
			assert.strictEqual(time.nanosecond, 999999999);
		});
		it("right-pads and truncates fractional seconds to nanoseconds", () => {
			assert.strictEqual(classifyInstance("07:32:00.6", TomlLocalTime).nanosecond, 600000000);
			assert.strictEqual(classifyInstance("07:32:00.9999999999", TomlLocalTime).nanosecond, 999999999);
			assert.strictEqual(classifyInstance("07:32:00.1234567891", TomlLocalTime).nanosecond, 123456789);
		});
		it("validates the Gregorian calendar including leap years", () => {
			assertScanError(() => classifyValueToken("2021-02-29T00:00:00Z", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("1900-02-29", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("2021-04-31", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("2021-13-01", 7), "InvalidDateTime", 7);
			assertScanError(() => classifyValueToken("2021-00-01", 0), "InvalidDateTime", 0);
			assert.strictEqual(classifyInstance("2000-02-29", TomlLocalDate).day, 29);
			assert.strictEqual(classifyInstance("2020-02-29", TomlLocalDate).day, 29);
		});
		it("validates time and offset ranges with inclusive maxima", () => {
			assertScanError(() => classifyValueToken("1979-05-27T25:00:00Z", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("07:60:00", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("07:32:61", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("1979-05-27T07:32:00+24:00", 0), "InvalidDateTime", 0);
			assertScanError(() => classifyValueToken("1979-05-27T07:32:00+10:60", 0), "InvalidDateTime", 0);
			assert.strictEqual(classifyInstance("23:59:60", TomlLocalTime).second, 60);
			assert.strictEqual(classifyInstance("1979-05-27T07:32:00+23:59", TomlOffsetDateTime).offsetMinutes, 1439);
			assert.strictEqual(classifyInstance("1979-05-27T07:32:00-23:59", TomlOffsetDateTime).offsetMinutes, -1439);
			assert.isTrue(Object.is(classifyInstance("1979-05-27T07:32:00-00:00", TomlOffsetDateTime).offsetMinutes, 0));
		});
		it("allows omitted seconds, materialized as second 0 (TOML 1.1)", () => {
			const time = classifyInstance("07:32", TomlLocalTime);
			assert.strictEqual(time.second, 0);
			assert.strictEqual(time.nanosecond, 0);
			const dt = classifyInstance("1979-05-27T07:32", TomlLocalDateTime);
			assert.strictEqual(dt.second, 0);
			const odt = classifyInstance("1979-05-27T07:32Z", TomlOffsetDateTime);
			assert.strictEqual(odt.second, 0);
			assert.strictEqual(odt.offsetMinutes, 0);
			assert.strictEqual(classifyInstance("1979-05-27 07:32-07:00", TomlOffsetDateTime).offsetMinutes, -420);
		});
		it("rejects a fractional second without seconds: secfrac nests inside the seconds group", () => {
			// partial-time = time-hour ":" time-minute [ ":" time-second [ time-secfrac ] ]
			// — the fraction is only reachable through the seconds group.
			assertScanError(() => classifyValueToken("07:32.5", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("1979-05-27T07:32.5", 0), "InvalidNumber", 0);
			assertScanError(() => classifyValueToken("1979-05-27T07:32.5Z", 0), "InvalidNumber", 0);
		});
	});

	describe("booleans", () => {
		it("classifies lowercase true and false", () => {
			assert.strictEqual(classifyValueToken("true", 0), true);
			assert.strictEqual(classifyValueToken("false", 0), false);
		});
		it("rejects any other casing", () => {
			assertScanError(() => classifyValueToken("True", 0), "InvalidValue", 0);
			assertScanError(() => classifyValueToken("TRUE", 0), "InvalidValue", 0);
		});
	});

	describe("value token scan", () => {
		it("stops at comma, brackets, braces, hash, whitespace and newlines", () => {
			for (const [source, value, end] of [
				["123,", "123", 3],
				["123]", "123", 3],
				["123}", "123", 3],
				["12 3", "12", 2],
				["12\t3", "12", 2],
				["12\n3", "12", 2],
				["12\r\n3", "12", 2],
				["12#c", "12", 2],
			] as const) {
				const result = scanValueToken(source, 0);
				assert.strictEqual(result.value, value, `token of ${JSON.stringify(source)}`);
				assert.strictEqual(result.end, end, `end of ${JSON.stringify(source)}`);
			}
		});
		it("extends a date token across a single space into the time part", () => {
			const extended = scanValueToken("1979-05-27 07:32:00Z\n", 0);
			assert.strictEqual(extended.value, "1979-05-27 07:32:00Z");
			assert.strictEqual(extended.end, 20);
			const inArray = scanValueToken("1979-05-27 07:32:00Z]", 0);
			assert.strictEqual(inArray.value, "1979-05-27 07:32:00Z");
			assert.strictEqual(inArray.end, 20);
		});
		it("does not eat a comment after a date token", () => {
			const result = scanValueToken("1979-05-27 # c", 0);
			assert.strictEqual(result.value, "1979-05-27");
			assert.strictEqual(result.end, 10);
		});
		it("scans from a mid-source position", () => {
			const result = scanValueToken("k = 123\n", 4);
			assert.strictEqual(result.value, "123");
			assert.strictEqual(result.end, 7);
		});
	});

	describe("misc", () => {
		it("throws InvalidUtf8 on U+FFFD, the lossy-decode marker of a malformed byte sequence", () => {
			// Pinned by toml-test invalid/encoding/bad-utf8-in-string.toml and friends:
			// after a lossy utf8 decode, U+FFFD is the only surviving evidence that
			// the source bytes were not valid UTF-8, so the document is rejected
			// even where the grammar would admit the character.
			assertScanError(() => assertValidUnicode('bad = "�"'), "InvalidUtf8", 7);
			assertScanError(() => assertValidUnicode("# �"), "InvalidUtf8", 2);
			assert.doesNotThrow(() => assertValidUnicode('ok = "plain"'));
		});
		it("skips a single leading BOM", () => {
			assert.strictEqual(skipBom("﻿a"), 1);
			assert.strictEqual(skipBom("a"), 0);
			assert.strictEqual(skipBom(""), 0);
		});
		it("scans LF and CRLF newlines and rejects a lone CR", () => {
			assert.strictEqual(scanNewline("a\nb", 1), 2);
			assert.strictEqual(scanNewline("a\r\nb", 1), 3);
			assert.strictEqual(scanNewline("ab", 1), 1);
			assert.strictEqual(scanNewline("a", 1), 1);
			assertScanError(() => scanNewline("a\rb", 1), "BareCarriageReturn", 1);
		});
		it("scans spaces and tabs as whitespace", () => {
			assert.strictEqual(scanWhitespace("  \tx", 0), 3);
			assert.strictEqual(scanWhitespace(" \t\nx", 0), 2);
			assert.strictEqual(scanWhitespace("x", 0), 0);
		});
		it("throws InvalidCharacter on NUL in a value token", () => {
			assertScanError(() => scanValueToken("\u0000", 0), "InvalidCharacter", 0);
			assertScanError(() => scanValueToken("ab\u0000", 0), "InvalidCharacter", 2);
		});
	});
});
