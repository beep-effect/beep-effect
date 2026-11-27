---
title: Check the live handoff outside the lab cache inputs
date: 2026-11-26
reversal: Remove the unconditional live handoff check and rely on the cached fixture golden alone.
governs:
  - scripts/generate-lane-plan-golden.ts#liveInput
  - scripts/generate-lane-plan-golden.ts#generate
enforcedBy: []
---

Plan the live handoff through the same contract §8.1 byte-and-digest path on every generator run, in both check and write modes.
Reason: the lab Turbo inputs omit the live file; a fixture-only golden check could therefore succeed after that document drifted.
Rejected: rely solely on the cached byte copy, which cannot detect live drift. HandoffDigestMismatchError names the changed path before any golden update.
