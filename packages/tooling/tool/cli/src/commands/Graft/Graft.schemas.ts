/**
 * Plans and receipts for copying clone-local Graft meaning artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Graft/Graft.schemas");

/**
 * Meaning-tier artifact families in their copy order.
 *
 * **Details**
 *
 * Concepts include only Markdown files at the Graft root, including INDEX.md.
 * The manifest is graft/manifest.json, the deep-layer index used by Graft queries.
 *
 * **Example** (Inspect copy order)
 *
 * ```ts import.meta.vitest name="Inspect copy order"
 * import { GraftCacheArtifact } from "@beep/repo-cli/commands/Graft"
 * console.log(GraftCacheArtifact.Options) // ["summaries", "concepts", "wiring", "manifest"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftCacheArtifact = LiteralKit(["summaries", "concepts", "wiring", "manifest"]).pipe(
  $I.annoteSchema("GraftCacheArtifact", { description: "Ordered families of reusable Graft meaning-tier artifacts." })
);

/**
 * A reusable meaning-tier artifact family.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftCacheArtifact = typeof GraftCacheArtifact.Type;

/**
 * The intended operation for one artifact destination.
 *
 * **Details**
 *
 * Refusals retain a reason and never authorize a write. A removal names a
 * root-level concept node the target still has and the source no longer does.
 *
 * **Example** (Recognize a refusal)
 *
 * ```ts import.meta.vitest name="Recognize a refusal"
 * import { GraftCacheSyncAction } from "@beep/repo-cli/commands/Graft"
 * GraftCacheSyncAction.is.refuse("refuse") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GraftCacheSyncAction = LiteralKit(["copy", "skip-missing-source", "refuse", "remove"]).pipe(
  $I.annoteSchema("GraftCacheSyncAction", {
    description: "Copy, missing-source skip, safety refusal, or removal of a target-only concept node.",
  })
);

/**
 * An operation recorded in a sync plan.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GraftCacheSyncAction = typeof GraftCacheSyncAction.Type;

/**
 * A destination clone and its only permitted write directory.
 *
 * **Details**
 *
 * Planning canonicalizes existing clone roots before checking overlap.
 *
 * **Example** (Describe a target clone)
 *
 * ```ts import.meta.vitest name="Describe a target clone"
 * import { GraftCacheSyncTarget } from "@beep/repo-cli/commands/Graft"
 * const target = GraftCacheSyncTarget.make({ root: "/clones/beep-effect2", graftDir: "/clones/beep-effect2/graft" })
 * target.graftDir // => "/clones/beep-effect2/graft"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncTarget extends S.Class<GraftCacheSyncTarget>($I`GraftCacheSyncTarget`)(
  { root: S.String, graftDir: S.String },
  $I.annote("GraftCacheSyncTarget", { description: "Clone root and the Graft directory that bounds all writes." })
) {}

/**
 * One source file's planned operation for one target clone.
 *
 * **Details**
 *
 * Missing INDEX.md receives its own skip even when other concept nodes exist.
 *
 * **Example** (Plan a missing wiring artifact)
 *
 * ```ts import.meta.vitest name="Plan a missing wiring artifact"
 * import { GraftCacheSyncPlanEntry, GraftCacheSyncTarget } from "@beep/repo-cli/commands/Graft"
 * const entry = GraftCacheSyncPlanEntry.make({
 *   target: GraftCacheSyncTarget.make({ root: "/clones/b", graftDir: "/clones/b/graft" }),
 *   artifact: "wiring", action: "skip-missing-source", reason: "Source artifact is missing.",
 *   sourcePath: "/clones/a/graft/.graph/wiring.json", targetPath: "/clones/b/graft/.graph/wiring.json"
 * })
 * entry.action // => "skip-missing-source"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncPlanEntry extends S.Class<GraftCacheSyncPlanEntry>($I`GraftCacheSyncPlanEntry`)(
  {
    target: GraftCacheSyncTarget,
    artifact: GraftCacheArtifact,
    action: GraftCacheSyncAction,
    reason: S.optional(S.String),
    sourcePath: S.String,
    targetPath: S.String,
  },
  $I.annote("GraftCacheSyncPlanEntry", { description: "A copy, skip, or refusal for one artifact file and clone." })
) {}

/**
 * A read-only snapshot of the selected source and destination operations.
 *
 * **Details**
 *
 * Applying a plan revalidates its paths and refuses stale or modified entries.
 *
 * **Example** (Represent an empty sibling discovery)
 *
 * ```ts import.meta.vitest name="Represent an empty sibling discovery"
 * import { GraftCacheSyncPlan } from "@beep/repo-cli/commands/Graft"
 * GraftCacheSyncPlan.make({ source: "/clones/beep-effect", entries: [] }).entries.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncPlan extends S.Class<GraftCacheSyncPlan>($I`GraftCacheSyncPlan`)(
  { source: S.String, entries: S.Array(GraftCacheSyncPlanEntry) },
  $I.annote("GraftCacheSyncPlan", { description: "Source clone and ordered artifact operations for selected targets." })
) {}

/**
 * Counts completed file copies, removals, skips, refusals, and bytes written.
 *
 * **Details**
 *
 * Counts are per file and target; each concept node contributes one entry. A
 * plan with any refusal is applied to nothing, so a report never mixes writes
 * with refused destinations.
 *
 * **Example** (Construct an empty receipt)
 *
 * ```ts import.meta.vitest name="Construct an empty receipt"
 * import { GraftCacheSyncPlan, GraftCacheSyncReport } from "@beep/repo-cli/commands/Graft"
 * import { NonNegativeInt } from "@beep/schema/Number"
 * const zero = NonNegativeInt.make(0)
 * const report = GraftCacheSyncReport.make({
 *   plan: GraftCacheSyncPlan.make({ source: "/clones/a", entries: [] }),
 *   copied: zero, removed: zero, skipped: zero, refused: zero, bytes: zero
 * })
 * report.bytes // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GraftCacheSyncReport extends S.Class<GraftCacheSyncReport>($I`GraftCacheSyncReport`)(
  {
    plan: GraftCacheSyncPlan,
    copied: NonNegativeInt,
    removed: NonNegativeInt,
    skipped: NonNegativeInt,
    refused: NonNegativeInt,
    bytes: NonNegativeInt,
  },
  $I.annote("GraftCacheSyncReport", {
    description: "Applied sync plan with copy, removal, skip, and refusal counts and exact bytes copied.",
  })
) {}
