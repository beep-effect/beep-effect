import { it } from "@beep/test-runner";
import { WinkEngineLive, WinkIntrinsicNounActivationError } from "@beep/wink";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { vi } from "vitest";

const observed = vi.hoisted(() => ({ constructorCalls: 0 }));
vi.mock("wink-nlp", (importOriginal) =>
  Promise.all([importOriginal<typeof import("wink-nlp")>(), import("wink-eng-lite-web-model")]).then(
    ([actual, { default: model }]) => ({
      ...actual,
      default: () => {
        observed.constructorCalls++;
        return actual.default(model);
      },
    })
  )
);

it.effect("the actual live engine layer preserves an uncaptured-core activation refusal", () =>
  Effect.gen(function* () {
    const result = yield* WinkEngineLive.pipe(Layer.build, Effect.result, Effect.scoped);
    assert.strictEqual(
      observed.constructorCalls,
      1,
      "the protocol-negative SDK ignores the adapter, yet the pinned SDK and model construct once"
    );
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
