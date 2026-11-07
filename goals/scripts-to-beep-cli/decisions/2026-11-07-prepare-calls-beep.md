---
title: "Root prepare calls the beep command and the command never fails install"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Restore the former prune-tsgo-backups.mjs node script in package.json prepare (from git history)"
---

Workspace exports resolve to src, so `bun run beep` works during `prepare` without built dists. The command catches every failure and exits 0 with a warning, matching the old script's try/catch: pruning is an optimization, never an install gate.
