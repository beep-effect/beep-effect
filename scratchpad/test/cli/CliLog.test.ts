// @effect-diagnostics strictEffectProvide:skip-file
import * as Data from "effect/Data";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience, CurrentRuntimeEnv, RuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import { Command } from "effect/cli";
import type { CliLogFile, CliLoggerOptions } from "../../effected/cli/index.ts";
import { CliLog, CliLogger, CliRuntime } from "../../effected/cli/index.ts";
import { LINE_BREAK, isCommand } from "./helpers/runnerCommands.ts";

class TestError extends Data.TaggedError("TestError")<{ readonly message: string; readonly cause?: unknown }> {
	override readonly name = "Error";
	constructor(message: string, options?: { readonly cause?: unknown }) { super({ message, ...options }); }
}

const ENV = "VITEST_REPORTER_LOG_LEVEL";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

interface Setup {
	readonly env?: Record<string, string>;
	readonly audience?: AudienceKind;
	readonly stderrTty?: boolean;
	readonly color?: "none" | "basic";
	readonly format?: "auto" | "json" | "pretty";
	readonly logger?: CliLoggerOptions;
}

/** CliLog.layer owns the whole logger set, so the stderr CliLogger it builds is always present beside the sink. */
const diagnostics = (setup: Setup = {}) =>
	CliLog.layer({
		envVar: ENV,
		...(setup.format === undefined ? {} : { format: setup.format }),
		...(setup.logger === undefined ? {} : { logger: setup.logger }),
	}).pipe(
		Layer.provide(
			Layer.mergeAll(
				Audience.layerTest(setup.audience ?? "agent"),
				TerminalEnv.layerTest({ stderr: { isTerminal: setup.stderrTty ?? false, color: setup.color ?? "none" } }),
			),
		),
	);

const capture = Effect.fn("capture")(function* (program: Effect.Effect<void>, setup: Setup = {}) {
		const { double, out, err } = capturing();
		yield* program.pipe(
			Effect.provide(diagnostics(setup)),
			Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(setup.env ?? {})),
			Effect.provideService(Console.Console, double),
		);
		return { out, err };
	});

const both = Effect.gen(function* () {
	yield* Effect.logDebug("dbg");
	yield* Effect.logError("boom");
});

/** The sink's NDJSON lines: CliLogger's plain lines share stderr, so a parser reads the lines that start with `{`. */
const ndjson = (lines: ReadonlyArray<string>): ReadonlyArray<string> => lines.filter((line) => line.startsWith("{"));
/** The sink's pretty lines: a time, a level, then the message. */
const pretty = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
	lines.filter((line) => /^\d\d:\d\d:\d\d\.\d{3} /.test(line));

const json = (line: string): { level: string; message: unknown; annotations: Record<string, unknown> } =>
	JSON.parse(line);

describe("CliLog.Level", () => {
	it.effect("defaults to None", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* CliLog.Level, "None");
		}),
	);
});

