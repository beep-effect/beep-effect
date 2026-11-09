/**
 * What a pull request review *body* reports, read from its structure alone.
 *
 * A review body is the prose a reviewer submits alongside their inline
 * comments. Nothing in yeet ever looked at one, so a CodeRabbit review that
 * posted two inline comments and eleven nitpicks summarised only in its body,
 * or a Greptile-format review whose single new P2 lives in its body, passed
 * through the operator's terminal without leaving a trace.
 *
 * **Details**
 *
 * The parsers here read the *structural markers* review tools emit — a bolded
 * actionable count, a `<summary>` title with a parenthesised number, a
 * confidence fraction, a `P0:n P1:n P2:n` triplet — and never the finding
 * prose itself. That boundary is the whole point: review text is untrusted
 * review data, and a body that argues for its own severity must not be able to
 * change what yeet counts.
 *
 * Everything this module produces is *advisory*. A review body can raise the
 * advisory count an operator sees; it can never gate a merge. Gating lives
 * with review threads, where a named human is waiting on an answer.
 *
 * **Details**
 *
 * A Greptile-format body is recognised by two rules, in this order.
 *
 * 1. A *named marker*: an author login containing `greptile`, a heading or a
 *    bolded line that names Greptile (`### Greptile Review`,
 *    `**Greptile** says`), or the tokens `Greptile-format` / `Greptile-style`
 *    anywhere in the body. The heading rule is line-anchored: the word in
 *    running prose — "greptile scored this 5/5" — is a human writing *about*
 *    the tool, not a body written in its format.
 * 2. A *structural fallback*: a confidence fraction together with either a
 *    `P0:n P1:n P2:n` triplet or a `**NEW:**` marker. The operator emulates
 *    this format through their own account and does not always name Greptile
 *    at all — the round-8 review on PR #1184 reads `## Review (r8)`,
 *    `Confidence **4/5**`, `**NEW:** 1×P2` and never says the word — so the
 *    shape alone is enough.
 *
 * **Gotchas**
 *
 * The `P0:n P1:n P2:n` triplet and the `N×Pk` items after `**NEW:**` describe
 * the same round, so each severity takes the *maximum* of the two readings and
 * never their sum: a body that prints a zeroed tally above a listed item still
 * reports that item, and a body that prints a tally with nothing listed still
 * reports the tally.
 *
 * **Details**
 *
 * CodeRabbit's body format drifts. The spellings read here are the ones a
 * census of real CodeRabbit review bodies on this repository showed (34 bodies
 * across 24 pull requests, November 2026) plus the older ones the tests pin:
 * `**Actionable comments posted: N**`; `Nitpick comments (N)` and
 * `Nitpick comments: N`; `Outside diff range comments (N)`; `Minor comments: N`;
 * fix-prompt items introduced by `` In `@path`: ``, by
 * `Review comments at @path:` or by a hard-wrapped
 * `Review comment at @path at line N:` / `... around lines N - M:`, each
 * followed by `- Line N:` or `- Around line N-M:`. The current format lists
 * every finding twice, in its own prompt and again in the "Prompt to fix all
 * issues" block, so items are deduplicated by path and line.
 *
 * A CodeRabbit body that carries findings in a shape none of those spellings
 * match reads as `coderabbit-unparsed`, never as a clean zero: the evidence is
 * a fix-prompt marker or a findings summary with a positive count.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseScore } from "./closeout/GreptileSignal.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewBodySignal");

/**
 * The fix-prompt section a CodeRabbit finding is listed under.
 *
 * **Details**
 *
 * The "Prompt to fix all issues" block groups its findings under headings:
 * `Inline comments:` for findings that also opened a review thread, and
 * `Nitpick comments:`, `Outside diff comments:` and `Minor comments:` for
 * findings that live in the body alone. Only the body-only sections are
 * already summarised by the body's own counts.
 *
 * **Example** (Recognise a body-only section)
 *
 * ```ts
 * import { YeetReviewBodyItemSection } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewBodyItemSection.is.nitpick("nitpick")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewBodyItemSection = LiteralKit(["inline", "nitpick", "outside-diff", "minor"]).pipe(
  $I.annoteSchema("YeetReviewBodyItemSection", {
    title: "Yeet Review Body Item Section",
    description: "The CodeRabbit fix-prompt section a review body finding is listed under.",
  })
);

/**
 * The fix-prompt section a CodeRabbit finding is listed under.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewBodyItemSection = typeof YeetReviewBodyItemSection.Type;

/**
 * The structural evidence that a CodeRabbit body carries findings.
 *
 * **Details**
 *
 * `fix-prompt` is a per-finding "Prompt for AI Agents" block, a fix-prompt
 * item marker or a fix-prompt section heading;
 * `findings-summary` is a `<summary>` title with a positive comment count.
 * Either one makes a body whose counts and items all parse to zero a format
 * Yeet no longer reads, not a clean round.
 *
 * **Example** (Name the evidence)
 *
 * ```ts
 * import { YeetReviewBodyFindingsEvidence } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReviewBodyFindingsEvidence.is["fix-prompt"]("fix-prompt")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewBodyFindingsEvidence = LiteralKit(["fix-prompt", "findings-summary"]).pipe(
  $I.annoteSchema("YeetReviewBodyFindingsEvidence", {
    title: "Yeet Review Body Findings Evidence",
    description: "The structural marker that shows a CodeRabbit review body carries findings.",
  })
);

/**
 * The structural evidence that a CodeRabbit body carries findings.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewBodyFindingsEvidence = typeof YeetReviewBodyFindingsEvidence.Type;

/**
 * One file location a CodeRabbit review body points its reader at.
 *
 * **Details**
 *
 * Parsed from the fix-prompt blocks, where each finding is introduced by the
 * path it lives in and then by the line it starts at. The line is optional
 * because a path can be named without one, and a location with no line still
 * counts as an advisory the operator has not seen. `section` is the
 * fix-prompt heading the finding was listed under, when the body names one.
 *
 * **Example** (Name a located finding)
 *
 * ```ts
 * import { YeetReviewBodyItem } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const item = YeetReviewBodyItem.make({ path: "src/Reply.ts", line: O.some(412) })
 * console.log(item.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewBodyItem extends S.Opaque<YeetReviewBodyItem, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    line: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    section: YeetReviewBodyItemSection.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetReviewBodyItem", {
      description: "One file location a review body points at.",
    })
  )
) {}

/**
 * Severity tallies for the findings a Greptile-format body reports as new.
 *
 * **Example** (Read a clean round)
 *
 * ```ts
 * import { YeetReviewBodyFindingCounts } from "@beep/repo-cli/test/Yeet"
 *
 * const counts = YeetReviewBodyFindingCounts.make({ p0: 0, p1: 0, p2: 0 })
 * console.log(counts.p2)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewBodyFindingCounts extends S.Opaque<
  YeetReviewBodyFindingCounts,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    p0: S.Finite,
    p1: S.Finite,
    p2: S.Finite,
  }).pipe(
    $I.annoteSchema("YeetReviewBodyFindingCounts", {
      description: "Per-severity counts of the findings a Greptile-format review body reports as new.",
    })
  )
) {}

/**
 * A CodeRabbit review body, reduced to its counts and its locations.
 *
 * **Details**
 *
 * `minor` is the `Minor comments: N` summary, a body-only section like the
 * nitpicks; it defaults to zero because older bodies never print it.
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyCoderabbit extends S.Opaque<ReviewBodyCoderabbit, { readonly brand: unique symbol }>()(
  S.Struct({
    signal: S.tag("coderabbit"),
    actionable: S.Finite,
    nitpicks: S.Finite,
    outsideDiff: S.Finite,
    minor: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0))),
    items: S.Array(YeetReviewBodyItem),
  }).pipe(
    $I.annoteSchema("ReviewBodyCoderabbit", {
      description:
        "A CodeRabbit review body's actionable, nitpick, outside-diff and minor counts with its located findings.",
    })
  )
) {}

/**
 * A CodeRabbit review body that carries findings Yeet could not read.
 *
 * **Details**
 *
 * The format-drift case: the body shows a fix-prompt marker or a findings
 * summary, yet every count and every item parsed to zero. Reading that as a
 * clean round is how a real finding went unseen, so it is its own variant and
 * the operator is told to read the review instead.
 *
 * **Example** (Describe an unreadable findings body)
 *
 * ```ts
 * import { ReviewBodyCoderabbitUnparsed } from "@beep/repo-cli/test/Yeet"
 *
 * const signal = ReviewBodyCoderabbitUnparsed.make({ signal: "coderabbit-unparsed", evidence: "fix-prompt" })
 * console.log(signal.evidence) // "fix-prompt"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyCoderabbitUnparsed extends S.Opaque<
  ReviewBodyCoderabbitUnparsed,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    signal: S.tag("coderabbit-unparsed"),
    evidence: YeetReviewBodyFindingsEvidence,
  }).pipe(
    $I.annoteSchema("ReviewBodyCoderabbitUnparsed", {
      description: "A CodeRabbit review body that shows findings in a format none of the known spellings parse.",
    })
  )
) {}

/**
 * A Greptile-format review body, reduced to its confidence and its findings.
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyGreptile extends S.Opaque<ReviewBodyGreptile, { readonly brand: unique symbol }>()(
  S.Struct({
    signal: S.tag("greptile"),
    confidence: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    newFindings: YeetReviewBodyFindingCounts,
  }).pipe(
    $I.annoteSchema("ReviewBodyGreptile", {
      description: "A Greptile-format review body's confidence fraction and new-finding severity counts.",
    })
  )
) {}

/**
 * A review body with no recognised structure.
 *
 * **Details**
 *
 * The honest default: a body yeet cannot read is still printed, and it
 * contributes nothing to the advisory count rather than being guessed at.
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyPlain extends S.Opaque<ReviewBodyPlain, { readonly brand: unique symbol }>()(
  S.Struct({
    signal: S.tag("plain"),
  }).pipe(
    $I.annoteSchema("ReviewBodyPlain", {
      description: "A review body carrying no recognised structural markers.",
    })
  )
) {}

/**
 * What one pull request review body reports.
 *
 * **Example** (Decode a plain body signal)
 *
 * ```ts
 * import { YeetReviewBodySignal } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(YeetReviewBodySignal)({ signal: "plain" })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReviewBodySignal = S.Union([
  ReviewBodyCoderabbit,
  ReviewBodyCoderabbitUnparsed,
  ReviewBodyGreptile,
  ReviewBodyPlain,
]).pipe(
  S.toTaggedUnion("signal"),
  $I.annoteSchema("YeetReviewBodySignal", {
    description: "What one pull request review body reports, read from its structural markers.",
  })
);

/**
 * What one pull request review body reports.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReviewBodySignal = typeof YeetReviewBodySignal.Type;

/**
 * Everything the body parser reads about one submitted review.
 *
 * **Details**
 *
 * Author and body travel together because neither identifies a review tool on
 * its own: CodeRabbit is known by its login, and a Greptile-format body is
 * known by its markers whoever submitted it.
 *
 * **Example** (Describe a submitted review)
 *
 * ```ts
 * import { YeetReviewBodySignalInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetReviewBodySignalInput.make({ authorLogin: "coderabbitai[bot]", body: "**Actionable comments posted: 0**" })
 * console.log(input.authorLogin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewBodySignalInput extends S.Opaque<YeetReviewBodySignalInput, { readonly brand: unique symbol }>()(
  S.Struct({
    authorLogin: S.String,
    body: S.String,
  }).pipe(
    $I.annoteSchema("YeetReviewBodySignalInput", {
      description: "One submitted review's author login and body text.",
    })
  )
) {}

/**
 * Where a review thread sits, for matching a body's findings against it.
 *
 * **Example** (Name a thread location)
 *
 * ```ts
 * import { YeetReviewBodyThreadLocation } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const location = YeetReviewBodyThreadLocation.make({ path: "src/Reply.ts", line: O.some(412) })
 * console.log(location.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReviewBodyThreadLocation extends S.Opaque<
  YeetReviewBodyThreadLocation,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: S.String,
    line: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetReviewBodyThreadLocation", {
      description: "The path and line of an existing review thread.",
    })
  )
) {}

/**
 * The logins CodeRabbit submits review bodies under.
 *
 * **Details**
 *
 * Two spellings for one reviewer: GitHub reports `coderabbitai` as a comment
 * author and `coderabbitai[bot]` wherever an app is named as an actor, so a
 * detector that knows only one of them misses half the bodies. Modelled as a
 * closed domain because it is exactly that — a finite set of names, not a
 * substring test that would also claim a human writing about CodeRabbit.
 *
 * **Example** (Recognise the app spelling)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { YeetCoderabbitLogin } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * strictEqual(S.is(YeetCoderabbitLogin)("coderabbitai[bot]"), true)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetCoderabbitLogin = LiteralKit(["coderabbitai", "coderabbitai[bot]"]).pipe(
  $I.annoteSchema("YeetCoderabbitLogin", {
    title: "Yeet CodeRabbit Login",
    description: "The logins CodeRabbit submits pull request review bodies under.",
  })
);

/**
 * The logins CodeRabbit submits review bodies under.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetCoderabbitLogin = typeof YeetCoderabbitLogin.Type;

const isYeetCoderabbitLogin = S.is(YeetCoderabbitLogin);

const actionablePattern = /\*\*Actionable comments posted:\s*(?<count>\d+)\*\*/iu;
// `Nitpick comments (N)` in the older format, `Nitpick comments: N` in the
// current one. The colon form is held to one line so a fix-prompt heading
// (`Nitpick comments:` followed by its items) never reads as a count.
const nitpickPattern = /Nitpick comments(?:\s*\((?<count>\d+)\)|:[ \t]*(?<colonCount>\d+))/giu;
const outsideDiffPattern = /Outside diff range comments\s*\((?<count>\d+)\)/giu;
const minorPattern = /Minor comments:[ \t]*(?<colonCount>\d+)/giu;
const itemPathPattern = /^In\s+`@?(?<path>[^`]+)`\s*:?$/u;
const itemLinePattern = /^-\s*(?:Around\s+lines?|Lines?)\s+(?<line>\d+)/iu;
// The current format's fix-prompt lead-ins. They are hard-wrapped at about 80
// columns wherever the path runs long, so a lead-in is joined with the lines
// after it, up to the colon that ends the location, before it is matched.
const reviewCommentLeadPattern = /^Review comments? at\b/u;
const reviewCommentsPathPattern = /^Review comments at @(?<path>\S+):$/u;
const reviewCommentLocatedPattern =
  /^Review comment at @(?<path>\S+) (?:at line|around lines) (?<line>\d+)(?: - \d+)?:$/u;
const sectionHeadingPattern = /^(?<section>Inline|Nitpick|Outside diff|Minor) comments:$/u;
const anySectionHeadingPattern = /^[A-Z][A-Za-z -]* comments:$/u;
// The per-finding prompt CodeRabbit attaches to every finding it lists, and
// to nothing else: a body carrying one carries a finding, however it is spelt.
const findingPromptPattern = /Prompt for AI Agents/u;
const blockquotePrefixPattern = /^\s*(?:>\s?)+/u;
const codeFencePattern = /^```/u;
// A `<summary>` title naming a positive comment count, whatever the section.
// "Additional comments" are the findings CodeRabbit itself marks unverified
// or low value; they are not a section Yeet counts, so they are not evidence.
const findingsSummaryPattern =
  /(?<name>[A-Za-z][A-Za-z -]*?)\s*comments(?:\s*\((?<count>\d+)\)|:[ \t]*(?<colonCount>\d+))/gu;
