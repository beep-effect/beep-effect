/**
 * The review lane measured as a verification lane (time-to-certainty ruling
 * 81): the per-clone review lane ledger, its recorders, and the pure fold
 * that turns it into the `yeet economics` review lane section.
 *
 * **Details**
 *
 * The ledger is append-only NDJSON in the owning clone, next to the proof
 * ledger (ruling 71's location rule), so retiring a lane never deletes the
 * sample and every lane cut from one clone writes one file. Writers are the
 * surfaces that observe the facts as they happen: `yeet ready` records the
 * flip, the monitor loop records heads and the merge-ready announcement, the
 * comment-stream collector records reviews, and `yeet reply` records thread
 * dispositions. Every writer is best effort: a failed append is one warning
 * line and a lost observation, never a failed command.
 *
 * Idempotency is the fold's, not the writer's. Reviews deduplicate by review
 * id, heads by sha, and the first flip and the first merge-ready after it
 * decide the window, so a row recorded twice (a replayed stream after a
 * watermark migration, two monitors on one branch) counts once. The writer
 * also drops rows whose identity the ledger already holds, which keeps the
 * file small; the fold would be correct without it.
 *
 * **Gotchas**
 *
 * Nothing here imputes. A thread answered without a declared disposition is
 * `unknown`, a review with no commit is unassigned, a pull request with
 * reviews and no flip is counted as such and never sampled.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { nearestRank } from "../../../internal/stats/NearestRank.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { resolveProofLedgerLocation } from "./ArtifactPaths.ts";
import {
  EconomicsReviewLane,
  EconomicsReviewLaneLedgerQuality,
  EconomicsReviewLanePrecisionRow,
  EconomicsReviewLanePullRequest,
  EconomicsReviewLaneRounds,
  economicsCountMix,
  YEET_ECONOMICS_PRECISION_METHOD,
} from "./Economics.schemas.ts";
import { appendLedgerRows, readLedgerRows } from "./LedgerFile.ts";
import { YeetCoderabbitLogin } from "./ReviewBodySignal.ts";
import {
  ReviewLaneLedger,
  ReviewLaneRowJson,
  YEET_REVIEW_LANE_LEDGER_FILE_NAME,
  YeetReviewerIdentity,
  YeetReviewerKind,
  YeetThreadDisposition,
} from "./ReviewLane.schemas.ts";
import type * as FileSystem from "effect/FileSystem";
import type { EconomicsCountRow } from "./Economics.schemas.ts";
import type {
  ReviewLaneDispositionRow,
  ReviewLaneFlipRow,
  ReviewLaneHeadRow,
  ReviewLaneMergeReadyRow,
  ReviewLaneReviewRow,
  ReviewLaneRow,
} from "./ReviewLane.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReviewLane");
const REVIEW_LANE_LEDGER_LABEL = "review lane ledger";

// ---------------------------------------------------------------------------
// Reviewer classification
// ---------------------------------------------------------------------------

const BEEP_REVIEWER_LOGIN_PREFIX = "beep-reviewer";
const GREPTILE_LOGIN_MARKER = "greptile";
const BOT_LOGIN_SUFFIX = "[bot]";
const BOT_ACCOUNT_TYPE = "Bot";
const isCoderabbitLogin = S.is(YeetCoderabbitLogin);

/**
 * Classify a reviewer from its login and account type alone.
 *
 * **Details**
 *
 * The repository's reviewer app, Greptile and CodeRabbit are recognised by
 * login; any other actor GitHub types `Bot` (GraphQL `__typename` or REST
 * `type`) or names with a `[bot]` suffix is a `bot`; everyone else is a
 * person. No body is read.
 *
 * **Example** (Classify the three named reviewers and a person)
 *
 * ```ts
 * import { classifyYeetReviewer } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(classifyYeetReviewer("beep-reviewer[bot]", O.some("Bot"))) // "beep-reviewer"
 * console.log(classifyYeetReviewer("greptile-apps[bot]", O.none())) // "greptile"
 * console.log(classifyYeetReviewer("coderabbitai", O.some("Bot"))) // "coderabbit"
 * console.log(classifyYeetReviewer("octocat", O.some("User"))) // "human"
 * ```
 *
 * @param login - The reviewer's GitHub login.
 * @param accountType - GitHub's actor type for the login, when the payload carried one.
 * @returns The reviewer kind the precision table groups by.
 * @category utilities
 * @since 0.0.0
 */
