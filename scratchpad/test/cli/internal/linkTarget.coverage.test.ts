import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { encodePath, fileUrlPath } from "../../../effected/cli/internal/linkTarget.ts";
it.effect("a relative backslash path is rooted and encoded, while reserved punctuation is data", () => Effect.sync(() => {
  assert.strictEqual(fileUrlPath("src\\a b.ts"), "/src/a%20b.ts");
  assert.strictEqual(encodePath("/!'()*"), "/%21%27%28%29%2A");
}));
