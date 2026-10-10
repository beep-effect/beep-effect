import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { assert, describe, it } from "@effect/vitest";
import { TerminalEnv } from "../../effected/env/index.ts";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { Prompt } from "effect/cli";
import type { NamedColor, Style, TokenName } from "../../effected/cli/index.ts";
import { CliTheme, Status, Token } from "../../effected/cli/index.ts";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const Json = S.fromJsonString(S.Unknown);

const env = (color: "none" | "basic" | "256" | "truecolor") => TerminalEnv.layerTest({ stdout: { color } });

describe("CliTheme.paint", () => {
	it.layer(CliTheme.layerTest({ color: "none" }), { timeout: "30 seconds" })((it) => {
		it.effect("returns the text unchanged at none", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.paint("failure", "x"), "x");
				assert.strictEqual(theme.paint(Token.hex("#e09a4e"), "x"), "x");
			}),
		);
	});

	it.layer(CliTheme.layerTest({ color: "basic" }), { timeout: "30 seconds" })((it) => {
		it.effect("paints a token at basic, closing with its own code", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.paint("failure", "x"), "\x1b[31mx\x1b[39m");
				assert.strictEqual(theme.paint("success", "x"), "\x1b[32mx\x1b[39m");
				assert.strictEqual(theme.paint("error", "x"), "\x1b[1m\x1b[31mx\x1b[39m\x1b[22m");
				assert.strictEqual(theme.paint("muted", "x"), "\x1b[2mx\x1b[22m");
				assert.strictEqual(theme.paint("emphasis", "x"), "\x1b[1mx\x1b[22m");
				assert.strictEqual(theme.paint("accent", "x"), "\x1b[36mx\x1b[39m");
				assert.strictEqual(theme.paint("info", "x"), "\x1b[36mx\x1b[39m");
				assert.strictEqual(theme.paint("warning", "x"), "\x1b[33mx\x1b[39m");
			}),
		);
	});

	it.layer(CliTheme.layerTest({ color: "truecolor" }), { timeout: "30 seconds" })((it) => {
		it.effect("paints an explicit style with truecolor", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.paint(Token.hex("#e09a4e"), "x"), "\x1b[38;2;224;154;78mx\x1b[39m");
			}),
		);
	});
});

describe("CliTheme.layer", () => {
	it.layer(CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(env("none"))), { timeout: "30 seconds" })((it) => {
		it.effect("reads the colour level from TerminalEnv: none paints plain", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.color, "none");
				assert.strictEqual(theme.paint("failure", "x"), "x");
			}),
		);
	});

	it.layer(CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(env("256"))), { timeout: "30 seconds" })((it) => {
		it.effect("reads 256 from TerminalEnv", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.color, "256");
				assert.strictEqual(theme.paint(Token.hex("#ff0000"), "x"), "\x1b[38;5;196mx\x1b[39m");
			}),
		);
	});

	it.layer(
		CliTheme.layer({ glyphs: "unicode", tokens: { failure: Token.named("magenta") } }).pipe(
			Layer.provide(env("basic")),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("token overrides replace a default and leave the rest", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.paint("failure", "x"), "\x1b[35mx\x1b[39m");
				assert.strictEqual(theme.paint("success", "x"), "\x1b[32mx\x1b[39m");
			}),
		);
	});

	class DumbGlyphs extends Context.Service<DumbGlyphs, string>()(
		"@beep/scratchpad/test/cli/CliTheme.test/DumbGlyphs",
	) {}
	class XtermGlyphs extends Context.Service<XtermGlyphs, string>()(
		"@beep/scratchpad/test/cli/CliTheme.test/XtermGlyphs",
	) {}
	class MissingGlyphs extends Context.Service<MissingGlyphs, string>()(
		"@beep/scratchpad/test/cli/CliTheme.test/MissingGlyphs",
	) {}
	const glyphsLayer = <Id>(service: Context.Service<Id, string>, term: Record<string, string>) =>
		Layer.effect(
			service,
			Effect.map(CliTheme, (theme) => theme.glyphs.kind),
		).pipe(
			Layer.provide(
				CliTheme.layer({ glyphs: "auto" }).pipe(
					Layer.provide(env("none")),
					Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(term))),
				),
			),
		);
	it.layer(
		Layer.mergeAll(
			glyphsLayer(DumbGlyphs, { TERM: "dumb" }),
			glyphsLayer(XtermGlyphs, { TERM: "xterm-256color" }),
			glyphsLayer(MissingGlyphs, {}),
		),
		{ timeout: "30 seconds" },
	)("glyphs auto", (it) => {
		it.effect("is ascii only when TERM=dumb", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* DumbGlyphs, "ascii");
				assert.strictEqual(yield* XtermGlyphs, "unicode");
				assert.strictEqual(yield* MissingGlyphs, "unicode");
			}),
		);
	});

	it.layer(
		CliTheme.layer({ glyphs: "ascii" }).pipe(
			Layer.provide(env("none")),
			Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "xterm" }))),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("explicit glyphs ignore TERM", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* CliTheme).glyphs.kind, "ascii");
			}),
		);
	});
});

