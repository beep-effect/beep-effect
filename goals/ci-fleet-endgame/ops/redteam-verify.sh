#!/usr/bin/env zsh
set -euo pipefail

# Usage:
#   redteam-verify.sh [ref] [expected-ami]
#
# ref defaults to REDTEAM_REF, then the current branch, then main. expected-ami
# defaults to REDTEAM_EXPECTED_AMI, and when both are absent it is resolved from
# the serving SSM pin (/beep-ci/controller/runner-ami-id) so the AMI_PIN gate is
# always evaluated whenever AWS is reachable; an unreadable pin fails the gate.
# When the run log exposes an instance id, teardown waits only for
# beep-ci-<instance-id>; otherwise it falls back to all controller runners
# observed during the run.

readonly repo="beep-effect/beep-effect"
readonly workflow="fleet-shadow-check.yml"
readonly poll_seconds=20
readonly max_run_polls=60
readonly teardown_limit=300
readonly required_gates=(
  A_APP_SECRET_SSM
  B_S3
  C_TAILNET_LAN
  D_CONTAINER_IMDS
  E_RUNNER_IMDS_HOOK
)

branch="${1:-${REDTEAM_REF:-}}"
if [[ -z "${branch}" ]]; then
  branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
fi
readonly branch="${branch:-main}"
expected_ami="${2:-${REDTEAM_EXPECTED_AMI:-}}"
readonly serving_pin_parameter="/beep-ci/controller/runner-ami-id"

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ci-fleet-redteam.XXXXXX")"
readonly work_dir
readonly seen_names="${work_dir}/seen-runner-names"
readonly runner_records="${work_dir}/runner-first-seen.tsv"
readonly run_log="${work_dir}/run.log"
readonly existing_run_ids="${work_dir}/existing-run-ids"
readonly current_run_ids="${work_dir}/current-run-ids"
touch "${seen_names}" "${runner_records}" "${existing_run_ids}" "${current_run_ids}"

result=1
ec2_assertion_skipped=0
finish() {
  if (( result == 0 )); then
    if (( ec2_assertion_skipped == 1 )); then
      echo "REDTEAM: PASS (EC2 termination assertion skipped: AWS credentials unavailable)"
    else
      echo "REDTEAM: PASS"
    fi
  else
    echo "REDTEAM: FAIL"
  fi
  rm -rf -- "${work_dir}"
}
trap finish EXIT

record_controller_runners() {
  local now_epoch now_iso runner
  now_epoch="$(date +%s)"
  now_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  while IFS= read -r runner; do
    [[ -n "${runner}" ]] || continue
    if ! grep -Fqx -- "${runner}" "${seen_names}"; then
      print -r -- "${runner}" >> "${seen_names}"
      printf '%s\t%s\t%s\n' "${runner}" "${now_epoch}" "${now_iso}" >> "${runner_records}"
      echo "runner first seen: ${runner} at ${now_iso}"
    fi
  done < <(gh api --paginate "repos/${repo}/actions/runners?per_page=100" \
    --jq '.runners[] | select(.name | startswith("beep-ci-")) | .name')
}

gh run list --workflow="${workflow}" --branch="${branch}" --limit 100 \
  --json databaseId --jq '.[].databaseId' > "${existing_run_ids}"
echo "dispatching ${workflow} on ${branch} with redteam=true"
gh workflow run "${workflow}" --ref "${branch}" -f redteam=true

run_id=""
for _ in {1..30}; do
  gh run list --workflow="${workflow}" --branch="${branch}" --limit 100 \
    --json databaseId --jq '.[].databaseId' > "${current_run_ids}"
  candidate=""
  while IFS= read -r candidate_id; do
    if ! grep -Fqx -- "${candidate_id}" "${existing_run_ids}"; then
      candidate="${candidate_id}"
      break
    fi
  done < "${current_run_ids}"
  if [[ -n "${candidate}" ]]; then
    run_id="${candidate}"
    break
  fi
  sleep 2
done
if [[ -z "${run_id}" ]]; then
  echo "failed to resolve the dispatched run id"
  exit 1
fi
echo "run id: ${run_id}"