export const classifyYeetReviewer: {
  (accountType: O.Option<string>): (login: string) => YeetReviewerKind;
  (login: string, accountType: O.Option<string>): YeetReviewerKind;
} = dual(2, (login: string, accountType: O.Option<string>): YeetReviewerKind => {
  const lower = Str.toLowerCase(login);
  if (Str.startsWith(BEEP_REVIEWER_LOGIN_PREFIX)(lower)) return YeetReviewerKind.Enum["beep-reviewer"];
  if (Str.includes(GREPTILE_LOGIN_MARKER)(lower)) return YeetReviewerKind.Enum.greptile;
  if (isCoderabbitLogin(lower)) return YeetReviewerKind.Enum.coderabbit;
  if (O.contains(accountType, BOT_ACCOUNT_TYPE) || Str.endsWith(BOT_LOGIN_SUFFIX)(lower)) {
    return YeetReviewerKind.Enum.bot;
  }
  return YeetReviewerKind.Enum.human;
});

/**
 * Name a reviewer: its login and the kind it classifies as.
 *
 * **Example** (Name Greptile)
 *
 * ```ts
 * import { yeetReviewerIdentity } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(yeetReviewerIdentity("greptile-apps[bot]", O.none()).kind) // "greptile"
 * ```
 *
 * @param login - The reviewer's GitHub login.
 * @param accountType - GitHub's actor type for the login, when the payload carried one.
 * @returns The reviewer identity a ledger row carries.
 * @category constructors
 * @since 0.0.0
 */
export const yeetReviewerIdentity: {
  (accountType: O.Option<string>): (login: string) => YeetReviewerIdentity;
  (login: string, accountType: O.Option<string>): YeetReviewerIdentity;
} = dual(
  2,
  (login: string, accountType: O.Option<string>): YeetReviewerIdentity =>
    YeetReviewerIdentity.make({ login, kind: classifyYeetReviewer(login, accountType) })
);

// ---------------------------------------------------------------------------
// Ledger location, read and append
// ---------------------------------------------------------------------------

/**
 * Where a checkout's review lane ledger lives: in the owning clone, beside
 * the proof ledger (ruling 71's location rule).
 *
 * **Example** (A lane's ledger lives in its clone)
 *
 * ```ts
 * import { ReviewLaneLedgerLocation } from "@beep/repo-cli/test/Yeet"
 *
 * const location = ReviewLaneLedgerLocation.make({
 *   ledgerRoot: "/work/repo",
 *   ledgerPath: "/work/repo/.beep/yeet/review-lane.ndjson",
 * })
 * console.log(location.ledgerRoot) // "/work/repo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReviewLaneLedgerLocation extends S.Opaque<ReviewLaneLedgerLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    ledgerRoot: S.NonEmptyString,
    ledgerPath: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("ReviewLaneLedgerLocation", {
      description: "The owning clone a checkout's review lane ledger is contained in, and the ledger's path.",
    })
  )
) {}

/**
 * Resolve where a checkout reads and appends its review lane ledger.
 *
 * **Details**
 *
 * The owning clone is found the way the proof ledger finds it (ruling 71):
 * from the checkout's `.git` metadata, without spawning git. Sibling lanes of
 * one clone therefore share one ledger, and `yeet sweep --retire` of a lane
 * never removes the sample.
 *
 * **Example** (Build the resolution)
 *
 * ```ts
 * import { resolveReviewLaneLedgerLocation } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveReviewLaneLedgerLocation("/repo"))) // true
 * ```
 *
 * @param repoRoot - Checkout that observed the fact: a primary clone, a linked worktree, or a plain directory.
 * @returns The ledger's containment root and path.
 * @category utilities
 * @since 0.0.0
 */
