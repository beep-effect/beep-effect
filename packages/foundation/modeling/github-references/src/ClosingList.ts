/**
 * The closing-list dialect: one whole line naming several issues at once.
 *
 * **Details**
 *
 * The list dialect, alongside the two in `IssueReferences`: after trimming,
 * the **entire** line must be `<keyword>[:] <list>` — keyword
 * case-insensitive (lowercased to canonical form in the result), colon
 * optional, and the list one or more `#<digits>` items separated by `,`,
 * `and`, or the Oxford `, and`. Whitespace inside the line is `[ \t]` only,
 * so an embedded newline cannot smuggle two lines past a parser whose
 * contract is one — the same posture as the bare-line pattern. Any trailing
 * content after the list rejects the line; duplicates are preserved in order,
 * because whether `#1, #1` means one issue or two is the caller's business.
 *
 * Two keyword sets play here. `parseClosingList` accepts only the nine
 * closing keywords and yields a `ClosingList`; `parseReferenceList`
 * additionally accepts the non-closing `REFERENCE_KEYWORDS` (`ref`,
 * `refs`, `references`) and reports which set matched via
 * `ReferenceList`'s `closing` flag.
 *
 * An item whose digits exceed `Number.MAX_SAFE_INTEGER` rejects the **whole
 * line**, where `harvestIssueReferences` merely skips the one match. The
 * asymmetry is deliberate: a harvest drops one reference out of running
 * prose, but a list line is a single claim about a set of issues, and
 * returning the parseable subset would misrepresent the line as claiming
 * less than it does.
 *
 * Complexity posture: parsing is a single left-to-right character scan —
 * this module contains **no regular expressions at all** — so worst-case
 * time is linear in the line length by construction. There is no
 * backtracking engine to feed, no polynomial blow-up for a scanner to flag,
 * and therefore no input truncation.
 *
 * Beyond the whole-line parsers, `harvestReferenceLists` generalizes
 * the same list grammar to the inline-in-prose posture — several lists on
 * one line of running text — and `parseClosingLists` /
 * `parseReferenceLists` apply the whole-line parsers per line of a
 * multi-line text. All of them ride the same character scan; the no-regex
 * promise above covers every export here.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubReferencesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClosingKeyword } from "./IssueReferences.ts";
import type * as A from "effect/Array";

const $I = $GithubReferencesId.create("ClosingList");

/**
 * The non-closing reference keywords the list dialect accepts, lowercased.
 *
 * **Details**
 *
 * GitHub does not act on these — they associate without closing — but a
 * generated references region writes them, so the list parsers read them.
 *
 * **Example** (Recognize a non-closing keyword)
 *
 * ```ts
 * import { ReferenceKeyword } from "@beep/github-references/ClosingList";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ReferenceKeyword)("refs")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ReferenceKeyword = LiteralKit(["ref", "refs", "references"]).pipe(
  $I.annoteSchema("ReferenceKeyword", { description: "A non-closing reference keyword in canonical lowercase form." })
);

/**
 * The decoded representation accepted by {@link ReferenceKeyword}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ReferenceKeyword = typeof ReferenceKeyword.Type;

/**
 * Lists the non-closing reference keywords in canonical lowercase form.
 *
 * **Example** (Read the non-closing keyword spellings)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { REFERENCE_KEYWORDS } from "@beep/github-references/ClosingList";
 *
 * console.log(A.join(REFERENCE_KEYWORDS, ",")); // ref,refs,references
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REFERENCE_KEYWORDS = ReferenceKeyword.literals;

/**
 * Any closing or non-closing keyword accepted by the list dialect.
 *
 * **Example** (Recognize both keyword sets)
 *
 * ```ts
 * import { ListKeyword } from "@beep/github-references/ClosingList";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ListKeyword)("fixes")); // true
 * console.log(S.is(ListKeyword)("refs")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ListKeyword = LiteralKit([...ClosingKeyword.literals, ...ReferenceKeyword.literals]).pipe(
  $I.annoteSchema("ListKeyword", { description: "A closing or non-closing keyword accepted by the list dialect." })
);

/**
 * The decoded representation accepted by {@link ListKeyword}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ListKeyword = typeof ListKeyword.Type;

const LIST_KEYWORD_BY_NAME: R.ReadonlyRecord<string, ListKeyword> = ListKeyword.Enum;
const CLOSING_KEYWORD_BY_NAME: R.ReadonlyRecord<string, ClosingKeyword> = ClosingKeyword.Enum;

/**
 * The issues a closing-list line names, per {@link parseClosingList}.
 *
 * **Example** (Validate a closing list with duplicates)
 *
 * ```ts
 * import { ClosingList } from "@beep/github-references/ClosingList";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ClosingList)({ keyword: "closes", issueNumbers: [12, 12] })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ClosingList extends S.Opaque<ClosingList, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The matched closing keyword, lowercased to its canonical form. */
    keyword: ClosingKeyword.pipe(
      $I.annoteKey("ClosingList.keyword", { description: "The matched closing keyword in canonical lowercase form." })
    ),
    /** The referenced issue numbers, duplicates preserved, in line order. */
    issueNumbers: S.NonEmptyArray(S.Natural).pipe(
      $I.annoteKey("ClosingList.issueNumbers", {
        description: "The safe integer issue numbers in line order, including duplicates.",
      })
    ),
  }).pipe($I.annoteSchema("ClosingList", { description: "The issues named by a whole closing-list line." }))
) {}

