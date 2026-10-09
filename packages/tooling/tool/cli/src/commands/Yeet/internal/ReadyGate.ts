/**
 * `yeet ready`: flip a draft pull request to ready once its content is final.
 *
 * **Details**
 *
 * Push-first publish opens every pull request as a draft (push-first-publish
 * D4). Draft means only "the owner is still pushing": the owner runs this flip
 * as soon as the content is final, without waiting for hosted heavy CI, so the
 * CI run doubles as the review window (review-window ruling, 2026-10-06, which
 * amends D10). The flip reads the pull request through the same status read
 * the readiness monitor uses and flips it (the GraphQL-only mutation, through
 * the budget guard) when, on the current head, no required check is known to
 * be failing and every review thread is answered. Pending checks and optional
 * lanes do not hold it. Anything else refuses with the first blocker named.
 * There is no `--force`. The merge gate, not this flip, waits for green checks
 * and for the review window.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { flipPullRequestReady } from "./GhOps.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { YEET_READY_COMMAND } from "./MonitorPolicy.ts";
import { findLiveReadyMonitorJob } from "./ProofJob.ts";
import { ProofJobLauncher } from "./ProofJobLauncher.ts";
import { YEET_REVIEW_WINDOW_DEFAULT } from "./ReviewWindow.ts";
import { collectYeetStatus, YeetStatusRemote } from "./Status.ts";
import { mergeReadyCriterionHolds, YeetMergeReady } from "./Verdict.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetReadyOptions } from "../Yeet.schemas.ts";
import type { ProofJobRecord } from "./ProofJob.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReadyGate");

const YEET_MONITOR_SUBMIT_COMMAND = "bun run beep yeet monitor --until-ready --detach";

/**
 * The criteria the draft-to-ready flip checks, in the order it names a blocker.
 *
 * **Details**
 *
 * The pull request must be open, no required check may be known to be failing
 * on the current head, and every review thread must be answered. `no-required-red`
 * is deliberately weaker than the merge gate's `required-checks-green`: a
 * pending required check, a pending or red optional lane (the `Heavy / *`
 * matrix), and a check census that could not be read all let the flip through,
 * because the flip happens at content-final and the merge gate still demands
 * green. Mergeability, the closeout run, and the review window are left to
 * `monitor --until-ready`.
 *
 * **Example** (List the gate criteria)
 *
 * ```ts
 * import { YeetReadyGateCriterion } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReadyGateCriterion.literals) // ["pr-open", "no-required-red", "threads-resolved"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReadyGateCriterion = LiteralKit(["pr-open", "no-required-red", "threads-resolved"]).pipe(
  $I.annoteSchema("YeetReadyGateCriterion", {
    description: "A criterion the yeet ready flip requires before a content-final pull request leaves draft.",
  })
);

/**
 * A criterion the draft-to-ready flip requires.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReadyGateCriterion = typeof YeetReadyGateCriterion.Type;

/**
 * The pull request read the flip decides on: the live remote summary and the
 * merge-readiness verdict derived from the same read.
 *
 * **Example** (A read with no pull request)
 *
 * ```ts
 * import { YeetReadyPullRequestRead, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const read = YeetReadyPullRequestRead.make({
 *   remote: YeetStatusRemote.make({ available: false, checked: true, detail: "no pull request" }),
 *   mergeReady: O.none(),
 * })
 * console.log(O.isNone(read.mergeReady)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyPullRequestRead extends S.Class<YeetReadyPullRequestRead>($I`YeetReadyPullRequestRead`)(
  {
    remote: YeetStatusRemote,
    mergeReady: S.Option(YeetMergeReady),
  },
  $I.annote("YeetReadyPullRequestRead", {
    description: "The live pull request summary and merge-readiness verdict the yeet ready gate decides on.",
  })
) {}

/**
 * The gate passed on a draft: flip it.
 *
 * **Example** (Describe a flip decision)
 *
 * ```ts
 * import { YeetReadyGateFlip } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const decision = YeetReadyGateFlip.make({ prNumber: 42, headSha: O.some("abc1234") })
 * console.log(decision._tag) // "flip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyGateFlip extends S.TaggedClass<YeetReadyGateFlip>($I`YeetReadyGateFlip`)(
  "flip",
  { prNumber: S.Finite, headSha: S.Option(S.String) },
  $I.annote("YeetReadyGateFlip", {
    description: "The content-final gate holds on a draft pull request; flip it to ready.",
  })
) {}

/**
 * The gate passed and the pull request is already ready for review.
 *
 * **Example** (Describe an already-ready decision)
 *
 * ```ts
 * import { YeetReadyGateAlreadyReady } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = YeetReadyGateAlreadyReady.make({ prNumber: 42 })
 * console.log(decision._tag) // "already-ready"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyGateAlreadyReady extends S.TaggedClass<YeetReadyGateAlreadyReady>($I`YeetReadyGateAlreadyReady`)(
  "already-ready",
  { prNumber: S.Finite },
  $I.annote("YeetReadyGateAlreadyReady", {
    description: "The pull request is open and not a draft; nothing to flip.",
  })
) {}

/**
 * The gate refused: the first unmet criterion and what the read observed.
 *
 * **Example** (Describe a blocked decision)
 *
 * ```ts
 * import { YeetReadyGateBlocked } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = YeetReadyGateBlocked.make({
 *   blocker: "threads-resolved",
 *   detail: "1 review thread still owes an answer",
 * })
 * console.log(decision.blocker) // "threads-resolved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyGateBlocked extends S.TaggedClass<YeetReadyGateBlocked>($I`YeetReadyGateBlocked`)(
  "blocked",
  { blocker: YeetReadyGateCriterion, detail: S.NonEmptyString },
  $I.annote("YeetReadyGateBlocked", {
    description: "The content-final gate refuses the flip on its first unmet criterion.",
  })
) {}

/**
 * What the draft-to-ready gate decided for one pull request read.
 *
 * **Example** (Decode a blocked decision)
 *
 * ```ts
 * import { YeetReadyGateDecision } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decision = S.decodeUnknownSync(YeetReadyGateDecision)({
 *   _tag: "blocked", blocker: "threads-resolved", detail: "1 review thread still owes an answer",
 * })
 * console.log(decision._tag) // "blocked"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReadyGateDecision = S.Union([YeetReadyGateFlip, YeetReadyGateAlreadyReady, YeetReadyGateBlocked]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetReadyGateDecision", {
    description: "Flip, already-ready, or blocked decision of the yeet ready gate.",
  })
);

/**
 * What the draft-to-ready gate decided for one pull request read.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReadyGateDecision = typeof YeetReadyGateDecision.Type;

/**
 * Typed refusal raised when `yeet ready` will not flip the draft.
 *
 * **Example** (Name the blocker)
 *
 * ```ts
 * import { YeetReadyGateRefused } from "@beep/repo-cli/test/Yeet"
 *
 * const error = YeetReadyGateRefused.make({ blocker: "no-required-red", message: "1 required check is failing" })
 * console.log(error.blocker) // "no-required-red"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class YeetReadyGateRefused extends S.TaggedError<YeetReadyGateRefused>($I`YeetReadyGateRefused`)(
  "YeetReadyGateRefused",
  {
    blocker: YeetReadyGateCriterion,
    message: S.String,
  },
  $I.annoteError<YeetReadyGateRefused>("YeetReadyGateRefused", {
    description: "yeet ready refused to flip a draft pull request because a content-final criterion is unmet.",
  })
) {
  /** Process exit code reported when the refusal reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

const countOf = (value: number | undefined): number => value ?? 0;

const failingRequiredChecks = (remote: YeetStatusRemote) =>
  A.filter(remote.checks, (check) => check.required && check.outcome === "fail");

// A required check known to be red on the current head. Pending and unread
// checks are not red: the flip happens before hosted CI finishes.
const noRequiredRed = (remote: YeetStatusRemote): boolean =>
  countOf(remote.failingRequiredCheckCount) === 0 && A.isReadonlyArrayEmpty(failingRequiredChecks(remote));

const readyGateCriterionHolds = (read: YeetReadyPullRequestRead, criterion: YeetReadyGateCriterion): boolean =>
  O.exists(read.mergeReady, (ready) =>
    YeetReadyGateCriterion.$match(criterion, {
      "pr-open": () => mergeReadyCriterionHolds(ready.criteria, "pr-open"),
      "no-required-red": () => noRequiredRed(read.remote),
      "threads-resolved": () => mergeReadyCriterionHolds(ready.criteria, "threads-resolved"),
    })
  );

const blockerDetail = (blocker: YeetReadyGateCriterion, remote: YeetStatusRemote): string =>
  Match.value(blocker).pipe(
    Match.when("pr-open", () =>
      remote.available && remote.state !== undefined
        ? `pull request #${remote.number ?? "?"} is ${remote.state}`
        : "no open pull request was found for this branch"
    ),
    Match.when("no-required-red", () => {
      const names = A.map(failingRequiredChecks(remote), (check) => check.name);
      const count = Num.max(countOf(remote.failingRequiredCheckCount), A.length(names));
      const named = A.isReadonlyArrayNonEmpty(names) ? ` (${A.join(names, ", ")})` : Str.empty;
      return `${count} required check(s) are failing on head ${O.getOrElse(remote.headSha, () => "unknown")}${named}; a red required check means the content is not final. Pending checks and optional lanes do not hold the flip`;
    }),
    Match.when(
      "threads-resolved",
      () =>
        `${countOf(remote.unresolvedReviewThreadCount) + countOf(remote.followUpThreadCount)} review thread(s) still owe an answer; answer them with \`bun run beep yeet reply\``
    ),
    Match.exhaustive
  );

/**
 * Decide the draft-to-ready flip for one pull request read.
 *
 * **Details**
 *
 * Walks {@link YeetReadyGateCriterion} in order against the read the monitor
 * also takes. An unread pull request fails every criterion, so it is blocked on
 * `pr-open`. With the gate met, a draft is flipped and a non-draft is reported
 * as already ready. Hosted checks that are still pending, and optional lanes
 * in any state, never block: the flip is due at content-final.
 *
 * **Example** (A missing pull request is blocked on pr-open)
 *
 * ```ts
 * import { decideYeetReadyGate, YeetReadyPullRequestRead, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const decision = decideYeetReadyGate(
 *   YeetReadyPullRequestRead.make({
 *     remote: YeetStatusRemote.make({ available: false, checked: true, detail: "no pull request" }),
 *     mergeReady: O.none(),
 *   })
 * )
 * console.log(decision._tag) // "blocked"
 * ```
 *
 * @param read - The live pull request summary and its merge-readiness verdict.
 * @returns Flip, already-ready, or the first blocker.
 * @category utilities
 * @since 0.0.0
 */
