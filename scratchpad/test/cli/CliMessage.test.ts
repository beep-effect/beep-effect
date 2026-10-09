import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience, CurrentRuntimeEnv } from "../../effected/env/index.ts";
import { Console, Effect, Layer, Option, References } from "effect";
import { CliMessage, CliTheme, Status, Token } from "../../effected/cli/index.ts";
import { commandLines } from "./helpers/runnerCommands.ts";

/** A `Console` recording which stream each line went to, in one sequence. */
const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const console_: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { console: console_, out, err };
};

const run = (
	program: Effect.Effect<void, never, CliTheme | Audience>,
	options: {
		readonly audience?: AudienceKind;
		readonly color?: "none" | "basic" | "truecolor";
		readonly stderrColor?: "none" | "basic" | "truecolor";
		readonly glyphs?: "unicode" | "ascii";
		/** Provide `CurrentRuntimeEnv` with this CI; omitted, the service is not in the environment at all. */
		readonly ci?: "github-actions" | "generic" | "none";
	} = {},
) =>
	Effect.gen(function* () {
		const { console: double, out, err } = capturing();
		yield* program.pipe(
			Effect.provide(
				CliTheme.layerTest({
					color: options.color ?? "none",
					...(options.stderrColor === undefined ? {} : { stderrColor: options.stderrColor }),
					glyphs: options.glyphs ?? "unicode",
				}),
			),
			Effect.provide(Audience.layerTest(options.audience ?? "human")),
			Effect.provide(
				options.ci === undefined
					? Layer.empty
					: CurrentRuntimeEnv.layerTest({ ci: options.ci === "none" ? Option.none() : Option.some(options.ci) }),
			),
			Effect.provideService(Console.Console, double),
		);
		return { out, err };
	});

describe("CliMessage streams", () => {
	it.effect("success and info go to stdout, warning and failure to stderr", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.success("done");
					yield* CliMessage.info("fyi");
					yield* CliMessage.warning("careful");
					yield* CliMessage.failure("boom");
				}),
			);
			assert.deepStrictEqual(out, ["✓ done", "ℹ fyi"]);
			assert.deepStrictEqual(err, ["⚠ careful", "✗ boom"]);
		}),
	);

	it.effect("status defaults to stderr for a rank at or above warning's, so a custom status follows its rank", () =>
		Effect.gen(function* () {
			const vocab = Status.extend({
				timeout: { glyph: "⧖", ascii: "[time]", token: Token.hex("#e09a4e"), rank: 85 },
				note: { glyph: "·", ascii: "[note]", token: "muted", rank: 50 },
			});
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.status(vocab, "timeout", "slow");
					yield* CliMessage.status(vocab, "note", "fyi");
					yield* CliMessage.status(vocab, "skip", "skipped");
				}),
			);
			assert.deepStrictEqual(err, ["⧖ slow"]);
			assert.deepStrictEqual(out, ["· fyi", "↷ skipped"]);
		}),
	);

	it.effect("an explicit stream overrides the default", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.status(Status.core, "failure", "to stdout", { stream: "stdout" });
					yield* CliMessage.status(Status.core, "success", "to stderr", { stream: "stderr" });
				}),
			);
			assert.deepStrictEqual(out, ["✗ to stdout"]);
			assert.deepStrictEqual(err, ["✓ to stderr"]);
		}),
	);

	it.effect("uses the ASCII glyph when the theme's glyphs are ASCII", () =>
		Effect.gen(function* () {
			const { err } = yield* run(CliMessage.failure("boom"), { glyphs: "ascii" });
			assert.deepStrictEqual(err, ["[FAIL] boom"]);
		}),
	);
});

describe("CliMessage audience", () => {
	it.effect("a human with colour gets the glyph painted and the text plain", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.success("done");
					yield* CliMessage.failure("boom");
				}),
				{ audience: "human", color: "truecolor" },
			);
			assert.deepStrictEqual(out, ["\x1b[32m✓\x1b[39m done"]);
			assert.deepStrictEqual(err, ["\x1b[31m✗\x1b[39m boom"]);
		}),
	);

	for (const audience of ["agent"] as const) {
		it.effect(`${audience}: glyph and text, never coloured, even when the theme has colour`, () =>
			Effect.gen(function* () {
				const { out, err } = yield* run(
					Effect.gen(function* () {
						yield* CliMessage.success("done");
						yield* CliMessage.warning("careful");
						yield* CliMessage.failure("boom");
					}),
					{ audience, color: "truecolor" },
				);
				assert.deepStrictEqual(out, ["✓ done"]);
				assert.deepStrictEqual(err, ["⚠ careful", "✗ boom"]);
				for (const line of [...out, ...err]) assert.notInclude(line, "\x1b");
			}),
		);
	}

	it.effect("an agent with an ASCII theme gets the ASCII glyph, uncoloured", () =>
		Effect.gen(function* () {
			const { err } = yield* run(CliMessage.failure("boom"), { audience: "agent", color: "basic", glyphs: "ascii" });
			assert.deepStrictEqual(err, ["[FAIL] boom"]);
		}),
	);

	it.effect("a ci audience is themed like a human (only agent is forced plain)", () =>
		Effect.gen(function* () {
			const { out } = yield* run(CliMessage.success("done"), { audience: "ci", color: "basic" });
			assert.deepStrictEqual(out, ["\x1b[32m✓\x1b[39m done"]);
		}),
	);
});

describe("CliMessage and the logger", () => {
	it.effect("lines still print when the minimum log level is None: they go through Console, not the logger", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.success("done");
					yield* CliMessage.failure("boom");
				}).pipe(Effect.provideService(References.MinimumLogLevel, "None")),
			);
			assert.deepStrictEqual(out, ["✓ done"]);
			assert.deepStrictEqual(err, ["✗ boom"]);
		}),
	);
});

