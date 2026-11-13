---
title: "Main cancel ban starts 2026-11-10; anchor for the before/after verdict reads"
date: 2026-11-10
kind: checkpoint
lane: "docs/main-cancel-ban"
reversal: "Revert the cancel-ban PR and delete this checkpoint; the before/after reads then have no anchor."
---

Slice 1 (HOST-01 a) adds the ban to the AGENTS.md Inherited-reds bullet and the orchestrate skill's Red check and Queue starved rows: the unblocker cancels pull-request runs only, never a `refs/heads/main` run, queued or running. No certainty scorecard is on `main` yet (MEAS-01 slice 1 is unmerged), so the pre-change main verdict rate cannot be read now. The ban's start date is 2026-11-10 (UTC, the day this PR merges): the 7-day before window is 2026-11-03 to 2026-11-09 and the 7-day after window, which is also the first zero-agent-cancel window, is 2026-11-11 to 2026-11-17. The scorecard reads both once it reports the main verdict rate and cancel attribution; slice 2 (the replay) waits on those numbers.

Update 2026-11-13: #3118 has since put `beep ci certainty` on `main`. It reports the main verdict rate but not cancel attribution, first-wave pickup p95 or heavy-wait p95 (decision `scorecard-field-census`); the before-window read is in `history/2026-11-13-pre-ban-main-verdict-rate.md`.
