---
title: "Two parts of the slice 18 rows cannot be read with the job token: VM boot and the explicit-cancel login"
date: 2026-11-27
lane: "feat/certainty-scorecard-rows"
reversal: "Build either part in a later slice and record a decision naming its source; delete this file once both are built."
---

The slice 18 brief allows a row that the nightly cannot compute from its job token's reads to be recorded instead of built. Every row is built (decision `sibling-row-definitions`). Two parts of two rows are not, and both are named in the report's "Not covered" list.

- **VM boot inside heavy slot-minutes.** `heavy-pool-diet` reads "heavy slot-minutes per code run (VM boot included)". The Actions jobs API starts a job's clock when a runner picks it up, so the one-job-one-VM boot falls inside the job's created-to-started gap, which is the `heavyQueue` row. Slot-minutes therefore count job wall only. The before and after readings for the diet are taken the same way, so the 20% comparison stays like for like. Boot time per job is in the heavy fleet's own runner telemetry (the scale-up and instance lifecycle records under `goals/infra-alchemy-rebuild`, P5 ci-runners), and a boot-inclusive figure belongs there.
- **The login behind an explicit main cancel.** `main-verdict-every-commit` wants zero agent-initiated cancels. The row reports `explicit` cancels, meaning those of runs that had created jobs; GitHub's concurrency queue never cancels such a run on main. That count is an upper bound and meets the acceptance when it is zero. GitHub writes the cancelling login only into check-run annotations, which need `checks: read`, a scope the nightly does not hold, and agents act through one shared login, so the login would not tell an agent from a person anyway. A nonzero `explicit` count is investigated by hand, from the run's annotations under an operator identity.
