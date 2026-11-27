---
title: Preserve frozen evidence unless regeneration is explicitly requested
date: 2026-11-26
reversal: Make the bare generators overwrite their committed evidence artifacts automatically.
governs:
  - scripts/generate-kpi-reading.ts#generate
  - scripts/generate-lane-plan-golden.ts#generate
  - scripts/generate-live-replay-evidence.ts#generate
  - scripts/generate-replay-evidence.ts#generate
enforcedBy: []
---

Bare generators check recomputed bytes against committed evidence; the replay generator prints its report in check mode. Only --write regenerates frozen dated records, and --check with --write fails typed.
Reason: automatically rewriting a dated record during verification would erase the evidence of drift.
Rejected: overwrite on every run, which turns verification into a baseline update.
A replay must match before writing, and the lane golden checks the live handoff in both modes so stale fixtures cannot regenerate a golden.
