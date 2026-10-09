import { assert, describe, it } from "@effect/vitest";
import { LineIndex } from "../../effected/markdown/internal/lineIndex.ts";

describe("LineIndex", () => {
	it("positions the only offset of an empty string at line 1 column 1", () => {
		const index = LineIndex.make("");
		assert.deepStrictEqual(index.positionAt(0), { line: 1, column: 1 });
	});

	it("positions offsets around \\n boundaries", () => {
		// "ab\ncd\nef"
		//  01 2 34 5 67
		const index = LineIndex.make("ab\ncd\nef");
		assert.deepStrictEqual(index.positionAt(0), { line: 1, column: 1 }); // 'a'
		assert.deepStrictEqual(index.positionAt(1), { line: 1, column: 2 }); // 'b'
		assert.deepStrictEqual(index.positionAt(2), { line: 1, column: 3 }); // '\n' itself
		assert.deepStrictEqual(index.positionAt(3), { line: 2, column: 1 }); // 'c'
		assert.deepStrictEqual(index.positionAt(6), { line: 3, column: 1 }); // 'e'
	});

	it("treats a CRLF pair as a single boundary, keeping \\r on the prior line", () => {
		// "ab\r\ncd"
		//  01 2 3 45
		const index = LineIndex.make("ab\r\ncd");
		assert.deepStrictEqual(index.positionAt(2), { line: 1, column: 3 }); // '\r'
		assert.deepStrictEqual(index.positionAt(3), { line: 1, column: 4 }); // '\n'
		assert.deepStrictEqual(index.positionAt(4), { line: 2, column: 1 }); // 'c'
	});

	it("positions the final character and the one-past-end position", () => {
		const index = LineIndex.make("hello");
		assert.deepStrictEqual(index.positionAt(4), { line: 1, column: 5 }); // 'o'
		assert.deepStrictEqual(index.positionAt(5), { line: 1, column: 6 }); // one past end
	});

	it("clamps out-of-range offsets to the nearest valid position", () => {
		const index = LineIndex.make("hi");
		assert.deepStrictEqual(index.positionAt(-10), { line: 1, column: 1 });
		assert.deepStrictEqual(index.positionAt(1000), { line: 1, column: 3 });
	});

	it("clamps across multiple lines when out of range", () => {
		const index = LineIndex.make("ab\ncd\nef");
		assert.deepStrictEqual(index.positionAt(1000), { line: 3, column: 3 });
		assert.deepStrictEqual(index.positionAt(-1), { line: 1, column: 1 });
	});
});
