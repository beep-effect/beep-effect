/**
 * The orchestrator's merge gate: re-verify one pull request at a pinned head
 * against AGENTS.md "Mergeable" plus the review-window ruling, then squash-merge.
 *
 * **Details**
 *
 * This is the CLI home of the gate the orchestrator session ran by hand on
 * 2026-10-06 (`merge.sh <pr> <sha10>`). The decision is a pure function of a
 * {@link MergeGateRead} so it can be tested from recorded GitHub payloads;
 * {@link readMergeGate} is the only place that talks to `gh`, and
 * {@link executeMergeGate} the only place that writes. Every unknown fails
 * closed: an unreadable ruleset, a GraphQL thread count that did not come
 * back, a missing head commit time, a required context with no check run.
 *
 * **Gotchas**
 *
 * A non-required red or pending check (Heavy / Coverage Regression, a
 * rate-limited Vercel deploy) is never tolerated by name alone. The caller
 * passes `--tolerate "<check>=<attribution>"` after reading the run, and the
 * attribution is echoed in the merge line so the hand-off log carries it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, DateTime, Effect } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../../internal/github/index.ts";
import { RepoRunContext } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import {
  deriveYeetReviewThreadState,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateInput,
  yeetReviewCommentAuthorKind,
  yeetReviewThreadStateOutstanding,
} from "./ReviewThreadState.ts";
import { readYeetReviewWindow, renderYeetReviewWindow, YeetReviewWindow } from "./ReviewWindow.ts";
import { readYeetRulesetRequiredContexts } from "./Settle.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { GhCommandFailure } from "../../../internal/github/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MergeGate");

/**
 * One check run on the head commit, reduced to what the gate reads.
 *
 * **Example** (A green required run)
 *
 * ```ts
 * import { MergeGateCheckRun } from "@beep/repo-cli/test/Yeet"
 *
 * const run = MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })
 * console.log(run.name) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCheckRun extends S.Class<MergeGateCheckRun>($I`MergeGateCheckRun`)(
  {
    id: S.Finite,
    name: S.NonEmptyString,
    status: S.String,
    conclusion: S.NullOr(S.String),
  },
  $I.annote("MergeGateCheckRun", { description: "One check run on the pull request head, as the gate reads it." })
) {}

/**
 * A non-required check the orchestrator tolerates red or pending, with the
 * attribution that justifies it.
 *
 * **Example** (Tolerate an inherited coverage red)
 *
 * ```ts
 * import { MergeGateTolerance } from "@beep/repo-cli/test/Yeet"
 *
 * const tolerance = MergeGateTolerance.make({
 *   check: "Heavy / Coverage Regression",
 *   attribution: "inherited: red on main since 2c1cb448ba, fix in #1477",
 * })
 * console.log(tolerance.check)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateTolerance extends S.Class<MergeGateTolerance>($I`MergeGateTolerance`)(
  { check: S.NonEmptyString, attribution: S.NonEmptyString },
  $I.annote("MergeGateTolerance", {
    description: "A non-required check tolerated red or pending, with the attribution that justifies it.",
  })
) {}

/**
 * Parse one `--tolerate "<check>=<attribution>"` argument.
 *
 * **Example** (Parse a tolerance)
 *
 * ```ts
 * import { parseMergeGateTolerance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseMergeGateTolerance("Heavy / Coverage Regression=inherited from main"))) // true
 * console.log(O.isNone(parseMergeGateTolerance("Heavy / Coverage Regression"))) // true
 * ```
 *
 * @param value - One `--tolerate` argument.
 * @returns The tolerance, or none when the form is wrong.
 * @category models
 * @since 0.0.0
 */
export const parseMergeGateTolerance = (value: string): O.Option<MergeGateTolerance> => {
  const separator = value.indexOf("=");
  if (separator < 0) return O.none();
  const check = Str.trim(value.slice(0, separator));
  const attribution = Str.trim(value.slice(separator + 1));
  return Str.isEmpty(check) || Str.isEmpty(attribution)
    ? O.none()
    : O.some(MergeGateTolerance.make({ check, attribution }));
};

