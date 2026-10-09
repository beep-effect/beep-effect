import { assert, describe, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import { vi } from "vitest";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, capturing, reduce, tick, warningsIn } from "../helpers/live.ts";

// React's development build records user-timing entries only when `console.timeStamp` is a function, checked once as
// it loads; a Vitest worker's console lacks it, so the drain behaviour below could not fail without this.
vi.hoisted(() => {
	const target = console;
	if (typeof target.timeStamp !== "function") target.timeStamp = () => undefined;
});

const ESC = String.fromCharCode(0x1b);

/** A frame that shows the run, the last event and the frame index. */
const withFrame = (state: State, frame: number): ReactElement =>
	createElement(
		Box,
		{ flexDirection: "column" },
		createElement(Text, null, `RUN ${state.run}`),
		createElement(Text, null, `${state.last} frame ${frame}`),
	);

const viewOptions = {
	initial: { run: 0, last: "idle", seen: [] } satisfies State,
	reduce,
	render: withFrame,
	isStart: (event: Ev) => event._tag === "Start",
	isTerminal: (event: Ev) => event._tag === "End",
};

describe("CliUiTest.live: the harness", () => {
	it.effect("publish settles like a key press: the frame shows the event at once, on the production path", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...viewOptions, columns: 40, rows: 10 });
			yield* view.publish(Start);
			assert.strictEqual(yield* view.plainFrame, "RUN 1\nstarted frame 0");
			yield* view.publish(tick(1));
			assert.strictEqual(yield* view.plainFrame, "RUN 1\ntick 1 frame 0");
			assert.deepStrictEqual(yield* view.frames, ["RUN 1\nstarted frame 0", "RUN 1\ntick 1 frame 0"]);
			assert.notInclude(yield* view.rawFrame, `${ESC}[2K`, "a frame without Ink's erase moves");
			yield* view.end;
			assert.strictEqual((yield* view.handle.state).last, "tick 1");
		}).pipe(Effect.scoped),
	);

	it.effect("end ends the stream and waits for the view, dying with what it died of", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({
				...viewOptions,
				reduce: (state: State, event: Ev) => {
					if (event._tag === "Tick") throw new Error("reduce threw");
					return reduce(state, event);
				},
			});
			yield* view.publish(Start);
			yield* view.publish(tick(1));
			const ended = yield* Effect.exit(view.end);
			assert.isTrue(Exit.isFailure(ended));
			assert.include(String(ended), "reduce threw");
		}).pipe(Effect.scoped),
	);
});

