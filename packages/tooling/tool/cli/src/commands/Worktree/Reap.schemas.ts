/**
 * Schema-first report models for the registered-worktree janitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Worktree/Reap.schemas");

/**
 * Pull-request classification for one registered worktree.
 *
 * **Details**
 *
 * `unknown` represents incomplete evidence. It never aliases `no-pr`, because
 * a failed GitHub probe cannot prove that no pull request exists.
 *
 * **Example** (Recognize a merged classification)
 *
 * ```ts
 * import { WorktreeReapClass } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WorktreeReapClass.is["merged-pr"]("merged-pr")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeReapClass = LiteralKit(["merged-pr", "open-pr", "no-pr", "unknown"]).pipe(
  $I.annoteSchema("WorktreeReapClass", {
    description: "Pull-request classification for one registered worktree, with unknown preserving failed evidence.",
  })
);

/**
 * Pull-request classification for one registered worktree.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeReapClass = typeof WorktreeReapClass.Type;

/**
 * Precise reason a registered worktree was not retired.
 *
 * **Example** (Recognize a dirty-tree refusal)
 *
 * ```ts
 * import { WorktreeReapSkipReason } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WorktreeReapSkipReason.is["dirty-tree"]("dirty-tree")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeReapSkipReason = LiteralKit([
  "locked",
  "detached-head",
  "missing-directory",
  "filesystem-probe-failed",
  "git-probe-failed",
  "gh-probe-failed",
  "idle-probe-failed",
  "dirty-tree",
  "open-pr",
  "no-pr",
  "reused-branch",
  "too-young",
  "live-session",
  "liveness-unknown",
  "retirement-failed",
]).pipe(
  $I.annoteSchema("WorktreeReapSkipReason", {
    description: "Fail-closed reason that prevented automatic worktree retirement.",
  })
);

/**
 * Fail-closed reason that prevented automatic worktree retirement.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeReapSkipReason = typeof WorktreeReapSkipReason.Type;

/**
 * One classified registered worktree and its retirement evidence.
 *
 * **Details**
 *
 * `skipReason` is absent only when the worktree is eligible (dry run) or was
 * retired (apply). Byte measurement is attempted only for eligible candidates
 * and is reporting-only: a failed measurement leaves `bytes` absent without
 * blocking retirement, and other failed probes leave optional evidence absent.
 *
 * **Example** (Describe an eligible merged worktree)
 *
 * ```ts
 * import { WorktreeReapCandidate } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const candidate = WorktreeReapCandidate.make({
 *   path: "/repo-worktrees/feature-x",
 *   branch: O.some("feat/feature-x"),
 *   reapClass: "merged-pr",
 *   skipReason: O.none(),
 *   prNumber: O.some(42),
 *   idleHours: O.some(72),
 *   bytes: O.some(4096),
 *   retired: false,
 * })
 * console.log(candidate.reapClass) // "merged-pr"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeReapCandidate extends S.Class<WorktreeReapCandidate>($I`WorktreeReapCandidate`)(
  {
    path: S.String,
    branch: S.OptionFromNullOr(S.String),
    reapClass: WorktreeReapClass,
    skipReason: S.OptionFromNullOr(WorktreeReapSkipReason),
    prNumber: S.OptionFromNullOr(S.Int),
    idleHours: S.OptionFromNullOr(S.Finite),
    bytes: S.OptionFromNullOr(S.Finite),
    retired: S.Boolean,
  },
  $I.annote("WorktreeReapCandidate", {
    description: "One registered worktree with PR, cleanliness, idleness, size, and retirement evidence.",
  })
) {}

/**
 * Auditable result of one dry-run or applied registered-worktree janitor pass.
 *
 * **Example** (Construct an empty dry-run report)
 *
 * ```ts
 * import { WorktreeReapReport } from "@beep/repo-cli/commands/Worktree"
 *
 * const report = WorktreeReapReport.make({
 *   scannedAt: "2026-09-03T12:00:00.000Z",
 *   mainCheckout: "/repo",
 *   invokingWorktree: "/repo-worktrees/janitor",
 *   idleThresholdHours: 48,
 *   applied: false,
 *   candidates: [],
 *   retiredCount: 0,
 *   reclaimableBytes: 0,
 *   reclaimedBytes: 0,
 *   warnings: [],
 * })
 * console.log(report.schemaVersion) // "worktree-reap/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeReapReport extends S.Class<WorktreeReapReport>($I`WorktreeReapReport`)(
  {
    schemaVersion: S.tag("worktree-reap/v1"),
    scannedAt: S.String,
    mainCheckout: S.String,
    invokingWorktree: S.String,
    idleThresholdHours: S.Finite,
    applied: S.Boolean,
    candidates: S.Array(WorktreeReapCandidate),
    retiredCount: S.Int,
    reclaimableBytes: S.Finite,
    reclaimedBytes: S.Finite,
    warnings: S.Array(S.String),
  },
  $I.annote("WorktreeReapReport", {
    description: "Versioned report for one dry-run or applied registered-worktree janitor pass.",
  })
) {}
