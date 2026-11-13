/**
 * The merge side of two-layer native GitHub stacks in Yeet.
 *
 * **Details**
 *
 * `PUT pulls/{top}/merge-async` merges every open layer below the top in one
 * push, so the merge gate first decides what a request would merge
 * ({@link decideYeetStackGate}): one pull request, a two-layer group gated
 * layer by layer, or a layout it refuses. The group also needs the top built on
 * the lower layer's head ({@link readYeetStackContainment}) and, after the
 * merge, the lower layer read back merged with its own squash commit
 * ({@link yeetStackLowerMergeCommit}). The ungated merge paths (`yeet merge`,
 * `yeet gh merge`, the owner checkpoint) refuse anything but a single pull
 * request ({@link readYeetStackUngatedRefusal}). Nothing here merges; the
 * merge gate composes these.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubRest } from "../../../internal/github/GithubRest.ts";
import { YEET_STACK_LAYER_CAP, YeetStackMergeScope } from "./Stack.schemas.ts";
import { readYeetStackMergeScope } from "./Stack.ts";
import type { GithubPullRequestRecord } from "../../../internal/github/GithubRest.ts";
import type { YeetStackLayer } from "./Stack.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/StackGate");

const sha10 = Str.slice(0, 10);

/**
 * Why the merge gate holds on a stack layout before it decides any layer.
 *
 * **Details**
 *
 * - `stack-unknown`: the stack read failed, the stack does not list the pull
 *   request, or whether the top contains the lower layer could not be read.
 * - `stack-too-deep`: more open layers than a stack merge may land.
 * - `stack-below-top`: an open layer sits above the gated pull request.
 * - `stack-relaxed`: `--relaxed` on a group, where a bypass reaches only the
 *   lowest layer.
 * - `stack-out-of-date`: the top does not contain the lower layer's head.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { YeetStackGateHoldReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetStackGateHoldReason.is["stack-below-top"]("stack-below-top")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStackGateHoldReason = LiteralKit([
  "stack-unknown",
  "stack-too-deep",
  "stack-below-top",
  "stack-relaxed",
  "stack-out-of-date",
]).pipe(
  $I.annoteSchema("YeetStackGateHoldReason", {
    description: "Why the merge gate holds on a stack layout before it decides any layer.",
  })
);

/**
 * Why the merge gate holds on a stack layout before it decides any layer.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackGateHoldReason = typeof YeetStackGateHoldReason.Type;

/**
 * The gate refuses the stack layout: nothing is decided or merged.
 *
 * **Example** (A refusal)
 *
 * ```ts
 * import { YeetStackGateRefused } from "@beep/repo-cli/test/Yeet"
 *
 * const refused = YeetStackGateRefused.make({ reason: "stack-too-deep", detail: "stack #43 has 3 open layers" })
 * console.log(refused._tag) // "Refused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStackGateRefused extends S.Opaque<YeetStackGateRefused, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Refused", { reason: YeetStackGateHoldReason, detail: S.NonEmptyString }).pipe(
    $I.annoteSchema("YeetStackGateRefused", { description: "The merge gate refuses a stack layout." })
  )
) {}

/**
 * How the merge gate proceeds once it knows a pull request's merge scope.
 *
 * **Details**
 *
 * - `Single`: gate and merge the one pull request, as for any other.
 * - `Group`: gate both layers, then merge both with one request on the top.
 * - `Refused`: hold with the reason before any layer is decided.
 *
 * **Example** (A pull request outside a stack)
 *
 * ```ts
 * import { YeetStackGatePlan, YeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetStackGatePlan.guards.Single(YeetStackMergeScope.cases.Single.make({}))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetStackGatePlan = S.Union([
  YeetStackMergeScope.cases.Single,
  YeetStackMergeScope.cases.Group,
  YeetStackGateRefused,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetStackGatePlan", {
    description: "Gate one pull request, gate a two-layer group, or refuse the stack layout.",
  })
);

/**
 * How the merge gate proceeds once it knows a pull request's merge scope.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackGatePlan = typeof YeetStackGatePlan.Type;

/**
 * A two-layer group: the top pull request and the one open layer below it.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetStackGroup = typeof YeetStackMergeScope.cases.Group.Type;

/**
 * What the gate asks of a stack layout: the gated pull request, its merge
 * scope, and the caller's `--alone` and `--relaxed`.
 *
 * **Example** (A lower layer landed alone)
 *
 * ```ts
 * import { YeetStackGateInput, YeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * const input = YeetStackGateInput.make({
 *   prNumber: 41,
 *   scope: YeetStackMergeScope.cases.Single.make({}),
 *   alone: true,
 *   relaxed: false,
 * })
 * console.log(input.alone) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStackGateInput extends S.Opaque<YeetStackGateInput, { readonly brand: unique symbol }>()(
  S.Struct({ prNumber: S.Int, scope: YeetStackMergeScope, alone: S.Boolean, relaxed: S.Boolean }).pipe(
    $I.annoteSchema("YeetStackGateInput", {
      description: "The gated pull request, its merge scope, and the caller's --alone and --relaxed.",
    })
  )
) {}

const refused = (reason: YeetStackGateHoldReason, detail: string): YeetStackGateRefused =>
  YeetStackGateRefused.make({ reason, detail });

const unknownScopeDetail = (detail: string): string =>
  `${detail}; the gate never merges a stacked pull request whose merge scope is unknown`;

const tooDeepDetail = (stackNumber: number, openLayers: number): string =>
  `stack #${stackNumber} has ${openLayers} open layers; one merge lands ${YEET_STACK_LAYER_CAP} at most`;

const unreadableStackDetail = (pull: GithubPullRequestRecord, message: string): string =>
  `stack #${O.match(pull.stack, { onNone: () => "?", onSome: (stack) => `${stack.number}` })} unreadable for #${pull.number} (${message}); a failed stack read never reads as a single pull request`;

/**
 * Decide how the merge gate proceeds for a pull request's merge scope.
 *
 * **Details**
 *
 * `Single` proceeds as it always has. `Unknown` and `TooDeep` refuse.
 * `BelowTop` refuses unless the caller passed `--alone`, which lands this
 * layer by itself and lets GitHub force-push the layer above onto the trunk.
 * `Group` refuses `--relaxed`, because a rules bypass reaches only the lowest
 * layer, and otherwise gates both layers. `--alone` changes nothing on the top
 * of a group: a merge request there always lands the layer below it.
 *
 * **Example** (A layer with an open layer above it)
 *
 * ```ts
 * import { decideYeetStackGate, YeetStackGateInput, YeetStackLayer, YeetStackMergeScope } from "@beep/repo-cli/test/Yeet"
 *
 * const scope = YeetStackMergeScope.cases.BelowTop.make({
 *   stackNumber: 43,
 *   upper: YeetStackLayer.make({ number: 42, position: 2, headRef: "feat/child", headSha: "abc" }),
 * })
 * const plan = decideYeetStackGate(YeetStackGateInput.make({ prNumber: 41, scope, alone: false, relaxed: false }))
 * console.log(plan._tag) // "Refused"
 * ```
 *
 * @param input - The gated pull request, its scope and the caller's flags.
 * @returns Gate one pull request, gate a group, or refuse.
 * @category decisions
 * @since 0.0.0
 */
