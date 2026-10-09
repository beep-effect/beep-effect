import * as O from "effect/Option";
import * as S from "effect/Schema";

// GitHub's closing-keyword issue-reference grammar, as pure functions.
//
// GitHub links an issue to a pull request when the PR's description carries
// `<keyword> #<number>` for one of nine documented keywords. Consumers speak
// that grammar in two distinct dialects, and this module models exactly those
// two — no service, no layer, nothing but strings in and values out:
//
// - **Inline-in-prose** (`harvestIssueReferences`): a reference may appear anywhere in
//   running text — `"fixes #12 and closes #13"` — with mandatory whitespace
//   and **no colon**, because that is the spelling GitHub itself scans PR
//   bodies for. This is the dialect a release pipeline harvests from commit
//   subjects and PR descriptions.
// - **Bare-line** (`parseBareLineReference`): the whole line, after trimming, *is*
//   the reference — `"Closes: #12"` — with an **optional colon**, because a
//   generated references region writes one reference per line and a colon
//   reads better there. GitHub does not require the colon; the region format
//   allows it, so the parser must too. The dialects differ because their
//   producers do: prose is written by humans for GitHub's scanner, the region
//   is written by tooling for humans.
//
// Deliberately out of scope: cross-repo references (`owner/repo#N`) and
// full-URL references (`https://github.com/owner/repo/issues/N`). Both are
// real GitHub spellings, but neither dialect's producers emit them, and
// guessing at their shape here would freeze an API nobody has driven.

/**
 * The nine closing keywords GitHub documents, lowercased.
 *
 * @public
 */
export const CLOSING_KEYWORDS = [
	"close",
	"closes",
	"closed",
	"fix",
	"fixes",
	"fixed",
	"resolve",
	"resolves",
	"resolved",
] as const;

/**
 * One of the nine documented closing keywords, in canonical lowercase form.
 *
 * @public
 */
export type ClosingKeyword = (typeof CLOSING_KEYWORDS)[number];

const isClosingKeyword = S.is(S.Literals(CLOSING_KEYWORDS));

/**
 * One closing reference found in prose by {@link harvestIssueReferences}.
 *
 * @public
 */
export interface IssueReference {
	/** The referenced issue number. */
	readonly issueNumber: number;
	/** The matched keyword, lowercased to its canonical form. */
	readonly keyword: ClosingKeyword;
	/** Offset of the first character of the whole match (`keyword` through digits). */
	readonly start: number;
	/** Offset one past the last character of the whole match. */
	readonly end: number;
}

/**
 * The closing reference a bare line carries, per {@link parseBareLineReference}.
 *
 * @remarks
 * No offsets: in the bare-line dialect the whole line is the reference, so
 * positions within it locate nothing a caller acts on.
 *
 * @public
 */
export interface BareLineReference {
	/** The referenced issue number. */
	readonly issueNumber: number;
	/** The matched keyword, lowercased to its canonical form. */
	readonly keyword: ClosingKeyword;
}

/**
 * Both patterns derive from {@link CLOSING_KEYWORDS} so the constant and the
 * grammar cannot drift. Alternation order is safe: the regex engine backtracks
 * through alternatives, so `close` matching inside `closes` fails at the
 * mandatory `#`-introducer and retries the longer keyword.
 */
const KEYWORDS = CLOSING_KEYWORDS.join("|");

/** Inline-in-prose: mandatory whitespace, no colon. */
const INLINE_PATTERN = new RegExp(`\\b(${KEYWORDS})\\s+#(\\d+)`, "gi");

/**
 * Bare-line: optional colon, then mandatory same-line whitespace. `[ \t]`
 * rather than `\s`, so an embedded newline cannot smuggle two lines past a
 * parser whose contract is one.
 */
const BARE_LINE_PATTERN = new RegExp(`^(${KEYWORDS}):?[ \\t]+#(\\d+)$`, "i");

/**
 * `#<digits>` parsed to a number — or `undefined` when the digits exceed
 * `Number.MAX_SAFE_INTEGER`, because a silently rounded issue number is worse
 * than a skipped match. Callers skip such matches; they do not fail.
 */
