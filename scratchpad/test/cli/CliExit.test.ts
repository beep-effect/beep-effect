import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Context from "effect/Context";
import * as Exit from "effect/Exit";
import * as MutableRef from "effect/MutableRef";
import { CliExit } from "../../effected/cli/index.ts";

class OtherExit extends Context.Service<OtherExit, Context.Service.Shape<typeof CliExit>>()(
	"@beep/scratchpad/test/cli/CliExit.test/OtherExit",
) {}

describe("CliExit", () => {
	it.layer(CliExit.layer, { timeout: "30 seconds" })((it) => {
		it.effect("starts at 0", () =>
			Effect.gen(function* () {
				const exit = yield* CliExit;
				assert.strictEqual(MutableRef.get(exit.code), 0);
			}),
		);
	});

	it.layer(CliExit.layer, { timeout: "30 seconds" })((it) => {
		it.effect("keeps the highest code set during the run", () =>
			Effect.gen(function* () {
				yield* CliExit.set(1);
				yield* CliExit.set(2);
				yield* CliExit.set(1);
				const exit = yield* CliExit;
				assert.strictEqual(MutableRef.get(exit.code), 2);
			}),
		);
	});

	it.layer(Layer.merge(CliExit.layer, Layer.effect(OtherExit, CliExit).pipe(Layer.provide(CliExit.layer))), {
		timeout: "30 seconds",
	})((it) => {
		it.effect("each layer build is a fresh cell", () =>
			Effect.gen(function* () {
				yield* Effect.provideService(CliExit.set(2), CliExit, yield* OtherExit);
				const exit = yield* CliExit;
				assert.strictEqual(MutableRef.get(exit.code), 0);
			}),
		);
	});

	for (const bad of [256, 1.5, Number.NaN, -1]) {
		it.layer(CliExit.layer, { timeout: "30 seconds" })((it) => {
			it.effect(`dies on ${bad}: an exit code must be an integer 0..255`, () =>
				Effect.gen(function* () {
					const exit = yield* CliExit.set(bad).pipe(Effect.exit);
					assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
					// A defect, not a typed failure: a bad code is a wiring bug.
					assert.isTrue(Cause.hasDies(exit.cause));
					assert.isFalse(Cause.hasFails(exit.cause));
					const defect = Cause.squash(exit.cause);
					assert.instanceOf(defect, Error);
					assert.strictEqual(defect.message, `CliExit.set: exit code must be an integer 0..255, received ${bad}`);
				}),
			);
		});
	}

	it.layer(CliExit.layer, { timeout: "30 seconds" })((it) => {
		it.effect("accepts the boundaries 0 and 255", () =>
			Effect.gen(function* () {
				yield* CliExit.set(0);
				yield* CliExit.set(255);
				const exit = yield* CliExit;
				assert.strictEqual(MutableRef.get(exit.code), 255);
			}),
		);
	});
});
