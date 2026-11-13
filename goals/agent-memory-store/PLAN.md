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
| P1 Log and L0 projection | complete (PR #3058, merged as 6fc960063d4) | Append-only event log; raw-slice Markdown projection with reparse check; byte-identity export; import of an existing nonempty folder before the first projection, with the projector refusing to write over a folder the log has not imported. | AC-1 green on the `goals/**` fixture; the nonempty-folder import test of AC-8 green. Evidence: `MarkdownProjector.byte-identity.test.ts` (172/172 sample files identical, 3,096 edits with 0 outside the span, 0/2,940 concurrent insertions lost), `MarkdownProjector.test.ts` (AC-8 import, aborted and failed imports, export refusal), opt-in full tree 3,593/3,593; numbers in the 2026-11-10 checkpoint. |
| P2 Admission | in progress: AC-2 green locally, AC-3 measured, PR pending | Op capture against the exported base; per-node CAS at row and list-item granularity; three-way merge on disjoint nodes; held conflicts with both texts; per-op admission; typed status fields with lifecycle guard. | AC-2 and AC-3 green on the adversarial fixture. Evidence: `Admission.acceptance.test.ts` (100 seeded runs of 118 cluster writes over 15 declared strata: 0 runs with loss, 1,000/1,000 contested nodes held with both texts; structural floor 912/11,800; resolver-needed 1,912/11,800 and per-op landing 12,178/15,600, neither comparable with the S14b bars on this upper-bound fixture; status conflicts 1,000 held 0 wrong 0; 744/744 backward moves rejected), `AgentWrite.test.ts` (two writers on one file both land, byte for byte); numbers in the 2026-11-13 checkpoint. |
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

Status of P1 Log and L0 projection on lane agent-memory-store-p1, first measured at commit d009c8eacbb and re-measured on this workstation after the P1 review fixes. Built: the live MemoryLog (effect/eventlog over SqlEventJournal and @beep/sqlite, per-node compare-and-set, hold and predecessor-placement checks in the journal transaction; decision memory-log-refuses-an-unplaced-node), the Markdown node partition with its reparse check, and the live MarkdownProjector (importFolder in one journal transaction, exportFolder behind the export fence bound to the folder, decision export-fence-is-bound-to-the-folder; projectNode with the reparse check; refusals as typed errors, decision projector-refusals-are-typed-errors). Fixture: the packed stratified goals sample, 172 files (167 tracked goals Markdown files in eleven strata plus 5 synthetic edge files), 1,065,752 Markdown bytes, 386,973 bytes packed, sampled at commit baf225131bd; import cuts it into 10,792 nodes and 10,965 entries in about 1.0 s. AC-1 byte identity: 172/172 files identical after import then export (0 files written) and after a rebuild from the log alone into an empty folder, every rebuilt digest equal to its FileImported digest. AC-1 edit confinement: n = 3,096 generated node edits (915 revisions, 1,099 inserts, 1,082 retirements) in 18 rounds, 0 outside the touched span, 3/n = 0.097%, at or below the 0.1% bar; the kind and the operation are drawn independently and counted by the node touched, and every one of the nine node kinds took at least 3 revisions, 3 retirements and 3 inserts after it (html 7, 6, 6 and thematicBreak 5, 6, 3 are the scarcest; gap nodes 319, 275, 308); projectNode cross-checked 774 of them, 374 edits reproduced the exported bytes exactly and 400 were refused with ReparseRefusedError (223 inserts without a separator, 173 retirements, 4 revisions), 0 mismatches. AC-1 concurrent insertions: 0/2,940 positions read as a deletion or misplaced. AC-8 tests green: nonempty-folder import before any projection with a byte-identical re-export, an import aborted at its 5,000th journal entry and one failing on a read part-way both leave every file byte-identical and the log empty, and exportFolder refuses an empty log, a foreign folder sharing a path, a folder mixing imported and foreign files and a foreign copy holding only a byte-identical imported file with UnimportedFolderError, writing nothing; importFolder refuses that copy with ForeignFolderError. AC-8 stays open until P5. Opt-in full tree: 3,597/3,597 files identical (31,726,283 bytes, 295,628 nodes, 299,226 entries; import 48.0 s in one transaction, rebuild 9.7 s, peak resident set 6.7 GB with the source snapshot now held from before the import; the first run, at d009c8eacbb, peaked at about 5.1 GB), run with this packet's pending review-fix files in the tree. Wall times under Bun: the package suite 9.7 s (108 passed, the opt-in test skipped). The fixture generator now reads the recorded commit's tree, and run at baf225131bd it reproduces the committed fixture byte for byte. Gates run before handoff: package-verify for the store package, goals doctor, decisions check, schema-first, jsdoc-ratchet and git diff --check, all green. Next: the orchestrator publishes the P1 PR; P2 admission opens once AC-1 is green on main.

Lane agent-memory-store-p1

Reverse: Supersede with a later checkpoint; reopen AC-1 by decision file if a hosted run of the AC-1 tests fails

### P2 checkpoint: admission and the write path built; AC-2 green, AC-3 measured and open, 2026-11-13

Status of P2 Admission on lane agent-memory-store-p2, measured on this workstation under heavy load (load average 55 to 90 on 64 cores). Built: op capture against the exported base (decisions op-capture-pairs-only-equal-count-runs, op-capture-derives-base-kinds, op-capture-is-pure-with-injected-minter) with status token swaps typed as setStatus (op-capture-types-a-status-token-swap); the live Admission layer (per-operation judgment in one SQL transaction, the whole-node three-way merge, held writes as WriteHeld and HoldResolved events with both texts, typed status fields with the lifecycle guard; decisions admission-judges-each-operation-in-one-transaction, p2-three-way-merge-is-whole-node, typed-status-fields-are-whole-token-values, resolutions-are-written-under-a-fixed-resolver-lineage, batch-dependencies-hold-on-a-missing-insert, admission-refusal-codes); the write path admitEdits and writeEdits (p2-write-path-is-capture-then-admit); admission runs no reparse check (admission-does-not-run-the-reparse-check); every journal string is well-formed UTF-16 (journal-strings-are-well-formed). Op capture on the goals sample: 516 seeded edits, 3,659 operations against a lower bound of 3,051 (ratio 1.1993), every edited byte reproduced. Fixture (decision p2-adversarial-fixture-is-seeded-contention-strata, fixed before measurement): 14 files and 1,710 nodes of the frozen goals sample, 57 clusters in 15 strata, 118 writes and 156 operations per run, 100 runs in seeded admission orders. AC-2 green: 0 of 100 runs with a silent loss under the test's own oracle, 1,000 of 1,000 contested nodes (six revise-versus-revise and four mixed-batch clusters per run) held with both texts, 600 delete-versus-edit holds (one per revise-versus-retire cluster per run), every run's export equal to the folder on disk. AC-3 measured, not ticked: structural floor 912 of 11,800 writes (6 to 12 of 118 per run); resolver-needed 1,912 of 11,800 (16 to 22 per run), against 26/279: 1,912 x 279 = 533,448 above 26 x 11,800 = 306,800, so the bar is not met; per-op landing 12,178 of 15,600 (78.1%), below 95%. Neither ratio is comparable with S14b: 16 of the 118 writes need a resolver in every interleaving by construction (16/118 is already above 26/279), and writes carry 1.3 operations against S14b's 7.1. The bars stay as SPEC.md states them; a re-baseline needs a measurement on a comparable replay. Typed status fields: 1,000 status conflicts, 0 held, 0 wrong resolutions; the lifecycle guard rejected 744 of 744 backward moves. Mutation checks: making a contested revise land last-writer-wins fails AC-2 (100 of 100 runs with loss, 0 of 1,000 contested nodes held); letting the guard accept a backward move fails AC-3 (1,188 wrong status resolutions, 0 of 744 backward moves rejected); both edits were reverted byte for byte. Wall times under that load: the acceptance file 40 s (the replay itself 0.3 to 0.9 s a run after one import and one capture per writer), the package suite with coverage 74 s; coverage 100% of lines, statements, functions and branches. Next: the orchestrator publishes the P2 PR; AC-3 needs a comparable replay or a re-baselining decision before P2 can close.

Lane agent-memory-store-p2

Reverse: Supersede with a later checkpoint; reopen AC-2 by decision file if a hosted run of the AC-2 test fails

<!-- beep:decisions:end -->
