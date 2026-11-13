---
title: "RunnerFleet takes the launch template as a typed input until aws-extras lands"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners-composite"
reversal: "Replace the launchTemplate input with a RunnerLaunchTemplate declared inside the composite from RunnerLaunchSpec."
---

`@beep/alchemy-aws-extras` (and its `RunnerLaunchTemplate`) was not on `origin/main` when the composite was written. `RunnerFleet` therefore owns each pool's runner role and instance profile and renders its user data, and hands them to a caller-supplied `launchTemplate(spec)` effect that returns a launch template id and version (`RunnerLaunchSpec` -> `RunnerLaunchTemplateRef`). The template must require IMDSv2 and enable instance metadata tags. Once `RunnerLaunchTemplate` lands, the composite composes it by default and the input becomes an override.
