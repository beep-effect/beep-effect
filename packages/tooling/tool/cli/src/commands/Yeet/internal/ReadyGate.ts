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
 * lanes do not hold it. The flip also requires a complete, passing
 * `yeet final-check` receipt for that exact head (`FinalCheck.ts`): the local
 * replay of every hosted gate the push-first cheap tier skips, so a lane
 * cannot call a pull request final while it still reds hosted CI. A head with
 * no receipt of its own may carry the receipt of a passing ancestor under the
 * refresh rule (operator ruling 2026-10-28, `FinalCheckRefresh.ts`) when the
 * lane's own changes since that receipt touch only regenerated standards
 * inventories and goal-packet files. Anything else refuses with the first blocker named.
 * There is no `--force`. The merge gate, not this flip, waits for green checks
 * and for the review window.
 *
 * Under S11 (operator ruling 2026-10-09, AGENTS.md "Mergeable") a required red
 * inherited from `main` does not hold the flip once the owner attributes it
 * with `--inherited "<check>=<attribution>"`; the attribution is written to
 * the PR body before the flip, and a failed write refuses the flip.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubRest, ghOutput } from "../../../internal/github/index.ts";
import {
  COMPUTE_PROFILE_WORKER_SKIP_REASON,
  gateHostedContextFor,
  patientGit,
} from "../../../internal/repo-run/index.ts";
import { HEAVY_ADMISSION_LABEL } from "../../Ci/HeavyAdmission.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { FinalCheckGate } from "./FinalCheck.schemas.ts";
import {
  finalCheckGateSetRefusal,
  finalCheckRefusal,
  readFinalCheckReceipt,
  YEET_FINAL_CHECK_COMMAND,
} from "./FinalCheck.ts";
import { FinalCheckRefreshVerdict } from "./FinalCheckRefresh.schemas.ts";
import { checkFinalCheckRefresh, checkFinalCheckRewriteCarry } from "./FinalCheckRefresh.ts";
import {
  flipPullRequestReady,
  provideYeetGhLogin,
  recordInheritedRedsInPullRequestBody,
  recordMonitoredPrSessionAsGhLogin,
  withYeetGh,
  yeetGithubFailure,
} from "./GhOps.ts";
import { currentCommitSha, yeetGitKitError } from "./GitExec.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { provideYeetHeadMoveClassifier } from "./HeadMove.ts";
import {
  decodeAttributedCheckFlags,
  MergeGateCheckRun,
  mergeGateGoodConclusion,
  mergeGateLatestRunPerName,
  parseAttributedCheck,
} from "./MergeGate.ts";
import { YEET_READY_COMMAND } from "./MonitorPolicy.ts";
import { findLiveReadyMonitorJob } from "./ProofJob.ts";
import { ProofJobLauncher } from "./ProofJobLauncher.ts";
import { admitPullRequestToHeavy } from "./PullRequest.ts";
import { ReviewLaneFlipRow, ReviewLaneReadyTransition, YEET_REVIEW_LANE_SCHEMA_VERSION } from "./ReviewLane.schemas.ts";
import { readYeetReviewLaneLedger, recordYeetReviewLaneRows } from "./ReviewLane.ts";
import { YEET_REVIEW_WINDOW_DEFAULT } from "./ReviewWindow.ts";
import { readSquashCommitlintForPullRequest, renderSquashCommitlintVerdict } from "./SquashCommitlint.ts";
import { YeetStatusRemote } from "./Status.schemas.ts";
import { collectYeetStatus } from "./Status.ts";
import { mergeReadyCriterionHolds, YeetMergeReady } from "./Verdict.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetReadyOptions } from "../Yeet.schemas.ts";
import type { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import type { FinalCheckRefreshOwnChange, FinalCheckRefreshRefused } from "./FinalCheckRefresh.schemas.ts";
import type { YeetOpenReadyHooks } from "./OpenReady.ts";
import type { ProofJobRecord } from "./ProofJob.ts";
import type { SquashCommitlintReport } from "./SquashCommitlint.ts";

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
 * A required check whose red is inherited from `main`, attributed by the owner
 * and recorded under S11 before the flip.
 *
 * **Example** (Attribute an inherited red)
 *
 * ```ts
 * import { YeetReadyInheritedRed } from "@beep/repo-cli/test/Yeet"
 *
 * const red = YeetReadyInheritedRed.make({ check: "Lint", attribution: "red on main since 2c1cb448ba, fix in #1477" })
 * console.log(red.check) // "Lint"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyInheritedRed extends S.Opaque<YeetReadyInheritedRed, { readonly brand: unique symbol }>()(
  S.Struct({ check: S.NonEmptyString, attribution: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetReadyInheritedRed", {
      description: "A required check red inherited from main, attributed and recorded under S11 before the ready flip.",
    })
  )
) {}

/**
 * Parse one `--inherited "<check>=<attribution>"` argument, split on the first `=`.
 *
 * **Example** (Parse an inherited red)
 *
 * ```ts
 * import { parseYeetReadyInheritedRed } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(parseYeetReadyInheritedRed("Lint=red on main since 2c1cb448ba"))) // true
 * console.log(O.isNone(parseYeetReadyInheritedRed("Lint"))) // true
 * ```
 *
 * @param value - One `--inherited` argument.
 * @returns The inherited red, or none when the form is wrong.
 * @category parsing
 * @since 0.0.0
 */
export const parseYeetReadyInheritedRed = parseAttributedCheck((fields) => YeetReadyInheritedRed.make(fields));

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
export class YeetReadyPullRequestRead extends S.Opaque<YeetReadyPullRequestRead, { readonly brand: unique symbol }>()(
  S.Struct({
    remote: YeetStatusRemote,
    mergeReady: S.Option(YeetMergeReady),
  }).pipe(
    $I.annoteSchema("YeetReadyPullRequestRead", {
      description: "The live pull request summary and merge-readiness verdict the yeet ready gate decides on.",
    })
  )
) {}

/**
 * The gate passed on a draft: flip it.
 *
 * **Details**
 *
 * `inherited` holds the S11 attributions the flip applied: those naming a
 * required check that is failing on the read head. They are recorded in the
 * PR body before the flip.
 *
 * **Example** (Describe a flip decision)
 *
 * ```ts
 * import { YeetReadyGateFlip } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const decision = YeetReadyGateFlip.make({ prNumber: 42, headSha: O.some("abc1234"), inherited: [] })
 * console.log(decision._tag) // "flip"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyGateFlip extends S.Opaque<YeetReadyGateFlip, { readonly brand: unique symbol }>()(
  S.TaggedStruct("flip", {
    prNumber: S.Finite,
    headSha: S.Option(S.String),
    inherited: S.Array(YeetReadyInheritedRed),
  }).pipe(
    $I.annoteSchema("YeetReadyGateFlip", {
      description: "The content-final gate holds on a draft pull request; flip it to ready.",
    })
  )
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
export class YeetReadyGateAlreadyReady extends S.Opaque<YeetReadyGateAlreadyReady, { readonly brand: unique symbol }>()(
  S.TaggedStruct("already-ready", { prNumber: S.Finite }).pipe(
    $I.annoteSchema("YeetReadyGateAlreadyReady", {
      description: "The pull request is open and not a draft; nothing to flip.",
    })
  )
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
export class YeetReadyGateBlocked extends S.Opaque<YeetReadyGateBlocked, { readonly brand: unique symbol }>()(
  S.TaggedStruct("blocked", { blocker: YeetReadyGateCriterion, detail: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetReadyGateBlocked", {
      description: "The content-final gate refuses the flip on its first unmet criterion.",
    })
  )
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
 * What a `yeet ready` refusal names: an unmet gate criterion read from the
 * pull request, or `final-check`, the head-pinned local receipt
 * (`FinalCheck.ts`) the flip requires before a draft leaves for review.
 *
 * **Example** (Check a refusal blocker)
 *
 * ```ts
 * import { YeetReadyRefusalBlocker } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReadyRefusalBlocker.is["final-check"]("final-check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReadyRefusalBlocker = LiteralKit([...YeetReadyGateCriterion.literals, "final-check"]).pipe(
  $I.annoteSchema("YeetReadyRefusalBlocker", {
    description: "The blocker a yeet ready refusal names: a pull-request gate criterion or the final-check receipt.",
  })
);

/**
 * What a `yeet ready` refusal names.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetReadyRefusalBlocker = typeof YeetReadyRefusalBlocker.Type;

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
export class YeetReadyGateRefused extends S.TaggedError<YeetReadyGateRefused, { readonly brand: unique symbol }>(
  $I`YeetReadyGateRefused`
)(
  "YeetReadyGateRefused",
  {
    blocker: YeetReadyRefusalBlocker,
    message: S.String,
    // The bare reason, without the `yeet ready` framing, for a caller that words its own refusal.
    detail: S.optionalKey(S.String),
  },
  $I.annoteError<YeetReadyGateRefused>("YeetReadyGateRefused", {
    description: "yeet ready refused to flip a draft pull request because a content-final criterion is unmet.",
  })
) {
  /** Process exit code reported when the refusal reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

const inheritedRedsEquivalence = S.toEquivalence(S.Array(YeetReadyInheritedRed));

const countOf = (value: number | undefined): number => value ?? 0;

const failingRequiredChecks = (remote: YeetStatusRemote) =>
  A.filter(remote.checks, (check) => check.required && check.outcome === "fail");

const failingRequiredNames = (remote: YeetStatusRemote): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(failingRequiredChecks(remote), (check) => check.name));

// The attributions naming a required check that is failing on this head.
const appliedInherited = (
  remote: YeetStatusRemote,
  inherited: ReadonlyArray<YeetReadyInheritedRed>
): ReadonlyArray<YeetReadyInheritedRed> => {
  const failing = failingRequiredNames(remote);
  return A.filter(inherited, (red) => HashSet.has(failing, red.check));
};

// A required check known to be red on the current head. Pending and unread
// checks are not red: the flip happens before hosted CI finishes. Under S11 a
// red attributed with --inherited does not count, but only when every red is
// named: a census that counts more failing required checks than it names
// fails closed, because an unnamed red cannot be attributed.
const noRequiredRed = (remote: YeetStatusRemote, inherited: ReadonlyArray<YeetReadyInheritedRed>): boolean => {
  const failing = failingRequiredChecks(remote);
  const count = countOf(remote.failingRequiredCheckCount);
  if (A.isReadonlyArrayEmpty(inherited)) return count === 0 && A.isReadonlyArrayEmpty(failing);
  const attributed = HashSet.fromIterable(A.map(inherited, (red) => red.check));
  return count <= A.length(failing) && A.every(failing, (check) => HashSet.has(attributed, check.name));
};

const readyGateCriterionHolds = (
  read: YeetReadyPullRequestRead,
  inherited: ReadonlyArray<YeetReadyInheritedRed>,
  criterion: YeetReadyGateCriterion
): boolean =>
  O.exists(read.mergeReady, (ready) =>
    YeetReadyGateCriterion.match(criterion, {
      "pr-open": () => mergeReadyCriterionHolds(ready.criteria, "pr-open"),
      "no-required-red": () => noRequiredRed(read.remote, inherited),
      "threads-resolved": () => mergeReadyCriterionHolds(ready.criteria, "threads-resolved"),
    })
  );

const blockerDetail = (blocker: YeetReadyGateCriterion, remote: YeetStatusRemote): string =>
  Match.value(blocker).pipe(
    Match.when("pr-open", () =>
      O.isSome(remote.readFailure) || !remote.checked || (remote.available && remote.state === undefined)
        ? `could not read the pull request: ${O.match(remote.readFailure, { onNone: () => remote.detail, onSome: (error) => error.message })}; retry after the GitHub rate limit resets or restore GitHub access`
        : remote.available
          ? `pull request #${remote.number ?? "?"} is ${remote.state}`
          : "no open pull request was found for this branch"
    ),
    Match.when("no-required-red", () => {
      const names = A.map(failingRequiredChecks(remote), (check) => check.name);
      const count = Num.max(countOf(remote.failingRequiredCheckCount), A.length(names));
      const named = A.isReadonlyArrayNonEmpty(names) ? ` (${A.join(names, ", ")})` : Str.empty;
      return `${count} required check(s) are failing on head ${O.getOrElse(remote.headSha, () => "unknown")}${named}; a red required check means the content is not final. Pending checks and optional lanes do not hold the flip; under S11, attribute a red inherited from main with --inherited "<check>=<attribution>"`;
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
 * `inherited` (S11) lets `no-required-red` hold when every failing required
 * check is attributed; a flip carries the attributions that named a failing
 * check, and the rest are dropped.
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
 * @param inherited - S11 attributions for required reds inherited from `main`.
 * @returns Flip, already-ready, or the first blocker.
 * @category utilities
 * @since 0.0.0
 */
export const decideYeetReadyGate: {
  (inherited?: ReadonlyArray<YeetReadyInheritedRed>): (read: YeetReadyPullRequestRead) => YeetReadyGateDecision;
  (read: YeetReadyPullRequestRead, inherited?: ReadonlyArray<YeetReadyInheritedRed>): YeetReadyGateDecision;
} = dual(
  (args) => P.hasProperty(args[0], "remote"),
  (read: YeetReadyPullRequestRead, inherited: ReadonlyArray<YeetReadyInheritedRed> = []): YeetReadyGateDecision => {
    const blocker = A.findFirst(
      YeetReadyGateCriterion.literals,
      (criterion) => !readyGateCriterionHolds(read, inherited, criterion)
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
        onSome: (prNumber): YeetReadyGateDecision =>
          YeetReadyGateFlip.make({
            prNumber,
            headSha: read.remote.headSha,
            inherited: appliedInherited(read.remote, inherited),
          }),
      })
    );
  }
);

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
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> =>
  ProofJobLauncher.make(context.repoRoot).pipe(
    Effect.flatMap((launcher) => launcher.list),
    Effect.map(findLiveReadyMonitorJob({ branch: context.branch, prNumber })),
    Effect.catch(() => Effect.succeedNone)
  );

