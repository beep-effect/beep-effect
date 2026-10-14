import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlDocument } from "../../effected/yaml/YamlDocument.ts";
import { YamlFormat } from "../../effected/yaml/YamlFormat.ts";
import type { YamlNode } from "../../effected/yaml/YamlNode.ts";
import { YamlAlias, YamlMap, YamlScalar, YamlSeq } from "../../effected/yaml/YamlNode.ts";
import { composeAllDocuments, composeFirstDocument } from "../../effected/yaml/internal/composer/document.ts";
import {
	blankLineAboveStart, columnAt, hasBlankLineAbove, hasBlankLineBelow,
	hasBlankLineBetween, isAfterIndicatorOnly, isOwnLineAt, sameLineSpan,
} from "../../effected/yaml/internal/composer/comments.ts";

const mapOf = (node: YamlNode | null | undefined): YamlMap => {
	assert.ok(S.is(YamlMap)(node));
	return node;
};

const withLineEnding = (text: string, newline: string): string => Str.replaceAll("\n", newline)(text);

describe("round-3 explicit empty flow keys", () => {
	for (const source of ["{? : 1}", "{? # empty\n : 1}", "{? # empty\n, next: 1}"]) {
		it(`locates the empty key at its question indicator: ${source}`, () => {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(document.errors, []);
			const map = mapOf(document.contents);
			const pair = map.items[0];
			assert.ok(pair);
			assert.deepStrictEqual([pair.key.offset, pair.key.length, pair.key.toValue()], [1, 0, null]);
			assert.strictEqual(pair.value?.toValue() ?? null, source.includes(",") ? null : 1);
			assertSuccess(Yaml.parseResult(source), source.includes(",") ? { "": null, next: 1 } : { "": 1 });
		});
	}

	it("positions colon-delimited duplicate keys at offsets 9 and 16", () => {
		const source = "nested: {? : 1, ? : 2}\n";
		const document = composeFirstDocument(source);
		const nested = mapOf(mapOf(document.contents).items[0]?.value);
		assert.deepStrictEqual(A.map(nested.items, (pair) => [pair.key.offset, pair.key.length, pair.key.toValue()]), [[9, 0, null], [16, 0, null]]);
		assert.deepStrictEqual(A.map(document.warnings, (warning) => [warning.code, warning.offset, warning.length]), [["DuplicateKey", 16, 0]]);
		const result = Yaml.parseResult(source);
		assertFailure(Result.mapError(result, (error) => error.diagnostics[0]?.offset), 16);
	});

	it("preserves a property-generated colon key and rejects unseparated ?: syntax", () => {
		const source = "{? !!str : 1}";
		const map = mapOf(composeFirstDocument(source).contents);
		const key = map.items[0]?.key;
		assert.ok(S.is(YamlScalar)(key));
		assert.strictEqual(key.tag, "!!str");
		assert.strictEqual(key.value, "");
		assert.strictEqual(key.offset, source.indexOf(":"));
		assert.strictEqual(map.items.length, 1);
		assertSuccess(Yaml.parseResult(source), { "": 1 });
		assertFailure(Result.mapError(Yaml.parseResult("{?: 1}"), (error) => error._tag), "YamlParseError");
	});

	for (const [source, expected, count, anchor, tag, emptyValue] of [
		["{? &a, next: *a}", { "": null, next: null }, 2, "a", undefined, null],
		["{? &a}", { "": null }, 1, "a", undefined, null],
		["{? !!str}", { "": null }, 1, undefined, "!!str", ""],
		["{? !!str &a # empty\n, next: *a}", { "": null, next: "" }, 2, "a", "!!str", ""],
	] as const) {
		it(`materializes one property-bearing explicit key: ${source}`, () => {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(document.errors, []);
			assert.deepStrictEqual(document.warnings, []);
			const map = mapOf(document.contents);
			assert.strictEqual(map.items.length, count);
			const key = map.items[0]?.key;
			assert.ok(S.is(YamlScalar)(key));
			assert.deepStrictEqual([key.offset, key.length, key.value, key.anchor, key.tag], [1, 0, emptyValue, anchor, tag]);
			assertSuccess(Yaml.parseResult(source), expected);
		});
	}
});

