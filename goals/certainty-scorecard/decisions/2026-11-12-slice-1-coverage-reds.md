---
title: "Slice 1 merged with two coverage rows red; #3121 fixed them"
date: 2026-11-12
lane: "fix/rout-05-partition-map"
reversal: "None needed: this records history. Delete the file if the attribution proves wrong."
---

#3118 (slice 1) merged as 8390750a8e3 with Heavy / Coverage Regression red on two rows it introduced: `LaneTimings.ts` branches at 99.4% against a 100% baseline (the `partial-read` reason folded into the preview verdict was never exercised) and `Certainty.ts`, a new file with no baseline row, at 75-81%. Main run 43310132188 on 5e9ee8341bd showed both. #3121 (3e2e0acaed8) fixed them with tests only: `test/ci-certainty-reader.test.ts` drives the live reader through a scripted GitHub transport and git, and a `--window --preview` lane-timings run covers the partial-read banner; scoped coverage then read 100% on all four `Certainty.ts` measures and on `LaneTimings.ts` branches, with no source or baseline change. The yeet inbox row for that red was acknowledged against 3e2e0acaed8. The other rows in that run belonged to other PRs.
