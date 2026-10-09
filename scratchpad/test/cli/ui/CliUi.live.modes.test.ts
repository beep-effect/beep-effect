// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file globalTimers:skip-file newPromise:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Audience } from "../../../effected/env/index.ts";
import type { Console } from "effect";
import { Effect, Exit, Fiber, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import { vi } from "vitest";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { screenAfter } from "../../../effected/cli/ui/testing/terminalModel.ts";
import { Select, Styled, Tabs, useTerminalSize, useTheme } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { State } from "../helpers/live.ts";
import {
	End,
	SHOW_CURSOR,
	Start,
	capturing,
	frameOf,
	liveOn,
	mountsAndResolves,
	optionsOf,
	queueOf,
	tick,
	until,
	warningsIn,
} from "../helpers/live.ts";

// Count loads of the peers through the kit's one loader, without changing what it does.
const { loads } = vi.hoisted(() => ({ loads: { count: 0 } }));
vi.mock("../../../effected/cli/ui/internal/ink.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../../effected/cli/ui/internal/ink.ts")>();
	const { Effect } = await import("effect");
	return {
		...actual,
		loadInk: Effect.suspend(() => {
			loads.count++;
			return actual.loadInk;
		}),
	};
});

const ESC = String.fromCharCode(0x1b);

/** Real time, which a `TestClock` does not hold: for Ink's own timers and React's commits. */
const settle = (millis: number): Effect.Effect<void> =>
	Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, millis)));

describe("CliUi.live: the tick, an Effect schedule in the run's scope", () => {
	it.effect("each run ticks on the clock: 400 ms on the TestClock draws frames 0 through 5", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const frames: Array<number> = [];
			const queue = yield* queueOf();
			yield* liveOn(
				fake,
				optionsOf(Stream.fromQueue(queue), {
					render: (state, frame) => {
						frames.push(frame);
						return frameOf(state);
					},
				}),
			);
			yield* Queue.offer(queue, Start);
			yield* settle(30);
			yield* TestClock.adjust("400 millis");
			yield* settle(50);
			assert.deepStrictEqual(
				[...new Set(frames)].sort((a, b) => a - b),
				[0, 1, 2, 3, 4, 5],
			);
		}).pipe(Effect.scoped),
	);

	it.effect("control: the tick stops at the terminal event, so time passing after it draws nothing", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const frames: Array<number> = [];
			const queue = yield* queueOf();
			yield* liveOn(
				fake,
				optionsOf(Stream.fromQueue(queue), {
					render: (state, frame) => {
						frames.push(frame);
						return frameOf(state);
					},
				}),
			);
			yield* Queue.offerAll(queue, [Start, End]);
			yield* settle(30);
			const drawn = frames.length;
			yield* TestClock.adjust("400 millis");
			yield* settle(50);
			assert.strictEqual(frames.length, drawn, "no frame after the run ended");
			assert.deepStrictEqual([...new Set(frames)], [0]);
		}).pipe(Effect.scoped),
	);

	it.effect("a tick that is not a positive number of milliseconds is a defect, before anything is pulled", () =>
		Effect.gen(function* () {
			for (const tickMillis of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
				const exit = yield* Effect.exit(
					Effect.scoped(liveOn(makeFakeStreams(), optionsOf(Stream.fromIterable([Start]), { tickMillis }))),
				);
				assert.isTrue(Exit.isFailure(exit), String(tickMillis));
				assert.include(String(exit), "tickMillis", String(tickMillis));
			}
		}),
	);
});