export const decideYeetReadyGate = (read: YeetReadyPullRequestRead): YeetReadyGateDecision => {
  const blocker = A.findFirst(
    YeetReadyGateCriterion.literals,
    (criterion) => !readyGateCriterionHolds(read, criterion)
  );
  // A pull request that is no longer a draft has nothing to flip, whatever
  // its checks and threads say: the verb must be idempotent, so a thread that
  // lands right after the flip reads as `already-ready`, never as a pending
  // flip an agent might wait on.
  // Only an OPEN pull request can be "already ready": `gh pr view` also
  // returns CLOSED and MERGED ones, and those still refuse on `pr-open`.
  const alreadyReady = O.filter(
    O.fromUndefinedOr(read.remote.number),
    () => read.remote.isDraft === false && read.remote.state === "OPEN"
  );
  if (O.isSome(alreadyReady)) return YeetReadyGateAlreadyReady.make({ prNumber: alreadyReady.value });
  return pipe(
    O.fromUndefinedOr(read.remote.number),
    O.filter(() => O.isNone(blocker)),
    O.match({
      onNone: () => {
        const unmet = O.getOrElse(blocker, () => YeetReadyGateCriterion.literals[0]);
        return YeetReadyGateBlocked.make({ blocker: unmet, detail: blockerDetail(unmet, read.remote) });
      },
      onSome: (prNumber): YeetReadyGateDecision => YeetReadyGateFlip.make({ prNumber, headSha: read.remote.headSha }),
    })
  );
};