const additionalCommentsPattern = /\bAdditional$/u;
// A wrapped location never runs past a few lines; a lead-in that does was not one.
const maxLocationClauseLines = 4;
// A heading or a bolded lead-in that names Greptile. Line-anchored on purpose:
// the word appearing anywhere in a body is prose about the tool — an operator
// writing "greptile scored this 5/5" — not a body written in its format.
const greptileMarkerPattern = /^(?:#{1,6}|\*\*)[^\n]*greptile/imu;
// The format's own name, which a body may carry outside a heading.
const greptileFormatTokenPattern = /greptile-(?:format|style)/iu;
// A login is a name, not prose, so a substring match on it is safe.
const greptileLoginPattern = /greptile/iu;
const confidencePattern = /confidence[^\n\d]{0,12}(?<score>\d+(?:\.\d+)?)\s*\/\s*5/iu;
const findingTripletPattern = /P0:\s*(?<p0>\d+)\s+P1:\s*(?<p1>\d+)\s+P2:\s*(?<p2>\d+)/iu;
const newMarkerPattern = /\*\*NEW:?\*\*:?|(?:^|\s)NEW:/mu;
const newItemPattern = /(?<count>\d+)\s*[x×]\s*P(?<level>[012])\b/giu;

// Review prose is untrusted. Saturating counts keeps malformed or enormous
// decimal captures from reaching checked Schema constructors as Infinity and
// bounds every aggregate, including a body with many listed items.
const maxReviewBodyCount = 100_000;

const parseCount = (value: string | undefined): number =>
  pipe(
    O.fromUndefinedOr(value),
    O.map((raw) => Number.parseInt(raw, 10)),
    O.map((parsed) => (Number.isSafeInteger(parsed) ? N.min(parsed, maxReviewBodyCount) : maxReviewBodyCount)),
    O.getOrElse(constant(0))
  );

// A count pattern captures either its parenthesised or its colon spelling.
const matchedCount = (match: RegExpMatchArray): number => parseCount(match.groups?.count ?? match.groups?.colonCount);

const sumPatternCounts = (body: string, pattern: RegExp): number =>
  pipe(
    A.fromIterable(Str.matchAll(pattern)(body)),
    A.map(matchedCount),
    A.reduce(0, (total, count) => N.min(total + count, maxReviewBodyCount))
  );

type LogicalLineScan = {
  readonly pending: O.Option<ReadonlyArray<string>>;
  readonly lines: ReadonlyArray<string>;
};

const emptyLogicalLineScan: LogicalLineScan = { pending: O.none(), lines: A.empty<string>() };

const joinLocationClause = (parts: ReadonlyArray<string>): string =>
  Str.trim(Str.replace(/\s+/gu, " ")(A.join(parts, " ")));

const flushLocationClause = (scan: LogicalLineScan): ReadonlyArray<string> =>
  O.match(scan.pending, {
    onNone: () => scan.lines,
    onSome: (parts) => A.append(scan.lines, joinLocationClause(parts)),
  });

// One physical line into the logical-line fold: blockquote markers and edge
// whitespace go, and a fix-prompt lead-in that does not end its location on
// its own line is held open until the line that does.
const foldLogicalLine = (scan: LogicalLineScan, raw: string): LogicalLineScan => {
  const line = Str.trim(Str.replace(blockquotePrefixPattern, "")(raw));
  return O.match(scan.pending, {
    onNone: () =>
      reviewCommentLeadPattern.test(line) && !Str.endsWith(":")(line)
        ? { pending: O.some(A.of(line)), lines: scan.lines }
        : { pending: O.none(), lines: A.append(scan.lines, line) },
    onSome: (parts) => {
      const joined = A.append(parts, line);
      return Str.endsWith(":")(line) || A.length(joined) >= maxLocationClauseLines
        ? { pending: O.none(), lines: A.append(scan.lines, joinLocationClause(joined)) }
        : { pending: O.some(joined), lines: scan.lines };
    },
  });
};

const logicalLines = (body: string): ReadonlyArray<string> =>
  pipe(Str.split(body, "\n"), A.reduce(emptyLogicalLineScan, foldLogicalLine), flushLocationClause);

const sectionOfHeading = (heading: string): YeetReviewBodyItemSection =>
  Match.value(heading).pipe(
    Match.when("Inline", () => YeetReviewBodyItemSection.Enum.inline),
    Match.when("Nitpick", () => YeetReviewBodyItemSection.Enum.nitpick),
    Match.when("Outside diff", () => YeetReviewBodyItemSection.Enum["outside-diff"]),
    Match.orElse(() => YeetReviewBodyItemSection.Enum.minor)
  );

type ItemScan = {
  readonly openPath: O.Option<string>;
  readonly openPathLocated: boolean;
  readonly section: O.Option<YeetReviewBodyItemSection>;
  readonly items: ReadonlyArray<YeetReviewBodyItem>;
};

const emptyItemScan: ItemScan = {
  openPath: O.none(),
  openPathLocated: false,
  section: O.none(),
  items: A.empty<YeetReviewBodyItem>(),
};

// A path named with no line beneath it is still a location the operator has
// not seen, so an open path that never produced a located item is closed as a
// line-less one.
const closeOpenPath = (scan: ItemScan): ReadonlyArray<YeetReviewBodyItem> =>
  scan.openPathLocated
    ? scan.items
    : pipe(
        scan.openPath,
        O.match({
          onNone: () => scan.items,
          onSome: (path) =>
            A.append(scan.items, YeetReviewBodyItem.make({ path, line: O.none(), section: scan.section })),
        })
      );

const openItemPath = (scan: ItemScan, path: string): ItemScan => ({
  ...scan,
  openPath: O.some(Str.trim(path)),
  openPathLocated: false,
  items: closeOpenPath(scan),
});

// One reading of a fix-prompt line: `None` when the line is not that shape.
type ItemLineReading = (scan: ItemScan, line: string) => O.Option<ItemScan>;

const capture = (pattern: RegExp, line: string, group: string): O.Option<string> =>
  O.fromUndefinedOr(pattern.exec(line)?.groups?.[group]);

const readSectionHeading: ItemLineReading = (scan, line) =>
  O.map(capture(sectionHeadingPattern, line, "section"), (heading) => ({
    ...scan,
    openPath: O.none(),
    section: O.some(sectionOfHeading(heading)),
    items: closeOpenPath(scan),
  }));

const readCodeFence: ItemLineReading = (scan, line) =>
  codeFencePattern.test(line) ? O.some({ ...scan, section: O.none() }) : O.none();

const readItemPath: ItemLineReading = (scan, line) =>
  pipe(
    capture(itemPathPattern, line, "path"),
    O.orElse(() => capture(reviewCommentsPathPattern, line, "path")),
    O.map((path) => openItemPath(scan, path))
  );

const readLocatedComment: ItemLineReading = (scan, line) =>
  O.map(
    O.all([capture(reviewCommentLocatedPattern, line, "path"), capture(reviewCommentLocatedPattern, line, "line")]),
    ([path, located]) => ({
      ...scan,
      openPath: O.none(),
      openPathLocated: false,
      items: A.append(
        closeOpenPath(scan),
        YeetReviewBodyItem.make({ path, line: O.some(parseCount(located)), section: scan.section })
      ),
    })
  );

const readItemLine: ItemLineReading = (scan, line) =>
  O.map(O.all([capture(itemLinePattern, line, "line"), scan.openPath]), ([located, openPath]) => ({
    ...scan,
    openPathLocated: true,
    items: A.append(
      scan.items,
      YeetReviewBodyItem.make({ path: openPath, line: O.some(parseCount(located)), section: scan.section })
    ),
  }));

// The first reading that matches wins, in this order; a line none of them
// reads leaves the scan as it was.
const itemLineReadings: ReadonlyArray<ItemLineReading> = [
  readSectionHeading,
  readCodeFence,
  readItemPath,
  readLocatedComment,
  readItemLine,
];

const scanItemLine = (scan: ItemScan, line: string): ItemScan =>
  pipe(
    itemLineReadings,
    A.findFirst((reading) => reading(scan, line)),
    O.getOrElse(() => scan)
  );

const lineEquivalence = O.makeEquivalence(N.Equivalence);

const sameItemLocation =
  (item: YeetReviewBodyItem) =>
  (other: YeetReviewBodyItem): boolean =>
    Str.Equivalence(item.path, other.path) && lineEquivalence(item.line, other.line);

type ItemDedupe = {
  readonly unclaimed: ReadonlyArray<YeetReviewBodyItem>;
  readonly kept: ReadonlyArray<YeetReviewBodyItem>;
};

// The current format lists every finding twice: once in its own prompt, under
// no section heading, and once in the "Prompt to fix all issues" block, under
// one. Each unsectioned item is dropped when a sectioned item at the same path
// and line is still unclaimed, so a finding counts once and keeps its section,
// while two findings one listing places at the same line both stay.
const dedupeItem = (scan: ItemDedupe, item: YeetReviewBodyItem): ItemDedupe =>
  O.isSome(item.section)
    ? { ...scan, kept: A.append(scan.kept, item) }
    : pipe(
        A.findFirstIndex(scan.unclaimed, sameItemLocation(item)),
        O.match({
          onNone: () => ({ ...scan, kept: A.append(scan.kept, item) }),
          onSome: (index) => ({ ...scan, unclaimed: A.remove(scan.unclaimed, index) }),
        })
      );

const dedupeItems = (items: ReadonlyArray<YeetReviewBodyItem>): ReadonlyArray<YeetReviewBodyItem> =>
  A.reduce(
    items,
    { unclaimed: A.filter(items, (item) => O.isSome(item.section)), kept: A.empty<YeetReviewBodyItem>() },
    dedupeItem
  ).kept;

const parseCoderabbitItems = (lines: ReadonlyArray<string>): ReadonlyArray<YeetReviewBodyItem> =>
  pipe(lines, A.reduce(emptyItemScan, scanItemLine), closeOpenPath, dedupeItems);

const isFixPromptEvidence = (line: string): boolean =>
  reviewCommentLeadPattern.test(line) || anySectionHeadingPattern.test(line);

const isFindingsSummaryEvidence = (match: RegExpMatchArray): boolean =>
  matchedCount(match) > 0 && !additionalCommentsPattern.test(Str.trim(match.groups?.name ?? Str.empty));

// What shows a body carries findings, whatever their spelling: a per-finding
// prompt or a fix-prompt marker first, then a summary title with a positive
// comment count.
const findingsEvidence = (body: string, lines: ReadonlyArray<string>): O.Option<YeetReviewBodyFindingsEvidence> =>
  findingPromptPattern.test(body) || A.some(lines, isFixPromptEvidence)
    ? O.some(YeetReviewBodyFindingsEvidence.Enum["fix-prompt"])
    : A.some(A.fromIterable(Str.matchAll(findingsSummaryPattern)(body)), isFindingsSummaryEvidence)
      ? O.some(YeetReviewBodyFindingsEvidence.Enum["findings-summary"])
      : O.none();

const isCleanZero = (signal: ReviewBodyCoderabbit): boolean =>
  signal.actionable + signal.nitpicks + signal.outsideDiff + signal.minor === 0 && A.isReadonlyArrayEmpty(signal.items);

const parseCoderabbit = (body: string): ReviewBodyCoderabbit | ReviewBodyCoderabbitUnparsed => {
  const lines = logicalLines(body);
  const parsed = ReviewBodyCoderabbit.make({
    signal: "coderabbit",
    actionable: parseCount(actionablePattern.exec(body)?.groups?.count),
    nitpicks: sumPatternCounts(body, nitpickPattern),
    outsideDiff: sumPatternCounts(body, outsideDiffPattern),
    minor: sumPatternCounts(body, minorPattern),
    items: parseCoderabbitItems(lines),
  });
  return isCleanZero(parsed)
    ? O.match(findingsEvidence(body, lines), {
        onNone: () => parsed,
        onSome: (evidence) => ReviewBodyCoderabbitUnparsed.make({ signal: "coderabbit-unparsed", evidence }),
      })
    : parsed;
};

type FindingTally = { readonly p0: number; readonly p1: number; readonly p2: number };

const noFindings: FindingTally = { p0: 0, p1: 0, p2: 0 };

// The `P0:n P1:n P2:n` tally line, when the body prints one.
const parseFindingTriplet = (body: string): FindingTally =>
  pipe(
    O.fromUndefinedOr(findingTripletPattern.exec(body)?.groups),
    O.map((groups) => ({ p0: parseCount(groups.p0), p1: parseCount(groups.p1), p2: parseCount(groups.p2) })),
    O.getOrElse(() => noFindings)
  );

// The `N×Pk` items listed after the `**NEW:**` marker, summed per severity:
// these are separate findings of the same round, so they do add up.
const parseFindingItems = (body: string): FindingTally =>
  pipe(
    O.fromNullOr(newMarkerPattern.exec(body)),
    O.map((marker) => A.fromIterable(Str.matchAll(newItemPattern)(Str.slice(marker.index + marker[0].length)(body)))),
    O.getOrElse(A.empty<RegExpMatchArray>),
    A.reduce(noFindings, (counts, match) => {
      const count = parseCount(match.groups?.count);
      const level = match.groups?.level;
      return level === "0"
        ? { ...counts, p0: N.min(counts.p0 + count, maxReviewBodyCount) }
        : level === "1"
          ? { ...counts, p1: N.min(counts.p1 + count, maxReviewBodyCount) }
          : { ...counts, p2: N.min(counts.p2 + count, maxReviewBodyCount) };
    })
  );

const parseNewFindings = (body: string): YeetReviewBodyFindingCounts => {
  const triplet = parseFindingTriplet(body);
  const items = parseFindingItems(body);
  // The two notations describe the same round, so the larger is the round's
  // count and summing them would report every finding twice. A body can print
  // a stale zeroed tally above a listed item, or list nothing beneath a real
  // tally, and the maximum is right in both directions.
  return YeetReviewBodyFindingCounts.make({
    p0: N.max(triplet.p0, items.p0),
    p1: N.max(triplet.p1, items.p1),
    p2: N.max(triplet.p2, items.p2),
  });
};

const parseConfidence = (body: string): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(confidencePattern.exec(body)?.groups?.score),
    O.map((score) => `${score}/5`),
    O.orElse(() => parseScore(body))
  );

