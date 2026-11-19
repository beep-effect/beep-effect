---
title: "A package-local task resolves no concurrency plan"
date: 2026-11-18
lane: "fix/gate-output-check-probe"
reversal: "Wrap the package branch of the task runner in the concurrency provider again."
---

The task runner resolved the admission-aware concurrency plan for every invocation and printed its admission note, including for a package-local task that runs one script and never reads the plan. Only a repo-root task resolves it now. This keeps the probe's failure to exactly one line through `beep-cli check`, and removes one line from every package-local task.
