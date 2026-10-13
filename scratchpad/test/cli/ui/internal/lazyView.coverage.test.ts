import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { createElement } from "react";
import type { ReactElement } from "react";
import { lazyView, loadView } from "../../../../effected/cli/ui/internal/lazyView.ts";
import { deliberatelyInvalid } from "../../deliberatelyInvalid.ts";

type View = (state: string, frame: number) => ReactElement;
describe("lazy view invalid module diagnostics", () => {
  it.effect("describes each invalid kind and retains deterministic rejection identity", () => Effect.gen(function* () {
    const samples: ReadonlyArray<readonly [unknown, string]> = [
      [null, "null"], [[], "no default export"], ["x", "string"], [1, "number"], [true, "boolean"], [1n, "bigint"], [Symbol("x"), "symbol"], [undefined, "undefined"],
      [{ default: [], named: 1 }, "an array"], [{ default: {}, named: 1 }, "an object"], [{ default: null }, "null"], [new (class { get default() { return undefined; } })(), "no default export"], [{ named: 1 }, "it exports named"],
    ];
    for (const [value, expected] of samples) {
      const view = lazyView(() => Promise.resolve(deliberatelyInvalid<View | { readonly default: View }>(value)));
      const first = yield* Effect.flip(loadView(view));
      const second = yield* Effect.flip(loadView(view));
      assert.strictEqual(first.cause, second.cause);
      assert.instanceOf(first.cause, Error);
      if (first.cause instanceof Error) assert.include(first.cause.message, expected);
    }
  }));
  it.effect("reports a module accessor that changes from invalid data to a function", () => Effect.gen(function* () {
    let reads = 0;
    const module = { get default() { reads += 1; return reads === 1 ? undefined : () => createElement("text"); } };
    const view = lazyView(() => Promise.resolve(deliberatelyInvalid<{ readonly default: View }>(module)));
    const failure = yield* Effect.flip(loadView(view));
    assert.instanceOf(failure.cause, Error);
    if (failure.cause instanceof Error) assert.include(failure.cause.message, "default export is function");
  }));
  it.effect("rejects malformed loader metadata and accepts missing metadata", () => Effect.gen(function* () {
    const failure = yield* Effect.flip(loadView({ [Symbol.for("@effected/cli/ui/lazyView")]: 42 }));
    assert.instanceOf(failure.cause, Error);
    if (failure.cause instanceof Error) assert.strictEqual(failure.cause.message, "lazy view loader is not a function");
    yield* loadView(null); yield* loadView({ [Symbol.for("@effected/cli/ui/lazyView")]: undefined });
    const view = lazyView(() => Promise.resolve({ default: (state: string, frame: number) => createElement("text", null, `${state}:${frame}`) }));
    assert.throws(() => view("early", 0), /before its module loaded/);
    yield* loadView(view);
    assert.deepStrictEqual(view("ready", 7), createElement("text", null, "ready:7"));
  }));
});
