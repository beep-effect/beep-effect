/**
 * The base a check.yml coverage lane diffs against, resolved from the workflow
 * event and the checkout.
 *
 * **Details**
 *
 * A pull-request job checks out the synthetic merge commit GitHub created for
 * the run (`GITHUB_SHA`, fetched by its exact sha). Its first parent is the
 * base-branch commit the pull request was merged into, so `<first parent>...HEAD`
 * is the pull request's own change set. `pull_request.base.sha` is not: GitHub
 * records it from the pull request, and when the base branch moves between that
 * record and the merge, the commits in between count as the pull request's own
 * changes (PR #3228's run 43386625727 diffed 49 files against it instead of 10,
 * and its global-input changes forced the full Test Unit matrix).
 *
 * `GITHUB_SHA` and the event payload are fixed for every job of a run and for
 * every re-run attempt, so every coverage producer and the comparator resolve
 * one base. The first parent is used only after proving HEAD is that merge:
 * HEAD is `GITHUB_SHA`, it has exactly two parents, and the second is
 * `pull_request.head.sha`. When the proof fails the base stays
 * `pull_request.base.sha`, the pre-existing behaviour: it is an ancestor of the
 * merged base commit, so it selects at least the pull request's own scope and
 * can only cost runner time. A pull request with neither is refused rather than
 * diffed against itself.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { configStringOption } from "@beep/repo-cli-kit/cli/EnvConfig";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";

const $I = $RepoCliId.create("commands/Ci/CiEventBase");

const PULL_REQUEST_EVENT = "pull_request";

/**
 * The base `beep ci lane` uses when neither `--base` nor `--event-base` is given.
 *
 * **Example** (Read the default lane base)
 *
 * ```ts
 * import { CI_LANE_DEFAULT_BASE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_LANE_DEFAULT_BASE) // "origin/main"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_LANE_DEFAULT_BASE = "origin/main";

/**
 * The workflow event and checkout facts a lane base is resolved from.
 *
 * **Details**
 *
 * The event facts come from `GITHUB_EVENT_NAME`, `GITHUB_SHA`,
 * `BEEP_CI_PR_BASE_SHA` (`pull_request.base.sha`) and `BEEP_CI_PR_HEAD_SHA`
 * (`pull_request.head.sha`); an unset or empty variable is `None`. The checkout
 * facts are HEAD and its parents, of which at most three are read: enough to
 * tell a two-parent merge from anything else.
 *
 * **Example** (Describe a pull-request merge checkout)
 *
 * ```ts
 * import { CiEventBaseFacts } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const facts = CiEventBaseFacts.make({
 *   eventName: O.some("pull_request"),
 *   eventSha: O.some("merge"),
 *   eventBaseSha: O.some("stale-base"),
 *   eventHeadSha: O.some("head"),
 *   checkoutSha: "merge",
 *   checkoutParents: ["base", "head"],
 * })
 * console.log(facts.checkoutParents.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEventBaseFacts extends S.Opaque<CiEventBaseFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    eventName: S.Option(S.String),
    eventSha: S.Option(S.String),
    eventBaseSha: S.Option(S.String),
    eventHeadSha: S.Option(S.String),
    checkoutSha: S.String,
    checkoutParents: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("CiEventBaseFacts", {
      description: "Workflow event shas and the checked-out commit with its parents, read once per lane invocation.",
    })
  )
) {}

/**
 * A pull-request base proven to be the first parent of the run's merge commit.
 *
 * **Example** (Build a merge first-parent base)
 *
 * ```ts
 * import { CiEventBaseMergeFirstParent } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const base = CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.some("stale-base") })
 * console.log(base._tag) // "merge-first-parent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEventBaseMergeFirstParent extends S.Opaque<
  CiEventBaseMergeFirstParent,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("merge-first-parent", { sha: S.String, eventBaseSha: S.Option(S.String) }).pipe(
    $I.annoteSchema("CiEventBaseMergeFirstParent", {
      description: "The verified merge commit's first parent, with the event base sha it replaced.",
    })
  )
) {}

/**
 * A pull-request base kept at `pull_request.base.sha` because HEAD is not the
 * run's verified merge commit.
 *
 * **Example** (Build an event base fallback)
 *
 * ```ts
 * import { CiEventBasePullRequestBase } from "@beep/repo-cli/commands/Ci"
 *
 * const base = CiEventBasePullRequestBase.make({ sha: "stale-base", gap: "HEAD has 1 parent(s)" })
 * console.log(base._tag) // "pull-request-base"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEventBasePullRequestBase extends S.Opaque<
  CiEventBasePullRequestBase,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("pull-request-base", { sha: S.String, gap: S.String }).pipe(
    $I.annoteSchema("CiEventBasePullRequestBase", {
      description: "The event's pull_request.base.sha, with the reason the merge-commit proof failed.",
    })
  )
) {}

/**
 * The base of a run that is not a pull request: its own `GITHUB_SHA`.
 *
 * **Example** (Build a push base)
 *
 * ```ts
 * import { CiEventBaseEventCommit } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiEventBaseEventCommit.make({ sha: "pushed" })._tag) // "event-commit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEventBaseEventCommit extends S.Opaque<CiEventBaseEventCommit, { readonly brand: unique symbol }>()(
  S.TaggedStruct("event-commit", { sha: S.String }).pipe(
    $I.annoteSchema("CiEventBaseEventCommit", { description: "GITHUB_SHA of a push or other non-pull-request event." })
  )
) {}

/**
 * The resolved lane base and how it was chosen.
 *
 * **Example** (Match a resolved base)
 *
 * ```ts
 * import { CiEventBase, CiEventBaseEventCommit } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiEventBase.guards["event-commit"](CiEventBaseEventCommit.make({ sha: "pushed" }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CiEventBase = S.Union([
  CiEventBaseMergeFirstParent,
  CiEventBasePullRequestBase,
  CiEventBaseEventCommit,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CiEventBase", {
    description: "A merge commit's first parent, the event base fallback, or a non-pull-request event's own commit.",
  })
);

/**
 * The resolved lane base and how it was chosen.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CiEventBase = typeof CiEventBase.Type;

const isMergeParents = S.is(S.Tuple([S.String, S.String]));

const shown = (value: O.Option<string>): string => O.getOrElse(value, () => "(unset)");

// HEAD is the run's own merge commit when it is GITHUB_SHA and has exactly two
// parents, the second the pull request head; the first is then the merged base.
const provenMergeFirstParent = (facts: CiEventBaseFacts): Result.Result<string, string> => {
  if (!O.contains(facts.eventSha, facts.checkoutSha)) {
    return Result.fail(`HEAD ${facts.checkoutSha} is not GITHUB_SHA ${shown(facts.eventSha)}`);
  }
  if (!isMergeParents(facts.checkoutParents)) {
    return Result.fail(`HEAD has ${A.length(facts.checkoutParents)} parent(s), not the two of a merge commit`);
  }
  const [first, second] = facts.checkoutParents;
  return O.contains(facts.eventHeadSha, second)
    ? Result.succeed(first)
    : Result.fail(`HEAD's second parent ${second} is not pull_request.head.sha ${shown(facts.eventHeadSha)}`);
};

/**
 * Resolve the lane base from event and checkout facts.
 *
 * **Details**
 *
 * A non-pull-request event uses its own `GITHUB_SHA` and fails without one. A
 * pull request uses the first parent of the verified merge commit, falls back
 * to `pull_request.base.sha` when the proof fails, and fails when that is unset
 * too: diffing a pull request against itself would select nothing.
 *
 * **Example** (Diff a pull request against its merge commit's first parent)
 *
 * ```ts
 * import { CiEventBaseFacts, resolveCiEventBase } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const facts = CiEventBaseFacts.make({
 *   eventName: O.some("pull_request"),
 *   eventSha: O.some("merge"),
 *   eventBaseSha: O.some("stale-base"),
 *   eventHeadSha: O.some("head"),
 *   checkoutSha: "merge",
 *   checkoutParents: ["base", "head"],
 * })
 * console.log(Effect.runSync(resolveCiEventBase(facts)).sha) // "base"
 * ```
 *
 * @param facts - Event and checkout facts read for this invocation.
 * @returns The resolved base, tagged with how it was chosen.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCiEventBase = Effect.fn("CiEventBase.resolve")(function* (
  facts: CiEventBaseFacts
): Effect.fn.Return<CiEventBase, CiCommandError> {
  if (!O.contains(facts.eventName, PULL_REQUEST_EVENT)) {
    return yield* O.match(facts.eventSha, {
      onNone: () =>
        Effect.fail(
          CiCommandError.make({ message: "--event-base needs GITHUB_SHA outside a pull_request event; pass --base." })
        ),
      onSome: (sha) => Effect.succeed(CiEventBaseEventCommit.make({ sha })),
    });
  }
  return yield* Result.match(provenMergeFirstParent(facts), {
    onSuccess: (sha) => Effect.succeed(CiEventBaseMergeFirstParent.make({ sha, eventBaseSha: facts.eventBaseSha })),
    onFailure: (gap) =>
      O.match(facts.eventBaseSha, {
        onNone: () =>
          Effect.fail(
            CiCommandError.make({
              message: `--event-base cannot prove a pull-request base: ${gap}, and pull_request.base.sha is unset.`,
            })
          ),
        onSome: (sha) => Effect.succeed(CiEventBasePullRequestBase.make({ sha, gap })),
      }),
  });
});

/**
 * Render the one log line that records which base a lane used and why.
 *
 * **Example** (Render a stale event base)
 *
 * ```ts
 * import { CiEventBaseMergeFirstParent, renderCiEventBase } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * console.log(renderCiEventBase(CiEventBaseMergeFirstParent.make({ sha: "base", eventBaseSha: O.some("old") })))
 * // [ci] base base: first parent of the pull request merge commit; pull_request.base.sha old differs
 * ```
 *
 * @param base - The resolved base.
 * @returns A `[ci]` log line naming the base and its source.
 * @category formatting
 * @since 0.0.0
 */
