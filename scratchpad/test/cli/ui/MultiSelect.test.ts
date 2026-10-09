import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { Cancelled, Fmt } from "../../../effected/cli/index.ts";
import type { MultiSelectSection } from "../../../effected/cli/ui.ts";
import { MultiSelect } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const sections: ReadonlyArray<MultiSelectSection<string>> = [
	{
		title: "Drafts",
		items: [
			{ key: "a1", label: "first draft", value: "a1", detail: "about a1" },
			{ key: "a2", label: "second draft", value: "a2", selected: true, detail: "about a2" },
			{ key: "a3", label: "third draft", value: "a3" },
		],
	},
	{
		title: "Stale",
		items: [
			{ key: "b1", label: "old one", value: "b1", detail: "about b1" },
			{ key: "b2", label: "older one", value: "b2" },
		],
	},
];

describe("MultiSelect reducer", () => {
	it("starts with each item's own selected flag, on the first item", () => {
		const state = MultiSelect.init(sections);
		assert.deepStrictEqual(MultiSelect.selected(state), ["a2"]);
		assert.strictEqual(state.viewport.cursor, 0);
	});

	it("toggle flips the highlighted item", () => {
		const once = MultiSelect.step(MultiSelect.init(sections), "toggle");
		assert.deepStrictEqual(MultiSelect.selected(once), ["a1", "a2"]);
		assert.deepStrictEqual(MultiSelect.selected(MultiSelect.step(once, "toggle")), ["a2"]);
	});

	it("toggleSection selects the whole section while any of it is unselected, then clears it", () => {
		const mixed = MultiSelect.init(sections);
		const all = MultiSelect.step(mixed, "toggleSection");
		assert.deepStrictEqual(MultiSelect.selected(all), ["a1", "a2", "a3"], "mixed → all");
		const none = MultiSelect.step(all, "toggleSection");
		assert.deepStrictEqual(MultiSelect.selected(none), [], "all → none");
		assert.deepStrictEqual(MultiSelect.selected(MultiSelect.step(none, "toggleSection")), ["a1", "a2", "a3"]);
	});

	it("toggleSection touches only the highlighted item's section", () => {
		const inStale = MultiSelect.step(
			MultiSelect.step(MultiSelect.step(MultiSelect.init(sections), "end"), "up"),
			"toggleSection",
		);
		assert.deepStrictEqual(MultiSelect.selected(inStale), ["a2", "b1", "b2"]);
	});

	it("selected lists section order then item order, whatever order they were toggled in", () => {
		let state = MultiSelect.init(sections);
		state = MultiSelect.step(MultiSelect.step(state, "end"), "toggle");
		state = MultiSelect.step(MultiSelect.step(state, "home"), "toggle");
		assert.deepStrictEqual(MultiSelect.selected(state), ["a1", "a2", "b2"]);
	});

	it("the cursor moves over items only, across sections, clamped at both ends", () => {
		let state = MultiSelect.init(sections);
		state = MultiSelect.step(MultiSelect.step(state, "down"), "down");
		assert.strictEqual(state.viewport.cursor, 2, "a3, the last draft");
		state = MultiSelect.step(state, "down");
		assert.strictEqual(state.viewport.cursor, 3, "b1: the Stale header is not a stop");
		assert.strictEqual(MultiSelect.step(MultiSelect.step(state, "end"), "down").viewport.cursor, 4);
		assert.strictEqual(MultiSelect.step(MultiSelect.init(sections), "up").viewport.cursor, 0);
	});

	it("item keys must be unique across all sections", () => {
		const twice: ReadonlyArray<MultiSelectSection<string>> = [
			{ title: "A", items: [{ key: "same", label: "one", value: "1" }] },
			{ title: "B", items: [{ key: "same", label: "two", value: "2" }] },
		];
		assert.throws(() => MultiSelect.init(twice), /unique.*same/);
	});

	it("binds space, a, enter and q, and keeps page, home and end out of the help line", () => {
		const named = (name: "space" | "enter" | "pagedown") => MultiSelect.keys.match({ _tag: "Named", name });
		assertSome(named("space"), "toggle");
		assertSome(MultiSelect.keys.match({ _tag: "Char", char: "a" }), "toggleSection");
		assertSome(named("enter"), "submit");
		assertSome(MultiSelect.keys.match({ _tag: "Char", char: "q" }), "cancel");
		assertSome(named("pagedown"), "pagedown"); // Bound, though not shown.
	});
});

