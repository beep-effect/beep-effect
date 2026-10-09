import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { sourceOffsetAt } from "../../effected/markdown/internal/segments.ts";

describe("segmented source offsets", () => {
	it("preserves fallback, gaps, duplicate starts and exclusive ends in both call forms", () => {
		const segments = [
			{ textOffset: 2, sourceOffset: 10, length: 3 },
			{ textOffset: 8, sourceOffset: 30, length: 0 },
			{ textOffset: 8, sourceOffset: 40, length: 2 },
			{ textOffset: 10, sourceOffset: 60, length: 2 },
		];
		const cases = [
			[-1, 7], [0, 7], [2, 10], [4, 12], [5, 13], [7, 13],
			[8, 40], [9, 41], [10, 60], [11, 61], [12, 62], [100, 62],
			[Number.NaN, 62], [Number.POSITIVE_INFINITY, 62], [Number.NEGATIVE_INFINITY, 7],
		] as const;
		for (const [index, expected] of cases) {
			assert.strictEqual(sourceOffsetAt(segments, index, 7), expected);
			assert.strictEqual(sourceOffsetAt(index, 7)(segments), expected);
		}
		assert.strictEqual(sourceOffsetAt([], 0, 7), 7);
		assert.strictEqual(sourceOffsetAt([{ textOffset: 0, sourceOffset: 20, length: 0 }], 0, 7), 20);
	});

	it("bounds segment-start reads logarithmically across a long ordered index", () => {
		const size = 32_000;
		let reads = 0;
		const segments = A.makeBy(size, (index) => ({
			get textOffset() { reads += 1; return index * 4; },
			sourceOffset: index * 8,
			length: 3,
		}));
		for (let index = 0; index < size; index += 1) {
			assert.strictEqual(sourceOffsetAt(segments, index * 4, -1), index * 8);
		}
		assert.isAtMost(reads, size * 18);
	});

	it("positions every emphasis and text endpoint in a long multiline paragraph", () => {
		const size = 8_000;
		const source = Str.repeat(size)("a *b*\n");
		const root = Result.getOrThrow(Markdown.parseResult(source));
		assert.strictEqual(root.children.length, 1);
		const paragraph = root.children[0];
		if (paragraph?.type !== "paragraph") assert.fail("expected a paragraph");
		let count = 0;
		for (const child of paragraph.children) {
			if (child.type !== "emphasis") continue;
			assert.strictEqual(child.position.start.offset, count * 6 + 2);
			assert.strictEqual(child.position.end.offset, count * 6 + 5);
			assert.strictEqual(child.position.start.line, count + 1);
			assert.strictEqual(child.position.end.column, 6);
			const text = child.children[0];
			assert.strictEqual(text?.position.start.offset, count * 6 + 3);
			assert.strictEqual(text?.position.end.offset, count * 6 + 4);
			count += 1;
		}
		assert.strictEqual(count, size);
	});
});