export const decideYeetStackGate = ({ prNumber, scope, alone, relaxed }: YeetStackGateInput): YeetStackGatePlan =>
  YeetStackMergeScope.match(scope, {
    Single: (single): YeetStackGatePlan => single,
    Unknown: ({ detail }) => refused("stack-unknown", unknownScopeDetail(detail)),
    TooDeep: ({ stackNumber, openLayers }) => refused("stack-too-deep", tooDeepDetail(stackNumber, openLayers)),
    BelowTop: ({ stackNumber, upper }): YeetStackGatePlan =>
      alone
        ? YeetStackMergeScope.cases.Single.make({})
        : refused(
            "stack-below-top",
            `#${prNumber} has open layer #${upper.number} above it in stack #${stackNumber}; merge from the top with \`bun run beep yeet merge-gate ${upper.number} <sha>\`, or pass --alone to land this layer by itself (GitHub then force-pushes #${upper.number} onto the trunk)`
          ),
    Group: (group): YeetStackGatePlan =>
      relaxed
        ? refused(
            "stack-relaxed",
            `--relaxed on #${group.top.number} would merge #${group.lower.number} with it in stack #${group.stackNumber}; bypass reaches only the lowest layer; land the stack bottom-up with --alone, or wait for green`
          )
        : group,
  });

