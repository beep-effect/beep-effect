/**
 * Pure merge-readiness policy shared by live status and retained completion proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { yeetReviewWindowElapsed } from "./ReviewWindow.ts";
import {
  mergeReadyCriterionHolds,
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
} from "./Verdict.ts";
import { yeetCheckBlocksMerge } from "./WatchStream.ts";
import type { YeetStatusArtifact, YeetStatusRemote } from "./Status.schemas.ts";

type ReadinessRemote = Pick<
  YeetStatusRemote,
  | "available"
  | "checked"
  | "readFailure"
  | "checks"
  | "requiredCheckCount"
  | "failingRequiredCheckCount"
  | "pendingRequiredCheckCount"
  | "pendingOptionalCheckCount"
  | "pendingCheckCount"
  | "failingCheckCount"
  | "failingOptionalCheckCount"
  | "mergeStateStatus"
  | "reviewDecision"
  | "unresolvedReviewThreadCount"
  | "followUpThreadCount"
  | "headSha"
  | "state"
  | "isDraft"
  | "mergeable"
  | "reviewWindow"
>;
type ReadinessCloseout = Pick<
  YeetStatusArtifact,
  "state" | "reviewedHeadSha" | "issueCount" | "gateIssues" | "greptileScore"
>;

// Retain the serialized criterion name while enforcing the complete PR check
// policy. Count-only failures cannot receive an evidence-based exemption.
const requiredChecksAreGreen = (remote: ReadinessRemote): boolean => {
  const exemptFailures = A.filter(
    remote.checks,
    (check) => check.outcome === "fail" && !yeetCheckBlocksMerge(check)
  ).length;
  return pipe(
    O.fromUndefinedOr(remote.requiredCheckCount),
    O.exists(
      (count) =>
        O.isNone(remote.readFailure) &&
        count > 0 &&
        A.every(
          [
            remote.failingRequiredCheckCount,
            remote.pendingRequiredCheckCount,
            remote.pendingOptionalCheckCount,
            remote.pendingCheckCount,
          ],
          (value) => (value ?? 0) === 0
        ) &&
        A.every(
          [remote.failingCheckCount, remote.failingOptionalCheckCount],
          (value) => (value ?? 0) <= exemptFailures
        ) &&
        !A.some(remote.checks, yeetCheckBlocksMerge)
    )
  );
};

const acceptableMergeStateStatuses: ReadonlyArray<string> = ["BEHIND", "CLEAN", "HAS_HOOKS", "UNSTABLE"];

/**
 * Whether the observed merge state permits the readiness gate.
 *
 * **Example** (Clean merge state)
 * ```ts
 * import { mergeStateIsAcceptable } from "@beep/repo-cli/commands/Yeet/internal/MergeReadiness.policy"
 * console.log(mergeStateIsAcceptable({ mergeStateStatus: "CLEAN" })) // true
 * ```
 * @param remote - Observed merge state; an absent state cannot prove readiness.
 * @returns Whether the case-insensitive state belongs to the accepted merge-state set.
 * @category predicates
 * @since 0.0.0
 */
export const mergeStateIsAcceptable = (remote: Pick<ReadinessRemote, "mergeStateStatus">): boolean =>
  O.exists(O.fromUndefinedOr(remote.mergeStateStatus), (status) =>
    A.contains(acceptableMergeStateStatuses, Str.toUpperCase(status))
  );

const reviewDecisionIsAcceptable = (remote: ReadinessRemote): boolean =>
  O.match(O.fromUndefinedOr(remote.reviewDecision), {
    onNone: () => true,
    onSome: (decision) => Str.isEmpty(decision) || Str.toUpperCase(decision) === "APPROVED",
  });

const sameHeadSha = S.toEquivalence(S.String);

// Every thread that still owes somebody an answer, whether or not GitHub
// still calls it open: unresolved threads plus threads the author resolved
// with a human reviewer speaking last. An acknowledgement is excluded on
// purpose — a review bot's confirmation is a receipt, not an objection.
/**
 * Count unresolved threads and later unanswered human follow-ups.
 *
 * **Example** (No outstanding threads)
 * ```ts
 * import { outstandingThreadCount } from "@beep/repo-cli/commands/Yeet/internal/MergeReadiness.policy"
 * console.log(outstandingThreadCount({ unresolvedReviewThreadCount: 0, followUpThreadCount: 0 })) // 0
 * ```
 * @param remote - Unresolved-thread and unanswered-follow-up counts from the same remote observation.
 * @returns Their sum, treating absent legacy counts as zero.
 * @category predicates
 * @since 0.0.0
 */
export const outstandingThreadCount = (
  remote: Pick<ReadinessRemote, "unresolvedReviewThreadCount" | "followUpThreadCount">
): number => (remote.unresolvedReviewThreadCount ?? 0) + (remote.followUpThreadCount ?? 0);

// Closeout issues a review thread raised: every recorded issue a non-thread
// gate did not. A summary written before the split carries no `gateIssues`, so
// all of its issues land here, exactly as they did before.
const closeoutThreadIssueCount = (closeout: ReadinessCloseout): number =>
  (closeout.issueCount ?? 0) - A.length(closeout.gateIssues ?? A.empty());