const ClosingFlagMatchesKeyword = S.makeFilter(
  (list: { readonly keyword: ListKeyword; readonly closing: boolean }) =>
    list.closing === S.is(ClosingKeyword)(list.keyword),
  $I.annote("ClosingFlagMatchesKeyword", {
    description: "The closing flag equals membership in the closing keyword domain.",
    message: "Expected closing to match the keyword's closing classification.",
  })
);

/**
 * The issues a reference-list line names, per {@link parseReferenceList}.
 *
 * **Example** (Validate a non-closing reference list)
 *
 * ```ts
 * import { ReferenceList } from "@beep/github-references/ClosingList";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ReferenceList)({ keyword: "refs", closing: false, issueNumbers: [7, 8] })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ReferenceList extends S.Opaque<ReferenceList, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The matched keyword, lowercased to its canonical form. */
    keyword: ListKeyword.pipe(
      $I.annoteKey("ReferenceList.keyword", { description: "The matched list keyword in canonical lowercase form." })
    ),
    /** Whether the keyword is one of the nine closing keywords. */
    closing: S.Boolean.pipe(
      $I.annoteKey("ReferenceList.closing", { description: "Whether the keyword is a closing keyword." })
    ),
    /** The referenced issue numbers, duplicates preserved, in line order. */
    issueNumbers: S.NonEmptyArray(S.Natural).pipe(
      $I.annoteKey("ReferenceList.issueNumbers", {
        description: "The safe integer issue numbers in line order, including duplicates.",
      })
    ),
  })
    .check(ClosingFlagMatchesKeyword)
    .pipe(
      $I.annoteSchema("ReferenceList", {
        description: "The issues named by a whole reference-list line with its closing flag.",
      })
    )
) {}

const HASH = "#";
const COLON = ":";
const COMMA = ",";

const isSpaceTab = (char: string | undefined): boolean => char === " " || char === "\t";

const isDigit = (char: string | undefined): boolean => char !== undefined && char >= "0" && char <= "9";

const isAsciiLetter = (char: string | undefined): boolean =>
  char !== undefined && ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z"));

const skipSpaceTab: {
  (line: string, from: number): number;
  (from: number): (line: string) => number;
} = dual(2, (line: string, from: number): number => {
  let index = from;
  while (index < line.length && isSpaceTab(line[index])) index += 1;
  return index;
});

const ItemScan = S.TaggedUnion({
  item: {
    value: S.Natural.pipe($I.annoteKey("ItemScan.item.value", { description: "The safely parsed issue number." })),
    next: S.Natural.pipe($I.annoteKey("ItemScan.item.next", { description: "The offset after the item." })),
  },
  unsafe: {
    next: S.Natural.pipe(
      $I.annoteKey("ItemScan.unsafe.next", { description: "The offset after the unsafe digit run." })
    ),
  },
  miss: {},
}).pipe(
  $I.annoteSchema("ItemScan", { description: "An item, unsafe digit run or absent item in the internal scanner." })
);
type ItemScan = typeof ItemScan.Type;
const SHARED_ITEM_MISS: ItemScan = { _tag: "miss" };
type ItemFound = Exclude<ItemScan, { readonly _tag: "miss" }>;