export const renderCiEventBase = (base: CiEventBase): string =>
  `[ci] base ${base.sha}: ${CiEventBase.match(base, {
    "merge-first-parent": ({ sha, eventBaseSha }) =>
      `first parent of the pull request merge commit; pull_request.base.sha ${O.match(eventBaseSha, {
        onNone: () => "is unset",
        onSome: (eventBase) => (eventBase === sha ? `${eventBase} is the same commit` : `${eventBase} differs`),
      })}`,
    "pull-request-base": ({ gap }) => `pull_request.base.sha, because ${gap}`,
    "event-commit": () => "GITHUB_SHA of a non-pull-request event",
  })}`;

const readEventValue = (name: string) => Effect.map(configStringOption(name), O.filter(Str.isNonEmpty));

/**
 * Read the event facts from the environment and the checkout facts from git.
 *
 * **Example** (Read facts for the current checkout)
 *
 * ```ts
 * import { readCiEventBaseFacts } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readCiEventBaseFacts("/repo"))) // true
 * ```
 *
 * @param repoRoot - Repository root of the checkout.
 * @returns The facts {@link resolveCiEventBase} decides from.
 * @category use-cases
 * @since 0.0.0
 */
export const readCiEventBaseFacts = Effect.fn("CiEventBase.readFacts")(function* (repoRoot: string) {
  const git = yield* Git;
  const commit = (ref: string) =>
    git
      .revParse(repoRoot, ref, { peel: "commit", quiet: true })
      .pipe(CiCommandError.mapError(`--event-base could not resolve ${ref} in ${repoRoot}.`));
  // A parent git cannot name does not exist: `HEAD^3` of a two-parent merge.
  const parent = (index: number) =>
    git.revParse(repoRoot, `HEAD^${index}`, { peel: "commit", quiet: true }).pipe(
      Effect.asSome,
      Effect.catchTag("UnknownRefError", () => Effect.succeedNone),
      CiCommandError.mapError(`--event-base could not read parent ${index} of HEAD in ${repoRoot}.`)
    );
  const parents = yield* Effect.forEach([1, 2, 3], parent);
  return CiEventBaseFacts.make({
    eventName: yield* readEventValue("GITHUB_EVENT_NAME"),
    eventSha: yield* readEventValue("GITHUB_SHA"),
    eventBaseSha: yield* readEventValue("BEEP_CI_PR_BASE_SHA"),
    eventHeadSha: yield* readEventValue("BEEP_CI_PR_HEAD_SHA"),
    checkoutSha: yield* commit("HEAD"),
    checkoutParents: A.getSomes(parents),
  });
});