/**
 * Everything the gate decides on, read once from GitHub at a point in time.
 *
 * **Details**
 *
 * `requiredContexts` is `None` when the base ruleset could not be read;
 * `unresolvedThreads` is `None` when the GraphQL thread read failed or was
 * truncated; `window` is `unknown` when the review-window reads failed. Each
 * unknown holds the gate rather than reading as "nothing to worry about".
 *
 * **Example** (Build a read)
 *
 * ```ts
 * import { MergeGateRead } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1459,
 *   title: "feat(ciops): P2 projection",
 *   headSha: "212fe39b4f0000000000000000000000000000ab",
 *   draft: false,
 *   mergeableState: "clean",
 *   requiredContexts: O.some(["Lint"]),
 *   checkRuns: [],
 *   window: { _tag: "elapsed", anchor: "ready-for-review", anchoredAt: "2026-10-06T08:00:52Z", windowMs: 1200000 },
 *   unresolvedThreads: O.some(0),
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * console.log(read.prNumber) // 1459
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateRead extends S.Class<MergeGateRead>($I`MergeGateRead`)(
  {
    prNumber: S.Finite,
    title: S.String,
    headSha: S.NonEmptyString,
    draft: S.Boolean,
    mergeableState: S.String,
    requiredContexts: S.NonEmptyString.pipe(S.Array, S.Option),
    checkRuns: S.Array(MergeGateCheckRun),
    window: YeetReviewWindow,
    unresolvedThreads: S.Option(S.Finite),
    readAt: S.DateTimeUtcFromString,
  },
  $I.annote("MergeGateRead", { description: "The pull request facts the merge gate decides on." })
) {}

/**
 * Why the gate held, as a closed domain so a caller can route each hold.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { MergeGateHoldReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MergeGateHoldReason.is["review-window-open"]("review-window-open")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateHoldReason = LiteralKit([
  "head-moved",
  "draft",
  "conflicting",
  "required-contexts-unknown",
  "required-pending",
  "required-red",
  "pending",
  "red",
  "review-window-unknown",
  "review-window-open",
  "threads-unknown",
  "threads-unresolved",
]).pipe($I.annoteSchema("MergeGateHoldReason", { description: "The first unmet merge-gate criterion." }));

/**
 * The first unmet merge-gate criterion.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateHoldReason = typeof MergeGateHoldReason.Type;

/**
 * The gate held: nothing is merged, and the reason is routed to whoever owns it.
 *
 * **Example** (A routed hold)
 *
 * ```ts
 * import { MergeGateHold } from "@beep/repo-cli/test/Yeet"
 *
 * const held = MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" })
 * console.log(held._tag) // "hold"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateHold extends S.TaggedClass<MergeGateHold>($I`MergeGateHold`)(
  "hold",
  { prNumber: S.Finite, reason: MergeGateHoldReason, detail: S.NonEmptyString },
  $I.annote("MergeGateHold", { description: "The merge gate refused on its first unmet criterion." })
) {}

/**
 * The gate is met: merge at this head with this squash title.
 *
 * **Example** (A met gate)
 *
 * ```ts
 * import { MergeGateMerge } from "@beep/repo-cli/test/Yeet"
 *
 * const met = MergeGateMerge.make({
 *   prNumber: 7,
 *   headSha: "abc",
 *   commitTitle: "fix: x (#7)",
 *   windowAgeSeconds: 1260,
 *   tolerated: [],
 * })
 * console.log(met._tag) // "merge"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerge extends S.TaggedClass<MergeGateMerge>($I`MergeGateMerge`)(
  "merge",
  {
    prNumber: S.Finite,
    headSha: S.NonEmptyString,
    commitTitle: S.NonEmptyString,
    windowAgeSeconds: S.Finite,
    tolerated: S.Array(MergeGateTolerance),
  },
  $I.annote("MergeGateMerge", { description: "The merge gate is met at a pinned head." })
) {}

/**
 * The gate's verdict.
 *
 * **Example** (Check a decision)
 *
 * ```ts
 * import { MergeGateDecision, MergeGateHold } from "@beep/repo-cli/test/Yeet"
 *
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MergeGateDecision)(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeGateDecision = S.Union([MergeGateHold, MergeGateMerge]).pipe(
  $I.annoteSchema("MergeGateDecision", { description: "Hold with a routed reason, or merge at a pinned head." })
);

/**
 * Hold with a routed reason, or merge at a pinned head.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeGateDecision = typeof MergeGateDecision.Type;

/**
 * What the caller asserts about the merge: the head it saw, the time, the
 * attributed tolerances, and whether the review window is overridden.
 *
 * **Details**
 *
 * The window itself (20 minutes by default, `BEEP_YEET_REVIEW_WINDOW`) is
 * read by `readYeetReviewWindow`, the same reader `yeet monitor` uses, so one
 * definition governs both. `forceWindow` exists for one case only: a fix that
 * unblocks `main`. The ruling text is in `feedback-review-window-before-merge`;
 * the flag is recorded in the merge line so the hand-off log shows every override.
 *
 * **Example** (State the caller's assertions)
 *
 * ```ts
 * import { MergeGateOptions } from "@beep/repo-cli/test/Yeet"
 *
 * import { DateTime } from "effect"
 *
 * const options = MergeGateOptions.make({ wantSha: "abc", now: DateTime.makeUnsafe(0), tolerate: [], forceWindow: false })
 * console.log(options.forceWindow) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateOptions extends S.Class<MergeGateOptions>($I`MergeGateOptions`)(
  {
    wantSha: S.NonEmptyString,
    now: S.DateTimeUtcFromString,
    tolerate: S.Array(MergeGateTolerance),
    forceWindow: S.Boolean,
  },
  $I.annote("MergeGateOptions", { description: "What the caller asserts when it asks the gate." })
) {}

/**
 * One gate question: the read and what the caller asserts about it.
 *
 * **Example** (Build a question)
 *
 * ```ts
 * import { MergeGateInput } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof MergeGateInput.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateInput extends S.Class<MergeGateInput>($I`MergeGateInput`)(
  { read: MergeGateRead, options: MergeGateOptions },
  $I.annote("MergeGateInput", { description: "The read and the caller's assertions the gate decides from." })
) {}

const goodConclusion = (conclusion: string | null): boolean =>
  conclusion === "success" || conclusion === "skipped" || conclusion === "neutral";

const latestRunPerName = (runs: ReadonlyArray<MergeGateCheckRun>): HashMap.HashMap<string, MergeGateCheckRun> =>
  A.reduce(runs, HashMap.empty<string, MergeGateCheckRun>(), (latest, run) =>
    latest.pipe(
      HashMap.get(run.name),
      O.exists((current) => current.id >= run.id)
    )
      ? latest
      : HashMap.set(latest, run.name, run)
  );

const hold = (prNumber: number, reason: MergeGateHoldReason, detail: string): MergeGateHold =>
  MergeGateHold.make({ prNumber, reason, detail });

const holdWhen = (
  condition: boolean,
  prNumber: number,
  reason: MergeGateHoldReason,
  detail: string
): O.Option<MergeGateHold> => (condition ? O.some(hold(prNumber, reason, detail)) : O.none());

const names = (runs: ReadonlyArray<MergeGateCheckRun>): string =>
  A.join(
    A.map(runs, (run) => run.name),
    ", "
  );

const sameHead = (want: string, head: string): boolean => Str.startsWith(want)(head) || want === head;

// Cheap structural refusals, before any check is read.
const structuralHold = ({ read, options }: MergeGateInput): O.Option<MergeGateHold> =>
  O.firstSomeOf([
    holdWhen(
      !sameHead(options.wantSha, read.headSha),
      read.prNumber,
      "head-moved",
      `head is ${read.headSha.slice(0, 10)}, caller saw ${options.wantSha.slice(0, 10)}`
    ),
    holdWhen(read.draft, read.prNumber, "draft", "still draft; the owner flips ready at content-final"),
    holdWhen(
      read.mergeableState === "dirty",
      read.prNumber,
      "conflicting",
      "conflicts with the base; owner merges main"
    ),
  ]);

const runsHold = (
  runs: ReadonlyArray<MergeGateCheckRun>,
  prNumber: number,
  reason: MergeGateHoldReason,
  prefix: string
): O.Option<MergeGateHold> => holdWhen(A.isReadonlyArrayNonEmpty(runs), prNumber, reason, `${prefix}: ${names(runs)}`);

const isPending = (run: MergeGateCheckRun): boolean => run.status !== "completed";
const isRed = (run: MergeGateCheckRun): boolean => !goodConclusion(run.conclusion);

// Required contexts must be registered, complete and green; every other check
// must be too unless the caller attributed it with --tolerate.
const checksHold = (
  { read, options }: MergeGateInput,
  latest: HashMap.HashMap<string, MergeGateCheckRun>
): O.Option<MergeGateHold> =>
  O.match(read.requiredContexts, {
    onNone: () =>
      O.some(
        hold(read.prNumber, "required-contexts-unknown", "base ruleset unreadable; never evaluate the gate without it")
      ),
    onSome: (contexts) => {
      if (!A.isReadonlyArrayNonEmpty(contexts)) {
        return O.some(
          hold(
            read.prNumber,
            "required-contexts-unknown",
            "base ruleset requires no status checks; no CI evidence to gate on"
          )
        );
      }
      const required = HashSet.fromIterable(contexts);
      const tolerated = HashSet.fromIterable(A.map(options.tolerate, (tolerance) => tolerance.check));
      const runs = latest.pipe(HashMap.values, A.fromIterable);
      const requiredRuns = A.filter(runs, (run) => HashSet.has(required, run.name));
      const optionalRuns = A.filter(
        runs,
        (run) => !HashSet.has(required, run.name) && !HashSet.has(tolerated, run.name)
      );
      const missing = A.filter(contexts, (context) => !HashMap.has(latest, context));
      return O.firstSomeOf([
        holdWhen(
          A.isReadonlyArrayNonEmpty(missing),
          read.prNumber,
          "required-pending",
          `required context(s) not registered on the head: ${A.join(missing, ", ")}`
        ),
        runsHold(A.filter(requiredRuns, isPending), read.prNumber, "required-pending", "required still running"),
        runsHold(A.filter(requiredRuns, isRed), read.prNumber, "required-red", "required red"),
        runsHold(
          A.filter(optionalRuns, isPending),
          read.prNumber,
          "pending",
          'still running, pass --tolerate "<check>=<attribution>" to merge over it'
        ),
        runsHold(A.filter(optionalRuns, isRed), read.prNumber, "red", "red, attribute it before tolerating"),
      ]);
    },
  });

// An unknown window always holds; an open one holds unless the caller forced
// it. Otherwise the step yields how long the window has run, for the merge line.
const windowStep = ({ read, options }: MergeGateInput): Result.Result<number, MergeGateHold> => {
  const window = read.window;
  if (window._tag === "unknown") {
    return Result.fail(hold(read.prNumber, "review-window-unknown", renderYeetReviewWindow(window)));
  }
  if (!options.forceWindow && window._tag === "open") {
    return Result.fail(hold(read.prNumber, "review-window-open", renderYeetReviewWindow(window)));
  }
  return Result.succeed(
    DateTime.make(window.anchoredAt).pipe(
      O.map((anchored) => Math.floor((DateTime.toEpochMillis(options.now) - DateTime.toEpochMillis(anchored)) / 1000)),
      O.getOrElse(() => 0)
    )
  );
};

const threadsHold = (read: MergeGateRead): O.Option<MergeGateHold> =>
  O.match(read.unresolvedThreads, {
    onNone: () =>
      O.some(
        hold(
          read.prNumber,
          "threads-unknown",
          "review threads unreadable (GraphQL quota?); a missing count is never zero"
        )
      ),
    onSome: (count) => holdWhen(count > 0, read.prNumber, "threads-unresolved", `${count} unresolved thread(s)`),
  });

/**
 * Decide the gate from one read. Pure, so recorded payloads prove every branch.
 *
 * **Details**
 *
 * Criteria in order, first failure wins: head unchanged since the caller
 * looked; not draft; not conflicting; base ruleset readable; every required
 * context registered, complete and green; every other check complete and
 * green unless tolerated with an attribution; review window known and
 * elapsed unless forced; thread count known and zero. The order puts
 * the cheap structural refusals first and the two judgment calls (window,
 * threads) last, matching the hand-run gate.
 *
 * **Example** (A draft never merges)
 *
 * ```ts
 * import { MergeGateRead, decideMergeGate } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const read = MergeGateRead.make({
 *   prNumber: 1,
 *   title: "fix: x",
 *   headSha: "abc",
 *   draft: true,
 *   mergeableState: "clean",
 *   requiredContexts: O.some([]),
 *   checkRuns: [],
 *   window: { _tag: "unknown", reason: "not read" },
 *   unresolvedThreads: O.some(0),
 *   readAt: DateTime.makeUnsafe(0),
 * })
 * const decision = decideMergeGate({
 *   read,
 *   options: { wantSha: "abc", now: DateTime.makeUnsafe(0), tolerate: [], forceWindow: false },
 * })
 * console.log(decision._tag) // "hold"
 * ```
 *
 * @param input - The read and the caller's assertions.
 * @returns Hold with a routed reason, or merge at the pinned head.
 * @category workflows
 * @since 0.0.0
 */
