import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CommandNeutralizer } from "../../effected/github-commands/CommandNeutralizer.ts";

describe("CommandNeutralizer runtime construction", () => {
  it.effect("reflective construction creates a stateless instance and preserves static neutralization", () =>
    Effect.sync(() => {
      const instance = Reflect.construct(CommandNeutralizer, []);
      assert.strictEqual(Object.getPrototypeOf(instance), CommandNeutralizer.prototype);
      assert.deepStrictEqual(Object.keys(instance), []);
      assert.strictEqual(CommandNeutralizer.text("::error::x\rprefix ##[warning]y"), "\u200b::error::x\nprefix ##\u200b[warning]y");
    })
  );
});