const markReadyThroughBudget = (prNumber: number, confirmedHead: string) =>
  flipPullRequestReady(prNumber, confirmedHead).pipe(
    withYeetGh(O.none()),
    Effect.mapError((cause) =>
      YeetCommandError.make({
        message: `could not mark pull request #${prNumber} ready for review: ${cause.message}`,
        command: `bun run beep yeet gh pr ready ${prNumber}`,
        exitCode: cause._tag === "GraphqlBudgetExhausted" ? 75 : 1,
      })
    )
  );

// S11 requires non-empty attributions; empty-section cleanup is best effort.
const recordInheritedThroughRest = (prNumber: number, entries: ReadonlyArray<YeetReadyInheritedRed>, headSha: string) =>
  recordInheritedRedsInPullRequestBody(prNumber, entries, headSha).pipe(
    Effect.mapError((cause) =>
      YeetCommandError.make({
        message: A.isReadonlyArrayNonEmpty(entries)
          ? `yeet ready refused: could not record the inherited reds in the body of #${prNumber} (${cause.message}); S11 requires the record before the flip`
          : `could not reconcile the inherited-reds section in the body of #${prNumber} (${cause.message})`,
        exitCode: 1,
      })
    )
  );

// The pull request author at flip time, so the fold can count the author's
// own review submissions (thread replies) beside the rounds, never inside
// them (ruling 81). A failed read leaves the flip row without one, which
// excludes nothing.
const readPullRequestAuthor = Effect.fn("Yeet.ReadyGate.readPullRequestAuthor")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<O.Option<string>, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  // KEEP (D-13): gh's GraphQL `author.login` comes without the `[bot]` suffix REST adds.
  return yield* ghOutput({
    args: ["pr", "view", `${prNumber}`, "--json", "author", "--jq", ".author.login"],
    cwd: context.repoRoot,
    label: "gh pr view author",
    onFailure: (failure) => failure,
  }).pipe(Effect.map(flow(Str.trim, O.liftPredicate(Str.isNonEmpty))), Effect.orElseSucceed(O.none<string>));
});