export const decideMergeGate = (input: MergeGateInput): MergeGateDecision => {
  const { read, options } = input;
  const latest = latestRunPerName(read.checkRuns);
  const window = windowStep(input);
  return O.firstSomeOf([
    structuralHold(input),
    checksHold(input, latest),
    Result.getFailure(window),
    threadsHold(read),
  ]).pipe(
    O.getOrElse(
      (): MergeGateDecision =>
        MergeGateMerge.make({
          prNumber: read.prNumber,
          headSha: read.headSha,
          commitTitle: `${read.title} (#${read.prNumber})`,
          // Every hold above is None here, so the window step succeeded.
          windowAgeSeconds: Result.getOrThrow(window),
          tolerated: A.filter(options.tolerate, (tolerance) => HashMap.has(latest, tolerance.check)),
        })
    )
  );
};

/**
 * Render a decision as the one line the hand-off log keeps.
 *
 * **Example** (Render a hold)
 *
 * ```ts
 * import { MergeGateHold, renderMergeGateDecision } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderMergeGateDecision(MergeGateHold.make({ prNumber: 7, reason: "draft", detail: "still draft" })))
 * // "#7 HOLD draft: still draft"
 * ```
 *
 * @param decision - The gate verdict.
 * @returns One line for the hand-off log.
 * @category formatting
 * @since 0.0.0
 */
