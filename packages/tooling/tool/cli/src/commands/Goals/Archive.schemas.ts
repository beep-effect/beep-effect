/**
 * Packet archive schemas: the manifest `archive` block, retention reasons,
 * the tombstone keep-set, and the reviewable archive plan and receipt.
 *
 * **Details**
 *
 * `beep goals archive` moves a terminal packet's full tree to the public
 * archive repository and leaves a tombstone on `main`. The plan is computed
 * first and content-addressed (`planId`), so a reviewed plan can be replayed
 * with `--write --expect <planId>`; the receipt records the archive commit and
 * per-packet tree-hash verification.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitCommitSha } from "../Codex/Findings.capture.schemas.ts";
import { PacketRoot, PacketSlug, PacketStatusToken } from "./PacketCore/PacketCore.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Archive.schemas");

/**
 * GitHub `owner/repo` reference of the archive repository.
 *
 * **Example** (Validate repository references)
 *
 * ```ts
 * import { ArchiveRepoRef } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchiveRepoRef)("beep-effect/beep-effect-goals-archive")) // true
 * console.log(S.is(ArchiveRepoRef)("no-slash")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchiveRepoRef = S.String.check(
  S.isPattern(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
    $I.annote("ArchiveRepoRefPatternCheck", {
      title: "Archive Repo Ref Pattern",
      description: "A GitHub repository reference: owner and name separated by one slash.",
      message: "Expected a GitHub <owner>/<repo> reference",
    })
  )
).pipe(
  $I.annoteSchema("ArchiveRepoRef", {
    description: "GitHub <owner>/<repo> reference of the packet archive repository.",
  })
);

/**
 * GitHub `owner/repo` reference of the archive repository.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArchiveRepoRef = typeof ArchiveRepoRef.Type;

/**
 * Git tree object name of a mirrored packet directory (`git rev-parse <commit>:<path>`).
 *
 * **Example** (Validate a tree hash)
 *
 * ```ts
 * import { TreeHash } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TreeHash)("a".repeat(40))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TreeHash = GitCommitSha.pipe(
  $I.annoteSchema("TreeHash", {
    description: "40-hex git tree object name of a packet directory, compared between main and the archive repo.",
  })
);

/**
 * Git tree object name of a packet directory.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TreeHash = typeof TreeHash.Type;

/**
 * Where a packet's full tree lives after archiving; written to the manifest
 * as the `archive` block.
 *
 * **Example** (Construct an archive record)
 *
 * ```ts
 * import { ArchiveRecord } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const record = ArchiveRecord.make({
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   path: "goals/demo",
 *   commit: "a".repeat(40),
 *   contentHash: "b".repeat(40),
 *   archivedAt: "2026-11-06T00:00:00.000Z",
 *   sourceCommit: "c".repeat(40),
 * })
 * console.log(record.path) // "goals/demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveRecord extends S.Class<ArchiveRecord, { readonly brand: unique symbol }>($I`ArchiveRecord`)(
  {
    repo: ArchiveRepoRef,
    path: S.String,
    commit: GitCommitSha,
    contentHash: TreeHash,
    archivedAt: S.String,
    sourceCommit: GitCommitSha,
  },
  $I.annote("ArchiveRecord", {
    description:
      "Archive repo, mirrored path, archive commit, verified tree hash, archive time and the main commit it came from.",
  })
) {}

/**
 * Why a terminal packet keeps its full evidence on `main` instead of being archived.
 *
 * **Example** (Validate a reason)
 *
 * ```ts
 * import { RetentionReason } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RetentionReason)("Live fixtures read by tests.")) // true
 * console.log(S.is(RetentionReason)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RetentionReason = S.NonEmptyString.pipe(
  $I.annoteSchema("RetentionReason", {
    description: "Required justification when a terminal packet keeps its full evidence on main.",
  })
);

/**
 * Why a terminal packet keeps its full evidence on `main`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RetentionReason = typeof RetentionReason.Type;

/**
 * Packet-relative paths a tombstone keeps on `main`, by packet root.
 *
 * **Details**
 *
 * A trailing `/**` keeps the whole subtree. `README.md` is kept as a path but
 * regenerated as the archive stub, not kept verbatim. Explorations also keep
 * `research/harvest/**`: the harvest ledger and its panel verdicts live on
 * `main` there, beside the exploration that defined them.
 *
 * **Example** (Read the goal keep-set)
 *
 * ```ts
 * import { TombstoneKeep } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * console.log(TombstoneKeep.goals.includes("research/OPPORTUNITIES.md")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const TombstoneKeep: { readonly [K in PacketRoot]: ReadonlyArray<string> } = {
  goals: ["ops/manifest.json", "README.md", "history/reflections/**", "research/OPPORTUNITIES.md"],
  explorations: ["ops/manifest.json", "README.md", "DECISIONS.md", "BRIEF.md", "research/harvest/**"],
};

const SUBTREE_SUFFIX = "/**";

/**
 * Whether a packet-relative path stays in the tombstone for a packet root.
 *
 * **Example** (Partition goal files)
 *
 * ```ts
 * import { tombstoneKeeps } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * console.log(tombstoneKeeps("goals", "history/reflections/2026-11-06-codex.md")) // true
 * console.log(tombstoneKeeps("goals", "PLAN.md")) // false
 * ```
 *
 * @param root - Packet root.
 * @param relativePath - Path relative to the packet directory.
 * @returns Whether the tombstone keeps the path.
 * @category guards
 * @since 0.0.0
 */
