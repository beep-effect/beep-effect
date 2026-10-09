import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { YamlMap, YamlScalar } from "../../effected/yaml/YamlNode.ts";
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

	it("rejects a second structural colon without a comma", () => {
		const source = "{foo: 1 bar: 2}";
		const document = composeFirstDocument(source);
		assert.ok(document.errors.some((error) => error.code === "MalformedFlowCollection" && error.offset === 11));
		const result = Yaml.parseResult(source);
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
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
