#!/usr/bin/env bash
# Tear down the supervised burst: terminate all tagged workers, drop dead
# runner registrations, and remind about the reaper TTL restore.
# Requires: authenticated aws session + gh with repo admin.
set -uo pipefail
export AWS_PAGER=""
export GH_PAGER=cat
REPO="beep-effect/beep-effect"

echo "== terminating all beep-ci=runner instances"
aws ec2 describe-instances \
  --filters "Name=tag:beep-ci,Values=runner" "Name=instance-state-name,Values=running,pending" \
  --query 'Reservations[].Instances[].InstanceId' --output text \
  | xargs -r aws ec2 terminate-instances --query 'TerminatingInstances[].[InstanceId,CurrentState.Name]' --output text --instance-ids

echo "== deregistering offline runners"
gh api "repos/${REPO}/actions/runners" --jq '.runners[] | select(.status == "offline") | .id' \
  | xargs -r -I{} gh api -X DELETE "repos/${REPO}/actions/runners/{}"

echo "== remaining runners:"
gh api "repos/${REPO}/actions/runners" --jq '.runners[] | [.name, .status] | @tsv'

cat <<'NOTES'
Restore the reaper TTL to steady-state (from infra/ci-runners):
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" \
    pulumi config set ciRunners:reaperTtlMinutes 90 && \
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" pulumi up --yes
NOTES