const readPullRequestForReady = Effect.fn("Yeet.readPullRequestForReady")(function* (context: RepoRunContext) {
  const snapshot = yield* collectYeetStatus(context, true);
  return YeetReadyPullRequestRead.make({ remote: snapshot.remote, mergeReady: snapshot.mergeReady });
});

// The live `monitor --until-ready` job for the pull request, when one exists.
// A registry read failure only loses the hint, never the flip.
const findLiveMonitorForReady = (
  context: RepoRunContext,
  prNumber: number
): Effect.Effect<
  O.Option<ProofJobRecord>,
  never,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
  ProofJobLauncher.make(context.repoRoot).pipe(
    Effect.flatMap((launcher) => launcher.list),
    Effect.map(findLiveReadyMonitorJob({ branch: context.branch, prNumber })),
    Effect.catch(() => Effect.succeedNone)
  );

const markReadyThroughBudget = (prNumber: number) =>
  flipPullRequestReady(prNumber).pipe(
    Effect.mapError((cause) =>
      YeetCommandError.make({
        message: `could not mark pull request #${prNumber} ready for review: ${cause.message}`,
        command: `bun run beep yeet gh pr ready ${prNumber}`,
        exitCode: cause._tag === "GraphqlBudgetExhausted" ? 75 : 1,
      })
    )
  );

interface YeetReadyGateDependencies {
  readonly findMonitor?: typeof findLiveMonitorForReady;
  readonly markReady?: (
    prNumber: number
  ) => Effect.Effect<void, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>;
  readonly read?: (
    context: RepoRunContext
  ) => Effect.Effect<
    YeetReadyPullRequestRead,
    YeetCommandError,
    Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
}

