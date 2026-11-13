/**
 * GitHub's closing-keyword issue-reference grammar, as pure functions.
 *
 * **Details**
 *
 * GitHub links an issue to a pull request when the PR's description carries
 * `<keyword> #<number>` for one of nine documented keywords. Consumers speak
 * that grammar in two distinct dialects, and this module models exactly those
 * two — no service, no layer, nothing but strings in and values out:
 *
 * - **Inline-in-prose** (`harvestIssueReferences`): a reference may appear anywhere in
 *   running text — `"fixes #12 and closes #13"` — with mandatory whitespace
 *   and **no colon**, because that is the spelling GitHub itself scans PR
 *   bodies for. This is the dialect a release pipeline harvests from commit
 *   subjects and PR descriptions.
 * - **Bare-line** (`parseBareLineReference`): the whole line, after trimming, *is*
 *   the reference — `"Closes: #12"` — with an **optional colon**, because a
 *   generated references region writes one reference per line and a colon
 *   reads better there. GitHub does not require the colon; the region format
 *   allows it, so the parser must too. The dialects differ because their
 *   producers do: prose is written by humans for GitHub's scanner, the region
 *   is written by tooling for humans.
 *
 * Deliberately out of scope: cross-repo references (`owner/repo#N`) and
 * full-URL references (`https://github.com/owner/repo/issues/N`). Both are
 * real GitHub spellings, but neither dialect's producers emit them, and
 * guessing at their shape here would freeze an API nobody has driven.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubReferencesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GithubReferencesId.create("IssueReferences");

/**
 * One of the nine documented closing keywords, in canonical lowercase form.
 *
 * **Example** (Validate a canonical closing keyword)
 *
 * ```ts
 * import { ClosingKeyword } from "@beep/github-references/IssueReferences";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ClosingKeyword)("fixes")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ClosingKeyword = LiteralKit([
  "close",
  "closes",
  "closed",
  "fix",
  "fixes",
  "fixed",
  "resolve",
  "resolves",
  "resolved",
]).pipe(
  $I.annoteSchema("ClosingKeyword", { description: "A documented GitHub closing keyword in canonical lowercase form." })
);

/**
 * Canonical lowercase spelling accepted by the closing-keyword schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClosingKeyword = typeof ClosingKeyword.Type;

/**
 * The nine closing keywords GitHub documents, lowercased.
 *
 * **Example** (Count the supported closing keywords)
 *
 * ```ts
 * import { CLOSING_KEYWORDS } from "@beep/github-references/IssueReferences";
 *
 * console.log(CLOSING_KEYWORDS.length) // 9
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const CLOSING_KEYWORDS = ClosingKeyword.literals;

const CLOSING_KEYWORD_BY_NAME: R.ReadonlyRecord<string, ClosingKeyword> = ClosingKeyword.Enum;

/**
 * One closing reference found in prose by {@link harvestIssueReferences}.
 *
 * **Example** (Validate a harvested reference with offsets)
 *
 * ```ts
 * import { IssueReference } from "@beep/github-references/IssueReferences";
 * import * as S from "effect/Schema";
 *
 * const reference = { issueNumber: 12, keyword: "fixes", start: 0, end: 9 };
 * console.log(S.is(IssueReference)(reference)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class IssueReference extends S.Opaque<IssueReference, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The referenced issue number. */
    issueNumber: S.Natural.pipe(
      $I.annoteKey("IssueReference.issueNumber", { description: "The referenced safe integer issue number." })
    ),
    /** The matched keyword, lowercased to its canonical form. */
    keyword: ClosingKeyword.pipe(
      $I.annoteKey("IssueReference.keyword", {
        description: "The matched closing keyword in canonical lowercase form.",
      })
    ),
    /** Offset of the first character of the whole match (`keyword` through digits). */
    start: S.Natural.pipe(
      $I.annoteKey("IssueReference.start", { description: "The offset of the first character of the whole match." })
    ),
    /** Offset one past the last character of the whole match. */
    end: S.Natural.pipe(
      $I.annoteKey("IssueReference.end", { description: "The offset one past the last character of the whole match." })
    ),
  })
    .check(
      S.makeFilter(
        (reference) => reference.end > reference.start,
        $I.annote("IssueReference.OrderedSpan", {
          description: "The exclusive end offset exceeds the start offset of the harvested match.",
          message: "Expected end to be greater than start.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("IssueReference", {
        description: "A closing issue reference harvested from prose with its match offsets.",
      })
    )
) {}

/**
 * The closing reference a bare line carries, per {@link parseBareLineReference}.
 *
 * **Details**
 *
 * No offsets: in the bare-line dialect the whole line is the reference, so
 * positions within it locate nothing a caller acts on.
 *
 * **Example** (Validate a whole-line reference)
 *
 * ```ts
 * import { BareLineReference } from "@beep/github-references/IssueReferences";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(BareLineReference)({ issueNumber: 12, keyword: "closes" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BareLineReference extends S.Opaque<BareLineReference, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The referenced issue number. */
    issueNumber: S.Natural.pipe(
      $I.annoteKey("BareLineReference.issueNumber", { description: "The referenced safe integer issue number." })
    ),
    /** The matched keyword, lowercased to its canonical form. */
    keyword: ClosingKeyword.pipe(
      $I.annoteKey("BareLineReference.keyword", {
        description: "The matched closing keyword in canonical lowercase form.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BareLineReference", { description: "The closing issue reference carried by a whole bare line." })
  )
) {}

