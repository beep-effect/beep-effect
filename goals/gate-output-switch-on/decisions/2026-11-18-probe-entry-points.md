---
title: "The probe leads the generated check script and the package task path"
date: 2026-11-18
lane: "fix/gate-output-check-probe"
reversal: "Drop the guard from the check rules in the package-scripts schema, run the scripts writer, remove the slim entry for the probe and re-record the per-package cache baselines."
---

Settles the open P0 point for fix 6. A package's generated `check` now reads `beep-cli quality check-probe && bun run beep:check`, and `beep-cli check` inside a package runs the same probe before it starts `beep:check`. Both print one line and stop before any compiler. The alternative, pointing the script at `beep-cli check`, loads the whole CLI on every check: about 1.1 seconds against 0.6 on a built `@beep/schema`. The probe has its own slim entry instead, which loads only the filesystem probe and costs about 0.14 seconds. `@beep/infra` keeps its plain script because its check builds the referenced projects itself, and the task path probes only a package whose generated `check` carries the probe, so the two entry points agree there too. Inside a package script `beep-cli` resolves to the workspace source, so hosted CI runs the lane's own probe. The writer changed 209 manifests and each one's cache baseline was re-recorded; reviews and requests are under `docs/reports`.
