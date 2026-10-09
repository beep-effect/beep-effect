import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import * as DateTime from "effect/DateTime";
import { TestConsole } from "effect/testing";
import {
	ActionEnvironment,
	type ActionOutputError,
	ActionOutputs,
	DetachedOutputError,
	InvalidOutputNameError,
	OutputEncodeError,
	RunnerFileUnavailableError,
	Secret,
} from "../../effected/github-actions/index.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import * as Context from "effect/Context";
import { $ScratchpadId } from "@beep/identity/packages";

const $I = $ScratchpadId.create("test/github-actions/ActionOutputs.test");
class FirstOutputs extends Context.Service<FirstOutputs, ReturnType<typeof ActionOutputs.makeTest>>()(
	$I`FirstOutputs`,
) {}
class SecondOutputs extends Context.Service<SecondOutputs, ReturnType<typeof ActionOutputs.makeTest>>()(
	$I`SecondOutputs`,
) {}

const Json = S.fromJsonString(S.Unknown);

const FILES = {
	GITHUB_OUTPUT: "/rf/output",
	GITHUB_ENV: "/rf/env",
	GITHUB_PATH: "/rf/path",
	GITHUB_STEP_SUMMARY: "/rf/summary",
};

/**
 * A real in-memory volume for the runner files, fresh per test.
 *
 * `ActionEnvironment`'s own TSDoc tells consumers to reach for `@effected/memfs`
 * rather than a hand stub, and the append semantics are why: these writes are
 * `flag: "a"` appends, and a stub that models them by concatenating into a Map
 * is re-implementing the filesystem behavior under test. The volume performs
 * the real append, and `/rf` is seeded because a write needs its parent.
 */
const runnerFiles = () => {
	const handle = MemoryFileSystem.makeSync({ "/rf": MemoryFileSystem.directory() });
	return { written: handle.volume, layer: handle.layer };
};

const outputLayer = (files: ReturnType<typeof runnerFiles>, env: Record<string, string> = FILES) =>
	ActionOutputs.layer.pipe(Layer.provide(Layer.mergeAll(ActionEnvironment.layerTest(env), files.layer)));