/**
 * Resolve, log and return the event base of the checkout at `repoRoot`.
 *
 * **Example** (Resolve the base for a checkout)
 *
 * ```ts
 * import { resolveCiEventBaseAt } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveCiEventBaseAt("/repo"))) // true
 * ```
 *
 * @param repoRoot - Repository root of the checkout.
 * @returns The resolved base.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCiEventBaseAt = Effect.fn("CiEventBase.resolveAt")(function* (repoRoot: string) {
  const facts = yield* readCiEventBaseFacts(repoRoot);
  const base = yield* resolveCiEventBase(facts);
  yield* Console.log(renderCiEventBase(base));
  return base;
});

/**
 * Choose the base `beep ci lane` runs with from its `--base` and `--event-base` flags.
 *
 * **Details**
 *
 * Without `--event-base` this is `--base`, or {@link CI_LANE_DEFAULT_BASE}.
 * With it the base is resolved from the workflow event, and an explicit
 * `--base` is refused instead of silently replaced.
 *
 * **Example** (Keep an explicit base)
 *
 * ```ts
 * import { resolveCiLaneBase } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(resolveCiLaneBase(O.some("origin/main"), false))) // true
 * ```
 *
 * @param base - The `--base` flag, if given.
 * @param eventBase - Whether `--event-base` was given.
 * @returns The base sha or ref the lane diffs against.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCiLaneBase = Effect.fn("CiEventBase.resolveLaneBase")(function* (
  base: O.Option<string>,
  eventBase: boolean
) {
  if (!eventBase) return O.getOrElse(base, () => CI_LANE_DEFAULT_BASE);
  if (O.isSome(base)) {
    return yield* CiCommandError.make({
      message: "--event-base resolves the base from the workflow event; it cannot be combined with --base.",
    });
  }
  const repoRoot = yield* findRepoRoot().pipe(CiCommandError.mapError("Failed to locate repository root."));
  const resolved = yield* resolveCiEventBaseAt(repoRoot);
  return resolved.sha;
});
