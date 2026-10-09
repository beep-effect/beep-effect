import { assert, describe, it } from "@effect/vitest";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import { Console, Effect, Layer, Option } from "effect";
import { CliLog, CliLogger } from "../../effected/cli/index.ts";
import { commandLines, isCommand } from "./helpers/runnerCommands.ts";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);
const ZWSP = String.fromCodePoint(0x200b);

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

type Ci = "github-actions" | "generic" | "absent";

const runtime = (ci: Ci) => (ci === "absent" ? Layer.empty : CurrentRuntimeEnv.layerTest({ ci: Option.some(ci) }));

/** Run `program` under the plain CliLogger and a captured Console, with an optional CurrentRuntimeEnv. */
const plain = (program: Effect.Effect<void>, ci: Ci = "absent", options: Parameters<typeof CliLogger.layer>[0] = {}) =>
	Effect.gen(function* () {
		const { double, err } = capturing();
		yield* program.pipe(
			Effect.provide(runtime(ci)),
			Effect.provide(CliLogger.layer(options)),
			Effect.provideService(Console.Console, double),
		);
		return err;
	});

/** The same under CliLog with a fixed format, level Debug, and the audience and terminal given. */
const diagnostics = (
	program: Effect.Effect<void>,
	format: "json" | "pretty",
	ci: Ci,
	audience: "human" | "agent" = "human",
) =>
	Effect.gen(function* () {
		const { double, err } = capturing();
		const terminal = TerminalEnv.layerTest({ stderr: { isTerminal: true, color: "truecolor" } });
		yield* program.pipe(
			Effect.provide(runtime(ci)),
			Effect.provide(
				CliLog.layer({ format, level: "Debug", plainLogger: false }).pipe(
					Layer.provide(Layer.mergeAll(terminal, Audience.layerTest(audience))),
				) as Layer.Layer<never>,
			),
			Effect.provideService(Console.Console, double),
		);
		return err;
	});

const HOSTILE = `x\r::error::injected\nprefix ##[add-mask]secret ${ESC}[31mred${ESC}[0m ${ESC}]8;;http://evil${BEL}y`;

describe("CliLogger sanitises and, under GitHub Actions, neutralizes", () => {
	it.effect("an agent or human gets no escape, BEL or carriage return from Effect.logError", () =>
		Effect.gen(function* () {
			const err = yield* plain(Effect.logError(`${ESC}[31mx${ESC}[0m`));
			assert.deepStrictEqual(err, ["x"]);
			const text = (yield* plain(Effect.logError(HOSTILE))).join("\n");
			assert.notInclude(text, ESC);
			assert.notInclude(text, BEL);
			assert.notInclude(text, "evil");
			assert.include(text, "injected", "the text itself is kept");
		}),
	);

	it.effect("under GitHub Actions no line is a command to either runner parser", () =>
		Effect.gen(function* () {
			for (const text of [
				HOSTILE,
				"x\n::error::y",
				"prefix ##[error]y",
				"a\r::add-mask::z",
				"b\r\n  ##[stop-commands]t",
			]) {
				const err = yield* plain(Effect.logError(text), "github-actions");
				assert.deepStrictEqual(commandLines(err.join("\n")), [], JSON.stringify(text));
				assert.isAbove(err.length, 0);
			}
		}),
	);

	it.effect(
		"outside GitHub Actions the text is left alone: no zero-width space, the command lines are still there",
		() =>
			Effect.gen(function* () {
				for (const ci of ["absent", "generic"] as const) {
					const err = yield* plain(Effect.logError("x\n::error::y ##[z]"), ci);
					assert.notInclude(err.join("\n"), ZWSP, ci);
					assert.strictEqual(commandLines(err.join("\n")).length, 1, ci);
				}
			}),
	);

	it.effect("an ordinary line and a bare ## are untouched, even under Actions", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* plain(Effect.log("synced 3 repos", "## Heading"), "github-actions"), [
				"synced 3 repos ## Heading",
			]);
		}),
	);

	it.effect("a custom render receives sanitised string input and owns its own output", () =>
		Effect.gen(function* () {
			const painted = (m: unknown) => `${ESC}[1m${String(Array.isArray(m) ? m.join(" ") : m)}${ESC}[22m`;
			const err = yield* plain(Effect.logError(`${ESC}[31mhostile${ESC}[0m`), "absent", { render: painted });
			assert.deepStrictEqual(err, [`${ESC}[1mhostile${ESC}[22m`]);
		}),
	);

	it.effect("a custom render's lines are still neutralized under Actions", () =>
		Effect.gen(function* () {
			const err = yield* plain(Effect.logError("fine"), "github-actions", { render: () => "::add-mask::from-render" });
			assert.deepStrictEqual(commandLines(err.join("\n")), []);
		}),
	);
});

