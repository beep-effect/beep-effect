import { assert, describe, it } from "@effect/vitest";
import { Glyphs } from "../../effected/cli/index.ts";
import { displayWidth } from "../../effected/cli/internal/displayWidth.ts";

describe("Glyphs", () => {
	it("unicode and ascii are distinct, tagged sets", () => {
		assert.strictEqual(Glyphs.unicode.kind, "unicode");
		assert.strictEqual(Glyphs.ascii.kind, "ascii");
		assert.strictEqual(Glyphs.unicode.ellipsis, "…");
		assert.strictEqual(Glyphs.ascii.ellipsis, "...");
		assert.strictEqual(Glyphs.unicode.arrow, "→");
		assert.strictEqual(Glyphs.ascii.arrow, "->");
	});

	it("the ascii set is ascii only, and every set has spinner frames", () => {
		const text = [Glyphs.ascii.ellipsis, Glyphs.ascii.bullet, Glyphs.ascii.arrow, ...Glyphs.ascii.spinner].join("");
		for (const ch of text) assert.isBelow(ch.codePointAt(0) ?? 0, 128);
		assert.isAbove(Glyphs.unicode.spinner.length, 0);
		assert.isAbove(Glyphs.ascii.spinner.length, 0);
	});

	it("carries a path separator per audience and a spinner interval", () => {
		assert.strictEqual(Glyphs.unicode.pathSeparator.human, "›");
		assert.strictEqual(Glyphs.unicode.pathSeparator.agent, " > ");
		assert.strictEqual(Glyphs.ascii.pathSeparator.human, ">");
		assert.strictEqual(Glyphs.ascii.pathSeparator.agent, " > ");
		assert.strictEqual(Glyphs.unicode.spinnerIntervalMs, 80);
		assert.strictEqual(Glyphs.ascii.spinnerIntervalMs, 80);
	});

	it("the ascii separators are ascii only", () => {
		for (const ch of Glyphs.ascii.pathSeparator.human + Glyphs.ascii.pathSeparator.agent) {
			assert.isBelow(ch.codePointAt(0) ?? 0, 128);
		}
	});

	it("the shared sets cannot be edited through their nested values", () => {
		for (const set of [Glyphs.unicode, Glyphs.ascii]) {
			assert.isTrue(Object.isFrozen(set));
			assert.isTrue(Object.isFrozen(set.pathSeparator));
			assert.isTrue(Object.isFrozen(set.spinner));
		}
	});

	it("carries tree glyphs of one width per set: branch, last, pipe and blank", () => {
		assert.deepStrictEqual(Glyphs.unicode.tree, { branch: "├─ ", last: "└─ ", pipe: "│  ", blank: "   " });
		assert.deepStrictEqual(Glyphs.ascii.tree, { branch: "|-- ", last: "\\-- ", pipe: "|   ", blank: "    " });
		for (const set of [Glyphs.unicode, Glyphs.ascii]) {
			const widths = Object.values(set.tree).map((g) => displayWidth(g));
			assert.strictEqual(new Set(widths).size, 1, `${set.kind} segments share a width so branches align`);
			assert.isTrue(Object.isFrozen(set.tree));
		}
		for (const ch of Object.values(Glyphs.ascii.tree).join("")) assert.isBelow(ch.codePointAt(0) ?? 0, 128);
	});
});

describe("Glyphs.select", () => {
	it("is Unicode unless told otherwise", () => {
		assert.strictEqual(Glyphs.select(), Glyphs.unicode);
		assert.strictEqual(Glyphs.select({}), Glyphs.unicode);
		assert.strictEqual(Glyphs.select({ term: "xterm-256color" }), Glyphs.unicode);
	});

	it("ascii: true and ascii: false decide, whatever TERM says", () => {
		assert.strictEqual(Glyphs.select({ ascii: true }), Glyphs.ascii);
		assert.strictEqual(Glyphs.select({ ascii: true, term: "xterm" }), Glyphs.ascii);
		assert.strictEqual(Glyphs.select({ ascii: false, term: "dumb" }), Glyphs.unicode);
	});

	it("auto, the default, is ASCII only for TERM=dumb, from the term the caller passes", () => {
		assert.strictEqual(Glyphs.select({ ascii: "auto", term: "dumb" }), Glyphs.ascii);
		assert.strictEqual(Glyphs.select({ term: "dumb" }), Glyphs.ascii);
		assert.strictEqual(Glyphs.select({ ascii: "auto", term: "xterm" }), Glyphs.unicode);
		assert.strictEqual(Glyphs.select({ ascii: "auto", term: "DUMB" }), Glyphs.unicode, "TERM is case-sensitive");
		assert.strictEqual(Glyphs.select({ ascii: "auto" }), Glyphs.unicode, "no term is not dumb");
	});

	it("never reads the process: TERM=dumb in process.env changes nothing", () => {
		const before = process.env.TERM;
		process.env.TERM = "dumb";
		try {
			assert.strictEqual(Glyphs.select({ ascii: "auto" }), Glyphs.unicode);
		} finally {
			if (before === undefined) delete process.env.TERM;
			else process.env.TERM = before;
		}
	});
});
