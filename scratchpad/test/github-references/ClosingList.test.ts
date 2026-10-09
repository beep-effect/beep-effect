import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import {
	REFERENCE_KEYWORDS,
	collectReferenceLists,
	harvestReferenceLists,
	parseClosingList,
	parseClosingLists,
	parseReferenceList,
	parseReferenceLists,
} from "../../effected/github-references/ClosingList.ts";
import { CLOSING_KEYWORDS } from "../../effected/github-references/IssueReferences.ts";

// Pure functions get pure tests, with no layer at all.

const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

describe("ClosingList.parseClosingList", () => {
	it("exports exactly the three reference keywords", () => {
		assert.deepStrictEqual([...REFERENCE_KEYWORDS], ["ref", "refs", "references"]);
	});

	it("accepts every closing keyword, with and without the colon", () => {
		for (const keyword of CLOSING_KEYWORDS) {
			for (const line of [`${keyword} #7`, `${keyword}: #7`]) {
				const parsed = parseClosingList(line);
				assert.isTrue(Option.isSome(parsed), line);
				const list = Option.getOrThrow(parsed);
				assert.strictEqual(list.keyword, keyword, line);
				assert.deepStrictEqual([...list.issueNumbers], [7], line);
			}
		}
	});

	it("lowercases the keyword to canonical form, whatever the case", () => {
		for (const line of ["CLOSES: #1, #2", "Closes: #1, #2", "cLoSeS #1, #2"]) {
			const list = Option.getOrThrow(parseClosingList(line));
			assert.strictEqual(list.keyword, "closes", line);
			assert.deepStrictEqual([...list.issueNumbers], [1, 2], line);
		}
	});

	it("parses a comma list, an and list, the Oxford comma, and a mix", () => {
		const cases: ReadonlyArray<readonly [string, ReadonlyArray<number>]> = [
			["Closes: #1, #2, #3", [1, 2, 3]],
			["Closes #1 and #2", [1, 2]],
			["Closes: #1, #2, and #3", [1, 2, 3]],
			["fixes #1, #2 and #3", [1, 2, 3]],
		];
		for (const [line, expected] of cases) {
			const parsed = parseClosingList(line);
			assert.isTrue(Option.isSome(parsed), line);
			assert.deepStrictEqual([...Option.getOrThrow(parsed).issueNumbers], expected, line);
		}
	});

	it("keeps duplicates, in line order — dedup is the caller's business", () => {
		const list = Option.getOrThrow(parseClosingList("closes #1, #1, and #2"));
		assert.deepStrictEqual([...list.issueNumbers], [1, 1, 2]);
	});

	it("trims surrounding whitespace before parsing", () => {
		const list = Option.getOrThrow(parseClosingList("   Closes: #12, #13\t "));
		assert.deepStrictEqual([...list.issueNumbers], [12, 13]);
	});

	it("rejects everything that is not exactly one whole-line list", () => {
		const negatives = [
			"Closes: 123", // the # is mandatory
			"closes #1 because reasons", // trailing prose after the list
			"see closes #1", // leading prose
			"closes #1, #2 done", // trailing prose after a longer list
			"closes #1, and", // Oxford comma with no final item
			"closes #1 and", // dangling and
			"closes #1,", // dangling comma
			"closes:#1", // colon without the mandatory space
			"closes#1", // no separator at all
			"closes", // keyword without a list
			"closes\n#1", // an embedded newline means this was never one line
			"closes #1,\n#2", // ...even between items
			"closes #1 android #2", // and must stand alone
			"closes owner/repo#3", // cross-repo is out of scope
			"#1, #2", // no keyword
			"", // an empty line carries nothing
			"complete garbage", // not the grammar at all
		];
		for (const line of negatives) assert.isTrue(Option.isNone(parseClosingList(line)), line);
	});

	it("rejects the WHOLE line when any item exceeds Number.MAX_SAFE_INTEGER", () => {
		// Contrast the harvest dialect, which skips the one bad match: a list is
		// a single claim about a set of issues, and a partial list misrepresents.
		assert.isTrue(Option.isNone(parseClosingList("closes #1, #9007199254740993, #2")));
		assert.isTrue(Option.isNone(parseClosingList("closes #9007199254740993")));
	});

	it("keeps Number.MAX_SAFE_INTEGER itself — the guard is strict, not fuzzy", () => {
		const list = Option.getOrThrow(parseClosingList(`closes #${Number.MAX_SAFE_INTEGER}`));
		assert.deepStrictEqual([...list.issueNumbers], [Number.MAX_SAFE_INTEGER]);
	});

	it("returns none for a Refs line — reference keywords are not closing", () => {
		for (const keyword of REFERENCE_KEYWORDS) {
			assert.isTrue(Option.isNone(parseClosingList(`${keyword}: #1, #2`)), keyword);
		}
	});

	it("keeps the separator case-sensitive while the keyword is not", () => {
		// The keyword head lowercases; the `and` separator is grammar, not prose.
		assert.isTrue(Option.isSome(parseClosingList("CLOSES #1 and #2")));
		assert.isTrue(Option.isNone(parseClosingList("closes #1 AND #2")));
		assert.isTrue(Option.isNone(parseClosingList("closes #1, And #2")));
	});

	it("stays linear on hostile input — long runs of tabs and huge lists", () => {
		// The scan is a single pass with no regex engine behind it; these would
		// hang a backtracking list pattern and must simply answer, fast.
		const tabs = "\t".repeat(100_000);
		assert.isTrue(Option.isNone(parseClosingList(`closes${tabs}x`)));
		assert.isTrue(Option.isNone(parseClosingList(`closes #1,${tabs}and#2`)));
		assert.isTrue(Option.isNone(parseClosingList(`closes #1${tabs}x`)));
		const wide = `closes ${Array.from({ length: 5_000 }, (_, index) => `#${index + 1}`).join(", ")}`;
		const list = Option.getOrThrow(parseClosingList(wide));
		assert.strictEqual(list.issueNumbers.length, 5_000);
		assert.strictEqual(list.issueNumbers[4_999], 5_000);
	});
});

