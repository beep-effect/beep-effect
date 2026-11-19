---
title: "fleet-shadow-check is repointed for the overlap and deleted at the Pulumi cleanup"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Restore .github/workflows/fleet-shadow-check.yml from git."
---

Packet gate ruling, 2026-11-18. During the overlap `fleet-shadow-check.yml` is repointed to the new fleet (`runs-on: beep-fleet-heavy`, and its App-secret denial probe reads `/beep-fleet/prod/app/<parameter>` instead of `/github-action-runners/app/<parameter>`), as extra per-pool proof in cutover step 3 that a runner cannot read the App key or webhook secret. It is deleted in the cutover step-6 cleanup PR together with the Pulumi program, `fleet-lane-probe.yml` and the other old-fleet readers. Both edits are `.github/` changes and ride the lane PRs the operator merges.
