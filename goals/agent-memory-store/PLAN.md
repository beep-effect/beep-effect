# Agent Memory Store Plan

## Status

Status: `pending`

## Shape

Design first, then the authority log and its projection, then admission, then
identity and observation, then retrieval, then the agent loop. Each phase is
one PR or one stack; the bars are the spike measurements in `SPEC.md`
"Acceptance Criteria", and a phase does not open until the previous phase's
bars are green on `main`. Nothing here changes the 2026-11-09 rulings.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Design and grill | pending | Confirm or reverse the five packet-decidable design items by decision file (the two rulings stay fixed); route the package home by specific-home-first; land the schemas and `Context.Service` contracts with no implementation. | Decision files exist for every item and the home; the store package exists via `create-package`; schemas and service contracts compile and are documented; `package-verify` green. |
| P1 Log and L0 projection | pending | Append-only event log; raw-slice Markdown projection with reparse check; byte-identity export. | AC-1 green on the `goals/**` fixture. |
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

_No checkpoint files yet._

<!-- beep:decisions:end -->
