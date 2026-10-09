// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Cause, Effect, Layer, Redacted, Schema } from "effect";
import { TestConsole } from "effect/testing";
import {
	ActionEnvironment,
	ActionOutputs,
	DetachedOutputError,
	InvalidOutputNameError,
	OutputEncodeError,
	RunnerFileUnavailableError,
	Secret,
} from "../../effected/github-actions/index.ts";

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

const live = <A, E>(program: Effect.Effect<A, E, ActionOutputs>, files: ReturnType<typeof runnerFiles>) =>
	program.pipe(
		Effect.provide(
			ActionOutputs.layer.pipe(Layer.provide(Layer.mergeAll(ActionEnvironment.layerTest(FILES), files.layer))),
		),
	);

describe("ActionOutputs", () => {
	describe("runner files", () => {
		it.effect("writes an output as a delimited block", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).set("version", "1.2.3");
					const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
					const [head, value, tail] = body.trimEnd().split("\n");
					assert.isTrue(head?.startsWith("version<<"), `unexpected head: ${head}`);
					assert.strictEqual(value, "1.2.3");
					assert.strictEqual(tail, head?.slice("version<<".length));
				}),
				files,
			);
		});

		it.effect("round-trips a multiline value, which is the point of the delimiter", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).set("notes", "line one\nline two\n\nline four");
					const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
					const lines = body.trimEnd().split("\n");
					const delimiter = lines[0]?.slice("notes<<".length) ?? "";
					assert.deepStrictEqual(lines.slice(1, -1), ["line one", "line two", "", "line four"]);
					assert.strictEqual(lines.at(-1), delimiter);
				}),
				files,
			);
		});

		it.effect("derives a delimiter the value cannot contain", () => {
			const files = runnerFiles();
			return live(
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
				files,
			);
		});

		it.effect("appends rather than truncating, so two outputs both survive", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					const outputs = yield* ActionOutputs;
					yield* outputs.set("a", "1");
					yield* outputs.set("b", "2");
					const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
					assert.include(body, "a<<");
					assert.include(body, "b<<");
				}),
				files,
			);
		});

		it.effect("routes exportVariable, addPath and summary to their own files", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					const outputs = yield* ActionOutputs;
					yield* outputs.exportVariable("FOO", "bar");
					yield* outputs.addPath("/opt/bin");
					yield* outputs.summary("## Results\n");
					assert.include(files.written.text(FILES.GITHUB_ENV) ?? "", "FOO<<");
					assert.strictEqual(files.written.text(FILES.GITHUB_PATH), "/opt/bin\n");
					assert.strictEqual(files.written.text(FILES.GITHUB_STEP_SUMMARY), "## Results\n");
				}),
				files,
			);
		});

		it.effect("encodes setJson through the schema", () => {
			const files = runnerFiles();
			const Payload = Schema.Struct({ count: Schema.Number, tag: Schema.String });
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).setJson("result", { count: 2, tag: "x" }, Payload);
					const body = files.written.text(FILES.GITHUB_OUTPUT) ?? "";
					assert.include(body, '{"count":2,"tag":"x"}');
				}),
				files,
			);
		});

		it.effect("fails typed when the runner file variable is not set", () => {
			const files = runnerFiles();
			return Effect.gen(function* () {
				const error = yield* Effect.flip((yield* ActionOutputs).set("a", "1"));
				assert.instanceOf(error, RunnerFileUnavailableError);
				assert.strictEqual(error.file, "GITHUB_OUTPUT");
			}).pipe(
				Effect.provide(
					ActionOutputs.layer.pipe(Layer.provide(Layer.mergeAll(ActionEnvironment.layerTest({}), files.layer))),
				),
			);
		});

		it.effect("refuses a name containing the delimiter syntax", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionOutputs).set("bad\nname", "1"));
					assert.instanceOf(error, InvalidOutputNameError);
					assert.strictEqual(files.written.paths().length, 0, "nothing may be written when the name is refused");
				}),
				files,
			);
		});

		it.effect("refuses a name containing the runner-file separators", () => {
			const files = runnerFiles();
			return live(
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
					const forJson = yield* Effect.flip((yield* ActionOutputs).setJson("bad<<name", 1, Schema.Number));
					assert.instanceOf(forJson, InvalidOutputNameError);
					const forTrailing = yield* Effect.flip((yield* ActionOutputs).set("bad<", "1"));
					assert.instanceOf(forTrailing, InvalidOutputNameError);
					const forJsonTrailing = yield* Effect.flip((yield* ActionOutputs).setJson("<", 1, Schema.Number));
					assert.instanceOf(forJsonTrailing, InvalidOutputNameError);
					assert.strictEqual(files.written.paths().length, 0, "nothing may be written when the name is refused");
				}),
				files,
			);
		});
	});

	describe("workflow commands", () => {
		it.effect("masks a secret", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).setSecret("s3cr3t");
					const lines = yield* TestConsole.logLines;
					assert.include(JSON.stringify(lines), "::add-mask::s3cr3t");
				}),
				files,
			);
		});

		it.effect("escapes a masked value that spans lines", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).setSecret("a\nb");
					const lines = yield* TestConsole.logLines;
					assert.include(JSON.stringify(lines), "::add-mask::a%0Ab");
				}),
				files,
			);
		});

		it.effect("emits setFailed as an error annotation", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					yield* (yield* ActionOutputs).setFailed("it broke");
					const lines = yield* TestConsole.logLines;
					assert.include(JSON.stringify(lines), "::error::it broke");
				}),
				files,
			);
		});
	});

	describe("layerDetached", () => {
		/** The S3-shaped secret from the incident this layer exists for. */
		const PLAINTEXT = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

		/** Everything this process wrote to its console, as one string. */
		const captured = Effect.map(Effect.zip(TestConsole.logLines, TestConsole.errorLines), ([logs, errors]) =>
			JSON.stringify([...logs, ...errors]),
		);

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
			}).pipe(Effect.provide(ActionOutputs.layerDetached)),
		);

		it.effect("the control: the REAL layer writes ::add-mask::<plaintext> — the shipped inversion", () => {
			const files = runnerFiles();
			return live(
				Effect.gen(function* () {
					// The mutant the regression discriminates against: swap
					// layerDetached back to ActionOutputs.layer and the plaintext is in
					// the output, workflow-command prefix and all. In a `uses:` step the
					// runner consumes this line; in a detached worker it IS the leak.
					yield* Secret.forSigning(Redacted.make(PLAINTEXT));
					assert.include(yield* captured, `::add-mask::${PLAINTEXT}`);
				}),
				files,
			);
		});

		it.effect("setSecret is a silent no-op — the value must not be written anywhere", () =>
			Effect.gen(function* () {
				yield* (yield* ActionOutputs).setSecret("s3cr3t");
				assert.strictEqual(yield* captured, "[]", "a detached worker must write nothing for a mask");
			}).pipe(Effect.provide(ActionOutputs.layerDetached)),
		);

		it.effect("every runner-file member fails typed, naming its file", () =>
			Effect.gen(function* () {
				const outputs = yield* ActionOutputs;
				const cases: ReadonlyArray<readonly [Effect.Effect<void, unknown>, string]> = [
					[outputs.set("version", "1.2.3"), "GITHUB_OUTPUT"],
					[outputs.setJson("result", { a: 1 }, Schema.Struct({ a: Schema.Number })), "GITHUB_OUTPUT"],
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
			}).pipe(Effect.provide(ActionOutputs.layerDetached)),
		);

		it.effect("setFailed degrades to a plain log line, with no workflow-command syntax", () =>
			Effect.gen(function* () {
				yield* (yield* ActionOutputs).setFailed("it broke");
				const errors = yield* TestConsole.errorLines;
				assert.include(JSON.stringify(errors), "it broke");
				// The ::error:: protocol means nothing in a worker's log file —
				// emitting it would be pretending a runner is listening.
				assert.notInclude(yield* captured, "::error::");
			}).pipe(Effect.provide(ActionOutputs.layerDetached)),
		);
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies loudly", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit((yield* ActionOutputs).set("a", "1"));
				assert.isTrue(exit._tag === "Failure");
			}).pipe(Effect.provide(ActionOutputs.layerTest())),
		);

		it.effect("layerTest serves a stubbed member", () =>
			Effect.gen(function* () {
				yield* (yield* ActionOutputs).setSecret("x");
			}).pipe(Effect.provide(ActionOutputs.layerTest({ setSecret: () => Effect.void }))),
		);

		describe("setJson always encodes first (#636)", () => {
			/** The output contract: `count` must be an integer. */
			const Report = Schema.Struct({ count: Schema.Int });
			/** The drift: a projection handing over a string where the schema says Int. */
			const drifted = { count: "3" as unknown as number };

			it.effect("the #636 trap: an override that ignores `schema` can no longer hide a drift", () =>
				Effect.gen(function* () {
					// The natural consumer override from the issue — accepts `schema`,
					// never looks at it. Before the fix this typechecked, read complete,
					// and turned a production OutputEncodeError into a green suite.
					const error = yield* Effect.flip((yield* ActionOutputs).setJson("result", drifted, Report));
					assert.strictEqual(error._tag, "OutputEncodeError");
					assert.strictEqual(error.name, "result");
				}).pipe(
					Effect.provide(
						ActionOutputs.layerTest({
							setJson: (_name, _value, schema) =>
								Effect.sync(() => {
									void schema;
								}),
						}),
					),
				),
			);

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

			it.effect("no override + a valid value still dies unimplemented", () =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit((yield* ActionOutputs).setJson("result", { count: 3 }, Report));
					assert.isTrue(exit._tag === "Failure");
					if (exit._tag === "Failure") {
						assert.isTrue(Cause.hasDies(exit.cause), "a valid value with no override is a die, not a typed failure");
						assert.include(Cause.pretty(exit.cause), "setJson() was called but not stubbed");
					}
				}).pipe(Effect.provide(ActionOutputs.layerTest())),
			);

			it.effect("no override + an invalid value fails typed — the encode runs before the die", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionOutputs).setJson("result", drifted, Report));
					assert.instanceOf(error, OutputEncodeError);
					assert.strictEqual(error.name, "result");
				}).pipe(Effect.provide(ActionOutputs.layerTest())),
			);
		});
	});

	describe("recording", () => {
		it.effect("setJson records the ENCODED JSON string, not the decoded value", () => {
			const recorder = ActionOutputs.recording();
			const Stamped = Schema.Struct({ at: Schema.DateFromString });
			const at = new Date("2026-09-13T00:00:00.000Z");
			return Effect.gen(function* () {
				yield* (yield* ActionOutputs).setJson("result", { at }, Stamped);
				const entries = recorder.entries();
				assert.strictEqual(entries.length, 1);
				assert.strictEqual(entries[0]?.member, "setJson");
				assert.strictEqual(entries[0]?.name, "result");
				assert.strictEqual(entries[0]?.value, '{"at":"2026-09-13T00:00:00.000Z"}');
			}).pipe(Effect.provide(recorder.layer));
		});

		it.effect("setJson fails typed on a drift and records nothing", () => {
			const recorder = ActionOutputs.recording();
			return Effect.gen(function* () {
				const error = yield* Effect.flip(
					(yield* ActionOutputs).setJson(
						"result",
						{ count: "3" as unknown as number },
						Schema.Struct({ count: Schema.Int }),
					),
				);
				assert.instanceOf(error, OutputEncodeError);
				assert.strictEqual(recorder.entries().length, 0);
			}).pipe(Effect.provide(recorder.layer));
		});

		it.effect("every member records in call order with its member, name and value", () => {
			const recorder = ActionOutputs.recording();
			return Effect.gen(function* () {
				const outputs = yield* ActionOutputs;
				yield* outputs.set("version", "1.2.3");
				yield* outputs.exportVariable("FOO", "bar");
				yield* outputs.addPath("/opt/bin");
				yield* outputs.summary("## Results\n");
				yield* outputs.setFailed("it broke");
				yield* outputs.setSecret("s3cr3t");
				yield* outputs.setJson("n", 2, Schema.Number);
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
			}).pipe(Effect.provide(recorder.layer));
		});

		it.effect("two recording() calls are independent journals", () => {
			const first = ActionOutputs.recording();
			const second = ActionOutputs.recording();
			return Effect.gen(function* () {
				yield* Effect.provide(
					Effect.flatMap(ActionOutputs, (outputs) => outputs.set("a", "1")),
					first.layer,
				);
				yield* Effect.provide(
					Effect.flatMap(ActionOutputs, (outputs) => outputs.set("b", "2")),
					second.layer,
				);
				assert.deepStrictEqual(
					first.entries().map((entry) => entry.name),
					["a"],
				);
				assert.deepStrictEqual(
					second.entries().map((entry) => entry.name),
					["b"],
				);
			});
		});

		it.effect("an invalid output name fails typed and records nothing", () => {
			const recorder = ActionOutputs.recording();
			return Effect.gen(function* () {
				const outputs = yield* ActionOutputs;
				const forSet = yield* Effect.flip(outputs.set("bad\nname", "1"));
				assert.instanceOf(forSet, InvalidOutputNameError);
				const forEnv = yield* Effect.flip(outputs.exportVariable("", "1"));
				assert.instanceOf(forEnv, InvalidOutputNameError);
				const forJson = yield* Effect.flip(outputs.setJson("bad\nname", 1, Schema.Number));
				assert.instanceOf(forJson, InvalidOutputNameError);
				const forEquals = yield* Effect.flip(outputs.set("bad=name", "1"));
				assert.instanceOf(forEquals, InvalidOutputNameError);
				const forSeparator = yield* Effect.flip(outputs.exportVariable("bad<<name", "1"));
				assert.instanceOf(forSeparator, InvalidOutputNameError);
				const forJsonSeparator = yield* Effect.flip(outputs.setJson("bad=name", 1, Schema.Number));
				assert.instanceOf(forJsonSeparator, InvalidOutputNameError);
				const forTrailing = yield* Effect.flip(outputs.set("bad<", "1"));
				assert.instanceOf(forTrailing, InvalidOutputNameError);
				const forTrailingJson = yield* Effect.flip(outputs.setJson("bad<", 1, Schema.Number));
				assert.instanceOf(forTrailingJson, InvalidOutputNameError);
				assert.strictEqual(recorder.entries().length, 0);
			}).pipe(Effect.provide(recorder.layer));
		});
	});
});
