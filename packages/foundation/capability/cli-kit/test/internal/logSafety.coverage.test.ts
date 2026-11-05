import { sanitizeParts, TrustedLine, underActionsIn } from "@beep/cli-kit/internal/logSafety";
import { CurrentRuntimeEnv } from "@beep/runtime-env";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

it.effect("message scalars stay intact and actions detection follows the logging fiber context", () =>
  Effect.gen(function* () {
    const TrustedLine1 = yield* TrustedLine;
    assert.strictEqual(TrustedLine1, false);
    const object = { text: "\u001b[31mkept as data" };
    assert.strictEqual(sanitizeParts(object), object);
    assert.strictEqual(sanitizeParts(12), 12);
    assert.strictEqual(sanitizeParts("\u001b[31mred\u001b[0m"), "red");
    assert.deepStrictEqual(sanitizeParts(["\u001b[31mred", object, null]), ["red", object, null]);
    const inspect = Effect.withFiber((fiber) => Effect.succeed(fiber.pipe(underActionsIn)));
    const inspect2 = yield* inspect;
    assert.strictEqual(inspect2, false);
    const actions = yield* Layer.build(CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") }));
    const pipe3 = yield* inspect.pipe(Effect.provideContext(actions));
    assert.strictEqual(pipe3, true);
    const generic = yield* Layer.build(CurrentRuntimeEnv.layerTest({ ci: O.some("generic") }));
    const pipe4 = yield* inspect.pipe(Effect.provideContext(generic));
    assert.strictEqual(pipe4, false);
  })
);
