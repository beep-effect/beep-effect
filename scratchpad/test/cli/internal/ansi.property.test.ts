import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Style } from "../../../effected/cli/Token.ts";
import { nearest256, openSequence, paintStyle, parseHex } from "../../../effected/cli/internal/ansi.ts";
import { stripAnsi } from "../../../effected/cli/internal/displayWidth.ts";
const runs = { arbitrary: fcRuns(100) };
const channel = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 }));
const rgb = S.Tuple([channel, channel, channel]);
const hexOf = (value: readonly [number, number, number]): `#${string}` => `#${value.map(n => n.toString(16).padStart(2, "0")).join("")}`;
it.effect.prop("hex parsing has canonical idempotence and parse/stringify fidelity", [Arbitrary.schema(rgb)], ([value]) => Effect.sync(() => {
  const text = hexOf(value);
  const parsed = parseHex(text);
  assert.deepStrictEqual(parsed, value);
  if (parsed === undefined) return assert.fail("valid RGB did not parse");
  assert.deepStrictEqual(parseHex(hexOf(parsed)), parsed);
  assert.strictEqual(hexOf(parsed), text);
  const index = nearest256(parsed);
  assert.isAtLeast(index, 16); assert.isAtMost(index, 255);
}), runs);
it.effect.prop("painting preserves text and is stable after removing prior paint; none is identity", [Arbitrary.schema(Style), Arbitrary.schema(S.String), Arbitrary.schema(S.Literals(["basic", "256", "truecolor"]))], ([style, input, level]) => Effect.sync(() => {
  const text = stripAnsi(input);
  const painted = paintStyle(style, level, text);
  assert.strictEqual(stripAnsi(painted), text);
  assert.strictEqual(paintStyle(style, level, stripAnsi(painted)), painted);
  assert.strictEqual(paintStyle(style, "none", input), input);
  assert.strictEqual(openSequence(style, level), openSequence(level)(style));
  assert.strictEqual(painted, paintStyle(level, text)(style));
}), runs);

const cubeLevels = [0, 95, 135, 175, 215, 255] as const;
const distance = (left: readonly [number, number, number], right: readonly [number, number, number]) =>
  (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2;
it.effect.prop("256-color formatting selects the minimum RGB distance over the complete cube and gray ramp", [Arbitrary.schema(rgb)], ([value]) => Effect.sync(() => {
  const colors: Array<readonly [number, readonly [number, number, number]]> = [];
  for (const [r, red] of cubeLevels.entries()) {
    for (const [g, green] of cubeLevels.entries()) {
      for (const [b, blue] of cubeLevels.entries()) colors.push([16 + 36 * r + 6 * g + b, [red, green, blue]]);
    }
  }
  for (let step = 0; step < 24; step++) {
    const gray = 8 + 10 * step;
    colors.push([232 + step, [gray, gray, gray]]);
  }
  const index = nearest256(value);
  const selected = colors.find(([candidate]) => candidate === index);
  if (selected === undefined) return assert.fail("formatter returned an index outside its palettes");
  for (const [, color] of colors) assert.isAtMost(distance(value, selected[1]), distance(value, color));
  assert.strictEqual(openSequence({ fg: hexOf(value) }, "256"), `\x1b[38;5;${index}m`);
}), runs);

const nibble = S.Int.check(S.isBetween({ minimum: 0, maximum: 15 }));
it.effect.prop("short hexadecimal colors expand without losing channel values and canonicalize stably", [Arbitrary.schema(S.Tuple([nibble, nibble, nibble]))], ([value]) => Effect.sync(() => {
  const short = `#${value.map(n => n.toString(16)).join("")}`;
  const parsed = parseHex(short);
  assert.deepStrictEqual(parsed, [value[0] * 17, value[1] * 17, value[2] * 17]);
  if (parsed === undefined) return assert.fail("valid short hex did not parse");
  const canonical = hexOf(parsed);
  assert.deepStrictEqual(parseHex(canonical), parsed);
  assert.strictEqual(parseHex(canonical.toUpperCase())?.join(","), parsed.join(","));
}), runs);
