# GOAL: Finish the on-demand CI fleet and eliminate 20-minute jobs

Repo root: the current `beep-effect` checkout. Do not assume an absolute path;
several checkouts exist.

Outcome: deliver BOTH co-primary results — one ephemeral on-demand worker per
eligible job, and no required job that waits 20 minutes. Neither result is a
substitute for or subordinate to the other.

Read first:

- `goals/ci-fleet-endgame/README.md`
- `goals/ci-fleet-endgame/SPEC.md`
- `goals/ci-fleet-endgame/PLAN.md`
- `goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`
- `goals/speed-loop/research/GRILL-DECISIONS.md` decisions 57–63
- `goals/ci-fleet-endgame/ops/manifest.json`

Binding architecture: adopt then wrap
`github-aws-runners/terraform-aws-github-runner` v7.10.x, ephemeral
one-job-one-VM with JIT registration. Prefer Pulumi's terraform-module bridge
inside the existing infra program; use a minimal Terraform root only at the
recorded bridge-failure tripwire. Preserve existing VPC, IAM, egress, flow-log,
reaper, AMI-pinning, fork-PR, and cache-write boundaries.

Sequence strictly:

1. Module bridge spike and non-serving shadow deploy.
2. Cut over `beep-ec2-heavy`; keep the non-ephemeral manual launch path
   retired, with teardown retained only for cleanup.
3. Ship trusted-write/PR-read-only asymmetric Turbo cache.
4. Ship the lockfile-keyed baked AMI.
5. Use pickup, cost, infra-success, peak-RSS, and wall-time evidence to
   right-size and shard until no required job waits 20 minutes.
6. Drive the PR mergeable through Yeet, write the closeout reflection, and
   flip the packet lifecycle.

Use the authorized 1Password vault named `BEEP_CI`; route each
required secret through a complete `op://BEEP_CI/<item>/<field>` reference.
Never request, reveal, print, or persist raw secret values. Keep all runner
operations behind `beep runners` porcelain. Stop on any signed tripwire,
authority gap, unexpected standing cost, dual-writer infrastructure state, or
security-boundary regression.

Verify packet integrity with:

```sh
test "$(wc -m < goals/ci-fleet-endgame/GOAL.md)" -le 4000
jq . goals/ci-fleet-endgame/ops/manifest.json
bun run beep goals doctor
git diff --check -- goals/ci-fleet-endgame
```
