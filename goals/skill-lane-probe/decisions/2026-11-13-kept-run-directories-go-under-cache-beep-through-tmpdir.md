---
title: "Kept run directories go under ~/.cache/beep through TMPDIR"
date: 2026-11-13
lane: "goals/skill-lane-probe-p1"
reversal: "Point TMPDIR back at the default temp root; nothing in the analysis depends on the location."
---

claude plugin eval writes --keep-temp directories under TMPDIR, which on this workstation defaults to a cache root outside ~/.cache/beep. The scored run sets TMPDIR to the lane's cache directory so kept directories stay out of /tmp and out of the repository, as GOAL.md requires. Run records carry only the kept directory's basename.
