import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliColor } from "../../effected/cli/CliColor.ts";

it.effect("CliColor retains its runtime class identity", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(CliColor, []) instanceof CliColor);
}));
