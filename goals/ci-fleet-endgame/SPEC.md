# CI Fleet Endgame Spec

## Objective

Deliver both co-primary outcomes:

1. **On-demand worker-per-job**: a system that spins up one worker per job on
   demand — "the single biggest win even if we struggle to get under
   20 minute jobs."
2. **No 20-minute jobs**: "Endgame should just mean we don't wait 20 minutes
   for any job."

Neither deliverable is subordinate to the other.

## Adopted architecture

Adopt then wrap `github-aws-runners/terraform-aws-github-runner` v7.10.x in
ephemeral one-job-one-VM mode with JIT registration. Preserve the existing
Pulumi stack's VPC, egress, IAM, flow-log, reaper, AMI-pinning, and
launch-template guardrails as module inputs or adjacent controls. Prefer the
Pulumi terraform-module bridge; use a minimal Terraform root only if the
bridge cannot consume the module's release artifacts or provider surface.

All runner operations route through `beep runners` porcelain. The asymmetric
Turbo cache and lockfile-keyed baked AMI remain repo-owned performance work.

## Source hierarchy

1. Operator charter and decisions 57–63 in
   `goals/speed-loop/research/GRILL-DECISIONS.md`.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `research/runner-endgame-decision-record.md`.
4. Governing infrastructure, security, and package standards.
5. This `SPEC.md`.
6. `PLAN.md` and `GOAL.md`.

Higher sources outrank lower sources when they conflict.

## Target surfaces

- Existing `infra/` Pulumi program and CI-runner stack.
- `beep runners` operator porcelain and durable lane-control state.
- GitHub Actions runner labels, trust controls, and observability.
- Asymmetric Turbo cache, lockfile-keyed baked worker AMI, peak-RSS capture,
  resource-weight ratchets, and lane sharding.
- This packet's research, evidence, and closeout artifacts.

## Constraints

- Module deployment comes first and is treated as hours-scale; performance
  wrapping follows on its own track.
- Workers use only the scoped, permissions-boundaried, deny-by-default,
  self-referential runner role ratified in decision 57; the single-use JIT
  token is deleted at registration.
- GitHub App scope stays beep-effect-only. Secret material uses SSM
  SecureString under KMS with `op://BEEP_CI` as source-of-truth reference;
  never expose raw values.
- Preserve scale-to-zero cost gates, diversified spot posture, capacity-error
  on-demand fallback, reaper TTL authority, and fork-PR trust boundaries from
  the decision record.
- PR code never writes the shared Turbo cache; trusted merged code writes and
  PR jobs receive read-only cache access.
- No controller ceremony may defer the co-primary no-20-minute-jobs outcome.

## Acceptance criteria

- [ ] Each eligible CI job receives an ephemeral on-demand worker without
      manual AWS or GitHub commands; teardown/orphan reconciliation is proven.
- [ ] The live red-team suite fails closed from a guest and trust boundaries
      match decisions 57 and 60.
- [ ] No required job waits 20 minutes under the measured acceptance workload.
- [ ] Trusted-write/PR-read-only cache behavior and lockfile-keyed AMI behavior
      are proven against real jobs.
- [ ] Pickup latency, cost, infra success, peak RSS, and lane wall time are
      recorded well enough to drive right-sizing and sharding.
- [ ] PR reaches mergeable through Yeet with zero unresolved review threads.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/ci-fleet-endgame/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ci-fleet-endgame/ops/manifest.json` | Passes |
| Packet integrity | `bun run beep goals doctor` | Passes |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at closeout |
| Whitespace | `git diff --check -- goals/ci-fleet-endgame` | Passes |

## Stop conditions

- Any tripwire in `research/runner-endgame-decision-record.md` fires.
- The Pulumi bridge and fallback root would become dual writers of shared
  resources.
- Required authority, secret-reference flow, or cost approval is unavailable.
- A change would weaken fork-PR, cache-write, IAM, egress, or teardown rails.