run_completed=0
conclusion=""
for (( poll = 1; poll <= max_run_polls; poll++ )); do
  record_controller_runners
  # `status` is a read-only special parameter in zsh; never assign to it.
  run_status="$(gh run view "${run_id}" --json status --jq .status)"
  echo "run ${run_id}: ${run_status} (${poll}/${max_run_polls})"
  if [[ "${run_status}" == completed ]]; then
    run_completed=1
    conclusion="$(gh run view "${run_id}" --json conclusion --jq .conclusion)"
    break
  fi
  sleep "${poll_seconds}"
done

run_failed=0
gate_failed=0
if (( run_completed == 1 )); then
  echo "run conclusion: ${conclusion}"
  gh run view "${run_id}" --log > "${run_log}"
  echo "gate summary:"
  grep -E 'GATE [A-Z0-9_]+: (PASS|FAIL)$' "${run_log}" || true
  [[ "${conclusion}" == success ]] || run_failed=1
  for gate in "${required_gates[@]}"; do
    # Anchor to end-of-line: `gh run view --log` also renders the step's
    # `echo "GATE …: PASS"` source line, which a fixed-string count would double.
    if [[ "$(grep -Ec "GATE ${gate}: PASS$" "${run_log}" || true)" -ne 1 ]]; then
      echo "required gate did not report exactly one PASS: ${gate}"
      gate_failed=1
    fi
  done
  if grep -Eq 'GATE [A-Z0-9_]+: FAIL$' "${run_log}"; then
    gate_failed=1
  fi
else
  echo "run did not complete within $((max_run_polls * poll_seconds / 60)) minutes"
  run_failed=1
  gate_failed=1
fi

instance_id=""
if [[ -s "${run_log}" ]]; then
  # CSF-003 denies runner-user IMDS access; the workflow derives identity from RUNNER_NAME.
  instance_id="$(sed -n 's/.*Runner instance-id: \(i-[0-9a-f][0-9a-f]*\).*/\1/p' "${run_log}" | head -1)"
fi
deregistration_names="${seen_names}"
if [[ -n "${instance_id}" ]]; then
  scoped_runner_name="beep-ci-${instance_id}"
  deregistration_names="${work_dir}/deregistration-runner-names"
  print -r -- "${scoped_runner_name}" > "${deregistration_names}"
  other_observed="$(awk -v target="${scoped_runner_name}" '$0 != target { count++ } END { print count + 0 }' \
    "${seen_names}")"
  echo "deregistration scope: ${scoped_runner_name} (${other_observed} other controller runners observed and ignored)"
else
  echo "deregistration scope: all observed controller runners (instance id not recovered)"
fi
readonly deregistration_names

aws_available=0
if command -v aws >/dev/null 2>&1 && aws sts get-caller-identity >/dev/null 2>&1; then
  aws_available=1
  if [[ -z "${instance_id}" ]]; then
    echo "AWS credentials available, but the worker instance id was not recovered"
  fi
else
  ec2_assertion_skipped=1
  echo "AWS credentials unavailable; EC2 termination assertion skipped"
fi

# Without an operator-supplied expectation the gate binds the worker to the
# serving pin itself; a PASS must never certify an image nobody compared.
ami_pin_unresolved=0
if [[ -z "${expected_ami}" ]] && (( aws_available == 1 )); then
  pin_error="${work_dir}/ssm-serving-pin.error"
  if expected_ami="$(aws ssm get-parameter --region us-east-1 \
    --name "${serving_pin_parameter}" \
    --query 'Parameter.Value' --output text 2>"${pin_error}")" \
    && [[ "${expected_ami}" == ami-* ]]; then
    echo "AMI pin expectation resolved from ${serving_pin_parameter}: ${expected_ami}"
  else
    expected_ami=""
    ami_pin_unresolved=1
    echo "GATE AMI_PIN: FAIL (no expected AMI given and ${serving_pin_parameter} could not be read)"
    sed -n '1,8p' "${pin_error}"
    gate_failed=1
  fi
fi

if (( ami_pin_unresolved == 1 )); then
  :
elif (( aws_available == 0 )); then
  echo "AMI pin assertion skipped (AWS credentials unavailable)"
