import { assert, describe, it } from "@effect/vitest";
import { parse } from "yaml";
import {
	foldRenderedScalar,
	foldScalarLine,
	renderBlockFolded,
	renderBlockLiteral,
	renderSingleQuotedMultiline,
} from "../../effected/yaml/internal/fold.ts";
import { computeEdits } from "../../effected/yaml/internal/diff.ts";
import { deepEqual } from "../../effected/yaml/internal/equal.ts";
import { requoteScalarText } from "../../effected/yaml/internal/requote.ts";

describe("plain data-first rendering helpers", () => {
	it("renders block scalars with omitted optional arguments and oracle defaults", () => {
		assert.strictEqual(renderBlockLiteral("hello", "  "), "|-\n  hello");
		assert.strictEqual(renderBlockLiteral("hello\n", "  ", "keep"), "|\n  hello");
		assert.strictEqual(renderBlockLiteral("hello\n", "  ", "keep", undefined, true), "|+\n  hello");
		assert.strictEqual(renderBlockLiteral("hello", "  ", undefined, undefined, undefined, 2), "|2-\n  hello");
		assert.strictEqual(renderBlockFolded("hello", "  "), ">-\n  hello");
		assert.strictEqual(renderBlockFolded("hello\n", "  ", "keep"), ">+\n  hello");
		assert.strictEqual(renderBlockFolded("hello", "  ", undefined, 2), ">2-\n  hello");
	});

	it("retains the other six direct helper contracts", () => {
		assert.strictEqual(foldScalarLine("one two three", "  ", 8, 2), "one\n  two\n  three");
		assert.strictEqual(foldRenderedScalar("|\n  one two three", "  ", 8), "|\n  one two three");
		assert.strictEqual(renderSingleQuotedMultiline("one\ntwo", "  "), "'one\n\n  two'");
		assert.deepStrictEqual(computeEdits("a: 1\n", "a: 2\n"), [{ offset: 3, length: 1, content: "2" }]);
		assert.isTrue(deepEqual({ a: [1, Number.NaN] }, { a: [1, Number.NaN] }));
		assert.isFalse(deepEqual([], {}));
		assert.isFalse(deepEqual(1, "1"));
		assert.strictEqual(
			requoteScalarText("'hello'", { value: "hello", style: "single-quoted", offset: 0, length: 7 }, '"', "escaping"),
			'"hello"',
		);
	});
});

describe("folded scalar more-indented transitions", () => {
	// Verified against af7566a9: upstream emits ">2-\n   a\n\n  b" for " a\nb".
	// The independent yaml parser resolves that output to " a\n\nb". YAML 1.2
	// already preserves a break following a more-indented line; no blank is needed.
	for (const value of [" a\nb", "\ta\nb", "a\n b\nc", " a\n\nb", "a\nb", "a\n\nb", " a\nb\n", " a\nb\n\n"]) {
		it(`round-trips ${JSON.stringify(value)} through an independent parser`, () => {
			const rendered = renderBlockFolded(value, "  ");
			assert.strictEqual(parse(`${rendered}\n`), value);
		});
	}
	it("emits no compensation blank after a more-indented line", () => {
		assert.strictEqual(renderBlockFolded(" a\nb", "  "), ">2-\n   a\n  b");
	});
});
