---
title: "MEAS-01 fixtures are a committed corpus, not the audit's scratch files"
date: 2026-11-09
reversal: "Point the parity test at an external corpus path and record where it lives; the committed fixtures can then be deleted."
---

The plan's gate for MEAS-01 replays the Opus head corpus and the Astra 60-run corpus, but neither file is tracked in this repository (`git ls-files` finds no such file at 6eb2e0588e2 or at c90929b1ff1). Slice 1 therefore commits a small recorded fixture corpus under the CLI's test fixtures: the named heads (eb295434 with two producers, facc14a6 with three attempts, a docs-only head, a cancelled head) and a frozen run set whose expected counts reproduce the recorded figures (4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run). Rejected: depending on session scratch files (not reviewable, lost on cleanup). Source: lever status check in this packet, `research/SOURCES.md` section 1.
