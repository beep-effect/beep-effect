#!/usr/bin/env bash
# Tear down the supervised burst: terminate all tagged workers, drop dead
# runner registrations, and remind about the reaper TTL restore.
# Requires: authenticated aws session + gh with repo admin.
set -euo pipefail
export AWS_PAGER=""
export GH_PAGER=cat
REPO="beep-effect/beep-effect"

echo "== terminating burst instances (beep-ci=runner WITHOUT the fleet's ghr:environment tag)"
# The ephemeral fleet controller's workers share the beep-ci=runner tag but
# additionally carry the module's ghr:environment tag; terminating them here
# would kill live one-job VMs mid-job. Keep only untagged (burst) instances.
instance_ids_text="$(aws ec2 describe-instances \
  --filters "Name=tag:beep-ci,Values=runner" \
    "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down" \
  --query "Reservations[].Instances[?!not_null(Tags[?Key=='ghr:environment'].Value | [0])].InstanceId" \
  --output text)"
read -r -a instance_ids <<<"$instance_ids_text"

if ((${#instance_ids[@]})); then
  aws ec2 terminate-instances \
    --query 'TerminatingInstances[].[InstanceId,CurrentState.Name]' --output text \
    --instance-ids "${instance_ids[@]}"
  echo "== waiting for instance termination"
  aws ec2 wait instance-terminated --instance-ids "${instance_ids[@]}"
fi

echo "== deregistering burst runners"
gh api --paginate "repos/${REPO}/actions/runners?per_page=100" \
  --jq '.runners[] | select(.name | startswith("beep-ec2-i-")) | .id' \
  | xargs -r -I{} gh api -X DELETE "repos/${REPO}/actions/runners/{}"

echo "== remaining runners:"
gh api --paginate "repos/${REPO}/actions/runners?per_page=100" \
  --jq '.runners[] | [.name, .status] | @tsv'

cat <<'NOTES'
Restore the reaper TTL to steady-state (from infra/ci-runners). Steady-state
is 150 since the fleet cutover — it must clear the 120-minute Check lane
timeout so the reaper can never kill a fleet VM under a live job:
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" \
    pulumi config set ciRunners:reaperTtlMinutes 150 && \
  PULUMI_CONFIG_PASSPHRASE="$(op read 'op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE')" pulumi up --yes
NOTES
