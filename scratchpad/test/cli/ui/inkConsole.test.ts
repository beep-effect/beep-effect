import { Schema } from "effect";
import { Result } from "effect";
import { assert, describe, it } from "@effect/vitest";
import { Console, Effect } from "effect";
import type { Instance } from "ink";
import { Box, Text, render } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import { loadInk } from "../../../effected/cli/ui/internal/ink.ts";
import type { InkConsole } from "../../../effected/cli/ui/internal/inkConsole.ts";
import { makeInkConsole } from "../../../effected/cli/ui/internal/inkConsole.ts";
import type { FakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { screenAfter } from "../../../effected/cli/ui/testing/terminalModel.ts";
import type { UiStreamsShape } from "../../../effected/cli/ui.ts";
import { UiStreams } from "../../../effected/cli/ui.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

/** A two-row frame, so a torn repaint shows as a stranded header. */
const frame = (tick: number): ReactElement =>
	createElement(
		Box,
		{ flexDirection: "column" },
		createElement(Text, null, "LIVE HEADER"),
		createElement(Text, null, `tick ${tick}`),
	);

/**
 * One terminal, as a tty is: stdout and stderr are the same fake stream, so the transcript holds both in write order.
 * The production path: interactive, debug off.
 */
const terminal = (): { readonly fake: FakeStreams; readonly streams: UiStreamsShape } => {
	const fake = makeFakeStreams({ columns: 40, rows: 20 });
	return { fake, streams: { stdin: fake.streams.stdin, stdout: fake.streams.stdout, stderr: fake.streams.stdout } };
};

const mount = (streams: UiStreamsShape, bridge: InkConsole, tick: number): Instance =>
	render(createElement(bridge.Bridge, null, frame(tick)), {
		stdin: streams.stdin,
		stdout: streams.stdout,
		stderr: streams.stderr,
		interactive: true,
		patchConsole: false,
		exitOnCtrlC: false,
	});

/** An ambient `Console` that records every call: the bridge must never fall through to it. */
const recordingConsole = (): { readonly console: Console.Console; readonly calls: Array<string> } => {
	const calls: Array<string> = [];
	const record = (name: string) => (): void => {
		calls.push(name);
	};
	const names = [
		"assert",
		"clear",
		"count",
		"countReset",
		"debug",
		"dir",
		"dirxml",
		"error",
		"group",
		"groupCollapsed",
		"groupEnd",
		"info",
		"log",
		"table",
		"time",
		"timeEnd",
		"timeLog",
		"trace",
		"warn",
	];
	return {
		console: Object.fromEntries(names.map((name) => [name, record(name)])) as unknown as Console.Console,
		calls,
	};
};

const LOGS = [1, 2, 3, 4, 5].flatMap((index) => [`out line ${index}`, `err line ${index}`]);
const FINAL = ["LIVE HEADER", "tick 5"];

/** A live frame rerendered five times, with a stdout and a stderr line written after each rerender by `write`. */
const run = Effect.fn("run")(function* (write: (bridge: InkConsole, streams: UiStreamsShape, index: number) => void, ambient: Console.Console = recordingConsole().console) {
		yield* loadInk;
		const { fake, streams } = terminal();
		const bridge = yield* makeInkConsole.pipe(
			Effect.provideService(UiStreams, streams),
			Effect.provideService(Console.Console, ambient),
		);
		const instance = mount(streams, bridge, 0);
		for (let index = 1; index <= 5; index++) {
			instance.rerender(createElement(bridge.Bridge, null, frame(index)));
			yield* Effect.promise(() => instance.waitUntilRenderFlush());
			write(bridge, streams, index);
		}
		bridge.detach();
		instance.unmount();
		yield* Effect.promise(() => instance.waitUntilExit().catch(() => undefined));
		return { fake, bridge };
	});

describe("the console bridge writes above a live Ink frame (production path; okf/decisions/live-logs-through-ink.md)", () => {
	it.live("five stdout and five stderr lines land above the frame, in order, with one frame left", () =>
		Effect.gen(function* () {
			const { fake } = yield* run((bridge, _streams, index) => {
				bridge.writer.log(`out line ${index}`);
				bridge.writer.error(`err line ${index}`);
			});
			assert.deepStrictEqual(screenAfter(fake.stdout()), [...LOGS, ...FINAL]);
		}),
	);

	it.live("control: the same lines written straight to the stream tear the frame", () =>
		Effect.gen(function* () {
			const { fake } = yield* run((_bridge, streams, index) => {
				streams.stdout.write(`out line ${index}\n`);
				streams.stderr.write(`err line ${index}\n`);
			});
			const shown = screenAfter(fake.stdout());
			// Torn: the repaint erases lines it did not write, so log lines go missing or a stale header stays behind.
			const missing = LOGS.filter((line) => !shown.includes(line));
			const headers = shown.filter((line) => line === "LIVE HEADER").length;
			assert.isTrue(missing.length > 0 || headers > 1, `torn: ${Result.getOrThrow(Schema.encodeUnknownResult(Json)(shown))}`);
		}),
	);

	it.live("before the bridge mounts and after detach, a line goes straight to its stream and is never dropped", () =>
		Effect.gen(function* () {
			const { fake, bridge } = yield* run(() => undefined);
			bridge.writer.log("after the unmount");
			bridge.writer.error("an error after the unmount");
			const shown = screenAfter(fake.stdout());
			assert.deepStrictEqual(shown.slice(-2), ["after the unmount", "an error after the unmount"]);
		}),
	);

	it.live("while mounted, a stdout line goes through Ink's stdout and a stderr line through its stderr", () =>
		Effect.gen(function* () {
			yield* loadInk;
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
			const instance = mount(fake.streams, bridge, 1);
			yield* Effect.promise(() => instance.waitUntilRenderFlush());
			bridge.writer.info("an info line");
			bridge.writer.warn("a warning line");
			bridge.detach();
			instance.unmount();
			yield* Effect.promise(() => instance.waitUntilExit().catch(() => undefined));
			assert.deepStrictEqual(screenAfter(fake.stdout()), ["an info line", ...FINAL.slice(0, 1), "tick 1"]);
			assert.strictEqual(fake.stderr(), "a warning line\n");
		}),
	);

	it.live("an unmount without a detach also goes back to the streams, so no line is dropped", () =>
		Effect.gen(function* () {
			yield* loadInk;
			const { fake, streams } = terminal();
			const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, streams));
			const instance = mount(streams, bridge, 1);
			yield* Effect.promise(() => instance.waitUntilRenderFlush());
			instance.unmount();
			yield* Effect.promise(() => instance.waitUntilExit().catch(() => undefined));
			bridge.writer.log("after an unmount with no detach");
			assert.deepStrictEqual(screenAfter(fake.stdout()).at(-1), "after an unmount with no detach");
		}),
	);

	it.live("detach takes effect at once: a line written after it, before the unmount, goes straight to its stream", () =>
		Effect.gen(function* () {
			yield* loadInk;
			const fake = makeFakeStreams({ columns: 40, rows: 20 });
			const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
			const instance = mount(fake.streams, bridge, 1);
			yield* Effect.promise(() => instance.waitUntilRenderFlush());
			bridge.detach();
			const before = fake.stdout();
			bridge.writer.error("written between detach and unmount");
			// Through Ink's writer the frame would be erased and repainted on stdout around the line.
			assert.strictEqual(fake.stdout(), before, "no repaint: Ink's writer was not used");
			assert.strictEqual(fake.stderr(), "written between detach and unmount\n");
			instance.unmount();
			yield* Effect.promise(() => instance.waitUntilExit().catch(() => undefined));
		}),
	);

	it.live("every Console method that writes goes above the frame: table, dir, assert, count, group, time", () =>
		Effect.gen(function* () {
			const ambient = recordingConsole();
			const { fake } = yield* run((bridge, _streams, index) => {
				bridge.writer.log(`out line ${index}`);
				bridge.writer.error(`err line ${index}`);
				if (index !== 3) return;
				const writer = bridge.writer;
				writer.table([{ name: "a", n: 1 }]);
				writer.dir({ n: 2 });
				writer.dirxml("dirxml line");
				writer.assert(true, "never shown");
				writer.assert(false, "an assertion");
				writer.count("hits");
				writer.count("hits");
				writer.group("a group");
				writer.log("inside");
				writer.groupEnd();
				writer.groupCollapsed("collapsed");
				writer.groupEnd();
				writer.time("t");
				writer.timeLog("t", "mid");
				writer.timeEnd("t");
			}, ambient.console);
			assert.deepStrictEqual(ambient.calls, [], "nothing falls through to the ambient console");
			const shown = screenAfter(fake.stdout());
			const at = shown.indexOf("out line 3");
			const added = shown.slice(shown.indexOf("err line 3") + 1, shown.indexOf("out line 4"));
			assert.isAbove(at, -1, `the run wrote: ${Result.getOrThrow(Schema.encodeUnknownResult(Json)(shown))}`);
			assert.deepStrictEqual(added.slice(0, 11), [
				"| (index) | name | n |",
				"| 0       | a    | 1 |",
				'{"n":2}',
				"dirxml line",
				"Assertion failed: an assertion",
				"hits: 1",
				"hits: 2",
				"a group",
				"  inside",
				"collapsed",
				added[10] ?? "",
			]);
			assert.match(added[10] ?? "", /^t: \d+(\.\d+)?ms mid$/);
			assert.match(added[11] ?? "", /^t: \d+(\.\d+)?ms$/);
			assert.deepStrictEqual(shown.slice(-2), FINAL, "one frame left, below every line");
			assert.strictEqual(shown.filter((line) => line === "LIVE HEADER").length, 1, "no torn copy");
		}),
	);

	it.live("clear erases nothing: the history above and the frame stay", () =>
		Effect.gen(function* () {
			const ambient = recordingConsole();
			const { fake } = yield* run((bridge, _streams, index) => {
				bridge.writer.log(`out line ${index}`);
				bridge.writer.error(`err line ${index}`);
				if (index === 5) bridge.writer.clear();
			}, ambient.console);
			assert.deepStrictEqual(ambient.calls, [], "clear does not reach the ambient console either");
			assert.notInclude(fake.stdout(), `${String.fromCharCode(0x1b)}[2J`);
			assert.deepStrictEqual(screenAfter(fake.stdout()), [...LOGS, ...FINAL]);
		}),
	);

	it.live("an Error is written with its stack, as a console writes it, not as JSON", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams();
			const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
			bridge.writer.error("failed:", new Error("boom"));
			const written = fake.stderr();
			assert.match(written, /^failed: Error: boom\n\s+at /);
			assert.notInclude(written, '"message"');
		}),
	);

	it.live("with no bridge mounted at all, stdout and stderr lines reach their own streams", () =>
		Effect.gen(function* () {
			const fake = makeFakeStreams();
			const bridge = yield* makeInkConsole.pipe(Effect.provideService(UiStreams, fake.streams));
			bridge.writer.log("to stdout", { n: 1 });
			bridge.writer.error("to stderr");
			assert.strictEqual(fake.stdout(), 'to stdout {"n":1}\n');
			assert.strictEqual(fake.stderr(), "to stderr\n");
		}),
	);
});
