# Git History Rewrite Cutover

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

beep-effect's pre-July history carries hundreds of `saving` / `updated deps` /
`merged in main` subjects and 226 vendored `.repos/` subtree squash commits.
A full `git filter-repo` cutover was planned and rehearsed in July 2026 in
`~/YeeBois/projects/beep-effect-cutover/` but never run, and no packet owned
it. This packet does, before `goals/legacy-drain` archives that folder.

## Next Open Question

None — graduated into [`goals/history-message-overlay`](../../goals/history-message-overlay/).
Reopen at align only if a real history rewrite is proposed again.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): July workspace inventory and what changed since.
3. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
4. [`RESEARCH.md`](./RESEARCH.md) - GitHub/filter-repo landscape, in-repo inventory, notes overlay facts.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log: no rewrite, notes overlay design.
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
7. [`MAP.md`](./MAP.md) - one goal, four slices.

## Trail

- 2026-11-06: research (GitHub rewrite side effects, filter-repo, in-repo
  inventory), align (no rewrite; notes overlay on `refs/notes/history`, D6
  stands, map tracked and folder archived), shape and decompose, then graduated
  into `goals/history-message-overlay`. Align looped back to research once for
  the git notes facts.
- 2026-11-06: packet opened in capture, seeded from the July 2026 cutover
  workspace and a live re-measure of `origin/main`. Stopped at the capture
  exit check.