export const resolveReviewLaneLedgerLocation = Effect.fn("Yeet.resolveReviewLaneLedgerLocation")(function* (
  repoRoot: string
): Effect.fn.Return<ReviewLaneLedgerLocation, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const { ledgerRoot } = yield* resolveProofLedgerLocation(repoRoot);
  return ReviewLaneLedgerLocation.make({
    ledgerRoot,
    ledgerPath: path.join(ledgerRoot, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME),
  });
});

/**
 * The identity a ledger row deduplicates on, when it has one.
 *
 * **Details**
 *
 * A flip, a head and a merge-ready announcement are one fact per
 * `(pull request, sha)`, a review one per `(pull request, review id)`. A
 * disposition has no identity: a thread answered again records again, and
 * the fold keeps the latest.
 *
 * **Example** (A review's identity is its id)
 *
 * ```ts
 * import { ReviewLaneReviewRow, YeetReviewerIdentity, reviewLaneRowKey } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const row = ReviewLaneReviewRow.make({
 *   schemaVersion: "yeet-review-lane/v1",
 *   prNumber: 2300,
 *   branch: "feat/review-lane",
 *   recordedAt: "2026-10-27T10:10:00.000Z",
 *   reviewId: 5275652920,
 *   reviewer: YeetReviewerIdentity.make({ login: "greptile-apps[bot]", kind: "greptile" }),
 *   state: "COMMENTED",
 *   submittedAt: "2026-10-27T10:09:00.000Z",
 * })
 * console.log(reviewLaneRowKey(row)) // Some("review:2300:5275652920")
 * ```
 *
 * @param row - One ledger row.
 * @returns The row's dedupe key, or `None` for a disposition.
 * @category utilities
 * @since 0.0.0
 */
export const reviewLaneRowKey = (row: ReviewLaneRow): O.Option<string> =>
  Match.value(row).pipe(
    Match.tag("flip", (flip) => O.some(`flip:${flip.prNumber}:${flip.headSha}`)),
    Match.tag("head", (head) => O.some(`head:${head.prNumber}:${head.headSha}`)),
    Match.tag("review", (review) => O.some(`review:${review.prNumber}:${review.reviewId}`)),
    Match.tag("merge-ready", (ready) => O.some(`merge-ready:${ready.prNumber}:${ready.headSha}`)),
    Match.tag("disposition", O.none<string>),
    Match.exhaustive
  );

const loadLedger = Effect.fn("Yeet.ReviewLaneLedger.load")(function* (
  location: ReviewLaneLedgerLocation
): Effect.fn.Return<ReviewLaneLedger, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const { ledgerPath, ledgerRoot } = location;
  const { rows, malformedRows } = yield* readLedgerRows(
    ledgerRoot,
    ledgerPath,
    REVIEW_LANE_LEDGER_LABEL,
    ReviewLaneRowJson.decodeOption
  );
  return ReviewLaneLedger.make({ ledgerPath, rows, malformedRows });
});

const encodeReviewLaneRow = (row: ReviewLaneRow): Effect.Effect<string, YeetCommandError> =>
  ReviewLaneRowJson.encode(row).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode a review lane ledger row."))
  );

const appendRows = Effect.fn("Yeet.ReviewLaneLedger.append")(function* (
  location: ReviewLaneLedgerLocation,
  rows: ReadonlyArray<ReviewLaneRow>
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  yield* appendLedgerRows(
    location.ledgerRoot,
    location.ledgerPath,
    REVIEW_LANE_LEDGER_LABEL,
    rows,
    encodeReviewLaneRow
  );
});

// Drop the rows whose identity the ledger already holds, and a second copy
// within one batch; dispositions have no identity and are always kept.
const freshRows = (
  known: ReadonlyArray<ReviewLaneRow>,
  rows: ReadonlyArray<ReviewLaneRow>
): ReadonlyArray<ReviewLaneRow> =>
  A.reduce(
    rows,
    { keys: HashSet.fromIterable(A.getSomes(A.map(known, reviewLaneRowKey))), kept: A.empty<ReviewLaneRow>() },
    (state, row) =>
      O.match(reviewLaneRowKey(row), {
        onNone: () => ({ ...state, kept: A.append(state.kept, row) }),
        onSome: (key) =>
          HashSet.has(state.keys, key)
            ? state
            : { keys: HashSet.add(state.keys, key), kept: A.append(state.kept, row) },
      })
  ).kept;

