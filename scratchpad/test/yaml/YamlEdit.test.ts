import { assert, describe, it } from "@effect/vitest";
import { YamlEdit, YamlRange } from "../../effected/yaml/index.ts";

describe("YamlEdit", () => {
	describe("make", () => {
		it("constructs an edit", () => {
			const edit = YamlEdit.make({ offset: 10, length: 0, content: "\nnewKey: true" });
			assert.strictEqual(edit.offset, 10);
			assert.strictEqual(edit.length, 0);
			assert.strictEqual(edit.content, "\nnewKey: true");
		});
	});

	describe("applyAll", () => {
		it("applies a single replacement", () => {
			assert.strictEqual(
				YamlEdit.applyAll("a: 1\n", [YamlEdit.make({ offset: 3, length: 1, content: "2" })]),
				"a: 2\n",
			);
		});

		it("applies multiple edits in reverse-offset order regardless of input order", () => {
			const text = "abcdef";
			const edits = [
				YamlEdit.make({ offset: 0, length: 1, content: "X" }),
				YamlEdit.make({ offset: 4, length: 2, content: "YZ" }),
				YamlEdit.make({ offset: 2, length: 0, content: "-" }),
			];
			assert.strictEqual(YamlEdit.applyAll(text, edits), "Xb-cdYZ");
		});

		it("preserves stable ties and leaves an unsorted input array unchanged", () => {
			const edits = [
				YamlEdit.make({ offset: 0, length: 0, content: "L" }),
				YamlEdit.make({ offset: 1, length: 0, content: "A" }),
				YamlEdit.make({ offset: 1, length: 0, content: "B" }),
			];
			const snapshot = [...edits];
			assert.strictEqual(YamlEdit.applyAll("xy", edits), "LxBAy");
			assert.deepStrictEqual(edits, snapshot);
		});

		it("inserts with length 0 and deletes with empty content", () => {
			assert.strictEqual(
				YamlEdit.applyAll("a: 1\n", [YamlEdit.make({ offset: 5, length: 0, content: "b: 2\n" })]),
				"a: 1\nb: 2\n",
			);
			assert.strictEqual(
				YamlEdit.applyAll("a: 1\nb: 2\n", [YamlEdit.make({ offset: 5, length: 5, content: "" })]),
				"a: 1\n",
			);
		});

		it("touching (adjacent, non-overlapping) edits both apply", () => {
			assert.strictEqual(
				YamlEdit.applyAll("abcdef", [
					YamlEdit.make({ offset: 0, length: 3, content: "X" }),
					YamlEdit.make({ offset: 3, length: 3, content: "Y" }),
				]),
				"XY",
			);
		});

		it("overlapping edits throw as a programmer-error defect", () => {
			assert.throws(
				() =>
					YamlEdit.applyAll("abcdef", [
						YamlEdit.make({ offset: 0, length: 4, content: "x" }),
						YamlEdit.make({ offset: 2, length: 3, content: "y" }),
					]),
				/overlap/,
			);
		});

		it("does not mutate the input array", () => {
			const edits = [YamlEdit.make({ offset: 0, length: 0, content: "!" })];
			const snapshot = [...edits];
			YamlEdit.applyAll("x", edits);
			assert.deepStrictEqual(edits, snapshot);
		});
	});

	describe("YamlRange", () => {
		it("carries offset/length fields", () => {
			const range = YamlRange.make({ offset: 4, length: 8 });
			assert.strictEqual(range.offset, 4);
			assert.strictEqual(range.length, 8);
		});
	});
});