describe("CliUiTest.live: vitest-agent's eight behaviours", () => {
	it.effect("1. the frame index is the wall clock in ticks, so it keeps counting across a remount", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live(viewOptions);
			yield* view.publish(Start);
			yield* view.advance("160 millis");
			assert.include(yield* view.plainFrame, "frame 2");
			yield* view.publish(End);
			yield* view.advance("160 millis");
			yield* view.publish(Start);
			assert.include(yield* view.plainFrame, "frame 4", "the new run starts at the clock's frame, not 0");
		}).pipe(Effect.scoped),
	);

	it.effect("2. the final frame is committed by the unmount, and nothing is cleared", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live(viewOptions);
			yield* view.publish(Start);
			yield* view.publish(tick(1));
			yield* view.publish(End);
			assert.strictEqual(yield* view.transcript, "RUN 1\nended frame 0");
			yield* view.end;
		}).pipe(Effect.scoped),
	);

	it.effect("3. a resize re-lays the frame out at the new width, leaving one copy", () =>
		Effect.gen(function* () {
			const bordered = (state: State): ReactElement =>
				createElement(Box, { borderStyle: "single", flexDirection: "column" }, createElement(Text, null, state.last));
			const view = yield* CliUiTest.live({ ...viewOptions, render: bordered, columns: 60, rows: 10 });
			yield* view.publish(Start);
			assert.strictEqual((yield* view.plainFrame).split("\n")[0]?.length, 60, "full width at 60 columns");
			yield* view.resize(40, 10);
			yield* view.publish(tick(1));
			const lines = (yield* view.plainFrame).split("\n");
			assert.strictEqual(lines[0]?.length, 40, "re-laid out at 40 columns");
			yield* view.publish(End);
			const shown = (yield* view.transcript).split("\n");
			assert.strictEqual(shown.filter((line) => line.startsWith("┌")).length, 1, shown.join("\n"));
		}).pipe(Effect.scoped),
	);

	it.effect("4. React's user-timing entries are drained after every render; without the drain they pile up", () => Effect.gen(function* () {
			const measures = Effect.fn("measures")(function* (drainPerformance: boolean) {
					performance.clearMeasures();
					const view = yield* CliUiTest.live({ ...viewOptions, drainPerformance });
					yield* view.publish(Start);
					for (let index = 1; index <= 10; index++) yield* view.publish(tick(index));
					yield* view.advance("400 millis");
					return performance.getEntriesByType("measure").length;
				}, Effect.scoped);
			const undrained = yield* measures(false);
			const drained = yield* measures(true);
			// React records a render's passive effects after the commit the drain follows, so up to one render's worth
			// is left between drains: bounded, where without the drain every render's entries stay.
			assert.isAbove(undrained, 40, `control: undrained, the entries pile up (${undrained})`);
			assert.isAtMost(drained, 5, `drained, at most one render's worth is left (${drained})`);
		}),
	);

	it.effect("5. a render that throws degrades the run: one warning, the last frame kept, the fold going on", () =>
		Effect.gen(function* () {
			const log = capturing();
			const view = yield* CliUiTest.live({
				...viewOptions,
				render: (state: State, frame: number) => {
					if (state.last === "tick 2") throw new Error("render threw");
					return withFrame(state, frame);
				},
			}).pipe(Effect.provideService(Console.Console, log.console));
			yield* view.publish(Start);
			yield* view.publish(tick(1));
			yield* view.publish(tick(2));
			yield* view.publish(tick(3));
			yield* view.publish(End);
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			assert.strictEqual(yield* view.transcript, "RUN 1\ntick 1 frame 0", "the last good frame, once");
			assert.strictEqual((yield* view.handle.state).last, "ended");
		}).pipe(Effect.scoped),
	);

	it.effect("6. watch mode: each run's frame stays, and a start mid-run redraws in place", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live(viewOptions);
			for (const event of [Start, tick(1), End, Start, tick(2), End, Start, tick(3), Start, tick(4), End]) {
				yield* view.publish(event);
			}
			assert.strictEqual(
				yield* view.transcript,
				["RUN 1", "ended frame 0", "RUN 2", "ended frame 0", "RUN 4", "ended frame 0"].join("\n"),
			);
			const written = yield* view.written;
			assert.include(written, "RUN 4", "control: the raw bytes are what the view wrote");
			assert.notInclude(written, `${ESC}[3J`, "the scrollback was never wiped");
			assert.notInclude(written, `${ESC}[2J`, "the screen was never cleared");
		}).pipe(Effect.scoped),
	);

	it.effect("7. teardown with no terminal event: the frame stays, the tick stops, nothing more is written", () =>
		Effect.gen(function* () {
			const view = yield* Effect.scoped(
				Effect.gen(function* () {
					const view = yield* CliUiTest.live(viewOptions);
					yield* view.publish(Start);
					yield* view.publish(tick(1));
					return view;
				}),
			);
			const shown = yield* view.transcript;
			assert.strictEqual(shown, "RUN 1\ntick 1 frame 0", "unmounted by the close, its frame committed");
			const drawn = (yield* view.frames).length;
			yield* view.advance("400 millis");
			assert.strictEqual((yield* view.frames).length, drawn, "no tick after the close");
			assert.strictEqual(yield* view.transcript, shown);
		}),
	);

	it.effect("8. the streams are injectable: the harness's own terminal gets every byte, the process's none", () =>
		Effect.acquireUseRelease(
			Effect.sync(() => vi.spyOn(process.stdout, "write")),
			(spy) =>
				Effect.gen(function* () {
					const view = yield* CliUiTest.live(viewOptions);
					yield* view.publish(Start);
					view.handle.logConsole.log("a log line");
					yield* view.publish(End);
					assert.strictEqual(yield* view.transcript, "a log line\nRUN 1\nended frame 0");
					assert.strictEqual(spy.mock.calls.length, 0, "nothing reached the process's stdout");
				}).pipe(Effect.scoped),
			(spy) => Effect.sync(() => spy.mockRestore()),
		),
	);
});

describe("CliUiTest.live: what the harness can see", () => {
	it.effect("a scrollback wipe shows: written carries ESC[3J, and the transcript loses what was above the frame", () =>
		Effect.gen(function* () {
			// A frame at the clamp's full height, then a height shrink: the one-paint lag the CliUi.live docs describe
			// makes Ink paint the old height into the shorter terminal, which it answers with a clear-terminal frame.
			const tall = (state: State): ReactElement =>
				createElement(
					Box,
					{ flexDirection: "column" },
					...Array.from({ length: 40 }, (_, index) =>
						createElement(Text, { key: index }, `${state.last} line ${index}`),
					),
				);
			const view = yield* CliUiTest.live({ ...viewOptions, render: tall, columns: 40, rows: 10 });
			view.handle.logConsole.log("HISTORY");
			yield* view.publish(Start);
			assert.isTrue((yield* view.transcript).startsWith("HISTORY"), "control: the history is there before the shrink");
			yield* view.resize(40, 4);
			yield* view.publish(tick(1));
			assert.include(yield* view.written, `${ESC}[3J`, "Ink wiped the scrollback");
			assert.isFalse((yield* view.transcript).startsWith("HISTORY"), "and the transcript shows it gone");
		}).pipe(Effect.scoped),
	);

	it.effect("a line logged after a run ended is not taken for a frame", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live(viewOptions);
			yield* view.publish(Start);
			yield* view.publish(End);
			const frames = yield* view.frames;
			view.handle.logConsole.log("after the run");
			yield* view.advance("0 millis");
			assert.deepStrictEqual(yield* view.frames, frames, "no frame was added");
			assert.strictEqual(yield* view.plainFrame, "RUN 1\nended frame 0");
			assert.include(yield* view.transcript, "after the run");
		}).pipe(Effect.scoped),
	);
});

describe("CliUiTest.live: advance needs the TestClock", () => {
	it.live("under it.live, with the real clock, advance dies instead of waiting", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live(viewOptions);
			yield* view.publish(Start);
			const exit = yield* Effect.exit(view.advance("80 millis"));
			assert.isTrue(Exit.isFailure(exit), "advance has no TestClock to move under it.live");
			assert.include(yield* view.plainFrame, "started", "the view itself is unaffected");
		}).pipe(Effect.scoped),
	);
});
