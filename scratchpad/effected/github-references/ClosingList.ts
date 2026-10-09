import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClosingKeyword } from "./IssueReferences.ts";

const $I = $ScratchpadId.create("effected/github-references/ClosingList");

// The closing-list dialect: one whole line naming several issues at once.
//
// The list dialect, alongside the two in `IssueReferences`: after trimming,
// the **entire** line must be `<keyword>[:] <list>` — keyword
// case-insensitive (lowercased to canonical form in the result), colon
// optional, and the list one or more `#<digits>` items separated by `,`,
// `and`, or the Oxford `, and`. Whitespace inside the line is `[ \t]` only,
// so an embedded newline cannot smuggle two lines past a parser whose
// contract is one — the same posture as the bare-line pattern. Any trailing
// content after the list rejects the line; duplicates are preserved in order,
// because whether `#1, #1` means one issue or two is the caller's business.
//
// Two keyword sets play here. `parseClosingList` accepts only the nine
// closing keywords and yields a `ClosingList`; `parseReferenceList`
// additionally accepts the non-closing `REFERENCE_KEYWORDS` (`ref`,
// `refs`, `references`) and reports which set matched via
// `ReferenceList`'s `closing` flag.
//
// An item whose digits exceed `Number.MAX_SAFE_INTEGER` rejects the **whole
// line**, where `harvestIssueReferences` merely skips the one match. The
// asymmetry is deliberate: a harvest drops one reference out of running
// prose, but a list line is a single claim about a set of issues, and
// returning the parseable subset would misrepresent the line as claiming
// less than it does.
//
// Complexity posture: parsing is a single left-to-right character scan —
// this module contains **no regular expressions at all** — so worst-case
// time is linear in the line length by construction. There is no
// backtracking engine to feed, no polynomial blow-up for a scanner to flag,
// and therefore no input truncation.
//
// Beyond the whole-line parsers, `harvestReferenceLists` generalizes
// the same list grammar to the inline-in-prose posture — several lists on
// one line of running text — and `parseClosingLists` /
// `parseReferenceLists` apply the whole-line parsers per line of a
// multi-line text. All of them ride the same character scan; the no-regex
// promise above covers every export here.

/**
 * The non-closing reference keywords the list dialect accepts, lowercased.
 *
 * @remarks
 * GitHub does not act on these — they associate without closing — but a
 * generated references region writes them, so the list parsers read them.
 *
 * @public
 */
export const ReferenceKeyword = LiteralKit(["ref", "refs", "references"]).annotate(
	$I.annote("ReferenceKeyword", { description: "A non-closing reference keyword in canonical lowercase form." }),
);

export type ReferenceKeyword = typeof ReferenceKeyword.Type;

export const REFERENCE_KEYWORDS = ReferenceKeyword.literals;

/**
 * Any closing or non-closing keyword accepted by the list dialect.
 *
 * @public
 */
export const ListKeyword = LiteralKit([...ClosingKeyword.literals, ...ReferenceKeyword.literals]).annotate(
	$I.annote("ListKeyword", { description: "A closing or non-closing keyword accepted by the list dialect." }),
);

export type ListKeyword = typeof ListKeyword.Type;

/**
 * The issues a closing-list line names, per {@link parseClosingList}.
 *
 * @public
 */
export const ClosingList = S.Struct({
	/** The matched closing keyword, lowercased to its canonical form. */
	keyword: ClosingKeyword.annotate($I.annote("ClosingList.keyword", { description: "The matched closing keyword in canonical lowercase form." })),
	/** The referenced issue numbers, duplicates preserved, in line order. */
	issueNumbers: S.Array(S.Int).annotate($I.annote("ClosingList.issueNumbers", { description: "The safe integer issue numbers in line order, including duplicates." })),
}).annotate($I.annote("ClosingList", { description: "The issues named by a whole closing-list line." }));

export type ClosingList = typeof ClosingList.Type;

/**
 * The issues a reference-list line names, per {@link parseReferenceList}.
 *
 * @public
 */
