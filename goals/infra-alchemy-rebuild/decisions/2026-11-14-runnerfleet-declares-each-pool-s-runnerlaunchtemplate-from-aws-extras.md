---
title: "RunnerFleet declares each pool's RunnerLaunchTemplate from aws-extras"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p2-github-runners-composite"
reversal: "Restore a caller-supplied launchTemplate(spec) effect returning a template id and version, built from a RunnerLaunchSpec the composite hands out."
---

With `@beep/alchemy-aws-extras` on `main` (#3292), `RunnerFleet` declares one `RunnerLaunchTemplate` per pool instead of taking a caller-built template id. The composite sets what it owns: the pool instance profile, the rendered user data, and metadata options that require IMDSv2 with instance metadata tags enabled (the user data reads `ghr:token_path` from them, hop limit 1 as upstream). The caller passes `launchTemplate`, a `Pick` of `RunnerLaunchTemplateProps` (`imageId`, `securityGroupIds`, `associatePublicIpAddress`, `blockDeviceMappings`, `ebsOptimized`, `tags`); instance types and Spot or on-demand capacity stay per launch in scale-up `CreateFleet`. Scale-up launches the template default version as a number, which the provider moves on every update, so a template change also rolls the scale-up runtime config. The earlier typed-input decision for this lane never merged and is replaced by this one.