describe("CliLog.layer threshold", () => {
	it.effect("with no env var the sink stays silent; CliLogger still prints the error plainly", () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(both);
			assert.deepStrictEqual(ndjson(err), []);
			assert.deepStrictEqual(err, ["boom"]);
			assert.deepStrictEqual(out, []);
		}),
	);

	it.effect(`${ENV}=debug writes both as NDJSON to stderr only under an agent audience`, () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(both, { env: { [ENV]: "debug" }, audience: "agent" });
			assert.deepStrictEqual(out, []);
			assert.strictEqual(ndjson(err).length, 2);
			assert.deepStrictEqual(
				ndjson(err).map((l) => json(l).level),
				["DEBUG", "ERROR"],
			);
			assert.deepStrictEqual(
				ndjson(err).map((l) => json(l).message),
				["dbg", "boom"],
			);
		}),
	);

	it.effect(`${ENV}=debug writes pretty lines under a human with a stderr TTY`, () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(both, {
				env: { [ENV]: "debug" },
				audience: "human",
				stderrTty: true,
			});
			assert.deepStrictEqual(out, []);
			assert.strictEqual(pretty(err).length, 2);
			assert.match(pretty(err)[0] ?? "", /^\d\d:\d\d:\d\d\.\d{3} DEBUG dbg$/);
			assert.match(pretty(err)[1] ?? "", /^\d\d:\d\d:\d\d\.\d{3} ERROR boom$/);
			assert.deepStrictEqual(ndjson(err), []);
		}),
	);

	it.effect("only records at or above the level are written", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.logDebug("d");
					yield* Effect.logInfo("i");
					yield* Effect.logWarning("w");
					yield* Effect.logError("e");
				}),
				{ env: { [ENV]: "warn" } },
			);
			assert.deepStrictEqual(
				ndjson(err).map((l) => json(l).level),
				["WARN", "ERROR"],
			);
		}),
	);

	it.effect("scoping CliLog.Level narrows the threshold further", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(both.pipe(Effect.provideService(CliLog.Level, "Error")), {
				env: { [ENV]: "debug" },
			});
			assert.deepStrictEqual(
				ndjson(err).map((l) => json(l).message),
				["boom"],
			);
		}),
	);

	describe("level aliases are case-insensitive", () => {
		const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
			["WARN", ["WARN", "ERROR", "FATAL"]],
			["Warning", ["WARN", "ERROR", "FATAL"]],
			["error", ["ERROR", "FATAL"]],
			["INFO", ["INFO", "WARN", "ERROR", "FATAL"]],
			["fatal", ["FATAL"]],
			["none", []],
			["all", ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]],
			["trace", ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"]],
		];
		for (const [value, expected] of cases) {
			it.effect(`${value} => ${expected.join(",") || "nothing"}`, () =>
				Effect.gen(function* () {
					const { err } = yield* capture(
						Effect.gen(function* () {
							yield* Effect.logTrace("t");
							yield* Effect.logDebug("d");
							yield* Effect.logInfo("i");
							yield* Effect.logWarning("w");
							yield* Effect.logError("e");
							yield* Effect.logFatal("f");
						}),
						{ env: { [ENV]: value } },
					);
					assert.deepStrictEqual(
						ndjson(err).map((l) => json(l).level),
						expected,
					);
				}),
			);
		}
	});

	it.effect("an invalid value warns exactly once through the existing logger, not the sink, and stays silent", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(Effect.logError("boom"), { env: { [ENV]: "bogus" } });
			// The one line is the plain CliLogger warning and "boom" (an Info-or-above record) printed by CliLogger;
			// nothing is written as NDJSON by the sink.
			assert.strictEqual(err.filter((l) => l.includes("bogus")).length, 1, err.join("\n"));
			assert.deepStrictEqual(ndjson(err), []);
			assert.deepStrictEqual(
				err.filter((l) => !l.includes("bogus")),
				["boom"],
			);
		}),
	);
});

const env = { [ENV]: "info" };

describe("CliLog.layer format", () => {
	const one = Effect.logInfo("hello");

	it.effect("auto is NDJSON for an agent and for ci", () =>
		Effect.gen(function* () {
			for (const audience of ["agent", "ci"] as const) {
				const { err } = yield* capture(one, { env, audience, stderrTty: true });
				assert.strictEqual(json(ndjson(err)[0] ?? "").message, "hello", audience);
				assert.deepStrictEqual(pretty(err), []);
			}
		}),
	);

	it.effect("auto is plain for a human whose stderr is not a terminal, with no NDJSON line and no escape", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(one, { env, audience: "human", stderrTty: false, color: "none" });
			assert.match(pretty(err)[0] ?? "", /INFO hello$/);
			assert.deepStrictEqual(ndjson(err), []);
			assert.notInclude(err.join("\n"), "\x1b");
		}),
	);

	it.effect("auto is plain for a human on a terminal too: the audience alone decides", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(one, { env, audience: "human", stderrTty: true });
			assert.match(pretty(err)[0] ?? "", /INFO hello$/);
			assert.deepStrictEqual(ndjson(err), []);
		}),
	);

	it.effect("auto is NDJSON for an agent and a CI whose stderr is not a terminal", () =>
		Effect.gen(function* () {
			for (const audience of ["agent", "ci"] as const) {
				const { err } = yield* capture(one, { env, audience, stderrTty: false });
				assert.strictEqual(json(ndjson(err)[0] ?? "").message, "hello", audience);
				assert.deepStrictEqual(pretty(err), []);
			}
		}),
	);

	it.effect("an explicit format overrides auto", () =>
		Effect.gen(function* () {
			const asPretty = yield* capture(one, { env, audience: "agent", format: "pretty" });
			assert.match(pretty(asPretty.err)[0] ?? "", /INFO hello$/);
			const asJson = yield* capture(one, { env, audience: "human", stderrTty: true, format: "json" });
			assert.strictEqual(json(ndjson(asJson.err)[0] ?? "").message, "hello");
		}),
	);

	it.effect("pretty colour comes from TerminalEnv.stderr.color, not from a TTY check", () =>
		Effect.gen(function* () {
			const plain = yield* capture(one, { env, audience: "human", stderrTty: true, color: "none" });
			assert.notInclude(pretty(plain.err)[0] ?? "", "\x1b");
			const coloured = yield* capture(one, { env, audience: "human", stderrTty: true, color: "basic" });
			assert.include(pretty(coloured.err)[0] ?? "", "\x1b[");
			assert.include(pretty(coloured.err)[0] ?? "", "hello");
		}),
	);
});