interface YeetReadyGateDependencies {
  readonly admitHeavy?: (
    context: RepoRunContext,
    prNumber: number
  ) => Effect.Effect<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git>;
  readonly finalCheck?: (
    context: RepoRunContext,
    headSha: string
  ) => Effect.Effect<O.Option<FinalCheckReceipt>, never, FileSystem.FileSystem | Path.Path>;
  readonly findMonitor?: typeof findLiveMonitorForReady;
  readonly hostedChecks?: (
    context: RepoRunContext,
    headSha: string
  ) => Effect.Effect<
    ReadonlyArray<MergeGateCheckRun>,
    YeetCommandError,
    SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
  >;
  readonly markReady?: (
    prNumber: number,
    confirmedHead: string
  ) => Effect.Effect<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
  readonly read?: (
    context: RepoRunContext
  ) => Effect.Effect<
    YeetReadyPullRequestRead,
    YeetCommandError,
    | SecureRandom.SecureRandom
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | Digest.Digest
    | Git
  >;
  readonly readAuthor?: (
    context: RepoRunContext,
    prNumber: number
  ) => Effect.Effect<O.Option<string>, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
  readonly recordInherited?: (
    prNumber: number,
    entries: ReadonlyArray<YeetReadyInheritedRed>,
    headSha: string
  ) => Effect.Effect<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
  readonly refresh?: (
    context: RepoRunContext,
    headSha: string
  ) => Effect.Effect<
    O.Option<FinalCheckRefreshVerdict>,
    YeetCommandError,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
  readonly requestReview?: (
    context: RepoRunContext,
    prNumber: number,
    confirmedHead: string,
    allowPush?: boolean,
    openedReady?: boolean
  ) => Effect.Effect<
    string,
    YeetCommandError,
    SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Git
  >;
  readonly rewriteCarry?: typeof rewriteCarryForReady;
  readonly squashCommitlint?: (
    context: RepoRunContext,
    prNumber: number
  ) => Effect.Effect<
    SquashCommitlintReport,
    YeetCommandError,
    SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
  >;
}

