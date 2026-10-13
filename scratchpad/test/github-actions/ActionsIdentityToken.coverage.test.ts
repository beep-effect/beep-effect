import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionsIdentityToken } from "../../effected/github-actions/ActionsIdentityToken.ts";
it.effect("the adapter namespace constructor has no runtime side effects", () => Effect.sync(() => {
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(ActionsIdentityToken, [])), ActionsIdentityToken.prototype);
}));
