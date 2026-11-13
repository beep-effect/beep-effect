---
title: "Slice 8 (PERIL-11 slice 2) in review: T3 root row and monitor waits apart"
date: 2026-11-13
kind: checkpoint
lane: "chore/certainty-peril-11-fleet-roots"
reversal: "Delete this checkpoint so the slice-7 checkpoint is the latest PLAN status note, and revert the slice-8 PR."
---

Slices 1 to 7, 10 and 11 merged (7 as #3263, 4 as #3266); the certainty nightly is live and its first run is recorded (#3270). Slice 8 (PERIL-11 slice 2) adds the T3 Code worktree root to the intended `roots.json` list in `docs/runbooks/fleet-roots-and-registry.md`, makes `yeet economics --fleet` read a checkout reachable through two roots once, and reports monitor waits apart from local work: a fourth attempt class `monitor`, local-work `modeDurations`, lane populations without wait lanes, and a `monitorWait` section in `yeet-economics/v4` (decision `peril-11-slice-2-t3-root-and-monitor-waits`). The admission gate is `packages/tooling/tool/cli/test/yeet-economics-fleet-roots.test.ts` and `packages/tooling/tool/cli/test/yeet-economics-monitor-wait.test.ts`. The workstation's own `roots.json` is not written: configured mode drops 8 orphaned lanes whose clones were deleted, so filing their journals in the attempt-journal store comes first. Next startable: PERIL-11 slice 3 (slice 9).
