// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Effect, Layer, Option, Schema } from "effect";
import { TestConsole } from "effect/testing";
import { ActionEnvironment, ActionOutputs, ActionState } from "../../effected/github-actions/index.ts";

const Token = Schema.Struct({ value: Schema.String, expires: Schema.Number });

/**
 * A real in-memory volume for the runner files, fresh per test — the shape
 * `ActionEnvironment`'s TSDoc points consumers at. The writes are `flag: "a"`
 * appends and the volume performs them, rather than a stub re-implementing
 * append by concatenation. `/rf` is seeded because a write needs its parent.
 */
const runnerFiles = () => {
	const handle = MemoryFileSystem.makeSync({ "/rf": MemoryFileSystem.directory() });
	return { written: handle.volume, layer: handle.layer };
};

const live = <A, E>(
	program: Effect.Effect<A, E, ActionState>,
	env: Record<string, string> = { GITHUB_STATE: "/rf/state" },
) => {
	const files = runnerFiles();
	const base = Layer.mergeAll(ActionEnvironment.layerTest(env), files.layer);
	const outputs = ActionOutputs.layer.pipe(Layer.provide(base));
	return {
		files,
		run: program.pipe(Effect.provide(ActionState.layer.pipe(Layer.provide(Layer.mergeAll(base, outputs))))),
	};
};

