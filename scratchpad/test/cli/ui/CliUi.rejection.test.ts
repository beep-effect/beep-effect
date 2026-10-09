import { assert, describe, it, vi } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";

// Ink whose waitUntilExit rejects at once, as it does when the app crashes outside any boundary.
// Ink is a third-party renderer without an Effect service seam; the subject imports it after this mock is installed.
vi.doMock("ink", (importOriginal) =>
	importOriginal<typeof import("ink")>().then((actual) => ({
		...actual,
		render: (...args: Parameters<typeof actual.render>) => {
			const instance = actual.render(...args);
			return { ...instance, waitUntilExit: () => Promise.reject(new Error("ink crashed")) };
		},
	})),
);

describe("CliUi.run when Ink's exit rejects", () => {
	it.layer(CliTheme.layerTest(), { excludeTestServices: true, timeout: "30 seconds" })((it) => {
		// Live clock keeps the two-second hang guard active while Ink settles its rejected exit promise.
		it.effect("dies with the rejection, never hangs", () =>
			Effect.gen(function* () {
				const { createElement } = yield* Effect.promise(() => import("react"));
				const { Text } = yield* Effect.promise(() => import("ink"));
				const { CliInteractive } = yield* Effect.promise(() => import("../../../effected/cli/index.ts"));
				const { CliUi, UiStreams } = yield* Effect.promise(() => import("../../../effected/cli/ui.ts"));
				const { makeFakeStreams } = yield* Effect.promise(() => import("../../../effected/cli/ui/testing/fakeStreams.ts"));
				const fake = makeFakeStreams();
				const exit = yield* Effect.exit(
					CliUi.run(() => createElement(Text, null, "doomed")).pipe(
						Effect.provideService(UiStreams, fake.streams),
						Effect.provideService(CliInteractive, true),
						Effect.timeout("2 seconds"),
					),
				);
				assertExitFailure(exit, Exit.match(exit, { onSuccess: () => Cause.empty, onFailure: identity }));
				assert.isTrue(Cause.hasDies(exit.cause), "a defect");
				assert.isFalse(Cause.hasFails(exit.cause), "not a typed failure, and not the timeout");
				const defect = Cause.squash(exit.cause);
				assert.strictEqual(defect instanceof Error ? defect.message : "", "ink crashed");
			}),
		);
	});
});
