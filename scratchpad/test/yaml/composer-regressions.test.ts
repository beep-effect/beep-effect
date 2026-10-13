import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import { parseCSTAll } from "../../effected/yaml/internal/cst-parser.ts";
import { createState, getLineStarts, lineCol, lineIndentColumn, sameLine } from "../../effected/yaml/internal/composer/state.ts";
import { composeFlowMap, composeFlowSeq } from "../../effected/yaml/internal/composer/flow.ts";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { YamlMap, YamlScalar, YamlSeq } from "../../effected/yaml/YamlNode.ts";
import { SemanticItem } from "../../effected/yaml/internal/composer/block.ts";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { composeAllDocuments, composeFirstDocument, composeFirstDocumentCounted } from "../../effected/yaml/internal/composer/document.ts";
import { findNextSignificantChild, getScalarValue, resolveScalar } from "../../effected/yaml/internal/composer/scalars.ts";

describe("composer review regressions", () => {
	it("resolves a scalar with two arguments", () => {
		assert.strictEqual(resolveScalar("123", ["plain"]), 123);
	});

	it("resolves a scalar with three arguments", () => {
		assert.strictEqual(resolveScalar("123", ["plain", "!!str"]), "123");
	});

	it("supports pipeable scalar resolution with optional tag context", () => {
		assert.strictEqual(pipe("123", resolveScalar(["plain"])), 123);
		assert.strictEqual(pipe("123", resolveScalar(["plain", "!!str"])), "123");
		assert.strictEqual(pipe("plain", resolveScalar(["double-quoted"])), "plain");
	});

	it("supports omitted and supplied options in pipeable document composition", () => {
		const source = "a: 1\n---\nb: 2\n";
		assert.deepStrictEqual(pipe(source, composeFirstDocument()), composeFirstDocument(source));
		assert.deepStrictEqual(pipe(source, composeFirstDocument({})), composeFirstDocument(source, {}));
		assert.strictEqual(pipe(source, composeFirstDocumentCounted()).documentCount, 2);
		assert.strictEqual(pipe(source, composeAllDocuments({})).documents.length, 2);
	});

	it("dispatches CST helpers with omitted and supplied optional arguments", () => {
		const scalar = { type: "flow-scalar", source: "123", offset: 0, length: 3 } as const;
		assert.strictEqual(getScalarValue(scalar), "123");
		assert.strictEqual(pipe(scalar, getScalarValue()), "123");
		assert.strictEqual(pipe(scalar, getScalarValue("123")), "123");
		assert.strictEqual(findNextSignificantChild([scalar], 0), 0);
		assert.strictEqual(pipe([scalar], findNextSignificantChild(0)), 0);
		assert.strictEqual(pipe([scalar], findNextSignificantChild(0, true)), 0);
	});

	it("registers a TAG directive for scalar resolution", () => {
		const result = Yaml.parseResult("%TAG !e! tag:yaml.org,2002:\n---\n!e!int 123\n");
		assertSuccess(result, Result.getOrThrow(result));
		assert.strictEqual(result.success, 123);
	});

	it("skips verbatim tag punctuation when finding a block scalar's parent", () => {
		const result = Yaml.parseResult("outer:\n  key:\n    !<tag:yaml.org,2002:str>\n    |2\n    hello\n");
		assertSuccess(result, Result.getOrThrow(result));
		assert.deepStrictEqual(result.success, { outer: { key: "hello\n" } });
	});

	it("ignores comment colons and dashes when locating explicit block indentation", () => {
		for (const comment of ["# note: x", "# - note", "# note: - x", "# note: 'quoted # data'"]) {
			assertSuccess(Yaml.parseResult(`key:\n  ${comment}\n  |2\n  hello\n`), { key: "hello\n" });
		}
		assertSuccess(Yaml.parseResult("'key # data':\n  # note: x\n  |2\n  hello\n"), { "key # data": "hello\n" });
		assertSuccess(Yaml.parseResult("key: 'value # data'\nother: |2\n  hello\n"), { key: "value # data", other: "hello\n" });
	});

	it("rejects a second structural colon without a comma", () => {
		const source = "{foo: 1 bar: 2}";
		const document = composeFirstDocument(source);
		assert.ok(document.errors.some((error) => error.code === "MalformedFlowCollection" && error.offset === 11));
		const result = Yaml.parseResult(source);
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
	});

	it("reports the missing comma only at the second structural colon", () => {
		for (const source of ["{foo: 1 bar: 2}", "{foo: 1\n bar: 2}"]) {
			const errors = composeFirstDocument(source).errors.filter((error) => error.code === "MalformedFlowCollection");
			assert.deepStrictEqual(errors.map((error) => [error.offset, error.length]), [[source.lastIndexOf(":"), 1]]);
		}
	});

	it("keeps nested collection separators and quoted or plain scalar colons scoped", () => {
		const result = Yaml.parseResult('{foo: {bar: 2}, seq: [a: 3], quoted: "x: y", plain: http://host}');
		assertSuccess(result, Result.getOrThrow(result));
		assert.deepStrictEqual(result.success, { foo: { bar: 2 }, seq: [{ a: 3 }], quoted: "x: y", plain: "http://host" });
	});

	it("folds multiline flow-map values as one scalar", () => {
		const result = Yaml.parseResult("{foo: multi\n  line}");
		assertSuccess(result, Result.getOrThrow(result));
		assert.deepStrictEqual(result.success, { foo: "multi line" });
	});

	it("folds multiline implicit flow-sequence mapping values as one scalar", () => {
		const result = Yaml.parseResult("[foo: multi\n  line]");
		assertSuccess(result, Result.getOrThrow(result));
		assert.deepStrictEqual(result.success, [{ foo: "multi line" }]);
	});

	it("still rejects separate quoted values without a comma", () => {
		const result = Yaml.parseResult('{foo: "one" "two"}');
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
	});

	it("allows a comment between a quoted flow key and its first colon", () => {
		const result = Yaml.parseResult('{ "foo" # comment\n :bar }');
		assertSuccess(result, Result.getOrThrow(result));
		assert.deepStrictEqual(result.success, { foo: "bar" });
	});

	it("keeps explicit node-less keys and absent values in the semantic model", () => {
		const isSemanticItem = S.is(SemanticItem);
		assert.isTrue(isSemanticItem({ kind: "key" }));
		assert.isFalse(isSemanticItem({ kind: "node" }));
		assert.isFalse(isSemanticItem({ kind: "comment", offset: 0 }));
		assert.isFalse(isSemanticItem({ kind: "value-sep" }));
		const document = composeFirstDocument("{? , empty: }");
		assert.deepStrictEqual(document.errors, []);
		assert.ok(S.is(YamlMap)(document.contents));
		const first = document.contents.items[0];
		assert.ok(S.is(YamlScalar)(first?.key));
		assert.strictEqual(first.key.value, null);
		assert.strictEqual(first.value, null);
		assert.strictEqual(document.contents.items[1]?.value, null);
	});

	for (const directive of ["%YAML nope", "%TAG !!", "%TAG !e! tag:example.com,2026: extra"]) {
		it(`rejects malformed directive ${directive} with a positioned fatal diagnostic`, () => {
			const source = `${directive}\n---\nvalue\n`;
			const document = composeFirstDocument(source);
			assert.ok(
				document.errors.some(
					(error) => error.code === "InvalidDirective" && error.offset === 0 && error.length >= directive.length,
				),
			);
			const result = Yaml.parseResult(source);
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		});
	}
});