/**
 * Read a pull request's merge scope and decide how the merge gate proceeds.
 *
 * **Details**
 *
 * A pull request outside a stack costs no request. A stack read that fails
 * refuses as `stack-unknown`: it never reads as a single pull request.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readYeetStackGatePlan } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetStackGatePlan) // "function"
 * ```
 *
 * @param pull - The gated pull request as the gate read it.
 * @param flags - The caller's `--alone` and `--relaxed`.
 * @returns How the gate proceeds.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetStackGatePlan = Effect.fn("Yeet.readStackGatePlan")(function* (
  pull: GithubPullRequestRecord,
  flags: Pick<YeetStackGateInput, "alone" | "relaxed">
): Effect.fn.Return<YeetStackGatePlan, never, GithubRest> {
  return yield* readYeetStackMergeScope(pull).pipe(
    Effect.map((scope) =>
      decideYeetStackGate(
        YeetStackGateInput.make({ prNumber: pull.number, scope, alone: flags.alone, relaxed: flags.relaxed })
      )
    ),
    Effect.catch((error) =>
      Effect.succeed<YeetStackGatePlan>(refused("stack-unknown", unreadableStackDetail(pull, error.message)))
    )
  );
});

/**
 * Read whether the top of a group contains the lower layer's listed head.
 *
 * **Details**
 *
 * One `compare` read, so neither commit has to exist locally. A top that does
 * not contain it refuses as `stack-out-of-date`: the merge would land a lower
 * layer the top was never tested on. A read that fails refuses as
 * `stack-unknown`.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readYeetStackContainment } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetStackContainment) // "function"
 * ```
 *
 * @param group - The group the gate is about to merge.
 * @param topHeadSha - The top's head as the gate read it.
 * @returns None when the top contains the lower head, else the refusal.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetStackContainment = Effect.fn("Yeet.readStackContainment")(function* (
  group: YeetStackGroup,
  topHeadSha: string
): Effect.fn.Return<O.Option<YeetStackGateRefused>, never, GithubRest> {
  const rest = yield* GithubRest;
  const { lower, top } = group;
  return yield* rest.headContains(lower.headSha, topHeadSha).pipe(
    Effect.map((contains) =>
      contains
        ? O.none()
        : O.some(
            refused(
              "stack-out-of-date",
              `#${top.number} does not contain #${lower.number}'s head ${sha10(lower.headSha)}; merge origin/${lower.headRef} into the top lane and push`
            )
          )
    ),
    Effect.catch((error) =>
      Effect.succeedSome(
        refused(
          "stack-unknown",
          `could not read whether #${top.number} contains #${lower.number}'s head ${sha10(lower.headSha)} (${error.message}); an unknown containment never merges`
        )
      )
    )
  );
});

/**
 * One layer a stack merge landed, with its own squash commit.
 *
 * **Example** (The lower layer of a merged stack)
 *
 * ```ts
 * import { YeetStackMergedLayer } from "@beep/repo-cli/test/Yeet"
 *
 * const layer = YeetStackMergedLayer.make({
 *   stackNumber: 43,
 *   position: 1,
 *   prNumber: 41,
 *   mergeSha: "1f562ae3c1",
 *   commitTitle: "docs: lower layer (#41)",
 * })
 * console.log(layer.position) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetStackMergedLayer extends S.Opaque<YeetStackMergedLayer, { readonly brand: unique symbol }>()(
  S.Struct({
    stackNumber: S.Int,
    position: S.Int,
    prNumber: S.Int,
    mergeSha: S.String,
    commitTitle: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("YeetStackMergedLayer", {
      description: "One layer a stack merge landed, with its own squash commit and the title it was gated on.",
    })
  )
) {}

/**
 * The suffix a merged line carries for a stack layer.
 *
 * **Example** (Render the suffix)
 *
 * ```ts
 * import { renderYeetStackLayerSuffix, YeetStackMergedLayer } from "@beep/repo-cli/test/Yeet"
 *
 * const layer = YeetStackMergedLayer.make({
 *   stackNumber: 43,
 *   position: 1,
 *   prNumber: 41,
 *   mergeSha: "1f562ae3c1",
 *   commitTitle: "docs: lower layer (#41)",
 * })
 * console.log(renderYeetStackLayerSuffix(layer)) // " (stack #43, layer 1)"
 * ```
 *
 * @param layer - The merged layer.
 * @returns The suffix, with its leading space.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetStackLayerSuffix = (layer: YeetStackMergedLayer): string =>
  ` (stack #${layer.stackNumber}, layer ${layer.position})`;

/**
 * The lower layer's own squash commit, read back after a stack merge on the top.
 *
 * **Details**
 *
 * The merge poll names the top's commit only; each layer's commit is its own
 * `merge_commit_sha`. A lower layer that does not read merged, or reads merged
 * with no commit, fails with what was observed: the top landed and the stack
 * did not, which nothing may paper over.
 *
 * **Example** (Reference the check)
 *
 * ```ts
 * import { yeetStackLowerMergeCommit } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetStackLowerMergeCommit) // "function"
 * ```
 *
 * @param lower - The lower layer as the gate listed it.
 * @param pull - The lower layer's pull request read after the merge.
 * @returns Its merge commit, or what was observed instead.
 * @category decisions
 * @since 0.0.0
 */
