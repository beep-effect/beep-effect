import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { parse } from "yaml";
import * as Effect from "effect/Effect";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlMap, YamlPair, YamlScalar, YamlSeq, type YamlNode } from "../../effected/yaml/YamlNode.ts";
import { composeFirstDocument } from "../../effected/yaml/internal/composer/document.ts";
import { MAX_NESTING_DEPTH } from "../../effected/yaml/internal/composer/state.ts";
import type { RawYamlDocument } from "../../effected/yaml/internal/raw-document.ts";
import {
	renderDoubleQuoted,
	StringifyDepthExceeded,
	StringifyFailure,
	stringifyDocument,
	stringifyValue,
	stripNodeComments,
} from "../../effected/yaml/internal/stringifier.ts";

function document(contents: YamlNode): RawYamlDocument {
	return {
		contents,
		errors: [],
		warnings: [],
		directives: [],
		hasDocumentStart: false,
		hasDocumentEnd: false,
		hasDocumentStartTab: false,
	};
}

function captureFailure(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
	assert.fail("Expected the stringifier to throw");
}

const isDepthFailure = S.is(StringifyDepthExceeded);
const isStringifyFailure = S.is(StringifyFailure);
const scalar = YamlScalar.make({ value: "leaf", style: "plain", offset: 0, length: 4, comment: "remove me" });

describe("stringifier data-first defaults", () => {
	it("returns strings when the optional arguments are omitted", () => {
		assert.strictEqual(stringifyValue({ finalNewline: false }), "finalNewline: false\n");
		assert.strictEqual(stringifyValue(undefined), "null\n");
		assert.strictEqual(stringifyValue(42, { finalNewline: false }), "42");
		assert.strictEqual(stringifyDocument(document(scalar)), "leaf\n");
		assert.strictEqual(stringifyDocument(document(scalar), { finalNewline: false }), "leaf");
		assert.strictEqual(renderDoubleQuoted("é"), '"é"');
		assert.strictEqual(renderDoubleQuoted("é", true), '"\\u00E9"');
	});
});

describe("large-integer AST fidelity", () => {
	for (const spelling of ["9007199254740993", "-9007199254740993", "0x20000000000001", "0o400000000000000001"]) {
		for (const input of [`${spelling}\n`, `n: ${spelling}\n`, `[${spelling}]\n`]) {
			it(`preserves the unquoted bigint value in ${input.trim()}`, () => {
				const before = composeFirstDocument(input);
				assert.deepStrictEqual(before.errors, []);
				for (const forceDefaultStyles of [false, true]) {
					const output = stringifyDocument(before, { forceDefaultStyles });
					const numericText = BigInt(spelling).toString();
					const expected =
						forceDefaultStyles && input.startsWith("[") ? `- ${numericText}\n` : input.replace(spelling, numericText);
					assert.strictEqual(output, expected);
					assert.deepStrictEqual(parse(output, { intAsBigInt: true }), parse(input, { intAsBigInt: true }));
					const after = composeFirstDocument(output);
					assert.deepStrictEqual(after.errors, []);
					assert.deepStrictEqual(after.contents?.toValue(), before.contents?.toValue());
				}
			});
		}
	}
	it("preserves an available bigint raw spelling", () => {
		const node = YamlScalar.make({
			value: 9007199254740993n,
			raw: "0x20000000000001",
			style: "plain",
			offset: 0,
			length: 16,
		});
		for (const forceDefaultStyles of [false, true]) {
			assert.strictEqual(stringifyDocument(document(node), { forceDefaultStyles }), "0x20000000000001\n");
		}
	});

	it("renders a synthetic bigint without raw text as an unquoted number", () => {
		const node = YamlScalar.make({ value: 9007199254740993n, style: "plain", offset: 0, length: 16 });
		assert.strictEqual(stringifyDocument(document(node)), "9007199254740993\n");
	});
});

