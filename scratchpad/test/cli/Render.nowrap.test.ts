// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience, TerminalEnv } from "../../effected/env/index.ts";
import { Console, Effect, Layer, Option } from "effect";
import { CliLinks, CliTheme, Doc, Render, Status } from "../../effected/cli/index.ts";

const ESC = String.fromCharCode(0x1b);
const strip = (text: string): string => text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

/** A finding wider than 80 columns: a reader greps it by `path:line:col`, so it must stay on one line. */
const PATH = `/very/long/absolute/path/${"deeply/nested/".repeat(4)}file.ts:12:3`;
const finding = [
	Doc.status(Status.core, "failure"),
	" ",
	PATH,
	"  rule-name  ",
	Doc.text("a message that runs on", "muted"),
];
const PROSE = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");

const env = (audience: AudienceKind, isTerminal: boolean, color: "none" | "truecolor" = "none") => {
	const stream = {
		isTerminal,
		color,
		hyperlinks: false,
		columns: isTerminal ? Option.some(40) : Option.none<number>(),
	};
	const terminal = TerminalEnv.layerTest({ stdinIsTerminal: isTerminal, stdout: stream, stderr: stream });
	return Layer.mergeAll(
		terminal,
		CliTheme.layer({ glyphs: "unicode" }).pipe(Layer.provide(terminal)),
		Audience.layerTest(audience),
		CliLinks.layerTest("off"),
	);
};

const printed = Effect.fn("printed")(function* (doc: Parameters<typeof Doc.print>[0], audience: AudienceKind, isTerminal: boolean) {
		const out: Array<string> = [];
		const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
			log: (...args: ReadonlyArray<unknown>) => out.push(args.map(String).join(" ")),
		});
		yield* Doc.print(doc).pipe(
			Effect.provide(env(audience, isTerminal)),
			Effect.provideService(Console.Console, double),
		);
		return out.join("\n").split("\n");
	});

describe("Render.context's width follows the stream's terminal for a human", () => {
	it.effect("a human on a pipe gets no limit, as an agent and a CI do", () =>
		Effect.gen(function* () {
			for (const audience of ["human", "agent", "ci"] as const) {
				const ctx = yield* Render.context("stdout").pipe(Effect.provide(env(audience, false)));
				assert.strictEqual(ctx.width, Number.POSITIVE_INFINITY, audience);
			}
		}),
	);

	it.effect("positive control: a human at a terminal still lays out at the terminal's width", () =>
		Effect.gen(function* () {
			const ctx = yield* Render.context("stdout").pipe(Effect.provide(env("human", true)));
			assert.strictEqual(ctx.width, 40);
			const lines = yield* printed([Doc.paragraph(PROSE)], "human", true);
			assert.isAbove(lines.length, 1, "prose wraps at a terminal");
		}),
	);

	it.effect("the width option still wins over both rules", () =>
		Effect.gen(function* () {
			const piped = yield* Render.context("stdout", { width: 30 }).pipe(Effect.provide(env("human", false)));
			assert.strictEqual(piped.width, 30);
		}),
	);

	it.effect("decides per stream: a human with stdout piped and stderr at a terminal", () =>
		Effect.gen(function* () {
			const terminal = TerminalEnv.layerTest({
				stdinIsTerminal: true,
				stdout: { isTerminal: false, columns: Option.some(40) },
				stderr: { isTerminal: true, columns: Option.some(40) },
			});
			const layer = Layer.mergeAll(
				terminal,
				CliTheme.layer().pipe(Layer.provide(terminal)),
				Audience.layerTest("human"),
				CliLinks.layerTest("off"),
			);
			const out = yield* Render.context("stdout").pipe(Effect.provide(layer));
			const err = yield* Render.context("stderr").pipe(Effect.provide(layer));
			assert.strictEqual(out.width, Number.POSITIVE_INFINITY);
			assert.strictEqual(err.width, 40);
		}),
	);

	it.effect("a piped human's finding prints on one line with its glyph", () =>
		Effect.gen(function* () {
			const lines = yield* printed([Doc.paragraph(...finding)], "human", false);
			assert.lengthOf(lines, 1);
			assert.include(lines[0], `✗ ${PATH}`);
		}),
	);
});

describe("Doc.line with wrap: false", () => {
	it("stays one line at a narrow width in every renderer, keeping its glyph and token", () => {
		for (const audience of ["human", "agent", "ci"] as const) {
			const ctx = Render.contextOf({ audience, width: 20, color: "truecolor" });
			for (const render of [Render.plain, Render.ansi, Render.githubLog, Render.markdown]) {
				const text = render([Doc.line(finding, { wrap: false })], ctx);
				assert.lengthOf(text.split("\n"), 1, `${audience} ${render === Render.plain ? "plain" : "other"}`);
				assert.include(strip(text), PATH);
			}
		}
		const human = Render.ansi(
			[Doc.line(finding, { wrap: false })],
			Render.contextOf({ audience: "human", width: 20, color: "truecolor" }),
		);
		assert.include(human, ESC, "the glyph and the muted text are still painted for a person");
		assert.match(strip(human), /^✗ /);
	});

	it("control: the same line without wrap: false wraps at that width", () => {
		const ctx = Render.contextOf({ audience: "human", width: 20 });
		assert.isAbove(Render.plain([Doc.line(finding)], ctx).split("\n").length, 1);
	});

	it("truncate still wins over wrap: false", () => {
		const ctx = Render.contextOf({ audience: "agent", width: 20 });
		const text = Render.plain([Doc.line(finding, { truncate: true, wrap: false })], ctx);
		assert.lengthOf(text.split("\n"), 1);
		assert.isAtMost(text.length, 20);
	});

	it("is atomic in a list item while the prose beside it wraps", () => {
		const ctx = Render.contextOf({ audience: "agent", width: 30 });
		const text = Render.plain([Doc.list([Doc.line(finding, { wrap: false }), Doc.paragraph(PROSE)])], ctx);
		const lines = text.split("\n");
		assert.lengthOf(
			lines.filter((line) => line.includes(PATH)),
			1,
		);
		assert.isAbove(lines.length, 3, "the prose item wrapped");
	});

	it("the node carries wrap only when given", () => {
		assert.notProperty(Doc.line("x"), "wrap");
		assert.strictEqual(Doc.line("x", { wrap: false }).wrap, false);
	});
});
