---
title: "Accept the new Cache files' coverage rows, as for photo-face"
date: 2026-11-14
lane: "chore/python-free-repo"
pullRequest: 3296
reversal: "Delete the five Cache.* rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them"
---

Same route as 2026-11-14-photo-face-coverage-rows-accepted. The ratchet flags any uncovered unit in a file with no baseline identity. After the model- and network-free tests, hosted CI (job 132315765397) measures the five new Cache files at or above the repo-cli tier (lines/statements/branches/functions): Cache.adapter.host.ts 96.66/96.13/100/89.87, Cache.diagnostics.ts 98.59/97.33/94.24/94.48, Cache.r2.command.ts 100/96.15/100/85.71, Cache.r2.live.ts 97.89/97.14/94.44/92.1, Cache.r2.ts 100/99.35/91.66/100. What is left uncovered is fallback thunks, error paths that need timing races, and the portable hash fallback the test runtime never takes. beep-reviewer scored that state 5/5 (round 10). The hosted rows are recorded verbatim; later regressions are judged against them.
