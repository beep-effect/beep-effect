---
title: "Slices 4, 4b and 7 landed; the first pin-bump pull request is read on main"
date: 2026-11-14
kind: checkpoint
lane: "docs/heavy-pool-diet-slice-7-readings"
reversal: "Revert this PR's squash commit; the PLAN rows read Open again and the reading note is removed."
---

Slice 4 merged as #3301 (11d8e70ed4), slice 4b as #3311 (538f2cdd54, its check errors fixed on main by #3318) and slice 7 as #3299 (c2de80d2a0). The first main run after #3299 re-recorded the closure digest on a byte-identical release, cut no release and opened pin-bump pull request #3326; a newer release then force-updated that same pull request. Readings: history/2026-11-14-perih-11-slice-2-on-main-reading.md. Open with the driver: a pending bump is replaced on every release (21 releases on 2026-11-13), and no rule limits that. Slice 3 (#3302) and slice 6 stay held until the ci-lane-economics window-5 verdict; slice 9 waits on PERIH-10.
