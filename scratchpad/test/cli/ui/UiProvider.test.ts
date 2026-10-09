// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { TerminalEnv } from "../../../effected/env/index.ts";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { Box, Text, render, renderToString } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { vi } from "vitest";
import { CliTheme } from "../../../effected/cli/CliTheme.ts";
import { withInkColour } from "../../../effected/cli/ui/internal/ink.ts";
import { useScreenCancel } from "../../../effected/cli/ui/internal/ScreenContext.ts";
import { makeFakeStreams } from "../../../effected/cli/ui/testing/fakeStreams.ts";
import type { UiContextValue } from "../../../effected/cli/ui.ts";
import {
	CliUi,
	KeyTable,
	Select,
	Styled,
	UiProvider,
	useGlyphs,
	useKeys,
	useTerminalSize,
	useTheme,
} from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

/** A truecolor terminal and a theme whose accent token is one unmistakable colour, with ASCII glyphs. */
const themeLayer = CliTheme.layer({ tokens: { accent: { fg: "#123456" } }, glyphs: "ascii" }).pipe(
	Layer.provide(
		TerminalEnv.layerTest({
			stdinIsTerminal: true,
			stdout: { isTerminal: true, color: "truecolor", hyperlinks: false, columns: Option.some(80) },
			stderr: { isTerminal: true, color: "truecolor", hyperlinks: false, columns: Option.some(80) },
		}),
	),
);

/** The SGR truecolor opener of `#123456`. */
const ACCENT = "\u001b[38;2;18;52;86m";

/** Mount `tree` with Ink's own `render` on fake streams, in debug mode, unmount it, and return stdout and the exit. */
const mountPlain = Effect.fn("mountPlain")(function* (tree: ReactNode, size: { readonly columns: number; readonly rows: number } = { columns: 80, rows: 24 }) {
		const fake = makeFakeStreams(size);
		const instance = render(tree, {
			stdin: fake.streams.stdin,
			stdout: fake.streams.stdout,
			stderr: fake.streams.stderr,
			debug: true,
			patchConsole: false,
			exitOnCtrlC: false,
			interactive: true,
		});
		instance.unmount();
		const exit = yield* Effect.exit(Effect.tryPromise(() => instance.waitUntilExit()));
		return { stdout: fake.stdout(), exit };
	});

const Probe = (): ReactElement => {
	const theme = useTheme();
	const glyphs = useGlyphs();
	return createElement(
		Box,
		{ flexDirection: "column" },
		createElement(Styled, { token: "accent" }, "marked"),
		createElement(Text, null, `glyphs=${glyphs.kind} color=${theme.color}`),
	);
};

const Size = (): ReactElement => {
	const { columns, rows } = useTerminalSize();
	return createElement(Text, null, `size=${columns}x${rows}`);
};

const provided = (value: UiContextValue, child: ReactElement): ReactElement =>
	createElement(UiProvider, { value }, child);

describe("UiProvider: the kit's hooks in a tree the kit did not mount", () => {
	it.effect("useTheme, useGlyphs and Styled render the theme's tokens under Ink's own render", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context;
			yield* withInkColour(value.theme.color);
			const { stdout, exit } = yield* mountPlain(provided(value, createElement(Probe)));
			assert.isTrue(Exit.isSuccess(exit), String(exit));
			assert.include(stdout, `${ACCENT}marked`);
			assert.include(stdout, "glyphs=ascii color=truecolor");
		}).pipe(Effect.scoped, Effect.provide(themeLayer)),
	);

	it.effect("control: without the provider the same component throws the outside-a-screen error", () =>
		Effect.acquireUseRelease(
			// The render error goes to Ink's own boundary and rejects waitUntilExit; nothing may reach console.error.
			Effect.sync(() => vi.spyOn(console, "error").mockImplementation(() => undefined)),
			(spy) =>
				Effect.gen(function* () {
					yield* CliUi.context;
					const { exit } = yield* mountPlain(createElement(Probe));
					assert.isTrue(Exit.isFailure(exit));
					assert.include(String(exit), "outside a screen");
					const reported = spy.mock.calls.map((call) => String(call[0])).join(" | ");
					assert.strictEqual(spy.mock.calls.length, 0, `nothing reaches console.error: ${reported}`);
				}),
			(spy) => Effect.sync(() => spy.mockRestore()),
		).pipe(Effect.provide(themeLayer)),
	);

	it.effect("useScreenCancel is a no-op under the provider, where there is no screen to cancel", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context;
			const Cancels = (): ReactElement => {
				useScreenCancel()("escape");
				return createElement(Text, null, "still here");
			};
			const { stdout, exit } = yield* mountPlain(provided(value, createElement(Cancels)));
			assert.isTrue(Exit.isSuccess(exit), String(exit));
			assert.include(stdout, "still here");
		}).pipe(Effect.provide(themeLayer)),
	);
});

