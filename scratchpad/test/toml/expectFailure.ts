import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";

/** Return the typed failure, failing the test if the effect succeeds. */
export const expectFailure = Effect.fn("toml.test.expectFailure")(<A, E, R>(self: Effect.Effect<A, E, R>) =>
	Effect.match(self, {
		onFailure: identity,
		onSuccess: () => assert.fail("expected the effect to fail"),
	}),
);
