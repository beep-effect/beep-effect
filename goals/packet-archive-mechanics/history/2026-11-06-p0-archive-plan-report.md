# P0 slice 2 report: `beep goals archive --plan` (2026-11-06)

## Files

- New in `packages/tooling/tool/cli/src/commands/Goals/`:
  - `Archive.schemas.ts`: ArchiveRepoRef, TreeHash, ArchiveRecord, RetentionReason,
    TombstoneKeep and `tombstoneKeeps`, ArchivePlanId, InboundLink, ArchivePlanEntry,
    ArchivePlan, ArchiveReceiptEntry, ArchiveReceipt.
  - `Archive.service.ts`: ArchivePlanner, ArchivePlannerLive, `archivePlanId`,
    `resolveLinkDestination`, INBOUND_LINK_ROOTS.
  - `Archive.ts`: the command.
- Changed:
  - `Goals.schemas.ts`: GoalManifest gains the `archive` and `retentionReason` keys.
  - `Explore/Atlas.ts`: ExplorationManifestEntry gains the same two keys.
  - `Goals.errors.ts`: ArchiveError and ArchiveErrorReason.
  - `Doctor.ts`: advisory `archive-decision-missing`. `Bootstrap.schemas.ts` maps the new
    kind to no bootstrap check.
  - `PortfolioIndex.ts`: an `Archived` column between Closeout and Mission, showing the
    date part of `archive.archivedAt` or `—`.
  - `Goals.command.ts` and `index.ts`.
  - `test/goals-command.test.ts`: the expected INDEX header and row cells.
- Test: `test/commands/Goals/Archive.test.ts` (5 tests). It covers manifest decodes
  (goal and exploration, valid and invalid), the tombstone keep-set, the doctor advisory,
  plan determinism, keep/remove on a goal and an exploration, inbound links and their
  `rewrittenTo`, batch, kind and slug selection, refusal of ineligible slugs, and the
  `--write` refusal.

## Real run: `bun run beep goals archive --kind goals --batch 3 --plan`

```
[goals:archive] plan 90fe3b0a4cf4340b9b6893f6c09d2939ffa04f8ecefac1464bbfd8b45ee70132 -> beep-effect/beep-effect-goals-archive from 9c298e70df9fb6655faf8e68afdc2b3522410e18: 3 packet(s)
- goals/agent-effectiveness-loop (completed-retained): keep 3, remove 13, inbound links 0, tree e5e478301ffdb92a984ad0c303e401a8c4df7e81
- goals/agent-execution-authority (completed-retained): keep 5, remove 7, inbound links 1, tree 350f91ed48cda870466afab76d99d7839c5f9495
- goals/agent-observability-foundation (completed-retained): keep 12, remove 373, inbound links 0, tree debfc337eb2669929c30aabe5a488aa26e7e0ea8
[goals:archive] totals: keep 20, remove 393, inbound links 1
```

The single inbound link is `goals/ontology-sidecar-stateless-identity/README.md:34`, which
points at `../agent-execution-authority/SPEC.md`. A full `--kind all --plan` over every
terminal packet totals keep 1,140, remove 21,902 and inbound links 1,013. Each plan takes
about 5 s. `--write` exits 1 with `archive-write-not-implemented`.

## Deviations from P0-DESIGN.md

1. `plan` needs no services from its caller (the Live layer holds file access, git and
   sha-256) and does not use PacketEventStore. Status comes from the manifest, which the
   doctor and the Atlas already keep in agreement with the event stream.
2. Options are `{kinds, slugs, batchSize?, repo, repoRoot}`. `--kind` reuses the harvest
   `HarvestKind` domain and `harvestKindRoots` instead of a second identical literal kit.
3. `planId` is a new unbranded `ArchivePlanId` schema (64 hex). It is the sha-256 of the
   canonical JSON of `{schemaVersion, repo, sourceCommit, entries}`, so the plan can be
   constructed without decoding a branded type. `TreeHash` reuses `GitCommitSha`.
4. ArchiveError is one tagged error with a `reason` kit that covers the design's codes
   plus `archive-input-invalid`, `archive-read-failed`, `archive-git-failed` and
   `archive-write-not-implemented`. It carries `slug` (nullable), `path` and `detail`.
5. Inbound links are scanned only in prose lines (fenced code is skipped) of tracked
   `.md`, `.mdx`, `.ts`, `.tsx` and `.json` files under the seven roots. A link counts only
   when it resolves to a file in `remove`; links to directories or to kept files such as
   README.md do not. `rewrittenTo` keeps the link's `#fragment`. Links from other packets
   in the same batch are still listed.
6. A `--slug` that is not an eligible terminal packet of the selected kind is refused
   with `archive-input-invalid` instead of being silently dropped. `--batch` below 1 is
   refused the same way.
7. The doctor advisory covers goals only, as the brief asked. Terminal explorations get
   no doctor finding yet.

## Verification

- `package-verify --quick`: `ok lint`, `ok check`. `Archive.test.ts` 5/5. The related
  goals, doctor, atlas and bootstrap suites: 93/93.
- Full `package-verify`: `fail audit`, `ok docgen`. The one failing suite was
  `test/policy-fingerprint-turbo-inputs.test.ts`: the policy-tool sources changed, so
  `standards/policy-tools.fingerprint.json` and the `turbo.json` seals drifted. I
  regenerated them with `bun run beep lint policy-fingerprint --write`; the suite then
  passes (6/6). The W9 yeet tests passed in this run.
