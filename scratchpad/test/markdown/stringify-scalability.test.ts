import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { Paragraph, Root, Table, TableCell, TableRow, Text } from "../../effected/markdown/MarkdownNode.ts";

describe("stringify scalability", () => {
	it("serializes a schema-valid 150000-row shallow table under the Node vitest runner", () => {
		const row = TableRow.make({ children: [TableCell.make({ children: [] })] });
		const root = Root.make({ children: [Table.make({ children: A.makeBy(150_000, () => row) })] });
		assert.isTrue(S.is(Root)(root));
		const result = Markdown.stringifyResult(root);
		assert.isTrue(Result.isSuccess(result));
		assert.strictEqual(Result.getOrThrow(result), "|  |\n| --- |\n" + Str.repeat(149_999)("|  |\n"));
	});

	for (const size of [4_000, 8_000, 16_000]) {
		it(`reads adjacent text values linearly for ${size} siblings without merging nodes`, () => {
			let reads = 0;
			const children = A.makeBy(size, () => new Proxy(Text.make({ value: "x" }), {
				get(target, key, receiver) {
					if (key === "value") reads += 1;
					return Reflect.get(target, key, receiver);
				},
			}));
			const paragraph = Paragraph.make({ children });
			const before = paragraph.children;
			const root = Root.make({ children: [paragraph] });
			reads = 0;
			assert.strictEqual(Result.getOrThrow(Markdown.stringifyResult(root)), `${Str.repeat(size)("x")}\n`);
			assert.isAtMost(reads, size * 4);
			assert.isAtLeast(reads, size);
			assert.strictEqual(paragraph.children, before);
			assert.strictEqual(paragraph.children.length, size);
			for (let index = 0; index < size; index += 1) {
				assert.strictEqual(paragraph.children[index], children[index]);
			}
		});
	}
});
