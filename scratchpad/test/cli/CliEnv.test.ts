import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Audience, CurrentRuntimeEnv, TerminalEnv } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Cause, ConfigProvider, Console, Effect, Exit, Layer, Path, Queue, Runtime, Stdio, Terminal } from "effect";
import { CliConfig, Command, GlobalFlag, Prompt } from "effect/cli";
import type { CliEnvOptions } from "../../effected/cli/index.ts";
import { CliEnv, CliInteractive, CliLinks, CliRuntime, CliTheme } from "../../effected/cli/index.ts";
import { TestTerminal } from "../../effected/cli/testing.ts";

const capturing = () => {
	const out: string[] = [];
	const err: string[] = [];
	const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
		log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
	});
	return { double, out, err };
};

/** `Stdio` and `Terminal` doubles: the requirements `CliEnv.layer` leaves to the platform. */
const platform = (io: {
	readonly stdin: boolean;
	readonly stdout: boolean;
	readonly columns?: Effect.Effect<number>;
}) =>
	Layer.mergeAll(
		Stdio.layerTest({ stdinIsTerminal: Effect.succeed(io.stdin), stdoutIsTerminal: Effect.succeed(io.stdout) }),
		Layer.succeed(
			Terminal.Terminal,
			Terminal.make({
				columns: io.columns ?? Effect.succeed(80),
				rows: Effect.succeed(24),
				readInput: Effect.die("unused"),
				readLine: Effect.die("unused"),
				display: () => Effect.void,
			}),
		),
	);

const TTY = platform({ stdin: true, stdout: true });
const PIPED = platform({ stdin: false, stdout: false });

const withEnv = (env: Record<string, string>) => ConfigProvider.fromUnknown(env);

describe("CliEnv.layer", () => {
	it.effect("builds every service, and the audience honours the env var", () =>
		Effect.gen(function* () {
			const runtime = yield* CurrentRuntimeEnv;
			const terminal = yield* TerminalEnv;
			const audience = yield* Audience;
			const theme = yield* CliTheme;
			const interactive = yield* CliInteractive;
			assert.isDefined(runtime);
			assert.strictEqual(terminal.stdinIsTerminal, true);
			assert.deepStrictEqual(audience, { kind: "agent", source: "override" });
			assert.strictEqual(theme.color, "none");
			// An agent audience is never interactive, even on a terminal.
			assert.strictEqual(interactive, false);
		}).pipe(
			Effect.provide(CliEnv.layer({ audienceEnvVar: "OKFIT_AUDIENCE" })),
			Effect.provide(TTY),
			Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ OKFIT_AUDIENCE: "agent" })),
		),
	);

	it.effect("a human on a terminal is interactive, and the theme follows the terminal's colour", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* CliInteractive, true);
			assert.strictEqual((yield* Audience).kind, "human");
			assert.strictEqual((yield* CliTheme).color, "256");
		}).pipe(
			Effect.provide(CliEnv.layer()),
			Effect.provide(TTY),
			Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ TERM: "xterm-256color" })),
		),
	);

	it.effect("piped stdin or stdout is not interactive", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* CliInteractive, false);
		}).pipe(
			Effect.provide(CliEnv.layer()),
			Effect.provide(PIPED),
			Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
		),
	);
});

