import { A } from "@beep/utils";
import {
  CustomEntityExample,
  EntityGroupName,
  WinkEngine,
  WinkEngineCustomEntities,
  WinkEngineLive,
  WinkEngineRef,
  WinkEngineRefLive,
} from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as O from "effect/Option";

const WinkEngineRefBundleLive = WinkEngineRefLive.pipe(Layer.provideMerge(WinkEngineLive));

const moneyEntities = WinkEngineCustomEntities.make({
  name: EntityGroupName.make("money"),
  patterns: [
    CustomEntityExample.make({
      mark: O.none(),
      name: "MONEY_PATTERN",
      patterns: ["[$]", "[100|200]"],
    }),
  ],
});

describe("WinkEngineRef", () => {
  it.layer(WinkEngineRefBundleLive)("returns one shared ref instance per provided live layer", (it) => {
    it.effect("returns one shared ref instance per provided live layer", () =>
      Effect.gen(function* () {
        const refService1 = yield* WinkEngineRef;
        const refService2 = yield* WinkEngineRef;
        const ref1 = refService1.getRef();
        const ref2 = refService2.getRef();

        expect(ref1).toBe(ref2);

        const state1 = yield* Ref.get(ref1);
        const state2 = yield* Ref.get(ref2);

        expect(state1.instanceId).toBe(state2.instanceId);
      })
    );
  });

  it.layer(WinkEngineRefBundleLive)("tracks engine updates through the shared runtime ref", (it) => {
    it.effect("tracks engine updates through the shared runtime ref", () =>
      Effect.gen(function* () {
        const engine = yield* WinkEngine;
        const refService = yield* WinkEngineRef;
        const stateRef = refService.getRef();
        const initialState = yield* Ref.get(stateRef);

        yield* engine.learnCustomEntities(moneyEntities);

        const updatedState = yield* Ref.get(stateRef);
        const tokens = yield* engine.getWinkTokens("I have $100 today.");

        expect(updatedState.instanceId).not.toBe(initialState.instanceId);
        expect(updatedState.customEntities._tag).toBe("Some");
        expect(O.getOrThrow(updatedState.customEntities).name).toBe("money");
        expect(A.map(tokens, (token) => token.out())).toContain("$");
      })
    );
  });
});
