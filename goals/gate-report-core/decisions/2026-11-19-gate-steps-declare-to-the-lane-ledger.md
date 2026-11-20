---
title: "Captured gate steps declare to the lane ledger through the streaming runner's group"
date: 2026-11-19
lane: "feat/gate-report-wiring"
pullRequest: 3419
reversal: "Give the root gate steps their own ledger calls again."
---

A root gate step runs its Turbo command captured, which bypassed the code that declares a step's Turbo digest to the lane ledger; under a wrapper lane nothing was declared and the lane's proof could not be reused. One ledger group now serves both runners: every direct Turbo step, streamed or captured, declares its digest, and each group closes once with its attempt count. A root gate step also adds Turbo's run-summary flag only when the caller did not pass it, because Turbo rejects a repeated flag and the CI lane passes its own.
