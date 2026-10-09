// Region-confined scalar replacement for YamlFormat.modify (#659):
// a scalar write into an existing single-line scalar target splices ONLY the
// target's byte range — quote style preserved, CRLFs and every other byte
// outside the span untouched — and anything outside the fast path's
// preconditions keeps the whole-document pipeline's existing behavior.

import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { YamlFormat, YamlModificationError } from "../../effected/yaml/YamlFormat.ts";

const modify = YamlFormat.modify;
const modifyToString = YamlFormat.modifyToString;

describe("YamlFormat.modify region-confined scalar replacement (#659)", () => {
	it.effect("preserves single quotes and CRLF line endings — the issue repro", () =>
		Effect.gen(function* () {
			const text = "generated:\r\n  by: x\r\n  at: '2020-01-01T00:00:00Z'\r\n";
			const out = yield* modifyToString(text, ["generated", "at"], "2026-01-01T00:00:00Z");
			assert.strictEqual(out, "generated:\r\n  by: x\r\n  at: '2026-01-01T00:00:00Z'\r\n");
		}),
	);

	it.effect("emits exactly one edit confined to the scalar span", () =>
		Effect.gen(function* () {
			const text = "generated:\n  by: x\n  at: '2020-01-01T00:00:00Z'\n";
			const edits = yield* modify(text, ["generated", "at"], "2026-01-01T00:00:00Z");
			assert.strictEqual(edits.length, 1);
			const edit = edits[0];
			assert.isDefined(edit);
			assert.strictEqual(text.slice(edit.offset, edit.offset + edit.length), "'2020-01-01T00:00:00Z'");
			assert.strictEqual(edit.content, "'2026-01-01T00:00:00Z'");
		}),
	);

	it.effect("preserves double-quote style", () =>
		Effect.gen(function* () {
			const text = 'a: 1\nb: "two"\n';
			const out = yield* modifyToString(text, ["b"], "three");
			assert.strictEqual(out, 'a: 1\nb: "three"\n');
		}),
	);

	it.effect("preserves plain style", () =>
		Effect.gen(function* () {
			const text = "a: hello\nb: 2\n";
			const edits = yield* modify(text, ["a"], "world");
			assert.strictEqual(edits.length, 1);
			assert.strictEqual(yield* modifyToString(text, ["a"], "world"), "a: world\nb: 2\n");
		}),
	);

	it.effect("quotes a plain-target value that cannot stay plain, regionally", () =>
		Effect.gen(function* () {
			const text = "flag: value\nother: 1\n";
			const out = yield* modifyToString(text, ["flag"], "123");
			// "123" must not re-parse as a number: the stringifier quotes it.
			assert.ok(out.match(/^flag: (['"])123\1\nother: 1\n$/));
			const edits = yield* modify(text, ["flag"], "123");
			assert.strictEqual(edits.length, 1);
			const edit = edits[0];
			assert.isDefined(edit);
			assert.ok(edit.offset + edit.length <= text.indexOf("\nother"));
		}),
	);

	it.effect("renders a non-string into a quoted target plain (type-correct), still regional", () =>
		Effect.gen(function* () {
			const text = "count: '5'\nkeep: x\n";
			const out = yield* modifyToString(text, ["count"], 7);
			assert.strictEqual(out, "count: 7\nkeep: x\n");
			assert.strictEqual((yield* modify(text, ["count"], 7)).length, 1);
		}),
	);

	it.effect("handles booleans into quoted targets without quoting them; null keeps the pipeline", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* modifyToString('a: "x"\n', ["a"], true), "a: true\n");
			// null renders as an empty scalar in the whole-document pipeline
			// (`a:`), and the fast path deliberately defers to that convention.
			assert.strictEqual(yield* modifyToString("a: 'x'\n", ["a"], null), "a:\n");
		}),
	);

	it.effect("preserves a same-line trailing comment (it lives outside the span)", () =>
		Effect.gen(function* () {
			const text = "a: 'v' # note\nb: 2\n";
			const out = yield* modifyToString(text, ["a"], "w");
			assert.strictEqual(out, "a: 'w' # note\nb: 2\n");
		}),
	);

	it.effect("leaves LF bytes outside the span untouched, including EOF newline", () =>
		Effect.gen(function* () {
			const text = "# header\n\nlist:\n  - 'one'\n  - two\n\n# footer\n";
			const out = yield* modifyToString(text, ["list", 0], "uno");
			assert.strictEqual(out, "# header\n\nlist:\n  - 'uno'\n  - two\n\n# footer\n");
		}),
	);

	it.effect("returns no edits for a no-op replacement", () =>
		Effect.gen(function* () {
			const text = "a: 'same'\r\n";
			assert.strictEqual((yield* modify(text, ["a"], "same")).length, 0);
			assert.strictEqual(yield* modifyToString(text, ["a"], "same"), text);
		}),
	);

	it.effect("escapes an embedded single quote in single-quoted style", () =>
		Effect.gen(function* () {
			const text = "a: 'plain'\n";
			assert.strictEqual(yield* modifyToString(text, ["a"], "it's"), "a: 'it''s'\n");
		}),
	);

	it.effect("escapes newlines in double-quoted style without touching the rest", () =>
		Effect.gen(function* () {
			const text = 'a: "x"\r\nb: 1\r\n';
			assert.strictEqual(yield* modifyToString(text, ["a"], "line1\nline2"), 'a: "line1\\nline2"\r\nb: 1\r\n');
		}),
	);

	it.effect("falls back to the full pipeline when a single-quoted target gets an unquotable value", () =>
		Effect.gen(function* () {
			// A tab cannot live in single-quoted style; the whole-document
			// pipeline picks a style that can express it (double-quoted).
			const text = "a: 'x'\nb: 1\n";
			const out = yield* modifyToString(text, ["a"], "has\ttab");
			assert.ok(out.includes("has\\ttab"));
			assert.ok((yield* modify(text, ["a"], "has\ttab")).length >= 1);
		}),
	);

	it.effect("falls back for object values (synthesized subtree, existing behavior)", () =>
		Effect.gen(function* () {
			const text = "a: 'x'\nb: 1\n";
			const out = yield* modifyToString(text, ["a"], { nested: true });
			assert.ok(out.includes("nested: true"));
			assert.ok((yield* modify(text, ["a"], { nested: true })).length >= 1);
		}),
	);

	it.effect("falls back for removals and insertions (existing behavior)", () =>
		Effect.gen(function* () {
			const text = "a: 'x'\nb: 1\n";
			assert.strictEqual(yield* modifyToString(text, ["a"], undefined), "b: 1\n");
			assert.strictEqual(yield* modifyToString(text, ["c"], "new"), "a: 'x'\nb: 1\nc: new\n");
		}),
	);

	it.effect("falls back for block scalar targets", () =>
		Effect.gen(function* () {
			const text = "a: |\n  line1\n  line2\nb: 1\n";
			// Exact whole-document pipeline output: the block scalar is replaced by
			// the stringifier's plain-scalar rendering. A weaker includes() check
			// would also pass if the fast path wrongly spliced the block header.
			assert.strictEqual(yield* modifyToString(text, ["a"], "replaced"), "a: replaced\nb: 1\n");
		}),
	);

	it.effect("falls back for tagged and anchored targets", () =>
		Effect.gen(function* () {
			// The fallback re-serialises from the composed value: the replacement
			// scalar takes the stringifier's own rendering, with no tag or anchor
			// carried over from the replaced target. Exact outputs pin the
			// tag/anchor bail precondition — includes() would pass under either path.
			assert.strictEqual(yield* modifyToString("a: !str 'x'\nb: 1\n", ["a"], "y"), "a: y\nb: 1\n");
			assert.strictEqual(yield* modifyToString("a: &an 'x'\nb: 1\n", ["a"], "y"), "a: y\nb: 1\n");
		}),
	);

	it.effect("falls back for a multi-line quoted span", () =>
		Effect.gen(function* () {
			const text = "a: 'one\n  two'\nb: 1\n";
			assert.strictEqual(yield* modifyToString(text, ["a"], "joined"), "a: joined\nb: 1\n");
		}),
	);

	it.effect("falls back to the whole-document pipeline on an explicit defaultScalarStyle", () =>
		Effect.gen(function* () {
			const text = "a: 'x'\nb: 1\n";
			// The explicit style request skips the fast path; the pipeline renders
			// the replacement as it always has (pins the fallback branch).
			const out = yield* modifyToString(text, ["a"], "y", { defaultScalarStyle: "double-quoted" });
			assert.strictEqual(out, "a: y\nb: 1\n");
		}),
	);

	it.effect("falls back to the whole-document pipeline on forceDefaultStyles", () =>
		Effect.gen(function* () {
			// Canonical mode drops quotes, comments and CRLFs; the fast path would
			// preserve all three. Pins the `forceDefaultStyles` bail clause.
			assert.strictEqual(
				yield* modifyToString("a: 'x' # note\r\nb: 1\r\n", ["a"], "y", { forceDefaultStyles: true }),
				"a: y\nb: 1\n",
			);
		}),
	);

	it.effect("falls back to the whole-document pipeline on sortKeys", () =>
		Effect.gen(function* () {
			// The fast path would splice in place and return the UNSORTED
			// "b: 'y'\na: 1\n"; the pipeline sorts keys and drops the quotes.
			// Deleting the `sortKeys === true` bail clause must fail this test.
			assert.strictEqual(yield* modifyToString("b: 'x'\na: 1\n", ["b"], "y", { sortKeys: true }), "a: 1\nb: y\n");
		}),
	);

	it.effect("falls back to the whole-document pipeline on indent", () =>
		Effect.gen(function* () {
			// The fast path would keep the original 4-space indentation; the
			// pipeline re-indents to 2. Pins the `indent !== undefined` clause.
			assert.strictEqual(yield* modifyToString("a:\n    k: 'x'\n", ["a", "k"], "y", { indent: 2 }), "a:\n  k: y\n");
		}),
	);

	it.effect("falls back to the whole-document pipeline on finalNewline", () =>
		Effect.gen(function* () {
			// The EOF newline sits outside the scalar span, so the fast path would
			// keep it; the pipeline honours finalNewline:false. Pins the clause.
			assert.strictEqual(yield* modifyToString("a: 'x'\n", ["a"], "y", { finalNewline: false }), "a: y");
		}),
	);

	it.effect("falls back to the whole-document pipeline on indentSequences", () =>
		Effect.gen(function* () {
			// The fast path would keep the indented sequence item; the pipeline
			// dedents it. Pins the `indentSequences !== undefined` clause.
			assert.strictEqual(
				yield* modifyToString("a:\n  - 'x'\n", ["a", 0], "y", { indentSequences: false }),
				"a:\n- y\n",
			);
		}),
	);

	it.effect("keeps typed navigation errors unchanged", () =>
		Effect.gen(function* () {
			const text = "a: 1\n";
			const error = yield* Effect.flip(YamlFormat.modify(text, ["missing", "deeper"], "v"));
			assert.ok(S.is(YamlModificationError)(error));
			assert.deepStrictEqual(error.path, ["missing", "deeper"]);
		}),
	);

	it.effect("still refuses multi-document streams and directives on the fast path shape", () =>
		Effect.gen(function* () {
			const stream = "a: '1'\n---\na: '2'\n";
			const streamResult = yield* Effect.exit(YamlFormat.modify(stream, ["a"], "x"));
			assertExitFailure(streamResult, streamResult.pipe(Exit.getCause, O.getOrThrow));
			const directives = "%YAML 1.2\n---\na: '1'\n";
			const directiveResult = yield* Effect.exit(YamlFormat.modify(directives, ["a"], "x"));
			assertExitFailure(directiveResult, directiveResult.pipe(Exit.getCause, O.getOrThrow));
		}),
	);

	it.effect("splices sequence elements regionally", () =>
		Effect.gen(function* () {
			const text = "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - c\r\n";
			assert.strictEqual(yield* modifyToString(text, ["list", 0], "A"), "list:\r\n  - 'A'\r\n  - \"b\"\r\n  - c\r\n");
			assert.strictEqual(yield* modifyToString(text, ["list", 1], "B"), "list:\r\n  - 'a'\r\n  - \"B\"\r\n  - c\r\n");
			assert.strictEqual(yield* modifyToString(text, ["list", 2], "C"), "list:\r\n  - 'a'\r\n  - \"b\"\r\n  - C\r\n");
		}),
	);

	it.effect(
		"quotes a plain replacement carrying a flow indicator when the target sits in a flow collection (#695)",
		() =>
			Effect.gen(function* () {
				assert.strictEqual(yield* modifyToString("a: [x, y]\n", ["a", 0], "p, q"), "a: ['p, q', y]\n");
				assert.strictEqual(yield* modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p,q"), "a: {b: 'p,q', c: y}\n");
				assert.strictEqual(yield* modifyToString("a: {b: x, c: y}\n", ["a", "b"], "p}"), "a: {b: 'p}', c: y}\n");
				// Still regional: one edit, confined to the target span.
				const edits = yield* modify("a: [x, y]\n", ["a", 0], "p, q");
				assert.strictEqual(edits.length, 1);
				const edit = edits[0];
				assert.isDefined(edit);
				assert.strictEqual(edit.offset, 4);
				assert.strictEqual(edit.length, 1);
				assert.strictEqual(edit.content, "'p, q'");
			}),
	);

	it.effect("a replacement without a flow indicator stays plain inside a flow collection", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* modifyToString("a: [x, y]\n", ["a", 0], "p q"), "a: [p q, y]\n");
		}),
	);

	it.effect("finds the first key behind a leading BOM and keeps the BOM (#694)", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* modifyToString("\uFEFFa: 'x'\nb: 1\n", ["a"], "y"), "\uFEFFa: 'y'\nb: 1\n");
		}),
	);
});
