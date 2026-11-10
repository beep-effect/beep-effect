# Agent Memory Store Plan

## Status

Status: `in-progress`

## Shape

Design first, then the authority log and its projection, then admission, then
identity and observation, then retrieval, then the agent loop. Each phase is
one PR or one stack; the bars are the spike measurements in `SPEC.md`
"Acceptance Criteria", and a phase does not open until the previous phase's
bars are green on `main`. Nothing here changes the 2026-11-09 rulings.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Design and grill | complete (PR #3013) | Confirm or reverse the six packet-decidable design items by decision file (the entry's three rulings stay fixed); route the package home by specific-home-first; land the schemas and `Context.Service` contracts with no implementation. | Decision files exist for every item and the home; the store package exists via `create-package`; schemas and service contracts compile and are documented; `package-verify` green. |
| P1 Log and L0 projection | in progress: AC-1 and the AC-8 import tests green locally, PR pending | Append-only event log; raw-slice Markdown projection with reparse check; byte-identity export; import of an existing nonempty folder before the first projection, with the projector refusing to write over a folder the log has not imported. | AC-1 green on the `goals/**` fixture; the nonempty-folder import test of AC-8 green. Evidence: `MarkdownProjector.byte-identity.test.ts` (172/172 sample files identical, 3,096 edits with 0 outside the span, 0/2,940 concurrent insertions lost), `MarkdownProjector.test.ts` (AC-8 import, aborted and failed imports, export refusal), opt-in full tree 3,593/3,593; numbers in the 2026-11-10 checkpoint. |
| P2 Admission | pending | Op capture against the exported base; per-node CAS at row and list-item granularity; three-way merge on disjoint nodes; held conflicts with both texts; per-op admission; typed status fields with lifecycle guard. | AC-2 and AC-3 green on the adversarial fixture. |
| P3 Identity and observation | pending | Tiered identity with abstention and link capture at write time; observation log with typed events and distinct-lineage counts; exact-hash deferral; near-duplicate flags. | AC-4, AC-5 and AC-7 green. |
| P4 Retrieval | pending | Exact record, FTS5, optional vector index, convex fusion, optional cross-encoder, admissibility gate with typed findings and typed identity lookup, budgets. | AC-6 green; tests pass with the optional models absent. |
| P5 Agent loop | pending | planned `memory` command family on `@beep/repo-cli`; `MEMORY.md` index as a generated projection; `## Current Phase` owner rule; operator runbook. | AC-8 green; `memory doctor` reports 0 drift on a fixture folder. |
| P6 Yeet: final PR to mergeable | pending | Publish the last phase through yeet with the closeout reflection, the gating `yeet-verdict` acceptance evidence and a typed `proposedCloseout`, and drive it to mergeable per `AGENTS.md` "Mergeable". | Mergeable per `AGENTS.md`: no outstanding review thread, no own-red check, squash commitlint passes, review window elapsed; `bun run beep lint reflection-artifacts` passes. |
| P7 Close | pending | Verify completion after the merge and adopt the status in a packet-state PR. | `bun run beep goals completion refresh --slug agent-memory-store` verifies; `set-status` adopted on `origin/main` (`closeout.status == initiative.status`). |

## Decomposition Rule

One packet. A phase splits into a child packet only when it needs more than
three concurrent PRs, and a child requires only independently completed
capabilities. P4's optional-model work (vector index, cross-encoder) is the
first candidate if it does.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`,
   finalPullRequest and the gating `yeet-verdict` acceptance evidence the
   Completion gate requires. Keep `initiative.status` operative until
   completion evidence verifies; do not close the external execution/session
   ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Fixtures are synthetic or derived from `goals/**` history; never the
  operator's notes or transcripts. One labeller per fixture, declared in the
  test file.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add agent-memory-store --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/agent-memory-store/GOAL.md)" -le 4000
jq . goals/agent-memory-store/ops/manifest.json
rg -n "agent-memory-store|GOAL.md|agentLaunchers|packetAnchorDocument" goals/agent-memory-store
git diff --check -- goals/agent-memory-store
bun run beep goals decisions check --slug agent-memory-store
bun run beep goals manifest --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug agent-memory-store`; add a `kind: checkpoint` file there, never edit this block._

### P1 checkpoint: log, partition and projector built; AC-1 and the AC-8 import tests green locally, 2026-11-10

Status of P1 Log and L0 projection on lane agent-memory-store-p1 at commit d009c8eacbb, measured on this workstation. Built: the live MemoryLog (effect/eventlog over SqlEventJournal and @beep/sqlite, per-node compare-and-set and hold checks in the journal transaction), the Markdown node partition with its reparse check, and the live MarkdownProjector (importFolder in one journal transaction, exportFolder behind the per-file known-bytes fence, projectNode with the reparse check). Fixture: the packed stratified goals sample, 172 files (167 tracked goals Markdown files in eleven strata plus 5 synthetic edge files), 1,065,752 Markdown bytes, 386,973 bytes packed, sampled at commit baf225131bd; import cuts it into 10,792 nodes and 10,965 entries in about 1.0 s. AC-1 byte identity: 172/172 files identical after import then export (0 files written) and after a rebuild from the log alone into an empty folder, every rebuilt digest equal to its FileImported digest. AC-1 edit confinement: n = 3,096 generated node edits (1,032 revisions, 1,035 inserts, 1,029 retirements across all nine node kinds, gap nodes 895 of them) in 18 rounds, 0 outside the touched span, 3/n = 0.097%, at or below the 0.1% bar; projectNode cross-checked 774 of them, 411 edits reproduced the exported bytes exactly and 363 were refused by the reparse check (202 inserts without a separator, 159 retirements, 2 revisions), 0 mismatches. AC-1 concurrent insertions: 0/2,940 positions read as a deletion or misplaced. AC-8 tests green: nonempty-folder import before any projection with a byte-identical re-export, an import aborted at its 5,000th journal entry and one failing on a read part-way both leave every file byte-identical and the log empty, and exportFolder refuses an empty log, a foreign folder sharing a path and a folder mixing imported and foreign files with UnimportedFolderError, writing nothing. AC-8 stays open until P5. Opt-in full tree: 3,593/3,593 files identical (31,705,138 bytes, 295,570 nodes, 299,164 entries; import 48.4 s in one transaction, rebuild 9.7 s, peak resident set about 5.1 GB), run on d009c8eacbb with this packet's pending P1 files in the tree. Wall times under Bun: the AC-1 test file 8.7 s, the package suite 9.9 s (106 passed, the opt-in test skipped). Gates run before handoff: package-verify for the store package, goals doctor, decisions check, schema-first, jsdoc-ratchet and git diff --check, all green. Next: the orchestrator publishes the P1 PR; P2 admission opens once AC-1 is green on main.

Lane agent-memory-store-p1

Reverse: Supersede with a later checkpoint; reopen AC-1 by decision file if a hosted run of the AC-1 tests fails

<!-- beep:decisions:end -->
