---
title: "PERIH-11 slice 1 read on main: unchanged closures skip, and recompile byte for byte"
date: 2026-11-13
kind: checkpoint
lane: "fix/ci-binary-closure-coverage"
reversal: "Records hosted readings only; revert this checkpoint file if the runs are re-read differently."
---

After #3165 (2ca2885bf09) fixed the `--list` default, the `Beep CI Binary` runs on main read as follows (closure digest, then outcome):

- 2ca2885bf09, run 43347759308: digest 40dcf6635fef; the latest release (beep-ci-61ac4497363e) recorded no digest, so it compiled and published beep-ci-2ca2885bf097, the first release that records a digest.
- ad71f5cdb67, run 43347787888: same digest 40dcf6635fef, but it also compiled and published (beep-ci-ad71f5cdb675). It overlapped run 43347759308 and listed the releases before that run had published, so it compared against beep-ci-61ac4497363e. The per-SHA concurrency group lets runs for different commits overlap; serializing them is a separate small PR.
- 3b85830d051, run 43350867866: digest 40dcf6635fef equals the recorded digest, so the job skipped compile, smoke and publish. This is the first closure skip.
- 202927595d6, run 43351886883: digest 6560e02c00f9 changed, so the job compiled and published beep-ci-202927595d64.
- 0f7a40369eb (run 43351914611) and 29ccc707fa9 (run 43352789758): digest 6560e02c00f9 unchanged, so both skipped.

Reproducibility: the `verify_reproducible` dispatch on main at 29ccc707fa9 (run 43353769826) found the closure unchanged, recompiled anyway, and matched beep-ci-202927595d64 byte for byte (sha256 98a0a2483f6e...). The release was built from 202927595d6, a different commit with the same closure, so an unchanged closure compiles to the same binary on hosted CI. PLAN slice 2's admission gate is met. The pin-bump automation is slice 7.