describe("canonical preprocessing nesting limit", () => {
	it("accepts the boundary and guards both mapping keys and values before descending", () => {
		assert.isUndefined(stripNodeComments(scalar, MAX_NESTING_DEPTH).comment);
		for (const node of [
			YamlSeq.make({ items: [scalar], style: "block", offset: 0, length: 0 }),
			YamlMap.make({ items: [YamlPair.make({ key: scalar, value: null })], style: "block", offset: 0, length: 0 }),
			YamlMap.make({ items: [YamlPair.make({ key: scalar, value: scalar })], style: "block", offset: 0, length: 0 }),
		]) {
			const error = captureFailure(() => stripNodeComments(node, MAX_NESTING_DEPTH));
			assert.isTrue(isDepthFailure(error));
		}
		const valueSequence = YamlSeq.make({ items: [scalar], style: "block", offset: 0, length: 0 });
		const map = YamlMap.make({
			items: [YamlPair.make({ key: scalar, value: valueSequence })],
			style: "block",
			offset: 0,
			length: 0,
		});
		assert.isTrue(isDepthFailure(captureFailure(() => stripNodeComments(map, MAX_NESTING_DEPTH - 1))));
	});
	it("throws the same typed error for a 50,000-deep AST in normal and canonical modes", () => {
		let node: YamlNode = scalar;
		// Each node is well-shaped; skip recursive validation while building the
		// deliberately excessive tree so the stringifier owns the limit check.
		for (let i = 0; i < 50_000; i++) {
			node = YamlSeq.make({ items: [node], style: "block", offset: 0, length: 0 }, { disableChecks: true });
		}
		for (const forceDefaultStyles of [false, true]) {
			const error = captureFailure(() => stringifyDocument(document(node), { forceDefaultStyles }));
			assert.isTrue(isDepthFailure(error));
			if (isDepthFailure(error)) {
				assert.strictEqual(error.name, "StringifyDepthExceeded");
				assert.strictEqual(error.message, `Nesting depth exceeded maximum of ${MAX_NESTING_DEPTH}`);
			}
		}
	});
});

describe("ancestor identity and tagged errors", () => {
	it("accepts shared references and structurally equal distinct values without marking them", () => {
		const first = { key: [1, 2] };
		const second = { key: [1, 2] };
		assert.isTrue(Equal.equals(first, second));
		const values = [first, second, first];
		assert.deepStrictEqual(parse(stringifyValue(values)), values);
		assert.isTrue(Equal.equals(first, second));
	});
	it("rejects object and array cycles while preserving reason, message, name and tag", () => {
		const object: Record<string, unknown> = {};
		object.self = object;
		const array: unknown[] = [];
		array.push(array);
		for (const value of [object, array, { child: { back: object } }]) {
			const error = captureFailure(() => stringifyValue(value));
			assert.isTrue(isStringifyFailure(error));
			if (isStringifyFailure(error)) {
				assert.strictEqual(error.reason, "Circular reference detected");
				assert.strictEqual(error.message, error.reason);
				assert.strictEqual(error.name, "StringifyFailure");
				assert.strictEqual(error._tag, "StringifyFailure");
			}
		}
		assert.strictEqual(stringifyValue({ okay: true }), "okay: true\n");
	});
	it("exposes schema errors and lawful construction helpers", () => {
		assert.isTrue(S.isSchema(StringifyFailure));
		assert.isTrue(S.isSchema(StringifyDepthExceeded));
		assert.isTrue(isStringifyFailure(StringifyFailure.new("test reason")));
		assert.isTrue(isDepthFailure(StringifyDepthExceeded.new()));
		const decoded = Result.getOrThrow(
			S.decodeResult(StringifyFailure)({ _tag: "StringifyFailure", message: "decoded", reason: "decoded" }),
		);
		assert.isTrue(isStringifyFailure(decoded));
		assert.strictEqual(decoded.name, "StringifyFailure");
		assert.strictEqual(decoded.reason, "decoded");
	});
});

