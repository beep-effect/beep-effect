# CI Fleet Endgame Plan

## Status

Status: `active`

## Execution order

The module deploy is hours-scale, not a weeks-scale program. It comes first;
the performance layer follows on its own track without becoming subordinate.

P2 cutover is gated on P3 and P4 landing first. Execution order is therefore
**P1 → P3 → P4 → P2 → P5 → P6**; phase ids and names remain stable because the
charter, signed decision record, and prior commits cite them.

The manual burst workers are non-ephemeral. Across the many jobs served during
a TTL, they accumulate a warm Turbo cache, warm bun store, and reused checkout.
One-job-one-VM workers discard all three after every job. Cutting over before a
remote cache exists would make every heavy job start cold: the security and
cost wins are real, but they would land alongside a speed loss.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Ratify + docs | complete | Graduate the signed decision record and bind decisions 57–63. | Active packet exists with co-primary charter and adoption contract. |
| P1 Bridge spike + deploy | complete | Mint the repo-scoped GitHub App, spike the Pulumi terraform-module bridge, and deploy a non-serving shadow label. | Module deploys through Pulumi, or the recorded fallback condition justifies a minimal Terraform root. |
| P2 Cutover | complete | Serve `beep-ec2-heavy` with ephemeral one-job-one-VM workers and demote manual burst scripts to break-glass. | Live worker passes lifecycle, teardown, trust, and red-team acceptance; heavy-lane wall time does not regress against the burst baseline. Landed 2026-08-11 (#666): 11/11 pickup gate, re-queue-to-fresh-runner proven live, burst registrations 75 → 6, PR waves ~20 min. Residue: the full guest-isolation red-team suite re-run on a live ephemeral worker stays open with the CSF-003 IMDS rework. |
| P3 Cache | complete | Ship trusted-write/PR-read-only asymmetric Turbo cache access. | Real PR jobs consume cache without obtaining write authority. Shipped 2026-08-13 (#673 infra + #674 CI wiring): 10/10 probe matrix including read-token PUT denial and direct-invoke HMAC rejection; first write-enabled main wave seeded 650+ artifacts; PR read hits recorded on the packet-split PR. |
| P4 Baked AMI | superseded | Ship lockfile-keyed worker images with the complete hosted toolbelt. | Continues as `goals/ci-fleet-residue` P0 (2026-08-13 split). |
| P5 Performance + ops | superseded | Ratchet resource weight, shard where measured, and expose pickup/cost/RSS/wall-time telemetry. | Continues as `goals/ci-lane-economics` (2026-08-13 split); P6 stays gated on its 20-minute outcome so this packet closes citing both charter halves. |
| P6 Yeet + close | pending | Drive the final PR mergeable, reflect, and close the packet. | Required checks green, zero unresolved threads, reflection valid, lifecycle completed-retained. |

### Why the asymmetric cache needs the ephemeral worker

If PR jobs can write the shared cache, a hostile PR can poison an artifact that
a later `main` build consumes: a supply-chain compromise through the build
cache. The cache therefore needs a read-write token for `main` and a read-only
token for PRs. That asymmetry is enforceable only on one-job-one-VM workers. On
a shared persistent runner, a write token can outlive its job on disk. P2 and
P3 are two halves of one argument.

### Measured startup budget

Probe `31352410248` took **77 seconds** from instance launch to its first job
step. Every job paid for EC2 boot, four sequential `dnf` rounds (docker, git,
jq, curl, and the CloudWatch agent), plus download and extraction of a 226 MB
runner tarball from S3. P4 bakes all of that into the image, targeting roughly
25–35 seconds where boot and agent registration dominate.

Going lower requires `pool_config`, trading idle cost for instant pickup. One
idle spot `m7i.2xlarge` is roughly $70–110/month against a $100 projection, so
a business-hours schedule is the affordable shape, not a 24/7 pool.

## Immediate next action

P1 is complete: probe `31352410248` proved one-job-one-VM lifecycle and
teardown, and red-team run `31354960508` passed all three gates. Next ship P3's
asymmetric cache, then P4's baked AMI, and only then execute P2 cutover without
regressing heavy-lane wall time against the burst baseline.

## Verification commands

```sh
test "$(wc -m < goals/ci-fleet-endgame/GOAL.md)" -le 4000
jq . goals/ci-fleet-endgame/ops/manifest.json
bun run beep goals doctor
git diff --check -- goals/ci-fleet-endgame
```
