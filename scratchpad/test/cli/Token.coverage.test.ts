import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Token } from "../../effected/cli/Token.ts";

it.effect("Token retains its runtime class identity", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(Token, []);
  assert.isTrue(instance instanceof Token);
}));