/**
 * Operations the review lane ledger of one checkout provides.
 *
 * **Example** (Describe an append)
 *
 * ```ts
 * import type { YeetReviewLaneLedgerShape } from "@beep/repo-cli/test/Yeet"
 *
 * const appendNothing = (ledger: YeetReviewLaneLedgerShape) => ledger.appendNew([])
 * console.log(appendNothing.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface YeetReviewLaneLedgerShape {
  /** Append rows as given, one write. */
  readonly append: (rows: ReadonlyArray<ReviewLaneRow>) => Effect.Effect<void, YeetCommandError>;
  /** Append only the rows whose identity the ledger does not already hold; returns how many were written. */
  readonly appendNew: (rows: ReadonlyArray<ReviewLaneRow>) => Effect.Effect<number, YeetCommandError>;
  /** Every decoded row, with the malformed-row count; a missing file is empty. */
  readonly load: Effect.Effect<ReviewLaneLedger, YeetCommandError>;
}

/**
 * Service boundary over one checkout's review lane ledger (ruling 81).
 *
 * **Details**
 *
 * `make(repoRoot)` resolves the owning clone once, then every operation reads
 * and appends through the clone's containment root with no symlink following.
 * Appends are `O_APPEND` writes with no lock, as the proof ledger's are: two
 * monitors on one clone may interleave rows, never tear a reader, because the
 * tolerant load counts a torn line as malformed and the fold deduplicates
 * what both wrote.
 *
 * **Example** (Load a checkout's ledger)
 *
 * ```ts
 * import { YeetReviewLaneLedger } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const ledger = yield* YeetReviewLaneLedger.make("/repo")
 *   return yield* ledger.load
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class YeetReviewLaneLedger extends Context.Service<YeetReviewLaneLedger, YeetReviewLaneLedgerShape>()(
  $I`YeetReviewLaneLedger`,
  {
    make: Effect.fn("Yeet.ReviewLaneLedger.make")(function* (
      repoRoot: string
    ): Effect.fn.Return<YeetReviewLaneLedgerShape, YeetCommandError, FileSystem.FileSystem | Path.Path> {
      const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const location = yield* resolveReviewLaneLedgerLocation(repoRoot);
      const load = loadLedger(location).pipe(Effect.provide(runtime));
      const append = (rows: ReadonlyArray<ReviewLaneRow>) => appendRows(location, rows).pipe(Effect.provide(runtime));
      return {
        load,
        append,
        appendNew: Effect.fn("Yeet.ReviewLaneLedger.appendNew")(function* (
          rows: ReadonlyArray<ReviewLaneRow>
        ): Effect.fn.Return<number, YeetCommandError> {
          if (A.isReadonlyArrayEmpty(rows)) {
            return 0;
          }
          const kept = freshRows((yield* load).rows, rows);
          yield* append(kept);
          return A.length(kept);
        }),
      };
    }),
  }
) {}

/**
 * Warn that an observation could not be recorded, naming the consequence.
 *
 * **Example** (Render the warning)
 *
 * ```ts
 * import { renderYeetReviewLaneLedgerWarning } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetReviewLaneLedgerWarning("disk is full"))
 * ```
 *
 * @param reason - Why the append failed.
 * @returns The one-line operator warning.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetReviewLaneLedgerWarning = (reason: string): string =>
  `[yeet] review lane ledger not updated: ${reason} The measurement loses this observation; nothing else is affected.`;

/**
 * Record observations in the checkout's review lane ledger, never failing.
 *
 * **Details**
 *
 * Every writer is a surface with its own job (a monitor poll, a reply pass,
 * the ready flip), and the measurement must never fail that job: a failed
 * resolution or append is one warning line and the rows are lost. Rows whose
 * identity the ledger already holds are not written again.
 *
 * **Example** (Record nothing)
 *
 * ```ts
 * import { recordYeetReviewLaneRows } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(recordYeetReviewLaneRows("/repo", []))) // true
 * ```
 *
 * @param repoRoot - The checkout that observed the facts.
 * @param rows - The observations; an empty list writes nothing.
 * @returns How many rows were appended; zero after a warning.
 * @category processes
 * @since 0.0.0
 */
