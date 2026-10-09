import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import type { Document, RenderContext, StreamTheme } from "../../../effected/cli/index.ts";
import { Doc, Render, Status } from "../../../effected/cli/index.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import { DocView, useTerminalSize, useTheme } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import { Audience, CurrentRuntimeEnv } from "../../../effected/env/index.ts";
import type { Ev, State } from "../helpers/live.ts";
import { End, Start, liveOn, optionsOf, reduce, tick } from "../helpers/live.ts";
import { commandLines } from "../helpers/runnerCommands.ts";

const ESC = String.fromCharCode(0x1b);

/** A document with every kind the brief names: a table, counts, a tree, a diff, a code block; and the edge cases. */
const sample: Document = [
	Doc.heading(2, "Results"),
	Doc.table(
		[{ header: "name" }, { header: "n" }],
		[
			["alpha", "1"],
			["beta", "22"],
		],
	),
	Doc.counts({
		layout: "columns",
		counters: [
			Doc.counter(Status.core, "success", { key: "p", label: "passed", n: 3 }),
			Doc.counter(Status.core, "failure", { key: "f", label: "failed", n: 1 }),
		],
	}),
	Doc.tree({ label: "root", children: [{ label: "a" }, { label: "b", children: [{ label: "c" }] }] }),
	Doc.diff("expected line", "received line"),
	Doc.codeBlock("let x = 1"),
	Doc.collapsible("Details", [Doc.paragraph("inside the collapsible")]),
	Doc.annotation({ level: "warning" }, "an annotation, never drawn"),
	Doc.paragraph("see ", Doc.link({ url: "https://example.test/docs" }, "the docs")),
	// A paragraph long enough to wrap at the width, and a section, whose blank lines must stay rows.
	Doc.paragraph(
		"a paragraph long enough that the kit's renderer wraps it at the width the view lays it out at, and no wider",
	),
	Doc.section("Summary", [Doc.paragraph("first"), Doc.paragraph("second")]),
];

const trimmed = (text: string): string =>
	text
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n+$/, "");

/** The context `DocView` should build from a screen's theme, written out from the public `RenderContext` shape. */
const contextFrom = (theme: StreamTheme, width: number): RenderContext => ({
	width,
	audience: "human",
	color: theme.color,
	paint: theme.paint,
	glyphs: theme.glyphs,
	link: (_target, label) => label,
	displayPath: (absolute) => absolute,
});