describe("CliUi.live: a render that fails degrades the run, unmounting before its one warning", () => {
	it.live("a render that throws mid-run: the last frame stays, one warning after the unmount, the fold goes on", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			const timeline: Array<string> = [];
			const keep = log.console.warn;
			const console = Object.assign(Object.create(log.console) as Console.Console, {
				log: (...args: ReadonlyArray<unknown>) => {
					timeline.push("log");
					keep(...args);
				},
			});
			// Paced, so every state is drawn: events that arrive together are folded at once and drawn once, which in a
			// cold run can fold `tick 2` away before it is ever rendered.
			const queue = yield* queueOf();
			const options = optionsOf(Stream.fromQueue(queue), {
				render: (state) => {
					if (state.last === "tick 2") throw new Error("render threw");
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console, onUnmount: () => timeline.push("unmount") });
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 1"));
			yield* Queue.offer(queue, tick(2));
			yield* until(() => warningsIn(log.lines).length > 0);
			yield* Queue.offerAll(queue, [tick(3), End]);
			yield* Queue.end(queue);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual((yield* handle.state).last, "ended", "the fold went on");
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			assert.include(warningsIn(log.lines)[0] ?? "", "render threw");
			assert.include(warningsIn(log.lines)[0] ?? "", "the live view stopped drawing this run: render threw");
			assert.deepStrictEqual(timeline, ["unmount", "log"], "the warning is written after the unmount");
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 1"], "the last good frame, once");
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "no instance or permit leaked");
		}).pipe(Effect.scoped),
	);

	it.live("a render that throws before the first paint: the final frame is written once, as a string", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			const options = optionsOf(Stream.fromIterable([Start, tick(1), End]), {
				render: (state) => {
					if (state.last === "started") throw new Error("first paint threw");
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console: log.console });
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			const shown = screenAfter(fake.stdout());
			assert.deepStrictEqual(shown, ["RUN 1", "ended"]);
		}).pipe(Effect.scoped),
	);

	it.live("a mount that fails degrades the same way: one warning, the fold goes on, the final frame once", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, tick(1), End])), {
				console: log.console,
				onMount: () => {
					throw new Error("the mount failed");
				},
			});
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual((yield* handle.state).last, "ended");
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			assert.include(warningsIn(log.lines)[0] ?? "", "the mount failed");
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "ended"]);
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted");
		}).pipe(Effect.scoped),
	);

	it.live("a degraded run ends at its terminal event: the next run mounts and draws again", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			// Paced, so `tick 2` is drawn (and throws) on its own.
			const queue = yield* queueOf();
			const options = optionsOf(Stream.fromQueue(queue), {
				render: (state) => {
					if (state.last === "tick 2") throw new Error("render threw");
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console: log.console });
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 1"));
			yield* Queue.offer(queue, tick(2));
			yield* until(() => warningsIn(log.lines).length > 0);
			yield* Queue.offerAll(queue, [End, Start, tick(5), End]);
			yield* Queue.end(queue);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 1", "RUN 2", "ended"]);
			assert.strictEqual(warningsIn(log.lines).length, 1);
		}).pipe(Effect.scoped),
	);

	it.live(
		"a render that throws only on the terminal state: one warning, after the unmount, and the last good frame",
		() =>
			Effect.gen(function* () {
				const fake = makeFakeStreams({ columns: 40, rows: 20 });
				const log = capturing();
				const timeline: Array<string> = [];
				const keep = log.console.warn;
				const console = Object.assign(Object.create(log.console) as Console.Console, {
					log: (...args: ReadonlyArray<unknown>) => {
						timeline.push("log");
						keep(...args);
					},
				});
				// A summary that first renders on the final data: the likeliest real shape of a render that throws. Paced, so
				// `tick 2` is drawn on its own before the end arrives (events that arrive together are drawn once).
				const queue = yield* queueOf();
				const options = optionsOf(Stream.fromQueue(queue), {
					render: (state) => {
						if (state.last === "ended") throw new Error("the summary threw");
						return frameOf(state);
					},
				});
				const handle = yield* liveOn(fake, options, { console, onUnmount: () => timeline.push("unmount") });
				yield* Queue.offerAll(queue, [Start, tick(1), tick(2)]);
				yield* until(() => screenAfter(fake.stdout()).includes("tick 2"));
				yield* Queue.offer(queue, End);
				yield* Queue.end(queue);
				yield* handle.done.pipe(Effect.timeout("2 seconds"));
				assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
				assert.include(warningsIn(log.lines)[0] ?? "", "the summary threw");
				assert.deepStrictEqual(timeline, ["unmount", "log"], "the warning is written after the unmount");
				assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 2"], "the last good frame, once");
				assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "no instance or permit leaked");
			}).pipe(Effect.scoped),
	);

	it.live("a render that throws on the terminal state, and on the last good frame after it: one warning still", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			let broken = false;
			const options = optionsOf(Stream.fromIterable([Start, tick(1), tick(2), End]).pipe(Stream.rechunk(1)), {
				render: (state) => {
					if (state.last === "ended") broken = true;
					if (broken) throw new Error("every render threw");
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console: log.console });
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			assert.include(warningsIn(log.lines)[0] ?? "", "every render threw");
			// Nothing of the run is left on the terminal here, and its final frame cannot be printed: the warning claims
			// no frame (final review N1).
			assert.include(warningsIn(log.lines)[0] ?? "", "the live view stopped drawing this run");
			assert.notInclude(warningsIn(log.lines)[0] ?? "", "frame", "the warning claims no frame");
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "no instance or permit leaked");
		}).pipe(Effect.scoped),
	);

	it.live("a start during a degraded run ends it and mounts a fresh run, with no terminal event between", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			const queue = yield* queueOf();
			let mounts = 0;
			const options = optionsOf(Stream.fromQueue(queue), {
				render: (state) => {
					if (state.run === 1 && state.last === "tick 2") throw new Error("render threw");
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console: log.console, onMount: () => mounts++ });
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 1"));
			yield* Queue.offer(queue, tick(2));
			yield* until(() => warningsIn(log.lines).length === 1);
			// A host that aborts a run without its terminal event (a watch rerun mid-run) starts the next one.
			yield* Queue.offerAll(queue, [Start, tick(5)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 5"));
			yield* Queue.offer(queue, End);
			yield* Queue.end(queue);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(mounts, 2, "the start mounted a fresh run");
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "tick 1", "RUN 2", "ended"]);
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
		}).pipe(Effect.scoped),
	);

	it.live("a reduce that throws unmounts first, then done dies with the error, and the terminal is restored", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const queue = yield* queueOf();
			const timeline: Array<string> = [];
			const handle = yield* liveOn(
				fake,
				optionsOf(Stream.fromQueue(queue), {
					reduce: (state, event) => {
						if (event._tag === "Tick" && event.n === 2) throw new Error("reduce threw");
						return { ...state, last: event._tag === "Tick" ? `tick ${event.n}` : event._tag, run: 1 };
					},
				}),
				{ onUnmount: () => timeline.push("unmount") },
			);
			const done = yield* Effect.forkChild(Effect.exit(handle.done));
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 1"));
			yield* Queue.offer(queue, tick(2));
			const exit = yield* Fiber.join(done).pipe(Effect.timeout("2 seconds"));
			timeline.push("done");
			assert.isTrue(Exit.isFailure(exit), "done failed");
			assert.include(String(exit), "reduce threw");
			assert.deepStrictEqual(timeline, ["unmount", "done"]);
			assert.deepStrictEqual(fake.rawModes, []);
			assert.include(fake.stdout().slice(-64), SHOW_CURSOR);
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "the permit was released");
		}).pipe(Effect.scoped),
	);
});

