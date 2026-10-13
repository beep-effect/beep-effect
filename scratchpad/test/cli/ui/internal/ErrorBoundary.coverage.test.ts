import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { errorBoundary } from "../../../../effected/cli/ui/internal/ErrorBoundary.ts";
import { loadInk } from "../../../../effected/cli/ui/internal/ink.ts";

it.effect("an empty boundary renders nothing before and after failure, including an empty fallback", () =>
  Effect.gen(function* () {
    yield* loadInk;
    const Boundary = errorBoundary();
    const errors: Array<unknown> = [];
    const boundary = new Boundary({ onError: (error) => { errors.push(error); } });
    assert.isNull(boundary.render());
    boundary.state = { failed: true };
    assert.isNull(boundary.render());
    const emptyFallback = new Boundary({ onError: () => undefined, fallback: () => undefined });
    emptyFallback.state = { failed: true };
    assert.isNull(emptyFallback.render());
    const failure = new Error("descendant");
    boundary.componentDidCatch?.(failure, { componentStack: "" });
    assert.deepStrictEqual(errors, [failure]);
  }),
);
