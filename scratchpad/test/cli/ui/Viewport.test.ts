// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it, vi } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, Schedule, Schema } from "effect";
import { Text } from "ink";
import type { ReactElement } from "react";
import { createElement, useState } from "react";
import { CliInteractive, CliTheme, Fmt } from "../../../effected/cli/index.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { Screen, ViewportRow, ViewportState } from "../../../effected/cli/ui.ts";
import { CliUi, KeyHelp, UiStreams, Viewport, useKeys } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const ESC = String.fromCharCode(0x1b);
const CLEAR_SCROLLBACK = `${ESC}[3J`;

type Move = "up" | "down" | "home" | "end" | "pageup" | "pagedown";
const MOVES: ReadonlyArray<Move> = ["up", "down", "home", "end", "pageup", "pagedown"];

/** The reducer's invariants: the cursor is an item and is in view, and the window never runs past the end. */
const holds = (state: ViewportState): boolean => {
	if (state.count === 0) return state.cursor === 0 && state.offset === 0;
	return (
		state.cursor >= 0 &&
		state.cursor < state.count &&
		state.offset <= state.cursor &&
		state.cursor < state.offset + state.height &&
		state.offset >= 0 &&
		state.offset <= Math.max(0, state.count - state.height)
	);
};

const Count = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 300 }));
const Height = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 40 }));
const Moves = Schema.Array(Schema.Literals(MOVES));

describe("Viewport reducer", () => {
	it.prop(
		"every step keeps the cursor an item, in view, with the window inside the list",
		{ count: Count, height: Height, start: Count, moves: Moves },
		({ count, height, start, moves }) => {
			let state = Viewport.init(count, height, start);
			if (!holds(state)) return false;
			for (const move of moves) {
				state = Viewport.step(state, move);
				if (!holds(state)) return false;
			}
			return true;
		},
		{ arbitrary: { runs: 400, size: 300 } },
	);

	it.prop(
		"resize keeps the cursor in view at the new height",
		{ count: Count, height: Height, next: Height, moves: Moves },
		({ count, height, next, moves }) => {
			const moved = moves.reduce((state, move) => Viewport.step(state, move), Viewport.init(count, height));
			const resized = Viewport.resize(moved, next);
			return holds(resized) && resized.cursor === moved.cursor && resized.height === next;
		},
		{ arbitrary: { runs: 400, size: 300 } },
	);

	it("never moves past either end", () => {
		const top = Viewport.init(10, 4);
		assert.strictEqual(Viewport.step(top, "up").cursor, 0);
		assert.strictEqual(Viewport.step(top, "pageup").cursor, 0);
		const bottom = Viewport.step(top, "end");
		assert.strictEqual(bottom.cursor, 9);
		assert.strictEqual(Viewport.step(bottom, "down").cursor, 9, "no wrap to the top");
		assert.strictEqual(Viewport.step(bottom, "pagedown").cursor, 9);
		assert.strictEqual(Viewport.step(bottom, "home").cursor, 0);
		assert.strictEqual(Viewport.step(top, "pagedown").cursor, 4, "a page is the height");
	});

	it("binds every move, and its help reads ↑/↓ move", () => {
		for (const move of MOVES) assert.isTrue(Viewport.keys.match({ _tag: "Named", name: move })._tag === "Some", move);
	});
});

const items = (count: number, prefix = "item", width = 0): ReadonlyArray<ViewportRow> =>
	Array.from({ length: count }, (_, index) => ({
		_tag: "Item" as const,
		key: `${prefix}${index}`.padEnd(width, "-"),
	}));

const renderRow = (row: ViewportRow, highlighted: boolean): ReactElement =>
	createElement(Text, null, row._tag === "Header" ? `# ${row.label}` : `${highlighted ? ">" : " "} ${row.key}`);

