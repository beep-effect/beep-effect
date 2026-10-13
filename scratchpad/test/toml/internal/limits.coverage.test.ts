import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { assertCap } from "../../../effected/toml/internal/limits.ts";

it.effect("caps accept positive safe integers in either call form and reject invalid bounds", () => Effect.sync(() => {
  assert.strictEqual(assertCap("depth", 1), 1);
  assert.strictEqual(assertCap(256)("depth"), 256);
  for (const value of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => assertCap("depth", value), /@effected\/toml internal cap depth must be a positive integer/);
  }
}));
