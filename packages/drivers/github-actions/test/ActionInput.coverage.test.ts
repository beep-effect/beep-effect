import { ActionInput } from "@beep/github-actions/ActionInput";
import { assert, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";

it.effect("input-name collisions retain the first present value", () =>
  Effect.gen(function* () {
    const provider = ActionInput.provider({ "a b": "first", a_b: "second", absent: undefined });
    const provideService1 = yield* Effect.provideService(
      ActionInput.string("a b"),
      ConfigProvider.ConfigProvider,
      provider
    );
    assert.strictEqual(provideService1, "first");
  })
);
it.effect("provider accepts numeric and empty config paths through its ambient lookup", () =>
  Effect.gen(function* () {
    const provider = ActionInput.provider({ "0": "zero", "": "root" });
    const loaded = yield* provider.load([0]);
    assert.deepStrictEqual(loaded, ConfigProvider.makeValue("zero"));
    const loaded2 = yield* provider.load([]);
    assert.deepStrictEqual(loaded2, ConfigProvider.makeValue("root"));
    const over = ActionInput.providerOver(provider);
    const loaded3 = yield* over.load([0]);
    assert.deepStrictEqual(loaded3, ConfigProvider.makeValue("zero"));
    const provideService4 = yield* Effect.provideService(Config.String("0"), ConfigProvider.ConfigProvider, provider);
    assert.strictEqual(provideService4, "zero");
  })
);

it.effect("static input facade retains its runtime constructor", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(ActionInput, []) instanceof ActionInput);
  })
);
