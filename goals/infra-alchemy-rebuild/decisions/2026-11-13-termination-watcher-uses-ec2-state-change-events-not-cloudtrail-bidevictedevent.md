---
title: "Termination watcher uses EC2 state-change events, not CloudTrail BidEvictedEvent"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p2-github-runners"
reversal: "Add an EventBridge rule on the CloudTrail BidEvictedEvent and decode it in TerminationEvent."
---

Upstream's spot termination handler listens for the CloudTrail `BidEvictedEvent`, which needs a trail. The port deregisters on `EC2 Spot Instance Interruption Warning` and on `EC2 Instance State-change Notification` (`shutting-down`, `terminated`), both native EventBridge events, so no trail is required and an instance stopped for any reason is deregistered. One Lambda handles both events and the deregister-retry queue (busy runner: GitHub 422, re-queued after 300 s; a record that keeps failing reaches the queue's DLQ). Metrics are not ported.