describe("ClosingList.parseReferenceList", () => {
	it("accepts a reference-keyword line and reports closing: false", () => {
		for (const keyword of REFERENCE_KEYWORDS) {
			for (const line of [`${keyword} #7`, `${keyword}: #7, #8`, `${capitalized(keyword)}: #7`]) {
				const parsed = parseReferenceList(line);
				assert.isTrue(Option.isSome(parsed), line);
				const list = Option.getOrThrow(parsed);
				assert.strictEqual(list.keyword, keyword, line);
				assert.isFalse(list.closing, line);
			}
		}
	});

	it("accepts every closing keyword too, and reports closing: true", () => {
		for (const keyword of CLOSING_KEYWORDS) {
			const list = Option.getOrThrow(parseReferenceList(`${keyword}: #1 and #2`));
			assert.strictEqual(list.keyword, keyword);
			assert.isTrue(list.closing);
			assert.deepStrictEqual([...list.issueNumbers], [1, 2]);
		}
	});

	it("shares the closing dialect's rejections", () => {
		const negatives = [
			"refs: 123", // the # is mandatory
			"refs #1 trailing", // trailing prose
			"refs\n#1", // embedded newline
			"refs #9007199254740993", // unsafe integer rejects the whole line
			"reference #1", // not a listed keyword spelling
			"", // an empty line carries nothing
		];
		for (const line of negatives) assert.isTrue(Option.isNone(parseReferenceList(line)), line);
	});
});

describe("ClosingList.parseReferenceLists", () => {
	it("collects the accepted lines in order, skipping the rejecting ones", () => {
		const text = ["Closes: #1, #2", "prose between the lists", "Refs: #3 and #4", "closes #5 trailing", ""].join("\n");
		assert.deepStrictEqual(parseReferenceLists(text), [
			{ keyword: "closes", closing: true, issueNumbers: [1, 2] },
			{ keyword: "refs", closing: false, issueNumbers: [3, 4] },
		]);
	});

	it("handles CRLF input — the per-line trim absorbs the carriage return", () => {
		assert.deepStrictEqual(parseReferenceLists("Closes: #1\r\nRefs: #2\r\n"), [
			{ keyword: "closes", closing: true, issueNumbers: [1] },
			{ keyword: "refs", closing: false, issueNumbers: [2] },
		]);
	});

	it("returns an empty array for empty text and for text with no lists", () => {
		assert.deepStrictEqual(parseReferenceLists(""), []);
		assert.deepStrictEqual(parseReferenceLists("just prose\nacross lines"), []);
	});
});

