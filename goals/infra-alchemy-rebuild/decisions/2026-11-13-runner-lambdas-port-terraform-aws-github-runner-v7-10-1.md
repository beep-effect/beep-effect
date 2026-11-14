---
title: "Runner Lambdas port terraform-aws-github-runner v7.10.1 without the features the live fleet leaves off"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners"
reversal: "Port the left-out upstream feature from lambdas/functions at v7.10.1 into the matching program and add its config field."
---

The handlers port `lambdas/functions/{webhook,control-plane,termination-watcher,gh-agent-syncer}` at v7.10.1, the version `infra/ci-runners/Pulumi.yaml` pins, as Effect programs over six service contracts (`GitHubAppAuth`, `GitHubRunners`, `Ec2Fleet`, `SsmStore`, `MessageQueue`, `RunnerBinaries`). Wire shapes stay upstream's: the SQS `ActionRequestMessage`, the `ghr:*` EC2 tags and the SSM token layout. Left out because the live fleet does not use them: dynamic `ghr-*` labels, dedicated hosts (`RunInstances`), the warm pool (`adjustPool`), the EventBridge webhook mode and queue-selection strategies other than first match, the AMI housekeeper, GitHub Enterprise base URLs in registration-token mode, and Powertools metrics and X-Ray. `jobQueuedCheck` defaults to false (the live value; upstream's default is true). Partial-launch, cap and retry semantics match upstream, including the on-demand failover for configured `CreateFleet` error codes.