const isCoderabbitAuthor = (authorLogin: string): boolean => isYeetCoderabbitLogin(Str.toLowerCase(authorLogin));

const isGreptileFormat = (input: YeetReviewBodySignalInput): boolean => {
  if (
    greptileLoginPattern.test(input.authorLogin) ||
    greptileMarkerPattern.test(input.body) ||
    greptileFormatTokenPattern.test(input.body)
  ) {
    return true;
  }
  // The operator writes this format by hand from their own account and does
  // not always name Greptile anywhere in the body, so a confidence fraction
  // paired with a findings marker is read as the format itself.
  return (
    O.isSome(parseConfidence(input.body)) &&
    (findingTripletPattern.test(input.body) || newMarkerPattern.test(input.body))
  );
};

/**
 * Read one review body's structural markers into a signal.
 *
 * **Details**
 *
 * CodeRabbit is recognised by its author login, a Greptile-format body by its
 * markers, and everything else is `plain`. Detection never reads finding
 * prose: the only body text that changes an outcome is a count, a fraction or
 * a file path the tool itself printed.
 *
 * **Gotchas**
 *
 * A Greptile-format body's `P0:n P1:n P2:n` triplet and its `N×Pk` items after
 * `**NEW:**` are two readings of one round, so each severity takes the larger
 * of them. Summing would double-count; taking only the triplet would lose a
 * listed finding the tally forgot.
 *
 * **Example** (Read a CodeRabbit actionable count)
 *
 * ```ts
 * import { parseYeetReviewBodySignal, YeetReviewBodySignalInput } from "@beep/repo-cli/test/Yeet"
 *
 * const signal = parseYeetReviewBodySignal(
 *   YeetReviewBodySignalInput.make({
 *     authorLogin: "coderabbitai[bot]",
 *     body: "**Actionable comments posted: 2**",
 *   })
 * )
 * console.log(signal.signal) // "coderabbit"
 * ```
 *
 * @param input - One submitted review's author login and body text.
 * @returns The structural signal the comment stream prints and the advisory count reads.
 * @category parsing
 * @since 0.0.0
 */
