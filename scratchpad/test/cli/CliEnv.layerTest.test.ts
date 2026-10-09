// CliEnv.layerTest: the env services a CliEnv.layer would build, from fixed answers, needing nothing and reading no
// host environment.
import { assert, describe, it } from "@effect/vitest";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { assertSome } from "@effect/vitest/utils";
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

describe("CliEnv.layerTest", () => {
	{
		class Observed0 extends Context.Service<Observed0, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed0",
		) {}
		const layerSeen0 = Layer.effect(Observed0, observe).pipe(Layer.provide(Layer.fresh(CliEnv.layerTest())));
		it.layer(Layer.mergeAll(layerSeen0), { timeout: "30 seconds" })((it) => {
			it.effect("by default: a human on no terminal, not interactive, colour none, Unicode glyphs, width 80", () =>
				Effect.gen(function* () {
					assert.deepStrictEqual(yield* Observed0, {
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
		});
	}

	{
		class Observed1 extends Context.Service<Observed1, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed1",
		) {}
		const layerSeen0 = Layer.effect(Observed1, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true }))),
		);
		it.layer(Layer.mergeAll(layerSeen0), { timeout: "30 seconds" })((it) => {
			it.effect("tty: a human on a terminal is interactive, every stream a terminal", () =>
				Effect.gen(function* () {
					const seen = yield* Observed1;
					assert.isTrue(seen.interactive);
					assert.deepStrictEqual(
						[seen.stdinIsTerminal, seen.stdoutIsTerminal, seen.stderrIsTerminal],
						[true, true, true],
					);
				}),
			);
		});
	}

	{
		class Observed2 extends Context.Service<Observed2, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed2",
		) {}
		const layerSeen0 = Layer.effect(Observed2, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true, term: "dumb" }))),
		);
		class Observed3 extends Context.Service<Observed3, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed3",
		) {}
		const layerSeen1 = Layer.effect(Observed3, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true, term: "xterm-256color" }))),
		);
		it.layer(Layer.mergeAll(layerSeen0, layerSeen1), { timeout: "30 seconds" })((it) => {
			it.effect(
				"term dumb: a terminal that is not interactive, drawn in ASCII; another TERM is interactive in Unicode",
				() =>
					Effect.gen(function* () {
						const dumb = yield* Observed2;
						assert.deepStrictEqual([dumb.interactive, dumb.glyphs], [false, "ascii"]);
						const xterm = yield* Observed3;
						assert.deepStrictEqual([xterm.interactive, xterm.glyphs], [true, "unicode"]);
					}),
			);
		});
	}

	{
		class Observed4 extends Context.Service<Observed4, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed4",
		) {}
		const layerSeen0 = Layer.effect(Observed4, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true }))),
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ TERM: "dumb" }))),
		);
		const ambientLayer = CliInteractive.layer.pipe(
			Layer.provide(
				Layer.mergeAll(
					TerminalEnv.layerTest({ stdinIsTerminal: true, stdout: { isTerminal: true } }),
					Audience.layerTest("human"),
				),
			),
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ TERM: "dumb" }))),
		);
		it.layer(Layer.mergeAll(layerSeen0, ambientLayer), { timeout: "30 seconds" })((it) => {
			it.effect("the host's TERM never decides: a dumb host still gets the layer's answer", () =>
				Effect.gen(function* () {
					const unset = yield* Observed4;
					assert.deepStrictEqual([unset.interactive, unset.glyphs], [true, "unicode"]);
					// Control: the same host TERM decides CliInteractive.layer when it reads the ambient provider.
					const ambient = yield* CliInteractive;
					assert.isFalse(ambient, "control: the host's dumb TERM is visible to an ambient read");
				}),
			);
		});
	}

	{
		class Observed5 extends Context.Service<Observed5, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed5",
		) {}
		const layerSeen0 = Layer.effect(Observed5, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true, audience: "agent" }))),
		);
		class Observed6 extends Context.Service<Observed6, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed6",
		) {}
		const layerSeen1 = Layer.effect(Observed6, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ tty: true, audience: "ci" }))),
		);
		it.layer(Layer.mergeAll(layerSeen0, layerSeen1), { timeout: "30 seconds" })((it) => {
			it.effect("audience: an agent or a CI on a terminal is not interactive", () =>
				Effect.gen(function* () {
					const agent = yield* Observed5;
					assert.deepStrictEqual([agent.audience, agent.interactive], ["agent", false]);
					const ci = yield* Observed6;
					assert.deepStrictEqual([ci.audience, ci.interactive], ["ci", false]);
				}),
			);
		});
	}

	{
		class Observed7 extends Context.Service<Observed7, Effect.Success<typeof observe>>()(
			"@beep/scratchpad/test/cli/CliEnv.layerTest.test/Observed7",
		) {}
		const layerSeen0 = Layer.effect(Observed7, observe).pipe(
			Layer.provide(Layer.fresh(CliEnv.layerTest({ columns: 60, color: "truecolor" }))),
		);
		const themeLayer = Layer.fresh(CliEnv.layerTest({ color: "truecolor" }));
		it.layer(Layer.mergeAll(layerSeen0, themeLayer), { timeout: "30 seconds" })((it) => {
			it.effect("columns and color set the terminal's width and both streams' colour", () =>
				Effect.gen(function* () {
					const seen = yield* Observed7;
					assert.deepStrictEqual([seen.width, seen.color, seen.stderrColor], [60, "truecolor", "truecolor"]);
					const theme = yield* CliTheme;
					assert.notStrictEqual(theme.paint("accent", "x"), "x", "the theme paints at truecolor");
				}),
			);
		});
	}

	{
		const termLayer = Layer.fresh(CliEnv.layerTest({ term: "dumb" })).pipe(
			Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown({ TERM: "xterm" }))),
		);
		it.layer(Layer.mergeAll(termLayer), { timeout: "30 seconds" })((it) => {
			it.effect("TERM is given to the layer's own builds only: the program still reads its own provider", () =>
				Effect.gen(function* () {
					const term = yield* Config.option(Config.String("TERM"));
					assertSome(term, "xterm");
				}),
			);
		});
	}
});
