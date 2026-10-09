// @effect-diagnostics strictEffectProvide:skip-file
// CliEnv.layerTest: the env services a CliEnv.layer would build, from fixed answers, needing nothing and reading no
// host environment.
import { assert, describe, it } from "@effect/vitest";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import { Config, ConfigProvider, Effect, Layer, Option } from "effect";
import type { CliEnvTestOptions } from "../../effected/cli/index.ts";
import { CliEnv, CliInteractive, CliTheme } from "../../effected/cli/index.ts";

/** What a program under the layer observes. */
const observe = Effect.gen(function* () {
	const terminal = yield* TerminalEnv;
	const audience = yield* Audience;
	const theme = yield* CliTheme;
	return {
		interactive: yield* CliInteractive,
		audience: audience.kind,
		stdinIsTerminal: terminal.stdinIsTerminal,
		stdoutIsTerminal: terminal.stdout.isTerminal,
		stderrIsTerminal: terminal.stderr.isTerminal,
		width: terminal.width(),
		color: theme.color,
		stderrColor: theme.forStream("stderr").color,
		glyphs: theme.glyphs.kind,
	};
});

const under = (options?: CliEnvTestOptions) => Effect.provide(observe, CliEnv.layerTest(options));

/** The host's environment, as a test runner on a dumb terminal would have it. */
const host = (env: Record<string, string>) =>
	Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("CliEnv.layerTest", () => {
	it.effect("by default: a human on no terminal, not interactive, colour none, Unicode glyphs, width 80", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* under(), {
				interactive: false,
				audience: "human",
				stdinIsTerminal: false,
				stdoutIsTerminal: false,
				stderrIsTerminal: false,
				width: 80,
				color: "none",
				stderrColor: "none",
				glyphs: "unicode",
			});
		}),
	);

	it.effect("tty: a human on a terminal is interactive, every stream a terminal", () =>
		Effect.gen(function* () {
			const seen = yield* under({ tty: true });
			assert.isTrue(seen.interactive);
			assert.deepStrictEqual([seen.stdinIsTerminal, seen.stdoutIsTerminal, seen.stderrIsTerminal], [true, true, true]);
		}),
	);

	it.effect(
		"term dumb: a terminal that is not interactive, drawn in ASCII; another TERM is interactive in Unicode",
		() =>
			Effect.gen(function* () {
				const dumb = yield* under({ tty: true, term: "dumb" });
				assert.deepStrictEqual([dumb.interactive, dumb.glyphs], [false, "ascii"]);
				const xterm = yield* under({ tty: true, term: "xterm-256color" });
				assert.deepStrictEqual([xterm.interactive, xterm.glyphs], [true, "unicode"]);
			}),
	);

	it.effect("the host's TERM never decides: a dumb host still gets the layer's answer", () =>
		Effect.gen(function* () {
			const unset = yield* under({ tty: true }).pipe(host({ TERM: "dumb" }));
			assert.deepStrictEqual([unset.interactive, unset.glyphs], [true, "unicode"]);
			// Control: the same host TERM decides CliInteractive.layer when it reads the ambient provider.
			const facts = Layer.mergeAll(
				TerminalEnv.layerTest({ stdinIsTerminal: true, stdout: { isTerminal: true } }),
				Audience.layerTest("human"),
			);
			const ambient = yield* Effect.provide(
				Effect.gen(function* () {
					return yield* CliInteractive;
				}),
				CliInteractive.layer.pipe(Layer.provide(facts)),
			).pipe(host({ TERM: "dumb" }));
			assert.isFalse(ambient, "control: the host's dumb TERM is visible to an ambient read");
		}),
	);

	it.effect("audience: an agent or a CI on a terminal is not interactive", () =>
		Effect.gen(function* () {
			const agent = yield* under({ tty: true, audience: "agent" });
			assert.deepStrictEqual([agent.audience, agent.interactive], ["agent", false]);
			const ci = yield* under({ tty: true, audience: "ci" });
			assert.deepStrictEqual([ci.audience, ci.interactive], ["ci", false]);
		}),
	);

	it.effect("columns and color set the terminal's width and both streams' colour", () =>
		Effect.gen(function* () {
			const seen = yield* under({ columns: 60, color: "truecolor" });
			assert.deepStrictEqual([seen.width, seen.color, seen.stderrColor], [60, "truecolor", "truecolor"]);
			const theme = yield* Effect.provide(
				Effect.gen(function* () {
					return yield* CliTheme;
				}),
				CliEnv.layerTest({ color: "truecolor" }),
			);
			assert.notStrictEqual(theme.paint("accent", "x"), "x", "the theme paints at truecolor");
		}),
	);

	it.effect("TERM is given to the layer's own builds only: the program still reads its own provider", () =>
		Effect.gen(function* () {
			const term = yield* Effect.provide(Config.option(Config.String("TERM")), CliEnv.layerTest({ term: "dumb" })).pipe(
				host({ TERM: "xterm" }),
			);
			assert.deepStrictEqual(term, Option.some("xterm"));
		}),
	);
});
