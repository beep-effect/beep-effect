import { assert, describe, it } from "@effect/vitest";
import { createScanner, lexAll } from "../../effected/yaml/internal/lexer.ts";

describe("lexer", () => {
	describe("anchor and alias token spans", () => {
		const text = "a: &anc 1\nb: *anc\n";

		it("anchor token span covers the & sigil and the full name", () => {
			const anchor = lexAll(text).find((t) => t.kind === "anchor");
			if (anchor === undefined) {
				assert.fail("expected an anchor token");
			}
			assert.strictEqual(text.slice(anchor.offset, anchor.offset + anchor.length), "&anc");
			assert.strictEqual(anchor.offset, text.indexOf("&anc"));
			assert.strictEqual(anchor.length, "&anc".length);
		});

		it("alias token span covers the * sigil and the full name", () => {
			const alias = lexAll(text).find((t) => t.kind === "alias");
			if (alias === undefined) {
				assert.fail("expected an alias token");
			}
			assert.strictEqual(text.slice(alias.offset, alias.offset + alias.length), "*anc");
			assert.strictEqual(alias.offset, text.indexOf("*anc"));
			assert.strictEqual(alias.length, "*anc".length);
		});

		it("anchor and alias token values stay the bare name without the sigil", () => {
			const tokens = lexAll(text);
			assert.strictEqual(tokens.find((t) => t.kind === "anchor")?.value, "anc");
			assert.strictEqual(tokens.find((t) => t.kind === "alias")?.value, "anc");
		});
	});

	describe("leading byte-order mark (#694)", () => {
		it("the BOM occupies no column, so the first line lexes at the same indent as the rest", () => {
			const tokens = lexAll("\uFEFFa: 1\nb: 2\n");
			const scalars = tokens.filter((t) => t.kind === "scalar" && (t.value === "a" || t.value === "b"));
			assert.deepStrictEqual(
				scalars.map((t) => t.column),
				[0, 0],
			);
			assert.strictEqual(tokens.filter((t) => t.kind === "block-map-start").length, 1);
		});

		it("setPosition replays the BOM without a column, matching scan", () => {
			const scanner = createScanner("\uFEFF---\na: 1\n");
			scanner.setPosition(1);
			assert.strictEqual(scanner.scan(), "document-start");
			assert.strictEqual(scanner.getTokenColumn(), 0);
		});
	});
});


describe("newline positions and scanner reset", () => {
	for (const newline of ["\r", "\r\n", "\n"]) {
		it(`counts ${JSON.stringify(newline)} once and resets indentation`, () => {
			const source = `a:${newline}  b: 1${newline}  c: 2${newline}d: 3${newline}`;
			const keys = lexAll(source).filter((token) => ["a", "b", "c", "d"].includes(token.value));
			assert.deepStrictEqual(keys.map((token) => [token.value, token.line, token.column]), [
				["a", 0, 0], ["b", 1, 2], ["c", 2, 2], ["d", 3, 0],
			]);
			const scanner = createScanner(source);
			while (scanner.scan() !== null) { /* Populate state before reset. */ }
			scanner.setPosition(source.indexOf("b"));
			assert.strictEqual(scanner.getToken(), null);
			assert.strictEqual(scanner.scan(), "scalar");
			assert.strictEqual(scanner.getTokenValue(), "b");
			assert.strictEqual(scanner.getTokenLine(), 1);
			assert.strictEqual(scanner.getTokenColumn(), 2);
			scanner.setPosition(source.indexOf("d"));
			assert.strictEqual(scanner.scan(), "scalar");
			assert.strictEqual(scanner.getTokenValue(), "d");
			assert.strictEqual(scanner.getTokenLine(), 3);
			assert.strictEqual(scanner.getTokenColumn(), 0);
			assert.strictEqual(scanner.scan(), "block-map-start");
			assert.strictEqual(scanner.getTokenColumn(), 0);
		});
	}
});

describe("plain scalar trailing whitespace", () => {
	for (const source of ["hello  ", "a: hello \t", "hello  : value"]) {
		it(`emits consumed whitespace separately for ${JSON.stringify(source)}`, () => {
			const tokens = lexAll(source);
			const scalar = tokens.find((token) => token.value === "hello");
			assert.isDefined(scalar);
			assert.strictEqual(scalar?.length, 5);
			const whitespace = tokens.find((token) => token.kind === "whitespace" && token.offset === (scalar?.offset ?? 0) + 5);
			assert.isDefined(whitespace);
			assert.strictEqual(whitespace?.column, (scalar?.column ?? 0) + 5);
			assert.strictEqual(tokens.map((token) => source.slice(token.offset, token.offset + token.length)).join(""), source);
		});
	}
});

describe("double quoted escape dispatch", () => {
	it("preserves every simple escape substitution", () => {
		const escapes = ["\\", '"', "/", "b", "f", "n", "r", "\t", "t", "0", "a", "e", "v", " ", "N", "_", "L", "P"];
		const expected = ["\\", '"', "/", "\b", "\f", "\n", "\r", "\t", "\t", "\0", "\x07", "\x1B", "\x0B", " ", "\u0085", "\u00A0", "\u2028", "\u2029"];
		const source = '"' + escapes.map((escape) => "\\" + escape).join("") + '"';
		const tokens = lexAll(source);
		assert.strictEqual(tokens.length, 1);
		assert.strictEqual(tokens[0]?.kind, "scalar");
		assert.strictEqual(tokens[0]?.value, expected.join(""));
		assert.strictEqual(tokens[0]?.length, source.length);
	});
	it("retains hex escapes, line continuations and invalid-escape errors", () => {
		const source = '"\\x41\\u0042\\U00000043\\\n  D\\\r\n  E\\\r  F"';
		assert.strictEqual(lexAll(source)[0]?.value, "ABCDEF");
		for (const invalid of ['"\\q"', '"\\xGG"', '"\\u00GG"', '"\\U00110000"']) {
			assert.strictEqual(lexAll(invalid)[0]?.kind, "error");
		}
	});
});