describe("ClosingList.parseClosingLists", () => {
	it("is the closing-only view: a Refs line contributes nothing", () => {
		const text = ["Closes: #1, #2", "Refs: #3", "Fixed #4"].join("\n");
		assert.deepStrictEqual(parseClosingLists(text), [
			{ keyword: "closes", issueNumbers: [1, 2] },
			{ keyword: "fixed", issueNumbers: [4] },
		]);
	});

	it("handles CRLF input and empty text", () => {
		assert.deepStrictEqual(parseClosingLists("closes #1\r\nfixes #2"), [
			{ keyword: "closes", issueNumbers: [1] },
			{ keyword: "fixes", issueNumbers: [2] },
		]);
		assert.deepStrictEqual(parseClosingLists(""), []);
	});
});

describe("ClosingList.harvestReferenceLists", () => {
	it("harvests two lists with different keywords from one line, offsets exact", () => {
		const text = "Closes #123, Fixes #456";
		const found = harvestReferenceLists(text);
		// `, Fixes` fails as a separator continuation because what follows the
		// comma is not `#`, so this is two single-item lists, not one of three.
		assert.deepStrictEqual(
			found.map((list) => ({ keyword: list.keyword, closing: list.closing, issueNumbers: [...list.issueNumbers] })),
			[
				{ keyword: "closes", closing: true, issueNumbers: [123] },
				{ keyword: "fixes", closing: true, issueNumbers: [456] },
			],
		);
		assert.strictEqual(text.slice(found[0]?.start, found[0]?.end), "Closes #123");
		assert.strictEqual(text.slice(found[1]?.start, found[1]?.end), "Fixes #456");
	});

	it("ends a list at its last item when a separator leads to a new keyword", () => {
		const text = "Closes #1, #2 and fixes #3";
		const found = harvestReferenceLists(text);
		assert.deepStrictEqual(
			found.map((list) => ({ keyword: list.keyword, issueNumbers: [...list.issueNumbers] })),
			[
				{ keyword: "closes", issueNumbers: [1, 2] },
				{ keyword: "fixes", issueNumbers: [3] },
			],
		);
		assert.strictEqual(text.slice(found[0]?.start, found[0]?.end), "Closes #1, #2");
		assert.strictEqual(text.slice(found[1]?.start, found[1]?.end), "fixes #3");
	});

	it("reports a reference-keyword list with closing: false", () => {
		const found = harvestReferenceLists("see refs #4, #5 and #6 for background");
		assert.lengthOf(found, 1);
		assert.strictEqual(found[0]?.keyword, "refs");
		assert.isFalse(found[0]?.closing);
		assert.deepStrictEqual([...(found[0]?.issueNumbers ?? [])], [4, 5, 6]);
	});

	it("parses the comma, and, and Oxford separators inside one candidate", () => {
		const found = harvestReferenceLists("This resolves #1, #2, and #3 at last");
		assert.lengthOf(found, 1);
		assert.deepStrictEqual([...(found[0]?.issueNumbers ?? [])], [1, 2, 3]);
	});

	it("lowercases the keyword to canonical form and keeps duplicates", () => {
		const found = harvestReferenceLists("CLOSES #1, #1 and #2");
		assert.strictEqual(found[0]?.keyword, "closes");
		assert.deepStrictEqual([...(found[0]?.issueNumbers ?? [])], [1, 1, 2]);
	});

	it("crosses a newline between keyword and first item, but never inside a list", () => {
		// The keyword→first-item gap mirrors the inline dialect's \s+ ...
		const gapped = harvestReferenceLists("closes\n#1, #2");
		assert.deepStrictEqual([...(gapped[0]?.issueNumbers ?? [])], [1, 2]);
		// ...while list continuation stays [ \t]-only: a later line makes its
		// own claims, so the newline ends the list at #1.
		const split = harvestReferenceLists("closes #1,\n#2");
		assert.lengthOf(split, 1);
		assert.deepStrictEqual([...(split[0]?.issueNumbers ?? [])], [1]);
	});

	it("holds word boundaries on both sides of the keyword", () => {
		for (const text of ["recloses #1", "1closes #1", "_closes #1", "closes2 #1", "closes_ #1"]) {
			assert.deepStrictEqual(harvestReferenceLists(text), [], text);
		}
	});

	it("rejects the colon inline — the colon spelling belongs to the line dialects", () => {
		// The same contrast harvestIssueReferences pins: GitHub's prose scanner
		// does not read `closes: #1`, but the whole-line dialects do.
		assert.deepStrictEqual(harvestReferenceLists("closes: #1"), []);
		assert.isTrue(Option.isSome(parseReferenceList("closes: #1")));
		assert.isTrue(Option.isSome(parseClosingList("closes: #1")));
	});

	it("requires whitespace between keyword and first item", () => {
		assert.deepStrictEqual(harvestReferenceLists("closes#1"), []);
	});

	it("skips the WHOLE candidate on an unsafe item, then keeps scanning", () => {
		// Never a partial list — the same reasoning as parseReferenceList — but
		// prose after the poisoned candidate still gets harvested.
		const found = harvestReferenceLists("closes #1, #9007199254740993 and fixes #2");
		assert.deepStrictEqual(
			found.map((list) => ({ keyword: list.keyword, issueNumbers: [...list.issueNumbers] })),
			[{ keyword: "fixes", issueNumbers: [2] }],
		);
		assert.deepStrictEqual(harvestReferenceLists("closes #9007199254740993"), []);
	});

	it("keeps Number.MAX_SAFE_INTEGER itself — the guard is strict, not fuzzy", () => {
		const found = harvestReferenceLists(`closes #${Number.MAX_SAFE_INTEGER}`);
		assert.deepStrictEqual([...(found[0]?.issueNumbers ?? [])], [Number.MAX_SAFE_INTEGER]);
	});

	it("keeps the separator case-sensitive while the keyword is not", () => {
		const found = harvestReferenceLists("closes #1 AND #2");
		assert.lengthOf(found, 1);
		assert.deepStrictEqual([...(found[0]?.issueNumbers ?? [])], [1]);
	});

	it("yields nothing from prose with no references, and from empty text", () => {
		assert.deepStrictEqual(harvestReferenceLists(""), []);
		assert.deepStrictEqual(harvestReferenceLists("nothing to see here, honestly"), []);
		assert.deepStrictEqual(harvestReferenceLists("the fix closed the gap"), []);
	});

	it("stays linear on hostile input — long runs of tabs and newlines", () => {
		// Same posture as the whole-line parsers: a single pass with no regex
		// engine behind it must simply answer, fast.
		const tabs = "\t".repeat(100_000);
		const newlines = "\n".repeat(100_000);
		assert.deepStrictEqual(harvestReferenceLists(`closes${tabs}x`), []);
		const gapped = harvestReferenceLists(`closes${newlines}#1`);
		assert.deepStrictEqual([...(gapped[0]?.issueNumbers ?? [])], [1]);
		const dangling = harvestReferenceLists(`closes #1,${tabs}and#2`);
		assert.lengthOf(dangling, 1);
		assert.deepStrictEqual([...(dangling[0]?.issueNumbers ?? [])], [1]);
	});
});