describe("round-3 alias properties and explicit multiline keys", () => {
	for (const source of ["a: &a 1\nb: !!str *a\n", "- &a 1\n- !!str *a\n"]) {
		it(`rejects a tag on a recovered alias: ${source}`, () => {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(A.map(document.errors, (error) => [error.code, error.offset, error.length]), [["UnexpectedToken", source.indexOf("!!str"), 5]]);
			const contents = document.contents;
			const alias = S.is(YamlSeq)(contents) ? contents.items[1] : mapOf(contents).items[1]?.value;
			assert.ok(S.is(YamlAlias)(alias));
			assert.strictEqual(alias.name, "a");
			assertFailure(Result.mapError(Yaml.parseResult(source), (error) => error._tag), "YamlParseError");
		});
	}

	it("keeps the existing anchor-on-alias check alongside tag rejection", () => {
		const document = composeFirstDocument("a: &a 1\nb: &b !!str *a\n");
		assert.deepStrictEqual(A.map(document.errors, (error) => error.code), ["UnexpectedToken", "DuplicateAnchor"]);
		assert.ok(S.is(YamlAlias)(mapOf(document.contents).items[1]?.value));
	});

	for (const quote of ["'", '"']) {
		it(`accepts explicit multiline ${quote} keys while rejecting implicit ones`, () => {
			const key = `${quote}multi\n  line${quote}`;
			assertSuccess(Yaml.parseResult(`? ${key}\n: 1\n`), { "multi line": 1 });
			const implicit = composeFirstDocument(`${key}: 1\n`);
			assert.ok(A.some(implicit.errors, (error) => error.message === "Implicit mapping key must not span multiple lines"));
			assertFailure(Result.mapError(Yaml.parseResult(`${key}: 1\n`), (error) => error._tag), "YamlParseError");
		});
	}
});

describe("round-3 empty-key comment fidelity", () => {
	for (const [source, keyComment, valueBefore, valueComment] of [
		[": # before\n  1 # after\n", " before", undefined, " after"],
		[":\n  # lead\n  1\n", undefined, " lead", undefined],
		[": # before\n  # lead\n  1 # after\n", " before", " lead", " after"],
	] as const) {
		it.effect(`retains both comment slots through parse/stringify: ${source}`, () => Effect.gen(function* () {
			const document = yield* YamlDocument.parse(source);
			const pair = mapOf(document.contents).items[0];
			assert.ok(pair);
			assert.deepStrictEqual([pair.key.comment, pair.value?.commentBefore, pair.value?.comment], [keyComment, valueBefore, valueComment]);
			const rendered = yield* document.stringify();
			assert.strictEqual(rendered, source);
			const reparsed = yield* YamlDocument.parse(rendered);
			assert.strictEqual(yield* reparsed.stringify(), source);
		}));
	}

	it.effect("keeps the cross-line next key separate from an absent empty-key value", () => Effect.gen(function* () {
		const source = ':\n# next\n"key": 1\n';
		const document = yield* YamlDocument.parse(source);
		const map = mapOf(document.contents);
		assert.strictEqual(map.items.length, 2);
		assert.strictEqual(map.items[0]?.value, null);
		assert.strictEqual(map.items[1]?.key.commentBefore, " next");
		assert.strictEqual(yield* document.stringify(), source);
	}));
});

describe("round-3 duplicate node properties", () => {
	for (const [source, property, last] of [
		["a: !!str\n  !!int\n  1\n", "tag", "!!int"],
		["a: &x\n  &y\n  foo\n", "anchor", "y"],
		["!!str !!int 1\n", "tag", "!!int"],
		["&a &b hello\n", "anchor", "b"],
		["!!str\n!!int\n1\n", "tag", "!!int"],
		["&a\n&b\nhello\n", "anchor", "b"],
		["[!!str !!int 1]", "tag", "!!int"],
		["[&a &b foo]", "anchor", "b"],
		["{key: !!str !!int 1}", "tag", "!!int"],
		["{key: &a &b foo}", "anchor", "b"],
		["a: &x\n  &y\n  &z\n  foo\n", "anchor", "z"],
		["!!str\n!!float\n!!int\n1\n", "tag", "!!int"],
	] as const) {
		it(`rejects duplicate ${property} declarations and recovers the last: ${source}`, () => {
			const document = composeFirstDocument(source);
			assert.ok(A.some(document.errors, (error) => error.code === "UnexpectedToken" && error.message.includes(`two ${property}`)));
			const root = document.contents;
			const scalar = S.is(YamlMap)(root) ? root.items[0]?.value : S.is(YamlSeq)(root) ? root.items[0] : root;
			assert.ok(S.is(YamlScalar)(scalar));
			assert.strictEqual(scalar[property], last);
			assertFailure(Result.mapError(Yaml.parseResult(source, { strict: true }), (error) => error._tag), "YamlParseError");
		});
	}

	it("preserves legal outer-container/inner-key property splits", () => {
		for (const source of ["&outer !!map\n&inner !!str key: value\n", "root: &outer !!map\n  &inner !!str key: value\n", "- &outer !!map\n  &inner !!str key: value\n"]) {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(document.errors, []);
			const root = document.contents;
			const map = S.is(YamlSeq)(root) ? mapOf(root.items[0]) : source.startsWith("root:") ? mapOf(mapOf(root).items[0]?.value) : mapOf(root);
			assert.strictEqual(map.anchor, "outer");
			assert.strictEqual(map.tag, "!!map");
			const key = map.items[0]?.key;
			assert.ok(S.is(YamlScalar)(key));
			assert.deepStrictEqual([key.anchor, key.tag], ["inner", "!!str"]);
		}
	});
});

