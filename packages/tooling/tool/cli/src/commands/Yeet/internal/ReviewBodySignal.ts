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
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseScore } from "./closeout/GreptileSignal.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewBodySignal");

/**
 * One file location a CodeRabbit review body points its reader at.
 *
 * **Details**
 *
 * Parsed from the fix-prompt block, where each finding is introduced by the
 * path it lives in and then by the line it starts at. The line is optional
 * because a path can be named without one, and a location with no line still
 * counts as an advisory the operator has not seen.
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
export class YeetReviewBodyItem extends S.Class<YeetReviewBodyItem>($I`YeetReviewBodyItem`)(
  {
    path: S.String,
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetReviewBodyItem", {
    description: "One file location a review body points at.",
  })
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
export class YeetReviewBodyFindingCounts extends S.Class<YeetReviewBodyFindingCounts>($I`YeetReviewBodyFindingCounts`)(
  {
    p0: S.Finite,
    p1: S.Finite,
    p2: S.Finite,
  },
  $I.annote("YeetReviewBodyFindingCounts", {
    description: "Per-severity counts of the findings a Greptile-format review body reports as new.",
  })
) {}

/**
 * A CodeRabbit review body, reduced to its counts and its locations.
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyCoderabbit extends S.Class<ReviewBodyCoderabbit>($I`ReviewBodyCoderabbit`)(
  {
    signal: S.tag("coderabbit"),
    actionable: S.Finite,
    nitpicks: S.Finite,
    outsideDiff: S.Finite,
    items: S.Array(YeetReviewBodyItem),
  },
  $I.annote("ReviewBodyCoderabbit", {
    description: "A CodeRabbit review body's actionable, nitpick and outside-diff counts with its located findings.",
  })
) {}

/**
 * A Greptile-format review body, reduced to its confidence and its findings.
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewBodyGreptile extends S.Class<ReviewBodyGreptile>($I`ReviewBodyGreptile`)(
  {
    signal: S.tag("greptile"),
    confidence: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    newFindings: YeetReviewBodyFindingCounts,
  },
  $I.annote("ReviewBodyGreptile", {
    description: "A Greptile-format review body's confidence fraction and new-finding severity counts.",
  })
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
export class ReviewBodyPlain extends S.Class<ReviewBodyPlain>($I`ReviewBodyPlain`)(
  {
    signal: S.tag("plain"),
  },
  $I.annote("ReviewBodyPlain", {
    description: "A review body carrying no recognised structural markers.",
  })
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
export const YeetReviewBodySignal = S.Union([ReviewBodyCoderabbit, ReviewBodyGreptile, ReviewBodyPlain]).pipe(
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

const isReviewBodyCoderabbit = S.is(ReviewBodyCoderabbit);
const isReviewBodyGreptile = S.is(ReviewBodyGreptile);

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
export class YeetReviewBodySignalInput extends S.Class<YeetReviewBodySignalInput>($I`YeetReviewBodySignalInput`)(
  {
    authorLogin: S.String,
    body: S.String,
  },
  $I.annote("YeetReviewBodySignalInput", {
    description: "One submitted review's author login and body text.",
  })
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
export class YeetReviewBodyThreadLocation extends S.Class<YeetReviewBodyThreadLocation>(
  $I`YeetReviewBodyThreadLocation`
)(
  {
    path: S.String,
    line: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetReviewBodyThreadLocation", {
    description: "The path and line of an existing review thread.",
  })
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
const nitpickPattern = /Nitpick comments\s*\((?<count>\d+)\)/giu;
const outsideDiffPattern = /Outside diff range comments\s*\((?<count>\d+)\)/giu;
const itemPathPattern = /^\s*In\s+`@?(?<path>[^`]+)`\s*:?\s*$/u;
const itemLinePattern = /^\s*-\s*(?:Around\s+lines?|Lines?)\s+(?<line>\d+)/iu;
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

const parseCount = (value: string | undefined): number =>
  pipe(
    O.fromUndefinedOr(value),
    O.map((raw) => Number.parseInt(raw, 10)),
    O.filter((parsed) => !Number.isNaN(parsed)),
    O.getOrElse(() => 0)
  );

const sumPatternCounts = (body: string, pattern: RegExp): number =>
  pipe(
    A.fromIterable(body.matchAll(pattern)),
    A.map((match) => parseCount(match.groups?.count)),
    A.reduce(0, N.sum)
  );

type ItemScan = {
  readonly openPath: O.Option<string>;
  readonly openPathLocated: boolean;
  readonly items: ReadonlyArray<YeetReviewBodyItem>;
};

const emptyItemScan: ItemScan = {
  openPath: O.none(),
  openPathLocated: false,
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
          onSome: (path) => A.append(scan.items, YeetReviewBodyItem.make({ path, line: O.none() })),
        })
      );

const scanItemLine = (scan: ItemScan, line: string): ItemScan => {
  const path = itemPathPattern.exec(line)?.groups?.path;
  if (path !== undefined) {
    return { openPath: O.some(Str.trim(path)), openPathLocated: false, items: closeOpenPath(scan) };
  }
  const located = itemLinePattern.exec(line)?.groups?.line;
  if (located === undefined) {
    return scan;
  }
  return pipe(
    scan.openPath,
    O.match({
      onNone: () => scan,
      onSome: (openPath) => ({
        openPath: O.some(openPath),
        openPathLocated: true,
        items: A.append(scan.items, YeetReviewBodyItem.make({ path: openPath, line: O.some(parseCount(located)) })),
      }),
    })
  );
};

const parseCoderabbitItems = (body: string): ReadonlyArray<YeetReviewBodyItem> =>
  pipe(Str.split(body, "\n"), A.reduce(emptyItemScan, scanItemLine), closeOpenPath);

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
    O.map((marker) => A.fromIterable(Str.slice(marker.index + marker[0].length)(body).matchAll(newItemPattern))),
    O.getOrElse(A.empty<RegExpExecArray>),
    A.reduce(noFindings, (counts, match) => {
      const count = parseCount(match.groups?.count);
      const level = match.groups?.level;
      return level === "0"
        ? { ...counts, p0: counts.p0 + count }
        : level === "1"
          ? { ...counts, p1: counts.p1 + count }
          : { ...counts, p2: counts.p2 + count };
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
    return ReviewBodyCoderabbit.make({
      signal: "coderabbit",
      actionable: parseCount(actionablePattern.exec(input.body)?.groups?.count),
      nitpicks: sumPatternCounts(input.body, nitpickPattern),
      outsideDiff: sumPatternCounts(input.body, outsideDiffPattern),
      items: parseCoderabbitItems(input.body),
    });
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
 * Count the advisories one review body raises that no thread already carries.
 *
 * **Details**
 *
 * A CodeRabbit finding that also opened an inline review thread is already on
 * the operator's worklist, so it is not counted twice: only body findings with
 * no thread at the same path — and the same line, when both are known — are
 * advisories, alongside the nitpick and outside-diff counts the body only ever
 * summarises. A Greptile-format body contributes its new findings at every
 * severity. A plain body contributes nothing.
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
} = dual(2, (signal: YeetReviewBodySignal, threads: ReadonlyArray<YeetReviewBodyThreadLocation>): number => {
  if (isReviewBodyCoderabbit(signal)) {
    const unlinked = pipe(
      signal.items,
      A.filter((item) => !itemHasThread(item, threads)),
      A.length
    );
    return unlinked + signal.nitpicks + signal.outsideDiff;
  }
  return isReviewBodyGreptile(signal) ? signal.newFindings.p0 + signal.newFindings.p1 + signal.newFindings.p2 : 0;
});
