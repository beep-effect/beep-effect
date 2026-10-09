import { assert, describe, it } from "@effect/vitest";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeInlineNode } from "../../effected/markdown/internal/inlineNode.ts";
import type { InlineScanner } from "../../effected/markdown/internal/inlineTypes.ts";
import { DelimiterRun, scanDelims } from "../../effected/markdown/internal/inlines/emphasis.ts";

const scannerFor: {
	(subject: string, pos: number): InlineScanner;
	(pos: number): (subject: string) => InlineScanner;
} = dual(2, (subject: string, pos: number): InlineScanner => {
	const scanner: InlineScanner = {
		subject,
		pos,
		refmap: HashMap.empty(),
		footnoteLabels: HashSet.empty(),
		delimiters: undefined,
		brackets: undefined,
		peek: () => O.getOrElse(Str.charCodeAt(subject, scanner.pos), () => -1),
		match: () => undefined,
		matchAhead: () => undefined,
		hasAhead: () => false,
		closingBacktickRun: () => undefined,
		append: () => {},
		appendText: (value, from, to) => makeInlineNode("text", from, to, value),
		lastChild: () => undefined,
		unputText: () => false,
		trimTrailingSpaces: () => 0,
		removeDelimiter: () => {},
		addBracket: () => {},
		removeBracket: () => {},
		deactivateLinkOpeners: () => {},
		processEmphasis: () => {},
	};
	return scanner;
});

describe("delimiter measurements", () => {
	it("returns the same schema payload in both call forms and restores the cursor", () => {
		const scanner = scannerFor(" **word**", 1);
		const expected = O.some(DelimiterRun.make({ numdelims: 2, canOpen: true, canClose: false }));
		assert.deepStrictEqual(scanDelims(scanner, 0x2a), expected);
		assert.strictEqual(scanner.pos, 1);
		assert.deepStrictEqual(scanDelims(0x2a)(scanner), expected);
		assert.strictEqual(scanner.pos, 1);
	});

	it("returns None without advancing when the requested run is absent or at EOF", () => {
		for (const pos of [0, 1]) {
			const scanner = scannerFor("a", pos);
			assert.deepStrictEqual(scanDelims(scanner, 0x2a), O.none());
			assert.strictEqual(scanner.pos, pos);
			assert.deepStrictEqual(scanDelims(0x2a)(scanner), O.none());
			assert.strictEqual(scanner.pos, pos);
		}
	});

	it("derives validation from the three-field runtime contract", () => {
		const isRun = S.is(DelimiterRun);
		assert.isTrue(isRun({ numdelims: 2, canOpen: true, canClose: false }));
		assert.isFalse(isRun({ numdelims: "2", canOpen: true, canClose: false }));
		assert.isFalse(isRun({ numdelims: 2, canOpen: 1, canClose: false }));
		assert.isFalse(isRun({ numdelims: Number.POSITIVE_INFINITY, canOpen: true, canClose: false }));
	});

	it("counts delimiters and cursor offsets in UTF-16 units beside astral characters", () => {
		const scanner = scannerFor("😀__a__😀", 2);
		assert.deepStrictEqual(scanDelims(scanner, 0x5f), O.some({ numdelims: 2, canOpen: true, canClose: false }));
		assert.strictEqual(scanner.pos, 2);
		scanner.pos = 5;
		assert.deepStrictEqual(scanDelims(0x5f)(scanner), O.some({ numdelims: 2, canOpen: false, canClose: true }));
		assert.strictEqual(scanner.pos, 5);
	});

	it("does not step backward over an unpaired low surrogate", () => {
		const scanner = scannerFor("a\udc00_a", 2);
		assert.deepStrictEqual(scanDelims(scanner, 0x5f), O.some({ numdelims: 1, canOpen: false, canClose: false }));
		assert.strictEqual(scanner.pos, 2);
	});
});
