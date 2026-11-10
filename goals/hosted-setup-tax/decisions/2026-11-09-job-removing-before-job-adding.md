---
title: "Job-removing before job-adding: this goal's removals land ahead of merge-group-parity"
date: 2026-11-09
reversal: "Drop the ordering constraint by a new decision if the scorecard measures the hosted concurrent-job ceiling and shows headroom for the merge-group run without these removals."
---

Every lever that adds hosted jobs or legs draws on the same unverified ceiling of about 60 concurrent hosted jobs; #3046 puts a full Check run at about 75 hosted jobs. The job-removing levers in this goal (PERIH-02 Shadcn Lint retired, ROUT-01 empty legs, PERIH-04 lane-relevance skips, HOST-09's PR Size fold, PERIL-01 Fallow folded) land ahead of the gated merge-group-parity candidate in explorations/github-merge-queue, which per D28 and that packet's sequencing ruling waits on this goal, route-soundness-repair and heavy-pool-diet merging; per-SHA main groups are no longer built by main-verdict-every-commit. Each removal is recorded as a PLAN.md checkpoint so that candidate's owner can read it. The packet keeps at most three open PRs at once. The order is MAP.md sequencing item 3 under the D19 appetite; D19 also opens TURB-01 slice 1 now. Rejected: add the merge-group run first (more jobs per main commit against the ceiling regress PR p95 in merge bursts).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19 order: job-removing before job-adding; D28 for the merge-group placement; D7 for the PR-p95 rationale) and `explorations/ten-minute-certainty/MAP.md` (sequencing item 3).