describe("CliRuntime.main with the env option", () => {
	const observe = (program: Effect.Effect<void, never, CliTheme | Audience | TerminalEnv>) =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			const exit = yield* CliRuntime.main(program, { platform: TTY, env: {} }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
				Effect.provideService(Console.Console, double),
			);
			return { out, err, exit };
		});

	it.effect("a program needing the env services typechecks and runs with no requirement left over", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const program = Effect.gen(function* () {
				seen.push((yield* Audience).kind, String(yield* CliInteractive), (yield* CliTheme).color);
				yield* TerminalEnv;
			});
			// `observe` returns an effect with R = never: a leaked requirement would not compile here.
			const { exit } = yield* observe(program);
			assert.isTrue(Exit.isSuccess(exit));
			assert.deepStrictEqual(seen, ["human", "true", "none"]);
		}),
	);

	// Forgetting the wiring silently yields a non-interactive run, so this pins that main really sets it.
	it.effect("under a human on a stdin and stdout terminal the program observes CliInteractive === true", () =>
		Effect.gen(function* () {
			let interactive: boolean | undefined;
			yield* observe(
				Effect.gen(function* () {
					interactive = yield* CliInteractive;
				}),
			);
			assert.strictEqual(interactive, true);
		}),
	);

	it.effect("without the env option nothing is provided and CliInteractive keeps its non-interactive default", () =>
		Effect.gen(function* () {
			let interactive: boolean | undefined;
			const { double } = capturing();
			yield* CliRuntime.main(
				Effect.gen(function* () {
					interactive = yield* CliInteractive;
				}),
				{ platform: TTY },
			).pipe(Effect.exit, Effect.provideService(Console.Console, double));
			assert.strictEqual(interactive, false);
		}),
	);

	it.effect("a failure building the env layer is one line and the exitCode option, not a stack", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			const broken = platform({ stdin: true, stdout: true, columns: Effect.die(new Error("tty broke")) });
			const exit = yield* CliRuntime.main(Effect.void, { platform: broken, env: {}, exitCode: 3 }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
				Effect.provideService(Console.Console, double),
			);
			// A defect: the status line first, then its cleaned stack.
			assert.strictEqual(err[0], "[FAIL] Error: tty broke");
			assert.deepStrictEqual(out, []);
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) assert.strictEqual(Runtime.getErrorExitCode(Cause.squash(exit.cause)), 3);
		}),
	);

	it.effect("a Config provider whose reads fail does not fail the layer: the env falls back to a quiet terminal", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			let seen: string | undefined;
			const failing = ConfigProvider.make(() => Effect.fail(new ConfigProvider.SourceError({ message: "no env" })));
			const exit = yield* CliRuntime.main(
				Effect.gen(function* () {
					seen = (yield* CliTheme).color;
				}),
				{ platform: TTY, env: {}, exitCode: 3 },
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, failing),
				Effect.provideService(Console.Console, double),
			);
			// Every env read degrades to "unset" by design, so there is nothing to fail: no line, no exit code.
			assert.isTrue(Exit.isSuccess(exit));
			assert.deepStrictEqual(err, []);
			assert.strictEqual(seen, "none");
		}),
	);

	it.effect(
		"env.log makes CliLog the logger set: the sink records a debug record, and a failure is still reported",
		() =>
			Effect.gen(function* () {
				const { double, err } = capturing();
				const exit = yield* CliRuntime.main(
					Effect.gen(function* () {
						yield* Effect.logDebug("inside");
						return yield* Effect.fail(new Error("boom"));
					}),
					{ platform: TTY, env: { log: { envVar: "TOOL_LOG" } } },
				).pipe(
					Effect.exit,
					Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ TOOL_LOG: "debug" })),
					Effect.provideService(Console.Console, double),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isTrue(err.some((line) => line.includes("Error: boom")));
				const records = err.filter((line) => line.startsWith("{") || /^\d\d:\d\d:\d\d\.\d{3} /.test(line));
				assert.isTrue(
					records.some((line) => line.includes("inside")),
					err.join("\n"),
				);
			}),
	);

	it.effect("without env.log the default CliLogger stays, so a debug record writes nothing", () =>
		Effect.gen(function* () {
			const { double, err } = capturing();
			yield* CliRuntime.main(Effect.logDebug("inside"), { platform: TTY, env: {} }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ TOOL_LOG: "debug" })),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(err, []);
		}),
	);

	it.effect("a failure building the env layer with env.log set is still one line and exit 3 (fallback logger)", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			const broken = platform({ stdin: true, stdout: true, columns: Effect.die(new Error("tty broke")) });
			const exit = yield* CliRuntime.main(Effect.void, {
				platform: broken,
				env: { log: { envVar: "TOOL_LOG" } },
				exitCode: 3,
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
				Effect.provideService(Console.Console, double),
			);
			// A defect: the status line first, then its cleaned stack.
			assert.strictEqual(err[0], "[FAIL] Error: tty broke");
			assert.deepStrictEqual(out, []);
			if (Exit.isFailure(exit)) assert.strictEqual(Runtime.getErrorExitCode(Cause.squash(exit.cause)), 3);
			else assert.fail("expected a failure");
		}),
	);

	it.effect("help text follows the same colour decision as the env: FORCE_COLOR colours it over a pipe", () =>
		Effect.gen(function* () {
			const app = Command.make("tool").pipe(Command.withSubcommands([Command.make("run", {}, () => Effect.void)]));
			const helpUnder = (env: Record<string, string>) =>
				Effect.gen(function* () {
					const { double, out } = capturing();
					yield* CliRuntime.main(Command.runWith(app, { version: "1.0.0" })(["--help"]), {
						platform: Layer.mergeAll(NodeServices.layer, PIPED),
						env: {},
					}).pipe(
						Effect.exit,
						Effect.provideService(ConfigProvider.ConfigProvider, withEnv(env)),
						Effect.provideService(Console.Console, double),
					);
					return out.join("\n");
				});
			assert.include(yield* helpUnder({ FORCE_COLOR: "1" }), "\x1b[");
			assert.notInclude(yield* helpUnder({}), "\x1b[");
		}),
	);

	it.effect("installs the terminal gate: a non-interactive program's Terminal never reaches the real one", () =>
		Effect.gen(function* () {
			const real = yield* TestTerminal.make({ columns: 100 });
			yield* real.input([{ name: "enter" }]);
			const { double } = capturing();
			let columns = 0;
			let ended = false;
			const exit = yield* CliRuntime.main(
				Effect.gen(function* () {
					const terminal = yield* Terminal.Terminal;
					columns = yield* terminal.columns;
					// Reading input on the gated terminal is quit at once, and display writes nothing.
					ended = Exit.isFailure(
						yield* Effect.exit(Effect.scoped(Effect.flatMap(terminal.readInput, (queue) => Queue.take(queue)))),
					);
					yield* terminal.display("never shown");
				}),
				{
					platform: Layer.mergeAll(
						Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
						real.layer,
					),
					env: {},
				},
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
				Effect.provideService(Console.Console, double),
			);
			assert.isTrue(Exit.isSuccess(exit));
			assert.strictEqual(columns, 100, "the real terminal's size is delegated");
			assert.isTrue(ended);
			assert.strictEqual(yield* real.output, "");
			assert.deepStrictEqual(yield* real.reads, { keys: 0, lines: 0, subscriptions: 0 });
			assert.strictEqual(yield* real.pending, 1);
		}),
	);

	it.effect("installs the wizard gate: --wizard is absent from --help when the run is not interactive", () =>
		Effect.gen(function* () {
			const app = Command.make("tool").pipe(Command.withSubcommands([Command.make("run", {}, () => Effect.void)]));
			const helpOn = (io: Layer.Layer<Stdio.Stdio | Terminal.Terminal>) =>
				Effect.gen(function* () {
					const { double, out } = capturing();
					yield* CliRuntime.main(Command.runWith(app, { version: "1.0.0" })(["--help"]), {
						platform: Layer.mergeAll(NodeServices.layer, io),
						env: {},
					}).pipe(
						Effect.exit,
						Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
						Effect.provideService(Console.Console, double),
					);
					return out.join("\n");
				});
			assert.notInclude(yield* helpOn(PIPED), "--wizard");
			assert.include(yield* helpOn(TTY), "--wizard");
		}),
	);

	it.effect("env.log accepts the file option when the platform provides FileSystem and Path", () =>
		Effect.gen(function* () {
			const handle = MemoryFileSystem.makeSync();
			const { double } = capturing();
			yield* CliRuntime.main(
				Effect.gen(function* () {
					yield* Effect.logDebug("recorded");
				}),
				{
					platform: Layer.mergeAll(TTY, handle.layer),
					env: { log: { envVar: "TOOL_LOG", file: { path: "/logs/tool.ndjson" } } },
				},
			).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ TOOL_LOG: "debug" })),
				Effect.provideService(Console.Console, double),
			);
			const text = handle.volume.text("/logs/tool.ndjson") ?? "";
			assert.include(text, '"message":"recorded"');
			assert.include(text, '"level":"DEBUG"');
		}),
	);

	// A warning logged while the env layer is built (an invalid override) used to go through Effect's default
	// logger to STDOUT, because under env.log the env layer was built as the logger's own dependency, before any
	// logger existed. Machine output on stdout must stay clean.
	it.effect("env.log: an env-layer warning goes to stderr through CliLogger and stdout stays clean", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(Console.log("ran"), {
				platform: TTY,
				env: { audienceEnvVar: "PROBE_AUDIENCE", log: { envVar: "PROBE_LOG" } },
			}).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ PROBE_AUDIENCE: "bogus" })),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(out, ["ran"]);
			assert.strictEqual(err.filter((line) => line.includes("PROBE_AUDIENCE=bogus")).length, 1, err.join("\n"));
			assert.isFalse(
				err.some((line) => /^\[\d\d:\d\d:\d\d\.\d{3}\] WARN/.test(line)),
				"plain CliLogger line, not the default format",
			);
		}),
	);

	it.effect("control: without env.log the same warning is on stderr", () =>
		Effect.gen(function* () {
			const { double, out, err } = capturing();
			yield* CliRuntime.main(Console.log("ran"), { platform: TTY, env: { audienceEnvVar: "PROBE_AUDIENCE" } }).pipe(
				Effect.exit,
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ PROBE_AUDIENCE: "bogus" })),
				Effect.provideService(Console.Console, double),
			);
			assert.deepStrictEqual(out, ["ran"]);
			assert.strictEqual(err.filter((line) => line.includes("PROBE_AUDIENCE=bogus")).length, 1);
		}),
	);

	it.effect(
		"a consumer's CliConfig passed through the platform survives env (gateWizard filters it, never rebuilds it)",
		() =>
			Effect.gen(function* () {
				const { double } = capturing();
				let builtIns = -1;
				yield* CliRuntime.main(
					Effect.gen(function* () {
						builtIns = (yield* CliConfig.CliConfig).builtIns.length;
					}),
					{ platform: Layer.mergeAll(TTY, CliConfig.layer({ builtIns: [] })), env: {} },
				).pipe(
					Effect.exit,
					Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
					Effect.provideService(Console.Console, double),
				);
				assert.strictEqual(builtIns, 0);
			}),
	);

	it.effect("under env the gate removes only the wizard from the ambient built-ins when not interactive", () =>
		Effect.gen(function* () {
			const { double } = capturing();
			const seen: Array<ReadonlyArray<unknown>> = [];
			const all = yield* Effect.map(CliConfig.CliConfig, (config) => config.builtIns);
			for (const io of [TTY, PIPED]) {
				yield* CliRuntime.main(
					Effect.gen(function* () {
						seen.push((yield* CliConfig.CliConfig).builtIns);
					}),
					{ platform: io, env: {} },
				).pipe(
					Effect.exit,
					Effect.provideService(ConfigProvider.ConfigProvider, withEnv({})),
					Effect.provideService(Console.Console, double),
				);
			}
			assert.deepStrictEqual(seen[0], all);
			assert.strictEqual(seen[1]?.length, all.length - 1);
			assert.isFalse(seen[1]?.includes(GlobalFlag.Wizard));
		}),
	);

	it.effect("installs the theme bridge: core prompts follow the terminal's colour under env", () =>
		Effect.gen(function* () {
			const themeUnder = (env: Record<string, string>, io: Layer.Layer<Stdio.Stdio | Terminal.Terminal>) =>
				Effect.gen(function* () {
					const { double } = capturing();
					let primary: string | undefined;
					yield* CliRuntime.main(
						Effect.gen(function* () {
							primary = (yield* Prompt.Theme).primaryColor;
						}),
						{ platform: io, env: {} },
					).pipe(
						Effect.exit,
						Effect.provideService(ConfigProvider.ConfigProvider, withEnv(env)),
						Effect.provideService(Console.Console, double),
					);
					return primary;
				});
			assert.strictEqual(yield* themeUnder({}, PIPED), "", "no colour: the prompt colour fields are empty");
			assert.notStrictEqual(yield* themeUnder({ FORCE_COLOR: "1" }, PIPED), "", "forced colour reaches core prompts");
		}),
	);

	it.effect(
		"provides CliLinks: file by default, vscode on the terminal signal, and the option and env var decide",
		() =>
			Effect.gen(function* () {
				const modeOf = (options: CliEnvOptions, env: Record<string, string>) =>
					Effect.gen(function* () {
						return (yield* CliLinks).mode;
					}).pipe(
						Effect.provide(CliEnv.layer(options)),
						Effect.provide(TTY),
						Effect.provideService(ConfigProvider.ConfigProvider, withEnv(env)),
					);
				assert.strictEqual(yield* modeOf({}, {}), "file");
				assert.strictEqual(yield* modeOf({}, { TERM_PROGRAM: "vscode" }), "vscode");
				assert.strictEqual(yield* modeOf({ editorLinks: "off" }, { TERM_PROGRAM: "vscode" }), "off");
				assert.strictEqual(yield* modeOf({ editorLinks: "vscode" }, {}), "vscode");
				assert.strictEqual(
					yield* modeOf({ editorLinks: "file", editorLinksEnvVar: "TOOL_EDITOR_LINKS" }, { TOOL_EDITOR_LINKS: "off" }),
					"off",
				);
			}),
	);

	it.effect("finds .vscode through the FileSystem and Path the platform provides, but does not require them", () =>
		Effect.gen(function* () {
			const seed = { "/repo/.git": MemoryFileSystem.directory(), "/repo/.vscode": MemoryFileSystem.directory() };
			const mode = Effect.gen(function* () {
				return (yield* CliLinks).mode;
			}).pipe(
				Effect.provide(CliEnv.layer()),
				Effect.provide(TTY),
				Effect.provideService(ConfigProvider.ConfigProvider, withEnv({ PWD: "/repo" })),
			);
			assert.strictEqual(
				yield* mode.pipe(Effect.provide(Layer.mergeAll(MemoryFileSystem.layerWith(seed), Path.layer))),
				"vscode",
			);
			assert.strictEqual(
				yield* mode,
				"file",
				"without them the layer still builds, and only the terminal signal applies",
			);
		}),
	);

	it("a CliEnvOptions-typed env, which may carry a file sink, requires FileSystem and Path from the platform", () => {
		const env: CliEnvOptions = { log: { envVar: "TOOL_LOG", file: { path: "/x" } } };
		const program = CliRuntime.main(Effect.void, { platform: TTY, env });
		// @ts-expect-error the widened env may carry log.file, so FileSystem | Path stay required (a silent drop before)
		const narrowed: Effect.Effect<void, Error, Stdio.Stdio | Terminal.Terminal> = program;
		assert.isDefined(narrowed);
		// A literal env with no file stays free of them.
		const plain = CliRuntime.main(Effect.void, { platform: TTY, env: { log: { envVar: "TOOL_LOG" } } });
		const ok: Effect.Effect<void, Error, never> = plain;
		assert.isDefined(ok);
	});

	it("CliLinks is one of the env services: a program that reads it needs nothing more from the platform", () => {
		const program = Effect.gen(function* () {
			yield* CliLinks;
		});
		const main = CliRuntime.main(program, { platform: TTY, env: { editorLinks: "off" } });
		const ok: Effect.Effect<void, Error, never> = main;
		assert.isDefined(ok);
	});
});