export const parseYeetReviewBodySignal = (input: YeetReviewBodySignalInput): YeetReviewBodySignal => {
  if (isCoderabbitAuthor(input.authorLogin)) {
    return parseCoderabbit(input.body);
  }
  return isGreptileFormat(input)
    ? ReviewBodyGreptile.make({
        signal: "greptile",
        confidence: parseConfidence(input.body),
        newFindings: parseNewFindings(input.body),
      })
    : ReviewBodyPlain.make({ signal: "plain" });
};

const itemHasThread = (item: YeetReviewBodyItem, threads: ReadonlyArray<YeetReviewBodyThreadLocation>): boolean =>
  A.some(
    threads,
    (thread) =>
      Str.Equivalence(thread.path, item.path) &&
      pipe(
        O.all([item.line, thread.line]),
        O.match({
          onNone: () => true,
          onSome: ([itemLine, threadLine]) => N.Equivalence(itemLine, threadLine),
        })
      )
  );

/**
 * The located findings of one review body that no review thread carries.
 *
 * **Details**
 *
 * A finding matches a thread at the same path, and at the same line when both
 * sides know one. Only a CodeRabbit body lists locations; every other signal
 * has none.
 *
 * **Example** (A threaded finding is dropped)
 *
 * ```ts
 * import {
 *   ReviewBodyCoderabbit,
 *   YeetReviewBodyItem,
 *   YeetReviewBodyThreadLocation,
 *   yeetReviewBodyUnthreadedItems,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const signal = ReviewBodyCoderabbit.make({
 *   signal: "coderabbit",
 *   actionable: 1,
 *   nitpicks: 0,
 *   outsideDiff: 0,
 *   items: [YeetReviewBodyItem.make({ path: "src/Reply.ts", line: O.some(412) })],
 * })
 * const left = yeetReviewBodyUnthreadedItems(signal, [
 *   YeetReviewBodyThreadLocation.make({ path: "src/Reply.ts", line: O.some(412) }),
 * ])
 * console.log(left.length) // 0
 * ```
 *
 * @param signal - One parsed review body signal.
 * @param threads - Where this pull request's review threads sit.
 * @returns The body's located findings with no thread at the same location, in body order.
 * @category utilities
 * @since 0.0.0
 */
