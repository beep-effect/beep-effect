---
title: "The hosted check-census step adds at most 0.5 slot-minutes per relevant Heavy / Check run"
date: 2026-11-13
lane: "feat/check-census-hosted-measure"
reversal: "Remove the check lane's census step (runCheckLaneCensus in the CI lane module); the gate itself stays runnable locally."
---

Measured on a built local tree on 2026-11-13 (single-threaded tsc 7.0.2+effect-tsgo.0.68.1, host load 5 to 11 on 64 cores): the step runs serially after a green Turbo run on the same runner and adds 24.2 s when the run checked @beep/repo-cli, 5.4 s for @beep/law-practice-domain, 4.2 s for the six @beep/schema rows and 30.0 s for every row (push runs), plus about 1.4 s for the Turbo selection dry run on every affected run; a run that checks no row package pays only that dry run. A slower hosted core stretches these numbers in proportion, and the step's own `ci:check:census: ok in <ms>` log line is the hosted reading.
