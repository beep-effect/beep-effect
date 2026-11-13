---
title: "Slice 1 lands over two unrecoverable MEAS-01 replay anchors"
date: 2026-11-13
lane: "fix/certainty-scoring-fixes"
pullRequest: 3144
reversal: "Delete this file and set the MEAS-01 lever back to open until a corpus reproducing the 4-of-30 and about-315 anchors is recovered."
---

The MEAS-01 admission gate names three fixture-replay anchors from the exploration: 4 of 30 under 10 min, green-only p95 101.9, and about 315 runner-min per run. The committed fixtures reproduce only the 101.9 p95. The 30-run membership behind the other two was never recorded (decision `fixture-corpus-real-captures`), so no corpus can be shown to reproduce them. Slice 1 is therefore marked landed against the anchors that can be checked: green-only p95 101.9; the named per-head cases (two producers, three run_attempts, docs-only, cancelled); the monotonicity fixtures (the baseline flip and the verdict-instant counterexample, decision `certainty-scoring-fixes`); and the api-partial refusal. The fixture's own figures are stated beside the recorded ones and never substituted for them: 1 code head under ten minutes, and 251.08 runner-min per head attempt over 35 attempts. The gate column itself is left as written, because it records the target the exploration set. The nightly's first certified week (P2) re-measures both anchors on live heads; that measurement, not the fixture, decides whether the recorded targets hold.
