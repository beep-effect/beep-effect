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
