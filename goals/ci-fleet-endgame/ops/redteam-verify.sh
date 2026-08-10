#!/usr/bin/env zsh
set -euo pipefail

readonly repo="beep-effect/beep-effect"
readonly workflow="fleet-shadow-check.yml"
readonly branch="feat/ci-fleet-redteam"
readonly poll_seconds=20
readonly max_run_polls=60
readonly teardown_limit=300

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/ci-fleet-redteam.XXXXXX")"
readonly work_dir
readonly seen_names="${work_dir}/seen-runner-names"
readonly runner_records="${work_dir}/runner-first-seen.tsv"
readonly run_log="${work_dir}/run.log"
touch "${seen_names}" "${runner_records}"

result=1
finish() {
  if (( result == 0 )); then
    echo "REDTEAM: PASS"
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
    --jq '.runners[] | select((.name | startswith("beep-ec2-i-")) | not) | .name')
}

previous_run_id="$(gh run list --workflow="${workflow}" --branch="${branch}" --limit 1 \
  --json databaseId --jq '.[0].databaseId // empty')"
echo "dispatching ${workflow} on ${branch} with redteam=true"
gh workflow run "${workflow}" --ref "${branch}" -f redteam=true

run_id=""
for _ in {1..30}; do
  candidate="$(gh run list --workflow="${workflow}" --branch="${branch}" --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty')"
  if [[ -n "${candidate}" && "${candidate}" != "${previous_run_id}" ]]; then
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
  status="$(gh run view "${run_id}" --json status --jq .status)"
  echo "run ${run_id}: ${status} (${poll}/${max_run_polls})"
  if [[ "${status}" == completed ]]; then
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
  if [[ "$(grep -Ec 'GATE [A-Z0-9_]+: PASS$' "${run_log}" || true)" -ne 3 ]] || \
    grep -Eq 'GATE [A-Z0-9_]+: FAIL$' "${run_log}"; then
    gate_failed=1
  fi
else
  echo "run did not complete within $((max_run_polls * poll_seconds / 60)) minutes"
  run_failed=1
  gate_failed=1
fi

instance_id=""
if [[ -s "${run_log}" ]]; then
  instance_id="$(sed -n 's/.*IMDS instance-id: \(i-[0-9a-f][0-9a-f]*\).*/\1/p' "${run_log}" | head -1)"
fi
aws_available=0
if command -v aws >/dev/null 2>&1 && aws sts get-caller-identity >/dev/null 2>&1; then
  aws_available=1
  if [[ -z "${instance_id}" ]]; then
    echo "AWS credentials available, but the worker instance id was not recovered"
  fi
else
  echo "AWS credentials unavailable; skipping EC2 teardown corroboration"
fi

teardown_start="$(date +%s)"
teardown_failed=0
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
  done < "${seen_names}"

  if (( aws_available == 1 )) && [[ -n "${instance_id}" ]]; then
    ec2_state="$(aws ec2 describe-instances --region us-east-1 \
      --instance-ids "${instance_id}" \
      --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || true)"
    [[ -n "${ec2_state}" ]] || ec2_state="not-found"
    echo "EC2 ${instance_id}: ${ec2_state}"
  fi

  elapsed="$(($(date +%s) - teardown_start))"
  if (( remaining == 0 )); then
    echo "ephemeral runner deregistered after ${elapsed}s"
    break
  fi
  if (( elapsed >= teardown_limit )); then
    echo "ephemeral runner still registered after ${elapsed}s (limit ${teardown_limit}s)"
    teardown_failed=1
    break
  fi
  sleep "${poll_seconds}"
done

if (( run_failed == 0 && gate_failed == 0 && teardown_failed == 0 )); then
  result=0
fi
exit "${result}"
