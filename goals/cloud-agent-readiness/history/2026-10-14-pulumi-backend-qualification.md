# Worker Pulumi backend qualification — 2026-10-14

## Result and backend provenance

Pulumi 3.267.0 on beep-worker now selects the existing DIY backend
`s3://oip-law-pulumi-state`, matching DankStation's current backend selection.
Current repository OIP stack configuration also names this bucket. The earlier
hosted-service login failure targeted the wrong backend for this workflow.

The worker's existing approved AWS environment file contains 1Password secret
references. Verified the exact `op run` operation with output suppressed before
using that route for AWS and Pulumi. No credential value was printed, copied
from an interactive workstation session or committed.

## Read-only proof

Within that credential environment:

1. AWS STS identity and S3 HeadBucket succeeded with output suppressed.
2. `pulumi login s3://oip-law-pulumi-state --non-interactive` succeeded and
   persisted the worker's backend selection.
3. `pulumi whoami -v` confirmed the selected S3 backend.
4. `pulumi stack ls --all --json` succeeded and listed four stacks:
   `organization/beep-ci-runners/production`,
   `organization/beep-storybook/production`,
   `organization/opip-web/production`, and `organization/opip-web/staging`.

The listing is a private worker cache artifact with mode 0600; no stack state or
secret configuration was exported. Legacy `opip-web` stack names remain intact.
No stack was selected, renamed, initialized, updated, refreshed or destroyed.

## Reusable credential route

Backend selection persists; resolved AWS credentials do not persist in the
shell. Future worker Pulumi operations use the approved environment explicitly:

```sh
op run --env-file="$HOME/.config/beep/secrets/aws.env" -- \
  pulumi stack ls --all
```

The hosted `PULUMI_ACCESS_TOKEN` reference is not needed for this S3 workflow.
Do not use an expired workstation AWS login or copy credential caches as a
substitute for the agent route. On an agent-side 1Password failure, run
`op-doctor` once and follow the canonical failure protocol.

## Boundaries and rollback

This proves AWS authentication, bucket access and Pulumi stack discovery. It
does not prove infrastructure write permissions, deployment/provider execution,
stack-secret decryption or state-locking behavior. No preview or deployment was
run. The CLI emitted an available-update notice; upgrading Pulumi was not needed
for this qualification.

The local backend selection can be changed with an explicit future
`pulumi login <backend>`; do not delete or migrate the existing S3 state to undo
local configuration. Broader headless portability and fleet readiness remain
open in the goal.
