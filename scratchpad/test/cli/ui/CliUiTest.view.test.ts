import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Schema } from "effect";
import { Text, useInput } from "ink";
import type { ReactElement } from "react";
import { createElement, useState } from "react";
import { NotInteractive } from "../../../effected/cli/index.ts";
import { Styled, useGlyphs, useTerminalSize, useTheme } from "../../../effected/cli/ui.ts";
import type { CliUiTestView } from "../../../effected/cli/ui-testing.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

/** A display-only element: it never resolves a screen, and draws through the kit's theme hooks. */
const Status = (props: { readonly label: string }): ReactElement => {
	const glyphs = useGlyphs();
	return createElement(Styled, { token: "success" }, `${glyphs.kind} ${props.label}`);
};

describe("CliUiTest.view: a display-only element (A10)", () => {
	it.effect("mounts an element with the kit's providers, so Styled and the theme hooks work inside it", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.view(createElement(Status, { label: "ok" }), { glyphs: "ascii" });
			assert.strictEqual((yield* view.frame).trim(), "[success]ascii ok[/success]");
		}).pipe(Effect.scoped),
	);

	it.effect("the marker theme, colour and size options apply as for render", () =>
		Effect.gen(function* () {
			const Probe = (): ReactElement => {
				const theme = useTheme();
				const { columns } = useTerminalSize();
				return createElement(Text, null, `${theme.color} ${columns}`);
			};
			const view = yield* CliUiTest.view(createElement(Probe), { color: "256", columns: 40 });
			assert.strictEqual((yield* view.plainFrame).trim(), "256 39");
			yield* view.resize(60, 20);
			assert.strictEqual((yield* view.plainFrame).trim(), "256 59");
		}).pipe(Effect.scoped),
	);

	it.effect("rerender swaps the element, keeping every frame", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.view(createElement(Status, { label: "running" }));
			yield* view.rerender(createElement(Status, { label: "done" }));
			assert.include(yield* view.plainFrame, "done");
			const frames = yield* view.frames;
			assert.isTrue(frames.some((frame) => frame.includes("running")));
			assert.isTrue(frames.at(-1)?.includes("done"));
		}).pipe(Effect.scoped),
	);

	it.effect("press and type reach the element's own input handler", () =>
		Effect.gen(function* () {
			const Echo = (): ReactElement => {
				const [seen, setSeen] = useState("");
				useInput((input, key) => setSeen((previous) => previous + (key.downArrow ? "v" : input)));
				return createElement(Text, null, `seen:${seen}`);
			};
			const view = yield* CliUiTest.view(createElement(Echo));
			yield* view.type("ab");
			yield* view.press("down");
			yield* view.chunk({ char: "c" });
			assert.strictEqual((yield* view.plainFrame).trim(), "seen:abvc");
		}).pipe(Effect.scoped),
	);

	it.effect("closing the scope unmounts it, so the next view mounts", () =>
		Effect.gen(function* () {
			yield* Effect.scoped(CliUiTest.view(createElement(Status, { label: "first" })));
			const second = yield* Effect.scoped(
				Effect.flatMap(CliUiTest.view(createElement(Status, { label: "second" })), (view) => view.plainFrame),
			);
			assert.include(second, "second");
		}),
	);

	it("the handle has no result: a display-only element never ends on its own (type-level)", () => {
		const hasResult: "result" extends keyof CliUiTestView ? true : false = false;
		const hasRerender: "rerender" extends keyof CliUiTestView ? true : false = true;
		assert.isFalse(hasResult);
		assert.isTrue(hasRerender);
	});
});

describe("CliUiTest.view surfaces an element that crashes or is refused", () => {
	const messageOf = (exit: Exit.Exit<unknown, unknown>): string => {
		if (Exit.isSuccess(exit)) return "<succeeded>";
		const error = Cause.squash(exit.cause);
		return error instanceof Error ? error.message : String(error);
	};
	const Boom = (): ReactElement => {
		throw new Error("element crashed");
	};

	it.live("a throwing element: view dies with the thrown message, within 2 s", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(Effect.scoped(CliUiTest.view(createElement(Boom)))).pipe(
				Effect.timeout("2 seconds"),
			);
			assert.include(messageOf(exit), "element crashed");
		}),
	);

	it.live("an element that crashes after its first frame: the next read dies with its error, not SCREEN_ENDED", () =>
		Effect.gen(function* () {
			const Later = (props: { readonly crash: boolean }): ReactElement => {
				if (props.crash) throw new Error("crashed on rerender");
				return createElement(Text, null, "fine");
			};
			const view = yield* CliUiTest.view(createElement(Later, { crash: false }));
			assert.include(yield* view.plainFrame, "fine", "control: it drew first");
			const swapped = yield* Effect.exit(view.rerender(createElement(Later, { crash: true })));
			const read = yield* Effect.exit(view.frame);
			const pressed = yield* Effect.exit(view.press("enter"));
			for (const exit of [read, pressed]) {
				assert.include(messageOf(exit), "crashed on rerender");
				assert.notInclude(messageOf(exit), "session.next");
			}
			assert.notInclude(messageOf(swapped), "session.next");
		}).pipe(Effect.scoped),
	);

	it.live("interactive: false: view dies with NotInteractive's message", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(
				Effect.scoped(CliUiTest.view(createElement(Text, null, "x"), { interactive: false })),
			);
			assert.isTrue(Exit.isFailure(exit), "control: it did not succeed");
			assert.notInclude(messageOf(exit), "<succeeded>");
			assert.isTrue(Exit.isFailure(exit) && Schema.is(NotInteractive)(Cause.squash(exit.cause)), messageOf(exit));
		}),
	);
});

describe("CliUiTest.view after a deliberate end", () => {
	for (const key of ["escape", "ctrl+c"] as const) {
		it.live(`${key}: the frames stay readable, and a key after the end dies with the ended message`, () =>
			Effect.gen(function* () {
				const view = yield* CliUiTest.view(createElement(Status, { label: "done" }));
				yield* view.press(key);
				assert.include(yield* view.plainFrame, "done");
				assert.isNotEmpty(yield* view.frames);
				const pressed = yield* Effect.exit(view.press("enter"));
				assert.isTrue(Exit.isFailure(pressed));
				const message = Exit.isFailure(pressed) ? String(Cause.squash(pressed.cause)) : "";
				assert.include(message, "has ended");
				assert.notInclude(message, "cancelled");
			}).pipe(Effect.scoped),
		);
	}
});
