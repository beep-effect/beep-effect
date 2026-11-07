---
title: "Commands live under beep worktree fleet"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Lift --join, describe and register into a new beep fleet group and re-export the Worktree internals."
---

fleet --join, fleet describe <checkout>, fleet register <checkout> --role ... [--owning-seat] [--retention-exempt]. Plain fleet output stays unchanged per the fleet-mirror SPEC. Schema and store modules live in commands/Worktree/internal/FleetRoots.* and FleetRegistry.*. Rejected: a new beep fleet group (splits fleet code across two groups); registry under beep session (mixes checkout facts into a session tool).
