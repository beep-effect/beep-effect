---
title: "Fixture fleet gates acceptance; the real seats/main is deferred to lane-bootstrap"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Add a workstation acceptance step that clones seats/main during P2 verification."
---

An Effect Vitest fixture fleet (temp projects dir with beep-effectN clones, <clone>-worktrees and .claude/worktrees lanes, beep/seats/main and beep/lanes/x, all origin-matched) proves discovery with the roots configured and byte-identity with roots unset. The workstation smoke is the byte-identical fleet --json diff only. The real seats/main clone is created by lane-bootstrap's first lane. Rejected: cloning a multi-GB idle seat now; a --depth 1 smoke seat (a trap if anyone starts work in it).