class UnicodeTheme extends Context.Service<UnicodeTheme, Context.Service.Shape<typeof CliTheme>>()(
	"@beep/scratchpad/test/cli/CliTheme.test/UnicodeTheme",
) {}
class AsciiTheme extends Context.Service<AsciiTheme, Context.Service.Shape<typeof CliTheme>>()(
	"@beep/scratchpad/test/cli/CliTheme.test/AsciiTheme",
) {}
it.layer(
	Layer.mergeAll(
		Layer.effect(UnicodeTheme, CliTheme).pipe(Layer.provide(CliTheme.layerTest({ color: "none", glyphs: "unicode" }))),
		Layer.effect(AsciiTheme, CliTheme).pipe(Layer.provide(CliTheme.layerTest({ color: "none", glyphs: "ascii" }))),
	),
	{ timeout: "30 seconds" },
)("CliTheme.status", (it) => {
	it.effect("renders glyph and text at none, in unicode and in ascii", () =>
		Effect.gen(function* () {
			const unicode = yield* UnicodeTheme;
			const ascii = yield* AsciiTheme;
			assert.strictEqual(unicode.status(Status.core, "failure", "boom"), "✗ boom");
			assert.strictEqual(ascii.status(Status.core, "failure", "boom"), "[FAIL] boom");
			assert.strictEqual(unicode.status(Status.core, "success"), "✓");
		}),
	);

	it.layer(CliTheme.layerTest({ color: "truecolor" }), { timeout: "30 seconds" })((it) => {
		it.effect("paints the glyph with the status token, and supports an extended vocabulary", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.status(Status.core, "failure", "boom"), "\x1b[31m✗\x1b[39m boom");
				const vocab = Status.extend({
					timeout: { glyph: "⧖", ascii: "[time]", token: Token.hex("#e09a4e"), rank: 85 },
				});
				assert.strictEqual(theme.status(vocab, "timeout", "slow"), "\x1b[38;2;224;154;78m⧖\x1b[39m slow");
			}),
		);
	});
});

class NonePrompt extends Context.Service<NonePrompt, Prompt.Theme>()(
	"@beep/scratchpad/test/cli/CliTheme.test/NonePrompt",
) {}
class BasicPrompt extends Context.Service<BasicPrompt, Prompt.Theme>()(
	"@beep/scratchpad/test/cli/CliTheme.test/BasicPrompt",
) {}
class AsciiPrompt extends Context.Service<AsciiPrompt, Prompt.Theme>()(
	"@beep/scratchpad/test/cli/CliTheme.test/AsciiPrompt",
) {}
const promptLayer = <Id>(
	service: Context.Service<Id, Prompt.Theme>,
	color: "none" | "basic",
	glyphs: "unicode" | "ascii",
) =>
	Layer.effect(service, Prompt.Theme).pipe(
		Layer.provide(Layer.fresh(CliTheme.promptTheme.pipe(Layer.provide(CliTheme.layerTest({ color, glyphs }))))),
	);
it.layer(
	Layer.mergeAll(
		promptLayer(NonePrompt, "none", "unicode"),
		promptLayer(BasicPrompt, "basic", "unicode"),
		promptLayer(AsciiPrompt, "none", "ascii"),
	),
	{ timeout: "30 seconds" },
)("CliTheme.promptTheme", (it) => {
	it.effect("has empty colour fields when colour is none", () =>
		Effect.gen(function* () {
			const theme = yield* NonePrompt;
			for (const field of ["primaryColor", "mutedColor", "successColor", "errorColor", "submittedColor"] as const) {
				assert.strictEqual(theme[field], "", field);
			}
		}),
	);

	it.effect("carries raw SGR openers from the tokens otherwise", () =>
		Effect.gen(function* () {
			const theme = yield* BasicPrompt;
			assert.strictEqual(theme.primaryColor, "\x1b[36m");
			assert.strictEqual(theme.successColor, "\x1b[32m");
			assert.strictEqual(theme.errorColor, "\x1b[1m\x1b[31m");
			assert.strictEqual(theme.mutedColor, "\x1b[2m");
		}),
	);

	it.effect("takes its ellipsis from the glyph set", () =>
		Effect.gen(function* () {
			assert.strictEqual((yield* AsciiPrompt).ellipsis, "...");
			assert.strictEqual((yield* NonePrompt).ellipsis, "…");
		}),
	);
});

