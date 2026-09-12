/**
 * Plan for retiring the linked worktree a sweep was started from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

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
