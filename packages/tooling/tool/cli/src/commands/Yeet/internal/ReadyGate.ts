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

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ghOutput } from "../../../internal/github/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { finalCheckRefusal, readFinalCheckReceipt } from "./FinalCheck.ts";
import { FinalCheckRefreshVerdict } from "./FinalCheckRefresh.schemas.ts";
import { checkFinalCheckRefresh } from "./FinalCheckRefresh.ts";
import { flipPullRequestReady, recordInheritedRedsInPullRequestBody, withYeetGh } from "./GhOps.ts";
import { runGitOutput } from "./GitExec.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { decodeAttributedCheckFlags, parseAttributedCheck } from "./MergeGate.ts";
import { YEET_READY_COMMAND } from "./MonitorPolicy.ts";
import { findLiveReadyMonitorJob } from "./ProofJob.ts";
import { ProofJobLauncher } from "./ProofJobLauncher.ts";
import { ReviewLaneFlipRow, YEET_REVIEW_LANE_SCHEMA_VERSION } from "./ReviewLane.schemas.ts";
import { recordYeetReviewLaneRows } from "./ReviewLane.ts";
import { YEET_REVIEW_WINDOW_DEFAULT } from "./ReviewWindow.ts";
import { readSquashCommitlintForPullRequest, renderSquashCommitlintVerdict } from "./SquashCommitlint.ts";
import { collectYeetStatus, YeetStatusRemote } from "./Status.ts";
import { mergeReadyCriterionHolds, YeetMergeReady } from "./Verdict.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetReadyOptions } from "../Yeet.schemas.ts";
import type { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import type { FinalCheckRefreshOwnChange } from "./FinalCheckRefresh.schemas.ts";
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
  return yield* ghOutput({
    args: ["pr", "view", `${prNumber}`, "--json", "author", "--jq", ".author.login"],
    cwd: context.repoRoot,
    label: "gh pr view author",
    onFailure: (failure) => failure,
  }).pipe(Effect.map(flow(Str.trim, O.liftPredicate(Str.isNonEmpty))), Effect.orElseSucceed(O.none<string>));
});