/**
 * Read the branch's pull request and flip it from draft to ready at content-final.
 *
 * **Details**
 *
 * The read is the status snapshot `monitor --until-ready` takes on every poll,
 * so the flip and the monitor never disagree about the current head, its
 * checks, or its threads. A blocked decision fails with
 * {@link YeetReadyGateRefused}; a failed flip (the GraphQL-only
 * `markPullRequestReadyForReview`, spent through the budget guard) fails with
 * `YeetCommandError`.
 *
 * **Example** (Build the gate effect)
 *
 * ```ts
 * import { runYeetReadyGate } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetReadyGate) // "function"
 * ```
 *
 * @param context - Repo context of the branch whose pull request is flipped.
 * @param dependencies - Injectable pull request read and ready flip for tests.
 * @returns The decision the gate acted on.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetReadyGate = Effect.fn("Yeet.runYeetReadyGate")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies = {}
): Effect.fn.Return<
  YeetReadyGateDecision,
  YeetCommandError | YeetReadyGateRefused,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const read = yield* (dependencies.read ?? readPullRequestForReady)(context);
  const decision = decideYeetReadyGate(read);
  yield* YeetReadyGateDecision.match(decision, {
    blocked: (blocked) =>
      Effect.fail(
        YeetReadyGateRefused.make({
          blocker: blocked.blocker,
          message: `yeet ready refused: blocked on ${blocked.blocker}: ${blocked.detail}. Re-run \`${YEET_READY_COMMAND}\` once it clears.`,
        })
      ),
    "already-ready": ({ prNumber }) =>
      Console.log(`[yeet] pull request #${prNumber} is already ready for review; nothing to flip`),
    flip: Effect.fnUntraced(function* ({ prNumber, headSha }) {
      // The gate decided on a read taken moments ago. A push, a check rerun,
      // or a new thread can land in between, even on the same head, so take
      // the whole gate read again immediately before the flip and require the
      // same verdict on the same head.
      const confirmation = decideYeetReadyGate(yield* (dependencies.read ?? readPullRequestForReady)(context));
      const sameHead = O.getOrElse(headSha, () => "unknown");
      if (confirmation._tag !== "flip" || !O.contains(confirmation.headSha, sameHead)) {
        const reason = YeetReadyGateDecision.match(confirmation, {
          blocked: ({ blocker, detail }) => `now blocked on ${blocker}: ${detail}`,
          "already-ready": () => "it is already ready for review",
          flip: ({ headSha: liveSha }) =>
            `the head moved (gate ${sameHead}, live ${O.getOrElse(liveSha, () => "unknown")})`,
        });
        return yield* YeetCommandError.make({
          message: `yeet ready refused: the pull request changed between the gate read and the flip; ${reason}. Re-run \`${YEET_READY_COMMAND}\` so the current state is gated.`,
          exitCode: 1,
        });
      }
      // markPullRequestReadyForReview is GraphQL-only; the default flip spends it
      // through the GraphQL budget guard, waiting for the hourly reset when the
      // shared budget is spent instead of failing the way `gh pr ready` did.
      yield* (dependencies.markReady ?? markReadyThroughBudget)(prNumber);
      yield* Console.log(`[yeet] pull request #${prNumber} flipped from draft to ready for review`);
      yield* Console.log(
        `[yeet] the review window starts now: the merge gate opens no sooner than the review window (default ${Duration.toMinutes(YEET_REVIEW_WINDOW_DEFAULT)} minutes) after this flip or the last push, whichever is later; do not merge in this step`
      );
      // Reviewers that skip drafts post only now, and a monitor that reported
      // `ready-pending-flip` has ended: name who is watching, or how to watch.
      const watching = yield* (dependencies.findMonitor ?? findLiveMonitorForReady)(context, prNumber);
      yield* Console.log(
        O.match(watching, {
          onNone: () =>
            `[yeet] no readiness monitor is watching #${prNumber}; submit one with: ${YEET_MONITOR_SUBMIT_COMMAND}\n[yeet] then wait with: bun run beep yeet job wait <jobId>`,
          onSome: (record) =>
            `[yeet] readiness monitor job ${record.jobId} is still watching #${prNumber}\n[yeet] wait with: bun run beep yeet job wait ${record.jobId}`,
        })
      );
    }),
  });
  return decision;
});

/**
 * Run `yeet ready` for the checked-out branch.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetReady } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetReady) // "function"
 * ```
 *
 * @param options - Base, head, and packet directory for the run context.
 * @returns An Effect that completes after the flip or the already-ready report.
 * @category use-cases
 * @since 0.0.0
 */
export const runYeetReady = Effect.fn("Yeet.runYeetReady")(function* (options: YeetReadyOptions) {
  const context = yield* hydrateYeetReadOnlyContext(options);
  yield* runYeetReadyGate(context);
});
