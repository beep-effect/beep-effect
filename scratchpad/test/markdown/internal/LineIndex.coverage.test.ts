import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { InvalidLineTableError, LineIndex } from "../../../effected/markdown/internal/lineIndex.ts";
it.effect("validates the initial line offset and locates bare-CR lines with the supplied table", () => Effect.sync(() => {
  assert.throws(() => LineIndex.fromLineStarts("x", []), InvalidLineTableError);
  assert.throws(() => LineIndex.fromLineStarts("x", [1]), InvalidLineTableError);
  const index = LineIndex.fromLineStarts("a\rb\nc", [0, 2, 4]);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((offset) => index.positionAt(offset)), [
    { line: 1, column: 1 }, { line: 1, column: 2 }, { line: 2, column: 1 },
    { line: 2, column: 2 }, { line: 3, column: 1 }, { line: 3, column: 2 },
  ]);
}));
