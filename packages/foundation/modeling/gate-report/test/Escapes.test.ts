// The escape pattern every console text and stray-output sample is cleaned with.
import { stripEscapes } from "@beep/gate-report/Escapes";
import { assert, describe, it } from "@effect/vitest";

describe("stripEscapes", () => {
  it("removes colours in the ESC [ and the one-byte C1 form", () => {
    assert.strictEqual(stripEscapes("\u001b[1;31mred\u001b[0m \u009b32mgreen\u009b39m"), "red green");
  });

  it("removes a hyperlink ended by BEL or by ST, keeping its text", () => {
    assert.strictEqual(stripEscapes("\u001b]8;;https://x.dev\u0007a\u001b]8;;\u001b\\"), "a");
  });

  it("removes cursor moves, screen clears, a character-set designation and the ESC c full reset", () => {
    assert.strictEqual(stripEscapes("\u001bc\u001b[3J\u001b[?25lx\u001bM\u001b7\u001b(B"), "x");
  });

  it("keeps other control characters and plain text", () => {
    assert.strictEqual(stripEscapes("a\tb\u0007"), "a\tb\u0007");
  });
});
