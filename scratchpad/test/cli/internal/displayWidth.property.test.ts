import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { displayWidth, graphemes, stripAnsi } from "../../../effected/cli/internal/displayWidth.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("grapheme parsing reconstructs input and survives stringify/reparse", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const parsed = graphemes(text);
  assert.strictEqual(parsed.join(""), text);
  assert.deepStrictEqual(graphemes(parsed.join("")), parsed);
  const visible = stripAnsi(text);
  assert.strictEqual(displayWidth(visible), graphemes(visible).reduce((sum, segment) => sum + displayWidth(segment), 0));
}), runs);
it.effect.prop("stripping is idempotent and ANSI rendering preserves visible text and width", [Arbitrary.schema(S.String)], ([input]) => Effect.sync(() => {
  const text = stripAnsi(input);
  assert.strictEqual(stripAnsi(text), text);
  const painted = `\x1b[31m${text}\x1b[39m`;
  assert.strictEqual(stripAnsi(painted), text);
  assert.strictEqual(displayWidth(painted), displayWidth(text));
}), runs);
