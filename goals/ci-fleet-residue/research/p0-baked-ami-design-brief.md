# P0 design brief — `beep runners bake` (lockfile-keyed baked AMI)

Status: design grounded in the live rails (2026-08-13). Implementation not
started. Ships as its own scoped PR; the deploy that flips the fleet to the
baked image is operator-gated (pulumi recipe + live probes).

## The rails (verified in source)

- `infra/src/CiFleetController.ts` resolves the worker AMI from Pulumi config
  `ciFleetController:amiId` (`Option`, schema `AmiId`), falling back to the
  public AL2023 SSM parameter
  (`/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`),
  and publishes the resolved id to SSM `/beep-ci/controller/runner-ami-id`
  (`dataType: aws:ec2:image`) which the terraform module consumes via
  `ami.id_ssm_parameter_arn`.
- `infra/src/CiRunners.ts` (burst rails) documents the same entry:
  "production stacks must pin `ciRunners:amiId`; the lockfile-keyed
  baked-AMI follow-up enters through this same override."
- Image Builder and Packer were REJECTED in the decision record
  (`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`).
  Bake drives plain EC2 through the existing launch-template rails.

## What the bake absorbs (the ~2.2m setup floor)

1. The toolbelt post-install (`dnf install -y git unzip zip jq`) — currently
   inlined into module user-data per boot (`runnerToolbeltPostInstall`).
2. The module user-data's own docker + libicu install.
3. Bun toolchain install (setup-bun's download/unzip).
4. A warmed bun package store for the repo's `bun.lock` so
   `bun install --frozen-lockfile` on a fresh checkout is near-instant.
   This is the "lockfile-keyed" part: the image is only valid for the
   `bun.lock` it was baked against.

Cross-runner tool-cache poisoning dies because each ephemeral VM boots an
immutable image instead of mutating a shared warm cache.

## Command shape (`beep runners bake`)

New CLI command group `Runners` in `packages/tooling/tool/cli` (schema-first:
config/report schemas → service contract → impl):

1. Resolve base AMI (AL2023 via the same SSM parameter the controller uses).
2. Launch one temporary instance in the runner VPC/subnet with the worker
   security group; run the bake script (toolbelt + docker/libicu + bun +
   `bun install` warm against the repo's committed `bun.lock`).
3. Create the AMI, tagged with the lockfile key:
   `beep-ci:lockfile-sha256=<sha256(bun.lock)>`, plus `App=ci-runners`,
   `ManagedBy=beep-runners-bake`, base AMI id, and bake date.
4. Wait for `available`, terminate the temp instance (teardown must be
   unconditional — reaper-tag the instance at launch).
5. Emit a machine-readable bake report artifact (schema-encoded through a
   JsonStringCodec — see the P3 closeout-writer lesson) with the new AMI id,
   lockfile sha, and the exact pulumi config command to pin it.

Staleness check (`beep runners bake --check`): compare the live pin's
lockfile tag against `sha256(bun.lock)` at HEAD; exit nonzero on mismatch so
a CI lane or operator ritual can demand a rebake when `bun.lock` moves.

## Rollback path (must be proven, per exit criteria)

The pin is one Pulumi config value. Rollback = restore the previous
`ciFleetController:amiId` (or unset → AL2023 latest + per-boot installs,
the exact posture running today). The bake report records the prior pin so
rollback is a copy-paste. Baked AMIs are retained (not deregistered) for at
least one generation.

## Hard rails carried over

- Never weaken fork-PR, cache-write, IAM, egress, or teardown protections.
- The bake instance gets the minimal instance profile it needs (SSM only if
  used for command execution), never the runner's role with wider scope.
- Deploy of the pin runs the documented pulumi recipe (op-read passphrase,
  `aws login` browser auth) and is gated on live probes (a real heavy-lane
  job on the baked image + Gate E acceptance), not the config diff.

## Implementation substrate (verified)

Neither the CLI package nor `infra/` depends on an AWS SDK; the burst rails
(`goals/speed-loop/ops/runner-burst/launch-burst-runners.sh`) drive the
plain `aws` CLI from an operator shell. `beep runners bake` should do the
same: an Effect CLI command shelling out to `aws` via the repo's
`ChildProcessSpawner` conventions (exactly how Yeet drives `git`/`gh`),
zero new dependencies. The bake script itself follows the burst user-data
conventions: reaper-tag + `shutdown -P` backstop at launch, `set -euo
pipefail` inside the script file, tokens/secrets never persisted.

## Open questions for implementation

- Bake driver: SSM RunCommand vs user-data + wait — SSM needs
  `enable_ssm_on_runners`-style profile on the bake instance only.
- Whether the burst rails (`ciRunners`, Ubuntu-based) also get a baked
  variant now or stay on per-boot setup (they are break-glass since the
  module cutover; suggest: defer).
- Where the warmed bun store lives so the runner user (`ec2-user`) owns it.
