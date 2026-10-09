import { assert, describe, it } from "@effect/vitest";
import { Doc, Fmt, Render } from "../../effected/cli/index.ts";

describe("Fmt.duration", () => {
	const cases: ReadonlyArray<readonly [number, string]> = [
		[0, "0ms"],
		[250, "250ms"],
		[999, "999ms"],
		[1000, "1s"],
		[1049, "1s"], // 1.049s rounds to 1.0, and a trailing .0 is dropped
		[1050, "1.1s"], // 1.050s rounds half up to 1.1
		[1200, "1.2s"],
		[2000, "2s"],
		[59_949, "59.9s"],
		[59_999, "1m"], // rounds up to a whole minute rather than printing "60s"
		[60_000, "1m"],
		[63_000, "1m 3s"],
		[120_000, "2m"],
		[3_599_999, "1h"], // rounds up to a whole hour rather than printing "60m"
		[3_600_000, "1h"],
		[3_660_000, "1h 1m"],
		[5_400_000, "1h 30m"],
		[7_200_000, "2h"],
		[7_260_000, "2h 1m"],
		[86_400_000, "24h"], // no days unit: hours keep counting
	];
	for (const [ms, expected] of cases) {
		it(`${ms}ms => ${expected}`, () => {
			assert.strictEqual(Fmt.duration(ms), expected);
		});
	}

	it("clamps a negative or non-finite input to 0ms", () => {
		assert.strictEqual(Fmt.duration(-5), "0ms");
		assert.strictEqual(Fmt.duration(Number.NaN), "0ms");
		assert.strictEqual(Fmt.duration(Number.POSITIVE_INFINITY), "0ms");
	});

	it("a fractional millisecond that rounds to 1000 is a second, not 1000ms", () => {
		assert.strictEqual(Fmt.duration(999.6), "1s");
	});
});

describe("Fmt.percent", () => {
	it("formats a ratio with one digit by default and drops a trailing zero decimal", () => {
		assert.strictEqual(Fmt.percent(0), "0%");
		assert.strictEqual(Fmt.percent(1), "100%");
		assert.strictEqual(Fmt.percent(0.8333), "83.3%");
		assert.strictEqual(Fmt.percent(0.5), "50%");
	});

	it("takes digits", () => {
		assert.strictEqual(Fmt.percent(0.8333, { digits: 0 }), "83%");
		assert.strictEqual(Fmt.percent(0.83333, { digits: 2 }), "83.33%");
		assert.strictEqual(Fmt.percent(0.5, { digits: 3 }), "50%");
	});

	it("never prints a negative zero", () => {
		assert.strictEqual(Fmt.percent(-0.00001), "0%");
	});
});

describe("Fmt.plural", () => {
	it("pluralises by count, with an irregular plural when given", () => {
		assert.strictEqual(Fmt.plural(0, "test"), "0 tests");
		assert.strictEqual(Fmt.plural(1, "test"), "1 test");
		assert.strictEqual(Fmt.plural(2, "test"), "2 tests");
		assert.strictEqual(Fmt.plural(1, "child", "children"), "1 child");
		assert.strictEqual(Fmt.plural(3, "child", "children"), "3 children");
	});
});

describe("Fmt.width", () => {
	it("measures display width", () => {
		assert.strictEqual(Fmt.width("hello"), 5);
		assert.strictEqual(Fmt.width("日本語"), 6);
		assert.strictEqual(Fmt.width("\x1b[31mred\x1b[0m"), 3);
	});
});

