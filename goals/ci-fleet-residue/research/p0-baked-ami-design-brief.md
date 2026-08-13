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
   security group AND an explicit public IPv4 association: the runner
   subnets set `mapPublicIpOnLaunch: false` (the controller compensates
   with `associate_public_ipv4_address: true`), so a bare `RunInstances`
   guest there has no internet path and every download (dnf, bun, git,
   SSM if used) dies. Run the bake script (toolbelt + docker/libicu + bun
   pinned to the repo's `.bun-version` + `bun install` warm against the
   committed `bun.lock`).
3. Create the AMI, tagged with the staleness key:
   `beep-ci:lockfile-sha256=<sha256(bun.lock)>` AND
   `beep-ci:bun-version=<.bun-version>`, plus `App=ci-runners`,
   `ManagedBy=beep-runners-bake`, base AMI id, and bake date. The image
   carries the Bun executable as well as the package store, so the
   lockfile sha alone is not the invalidation key — a `.bun-version` bump
   with unchanged dependencies must also read as stale.
4. Wait for `available`, terminate the temp instance. Teardown must be
   unconditional: launch with the reaper's exact filter tags
   (`beep-ci=runner`, matching `runner_ec2_tags`) plus a
   `beep-ci:bake=true` marker, so an interrupted bake is swept by the
   existing reaper instead of leaking a running instance; keep the
   in-guest `shutdown -P` backstop from the burst conventions too.
5. Emit a machine-readable bake report artifact (schema-encoded through a
   JsonStringCodec — see the P3 closeout-writer lesson) with the new AMI id,
   lockfile sha, bun version, and the exact pulumi config command to pin it.

Activation is NOT just the pin. Pinning `amiId` alone leaves every
per-boot/per-job setup path running against the baked image and deletes no
floor: the controller still inlines `runnerToolbeltPostInstall` and the
module's docker/libicu user-data, and
`.github/actions/setup-monorepo-ci/action.yml` still downloads bun via
setup-bun, restores the Bun cache, and runs `bun install`. The activation
change therefore lands as a coordinated set: (a) the pin, (b) controller
user-data paths become baked-image no-ops (marker-file check, still
subshell-scoped), and (c) the workflow setup action short-circuits its
download/install steps when the baked marker + matching staleness key are
present. Rollback restores all three together (unset pin -> per-boot
installs resume; the workflow path re-activates on missing marker).

Staleness check (`beep runners bake --check`): compare the live pin's
lockfile AND bun-version tags against `sha256(bun.lock)` and `.bun-version`
at HEAD; exit nonzero on any mismatch so a CI lane or operator ritual can
demand a rebake when either moves.

## Rollback path (must be proven, per exit criteria)

Rollback = restore the previous `ciFleetController:amiId` (or unset ->
AL2023 latest) AND revert the coordinated activation set from the section
above in the same deploy — the user-data no-op markers and the workflow
short-circuit both fail open (missing marker -> per-boot installs resume),
which is the exact posture running today. The bake report records the
prior pin so the config half is a copy-paste. Baked AMIs are retained (not
deregistered) for at least one generation.

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
