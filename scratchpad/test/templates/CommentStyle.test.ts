import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import { CommentStyle } from "../../effected/templates/index.ts";

describe("CommentStyle", () => {
	describe("presets", () => {
		it("exposes the line styles", () => {
			assert.strictEqual(CommentStyle.hash.prefix, "#");
			assert.strictEqual(CommentStyle.hash.suffix, undefined);
			assert.strictEqual(CommentStyle.slash.prefix, "//");
			assert.strictEqual(CommentStyle.semicolon.prefix, ";");
			assert.strictEqual(CommentStyle.dash.prefix, "--");
		});

		it("exposes the wrapped styles, which v3 could not represent", () => {
			assert.strictEqual(CommentStyle.html.prefix, "<!--");
			assert.strictEqual(CommentStyle.html.suffix, "-->");
			assert.strictEqual(CommentStyle.block.prefix, "/*");
			assert.strictEqual(CommentStyle.block.suffix, "*/");
		});

		it("collects every preset in `presets`", () => {
			assert.deepStrictEqual(
				[...CommentStyle.presets].map((style) => style.prefix),
				["#", "//", ";", "--", "<!--", "/*"],
			);
		});
	});

	describe("construction", () => {
		it("accepts a caller-defined style the presets do not cover", () => {
			const tex = CommentStyle.make({ prefix: "%" });
			assert.strictEqual(tex.prefix, "%");
			const ml = CommentStyle.make({ prefix: "(*", suffix: "*)" });
			assert.strictEqual(ml.suffix, "*)");
		});

		it("refuses an empty prefix, which would match every line", () => {
			assert.throws(() => CommentStyle.make({ prefix: "" }));
		});

		it("refuses a newline in the prefix, which would inject lines into a marker", () => {
			assert.throws(() => CommentStyle.make({ prefix: "#\n#" }));
			assert.throws(() => CommentStyle.make({ prefix: "#\r\n#" }));
		});

		it("refuses an empty or newline-bearing suffix", () => {
			assert.throws(() => CommentStyle.make({ prefix: "<!--", suffix: "" }));
			assert.throws(() => CommentStyle.make({ prefix: "<!--", suffix: "--\n>" }));
		});
	});

	describe("identity", () => {
		it("is structural, and distinguishes a present suffix from an absent one", () => {
			assert.isTrue(Equal.equals(CommentStyle.make({ prefix: "#" }), CommentStyle.make({ prefix: "#" })));
			assert.isFalse(Equal.equals(CommentStyle.make({ prefix: "#" }), CommentStyle.make({ prefix: "//" })));
			assert.isFalse(
				Equal.equals(CommentStyle.make({ prefix: "<!--" }), CommentStyle.make({ prefix: "<!--", suffix: "-->" })),
			);
		});

		it("derives a stable id that separates prefix from suffix unambiguously", () => {
			// Without a separator, {prefix:"ab"} and {prefix:"a",suffix:"b"} would collide.
			assert.notStrictEqual(CommentStyle.make({ prefix: "ab" }).id, CommentStyle.make({ prefix: "a", suffix: "b" }).id);
			assert.strictEqual(CommentStyle.make({ prefix: "#" }).id, CommentStyle.hash.id);
		});
	});
});