const Styledframe = (state: State): ReactElement =>
	createElement(Styled, { token: "accent" }, `${state.last} ${"x".repeat(60)}`);

describe("CliUi.live when not interactive", () => {
	it.live("owned: the final frame is written once at the terminal event, escape-free at colour none", () =>
		Effect.gen(function* () {
			loads.count = 0;
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, tick(1), End])), { interactive: false });
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(fake.stdout(), "RUN 1\nended\n");
			assert.strictEqual(loads.count, 1, "Ink was loaded once, for the string");
		}).pipe(Effect.scoped),
	);

	it.live("owned: a human at truecolor gets the theme's colour; at none, no escape at all", () =>
		Effect.gen(function* () {
			const coloured = makeFakeStreams({ columns: 200, rows: 20 });
			const human = yield* liveOn(coloured, optionsOf(Stream.fromIterable([Start, End]), { render: Styledframe }), {
				interactive: false,
				color: "truecolor",
			});
			yield* human.done.pipe(Effect.timeout("2 seconds"));
			assert.include(coloured.stdout(), `${ESC}[`, "coloured for a human at truecolor");
			const plain = makeFakeStreams({ columns: 200, rows: 20 });
			const agent = yield* liveOn(plain, optionsOf(Stream.fromIterable([Start, End]), { render: Styledframe }), {
				interactive: false,
				color: "none",
			});
			yield* agent.done.pipe(Effect.timeout("2 seconds"));
			assert.notInclude(plain.stdout(), ESC, "escape-free at colour none");
			assert.include(plain.stdout(), "ended");
		}).pipe(Effect.scoped),
	);

	it.live("owned: laid out at the stdout width, or 80 when it reports none, and never cut in height", () =>
		Effect.gen(function* () {
			const Size = (state: State): ReactElement => {
				const Probe = (): ReactElement => {
					const { columns, rows } = useTerminalSize();
					return createElement(Text, null, `${state.last} size=${columns} rows=${rows} ${"word ".repeat(30)}`);
				};
				return createElement(Probe);
			};
			const narrow = makeFakeStreams({ columns: 40, rows: 5 });
			const first = yield* liveOn(narrow, optionsOf(Stream.fromIterable([Start, End]), { render: Size }), {
				interactive: false,
			});
			yield* first.done.pipe(Effect.timeout("2 seconds"));
			const lines = narrow.stdout().trimEnd().split("\n");
			assert.include(lines[0] ?? "", "size=39");
			assert.isTrue(
				lines.every((line) => line.length <= 40),
				lines.join("|"),
			);
			assert.isAbove(lines.length, 4, "taller than the 5 rows the stream reports: not height-clipped");
			assert.include(lines.join(" "), "rows=Infinity", "widgets see no height to fit, not the stream's 5 rows");
			const unknown = makeFakeStreams({ columns: 40, rows: 20 });
			Object.assign(unknown.streams.stdout, { columns: undefined });
			const second = yield* liveOn(unknown, optionsOf(Stream.fromIterable([Start, End]), { render: Size }), {
				interactive: false,
			});
			yield* second.done.pipe(Effect.timeout("2 seconds"));
			assert.include(unknown.stdout(), "size=79");
		}).pipe(Effect.scoped),
	);

	it.live("owned: a stream that ends without a terminal event still writes its frame once; each run writes one", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, tick(1), End, Start, tick(2)])), {
				interactive: false,
			});
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(fake.stdout(), "RUN 1\nended\nRUN 2\ntick 2\n");
		}).pipe(Effect.scoped),
	);

	it.live("hosted: nothing is written and Ink is never loaded", () =>
		Effect.gen(function* () {
			loads.count = 0;
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, tick(1), End]), { mode: "hosted" }), {
				interactive: false,
			});
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(fake.stdout(), "");
			assert.strictEqual(fake.stderr(), "");
			assert.strictEqual(loads.count, 0);
			assert.strictEqual((yield* handle.state).last, "ended", "the fold still ran");
		}).pipe(Effect.scoped),
	);

	it.live("owned: no string is due until the terminal event, so Ink is not loaded before it", () =>
		Effect.gen(function* () {
			loads.count = 0;
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const queue = yield* queueOf();
			const handle = yield* liveOn(fake, optionsOf(Stream.fromQueue(queue)), { interactive: false });
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => true);
			yield* Effect.sleep("30 millis");
			assert.strictEqual(loads.count, 0, "nothing loaded mid-run");
			assert.strictEqual((yield* handle.state).last, "tick 1");
			yield* Queue.offer(queue, End);
			yield* until(() => fake.stdout().includes("ended"));
			assert.strictEqual(loads.count, 1);
		}).pipe(Effect.scoped),
	);
});

