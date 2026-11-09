---
title: "Org runner group and GitHub App webhook URL stay outside IaC"
date: 2026-11-09
lane: "goals/infra-alchemy-rebuild-p1"
reversal: "Add RunnerGroup and an App-webhook resource over distilled actions/apps to @beep/alchemy-github-runners and adopt both objects."
---

Open question 4 of the P0 matrix. The `beep-ec2-heavy` org runner group and the GitHub App webhook URL stay outside IaC: the runner group remains an org setting recorded in the ci-runners runbook, and the App webhook URL is set by the `beep github app` command family that D10 already makes the App's owner. `@alchemy.run/github` has no runner-group or App resource and token-only credentials, so owning either means two repo resources with App-JWT auth for two objects that change once per fleet rebuild. Revisit in P5 only if a runbook step drifts in practice.