describe("CliMessage edge cases", () => {
	it.effect("empty text prints the glyph alone, with no trailing space", () =>
		Effect.gen(function* () {
			const human = yield* run(CliMessage.success(""));
			assert.deepStrictEqual(human.out, ["✓"]);
			const agent = yield* run(CliMessage.failure(""), { audience: "agent" });
			assert.deepStrictEqual(agent.err, ["✗"]);
		}),
	);

	it.effect("an agent audience honours an explicit stream override, still plain", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.status(Status.core, "failure", "to stdout", { stream: "stdout" });
					yield* CliMessage.status(Status.core, "success", "to stderr", { stream: "stderr" });
				}),
				{ audience: "agent", color: "truecolor" },
			);
			assert.deepStrictEqual(out, ["✗ to stdout"]);
			assert.deepStrictEqual(err, ["✓ to stderr"]);
		}),
	);

	it.effect("replacing the core warning with a low rank moves the stderr threshold for that vocabulary", () =>
		Effect.gen(function* () {
			const vocab = Status.extend({ warning: { glyph: "!", ascii: "!", token: "warning", rank: 5 } });
			const { out, err } = yield* run(
				Effect.gen(function* () {
					yield* CliMessage.status(vocab, "warning", "low");
					yield* CliMessage.status(vocab, "success", "above the new threshold");
				}),
			);
			// success (10) is now at or above warning's rank (5), so it goes to stderr with it.
			assert.deepStrictEqual(err, ["! low", "✓ above the new threshold"]);
			assert.deepStrictEqual(out, []);
		}),
	);
});

describe("CliMessage paints each line with the colour of the stream it goes to", () => {
	const both = Effect.gen(function* () {
		yield* CliMessage.success("ok");
		yield* CliMessage.failure("bad");
	});

	it.effect("stdout coloured and stderr not (tool 2>err.log): the failure line has no escape, success does", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(both, { color: "truecolor", stderrColor: "none" });
			assert.deepStrictEqual(out, ["\x1b[32m✓\x1b[39m ok"]);
			assert.deepStrictEqual(err, ["✗ bad"]);
		}),
	);

	it.effect("stderr coloured and stdout not (tool | jq): the reverse", () =>
		Effect.gen(function* () {
			const { out, err } = yield* run(both, { color: "none", stderrColor: "basic" });
			assert.deepStrictEqual(out, ["✓ ok"]);
			assert.deepStrictEqual(err, ["\x1b[31m✗\x1b[39m bad"]);
		}),
	);

	it.effect("an explicit stream override paints with that stream's colour", () =>
		Effect.gen(function* () {
			const { out } = yield* run(CliMessage.status(Status.core, "failure", "to stdout", { stream: "stdout" }), {
				color: "none",
				stderrColor: "basic",
			});
			assert.deepStrictEqual(out, ["✗ to stdout"]);
		}),
	);
});

describe("CliMessage joins the output policy: sanitised, and neutralized under GitHub Actions", () => {
	const ESC = String.fromCharCode(0x1b);
	const BEL = String.fromCharCode(7);
	const ZWSP = String.fromCodePoint(0x200b);
	const HOSTILE = `ok\n::add-mask::secret\n${ESC}[31mred${ESC}[0m ${ESC}]8;;http://evil${BEL}x${ESC}]8;;${BEL} a ##[error]b\rz`;

	const lines = (written: ReadonlyArray<string>) => written.join("\n").split(/\r\n|\r|\n/);

	it.effect("an agent gets no escape of any kind, whatever the text carries", () =>
		Effect.gen(function* () {
			for (const name of ["info", "failure"] as const) {
				const { out, err } = yield* run(CliMessage[name](HOSTILE), { audience: "agent", color: "truecolor" });
				const text = [...out, ...err].join("\n");
				assert.notInclude(text, ESC);
				assert.notInclude(text, BEL);
				assert.notInclude(text, "evil");
				assert.include(text, "red", "the text itself is kept");
			}
		}),
	);

	it.effect(
		"a human on a colour terminal gets only the glyph's own SGR from the kit: the text's escapes are gone",
		() =>
			Effect.gen(function* () {
				const { out } = yield* run(CliMessage.info(HOSTILE), { audience: "human", color: "truecolor" });
				const text = out.join("\n");
				assert.notInclude(text, `${ESC}[31mred`);
				assert.notInclude(text, `${ESC}]8`);
				assert.notInclude(text, BEL);
			}),
	);

	it.effect("under GitHub Actions no line is a command to either runner parser, for every audience", () =>
		Effect.gen(function* () {
			for (const audience of ["human", "agent", "ci"] as const) {
				const { out, err } = yield* run(
					Effect.all([CliMessage.info(HOSTILE), CliMessage.failure(HOSTILE)]).pipe(Effect.asVoid),
					{
						audience,
						ci: "github-actions",
					},
				);
				assert.deepStrictEqual(commandLines([...out, ...err].join("\n")), [], audience);
				assert.isAbove(lines([...out, ...err]).filter((line) => line.includes("add-mask")).length, 0);
			}
		}),
	);

	it.effect("outside GitHub Actions the lines are untouched: no zero-width space, the commands are still there", () =>
		Effect.gen(function* () {
			for (const ci of [undefined, "generic", "none"] as const) {
				const { out } = yield* run(CliMessage.info("ok\n::add-mask::secret\nx ##[error]y"), {
					audience: "agent",
					...(ci === undefined ? {} : { ci }),
				});
				const text = out.join("\n");
				assert.notInclude(text, ZWSP, String(ci));
				assert.strictEqual(commandLines(text).length, 2, String(ci));
			}
		}),
	);
});
