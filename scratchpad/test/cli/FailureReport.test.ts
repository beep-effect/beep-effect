// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import * as Data from "effect/Data";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import type { Document, FailureDetails, ReportFailuresOptions } from "../../effected/cli/index.ts";
import { CliDoc, CliLinks, CliLogger, CliRuntime, CliTheme, Doc, Render } from "../../effected/cli/index.ts";
import { commandLines } from "./helpers/runnerCommands.ts";

const Json = S.fromJsonString(S.Unknown);

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

const ESC = String.fromCharCode(0x1b);

const platform = Layer.mergeAll(
	Stdio.layerTest({ stdinIsTerminal: Effect.succeed(true), stdoutIsTerminal: Effect.succeed(true) }),
	Layer.succeed(
		Terminal.Terminal,
		Terminal.make({
			columns: Effect.succeed(100),
			rows: Effect.succeed(24),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	),
);

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

const USER = "/repo/src/run.ts";
const dying = (message: string) =>
	Effect.suspend(() => {
		const error = new Error(message);
		error.stack = `Error: ${message}\n    at run (${USER}:3:4)`;
		return Effect.die(error);
	});

const layers = (audience: AudienceKind) => {
	const terminal = TerminalEnv.layerTest({
		stdinIsTerminal: true,
		stdout: { isTerminal: true, color: "none" },
	});
	return Layer.mergeAll(
		terminal,
		CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
		Audience.layerTest(audience),
		CliLinks.layerTest("vscode"),
	);
};

describe("the report's last resort keeps the output policy", () => {
	/** A document whose block the renderer has no case for: the walker throws on it. */
	class Broken extends Data.TaggedError("Broken")<{ readonly message: string }> {
	override readonly name = "Error";
	constructor(message = "") { super({ message }); }

		[CliDoc](): Document {
			return [{ _tag: "NotABlock" } as never];
		}
	}

	it("control: the renderer really does throw on that document", () => {
		const ctx = Effect.runSync(Render.context("stderr").pipe(Effect.provide(layers("agent"))));
		assert.throws(() => Render.plain([{ _tag: "NotABlock" } as never], ctx));
	});

	it.effect("when the document cannot be rendered at all, the report is one sanitised, neutralized line", () =>
		Effect.gen(function* () {
			for (const env of [{ AI_AGENT: "x" }, { GITHUB_ACTIONS: "true" }, {}]) {
				const { double, err } = capturing();
				const message = `bad${ESC}[31m red ${ESC}]8;;http://evil\u0007x\r::error::injected\n##[add-mask]y`;
				yield* CliRuntime.main(
					Effect.suspend(() => Effect.fail(new Broken(message))),
					{
						platform,
						env: {},
					},
				).pipe(
					Effect.exit,
					Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
					Effect.provideService(Console.Console, double),
				);
				const text = err.join("\n");
				assert.isAbove(err.length, 0, Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.notInclude(text, ESC, Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.notInclude(text, "\u0007", Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.notInclude(text, "evil", Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.deepStrictEqual(commandLines(text), [], Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.include(text, "injected", "the text itself is kept");
			}
		}),
	);
});

describe("Doc.print forwards displayPath and width", () => {
	const doc: Document = [
		Doc.paragraph("open ", Doc.link({ file: `${USER}`, line: 3, col: 4 }, "x")),
		Doc.paragraph(Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ")),
	];

	const print = Effect.fn("print")(function* (audience: AudienceKind, options: Parameters<typeof Doc.print>[1]) {
			const { double, out } = capturing();
			yield* Doc.print(doc, options).pipe(
				Effect.provide(layers(audience)),
				Effect.provideService(Console.Console, double),
			);
			return out.join("\n");
		});

	it.effect("displayPath is applied to the link's path", () =>
		Effect.gen(function* () {
			const text = yield* print("agent", { displayPath: (p) => p.replace("/repo/", "") });
			assert.include(text, "src/run.ts:3:4");
			assert.notInclude(text, "/repo/");
			assert.include(yield* print("agent", {}), "/repo/src/run.ts:3:4", "control: the identity without it");
		}),
	);

	it.effect("width is the context's, so an agent can be laid out at a width after all", () =>
		Effect.gen(function* () {
			const narrow = yield* print("agent", { width: 30 });
			const longest = Math.max(...narrow.split("\n").map((line) => line.length));
			assert.isAtMost(longest, 40);
			const unbounded = yield* print("agent", {});
			assert.isAbove(Math.max(...unbounded.split("\n").map((line) => line.length)), 100, "control: unbounded");
		}),
	);
});

describe("main's env.displayPath is the default report's path display", () => {
	it.effect("stack frames are shown through it", () =>
		Effect.gen(function* () {
			for (const env of [{ AI_AGENT: "x" }, { TERM: "xterm-256color" }]) {
				const { double, err } = capturing();
				yield* CliRuntime.main(dying("kaboom"), {
					platform,
					env: { displayPath: (p) => p.replace("/repo/", "") },
				}).pipe(
					Effect.exit,
					Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
					Effect.provideService(Console.Console, double),
				);
				const text = err.join("\n");
				assert.include(text, "src/run.ts:3:4", Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.notInclude(text, "/repo/", Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
			}
			const { double, err } = capturing();
			yield* CliRuntime.main(dying("kaboom"), { platform, env: {} }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ AI_AGENT: "x" })),
				Effect.provideService(Console.Console, double),
			);
			assert.include(err.join("\n"), "/repo/src/run.ts:3:4", "control: absolute without the option");
		}),
	);

	it("defaultRender is unchanged by it: plain lines of the cause", () => {
		const cause = Cause.fail(new Error("x"));
		const lines = CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: false });
		assert.isAbove((typeof lines === "string" ? [lines] : lines).length, 0);
	});
});

describe("a consumer render's output is untrusted text", () => {
	const ZWSP = String.fromCodePoint(0x200b);
	const BEL = String.fromCharCode(7);
	const PROBE = [
		"fine",
		"::add-mask::secret",
		"prefix ##[error]y",
		`${ESC}[31mred${ESC}[0m`,
		`${ESC}]8;;http://evil${BEL}z`,
	];
	const render = () => PROBE;

	const reportWith = Effect.fn("reportWith")(function* (env: Record<string, string>, options: { readonly env?: boolean } = {}) {
			const { double, err } = capturing();
			const program = Effect.suspend(() => Effect.fail(new TestError("x")));
			yield* (
				options.env === false
					? CliRuntime.main(program, { platform: Layer.empty, render })
					: CliRuntime.main(program, { platform, env: { audienceEnvVar: "TEST_AUDIENCE" }, render })
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
				Effect.provideService(Console.Console, double),
			);
			return err;
		});

	it.effect("under GitHub Actions no line is a command, whatever the audience", () =>
		Effect.gen(function* () {
			for (const env of [
				{ GITHUB_ACTIONS: "true", AI_AGENT: "x" },
				{ GITHUB_ACTIONS: "true", TEST_AUDIENCE: "human", TERM: "xterm-256color" },
				{ GITHUB_ACTIONS: "true" },
			]) {
				const err = yield* reportWith(env);
				assert.deepStrictEqual(commandLines(err.join("\n")), [], Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
				assert.isAbove(err.length, 0);
				assert.include(err.join("\n"), "secret", "the text itself is kept");
			}
		}),
	);

	it.effect("an agent gets no escape of any kind from it", () =>
		Effect.gen(function* () {
			const err = yield* reportWith({ AI_AGENT: "x", TERM: "xterm-256color" });
			const text = err.join("\n");
			assert.notInclude(text, ESC);
			assert.notInclude(text, BEL);
			assert.notInclude(text, "evil");
			assert.include(text, "red");
			// Outside Actions nothing is neutralized, so the command lines are still there.
			assert.notInclude(text, ZWSP);
		}),
	);

	it.effect(
		"a ci audience, which is what GitHub Actions detects, gets no escape either: OSC 8 and BEL are stripped",
		() =>
			Effect.gen(function* () {
				// Detected CI (GITHUB_ACTIONS, no override) and an explicit ci audience outside Actions.
				for (const env of [{ GITHUB_ACTIONS: "true" }, { TEST_AUDIENCE: "ci" }, { CI: "true", TEST_AUDIENCE: "ci" }]) {
					const err = yield* reportWith(env);
					const text = err.join("\n");
					assert.notInclude(text, ESC, Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
					assert.notInclude(text, BEL, Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
					assert.notInclude(text, "evil", Result.getOrThrow(S.encodeUnknownResult(Json)(env)));
					assert.include(text, "red", "the text itself is kept");
					if (env.GITHUB_ACTIONS !== undefined) assert.deepStrictEqual(commandLines(text), [], "and still neutralized");
				}
			}),
	);

	it.effect("a human outside GitHub Actions keeps the consumer's own escapes, and nothing is neutralized", () =>
		Effect.gen(function* () {
			const err = yield* reportWith({ TEST_AUDIENCE: "human", TERM: "xterm-256color" });
			const text = err.join("\n");
			assert.include(text, `${ESC}[31mred`, "the consumer's SGR is theirs");
			assert.notInclude(text, ZWSP);
			assert.strictEqual(commandLines(text).length, 2, "control: the command lines are really there");
		}),
	);

	it.effect("a human under GitHub Actions keeps the consumer's SGR but is neutralized", () =>
		Effect.gen(function* () {
			const err = yield* reportWith({ GITHUB_ACTIONS: "true", TEST_AUDIENCE: "human", TERM: "xterm-256color" });
			const text = err.join("\n");
			assert.include(text, `${ESC}[31mred`);
			assert.deepStrictEqual(commandLines(text), []);
		}),
	);

	it.effect("with no environment services at all it neutralizes, and does not strip what it cannot judge", () =>
		Effect.gen(function* () {
			const err = yield* reportWith({}, { env: false });
			const text = err.join("\n");
			assert.deepStrictEqual(commandLines(text), []);
			assert.include(text, `${ESC}[31mred`, "an unknown audience is not an agent: no sanitising");
		}),
	);

	it.effect("a render that returns one string with line breaks is neutralized per line", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			yield* CliRuntime.main(
				Effect.suspend(() => Effect.fail(new TestError("x"))),
				{
					platform,
					env: {},
					render: () => "a\r::add-mask::b\n##[error]c",
				},
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ GITHUB_ACTIONS: "true" })),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(commandLines(err.join("\n")), []);
		}),
	);
});

describe("a delegating render gets the default report", () => {
	const human = ConfigProvider.fromUnknown({ TERM: "xterm-256color", FORCE_COLOR: "3" });
	const report = Effect.fn("report")(function* (render?: NonNullable<ReportFailuresOptions["render"]>) {
			const { double, err } = capturing();
			yield* CliRuntime.main(dying("kaboom"), {
				platform,
				env: { displayPath: (p) => p.replace("/repo/", "") },
				...(render === undefined ? {} : { render }),
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, human),
				Effect.provideService(Console.Console, double),
			);
			return err;
		});

	it.effect(
		"details.defaultLines is the report the kit would write, painted and path-displayed: returned, it is identical",
		() =>
			Effect.gen(function* () {
				const kit = yield* report();
				assert.isTrue(
					kit.some((line) => line.includes(ESC)),
					"control: the default report is painted for this human",
				);
				assert.include(kit.join("\n"), "src/run.ts:3:4");
				const delegated = yield* report((_error, details) => details.defaultLines);
				assert.deepStrictEqual(delegated, kit);
			}),
	);

	it("defaultRender with status: false drops the leading status mark, so a prefix reads cleanly", () => {
		const cause = Cause.fail(new Error("boom"));
		const lines = (value: string | ReadonlyArray<string>) => (typeof value === "string" ? [value] : value);
		const withStatus = lines(CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: false }));
		assert.match(withStatus[0] ?? "", /^\[FAIL\] /, "control: the status leads by default");
		const without = lines(CliRuntime.defaultRender(Cause.squash(cause), { cause, isDefect: false }, { status: false }));
		assert.strictEqual(`vitest-agent: ${without[0]}`, "vitest-agent: Error: boom");
	});
});

describe("details.lines: the run's report, with or without its status (A2)", () => {
	const run = Effect.fn("run")(function* (env: Record<string, string>, render: NonNullable<ReportFailuresOptions["render"]>) {
			const { double, err } = capturing();
			yield* CliRuntime.main(dying("kaboom"), {
				platform,
				env: { displayPath: (p) => p.replace("/repo/", "") },
				render,
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
				Effect.provideService(Console.Console, double),
			);
			return err;
		});

	it.effect("a prefixing render keeps the run's displayPath and has no status marker", () =>
		Effect.gen(function* () {
			const err = yield* run({ AI_AGENT: "x" }, (_error, details) =>
				details.lines({ status: false }).map((line, index) => (index === 0 ? `prog: ${line}` : line)),
			);
			assert.strictEqual(err[0], "prog: Error: kaboom");
			const text = err.join("\n");
			assert.include(text, "src/run.ts:3:4");
			assert.notInclude(text, "/repo/");
			assert.notInclude(text, "[FAIL]");
		}),
	);

	it.effect("for a person it keeps the run's colour, and drops the status glyph", () =>
		Effect.gen(function* () {
			const human = { TERM: "xterm-256color", FORCE_COLOR: "3" };
			const withStatus = yield* run(human, (_error, details) => details.lines());
			const without = yield* run(human, (_error, details) => details.lines({ status: false }));
			assert.isTrue(
				without.some((line) => line.includes(ESC)),
				"painted, like the run",
			);
			assert.notStrictEqual(withStatus[0], without[0], "control: the status leads lines()");
			assert.include(without.join("\n"), "src/run.ts:3:4");
			// biome-ignore lint/suspicious/noControlCharactersInRegex: the SGR sequences being stripped
			const strip = (line: string | undefined) => (line ?? "").replace(/\u001b\[[0-9;]*m/g, "");
			assert.strictEqual(strip(without[0]), "Error: kaboom");
			assert.match(strip(withStatus[0]), /^\S+ Error: kaboom$/, "control: a glyph leads lines()");
		}),
	);

	it.effect("lines() is defaultLines", () =>
		Effect.gen(function* () {
			let pair: readonly [ReadonlyArray<string>, ReadonlyArray<string>] | undefined;
			yield* run({ TERM: "xterm-256color", FORCE_COLOR: "3" }, (_error, details) => {
				pair = [details.lines(), details.defaultLines];
				return details.defaultLines;
			});
			assert.isDefined(pair);
			assert.deepStrictEqual(pair?.[0], pair?.[1]);
		}),
	);
});

describe("main's env.stackFrames (A3)", () => {
	const VENDOR = "/repo/node_modules/vendor/dist/run.js";
	const dyingThroughVendor = Effect.suspend(() => {
		const error = new Error("kaboom");
		error.stack = `Error: kaboom\n    at run (${USER}:3:4)\n    at vendor (${VENDOR}:7:8)`;
		return Effect.die(error);
	});
	const run = Effect.fn("run")(function* (stackFrames: "app" | "all" | undefined, render?: NonNullable<ReportFailuresOptions["render"]>) {
			const { double, err } = capturing();
			yield* CliRuntime.main(dyingThroughVendor, {
				platform,
				env: { displayPath: (p) => p.replace("/repo/", ""), ...(stackFrames === undefined ? {} : { stackFrames }) },
				...(render === undefined ? {} : { render }),
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ AI_AGENT: "x" })),
				Effect.provideService(Console.Console, double),
			);
			return err.join("\n");
		});

	it.effect("the default report hides a node_modules frame, and shows the program's through displayPath", () =>
		Effect.gen(function* () {
			const text = yield* run(undefined);
			assert.include(text, "src/run.ts:3:4");
			assert.notInclude(text, "/repo/");
			assert.notInclude(text, "vendor");
		}),
	);

	it.effect('"all" keeps it in the default report, in defaultLines and in lines(), through displayPath', () =>
		Effect.gen(function* () {
			for (const render of [
				undefined,
				(_e: unknown, d: FailureDetails) => d.defaultLines,
				(_e: unknown, d: FailureDetails) => d.lines({ status: false }),
			]) {
				const text = yield* run("all", render);
				assert.include(text, "node_modules/vendor/dist/run.js:7:8");
				assert.notInclude(text, "/repo/");
			}
		}),
	);
});

describe("a report target that cannot be built falls back to plain", () => {
	it.effect(
		"bare reportFailures with services whose terminal width throws: the plain report, not an escaped defect",
		() =>
			Effect.gen(function* () {
				const { double, err } = capturing();
				const stream = { isTerminal: true, color: "none" as const, hyperlinks: false, columns: O.none<number>() };
				const hostileTerminal = Layer.succeed(TerminalEnv, {
					stdinIsTerminal: true,
					stdout: stream,
					stderr: stream,
					width: () => {
						throw new Error("width exploded");
					},
				});
				const services = Layer.mergeAll(
					hostileTerminal,
					CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(TerminalEnv.layerTest())),
					Audience.layerTest("human"),
					CliLinks.layerTest("off"),
				);
				const exit = yield* Effect.fail(new TestError("disk full")).pipe(
					CliRuntime.reportFailures(),
					Effect.provide(services),
					Effect.provide(CliLogger.layer()),
					Effect.provideService(Console.Console, double),
					Effect.exit,
				);
				assert.isTrue(Exit.isFailure(exit));
				const squashed = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
				assert.include(String(squashed), "disk full", "the program's own failure, not the target's defect");
				assert.include(err.join("\n"), "disk full");
			}),
	);
});
