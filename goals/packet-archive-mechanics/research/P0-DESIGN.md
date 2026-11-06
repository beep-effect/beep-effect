# P0 design — schemas and service contracts

Design order per repo law: schema → `Context.Service` contract → implementation.
All decisions below derive from `explorations/packet-archive-and-alpha-harvest/DECISIONS.md`
(2026-11-06). Anchors: `commands/Goals/Goals.schemas.ts` (`GoalManifest`),
`commands/Explore/Atlas.ts` (`ExplorationManifest`), `commands/Goals/PacketCore/*`
(`PacketRoot`, `PacketSlug`, `PacketEventStore`, `sha256Hex`),
`commands/Knowledge/Knowledge.refs.ts` (`knowledgeDocumentLines`, `knowledgeLinkDestinations`),
`commands/Lint/ReflectionArtifact.ts` (`ReflectionFrontmatter`), `commands/Refs/Refs.schemas.ts`.

## 1. Schemas (`commands/Goals/Archive.schemas.ts`, `commands/Goals/Harvest.schemas.ts`)

```ts
// Archive.schemas.ts
export const ArchiveRepoRef = S.String.check(/* "<owner>/<repo>" */)            // "beep-effect/beep-effect-goals-archive"
export const GitObjectSha  = S.String.check(/* 40 lowercase hex */)
export const TreeHash      = GitObjectSha                                        // git tree hash of the mirrored packet dir

export class ArchiveRecord extends S.Class<ArchiveRecord>("ArchiveRecord")({
  repo: ArchiveRepoRef,
  path: S.String,              // mirrored path, e.g. "goals/<slug>"
  commit: GitObjectSha,        // archive-repo commit holding the tree
  contentHash: TreeHash,       // `git rev-parse <commit>:<path>` in the archive repo
  archivedAt: S.String,        // ISO date-time
  sourceCommit: GitObjectSha,  // main commit the tree was taken from
}) {}

export const RetentionReason = S.NonEmptyString   // required when a terminal packet keeps its evidence on main

// Added to GoalManifest (optionalKey): archive: ArchiveRecord, retentionReason: RetentionReason
// Added to ExplorationManifestEntry (optionalKey): archive: ArchiveRecord, retentionReason: RetentionReason
// Check: a terminal packet (goals: completed-retained | superseded; explorations: graduated | killed)
//        with neither key is a doctor finding "archive-decision-missing" (advisory until the sweep is done,
//        blocking afterwards — flip is a decision file in this packet).

export const TombstoneKeep = {                      // what `archive` leaves on main, by PacketRoot
  goals:        ["ops/manifest.json", "README.md", "history/reflections/**", "research/OPPORTUNITIES.md"],
  explorations: ["ops/manifest.json", "README.md", "DECISIONS.md", "BRIEF.md"],
} // README.md is regenerated as the stub, not kept verbatim

export class ArchivePlanEntry extends S.Class<ArchivePlanEntry>("ArchivePlanEntry")({
  root: PacketRoot, slug: PacketSlug, status: PacketStatusToken,
  keep: S.Array(S.String), remove: S.Array(S.String),          // repo-relative file lists
  inboundLinks: S.Array(InboundLink),                           // {file, line, destination, rewrittenTo}
  localTreeHash: TreeHash,
}) {}
export class ArchivePlan extends S.Class<ArchivePlan>("ArchivePlan")({
  schemaVersion: S.tag("archive-plan/v1"), planId: S.String /* sha256 of canonical JSON */,
  repo: ArchiveRepoRef, sourceCommit: GitObjectSha, entries: S.Array(ArchivePlanEntry),
}) {}
export class ArchiveReceipt extends S.Class<ArchiveReceipt>("ArchiveReceipt")({
  schemaVersion: S.tag("archive-receipt/v1"), planId: S.String, archiveCommit: GitObjectSha,
  entries: S.Array(S.Struct({ root: PacketRoot, slug: PacketSlug, record: ArchiveRecord, verified: S.Boolean })),
}) {}
```