export const tombstoneKeeps: {
  (root: PacketRoot, relativePath: string): boolean;
  (relativePath: string): (root: PacketRoot) => boolean;
} = dual(2, (root: PacketRoot, relativePath: string): boolean =>
  A.some(TombstoneKeep[root], (pattern) =>
    Str.endsWith(SUBTREE_SUFFIX)(pattern)
      ? Str.startsWith(Str.slice(0, Str.length(pattern) - 2)(pattern))(relativePath)
      : pattern === relativePath
  )
);

/**
 * Content address of an archive plan: lowercase sha-256 hex.
 *
 * **Example** (Validate a plan id)
 *
 * ```ts
 * import { ArchivePlanId } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ArchivePlanId)("d".repeat(64))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchivePlanId = S.String.check(
  S.isPattern(
    /^[0-9a-f]{64}$/,
    $I.annote("ArchivePlanIdPatternCheck", {
      title: "Archive Plan Id Pattern",
      description: "A plan id is a 64-character lowercase sha-256 hex digest.",
      message: "Expected a 64-character lowercase hex plan id",
    })
  )
).pipe(
  $I.annoteSchema("ArchivePlanId", {
    description: "sha-256 of the canonical JSON of an archive plan without its planId key.",
  })
);

/**
 * Content address of an archive plan.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ArchivePlanId = typeof ArchivePlanId.Type;

/**
 * One link into a file the archive will remove from `main`, and the archive
 * URL it is rewritten to.
 *
 * **Example** (Construct an inbound link)
 *
 * ```ts
 * import { InboundLink } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const link = InboundLink.make({
 *   file: "docs/README.md",
 *   line: 3,
 *   destination: "../goals/demo/PLAN.md",
 *   rewrittenTo: "https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/demo/PLAN.md",
 * })
 * console.log(link.line) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InboundLink extends S.Class<InboundLink, { readonly brand: unique symbol }>($I`InboundLink`)(
  {
    file: S.String,
    line: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    destination: S.String,
    rewrittenTo: S.String,
  },
  $I.annote("InboundLink", {
    description: "A link from a file outside the packet into a removed packet file, with its archive blob URL.",
  })
) {}

/**
 * One packet of an archive plan: what stays, what moves, and which links
 * into it get rewritten.
 *
 * **Example** (Construct a plan entry)
 *
 * ```ts
 * import { ArchivePlanEntry } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const entry = ArchivePlanEntry.make({
 *   root: "goals",
 *   slug: "demo",
 *   status: "completed-retained",
 *   keep: ["goals/demo/ops/manifest.json"],
 *   remove: ["goals/demo/PLAN.md"],
 *   inboundLinks: [],
 *   localTreeHash: "a".repeat(40),
 * })
 * console.log(entry.remove.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePlanEntry extends S.Class<ArchivePlanEntry, { readonly brand: unique symbol }>(
  $I`ArchivePlanEntry`
)(
  {
    root: PacketRoot,
    slug: PacketSlug,
    status: PacketStatusToken,
    keep: S.Array(S.String),
    remove: S.Array(S.String),
    inboundLinks: S.Array(InboundLink),
    localTreeHash: TreeHash,
  },
  $I.annote("ArchivePlanEntry", {
    description: "One terminal packet's repo-relative keep and remove lists, inbound links and HEAD tree hash.",
  })
) {}

/**
 * A reviewable, content-addressed archive plan.
 *
 * **Details**
 *
 * `planId` is the sha-256 of the canonical JSON of the encoded plan without
 * its `planId` key, so identical inputs always produce the same id.
 *
 * **Example** (Construct an empty plan)
 *
 * ```ts
 * import { ArchivePlan } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const plan = ArchivePlan.make({
 *   schemaVersion: "archive-plan/v1",
 *   planId: "d".repeat(64),
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   sourceCommit: "c".repeat(40),
 *   entries: [],
 * })
 * console.log(plan.entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchivePlan extends S.Class<ArchivePlan, { readonly brand: unique symbol }>($I`ArchivePlan`)(
  {
    schemaVersion: S.tag("archive-plan/v1"),
    planId: ArchivePlanId,
    repo: ArchiveRepoRef,
    sourceCommit: GitCommitSha,
    entries: S.Array(ArchivePlanEntry),
  },
  $I.annote("ArchivePlan", {
    description: "Content-addressed archive plan: target repo, main source commit and one entry per packet.",
  })
) {}

/**
 * One packet's outcome in an archive receipt.
 *
 * **Example** (Construct a verified entry)
 *
 * ```ts
 * import { ArchiveReceiptEntry, ArchiveRecord } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const entry = ArchiveReceiptEntry.make({
 *   root: "goals",
 *   slug: "demo",
 *   record: ArchiveRecord.make({
 *     repo: "beep-effect/beep-effect-goals-archive",
 *     path: "goals/demo",
 *     commit: "a".repeat(40),
 *     contentHash: "b".repeat(40),
 *     archivedAt: "2026-11-06T00:00:00.000Z",
 *     sourceCommit: "c".repeat(40),
 *   }),
 *   verified: true,
 * })
 * console.log(entry.verified) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveReceiptEntry extends S.Class<ArchiveReceiptEntry, { readonly brand: unique symbol }>(
  $I`ArchiveReceiptEntry`
)(
  {
    root: PacketRoot,
    slug: PacketSlug,
    record: ArchiveRecord,
    verified: S.Boolean,
  },
  $I.annote("ArchiveReceiptEntry", {
    description: "One archived packet's record and whether its archive tree hash matched the local tree hash.",
  })
) {}

/**
 * Receipt of an executed archive plan.
 *
 * **Example** (Construct an empty receipt)
 *
 * ```ts
 * import { ArchiveReceipt } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const receipt = ArchiveReceipt.make({
 *   schemaVersion: "archive-receipt/v1",
 *   planId: "d".repeat(64),
 *   archiveCommit: "a".repeat(40),
 *   entries: [],
 * })
 * console.log(receipt.entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveReceipt extends S.Class<ArchiveReceipt, { readonly brand: unique symbol }>($I`ArchiveReceipt`)(
  {
    schemaVersion: S.tag("archive-receipt/v1"),
    planId: ArchivePlanId,
    archiveCommit: GitCommitSha,
    entries: S.Array(ArchiveReceiptEntry),
  },
  $I.annote("ArchiveReceipt", {
    description: "The archive commit of an executed plan and each packet's record and verification verdict.",
  })
) {}

/**
 * One row of the archive repository's `ARCHIVE-INDEX.md`.
 *
 * **Example** (Construct an index row)
 *
 * ```ts
 * import { ArchiveIndexRow } from "@beep/repo-cli/commands/Goals/Archive.schemas"
 *
 * const row = ArchiveIndexRow.make({
 *   root: "goals",
 *   slug: "demo",
 *   status: "completed-retained",
 *   archiveCommit: "a".repeat(40),
 *   sourceCommit: "c".repeat(40),
 * })
 * console.log(row.slug) // "demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveIndexRow extends S.Class<ArchiveIndexRow, { readonly brand: unique symbol }>($I`ArchiveIndexRow`)(
  {
    root: PacketRoot,
    slug: PacketSlug,
    status: PacketStatusToken,
    archiveCommit: GitCommitSha,
    sourceCommit: GitCommitSha,
  },
  $I.annote("ArchiveIndexRow", {
    description: "One archived packet in ARCHIVE-INDEX.md: kind, slug, status, archive commit and main source commit.",
  })
) {}
