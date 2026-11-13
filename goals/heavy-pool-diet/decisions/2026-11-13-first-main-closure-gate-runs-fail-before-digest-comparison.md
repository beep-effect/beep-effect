---
title: "First main closure-gate runs fail before digest comparison"
date: 2026-11-13
kind: checkpoint
reversal: "Supersede this observation with successful main-run evidence after the closure command flag failure is repaired."
---

Read-only GitHub Actions audit on 2026-11-13: main workflow runs 43342046581 (merge 87c4dc204c8), 43342105606, 43342142443 and 43342189531 all failed at Compare the closure digest with the latest release. Compile, reproducibility verification, smoke-run and release publication were skipped after that failure; none establishes a digest-match skip or a compiled release. The first run job 131612442366 logs the binary-closure command failing with Missing required flag: --list. Evidence: https://github.com/beep-effect/beep-effect/actions/runs/43342046581 and the three subsequent run ids above. This checkpoint records the observation only; the owning orchestrator must route the workflow failure for repair.
