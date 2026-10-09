import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { TestConsole } from "effect/testing";
import { ActionEnvironment, ActionOutputs, ActionState } from "../../effected/github-actions/index.ts";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";

const Json = S.fromJsonString(S.Unknown);

const Token = S.Struct({ value: S.String, expires: S.Finite });

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

const stateFixture = (env: Record<string, string> = { GITHUB_STATE: "/rf/state" }) => {
	const files = runnerFiles();
	const base = Layer.mergeAll(ActionEnvironment.layerTest(env), files.layer);
	const outputs = ActionOutputs.layer.pipe(Layer.provide(base));
	return { files, layer: ActionState.layer.pipe(Layer.provide(Layer.mergeAll(base, outputs))) };
};

describe("ActionState", () => {
	{
		const { files, layer } = stateFixture();
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("persists a value as a delimited block on the state file", () => {
				const run = Effect.gen(function* () {
					yield* (yield* ActionState).save("token", { value: "abc", expires: 1 }, Token);
				});
				return Effect.map(run, () => {
					const body = files.written.text("/rf/state") ?? "";
					assert.isTrue(body.startsWith("token<<"));
					assert.include(body, '{"value":"abc","expires":1}');
				});
			});
		});
	}

	{
		const { files, layer } = stateFixture();
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("refuses a key that cannot head a block, and writes nothing", () => {
				// The same heredoc protocol as ActionOutputs: a key carrying a line break
				// would end its block early and corrupt every entry after it, so it is
				// a typed `writeFailed` naming the key — never a silent corruption.
				const run = Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).save("to\nken", { value: "abc", expires: 1 }, Token));
					assert.strictEqual(error.reason, "writeFailed");
					assert.strictEqual(error.key, "to\nken");
				});
				return Effect.map(run, () => {
					assert.isUndefined(files.written.text("/rf/state"));
				});
			});
		});
	}

	{
		const { files, layer } = stateFixture();
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("refuses a key containing the runner-file separators, and writes nothing", () => {
				// The runner reads each line up to its first `=` or `<<`, whichever comes
				// first: a key carrying `=` parses as a key=value property before the
				// block ever opens, and a key carrying `<<` splits at the wrong delimiter
				// — either way every entry after it is corrupt, so both fail typed. A key
				// ending in `<` composes a header (`to<<<DELIM`) whose first `<<` matches
				// one character early, leaving a delimiter the terminator can never match.
				const run = Effect.gen(function* () {
					const forEquals = yield* Effect.flip(
						(yield* ActionState).save("to=ken", { value: "abc", expires: 1 }, Token),
					);
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
				});
				return Effect.map(run, () => {
					assert.isUndefined(files.written.text("/rf/state"));
				});
			});
		});
	}

	{
		const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc","expires":1}' });
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("reads a value back from the STATE_ variable the runner republishes", () =>
				Effect.gen(function* () {
					const value = yield* (yield* ActionState).get("token", Token);
					assert.deepStrictEqual(value, { value: "abc", expires: 1 });
				}),
			);
		});
	}

	{
		const { layer } = stateFixture();
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("getOptional answers none for a key that was never saved", () =>
				Effect.gen(function* () {
					assertNone(yield* (yield* ActionState).getOptional("absent", Token));
				}),
			);
		});
	}

	{
		const { layer } = stateFixture();
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("get fails typed for a key that was never saved", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("absent", Token));
					assert.strictEqual(error._tag, "ActionStateError");
					assert.strictEqual(error.reason, "missing");
					assert.strictEqual(error.key, "absent");
				}),
			);
		});
	}

	{
		const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: '{"value":"abc"}' });
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("fails typed when the persisted value does not satisfy its schema", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("token", Token));
					assert.strictEqual(error.reason, "malformed");
				}),
			);
		});
	}

	{
		const { layer } = stateFixture({ GITHUB_STATE: "/rf/state", STATE_token: "{ not json" });
		it.layer(layer, { timeout: "30 seconds" })((it) => {
			it.effect("fails typed when the persisted value is not JSON", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionState).get("token", Token));
					assert.strictEqual(error.reason, "malformed");
				}),
			);
		});
	}

	describe("save-time round-trip validation", () => {
		{
			const { files, layer } = stateFixture();
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("a schema whose encoded form is not plain JSON fails AT SAVE, naming the key", () => {
					// The regression that cost a real matrix round: Schema.Option's encoded
					// form is an Option INSTANCE — JSON.stringify serializes it via toJSON
					// to {"_id":"Option",…}, the save "succeeds", and post's decode fails
					// `malformed` with no pointer to the cause. The round-trip must decode
					// the PARSED value: a mutant that re-decodes the encoded value instead
					// passes an Option instance straight through and goes green here.
					const run = Effect.gen(function* () {
						return yield* Effect.flip((yield* ActionState).save("choice", O.some("x"), S.Option(S.String)));
					});
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
			});
		}

		{
			const { files, layer } = stateFixture();
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("Schema.OptionFromNullOr is the sanctioned spelling and still saves", () => {
					const run = Effect.gen(function* () {
						const state = yield* ActionState;
						yield* state.save("some", O.some("x"), S.OptionFromNullOr(S.String));
						yield* state.save("none", O.none<string>(), S.OptionFromNullOr(S.String));
					});
					return Effect.map(run, () => {
						const body = files.written.text("/rf/state") ?? "";
						assert.include(body, '"x"');
						assert.include(body, "null");
					});
				});
			});
		}

		{
			const { layer } = stateFixture();
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("an unstringifiable encoded form fails typed rather than as a defect", () =>
					Effect.gen(function* () {
						// JSON.stringify THROWS on a bigint; before the round-trip that
						// left `save` through the defect channel, not the typed one.
						const error = yield* Effect.flip((yield* ActionState).save("big", { n: 1n }, S.Any));
						assert.strictEqual(error.reason, "notPlainJson");
						assert.strictEqual(error.key, "big");
					}),
				);
			});
		}
	});

	describe("saveSecret", () => {
		{
			const { files, layer } = stateFixture();
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("masks the secret BEFORE persisting it", () => {
					const run = Effect.gen(function* () {
						yield* (yield* ActionState).saveSecret("gh-token", "ghs_abc123");
					});
					return Effect.gen(function* () {
						yield* run;
						const lines = Result.getOrThrowWith(S.encodeResult(Json)(yield* TestConsole.logLines), (error) => error);
						assert.include(lines, "::add-mask::ghs_abc123");
						// GITHUB_STATE is plaintext by GitHub's protocol; the mask is the only
						// available defense, so it must have happened.
						assert.include(files.written.text("/rf/state") ?? "", "ghs_abc123");
					});
				});
			});
		}
	});

	describe("test double", () => {
		{
			it.layer(ActionState.layerTest(), { timeout: "30 seconds" })((it) => {
				it.effect("an unstubbed member dies loudly", () =>
					Effect.gen(function* () {
						const exit = yield* Effect.exit((yield* ActionState).get("k", Token));
						assertExitFailure(
							exit,
							Cause.die(
								UnstubbedMemberError.make({
									message: "ActionState.makeTest: get() was called but not stubbed — pass a `get` override.",
								}),
							),
						);
					}),
				);
			});
		}
	});
});