export const yeetReviewBodyUnthreadedItems: {
  (
    signal: YeetReviewBodySignal,
    threads: ReadonlyArray<YeetReviewBodyThreadLocation>
  ): ReadonlyArray<YeetReviewBodyItem>;
  (
    threads: ReadonlyArray<YeetReviewBodyThreadLocation>
  ): (signal: YeetReviewBodySignal) => ReadonlyArray<YeetReviewBodyItem>;
} = dual(
  2,
  (
    signal: YeetReviewBodySignal,
    threads: ReadonlyArray<YeetReviewBodyThreadLocation>
  ): ReadonlyArray<YeetReviewBodyItem> =>
    signal.signal === "coderabbit" ? A.filter(signal.items, (item) => !itemHasThread(item, threads)) : A.empty()
);

// Findings listed under a body-only fix-prompt section; the rest (an
// `Inline comments:` item, or an item the body files under no heading) may
// have opened a thread.
const isBodyOnlyItem = (item: YeetReviewBodyItem): boolean =>
  O.exists(item.section, (section) => section !== YeetReviewBodyItemSection.Enum.inline);

const coderabbitAdvisoryCount = (
  signal: ReviewBodyCoderabbit,
  threads: ReadonlyArray<YeetReviewBodyThreadLocation>
): number => {
  const unthreaded = yeetReviewBodyUnthreadedItems(signal, threads);
  const threadable = A.length(A.filter(unthreaded, (item) => !isBodyOnlyItem(item)));
  const bodyOnlyListed = A.length(A.filter(signal.items, isBodyOnlyItem));
  const bodyOnlyThreaded = bodyOnlyListed - A.length(A.filter(unthreaded, isBodyOnlyItem));
  // A body-only item is the same finding its section's count summarises, so
  // the larger of the two readings is the number of body-only findings, less
  // the listed ones a thread already carries.
  return threadable + N.max(signal.nitpicks + signal.outsideDiff + signal.minor, bodyOnlyListed) - bodyOnlyThreaded;
};