/**
 * Subject of the empty commit `yeet ready` pushes after the flip (S32).
 *
 * **Details**
 *
 * This fallback remains for authors/repositories without the configured
 * pr-comment routine. Covered requests use an exact-head comment instead.
 * A pull request in a native stack never takes the fallback, top layer
 * included: a push below the top moves the head the layer above is based on,
 * and a push on the top restarts the review window the merge gate reads. An
 * uncovered layer gets a warning with the manual request comment instead.
 *
 * **Example** (Read the re-request subject)
 *
 * ```ts
 * import { YEET_REVIEWER_REQUEST_SUBJECT } from "@beep/repo-cli/commands/Yeet/internal/ReadyGate"
 *
 * console.log(YEET_REVIEWER_REQUEST_SUBJECT) // chore: re-request beep-reviewer (S32)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_REVIEWER_REQUEST_SUBJECT = "chore: re-request beep-reviewer (S32)";

/**
 * Whether `yeet ready` may push the reviewer re-request from this checkout.
 *
 * **Details**
 *
 * The empty commit is pushed only when the checkout stands on the head the gate
 * just flipped; anything else (a later local commit, another branch) would
 * push unreviewed work or the wrong branch, so the owner pushes by hand instead.
 *
 * **Example** (Decide whether to push the re-request)
 *
 * ```ts
 * import { reviewerRequestPushable } from "@beep/repo-cli/commands/Yeet/internal/ReadyGate"
 *
 * console.log(reviewerRequestPushable("abc123", "abc123")) // true
 * console.log(reviewerRequestPushable("def456", "abc123")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const reviewerRequestPushable: {
  (localHead: string, confirmedHead: string): boolean;
  (confirmedHead: string): (localHead: string) => boolean;
} = dual(2, (localHead: string, confirmedHead: string): boolean => localHead === confirmedHead);

// The explicit destination: the pull request branch on origin, where publish
// pushed it, never the checkout's push configuration (which may point elsewhere).
const reviewerRequestPush = (branch: string) => `git push origin HEAD:refs/heads/${branch}`;

// The hand route, from a checkout of the pull request branch at the flipped head.
const reviewerRequestManual = (confirmedHead: string, branch: string) =>
  `from a checkout of the pull request branch at ${confirmedHead}, run: git commit --allow-empty --only --no-verify -m "${YEET_REVIEWER_REQUEST_SUBJECT}" && ${reviewerRequestPush(branch)}`;

// Push one empty commit so beep-reviewer sees a head pushed to the ready pull
// request; returns the line to log. `--only` with no paths commits HEAD's own
// tree and disregards the index, so staged changes (a lefthook re-stage
// included) cannot ride onto the ready pull request unproven; `--no-verify`
// keeps hooks from re-staging into it, and signing follows the git config.
const pushReviewerRequest = Effect.fn("Yeet.pushReviewerRequest")(function* (
  context: RepoRunContext,
  prNumber: number,
  confirmedHead: string
) {
  const localHead = yield* currentCommitSha(context);
  if (!reviewerRequestPushable(localHead, confirmedHead)) {
    return `[yeet] note: the checkout is at ${localHead}, not the flipped head ${confirmedHead}, so nothing was pushed; ${reviewerRequestManual(confirmedHead, context.branch)}`;
  }
  const git = yield* Git;
  yield* git
    .commit(context.repoRoot, YEET_REVIEWER_REQUEST_SUBJECT, { allowEmpty: true, only: true, noVerify: true })
    .pipe(
      Effect.mapError(
        yeetGitKitError(GitCommand.commit(YEET_REVIEWER_REQUEST_SUBJECT, false, true, false, undefined, true, true))
      )
    );
  const request = yield* currentCommitSha(context);
  const refspec = `HEAD:refs/heads/${context.branch}`;
  // A push may outlive the edge instance's 30 s timeout (SPEC D-09), so it runs on the patient one.
  const pushing = yield* patientGit;
  const pushInvocation = GitCommand.push("origin", refspec);
  return yield* pushing.push(context.repoRoot, { remote: "origin", refspec }).pipe(
    // A rejected non-fast-forward push is git's exit 1, worded as the capture worded it.
    Effect.mapError((error) =>
      P.isTagged(error, "NonFastForwardError")
        ? YeetCommandError.make({
            message: `git ${A.join(pushInvocation.redactedArgs, " ")} failed with exit code 1.`,
            command: `git ${A.join(pushInvocation.redactedArgs, " ")}`,
            exitCode: 1,
          })
        : yeetGitKitError(pushInvocation)(error)
    ),
    Effect.as(
      `[yeet] pushed ${request} (${YEET_REVIEWER_REQUEST_SUBJECT}) so beep-reviewer reviews #${prNumber} on a head pushed while ready; send this sha as the final`
    ),
    Effect.catchTag("YeetCommandError", (cause) =>
      Effect.succeed(
        `[yeet] warning: created the beep-reviewer re-request ${request} locally but the push failed: ${cause.message}; run: ${reviewerRequestPush(context.branch)}`
      )
    )
  );
});

/**
 * Exercise the legacy empty-commit fallback independently of GitHub routing.
 *
 * **Example** (Reference the fallback)
 *
 * ```ts
 * import { pushReviewerRequestForTesting } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof pushReviewerRequestForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const pushReviewerRequestForTesting = pushReviewerRequest;

// The deployed pr-comment routine currently permits this account in this repo.
// Expand only after the corresponding routine allowlist has been configured.
const REVIEWER_COMMENT_AUTHOR = "kriegcloud";
const REVIEWER_COMMENT_REPOSITORY = "beep-effect/beep-effect";

const ReviewerRequestHead = GitObjectId.check(
  S.isMaxLength(40, {
    identifier: "ReviewerRequestSha1Width",
    title: "Reviewer request SHA-1 width",
    description: "The deployed comment listener accepts exactly forty hexadecimal characters.",
  })
).pipe(
  $I.annoteSchema("ReviewerRequestHead", {
    description: "Full SHA-1 head accepted by the deployed reviewer comment routine.",
  })
);

const ReviewerRequestStack = S.Struct({
  number: S.Int,
  position: S.Int,
  size: S.Int,
}).pipe(
  $I.annoteSchema("ReviewerRequestStack", {
    description: "The native stack a pull request sits in: the stack number and the layer's position and size.",
  })
);

const ReviewerRequestPull = S.Struct({
  state: S.String,
  draft: S.Boolean,
  created_at: S.OptionFromOptionalKey(S.DateTimeUtcFromString),
  head: S.Struct({ sha: ReviewerRequestHead }),
  user: S.Struct({ login: S.NonEmptyString }),
  base: S.Struct({ repo: S.Struct({ full_name: S.NonEmptyString }) }),
  // `null` or absent outside a native stack.
  stack: S.OptionFromOptionalNullOr(ReviewerRequestStack),
}).pipe(
  $I.annoteSchema("ReviewerRequestPull", { description: "Live REST pull request identity for a reviewer request." })
);
const ReviewerRequestComment = S.Struct({
  body: S.String,
  created_at: S.DateTimeUtcFromString,
  user: S.Struct({ login: S.NonEmptyString }),
}).pipe(
  $I.annoteSchema("ReviewerRequestComment", {
    description: "Comment body and authenticated author used to deduplicate a review request.",
  })
);

const ReviewerRequestReadyEvent = S.Struct({
  event: S.String,
  created_at: S.OptionFromOptionalKey(S.DateTimeUtcFromString),
}).pipe(
  $I.annoteSchema("ReviewerRequestReadyEvent", {
    description: "Timeline event used to distinguish requests made before the latest ready transition.",
  })
);

const reviewerCommentMarker = (head: string) => `<!-- beep-reviewer:request sha=${head} -->`;
const reviewerCommentBody = (head: string) =>
  `Requesting beep-reviewer review of this ready PR head.\n\n${reviewerCommentMarker(head)}`;
const reviewerCommentManual = (prNumber: number, head: string) =>
  S.is(ReviewerRequestHead)(head)
    ? `retry \`bun run beep yeet ready\` or, as ${REVIEWER_COMMENT_AUTHOR}, post this canonical request body: ${reviewerCommentBody(head)} on #${prNumber} after confirming it is open, ready, and still at ${head}`
    : "retry `bun run beep yeet ready` after the current full head can be read";
// A push below the top moves the head the layer above is based on, and a push
// on the top restarts the review window the merge gate is about to read
// (decision 2026-11-13-ready-never-pushes-on-a-layer), so no layer takes S32.
const reviewerStackLayerHeld = (prNumber: number, head: string, stack: typeof ReviewerRequestStack.Type) =>
  `[yeet] warning: #${prNumber} is layer ${stack.position} of stack #${stack.number} (${stack.size} layers); no review-trigger commit was pushed because a push on a stack layer moves the head the stack is built on; ${reviewerCommentManual(prNumber, head)}`;

const decodeReviewerResponse = Effect.fnUntraced(function* <T, I>(schema: S.Codec<T, I>, value: string) {
  return yield* S.decodeEffect(S.fromJsonString(schema))(value).pipe(
    Effect.mapError(() =>
      YeetCommandError.make({ message: "could not decode the reviewer request GitHub response", exitCode: 1 })
    )
  );
});

const reviewerRequestOutput = Effect.fnUntraced(function* (context: RepoRunContext, args: ReadonlyArray<string>) {
  return yield* ghOutput({
    args,
    cwd: context.repoRoot,
    label: "gh reviewer request",
    onFailure: (failure) =>
      YeetCommandError.make({ message: `${failure.label} failed (${failure._tag})`, exitCode: 1 }),
  });
});

const readReviewerPull = Effect.fnUntraced(function* (context: RepoRunContext, prNumber: number) {
  return yield* reviewerRequestOutput(context, ["api", `repos/{owner}/{repo}/pulls/${prNumber}`]).pipe(
    Effect.flatMap((value) => decodeReviewerResponse(ReviewerRequestPull, value))
  );
});

const reviewerPullReady = (pull: typeof ReviewerRequestPull.Type, head: string) =>
  pull.state === "open" && !pull.draft && pull.head.sha === head;
const reviewerCommentCovered = (pull: typeof ReviewerRequestPull.Type) =>
  pull.user.login === REVIEWER_COMMENT_AUTHOR && pull.base.repo.full_name === REVIEWER_COMMENT_REPOSITORY;

const readReviewerReadyAt = Effect.fnUntraced(function* (
  context: RepoRunContext,
  prNumber: number,
  openedAt: O.Option<DateTime.Utc>
) {
  // Match ReviewWindow's latest ready_for_review event, or the open a ready
  // open passes in (`openedAt`; a flip passes none). A missing transition on one that was a draft
  // is unknown: an eventually consistent timeline must not validate a draft-era request.
  const events = yield* reviewerRequestOutput(context, [
    "api",
    `repos/{owner}/{repo}/issues/${prNumber}/timeline?per_page=100`,
    "--paginate",
    "--slurp",
  ]).pipe(Effect.flatMap((value) => decodeReviewerResponse(ReviewerRequestReadyEvent.pipe(S.Array, S.Array), value)));
  const readyEvents = A.filter(A.flatten(events), (event) => event.event === "ready_for_review");
  if (A.some(readyEvents, (event) => O.isNone(event.created_at))) {
    return yield* YeetCommandError.make({
      message: "reviewer request refused: latest ready event is missing or has no timestamp",
      exitCode: 1,
    });
  }
  const drafted = A.filter(A.flatten(events), (event) => event.event === "convert_to_draft");
  const readyAt = yield* pipe(
    readyEvents,
    A.map((event) => event.created_at),
    A.getSomes,
    A.sort(DateTime.Order),
    A.last,
    // Opened ready and never converted: the open is the ready transition.
    O.orElse(() => (A.isReadonlyArrayEmpty(drafted) ? openedAt : O.none())),
    Effect.fromOption,
    Effect.mapError(() => YeetCommandError.make({ message: "reviewer ready timestamp is unavailable", exitCode: 1 }))
  );
  if (
    A.some(
      drafted,
      (event) => O.isNone(event.created_at) || O.exists(event.created_at, (at) => !DateTime.isLessThan(at, readyAt))
    )
  ) {
    return yield* YeetCommandError.make({
      message:
        "reviewer request refused: timeline has a draft transition without a later ready event; retry after GitHub catches up",
      exitCode: 1,
    });
  }
  return readyAt;
});

const requestReviewerComment = Effect.fnUntraced(function* (
  context: RepoRunContext,
  prNumber: number,
  confirmedHead: string,
  openedAt: O.Option<DateTime.Utc>
) {
  const login = yield* reviewerRequestOutput(context, ["api", "user", "--jq", ".login"]).pipe(Effect.map(Str.trim));
  if (login !== REVIEWER_COMMENT_AUTHOR) {
    return yield* YeetCommandError.make({
      message: `reviewer comment requires authenticated ${REVIEWER_COMMENT_AUTHOR}; no comment or fallback push attempted`,
      exitCode: 1,
    });
  }
  const readyAt = yield* readReviewerReadyAt(context, prNumber, openedAt);
  const body = reviewerCommentBody(confirmedHead);
  const pages = yield* reviewerRequestOutput(context, [
    "api",
    `repos/{owner}/{repo}/issues/${prNumber}/comments?per_page=100`,
    "--paginate",
    "--slurp",
  ]).pipe(Effect.flatMap((value) => decodeReviewerResponse(ReviewerRequestComment.pipe(S.Array, S.Array), value)));
  if (
    A.some(
      A.flatten(pages),
      (comment) =>
        comment.user.login === login && comment.body === body && DateTime.isGreaterThan(comment.created_at, readyAt)
    )
  ) {
    return `[yeet] trusted beep-reviewer request already exists for #${prNumber} at ${confirmedHead}; nothing posted`;
  }
  const latest = yield* readReviewerPull(context, prNumber);
  if (!reviewerPullReady(latest, confirmedHead) || !reviewerCommentCovered(latest)) {
    return yield* YeetCommandError.make({
      message:
        "reviewer request refused: pull request changed before the comment; no comment or fallback push attempted",
      exitCode: 1,
    });
  }
  yield* reviewerRequestOutput(context, [
    "api",
    `repos/{owner}/{repo}/issues/${prNumber}/comments`,
    "--method",
    "POST",
    "--field",
    `body=${body}`,
  ]);
  return `[yeet] posted beep-reviewer request for #${prNumber} at ${confirmedHead}; checkout and head unchanged`;
});

const requestReviewerReview = Effect.fn("Yeet.requestReviewerReview")(function* (
  context: RepoRunContext,
  prNumber: number,
  confirmedHead: string,
  allowPush: boolean,
  openedReady?: boolean
) {
  if (!S.is(ReviewerRequestHead)(confirmedHead)) {
    return yield* YeetCommandError.make({
      message: "reviewer request requires a full 40-hex proven head; no request attempted",
      exitCode: 1,
    });
  }
  const pull = yield* readReviewerPull(context, prNumber);
  if (!reviewerPullReady(pull, confirmedHead)) {
    return yield* YeetCommandError.make({
      message: "reviewer request refused: pull request is no longer open and ready at the proven head",
      exitCode: 1,
    });
  }
  if (!reviewerCommentCovered(pull)) {
    if (O.isSome(pull.stack)) return reviewerStackLayerHeld(prNumber, confirmedHead, pull.stack.value);
    return allowPush
      ? yield* pushReviewerRequest(context, prNumber, confirmedHead)
      : `[yeet] no comment routine configured for this pull request author/repository; no repeated review-trigger push`;
  }
  // The open time may anchor only for a pull request known to have opened
  // ready: at the ready open, or later when the ledger recorded that open. After
  // a flip the timeline can lag, and a pull request created as a draft records
  // no convert_to_draft event, so its open time would validate a draft-era request.
  return yield* requestReviewerComment(
    context,
    prNumber,
    confirmedHead,
    openedReady === true ? pull.created_at : O.none()
  );
});

/**
 * Exercise the live reviewer-request routing with scripted GitHub commands.
 *
 * **Example** (Reference the request workflow)
 *
 * ```ts
 * import { requestReviewerReviewForTesting } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof requestReviewerReviewForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const requestReviewerReviewForTesting = requestReviewerReview;

const ensureReviewerRequest = Effect.fn("Yeet.ensureReviewerRequest")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: number,
  head: string,
  allowPush: boolean,
  openedReady?: boolean
) {
  const request = dependencies.requestReview ?? requestReviewerReview;
  const message = yield* request(context, prNumber, head, allowPush, openedReady).pipe(
    Effect.catchTag("YeetCommandError", (cause) =>
      Effect.succeed(
        `[yeet] warning: could not create the beep-reviewer re-request: ${cause.message}; ${reviewerCommentManual(prNumber, head)}`
      )
    )
  );
  yield* Console.log(message);
});

// The moment a pull request became ready, a flip or a ready open, with its
// author: the start of the rounds-to-ready window (ruling 81).
const recordReadyTransition = Effect.fn("Yeet.recordReadyTransition")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: number,
  headSha: string,
  transition: ReviewLaneReadyTransition
) {
  const at = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const author = yield* (dependencies.readAuthor ?? readPullRequestAuthor)(context, prNumber);
  yield* recordYeetReviewLaneRows(context.repoRoot, [
    ReviewLaneFlipRow.make({
      schemaVersion: YEET_REVIEW_LANE_SCHEMA_VERSION,
      prNumber,
      branch: context.branch,
      recordedAt: at,
      headSha,
      at,
      author,
      transition,
    }),
  ]);
});

// Whether this checkout's ledger shows the pull request was opened ready and
// never flipped. Only then may its open time anchor a reviewer request when
// the timeline shows no ready event: a pull request created as a draft records
// no convert_to_draft event, and a retry right after its flip can still read a
// lagging timeline. A ledger without the row (another checkout) answers no.
const openedReadyPerLedger = Effect.fn("Yeet.openedReadyPerLedger")(function* (
  context: RepoRunContext,
  prNumber: number
) {
  const ledger = yield* readYeetReviewLaneLedger(context.repoRoot);
  const transitions = A.flatMap(ledger.rows, (row) =>
    row._tag === "flip" && row.prNumber === prNumber ? [row.transition] : []
  );
  return A.isReadonlyArrayNonEmpty(transitions) && A.every(transitions, ReviewLaneReadyTransition.is.open);
});

const admitHeavyForReady = (context: RepoRunContext, prNumber: number) =>
  admitPullRequestToHeavy(context, prNumber).pipe(provideYeetGhLogin(context.repoRoot), Effect.asVoid);

// A ready pull request is admitted to the heavy matrix. One that already
// carries the label is left alone, so no second label event starts a Heavy
// Admit run. The edit warns on its own failure; a failed diff read warns here.
const ensureHeavyAdmission = Effect.fn("Yeet.ensureHeavyAdmission")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: number,
  labels: ReadonlyArray<string>
) {
  if (A.contains(labels, HEAVY_ADMISSION_LABEL)) return;
  yield* (dependencies.admitHeavy ?? admitHeavyForReady)(context, prNumber).pipe(
    Effect.catchTag("YeetCommandError", (cause) =>
      Console.error(
        `[yeet] warning: could not apply ${HEAVY_ADMISSION_LABEL} to PR #${prNumber} (${cause.message}); run: gh api -X POST repos/{owner}/{repo}/issues/${prNumber}/labels -f labels[]=${HEAVY_ADMISSION_LABEL}`
      )
    )
  );
});

// Advisory only: the merge gate holds on the same verdict, so the flip never
// refuses on it, but the owner learns here, before the flip starts the review
// window, that a reword is due. A read that fails loses only the advice.
const adviseSquashCommitlint = Effect.fn("Yeet.adviseSquashCommitlint")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: number
) {
  const report = yield* (dependencies.squashCommitlint ?? readSquashCommitlintForPullRequest)(context, prNumber).pipe(
    Effect.option
  );
  yield* O.match(report, {
    onNone: () =>
      Console.log(
        `[yeet] warning: squash-commitlint check skipped for #${prNumber}: could not read the pull request commits or run commitlint`
      ),
    onSome: ({ verdict }) =>
      verdict._tag === "pass"
        ? Console.log(`[yeet] squash-commitlint #${prNumber}: pass`)
        : Console.log(
            `[yeet] warning: the squash commit message GitHub will write for #${prNumber} fails commitlint: ${renderSquashCommitlintVerdict(verdict)}. The merge gate holds on squash-commitlint until it passes; reword before the gate runs.`
          ),
  });
});

const readFinalCheckForReady = (context: RepoRunContext, headSha: string) =>
  readFinalCheckReceipt(context.repoRoot, headSha);

const refreshForReady = (context: RepoRunContext, headSha: string) =>
  checkFinalCheckRefresh(context.repoRoot, context.base, headSha);

const rewriteCarryForReady = Effect.fn("Yeet.rewriteCarryForReady")(function* (
  context: RepoRunContext,
  prNumber: number,
  headSha: string
) {
  const pull = yield* provideYeetGhLogin(context.repoRoot)(GithubRest.use((rest) => rest.pullRequest(prNumber))).pipe(
    Effect.option
  );
  if (O.isNone(pull) || pull.value.headSha !== headSha) return O.none<FinalCheckRefreshVerdict>();
  const rows = yield* provideYeetGhLogin(context.repoRoot)(
    GithubRest.use((rest) => rest.refActivity(pull.value.headRef))
  ).pipe(Effect.option);
  if (O.isNone(rows)) return O.none<FinalCheckRefreshVerdict>();
  const priorHeads = HashSet.fromIterable(A.flatMap(rows.value, (row) => [row.before, row.after]));
  return yield* checkFinalCheckRewriteCarry(
    context.repoRoot,
    context.base,
    headSha,
    pull.value.baseSha,
    priorHeads
  ).pipe(provideYeetHeadMoveClassifier(context.repoRoot), Effect.option, Effect.map(O.flatten));
});

const refuseFinalCheck = (detail: string) =>
  YeetReadyGateRefused.make({
    blocker: "final-check",
    detail,
    message: `yeet ready refused: blocked on final-check: ${detail}. Re-run \`${YEET_READY_COMMAND}\` once it passes.`,
  });

/**
 * How `yeet ready` judged the gates a worker-profile final-check deferred to
 * hosted CI.
 *
 * **Details**
 *
 * `accepted` lists the gates whose hosted check run is green on the head;
 * `refusal` is set when any deferred gate's run is pending, missing or red,
 * naming the first such gate.
 *
 * **Example** (Build an all-green judgement)
 *
 * ```ts
 * import { YeetReadyHostedDeferral } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const judged = YeetReadyHostedDeferral.make({ accepted: ["check"], refusal: O.none() })
 * console.log(judged.accepted) // [ "check" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetReadyHostedDeferral extends S.Opaque<YeetReadyHostedDeferral, { readonly brand: unique symbol }>()(
  S.Struct({ accepted: S.Array(FinalCheckGate), refusal: S.Option(S.String) }).pipe(
    $I.annoteSchema("YeetReadyHostedDeferral", {
      description: "The gates a worker-profile final-check deferred that hosted CI proved, and the refusal if any.",
    })
  )
) {}

const profileSkippedGates = (receipt: FinalCheckReceipt): ReadonlyArray<FinalCheckGate> =>
  pipe(
    receipt.steps,
    A.filter((step) => step.status === "skipped" && step.reason === COMPUTE_PROFILE_WORKER_SKIP_REASON),
    A.map((step) => step.gate),
    A.dedupe
  );

type HostedGateJudgement =
  | { readonly _tag: "accepted"; readonly gate: FinalCheckGate }
  | { readonly _tag: "refused"; readonly detail: string };

const judgeHostedGate =
  (latest: HashMap.HashMap<string, MergeGateCheckRun>) =>
  (gate: FinalCheckGate): HostedGateJudgement =>
    O.match(gateHostedContextFor(gate), {
      onNone: () => ({
        _tag: "refused",
        detail: `${gate} was deferred to hosted CI (${COMPUTE_PROFILE_WORKER_SKIP_REASON}) but has no hosted context; run \`${YEET_FINAL_CHECK_COMMAND} --force-local\``,
      }),
      onSome: (context): HostedGateJudgement =>
        O.match(HashMap.get(latest, context), {
          onNone: () => ({ _tag: "refused", detail: `wait for hosted ${context} (worker profile defers ${gate})` }),
          onSome: (run): HostedGateJudgement =>
            run.conclusion === null
              ? { _tag: "refused", detail: `wait for hosted ${context} (worker profile defers ${gate})` }
              : mergeGateGoodConclusion(run.conclusion)
                ? { _tag: "accepted", gate }
                : {
                    _tag: "refused",
                    detail: `hosted ${context} is red (${run.conclusion}) on this head; the worker profile deferred ${gate} to it, fix the red before the flip`,
                  },
        }),
    });

/**
 * Judge the gates a receipt deferred with `compute-profile=worker` against
 * the head's hosted check runs.
 *
 * **Details**
 *
 * Each deferred gate maps to its hosted check run through
 * `gateHostedContextFor`; the newest run of that name decides. Success (or
 * skipped/neutral, as the merge gate counts them) accepts the gate; a pending
 * or missing run refuses with "wait for hosted <context>"; any other
 * conclusion refuses naming the red. Operator skips are not judged here.
 *
 * **Example** (Accept a green hosted Check)
 *
 * ```ts
 * import {
 *   FINAL_CHECK_GATE_SET_DIGEST,
 *   FinalCheckReceipt,
 *   FinalCheckStepResult,
 *   judgeHostedDeferrals,
 *   MergeGateCheckRun,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = FinalCheckReceipt.make({
 *   schemaVersion: "yeet-final-check/v2",
 *   gateSetDigest: FINAL_CHECK_GATE_SET_DIGEST,
 *   headSha: "a".repeat(40),
 *   mergeBase: "b".repeat(40),
 *   base: "origin/main",
 *   complete: true,
 *   verdict: "pass",
 *   startedAt: "2026-11-08T00:00:00.000Z",
 *   finishedAt: "2026-11-08T00:01:00.000Z",
 *   steps: [
 *     FinalCheckStepResult.make({
 *       gate: "check",
 *       label: "final-check:check",
 *       hostedContext: "Heavy / Check",
 *       command: "(skipped)",
 *       status: "skipped",
 *       durationMs: 0,
 *       reason: "compute-profile=worker",
 *     }),
 *   ],
 *   expectationRewrites: [],
 * })
 * const runs = [MergeGateCheckRun.make({ id: 1, name: "Heavy / Check", status: "completed", conclusion: "success" })]
 * console.log(judgeHostedDeferrals(receipt, runs).accepted) // [ "check" ]
 * ```
 *
 * @param receipt - The passing receipt the flip rests on.
 * @param runs - Every check run on the pull request head.
 * @returns The accepted gates and the refusal, if any.
 * @category policies
 * @since 0.0.0
 */
