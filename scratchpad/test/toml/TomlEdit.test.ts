// TomlEdit.applyAll: reverse-offset splicing so earlier offsets stay valid,
// overlap rejection as a programmer-error defect, and input immutability.

import { assert, describe, it } from "@effect/vitest";
import { TomlEdit } from "../../effected/toml/TomlEdit.ts";

const edit = (offset: number, length: number, content: string): TomlEdit => TomlEdit.make({ offset, length, content });

describe("TomlEdit", () => {
	describe("applyAll", () => {
		it("applies multiple edits regardless of the order given", () => {
			const text = "aaa bbb ccc";
			const expected = "xx bbb yyyy";
			const ascending = [edit(0, 3, "xx"), edit(8, 3, "yyyy")];
			const descending = [edit(8, 3, "yyyy"), edit(0, 3, "xx")];
			assert.strictEqual(TomlEdit.applyAll(text, ascending), expected);
			assert.strictEqual(TomlEdit.applyAll(text, descending), expected);
		});

		it("an empty edit list returns the text unchanged", () => {
			assert.strictEqual(TomlEdit.applyAll("a = 1\n", []), "a = 1\n");
		});

		it("a zero-length range inserts without consuming text", () => {
			assert.strictEqual(TomlEdit.applyAll("ac", [edit(1, 0, "b")]), "abc");
		});

		it("touching (adjacent, non-overlapping) edits both apply", () => {
			assert.strictEqual(TomlEdit.applyAll("abcdef", [edit(0, 3, "X"), edit(3, 3, "Y")]), "XY");
		});

		it("overlapping edits throw as a programmer-error defect", () => {
			assert.throws(() => TomlEdit.applyAll("abcdef", [edit(0, 4, "x"), edit(2, 3, "y")]), /overlap/);
		});

		it("does not mutate the input edits array", () => {
			const edits = [edit(0, 1, "x"), edit(3, 1, "y")];
			TomlEdit.applyAll("abcdef", edits);
			assert.strictEqual(edits[0].offset, 0);
			assert.strictEqual(edits[1].offset, 3);
		});
	});
});