describe("CliTheme.forStream", () => {
	it.layer(CliTheme.layerTest({ color: "truecolor", stderrColor: "none" }), { timeout: "30 seconds" })((it) => {
		it.effect("each stream paints with its own colour level; the top-level members are the stdout ones", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.forStream("stdout").color, "truecolor");
				assert.strictEqual(theme.forStream("stderr").color, "none");
				assert.strictEqual(theme.forStream("stdout").paint("failure", "x"), "\x1b[31mx\x1b[39m");
				assert.strictEqual(theme.forStream("stderr").paint("failure", "x"), "x");
				assert.strictEqual(theme.forStream("stderr").sgr("failure"), "");
				assert.strictEqual(theme.forStream("stderr").status(Status.core, "failure", "boom"), "✗ boom");
				assert.strictEqual(theme.color, "truecolor");
				assert.strictEqual(theme.paint("failure", "x"), theme.forStream("stdout").paint("failure", "x"));
			}),
		);
	});

	it.layer(
		CliTheme.layer({ glyphs: "unicode" }).pipe(
			Layer.provide(TerminalEnv.layerTest({ stdout: { color: "256" }, stderr: { color: "none" } })),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layer reads stdout and stderr colour from TerminalEnv separately", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.strictEqual(theme.forStream("stdout").color, "256");
				assert.strictEqual(theme.forStream("stderr").color, "none");
			}),
		);
	});

	it.layer(CliTheme.layerTest({ color: "basic" }), { timeout: "30 seconds" })((it) => {
		it.effect("layerTest gives stderr the stdout colour unless told otherwise", () =>
			Effect.gen(function* () {
				assert.strictEqual((yield* CliTheme).forStream("stderr").color, "basic");
			}),
		);
	});
});

/** The SGR parameters of a painted token, decoded without the kit's own colour table: what a terminal would show. */
const NAMES: Readonly<Record<number, NamedColor | undefined>> = {
	30: "black",
	31: "red",
	32: "green",
	33: "yellow",
	34: "blue",
	35: "magenta",
	36: "cyan",
	37: "white",
	90: "blackBright",
	91: "redBright",
	92: "greenBright",
	93: "yellowBright",
	94: "blueBright",
	95: "magentaBright",
	96: "cyanBright",
	97: "whiteBright",
};

const ESC = String.fromCharCode(0x1b);

const decode = (painted: string): Style => {
	const style: { -readonly [K in keyof Style]: Style[K] } = {};
	const opens = [...painted.matchAll(new RegExp(`${ESC}\\[([0-9;]+)m`, "g"))].map((match) => match[1] ?? "");
	for (const params of opens) {
		const parts = params.split(";").map(Number);
		if (parts[0] === 38 && parts[1] === 2) {
			const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(2, "0");
			style.fg = `#${hex(parts[2])}${hex(parts[3])}${hex(parts[4])}`;
		} else if (parts.length === 1 && parts[0] !== undefined) {
			const code = parts[0];
			if (code === 1) style.bold = true;
			else if (code === 2) style.dim = true;
			else if (code === 3) style.italic = true;
			else if (code === 4) style.underline = true;
			else if (NAMES[code] !== undefined) style.fg = NAMES[code];
		}
	}
	return style;
};

const tokenNames: ReadonlyArray<TokenName> = [
	"success",
	"failure",
	"warning",
	"info",
	"error",
	"muted",
	"accent",
	"emphasis",
];

describe("Token.resolve agrees with what CliTheme.paint renders", () => {
	it.layer(CliTheme.layerTest({ color: "basic" }), { timeout: "30 seconds" })((it) => {
		it.effect("for every token, decoding the SGR gives the resolved style (basic, default tokens)", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				for (const token of tokenNames) {
					const resolved = Token.resolve(token);
					const painted = theme.paint(token, "x");
					// Without the name-to-number table the default styles are all named colours and attributes.
					assert.deepStrictEqual(
						decode(painted),
						{ ...resolved },
						`${token}: ${Result.getOrThrow(S.encodeUnknownResult(Json)(painted))}`,
					);
				}
			}),
		);
	});

	it.layer(
		CliTheme.layer({ tokens: { success: { fg: "#102030", bold: true }, muted: { fg: "magentaBright" } } }).pipe(
			Layer.provide(TerminalEnv.layerTest({ stdout: { color: "truecolor" }, stderr: { color: "truecolor" } })),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("with overrides, StreamTheme.style is the resolved style paint uses, on both streams", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				const overrides = { success: { fg: "#102030", bold: true }, muted: { fg: "magentaBright" } } as const;
				for (const stream of ["stdout", "stderr"] as const) {
					const view = theme.forStream(stream);
					for (const token of tokenNames) {
						const resolved = Token.resolve(token, overrides);
						assert.deepStrictEqual(view.style(token), resolved, `${stream} ${token}`);
						assert.deepStrictEqual(decode(view.paint(token, "x")), { ...resolved }, `${stream} ${token}`);
					}
				}
				const explicit: Style = { fg: "#abcdef", italic: true };
				assert.deepStrictEqual(theme.style(explicit), explicit);
				assert.deepStrictEqual(decode(theme.paint(explicit, "x")), explicit);
			}),
		);
	});

	it.layer(CliTheme.layerTest({ color: "none" }), { timeout: "30 seconds" })((it) => {
		it.effect("style is independent of the colour level: none still reports the style that would be painted", () =>
			Effect.gen(function* () {
				const theme = yield* CliTheme;
				assert.deepStrictEqual(theme.style("failure"), Token.defaults.failure);
				assert.strictEqual(theme.paint("failure", "x"), "x");
			}),
		);
	});
});