/** A screen scrolling `rows` with the viewport's own keys, at `height` lines unless the terminal is smaller. */
const scrolling =
	(rows: ReadonlyArray<ViewportRow>, height: number, reserved = 0): Screen<never> =>
	() => {
		const count = rows.filter((row) => row._tag === "Item").length;
		const Scroller = (): ReactElement => {
			const [state, setState] = useState(() => Viewport.init(count, height));
			useKeys(Viewport.keys, (move) => setState((current) => Viewport.step(current, move)));
			return createElement(Viewport.View, { rows, state, renderRow, reserved });
		};
		return createElement(Scroller);
	};

const lineCount = (frame: string): number =>
	frame.split("\n").filter((line, index, all) => !(index === all.length - 1 && line === "")).length;

describe("Viewport.View under CliUiTest", () => {
	it.effect("re-emits a section header scrolled off the top", () =>
		Effect.gen(function* () {
			const rows: ReadonlyArray<ViewportRow> = [
				{ _tag: "Header", label: "A" },
				...items(10, "a"),
				{ _tag: "Header", label: "B" },
				...items(20, "b"),
			];
			const handle = yield* CliUiTest.render(scrolling(rows, 6));
			assert.strictEqual((yield* handle.plainFrame).split("\n")[0], "# A");
			yield* handle.press("pagedown", "pagedown", "pagedown");
			const lines = (yield* handle.plainFrame).split("\n");
			assert.strictEqual(lines[0], "# B", "the header of the first visible item is shown first");
			assert.isTrue(
				lines.some((line) => line.startsWith(">")),
				"the cursor row is visible",
			);
		}).pipe(Effect.scoped),
	);

	it.effect("in a sectioned list, moving up inside the window moves the highlight, not the window", () =>
		Effect.gen(function* () {
			const rows: ReadonlyArray<ViewportRow> = [
				{ _tag: "Header", label: "A" },
				...items(5, "a"),
				{ _tag: "Header", label: "B" },
				...items(5, "b"),
				{ _tag: "Header", label: "C" },
				...items(5, "c"),
			];
			const handle = yield* CliUiTest.render(scrolling(rows, 4));
			yield* handle.press("end");
			const unmarked = (frame: string): ReadonlyArray<string> =>
				frame.split("\n").map((line) => line.replace(/^>/, " "));
			const atBottom = yield* handle.plainFrame;
			yield* handle.press("up");
			const afterUp = yield* handle.plainFrame;
			assert.deepStrictEqual(unmarked(afterUp), unmarked(atBottom), "the window did not move");
			assert.notStrictEqual(afterUp, atBottom, "the highlight did");
			assert.include(afterUp, "> c3");
			yield* handle.press("up");
			assert.include(yield* handle.plainFrame, "> c2", "the cursor reaches the top row of the window");
			assert.deepStrictEqual(unmarked(yield* handle.plainFrame), unmarked(atBottom), "and the window still holds");
			yield* handle.press("up");
			assert.include(yield* handle.plainFrame, "> c1", "leaving the top of the window scrolls it by one");
			assert.notDeepEqual(unmarked(yield* handle.plainFrame), unmarked(atBottom));
		}).pipe(Effect.scoped),
	);

	it.effect("at the end of the list, a taller terminal pulls the window back so it fills the new height", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(scrolling(items(200), 50), { rows: 10 });
			yield* handle.press("end");
			assert.strictEqual(lineCount(yield* handle.plainFrame), 9);
			yield* handle.resize(80, 20);
			const lines = (yield* handle.plainFrame).split("\n").filter((line) => line !== "");
			assert.lengthOf(lines, 19, "the grown window is full");
			assert.strictEqual(lines.at(-1), "> item199", "still ending on the selected last item");
			assert.strictEqual(lines[0], "  item181");
		}).pipe(Effect.scoped),
	);

	it.effect("highlights the last item when the state's cursor runs past the rows", () =>
		Effect.gen(function* () {
			const rows = items(3);
			const Mismatched = (): ReactElement =>
				createElement(Viewport.View, { rows, state: Viewport.init(10, 5, 9), renderRow });
			const handle = yield* CliUiTest.render(() => createElement(Mismatched));
			assert.include(yield* handle.plainFrame, "> item2");
		}).pipe(Effect.scoped),
	);

	it.live("a repeated item key dies with the reason, before React can warn on the real stderr", () =>
		Effect.acquireUseRelease(
			Effect.sync(() => vi.spyOn(console, "error").mockImplementation(() => undefined)),
			(spy) =>
				Effect.gen(function* () {
					const rows: ReadonlyArray<ViewportRow> = [
						{ _tag: "Item", key: "same" },
						{ _tag: "Item", key: "other" },
						{ _tag: "Item", key: "same" },
					];
					const handle = yield* CliUiTest.render(() =>
						createElement(Viewport.View, { rows, state: Viewport.init(3, 5), renderRow }),
					);
					const exit = yield* Effect.exit(handle.result.pipe(Effect.timeout("1 second")));
					const warned = spy.mock.calls.map((call) => String(call[0])).join(" | ");
					assert.strictEqual(spy.mock.calls.length, 0, `nothing reaches console.error: ${warned}`);
					if (Exit.isFailure(exit)) {
						const defect = Cause.squash(exit.cause);
						assert.include(defect instanceof Error ? defect.message : String(defect), "unique");
						assert.include(defect instanceof Error ? defect.message : String(defect), '"same"');
					} else {
						assert.fail("expected a defect, but the viewport resolved");
					}
				}).pipe(Effect.scoped),
			(spy) => Effect.sync(() => spy.mockRestore()),
		),
	);

	it.effect("on a 10-row terminal, a 200-row viewport never draws a frame taller than 9 lines", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(scrolling(items(200), 50), { rows: 10 });
			yield* handle.press("down", "pagedown", "pagedown", "end", "up", "home");
			const frames = yield* handle.frames;
			assert.isAbove(frames.length, 3);
			for (const frame of frames) assert.isAtMost(lineCount(frame), 9, frame);
			assert.notInclude(yield* handle.rawFrame, CLEAR_SCROLLBACK);
			assert.include(yield* handle.plainFrame, "item0", "home brings the first row back");
		}).pipe(Effect.scoped),
	);

	it.effect("reserved lines come off the height", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(scrolling(items(200), 50, 3), { rows: 10 });
			assert.strictEqual(lineCount(yield* handle.plainFrame), 6);
		}).pipe(Effect.scoped),
	);

	it.effect("on a 20-column terminal no line is wider than 19 cells", () =>
		Effect.gen(function* () {
			// At colour none the styled frames carry no markup, so each line is measured exactly as drawn.
			const handle = yield* CliUiTest.render(scrolling(items(30, "a-very-long-row-name-", 60), 5), {
				columns: 20,
				rows: 10,
				color: "none",
			});
			yield* handle.press("down", "pagedown");
			assert.include(yield* handle.plainFrame, "a-very", "the long rows were drawn");
			assert.strictEqual(lineCount(yield* handle.plainFrame), 5, "each long row is clipped to one line, not wrapped");
			for (const frame of yield* handle.frames) {
				assert.notInclude(frame, "[", "no markup at colour none, so the width is the drawn width");
				for (const line of frame.split("\n")) assert.isAtMost(Fmt.width(line), 19, line);
			}
			for (const line of (yield* handle.plainFrame).split("\n")) assert.isAtMost(Fmt.width(line), 19, line);
		}).pipe(Effect.scoped),
	);

	it.effect(
		"on a 20-column terminal the KeyHelp line is cut to 19 cells, cutting the widget keys and keeping esc cancel",
		() =>
			Effect.gen(function* () {
				const unicode = yield* Effect.scoped(
					Effect.flatMap(
						CliUiTest.render(() => createElement(KeyHelp, { tables: [Viewport.keys] }), { columns: 20 }),
						(handle) => handle.plainFrame,
					),
				);
				assert.lengthOf(unicode.trimEnd().split("\n"), 1, "one line, not wrapped");
				assert.isAtMost(Fmt.width(unicode.trimEnd()), 19);
				assert.include(unicode, "…", "the widget keys were cut");
				assert.isTrue(unicode.trimEnd().endsWith(" · esc cancel"), `the root hint stays whole at the end: ${unicode}`);
				const ascii = yield* Effect.scoped(
					Effect.flatMap(
						CliUiTest.render(() => createElement(KeyHelp, { tables: [Viewport.keys] }), {
							columns: 20,
							glyphs: "ascii",
						}),
						(handle) => handle.plainFrame,
					),
				);
				assert.include(ascii, "...", "the widget keys were cut");
				assert.isTrue(ascii.trimEnd().endsWith(" | esc cancel"), ascii);
				assert.isAtMost(Fmt.width(ascii.trimEnd()), 19);
			}),
	);

	it.effect(
		"KeyHelp drops a widget part that would get fewer than 4 cells, and the separator when only the hint fits",
		() =>
			Effect.gen(function* () {
				for (const glyphs of ["unicode", "ascii"] as const) {
					const at = (columns: number) =>
						Effect.scoped(
							Effect.flatMap(
								CliUiTest.render(() => createElement(KeyHelp, { tables: [Viewport.keys] }), { columns, glyphs }),
								(handle) => handle.plainFrame,
							),
						);
					// 14 usable cells: " · esc cancel" takes 13, leaving 1 for the widget's keys, too few to say anything.
					assert.strictEqual((yield* at(15)).trim(), "esc cancel", `${glyphs}: the widget part is dropped`);
					// 11 usable cells: the separator no longer fits, the hint alone does.
					assert.strictEqual((yield* at(12)).trim(), "esc cancel", `${glyphs}: just the hint`);
					// 18 usable cells: 5 for the widget's keys, enough to keep.
					const kept = (yield* at(19)).trim();
					assert.isTrue(kept.endsWith("esc cancel") && kept.length > "esc cancel".length + 3, `${glyphs}: ${kept}`);
					assert.isAtMost(Fmt.width(kept), 18);
				}
			}),
	);

	it.effect("KeyHelp for the viewport's keys reads ↑/↓ move", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(KeyHelp, { tables: [Viewport.keys] }));
			assert.include(yield* handle.plainFrame, "↑/↓ move");
		}).pipe(Effect.scoped),
	);
});

