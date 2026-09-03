/**
 * Schema-first report models for the home-residue janitor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/ResidueReap.schemas");

/**
 * Home-residue families owned by the janitor's closed policy.
 *
 * **Example** (Recognize a cleanup class)
 *
 * ```ts
 * import { ResidueReapClass } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ResidueReapClass.is["turbo-cache"]("turbo-cache")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapClass = LiteralKit([
  "codex-sessions",
  "codex-worktrees",
  "turbo-cache",
  "beep-cache-disposable",
]).pipe(
  $I.annoteSchema("ResidueReapClass", {
    description: "Home-residue family recognized by the janitor's closed discovery policy.",
  })
);

/**
 * Home-residue family recognized by the janitor.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapClass = typeof ResidueReapClass.Type;

/**
 * Filesystem action selected for one home-residue candidate.
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapAction = LiteralKit(["remove-file", "remove-dir", "skip"]).pipe(
  $I.annoteSchema("ResidueReapAction", {
    description: "Filesystem action selected after a residue candidate's evidence is evaluated.",
  })
);

/**
 * Filesystem action selected for one candidate.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapAction = typeof ResidueReapAction.Type;

/**
 * Fail-closed reason that prevented removal of a residue candidate.
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapSkipReason = LiteralKit([
  "too-young",
  "protected-name",
  "wrong-shape",
  "stat-failed",
  "census-failed",
  "census-overflow",
  "live-cwd-ref",
  "process-probe-failed",
  "path-changed",
  "removal-failed",
]).pipe(
  $I.annoteSchema("ResidueReapSkipReason", {
    description: "Precise missing or negative safety evidence that prevented residue removal.",
  })
);

/**
 * Fail-closed reason that prevented candidate removal.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapSkipReason = typeof ResidueReapSkipReason.Type;

/**
 * Non-negative finite age threshold measured in days.
 *
 * @category models
 * @since 0.0.0
 */
export const ResidueReapAgeDays = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ResidueReapAgeDays", {
    description: "Schema-validated non-negative finite cleanup threshold in days.",
  })
);

/**
 * Non-negative finite age threshold measured in days.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ResidueReapAgeDays = typeof ResidueReapAgeDays.Type;

/**
 * One residue candidate and the complete evidence used to choose its action.
 *
 * **Example** (Describe an eligible session file)
 *
 * ```ts
 * import { ResidueReapCandidate } from "@beep/repo-cli/test/RepoRun"
 *
 * const candidate = ResidueReapCandidate.make({
 *   root: "/home/me/.codex/sessions",
 *   path: "/home/me/.codex/sessions/old.jsonl",
 *   reapClass: "codex-sessions",
 *   ageDays: 45,
 *   action: "remove-file",
 * })
 * console.log(candidate.action) // "remove-file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueReapCandidate extends S.Class<ResidueReapCandidate>($I`ResidueReapCandidate`)(
  {
    root: S.String,
    path: S.String,
    reapClass: ResidueReapClass,
    ageDays: S.optional(S.Finite),
    action: ResidueReapAction,
    skipReason: S.optional(ResidueReapSkipReason),
    entriesScanned: S.optional(S.Int),
    bytes: S.optional(S.Finite),
  },
  $I.annote("ResidueReapCandidate", {
    description: "One home-residue candidate with age, census, action, and fail-closed skip evidence.",
  })
) {}

/**
 * Auditable result of one dry-run or applied home-residue janitor pass.
 *
 * **Example** (Construct an empty dry-run report)
 *
 * ```ts
 * import { ResidueReapReport } from "@beep/repo-cli/test/RepoRun"
 *
 * const report = ResidueReapReport.make({
 *   scannedAt: "2026-09-03T12:00:00.000Z",
 *   homeRoot: "/home/me",
 *   repoRoot: "/repo",
 *   maxAgeDays: 30,
 *   turboMaxAgeDays: 14,
 *   applied: false,
 *   classes: ["codex-sessions"],
 *   candidates: [],
 *   reapedCount: 0,
 *   reclaimedBytes: 0,
 *   warnings: [],
 * })
 * console.log(report.schemaVersion) // "residue-reap/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResidueReapReport extends S.Class<ResidueReapReport>($I`ResidueReapReport`)(
  {
    schemaVersion: S.tag("residue-reap/v1"),
    scannedAt: S.String,
    homeRoot: S.String,
    repoRoot: S.String,
    maxAgeDays: ResidueReapAgeDays,
    turboMaxAgeDays: ResidueReapAgeDays,
    applied: S.Boolean,
    classes: S.Array(ResidueReapClass),
    candidates: S.Array(ResidueReapCandidate),
    reapedCount: S.Int,
    reclaimedBytes: S.Finite,
    warnings: S.Array(S.String),
  },
  $I.annote("ResidueReapReport", {
    description: "Versioned report for a dry-run or applied home-residue cleanup pass.",
  })
) {}
