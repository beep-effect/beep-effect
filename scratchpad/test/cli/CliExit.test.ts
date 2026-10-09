import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, MutableRef } from "effect";
import { CliExit } from "../../effected/cli/index.ts";

describe("CliExit", () => {
	it.effect("starts at 0", () =>
		Effect.gen(function* () {
			const exit = yield* CliExit;
			assert.strictEqual(MutableRef.get(exit.code), 0);
		}).pipe(Effect.provide(CliExit.layer)),
	);

	it.effect("keeps the highest code set during the run", () =>
		Effect.gen(function* () {
			yield* CliExit.set(1);
			yield* CliExit.set(2);
			yield* CliExit.set(1);
			const exit = yield* CliExit;
			assert.strictEqual(MutableRef.get(exit.code), 2);
		}).pipe(Effect.provide(CliExit.layer)),
	);

	it.effect("each layer build is a fresh cell", () =>
		Effect.gen(function* () {
			yield* CliExit.set(2).pipe(Effect.provide(CliExit.layer));
			const exit = yield* CliExit;
			assert.strictEqual(MutableRef.get(exit.code), 0);
		}).pipe(Effect.provide(CliExit.layer)),
	);

	for (const bad of [256, 1.5, Number.NaN, -1]) {
		it.effect(`dies on ${bad}: an exit code must be an integer 0..255`, () =>
			Effect.gen(function* () {
				const exit = yield* CliExit.set(bad).pipe(Effect.exit, Effect.provide(CliExit.layer));
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// A defect, not a typed failure: a bad code is a wiring bug.
					assert.isTrue(Cause.hasDies(exit.cause));
					assert.isFalse(Cause.hasFails(exit.cause));
					const defect = Cause.squash(exit.cause);
					assert.instanceOf(defect, Error);
					assert.strictEqual(
						(defect as Error).message,
						`CliExit.set: exit code must be an integer 0..255, received ${bad}`,
					);
				}
			}),
		);
	}

	it.effect("accepts the boundaries 0 and 255", () =>
		Effect.gen(function* () {
			yield* CliExit.set(0);
			yield* CliExit.set(255);
			const exit = yield* CliExit;
			assert.strictEqual(MutableRef.get(exit.code), 255);
		}).pipe(Effect.provide(CliExit.layer)),
	);
});
