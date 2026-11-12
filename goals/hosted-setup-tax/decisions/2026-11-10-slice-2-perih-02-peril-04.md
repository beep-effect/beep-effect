---
title: "TURB-01 slice 1 merged as #3063; slice 2 (PERIH-02, PERIL-04) implemented"
date: 2026-11-10
kind: checkpoint
lane: "claude/relaxed-wu-e85a5e"
reversal: "Revert this PR; the packet returns to the TURB-01 slice 1 checkpoint."
---

TURB-01 slice 1 merged as #3063 (b757bd0400f); README and the SPEC TURB-01 row now say so. Slice 2 re-checked its cited lines at origin/main b757bd0400f: `lint:shadcn` sat at `Tasks.ts:3709` (SPEC said 3706), the CiLane changeset-graph step at `CiLane.ts:1973` (SPEC said 1953), the `GithubChecks.ts:577-581` lane and the `RouteFootprints.ts:157` row as cited, and `WaveOrder.ts` carried only a comment. heavy-pool-diet had not changed `policyStateTasks` since the graduation, so no merge of main was needed first. Job removed: Shadcn Lint (non-required), one hosted job and its 60 to 70 s of setup per run, recorded here for the merge-group-parity candidate. Next startable: slice 3 (TEST-01 oracle census, running separately); slice 4 follows slice 3.