describe("CliUi.live: a stream that dies, a fallback that throws, an agent audience and the frame index", () => {
	const dying = Stream.fromIterable([Start, tick(1)]).pipe(
		Stream.rechunk(1),
		Stream.concat(Stream.die(new Error("the stream died"))),
	);

	it.live("a stream that dies mid-run: the run unmounts first, then done dies with the stream's defect", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const timeline: Array<string> = [];
			const handle = yield* liveOn(fake, optionsOf(dying), { onUnmount: () => timeline.push("unmount") });
			const exit = yield* Effect.exit(handle.done).pipe(Effect.timeout("2 seconds"));
			timeline.push("done");
			assert.isTrue(Exit.isFailure(exit), String(exit));
			assert.include(String(exit), "the stream died");
			assert.deepStrictEqual(timeline, ["unmount", "done"]);
			assert.deepStrictEqual(fake.rawModes, []);
			assert.include(fake.stdout().slice(-64), SHOW_CURSOR);
			assert.strictEqual(yield* mountsAndResolves(makeFakeStreams()), "mounted", "the permit was released");
		}).pipe(Effect.scoped),
	);

	it.live("a stream that dies when not interactive: done dies with the stream's defect too", () =>
		Effect.gen(function* () {
			const handle = yield* liveOn(makeFakeStreams(), optionsOf(dying), { interactive: false });
			const exit = yield* Effect.exit(handle.done).pipe(Effect.timeout("2 seconds"));
			assert.isTrue(Exit.isFailure(exit), String(exit));
			assert.include(String(exit), "the stream died");
		}).pipe(Effect.scoped),
	);

	it.live("a fallback that throws too leaves the run unpainted, so its final frame is printed as a string", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const log = capturing();
			const drawn = new Set<string>();
			// Paced, so `tick 1` is the last good frame and `tick 2` is drawn (and throws) on its own.
			const queue = yield* queueOf();
			const options = optionsOf(Stream.fromQueue(queue), {
				render: (state) => {
					if (state.last === "tick 2") throw new Error("render threw");
					// The fallback draws the last good state again: this time it throws as well.
					if (drawn.has(state.last)) throw new Error("fallback threw");
					drawn.add(state.last);
					return frameOf(state);
				},
			});
			const handle = yield* liveOn(fake, options, { console: log.console });
			yield* Queue.offerAll(queue, [Start, tick(1)]);
			yield* until(() => screenAfter(fake.stdout()).includes("tick 1"));
			yield* Queue.offer(queue, tick(2));
			yield* until(() => warningsIn(log.lines).length > 0);
			yield* Queue.offer(queue, End);
			yield* Queue.end(queue);
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.strictEqual(warningsIn(log.lines).length, 1, log.lines.join("\n"));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["RUN 1", "ended"], "the final frame, once");
		}).pipe(Effect.scoped),
	);

	it.live("owned, not interactive, for an agent audience: escape-free even on a truecolor terminal", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 200, rows: 20 });
			const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, End]), { render: Styledframe }), {
				interactive: false,
				color: "truecolor",
			}).pipe(Effect.provide(Audience.layerTest("agent")));
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			assert.include(fake.stdout(), "ended");
			assert.notInclude(fake.stdout(), ESC, "no escape of any kind for an agent");
		}).pipe(Effect.scoped),
	);

	it.effect("the frame index never steps back: every frame drawn is at or after the last", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const frames: Array<number> = [];
			const queue = yield* queueOf();
			yield* liveOn(
				fake,
				optionsOf(Stream.fromQueue(queue), {
					tickMillis: 10,
					render: (state, frame) => {
						frames.push(frame);
						return frameOf(state);
					},
				}),
			);
			yield* Queue.offer(queue, Start);
			yield* settle(20);
			for (let step = 1; step <= 30; step++) {
				yield* Queue.offer(queue, tick(step));
				yield* TestClock.adjust("25 millis");
			}
			yield* settle(80);
			const backwards = frames.filter((frame, index) => index > 0 && frame < (frames[index - 1] ?? 0));
			assert.deepStrictEqual(backwards, [], `frames drawn: ${frames.join(",")}`);
		}).pipe(Effect.scoped),
	);
});

