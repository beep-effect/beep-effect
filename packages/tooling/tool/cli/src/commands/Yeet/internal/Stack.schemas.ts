/**
 * Schemas for two-layer native GitHub stacks in Yeet.
 *
 * **Details**
 *
 * A native stack chains pull requests base to head on one trunk. Yeet supports
 * two layers: a parent on the trunk and one layer on the parent's branch. These
 * schemas name the three decisions that make that safe: whether a lane may
 * publish a layer on a parent, what one merge request from a pull request would
 * merge, and whether the trunk's required checks are green enough to open a
 * stack at all.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { GithubPullRequestRecord } from "../../../internal/github/GithubRest.ts";
import { MergeGateCheckRun } from "./MergeGate.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Stack");

/**
 * The most layers a routine stack may hold open at once.
 *
 * **Details**
 *
 * Every layer is an ordinary pull request for CI and runs the full matrix
 * again after a cascade, so landing `n` layers bottom-up costs `n(n+1)/2`
 * runs (decision `2026-11-10-two-layer-cap`).
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { YEET_STACK_LAYER_CAP } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_STACK_LAYER_CAP) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_STACK_LAYER_CAP = 2;

/**
 * Whether the trunk's required checks are green.
 *
 * **Details**
 *
 * A stack is opened only on a green trunk, because a bypass reaches only the
 * lowest layer and a red trunk lands a stack bottom-up with one cascade per
 * layer (decision `2026-11-10-stack-only-on-green-main`).
 *
 * - `Green`: every required context's newest completed run on the trunk
 *   passed; `sha` is the trunk head that was read.
 * - `Red`: at least one required context's newest completed run failed;
 *   `contexts` names them.
 * - `Unknown`: the read failed, or a required context has no completed run
 *   within the commits that were read. Unknown never opens a stack.
 *
 * **Example** (A red trunk)
 *
 * ```ts
 * import { YeetTrunkHealth } from "@beep/repo-cli/test/Yeet"
 *
 * const health = YeetTrunkHealth.cases.Red.make({ sha: "abc", contexts: ["Test Unit"] })
 * console.log(YeetTrunkHealth.guards.Red(health)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetTrunkHealth = S.TaggedUnion({
  Green: { sha: S.NonEmptyString },
  Red: { sha: S.NonEmptyString, contexts: S.Array(S.NonEmptyString) },
  Unknown: { detail: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("YeetTrunkHealth", {
    description: "Whether the trunk's required checks are green: green, red with the failing contexts, or unknown.",
  })
);

/**
 * Whether the trunk's required checks are green.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetTrunkHealth = typeof YeetTrunkHealth.Type;

/**
 * The check runs read on one trunk commit, newest commit first when listed.
 *
 * **Example** (One commit's runs)
 *
 * ```ts
 * import { MergeGateCheckRun, YeetTrunkCommitChecks } from "@beep/repo-cli/test/Yeet"
 *
 * const commit = YeetTrunkCommitChecks.make({
 *   sha: "abc",
 *   runs: [MergeGateCheckRun.make({ id: 1, name: "Lint", status: "completed", conclusion: "success" })],
 * })
 * console.log(commit.runs.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetTrunkCommitChecks extends S.Opaque<YeetTrunkCommitChecks, { readonly brand: unique symbol }>()(
  S.Struct({ sha: S.NonEmptyString, runs: S.Array(MergeGateCheckRun) }).pipe(
    $I.annoteSchema("YeetTrunkCommitChecks", { description: "The check runs read on one trunk commit." })
  )
) {}

/**
 * Why a lane may not publish a layer on the parent it named.
 *
 * **Details**
 *
 * - `parent-is-self`: the parent pull request is this branch's own.
 * - `parent-not-open`: the parent merged or closed; publish on the trunk.
 * - `parent-off-trunk`: the parent's base is not the trunk, so this layer
 *   would be a third.
 * - `parent-stacked`: the parent is already in a stack this layer is not
 *   part of.
 * - `existing-base-mismatch`: this branch already has an open pull request on
 *   another base; Yeet does not retarget.
 * - `stack-mismatch`: this branch's pull request is in a different stack.
 * - `not-built-on-parent`: the parent's head is not an ancestor of `HEAD`.
 * - `trunk-red`, `trunk-unknown`: the trunk's required checks are not known
 *   to be green.
 *
 * **Example** (Narrow a refusal)
 *
 * ```ts
 * import { YeetStackPublishRefusal } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetStackPublishRefusal.is["trunk-red"]("trunk-red")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStackPublishRefusal = LiteralKit([
  "parent-is-self",
  "parent-not-open",
  "parent-off-trunk",
  "parent-stacked",
  "existing-base-mismatch",
  "stack-mismatch",
  "not-built-on-parent",
  "trunk-red",
  "trunk-unknown",
]).pipe($I.annoteSchema("YeetStackPublishRefusal", { description: "Why a lane may not publish a layer on a parent." }));

/**
 * Why a lane may not publish a layer on the parent it named.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackPublishRefusal = typeof YeetStackPublishRefusal.Type;

/**
 * What Yeet knows when a lane asks to publish its branch as a layer on a parent.
 *
 * **Details**
 *
 * `existing` is this branch's open pull request, when it already has one: a
 * later publish of the same layer, or a link that failed after the create.
 * `builtOnParent` says the parent's head is an ancestor of `HEAD`. `trunkHealth`
 * is read only before a new layer is created; an existing layer's stack is
 * already open, so it is none there.
 *
 * **Example** (Reference the facts)
 *
 * ```ts
 * import { YeetStackPublishFacts } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetStackPublishFacts.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStackPublishFacts extends S.Opaque<YeetStackPublishFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    branch: S.NonEmptyString,
    trunk: S.NonEmptyString,
    parent: GithubPullRequestRecord,
    existing: S.Option(GithubPullRequestRecord),
    builtOnParent: S.Boolean,
    trunkHealth: S.Option(YeetTrunkHealth),
  }).pipe(
    $I.annoteSchema("YeetStackPublishFacts", {
      description: "The parent, this branch's own pull request, ancestry and trunk health a layer publish decides on.",
    })
  )
) {}

/**
 * Whether a lane may publish its branch as a layer on a parent, and how.
 *
 * **Details**
 *
 * - `Layer`: publish on the parent's branch. `stackNumber` is some when both
 *   pull requests are already linked, so nothing is linked again. `parentMoved`
 *   is true when an existing layer no longer contains the parent's head: the
 *   publish goes on, and the merge gate holds until the lane merges the
 *   parent's branch.
 * - `Refused`: nothing is committed, pushed or created.
 *
 * **Example** (A refusal)
 *
 * ```ts
 * import { YeetStackPublishDecision } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = YeetStackPublishDecision.cases.Refused.make({
 *   reason: "parent-not-open",
 *   detail: "#41 is merged",
 * })
 * console.log(decision._tag) // "Refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStackPublishDecision = S.TaggedUnion({
  Layer: {
    parentNumber: S.Int,
    parentHeadRef: S.NonEmptyString,
    parentHeadSha: S.NonEmptyString,
    trunk: S.NonEmptyString,
    stackNumber: S.Option(S.Int),
    parentMoved: S.Boolean,
  },
  Refused: { reason: YeetStackPublishRefusal, detail: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("YeetStackPublishDecision", {
    description: "Publish this branch as a layer on a parent pull request, or refuse with the reason.",
  })
);

/**
 * Whether a lane may publish its branch as a layer on a parent, and how.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackPublishDecision = typeof YeetStackPublishDecision.Type;

/**
 * One open layer of a stack, pinned to the head GitHub listed for it.
 *
 * **Example** (The lower layer)
 *
 * ```ts
 * import { YeetStackLayer } from "@beep/repo-cli/test/Yeet"
 *
 * const lower = YeetStackLayer.make({ number: 41, position: 1, headRef: "feat/parent", headSha: "abc" })
 * console.log(lower.position) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStackLayer extends S.Opaque<YeetStackLayer, { readonly brand: unique symbol }>()(
  S.Struct({
    number: S.Int,
    position: S.Int,
    headRef: S.NonEmptyString,
    headSha: S.NonEmptyString,
  }).pipe($I.annoteSchema("YeetStackLayer", { description: "One open layer of a stack at its listed head." }))
) {}

/**
 * What one merge request for a pull request would merge.
 *
 * **Details**
 *
 * `PUT pulls/{n}/merge-async` on a stacked pull request merges every open
 * layer below it in the same push, so the gate has to know the scope before
 * it decides.
 *
 * - `Single`: only this pull request. It is outside a stack, or it is the
 *   last open layer of one.
 * - `Group`: this pull request and the one open layer below it. Both are
 *   gated and one request merges both.
 * - `BelowTop`: an open layer sits above this pull request. Merging it alone
 *   makes GitHub force-push the layer above onto the trunk, so the gate holds
 *   unless the caller asks for this layer alone.
 * - `TooDeep`: more open layers than {@link YEET_STACK_LAYER_CAP} would merge
 *   or strand. The gate holds.
 * - `Unknown`: the stack GitHub returned does not list this pull request, so
 *   the scope cannot be trusted. The gate holds.
 *
 * **Example** (A pull request outside a stack)
 *
 * ```ts
 * import { YeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * const scope = YeetStackMergeScope.cases.Single.make({})
 * console.log(scope._tag) // "Single"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStackMergeScope = S.TaggedUnion({
  Single: {},
  Group: { stackNumber: S.Int, trunk: S.NonEmptyString, lower: YeetStackLayer, top: YeetStackLayer },
  BelowTop: { stackNumber: S.Int, upper: YeetStackLayer },
  TooDeep: { stackNumber: S.Int, openLayers: S.Int },
  Unknown: { stackNumber: S.Int, detail: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("YeetStackMergeScope", {
    description:
      "What one merge request would merge: one pull request, a two-layer group, or a layout the gate holds on.",
  })
);

/**
 * What one merge request for a pull request would merge.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackMergeScope = typeof YeetStackMergeScope.Type;
