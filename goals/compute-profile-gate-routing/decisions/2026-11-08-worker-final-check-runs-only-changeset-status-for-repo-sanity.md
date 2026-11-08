---
title: "Worker final-check runs only changeset status for repo-sanity"
date: 2026-11-08
reversal: "Remove routeFinalCheckStepsForProfile from the final-check run so repo-sanity dispatches the full ci lane again"
---
D6 keeps only the repo-sanity changeset status check local on worker, but P1 routed the whole gate
local, so `yeet final-check` still dispatched `ci lane repo-sanity` and its whole-repo schema catalog
scan. On 2026-11-08 that scan held 5.2 GB in dankserver's 7 GiB worker slice for 25 minutes and took
T3 offline until it was killed (PR #2968's final-check).

The narrowing lives in final-check, not in `beep ci lane`: hosted runners execute that same lane and
must keep the full scan. A passing repo-sanity step on a worker receipt therefore means changeset
status only; hosted Repo Sanity remains the proof. `--force-local` restores the full lane.