export const ReferenceList = S.Struct({
	/** The matched keyword, lowercased to its canonical form. */
	keyword: ListKeyword.annotate($I.annote("ReferenceList.keyword", { description: "The matched list keyword in canonical lowercase form." })),
	/** Whether the keyword is one of the nine closing keywords. */
	closing: S.Boolean.annotate($I.annote("ReferenceList.closing", { description: "Whether the keyword is a closing keyword." })),
	/** The referenced issue numbers, duplicates preserved, in line order. */
	issueNumbers: S.Array(S.Int).annotate($I.annote("ReferenceList.issueNumbers", { description: "The safe integer issue numbers in line order, including duplicates." })),
}).annotate($I.annote("ReferenceList", { description: "The issues named by a whole reference-list line with its closing flag." }));

export type ReferenceList = typeof ReferenceList.Type;

const HASH = 0x23; // #
const COLON = 0x3a; // :
const COMMA = 0x2c; // ,

/** `[ \t]` — the only whitespace the dialect admits, per the header comment. */
const isSpaceTab = (code: number): boolean => code === 0x20 || code === 0x09;

const isDigit = (code: number): boolean => code >= 0x30 && code <= 0x39;

const isAsciiLetter = (code: number): boolean => (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);

/** The index after the run of `[ \t]` starting at `from` (possibly `from` itself). */
const skipSpaceTab = (line: string, from: number): number => {
	let index = from;
	while (index < line.length && isSpaceTab(line.charCodeAt(index))) index += 1;
	return index;
};

/**
 * One list item at exactly `from`: `#<digits>` and the index one past it.
 * Digits exceeding `Number.MAX_SAFE_INTEGER` report `"unsafe"` rather than a
 * silently rounded issue number, still carrying the index one past the digit
 * run so a caller can skip the item's extent; the whole-line parsers reject
 * on it and {@link harvestReferenceLists} abandons the entire candidate —
 * a list never yields a partial reading.
 * Anything that is not `#<digits>` at all is `None`.
 */
const readItem = (
	line: string,
	from: number,
): O.Option<
	| { readonly kind: "item"; readonly value: number; readonly next: number }
	| { readonly kind: "unsafe"; readonly next: number }
> => {
	if (line.charCodeAt(from) !== HASH) return O.none();
	const start = from + 1;
	let index = start;
	while (index < line.length && isDigit(line.charCodeAt(index))) index += 1;
	if (index === start) return O.none();
	const value = Number(line.slice(start, index));
	return O.some(Number.isSafeInteger(value) ? { kind: "item", value, next: index } : { kind: "unsafe", next: index });
};

/**
 * One separator at exactly `from`: a comma with optional surrounding `[ \t]`
 * and an optional Oxford `and` (consumed only when its own trailing `[ \t]+`
 * is present), or a bare `and` requiring `[ \t]+` on both sides. `and` is
 * lowercase-only — the keyword head is case-insensitive, the separator is
 * not. Returns the index where the next item must start, or `None` when
 * no separator is present.
 */
const scanSeparator = (line: string, from: number): O.Option<number> => {
	const afterLeading = skipSpaceTab(line, from);
	if (line.charCodeAt(afterLeading) === COMMA) {
		const afterComma = skipSpaceTab(line, afterLeading + 1);
		if (line.startsWith("and", afterComma)) {
			const afterAnd = skipSpaceTab(line, afterComma + 3);
			if (afterAnd > afterComma + 3) return O.some(afterAnd);
		}
		return O.some(afterComma);
	}
	if (afterLeading > from && line.startsWith("and", afterLeading)) {
		const afterAnd = skipSpaceTab(line, afterLeading + 3);
		if (afterAnd > afterLeading + 3) return O.some(afterAnd);
	}
	return O.none();
};

/**
 * The scan walk: item, then separator, then item, until the cursor stands
 * exactly at the end of the string. Anything else — a malformed item, an
 * unknown separator, trailing content, an unsafe issue number — is
 * `None`, and the caller rejects the whole line.
 */
const parseItems = (line: string, from: number): O.Option<ReadonlyArray<number>> => {
	const issueNumbers: Array<number> = [];
	let cursor = from;
	for (;;) {
		const item = readItem(line, cursor);
		if (O.isNone(item) || item.value.kind === "unsafe") return O.none();
		issueNumbers.push(item.value.value);
		cursor = item.value.next;
		if (cursor === line.length) return O.some(issueNumbers);
		const next = scanSeparator(line, cursor);
		if (O.isNone(next)) return O.none();
		cursor = next.value;
	}
};