describe("CliLog.component", () => {
	const work = CliLog.component("plugin")(Effect.logInfo("starting"));

	it.effect("shows as [plugin] in pretty output", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(work, { env: { [ENV]: "info" }, audience: "human", stderrTty: true });
			assert.match(pretty(err)[0] ?? "", /INFO \[plugin\] starting$/);
		}),
	);

	it.effect("is a field in NDJSON", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(work, { env: { [ENV]: "info" }, audience: "agent" });
			assert.strictEqual(json(ndjson(err)[0] ?? "").annotations.component, "plugin");
		}),
	);
});

describe("CliLog owns the logger set", () => {
	const boom = Command.make("boom", {}, () => Effect.fail(new TestError("boom")));
	const inside = Command.make("inside", {}, () => Effect.logDebug("inside"));
	const app = Command.make("tool").pipe(Command.withSubcommands([boom, inside]));

	const inputs = Layer.mergeAll(Audience.layerTest("agent"), TerminalEnv.layerTest());
	const diagnostic = () => CliLog.layer({ envVar: ENV }).pipe(Layer.provide(inputs));

	const runMain = Effect.fnUntraced(function* (argv: ReadonlyArray<string>, env: Record<string, string> = {}, logger: Layer.Layer<never> = diagnostic()) {
			const { double, out, err } = capturing();
			const exit = yield* CliRuntime.main(Command.runWith(app, { version: "1.0.0" })(argv), {
				platform: NodeServices.layer,
				logger,
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
				Effect.provideService(Console.Console, double),
			);
			const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
			return { out, err, code };
		});

	// Neither the diagnostics default nor `--log-level none` may silence the failure report.
	for (const argv of [["boom"], ["--log-level", "none", "boom"]]) {
		it.effect(`a failure is still reported, once and plain, with the diagnostics level None: ${argv.join(" ")}`, () =>
			Effect.gen(function* () {
				const { out, err, code } = yield* runMain(argv);
				assert.deepStrictEqual(err, ["[FAIL] Error: boom"]);
				assert.deepStrictEqual(out, []);
				assert.strictEqual(code, 1);
			}),
		);
	}

	it.effect("the diagnostics level does not make CliLogger print debug records: only the sink does", () =>
		Effect.gen(function* () {
			const { err } = yield* runMain(["inside"], { [ENV]: "debug" });
			// One NDJSON line from the sink. CliLogger keeps the threshold it had and prints nothing for a debug record.
			assert.strictEqual(err.length, 1, err.join("\n"));
			assert.strictEqual(json(err[0] ?? "").level, "DEBUG");
		}),
	);

	it.effect("with the level at debug a failure is reported plain by CliLogger and also recorded by the sink", () =>
		Effect.gen(function* () {
			const { err, code } = yield* runMain(["boom"], { [ENV]: "debug" });
			assert.strictEqual(code, 1);
			assert.include(err, "[FAIL] Error: boom");
			assert.isTrue(ndjson(err).some((line) => json(line).level === "ERROR"));
		}),
	);

	it.effect("--log-level debug: the sink follows the flag, with the diagnostics level still None", () =>
		Effect.gen(function* () {
			const { err } = yield* runMain(["--log-level", "debug", "inside"]);
			assert.isTrue(ndjson(err).some((line) => json(line).message === "inside"));
		}),
	);

	it.effect("without the flag or the env var a debug record writes nothing", () =>
		Effect.gen(function* () {
			const { err } = yield* runMain(["inside"]);
			assert.deepStrictEqual(err, []);
		}),
	);

	it.effect("--log-level none silences the sink even with the diagnostics level at debug", () =>
		Effect.gen(function* () {
			const { err } = yield* runMain(["--log-level", "none", "inside"], { [ENV]: "debug" });
			assert.deepStrictEqual(err, []);
		}),
	);

	// The layer builds CliLogger itself and replaces the logger set without reading it, so there is no order to get
	// wrong: every wiring below gives the same result.
	describe("the wiring order does not matter", () => {
		const wirings: ReadonlyArray<readonly [string, () => Layer.Layer<never>]> = [
			["CliLog.layer alone", diagnostic],
			[
				"CliLog.layer over CliLogger.layer (the old canonical order)",
				() => CliLog.layer({ envVar: ENV }).pipe(Layer.provide(CliLogger.layer()), Layer.provide(inputs)),
			],
			[
				"CliLogger.layer merged before CliLog.layer",
				() => Layer.mergeAll(CliLogger.layer(), CliLog.layer({ envVar: ENV }).pipe(Layer.provide(inputs))),
			],
		];
		for (const [label, wiring] of wirings) {
			it.effect(`${label}: the sink records a debug record and CliLogger stays quiet; the failure is reported`, () =>
				Effect.gen(function* () {
					const debug = yield* runMain(["inside"], { [ENV]: "debug" }, wiring());
					assert.strictEqual(debug.err.length, 1, debug.err.join("\n"));
					assert.strictEqual(json(debug.err[0] ?? "").level, "DEBUG");
					const failed = yield* runMain(["boom"], {}, wiring());
					assert.deepStrictEqual(failed.err, ["[FAIL] Error: boom"]);
					assert.strictEqual(failed.code, 1);
				}),
			);
		}
	});

	it.effect("passes options through to the CliLogger it builds", () =>
		Effect.gen(function* () {
			const { out, err } = yield* capture(Effect.logInfo("hello"), { logger: { stderrFrom: "Error" } });
			// With stderrFrom Error an Info record is program-facing output on stdout, not a diagnostic.
			assert.deepStrictEqual(out, ["hello"]);
			assert.deepStrictEqual(err, []);
		}),
	);
});

describe("CliLog.layer extraLoggers", () => {
	it.effect("owning the set does not drop an extra logger: it receives records, at the minimum level it had", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const extra = Logger.make<unknown, void>((record) => {
				seen.push(`${record.logLevel}:${String(record.message)}`);
			});
			const { double } = capturing();
			yield* Effect.gen(function* () {
				yield* Effect.logDebug("dbg");
				yield* Effect.logError("boom");
			}).pipe(
				Effect.provide(
					CliLog.layer({ envVar: ENV, extraLoggers: [extra] }).pipe(
						Layer.provide(Layer.mergeAll(Audience.layerTest("agent"), TerminalEnv.layerTest())),
					),
				),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ [ENV]: "debug" })),
				Effect.provideService(Console.Console, double),
			);
			// The debug record reached the diagnostics sink but not the extra logger, which keeps filtering at Info.
			assert.deepStrictEqual(seen, ["Error:boom"]);
		}),
	);

	it.effect("an extra logger receives ordinary records when diagnostics are off", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const extra = Logger.make<unknown, void>((record) => {
				seen.push(String(record.message));
			});
			const { double } = capturing();
			yield* Effect.logInfo("hello").pipe(
				Effect.provide(
					CliLog.layer({ extraLoggers: [extra] }).pipe(
						Layer.provide(Layer.mergeAll(Audience.layerTest("agent"), TerminalEnv.layerTest())),
					),
				),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(seen, ["hello"]);
		}),
	);
});