export const judgeHostedDeferrals: {
  (receipt: FinalCheckReceipt, runs: ReadonlyArray<MergeGateCheckRun>): YeetReadyHostedDeferral;
  (runs: ReadonlyArray<MergeGateCheckRun>): (receipt: FinalCheckReceipt) => YeetReadyHostedDeferral;
} = dual(2, (receipt: FinalCheckReceipt, runs: ReadonlyArray<MergeGateCheckRun>): YeetReadyHostedDeferral => {
  const judgements = A.map(profileSkippedGates(receipt), judgeHostedGate(mergeGateLatestRunPerName(runs)));
  return YeetReadyHostedDeferral.make({
    accepted: A.flatMap(judgements, (judgement) => (judgement._tag === "accepted" ? [judgement.gate] : [])),
    refusal: A.head(A.flatMap(judgements, (judgement) => (judgement._tag === "refused" ? [judgement.detail] : []))),
  });
});

const readHostedChecksForReady = (context: RepoRunContext, headSha: string) =>
  provideYeetGhLogin(context.repoRoot)(
    GithubRest.use((rest) => rest.checkRuns(headSha)).pipe(
      Effect.mapBoth({
        onFailure: yeetGithubFailure(`gh api check-runs ${Str.slice(0, 12)(headSha)}`),
        onSuccess: A.map((run) =>
          MergeGateCheckRun.make({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: O.getOrNull(run.conclusion),
          })
        ),
      })
    )
  );

