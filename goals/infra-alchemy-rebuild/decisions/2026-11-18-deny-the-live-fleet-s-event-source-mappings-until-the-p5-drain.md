---
title: "Deny the live fleet's event-source mappings until the P5 drain"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
pullRequest: 3386
reversal: "remove DenyLiveFleetMappings in the P5 drain+destroy PR"
---

The deploy role grants `lambda:TagResource` on event-source mappings for tag on create, and Update/Delete need only the ownership tags plus `lambda:FunctionArn` on a fleet function. Whether `lambda:FunctionArn` evaluates the requested or the current target is not documented, so a tagged foreign mapping could be retargeted to a fleet function. The account holds six foreign mappings: the live Pulumi fleet's `beep-ci-*` and `beep-ovf-*` scale-up, job-retry and deregister-retry. A stalled live scale-up stalls production CI, so the driver ruled option B (2026-11-18). `DenyLiveFleetMappings` in `DeployRolePolicy.ts` denies `lambda:TagResource`, `UntagResource`, `UpdateEventSourceMapping` and `DeleteEventSourceMapping` on exactly those six mapping ARNs, read with `aws lambda list-event-source-mappings`. It is keyed on the resource ARNs alone, with no condition, because the `lambda:FunctionArn` form is ambiguous on update and `TagResource` does not document the key. Tag on create for the stack's own mappings is unchanged. The cutover decision re-reads the mappings before step 1b and before the drain, and holds if a UUID changes. Simulations #29a to #29d.
