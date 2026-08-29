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

State (2026-08-13): P0-P3 are complete — the fleet serves `beep-ec2-heavy`
one-job-one-VM and the asymmetric Turbo cache is live (#673/#674). P4 and P5
are superseded: the baked AMI continues in `goals/ci-fleet-residue` and the
20-minute outcome in `goals/ci-lane-economics`. Do NOT execute P3, P4, or P5
from this packet.

The only remaining work here is P6: once ci-lane-economics delivers the
20-minute outcome, drive the final PR mergeable through Yeet, write the
closeout reflection citing both charter halves, and flip the packet
lifecycle to completed-retained.

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
