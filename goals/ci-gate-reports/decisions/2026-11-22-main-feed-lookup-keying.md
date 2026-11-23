---
title: "Main-feed lookup keys on job artifact and gate filter"
date: 2026-11-22
lane: "goals/ci-gate-reports-p3"
reversal: "Change MainFeedRequest in Ci/CiMainFeed.ts and its callers"
---

`MainFeed.lookup` (`Ci/CiMainFeed.ts`) takes a merge base, the caller's first-parent ancestors, the job artifact keys to read and a gate filter (empty means every gate). A gate name alone cannot address an artifact: artifacts are named per job, `task-outcomes-<run>-<attempt>-<job>`, so the caller names the jobs. The caller supplies `git rev-list --first-parent` past the merge base, since the checkout already has it and the walk then costs no API call; the lookup lists `check.yml` push runs on `main` once, bounded by the merge base run's creation time, and takes the first listed ancestor within 100 (`MAIN_FEED_ANCESTOR_LIMIT`) whose run concluded `success` or `failure`. A cancelled or skipped run ran no gate; red runs are kept, because main's red reports are the baseline a lane compares against. A hit at the merge base costs 1 listing plus 2 requests per job (artifact by exact name, zip), 3 for one job; everything goes through `GitHubClient`, REST only.