/**
 * The issue list a whole line carries under either keyword set, or
 * `Option.none()`.
 *
 * @remarks
 * Accepts the nine closing keywords plus {@link REFERENCE_KEYWORDS}, and
 * reports which set matched in the result's `closing` flag.
 *
 * After trimming, the **entire** line must be `<keyword>[:] <list>`: the
 * keyword is case-insensitive (lowercased in the result), the colon is
 * optional, and the list is one or more `#<digits>` items separated by `,`,
 * `and` or the Oxford `, and`. Whitespace inside the line is space or tab
 * only, so an embedded newline cannot smuggle a second line in. Any trailing
 * content rejects the line, and duplicates are preserved in order, because
 * whether `#1, #1` means one issue or two is the caller's business.
 *
 * An item whose digits exceed `Number.MAX_SAFE_INTEGER` rejects the **whole
 * line**, where {@link harvestIssueReferences} merely skips the one match: a
 * list line is a single claim about a set of issues, and returning the
 * parseable subset would misrepresent it. Parsing is a single left-to-right
 * scan with no regular expressions, so time is linear in the line length and
 * no input is truncated.
 *
 * @example
 * ```ts
 * import { parseReferenceList } from "./index.ts";
 * import * as O from "effect/Option";
 *
 * const list = parseReferenceList("Closes #247, #248 and #251");
 * // => Option.some({ keyword: "closes", closing: true, issueNumbers: [247, 248, 251] })
 * O.isNone(parseReferenceList("Closes #1 for the rest"));
 * // => true
 * ```
 *
 * @public
 */
export const parseReferenceList = (line: string): O.Option<ReferenceList> => {
	const trimmed = Str.trim(line);
	let letters = 0;
	while (letters < trimmed.length && isAsciiLetter(trimmed.charCodeAt(letters))) letters += 1;
	if (letters === 0) return O.none();
	const keyword = R.get<string, ListKeyword>(ListKeyword.Enum, Str.toLowerCase(trimmed.slice(0, letters)));
	if (O.isNone(keyword)) return O.none();
	let cursor = letters;
	if (trimmed.charCodeAt(cursor) === COLON) cursor += 1;
	const afterWhitespace = skipSpaceTab(trimmed, cursor);
	if (afterWhitespace === cursor) return O.none();
	const issueNumbers = parseItems(trimmed, afterWhitespace);
	return O.map(issueNumbers, (issueNumbers) => ({
		keyword: keyword.value,
		closing: R.has<string, ClosingKeyword>(ClosingKeyword.Enum, keyword.value),
		issueNumbers,
	}));
};

/**
 * Every reference list a text carries, line by line, whether a line is a
 * whole-line list or has lists inline in prose.
 *
 * @remarks
 * Handles a commit body that interleaves trailer lines with prose: each line is
 * tried as a whole-line reference list first ({@link parseReferenceList} —
 * colon-tolerant, per the line dialect), and only a line that is not one is
 * harvested inline ({@link harvestReferenceLists} — no colon, per the inline
 * dialect). The preference means a colon-less trailer line contributes its
 * list exactly once, never once per posture.
 *
 * Results carry no offsets, deliberately: this is the line-granular
 * composition, and a consumer that needs spans uses
 * {@link harvestReferenceLists} directly. Duplicates are preserved, in
 * document order.
 *
 * @public
 */
export const collectReferenceLists = (text: string): ReadonlyArray<ReferenceList> => {
	const lists: Array<ReferenceList> = [];
	for (const line of Str.split(text, "\n")) {
		const whole = parseReferenceList(line);
		if (O.isSome(whole)) {
			lists.push(whole.value);
			continue;
		}
		for (const harvested of harvestReferenceLists(line)) {
			lists.push({ keyword: harvested.keyword, closing: harvested.closing, issueNumbers: harvested.issueNumbers });
		}
	}
	return lists;
};

