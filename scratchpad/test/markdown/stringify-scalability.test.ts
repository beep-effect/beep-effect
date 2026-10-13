import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Match from "effect/Match";
import { vi } from "vitest";
import { stringifyTree } from "../../effected/markdown/internal/stringify.ts";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Markdown } from "../../effected/markdown/Markdown.ts";
import { InlineCode, Paragraph, Root, Table, TableCell, TableRow, Text } from "../../effected/markdown/MarkdownNode.ts";

vi.mock("effect/Match", { spy: true });

describe("stringify scalability", () => {
	it("serializes a schema-valid 150000-row shallow table under the Node vitest runner", () => {
		const row = TableRow.make({ children: [TableCell.make({ children: [] })] });
		const root = Root.make({ children: [Table.make({ children: A.makeBy(150_000, () => row) })] });
		assert.isTrue(S.is(Root)(root));
		const result = Markdown.stringifyResult(root);
		assertSuccess(Result.map(result, () => undefined), undefined);
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


describe("compiled serializer dispatch", () => {
	it("builds no Match dispatchers while serializing 10000 inline-code siblings", () => {
		const root = Root.make({
			children: [Paragraph.make({ children: A.makeBy(10_000, () => InlineCode.make({ value: "x" })) })],
		});
		const typeCalls = vi.mocked(Match.type);
		typeCalls.mockClear();
		const valueCalls = vi.mocked(Match.value);
		valueCalls.mockClear();
		try {
			for (let sample = 0; sample < 3; sample += 1) {
				assert.strictEqual(stringifyTree(root), `${Str.repeat(10_000)("`x`")}\n`);
			}
			assert.strictEqual(typeCalls.mock.calls.length, 0);
			assert.strictEqual(valueCalls.mock.calls.length, 0);
		} finally {
			typeCalls.mockClear();
			valueCalls.mockClear();
		}
	});
});