describe("stable key ordering", () => {
	it("sorts value keys lexically and leaves the source intact", () => {
		const value = { z: 1, a: 2, b: 3 };
		assert.strictEqual(stringifyValue(value, { sortKeys: true }), "a: 2\nb: 3\nz: 1\n");
		assert.strictEqual(stringifyValue(value), "z: 1\na: 2\nb: 3\n");
	});
	it("preserves stable scalar-coercion ties and non-scalar fallback ordering", () => {
		const key = (value: unknown) => YamlScalar.make({ value, style: "plain", offset: 0, length: 1 });
		const items = [
			YamlPair.make({ key: key("z"), value: key("last") }),
			YamlPair.make({ key: key(1), value: key("first") }),
			YamlPair.make({ key: key("1"), value: key("second") }),
			YamlPair.make({
				key: YamlSeq.make({ items: [key("c")], style: "block", offset: 0, length: 1 }),
				value: key("complex"),
			}),
		];
		const node = YamlMap.make({ items, style: "block", offset: 0, length: 0 });
		assert.strictEqual(
			stringifyDocument(document(node), { sortKeys: true }),
			"? - c\n: complex\n1: first\n'1': second\nz: last\n",
		);
		assert.strictEqual(node.items[0], items[0]);
	});
});


describe("scalar rendering fidelity", () => {
	it.effect("round-trips newline-only values through public block-style options", () => Effect.gen(function* () {
		for (const defaultScalarStyle of ["block-literal", "block-folded"] as const) {
			for (const value of ["\n", "\n\n", "\n\n\n"]) {
				for (const forceDefaultStyles of [false, true]) {
					const text = yield* Yaml.stringify(value, { defaultScalarStyle, forceDefaultStyles });
					assert.strictEqual(parse(text), value);
					assert.strictEqual(yield* Yaml.parse(text), value);
				}
			}
		}
	}));
	it.effect("round-trips interior trailing and continuation-leading whitespace canonically", () => Effect.gen(function* () {
		for (const defaultScalarStyle of ["plain", "single-quoted"] as const) {
			for (const value of ["a \nb", "a\t\nb", "a\n b", "a\n\tb", "a \n\nb", "a\n \tb"]) {
				const text = yield* Yaml.stringify(value, { defaultScalarStyle, forceDefaultStyles: true });
				assert.strictEqual(text, `${renderDoubleQuoted(value, true)}\n`);
				assert.strictEqual(parse(text), value);
				assert.strictEqual(yield* Yaml.parse(text), value);
			}
		}
	}));
	it.effect("escapes required block indentation outside the single-digit range", () => Effect.gen(function* () {
		for (const defaultScalarStyle of ["block-literal", "block-folded"] as const) {
			for (const indent of [0, 10]) {
				for (const value of [" x", " x\ny", "\n\nx"]) {
					for (const forceDefaultStyles of [false, true]) {
						const text = yield* Yaml.stringify(value, { defaultScalarStyle, indent, forceDefaultStyles });
						assert.strictEqual(text, `${renderDoubleQuoted(value, forceDefaultStyles)}\n`);
						assert.strictEqual(parse(text), value);
						assert.strictEqual(yield* Yaml.parse(text), value);
					}
				}
			}
		}
	}));
	it("matches af7566a9 oracle bytes for representable canonical trailing-newline strings", () => {
		// Pinned upstream stringifier.ts returns renderSingleQuotedMultiline unchanged.
		const value = "first\nsecond\n";
		const oracleBytes = "'first\n\n  second\n\n'\n";
		for (const style of ["plain", "single-quoted"] as const) {
			assert.strictEqual(stringifyValue(value, { defaultScalarStyle: style, forceDefaultStyles: true }), oracleBytes);
			const node = YamlScalar.make({ value, style, offset: 0, length: value.length });
			assert.strictEqual(stringifyDocument(document(node), { forceDefaultStyles: true }), oracleBytes);
		}
		assert.strictEqual(parse(oracleBytes), value);
	});
	it.effect("uses escaped quotes for nested trailing-newline canonical scalars", () => Effect.gen(function* () {
		// af7566a9 emits an unindented closing quote here, rejected by yaml@2.9.0.
		for (const style of ["plain", "single-quoted"] as const) {
			const value = "first\nsecond\n";
			const leaf = YamlScalar.make({ value, style, offset: 0, length: value.length });
			const key = YamlScalar.make({ value: "key", style: "plain", offset: 0, length: 3 });
			const sequence = YamlSeq.make({ items: [leaf], style: "block", offset: 0, length: 1 });
			const mapping = YamlMap.make({ items: [YamlPair.make({ key, value: leaf })], style: "block", offset: 0, length: 1 });
			for (const input of [[value], { key: value }]) {
				const text = stringifyValue(input, { defaultScalarStyle: style, forceDefaultStyles: true });
				assert.deepStrictEqual(parse(text), input);
				assert.deepStrictEqual(yield* Yaml.parse(text), input);
			}
			for (const node of [sequence, mapping]) {
				const text = stringifyDocument(document(node), { forceDefaultStyles: true });
				assert.deepStrictEqual(parse(text), node.toValue());
				assert.deepStrictEqual(yield* Yaml.parse(text), node.toValue());
			}
		}
	}));
	it.effect("escapes multiline and block-style scalars in flow values and keys", () => Effect.gen(function* () {
		for (const defaultScalarStyle of ["plain", "single-quoted", "double-quoted", "block-literal", "block-folded"] as const) {
			for (const forceDefaultStyles of [false, true]) {
				for (const value of ["a\nb", "a \n b", "one line"]) {
					for (const input of [[value], { [value]: value }]) {
						const text = yield* Yaml.stringify(input, { defaultCollectionStyle: "flow", defaultScalarStyle, forceDefaultStyles, lineWidth: 8 });
						assert.deepStrictEqual(parse(text), input);
						assert.deepStrictEqual(yield* Yaml.parse(text), input);
					}
					const leaf = YamlScalar.make({ value, style: defaultScalarStyle, offset: 0, length: value.length });
					const sequence = YamlSeq.make({ items: [leaf], style: "flow", offset: 0, length: 1 });
					const mapping = YamlMap.make({ items: [YamlPair.make({ key: leaf, value: leaf })], style: "flow", offset: 0, length: 1 });
					for (const node of [sequence, mapping]) {
						const text = stringifyDocument(document(node), { defaultCollectionStyle: "flow", forceDefaultStyles, lineWidth: 8 });
						assert.deepStrictEqual(parse(text), node.toValue());
						assert.deepStrictEqual(yield* Yaml.parse(text), node.toValue());
					}
				}
			}
		}
	}));
	it.effect("escapes controls and lone CR before explicit style dispatch", () => Effect.gen(function* () {
		for (const defaultScalarStyle of ["single-quoted", "block-literal", "block-folded"] as const) {
			for (const value of ["a\u0000b", "a\u001bb", "a\rb", "a\u0000b\nc"]) {
				for (const forceDefaultStyles of [false, true]) {
					const text = yield* Yaml.stringify(value, { defaultScalarStyle, forceDefaultStyles });
					assert.strictEqual(text, `${renderDoubleQuoted(value, forceDefaultStyles)}\n`);
					assert.strictEqual(parse(text), value);
					assert.strictEqual(yield* Yaml.parse(text), value);
					const node = YamlScalar.make({ value, style: defaultScalarStyle, offset: 0, length: value.length });
					const astText = stringifyDocument(document(node), { forceDefaultStyles });
					assert.strictEqual(astText, text);
					assert.strictEqual(yield* Yaml.parse(astText), value);
				}
			}
		}
	}));
});