describe("DocView", () => {
	it.effect("at colour none, its frame is Render.plain of the same document at the same width, byte for byte", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(DocView, { doc: sample }), {
				columns: 60,
				rows: 60,
				color: "none",
			});
			const expected = Render.plain(sample, Render.contextOf({ audience: "human", width: 59 }));
			assert.strictEqual(trimmed(yield* handle.plainFrame), trimmed(expected));
			const plain = yield* handle.plainFrame;
			assert.include(plain, "inside the collapsible", "a collapsible is drawn open");
			assert.notInclude(plain, "an annotation", "an annotation is skipped");
		}),
	);

	it.effect("in colour, its token markers are exactly Render.ansi's with the screen's own theme paint", () =>
		Effect.gen(function* () {
			let seen: { readonly theme: StreamTheme; readonly columns: number } | undefined;
			const Probe = (): ReactElement => {
				seen = { theme: useTheme(), columns: useTerminalSize().columns };
				return createElement(DocView, { doc: sample });
			};
			const handle = yield* CliUiTest.render(() => createElement(Probe), { columns: 60, rows: 60 });
			const frame = yield* handle.frame;
			assert.isDefined(seen);
			const expected = CliUiTest.styled(
				Render.ansi(sample, contextFrom(seen.theme, seen?.columns ?? 0)),
			);
			assert.strictEqual(trimmed(frame), trimmed(expected));
			assert.include(frame, "[success]", "control: the marker palette painted a token");
			assert.notInclude(yield* handle.rawFrame, `${ESC}]8;`, "links are off by default: no OSC 8");
		}),
	);

	it.effect("a ctx prop replaces the built context entirely: it lays out at the ctx's width", () =>
		Effect.gen(function* () {
			const ctx = Render.contextOf({ audience: "human", width: 24 });
			const doc = [Doc.paragraph("a paragraph long enough to wrap at twenty-four columns and no wider")];
			const handle = yield* CliUiTest.render(() => createElement(DocView, { doc, ctx }), {
				columns: 80,
				color: "none",
			});
			assert.strictEqual(trimmed(yield* handle.plainFrame), trimmed(Render.plain(doc, ctx)));
		}),
	);

	it.effect("a row wider than the terminal is cut to one line, never re-wrapped by Ink", () =>
		Effect.gen(function* () {
			const ctx = Render.contextOf({ audience: "human", width: 120 });
			const doc = [Doc.lines([[Doc.text("x".repeat(100))], [Doc.text("next row")]])];
			const handle = yield* CliUiTest.render(() => createElement(DocView, { doc, ctx }), {
				columns: 40,
				color: "none",
			});
			const rows = trimmed(yield* handle.plainFrame).split("\n");
			assert.strictEqual(rows.length, 2, rows.join("|"));
			assert.strictEqual(rows[1], "next row");
		}),
	);

	it.effect("one block on its own is drawn as a one-block document", () =>
		Effect.gen(function* () {
			const block = Doc.codeBlock("just one block");
			const handle = yield* CliUiTest.render(() => createElement(DocView, { doc: block }), { color: "none" });
			assert.strictEqual(
				trimmed(yield* handle.plainFrame),
				trimmed(Render.plain([block], Render.contextOf({ audience: "human", width: 79 }))),
			);
		}),
	);

	it.effect("in a parent of fixed height that clips, it shows its first rows, never a squeezed sample", () =>
		Effect.gen(function* () {
			const doc = [Doc.lines(Array.from({ length: 40 }, (_, index) => [Doc.text(`row ${index}`)]))];
			const handle = yield* CliUiTest.render(
				() =>
					createElement(
						Box,
						{ height: 5, overflow: "hidden", flexDirection: "column" },
						createElement(DocView, { doc }),
					),
				{ color: "none" },
			);
			assert.strictEqual(trimmed(yield* handle.plainFrame), ["row 0", "row 1", "row 2", "row 3", "row 4"].join("\n"));
		}),
	);

	it.layer(Audience.layerTest("agent"), { timeout: "30 seconds" })((it) => {
		it.effect("for an agent the screen's theme is colourless, so the frame carries no escape", () =>
			Effect.gen(function* () {
				const handle = yield* CliUiTest.render(() => createElement(DocView, { doc: sample }), {
					columns: 60,
					rows: 60,
				});
				assert.notInclude(yield* handle.rawFrame, `${ESC}[3`, "no colour escape");
				assert.include(yield* handle.plainFrame, "alpha");
			}),
		);
	});

	it.effect("the layout runs once per document and width: a re-render with the same document does not repeat it", () =>
		Effect.gen(function* () {
			const spy = vi.spyOn(Render, "plain");
			try {
				const handle = yield* CliUiTest.render(() => createElement(DocView, { doc: sample }), { color: "none" });
				const before = spy.mock.calls.length;
				yield* handle.rerender(() => createElement(DocView, { doc: sample }));
				yield* handle.resize(80, 30);
				assert.strictEqual(spy.mock.calls.length, before, "same document and width: not laid out again");
				yield* handle.resize(60, 30);
				assert.strictEqual(spy.mock.calls.length, before + 1, "a new width lays it out again");
			} finally {
				spy.mockRestore();
			}
		}),
	);
});