describe("CliLog.layer format follows the audience in force for each record", () => {
	const inside = (kind: AudienceKind) =>
		Effect.logInfo("hello").pipe(Effect.provideService(Audience, { kind, source: "flag" }));

	it.effect("a human terminal with --agent in force gets NDJSON for records logged inside the flagged scope", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(
				Effect.gen(function* () {
					yield* Effect.logInfo("outside");
					yield* inside("agent");
				}),
				{ env, audience: "human", stderrTty: true },
			);
			// Outside the flag the build-time audience (human on a TTY) gives pretty; inside it, agent gives NDJSON.
			assert.match(pretty(err).join("\n"), /INFO outside$/);
			assert.deepStrictEqual(
				ndjson(err).map((line) => json(line).message),
				["hello"],
			);
		}),
	);

	it.effect("and the reverse: an agent build with --human in force gets pretty", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(inside("human"), { env, audience: "agent", stderrTty: true });
			assert.match(pretty(err).join("\n"), /INFO hello$/);
			assert.deepStrictEqual(ndjson(err), []);
		}),
	);

	it.effect("an explicit format is never overridden by the audience in force", () =>
		Effect.gen(function* () {
			const { err } = yield* capture(inside("agent"), { env, audience: "human", stderrTty: true, format: "pretty" });
			assert.match(pretty(err).join("\n"), /INFO hello$/);
		}),
	);
});

