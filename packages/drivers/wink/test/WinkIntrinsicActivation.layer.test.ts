import { it } from "@beep/test-runner";
import { WinkEngineLive, WinkIntrinsicNounActivationError } from "@beep/wink";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { vi } from "vitest";

const observed = vi.hoisted(() => ({ constructorCalls: 0 }));
// A protocol-negative SDK deliberately ignores the supplied adapter. The real
// pinned SDK/model still construct once; the owner must reject the uncaptured core.
vi.mock("wink-nlp", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const actual = yield* Effect.promise(() => vi.importActual<typeof import("wink-nlp")>("wink-nlp"));
      const { default: model } = yield* Effect.promise(() => import("wink-eng-lite-web-model"));
      return {
        ...actual,
        default: () => {
          observed.constructorCalls++;
          return actual.default(model);
        },
      };
    })
  )
);

it.effect("the actual live engine layer preserves an uncaptured-core activation refusal", () =>
  Effect.gen(function* () {
    const result = yield* WinkEngineLive.pipe(Layer.build, Effect.result, Effect.scoped);
    assert.strictEqual(observed.constructorCalls, 1);
    assert.strictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      assert.strictEqual(S.is(WinkIntrinsicNounActivationError)(result.failure), true);
      assert.strictEqual(result.failure._tag, "WinkIntrinsicNounActivationError");
      if (result.failure._tag === "WinkIntrinsicNounActivationError") {
        assert.strictEqual(result.failure.reason, "core-owner");
        assert.strictEqual(result.failure.cause, "fixed engine did not construct exactly one core");
      }
    }
  })
);