/**
 * The closing-only view of {@link parseReferenceList}: the list a whole line
 * carries under one of the nine closing keywords, or `Option.none()`.
 *
 * @remarks
 * A `Refs:` line is a valid reference list but not a closing one, so it
 * returns `Option.none()` here and `closing: false` from
 * {@link parseReferenceList}.
 *
 * @public
 */
export const parseClosingList = (line: string): O.Option<ClosingList> =>
	O.flatMap(parseReferenceList(line), (list) =>
		O.map(R.get<string, ClosingKeyword>(ClosingKeyword.Enum, list.keyword), (keyword) => ({ keyword, issueNumbers: list.issueNumbers })),
	);

/**
 * Every reference list a whole text carries, one whole-line list per line.
 *
 * @remarks
 * The per-line convenience over {@link parseReferenceList}: split on `"\n"`
 * (the parser's own trim absorbs a `"\r"`, so CRLF input needs no special
 * case), parse each line, and collect the accepted lists in line order.
 * Rejected lines simply contribute nothing. The results carry **no line
 * numbers** — deliberately, because most consumers only aggregate the
 * references; a consumer that needs positions keeps its own split loop.
 *
 * @public
 */
export const parseReferenceLists = (text: string): ReadonlyArray<ReferenceList> => {
	const lists: Array<ReferenceList> = [];
	for (const line of Str.split(text, "\n")) {
		const parsed = parseReferenceList(line);
		if (O.isSome(parsed)) lists.push(parsed.value);
	}
	return lists;
};

/**
 * Every closing list a whole text carries, one whole-line list per line.
 *
 * @remarks
 * The per-line convenience over {@link parseClosingList} — the closing-only
 * view of {@link parseReferenceLists}, with the same split-on-`"\n"`,
 * collect-the-accepted shape and the same deliberate absence of line
 * numbers: a consumer that needs positions keeps its own split loop.
 *
 * @public
 */
export const parseClosingLists = (text: string): ReadonlyArray<ClosingList> => {
	const lists: Array<ClosingList> = [];
	for (const line of Str.split(text, "\n")) {
		const parsed = parseClosingList(line);
		if (O.isSome(parsed)) lists.push(parsed.value);
	}
	return lists;
};

/** `[A-Za-z0-9_]` — the word-boundary alphabet the inline dialects use. */
const isWordChar = (code: number): boolean => isAsciiLetter(code) || isDigit(code) || code === 0x5f;

/**
 * The full JavaScript `\s` set, spelled as a predicate so the module keeps
 * its no-regex promise: ASCII whitespace, NEL-adjacent controls, and the
 * Unicode space separators. Only the keyword→first-item gap of
 * {@link harvestReferenceLists} admits this set — everything inside a list
 * stays `[ \t]`, per the header comment.
 */
const isAnyWhitespace = (code: number): boolean =>
	code === 0x20 ||
	(code >= 0x09 && code <= 0x0d) ||
	code === 0xa0 ||
	code === 0x1680 ||
	(code >= 0x2000 && code <= 0x200a) ||
	code === 0x2028 ||
	code === 0x2029 ||
	code === 0x202f ||
	code === 0x205f ||
	code === 0x3000 ||
	code === 0xfeff;

/**
 * A reference list harvested out of running text by
 * {@link harvestReferenceLists}, with the offsets a prose harvest needs.
 *
 * @public
 */
export const HarvestedReferenceList = S.Struct({
	...ReferenceList.fields,
	/** Offset of the first character of the matched keyword. */
	start: S.Int.annotate($I.annote("HarvestedReferenceList.start", { description: "The offset of the first character of the matched keyword." })),
	/** Offset one past the last digit of the last item. */
	end: S.Int.annotate($I.annote("HarvestedReferenceList.end", { description: "The offset one past the last digit of the last item." })),
}).annotate($I.annote("HarvestedReferenceList", { description: "A reference list harvested from prose with its match offsets." }));

export type HarvestedReferenceList = typeof HarvestedReferenceList.Type;