export const renderMergeGateDecision = (decision: MergeGateDecision): string =>
  decision._tag === "hold"
    ? `#${decision.prNumber} HOLD ${decision.reason}: ${decision.detail}`
    : `#${decision.prNumber} GATE-MET at ${decision.headSha.slice(0, 10)} (window ${decision.windowAgeSeconds}s)${
        A.isReadonlyArrayNonEmpty(decision.tolerated)
          ? ` tolerated: ${A.join(
              A.map(decision.tolerated, (tolerance) => `${tolerance.check} [${tolerance.attribution}]`),
              "; "
            )}`
          : ""
      }`;

const GhPull = S.Struct({
  number: S.Finite,
  title: S.String,
  draft: S.Boolean,
  created_at: S.String,
  mergeable_state: S.NullOr(S.String),
  head: S.Struct({ sha: S.String }),
  base: S.Struct({ ref: S.String }),
  user: S.NullOr(S.Struct({ login: S.String })),
});
const GhCheckRuns = S.Struct({
  check_runs: S.Array(S.Struct({ id: S.Finite, name: S.String, status: S.String, conclusion: S.NullOr(S.String) })),
});
const GhThreadNode = S.Struct({
  id: S.String,
  isResolved: S.Boolean,
  isOutdated: S.Boolean,
  resolvedBy: S.NullOr(S.Struct({ login: S.String })),
  comments: S.Struct({
    nodes: S.Array(
      S.Struct({
        createdAt: S.optionalKey(S.String),
        author: S.NullOr(S.Struct({ __typename: S.optionalKey(S.String), login: S.String })),
      })
    ),
  }),
});
const GhThreads = S.Struct({
  data: S.Struct({
    repository: S.Struct({
      pullRequest: S.Struct({
        reviewThreads: S.Struct({ totalCount: S.Finite, nodes: S.Array(GhThreadNode) }),
      }),
    }),
  }),
});
const GhMergeResult = S.Struct({ merged: S.Boolean, sha: S.optionalKey(S.String), message: S.optionalKey(S.String) });

