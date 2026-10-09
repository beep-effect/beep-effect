import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import {
	CLOSING_KEYWORDS,
	harvestIssueReferences,
	parseBareLineReference,
	parseBareLines,
} from "../../effected/github-references/IssueReferences.ts";

// Pure classes get pure tests, with no layer at all.

const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

describe("IssueReferences.harvestIssueReferences", () => {
	it("exports exactly the nine documented keywords", () => {
		assert.deepStrictEqual(
			[...CLOSING_KEYWORDS],
			["close", "closes", "closed", "fix", "fixes", "fixed", "resolve", "resolves", "resolved"],
		);
	});

	it("finds every documented keyword, whatever the case, lowercased to canonical form", () => {
		for (const keyword of CLOSING_KEYWORDS) {
			for (const spelled of [keyword, keyword.toUpperCase(), capitalized(keyword)]) {
				const found = harvestIssueReferences(`This ${spelled} #12 today`);
				assert.lengthOf(found, 1, spelled);
				assert.strictEqual(found[0]?.keyword, keyword, spelled);
				assert.strictEqual(found[0]?.issueNumber, 12, spelled);
			}
		}
	});

	it("offsets span the whole match, keyword through digits", () => {
		const text = "chore: Fixes #12 and closes #345 done";
		const found = harvestIssueReferences(text);
		assert.lengthOf(found, 2);
		assert.strictEqual(text.slice(found[0]?.start, found[0]?.end), "Fixes #12");
		assert.strictEqual(text.slice(found[1]?.start, found[1]?.end), "closes #345");
	});

	it("keeps duplicates, in document order — dedup is the caller's business", () => {
		const found = harvestIssueReferences("fixes #1, fixes #1 and closes #2");
		assert.deepStrictEqual(
			found.map((reference) => reference.issueNumber),
			[1, 1, 2],
		);
	});

	it("any run of whitespace separates keyword and number, per the prose dialect", () => {
		assert.strictEqual(harvestIssueReferences("fixes  #7")[0]?.issueNumber, 7);
		assert.strictEqual(harvestIssueReferences("fixes\n#7")[0]?.issueNumber, 7);
	});

	it("rejects what the inline dialect does not say", () => {
		const negatives = [
			"fixes#12", // keyword without the mandatory whitespace
			"fixesX #12", // not a keyword
			"prefixes #12", // the keyword must start at a word boundary
			"#12", // a bare number references nothing
			"fixes owner/repo#3", // cross-repo is out of scope this round
			"fixes: #12", // the colon belongs to the bare-line dialect
		];
		for (const text of negatives) assert.lengthOf(harvestIssueReferences(text), 0, text);
	});

	it("skips a number too big to represent rather than misparsing it", () => {
		// 2^53 + 1 rounds under Number; a silently-wrong issue number is worse
		// than a skipped match, so the match is dropped and its neighbours kept.
		const found = harvestIssueReferences("fixes #9007199254740993 and closes #2");
		assert.deepStrictEqual(
			found.map((reference) => reference.issueNumber),
			[2],
		);
	});

	it("keeps Number.MAX_SAFE_INTEGER itself — the guard is strict, not fuzzy", () => {
		assert.strictEqual(
			harvestIssueReferences(`fixes #${Number.MAX_SAFE_INTEGER}`)[0]?.issueNumber,
			Number.MAX_SAFE_INTEGER,
		);
	});
});

describe("IssueReferences.parseBareLineReference", () => {
	it("accepts every keyword, with and without the colon, whatever the case", () => {
		for (const keyword of CLOSING_KEYWORDS) {
			for (const line of [
				`${keyword} #7`,
				`${keyword}: #7`,
				`${capitalized(keyword)}: #7`,
				`${keyword.toUpperCase()} #7`,
			]) {
				const parsed = parseBareLineReference(line);
				assert.isTrue(O.isSome(parsed), line);
				const reference = O.getOrThrow(parsed);
				assert.strictEqual(reference.keyword, keyword, line);
				assert.strictEqual(reference.issueNumber, 7, line);
			}
		}
	});

	it("trims surrounding whitespace before parsing", () => {
		const parsed = parseBareLineReference("   Closes: #12\t ");
		assert.strictEqual(O.getOrThrow(parsed).issueNumber, 12);
	});

	it("rejects everything that is not exactly one bare reference", () => {
		const negatives = [
			"fixes #12 because reasons", // trailing prose
			"see fixes #12", // leading prose
			"fixes:#12", // colon without the mandatory space
			"fixes#12", // no separator at all
			"fixes 12", // no #
			"#12", // no keyword
			"fixes owner/repo#3", // cross-repo is out of scope this round
			"fixes #1 #2", // one reference max
			"fixes\n#12", // an embedded newline means this was never one line
			"", // an empty line carries nothing
		];
		for (const line of negatives) assert.isTrue(O.isNone(parseBareLineReference(line)), line);
	});

	it("rejects a number past Number.MAX_SAFE_INTEGER rather than rounding it", () => {
		assert.isTrue(O.isNone(parseBareLineReference("fixes #9007199254740993")));
		assert.isTrue(O.isSome(parseBareLineReference(`fixes #${Number.MAX_SAFE_INTEGER}`)));
	});
});

describe("IssueReferences.parseBareLines", () => {
	it("collects the accepted lines in order, skipping the rejecting ones", () => {
		const text = ["Closes: #12", "some prose between", "fixes #7", "", "fixes #1 trailing prose", "Resolved #9"].join(
			"\n",
		);
		assert.deepStrictEqual(parseBareLines(text), [
			{ issueNumber: 12, keyword: "closes" },
			{ issueNumber: 7, keyword: "fixes" },
			{ issueNumber: 9, keyword: "resolved" },
		]);
	});

	it("handles CRLF input — the per-line trim absorbs the carriage return", () => {
		const text = "Closes: #1\r\nfixes #2\r\n";
		assert.deepStrictEqual(parseBareLines(text), [
			{ issueNumber: 1, keyword: "closes" },
			{ issueNumber: 2, keyword: "fixes" },
		]);
	});

	it("returns an empty array for empty text and for text with no references", () => {
		assert.deepStrictEqual(parseBareLines(""), []);
		assert.deepStrictEqual(parseBareLines("just prose\nacross lines\n"), []);
	});

	it("keeps duplicate lines — dedup is the caller's business", () => {
		assert.deepStrictEqual(parseBareLines("fixes #1\nfixes #1"), [
			{ issueNumber: 1, keyword: "fixes" },
			{ issueNumber: 1, keyword: "fixes" },
		]);
	});
});
