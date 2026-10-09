// Region-confined scalar replacement for YamlFormat.modify (#659):
// a scalar write into an existing single-line scalar target splices ONLY the
// target's byte range — quote style preserved, CRLFs and every other byte
// outside the span untouched — and anything outside the fast path's
// preconditions keeps the whole-document pipeline's existing behavior.

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { YamlFormat, YamlModificationError } from "../../effected/yaml/YamlFormat.ts";

const modify = (
	text: string,
	path: ReadonlyArray<string | number>,
	value: unknown,
	options?: Parameters<typeof YamlFormat.modify>[3],
) => Effect.runSync(YamlFormat.modify(text, path, value, options));
const modifyToString = (
	text: string,
	path: ReadonlyArray<string | number>,
	value: unknown,
	options?: Parameters<typeof YamlFormat.modifyToString>[3],
) => Effect.runSync(YamlFormat.modifyToString(text, path, value, options));

describe("YamlFormat.modify region-confined scalar replacement (#659)", () => {
	it("preserves single quotes and CRLF line endings — the issue repro", () => {
		const text = "generated:\r\n  by: x\r\n  at: '2020-01-01T00:00:00Z'\r\n";
		const out = modifyToString(text, ["generated", "at"], "2026-01-01T00:00:00Z");
		assert.strictEqual(out, "generated:\r\n  by: x\r\n  at: '2026-01-01T00:00:00Z'\r\n");
	});

	it("emits exactly one edit confined to the scalar span", () => {
		const text = "generated:\n  by: x\n  at: '2020-01-01T00:00:00Z'\n";
		const edits = modify(text, ["generated", "at"], "2026-01-01T00:00:00Z");
		assert.strictEqual(edits.length, 1);
		const edit = edits[0] as { offset: number; length: number; content: string };
		assert.strictEqual(text.slice(edit.offset, edit.offset + edit.length), "'2020-01-01T00:00:00Z'");
		assert.strictEqual(edit.content, "'2026-01-01T00:00:00Z'");
	});

	it("preserves double-quote style", () => {
		const text = 'a: 1\nb: "two"\n';
		const out = modifyToString(text, ["b"], "three");
		assert.strictEqual(out, 'a: 1\nb: "three"\n');
	});

	it("preserves plain style", () => {
		const text = "a: hello\nb: 2\n";
		const edits = modify(text, ["a"], "world");
		assert.strictEqual(edits.length, 1);
		assert.strictEqual(modifyToString(text, ["a"], "world"), "a: world\nb: 2\n");
	});

	it("quotes a plain-target value that cannot stay plain, regionally", () => {
		const text = "flag: value\nother: 1\n";
		const out = modifyToString(text, ["flag"], "123");
		// "123" must not re-parse as a number: the stringifier quotes it.
		assert.ok(out.match(/^flag: (['"])123\1\nother: 1\n$/));
		const edits = modify(text, ["flag"], "123");
		assert.strictEqual(edits.length, 1);
		const edit = edits[0] as { offset: number; length: number };
		assert.ok(edit.offset + edit.length <= text.indexOf("\nother"));
	});

	it("renders a non-string into a quoted target plain (type-correct), still regional", () => {
		const text = "count: '5'\nkeep: x\n";
		const out = modifyToString(text, ["count"], 7);
		assert.strictEqual(out, "count: 7\nkeep: x\n");
		assert.strictEqual(modify(text, ["count"], 7).length, 1);
	});

	it("handles booleans into quoted targets without quoting them; null keeps the pipeline", () => {
		assert.strictEqual(modifyToString('a: "x"\n', ["a"], true), "a: true\n");
		// null renders as an empty scalar in the whole-document pipeline
		// (`a:`), and the fast path deliberately defers to that convention.
		assert.strictEqual(modifyToString("a: 'x'\n", ["a"], null), "a:\n");
	});

	it("preserves a same-line trailing comment (it lives outside the span)", () => {
		const text = "a: 'v' # note\nb: 2\n";
		const out = modifyToString(text, ["a"], "w");
		assert.strictEqual(out, "a: 'w' # note\nb: 2\n");
	});

	it("leaves LF bytes outside the span untouched, including EOF newline", () => {
		const text = "# header\n\nlist:\n  - 'one'\n  - two\n\n# footer\n";
		const out = modifyToString(text, ["list", 0], "uno");
		assert.strictEqual(out, "# header\n\nlist:\n  - 'uno'\n  - two\n\n# footer\n");
	});

	it("returns no edits for a no-op replacement", () => {
		const text = "a: 'same'\r\n";
		assert.strictEqual(modify(text, ["a"], "same").length, 0);
		assert.strictEqual(modifyToString(text, ["a"], "same"), text);
	});

	it("escapes an embedded single quote in single-quoted style", () => {
		const text = "a: 'plain'\n";
		assert.strictEqual(modifyToString(text, ["a"], "it's"), "a: 'it''s'\n");
	});

	it("escapes newlines in double-quoted style without touching the rest", () => {
		const text = 'a: "x"\r\nb: 1\r\n';
		assert.strictEqual(modifyToString(text, ["a"], "line1\nline2"), 'a: "line1\\nline2"\r\nb: 1\r\n');
	});

	it("falls back to the full pipeline when a single-quoted target gets an unquotable value", () => {
		// A tab cannot live in single-quoted style; the whole-document
		// pipeline picks a style that can express it (double-quoted).
		const text = "a: 'x'\nb: 1\n";
		const out = modifyToString(text, ["a"], "has\ttab");
		assert.ok(out.includes("has\\ttab"));
		assert.ok(modify(text, ["a"], "has\ttab").length >= 1);
	});

	it("falls back for object values (synthesized subtree, existing behavior)", () => {
		const text = "a: 'x'\nb: 1\n";
		const out = modifyToString(text, ["a"], { nested: true });
		assert.ok(out.includes("nested: true"));
		assert.ok(modify(text, ["a"], { nested: true }).length >= 1);
	});

	it("falls back for removals and insertions (existing behavior)", () => {
		const text = "a: 'x'\nb: 1\n";
		assert.strictEqual(modifyToString(text, ["a"], undefined), "b: 1\n");
		assert.strictEqual(modifyToString(text, ["c"], "new"), "a: 'x'\nb: 1\nc: new\n");
	});

	it("falls back for block scalar targets", () => {
		const text = "a: |\n  line1\n  line2\nb: 1\n";
		// Exact whole-document pipeline output: the block scalar is replaced by
		// the stringifier's plain-scalar rendering. A weaker includes() check
		// would also pass if the fast path wrongly spliced the block header.
		assert.strictEqual(modifyToString(text, ["a"], "replaced"), "a: replaced\nb: 1\n");
	});

	it("falls back for tagged and anchored targets", () => {
		// The fallback re-serialises from the composed value: the replacement
		// scalar takes the stringifier's own rendering, with no tag or anchor
		// carried over from the replaced target. Exact outputs pin the
		// tag/anchor bail precondition — includes() would pass under either path.
		assert.strictEqual(modifyToString("a: !str 'x'\nb: 1\n", ["a"], "y"), "a: y\nb: 1\n");
		assert.strictEqual(modifyToString("a: &an 'x'\nb: 1\n", ["a"], "y"), "a: y\nb: 1\n");
	});

	it("falls back for a multi-line quoted span", () => {
		const text = "a: 'one\n  two'\nb: 1\n";
		assert.strictEqual(modifyToString(text, ["a"], "joined"), "a: joined\nb: 1\n");
	});

	it("falls back to the whole-document pipeline on an explicit defaultScalarStyle", () => {
		const text = "a: 'x'\nb: 1\n";
		// The explicit style request skips the fast path; the pipeline renders
		// the replacement as it always has (pins the fallback branch).
		const out = modifyToString(text, ["a"], "y", { defaultScalarStyle: "double-quoted" });
		assert.strictEqual(out, "a: y\nb: 1\n");
	});

	it("falls back to the whole-document pipeline on forceDefaultStyles", () => {
		// Canonical mode drops quotes, comments and CRLFs; the fast path would
		// preserve all three. Pins the `forceDefaultStyles` bail clause.
		assert.strictEqual(
			modifyToString("a: 'x' # note\r\nb: 1\r\n", ["a"], "y", { forceDefaultStyles: true }),
			"a: y\nb: 1\n",
		);
	});

	it("falls back to the whole-document pipeline on sortKeys", () => {
		// The fast path would splice in place and return the UNSORTED
		// "b: 'y'\na: 1\n"; the pipeline sorts keys and drops the quotes.
		// Deleting the `sortKeys === true` bail clause must fail this test.
		assert.strictEqual(modifyToString("b: 'x'\na: 1\n", ["b"], "y", { sortKeys: true }), "a: 1\nb: y\n");
	});

	it("falls back to the whole-document pipeline on indent", () => {
		// The fast path would keep the original 4-space indentation; the
		// pipeline re-indents to 2. Pins the `indent !== undefined` clause.
		assert.strictEqual(modifyToString("a:\n    k: 'x'\n", ["a", "k"], "y", { indent: 2 }), "a:\n  k: y\n");
	});

	it("falls back to the whole-document pipeline on finalNewline", () => {
		// The EOF newline sits outside the scalar span, so the fast path would
		// keep it; the pipeline honours finalNewline:false. Pins the clause.
		assert.strictEqual(modifyToString("a: 'x'\n", ["a"], "y", { finalNewline: false }), "a: y");
	});

	it("falls back to the whole-document pipeline on indentSequences", () => {
		// The fast path would keep the indented sequence item; the pipeline
		// dedents it. Pins the `indentSequences !== undefined` clause.
		assert.strictEqual(modifyToString("a:\n  - 'x'\n", ["a", 0], "y", { indentSequences: false }), "a:\n- y\n");
	});

	it("keeps typed navigation errors unchanged", () => {
		const text = "a: 1\n";
		const error = YamlFormat.modify(text, ["missing", "deeper"], "v").pipe(Effect.flip, Effect.runSync);
		assert.ok(S.is(YamlModificationError)(error));
		assert.deepStrictEqual((error as { path: ReadonlyArray<string | number> }).path, ["missing", "deeper"]);
	});

	it("still refuses multi-document streams and directives on the fast path shape", () => {
		const stream = "a: '1'\n---\na: '2'\n";
		const streamResult = Effect.runSyncExit(YamlFormat.modify(stream, ["a"], "x"));
		assert.strictEqual(streamResult._tag, "Failure");
		const directives = "%YAML 1.2\n---\na: '1'\n";
		const directiveResult = Effect.runSyncExit(YamlFormat.modify(directives, ["a"], "x"));
		assert.strictEqual(directiveResult._tag, "Failure");
	});

	it("splices sequence elements regionally", () => {
		const text = "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - c\r\n";
		assert.strictEqual(modifyToString(text, ["list", 0], "A"), "list:\r\n  - 'A'\r\n  - \"b\"\r\n  - c\r\n");
		assert.strictEqual(modifyToString(text, ["list", 1], "B"), "list:\r\n  - 'a'\r\n  - \"B\"\r\n  - c\r\n");
		assert.strictEqual(modifyToString(text, ["list", 2], "C"), "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - C\r\n");
	});

	it("quotes a plain replacement carrying a flow indicator when the target sits in a flow collection (#695)", () => {
		assert.strictEqual(modifyToString("a: [x, y]\n", ["a", 0], "p, q"), "a: ['p, q', y]\n");
		assert.strictEqual(modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p,q"), "a: {b: 'p,q', c: y}\n");
		assert.strictEqual(modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p}"), "a: {b: 'p}', c: y}\n");
		// Still regional: one edit, confined to the target span.
		const edits = modify("a: [x, y]\n", ["a", 0], "p, q");
		assert.strictEqual(edits.length, 1);
		const edit = edits[0] as { offset: number; length: number; content: string };
		assert.strictEqual(edit.offset, 4);
		assert.strictEqual(edit.length, 1);
		assert.strictEqual(edit.content, "'p, q'");
	});

	it("a replacement without a flow indicator stays plain inside a flow collection", () => {
		assert.strictEqual(modifyToString("a: [x, y]\n", ["a", 0], "p q"), "a: [p q, y]\n");
	});

	it("finds the first key behind a leading BOM and keeps the BOM (#694)", () => {
		assert.strictEqual(modifyToString("\uFEFFa: 'x'\nb: 1\n", ["a"], "y"), "\uFEFFa: 'y'\nb: 1\n");
	});
});