const decodePull = S.decodeUnknownEffect(S.fromJsonString(GhPull));
const decodeCheckRunPages = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhCheckRuns)));
const decodeThreads = S.decodeUnknownEffect(S.fromJsonString(GhThreads));
const decodeMergeResult = S.decodeUnknownEffect(S.fromJsonString(GhMergeResult));

// AGENTS.md "Mergeable": an unresolved thread, or one the author resolved
// that a human commented on afterwards, still owes a reply. Same rule as
// closeout, status and watch: deriveYeetReviewThreadState.
const outstandingThreadCount = (
  nodes: ReadonlyArray<typeof GhThreadNode.Type>,
  pullRequestAuthor: O.Option<string>
): number =>
  A.length(
    A.filter(nodes, (node) =>
      yeetReviewThreadStateOutstanding(
        deriveYeetReviewThreadState(
          YeetReviewThreadStateInput.make({
            threadId: node.id,
            isResolved: node.isResolved,
            isOutdated: node.isOutdated,
            pullRequestAuthor,
            resolvedBy: O.fromNullishOr(node.resolvedBy?.login),
            newestComment: A.last(node.comments.nodes).pipe(
              O.flatMap((comment) =>
                O.map(O.fromNullishOr(comment.author), (author) =>
                  YeetReviewThreadNewestComment.make({
                    authorLogin: author.login,
                    authorKind: yeetReviewCommentAuthorKind(O.fromUndefinedOr(author.__typename)),
                    createdAt: O.fromUndefinedOr(comment.createdAt),
                  })
                )
              )
            ),
          })
        )
      )
    )
  );