export const recordYeetReviewLaneRows = Effect.fn("Yeet.recordReviewLaneRows")(function* (
  repoRoot: string,
  rows: ReadonlyArray<ReviewLaneRow>
): Effect.fn.Return<number, never, FileSystem.FileSystem | Path.Path> {
  if (A.isReadonlyArrayEmpty(rows)) {
    return 0;
  }
  return yield* YeetReviewLaneLedger.make(repoRoot).pipe(
    Effect.flatMap((ledger) => ledger.appendNew(rows)),
    Effect.catch((error) => Console.error(renderYeetReviewLaneLedgerWarning(error.message)).pipe(Effect.as(0)))
  );
});

/**
 * Read a checkout's review lane ledger as a report input, never failing.
 *
 * **Details**
 *
 * A ledger that exists but cannot be read, or whose location cannot be
 * resolved, reads as an unreadable ledger with no rows so the report can
 * count it; a missing ledger reads as empty.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readYeetReviewLaneLedger } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readYeetReviewLaneLedger("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout whose owning clone's ledger is read.
 * @returns The ledger, unreadable when it could not be read.
 * @category processes
 * @since 0.0.0
 */
export const readYeetReviewLaneLedger = Effect.fn("Yeet.readReviewLaneLedger")(function* (
  repoRoot: string
): Effect.fn.Return<ReviewLaneLedger, never, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const unreadableAt = (ledgerPath: string): ReviewLaneLedger =>
    ReviewLaneLedger.make({ ledgerPath, rows: [], malformedRows: 0, unreadable: true });
  // The location resolves first so an unreadable ledger is named by its own
  // path (the owning clone's for a lane); the checkout's own path stands in
  // only when the location itself cannot be resolved.
  return yield* resolveReviewLaneLedgerLocation(repoRoot).pipe(
    Effect.flatMap((location) =>
      loadLedger(location).pipe(Effect.orElseSucceed(() => unreadableAt(location.ledgerPath)))
    ),
    Effect.orElseSucceed(() =>
      unreadableAt(path.join(path.resolve(repoRoot), ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME))
    )
  );
});

// ---------------------------------------------------------------------------
// Pure fold
// ---------------------------------------------------------------------------

interface PullRequestFacts {
  readonly branches: HashSet.HashSet<string>;
  // The latest disposition per thread by its recorded instant.
  readonly dispositions: HashMap.HashMap<string, ReviewLaneDispositionRow>;
  readonly flips: ReadonlyArray<ReviewLaneFlipRow>;
  readonly heads: HashMap.HashMap<string, ReviewLaneHeadRow>;
  readonly mergeReadies: ReadonlyArray<ReviewLaneMergeReadyRow>;
  readonly prNumber: number;
  readonly reviewRows: number;
  readonly reviews: HashMap.HashMap<number, ReviewLaneReviewRow>;
}

const emptyFacts = (prNumber: number): PullRequestFacts => ({
  prNumber,
  branches: HashSet.empty(),
  flips: A.empty(),
  heads: HashMap.empty(),
  reviews: HashMap.empty(),
  reviewRows: 0,
  mergeReadies: A.empty(),
  dispositions: HashMap.empty(),
});

const parseMillis = (value: string): O.Option<number> => O.map(DateTime.make(value), DateTime.toEpochMillis);

// The latest declaration per thread wins by its recorded instant, whatever
// ledger it came from; ledger order decides only a tie or an instant that
// does not parse.
const latestDisposition = (
  held: ReviewLaneDispositionRow,
  next: ReviewLaneDispositionRow
): ReviewLaneDispositionRow => {
  const heldAt = parseMillis(held.recordedAt);
  const nextAt = parseMillis(next.recordedAt);
  return O.isSome(heldAt) && O.isSome(nextAt) && heldAt.value > nextAt.value ? held : next;
};