const safeIssueNumber = (digits: string): number | undefined => {
	const value = Number(digits);
	return Number.isSafeInteger(value) ? value : undefined;
};

/**
 * Every inline closing reference in `text`, in document order.
 *
 * @remarks
 * The **inline-in-prose** dialect: case-insensitive `<keyword> #<number>`
 * anywhere in the text, whitespace mandatory, colon not accepted — a colon
 * spelling belongs to the bare-line dialect and {@link parseBareLineReference}.
 * Duplicates are preserved: whether `fixes #1, fixes #1` means one reference
 * or two is the caller's business, not a parser's.
 *
 * A match whose digits exceed `Number.MAX_SAFE_INTEGER` is skipped, not
 * misparsed. Cross-repo (`owner/repo#N`) and full-URL references are not
 * recognized.
 *
 * @example
 * ```ts
 * import { harvestIssueReferences } from "./index.ts";
 *
 * harvestIssueReferences("fixes #12 and closes #13");
 * // => [
 * //   { issueNumber: 12, keyword: "fixes", start: 0, end: 9 },
 * //   { issueNumber: 13, keyword: "closes", start: 14, end: 24 },
 * // ]
 * ```
 *
 * @public
 */
export const harvestIssueReferences = (text: string): ReadonlyArray<IssueReference> => {
	const references: Array<IssueReference> = [];
	for (const match of text.matchAll(INLINE_PATTERN)) {
		const issueNumber = safeIssueNumber(match[2] ?? "");
		if (issueNumber === undefined) continue;
		const keyword = (match[1] ?? "").toLowerCase();
		if (!isClosingKeyword(keyword)) continue;
		references.push({
			issueNumber,
			keyword,
			start: match.index,
			end: match.index + match[0].length,
		});
	}
	return references;
};

/**
 * The reference a whole line carries, or `Option.none()`.
 *
 * @remarks
 * The **bare-line** dialect: after trimming, the entire line must be
 * `<keyword>[:] #<number>` — keyword case-insensitive, colon optional,
 * whitespace before the `#` mandatory. Trailing prose, a missing keyword, or
 * anything else at all is a rejection, never a partial parse; a line carries
 * one reference or none. Digits past `Number.MAX_SAFE_INTEGER` reject too,
 * for the same reason {@link harvestIssueReferences} skips them.
 *
 * @example
 * ```ts
 * import { parseBareLineReference } from "./index.ts";
 *
 * parseBareLineReference("Closes: #12");
 * // => Option.some({ issueNumber: 12, keyword: "closes" })
 * ```
 *
 * @public
 */
export const parseBareLineReference = (line: string): O.Option<BareLineReference> => {
	const match = BARE_LINE_PATTERN.exec(line.trim());
	if (match === null) return O.none();
	const issueNumber = safeIssueNumber(match[2] ?? "");
	if (issueNumber === undefined) return O.none();
	const keyword = (match[1] ?? "").toLowerCase();
	if (!isClosingKeyword(keyword)) return O.none();
	return O.some({ issueNumber, keyword });
};

/**
 * Every bare-line reference a whole text carries, one per line.
 *
 * @remarks
 * The per-line convenience over {@link parseBareLineReference}: split on
 * `"\n"` (the parser's own trim absorbs a `"\r"`, so CRLF input needs no
 * special case), parse each line, and collect the accepted references in
 * line order. Rejected lines simply contribute nothing. The results carry
 * **no line numbers** — deliberately, because {@link BareLineReference} has
 * none and most consumers only aggregate the references; a consumer that
 * needs positions keeps its own split loop.
 *
 * @public
 */
export const parseBareLines = (text: string): ReadonlyArray<BareLineReference> => {
	const references: Array<BareLineReference> = [];
	for (const line of text.split("\n")) {
		const parsed = parseBareLineReference(line);
		if (O.isSome(parsed)) references.push(parsed.value);
	}
	return references;
};
