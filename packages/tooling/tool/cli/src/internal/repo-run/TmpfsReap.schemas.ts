/**
 * Schema-first report models for the tmpfs artifact janitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/TmpfsReap.schemas");

/**
 * Artifact families the janitor can classify without inspecting arbitrary paths.
 *
 * **Example** (Recognize a worktree class)
 *
 * ```ts
 * import { TmpfsReapClass } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(TmpfsReapClass.is["git-worktree"]("git-worktree")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TmpfsReapClass = LiteralKit(["git-worktree", "head-install", "fallow-cache", "scoped-temp"]).pipe(
  $I.annoteSchema("TmpfsReapClass", {
    description: "Artifact family recognized by the tmpfs janitor's closed classification policy.",
  })
);

/**
 * Artifact family recognized by the tmpfs janitor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TmpfsReapClass = typeof TmpfsReapClass.Type;

/**
 * Filesystem or Git operation selected for one janitor candidate.
 *
 * **Example** (Inspect the removal actions)
 *
 * ```ts
 * import { TmpfsReapAction } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(TmpfsReapAction.Options) // ["worktree-remove", "remove-dir", "skip"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TmpfsReapAction = LiteralKit(["worktree-remove", "remove-dir", "skip"]).pipe(
  $I.annoteSchema("TmpfsReapAction", {
    description: "Filesystem or Git operation selected for a classified janitor candidate.",
  })
);

/**
 * Filesystem or Git operation selected for one janitor candidate.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TmpfsReapAction = typeof TmpfsReapAction.Type;

/**
 * Conjunctive safety condition that prevented a candidate from being reaped.
 *
 * **Example** (Recognize an age refusal)
 *
 * ```ts
 * import { TmpfsReapSkipReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(TmpfsReapSkipReason.is["too-young"]("too-young")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TmpfsReapSkipReason = LiteralKit([
  "live-cwd-ref",
  "live-fd-ref",
  "live-flock",
  "too-young",
  "parent-repo-missing-but-refs",
  "unclassified",
]).pipe(
  $I.annoteSchema("TmpfsReapSkipReason", {
    description: "Safety condition that prevented a classified janitor candidate from being reaped.",
  })
);

/**
 * Safety condition that prevented a candidate from being reaped.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TmpfsReapSkipReason = typeof TmpfsReapSkipReason.Type;

/**
 * One classified artifact together with its idleness and liveness evidence.
 *
 * **Example** (Describe an idle cache)
 *
 * ```ts
 * import { TmpfsReapCandidate } from "@beep/repo-cli/test/RepoRun"
 *
 * const candidate = TmpfsReapCandidate.make({
 *   path: "/tmp/fallow-audit-base-cache-example",
 *   reapClass: "fallow-cache",
 *   ageHours: 8,
 *   refCount: 0,
 *   action: "remove-dir",
 *   bytes: 4096,
 * })
 * console.log(candidate.action) // "remove-dir"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TmpfsReapCandidate extends S.Class<TmpfsReapCandidate>($I`TmpfsReapCandidate`)(
  {
    path: S.String,
    reapClass: TmpfsReapClass,
    ageHours: S.Finite,
    refCount: S.Int,
    action: TmpfsReapAction,
    skipReason: S.optional(TmpfsReapSkipReason),
    parentRepo: S.optional(S.String),
    bytes: S.optional(S.Finite),
  },
  $I.annote("TmpfsReapCandidate", {
    description: "One classified temporary artifact with the evidence and action chosen by the janitor.",
  })
) {}

/**
 * Auditable result of one dry-run or applied tmpfs janitor pass.
 *
 * **Example** (Construct an empty dry-run report)
 *
 * ```ts
 * import { TmpfsReapReport } from "@beep/repo-cli/test/RepoRun"
 *
 * const report = TmpfsReapReport.make({
 *   scannedAt: "2026-08-29T12:00:00.000Z",
 *   tmpRoot: "/tmp",
 *   applied: false,
 *   candidates: [],
 *   reapedCount: 0,
 *   reclaimedBytes: 0,
 *   warnings: [],
 * })
 * console.log(report.schemaVersion) // "tmpfs-reap/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TmpfsReapReport extends S.Class<TmpfsReapReport>($I`TmpfsReapReport`)(
  {
    schemaVersion: S.tag("tmpfs-reap/v1"),
    scannedAt: S.String,
    tmpRoot: S.String,
    applied: S.Boolean,
    candidates: S.Array(TmpfsReapCandidate),
    reapedCount: S.Int,
    reclaimedBytes: S.Finite,
    warnings: S.Array(S.String),
  },
  $I.annote("TmpfsReapReport", {
    description: "Auditable result of one dry-run or applied tmpfs artifact janitor pass.",
  })
) {}
