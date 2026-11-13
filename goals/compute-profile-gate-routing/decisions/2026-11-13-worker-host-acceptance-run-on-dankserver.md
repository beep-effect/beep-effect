---
title: "Worker-host acceptance run on dankserver"
date: 2026-11-13
lane: "test/compute-profile-worker-acceptance"
pullRequest: 3267
reversal: "Delete the research note; it records measurements and changes no behaviour."
---

On dankserver (worker, 7 GiB ceiling) the probe, the profile-driven catalog hook skip, the worker final-check posture (six hosted-only gates skipped with compute-profile=worker), yeet open with the compute-profile-worker label and the hosted Catalog Regeneration commit all worked, and no lane process exceeded 1.5 GB. Hosted Check and Lint Policy then went red on the lane's own test (TS377032 and an EV002 per-test Layer provide), which the worker could only learn from hosted CI about 36 minutes after the push; yeet ready refused on pending and on red gates, including after an operator flipped the PR ready. Not proven: hosted green after regeneration (the bot push leaves every workflow action_required pending maintainer approval), a forceLocal receipt (fallow under a 3 GiB cap did not finish in 29.5 minutes and was stopped to protect T3), and admission facts (no admission journal row is written for worker-lane runs). Evidence: research/2026-11-13-worker-host-acceptance.md.
