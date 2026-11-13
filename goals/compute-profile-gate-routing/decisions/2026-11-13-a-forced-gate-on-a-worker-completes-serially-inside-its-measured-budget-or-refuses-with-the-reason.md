---
title: "A forced gate on a worker completes serially inside its measured budget or refuses with the reason"
date: 2026-11-13
lane: "fix/compute-profile-forced-gates"
reversal: "Set fallow back to Serial in workerForcedRouteTable, drop the coverage scope refusal in FinalCheck.ts and record options.forceLocal on the receipt again"
---

The two dankserver acceptance runs (research/2026-11-13-worker-host-acceptance.md and its -repeat.md sibling; 15 GiB host, 7 GiB agent slice) measured every forced gate that ran: none completed. Forced fallow, serial, held a 2G-capped scope at its ceiling (2.15 GB aggregate) in its first sub-lane fallow:audit:check (204 packages) until slice pressure passed 15 at 523 s; unserialized it reached 3.06 GB and gave no result in 29.5 minutes. The @beep/repo-cli test type-check held 2.59 GB in one tsc process and gave no result in 30 minutes under a 3 GiB cap. The whole-repo schema catalog scan behind cheap-gates and the full repo-sanity lane held 5.2 GB for 25 minutes (decision 2026-11-08). Forced coverage was stopped at 565 s at 2.15 GB in a prebuild that ran turbo build at --concurrency=4.

The worker forced-route table now follows those figures. Only coverage is forceable: its prebuild, shard group and Turbo graph all follow --concurrency=1, and final-check runs it only when the affected plan selects the diff's own packages, which it names. A whole-workspace or unreadable plan refuses. fallow, check and lint-policy (2.59 GB), cheap-gates and the full repo-sanity lane (5.2 GB) refuse with their measured figure and note; docgen refuses with no measured worker budget. Every refusal tells the operator to push with yeet open and let hosted CI prove the gate. The receipt records forceLocal: true only when a gate was actually forced, so a refusal-only run no longer claims a forced run.

Amended reading of criterion 2b: on a worker, a forced gate either completes with concurrency 1 and its receipt records forceLocal: true, or refuses with a reason naming its measurement; a refused gate writes an admission-routed refusal row and no forced step. Refusing is correct behaviour on a 7 GiB slice. Still to show on dankserver: one forced coverage run over a small package completing with forceLocal: true on its receipt.