describe("ActionState", () => {
	it.effect("persists a value as a delimited block on the state file", () => {
		const { files, run } = live(
			Effect.gen(function* () {
				yield* (yield* ActionState).save("token", { value: "abc", expires: 1 }, Token);
			}),
		);
		return Effect.map(run, () => {
			const body = files.written.text("/rf/state") ?? "";
			assert.isTrue(body.startsWith("token<<"));
			assert.include(body, '{"value":"abc","expires":1}');
		});
	});

	it.effect("refuses a key that cannot head a block, and writes nothing", () => {
		// The same heredoc protocol as ActionOutputs: a key carrying a line break
		// would end its block early and corrupt every entry after it, so it is
		// a typed `writeFailed` naming the key — never a silent corruption.
		const { files, run } = live(
			Effect.gen(function* () {
				const error = yield* Effect.flip((yield* ActionState).save("to\nken", { value: "abc", expires: 1 }, Token));
				assert.strictEqual(error.reason, "writeFailed");
				assert.strictEqual(error.key, "to\nken");
			}),
		);
		return Effect.map(run, () => {
			assert.isUndefined(files.written.text("/rf/state"));
		});
	});

	it.effect("refuses a key containing the runner-file separators, and writes nothing", () => {
		// The runner reads each line up to its first `=` or `<<`, whichever comes
		// first: a key carrying `=` parses as a key=value property before the
		// block ever opens, and a key carrying `<<` splits at the wrong delimiter
		// — either way every entry after it is corrupt, so both fail typed. A key
		// ending in `<` composes a header (`to<<<DELIM`) whose first `<<` matches
		// one character early, leaving a delimiter the terminator can never match.
		const { files, run } = live(
			Effect.gen(function* () {
				const forEquals = yield* Effect.flip((yield* ActionState).save("to=ken", { value: "abc", expires: 1 }, Token));
				assert.strictEqual(forEquals.reason, "writeFailed");
				assert.strictEqual(forEquals.key, "to=ken");
				const forHeredoc = yield* Effect.flip(
					(yield* ActionState).save("to<<ken", { value: "abc", expires: 1 }, Token),
				);
				assert.strictEqual(forHeredoc.reason, "writeFailed");
				assert.strictEqual(forHeredoc.key, "to<<ken");
				const forTrailing = yield* Effect.flip((yield* ActionState).save("to<", { value: "abc", expires: 1 }, Token));
				assert.strictEqual(forTrailing.reason, "writeFailed");
				assert.strictEqual(forTrailing.key, "to<");
			}),
		);
		return Effect.map(run, () => {
			assert.isUndefined(files.written.text("/rf/state"));
		});
	});

	it.effect(
		"reads a value back from the STATE_ variable the runner republishes",
		() =>
			live(
				Effect.gen(function* () {
					const value = yield* (yield* ActionState).get("token", Token);
					assert.deepStrictEqual(value, { value: "abc", expires: 1 });
				}),
				{ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc","expires":1}' },
			).run,
	);

	it.effect(
		"getOptional answers none for a key that was never saved",
		() =>
			live(
				Effect.gen(function* () {
					assert.isTrue(Option.isNone(yield* (yield* ActionState).getOptional("absent", Token)));
				}),
			).run,
	);

	it.effect(
		"get fails typed for a key that was never saved",
		() =>
			live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("absent", Token));
					assert.strictEqual(error._tag, "ActionStateError");
					assert.strictEqual(error.reason, "missing");
					assert.strictEqual(error.key, "absent");
				}),
			).run,
	);

	it.effect(
		"fails typed when the persisted value does not satisfy its schema",
		() =>
			live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("token", Token));
					assert.strictEqual(error.reason, "malformed");
				}),
				{ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc"}' },
			).run,
	);

	it.effect(
		"fails typed when the persisted value is not JSON",
		() =>
			live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("token", Token));
					assert.strictEqual(error.reason, "malformed");
				}),
				{ GITHUB_STATE: "/rf/state", STATE_token: "{ not json" },
			).run,
	);

	describe("save-time round-trip validation", () => {
		it.effect("a schema whose encoded form is not plain JSON fails AT SAVE, naming the key", () => {
			// The regression that cost a real matrix round: Schema.Option's encoded
			// form is an Option INSTANCE — JSON.stringify serializes it via toJSON
			// to {"_id":"Option",…}, the save "succeeds", and post's decode fails
			// `malformed` with no pointer to the cause. The round-trip must decode
			// the PARSED value: a mutant that re-decodes the encoded value instead
			// passes an Option instance straight through and goes green here.
			const { files, run } = live(
				Effect.gen(function* () {
					return yield* Effect.flip(
						(yield* ActionState).save("choice", Option.some("x"), Schema.Option(Schema.String)),
					);
				}),
			);
			return Effect.map(run, (error) => {
				assert.strictEqual(error._tag, "ActionStateError");
				assert.strictEqual(error.reason, "notPlainJson");
				assert.strictEqual(error.key, "choice");
				assert.include(error.message, "plain JSON");
				// The failure must precede the write: a state file carrying the bad
				// value would resurrect the phase-later mystery this exists to kill.
				assert.isUndefined(files.written.text("/rf/state"));
			});
		});

		it.effect("Schema.OptionFromNullOr is the sanctioned spelling and still saves", () => {
			const { files, run } = live(
				Effect.gen(function* () {
					const state = yield* ActionState;
					yield* state.save("some", Option.some("x"), Schema.OptionFromNullOr(Schema.String));
					yield* state.save("none", Option.none<string>(), Schema.OptionFromNullOr(Schema.String));
				}),
			);
			return Effect.map(run, () => {
				const body = files.written.text("/rf/state") ?? "";
				assert.include(body, '"x"');
				assert.include(body, "null");
			});
		});

		it.effect(
			"an unstringifiable encoded form fails typed rather than as a defect",
			() =>
				live(
					Effect.gen(function* () {
						// JSON.stringify THROWS on a bigint; before the round-trip that
						// left `save` through the defect channel, not the typed one.
						const error = yield* Effect.flip((yield* ActionState).save("big", { n: 1n }, Schema.Any));
						assert.strictEqual(error.reason, "notPlainJson");
						assert.strictEqual(error.key, "big");
					}),
				).run,
		);
	});

	describe("saveSecret", () => {
		it.effect("masks the secret BEFORE persisting it", () => {
			const { files, run } = live(
				Effect.gen(function* () {
					yield* (yield* ActionState).saveSecret("gh-token", "ghs_abc123");
				}),
			);
			return Effect.gen(function* () {
				yield* run;
				const lines = JSON.stringify(yield* TestConsole.logLines);
				assert.include(lines, "::add-mask::ghs_abc123");
				// GITHUB_STATE is plaintext by GitHub's protocol; the mask is the only
				// available defense, so it must have happened.
				assert.include(files.written.text("/rf/state") ?? "", "ghs_abc123");
			});
		});
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies loudly", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit((yield* ActionState).get("k", Token));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(ActionState.layerTest())),
		);
	});
});