describe("CliUi.live and CliUi.run for an agent: the provided theme is colourless", () => {
	/** What an agent's frame must show: the theme's own colour and paint, and the kit's colour-none text markers. */
	const AgentProbe = (): ReactElement => {
		const theme = useTheme();
		return createElement(
			Box,
			{ flexDirection: "column" },
			createElement(Text, null, `color=${theme.color} ${theme.paint("accent", "painted")}`),
			createElement(Select.View<number>, {
				message: "Pick",
				choices: [
					{ label: "one", value: 1 },
					{ label: "two", value: 2, disabled: true },
				],
				onSubmit: () => undefined,
			}),
			createElement(Tabs.View, {
				tabs: [
					{ name: "a", label: "Alpha" },
					{ name: "b", label: "Beta" },
				],
			}),
		);
	};
	const SGR = new RegExp(`${ESC}\\[[0-9;]*m`);

	it.live("an owned live view's printed frame: no escape, color=none, and the colour-none markers drawn", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams({ columns: 80, rows: 20 });
			const handle = yield* liveOn(
				fake,
				optionsOf(Stream.fromIterable([Start, End]), { render: () => createElement(AgentProbe) }),
				{ interactive: false, color: "truecolor" },
			).pipe(Effect.provide(Audience.layerTest("agent")));
			yield* handle.done.pipe(Effect.timeout("2 seconds"));
			const written = fake.stdout();
			assert.notInclude(written, ESC, "no escape of any kind for an agent");
			assert.include(written, "color=none painted");
			assert.include(written, "(disabled)", "Select's colour-none marker");
			assert.include(written, "[Alpha]", "Tabs' colour-none brackets");
		}).pipe(Effect.scoped),
	);

	it.live("a CliUi.run screen for an agent (forced interactive by the harness) gets the same colourless theme", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(AgentProbe), { color: "truecolor" }).pipe(
				Effect.provide(Audience.layerTest("agent")),
			);
			const raw = yield* handle.rawFrame;
			assert.notMatch(raw, SGR, "no colour escape for an agent");
			const plain = yield* handle.plainFrame;
			assert.include(plain, "color=none painted");
			assert.include(plain, "(disabled)");
			assert.include(plain, "[Alpha]");
		}).pipe(Effect.scoped),
	);
});
