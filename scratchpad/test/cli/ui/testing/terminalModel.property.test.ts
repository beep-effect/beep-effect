import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { screenAfter } from "../../../../effected/cli/ui/testing/terminalModel.ts";

const runs = { arbitrary: fcRuns(100) };
const text = S.Literals(["a", "Z", "0", " ", "é", "界"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));
const transcript = S.Literals([
  "a", "b", " ", "é", "界", "\n", "\r", "\t", "\u001b[A", "\u001b[2A", "\u001b[G",
  "\u001b[2K", "\u001b[2J", "\u001b[3J", "\u001b[H", "\u001b[2;4H", "\u001b[;H",
  "\u001b[31m", "\u001b[?25l", "\u001b]8;;url\u0007", "\u001b]8;;\u001b\\",
]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));
const height = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 1, maximum: 10 })));

describe("terminalModel property floor", () => {
  it.effect.prop("overwriting either cell of a wide grapheme preserves the suffix", [
    Arbitrary.schema(S.Literals(["😀", "界", "👨‍👩‍👧‍👦", "🇺🇸"])),
    text,
  ], ([wide, suffix]) => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter(`${wide}${suffix}\rA`), screenAfter(`A ${suffix}`));
    assert.deepStrictEqual(screenAfter(`${wide}${suffix}\u001b[1;2HA`), screenAfter(` A${suffix}`));
    assert.deepStrictEqual(screenAfter(`${wide}${suffix}\u001b[2GA`), screenAfter(` A${suffix}`));
  }), runs);

  it.effect.prop("canonical screen text is idempotent and preserves the parsed screen on reparse", [transcript, height], ([written, rows]) => Effect.sync(() => {
    const parsed = screenAfter(written, rows);
    const formatted = parsed.join("\n");
    const reparsed = screenAfter(formatted, rows);
    assert.deepStrictEqual(reparsed, parsed);
    assert.strictEqual(reparsed.join("\n"), formatted);
    assert.deepStrictEqual(screenAfter(written), screenAfter(screenAfter(written).join("\n")));
  }), runs);

  it.effect.prop("plain text remains unwrapped and preserves every nonempty line except trailing spaces", [text, text, height], ([first, second, rows]) => Effect.sync(() => {
    const expected = [first.trimEnd(), second.trimEnd()].filter((line) => line !== "");
    assert.deepStrictEqual(screenAfter(`${first}\n${second}`, rows), expected);
    assert.deepStrictEqual(screenAfter(rows)(`${first}\n${second}`), expected);
  }), runs);

  it.effect.prop("OSC hyperlinks and ignored CSI decorations preserve visible text", [text], ([value]) => Effect.sync(() => {
    const expected = screenAfter(value);
    assert.deepStrictEqual(screenAfter(`\u001b]8;;url\u0007\u001b[31m${value}\u001b[0m\u001b]8;;\u001b\\`), expected);
  }), runs);

  it.effect.prop("clear screen, clear scrollback and home replace all previous output", [transcript, text, height], ([written, next, rows]) => Effect.sync(() => {
    assert.deepStrictEqual(screenAfter(`${written}\u001b[2J\u001b[3J\u001b[H${next}`, rows), screenAfter(next));
  }), runs);
});