const addRow = (facts: PullRequestFacts, row: ReviewLaneRow): PullRequestFacts => {
  const branched = { ...facts, branches: HashSet.add(facts.branches, row.branch) };
  return Match.value(row).pipe(
    Match.tag("flip", (flip) => ({ ...branched, flips: A.append(branched.flips, flip) })),
    Match.tag("head", (head) => ({ ...branched, heads: HashMap.set(branched.heads, head.headSha, head) })),
    Match.tag("review", (review) => ({
      ...branched,
      reviews: HashMap.set(branched.reviews, review.reviewId, review),
      reviewRows: branched.reviewRows + 1,
    })),
    Match.tag("merge-ready", (ready) => ({ ...branched, mergeReadies: A.append(branched.mergeReadies, ready) })),
    Match.tag("disposition", (disposition) => ({
      ...branched,
      dispositions: HashMap.modifyAt(branched.dispositions, disposition.threadId, (held) =>
        O.some(O.match(held, { onNone: () => disposition, onSome: (row) => latestDisposition(row, disposition) }))
      ),
    })),
    Match.exhaustive
  );
};

const factsByPullRequest = (rows: ReadonlyArray<ReviewLaneRow>): ReadonlyArray<PullRequestFacts> =>
  pipe(
    A.reduce(rows, HashMap.empty<number, PullRequestFacts>(), (acc, row) =>
      HashMap.modifyAt(acc, row.prNumber, (existing) =>
        O.some(
          addRow(
            O.getOrElse(existing, () => emptyFacts(row.prNumber)),
            row
          )
        )
      )
    ),
    HashMap.toValues,
    A.sort(Order.mapInput(Order.Number, (facts: PullRequestFacts) => facts.prNumber))
  );

interface Instant {
  readonly at: string;
  readonly millis: number;
}

const instantOrder = Order.mapInput(Order.Number, (instant: Instant) => instant.millis);

const earliestInstant = (values: ReadonlyArray<string>): O.Option<Instant> =>
  pipe(
    values,
    A.map((at) => O.map(parseMillis(at), (millis): Instant => ({ at, millis }))),
    A.getSomes,
    A.sort(instantOrder),
    A.head
  );

interface ReviewWindow {
  readonly flip: Instant;
  readonly mergeReady: O.Option<Instant>;
}

// The first flip opens the window; the first merge-ready at or after it closes it.
const reviewWindow = (facts: PullRequestFacts): O.Option<ReviewWindow> =>
  O.map(
    earliestInstant(A.map(facts.flips, (flip) => flip.at)),
    (flip): ReviewWindow => ({
      flip,
      mergeReady: earliestInstant(
        A.filter(
          A.map(facts.mergeReadies, (ready) => ready.at),
          (at) => O.exists(parseMillis(at), (millis) => millis >= flip.millis)
        )
      ),
    })
  );

const inWindow = (window: ReviewWindow, at: string): boolean =>
  O.exists(
    parseMillis(at),
    (millis) =>
      millis >= window.flip.millis &&
      O.match(window.mergeReady, { onNone: () => true, onSome: (ready) => millis <= ready.millis })
  );

const pullRequestFacts = (facts: PullRequestFacts, window: ReviewWindow): EconomicsReviewLanePullRequest => {
  const reviews = A.filter(HashMap.toValues(facts.reviews), (review) => inWindow(window, review.submittedAt));
  const heads = A.filter(HashMap.toValues(facts.heads), (head) =>
    inWindow(
      window,
      O.getOrElse(head.pushedAt, () => head.observedAt)
    )
  );
  const reviewedHeads = HashSet.fromIterable(A.getSomes(A.map(reviews, (review) => review.commitSha)));
  return EconomicsReviewLanePullRequest.make({
    prNumber: facts.prNumber,
    flipAt: window.flip.at,
    mergeReadyAt: O.map(window.mergeReady, (ready) => ready.at),
    rounds: HashSet.size(reviewedHeads),
    reviews: A.length(reviews),
    heads: A.length(heads),
    unassignedReviews: A.length(A.filter(reviews, (review) => O.isNone(review.commitSha))),
  });
};