export const yeetStackLowerMergeCommit: {
  (lower: YeetStackLayer, pull: GithubPullRequestRecord): Result.Result<string, string>;
  (pull: GithubPullRequestRecord): (lower: YeetStackLayer) => Result.Result<string, string>;
} = dual(
  2,
  (lower: YeetStackLayer, pull: GithubPullRequestRecord): Result.Result<string, string> =>
    pull.merged
      ? O.match(pull.mergeCommitSha, {
          onNone: () => Result.fail(`#${lower.number} reads merged but GitHub reports no merge commit for it`),
          onSome: Result.succeed,
        })
      : Result.fail(`#${lower.number} reads state ${pull.state}, merged=false, after the stack merge`)
);

/**
 * The warning a stack merge prints when the lower layer merged at a head other
 * than the one the gate read.
 *
 * **Details**
 *
 * The merge request pins the top's head only, so a push that lands on the lower
 * layer between the gate's read and the merge lands unseen. The merge already
 * happened; the line names both heads so the hand-off log shows it.
 *
 * **Example** (Reference the check)
 *
 * ```ts
 * import { yeetStackLowerHeadDrift } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof yeetStackLowerHeadDrift) // "function"
 * ```
 *
 * @param lower - The lower layer as the gate listed it.
 * @param pull - The lower layer's pull request read after the merge.
 * @returns The warning, or none when the merged head is the gated one.
 * @category formatting
 * @since 0.0.0
 */
