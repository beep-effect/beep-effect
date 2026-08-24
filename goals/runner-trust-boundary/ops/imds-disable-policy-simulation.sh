#!/usr/bin/env bash
# IAM's custom-policy simulator does not resolve the instance-profile policy's
# ${ec2:SourceInstanceARN} variable from context entries. Self-scoping is NOT
# simulator-provable; the helper's live pre-disable dry-runs prove it in Gate L.
set -euo pipefail

command -v aws >/dev/null 2>&1
command -v jq >/dev/null 2>&1

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
boundary_source="${script_dir}/beep-ci-fleet-boundary.v2.json"
region="${SIMULATION_REGION:-us-east-1}"
account_id="${SIMULATION_ACCOUNT_ID:-}"
if [[ -z "${account_id}" ]]; then
  account_id="$(aws sts get-caller-identity --query Account --output text)"
fi

probe_instance_arn="arn:aws:ec2:${region}:${account_id}:instance/i-boundary-probe"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/beep-imds-policy-simulation.XXXXXX")"
allow_policy="${work_dir}/allow.json"
boundary_policy="${work_dir}/boundary.json"
result_file="${work_dir}/result.json"
trap 'rm -rf -- "${work_dir}"' EXIT

cat > "${allow_policy}" <<'ALLOW_POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StandInIdentityCeiling",
      "Effect": "Allow",
      "Action": "ec2:ModifyInstanceMetadataOptions",
      "Resource": "*"
    }
  ]
}
ALLOW_POLICY

sed "s/<acct>/${account_id}/g" "${boundary_source}" > "${boundary_policy}"

simulate() {
  local label="$1"
  local endpoint="$2"
  local expected="$3"
  local decision
  local -a context_args=()

  if [[ "${endpoint}" != absent ]]; then
    context_args=(
      --context-entries
      "ContextKeyName=ec2:MetadataHttpEndpoint,ContextKeyValues=${endpoint},ContextKeyType=string"
    )
  fi

  # The unrestricted identity policy stands in for the role-policy ceiling so
  # the v2 permissions boundary's Deny is the only variable under simulation.
  # Both list parameters take policy documents as strings; a `file://` value is
  # parsed as JSON and its object members become list entries, which the API
  # rejects ("Member must have length less than or equal to 10").
  if ! aws iam simulate-custom-policy \
    --policy-input-list "$(cat "${allow_policy}")" \
    --permissions-boundary-policy-input-list "$(cat "${boundary_policy}")" \
    --action-names ec2:ModifyInstanceMetadataOptions \
    --resource-arns "${probe_instance_arn}" \
    "${context_args[@]}" \
    --output json \
    > "${result_file}"; then
    echo "SIMULATION ${label}: FAIL"
    return 1
  fi

  if ! decision="$(jq -er '.EvaluationResults[0].EvalDecision' "${result_file}")"; then
    echo "SIMULATION ${label}: FAIL"
    return 1
  fi
  if [[ "${decision}" != "${expected}" ]]; then
    echo "SIMULATION ${label}: FAIL"
    return 1
  fi
  echo "SIMULATION ${label}: PASS"
}

failed=0
simulate "endpoint_disabled" disabled allowed || failed=1
simulate "endpoint_enabled" enabled explicitDeny || failed=1
simulate "endpoint_absent" absent explicitDeny || failed=1
exit "${failed}"