// Operator skips are named for the PR body and never checked; skips the
// worker profile recorded are judged against the head's hosted check runs
// and refuse the flip until each mapped run is green.
const logReceiptSkips = (receipt: FinalCheckReceipt, label: string) => {
  const skipped = A.filter(
    receipt.steps,
    (step) => step.status === "skipped" && step.reason !== COMPUTE_PROFILE_WORKER_SKIP_REASON
  );
  const deferred = profileSkippedGates(receipt);
  return Console.log(
    A.isReadonlyArrayEmpty(skipped)
      ? A.isReadonlyArrayEmpty(deferred)
        ? `[yeet] final-check receipt for ${label}: pass, every gate ran`
        : `[yeet] final-check receipt for ${label}: pass, every gate ran or was deferred to hosted CI (${COMPUTE_PROFILE_WORKER_SKIP_REASON})`
      : `[yeet] final-check receipt for ${label}: pass with ${A.length(skipped)} skipped gate(s): ${A.join(
          A.map(skipped, (step) => `${step.gate} (${step.reason ?? "no reason"})`),
          "; "
        )}; name them in the PR body as checks hosted CI proves`
  );
};

const acceptHostedDeferrals = Effect.fn("Yeet.acceptHostedDeferrals")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  receipt: FinalCheckReceipt,
  headSha: string
) {
  if (A.isReadonlyArrayEmpty(profileSkippedGates(receipt))) return A.empty<FinalCheckGate>();
  const runs = yield* (dependencies.hostedChecks ?? readHostedChecksForReady)(context, headSha).pipe(
    Effect.mapError((cause) =>
      refuseFinalCheck(
        `the worker profile deferred gates to hosted CI and their check runs could not be read: ${cause.message}`
      )
    )
  );
  const judged = judgeHostedDeferrals(receipt, runs);
  if (O.isSome(judged.refusal)) return yield* refuseFinalCheck(judged.refusal.value);
  yield* Effect.forEach(judged.accepted, (gate) => Console.log(`[yeet] hosted green stands in for ${gate}`), {
    discard: true,
  });
  return judged.accepted;
});

// A publish checks the receipt before its pull request exists.
const renderFinalPr = (prNumber: O.Option<number>): string =>
  O.match(prNumber, { onNone: () => "#<pr>", onSome: (value) => `#${value}` });

const renderHostedGreen = (accepted: ReadonlyArray<FinalCheckGate>): string =>
  A.isReadonlyArrayEmpty(accepted) ? "" : ` hosted-green ${A.join(accepted, ",")}`;

const renderOwnChange = (change: FinalCheckRefreshOwnChange): string =>
  `${change.path} (${O.getOrElse(change.allowance, () => "not allowed")})`;

const acceptCarriedReceipt = Effect.fn("Yeet.acceptCarriedReceipt")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  receipt: FinalCheckReceipt,
  headSha: string,
  prNumber: O.Option<number>,
  label: string
) {
  yield* logReceiptSkips(receipt, label);
  const accepted = yield* acceptHostedDeferrals(context, dependencies, receipt, headSha);
  yield* Console.log(
    `[yeet] report this final as: final <sha40> ${renderFinalPr(prNumber)} receipt ${receipt.headSha}${renderHostedGreen(accepted)} (the sha is the head after the flip)`
  );
});

const carriedReceiptRefusal = (refused: FinalCheckRefreshRefused, missing: string, rewrite: boolean): string => {
  if (rewrite)
    return `${missing}; the receipt of ${refused.receiptHead} does not carry across the GitHub rewrite: ${refused.detail}`;
  return refused.reason === "malformed-receipt"
    ? refused.detail
    : `${missing}; the nearest ancestor receipt, on ${Str.slice(0, 12)(refused.receiptHead)}, does not carry to this head: ${refused.detail}`;
};

const acceptOwnReceipt = Effect.fn("Yeet.acceptOwnReceipt")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  passing: FinalCheckReceipt,
  headSha: string,
  prNumber: O.Option<number>
) {
  yield* logReceiptSkips(passing, Str.slice(0, 12)(headSha));
  const accepted = yield* acceptHostedDeferrals(context, dependencies, passing, headSha);
  if (A.isReadonlyArrayNonEmpty(accepted)) {
    yield* Console.log(
      `[yeet] report this final as: final <sha40> ${renderFinalPr(prNumber)} receipt ${passing.headSha}${renderHostedGreen(accepted)} (the sha is the head after the flip)`
    );
  }
});

