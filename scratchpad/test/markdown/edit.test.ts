// The edit parity vocabulary: MarkdownEdit/MarkdownRange shape, applyAll
// splice semantics, and the overlap posture.
//
// Parity note: the shape ({ offset, length, content } / { offset, length })
// is bound to the jsonc/yaml/toml convention. Where the siblings diverge —
// toml's applyAll throws on overlapping edits, jsonc's and yaml's do not
// check — this package adopts the toml posture, and the overlap tests below
// pin that choice.

import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { MarkdownEdit, MarkdownRange } from "../../effected/markdown/MarkdownEdit.ts";

describe("MarkdownRange", () => {
	it("constructs via make with offset and length", () => {
		const range = MarkdownRange.make({ offset: 4, length: 10 });
		assert.strictEqual(range.offset, 4);
		assert.strictEqual(range.length, 10);
	});

	it("is structurally equal for identical fields", () => {
		assert.isTrue(
			Equal.equals(MarkdownRange.make({ offset: 1, length: 2 }), MarkdownRange.make({ offset: 1, length: 2 })),
		);
	});
});

describe("MarkdownEdit", () => {
	const edit = (offset: number, length: number, content: string) => MarkdownEdit.make({ offset, length, content });

	it("applies a single replacement splice", () => {
		assert.strictEqual(MarkdownEdit.applyAll("# Hello", [edit(2, 5, "World")]), "# World");
	});

	it("applies multiple edits regardless of input order", () => {
		const text = "one two three";
		const edits = [edit(0, 3, "ONE"), edit(8, 5, "THREE"), edit(4, 3, "TWO")];
		assert.strictEqual(MarkdownEdit.applyAll(text, edits), "ONE TWO THREE");
	});

	it("deletes with empty content", () => {
		assert.strictEqual(MarkdownEdit.applyAll("a b c", [edit(1, 2, "")]), "a c");
	});

	it("inserts with zero length", () => {
		assert.strictEqual(MarkdownEdit.applyAll("ac", [edit(1, 0, "b")]), "abc");
	});

	it("allows adjacent edits that touch without overlapping", () => {
		const text = "abcdef";
		const edits = [edit(0, 3, "X"), edit(3, 3, "Y")];
		assert.strictEqual(MarkdownEdit.applyAll(text, edits), "XY");
	});

	it("throws on overlapping edits as a programmer error", () => {
		const edits = [edit(0, 4, "x"), edit(2, 4, "y")];
		assert.throws(() => MarkdownEdit.applyAll("abcdefgh", edits), /overlapping edits are a programmer error/);
	});

	it("throws when an insertion sits inside a replaced span", () => {
		const edits = [edit(0, 4, "x"), edit(2, 0, "y")];
		assert.throws(() => MarkdownEdit.applyAll("abcdefgh", edits), /overlapping edits are a programmer error/);
	});

	it("does not mutate the input edits array", () => {
		const edits = [edit(4, 1, "B"), edit(0, 1, "A")];
		MarkdownEdit.applyAll("a b c", edits);
		assert.strictEqual(edits[0]?.offset, 4);
		assert.strictEqual(edits[1]?.offset, 0);
	});

	it("offsets are UTF-16 code units on astral content", () => {
		// "𝄞" occupies two UTF-16 code units, so "b" sits at offset 3.
		assert.strictEqual(MarkdownEdit.applyAll("a\u{1D11E}b", [edit(3, 1, "c")]), "a\u{1D11E}c");
		// Splicing the surrogate pair itself out as a unit.
		assert.strictEqual(MarkdownEdit.applyAll("a\u{1D11E}b", [edit(1, 2, "-")]), "a-b");
	});

	it("empty edits array returns the text unchanged", () => {
		assert.strictEqual(MarkdownEdit.applyAll("unchanged", []), "unchanged");
	});

	const Nat = (max: number) => S.Int.check(S.isBetween({ minimum: 0, maximum: max }));
	const disjointEdits = Arbitrary.schema(
		S.Tuple([
			S.String.check(S.isBetweenLength(8, 64)),
			S.Array(S.Tuple([Nat(7), Nat(3), S.String.check(S.isMaxLength(5))])).check(
				S.isMaxLength(4),
			),
		]),
	).pipe(
		Arbitrary.map(([text, raw]) => {
			// Lay raw (gap, length, content) triples out left to right so the
			// resulting edits are always disjoint and in-bounds. The cursor
			// always advances at least one unit past each edit's offset, so a
			// zero-length insertion can never share an offset with the next
			// edit's start (which the overlap guard rightly rejects).
			const edits: Array<MarkdownEdit> = [];
			let cursor = 0;
			for (const [gap, length, content] of raw) {
				const offset = cursor + gap;
				if (offset + length > text.length) {
					break;
				}
				edits.push(MarkdownEdit.make({ offset, length, content }));
				cursor = offset + Math.max(length, 1);
			}
			return { text, edits };
		}),
	);

	// `size` lifts the length scale to the 64-character text cap; the default
	// scale of 10 would pin every text near its 8-character floor.
	it.prop(
		"batch application equals sequential reverse-offset application on disjoint edits",
		[disjointEdits],
		([{ text, edits }]) => {
			const batch = MarkdownEdit.applyAll(text, edits);
			let sequential = text;
			for (const e of [...edits].sort((a, b) => b.offset - a.offset)) {
				sequential = MarkdownEdit.applyAll(sequential, [e]);
			}
			return batch === sequential;
		},
		{ arbitrary: { runs: 200, size: 64 } },
	);
});
