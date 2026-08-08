# CI Fleet Endgame Plan

## Status

Status: `active`

## Execution order

The module deploy is hours-scale, not a weeks-scale program. It comes first;
the performance layer follows on its own track without becoming subordinate.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Ratify + docs | complete | Graduate the signed decision record and bind decisions 57–63. | Active packet exists with co-primary charter and adoption contract. |
| P1 Bridge spike + deploy | pending | Mint the repo-scoped GitHub App, spike the Pulumi terraform-module bridge, and deploy a non-serving shadow label. | Module deploys through Pulumi, or the recorded fallback condition justifies a minimal Terraform root. |
| P2 Cutover | pending | Serve `beep-ec2-heavy` with ephemeral one-job-one-VM workers and demote manual burst scripts to break-glass. | Live worker passes lifecycle, teardown, trust, and red-team acceptance. |
| P3 Cache | pending | Ship trusted-write/PR-read-only asymmetric Turbo cache access. | Real PR jobs consume cache without obtaining write authority. |
| P4 Baked AMI | pending | Ship lockfile-keyed worker images with the complete hosted toolbelt. | Setup floor and cross-runner tool-cache poisoning are removed. |
| P5 Performance + ops | pending | Ratchet resource weight, shard where measured, and expose pickup/cost/RSS/wall-time telemetry. | No required job waits 20 minutes and evidence supports ongoing right-sizing. |
| P6 Yeet + close | pending | Drive the final PR mergeable, reflect, and close the packet. | Required checks green, zero unresolved threads, reflection valid, lifecycle completed-retained. |

## Immediate next action

Execute P1 only: validate 1Password secret references through the authorized
Developer Environment flow, mint/install the repo-scoped GitHub App, then
prove the module on a non-serving shadow label through the existing Pulumi
backend. Do not start cache or AMI work before the module is deployed.

## Verification commands

```sh
test "$(wc -m < goals/ci-fleet-endgame/GOAL.md)" -le 4000
jq . goals/ci-fleet-endgame/ops/manifest.json
bun run beep goals doctor
git diff --check -- goals/ci-fleet-endgame
```
