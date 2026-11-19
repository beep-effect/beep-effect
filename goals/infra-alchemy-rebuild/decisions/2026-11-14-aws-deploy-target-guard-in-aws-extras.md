---
title: "The AWS account and region guard lives in @beep/alchemy-aws-extras; the stack provides DockerLive"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Inline requireDeployTarget back into packages/tooling/infra/ci-runners/src/Guards.ts and delete DeployTarget.ts from aws-extras."
---

`@beep/alchemy-aws-extras` gains `DeployTarget` (`AwsAccountId`, the `DeployTarget` model and `requireDeployTarget`), and `@beep/infra-ci-runners` uses it instead of a copy of the cost-controls account schema and guard. Fallow's new-code duplication gate flagged the copy; the shared module is the single home a third AWS stack will need too. The guard compares the resolved `AWSEnvironment` account and region with the target and fails with a `ConfigError` naming the stack and target, never the credentials. `@beep/infra-cost-controls` keeps its own guard for now: changing it would run that stack's push-to-main deploy during the window-5 measurement; adopting the shared module there is a small later PR.

Also: `Lambda.FunctionProvider` needs a `Docker` service (it supports container-image functions), so the stack's provider layer provides `DockerLive` from `@alchemy.run/docker`, added to the root catalog at the same `2.0.0-beta.87` as the other `@alchemy.run/*` pins (D13). The layer is lazy: nothing runs `docker` unless a function is built from an image, and none is.