const readItem: {
  (line: string, from: number): ItemScan;
  (from: number): (line: string) => ItemScan;
} = dual(2, (line: string, from: number): ItemScan => {
  if (line[from] !== HASH) return SHARED_ITEM_MISS;
  const start = from + 1;
  let index = start;
  let value = 0;
  while (index < line.length && isDigit(line[index])) {
    value = value * 10 + Number(line[index]);
    index += 1;
  }
  if (index === start) return SHARED_ITEM_MISS;
  return Number.isSafeInteger(value) ? { _tag: "item", value, next: index } : { _tag: "unsafe", next: index };
});

const afterAndWithTrailingSpaceTabElse = (line: string, from: number, fallback: number): number => {
  if (Str.slice(from, from + 3)(line) !== "and") return fallback;
  const afterAnd = skipSpaceTab(line, from + 3);
  return afterAnd > from + 3 ? afterAnd : fallback;
};

const scanLowercaseOnlySeparator: {
  (line: string, from: number): number;
  (from: number): (line: string) => number;
} = dual(2, (line: string, from: number): number => {
  const afterLeading = skipSpaceTab(line, from);
  if (line[afterLeading] === COMMA) {
    const afterComma = skipSpaceTab(line, afterLeading + 1);
    return afterAndWithTrailingSpaceTabElse(line, afterComma, afterComma);
  }
  return afterLeading > from ? afterAndWithTrailingSpaceTabElse(line, afterLeading, from) : from;
});

const parseItems: {
  (line: string, from: number): O.Option<A.NonEmptyReadonlyArray<number>>;
  (from: number): (line: string) => O.Option<A.NonEmptyReadonlyArray<number>>;
} = dual(2, (line: string, from: number): O.Option<A.NonEmptyReadonlyArray<number>> => {
  const first = readItem(line, from);
  if (first._tag !== "item") return O.none();
  const issueNumbers: A.NonEmptyArray<number> = [first.value];
  let cursor = first.next;
  while (cursor < line.length) {
    const next = scanLowercaseOnlySeparator(line, cursor);
    if (next === cursor) return O.none();
    const item = readItem(line, next);
    if (item._tag !== "item") return O.none();
    issueNumbers.push(item.value);
    cursor = item.next;
  }
  return O.some(issueNumbers);
});

