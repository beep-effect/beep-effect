// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type { AudienceKind } from "../../effected/env/index.ts";
import { Audience } from "../../effected/env/index.ts";
import { Console, Effect, Layer, Logger } from "effect";
import { CliLog, CliLogger, CliMessage, CliTheme, Doc, Glyphs, Render, Status } from "../../effected/cli/index.ts";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(7);
/** A glyph built from data: a hyperlink, a cursor move up two lines, and a bell around a plain mark. */
const HOSTILE = `${ESC}]8;;https://evil.example${BEL}!${ESC}]8;;${BEL}${ESC}[2A${BEL}`;
const vocab = Status.extend({ evil: { glyph: HOSTILE, ascii: HOSTILE, token: "failure", rank: 95 } });

/** What is left of a line once the kit's own SGR colour (ESC [ … m) is removed: nothing else may be an escape. */
const withoutColour = (line: string): string => line.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

const assertNeutralised = (line: string, label: string): void => {
	assert.include(line, "!", `${label}: the mark itself is drawn`);
	assert.notInclude(withoutColour(line), ESC, `${label}: no escape but the kit's own colour`);
	assert.notInclude(line, BEL, `${label}: no bell`);
	assert.notInclude(line, "evil.example", `${label}: no hyperlink target`);
};

const run = (effect: Effect.Effect<void, never, CliTheme | Audience>, audience: AudienceKind) =>
	Effect.gen(function* () {
		const lines: Array<string> = [];
		const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
			log: (...args: ReadonlyArray<unknown>) => lines.push(args.map(String).join(" ")),
			error: (...args: ReadonlyArray<unknown>) => lines.push(args.map(String).join(" ")),
		});
		yield* effect.pipe(
			Effect.provide(Layer.mergeAll(CliTheme.layerTest({ color: "truecolor" }), Audience.layerTest(audience))),
			Effect.provide(Logger.layer([CliLogger.make()])),
			Effect.provideService(Console.Console, double),
		);
		return lines;
	});

describe("a hostile status glyph is neutralised on every path", () => {
	for (const audience of ["agent", "human"] as const) {
		it.effect(`CliLog.status, for ${audience === "agent" ? "an agent" : "a person"}`, () =>
			Effect.gen(function* () {
				const [line = ""] = yield* run(CliLog.status(vocab, "evil", "boom"), audience);
				assertNeutralised(line, "CliLog.status");
				if (audience === "agent") assert.notInclude(line, ESC, "an agent gets no escape at all");
				else assert.include(line, ESC, "control: a person's glyph is still painted");
			}),
		);

		it.effect(`CliMessage.status, for ${audience === "agent" ? "an agent" : "a person"}`, () =>
			Effect.gen(function* () {
				const [line = ""] = yield* run(CliMessage.status(vocab, "evil", "boom"), audience);
				assertNeutralised(line, "CliMessage.status");
				if (audience === "agent") assert.notInclude(line, ESC);
			}),
		);

		it(`a document's status mark, for ${audience === "agent" ? "an agent" : "a person"}`, () => {
			const ctx = Render.contextOf({ audience, color: "truecolor" });
			const line = Render.ansi([Doc.paragraph(Doc.status(vocab, "evil"), " boom")], ctx);
			assertNeutralised(line, "Doc");
		});
	}

	it("Status.glyph and a theme's status are the shared source", () => {
		assert.strictEqual(vocab.glyph("evil", Glyphs.unicode), "!");
		assert.strictEqual(vocab.glyph("evil", Glyphs.ascii), "!");
		assert.strictEqual(Status.core.glyph("failure", Glyphs.unicode), "✗", "control: an ordinary glyph is unchanged");
	});
});