describe("CliLog's pretty line sanitises and neutralizes", () => {
	it.effect("the message, and an error cause, carry no escape, whatever the audience", () =>
		Effect.gen(function* () {
			for (const audience of ["human", "agent"] as const) {
				const err = yield* diagnostics(
					Effect.logError(HOSTILE, new Error(`cause ${ESC}[2Jboom`)),
					"pretty",
					"absent",
					audience,
				);
				const text = err.join("\n");
				// The kit paints the level itself with a human on a colour terminal; nothing the message carried survives.
				assert.notInclude(text, `${ESC}[31mred`);
				assert.notInclude(text, `${ESC}]8`);
				assert.notInclude(text, `${ESC}[2J`);
				assert.notInclude(text, BEL);
				assert.notInclude(text, "evil");
				assert.include(text, "injected");
			}
		}),
	);

	it.effect("under GitHub Actions no pretty line is a command", () =>
		Effect.gen(function* () {
			for (const text of [HOSTILE, "x\n::error::y", "prefix ##[error]y", "a\r\n::add-mask::z"]) {
				const err = yield* diagnostics(Effect.logError(text), "pretty", "github-actions");
				assert.deepStrictEqual(commandLines(err.join("\n")), [], JSON.stringify(text));
				assert.isAbove(err.length, 0);
			}
		}),
	);

	it.effect("outside Actions the pretty text is untouched by neutralizing", () =>
		Effect.gen(function* () {
			const err = yield* diagnostics(Effect.logError("x\n::error::y"), "pretty", "generic");
			assert.notInclude(err.join("\n"), ZWSP);
			assert.isAbove(commandLines(err.join("\n")).length, 0);
		}),
	);
});

describe("CliLog's NDJSON: a runner can read ##[ out of a JSON string too", () => {
	const parsed = (line: string) => JSON.parse(line) as { message: unknown };

	it.effect("under Actions no NDJSON line is a command, and the message decodes back to exactly what was logged", () =>
		Effect.gen(function* () {
			for (const text of ["prefix ##[add-mask]secret", "x\n::error::y ##[stop-commands]t", "a ##[b] c ##[d]"]) {
				const err = yield* diagnostics(Effect.logError(text), "json", "github-actions");
				const lines = err.filter((line) => line.startsWith("{"));
				assert.strictEqual(lines.length, 1, JSON.stringify(err));
				assert.isFalse(isCommand(lines[0] ?? ""), `the legacy parser finds ##[ anywhere: ${lines[0]}`);
				assert.strictEqual(parsed(lines[0] ?? "").message, text, "lossless: the JSON decodes to the same text");
			}
		}),
	);

	it.effect("outside Actions the NDJSON line is exactly what JSON.stringify gives", () =>
		Effect.gen(function* () {
			const err = yield* diagnostics(Effect.logError("prefix ##[add-mask]secret"), "json", "absent");
			const line = err.find((entry) => entry.startsWith("{")) ?? "";
			assert.include(line, "##[add-mask]");
			assert.strictEqual(parsed(line).message, "prefix ##[add-mask]secret");
		}),
	);

	it.effect("a control character in a message is already escaped by JSON, so the line has none", () =>
		Effect.gen(function* () {
			const err = yield* diagnostics(Effect.logError(`a${ESC}[31mb\r\n`), "json", "github-actions");
			const line = err.find((entry) => entry.startsWith("{")) ?? "";
			assert.notInclude(line, ESC);
			assert.notInclude(line, "\r");
		}),
	);
});