export const yeetStackLowerHeadDrift: {
  (lower: YeetStackLayer, pull: GithubPullRequestRecord): O.Option<string>;
  (pull: GithubPullRequestRecord): (lower: YeetStackLayer) => O.Option<string>;
} = dual(
  2,
  (lower: YeetStackLayer, pull: GithubPullRequestRecord): O.Option<string> =>
    pull.headSha === lower.headSha
      ? O.none()
      : O.some(
          `#${lower.number} merged at ${sha10(pull.headSha)}, not the gated head ${sha10(lower.headSha)}: a push landed on #${lower.number} after the gate read it, and merged ungated`
        )
);

/**
 * Why an ungated merge path refuses a pull request's merge scope, if it does.
 *
 * **Details**
 *
 * `yeet merge`, `yeet gh merge` and the owner checkpoint gate one pull request
 * at most, so they merge only a `Single` scope. On the top of a group the
 * request would also merge the layer below; below the top it would make GitHub
 * force-push the layer above onto the trunk.
 *
 * **Example** (The top of a group refuses)
 *
 * ```ts
 * import { YeetStackLayer, YeetStackMergeScope, yeetStackUngatedRefusal } from "@beep/repo-cli/test/Yeet"
 *
 * const layer = (number: number, position: number) =>
 *   YeetStackLayer.make({ number, position, headRef: `feat/${number}`, headSha: "abc" })
 * const scope = YeetStackMergeScope.cases.Group.make({ stackNumber: 43, trunk: "main", lower: layer(41, 1), top: layer(42, 2) })
 * console.log(yeetStackUngatedRefusal(scope, 42)._tag) // "Some"
 * ```
 *
 * @param scope - The merge scope of the pull request the path would merge.
 * @param prNumber - That pull request.
 * @returns The refusal, or none for a single pull request.
 * @category decisions
 * @since 0.0.0
 */
export const yeetStackUngatedRefusal: {
  (scope: YeetStackMergeScope, prNumber: number): O.Option<string>;
  (prNumber: number): (scope: YeetStackMergeScope) => O.Option<string>;
} = dual(
  2,
  (scope: YeetStackMergeScope, prNumber: number): O.Option<string> =>
    YeetStackMergeScope.match(scope, {
      Single: () => O.none(),
      Group: ({ stackNumber, lower }) =>
        O.some(
          `#${prNumber} is the top of stack #${stackNumber}: this merge would also merge #${lower.number}; use \`bun run beep yeet merge-gate ${prNumber} <sha>\`, which gates every layer`
        ),
      BelowTop: ({ stackNumber, upper }) =>
        O.some(
          `#${prNumber} has open layer #${upper.number} above it in stack #${stackNumber}; merge from the top with \`bun run beep yeet merge-gate ${upper.number} <sha>\`, or land this layer by itself with \`bun run beep yeet merge-gate ${prNumber} <sha> --alone\``
        ),
      TooDeep: ({ stackNumber, openLayers }) => O.some(tooDeepDetail(stackNumber, openLayers)),
      Unknown: ({ detail }) => O.some(unknownScopeDetail(detail)),
    })
);

/**
 * Read a pull request's merge scope and say why an ungated merge path refuses
 * it, if it does.
 *
 * **Details**
 *
 * A pull request outside a stack costs no request and never refuses. A stack
 * read that fails refuses: an unknown scope is never a single pull request.
 *
 * **Example** (Reference the read)
 *
 * ```ts
 * import { readYeetStackUngatedRefusal } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readYeetStackUngatedRefusal) // "function"
 * ```
 *
 * @param pull - The pull request the path would merge.
 * @returns The refusal, or none.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetStackUngatedRefusal = Effect.fn("Yeet.readStackUngatedRefusal")(function* (
  pull: GithubPullRequestRecord
): Effect.fn.Return<O.Option<string>, never, GithubRest> {
  return yield* readYeetStackMergeScope(pull).pipe(
    Effect.map(yeetStackUngatedRefusal(pull.number)),
    Effect.catch((error) => Effect.succeedSome(unreadableStackDetail(pull, error.message)))
  );
});
