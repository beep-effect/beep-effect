---
title: "replayInputs populations: main rows count every main push, the pull-request row counts code heads only"
date: 2026-11-27
lane: "goals/certainty-scorecard-closeout"
reversal: "Filter docs commits out of mainMerges and mainRunHostedJobs in Certainty.ts and delete this file; the slice 18 definition (decision sibling-row-definitions) then reads code heads everywhere."
---

Driver ruling 2026-11-27 on the `replayInputs` row that decision `sibling-row-definitions` defines for `main-verdict-every-commit`. `mainMerges` and `mainRunHostedJobs` count every main push in the window, docs commits included: every push to main starts a main `check.yml` run and loads the pool, and the merge-timestamp replay models that load, so leaving docs pushes out would under-count it. `pullRequestRunHostedJobs` and every other row of the report count code heads only, as `sibling-row-definitions` says ("docs heads never count").

The code already does this on 32db77c222f. `mainMerges` is the length of `mainRows`, one row per first-parent commit in the window whether or not it is docs-only (`mainStatOf` filters docs commits out for the verdict rate, not for this count). `mainRunHostedJobs` reads `mainRuns`, the main push runs of those commits. `pullRequestRunHostedJobs` reads `codeAttempts`, the attempts of code heads. This decision records the population so a reader of the replay does not take the main rows for code-only counts; no code changes.

A main push run that started no hosted job (one the concurrency queue replaced before it created jobs) adds no point to the `mainRunHostedJobs` distribution, since it put no load on the pool; it is still one of `mainMerges`.