describe("g8 required composer regressions", () => {
	for (const [source, offset, length] of [
		["- &a &b foo\n", 5, 2],
		["- !!str !!int 1\n", 8, 5],
		["a: &a &b foo\n", 6, 2],
		["a: !!str !!int 1\n", 9, 5],
	] as const) {
		it(`rejects duplicate node properties at ${offset}: ${source.trim()}`, () => {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(document.errors.map((error) => [error.code, error.offset, error.length]), [["UnexpectedToken", offset, length]]);
			const result = Yaml.parseResult(source, { strict: true });
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		});
	}

	it("retains distinct outer mapping and inner key metadata in mappings and sequences", () => {
		for (const prefix of ["root:", "-"]) {
			const source = `${prefix} &outer !!map\n  &inner !!str key: value\n`;
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(document.errors, []);
			const root = document.contents;
			let map;
			if (S.is(YamlSeq)(root)) map = root.items[0];
			else if (S.is(YamlMap)(root)) map = root.items[0]?.value;
			assert.ok(S.is(YamlMap)(map));
			assert.strictEqual(map.anchor, "outer");
			assert.strictEqual(map.tag, "!!map");
			const key = map.items[0]?.key;
			assert.ok(S.is(YamlScalar)(key));
			assert.strictEqual(key.anchor, "inner");
			assert.strictEqual(key.tag, "!!str");
			assertSuccess(Yaml.parseResult(source), prefix === "-" ? [{ key: "value" }] : { root: { key: "value" } });
		}
	});

	it("positions both nested explicit empty keys and the duplicate-key diagnostic", () => {
		const source = "nested: {? , ?}\n";
		const document = composeFirstDocument(source);
		assert.deepStrictEqual(document.errors, []);
		assert.ok(S.is(YamlMap)(document.contents));
		const map = document.contents.items[0]?.value;
		assert.ok(S.is(YamlMap)(map));
		assert.deepStrictEqual(map.items.map((pair) => [pair.key.offset, pair.key.length, pair.key.toValue(), pair.value]), [[9, 0, null, null], [13, 0, null, null]]);
		assert.deepStrictEqual(document.warnings.map((warning) => [warning.code, warning.offset, warning.length]), [["DuplicateKey", 13, 0]]);
		const result = Yaml.parseResult(source);
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		assert.strictEqual(result.failure.diagnostics[0]?.offset, 13);
	});

	for (const source of ["{foo #c\n bar: baz}", "[foo #c\n bar]", '{"foo" #c\n "bar": baz}', '["foo" #c\n "bar"]']) {
		it(`requires a comma between comment-separated entries: ${source}`, () => {
			const errors = composeFirstDocument(source).errors.filter((error) => error.code === "MalformedFlowCollection");
			assert.strictEqual(errors.length, 1);
			assert.strictEqual(errors[0]?.offset, source.indexOf("bar") - (source.includes('"bar"') ? 1 : 0));
			const result = Yaml.parseResult(source);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		});
	}

	it("retains embedded TAG URI fragments while recognizing separated comments", () => {
		const source = "%TAG !e! tag:example.com,2026:foo# # comment\n---\n!e!bar x\n";
		const document = composeFirstDocument(source);
		assert.deepStrictEqual(document.errors, []);
		assert.deepStrictEqual(document.directives, [{ name: "TAG", parameters: ["!e!", "tag:example.com,2026:foo#"] }]);
		assertSuccess(Yaml.parseResult(source), "x");
		assertSuccess(Yaml.parseResult("%TAG !e! tag:example.com,2026:foo#\n---\n!e!bar x\n"), "x");
		assert.strictEqual(composeFirstDocument("%YAML 1.2#bad\n---\nx\n").errors[0]?.code, "InvalidDirective");
		assert.strictEqual(composeFirstDocument("%TAG !e! urn:foo# extra\n---\nx\n").errors[0]?.code, "InvalidDirective");
	});

	it("preserves explicit and implicit integer fidelity beyond the safe-number range", () => {
		for (const [spelling, expected] of [["9007199254740993", 9007199254740993n], ["-9007199254740993", -9007199254740993n], ["+9007199254740993", 9007199254740993n], ["0x20000000000001", 9007199254740993n], ["0o400000000000000001", 9007199254740993n]] as const) {
			assertSuccess(Yaml.parseResult(spelling), expected);
			assertSuccess(Yaml.parseResult(`!!int ${spelling}`), expected);
		}
		assertSuccess(Yaml.parseResult("!!int 9007199254740991"), 9007199254740991);
		assertSuccess(Yaml.parseResult("!!int 123tail"), 123);
		assertSuccess(Yaml.parseResult("!!int nope"), "nope");
	});

	it("indexes CR and CRLF physical lines and rejects dedented continuations equally", () => {
		for (const newline of ["\n", "\r", "\r\n"]) {
			const text = `a: 1${newline}  b: 2${newline}`;
			assert.deepStrictEqual(getLineStarts(text), [0, 4 + newline.length, text.length]);
			assert.deepStrictEqual(lineCol(text, 4 + newline.length), { line: 1, column: 0 });
			assert.strictEqual(lineIndentColumn(text, 6 + newline.length), 2);
			assert.isFalse(sameLine(text, 0, 4 + newline.length));
			const result = Yaml.parseResult(`a:${newline}  first${newline}bare${newline}`);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			assertSuccess(Yaml.parseResult(`a:${newline}  first${newline}  continued${newline}`), { a: "first continued" });
		}
	});

	it("keeps separator-validation source reads linear on malformed comma-free segments", () => {
		const readsAt = (count: number): number => {
			const text = `{k: ${"x [b] ".repeat(count)}}`;
			const cst = parseCSTAll(text)[0]?.children?.find((child) => child.type === "flow-map");
			assert.ok(cst);
			let reads = 0;
			const children = (cst.children ?? []).map((child) => ({ ...child, get source() { reads++; return child.source; } }));
			const state = createState(text, { composeFlowMap, composeFlowSeq }, { uniqueKeys: false });
			composeFlowMap({ ...cst, children }, state);
			assert.strictEqual(state.errors.filter((error) => error.code === "MalformedFlowCollection").length, count * 2 - 1);
			assert.ok(reads < children.length * 100);
			return reads;
		};
		const small = readsAt(1000);
		const large = readsAt(4000);
		assert.ok(large < small * 5);
	});
});
