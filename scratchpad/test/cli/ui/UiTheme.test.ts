import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Text } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";
import { Styled, inkProps, useGlyphs, useTerminalSize, useTheme } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

describe("inkProps", () => {
	it("maps each style field to its Ink Text prop", () => {
		assert.deepStrictEqual(inkProps({ fg: "red" }, "truecolor"), { color: "red" });
		assert.deepStrictEqual(inkProps({ fg: "#ff8800" }, "256"), { color: "#ff8800" });
		assert.deepStrictEqual(inkProps({ bold: true }, "basic"), { bold: true });
		assert.deepStrictEqual(inkProps({ dim: true }, "basic"), { dimColor: true });
		assert.deepStrictEqual(inkProps({ italic: true }, "basic"), { italic: true });
		assert.deepStrictEqual(inkProps({ underline: true }, "basic"), { underline: true });
		assert.deepStrictEqual(inkProps({ bold: false }, "basic"), {}, "a false flag adds no prop");
	});

	it("gives no styling props at all when colour is none", () => {
		assert.deepStrictEqual(inkProps({ fg: "red", bold: true, dim: true, italic: true, underline: true }, "none"), {});
	});

	it("with the colour omitted emits every prop, as at truecolor, for Ink's own chalk to gate (A7)", () => {
		const style = { fg: "red", bold: true, dim: true, italic: true, underline: true } as const;
		assert.deepStrictEqual(inkProps(style), inkProps(style, "truecolor"));
		assert.deepStrictEqual(inkProps(style), {
			color: "red",
			bold: true,
			dimColor: true,
			italic: true,
			underline: true,
		});
	});
});

describe("the theme bridge under CliUiTest", () => {
	it.effect("Styled paints through the screen's theme, so a token decodes back to its marker", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(Styled, { token: "failure" }, "x"));
			assert.strictEqual((yield* handle.frame).trim(), "[failure]x[/failure]");
		}),
	);

	it.effect("Styled at colour none draws plain text", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(() => createElement(Styled, { token: "failure" }, "x"), {
				color: "none",
			});
			assert.strictEqual(yield* handle.rawFrame, "x");
		}),
	);

	it.effect("useTheme and useGlyphs read the mounted screen's theme", () =>
		Effect.gen(function* () {
			const Probe = (): ReactElement => {
				const theme = useTheme();
				const glyphs = useGlyphs();
				return createElement(Text, null, `${theme.color} ${glyphs.kind}`);
			};
			const handle = yield* CliUiTest.render(() => createElement(Probe), { color: "256", glyphs: "ascii" });
			assert.strictEqual((yield* handle.plainFrame).trim(), "256 ascii");
		}),
	);

	it.effect("useTerminalSize is the stdout size less one, and follows a resize", () =>
		Effect.gen(function* () {
			const Size = (): ReactElement => {
				const { columns, rows } = useTerminalSize();
				return createElement(Text, null, `${columns}x${rows}`);
			};
			const handle = yield* CliUiTest.render(() => createElement(Size), { columns: 80, rows: 24 });
			assert.strictEqual((yield* handle.plainFrame).trim(), "79x23");
			yield* handle.resize(100, 30);
			assert.strictEqual((yield* handle.plainFrame).trim(), "99x29");
		}),
	);
});
