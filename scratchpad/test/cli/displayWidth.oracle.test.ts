// The differential test for the package's own display width, against `string-width`. This is the ONLY file in the
// package that imports `string-width` (a devDependency); see okf/decisions/own-display-width.md.
import { assert, describe, it } from "@effect/vitest";
import stringWidth from "string-width";
import { displayWidth } from "../../effected/cli/internal/displayWidth.ts";

const OSC8 = "\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007";

/** 29 curated strings, labelled: ASCII, accents, CJK, emoji of every kind, ANSI, OSC-8, text and emoji presentation. */
const CURATED: ReadonlyArray<readonly [label: string, text: string]> = [
	["ASCII", "hello world"],
	["precomposed accent (U+00E9)", "h\u00e9llo"],
	["decomposed accent (e + U+0301)", "he\u0301llo"],
	["CJK", "日本語"],
	["fullwidth Latin", "ＡＢＣ"],
	["thumbs up", "👍"],
	["ZWJ family", "👨‍👩‍👧"],
	["flag", "🇯🇵"],
	["skin tone", "👍🏽"],
	["keycap", "1️⃣"],
	["SGR colour", "\u001b[31mred\u001b[0m"],
	["tab", "a\tb"],
	["Hangul", "한국어"],
	["OSC-8 link", OSC8],
	["halfwidth kana", "ｱｲｳ"],
	["warning sign, VS16", "⚠️"],
	["red heart, VS16", "❤️"],
	["check mark button", "✅"],
	["warning sign, text presentation", "⚠"],
	["Thai", "สวัสดี"],
	["empty", ""],
	["rainbow flag", "🏳️‍🌈"],
	["box drawing", "─┼─│"],
	["CJK mixed with ASCII", "日本語 mixed abc"],
	["lone ZWJ", "a\u200db"],
	["thermometer, text presentation", "🌡"],
	["thermometer, VS16", "🌡️"],
	["CJK extension B", "\u{20000}"],
	["Hangul filler", "한\u3164글"],
];

describe("displayWidth against string-width", () => {
	it("the oracle is the version the decision was measured against", () => {
		// 7.2.0 said 2 for a bare U+26A0 and 8.3.0 says 1; if this flips, string-width drifted and the sweep below
		// is no longer comparing what the decision measured.
		assert.strictEqual(stringWidth("⚠"), 1);
	});

	it("the harness can report a mismatch (positive control)", () => {
		assert.notStrictEqual(stringWidth("日本語"), "日本語".length);
		assert.notStrictEqual(displayWidth("日本語"), "日本語".length);
	});

	it("has 29 curated strings", () => {
		assert.strictEqual(CURATED.length, 29);
	});

	for (const [label, text] of CURATED) {
		it(`curated: ${label}`, () => {
			assert.strictEqual(displayWidth(text), stringWidth(text));
		});
	}

	it("a code-point sweep of every assigned code point agrees, except the lone regional indicators", () => {
		// U+0000 to U+10FFFF at stride 1, so no block edge or astral zero-width range (tag characters, the variation
		// selectors supplement) escapes it. Surrogates and ESC (which starts an escape sequence) are skipped.
		const assigned = /^\p{Assigned}$/u;
		const mismatches: string[] = [];
		let checked = 0;
		for (let cp = 0; cp <= 0x10ffff; cp++) {
			if ((cp >= 0xd800 && cp <= 0xdfff) || cp === 0x1b) continue;
			// Documented divergence: a lone regional indicator is 1 for the oracle and 2 here.
			if (cp >= 0x1f1e6 && cp <= 0x1f1ff) continue;
			const ch = String.fromCodePoint(cp);
			if (!assigned.test(ch)) continue;
			checked++;
			if (displayWidth(ch) !== stringWidth(ch)) {
				mismatches.push(`U+${cp.toString(16).toUpperCase()} ours=${displayWidth(ch)} oracle=${stringWidth(ch)}`);
			}
		}
		// Well over the ~297,000 assigned code points outside the skipped ones: a sweep that quietly shrank would fail.
		assert.isAbove(checked, 290_000);
		assert.deepStrictEqual(mismatches.slice(0, 10), []);
		assert.strictEqual(mismatches.length, 0);
		// About a second alone; the bound leaves room for a loaded machine running other suites in parallel.
	}, 30_000);

	it("pins the two documented divergences", () => {
		// A lone regional indicator: the oracle counts one column, this counts two.
		assert.strictEqual(stringWidth("\u{1F1FA}"), 1);
		assert.strictEqual(displayWidth("\u{1F1FA}"), 2);
		// A bare combining mark glued after a flag grapheme: the oracle folds the whole grapheme to one column,
		// this counts two.
		assert.strictEqual(stringWidth("🇺🇸ั"), 1);
		assert.strictEqual(displayWidth("🇺🇸ั"), 2);
	});

	it("a seeded fuzz of 5,000 compositions agrees", () => {
		// Every curated string is an atom but the empty one. A free-standing combining mark glued after an emoji or
		// flag is the documented divergence, and none of these atoms is one.
		const atoms = CURATED.map(([, text]) => text).filter((text) => text !== "");
		// mulberry32, fixed seed: the run never varies.
		let state = 0x5eed1234;
		const next = (): number => {
			state = (state + 0x6d2b79f5) | 0;
			let t = Math.imul(state ^ (state >>> 15), 1 | state);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		const mismatches: string[] = [];
		for (let i = 0; i < 5000; i++) {
			const length = 1 + Math.floor(next() * 6);
			let text = "";
			for (let j = 0; j < length; j++) text += atoms[Math.floor(next() * atoms.length)];
			if (displayWidth(text) !== stringWidth(text)) mismatches.push(JSON.stringify(text));
		}
		assert.deepStrictEqual(mismatches.slice(0, 5), []);
	});
});