describe("ActionOutputs", () => {
	describe("runner files", () => {
		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("writes an output as a delimited block", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).set("version", "1.2.3");
						const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
						const [head, value, tail] = body.trimEnd().split("\n");
						assert.isTrue(head?.startsWith("version<<"), `unexpected head: ${head}`);
						assert.strictEqual(value, "1.2.3");
						assert.strictEqual(tail, head?.slice("version<<".length));
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("round-trips a multiline value, which is the point of the delimiter", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).set("notes", "line one\nline two\n\nline four");
						const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
						const lines = body.trimEnd().split("\n");
						const delimiter = lines[0]?.slice("notes<<".length) ?? "";
						assert.deepStrictEqual(lines.slice(1, -1), ["line one", "line two", "", "line four"]);
						assert.strictEqual(lines.at(-1), delimiter);
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("derives a delimiter the value cannot contain", () =>
					Effect.gen(function* () {
						// A value containing the default delimiter would, with a fixed
						// delimiter, terminate the block early and corrupt every later entry.
						yield* (yield* ActionOutputs).set("evil", "EFFECTED_EOF\nsmuggled=1");
						const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
						const lines = body.trimEnd().split("\n");
						const delimiter = lines[0]?.slice("evil<<".length) ?? "";
						assert.notStrictEqual(delimiter, "EFFECTED_EOF");
						assert.isFalse("EFFECTED_EOF\nsmuggled=1".includes(delimiter), "delimiter must not occur in the value");
						assert.strictEqual(lines.at(-1), delimiter);
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("appends rather than truncating, so two outputs both survive", () =>
					Effect.gen(function* () {
						const outputs = yield* ActionOutputs;
						yield* outputs.set("a", "1");
						yield* outputs.set("b", "2");
						const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
						assert.include(body, "a<<");
						assert.include(body, "b<<");
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("routes exportVariable, addPath and summary to their own files", () =>
					Effect.gen(function* () {
						const outputs = yield* ActionOutputs;
						yield* outputs.exportVariable("FOO", "bar");
						yield* outputs.addPath("/opt/bin");
						yield* outputs.summary("## Results\n");
						assert.include(files.written.text(FILES.GITHUB_ENV) ?? "", "FOO<<");
						assert.strictEqual(files.written.text(FILES.GITHUB_PATH), "/opt/bin\n");
						assert.strictEqual(files.written.text(FILES.GITHUB_STEP_SUMMARY), "## Results\n");
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("encodes setJson through the schema", () => {
					const Payload = S.Struct({ count: S.Finite, tag: S.String });
					return Effect.gen(function* () {
						yield* (yield* ActionOutputs).setJson("result", { count: 2, tag: "x" }, Payload);
						const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
						assert.include(body, '{"count":2,"tag":"x"}');
					});
				});
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files, {}), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the runner file variable is not set", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip((yield* ActionOutputs).set("a", "1"));
						assert.instanceOf(error, RunnerFileUnavailableError);
						assert.strictEqual(error.file, "GITHUB_OUTPUT");
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("refuses a name containing the delimiter syntax", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip((yield* ActionOutputs).set("bad\nname", "1"));
						assert.instanceOf(error, InvalidOutputNameError);
						assert.strictEqual(files.written.paths().length, 0, "nothing may be written when the name is refused");
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("refuses a name containing the runner-file separators", () =>
					Effect.gen(function* () {
						// The runner reads each line up to its first `=` or `<<`, whichever
						// comes first: a name carrying `=` parses as a key=value property
						// before the block ever opens, and a name carrying `<<` splits at
						// the wrong delimiter — either way every entry after it is corrupt.
						// A name ending in `<` composes a header (`a<<<DELIM`) whose first
						// `<<` matches one character early, so the delimiter the runner
						// waits for can never be matched by the terminating line.
						const forEquals = yield* Effect.flip((yield* ActionOutputs).set("bad=name", "1"));
						assert.instanceOf(forEquals, InvalidOutputNameError);
						const forHeredoc = yield* Effect.flip((yield* ActionOutputs).set("bad<<name", "1"));
						assert.instanceOf(forHeredoc, InvalidOutputNameError);
						const forEnv = yield* Effect.flip((yield* ActionOutputs).exportVariable("bad=name", "1"));
						assert.instanceOf(forEnv, InvalidOutputNameError);
						const forJson = yield* Effect.flip((yield* ActionOutputs).setJson("bad<<name", 1, S.Finite));
						assert.instanceOf(forJson, InvalidOutputNameError);
						const forTrailing = yield* Effect.flip((yield* ActionOutputs).set("bad<", "1"));
						assert.instanceOf(forTrailing, InvalidOutputNameError);
						const forJsonTrailing = yield* Effect.flip((yield* ActionOutputs).setJson("<", 1, S.Finite));
						assert.instanceOf(forJsonTrailing, InvalidOutputNameError);
						assert.strictEqual(files.written.paths().length, 0, "nothing may be written when the name is refused");
					}),
				);
			});
		}
	});

	describe("workflow commands", () => {
		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("masks a secret", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setSecret("s3cr3t");
						const lines = yield* TestConsole.logLines;
						assert.include(
							Result.getOrThrowWith(S.encodeResult(Json)(lines), (error) => error),
							"::add-mask::s3cr3t",
						);
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("escapes a masked value that spans lines", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setSecret("a\nb");
						const lines = yield* TestConsole.logLines;
						assert.include(
							Result.getOrThrowWith(S.encodeResult(Json)(lines), (error) => error),
							"::add-mask::a%0Ab",
						);
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("emits setFailed as an error annotation", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setFailed("it broke");
						const lines = yield* TestConsole.logLines;
						assert.include(
							Result.getOrThrowWith(S.encodeResult(Json)(lines), (error) => error),
							"::error::it broke",
						);
					}),
				);
			});
		}
	});

	describe("layerDetached", () => {
		/** The S3-shaped secret from the incident this layer exists for. */
		const PLAINTEXT = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

		/** Everything this process wrote to its console, as one string. */
		const captured = Effect.map(Effect.zip(TestConsole.logLines, TestConsole.errorLines), ([logs, errors]) =>
			Result.getOrThrowWith(S.encodeResult(Json)([...logs, ...errors]), (error) => error),
		);

		{
			it.layer(ActionOutputs.layerDetached, { timeout: "30 seconds" })((it) => {
				it.effect("the incident, as regression: a signing secret never reaches a detached worker's log", () =>
					Effect.gen(function* () {
						// The worker-side composition that shipped wrong: an S3-style signer
						// declassifying its key via Secret.forSigning. Under layerDetached
						// the signer still gets the raw bytes for the HMAC…
						const key = yield* Secret.forSigning(Redacted.make(PLAINTEXT));
						assert.strictEqual(key, PLAINTEXT);
						// …and the secret appears NOWHERE in the captured output. Under the
						// real layer this exact assertion fails (see the control below):
						// stdout in a detached worker is a log file no runner parses, so the
						// mask both masks nothing and writes the plaintext into the log.
						assert.notInclude(yield* captured, PLAINTEXT);
					}),
				);
			});
		}

		{
			const files = runnerFiles();
			it.layer(outputLayer(files), { timeout: "30 seconds" })((it) => {
				it.effect("the control: the REAL layer writes ::add-mask::<plaintext> — the shipped inversion", () =>
					Effect.gen(function* () {
						// The mutant the regression discriminates against: swap
						// layerDetached back to ActionOutputs.layer and the plaintext is in
						// the output, workflow-command prefix and all. In a `uses:` step the
						// runner consumes this line; in a detached worker it IS the leak.
						yield* Secret.forSigning(Redacted.make(PLAINTEXT));
						assert.include(yield* captured, `::add-mask::${PLAINTEXT}`);
					}),
				);
			});
		}

		{
			it.layer(ActionOutputs.layerDetached, { timeout: "30 seconds" })((it) => {
				it.effect("setSecret is a silent no-op — the value must not be written anywhere", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setSecret("s3cr3t");
						assert.strictEqual(yield* captured, "[]", "a detached worker must write nothing for a mask");
					}),
				);
			});
		}

		{
			it.layer(ActionOutputs.layerDetached, { timeout: "30 seconds" })((it) => {
				it.effect("every runner-file member fails typed, naming its file", () =>
					Effect.gen(function* () {
						const outputs = yield* ActionOutputs;
						const cases: ReadonlyArray<readonly [Effect.Effect<void, ActionOutputError>, string]> = [
							[outputs.set("version", "1.2.3"), "GITHUB_OUTPUT"],
							[outputs.setJson("result", { a: 1 }, S.Struct({ a: S.Finite })), "GITHUB_OUTPUT"],
							[outputs.exportVariable("FOO", "bar"), "GITHUB_ENV"],
							[outputs.addPath("/opt/bin"), "GITHUB_PATH"],
							[outputs.summary("## Results\n"), "GITHUB_STEP_SUMMARY"],
						];
						for (const [call, file] of cases) {
							const error = yield* Effect.flip(call);
							assert.instanceOf(error, DetachedOutputError);
							assert.strictEqual(error.file, file);
							assert.include(error.message, "detached worker");
						}
						// Failing typed, not silently: nothing was logged on the way.
						assert.strictEqual(yield* captured, "[]");
					}),
				);
			});
		}

		{
			it.layer(ActionOutputs.layerDetached, { timeout: "30 seconds" })((it) => {
				it.effect("setFailed degrades to a plain log line, with no workflow-command syntax", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setFailed("it broke");
						const errors = yield* TestConsole.errorLines;
						assert.include(
							Result.getOrThrowWith(S.encodeResult(Json)(errors), (error) => error),
							"it broke",
						);
						// The ::error:: protocol means nothing in a worker's log file —
						// emitting it would be pretending a runner is listening.
						assert.notInclude(yield* captured, "::error::");
					}),
				);
			});
		}
	});

	describe("test double", () => {
		{
			it.layer(ActionOutputs.layerTest(), { timeout: "30 seconds" })((it) => {
				it.effect("an unstubbed member dies loudly", () =>
					Effect.gen(function* () {
						const exit = yield* Effect.exit((yield* ActionOutputs).set("a", "1"));
						assertExitFailure(
							exit,
							Cause.die(
								UnstubbedMemberError.make({
									message: "ActionOutputs.makeTest: set() was called but not stubbed — pass a `set` override.",
								}),
							),
						);
					}),
				);
			});
		}

		{
			it.layer(ActionOutputs.layerTest({ setSecret: () => Effect.void }), { timeout: "30 seconds" })((it) => {
				it.effect("layerTest serves a stubbed member", () =>
					Effect.gen(function* () {
						yield* (yield* ActionOutputs).setSecret("x");
					}),
				);
			});
		}

		describe("setJson always encodes first (#636)", () => {
			/** The output contract: `count` must be an integer. */
			const Report = S.Struct({ count: S.Int });
			/** The drift: a projection handing over a string where the schema says Int. */
			const drifted = { count: deliberatelyInvalid<number>("3") };

			{
				it.layer(
					ActionOutputs.layerTest({
						setJson: (_name, _value, schema) =>
							Effect.sync(() => {
								void schema;
							}),
					}),
					{ timeout: "30 seconds" },
				)((it) => {
					it.effect("the #636 trap: an override that ignores `schema` can no longer hide a drift", () =>
						Effect.gen(function* () {
							// The natural consumer override from the issue — accepts `schema`,
							// never looks at it. Before the fix this typechecked, read complete,
							// and turned a production OutputEncodeError into a green suite.
							const error = yield* Effect.flip((yield* ActionOutputs).setJson("result", drifted, Report));
							assert.strictEqual(error._tag, "OutputEncodeError");
							assert.strictEqual(error.name, "result");
						}),
					);
				});
			}

			it.effect("a valid value reaches the override with the ORIGINAL name, value and schema", () =>
				Effect.gen(function* () {
					const seen: Array<{ name: string; value: unknown; schema: unknown }> = [];
					const value = { count: 3 };
					const outputs = ActionOutputs.makeTest({
						setJson: (name, value, schema) =>
							Effect.sync(() => {
								seen.push({ name, value, schema });
							}),
					});
					yield* outputs.setJson("result", value, Report);
					assert.strictEqual(seen.length, 1);
					assert.strictEqual(seen[0]?.name, "result");
					assert.strictEqual(seen[0]?.value, value, "the override receives the decoded value, not the encoded one");
					assert.strictEqual(seen[0]?.schema, Report);
				}),
			);

			{
				it.layer(ActionOutputs.layerTest(), { timeout: "30 seconds" })((it) => {
					it.effect("no override + a valid value still dies unimplemented", () =>
						Effect.gen(function* () {
							const exit = yield* Effect.exit((yield* ActionOutputs).setJson("result", { count: 3 }, Report));
							assertExitFailure(
								exit,
								Cause.die(
									UnstubbedMemberError.make({
										message:
											"ActionOutputs.makeTest: setJson() was called but not stubbed — pass a `setJson` override.",
									}),
								),
							);
							assert.isTrue(Cause.hasDies(exit.cause), "a valid value with no override is a die, not a typed failure");
							assert.include(Cause.pretty(exit.cause), "setJson() was called but not stubbed");
						}),
					);
				});
			}

			{
				it.layer(ActionOutputs.layerTest(), { timeout: "30 seconds" })((it) => {
					it.effect("no override + an invalid value fails typed — the encode runs before the die", () =>
						Effect.gen(function* () {
							const error = yield* Effect.flip((yield* ActionOutputs).setJson("result", drifted, Report));
							assert.instanceOf(error, OutputEncodeError);
							assert.strictEqual(error.name, "result");
						}),
					);
				});
			}
		});
	});

	describe("recording", () => {
		{
			const recorder = ActionOutputs.recording();
			it.layer(recorder.layer, { timeout: "30 seconds" })((it) => {
				it.effect("setJson records the ENCODED JSON string, not the decoded value", () => {
					const Stamped = S.Struct({ at: S.DateFromString });
					const at = DateTime.toDateUtc(DateTime.makeUnsafe("2026-09-13T00:00:00.000Z"));
					return Effect.gen(function* () {
						yield* (yield* ActionOutputs).setJson("result", { at }, Stamped);
						const entries = recorder.entries();
						assert.strictEqual(entries.length, 1);
						assert.strictEqual(entries[0]?.member, "setJson");
						assert.strictEqual(entries[0]?.name, "result");
						assert.strictEqual(entries[0]?.value, '{"at":"2026-09-13T00:00:00.000Z"}');
					});
				});
			});
		}

		{
			const recorder = ActionOutputs.recording();
			it.layer(recorder.layer, { timeout: "30 seconds" })((it) => {
				it.effect("setJson fails typed on a drift and records nothing", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							(yield* ActionOutputs).setJson(
								"result",
								{ count: deliberatelyInvalid<number>("3") },
								S.Struct({ count: S.Int }),
							),
						);
						assert.instanceOf(error, OutputEncodeError);
						assert.strictEqual(recorder.entries().length, 0);
					}),
				);
			});
		}

		{
			const recorder = ActionOutputs.recording();
			it.layer(recorder.layer, { timeout: "30 seconds" })((it) => {
				it.effect("every member records in call order with its member, name and value", () =>
					Effect.gen(function* () {
						const outputs = yield* ActionOutputs;
						yield* outputs.set("version", "1.2.3");
						yield* outputs.exportVariable("FOO", "bar");
						yield* outputs.addPath("/opt/bin");
						yield* outputs.summary("## Results\n");
						yield* outputs.setFailed("it broke");
						yield* outputs.setSecret("s3cr3t");
						yield* outputs.setJson("n", 2, S.Finite);
						assert.deepStrictEqual(
							recorder.entries().map((entry) => [entry.member, entry.name, entry.value]),
							[
								["set", "version", "1.2.3"],
								["exportVariable", "FOO", "bar"],
								["addPath", undefined, "/opt/bin"],
								["summary", undefined, "## Results\n"],
								["setFailed", undefined, "it broke"],
								["setSecret", undefined, "s3cr3t"],
								["setJson", "n", "2"],
							],
						);
					}),
				);
			});
		}

		{
			const first = ActionOutputs.recording();
			const second = ActionOutputs.recording();
			it.layer(
				Layer.mergeAll(
					Layer.effect(FirstOutputs, ActionOutputs).pipe(Layer.provide(first.layer)),
					Layer.effect(SecondOutputs, ActionOutputs).pipe(Layer.provide(second.layer)),
				),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("two recording() calls are independent journals", () =>
					Effect.gen(function* () {
						yield* Effect.flatMap(FirstOutputs, (outputs) => outputs.set("a", "1"));
						yield* Effect.flatMap(SecondOutputs, (outputs) => outputs.set("b", "2"));
						assert.deepStrictEqual(
							first.entries().map((entry) => entry.name),
							["a"],
						);
						assert.deepStrictEqual(
							second.entries().map((entry) => entry.name),
							["b"],
						);
					}),
				);
			});
		}

		{
			const recorder = ActionOutputs.recording();
			it.layer(recorder.layer, { timeout: "30 seconds" })((it) => {
				it.effect("an invalid output name fails typed and records nothing", () =>
					Effect.gen(function* () {
						const outputs = yield* ActionOutputs;
						const forSet = yield* Effect.flip(outputs.set("bad\nname", "1"));
						assert.instanceOf(forSet, InvalidOutputNameError);
						const forEnv = yield* Effect.flip(outputs.exportVariable("", "1"));
						assert.instanceOf(forEnv, InvalidOutputNameError);
						const forJson = yield* Effect.flip(outputs.setJson("bad\nname", 1, S.Finite));
						assert.instanceOf(forJson, InvalidOutputNameError);
						const forEquals = yield* Effect.flip(outputs.set("bad=name", "1"));
						assert.instanceOf(forEquals, InvalidOutputNameError);
						const forSeparator = yield* Effect.flip(outputs.exportVariable("bad<<name", "1"));
						assert.instanceOf(forSeparator, InvalidOutputNameError);
						const forJsonSeparator = yield* Effect.flip(outputs.setJson("bad=name", 1, S.Finite));
						assert.instanceOf(forJsonSeparator, InvalidOutputNameError);
						const forTrailing = yield* Effect.flip(outputs.set("bad<", "1"));
						assert.instanceOf(forTrailing, InvalidOutputNameError);
						const forTrailingJson = yield* Effect.flip(outputs.setJson("bad<", 1, S.Finite));
						assert.instanceOf(forTrailingJson, InvalidOutputNameError);
						assert.strictEqual(recorder.entries().length, 0);
					}),
				);
			});
		}
	});
});