/**
 * The issue list a whole line carries under either keyword set, or
 * `Option.none()`.
 *
 * **Details**
 *
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
 * **Example** (Parse a closing issue list and reject trailing prose)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { parseReferenceList } from "@beep/github-references/ClosingList";
 * import * as O from "effect/Option";
 *
 * const list = parseReferenceList("Closes #247, #248 and #251");
 * console.log(O.map(list, (value) => A.join(A.map(value.issueNumbers, String), ",")).pipe(O.getOrUndefined)); // 247,248,251
 * console.log(O.isNone(parseReferenceList("Closes #1 for the rest"))); // true
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const parseReferenceList = (line: string): O.Option<ReferenceList> => {
  const trimmed = Str.trim(line);
  let letters = 0;
  while (letters < trimmed.length && isAsciiLetter(trimmed[letters])) letters += 1;
  if (letters === 0) return O.none();
  const keyword = R.get(LIST_KEYWORD_BY_NAME, Str.toLowerCase(Str.slice(0, letters)(trimmed)));
  if (O.isNone(keyword)) return O.none();
  let cursor = letters;
  if (trimmed[cursor] === COLON) cursor += 1;
  const afterWhitespace = skipSpaceTab(trimmed, cursor);
  if (afterWhitespace === cursor) return O.none();
  const issueNumbers = parseItems(trimmed, afterWhitespace);
  if (O.isNone(issueNumbers)) return O.none();
  return ReferenceList.makeOption({
    keyword: keyword.value,
    closing: R.has(CLOSING_KEYWORD_BY_NAME, keyword.value),
    issueNumbers: issueNumbers.value,
  });
};

/**
 * Every reference list a text carries, line by line, whether a line is a
 * whole-line list or has lists inline in prose.
 *
 * **Details**
 *
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
 * **Example** (Collect trailers and prose without counting twice)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { collectReferenceLists } from "@beep/github-references/ClosingList";
 * const lists = collectReferenceLists("Fixes: #10\nprose mentioning closes #11");
 * console.log(A.join(A.map(lists, (list) => A.join(A.map(list.issueNumbers, String), ",")), ";")); // 10;11
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
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
      lists.push(
        ReferenceList.make({
          keyword: harvested.keyword,
          closing: harvested.closing,
          issueNumbers: harvested.issueNumbers,
        })
      );
    }
  }
  return lists;
};

/**
 * The closing-only view of {@link parseReferenceList}: the list a whole line
 * carries under one of the nine closing keywords, or `Option.none()`.
 *
 * **Details**
 *
 * A `Refs:` line is a valid reference list but not a closing one, so it
 * returns `Option.none()` here and `closing: false` from
 * {@link parseReferenceList}.
 *
 * **Example** (Accept closing keywords and reject reference keywords)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { parseClosingList } from "@beep/github-references/ClosingList";
 * import * as O from "effect/Option";
 *
 * console.log(O.map(parseClosingList("Fixes #1, #2, and #3"), (value) => A.join(A.map(value.issueNumbers, String), ",")).pipe(O.getOrUndefined)); // 1,2,3
 * console.log(O.isNone(parseClosingList("Refs #7, #8"))); // true
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const parseClosingList = (line: string): O.Option<ClosingList> =>
  O.flatMap(parseReferenceList(line), (list) =>
    O.map(R.get(CLOSING_KEYWORD_BY_NAME, list.keyword), (keyword) =>
      ClosingList.make({ keyword, issueNumbers: list.issueNumbers })
    )
  );

/**
 * Every reference list a whole text carries, one whole-line list per line.
 *
 * **Details**
 *
 * The per-line convenience over {@link parseReferenceList}: split on `"\n"`
 * (the parser's own trim absorbs a `"\r"`, so CRLF input needs no special
 * case), parse each line, and collect the accepted lists in line order.
 * Rejected lines simply contribute nothing. The results carry **no line
 * numbers** — deliberately, because most consumers only aggregate the
 * references; a consumer that needs positions keeps its own split loop.
 *
 * **Example** (Collect accepted reference lines in order)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { parseReferenceLists } from "@beep/github-references/ClosingList";
 * const lists = parseReferenceLists("Refs #7, #8\r\nnot a reference\r\nCloses #9");
 * console.log(A.join(A.map(lists, (list) => list.keyword), ",")); // refs,closes
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
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
 * **Details**
 *
 * The per-line convenience over {@link parseClosingList} — the closing-only
 * view of {@link parseReferenceLists}, with the same split-on-`"\n"`,
 * collect-the-accepted shape and the same deliberate absence of line
 * numbers: a consumer that needs positions keeps its own split loop.
 *
 * **Example** (Collect only closing lines)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { parseClosingLists } from "@beep/github-references/ClosingList";
 * const lists = parseClosingLists("Fixes #1, #2\nRefs #9\nCloses #3 and #4");
 * console.log(A.join(A.map(lists, (list) => A.join(A.map(list.issueNumbers, String), ",")), ";")); // 1,2;3,4
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const parseClosingLists = (text: string): ReadonlyArray<ClosingList> => {
  const lists: Array<ClosingList> = [];
  for (const line of Str.split(text, "\n")) {
    const parsed = parseClosingList(line);
    if (O.isSome(parsed)) lists.push(parsed.value);
  }
  return lists;
};

const isWordChar = (char: string | undefined): boolean => isAsciiLetter(char) || isDigit(char) || char === "_";

const isAsciiWhitespace = (char: string | undefined): boolean =>
  char === " " || (char !== undefined && char >= "\t" && char <= "\r");

const ISOLATED_NON_ASCII_JS_WHITESPACE: HashSet.HashSet<string> = HashSet.make(
  "\xa0",
  "\u1680",
  "\u2028",
  "\u2029",
  "\u202f",
  "\u205f",
  "\u3000",
  "\ufeff"
);

const isNonAsciiJsWhitespace = (char: string | undefined): boolean =>
  (char !== undefined && char >= "\u2000" && char <= "\u200a") ||
  (char !== undefined && HashSet.has(ISOLATED_NON_ASCII_JS_WHITESPACE, char));

const isJsRegexWhitespaceWithoutARegex = (char: string | undefined): boolean =>
  isAsciiWhitespace(char) || isNonAsciiJsWhitespace(char);

/**
 * A reference list harvested out of running text by
 * {@link harvestReferenceLists}, with the offsets a prose harvest needs.
 *
 * **Example** (Validate a harvested list span)
 *
 * ```ts
 * import { HarvestedReferenceList } from "@beep/github-references/ClosingList";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(HarvestedReferenceList)({
 *  keyword: "closes", closing: true, issueNumbers: [123], start: 0, end: 11
 * })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class HarvestedReferenceList extends S.Opaque<HarvestedReferenceList, { readonly brand: unique symbol }>()(
  S.Struct({
    ...ReferenceList.fields,
    /** Offset of the first character of the matched keyword. */
    start: S.Natural.pipe(
      $I.annoteKey("HarvestedReferenceList.start", {
        description: "The offset of the first character of the matched keyword.",
      })
    ),
    /** Offset one past the last digit of the last item. */
    end: S.Natural.pipe(
      $I.annoteKey("HarvestedReferenceList.end", {
        description: "The offset one past the last digit of the last item.",
      })
    ),
  })
    .check(
      ClosingFlagMatchesKeyword,
      S.makeFilter(
        (list) => list.end > list.start,
        $I.annote("HarvestedReferenceList.OrderedSpan", {
          description: "The exclusive end offset exceeds the start offset of the harvested match.",
          message: "Expected end to be greater than start.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("HarvestedReferenceList", {
        description: "A reference list harvested from prose with its match offsets.",
      })
    )
) {}