describe("UiProvider's size override", () => {
	it.effect(
		"renderToString: useTerminalSize reads the override, not process.stdout, so it agrees with Ink's layout",
		() =>
			Effect.gen(function* () {
				const value = yield* CliUi.context;
				const out = renderToString(provided({ ...value, size: { columns: 30, rows: 8 } }, createElement(Size)), {
					columns: 30,
				});
				assert.strictEqual(out.trim(), "size=29x7");
			}).pipe(Effect.provide(themeLayer)),
	);

	it.effect("a live mount: the override wins over the stdout's size, and without it the stdout's is read", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context;
			const overridden = yield* mountPlain(provided({ ...value, size: { columns: 30, rows: 8 } }, createElement(Size)));
			assert.include(overridden.stdout, "size=29x7");
			const control = yield* mountPlain(provided(value, createElement(Size)));
			assert.include(control.stdout, "size=79x23");
		}).pipe(Effect.provide(themeLayer)),
	);
});

/** A widget whose enter handler throws: inside a screen the kit's guard must turn it into a defect. */
const ThrowsOnEnter = (): ReactElement => {
	useKeys(KeyTable.make([{ keys: ["enter"], action: "go", help: "go" }]), () => {
		throw new Error("handler threw under a nested provider");
	});
	return createElement(Text, null, "armed");
};

const messageOf = (exit: Exit.Exit<unknown, unknown>): string => {
	if (Exit.isSuccess(exit)) return "<succeeded>";
	const error = Cause.squash(exit.cause);
	return error instanceof Error ? error.message : String(error);
};

describe("a UiProvider nested in a CliUi.run screen keeps the screen (review I1)", () => {
	it.live("a throwing key handler under it is still the screen's defect, never an uncaught exception", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context.pipe(Effect.provide(themeLayer));
			const handle = yield* CliUiTest.render(() =>
				createElement(
					UiProvider,
					{ value: { ...value, size: { columns: 30, rows: 8 } } },
					createElement(ThrowsOnEnter),
				),
			);
			assert.include(yield* handle.plainFrame, "armed", "control: it drew first");
			yield* handle.press("enter");
			const result = yield* Effect.exit(handle.result.pipe(Effect.timeout("1 second")));
			assert.isTrue(
				Exit.isFailure(result) && result.cause.reasons.some(Cause.isDieReason),
				`a defect: ${messageOf(result)}`,
			);
			assert.include(messageOf(result), "handler threw under a nested provider");
		}).pipe(Effect.scoped, Effect.timeout("3 seconds")),
	);

	it.live("Select's q under it still cancels the screen with escape", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context.pipe(Effect.provide(themeLayer));
			const handle = yield* CliUiTest.render<number>((control) =>
				createElement(
					UiProvider,
					{ value },
					createElement(Select.View<number>, {
						message: "Pick",
						choices: [{ label: "one", value: 1 }],
						onSubmit: control.resolve,
					}),
				),
			);
			assert.include(yield* handle.plainFrame, "Pick", "control: it drew first");
			yield* handle.press({ char: "q" });
			const result = yield* Effect.exit(handle.result.pipe(Effect.timeout("1 second")));
			assert.deepStrictEqual(CliUiTest.cancelReason(result), Option.some("escape"), messageOf(result));
		}).pipe(Effect.scoped, Effect.timeout("3 seconds")),
	);
});

describe("UiContextValue is minted only by CliUi.context (review M1)", () => {
	it.effect("a hand-built value does not compile; a spread of a minted one does", () =>
		Effect.gen(function* () {
			const value = yield* CliUi.context;
			// @ts-expect-error a value built by hand lacks the brand only CliUi.context sets
			const forged: UiContextValue = { theme: value.theme, glyphs: value.glyphs };
			const sized: UiContextValue = { ...value, size: { columns: 30, rows: 8 } };
			assert.strictEqual(sized.theme, forged.theme, "both carry the same theme at runtime");
		}).pipe(Effect.provide(themeLayer)),
	);
});
