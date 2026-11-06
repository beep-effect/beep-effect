# P0 slice 3 report: `beep goals archive --write` against a local checkout (2026-11-06)

## Files

- New: `packages/tooling/tool/cli/src/commands/Goals/ArchiveExecution.service.ts`, which holds:
  - the services ArchiveWorkspace, ArchiveStore, TombstoneWriter and InboundLinkRewriter,
    with their `make*` constructors and `*Live` layers;
  - the schemas ArchiveVerification and TombstoneStub;
  - the pure helpers `renderTombstoneReadme`, `rewriteLinksInText`, `parseArchiveIndexRows`,
    `renderArchiveIndex` and `archiveCommitMessage`.
- Changed: `Archive.ts` gains `--write --expect`, `--dry-run`, `--archive-dir`,
  `executeArchivePlan` and `renderArchiveDryRun`. `Archive.schemas.ts` gains
  ArchiveIndexRow. `Goals.errors.ts` gains the reason `archive-plan-mismatch`. The
  `index.ts` barrel is updated.
- Tests: `test/commands/Goals/Archive.test.ts`, now 8 tests. Each run uses a temp fixture
  repo plus a temp archive checkout made with `git init`. They cover:
  - push and verify success;
  - a verify mismatch aborting with every file on main byte-identical;
  - the tombstone keep/remove result;
  - the stub README: Lifecycle line, mission, provides, the newest reflection's first
    finding, and the archive URL; plus the exploration status region;
  - the manifest archive blocks;
  - link rewriting, including a fenced line staying untouched;
  - the receipt, and the archived packets leaving the next plan;
  - the stale `--expect` refusal, a dry-run no-op, and input validation.

## Real dry run on this worktree (no `--write`)

`bun run beep goals archive --kind goals --batch 1 --plan --json` gave planId
`3ece2756a4bada139262e0bdd83eba4307c737f1ee9455190ba48c64f3b77059`, then:

```
$ bun run beep goals archive --kind goals --batch 1 --write --expect 3ece2756… --dry-run --archive-dir ~/.cache/beep/goals-archive-scratch
[goals:archive] dry run of plan 3ece2756a4bada139262e0bdd83eba4307c737f1ee9455190ba48c64f3b77059; nothing was written.
- archive checkout ~/.cache/beep/goals-archive-scratch: commit "archive(goals): 1 packets from bc18c98c60afe6fee79f77ea2facd4a76dcf77ed", then refresh ARCHIVE-INDEX.md
- goals/agent-effectiveness-loop: mirror 16 file(s) and verify tree e5e478301ffdb92a984ad0c303e401a8c4df7e81; delete 13 file(s) on main; regenerate README.md; write the manifest archive block; rewrite 0 inbound link(s)
- receipt: .beep/archive/receipts/3ece2756a4bada139262e0bdd83eba4307c737f1ee9455190ba48c64f3b77059.json
```

Afterwards the worktree and the scratch directory were unchanged (`git status` clean
apart from this slice's source edits; the scratch directory was empty). `.beep/` is
gitignored (`.gitignore:124 **/.beep/*`).

## Deviations from the brief / P0-DESIGN.md

1. **No `archived` packet event; the change is manifest-only.** Adding the event type is
   more than a new literal. It needs a new body in the `PacketEventBody` union, a branch
   in the fold (whose fall-through currently assumes `packet-created`), a third branch in
   SetStatus's body switch, a new request type in the `PacketPlanRequest` union with a
   drafting path in PacketTransitionWriter, and a decision on whether it changes derived
   state or the trace projection. That is a change to the packet-core event vocabulary,
   and it belongs in its own reviewed change. The manifest `archive` block is the record
   of the archive; 65 packets have event streams, and their streams stay untouched.
2. **Two archive commits.** The first, `archive(<kind>): <n> packets from <source>`,
   mirrors the trees and adds README.md if it is missing. The second,
   `archive(index): …`, refreshes ARCHIVE-INDEX.md. The index names the archive commit,
   so it cannot go in that same commit. `ArchiveRecord.commit` and verification use the
   first commit, and the second commit leaves every packet tree unchanged.
3. **Services are bound to a workspace.** `ArchiveWorkspace` (main checkout, archive
   checkout, repo reference, kind label) is captured when each service is constructed,
   so the service methods need nothing from their callers. `runGoalsArchive` builds the
   three services per run with `Effect.provideServiceEffect` rather than
   `Effect.provide(layer)`, which the strict-provide diagnostic flags. The `*Live`
   layers exist for composition.
4. **The mirror copies the working tree, not HEAD blobs.** Verification compares against
   the HEAD tree hash recorded in the plan, so an uncommitted edit inside a packet always
   aborts with `archive-verify-mismatch` before main is touched. The test proves this.
   Copying HEAD instead would archive bytes that differ from what is then deleted.
5. **Some inbound links are skipped.** A link written in a file the same plan deletes, or
   in a packet README the plan regenerates, is not rewritten, because that file is
   replaced anyway. The `goals/README.md` link to packet-convention-migration is
   rewritten like any other link; there are no exemptions.
6. **Order on main:** links are rewritten first, then the tombstones are written
   (deletes, stub README, manifest block, then the manifest formatter: Biome unless a
   `GoalManifestFormatter` is provided), then the receipt. All of it happens only after
   verification passes. Main changes stay uncommitted for the operator to review.
7. **`--write` and `--plan` are mutually exclusive.** `--write` without `--expect` is
   `archive-input-invalid`; a stale `--expect` is `archive-plan-mismatch`.

## Verification

- `bun run beep quality package-verify @beep/repo-cli --quick`: `ok lint`, `ok check`.
- Full `bun run beep quality package-verify @beep/repo-cli`: `ok audit 162.8s   ok docgen 49.1s`.
- `bun run beep lint policy-fingerprint`: current.
