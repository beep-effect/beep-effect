import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { MAX_NESTING_DEPTH } from "../../../effected/markdown/internal/limits.ts";
it.effect("pins the shared parser nesting boundary", () => Effect.sync(() => {
  assert.strictEqual(MAX_NESTING_DEPTH, 256);
}));