const letterRunEnd = (text: string, from: number): number => {
  let runEnd = from + 1;
  while (runEnd < text.length && isAsciiLetter(text[runEnd])) runEnd += 1;
  return runEnd;
};

const isWordEmbedded = (text: string, runStart: number, runEnd: number): boolean =>
  (runStart > 0 && isWordChar(text[runStart - 1])) || (runEnd < text.length && isWordChar(text[runEnd]));

const freeStandingKeywordAt = (text: string, runStart: number, runEnd: number): O.Option<ListKeyword> =>
  isWordEmbedded(text, runStart, runEnd)
    ? O.none()
    : R.get(LIST_KEYWORD_BY_NAME, Str.toLowerCase(Str.slice(runStart, runEnd)(text)));

const readFirstItemAfterAnyWhitespaceGap = (text: string, runEnd: number): ItemScan => {
  let cursor = runEnd;
  while (cursor < text.length && isJsRegexWhitespaceWithoutARegex(text[cursor])) cursor += 1;
  return cursor === runEnd ? SHARED_ITEM_MISS : readItem(text, cursor);
};

const readContinuationToListEndOrPoisoningUnsafe = (
  text: string,
  first: ItemFound,
  issueNumbers: A.NonEmptyArray<number>
): ItemFound => {
  let last: ItemFound = first;
  while (last._tag === "item") {
    const next = scanLowercaseOnlySeparator(text, last.next);
    if (next === last.next) break;
    const item = readItem(text, next);
    if (item._tag === "miss") break;
    if (item._tag === "item") issueNumbers.push(item.value);
    last = item;
  }
  return last;
};

const harvestCandidateReturningResumeOffset = (
  text: string,
  runStart: number,
  runEnd: number,
  keyword: ListKeyword,
  lists: Array<HarvestedReferenceList>
): number => {
  const first = readFirstItemAfterAnyWhitespaceGap(text, runEnd);
  if (first._tag === "miss") return runEnd;
  if (first._tag === "unsafe") return first.next;
  const issueNumbers: A.NonEmptyArray<number> = [first.value];
  const tail = readContinuationToListEndOrPoisoningUnsafe(text, first, issueNumbers);
  if (tail._tag === "unsafe") return tail.next;
  lists.push(
    HarvestedReferenceList.make({
      keyword,
      closing: R.has(CLOSING_KEYWORD_BY_NAME, keyword),
      issueNumbers,
      start: runStart,
      end: tail.next,
    })
  );
  return tail.next;
};

const harvestAtLetterRun = (text: string, runStart: number, lists: Array<HarvestedReferenceList>): number => {
  const runEnd = letterRunEnd(text, runStart);
  return O.match(freeStandingKeywordAt(text, runStart, runEnd), {
    onNone: () => runEnd,
    onSome: (keyword) => harvestCandidateReturningResumeOffset(text, runStart, runEnd, keyword, lists),
  });
};

/**
 * Every reference list found inline in `text`, in document order.
 *
 * **Details**
 *
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
 * **Example** (Harvest separate lists from one prose line)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { harvestReferenceLists } from "@beep/github-references/ClosingList";
 * const lists = harvestReferenceLists("Closes #123, Fixes #456");
 * console.log(A.join(A.map(lists, (list) => `${list.keyword}:${list.start}-${list.end}`), ",")); // closes:0-11,fixes:13-23
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const harvestReferenceLists = (text: string): ReadonlyArray<HarvestedReferenceList> => {
  const lists: Array<HarvestedReferenceList> = [];
  let index = 0;
  while (index < text.length) {
    index = isAsciiLetter(text[index]) ? harvestAtLetterRun(text, index, lists) : index + 1;
  }
  return lists;
};