describe("ClosingList.collectReferenceLists", () => {
	it("collects a colon trailer line the inline harvest cannot see", () => {
		const lists = collectReferenceLists("Closes: #1, #2");
		assert.lengthOf(lists, 1);
		assert.deepStrictEqual([...(lists[0]?.issueNumbers ?? [])], [1, 2]);
		assert.isTrue(lists[0]?.closing);
	});

	it("harvests prose lines that are not whole-line lists", () => {
		const lists = collectReferenceLists("merged after review; closes #7, #8 and refs #9");
		assert.deepStrictEqual(
			lists.map((list) => [list.keyword, [...list.issueNumbers]]),
			[
				["closes", [7, 8]],
				["refs", [9]],
			],
		);
	});

	it("never counts a colon-less trailer line once per posture", () => {
		// The line parses whole-line AND would harvest inline; preference means one list.
		const lists = collectReferenceLists("closes #1, #2");
		assert.lengthOf(lists, 1);
	});

	it("interleaves both postures across lines, in document order, with no offsets", () => {
		const text = ["Fixes: #10", "prose mentioning closes #11 and refs #12, #13", "", "not grammar at all"].join("\n");
		const lists = collectReferenceLists(text);
		assert.deepStrictEqual(
			lists.map((list) => [list.keyword, list.closing, [...list.issueNumbers]]),
			[
				["fixes", true, [10]],
				["closes", true, [11]],
				["refs", false, [12, 13]],
			],
		);
		for (const list of lists) assert.isFalse("start" in list);
	});

	it("returns an empty array for empty or referenceless text", () => {
		assert.deepStrictEqual([...collectReferenceLists("")], []);
		assert.deepStrictEqual([...collectReferenceLists("no references here\nnor here")], []);
	});
});
