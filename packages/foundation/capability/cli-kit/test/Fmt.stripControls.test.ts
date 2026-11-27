import { Fmt, sanitize, stripControls } from "@beep/cli-kit/Fmt";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ESC = "\u001B";
const C0_DEL_OR_C1_CONTROL = /[\u0000-\u001F\u007F-\u009F]/u;

describe("Fmt.stripControls", () => {
  it("removes an OSC 8 hyperlink with either terminator, and an OSC 52 clipboard write", () => {
    assert.strictEqual(stripControls(`${ESC}]8;;https://evil.test\u0007click${ESC}]8;;\u0007`), "click");
    assert.strictEqual(stripControls(`${ESC}]8;;https://evil.test${ESC}\\click${ESC}]8;;${ESC}\\`), "click");
    assert.strictEqual(stripControls(`${ESC}]52;c;aGVsbG8=\u0007copied`), "copied");
  });

  it("removes CSI sequences with parameters and intermediates, and two-byte ESC sequences", () => {
    assert.strictEqual(stripControls(`${ESC}[31mred${ESC}[0m`), "red");
    assert.strictEqual(stripControls(`${ESC}[?25l${ESC}[2J${ESC}[H${ESC}[1;2'zx`), "x");
    assert.strictEqual(stripControls(`${ESC}M${ESC}_${ESC}@ok`), "ok");
    assert.strictEqual(
      stripControls(`${ESC}c${ESC}7ok`),
      "c7ok",
      "an ESC before a byte outside @ through _ loses only the ESC, as in both copies it replaced"
    );
  });

  it("removes line breaks, tabs, NUL, DEL and C1 controls, which sanitize keeps or rewrites", () => {
    assert.strictEqual(stripControls("mallory\r\n[yeet] approved"), "mallory[yeet] approved");
    assert.strictEqual(stripControls("a\tb\u0000c\u007Fd\u0085e\u009B31mf"), "abcde31mf");
    assert.strictEqual(sanitize("a\nb\tc"), "a\nb c", "control: sanitize keeps the line feed and spaces the tab");
  });

  it("an unterminated OSC loses only its introducer, so its text stays visible and inert", () => {
    assert.strictEqual(stripControls(`before ${ESC}]8;;https://x`), "before 8;;https://x");
  });

  it("keeps printable text whole, wide characters, emoji and combining marks included", () => {
    assert.strictEqual(stripControls("界 👨‍👩‍👧 é"), "界 👨‍👩‍👧 é");
    assert.strictEqual(Fmt.stripControls, stripControls);
  });
});

const hostile = S.Array(
  S.Literals([
    ESC,
    "]",
    "[",
    "\\",
    "\u0007",
    "\r",
    "\n",
    "\t",
    "\u0085",
    "\u009B",
    "\u007F",
    "0",
    ";",
    "m",
    "a",
    "界",
    "🙂",
  ])
).pipe(Arbitrary.schema, Arbitrary.map(A.join("")));

it.effect.prop(
  "the result never carries a control character, is idempotent, and is never longer than its input",
  [hostile],
  ([text]) =>
    Effect.sync(() => {
      const once = stripControls(text);
      assert.isFalse(C0_DEL_OR_C1_CONTROL.test(once));
      assert.strictEqual(stripControls(once), once);
      assert.isAtMost(Str.length(once), Str.length(text));
    }),
  { arbitrary: fcRuns(200) }
);