elif [[ -z "${instance_id}" ]]; then
  echo "GATE AMI_PIN: FAIL (worker instance id was not recovered)"
  gate_failed=1
else
  ami_error="${work_dir}/ec2-image-id.error"
  if actual_ami="$(aws ec2 describe-instances --region us-east-1 \
    --instance-ids "${instance_id}" \
    --query 'Reservations[0].Instances[0].ImageId' --output text 2>"${ami_error}")"; then
    if [[ "${actual_ami}" == "${expected_ami}" ]]; then
      echo "GATE AMI_PIN: PASS (${actual_ami})"
    else
      echo "GATE AMI_PIN: FAIL (expected ${expected_ami}, got ${actual_ami})"
      gate_failed=1
    fi
  elif grep -q 'InvalidInstanceID.NotFound' "${ami_error}"; then
    echo "GATE AMI_PIN: FAIL (instance already terminated before ImageId could be read)"
    gate_failed=1
  else
    echo "GATE AMI_PIN: FAIL (describe-instances failed before ImageId could be read)"
    sed -n '1,8p' "${ami_error}"
    gate_failed=1
  fi
fi

teardown_start="$(date +%s)"
teardown_failed=0
ec2_assertion_complete="${ec2_assertion_skipped}"
if (( aws_available == 1 )) && [[ -z "${instance_id}" ]]; then
  echo "EC2 termination assertion failed: worker instance id was not recovered"
  teardown_failed=1
  ec2_assertion_complete=1
fi
if [[ ! -s "${seen_names}" ]]; then
  echo "no ephemeral controller runner was observed during the run"
  teardown_failed=1
fi
while true; do
  roster="$(gh api --paginate "repos/${repo}/actions/runners?per_page=100" \
    --jq '.runners[].name')"
  remaining=0
  while IFS= read -r runner; do
    [[ -n "${runner}" ]] || continue
    if print -r -- "${roster}" | grep -Fqx -- "${runner}"; then
      remaining=1
      echo "waiting for runner deregistration: ${runner}"
    fi
  done < "${deregistration_names}"

  if (( aws_available == 1 )) && [[ -n "${instance_id}" ]]; then
    ec2_error="${work_dir}/ec2-describe.error"
    if ec2_state="$(aws ec2 describe-instances --region us-east-1 \
      --instance-ids "${instance_id}" \
      --query 'Reservations[0].Instances[0].State.Name' --output text 2>"${ec2_error}")"; then
      [[ -n "${ec2_state}" && "${ec2_state}" != None ]] || ec2_state="not-found"
      echo "EC2 ${instance_id}: ${ec2_state}"
      if [[ "${ec2_state}" == terminated || "${ec2_state}" == shutting-down || "${ec2_state}" == not-found ]]; then
        ec2_assertion_complete=1
      fi
    elif grep -q 'InvalidInstanceID.NotFound' "${ec2_error}"; then
      echo "EC2 ${instance_id}: not-found"
      ec2_assertion_complete=1
    else
      echo "EC2 termination assertion failed: describe-instances returned an unexpected error"
      sed -n '1,8p' "${ec2_error}"
      teardown_failed=1
      ec2_assertion_complete=1
    fi
  fi

  elapsed="$(($(date +%s) - teardown_start))"
  if (( remaining == 0 && ec2_assertion_complete == 1 )); then
    echo "ephemeral runner deregistered after ${elapsed}s"
    if (( ec2_assertion_skipped == 0 && teardown_failed == 0 )); then
      echo "EC2 termination asserted after ${elapsed}s"
    fi
    break
  fi
  if (( elapsed >= teardown_limit )); then
    if (( remaining == 1 )); then
      echo "ephemeral runner still registered after ${elapsed}s (limit ${teardown_limit}s)"
    fi
    if (( ec2_assertion_complete == 0 )); then
      echo "EC2 instance did not reach terminated, shutting-down, or not-found after ${elapsed}s"
    fi
    teardown_failed=1
    break
  fi
  sleep "${poll_seconds}"
done

if (( run_failed == 0 && gate_failed == 0 && teardown_failed == 0 )); then
  result=0
fi
exit "${result}"
