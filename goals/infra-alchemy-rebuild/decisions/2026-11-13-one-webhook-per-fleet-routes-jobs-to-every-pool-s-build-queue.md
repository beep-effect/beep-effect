---
title: "One webhook per fleet routes jobs to every pool's build queue"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners"
reversal: "Give each pool its own webhook Lambda and WebhookRuntimeConfig with a single matcher."
---

The live fleet runs one terraform module per pool, so the heavy and shard-overflow pools each have a webhook and a webhook secret. The port follows upstream's multi-runner design instead: one webhook Lambda per fleet holds a matcher per pool (labels, match mode, build-queue URL), tries strict matchers (bidirectional or all-of) before any-of ones and sends the job to the first match. Two pools therefore need one App webhook URL and one secret; the overflow pool's separate secret parameter is not carried over.