describe("round-3 physical comment lines", () => {
	for (const newline of ["\n", "\r", "\r\n"]) {
		it(`counts ${Str.replaceAll("\n", "LF")(Str.replaceAll("\r", "CR")(newline))} as one physical break`, () => {
			const text = `a: 1${newline} \t${newline}  # next${newline}${newline}b: 2`;
			const offset = text.indexOf("#");
			assert.isFalse(sameLineSpan(text, 0, offset));
			assert.isTrue(sameLineSpan(text, offset, offset + 6));
			assert.isTrue(hasBlankLineBetween(text, 0, offset));
			assert.isFalse(hasBlankLineBetween(`a${newline}b`, 0, 2 + newline.length));
			assert.strictEqual(blankLineAboveStart(text, offset), 4 + newline.length);
			assert.isTrue(hasBlankLineAbove(text, offset));
			assert.isTrue(hasBlankLineBelow(text, offset));
			assert.isFalse(hasBlankLineBelow(`a${newline}`, 0));
			assert.strictEqual(columnAt(text, offset), 2);
			assert.isTrue(isOwnLineAt(text, offset));
			assert.isTrue(isAfterIndicatorOnly(`x${newline}: # c`, 3 + newline.length));
			assert.strictEqual(columnAt(`a${newline}\uFEFFkey`, 2 + newline.length), 0);
		});
	}

	for (const source of [
		"a: # key\n  # lead\n  1 # value\n",
		"a:\n  # note\n  1\n",
		"# heading\n\na: 1\n",
		"# first\n\n# second\n\na: 1\n",
		"a: 1\n\n# next\nb: 2\n",
		": # key\n  # lead\n  1 # value\n",
		":\n# next\nkey: 1\n",
		"root:\n  nested:\n    b: 1\n\n# tail\na: 2\n",
		"root:\n  nested:\n    - b\n\n# tail\na: 2\n",
		"root:\n  nested:\n    b: 1\n\n# tail\n",
	]) {
		it.effect(`matches LF comment ownership and emitted bytes: ${source}`, () => Effect.gen(function* () {
			const lf = yield* YamlDocument.parse(source);
			const expected = yield* lf.stringify();
			for (const newline of ["\r", "\r\n"]) {
				const twin = withLineEnding(source, newline);
				const document = yield* YamlDocument.parse(twin);
				assert.strictEqual(yield* document.stringify(), expected);
				assert.strictEqual(YamlFormat.formatToString(twin), YamlFormat.formatToString(source));
				assert.strictEqual(YamlFormat.formatToString(YamlFormat.formatToString(twin)), YamlFormat.formatToString(source));
			}
		}));
	}

	it("trims escaped comments and their blank line from nested node spans", () => {
		for (const newline of ["\n", "\r", "\r\n"]) {
			const source = withLineEnding("root:\n  nested:\n    b: 1\n\n# tail\na: 2\n", newline);
			const root = mapOf(composeFirstDocument(source).contents);
			const outer = mapOf(root.items[0]?.value);
			const inner = mapOf(outer.items[0]?.value);
			const blankStart = source.indexOf(`${newline}${newline}`) + newline.length;
			assert.strictEqual(outer.offset + outer.length, blankStart);
			assert.strictEqual(inner.offset + inner.length, blankStart);
			assert.isUndefined(outer.comment);
			assert.isUndefined(inner.comment);
			assert.strictEqual(root.items[1]?.key.commentBefore, " tail");
		}
	});
});

