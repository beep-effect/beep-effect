import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Path from "effect/Path";
import * as A from "effect/Array";
// @effect-diagnostics strictEffectProvide:skip-file
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import { Command } from "effect/cli";
import { CliRuntime } from "../../effected/cli/index.ts";
import { LINE_BREAK, isCommand } from "./helpers/runnerCommands.ts";

const platformServices = Layer.mergeAll(
	Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}),
	MemoryFileSystem.layer,
	Path.layer,
	Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
	Layer.succeed(
		Terminal.Terminal,
		Terminal.make({
			columns: Effect.succeed(80),
			rows: Effect.succeed(24),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	),
);

const Json = S.fromJsonString(S.Unknown);

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console), {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

/** `Stdio` and `Terminal` doubles, as a platform provides them. */
const io = Layer.mergeAll(
	Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
	Layer.succeed(
		Terminal.Terminal,
		Terminal.make({
			columns: Effect.succeed(80),
			rows: Effect.succeed(24),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	),
);

it.layer(platformServices, { timeout: "30 seconds" })((it) => {
	describe("CliRuntime.main: the platform is built under the logger", () => {
		it.effect("a log line the platform emits while it builds goes to stderr, never stdout, under env.log", () =>
			Effect.gen(function* () {
				const { double, out, err } = capturing();
				const chatty = Layer.mergeAll(io, Layer.effectDiscard(Effect.logInfo("platform built")));
				yield* CliRuntime.main(Effect.void, { platform: chatty, env: { log: {} } }).pipe(
					Effect.provideService(Console.Console, double),
				);
				assert.deepStrictEqual(out, []);
				assert.isTrue(
					err.some((line) => line.includes("platform built")),
					Result.getOrThrow(S.encodeUnknownResult(Json)(err)),
				);
			}),
		);

		it.effect("control: without env.log the same line also goes to stderr", () =>
			Effect.gen(function* () {
				const { double, out, err } = capturing();
				const chatty = Layer.effectDiscard(Effect.logInfo("platform built"));
				yield* CliRuntime.main(Effect.void, { platform: chatty }).pipe(Effect.provideService(Console.Console, double));
				assert.deepStrictEqual(out, []);
				assert.isTrue(
					err.some((line) => line.includes("platform built")),
					Result.getOrThrow(S.encodeUnknownResult(Json)(err)),
				);
			}),
		);
	});

	describe("CliRuntime.main: env.formatter", () => {
		const root = Command.make("tool");
		const run = Effect.fn("run")(function* (formatter?: {
			readonly formatVersion: (name: string, version: string) => string;
		}) {
			const { double, out } = capturing();
			yield* CliRuntime.main(Command.runWith(root, { version: "1.2.3" })(["--version"]), {
				platform: io,
				env: formatter === undefined ? {} : { formatter },
			}).pipe(Effect.provideService(Console.Console, double));
			return out.join("\n");
		});

		it.effect("a custom formatVersion survives the formatter main installs", () =>
			Effect.gen(function* () {
				const text = yield* run({ formatVersion: (name, version) => `${name} ${version} via carrier 9.9.9` });
				assert.include(text, "tool 1.2.3 via carrier 9.9.9");
			}),
		);

		it.effect("control: without it the default formatter's version line is used", () =>
			Effect.gen(function* () {
				const text = yield* run();
				assert.include(text, "1.2.3");
				assert.notInclude(text, "carrier");
			}),
		);
	});

	describe("CliRuntime.main: the log level applies while the platform builds", () => {
		const debugging = Layer.mergeAll(io, Layer.effectDiscard(Effect.logDebug("migration ran")));

		it.effect("format json: a Debug record the platform logs while it builds is one NDJSON line on stderr", () =>
			Effect.gen(function* () {
				const { double, out, err } = capturing();
				yield* CliRuntime.main(Effect.void, {
					platform: debugging,
					env: { log: { level: "Debug", format: "json" } },
				}).pipe(Effect.provideService(Console.Console, double));
				assert.deepStrictEqual(out, []);
				const records = err.filter((line) => line.includes("migration ran"));
				assert.lengthOf(records, 1, Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
				const record = Result.getOrThrow(S.decodeResult(LogRecord)(A.getUnsafe(records, 0)));
				assert.strictEqual(record.level, "DEBUG");
				assert.strictEqual(record.message, "migration ran");
			}),
		);

		it.effect("another format: the build-time plain logger is floored at the same level, read from envVar", () =>
			Effect.gen(function* () {
				const { double, err } = capturing();
				yield* CliRuntime.main(Effect.void, {
					platform: debugging,
					env: { log: { envVar: "REPORTER_LOG_LEVEL", format: "pretty" } },
				}).pipe(
					Effect.provideService(Console.Console, double),
					Effect.provideService(
						ConfigProvider.ConfigProvider,
						ConfigProvider.fromUnknown({ REPORTER_LOG_LEVEL: "debug" }),
					),
				);
				assert.isTrue(
					err.some((line) => line.includes("migration ran")),
					Result.getOrThrow(S.encodeUnknownResult(Json)(err)),
				);
			}),
		);

		it.effect("control: with diagnostics off, the platform's Debug record is not shown", () =>
			Effect.gen(function* () {
				const { double, err } = capturing();
				yield* CliRuntime.main(Effect.void, { platform: debugging, env: { log: { format: "json" } } }).pipe(
					Effect.provideService(Console.Console, double),
				);
				assert.isFalse(err.some((line) => line.includes("migration ran")));
			}),
		);
	});

	describe("CliRuntime.main: format auto decides the build-time lines from env and argv (A1)", () => {
		const building = Layer.mergeAll(io, Layer.effectDiscard(Effect.logDebug("migration ran")));
		const program = Effect.logDebug("handler ran");
		const isJson = (line: string): boolean => {
			try {
				JSON.parse(line);
				return true;
			} catch {
				return false;
			}
		};
		const run = Effect.fn("run")(function* (
			env: Record<string, string>,
			log: { readonly argv?: ReadonlyArray<string> } = {},
		) {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(program, {
				platform: building,
				env: { audienceEnvVar: "TOOL_AUDIENCE", log: { level: "Debug", ...log } },
			}).pipe(
				Effect.provideService(Console.Console, double),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
			);
			assert.deepStrictEqual(out, []);
			const built = err.find((line) => line.includes("migration ran"));
			assert.isDefined(built, Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
			return { err, built };
		});

		it.effect("AI_AGENT: every stderr line is NDJSON, build-time and runtime alike", () =>
			Effect.gen(function* () {
				const { err } = yield* run({ AI_AGENT: "claude-code_x_agent" });
				assert.isTrue(
					err.some((line) => line.includes("handler ran")),
					"control: the runtime line was written",
				);
				assert.deepStrictEqual(
					err.filter((line) => !isJson(line)),
					[],
				);
			}),
		);

		it.effect("CI: the build-time line is NDJSON", () =>
			Effect.gen(function* () {
				assert.isTrue(isJson((yield* run({ CI: "true" })).built));
			}),
		);

		it.effect("--agent in the argv option, with no env: the build-time line is NDJSON", () =>
			Effect.gen(function* () {
				assert.isTrue(isJson((yield* run({}, { argv: ["--agent", "go"] })).built));
			}),
		);

		it.effect("--human in argv beats a detected agent: plain", () =>
			Effect.gen(function* () {
				const { built } = yield* run({ AI_AGENT: "claude-code_x_agent" }, { argv: ["--human"] });
				assert.isFalse(isJson(built), built);
			}),
		);

		it.effect("the audience override variable beats detection: plain", () =>
			Effect.gen(function* () {
				const { built } = yield* run({ AI_AGENT: "claude-code_x_agent", TOOL_AUDIENCE: "human" });
				assert.isFalse(isJson(built), built);
			}),
		);

		it.effect("no agent and no CI: plain, as before", () =>
			Effect.gen(function* () {
				const { built } = yield* run({});
				assert.isFalse(isJson(built), built);
			}),
		);

		it.effect("a human whose stderr is not a terminal: every stderr line is plain, build-time and runtime alike", () =>
			Effect.gen(function* () {
				// The platform double's stdout is not a terminal, and stderr mirrors it: a human piping stderr to a file.
				const { err } = yield* run({});
				assert.isTrue(
					err.some((line) => line.includes("handler ran")),
					"control: the runtime line was written",
				);
				assert.deepStrictEqual(
					err.filter((line) => isJson(line)),
					[],
				);
			}),
		);

		it.effect("control: the argv the platform's Stdio carries is not seen at build time, only the option's", () =>
			Effect.gen(function* () {
				const { double, err } = capturing();
				const withArgs = Layer.mergeAll(
					Stdio.layerTest({
						args: Effect.succeed(["--agent"]),
						stdinIsTerminal: Effect.succeed(false),
						stdoutIsTerminal: Effect.succeed(false),
					}),
					Layer.effectDiscard(Effect.logDebug("migration ran")),
					Layer.succeed(
						Terminal.Terminal,
						Terminal.make({
							columns: Effect.succeed(80),
							rows: Effect.succeed(24),
							readInput: Effect.die("unused"),
							readLine: Effect.die("unused"),
							display: () => Effect.void,
						}),
					),
				);
				yield* CliRuntime.main(Effect.void, { platform: withArgs, env: { log: { level: "Debug" } } }).pipe(
					Effect.provideService(Console.Console, double),
					Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
				);
				const built = err.find((line) => line.includes("migration ran")) ?? "";
				assert.isFalse(isJson(built), built);
			}),
		);
	});

	describe("CliRuntime.main: build-time lines are neutralized under GitHub Actions", () => {
		const injecting = Layer.mergeAll(io, Layer.effectDiscard(Effect.logWarning("build ##[warning]injected")));
		const commands = (lines: ReadonlyArray<string>) =>
			lines.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand);
		const run = Effect.fn("run")(function* (format: "auto" | "json" | "pretty", env: Record<string, string>) {
			const { double, err } = capturing();
			yield* CliRuntime.main(Effect.void, { platform: injecting, env: { log: { level: "Debug", format } } }).pipe(
				Effect.provideService(Console.Console, double),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
			);
			return err;
		});

		for (const format of ["auto", "json", "pretty"] as const) {
			it.effect(`${format}: no workflow command reaches stderr from what the platform logs while it builds`, () =>
				Effect.gen(function* () {
					const err = yield* run(format, { GITHUB_ACTIONS: "true", CI: "true" });
					assert.isTrue(
						err.some((line) => line.includes("injected")),
						`the build line was written: ${Result.getOrThrow(S.encodeUnknownResult(Json)(err))}`,
					);
					assert.deepStrictEqual(commands(err), [], Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
				}),
			);
		}

		it.effect("control: off GitHub Actions the same line is left as it is", () =>
			Effect.gen(function* () {
				assert.isNotEmpty(commands(yield* run("pretty", {})));
			}),
		);
	});

	describe("CliRuntime.main: the audience-override warning is neutralized under GitHub Actions", () => {
		const commands = (lines: ReadonlyArray<string>) =>
			lines.flatMap((line) => line.split(LINE_BREAK)).filter(isCommand);
		const run = Effect.fn("run")(function* (format: "auto" | "json" | "pretty", env: Record<string, string>) {
			const { double, err } = capturing();
			yield* CliRuntime.main(Effect.void, {
				platform: io,
				env: { audienceEnvVar: "TOOL_AUDIENCE", log: { format } },
			}).pipe(
				Effect.provideService(Console.Console, double),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
			);
			return err;
		});

		for (const format of ["auto", "json", "pretty"] as const) {
			it.effect(`${format}: an override value carrying a workflow command writes no command`, () =>
				Effect.gen(function* () {
					const err = yield* run(format, {
						GITHUB_ACTIONS: "true",
						CI: "true",
						TOOL_AUDIENCE: "##[error]injected\n::error::injected",
					});
					assert.isTrue(
						err.some((line) => line.includes("TOOL_AUDIENCE")),
						`the warning was written: ${Result.getOrThrow(S.encodeUnknownResult(Json)(err))}`,
					);
					assert.deepStrictEqual(commands(err), [], Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
				}),
			);
		}

		it.effect("control: off GitHub Actions the warning keeps the value as given", () =>
			Effect.gen(function* () {
				const err = yield* run("pretty", { TOOL_AUDIENCE: "##[error]injected" });
				assert.isNotEmpty(commands(err), Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
			}),
		);
	});

	describe("CliRuntime.main: the audience-override warning is written exactly once, in the decided format", () => {
		const isJson = (line: string): boolean => {
			try {
				JSON.parse(line);
				return true;
			} catch {
				return false;
			}
		};
		const run = Effect.fn("run")(function* (
			env: Record<string, string>,
			log: { readonly plainLogger?: boolean; readonly level?: "Debug" },
		) {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(Effect.void, {
				platform: io,
				env: { audienceEnvVar: "TOOL_AUDIENCE", log },
			}).pipe(
				Effect.provideService(Console.Console, double),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
			);
			assert.deepStrictEqual(out, []);
			return err;
		});
		const AGENT = { AI_AGENT: "claude-code_x_agent" };

		for (const plainLogger of [true, false]) {
			it.effect(`agent, plainLogger ${plainLogger}: one NDJSON warning line`, () =>
				Effect.gen(function* () {
					const err = yield* run({ ...AGENT, TOOL_AUDIENCE: "bogus" }, { plainLogger });
					assert.lengthOf(err, 1, Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
					assert.isTrue(isJson(A.getUnsafe(err, 0)), err[0]);
					assert.include(err[0], "TOOL_AUDIENCE=bogus");
				}),
			);

			it.effect(`human, plainLogger ${plainLogger}: one plain warning line`, () =>
				Effect.gen(function* () {
					const err = yield* run({ TOOL_AUDIENCE: "bogus" }, { plainLogger });
					assert.lengthOf(err, 1, Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
					assert.isFalse(isJson(A.getUnsafe(err, 0)), err[0]);
					assert.include(err[0], "TOOL_AUDIENCE=bogus");
				}),
			);
		}

		it.effect("agent with diagnostics on: still exactly one warning, in NDJSON", () =>
			Effect.gen(function* () {
				const err = yield* run({ ...AGENT, TOOL_AUDIENCE: "bogus" }, { level: "Debug" });
				const warnings = err.filter((line) => line.includes("TOOL_AUDIENCE=bogus"));
				assert.lengthOf(warnings, 1, Result.getOrThrow(S.encodeUnknownResult(Json)(err)));
				assert.isTrue(isJson(A.getUnsafe(warnings, 0)), warnings[0]);
			}),
		);

		it.effect("agent, plainLogger false, a valid override: nothing on stderr", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* run({ ...AGENT, TOOL_AUDIENCE: "agent" }, { plainLogger: false }), []);
			}),
		);
	});

	describe("CliRuntime.main: the audience-override warning goes to stderr alone", () => {
		const seen: Array<string> = [];
		const extra = Logger.make<unknown, void>(({ message }) => {
			seen.push(String(message));
		});
		for (const [audience, env] of [
			["human", { TOOL_AUDIENCE: "bogus" }],
			["agent", { AI_AGENT: "claude-code_x_agent", TOOL_AUDIENCE: "bogus" }],
		] as const) {
			it.effect(`${audience}: on stderr even with stderrFrom raised, stdout empty, never on an extra logger`, () =>
				Effect.gen(function* () {
					seen.length = 0;
					const { double, out, err } = capturing();
					yield* CliRuntime.main(Effect.void, {
						platform: io,
						env: {
							audienceEnvVar: "TOOL_AUDIENCE",
							log: { logger: { stderrFrom: "Error" }, extraLoggers: [extra] },
						},
					}).pipe(
						Effect.provideService(Console.Console, double),
						Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
					);
					assert.deepStrictEqual(out, []);
					assert.strictEqual(
						err.filter((line) => line.includes("TOOL_AUDIENCE=bogus")).length,
						1,
						Result.getOrThrow(S.encodeUnknownResult(Json)(err)),
					);
					assert.isFalse(
						seen.some((line) => line.includes("TOOL_AUDIENCE")),
						`not on the extra logger: ${Result.getOrThrow(S.encodeUnknownResult(Json)(seen))}`,
					);
					// Control: the extra logger is installed and live for the run's own records.
					yield* CliRuntime.main(Effect.logError("run record"), {
						platform: io,
						env: { log: { logger: { stderrFrom: "Error" }, extraLoggers: [extra] } },
					}).pipe(Effect.provideService(Console.Console, capturing().double));
					assert.isTrue(
						seen.some((line) => line.includes("run record")),
						`control: the extra logger saw the run: ${Result.getOrThrow(S.encodeUnknownResult(Json)(seen))}`,
					);
				}),
			);
		}
	});

	describe("CliRuntime.main: only the env build is pinned to stderr; the platform's build follows stderrFrom (nit 2 scope)", () => {
		it.effect(
			"human, stderrFrom Error: the override warning on stderr, a platform Warning at build time on stdout",
			() =>
				Effect.gen(function* () {
					const { double, out, err } = capturing();
					const warning = Layer.mergeAll(io, Layer.effectDiscard(Effect.logWarning("platform warned")));
					yield* CliRuntime.main(Effect.void, {
						platform: warning,
						env: { audienceEnvVar: "TOOL_AUDIENCE", log: { logger: { stderrFrom: "Error" } } },
					}).pipe(
						Effect.provideService(Console.Console, double),
						Effect.provideService(
							ConfigProvider.ConfigProvider,
							ConfigProvider.fromUnknown({ TOOL_AUDIENCE: "bogus" }),
						),
					);
					assert.isTrue(
						err.some((line) => line.includes("TOOL_AUDIENCE=bogus")),
						`the override warning is on stderr: ${Result.getOrThrow(S.encodeUnknownResult(Json)({ out, err }))}`,
					);
					assert.isFalse(out.some((line) => line.includes("TOOL_AUDIENCE")));
					// The host chose to route warnings below Error to stdout, and the platform's own build-time line honours it.
					assert.isTrue(
						out.some((line) => line.includes("platform warned")),
						`the platform warning follows stderrFrom: ${Result.getOrThrow(S.encodeUnknownResult(Json)({ out, err }))}`,
					);
					assert.isFalse(err.some((line) => line.includes("platform warned")));
				}),
		);
	});

	const LogRecord = S.fromJsonString(S.Struct({ level: S.String, message: S.Unknown }));
});
