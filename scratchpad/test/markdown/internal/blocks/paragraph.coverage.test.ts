import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { paragraphConstruct } from "../../../../effected/markdown/internal/blocks/paragraph.ts";
it.effect("paragraph rejects block children", () => Effect.sync(() => {
  assert.strictEqual(paragraphConstruct.canContain("paragraph"), false);
}));