describe("round-3 flow comments before values", () => {
	for (const [source, expected] of [
		["{foo: # c\n bar}", { foo: "bar" }],
		["[foo: # c\n bar]", [{ foo: "bar" }]],
		['{"foo": # c\n bar}', { foo: "bar" }],
		['["foo": # c\n bar]', [{ foo: "bar" }]],
		["{foo: # c\n [bar]}", { foo: ["bar"] }],
		["[foo: # c\n {bar: 1}]", [{ foo: { bar: 1 } }]],
		["{foo: # c\n # lead\n bar, next: 2}", { foo: "bar", next: 2 }],
	] as const) {
		it(`accepts comments while the entry awaits a value: ${source}`, () => {
			assert.deepStrictEqual(composeFirstDocument(source).errors, []);
			assertSuccess(Yaml.parseResult(source), expected);
		});
	}

	it("keeps a comment before the first colon valid and missing commas fatal", () => {
		assertSuccess(Yaml.parseResult('{"foo" # c\n : bar}'), { foo: "bar" });
		for (const source of ["{foo: bar # c\n next: 2}", "[foo: bar # c\n next: 2]", "{foo # c\n bar: 2}", "[foo # c\n bar]"]) {
			assert.ok(A.some(composeFirstDocument(source).errors, (error) => error.code === "MalformedFlowCollection"));
			assertFailure(Result.mapError(Yaml.parseResult(source), (error) => error._tag), "YamlParseError");
		}
	});
});

describe("round-3 consumed tag-handle validation", () => {
	for (const source of ["!missing!str hi\n", "x: !missing!str hi\n", "!missing!map {x: 1}\n", "!missing!seq [1]\n"]) {
		it.effect(`rejects an undeclared handle in document one: ${source}`, () => Effect.gen(function* () {
			const document = composeFirstDocument(source);
			assert.deepStrictEqual(A.map(document.errors, (error) => [error.code, error.offset]), [["UnresolvedTag", source.indexOf("!missing!")]]);
			assertFailure(Result.mapError(Yaml.parseResult(source), (error) => error._tag), "YamlParseError");
			const result = yield* Effect.result(YamlDocument.parseAll(source));
			assertFailure(Result.mapError(result, (error) => error.diagnostics[0]?.code), "UnresolvedTag");
		}));
	}

	it.effect("reports the later document's undeclared handle once through AST parseAll", () => Effect.gen(function* () {
		const source = "%TAG !e! tag:example.com,2000:\n---\n!e!foo bar\n...\n---\n!e!foo baz\n";
		const composed = composeAllDocuments(source);
		assert.deepStrictEqual(composed.streamErrors, []);
		assert.deepStrictEqual(composed.documents[0]?.errors, []);
		assert.deepStrictEqual(A.map(composed.documents[1]?.errors ?? [], (error) => [error.code, error.offset]), [["UnresolvedTag", 54]]);
		assert.deepStrictEqual(A.map(composeFirstDocument(source).errors, (error) => [error.code, error.offset]), [["UnresolvedTag", 54]]);
		assertFailure(Result.mapError(Yaml.parseResult(source), (error) => error._tag), "YamlParseError");
		const result = yield* Effect.result(YamlDocument.parseAll(source));
		assertFailure(Result.mapError(result, (error) => A.map(error.diagnostics, (diagnostic) => [diagnostic.code, diagnostic.offset])), [["UnresolvedTag", 54]]);
	}));

	it.effect("keeps tag-shaped plain continuation text in later documents", () => Effect.gen(function* () {
		const source = "---\n0\n---\nhello\n !missing!str\n";
		const composed = composeAllDocuments(source);
		assert.deepStrictEqual(composed.streamErrors, []);
		assert.deepStrictEqual(A.map(composed.documents, (document) => document.errors), [[], []]);
		assert.deepStrictEqual(composeFirstDocument(source).errors, []);
		assertSuccess(Yaml.parseResult(source), 0);
		assertSuccess(Yaml.parseAllResult(source), [0, "hello !missing!str"]);
		const documents = yield* YamlDocument.parseAll(source);
		assert.deepStrictEqual(A.map(documents, (document) => document.contents?.toValue()), [0, "hello !missing!str"]);
	}));
});


describe("round-3 stream directive placement", () => {
  it.effect("rejects a directive following an unterminated document across stream facades", () => Effect.gen(function* () {
    const source = "a\n---\n%YAML 1.2\n---\nb\n";
    assert.deepStrictEqual(A.map(composeAllDocuments(source).streamErrors, (error) => error.code), ["InvalidDirective"]);
    assertFailure(Result.mapError(Yaml.parseAllResult(source), (error) => A.map(error.diagnostics, (diagnostic) => diagnostic.code)), ["InvalidDirective"]);
    const result = yield* Effect.result(YamlDocument.parseAll(source));
    assertFailure(Result.mapError(result, (error) => A.map(error.diagnostics, (diagnostic) => diagnostic.code)), ["InvalidDirective"]);
    assert.strictEqual(YamlFormat.formatToString(source), source);
  }));
});
