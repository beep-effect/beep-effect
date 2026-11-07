---
title: "Root prepare calls the beep command and the command never fails install"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Restore node scripts/prune-tsgo-backups.mjs in package.json prepare"
---

Workspace exports resolve to src, so `bun run beep` works during `prepare` without built dists. The command catches every failure and exits 0 with a warning, matching the old script's try/catch: pruning is an optimization, never an install gate.