```ts
// Harvest.schemas.ts
export const HarvestSource = LiteralKit([
  "reflection-finding", "reflection-todo", "friction-receipt", "plan-unchecked",
  "status-note", "stop-condition", "decision-file", "open-question",
])
export const HarvestRowId = S.String   // sha256(root, slug, source, file, line, text) — stable across runs

export class HarvestRow extends S.Class<HarvestRow>("HarvestRow")({
  id: HarvestRowId, root: PacketRoot, slug: PacketSlug, status: PacketStatusToken,
  terminal: S.Boolean, source: HarvestSource,
  file: S.String, line: S.Int, commit: GitObjectSha, text: S.String,
  category: S.optionalKey(S.String),      // reflection finding category when present
  confidence: S.optionalKey(S.String),
}) {}
export class HarvestLedger extends S.Class<HarvestLedger>("HarvestLedger")({
  schemaVersion: S.tag("harvest-ledger/v1"), sourceCommit: GitObjectSha, generatedAt: S.String,
  rowCount: S.Int, rows: S.Array(HarvestRow),  // JSONL on disk: one header line, then rows
}) {}
```

Friction receipts: every tracked `OPPORTUNITIES.md` in the repo (git ls-files), not only
`research/OPPORTUNITIES.md`; a receipt is one `## ` section; the row text is the heading plus the
`Prevention` line when present. Rows outside any packet carry `root`/`slug` of the nearest
packet or `slug: "repo"` under a synthetic root entry (decision: `PacketRoot` stays two-valued;
non-packet ledgers are tagged `slug = "<path>"` with `root = "goals"`? No: add a nullable
`packet: S.NullOr(S.Struct({root, slug}))` instead and keep `PacketRoot` untouched).

## 2. Services (`Context.Service`, one per concern)

```ts
export class HarvestProjector extends Context.Service<HarvestProjector, {
  readonly collect: (options: { kinds: ReadonlyArray<PacketRoot> }) => Effect<HarvestLedger, HarvestError, FileSystem | Path>
  readonly write:   (ledger: HarvestLedger, target: string) => Effect<void, HarvestError, FileSystem>
}>()("HarvestProjector") {}

export class ArchivePlanner extends Context.Service<ArchivePlanner, {
  readonly plan: (options: { kinds; slugs?: ReadonlyArray<PacketSlug>; batchSize?: number }) =>
    Effect<ArchivePlan, ArchiveError, PacketEventStore | FileSystem | Path | GitCli>
}>()("ArchivePlanner") {}

export class ArchiveStore extends Context.Service<ArchiveStore, {   // the archive repo
  readonly push:   (plan: ArchivePlan) => Effect<{ commit: GitObjectSha }, ArchiveError, GitCli>
  readonly verify: (plan: ArchivePlan, commit: GitObjectSha) => Effect<ReadonlyArray<{slug; verified: boolean}>, ArchiveError, GitCli>
}>()("ArchiveStore") {}

export class TombstoneWriter extends Context.Service<TombstoneWriter, {
  readonly apply: (plan: ArchivePlan, receipt: ArchiveReceipt) => Effect<void, ArchiveError, FileSystem | Path | PacketEventStore>
  // deletes `remove`, regenerates stub README, writes manifest.archive, appends packet event "archived"
}>()("TombstoneWriter") {}

export class InboundLinkRewriter extends Context.Service<InboundLinkRewriter, {
  readonly scan:    (plan: ArchivePlan) => Effect<ReadonlyArray<InboundLink>, ArchiveError, FileSystem>
  readonly rewrite: (links: ReadonlyArray<InboundLink>) => Effect<void, ArchiveError, FileSystem>
  // uses knowledgeDocumentLines + knowledgeLinkDestinations; target `https://github.com/<repo>/blob/main/<path>`
}>()("InboundLinkRewriter") {}
```

Errors: `ArchiveError` / `HarvestError` tagged unions in `Goals.errors.ts`
(`archive-verify-mismatch`, `archive-push-failed`, `tombstone-conflict`, `retention-undeclared`,
`harvest-parse-failed`), each carrying slug + path.

## 3. Commands (Goals family)

- `beep goals harvest --kind goals|explorations|all --out <path> [--check]` → writes/verifies the ledger.
- `beep goals archive --kind ... (<slug>... | --batch <n>) --repo <owner/repo> --plan [--json] | --write --expect <planId>`
  (same review-then-replay shape as `explore graduate` and `goals bootstrap`).
- `goals doctor`: new rule `archive-decision-missing`; archived packets exempt from
  `research-reports-drift` and missing-file findings.
- `goals index`: Archived column (`archive.archivedAt` date or `—`).

## 4. First vertical slice (P0 exit)

`beep goals harvest --kind all` on this lane writes
`explorations/packet-archive-and-alpha-harvest/research/harvest/ledger.jsonl`; schema-valid;
row count ≥ 2,156 receipts + 344 reflections' findings/todos + 90 PLAN items. Then
`beep goals archive --plan` on one completed goal prints a plan with keep/remove/inboundLinks
(no `--write` until the archive repo exists in P1).
