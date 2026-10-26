import { ActionsIdentityToken } from "@beep/github-actions/ActionsIdentityToken";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("the adapter namespace constructor has no runtime side effects", () =>
  Effect.sync(() => {
    assert.strictEqual(
      Object.getPrototypeOf(Reflect.construct(ActionsIdentityToken, [])),
      ActionsIdentityToken.prototype
    );
  })
);