describe("DocView inside a live view (okf/decisions/live-height-clamp-not-width.md)", () => {
	const tallDoc = (state: State): Document => [
		Doc.heading(2, `run ${state.run}: ${state.last}`),
		Doc.lines(Array.from({ length: 200 }, (_, index) => [Doc.text(`row ${index}`)])),
	];
	const viewOf = (render: (state: State, frame: number) => ReactElement) => ({
		initial: { run: 0, last: "idle", seen: [] } satisfies State,
		reduce,
		render,
		isStart: (event: Ev) => event._tag === "Start",
		isTerminal: (event: Ev) => event._tag === "End",
	});

	it.effect("a document taller than the terminal stays clamped: no clear, at most rows - 1 lines", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({
				...viewOf((state) => createElement(DocView, { doc: tallDoc(state) })),
				columns: 40,
				rows: 10,
				color: "none",
			});
			yield* view.publish(Start);
			yield* view.publish(tick(1));
			yield* view.publish(End);
			assert.notInclude(yield* view.written, `${ESC}[3J`);
			assert.notInclude(yield* view.written, `${ESC}[2J`);
			assert.isAtMost((yield* view.transcript).split("\n").length, 9);
			assert.include(yield* view.transcript, "run 1: ended");
		}),
	);

	it.effect("a shrink from 60 to 40 columns re-lays the document out, and leaves one copy of it", () =>
		Effect.gen(function* () {
			const wide = (state: State): Document => [
				Doc.table(
					[{ header: "status" }, { header: "detail" }],
					[[state.last, "a detail long enough to fill the width of a sixty column terminal row"]],
				),
			];
			const view = yield* CliUiTest.live({
				...viewOf((state) => createElement(DocView, { doc: wide(state) })),
				columns: 60,
				rows: 20,
				color: "none",
			});
			yield* view.publish(Start);
			assert.isAbove(Math.max(...(yield* view.plainFrame).split("\n").map((line) => line.length)), 40);
			yield* view.resize(40, 20);
			yield* view.publish(tick(1));
			const lines = (yield* view.plainFrame).split("\n");
			assert.isTrue(
				lines.every((line) => line.length <= 40),
				lines.join("|"),
			);
			yield* view.publish(End);
			const shown = (yield* view.transcript).split("\n");
			assert.strictEqual(shown.filter((line) => line.includes("status")).length, 1, shown.join("\n"));
			assert.notInclude(yield* view.written, `${ESC}[3J`);
		}),
	);
});

describe("DocView and the live view under GitHub Actions: no workflow command from data", () => {
	const actions = CurrentRuntimeEnv.layerTest({ ci: O.some("github-actions") });
	const injected = [Doc.lines([[Doc.text("::error::injected from test data")], [Doc.text("a ##[warning]legacy one")]])];
	const printed = Effect.fn("printed")(function* (render: () => ReactElement) {
		const fake = makeFakeStreams({ columns: 80, rows: 20 });
		const handle = yield* liveOn(fake, optionsOf(Stream.fromIterable([Start, End]), { render }), { interactive: false });
		yield* handle.done.pipe(Effect.timeout("2 seconds"));
		return fake.stdout();
	});

	it.layer(actions, { timeout: "30 seconds" })((it) => {
		it.effect("an owned live view's printed DocView: the runner reads no command in it", () =>
			Effect.gen(function* () {
				const out = yield* printed(() => createElement(DocView, { doc: injected }));
				assert.include(out, "injected from test data", "control: the text is there");
				assert.deepStrictEqual(commandLines(out), []);
			}),
		);

		it.effect("an owned live view's printed raw Text: the printed string is neutralized too", () =>
			Effect.gen(function* () {
				const out = yield* printed(() => createElement(Text, null, "::error::from a raw Text"));
				assert.include(out, "from a raw Text");
				assert.deepStrictEqual(commandLines(out), []);
			}),
		);
	});

	it.effect("control: off Actions the same output is left alone, so the runner oracle does see the commands", () =>
		Effect.gen(function* () {
			const out = yield* printed(() => createElement(DocView, { doc: injected }));
			assert.deepStrictEqual(commandLines(out), ["::error::injected from test data", "a ##[warning]legacy one"]);
		}),
	);

	it.layer(actions, { timeout: "30 seconds" })((it) => {
		it.effect("a CliUi.run screen's DocView under Actions: its frame carries no command either", () =>
			Effect.gen(function* () {
				const handle = yield* CliUiTest.render(() => createElement(DocView, { doc: injected }), { color: "none" });
				const frame = yield* handle.plainFrame;
				assert.include(frame, "injected from test data");
				assert.deepStrictEqual(commandLines(frame), []);
			}),
		);
	});
});