// A carried receipt must be written under the current schema version and gate
// set, whichever carry produced it: the refresh and rewrite readers refuse one
// already, and this keeps the flip closed if a carry ever skips that check.
const refuseStaleCarriedReceipt = (receipt: FinalCheckReceipt, missing: string, carry: string) =>
  O.match(finalCheckGateSetRefusal(receipt), {
    onNone: () => Effect.void,
    onSome: (detail) =>
      Effect.fail(
        refuseFinalCheck(
          `${missing}; the receipt of ${Str.slice(0, 12)(receipt.headSha)} does not carry ${carry}: ${detail}`
        )
      ),
  });

// The flip is the content-final claim, so it requires the head-pinned
// final-check receipt: every hosted gate the cheap tier skips, replayed on
// this exact head. Skipped gates are named so the owner states them in the PR.
// A head with no receipt of its own may carry an ancestor's passing receipt
// under the ancestor refresh rule, then the GitHub rewrite carry; a failing or partial
// receipt on this head always stands. A publish asks before its pull request
// exists (`prNumber` is `None`), where no GitHub rewrite can have happened yet.
const requireFinalCheck = Effect.fn("Yeet.requireFinalCheck")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: O.Option<number>,
  headSha: string
) {
  const receipt = yield* (dependencies.finalCheck ?? readFinalCheckForReady)(context, headSha);
  const refusal = finalCheckRefusal(receipt, headSha);
  if (O.isNone(refusal)) {
    // A passing finalCheckRefusal requires a present receipt; an empty receipt
    // always has a refusal. Do not keep an unreachable success branch here.
    yield* acceptOwnReceipt(context, dependencies, O.getOrThrow(receipt), headSha, prNumber);
    return;
  }
  if (O.isSome(receipt)) return yield* refuseFinalCheck(refusal.value);
  const ancestor = yield* (dependencies.refresh ?? refreshForReady)(context, headSha);
  const refresh =
    O.isSome(ancestor) || O.isNone(prNumber)
      ? ancestor
      : yield* (dependencies.rewriteCarry ?? rewriteCarryForReady)(context, prNumber.value, headSha);
  if (O.isNone(refresh)) return yield* refuseFinalCheck(refusal.value);
  yield* FinalCheckRefreshVerdict.match(refresh.value, {
    refused: (refused) =>
      Effect.fail(refuseFinalCheck(carriedReceiptRefusal(refused, refusal.value, O.isNone(ancestor)))),
    rewrite: Effect.fnUntraced(function* (passed) {
      yield* refuseStaleCarriedReceipt(passed.receipt, refusal.value, "across the GitHub rewrite");
      yield* Console.log(
        `[yeet] head ${headSha} carries the receipt of ${passed.receipt.headSha}: it replays ${passed.receipt.headSha}'s ${passed.move.commits} commits onto ${passed.move.base} with identical patches`
      );
      yield* acceptCarriedReceipt(context, dependencies, passed.receipt, headSha, prNumber, "GitHub rewrite");
    }),
    pass: Effect.fnUntraced(function* (passed) {
      yield* refuseStaleCarriedReceipt(passed.receipt, refusal.value, "from the ancestor");
      const receiptHead = passed.receipt.headSha;
      yield* Console.log(
        `[yeet] final-check refresh: pass; head ${Str.slice(0, 12)(headSha)} carries the receipt of ancestor ${receiptHead}; own changes since the receipt: ${
          A.isReadonlyArrayEmpty(passed.ownChanges) ? "none" : A.join(A.map(passed.ownChanges, renderOwnChange), ", ")
        }`
      );
      yield* acceptCarriedReceipt(
        context,
        dependencies,
        passed.receipt,
        headSha,
        prNumber,
        `ancestor ${Str.slice(0, 12)(receiptHead)}`
      );
    }),
  });
});

const recordAndConfirmInherited = Effect.fn("Yeet.recordAndConfirmInherited")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  confirmation: YeetReadyGateFlip,
  inherited: ReadonlyArray<YeetReadyInheritedRed>,
  headSha: string
) {
  const applied = confirmation.inherited;
  const record = (dependencies.recordInherited ?? recordInheritedThroughRest)(confirmation.prNumber, applied, headSha);
  yield* A.isReadonlyArrayNonEmpty(applied)
    ? record
    : record.pipe(
        Effect.catchTag("YeetCommandError", (cause) =>
          Console.log(`[yeet] warning: ${cause.message}; continuing the ready flip with no applied inherited reds`)
        )
      );
  // Recording takes time; confirm the whole gate against the recorded head and
  // attributions before allowing the caller to flip.
  const value1 = yield* (dependencies.read ?? readPullRequestForReady)(context);
  const afterRecord = decideYeetReadyGate(value1, inherited);
  if (
    afterRecord._tag !== "flip" ||
    !O.contains(afterRecord.headSha, headSha) ||
    !inheritedRedsEquivalence(afterRecord.inherited, applied)
  ) {
    return yield* YeetCommandError.make({
      message: A.isReadonlyArrayNonEmpty(applied)
        ? `yeet ready refused: the pull request changed while recording inherited reds; re-run \`${YEET_READY_COMMAND}\` so the current state is gated and recorded.`
        : `yeet ready refused: the pull request changed while reconciling the inherited-reds section; re-run \`${YEET_READY_COMMAND}\` so the current state is gated.`,
      exitCode: 1,
    });
  }
});

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
 * `YeetCommandError`. With S11 `inherited` attributions, a flip first records
 * the applied ones in the PR body (REST), and a failed record refuses the flip
 * with `YeetCommandError`. A second confirmation after the body write requires
 * the same head, a passing gate, and the same applied attributions before flipping.
 * Already-ready pull requests also verify the current-head receipt, including
 * the existing ancestor refresh rule after a base-only merge; no flip or
 * review-trigger push is repeated; a covered comment request can be repaired.
 * After a flip, an author or repository the comment routine does not cover
 * falls back to the empty S32 commit, except on a native stack layer, where
 * nothing is pushed and the warning names the manual request comment.
 * Before a flip, and for an already-ready pull request, the squash commit
 * message GitHub will write is predicted and linted as an advisory
 * (`SquashCommitlint.ts`): a failing verdict prints the rule and the offending
 * line but never refuses the flip, because the merge gate holds on it.
 * When no reds apply, stale-section cleanup is best effort: an existing section
 * is rewritten to a head-pinned None record, but a failed read or write only
 * warns. An empty set without a section adds nothing. The post-record gate
 * confirmation still requires the same head and passing checks and threads.
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
 * @param dependencies - Injectable pull request read, inherited-red record and ready flip for tests.
 * @param inherited - Parsed S11 `--inherited` attributions.
 * @returns The decision the gate acted on.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetReadyGate = Effect.fn("Yeet.runYeetReadyGate")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies = {},
  inherited: ReadonlyArray<YeetReadyInheritedRed> = []
): Effect.fn.Return<
  YeetReadyGateDecision,
  YeetCommandError | YeetReadyGateRefused,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git
