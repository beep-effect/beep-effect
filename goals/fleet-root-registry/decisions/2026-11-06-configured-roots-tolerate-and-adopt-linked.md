---
title: "Configured roots tolerate a missing root and admit linked-worktree children"
date: 2026-11-06
lane: "feat/fleet-root-registry"
reversal: "Pass configured=false to discoverClones for every source so configured roots behave like the derived root."
---

A configured list names beep/seats and beep/lanes before lane-bootstrap creates them, so a configured root that does not exist contributes nothing instead of failing the scan. A beep/lanes child is a linked worktree whose .git is a file; discovery resolves it through git-common-dir to its owning clone and adds that clone when its origin matches. The derived single root (roots unset, or FleetScanOptions.fleetRoot) keeps the old behavior exactly, which the byte-identity fixture pins. Rejected: applying both rules to the derived root (a behavior change for roots-unset users).