/** Run `screen` on the production render path: fake TTY streams, interactive, Ink's ordinary (non-debug) output. */
const production = Effect.fn("production")(function* (screen: Screen<never>, keys: ReadonlyArray<string>) {
		const fake = makeFakeStreams({ columns: 40, rows: 10 });
		const fiber = yield* Effect.forkChild(
			CliUi.run(screen).pipe(
				Effect.provideService(UiStreams, fake.streams),
				Effect.provideService(CliInteractive, true),
				Effect.provide(CliTheme.layerTest()),
			),
		);
		yield* Effect.suspend(() => (fake.rawModes.includes(true) ? Effect.void : Effect.fail("not yet"))).pipe(
			Effect.retry(Schedule.spaced("5 millis")),
			Effect.timeout("2 seconds"),
			Effect.orDie,
		);
		for (const key of keys) {
			fake.input(key);
			yield* Effect.sleep("40 millis");
		}
		yield* Fiber.interrupt(fiber);
		return fake.stdout();
	});

describe("the production render path (Ink's own output, not debug frames)", () => {
	it.live("control: an unclamped 200-line Text on a 10-row terminal does clear the scrollback", () =>
		Effect.gen(function* () {
			const tall = Array.from({ length: 200 }, (_, index) => `line ${index}`).join("\n");
			const stdout = yield* production(() => createElement(Text, null, tall), []);
			assert.include(stdout, CLEAR_SCROLLBACK);
		}),
	);

	it.live("a 200-row viewport on a 10-row terminal never clears the scrollback, through scrolling and unmount", () =>
		Effect.gen(function* () {
			const stdout = yield* production(scrolling(items(200), 50), ["\u001b[B", "\u001b[6~", "\u001b[6~", "\u001b[F"]);
			assert.include(stdout, "item", "the viewport drew");
			assert.notInclude(stdout, CLEAR_SCROLLBACK);
			assert.notInclude(stdout, `${ESC}[2J`);
		}),
	);
});
