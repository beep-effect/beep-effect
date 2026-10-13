import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ActionsProvenance } from "../../effected/github-actions/ActionsProvenance.ts";
it.effect("the adapter namespace constructor has no runtime side effects", () => Effect.sync(() => {
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(ActionsProvenance, [])), ActionsProvenance.prototype);
}));