describe("Fmt.truncate", () => {
	it("cuts ASCII to the width with an ellipsis, result width <= width", () => {
		assert.strictEqual(Fmt.truncate("hello world", 8), "hello w…");
		assert.strictEqual(Fmt.width(Fmt.truncate("hello world", 8)), 8);
	});

	it("returns text that already fits unchanged", () => {
		assert.strictEqual(Fmt.truncate("hello", 5), "hello");
		assert.strictEqual(Fmt.truncate("hello", 10), "hello");
		assert.strictEqual(Fmt.truncate("", 3), "");
	});

	it("never produces half a wide character: CJK at an odd budget", () => {
		// "日本語" is 6 wide. Width 4 leaves 3 after the 1-wide ellipsis: one wide char (2) fits, a second (4) does not.
		const out = Fmt.truncate("日本語", 4);
		assert.strictEqual(out, "日…");
		assert.isAtMost(Fmt.width(out), 4);
		assert.strictEqual(Fmt.truncate("日本語日本語", 5), "日本…");
	});

	it("never splits an emoji ZWJ family", () => {
		const family = "👨‍👩‍👧";
		assert.strictEqual(Fmt.width(family), 2);
		// Room for the ellipsis and one column: the 2-wide family does not fit, so it is dropped whole.
		assert.strictEqual(Fmt.truncate(`${family}${family}`, 3), `${family}…`);
		assert.strictEqual(Fmt.truncate(`${family}${family}`, 2), "…");
		assert.strictEqual(Fmt.truncate(`a${family}`, 2), "a…");
	});

	it("truncates ANSI-coloured input as plain text: the escapes are dropped, never cut in half", () => {
		const out = Fmt.truncate("\x1b[31mhello world\x1b[39m", 8);
		assert.strictEqual(out, "hello w…");
		assert.notInclude(out, "\x1b");
	});

	it("leaves ANSI-coloured input that already fits untouched", () => {
		const coloured = "\x1b[31mhi\x1b[39m";
		assert.strictEqual(Fmt.truncate(coloured, 5), coloured);
	});

	it("takes a custom ellipsis, counted by width", () => {
		assert.strictEqual(Fmt.truncate("hello world", 8, { ellipsis: "..." }), "hello...");
		assert.strictEqual(Fmt.truncate("hello world", 8, { ellipsis: "" }), "hello wo");
	});

	it("drops the ellipsis when it cannot fit, and gives an empty string for a width of 0 or less", () => {
		assert.strictEqual(Fmt.truncate("hello", 2, { ellipsis: "..." }), "he");
		assert.strictEqual(Fmt.truncate("hello", 0), "");
		assert.strictEqual(Fmt.truncate("hello", -3), "");
	});
});

describe("Fmt.percent scale", () => {
	it("scale 100 takes a 0 to 100 number as it is", () => {
		assert.strictEqual(Fmt.percent(83.3, { scale: 100 }), "83.3%");
		assert.strictEqual(Fmt.percent(100, { scale: 100 }), "100%");
		assert.strictEqual(Fmt.percent(0, { scale: 100 }), "0%");
		assert.strictEqual(Fmt.percent(50, { scale: 100 }), "50%");
	});

	it("scale 1 and an omitted scale are the ratio, exactly as before", () => {
		for (const n of [0, 0.5, 0.8333, 1, 0.12345]) {
			assert.strictEqual(Fmt.percent(n, { scale: 1 }), Fmt.percent(n));
		}
	});

	it("scale 100 agrees with the ratio form on the same number divided by 100", () => {
		for (const n of [0, 12.5, 33.333, 83.3, 99.95, 100]) {
			assert.strictEqual(Fmt.percent(n, { scale: 100 }), Fmt.percent(n / 100), String(n));
		}
	});

	it("digits compose with scale, and a value rounding to zero is 0%, never -0%", () => {
		assert.strictEqual(Fmt.percent(83.333, { scale: 100, digits: 2 }), "83.33%");
		assert.strictEqual(Fmt.percent(83.3, { scale: 100, digits: 0 }), "83%");
		assert.strictEqual(Fmt.percent(-0.001, { scale: 100, digits: 0 }), "0%");
	});
});

describe("Fmt.sanitize", () => {
	it("removes escapes and controls, turns a tab into a space, and keeps line breaks", () => {
		assert.strictEqual(Fmt.sanitize("a\u001b[31mb\u001b[39m\tc\u0007\u009b\nd\r\ne"), "ab c\nd\r\ne");
	});

	it("is what the renderers use: plain text of a paragraph is the sanitized text", () => {
		const ctx = Render.contextOf({ audience: "agent" });
		for (const hostile of ["x\u001b]8;;https://evil\u0007y", "a\u0000b\u007fc", "tab\there", "\u001b[2Jclear"]) {
			assert.strictEqual(Render.plain([Doc.paragraph(hostile)], ctx), Fmt.sanitize(hostile));
		}
	});
});
