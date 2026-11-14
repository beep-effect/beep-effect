/**
 * Resolves the pull request `goals set-status <slug> completed-retained` binds as a goal's final.
 *
 * **Details**
 *
 * The bind writer needs one hosted fact per candidate: the pull request's
 * number, its state and its head branch. The live resolver reads them with
 * `gh pr view [n] --json number,state,headRefName`, the route Yeet closeout
 * already keeps for the checked-out branch's pull request. It is the only
 * process boundary `goals set-status` has. A non-zero exit, a spawn failure
 * or undecodable JSON resolves to `None`, so the writer refuses instead of
 * guessing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PullRequest } from "@beep/github/PullRequest";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ghOutput } from "../../internal/github/GhCommand.ts";
import { layerWorktreeGithub } from "../Worktree/Worktree.service.ts";
import type { PullRequestInfo } from "@beep/github/PullRequest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Goals/FinalPullRequest");

/**
 * GitHub's pull request state as `gh pr view --json state` reports it.
 *
 * **Example** (Guard a merged state)
 *
 * ```ts
 * import { GoalFinalPullRequestState } from "@beep/repo-cli/commands/Goals/FinalPullRequest"
 * console.log(GoalFinalPullRequestState.is.MERGED("MERGED")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalFinalPullRequestState = LiteralKit(["OPEN", "MERGED", "CLOSED"]).pipe(
  $I.annoteSchema("GoalFinalPullRequestState", {
    description: "GitHub pull request state as gh pr view reports it: open, merged, or closed without merging.",
  })
);

/**
 * GitHub's pull request state as `gh pr view --json state` reports it.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoalFinalPullRequestState = typeof GoalFinalPullRequestState.Type;

/**
 * One pull request the bind writer may name as a goal's final.
 *
 * **Example** (Describe an open candidate)
 *
 * ```ts
 * import { GoalFinalPullRequestCandidate } from "@beep/repo-cli/commands/Goals/FinalPullRequest"
 *
 * const candidate = GoalFinalPullRequestCandidate.make({ number: 3150, state: "OPEN", headRefName: "feat/demo" })
 * console.log(candidate.number) // 3150
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalFinalPullRequestCandidate extends S.Opaque<
  GoalFinalPullRequestCandidate,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    number: S.Int.check(S.isGreaterThan(0)),
    state: GoalFinalPullRequestState,
    headRefName: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("GoalFinalPullRequestCandidate", {
      description: "A pull request number, state and head branch read for the goal closeout bind writer.",
    })
  )
) {}

/**
 * Operations of {@link GoalFinalPullRequestResolver}.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalFinalPullRequestResolverShape = {
  /** The checked-out branch's pull request under `root`, or `None` when gh finds none or cannot be read. */
  readonly forBranch: (root: string) => Effect.Effect<O.Option<GoalFinalPullRequestCandidate>>;
  /** Pull request `number` in the repository under `root`, or `None` when gh finds none or cannot be read. */
  readonly byNumber: (root: string, number: number) => Effect.Effect<O.Option<GoalFinalPullRequestCandidate>>;
};

const GH_PR_VIEW_FIELDS = "number,state,headRefName";

const decodeCandidate = S.decodeUnknownOption(S.fromJsonString(GoalFinalPullRequestCandidate));
const decodeCandidateFields = S.decodeUnknownOption(GoalFinalPullRequestCandidate);

// `gh pr view`'s GraphQL state from the REST record: GitHub's REST `closed` covers a merge.
const candidateFromPull = (pull: PullRequestInfo): O.Option<GoalFinalPullRequestCandidate> =>
  decodeCandidateFields({
    number: pull.number,
    state: pull.merged ? "MERGED" : pull.state === "open" ? "OPEN" : "CLOSED",
    headRefName: pull.head,
  });

