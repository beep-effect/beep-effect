import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { deepEqual } from "../../../effected/yaml/internal/equal.ts";

it.effect("compares primitives, null, NaN, arrays and recursive key sets", () => Effect.sync(() => {
  const cases: ReadonlyArray<readonly [unknown, unknown, boolean]> = [
    [undefined, undefined, true], [null, null, true], [0, -0, true], [1, "1", false],
    [Number.NaN, Number.NaN, true], [Number.NaN, 1, false], [1, Number.NaN, false],
    [null, {}, false], [{}, null, false], [[], {}, false], [{}, [], false],
    [[], [1], false], [[1, 2], [2, 1], false], [[{ a: 1 }], [{ a: 1 }], true],
    [{ a: 1 }, {}, false], [{ a: 1 }, { b: 1 }, false], [{ a: 1 }, { a: 2 }, false],
    [{ a: [1], b: { c: 2 } }, { b: { c: 2 }, a: [1] }, true], [{}, 1, false], [1, {}, false],
  ];
  for (const [left, right, expected] of cases) assert.strictEqual(deepEqual(left, right), expected);
  assert.isFalse(deepEqual({ a: undefined }, Object.create({ a: undefined })));
}));
