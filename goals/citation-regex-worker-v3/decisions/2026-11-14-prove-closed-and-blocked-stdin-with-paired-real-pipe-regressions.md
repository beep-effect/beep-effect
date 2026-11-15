---
title: "Prove closed and blocked stdin with paired real-pipe regressions"
date: 2026-11-14
reversal: "Replace the paired proofs only with equivalent real-process lifecycle assertions on both runtimes."
---

The owner accepts prompt channel-failed from genuine EPIPE and separately requires the job deadline on a child that leaves stdin open without reading. Neither error is delayed or suppressed. Both regressions use a real frame larger than 1 MiB, observe the incomplete real sink write, assert parent SIGKILL and confirmed death before evaluate returns, started equals confirmed, one capacity return, and fail-closed reuse without a spawn. The earlier Bun-parent probe did not distinguish write completion from awaiting a reply and left its manual clock undriven; the new probe measures backpressure and drives the job timer explicitly. No production sink patch or Effect version change is needed. Review round 2 evidence records the results.
