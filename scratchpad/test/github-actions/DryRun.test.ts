import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestConsole } from "effect/testing";
import { ActionInput, ActionLogger, DryRun } from "../../effected/github-actions/index.ts";

const lines = Effect.map(TestConsole.logLines, (captured) => captured.map(String));

/** A mutation that records the fact it ran, so "did not run" is observable. */
const mutation = () => {
	const performed: Array<string> = [];
	const effect = Effect.sync(() => {
		performed.push("ran");
		return "real";
	});
	return { performed, effect };
};

describe("DryRun", () => {
	describe("guard", () => {
		it.effect("skips the mutation and takes the fallback when rehearsing", () =>
			Effect.gen(function* () {
				const { performed, effect } = mutation();
				const result = yield* (yield* DryRun).guard("publish", effect, "rehearsed");
				assert.strictEqual(result, "rehearsed");
				assert.deepStrictEqual(performed, [], "a rehearsal must not perform the mutation");
			}).pipe(Effect.provide(DryRun.layerFrom(true))),
		);

		it.effect("reports what it would have done", () =>
			Effect.gen(function* () {
				yield* (yield* DryRun).guard("publish @acme/thing@1.2.3", Effect.succeed("real"), "rehearsed");
				assert.deepStrictEqual(yield* lines, ["[DRY-RUN] publish @acme/thing@1.2.3"]);
			}).pipe(Effect.provide(DryRun.layerFrom(true)), Effect.provide(ActionLogger.layerLogger)),
		);

		it.effect("runs the mutation for real otherwise", () =>
			Effect.gen(function* () {
				const { performed, effect } = mutation();
				const result = yield* (yield* DryRun).guard("publish", effect, "rehearsed");
				assert.strictEqual(result, "real");
				assert.deepStrictEqual(performed, ["ran"]);
				assert.deepStrictEqual(yield* lines, [], "a real run announces nothing");
			}).pipe(Effect.provide(DryRun.layerFrom(false)), Effect.provide(ActionLogger.layerLogger)),
		);

		it.effect("isDryRun reports the mode", () =>
			Effect.gen(function* () {
				assert.isTrue(yield* (yield* DryRun).isDryRun);
			}).pipe(Effect.provide(DryRun.layerFrom(true))),
		);
	});

	describe("driven by the action input", () => {
		const withInput = <A, E>(program: Effect.Effect<A, E, DryRun>, env: Record<string, string>) =>
			program.pipe(Effect.provide(DryRun.layer), Effect.provide(ActionInput.layer(env)));

		it.effect("reads a true input", () =>
			withInput(
				Effect.gen(function* () {
					assert.isTrue(yield* (yield* DryRun).isDryRun);
				}),
				// Input-name keyed, `with:`-block style: the INPUT_ mangling stays
				// inside ActionInput, where a hand-written spelling cannot drift.
				{ "dry-run": "true" },
			),
		);

		it.effect("defaults to a real run when the input is absent", () =>
			withInput(
				Effect.gen(function* () {
					assert.isFalse(yield* (yield* DryRun).isDryRun);
				}),
				{},
			),
		);

		it.effect("defaults to a real run when the input is the empty string the runner writes", () =>
			withInput(
				Effect.gen(function* () {
					assert.isFalse(yield* (yield* DryRun).isDryRun);
				}),
				{ "dry-run": "" },
			),
		);

		it.effect("refuses a malformed input rather than defaulting it away", () =>
			// The discriminating case, and the reason `ActionInput`'s validation
			// errors carry their `actual` value: `Config.withDefault` falls back for
			// MISSING data only, and an `InvalidValue` with no actual is classified
			// as missing. Without that, `dry-run: yes` would silently resolve to
			// `false` and the action would perform every mutation it was asked to
			// rehearse — the worst possible direction for this particular default.
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					Effect.flatMap(DryRun, (dryRun) => dryRun.isDryRun).pipe(Effect.provide(DryRun.layer)),
				);
				assert.strictEqual(error._tag, "ConfigError");
				assert.include(error.message, "YAML 1.2 core schema");
			}).pipe(Effect.provide(ActionInput.layer({ "INPUT_DRY-RUN": "yes" }))),
		);

		it.effect("layerFromInput reads the name it is given", () =>
			Effect.gen(function* () {
				assert.isTrue(yield* (yield* DryRun).isDryRun);
			}).pipe(
				Effect.provide(DryRun.layerFromInput("rehearse only")),
				Effect.provide(ActionInput.layer({ "rehearse only": "true" })),
			),
		);
	});

	describe("test double", () => {
		it.effect("defaults to rehearsing, which is the safe direction", () =>
			Effect.gen(function* () {
				const { performed, effect } = mutation();
				assert.isTrue(yield* (yield* DryRun).isDryRun);
				yield* (yield* DryRun).guard("publish", effect, "rehearsed");
				assert.deepStrictEqual(performed, []);
			}).pipe(Effect.provide(DryRun.layerTest()), Effect.provide(ActionLogger.layerLogger)),
		);

		it.effect("an override wins over the default", () =>
			Effect.gen(function* () {
				assert.isFalse(yield* (yield* DryRun).isDryRun);
			}).pipe(Effect.provide(DryRun.layerTest({ isDryRun: Effect.succeed(false) }))),
		);
	});
});
