---
title: "Ledger windows are per concurrent bucket, not per login"
date: 2026-11-13
lane: "fix/github-ledger-concurrent-buckets"
reversal: "Revert the lanes commit and the rollup v2 bump; v2 rollups would then fail to decode and be recomputed under the v1 model"
---

Live ledger data on 2026-11-12 showed GitHub GraphQL rate-limit windows are per credential, not per login. The gh login token and the yeet monitor token, folded into `user:kriegcloud` by the alias map, each kept their own window, with resets about a minute apart. The design note (research/2026-11-10-design.md) split a key's anchors into sequential reset epochs, so each switch between the interleaved windows read as a reset crossing. The 20:00 UTC hour reported 10,347+ GraphQL points against a real ~1,200.

The bucket key stays identity plus resource, so the login grouping and the reserve signal per identity are unchanged. Inside a key, anchors are now assigned to lanes, one per concurrent physical bucket: by reset match, then an idle lane, then a lane whose window has ended, else a new lane. Windows pair anchors only within a lane, and the hour telescopes per lane. The reserve signal is the most constrained fresh, live lane. Rollups move to `github-ledger-rollup/v2`, and a v1 rollup reads as absent so its hour is recomputed from rows.

This amends the design note's epoch model. That note is a dated record and is left as written.
