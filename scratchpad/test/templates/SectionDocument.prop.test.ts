import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Result, Schema } from "effect";
import type { Section, SectionReconciliation } from "../../effected/templates/index.ts";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";

// Styles are constructed inline rather than taken from the presets, so the
// properties exercise STRUCTURAL identity rather than reference identity — the
// path a consumer defining its own style takes.
const styles = [
	CommentStyle.make({ prefix: "#" }),
	CommentStyle.make({ prefix: "//" }),
	CommentStyle.make({ prefix: "<!--", suffix: "-->" }),
] as const;

const Key = Schema.Literals(["alpha", "beta", "gamma", "delta"]);
// The style is generated as an index into `styles` — a literal can name a
// position, not an object — and resolved after generation.
const StyleIndex = Schema.Literals([0, 1, 2]);

/** Content lines that can never accidentally form a marker. */
const Content = Schema.Array(
	Schema.Literals(["", "a", "echo hi", "  indented", "# an ordinary comment", "trailing  "]),
).check(Schema.isMaxLength(4));

const Declared = Schema.Array(Schema.Tuple([Key, StyleIndex, Content])).check(Schema.isBetweenLength(1, 4));

/** Declared sets must be unique by identity, or reconciliation refuses by design. */
const declaredArb = Arbitrary.schema(Declared).pipe(
	Arbitrary.map((sections) => {
		const seen = new Set<string>();
		const declared: Array<Section> = [];
		for (const [key, styleIndex, content] of sections) {
			const commentStyle = styles[styleIndex];
			const identity = `${key}|${commentStyle.id}`;
			if (seen.has(identity)) {
				continue;
			}
			seen.add(identity);
			declared.push(SectionId.make({ key, commentStyle }).section(content.join("\n")));
		}
		return declared;
	}),
);

/** Plain user documents, with no markers in them. */
const documentArb = Arbitrary.schema(
	Schema.Array(Schema.Literals(["", "#!/bin/sh", "user line", "  spaced", "## heading", "set -e"])).check(
		Schema.isMaxLength(6),
	),
).pipe(Arbitrary.map((parts) => parts.join("\n")));

const reconcile = (text: string, declared: ReadonlyArray<Section>): SectionReconciliation => {
	const parsed = SectionDocument.parseResult(text, SectionDialect.default);
	if (!Result.isSuccess(parsed)) {
		assert.fail(`document should parse: ${parsed.failure.reason}`);
	}
	const result = parsed.success.reconcile(declared);
	if (!Result.isSuccess(result)) {
		assert.fail(`reconciliation should succeed: ${result.failure.reason}`);
	}
	return result.success;
};

describe("SectionDocument properties", () => {
	it.prop("reconciliation reaches a fixed point after one pass", [documentArb, declaredArb], ([text, declared]) => {
		const first = reconcile(text, declared);
		const second = reconcile(first.text, declared);
		assert.strictEqual(second.text, first.text);
		assert.isFalse(second.changed);
		assert.isTrue(
			second.outcomes.every((outcome) => outcome._tag === "Unchanged"),
			"every section should be Unchanged on the second pass",
		);
		// A third pass cannot drift either.
		assert.strictEqual(reconcile(second.text, declared).text, first.text);
		return true;
	});

	it.prop("every user line survives reconciliation, in order", [documentArb, declaredArb], ([text, declared]) => {
		const result = reconcile(text, declared);
		const original = text.split("\n").filter((line) => line.trim() !== "");
		const produced = result.text.split("\n");
		let cursor = 0;
		for (const line of original) {
			const found = produced.indexOf(line, cursor);
			assert.isAbove(found, -1, `user line "${line}" was lost`);
			cursor = found + 1;
		}
		return true;
	});

	it.prop("declared sections come back in declared order", [documentArb, declaredArb], ([text, declared]) => {
		const result = reconcile(text, declared);
		const parsed = SectionDocument.parseResult(result.text);
		if (!Result.isSuccess(parsed)) {
			assert.fail(`output should re-parse: ${parsed.failure.reason}`);
		}
		assert.deepStrictEqual(
			parsed.success.sections.map((placed) => placed.section.key),
			declared.map((section) => section.key),
		);
		return true;
	});

	it.prop(
		"re-declaring in a different order rewrites the document into that order",
		[documentArb, declaredArb],
		([text, declared]) => {
			// The first pass CREATES the sections; only the second exercises the
			// reassignment path, where ordering normalization actually lives. A
			// property that only ever creates cannot discriminate it.
			const created = reconcile(text, declared);
			const reversed = [...declared].reverse();
			const result = reconcile(created.text, reversed);
			const parsed = SectionDocument.parseResult(result.text);
			if (!Result.isSuccess(parsed)) {
				assert.fail("reordered output should re-parse");
			}
			assert.deepStrictEqual(
				parsed.success.sections.map((placed) => placed.section.key),
				reversed.map((section) => section.key),
			);
			// Reordering moves text but changes no content.
			assert.isTrue(result.outcomes.every((outcome) => outcome._tag === "Unchanged"));
			return true;
		},
	);

	it.prop("a parsed section round-trips its content exactly", [documentArb, declaredArb], ([text, declared]) => {
		const result = reconcile(text, declared);
		const parsed = SectionDocument.parseResult(result.text);
		if (!Result.isSuccess(parsed)) {
			assert.fail("output should re-parse");
		}
		for (const section of declared) {
			const outcome = parsed.success.check(section);
			assert.strictEqual(outcome._tag, "UpToDate", `section "${section.key}" did not round-trip`);
		}
		return true;
	});

	it.prop(
		"a CRLF document stays CRLF and still reaches a fixed point",
		[documentArb, declaredArb],
		([text, declared]) => {
			const crlf = text.replace(/\n/g, "\r\n");
			// A source with no line break carries no evidence of its line ending, so
			// there is nothing to preserve; a new document is written LF by design.
			if (!crlf.includes("\r\n")) {
				return true;
			}
			const first = reconcile(crlf, declared);
			assert.isFalse(/[^\r]\n/.test(first.text), "output must not contain a lone LF");
			const second = reconcile(first.text, declared);
			assert.strictEqual(second.text, first.text);
			assert.isFalse(second.changed);
			return true;
		},
	);

	it.prop(
		"removing every declared section restores a document with none",
		[documentArb, declaredArb],
		([text, declared]) => {
			let current = reconcile(text, declared).text;
			for (const section of declared) {
				const parsed = SectionDocument.parseResult(current);
				if (!Result.isSuccess(parsed)) {
					assert.fail("intermediate document should parse");
				}
				const removed = parsed.success.remove(section.id);
				assert.isTrue(removed._tag === "Some", `section "${section.key}" should be removable`);
				current = removed._tag === "Some" ? removed.value : current;
			}
			const final = SectionDocument.parseResult(current);
			if (!Result.isSuccess(final)) {
				assert.fail("final document should parse");
			}
			assert.lengthOf(final.success.sections, 0);
			return true;
		},
	);
});