> {
  const read = yield* (dependencies.read ?? readPullRequestForReady)(context);
  const decision = decideYeetReadyGate(read, inherited);
  const failing = failingRequiredNames(read.remote);
  yield* Effect.forEach(
    A.filter(inherited, (red) => !HashSet.has(failing, red.check)),
    (red) =>
      Console.log(
        `[yeet] note: --inherited ${red.check} is not a failing required check on this head; ignored (optional reds never hold the flip)`
      ),
    { discard: true }
  );
  yield* YeetReadyGateDecision.match(decision, {
    blocked: (blocked) =>
      Effect.fail(
        YeetReadyGateRefused.make({
          blocker: blocked.blocker,
          message: `yeet ready refused: blocked on ${blocked.blocker}: ${blocked.detail}. Re-run \`${YEET_READY_COMMAND}\` once it clears.`,
        })
      ),
    "already-ready": Effect.fnUntraced(function* ({ prNumber }) {
      const currentHead = O.getOrElse(read.remote.headSha, () => "unknown");
      yield* requireFinalCheck(context, dependencies, O.some(prNumber), currentHead);
      yield* Console.log(
        `[yeet] pull request #${prNumber} is already ready for review; current-head final-check proof verified, nothing to flip`
      );
      yield* adviseSquashCommitlint(context, dependencies, prNumber);
      // Repairs a ready pull request whose label edit failed at the open or the flip.
      yield* ensureHeavyAdmission(context, dependencies, prNumber, read.remote.labels);
      // The open may anchor the request only for a pull request this checkout opened ready.
      const openedReady = yield* openedReadyPerLedger(context, prNumber);
      yield* ensureReviewerRequest(context, dependencies, prNumber, currentHead, false, openedReady);
    }),
    flip: Effect.fnUntraced(function* ({ prNumber, headSha }) {
      yield* requireFinalCheck(
        context,
        dependencies,
        O.some(prNumber),
        O.getOrElse(headSha, () => "unknown")
      );
      yield* adviseSquashCommitlint(context, dependencies, prNumber);
      // The gate decided on a read taken moments ago. A push, a check rerun,
      // or a new thread can land in between, even on the same head, so take
      // the whole gate read again immediately before the flip and require the
      // same verdict on the same head.
      const value2 = yield* (dependencies.read ?? readPullRequestForReady)(context);
      const confirmation = decideYeetReadyGate(value2, inherited);
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
      // S11: the attributions the confirmation applied are written before the
      // flip; a failed non-empty write refuses it. Empty-section cleanup warns.
      const applied = confirmation.inherited;
      yield* recordAndConfirmInherited(context, dependencies, confirmation, inherited, sameHead);
      // markPullRequestReadyForReview is GraphQL-only; the default flip spends it
      // through the GraphQL budget guard, waiting for the hourly reset when the
      // shared budget is spent instead of failing the way `gh pr ready` did.
      yield* (dependencies.markReady ?? markReadyThroughBudget)(prNumber, sameHead);
      yield* Console.log(`[yeet] pull request #${prNumber} flipped from draft to ready for review`);
      // A `--draft` open carries no heavy-admission label: the flip admits the heavy matrix.
      yield* ensureHeavyAdmission(context, dependencies, prNumber, value2.remote.labels);
      // The flip opens the rounds-to-ready window (ruling 81); a failed
      // record is one warning and never touches the flip.
      yield* recordReadyTransition(context, dependencies, prNumber, sameHead, "flip");
      // Draft pushes are ignored by the reviewer. Request the proven head by
      // comment where configured, otherwise retain S32 off a stack layer; a failure warns.
      yield* ensureReviewerRequest(context, dependencies, prNumber, sameHead, true);
      if (A.isReadonlyArrayNonEmpty(applied)) {
        yield* Console.log(`[yeet] recorded ${A.length(applied)} inherited red(s) in the PR body`);
      }
      yield* Console.log(
        `[yeet] the review window starts now: the merge gate opens no sooner than the review window (default ${Duration.toMinutes(YEET_REVIEW_WINDOW_DEFAULT)} minutes) after this flip or the last push, whichever is later; do not merge in this step`
      );
      // Reviewers that skip drafts post only now, and a monitor that reported
      // `ready-pending-flip` has ended: name who is watching, or how to watch.
      const watching = yield* (dependencies.findMonitor ?? findLiveMonitorForReady)(context, prNumber);
      yield* Console.log(
        O.match(watching, {
          onNone: () =>
            `[yeet] no detached readiness monitor is registered for #${prNumber}; keep any attached --until-ready monitor running. Otherwise submit: ${YEET_MONITOR_SUBMIT_COMMAND}\n[yeet] for a submitted job, wait with: bun run beep yeet job wait <jobId>`,
          onSome: (record) =>
            `[yeet] readiness monitor job ${record.jobId} is still watching #${prNumber}\n[yeet] wait with: bun run beep yeet job wait ${record.jobId}`,
        })
      );
    }),
  });
  return decision;
});

const renderOpenReadyRefusal = (headSha: string, detail: string): string =>
  `yeet publish refused to open the pull request ready: ${detail}. Nothing was pushed; commit ${Str.slice(0, 12)(headSha)} is local. A pull request opens ready for review only on a head with a passing final-check receipt: run \`${YEET_FINAL_CHECK_COMMAND}\` (skip a gate this machine cannot run with --skip <gate>=<reason> and name it in the PR body), then \`bun run beep yeet open\`. To open unfinished work instead, pass --draft: a draft runs only the cheap hosted tier until \`${YEET_READY_COMMAND}\` flips it.`;

/**
 * The ready-gate hooks a publish uses to open a pull request ready.
 *
 * **Details**
 *
 * `requireProof` is the receipt rule `yeet ready` enforces at a flip, asked
 * before the pull request exists: the head's own passing final-check receipt,
 * or an ancestor's under the refresh rule. A receipt whose gates the worker
 * profile deferred to hosted CI cannot pass here, because no hosted run exists
 * before the open. `afterOpen` does what the flip does once the pull request
 * is ready: it records the start of the review round and requests the reviewer
 * by comment where the routine covers the author. It never pushes, and a
 * failure is one warning.
 *
 * **Example** (Reference the hooks)
 *
 * ```ts
 * import { yeetOpenReadyHooks } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetOpenReadyHooks().requireProof) // "function"
 * ```
 *
 * @param dependencies - Injectable receipt, refresh, hosted-check and reviewer reads for tests.
 * @returns The hooks the command layer provides as `YeetOpenReady`.
 * @category workflows
 * @since 0.0.0
 */
export const yeetOpenReadyHooks = (dependencies: YeetReadyGateDependencies = {}): YeetOpenReadyHooks => ({
  requireProof: (context, headSha) =>
    requireFinalCheck(context, dependencies, O.none(), headSha).pipe(
      Effect.catchTag("YeetReadyGateRefused", (refused) =>
        Effect.fail(
          YeetCommandError.make({
            message: renderOpenReadyRefusal(headSha, refused.detail ?? refused.message),
            exitCode: 1,
          })
        )
      )
    ),
  afterOpen: Effect.fnUntraced(function* (context, prNumber, headSha) {
    yield* recordReadyTransition(context, dependencies, prNumber, headSha, "open");
    yield* ensureReviewerRequest(context, dependencies, prNumber, headSha, false, true);
    yield* Console.log(
      `[yeet] the review window starts now: the merge gate opens no sooner than the review window (default ${Duration.toMinutes(YEET_REVIEW_WINDOW_DEFAULT)} minutes) after this open or the last push, whichever is later`
    );
  }),
});

/**
 * Run `yeet ready` for the checked-out branch.
 *
 * **Details**
 *
 * A malformed `--inherited` value is refused before anything is read.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetReady } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetReady) // "function"
 * ```
 *
 * @param options - Base, head, packet directory, and the raw `--inherited` values.
 * @returns An Effect that completes after the flip or the already-ready report.
 * @category use-cases
 * @since 0.0.0
 */
export const runYeetReady = Effect.fn("Yeet.runYeetReady")(function* (options: YeetReadyOptions) {
  const inherited = yield* decodeAttributedCheckFlags("inherited", options.inherited, parseYeetReadyInheritedRed);
  const context = yield* hydrateYeetReadOnlyContext(options);
  const stamped = yield* Ref.make(false);
  yield* runYeetReadyGate(
    context,
    {
      read: readPullRequestForReadyStampingFooter({
        read: readPullRequestForReady,
        stamp: recordMonitoredPrSessionAsGhLogin,
        stamped,
      }),
    },
    inherited
  );
});

// Every owner runs `yeet ready` at content-final, whether the flip goes
// through or is refused, so its first pull-request read records this session
// and re-asserts the provenance footer a body rewrite may have dropped. The
// gate reads twice; the Ref keeps the stamp to one. A failed stamp only warns.
const readPullRequestForReadyStampingFooter =
  <E, R, R2>({
    read,
    stamp,
    stamped,
  }: {
    readonly read: (context: RepoRunContext) => Effect.Effect<YeetReadyPullRequestRead, E, R>;
    readonly stamp: (context: RepoRunContext, prNumber: number) => Effect.Effect<unknown, never, R2>;
    readonly stamped: Ref.Ref<boolean>;
  }) =>
  (context: RepoRunContext) =>
    read(context).pipe(
      Effect.tap((value) =>
        Effect.flatMap(Ref.getAndSet(stamped, true), (alreadyStamped) =>
          alreadyStamped || value.remote.number === undefined
            ? Effect.void
            : Effect.asVoid(stamp(context, value.remote.number))
        )
      )
    );

/**
 * The `yeet ready` pull-request read that records the session and re-asserts
 * the provenance footer once, with the read and the stamp injected.
 *
 * **Example** (Reference the wrapper)
 *
 * ```ts
 * import { readPullRequestForReadyStampingFooterForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readPullRequestForReadyStampingFooterForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const readPullRequestForReadyStampingFooterForTesting = readPullRequestForReadyStampingFooter;