describe("CliLog.layer under GitHub Actions captured when it was built", () => {
	const hostile = Effect.logWarning("::error::injected\n##[warning]also");
	/** A host's layer: CliLog built over a layer whose CurrentRuntimeEnv says GitHub Actions, never in the fiber. */
	const hosted = (neutralize?: boolean | "auto") =>
		CliLog.layer({
			level: "Info",
			format: "json",
			plainLogger: false,
			...(neutralize === undefined ? {} : { neutralize }),
		}).pipe(Layer.provide(CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") })));
	const commands = (lines: ReadonlyArray<string>) => lines.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand);
	const written = Effect.fn("written")(function* (layer: Layer.Layer<never>) {
			const { double, err } = capturing();
			yield* hostile.pipe(Effect.provide(layer), Effect.provideService(Console.Console, double));
			return err;
		});

	it.effect("auto: a record from a fiber without CurrentRuntimeEnv is neutralized from the capture", () =>
		Effect.gen(function* () {
			const err = yield* written(hosted());
			assert.isNotEmpty(err, "the record was written");
			assert.deepStrictEqual(commands(err), []);
		}),
	);

	it.effect("false never neutralizes, and true always does even with nothing captured", () =>
		Effect.gen(function* () {
			assert.isNotEmpty(commands(yield* written(hosted(false))), "false leaves the command");
			const bare = CliLog.layer({ level: "Info", format: "json", plainLogger: false, neutralize: true });
			assert.deepStrictEqual(commands(yield* written(bare)), []);
			const control = CliLog.layer({ level: "Info", format: "json", plainLogger: false });
			assert.isNotEmpty(commands(yield* written(control)), "control: off Actions, nothing captured, not neutralized");
		}),
	);
});

describe("CliLog.layer's runtimeEnv option (A9)", () => {
	const hostile = Effect.logWarning("::error::injected\n##[warning]also");
	const commands = (lines: ReadonlyArray<string>) => lines.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand);
	const actions = RuntimeEnv.fromRecord({ GITHUB_ACTIONS: "true" });
	const local = RuntimeEnv.fromRecord({});
	const written = Effect.fn("written")(function* (layer: Layer.Layer<never>, inFiber?: RuntimeEnv) {
			const { double, err } = capturing();
			const program = inFiber === undefined ? hostile : Effect.provideService(hostile, CurrentRuntimeEnv, inFiber);
			yield* program.pipe(Effect.provide(layer), Effect.provideService(Console.Console, double));
			return err;
		});

	it.effect("with runtimeEnv saying GitHub Actions and no service anywhere, a record is neutralized", () =>
		Effect.gen(function* () {
			const err = yield* written(CliLog.layer({ level: "Info", format: "json", runtimeEnv: actions }));
			assert.isAtLeast(err.length, 2, "the plain line and the NDJSON line were both written");
			assert.deepStrictEqual(commands(err), []);
			const control = yield* written(CliLog.layer({ level: "Info", format: "json" }));
			assert.isNotEmpty(commands(control), "control: without it nothing says Actions, and nothing is neutralized");
		}),
	);

	it.effect("it beats the captured service", () =>
		Effect.gen(function* () {
			const captured = CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") });
			const overridden = CliLog.layer({ level: "Info", format: "json", runtimeEnv: local }).pipe(
				Layer.provide(captured),
			);
			assert.isNotEmpty(commands(yield* written(overridden)), "the option said not Actions");
			const capturedOnly = CliLog.layer({ level: "Info", format: "json" }).pipe(Layer.provide(captured));
			assert.deepStrictEqual(commands(yield* written(capturedOnly)), [], "control: the capture alone neutralizes");
		}),
	);

	it.effect("the logging fiber's own CurrentRuntimeEnv still beats it", () =>
		Effect.gen(function* () {
			const layer = CliLog.layer({ level: "Info", format: "json", runtimeEnv: actions });
			assert.isNotEmpty(commands(yield* written(layer, local)), "the fiber said not Actions");
		}),
	);
});

