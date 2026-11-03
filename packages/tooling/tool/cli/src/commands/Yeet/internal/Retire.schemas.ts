/**
 * Plan for retiring the linked worktree a sweep was started from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { GitObjectId } from "@beep/schema/Conformance";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { WorktreeRemovalReceipt } from "../../Worktree/Worktree.schemas.ts";
import { ProofJobCancelOutcome } from "./ProofJob.ts";
import { SweepPlan, SweepReport } from "./Sweep.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Retire.schemas");

/**
 * The worktree `yeet sweep --retire` will archive-retire and the clone it sweeps afterwards.
 *
 * **Details**
 *
 * `owningClone` is the parent of the Git common directory, so it is the clone
 * whose `main` the sweep fast-forwards; `worktreePath` is the linked checkout
 * the command was started in, and `name` its directory basename as the
 * removal service addresses it.
 *
 * **Example** (Make a retirement plan)
 *
 * ```ts
 * import { YeetRetirePlan } from "@beep/repo-cli/test/Yeet"
 *
 * const plan = YeetRetirePlan.make({
 *   worktreePath: "/clones/beep-effect6/.claude/worktrees/lane",
 *   owningClone: "/clones/beep-effect6",
 *   name: "lane",
 *   branch: "claude/lane",
 * })
 * console.log(plan.name) // lane
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRetirePlan extends S.Opaque<YeetRetirePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    worktreePath: S.NonEmptyString,
    owningClone: S.NonEmptyString,
    name: S.NonEmptyString,
    branch: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("YeetRetirePlan", {
      description: "The linked worktree a sweep retires, the clone that owns it, and the merged branch it carried.",
    })
  )
) {}

/**
 * A detached job a retirement asked to stop before fencing its lane, and how the stop went.
 *
 * **Example** (Record a stopped monitor)
 *
 * ```ts
 * import { StoppedLaneJob } from "@beep/repo-cli/test/Yeet"
 *
 * const stopped = StoppedLaneJob.make({ jobId: "0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60", outcome: "stop-requested" })
 * console.log(stopped.outcome) // stop-requested
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StoppedLaneJob extends S.Opaque<StoppedLaneJob, { readonly brand: unique symbol }>()(
  S.Struct({
    jobId: S.NonEmptyString,
    outcome: ProofJobCancelOutcome,
  }).pipe(
    $I.annoteSchema("StoppedLaneJob", {
      description: "A detached job the retirement asked to stop before fencing its lane, with the stop's outcome.",
    })
  )
) {}

/**
 * What the retirement gate decided for a lane, and why.
 *
 * **Details**
 *
 * `pr-merged` is the ordinary closeout: the pull request resolved for the
 * lane's branch is MERGED and heads that branch. `pr-less-on-main` covers a
 * lane whose branch never headed a pull request but whose tip `origin/<main>`
 * already contains (`git merge-base --is-ancestor`) while its tree is clean:
 * the work landed some other way (a stacked parent, a direct push, a branch
 * that was only ever a scratch checkout), so archiving it and deleting the
 * local branch loses nothing. `refused` carries the first reason an operator
 * would check, in the order they would check it: a pull request that is not
 * MERGED or heads another branch, or, without one, a tip that `origin/<main>`
 * does not contain or a dirty tree.
 *
 * **Example** (Match a verdict)
 *
 * ```ts
 * import { YeetRetireVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * const verdict = YeetRetireVerdict.cases["pr-less-on-main"].make({
 *   tip: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
 *   mainBranch: "main",
 * })
 * console.log(YeetRetireVerdict.guards.refused(verdict)) // false
 * console.log(verdict._tag) // "pr-less-on-main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetRetireVerdict = S.TaggedUnion({
  "pr-merged": {},
  "pr-less-on-main": { tip: GitObjectId, mainBranch: S.NonEmptyString },
  refused: { reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("YeetRetireVerdict", {
    description:
      "The retirement gate's decision for a lane: its pull request is MERGED, its pull-request-less tip is already on the remote main branch with a clean tree, or the first reason it is refused.",
  })
);

/**
 * Decoded retirement verdict union.
 *
 * @see {@link YeetRetireVerdict} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type YeetRetireVerdict = typeof YeetRetireVerdict.Type;

/**
 * The `--plan --json` document of `yeet sweep --retire`: the retirement, its gate, and the clone sweep plan.
 *
 * **Example** (Encode a plan document)
 *
 * ```ts
 * import { YeetRetireSweepPlanJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetRetireSweepPlanJson.encode) // function
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRetireSweepPlan extends S.Opaque<YeetRetireSweepPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-retire-sweep-plan/v2"),
    retire: YeetRetirePlan,
    verdict: YeetRetireVerdict,
    activePackets: S.Array(S.String),
    sweep: SweepPlan,
  }).pipe(
    $I.annoteSchema("YeetRetireSweepPlan", {
      description:
        "Dry-run document for a retirement: the lane plan, the gate's verdict (why it proceeds or is refused), the touched packets still active, and the owning clone's sweep plan.",
    })
  )
) {}

/**
 * JSON codec for {@link YeetRetireSweepPlan}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetRetireSweepPlanJson = JsonStringCodec(YeetRetireSweepPlan);

/**
 * The `--json` document of an executed `yeet sweep --retire`: the retirement receipt and the clone sweep report.
 *
 * **Example** (Encode a report document)
 *
 * ```ts
 * import { YeetRetireSweepReportJson } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetRetireSweepReportJson.encode) // function
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetRetireSweepReport extends S.Opaque<YeetRetireSweepReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-retire-sweep-report/v2"),
    retire: YeetRetirePlan,
    verdict: YeetRetireVerdict,
    receipt: WorktreeRemovalReceipt,
    activePackets: S.Array(S.String),
    sweep: SweepReport,
    stoppedJobs: S.Array(StoppedLaneJob).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("YeetRetireSweepReport", {
      description:
        "Result document for a retirement: the lane plan, the verdict that opened the gate, the worktree removal receipt, the touched packets still active, the owning clone's sweep report, and the lane's detached jobs stopped before the fence.",
    })
  )
) {}

/**
 * JSON codec for {@link YeetRetireSweepReport}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetRetireSweepReportJson = JsonStringCodec(YeetRetireSweepReport);
