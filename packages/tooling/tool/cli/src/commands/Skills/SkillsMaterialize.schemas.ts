/**
 * Report schemas for `beep skills materialize`.
 *
 * **Details**
 *
 * One row per lock entry the run examined. A vendored row reports whether its
 * installed targets already hold the verified effective tree (`current`),
 * were rebuilt from the pristine tree plus its patch series (`rebuilt`), or
 * would be rebuilt (`would-rebuild`, check mode). A local row is never
 * reconstructed; it is `current` when its targets hash to the recorded
 * `installedTreeHash` and `local-drift` otherwise. Each target is reported
 * by its repo-relative path with its own state, so a skew between the two
 * install targets (a crash between the two renames) is visible per target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Skills/SkillsMaterialize.schemas");

/**
 * Whether `materialize` writes (`write`) or only verifies (`check`).
 *
 * **Example** (Check a mode)
 *
 * ```ts
 * import { SkillMaterializeMode } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * console.log(SkillMaterializeMode.is.check("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillMaterializeMode = LiteralKit(["write", "check"]).pipe(
  $I.annoteSchema("SkillMaterializeMode", {
    description: "Whether skills materialize rebuilds installed trees or only verifies them.",
  })
);

/**
 * Whether `materialize` writes (`write`) or only verifies (`check`).
 *
 * **Example** (Annotate a mode)
 *
 * ```ts
 * import type { SkillMaterializeMode } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const mode: SkillMaterializeMode = "check"
 * console.log(mode)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMaterializeMode = typeof SkillMaterializeMode.Type;

/**
 * One install target's state against the verified tree.
 *
 * **Details**
 *
 * `matches`: the target hashes to the verified tree. `differs`: it exists with
 * other bytes or modes. `missing`: it does not exist.
 *
 * **Example** (Check a target state)
 *
 * ```ts
 * import { SkillMaterializeTargetState } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * console.log(SkillMaterializeTargetState.is.differs("differs")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillMaterializeTargetState = LiteralKit(["matches", "differs", "missing"]).pipe(
  $I.annoteSchema("SkillMaterializeTargetState", {
    description: "An install target's state against the verified effective tree.",
  })
);

/**
 * One install target's state against the verified tree.
 *
 * **Example** (Annotate a target state)
 *
 * ```ts
 * import type { SkillMaterializeTargetState } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const state: SkillMaterializeTargetState = "missing"
 * console.log(state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMaterializeTargetState = typeof SkillMaterializeTargetState.Type;

/**
 * The outcome for one lock entry.
 *
 * **Details**
 *
 * `current`: every target already holds the verified tree. `rebuilt`: write
 * mode published the verified tree to every target. `would-rebuild`: check
 * mode found a target that differs or is missing. `local-drift`: a local
 * entry's targets no longer hash to its `installedTreeHash`; materialize does
 * not rebuild local skills, so `skills update` must relock them.
 *
 * **Example** (Check a status)
 *
 * ```ts
 * import { SkillMaterializeStatus } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * console.log(SkillMaterializeStatus.is["would-rebuild"]("would-rebuild")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SkillMaterializeStatus = LiteralKit(["current", "rebuilt", "would-rebuild", "local-drift"]).pipe(
  $I.annoteSchema("SkillMaterializeStatus", {
    description: "Per-entry materialize outcome: current, rebuilt, would rebuild, or local drift.",
  })
);

/**
 * The outcome for one lock entry.
 *
 * **Example** (Annotate a status)
 *
 * ```ts
 * import type { SkillMaterializeStatus } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const status: SkillMaterializeStatus = "current"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillMaterializeStatus = typeof SkillMaterializeStatus.Type;

/**
 * One install target and its state before the run wrote anything.
 *
 * **Example** (Record a missing target)
 *
 * ```ts
 * import { SkillMaterializeTarget } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const target = SkillMaterializeTarget.make({ target: ".agents/skills/oracle", state: "missing" })
 * console.log(target.state) // "missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillMaterializeTarget extends S.Class<SkillMaterializeTarget>($I`SkillMaterializeTarget`)(
  {
    target: S.String,
    state: SkillMaterializeTargetState,
  },
  $I.annote("SkillMaterializeTarget", {
    description: "One repo-relative install target and its state against the verified tree.",
  })
) {}

/**
 * The materialize outcome for one lock entry.
 *
 * **Details**
 *
 * `patches` counts the replayed patch series (zero for a local entry or an
 * unpatched vendored one). `targets` lists every recorded install target in
 * lock order with its state before the run wrote anything.
 *
 * **Example** (Record a current vendored skill)
 *
 * ```ts
 * import { SkillMaterializeRow, SkillMaterializeTarget } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const row = SkillMaterializeRow.make({
 *   skill: "oracle",
 *   kind: "vendored",
 *   status: "current",
 *   patches: 2,
 *   targets: [SkillMaterializeTarget.make({ target: ".claude/skills/oracle", state: "matches" })],
 * })
 * console.log(row.status) // "current"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillMaterializeRow extends S.Class<SkillMaterializeRow>($I`SkillMaterializeRow`)(
  {
    skill: S.String,
    kind: S.Literals(["vendored", "local"]),
    status: SkillMaterializeStatus,
    patches: S.Natural,
    targets: S.Array(SkillMaterializeTarget),
  },
  $I.annote("SkillMaterializeRow", {
    description: "The materialize outcome for one lock entry with its per-target states.",
  })
) {}

/**
 * The full `skills materialize` report.
 *
 * **Example** (Build an empty check report)
 *
 * ```ts
 * import { SkillMaterializeReport } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const report = SkillMaterializeReport.make({ mode: "check", rows: [] })
 * console.log(report.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillMaterializeReport extends S.Class<SkillMaterializeReport>($I`SkillMaterializeReport`)(
  {
    mode: SkillMaterializeMode,
    rows: S.Array(SkillMaterializeRow),
  },
  $I.annote("SkillMaterializeReport", {
    description: "Per-entry materialize outcomes for one write or check run.",
  })
) {}
