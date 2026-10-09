/**
 * Token position-fidelity conformance (#129).
 *
 * The invariant the whole lint layer rests on: every diagnostic position and
 * every autofix span is a token position. The public `text` field is the raw
 * source slice BY CONSTRUCTION (see YamlToken.ts), so the falsifiable
 * invariant pinned here is the COVERAGE contract: across every
 * yaml-test-suite fixture — valid AND invalid alike, since the tokenizer is
 * total — the tokens must be in order and non-overlapping, every gap between
 * consecutive tokens must be horizontal-whitespace-only (the lexer consumes
 * some insignificant whitespace without emitting a token, e.g. the run
 * before a `:` indicator), every non-whitespace source unit must be covered,
 * and each token's `line`/`character` must agree with a direct scan.
 */

import { assert, describe, it } from "@effect/vitest";
import * as Result from "effect/Result";
import { YamlTokens } from "../../../effected/yaml/index.ts";
import { loadAllTestCases } from "./support/suite.ts";

const allCases = loadAllTestCases();

/** Zero-based line/character of `offset` by direct scan. */
function positionOf(text: string, offset: number): { line: number; character: number } {
	let line = 0;
	let lineStart = 0;
	for (let i = 0; i < offset && i < text.length; i++) {
		if (text[i] === "\n") {
			line++;
			lineStart = i + 1;
		}
	}
	return { line, character: offset - lineStart };
}

describe("token position fidelity (yaml-test-suite corpus)", () => {
	it("tokens cover every fixture: ordered, non-overlapping, whitespace-only gaps", () => {
		let tokensChecked = 0;
		for (const tc of allCases) {
			const result = YamlTokens.tokenize(tc.yaml);
			// The tokenizer is total: error-kind tokens, never a failure.
			assert.isTrue(Result.isSuccess(result), `tokenize failed for ${tc.id}`);
			if (!Result.isSuccess(result)) continue;
			let cursor = 0;
			for (const token of result.success) {
				// Ordered and non-overlapping; any gap must be horizontal
				// whitespace only. (Synthetic zero-length structural markers
				// sit AT the cursor.)
				if (token.offset < cursor) {
					assert.fail(`[${tc.id}] ${token.kind}@${token.offset}: overlaps previous token ending at ${cursor}`);
				}
				if (token.offset > cursor && !/^[ \t\r]*$/.test(tc.yaml.slice(cursor, token.offset))) {
					assert.fail(
						`[${tc.id}] ${token.kind}@${token.offset}: non-whitespace gap ${JSON.stringify(tc.yaml.slice(cursor, token.offset))}`,
					);
				}
				if (token.text !== tc.yaml.slice(token.offset, token.offset + token.length)) {
					assert.fail(`[${tc.id}] ${token.kind}@${token.offset}: text disagrees with its slice`);
				}
				const pos = positionOf(tc.yaml, token.offset);
				if (pos.line !== token.line || pos.character !== token.character) {
					assert.fail(
						`[${tc.id}] ${token.kind}@${token.offset}: claimed ${token.line}:${token.character}, actual ${pos.line}:${pos.character}`,
					);
				}
				cursor = token.offset + token.length;
				tokensChecked++;
			}
			// Full coverage: nothing but horizontal whitespace may follow the
			// last token.
			if (cursor < tc.yaml.length && !/^[ \t\r\n]*$/.test(tc.yaml.slice(cursor))) {
				assert.fail(`[${tc.id}] tokens cover ${cursor} of ${tc.yaml.length} source units`);
			}
		}
		// The corpus is large; a vacuous walk would be a false green. (The
		// full suite yields ~6.4k tokens today; the floor only guards against
		// an accidentally-empty walk, not an exact count.)
		assert.isAbove(tokensChecked, 5_000, "corpus walk must actually check tokens");
	});
});