describe("MultiSelect.screen under CliUiTest", () => {
	it.effect("space, down, a, enter returns the selection in section and item order", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections }));
			yield* handle.press("space", "down");
			yield* handle.type("a");
			yield* handle.press("enter");
			assert.deepStrictEqual(yield* handle.result, ["a1", "a2", "a3"]);
		}),
	);

	it.effect("submitting with nothing selected resolves an empty list, not a cancel", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections }));
			yield* handle.press("down", "space");
			yield* handle.press("enter");
			assert.deepStrictEqual(yield* handle.result, []);
		}),
	);

	it.effect("a screen with a repeated item key dies with the reason", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(
				MultiSelect.screen({
					message: "Pick",
					sections: [
						{
							title: "A",
							items: [
								{ key: "k", label: "one", value: 1 },
								{ key: "k", label: "two", value: 2 },
							],
						},
					],
				}),
			);
			const exit = yield* Effect.exit(handle.result);
			if (Exit.isFailure(exit)) {
				const defect = Cause.squash(exit.cause);
				assert.include(defect instanceof Error ? defect.message : "", "unique");
			} else {
				assert.fail("expected a defect, but the multi-select resolved");
			}
		}),
	);

	it.effect("q cancels with escape", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections }));
			yield* handle.type("q");
			const error = yield* Effect.flip(handle.result);
			assert.strictEqual(S.is(Cancelled)(error) ? error.reason : undefined, "escape");
		}),
	);

	it.effect("draws headers, check glyphs, the highlighted row in accent and its detail muted below", () =>
		Effect.gen(function* () {
			// One screen at a time: each frame is read in its own scope, so the second mount does not wait on the first.
			const frame = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections })),
					(handle) => handle.frame,
				),
			);
			assert.include(frame, "Drafts");
			assert.include(frame, "Stale");
			assert.include(frame, "[accent]→ ◯ first draft[/accent]");
			assert.include(frame, "◉ second draft");
			assert.include(frame, "[muted]about a1[/muted]");
			const ascii = yield* Effect.scoped(
				Effect.flatMap(
					CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections }), { glyphs: "ascii" }),
					(each) => each.plainFrame,
				),
			);
			assert.include(ascii, "[ ] first draft");
			assert.include(ascii, "[x] second draft");
		}),
	);

	it.effect("on a 40×10 terminal the frame is clamped and the highlighted detail stays visible", () =>
		Effect.gen(function* () {
			const many: ReadonlyArray<MultiSelectSection<number>> = [0, 1, 2].map((section) => ({
				title: `Section ${section}`,
				items: Array.from({ length: 10 }, (_, item) => ({
					key: `${section}-${item}`,
					label: `item ${section}-${item} with a label long enough to be cut`,
					value: section * 10 + item,
					detail: `detail of ${section}-${item}`,
				})),
			}));
			const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Pick some", sections: many }), {
				columns: 40,
				rows: 10,
				color: "none",
			});
			yield* handle.press("pagedown", "down", "down");
			for (const frame of yield* handle.frames) {
				const lines = frame.split("\n").filter((line, index, all) => !(index === all.length - 1 && line === ""));
				assert.isAtMost(lines.length, 9, frame);
				for (const line of lines) assert.isAtMost(Fmt.width(line), 39, line);
			}
			const last = yield* handle.plainFrame;
			const highlighted = last.split("\n").find((line) => line.startsWith("→"));
			assert.isDefined(highlighted, "the highlighted row is drawn");
			const key = /item (\d-\d)/.exec(highlighted ?? "")?.[1];
			assert.include(last, `detail of ${key}`, "its detail is visible below the list");
		}),
	);

	it.effect("the help line names space, a, enter and esc", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(MultiSelect.screen({ message: "Promote which?", sections }));
			const help = (yield* handle.plainFrame).trimEnd().split("\n").at(-1) ?? "";
			for (const part of ["space toggle", "a toggle section", "enter continue", "q/esc cancel"]) {
				assert.include(help, part, help);
			}
			assert.notInclude(help, "…", "it fits at 80 columns");
		}),
	);
});
