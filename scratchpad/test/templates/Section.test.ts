import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { CommentStyle, Section, SectionId, SectionKey } from "../../effected/templates/index.ts";

describe("SectionId", () => {
	it("builds a Section from an identity plus content", () => {
		const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
		const section = id.section("echo hi");
		assert.strictEqual(section.key, "example-tool");
		assert.strictEqual(section.content, "echo hi");
		assert.isTrue(Equal.equals(section.commentStyle, CommentStyle.hash));
	});

	it("requires a comment style, so a shell marker can never land in a TypeScript file by omission", () => {
		// @ts-expect-error commentStyle is required — no silent "#" default.
		assert.throws(() => SectionId.make({ key: "example-tool" }));
	});

	describe("key validation", () => {
		it("accepts the documented key shape", () => {
			for (const key of ["a", "example-tool", "Example.Tool_2", "SAVVY-LINT", "x9"]) {
				const id = SectionId.make({ key, commentStyle: CommentStyle.hash });
				assert.strictEqual(id.key, key);
			}
		});

		it("refuses a key that would break the marker grammar", () => {
			// Whitespace would make the scanner's key capture ambiguous; the other
			// characters cannot appear in a marker the scanner can read back.
			for (const key of ["", " ", "two words", "-leading", ".leading", "has/slash", "has\nnewline"]) {
				assert.throws(() => SectionId.make({ key, commentStyle: CommentStyle.hash }), undefined, undefined, key);
			}
		});
	});

	describe("identity", () => {
		it("is case-sensitive: a key is the exact string in the file", () => {
			const lower = SectionId.make({ key: "savvy-lint", commentStyle: CommentStyle.hash });
			const upper = SectionId.make({ key: "SAVVY-LINT", commentStyle: CommentStyle.hash });
			assert.isFalse(Equal.equals(lower, upper));
		});

		it("distinguishes the same key under different comment styles", () => {
			const hash = SectionId.make({ key: "k", commentStyle: CommentStyle.hash });
			const slash = SectionId.make({ key: "k", commentStyle: CommentStyle.slash });
			assert.isFalse(Equal.equals(hash, slash));
		});

		it("compares equal across separately constructed but equal styles", () => {
			const a = SectionId.make({ key: "k", commentStyle: CommentStyle.make({ prefix: "#" }) });
			const b = SectionId.make({ key: "k", commentStyle: CommentStyle.make({ prefix: "#" }) });
			assert.isTrue(Equal.equals(a, b));
		});
	});
});

describe("Section", () => {
	const style = CommentStyle.make({ prefix: "#" });
	const make = (content: string) => Section.make({ key: "k", commentStyle: style, content });

	it("exposes its identity", () => {
		const section = make("body");
		assert.isTrue(Equal.equals(section.id, SectionId.make({ key: "k", commentStyle: style })));
	});

	it("replaces content without disturbing identity", () => {
		const next = make("body").withContent("other");
		assert.strictEqual(next.content, "other");
		assert.isTrue(Equal.equals(next.id, make("body").id));
	});

	it("compares structurally on content", () => {
		assert.isTrue(Equal.equals(make("body"), make("body")));
		assert.isFalse(Equal.equals(make("body"), make("other")));
	});

	it("treats whitespace as significant, unlike the v3 normalized comparison", () => {
		// v3 collapsed whitespace before comparing, so an indentation-only
		// template change reported Unchanged and never reached the file.
		assert.isFalse(Equal.equals(make("a b"), make("a  b")));
		assert.isFalse(Equal.equals(make("body"), make("  body")));
	});
});

describe("SectionKey JSON Schema export", () => {
	it("exports its key pattern, standalone and inside SectionId", () => {
		const pattern = "^[A-Za-z0-9][A-Za-z0-9._-]*$";
		assert.nestedPropertyVal(S.toJsonSchemaDocument(SectionKey), "schema.pattern", pattern);
		assert.nestedPropertyVal(
			S.toJsonSchemaDocument(SectionId),
			"definitions.@beep/scratchpad/effected/templates/Section/SectionIdEncoded.properties.key.pattern",
			pattern,
		);
	});
});