/**
 * Count the advisories one review body raises that no thread already carries.
 *
 * **Details**
 *
 * A CodeRabbit finding that also opened an inline review thread is already on
 * the operator's worklist, so it is not counted twice: only body findings with
 * no thread at the same path — and the same line, when both are known — are
 * advisories, alongside the nitpick, outside-diff and minor counts the body
 * summarises. A finding the fix prompt lists under one of those body-only
 * sections is the same finding its count summarises, so the two readings are
 * not added: the larger one stands. A Greptile-format body contributes its new
 * findings at every severity. A plain body contributes nothing. A CodeRabbit
 * body whose findings Yeet could not parse counts as one advisory, the floor
 * of what it is known to carry.
 *
 * **Gotchas**
 *
 * Advisory counts never gate. They are the number an operator reads to decide
 * whether to go and look, not a condition anything waits on.
 *
 * **Example** (A finding with a thread is not an advisory)
 *
 * ```ts
 * import {
 *   parseYeetReviewBodySignal,
 *   YeetReviewBodySignalInput,
 *   YeetReviewBodyThreadLocation,
 *   yeetReviewBodyAdvisoryCount,
 * } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const signal = parseYeetReviewBodySignal(
 *   YeetReviewBodySignalInput.make({
 *     authorLogin: "coderabbitai[bot]",
 *     body: "**Actionable comments posted: 1**\n\nIn `@src/Reply.ts`:\n- Line 412: fix it\n",
 *   })
 * )
 * const counted = yeetReviewBodyAdvisoryCount(signal, [
 *   YeetReviewBodyThreadLocation.make({ path: "src/Reply.ts", line: O.some(412) }),
 * ])
 * console.log(counted) // 0
 * ```
 *
 * @param signal - One parsed review body signal.
 * @param threads - Where this pull request's review threads sit.
 * @returns How many advisories this body raises that no thread already carries.
 * @category utilities
 * @since 0.0.0
 */
export const yeetReviewBodyAdvisoryCount: {
  (signal: YeetReviewBodySignal, threads: ReadonlyArray<YeetReviewBodyThreadLocation>): number;
  (threads: ReadonlyArray<YeetReviewBodyThreadLocation>): (signal: YeetReviewBodySignal) => number;
} = dual(2, (signal: YeetReviewBodySignal, threads: ReadonlyArray<YeetReviewBodyThreadLocation>): number =>
  Match.value(signal).pipe(
    Match.discriminator("signal")("coderabbit", (coderabbit) => coderabbitAdvisoryCount(coderabbit, threads)),
    Match.discriminator("signal")("coderabbit-unparsed", () => 1),
    Match.discriminator("signal")(
      "greptile",
      (greptile) => greptile.newFindings.p0 + greptile.newFindings.p1 + greptile.newFindings.p2
    ),
    Match.discriminator("signal")("plain", () => 0),
    Match.exhaustive
  )
);