/**
 * Every reference list found inline in `text`, in document order.
 *
 * @remarks
 * The inline-in-prose posture generalized to lists:
 * `Closes #123, Fixes #456` in one line of a commit body yields two
 * single-item lists, where
 * `harvestIssueReferences` reads only the first reference of each and the
 * whole-line parsers read neither. The grammar per candidate:
 *
 * - The keyword is case-insensitive, drawn from either keyword set,
 *   lowercased to canonical form in the result, with `closing` reported by
 *   set membership. Word boundaries hold on both sides: the characters
 *   immediately before and after the keyword's letter run must not be
 *   `[A-Za-z0-9_]`, so `recloses #1` and `1closes #1` do not match.
 * - **No colon** — exactly like `harvestIssueReferences`, the colon spelling
 *   belongs to the line dialects ({@link parseReferenceList} and the
 *   bare-line parser), so `closes: #1` inline yields nothing.
 * - The keyword→first-item gap is any run of whitespace **including
 *   newlines**, mirroring the inline dialect's `\s+`.
 * - List continuation uses the `,` / `and` / Oxford separators with `[ \t]`
 *   whitespace only, so a list cannot continue past a newline — a later
 *   line makes its own claims.
 * - Items are `#<digits>`; duplicates are preserved in order.
 *
 * A list ends at its last valid item: in `closes #1 and fixes #2` the
 * ` and ` before `fixes` fails as a separator because what follows is not
 * `#`, so the text yields `closes: [1]` then `fixes: [2]`. An item past
 * `Number.MAX_SAFE_INTEGER` anywhere in a candidate skips the **entire**
 * candidate — never a partial list, for the same reason
 * {@link parseReferenceList} rejects the whole line — and scanning resumes
 * after the candidate's scanned extent.
 *
 * Like everything in this module, the harvest is a single left-to-right
 * character scan with no regular expressions, so time stays linear in the
 * text length and no input is truncated.
 *
 * @public
 */
export const harvestReferenceLists = (text: string): ReadonlyArray<HarvestedReferenceList> => {
	const lists: Array<HarvestedReferenceList> = [];
	let index = 0;
	while (index < text.length) {
		if (!isAsciiLetter(text.charCodeAt(index))) {
			index += 1;
			continue;
		}
		const runStart = index;
		let runEnd = index + 1;
		while (runEnd < text.length && isAsciiLetter(text.charCodeAt(runEnd))) runEnd += 1;
		if (
			(runStart > 0 && isWordChar(text.charCodeAt(runStart - 1))) ||
			(runEnd < text.length && isWordChar(text.charCodeAt(runEnd)))
		) {
			index = runEnd;
			continue;
		}
		const keyword = R.get<string, ListKeyword>(ListKeyword.Enum, Str.toLowerCase(text.slice(runStart, runEnd)));
		if (O.isNone(keyword)) {
			index = runEnd;
			continue;
		}
		let cursor = runEnd;
		while (cursor < text.length && isAnyWhitespace(text.charCodeAt(cursor))) cursor += 1;
		const first = cursor === runEnd ? O.none() : readItem(text, cursor);
		if (O.isNone(first)) {
			// No valid first item: resume right after the keyword run.
			index = runEnd;
			continue;
		}
		if (first.value.kind === "unsafe") {
			index = first.value.next;
			continue;
		}
		const issueNumbers: Array<number> = [first.value.value];
		let end = first.value.next;
		let unsafeNext: O.Option<number> = O.none();
		for (;;) {
			const next = scanSeparator(text, end);
			if (O.isNone(next)) break;
			const item = readItem(text, next.value);
			// A separator not followed by an item is prose, not grammar: the
			// list already ended at its last item and the separator stays
			// unconsumed for the outer scan.
			if (O.isNone(item)) break;
			if (item.value.kind === "unsafe") {
				unsafeNext = O.some(item.value.next);
				break;
			}
			issueNumbers.push(item.value.value);
			end = item.value.next;
		}
		if (O.isSome(unsafeNext)) {
			// One unsafe item poisons the whole candidate — never a partial
			// list — and scanning resumes after the candidate's extent.
			index = unsafeNext.value;
			continue;
		}
		lists.push({
			keyword: keyword.value,
			closing: R.has<string, ClosingKeyword>(ClosingKeyword.Enum, keyword.value),
			issueNumbers,
			start: runStart,
			end,
		});
		index = end;
	}
	return lists;
};
