# P1 execution decisions — ratified 2026-08-04

Outcome record of the post-P2 grill session over execution shape for P1's five phase-0
report commands and the P3+ progression rules. These are process decisions, not schema
doctrine: the implementation contracts stay owned by `p1-knowledge-finding-schema-design.md`,
`p1-manifest-capability-extension-design.md`, `p1-skill-upstream-resolution.md`, and
`p2-grill-decisions.md`. Like the P2 record, do not relitigate in implementation PRs.

## E1. Tranche structure — two tranches, T1 parallel

- **T1** builds three reports concurrently as three separate PRs, one per workstream
  report, exploiting disjoint file families:
  - **D** — manifest capability schema slice (`Goals.schemas.ts` + decode-retention
    tests);
  - **C** — `beep knowledge semantic-delta` (new `Knowledge` command family + golden
    paired fixtures);
  - **B** — `beep skills provenance` read-only pilot (`Skills` family, target `shadcn`).
- **T2** follows after T1 lands: **A** `beep knowledge refs --tree` (reuses C's
  `Knowledge` family scaffold) and **E** `beep goals bootstrap`/`adopt --plan` pure-plan
  reports.
- Rejected: one consolidated P1 PR (three command families in one diff defeats the
  one-report-one-artifact deliverable discipline) and strict sequential (starts the
  long-pole C report last for no correctness gain).

## E2. Orchestration — parallel codex jobs in dedicated worktrees

One dedicated git worktree per T1 report, each implemented by a background
`codex exec` job (gpt-5.6-sol, xhigh — the standing delegation mandate for this
initiative). The orchestrating session reviews every diff and drives Yeet
publish/closeout per branch. The primary checkout stays free for parallel human work.

## E3. Publish cadence — publish when proven; reconcile by merge

Each branch publishes as soon as its full local proof is green; merge order is the
reviewer's choice. Surviving PRs reconcile with the moved base by merging
`origin/main` into the branch (never rebase + force-push, per standing repo practice).
Full Yeet proofs serialize across worktrees even though implementation runs in
parallel.

## E4. FP-eyeball evidence — committed research report per command

Every report PR ships `research/p1-report-<command>.md` capturing the live-repo run
(JSON excerpts plus false-positive annotations). A non-command tranche satisfies the
same contract with its live-corpus proof run: D's artifact is
`research/p1-report-manifest-capabilities.md`, capturing the evergreen tracked-manifest
decode census executed by its decode-retention suite. Host-absolute paths are redacted
to `<HOME>`-style placeholders so the packet's host-path verification grep stays green
and the reports stay clone-agnostic. The committed report is the durable input to the
phase-gate eyeball; the reviewer's verdict is recorded before any dependent mutation PR
starts.

## E5. Phase progression — per-workstream, no phase barrier

A workstream's mutation work unlocks when **its own** P1 report's false-positive rate
has been eyeballed; P3 is not a barrier waiting on all five reports. Concretely: the C
Stage-1 gate wiring may start immediately after the semantic-delta report is approved,
without waiting for E's pure-plan report. Manifest phase labels remain as milestones;
unlock is per-workstream.

## E6. Context-bloat pruning diff — commissioned now, parallel

The queued CLAUDE.md/AGENTS.md pruning-candidate diff (with token-weight estimates)
is commissioned immediately as a delegated background job, parallel to T1, landing as
its own docs-only PR. It shares no files with the report PRs and is not gated on any
report.

## E7. T2 design docs — drafted during T1, own docs-only PR

A refs-tree design doc and a bootstrap/adopt pure-plan design doc are drafted during
T1, reviewed in-session, and land as one docs-only PR **before** T2 implementation
starts — the same research-before-implementation pattern C and D followed. Any newly
surfaced open decision gets a mini-grill rather than an implementation-PR debate.