const THREADS_QUERY =
  "query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){totalCount nodes{id isResolved isOutdated resolvedBy{login} comments(last:1){nodes{createdAt author{__typename login}}}}}}}}";

const ghFailure = (what: string) => (failure: GhCommandFailure) =>
  YeetCommandError.make({
    message: `${what} failed (${failure._tag}${failure._tag === "nonzero-exit" ? ` ${failure.exitCode}: ${Str.trim(failure.output)}` : ""}).`,
    command: failure.command,
    exitCode: 1,
  });

const gh = (context: RepoRunContext, label: string, args: ReadonlyArray<string>) =>
  ghOutput({ args, cwd: context.repoRoot, label, onFailure: ghFailure(label) });

const decodeOrFail = <A>(what: string, decode: (input: unknown) => Effect.Effect<A, S.SchemaError>, input: string) =>
  decode(input).pipe(Effect.mapError(YeetCommandError.new(`Failed to decode ${what}.`)));

/**
 * Read everything the gate needs for one pull request, once.
 *
 * **Details**
 *
 * REST for the pull request and check runs (core quota); the review window
 * and the base ruleset through the same readers `yeet monitor` uses; one
 * GraphQL query for the unresolved thread count. The thread read is the only
 * call allowed to fail softly, and it fails to `None`, which the decision
 * treats as a hold.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readMergeGate = Effect.fn("Yeet.readMergeGate")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<MergeGateRead, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const pull = yield* decodeOrFail(
    "the pull request",
    decodePull,
    yield* gh(context, `gh api pulls/${prNumber}`, ["api", `repos/{owner}/{repo}/pulls/${prNumber}`])
  );
  // `--slurp` wraps pages in an array; fold the pages back into one check_runs list.
  const checkRunPages = yield* decodeOrFail(
    "the head check runs",
    decodeCheckRunPages,
    yield* gh(context, "gh api check-runs", [
      "api",
      `repos/{owner}/{repo}/commits/${pull.head.sha}/check-runs?per_page=100`,
      "--paginate",
      "--slurp",
    ])
  );
  const checkRuns = A.flatMap(checkRunPages, (page) => page.check_runs);
  const unresolvedThreads = yield* gh(context, "gh api graphql threads", [
    "api",
    "graphql",
    "-f",
    `query=${THREADS_QUERY}`,
    "-F",
    "owner={owner}",
    "-F",
    "name={repo}",
    "-F",
    `number=${prNumber}`,
  ]).pipe(
    Effect.flatMap((output) => decodeOrFail("the review threads", decodeThreads, output)),
    Effect.map(({ data }) => {
      const threads = data.repository.pullRequest.reviewThreads;
      // More threads than one page: the count is unknown, never a lower bound.
      return threads.totalCount > A.length(threads.nodes)
        ? O.none<number>()
        : O.some(outstandingThreadCount(threads.nodes, O.fromNullishOr(pull.user?.login)));
    }),
    Effect.orElseSucceed(O.none<number>)
  );
  // The PR's own base decides the required contexts, not the caller's --base.
  const ruleset = yield* readYeetRulesetRequiredContexts(
    RepoRunContext.make({ ...context, base: `origin/${pull.base.ref}` })
  );
  return MergeGateRead.make({
    prNumber: pull.number,
    title: pull.title,
    headSha: pull.head.sha,
    draft: pull.draft,
    mergeableState: pull.mergeable_state ?? "unknown",
    requiredContexts: O.map(ruleset, (rules) => rules.contexts),
    checkRuns: A.map(checkRuns, (run) =>
      MergeGateCheckRun.make({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion })
    ),
    window: yield* readYeetReviewWindow(context, { prNumber: pull.number, headSha: pull.head.sha }),
    unresolvedThreads,
    readAt: yield* DateTime.now,
  });
});

/**
 * Result of the squash merge GitHub reported.
 *
 * **Example** (A confirmed merge)
 *
 * ```ts
 * import { MergeGateMerged } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(MergeGateMerged.make({ prNumber: 7, mergeSha: "feedface", commitTitle: "fix: x (#7)" }).prNumber) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateMerged extends S.Class<MergeGateMerged>($I`MergeGateMerged`)(
  { prNumber: S.Finite, mergeSha: S.String, commitTitle: S.NonEmptyString },
  $I.annote("MergeGateMerged", { description: "The squash merge GitHub confirmed." })
) {}

/**
 * Squash-merge at the pinned head with `<title> (#n)` as the commit title.
 *
 * **Gotchas**
 *
 * The `sha` field makes GitHub refuse server-side when the head moved between
 * the read and the merge, so a push landing in that window is never merged
 * sight-unseen.
 *
 * **Example** (Build the merge effect)
 *
 * ```ts
 * import { executeMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof executeMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const executeMergeGate = Effect.fn("Yeet.executeMergeGate")(function* (
  context: RepoRunContext,
  decision: MergeGateMerge
): Effect.fn.Return<MergeGateMerged, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* decodeOrFail(
    "the merge result",
    decodeMergeResult,
    yield* gh(context, `gh api merge #${decision.prNumber}`, [
      "api",
      "-X",
      "PUT",
      `repos/{owner}/{repo}/pulls/${decision.prNumber}/merge`,
      "-f",
      "merge_method=squash",
      "-f",
      `sha=${decision.headSha}`,
      "-f",
      `commit_title=${decision.commitTitle}`,
    ])
  );
  if (!result.merged) {
    return yield* YeetCommandError.make({
      message: `GitHub did not merge #${decision.prNumber}: ${result.message ?? "no message"}`,
      exitCode: 1,
    });
  }
  return MergeGateMerged.make({
    prNumber: decision.prNumber,
    mergeSha: result.sha ?? "",
    commitTitle: decision.commitTitle,
  });
});

/**
 * Options for one `yeet merge-gate` run.
 *
 * **Example** (Describe one run)
 *
 * ```ts
 * import { MergeGateRunOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const run = MergeGateRunOptions.make({ prNumber: 7, wantSha: "abc", tolerate: [], forceWindow: false, dryRun: true })
 * console.log(run.dryRun) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateRunOptions extends S.Class<MergeGateRunOptions>($I`MergeGateRunOptions`)(
  {
    prNumber: S.Finite,
    wantSha: S.NonEmptyString,
    tolerate: S.Array(MergeGateTolerance),
    forceWindow: S.Boolean,
    dryRun: S.Boolean,
  },
  $I.annote("MergeGateRunOptions", { description: "One merge-gate invocation." })
) {}

/**
 * Read, decide, print, and merge unless the gate held or `--dry-run` was passed.
 *
 * **Details**
 *
 * A hold exits non-zero with the routed reason so a background waiter can
 * loop on it; a merge prints the merge sha and any tolerated attribution. The
 * window override is printed whenever it was used.
 *
 * **Example** (Build the gate effect)
 *
 * ```ts
 * import { runMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runMergeGate) // "function"
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const runMergeGate = Effect.fn("Yeet.runMergeGate")(function* (
  context: RepoRunContext,
  options: MergeGateRunOptions
): Effect.fn.Return<MergeGateDecision, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const read = yield* readMergeGate(context, options.prNumber);
  const decision = decideMergeGate({
    read,
    options: {
      wantSha: options.wantSha,
      now: read.readAt,
      tolerate: options.tolerate,
      forceWindow: options.forceWindow,
    },
  });
  yield* Console.log(
    `[yeet] ${renderMergeGateDecision(decision)}${options.forceWindow ? " (review window forced)" : ""}`
  );
  if (decision._tag === "hold") {
    return yield* YeetCommandError.make({ message: renderMergeGateDecision(decision), exitCode: 1 });
  }
  if (options.dryRun) {
    yield* Console.log(`[yeet] dry run: would squash-merge #${decision.prNumber} as "${decision.commitTitle}"`);
    return decision;
  }
  const merged = yield* executeMergeGate(context, decision);
  yield* Console.log(`[yeet] MERGED #${merged.prNumber} -> ${merged.mergeSha.slice(0, 10)} "${merged.commitTitle}"`);
  return decision;
});

/**
 * The `yeet merge-gate` flags as the CLI parses them, before `--tolerate` is decoded.
 *
 * **Example** (Describe an invocation)
 *
 * ```ts
 * import { MergeGateCommandOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = MergeGateCommandOptions.make({
 *   base: "origin/main",
 *   head: "HEAD",
 *   packetDir: ".beep/yeet",
 *   pr: 1459,
 *   sha: "212fe39b4f",
 *   tolerate: [],
 *   forceWindow: false,
 *   dryRun: true,
 * })
 * console.log(options.pr) // 1459
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MergeGateCommandOptions extends S.Class<MergeGateCommandOptions>($I`MergeGateCommandOptions`)(
  {
    base: S.String,
    head: S.String,
    packetDir: S.String,
    pr: S.Finite,
    sha: S.String,
    tolerate: S.Array(S.String),
    forceWindow: S.Boolean,
    dryRun: S.Boolean,
  },
  $I.annote("MergeGateCommandOptions", { description: "Parsed yeet merge-gate flags before tolerances are decoded." })
) {}

/**
 * Run `yeet merge-gate`: decode the tolerances, resolve the repo root, gate, and merge.
 *
 * **Details**
 *
 * Unlike `yeet merge`, which merges the current branch's pull request and
 * sweeps the clone, this takes any pull request number and never sweeps: the
 * owning session retires its own lane after the orchestrator reports the
 * merge. A malformed `--tolerate` is refused before anything is read.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetMergeGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetMergeGate) // "function"
 * ```
 *
 * @param options - The parsed command flags.
 * @returns Nothing; a hold fails with the routed reason.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetMergeGate = Effect.fn("Yeet.runMergeGateCommand")(function* (options: MergeGateCommandOptions) {
  const parsed = A.map(options.tolerate, parseMergeGateTolerance);
  const malformed = A.filter(A.zip(options.tolerate, parsed), ([, tolerance]) => O.isNone(tolerance));
  if (A.isReadonlyArrayNonEmpty(malformed)) {
    return yield* YeetCommandError.make({
      message: `--tolerate needs "<check name>=<attribution>"; got ${A.join(
        A.map(malformed, ([value]) => JSON.stringify(value)),
        ", "
      )}.`,
      exitCode: 1,
    });
  }
  const context = yield* hydrateYeetReadOnlyContext(options);
  yield* runMergeGate(context, {
    prNumber: options.pr,
    wantSha: options.sha,
    tolerate: A.getSomes(parsed),
    forceWindow: options.forceWindow,
    dryRun: options.dryRun,
  });
});