const roundsToReady = (pullRequests: ReadonlyArray<EconomicsReviewLanePullRequest>): EconomicsReviewLaneRounds => {
  const closed = A.filter(pullRequests, (pullRequest) => O.isSome(pullRequest.mergeReadyAt));
  const rounds = A.map(closed, (pullRequest) => pullRequest.rounds);
  return EconomicsReviewLaneRounds.make({
    closedPullRequests: A.length(closed),
    openPullRequests: A.length(pullRequests) - A.length(closed),
    p50Rounds: nearestRank(rounds, 0.5),
    p95Rounds: nearestRank(rounds, 0.95),
    roundsMix: economicsCountMix(A.map(rounds, String)),
    unassignedReviews: Num.sumAll(A.map(pullRequests, (pullRequest) => pullRequest.unassignedReviews)),
    pullRequests,
  });
};

const percentOf = (numerator: number, denominator: number): O.Option<number> =>
  O.map(Num.divide(numerator, denominator), (ratio) => Num.round(Num.round(ratio, 6) * 100, 2));

const dispositionCount = (dispositions: ReadonlyArray<YeetThreadDisposition>, wanted: YeetThreadDisposition): number =>
  A.length(A.filter(dispositions, (disposition) => disposition === wanted));

const precisionRow = (
  reviewer: YeetReviewerKind,
  dispositions: ReadonlyArray<YeetThreadDisposition>
): EconomicsReviewLanePrecisionRow => {
  const fixed = dispositionCount(dispositions, YeetThreadDisposition.Enum.fixed);
  const rejected = dispositionCount(dispositions, YeetThreadDisposition.Enum.rejected);
  const immaterial = dispositionCount(dispositions, YeetThreadDisposition.Enum.immaterial);
  return EconomicsReviewLanePrecisionRow.make({
    reviewer,
    fixed,
    rejected,
    intentional: dispositionCount(dispositions, YeetThreadDisposition.Enum.intentional),
    immaterial,
    unknown: dispositionCount(dispositions, YeetThreadDisposition.Enum.unknown),
    precisionPct: percentOf(fixed, fixed + rejected + immaterial),
  });
};

/**
 * Fold review lane ledgers into the economics review lane section (ruling 81).
 *
 * **Details**
 *
 * Pure: the same ledgers and branch always give the same section. Rows are
 * grouped by pull request; reviews deduplicate by review id, heads by sha,
 * dispositions keep the latest per thread by its recorded instant. A pull request enters the rounds
 * table only with a flip; it is closed when a merge-ready announcement at or
 * after the flip exists, and only closed pull requests feed the nearest-rank
 * percentiles. Precision groups the latest disposition of every thread by
 * the reviewer who opened it; a disposition with no attributable reviewer is
 * counted and sits in no row. With a branch, only pull requests with at
 * least one row recorded under that branch are read.
 *
 * **Example** (Fold no ledgers)
 *
 * ```ts
 * import { buildYeetEconomicsReviewLane } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const section = buildYeetEconomicsReviewLane([], O.none())
 * console.log(section.roundsToReady.closedPullRequests) // 0
 * ```
 *
 * @param ledgers - Every ledger read for the scope.
 * @param branch - The branch the scope narrowed to, when it did.
 * @returns The review lane section.
 * @category utilities
 * @since 0.0.0
 */
