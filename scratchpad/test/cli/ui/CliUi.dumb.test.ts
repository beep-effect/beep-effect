// @effect-diagnostics strictEffectProvide:skip-file
// A TERM=dumb terminal cannot move the cursor or take synchronized output, so the kit's screens treat it as not
// interactive, through CliInteractive's own decision: a live view prints its final frame once, as for a
// pipe, and a screen is refused.
import { assert, describe, it } from "@effect/vitest";
import { Audience, TerminalEnv } from "../../../effected/env/index.ts";
import { ConfigProvider, Effect, Layer, Stream } from "effect";
import { Text } from "ink";
import { createElement } from "react";
import { CliInteractive, CliTheme, NotInteractive } from "../../../effected/cli/index.ts";
import type { FakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { CliUi, UiStreams } from "../../../effected/cli/ui.ts";
import { ESC, End, Start, optionsOf, tick } from "../helpers/live.ts";

const SYNC_BEGIN = `${ESC}[?2026h`;
const CURSOR_UP = new RegExp(`${ESC}\\[\\d*A`);

/** The decision as a program gets it: a human on two terminals, with `TERM` from the environment. */
const onTerminals =
	(term: string) =>
	<A, E, R>(self: Effect.Effect<A, E, R>) =>
		self.pipe(
			Effect.provide(
				CliInteractive.layer.pipe(
					Layer.provide(
						Layer.mergeAll(
							Audience.layerTest("human"),
							TerminalEnv.layerTest({ stdinIsTerminal: true, stdout: { isTerminal: true } }),
						),
					),
				),
			),
			Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: term })),
		);

const liveUnder = Effect.fn("liveUnder")(function* (term: string, fake: FakeStreams) {
		const handle = yield* CliUi.live(optionsOf(Stream.fromIterable([Start, tick(1), tick(2), End]))).pipe(
			Effect.provideService(UiStreams, fake.streams),
			Effect.provide(CliTheme.layerTest()),
			onTerminals(term),
		);
		yield* handle.done.pipe(Effect.timeout("2 seconds"));
		return fake.stdout();
	}, Effect.scoped);

describe("TERM=dumb is not interactive", () => {
	it.live("a live view on a dumb TTY prints its final frame once: no synchronized output, no cursor-up", () =>
		Effect.gen(function* () {
			const written = yield* liveUnder("dumb", makeFakeStreams({ columns: 40, rows: 20 }));
			assert.notInclude(written, SYNC_BEGIN);
			assert.notMatch(written, CURSOR_UP);
			assert.strictEqual(written.split("RUN 1").length - 1, 1, written);
			assert.include(written, "ended");
		}),
	);

	it.live("control: the same view on a real TERM is drawn live, with synchronized output", () =>
		Effect.gen(function* () {
			const written = yield* liveUnder("xterm-256color", makeFakeStreams({ columns: 40, rows: 20 }));
			assert.include(written, SYNC_BEGIN);
		}),
	);

	it.live("a screen on a dumb TTY fails with NotInteractive", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const error = yield* CliUi.run<string>(() => createElement(Text, null, "a screen")).pipe(
				Effect.provideService(UiStreams, fake.streams),
				Effect.provide(CliTheme.layerTest()),
				onTerminals("dumb"),
				Effect.flip,
				Effect.timeout("2 seconds"),
			);
			assert.instanceOf(error, NotInteractive);
			assert.strictEqual(fake.stdout(), "");
		}),
	);
});
