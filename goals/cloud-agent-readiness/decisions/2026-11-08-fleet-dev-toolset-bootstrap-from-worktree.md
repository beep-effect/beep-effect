---
title: "Fleet toolset bootstrap runs from a fresh origin/main worktree"
date: 2026-11-08
lane: "goals/cloud-agent-readiness-fleet-toolset"
reversal: "Run scripts/cloud/bootstrap.sh in each host's primary checkout instead; the persisted toolchain is unaffected."
---

The 2026-11-08 fleet developer toolset ran scripts/cloud/bootstrap.sh from a detached origin/main worktree on each host (removed afterwards), not the primary clone. beep-worker's primary clone is stale and dirty and must not be touched, grok-bot's clone is stale, and T3 threads may be using the others. The persisted toolchain (bun, pinned Node, typos, gitleaks, portless) is the same. Receipt: history/2026-11-08-fleet-dev-toolset.md.