export const buildYeetEconomicsReviewLane: {
  (branch: O.Option<string>): (ledgers: ReadonlyArray<ReviewLaneLedger>) => EconomicsReviewLane;
  (ledgers: ReadonlyArray<ReviewLaneLedger>, branch: O.Option<string>): EconomicsReviewLane;
} = dual(2, (ledgers: ReadonlyArray<ReviewLaneLedger>, branch: O.Option<string>): EconomicsReviewLane => {
  const readable = A.filter(ledgers, (ledger) => !ledger.unreadable);
  const rows = A.flatMap(readable, (ledger) => ledger.rows);
  const facts = A.filter(factsByPullRequest(rows), (pullRequest) =>
    O.match(branch, { onNone: () => true, onSome: (wanted) => HashSet.has(pullRequest.branches, wanted) })
  );
  const windows = A.map(facts, (pullRequest) =>
    O.map(reviewWindow(pullRequest), (window) => pullRequestFacts(pullRequest, window))
  );
  const latestDispositions = A.flatMap(facts, (pullRequest) => HashMap.toValues(pullRequest.dispositions));
  const attributed = A.getSomes(
    A.map(latestDispositions, (row) =>
      O.map(row.reviewer, (reviewer) => ({ kind: reviewer.kind, disposition: row.disposition }))
    )
  );
  return EconomicsReviewLane.make({
    roundsToReady: roundsToReady(A.getSomes(windows)),
    precisionMethod: YEET_ECONOMICS_PRECISION_METHOD,
    precision: A.map(YeetReviewerKind.literals, (kind) =>
      precisionRow(
        kind,
        A.map(
          A.filter(attributed, (entry) => entry.kind === kind),
          (entry) => entry.disposition
        )
      )
    ),
    ledgerQuality: EconomicsReviewLaneLedgerQuality.make({
      ledgersRead: A.length(readable),
      unreadableLedgers: A.length(ledgers) - A.length(readable),
      rows: A.length(rows),
      malformedRows: Num.sumAll(A.map(readable, (ledger) => ledger.malformedRows)),
      duplicateReviewRowsDeduplicated: Num.sumAll(
        A.map(facts, (pullRequest) => pullRequest.reviewRows - HashMap.size(pullRequest.reviews))
      ),
      pullRequestsWithoutFlip: A.length(A.filter(windows, O.isNone)),
      unattributedDispositions: A.length(latestDispositions) - A.length(attributed),
    }),
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const formatCount: (value: O.Option<number>) => string = O.match({
  onNone: () => "n/a",
  onSome: (value) => `${value}`,
});

const formatPercent: (value: O.Option<number>) => string = O.match({
  onNone: () => "n/a",
  onSome: (value) => `${value}%`,
});

const formatMix = (rows: ReadonlyArray<EconomicsCountRow>): string =>
  A.match(rows, {
    onEmpty: () => "none",
    onNonEmpty: (nonEmpty) =>
      A.join(
        A.map(nonEmpty, (row) => `${row.key} round(s) ${row.count}`),
        ", "
      ),
  });

const renderPrecisionRow = (row: EconomicsReviewLanePrecisionRow): string =>
  `${row.reviewer} ${formatPercent(row.precisionPct)} (fixed ${row.fixed}, rejected ${row.rejected}, immaterial ${row.immaterial}; intentional ${row.intentional}, unknown ${row.unknown})`;

/**
 * Render the review lane section for the terminal, three lines.
 *
 * **Example** (Render an empty section)
 *
 * ```ts
 * import { buildYeetEconomicsReviewLane, renderYeetEconomicsReviewLane } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const lines = renderYeetEconomicsReviewLane(buildYeetEconomicsReviewLane([], O.none()))
 * console.log(lines.length) // 3
 * ```
 *
 * @param section - The folded review lane section.
 * @returns The rounds line, the precision line, and the ledger line.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetEconomicsReviewLane = (section: EconomicsReviewLane): ReadonlyArray<string> => {
  const { roundsToReady: rounds, ledgerQuality: quality } = section;
  return [
    `review lane (rounds to ready; its own denominators, never summed with the lane populations): ${rounds.closedPullRequests} closed PR(s), ${rounds.openPullRequests} open; rounds p50 ${formatCount(rounds.p50Rounds)}, p95 ${formatCount(rounds.p95Rounds)}; mix: ${formatMix(rounds.roundsMix)}; unassigned reviews ${rounds.unassignedReviews}`,
    `  precision (${section.precisionMethod}): ${A.join(A.map(section.precision, renderPrecisionRow), "; ")}`,
    `  ledger: ${quality.rows} row(s) from ${quality.ledgersRead} ledger(s), ${quality.unreadableLedgers} unreadable, ${quality.malformedRows} malformed; ${quality.duplicateReviewRowsDeduplicated} duplicate review row(s) deduplicated; ${quality.pullRequestsWithoutFlip} PR(s) without a flip; ${quality.unattributedDispositions} unattributed disposition(s)`,
  ];
};
