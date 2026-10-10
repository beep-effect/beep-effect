import { assert, describe, it } from "@effect/vitest";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { ReferenceKeyword } from "../../effected/github-references/ClosingList.ts";
import { REFERENCE_KEYWORDS } from "../../effected/github-references/ClosingList.ts";
import type { ClosingKeyword } from "../../effected/github-references/IssueReferences.ts";
import { CLOSING_KEYWORDS } from "../../effected/github-references/IssueReferences.ts";
import { KeywordFamily, keywordFamily } from "../../effected/github-references/KeywordFamily.ts";

// Pure functions get pure tests, with no layer at all.

describe("KeywordFamily.keywordFamily", () => {
	it("defines exactly the four schema families reached by the twelve keywords", () => {
		assert.deepStrictEqual(KeywordFamily.literals, ["close", "fix", "resolve", "ref"]);
		assert.deepStrictEqual(R.values(KeywordFamily.Enum), [...KeywordFamily.literals]);
		for (const keyword of [...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS]) {
			assert.isTrue(S.is(KeywordFamily)(keywordFamily(keyword)), keyword);
		}
		for (const invalid of ["closes", "refs", "constructor", "toString", "__proto__"]) {
			assert.isFalse(S.is(KeywordFamily)(invalid), invalid);
		}
	});

	it("maps all twelve keywords — the projection is exhaustive", () => {
		// One row per keyword, spelled out: the test restates the table so a
		// drifted entry in the source record fails loudly, keyword by keyword.
		const expected: ReadonlyArray<readonly [ClosingKeyword | ReferenceKeyword, KeywordFamily]> = [
			["close", "close"],
			["closes", "close"],
			["closed", "close"],
			["fix", "fix"],
			["fixes", "fix"],
			["fixed", "fix"],
			["resolve", "resolve"],
			["resolves", "resolve"],
			["resolved", "resolve"],
			["ref", "ref"],
			["refs", "ref"],
			["references", "ref"],
		];
		assert.deepStrictEqual(
			expected.map(([keyword]) => keyword),
			[...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS],
		);
		for (const [keyword, family] of expected) {
			assert.strictEqual(keywordFamily(keyword), family, keyword);
		}
	});

	it("collapses each closing conjugation to its stem", () => {
		for (const keyword of CLOSING_KEYWORDS) {
			const family = keywordFamily(keyword);
			assert.isTrue(keyword.startsWith(family), keyword);
			assert.notStrictEqual(family, "ref", keyword);
		}
	});

	it("maps every reference keyword to the ref family", () => {
		for (const keyword of REFERENCE_KEYWORDS) {
			assert.strictEqual(keywordFamily(keyword), "ref", keyword);
		}
	});
});
