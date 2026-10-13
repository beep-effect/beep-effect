import { assert, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { ActionInput } from "../../effected/github-actions/ActionInput.ts";
it.effect("input-name collisions retain the first present value", () => Effect.gen(function* () {
  const provider = ActionInput.provider({ "a b": "first", a_b: "second", absent: undefined });
  assert.strictEqual(yield* Effect.provideService(ActionInput.string("a b"), ConfigProvider.ConfigProvider, provider), "first");
}));
it.effect("provider accepts numeric and empty config paths through its ambient lookup", () => Effect.gen(function* () {
  const provider = ActionInput.provider({ "0": "zero", "": "root" });
  assert.deepStrictEqual(yield* provider.load([0]), ConfigProvider.makeValue("zero"));
  assert.deepStrictEqual(yield* provider.load([]), ConfigProvider.makeValue("root"));
  const over = ActionInput.providerOver(provider);
  assert.deepStrictEqual(yield* over.load([0]), ConfigProvider.makeValue("zero"));
  assert.strictEqual(yield* Effect.provideService(Config.String("0"), ConfigProvider.ConfigProvider, provider), "zero");
}));

it.effect("static input facade retains its runtime constructor", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(ActionInput, []) instanceof ActionInput);
}));