// The live remote thread counts are the authoritative surface; the closeout
// artifact is a prior run's record and only blocks when it EXISTS and still
// reports issues a thread raised. Requiring its presence would conflate
// "closeout has not run yet" with "threads are unresolved" — a missing
// artifact is unknown, and unknown must not masquerade as a named blocker.
// Issues from the closeout's review-bot gates never count here: a Greptile
// score is not a review thread, and those gates are advisory.
const threadsAreResolved = (closeout: ReadinessCloseout, remote: ReadinessRemote): boolean =>
  outstandingThreadCount(remote) === 0 && closeoutThreadIssueCount(closeout) <= 0;

// The closeout-run criterion binds to a specific revision: a closeout artifact
// satisfies it only when the head it reviewed is the head the PR currently
// points at. Legacy reports without a recorded head never bind.
const closeoutBindsCurrentHead = (closeout: ReadinessCloseout, remote: ReadinessRemote): boolean =>
  pipe(
    closeout.reviewedHeadSha,
    O.exists((reviewedHeadSha) => O.exists(remote.headSha, (headSha) => sameHeadSha(reviewedHeadSha, headSha)))
  );

// The first unsatisfied hard criterion in protocol order, or `None` when every
// one holds. Order mirrors the closeout -> checks -> threads escalation the
// merge protocol asks an operator to walk.
const firstFailingCriterion = (criteria: YeetMergeReadyCriteria): O.Option<YeetMergeReadyCriterion> =>
  pipe(
    YeetMergeReadyCriterion.literals,
    A.findFirst((criterion) => !mergeReadyCriterionHolds(criteria, criterion))
  );

/**
 * Fold the live pull request surfaces into one truthful merge-readiness verdict.
 *
 * **Details**
 *
 * Status already fetches everything the protocol asks a human to read, so the
 * only thing missing was a name for the answer. Pull request state, draft state,
 * current-head closeout, required checks, threads, mergeability, merge state,
 * review decision, and the review window are hard criteria. The review window
 * holds only when `remote.reviewWindow` carries an elapsed read; an unread or
 * unknown window blocks. A missing closeout artifact is its own
 * blocker while the live thread criterion continues to report only the state it
 * knows. A present closeout satisfies `closeout-run` only when its recorded
 * reviewed head equals the current remote head; legacy headless and stale
 * reports remain blockers. Closeout issues a review thread raised block
 * `threads-resolved`; issues a review-bot gate raised (`--require-greptile-*`)
 * are advisory, because the bots reviewing a pull request rotate with the
 * operator's quota and one that never posts must not hold the merge. The
 * Greptile score rides along as display-only.
 *
 * **Gotchas**
 *
 * Returns `None` when the pull request was not read at all (`yeet status`
 * without `--remote`, or no PR for the branch). Unknown is not the same as
 * blocked, and callers that flatten it to `false` would announce a failing
 * criterion that was never observed. Unread *checks*, by contrast, are treated
 * as not-green: the criterion is hard, so absence of proof blocks.
 *
 * **Example** (Name the blocking criterion)
 *
 * ```ts
 * import { deriveYeetMergeReady, YeetStatusArtifact, YeetStatusRemote } from "@beep/repo-cli/test/Yeet"
 *
 * const mergeReady = deriveYeetMergeReady(
 *   YeetStatusArtifact.make({ detail: "closed", issueCount: 0, path: "pr-closeout.json", state: "present" }),
 *   YeetStatusRemote.make({
 *     available: true,
 *     checked: true,
 *     detail: "PR #42 OPEN",
 *     state: "OPEN", isDraft: false, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN",
 *     requiredCheckCount: 17, failingRequiredCheckCount: 1, pendingRequiredCheckCount: 0,
 *     unresolvedReviewThreadCount: 0,
 *   })
 * )
 * console.log(mergeReady)
 * ```
 *
 * @param closeout - Closeout artifact summary for the branch.
 * @param remote - Live pull request summary, checked or not.
 * @returns The merge-readiness verdict, or `None` when the PR was not read.
 * @category diagnostics
 * @since 0.0.0
 */
export const deriveYeetMergeReady: {
  (remote: ReadinessRemote): (closeout: ReadinessCloseout) => O.Option<YeetMergeReady>;
  (closeout: ReadinessCloseout, remote: ReadinessRemote): O.Option<YeetMergeReady>;
} = dual(2, (closeout: ReadinessCloseout, remote: ReadinessRemote): O.Option<YeetMergeReady> => {
  if (!remote.checked || !remote.available) {
    return O.none();
  }
  const criteria = YeetMergeReadyCriteria.make({
    prOpen: remote.state === "OPEN",
    notDraft: remote.isDraft === false,
    closeoutRun: closeout.state === "present" && closeoutBindsCurrentHead(closeout, remote),
    requiredChecksGreen: requiredChecksAreGreen(remote),
    threadsResolved: threadsAreResolved(closeout, remote),
    mergeable: remote.mergeable === "MERGEABLE",
    mergeStateAcceptable: mergeStateIsAcceptable(remote),
    reviewDecisionAcceptable: reviewDecisionIsAcceptable(remote),
    reviewWindowElapsed: yeetReviewWindowElapsed(remote.reviewWindow),
    greptileScore: closeout.greptileScore,
  });
  const failing = firstFailingCriterion(criteria);
  return O.some(YeetMergeReady.make({ ready: O.isNone(failing), failing, criteria }));
});
