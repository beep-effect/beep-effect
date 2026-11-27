import { displayWidth } from "@beep/cli-kit/internal/displayWidth";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { identity, pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import stringWidth from "string-width";

const UnknownJson = S.fromJsonString(S.Unknown);

const OSC8 = "\u001b]8;;https://example.com\u0007link\u001b]8;;\u0007";

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

const sweepTimeoutOnLoadedMachine = 30_000;
const ARABIC_NUMBER_SIGN = "\u0600";
const KAITHI_NUMBER_SIGN = "\u{110BD}";
const SYRIAC_ABBREVIATION_MARK = "\u070F";

const isSurrogateOrEscape = (cp: number): boolean => (cp >= 0xd800 && cp <= 0xdfff) || cp === 0x1b;

describe("displayWidth against string-width, the package's only importer of that devDependency", () => {
  it("the oracle is the version the decision was measured against", () => {
    assert.strictEqual(
      stringWidth("⚠"),
      1,
      "7.2.0 said 2 for a bare U+26A0, 8.3.0 and 9.0.0 say 1: a flip means string-width drifted from the measured oracle"
    );
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

  it(
    "a stride-1 sweep of every assigned code point agrees, so no block edge or astral zero-width range escapes",
    () => {
      const assigned = /^\p{Assigned}$/u;
      const mismatches: string[] = [];
      let checked = 0;
      for (let cp = 0; cp <= 0x10ffff; cp++) {
        if (isSurrogateOrEscape(cp)) continue;
        const ch = String.fromCodePoint(cp);
        if (!assigned.test(ch)) continue;
        checked++;
        if (displayWidth(ch) !== stringWidth(ch)) {
          mismatches.push(`U+${Str.toUpperCase(cp.toString(16))} ours=${displayWidth(ch)} oracle=${stringWidth(ch)}`);
        }
      }
      assert.isAbove(
        checked,
        290_000,
        "about 297,000 code points are assigned outside the skipped ones: a sweep must not shrink"
      );
      assert.deepStrictEqual(mismatches.slice(0, 10), []);
      assert.strictEqual(mismatches.length, 0);
    },
    sweepTimeoutOnLoadedMachine
  );

  it("agrees on the former divergences and on prepended concatenation marks", () => {
    const cases: ReadonlyArray<readonly [text: string, columns: number]> = [
      ["\u{1F1FA}", 2],
      ["🇺🇸ั", 2],
      [ARABIC_NUMBER_SIGN, 1],
      [`${ARABIC_NUMBER_SIGN}1`, 2],
      [`${ARABIC_NUMBER_SIGN}${ARABIC_NUMBER_SIGN}1`, 3],
      [`${ARABIC_NUMBER_SIGN}\u0301`, 1],
      [`${ARABIC_NUMBER_SIGN}日`, 2],
      [`${ARABIC_NUMBER_SIGN}👍`, 2],
      [KAITHI_NUMBER_SIGN, 1],
      [SYRIAC_ABBREVIATION_MARK, 0],
    ];
    for (const [text, columns] of cases) {
      assert.strictEqual(
        stringWidth(text),
        columns,
        `string-width 9.0.0 pinned (8.3.0 gave one column to a lone regional indicator or a mark after a flag): ${text}`
      );
      assert.strictEqual(displayWidth(text), columns, text);
    }
  });

  it("a seeded fuzz of 5,000 compositions agrees", () => {
    const atoms = pipe(
      CURATED,
      A.map(([, text]) => text),
      A.filter((text) => text !== "")
    );
    let state = 0x5eed1234;
    const mulberry32 = (): number => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const mismatches: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const length = 1 + Math.floor(mulberry32() * 6);
      let text = "";
      for (let j = 0; j < length; j++) text += atoms[Math.floor(mulberry32() * atoms.length)];
      if (displayWidth(text) !== stringWidth(text))
        mismatches.push(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(text), identity));
    }
    assert.deepStrictEqual(mismatches.slice(0, 5), []);
  });
});
