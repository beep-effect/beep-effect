/**
 * Plan for retiring the linked worktree a sweep was started from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { WorktreeRemovalReceipt } from "../../Worktree/Worktree.schemas.ts";
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
export class YeetRetirePlan extends S.Class<YeetRetirePlan>($I`YeetRetirePlan`)(
  {
    worktreePath: S.NonEmptyString,
    owningClone: S.NonEmptyString,
    name: S.NonEmptyString,
    branch: S.NonEmptyString,
  },
  $I.annote("YeetRetirePlan", {
    description: "The linked worktree a sweep retires, the clone that owns it, and the merged branch it carried.",
  })
) {}

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
export class YeetRetireSweepPlan extends S.Class<YeetRetireSweepPlan>($I`YeetRetireSweepPlan`)(
  {
    schemaVersion: S.Literal("yeet-retire-sweep-plan/v1"),
    retire: YeetRetirePlan,
    blocker: S.OptionFromNullOr(S.String),
    sweep: SweepPlan,
  },
  $I.annote("YeetRetireSweepPlan", {
    description:
      "Dry-run document for a retirement: the lane plan, why it would be refused if at all, and the owning clone's sweep plan.",
  })
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
export class YeetRetireSweepReport extends S.Class<YeetRetireSweepReport>($I`YeetRetireSweepReport`)(
  {
    schemaVersion: S.Literal("yeet-retire-sweep-report/v1"),
    retire: YeetRetirePlan,
    receipt: WorktreeRemovalReceipt,
    sweep: SweepReport,
  },
  $I.annote("YeetRetireSweepReport", {
    description:
      "Result document for a retirement: the lane plan, the worktree removal receipt, and the owning clone's sweep report.",
  })
) {}

/**
 * JSON codec for {@link YeetRetireSweepReport}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const YeetRetireSweepReportJson = JsonStringCodec(YeetRetireSweepReport);