const makeGoalFinalPullRequestResolver: Effect.Effect<
  GoalFinalPullRequestResolverShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> = Effect.map(Effect.context<ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom>(), (context) => {
  const forBranch = (root: string) =>
    // KEEP (D-22): the branch's pull request in any state; the kit only has `openPullRequestForBranch`, and
    // `PullRequest.list` filters one state per read.
    // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-22), reason above
    ghOutput({
      args: ["pr", "view", "--json", GH_PR_VIEW_FIELDS],
      cwd: root,
      label: "gh pr view",
      onFailure: identity,
    }).pipe(Effect.map(decodeCandidate), Effect.orElseSucceed(O.none), Effect.provideContext(context));
  // `PullRequest.get` (`GET /repos/{owner}/{repo}/pulls/{n}`, W8, SPEC D-22) on the `gh` login and the
  // checkout's repository; any token, repository, transport or decode failure is `None`, as gh's was.
  const byNumber = (root: string, number: number) =>
    Layer.build(layerWorktreeGithub(root)).pipe(
      Effect.flatMap((services) =>
        Effect.provideContext(
          PullRequest.use((pulls) => pulls.get(number)),
          services
        )
      ),
      Effect.scoped,
      Effect.map(candidateFromPull),
      Effect.orElseSucceed(O.none<GoalFinalPullRequestCandidate>),
      Effect.provideContext(context)
    );
  return {
    forBranch: Effect.fn("GoalFinalPullRequestResolver.forBranch")(forBranch),
    byNumber: Effect.fn("GoalFinalPullRequestResolver.byNumber")(byNumber),
  };
});

const candidateAt = (candidates: ReadonlyArray<GoalFinalPullRequestCandidate>, number: number) =>
  A.findFirst(candidates, (candidate) => candidate.number === number);

/**
 * Reads the pull request a goal closeout binds as its final.
 *
 * **Details**
 *
 * `layer` runs `gh pr view [n] --json number,state,headRefName` in the
 * repository root. `layerTest(candidates)` never spawns: `forBranch`
 * returns the first candidate (the checked-out branch's pull request), and
 * `byNumber` finds any candidate by number. An empty list models a branch
 * with no pull request.
 *
 * **Example** (Build a fixture resolver for the branch's pull request)
 *
 * ```ts
 * import {
 *   GoalFinalPullRequestCandidate,
 *   GoalFinalPullRequestResolver,
 * } from "@beep/repo-cli/commands/Goals/FinalPullRequest"
 * import * as Layer from "effect/Layer";
 *
 * const fixture = GoalFinalPullRequestResolver.layerTest([
 *   GoalFinalPullRequestCandidate.make({ number: 7, state: "OPEN", headRefName: "feat/demo" }),
 * ])
 * console.log(Layer.isLayer(fixture)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalFinalPullRequestResolver extends Context.Service<
  GoalFinalPullRequestResolver,
  GoalFinalPullRequestResolverShape
>()($I`GoalFinalPullRequestResolver`, { make: makeGoalFinalPullRequestResolver }) {
  /** Live resolver over `gh pr view`. */
  static readonly layer: Layer.Layer<
    GoalFinalPullRequestResolver,
    never,
    ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
  > = Layer.effect(GoalFinalPullRequestResolver, GoalFinalPullRequestResolver.make);

  /** Fixture resolver: the first candidate is the branch's pull request; `byNumber` searches them all. */
  static readonly layerTest = (
    candidates: ReadonlyArray<GoalFinalPullRequestCandidate>
  ): Layer.Layer<GoalFinalPullRequestResolver> =>
    Layer.succeed(GoalFinalPullRequestResolver, {
      forBranch: Effect.fn("GoalFinalPullRequestResolver.forBranch")(() => Effect.succeed(A.head(candidates))),
      byNumber: Effect.fn("GoalFinalPullRequestResolver.byNumber")((_root: string, number: number) =>
        Effect.succeed(candidateAt(candidates, number))
      ),
    });
}

/**
 * The provided {@link GoalFinalPullRequestResolver}, or the live one when none is provided.
 *
 * **Details**
 *
 * `goals set-status` runs under the CLI runtime, which provides no resolver,
 * so it reads gh. A test provides `GoalFinalPullRequestResolver.layerTest`
 * around the command and the writer uses that instead.
 *
 * **Example** (Read one pull request through whichever resolver is in scope)
 *
 * ```ts
 * import { goalFinalPullRequestResolver } from "@beep/repo-cli/commands/Goals/FinalPullRequest"
 * import * as Effect from "effect/Effect";
 *
 * const program = goalFinalPullRequestResolver().pipe(Effect.flatMap((resolver) => resolver.byNumber(".", 7)))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @returns The resolver to read final pull request candidates with.
 * @category services
 * @since 0.0.0
 */
export const goalFinalPullRequestResolver = Effect.fn("Goals.goalFinalPullRequestResolver")(function* () {
  const supplied = yield* Effect.serviceOption(GoalFinalPullRequestResolver);
  if (O.isSome(supplied)) return supplied.value;
  return yield* GoalFinalPullRequestResolver.make;
});