/** The `R` of a layer. */
type RIn<L> = L extends Layer.Layer<infer _A, infer _E, infer R> ? R : never;
/** True only when `A` and `B` are the same type. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("CliLog.layer requirements per overload", () => {
	it("each overload's R, and an optional file keeps FileSystem and Path in R", () => {
		const maybe: CliLogFile | undefined = undefined;
		type Fs = FileSystem.FileSystem | Path.Path;
		const checks: ReadonlyArray<boolean> = [
			true satisfies Same<RIn<ReturnType<typeof jsonNoFile>>, never>,
			true satisfies Same<RIn<typeof jsonFile>, Fs>,
			true satisfies Same<RIn<ReturnType<typeof jsonMaybe>>, Fs>,
			true satisfies Same<RIn<ReturnType<typeof prettyNoFile>>, TerminalEnv>,
			true satisfies Same<RIn<ReturnType<typeof prettyMaybe>>, TerminalEnv | Fs>,
			true satisfies Same<RIn<ReturnType<typeof autoNoFile>>, Audience | TerminalEnv>,
			true satisfies Same<RIn<ReturnType<typeof autoMaybe>>, Audience | TerminalEnv | Fs>,
		];
		assert.isTrue(checks.every(Boolean));
		assert.isUndefined(maybe);
	});
});

const jsonNoFile = () => CliLog.layer({ format: "json" });
const jsonFile = CliLog.layer({ format: "json", file: { path: "/x.ndjson" } });
const jsonMaybe = (file: CliLogFile | undefined = undefined) => CliLog.layer({ format: "json", file });
const prettyNoFile = () => CliLog.layer({ format: "pretty" });
const prettyMaybe = (file: CliLogFile | undefined = undefined) => CliLog.layer({ format: "pretty", file });
const autoNoFile = () => CliLog.layer({});
const autoMaybe = (file: CliLogFile | undefined = undefined) => CliLog.layer({ file });

describe("CliLog.layer's own plain CliLogger neutralizes as its sink does", () => {
	it.effect("with the default plainLogger, a host-built layer over Actions writes no command on either line", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			const hosted = CliLog.layer({ level: "Info", format: "json" }).pipe(
				Layer.provide(CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") })),
			);
			yield* Effect.logWarning("::error::injected").pipe(
				Effect.provide(hosted),
				Effect.provideService(Console.Console, double),
			);
			assert.isAtLeast(err.length, 2, "the plain line and the NDJSON line were both written");
			assert.deepStrictEqual(err.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand), [], err.join(" | "));
		}),
	);

	it.effect("neutralize: false reaches the plain line too", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			const hosted = CliLog.layer({ level: "Info", format: "json", neutralize: false }).pipe(
				Layer.provide(CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") })),
			);
			yield* Effect.logWarning("::error::injected").pipe(
				Effect.provide(hosted),
				Effect.provideService(Console.Console, double),
			);
			// The plain line is the one a `::` command could open: an NDJSON line starts with `{`.
			assert.deepStrictEqual(err.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand), ["::error::injected"]);
		}),
	);
});
