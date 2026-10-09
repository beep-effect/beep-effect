/**
 * GitHub's issue-reference grammar as pure functions: strings in, values out,
 * with no service, layer or client.
 *
 * GitHub links an issue to a pull request when the description carries
 * `<keyword> #<number>` for one of nine documented closing keywords
 * ({@link CLOSING_KEYWORDS}). Three dialects are modelled, because their
 * producers differ:
 *
 * - **Inline-in-prose** — {@link harvestIssueReferences} finds references
 *   anywhere in running text (`fixes #12 and closes #13`), with mandatory
 *   whitespace and **no colon**, the spelling GitHub itself scans for. Each hit
 *   carries offsets.
 * - **Bare-line** — {@link parseBareLineReference} reads a whole trimmed line
 *   that *is* the reference (`Closes: #12`), with an **optional colon**, the
 *   form a generated references region writes. {@link parseBareLines} applies
 *   it across a text.
 * - **List** — {@link parseClosingList} and {@link parseReferenceList} read a
 *   whole line naming several issues (`Closes #247, #248 and #251`);
 *   {@link harvestReferenceLists} finds such lists inline in prose, and
 *   {@link collectReferenceLists} handles a text mixing both. The non-closing
 *   {@link REFERENCE_KEYWORDS} (`ref`, `refs`, `references`) are read by the
 *   reference-list functions and reported with `closing: false`.
 *
 * Every dialect requires the `#`, preserves duplicates in order, and rejects or
 * skips a number past `Number.MAX_SAFE_INTEGER` rather than rounding it.
 * {@link keywordFamily} collapses any keyword to its stem for categorizing
 * results. Cross-repo (`owner/repo#N`) and full-URL references are not
 * recognized.
 *
 * @packageDocumentation
 */

export {
	ClosingList,
	HarvestedReferenceList,
	ListKeyword,
	REFERENCE_KEYWORDS,
	ReferenceKeyword,
	ReferenceList,
	collectReferenceLists,
	harvestReferenceLists,
	parseClosingList,
	parseClosingLists,
	parseReferenceList,
	parseReferenceLists,
} from "./ClosingList.ts";
export {
	BareLineReference,
	CLOSING_KEYWORDS,
	ClosingKeyword,
	IssueReference,
	harvestIssueReferences,
	parseBareLineReference,
	parseBareLines,
} from "./IssueReferences.ts";
export { KeywordFamily, keywordFamily } from "./KeywordFamily.ts";