interface YeetReadyGateDependencies {
  readonly finalCheck?: (
    context: RepoRunContext,
    headSha: string
  ) => Effect.Effect<O.Option<FinalCheckReceipt>, never, FileSystem.FileSystem | Path.Path>;
  readonly findMonitor?: typeof findLiveMonitorForReady;
  readonly markReady?: (
    prNumber: number,
    confirmedHead: string
  ) => Effect.Effect<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
  readonly read?: (
    context: RepoRunContext
  ) => Effect.Effect<
    YeetReadyPullRequestRead,
    YeetCommandError,
    SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
    confirmedHead: string
  ) => Effect.Effect<string, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
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
 * beep-reviewer reviews only heads pushed while the pull request is ready, so
 * the head current at the flip, pushed while the pull request was a draft, would
 * otherwise never be reviewed.
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
  const localHead = yield* runGitOutput(context.repoRoot, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim));
  if (!reviewerRequestPushable(localHead, confirmedHead)) {
    return `[yeet] note: the checkout is at ${localHead}, not the flipped head ${confirmedHead}, so nothing was pushed; ${reviewerRequestManual(confirmedHead, context.branch)}`;
  }
  yield* runGitOutput(context.repoRoot, [
    "commit",
    "--allow-empty",
    "--only",
    "--no-verify",
    "-m",
    YEET_REVIEWER_REQUEST_SUBJECT,
  ]);
  const request = yield* runGitOutput(context.repoRoot, ["rev-parse", "HEAD"]).pipe(Effect.map(Str.trim));
  return yield* runGitOutput(context.repoRoot, ["push", "origin", `HEAD:refs/heads/${context.branch}`]).pipe(
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

const refuseFinalCheck = (detail: string) =>
  YeetReadyGateRefused.make({
    blocker: "final-check",
    message: `yeet ready refused: blocked on final-check: ${detail}. Re-run \`${YEET_READY_COMMAND}\` once it passes.`,
  });

const logReceiptSkips = (receipt: FinalCheckReceipt, label: string) => {
  const skipped = A.filter(receipt.steps, (step) => step.status === "skipped");
  return Console.log(
    A.isReadonlyArrayEmpty(skipped)
      ? `[yeet] final-check receipt for ${label}: pass, every gate ran`
      : `[yeet] final-check receipt for ${label}: pass with ${A.length(skipped)} skipped gate(s): ${A.join(
          A.map(skipped, (step) => `${step.gate} (${step.reason ?? "no reason"})`),
          "; "
        )}; name them in the PR body as checks hosted CI proves`
  );
};

const renderOwnChange = (change: FinalCheckRefreshOwnChange): string =>
  `${change.path} (${O.getOrElse(change.allowance, () => "not allowed")})`;

// The flip is the content-final claim, so it requires the head-pinned
// final-check receipt: every hosted gate the cheap tier skips, replayed on
// this exact head. Skipped gates are named so the owner states them in the PR.
// A head with no receipt of its own may carry an ancestor's passing receipt
// under the refresh rule (`FinalCheckRefresh.ts`); a failing or partial
// receipt on this head always stands.
const requireFinalCheck = Effect.fn("Yeet.requireFinalCheck")(function* (
  context: RepoRunContext,
  dependencies: YeetReadyGateDependencies,
  prNumber: number,
  headSha: string
) {
  const receipt = yield* (dependencies.finalCheck ?? readFinalCheckForReady)(context, headSha);
  const refusal = finalCheckRefusal(receipt, headSha);
  if (O.isNone(refusal)) {
    // A passing finalCheckRefusal requires a present receipt; an empty receipt
    // always has a refusal. Do not keep an unreachable success branch here.
    return yield* logReceiptSkips(O.getOrThrow(receipt), Str.slice(0, 12)(headSha));
  }
  if (O.isSome(receipt)) return yield* refuseFinalCheck(refusal.value);
  const refresh = yield* (dependencies.refresh ?? refreshForReady)(context, headSha);
  if (O.isNone(refresh)) return yield* refuseFinalCheck(refusal.value);
  yield* FinalCheckRefreshVerdict.match(refresh.value, {
    refused: (refused) =>
      Effect.fail(
        refuseFinalCheck(
          refused.reason === "malformed-receipt"
            ? refused.detail
            : `${refusal.value}; the nearest ancestor receipt, on ${Str.slice(0, 12)(refused.receiptHead)}, does not carry to this head: ${refused.detail}`
        )
      ),
    pass: Effect.fnUntraced(function* (passed) {
      const receiptHead = passed.receipt.headSha;
      yield* Console.log(
        `[yeet] final-check refresh: pass; head ${Str.slice(0, 12)(headSha)} carries the receipt of ancestor ${receiptHead}; own changes since the receipt: ${
          A.isReadonlyArrayEmpty(passed.ownChanges) ? "none" : A.join(A.map(passed.ownChanges, renderOwnChange), ", ")
        }`
      );
      yield* logReceiptSkips(passed.receipt, `ancestor ${Str.slice(0, 12)(receiptHead)}`);
      yield* Console.log(
        `[yeet] report this final as: final <sha40> #${prNumber} receipt ${receiptHead} (the sha is the head after the flip)`
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
  const afterRecord = decideYeetReadyGate(yield* (dependencies.read ?? readPullRequestForReady)(context), inherited);
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
      yield* Console.log(`[yeet] pull request #${prNumber} is already ready for review; nothing to flip`);
      yield* adviseSquashCommitlint(context, dependencies, prNumber);
    }),
    flip: Effect.fnUntraced(function* ({ prNumber, headSha }) {
      yield* requireFinalCheck(
        context,
        dependencies,
        prNumber,
        O.getOrElse(headSha, () => "unknown")
      );
      yield* adviseSquashCommitlint(context, dependencies, prNumber);
      // The gate decided on a read taken moments ago. A push, a check rerun,
      // or a new thread can land in between, even on the same head, so take
      // the whole gate read again immediately before the flip and require the
      // same verdict on the same head.
      const confirmation = decideYeetReadyGate(
        yield* (dependencies.read ?? readPullRequestForReady)(context),
        inherited
      );
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
      // The flip opens the rounds-to-ready window (ruling 81); a failed
      // record is one warning and never touches the flip.
      const flippedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const author = yield* (dependencies.readAuthor ?? readPullRequestAuthor)(context, prNumber);
      yield* recordYeetReviewLaneRows(context.repoRoot, [
        ReviewLaneFlipRow.make({
          schemaVersion: YEET_REVIEW_LANE_SCHEMA_VERSION,
          prNumber,
          branch: context.branch,
          recordedAt: flippedAt,
          headSha: sameHead,
          at: flippedAt,
          author,
        }),
      ]);
      // The head was pushed while the pull request was a draft, which
      // beep-reviewer ignores; a failed re-request only warns, the flip stands.
      yield* Console.log(
        yield* (dependencies.requestReview ?? pushReviewerRequest)(context, prNumber, sameHead).pipe(
          Effect.catchTag("YeetCommandError", (cause) =>
            Effect.succeed(
              `[yeet] warning: could not create the beep-reviewer re-request: ${cause.message}; ${reviewerRequestManual(sameHead, context.branch)}`
            )
          )
        )
      );
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
  yield* runYeetReadyGate(context, {}, inherited);
});