/**
 * Both patterns derive from {@link CLOSING_KEYWORDS} so the constant and the
 * grammar cannot drift. Alternation order is safe: the regex engine backtracks
 * through alternatives, so `close` matching inside `closes` fails at the
 * mandatory `#`-introducer and retries the longer keyword.
 */
const KEYWORDS = A.join(CLOSING_KEYWORDS, "|");

/** Inline-in-prose: mandatory whitespace, no colon. */
const INLINE_PATTERN = new RegExp(`\\b(${KEYWORDS})\\s+#(\\d+)`, "gi");

/**
 * Bare-line: optional colon, then mandatory same-line whitespace. `[ \t]`
 * rather than `\s`, so an embedded newline cannot smuggle two lines past a
 * parser whose contract is one.
 */
const BARE_LINE_PATTERN = new RegExp(`^(${KEYWORDS}):?[ \\t]+#(\\d+)$`, "i");

/**
 * Every inline closing reference in `text`, in document order.
 *
 * **Details**
 *
 * The **inline-in-prose** dialect: case-insensitive `<keyword> #<number>`
 * anywhere in the text, whitespace mandatory, colon not accepted — a colon
 * spelling belongs to the bare-line dialect and {@link parseBareLineReference}.
 * Duplicates are preserved: whether `fixes #1, fixes #1` means one reference
 * or two is the caller's business, not a parser's.
 *
 * The keyword needs only a word boundary before it, so markdown emphasis,
 * brackets and list markers around a reference do not hide it; a match's
 * span runs from the keyword through the last digit and excludes them.
 *
 * A match whose digits exceed `Number.MAX_SAFE_INTEGER` is skipped, not
 * misparsed. Cross-repo (`owner/repo#N`) and full-URL references are not
 * recognized.
 *
 * **Example** (Harvest inline closing references with offsets)
 *
 * ```ts
 * import { harvestIssueReferences } from "@beep/github-references/IssueReferences";
 *
 * const references = harvestIssueReferences("fixes #12 and closes #13");
 * console.log(JSON.stringify(references)) // [{"issueNumber":12,"keyword":"fixes","start":0,"end":9},{"issueNumber":13,"keyword":"closes","start":14,"end":24}]
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const harvestIssueReferences = (text: string): ReadonlyArray<IssueReference> => {
  const references: Array<IssueReference> = [];
  const pattern = new RegExp(INLINE_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    // Both captures are mandatory in INLINE_PATTERN.
    const issueNumber = Number(A.getUnsafe(match, 2));
    if (!Number.isSafeInteger(issueNumber)) continue;
    const keyword = O.getOrThrow(R.get(CLOSING_KEYWORD_BY_NAME, Str.toLowerCase(A.getUnsafe(match, 1))));
    references.push(
      IssueReference.make({ issueNumber, keyword, start: match.index, end: match.index + match[0].length })
    );
  }
  return references;
};

/**
 * The reference a whole line carries, or `Option.none()`.
 *
 * **Details**
 *
 * The **bare-line** dialect: after trimming, the entire line must be
 * `<keyword>[:] #<number>` — keyword case-insensitive, colon optional,
 * whitespace before the `#` mandatory. Trailing prose, a missing keyword, or
 * anything else at all is a rejection, never a partial parse; a line carries
 * one reference or none. Digits past `Number.MAX_SAFE_INTEGER` reject too,
 * for the same reason {@link harvestIssueReferences} skips them.
 *
 * **Example** (Parse a closing reference with an optional colon)
 *
 * ```ts
 * import { parseBareLineReference } from "@beep/github-references/IssueReferences";
 * import * as O from "effect/Option";
 *
 * const reference = parseBareLineReference("Closes: #12");
 * console.log(JSON.stringify(O.getOrNull(reference))) // {"issueNumber":12,"keyword":"closes"}
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const parseBareLineReference = (line: string): O.Option<BareLineReference> => {
  const match = BARE_LINE_PATTERN.exec(Str.trim(line));
  if (match === null) return O.none();
  // Both captures are mandatory in BARE_LINE_PATTERN.
  const issueNumber = Number(A.getUnsafe(match, 2));
  if (!Number.isSafeInteger(issueNumber)) return O.none();
  const keyword = O.getOrThrow(R.get(CLOSING_KEYWORD_BY_NAME, Str.toLowerCase(A.getUnsafe(match, 1))));
  return O.some(BareLineReference.make({ issueNumber, keyword }));
};

/**
 * Every bare-line reference a whole text carries, one per line.
 *
 * **Details**
 *
 * The per-line convenience over {@link parseBareLineReference}: split on
 * `"\n"` (the parser's own trim absorbs a `"\r"`, so CRLF input needs no
 * special case), parse each line, and collect the accepted references in
 * line order. Rejected lines simply contribute nothing. The results carry
 * **no line numbers** — deliberately, because {@link BareLineReference} has
 * none and most consumers only aggregate the references; a consumer that
 * needs positions keeps its own split loop.
 *
 * **Example** (Collect accepted lines in order)
 *
 * ```ts
 * import { parseBareLines } from "@beep/github-references/IssueReferences";
 *
 * const references = parseBareLines("Closes: #12\r\nnot a reference\nfixes #13");
 * console.log(JSON.stringify(references)) // [{"issueNumber":12,"keyword":"closes"},{"issueNumber":13,"keyword":"fixes"}]
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const parseBareLines = (text: string): ReadonlyArray<BareLineReference> => {
  const references: Array<BareLineReference> = [];
  for (const line of Str.split(text, "\n")) {
    const parsed = parseBareLineReference(line);
    if (O.isSome(parsed)) references.push(parsed.value);
  }
  return references;
};
