# Supervised runner burst — interim runbook

Manual capacity for the `beep-ec2-heavy` lanes until the controller (ledger
#91) automates dispatch. Battle-tested 2026-08-08 landing an eight-PR merge
wave. These scripts are the vetted-porcelain path the repo's permission
policy expects; their successor is a `beep runners` CLI command.

## Preconditions

- Authenticated `aws login` session (any admin identity — the scripts switch
  to the `beep-ci-runner-launcher` identity for launches internally).
- `gh` authenticated with repo admin (mints single-use registration tokens).
- `op` unlocked (launcher keys resolve from `op://BEEP_CI/aws-runner-launcher`).
- Reaper TTL raised for the burst window (launch script prints the command;
  default 90 min WILL kill long-lived burst workers mid-job).

## Burst lifecycle

1. `bash launch-burst-runners.sh <count>` — mints tokens, launches spot
   workers from launch template `beep-ci-runner` (alternating fleet subnets),
   waits ~90s, lists registrations. Success: `beep-ec2-i-*` rows `online`.
2. Work happens. Watch for **zombie attrition**: compare
   `gh api .../actions/runners` online count against
   `aws ec2 describe-instances` running count; a VM without an agent is a
   zombie — terminate it and launch a replacement. Non-ephemeral agents on
   long-lived guests zombie silently (three times in one night); this is why
   the controller uses one-job-one-VM ephemeral.
3. `bash teardown-burst-runners.sh` — terminates all tagged workers, drops
   offline registrations, prints the TTL-restore command.

## Known failure modes (all lived, see ledger runner-burst receipts)

- Admin-identity launches fail on a legacy deny (`FreedomFramework-CI`,
  t2.micro-only) — launches must use the launcher identity (scripts do).
- Fresh spot use in a new account: mint `AWSServiceRoleForEC2Spot` once.
- Do NOT approve outside-collaborator workflow runs while burst workers are
  registered — non-ephemeral runners would execute them.
- Cancelling a PR's run does not stop in-flight jobs instantly; a worker can
  stay busy on a closed PR's job — cancel the run explicitly.
