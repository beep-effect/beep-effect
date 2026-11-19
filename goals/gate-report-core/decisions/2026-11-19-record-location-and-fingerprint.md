---
title: "The repository root is the nearest Turbo config that extends nothing; the fingerprint is the Turbo hash or the run id"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Change the root rule and the fingerprint in the package-location module of the record library."
---

Twenty-seven packages have their own Turbo config, so the root is the nearest one with no `extends`. The input fingerprint is the Turbo task hash under Turbo and the run id otherwise; a digest of the head commit and uncommitted changes is left to the history goal, which is the only reader that compares fingerprints.
