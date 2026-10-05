/**
 * `yeet ready`: flip a draft pull request to ready under the D10 gate.
 *
 * **Details**
 *
 * Push-first publish opens every pull request as a draft (push-first-publish
 * D4) and `monitor --until-ready` ends `ready-pending-flip` once the draft flag
 * is the only blocker (D9). This module is the flip: it reads the pull request
 * through the same status read the readiness monitor uses, and runs
 * `gh pr ready` only when, on the current head, every review thread is answered
 * and the required checks are green (D10). Anything else refuses with the first
 * blocker named. There is no `--force`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Console, Effect, Match, pipe, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import { YEET_READY_COMMAND } from "./MonitorPolicy.ts";
import { collectYeetStatus, YeetStatusRemote } from "./Status.ts";
import { mergeReadyCriterionHolds, YeetMergeReady, YeetMergeReadyCriterion } from "./Verdict.ts";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetReadyOptions } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ReadyGate");

/**
 * The merge-protocol criteria the draft-to-ready flip checks, in the order it
 * names a blocker.
 *
 * **Details**
 *
 * A subset of {@link YeetMergeReadyCriterion}: the pull request must be open,
 * its required checks green on the current head, and every review thread
 * answered (push-first-publish D10). Mergeability and the closeout run are left
 * to `monitor --until-ready`, which keeps watching after the flip.
 *
 * **Example** (List the gate criteria)
 *
 * ```ts
 * import { YeetReadyGateCriterion } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetReadyGateCriterion.literals) // ["pr-open", "required-checks-green", "threads-resolved"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetReadyGateCriterion = YeetMergeReadyCriterion.pick([
  "pr-open",
  "required-checks-green",
  "threads-resolved",
]).pipe(
  $I.annoteSchema("YeetReadyGateCriterion", {
    description: "A merge-protocol criterion the yeet ready flip requires before it leaves draft.",
  })
);

/**
 * A merge-protocol criterion the draft-to-ready flip requires.
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
  $I.annote("YeetReadyGateFlip", { description: "The D10 gate holds on a draft pull request; flip it to ready." })
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
    description: "The D10 gate holds and the pull request is not a draft; nothing to flip.",
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
    description: "The D10 gate refuses the flip on its first unmet criterion.",
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
 * const error = YeetReadyGateRefused.make({ blocker: "required-checks-green", message: "required checks pending" })
 * console.log(error.blocker) // "required-checks-green"
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
    description: "yeet ready refused to flip a draft pull request because a D10 criterion is unmet.",
  })
) {
  /** Process exit code reported when the refusal reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

const countOf = (value: number | undefined): number => value ?? 0;

const blockerDetail = (blocker: YeetReadyGateCriterion, remote: YeetStatusRemote): string =>
  Match.value(blocker).pipe(
    Match.when("pr-open", () =>
      remote.available && remote.state !== undefined
        ? `pull request #${remote.number ?? "?"} is ${remote.state}`
        : "no open pull request was found for this branch"
    ),
    Match.when(
      "required-checks-green",
      () =>
        `required checks are not green on head ${O.getOrElse(remote.headSha, () => "unknown")}: ${countOf(
          remote.failingRequiredCheckCount
        )} failing, ${countOf(remote.pendingRequiredCheckCount)} pending of ${countOf(remote.requiredCheckCount)} required`
    ),
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
 * Walks {@link YeetReadyGateCriterion} in order against the merge-readiness
 * verdict the monitor derives from the same read. An unread pull request fails
 * every criterion, so it is blocked on `pr-open`. With the gate met, a draft is
 * flipped and a non-draft is reported as already ready.
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
    (criterion) => !O.exists(read.mergeReady, (ready) => mergeReadyCriterionHolds(ready.criteria, criterion))
  );
  return pipe(
    O.fromUndefinedOr(read.remote.number),
    O.filter(() => O.isNone(blocker)),
    O.match({
      onNone: () => {
        const unmet = O.getOrElse(blocker, () => YeetReadyGateCriterion.literals[0]);
        return YeetReadyGateBlocked.make({ blocker: unmet, detail: blockerDetail(unmet, read.remote) });
      },
      onSome: (prNumber): YeetReadyGateDecision =>
        read.remote.isDraft === false
          ? YeetReadyGateAlreadyReady.make({ prNumber })
          : YeetReadyGateFlip.make({ prNumber, headSha: read.remote.headSha }),
    })
  );
};

const readPullRequestForReady = Effect.fn("Yeet.readPullRequestForReady")(function* (context: RepoRunContext) {
  const snapshot = yield* collectYeetStatus(context, true);
  return YeetReadyPullRequestRead.make({ remote: snapshot.remote, mergeReady: snapshot.mergeReady });
});

interface YeetReadyGateDependencies {
  readonly capture?: typeof runRepoCommandCapture;
  readonly read?: (
    context: RepoRunContext
  ) => Effect.Effect<
    YeetReadyPullRequestRead,
    YeetCommandError,
    Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
}

/**
 * Read the branch's pull request and flip it from draft to ready under D10.
 *
 * **Details**
 *
 * The read is the status snapshot `monitor --until-ready` takes on every poll,
 * so the flip and the monitor never disagree about the current head, its
 * checks, or its threads. A blocked decision fails with
 * {@link YeetReadyGateRefused}; a failed `gh pr ready` fails with
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
 * @param dependencies - Injectable pull request read and GitHub runner for tests.
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
      const capture = dependencies.capture ?? runRepoCommandCapture;
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
      const args = ["pr", "ready", `${prNumber}`];
      const result = yield* capture("gh", args, context.repoRoot).pipe(
        Effect.mapError(YeetCommandError.new("Failed to run gh pr ready."))
      );
      if (result.exitCode !== 0) {
        return yield* YeetCommandError.make({
          message: `gh pr ready failed:\n${Str.trim(result.output)}`,
          command: `gh ${A.join(args, " ")}`,
          exitCode: result.exitCode,
        });
      }
      yield* Console.log(`[yeet] pull request #${prNumber} flipped from draft to ready for review`);
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
