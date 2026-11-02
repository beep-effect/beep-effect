#!/usr/bin/env zsh
# Operator side of Probe N (runner-trust-boundary P8, exception E1).
#
# Usage: post-release-replay.sh [ref] [INT|KILL] [hold-minutes]
#   hold-minutes (KILL only, 0 to 15): keep an accepted replay session open with
#   Runner.Worker removed and, when the hold starts, dispatch one decoy
#   fleet-shadow-check run (no inputs, no secrets) to see whether GitHub offers
#   the hijacked session a job other than its original one.
#   (ref defaults to main; the
# runner group admits fleet-shadow-check.yml only at refs/heads/main. INT, the
# default, stops the listener the orderly way; KILL kills it without releasing
# its session and makes Probe N retry the same-host replay until the
# registration is deleted.)
#
# 1. Mint a one-time RSA-4096 key pair in a private scratch directory.
# 2. Dispatch fleet-shadow-check.yml with jit_post_release_replay=true and the
#    public half. On the worker, Probe N reads the JIT configuration as root,
#    disarms the poweroff shim, stops the listener (INT: orderly, releasing
#    the session; KILL: without release, retrying the same-host replay every
#    30 s through the window), replays on the same host, and writes each
#    attempt, its verdict and the wrapped configuration to the EC2 serial
#    console only. The console poll allows 50 minutes, above KILL's worst
#    case of about 38.
# 3. Poll the serial console with AWS credentials until the probe is done.
# 4. Wait until the instance is terminated and the runner has left the
#    organization roster, then unwrap the configuration in memory and replay it
#    from a second, disposable EC2 host: a one-off t3.small with no instance
#    profile in the fleet subnet and the ingress-free worker security group.
#    The configuration reaches it only through AWS-private user-data; the host
#    runs the checksum-verified official runner, kills it at the first
#    connection marker, writes its verdict to its own serial console, and
#    powers off into termination. An operator workstation never runs the
#    replay, so an accepted replay can only ever reach a throwaway VM.
# 5. Print sanitized verdicts. The JIT value and the private key never reach
#    stdout or any file outside the scratch directory, which is removed on exit.
#
# Needs: gh with workflow dispatch rights, AWS credentials that can call
# ec2:DescribeInstances, ec2:GetConsoleOutput, ec2:RunInstances and
# ec2:TerminateInstances (for example AWS_PROFILE=elpresidank-vault), and openssl.
set -euo pipefail

readonly repo="beep-effect/beep-effect"
readonly org="${repo%%/*}"
readonly workflow="fleet-shadow-check.yml"
readonly region="${AWS_REGION:-us-east-1}"
readonly runner_version="2.338.2"
# SHA-256 of actions-runner-linux-x64-2.338.2.tar.gz from the v2.338.2 release notes.
readonly runner_sha256="baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40"
readonly probe_subnet="${REPLAY_SUBNET_ID:-subnet-01bc446dbd3c68d84}"
readonly probe_security_group="${REPLAY_SECURITY_GROUP_ID:-sg-0ec4816fcd2af2d4b}"
readonly ref="${1:-main}"
readonly stop_signal="${2:-INT}"
readonly hold_minutes="${3:-0}"
[[ "${hold_minutes}" =~ ^[0-9]{1,2}$ ]] && (( hold_minutes <= 15 )) || { echo "hold-minutes must be 0 to 15" >&2; exit 64; }
[[ "${hold_minutes}" == 0 || "${stop_signal}" == KILL ]] || { echo "hold-minutes needs KILL" >&2; exit 64; }
[[ "${stop_signal}" == INT || "${stop_signal}" == KILL ]] || { echo "stop signal must be INT or KILL" >&2; exit 64; }

if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo "AWS credentials unavailable; the serial console cannot be read" >&2
  exit 78
fi

scratch="$(mktemp -d "${TMPDIR:-/tmp}/rtb-post-release.XXXXXX")"
readonly scratch
second_host=""
cleanup() {
  if [[ -n "${second_host}" ]]; then
    aws ec2 terminate-instances --region "${region}" --instance-ids "${second_host}" > /dev/null 2>&1 || true
  fi
  unset jit
  rm -rf -- "${scratch}"
}
trap cleanup EXIT
umask 077

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "${scratch}/priv.pem" 2> /dev/null
openssl pkey -in "${scratch}/priv.pem" -pubout -out "${scratch}/pub.pem"
recipient_key="$(base64 -w0 "${scratch}/pub.pem")"

gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
  --json databaseId --jq '.[].databaseId' > "${scratch}/before"
gh workflow run "${workflow}" --ref "${ref}" \
  -f jit_post_release_replay=true -f "replay_stop_signal=${stop_signal}" \
  -f "replay_hold_minutes=${hold_minutes}" \
  -f "replay_recipient_key=${recipient_key}"
run_id=""
for _ in {1..30}; do
  run_id="$(gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
    --json databaseId --jq '.[].databaseId' | grep -Fvxf "${scratch}/before" | head -1 || true)"
  [[ -n "${run_id}" ]] && break
  sleep 2
done
[[ -n "${run_id}" ]] || { echo "dispatched run not found" >&2; exit 1; }
echo "run id: ${run_id}"

decoy_run=""
instance_id=""
for _ in {1..90}; do
  runner_name="$(gh api "repos/${repo}/actions/runs/${run_id}/jobs" --jq '.jobs[0].runner_name // ""')"
  if [[ "${runner_name}" =~ '^beep-ci-(i-[0-9a-f]+)$' ]]; then
    instance_id="${match[1]}"
    break
  fi
  sleep 10
done
[[ -n "${instance_id}" ]] || { echo "worker never assigned" >&2; exit 1; }
echo "worker: beep-ci-${instance_id}"

# Accumulate RTB- lines from the serial console until the probe reports DONE.
: > "${scratch}/console"
for _ in {1..200}; do
  aws ec2 get-console-output --region "${region}" --instance-id "${instance_id}" --latest \
    --query Output --output text 2> /dev/null | tr -d '\r' \
    | sed -n 's/^.*\(RTB-[A-Z][A-Z-]*.*\)$/\1/p' >> "${scratch}/console" || true
  if [[ -z "${decoy_run}" ]] && grep -q '^RTB-HOLD-START' "${scratch}/console"; then
    gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
      --json databaseId --jq '.[].databaseId' > "${scratch}/before-decoy"
    gh workflow run "${workflow}" --ref "${ref}"
    for _ in {1..30}; do
      decoy_run="$(gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
        --json databaseId --jq '.[].databaseId' | grep -Fvxf "${scratch}/before-decoy" | head -1 || true)"
      [[ -n "${decoy_run}" ]] && break
      sleep 2
    done
    echo "decoy run: ${decoy_run:-not found} dispatched at $(date -u +%FT%TZ)"
  fi
  grep -q '^RTB-DONE' "${scratch}/console" && break
  sleep 15
done
if [[ -n "${decoy_run}" ]]; then
  for _ in {1..40}; do
    decoy="$(gh api "repos/${repo}/actions/runs/${decoy_run}/jobs?filter=all" \
      --jq '.jobs[0] | [.status, (.conclusion // "-"), (.runner_name // "-"), (.started_at // "-")] | @tsv')"
    [[ "${decoy}" == completed* ]] && break
    sleep 15
  done
  decoy_runner="$(print -r -- "${decoy}" | cut -f3)"
  echo "DECOY: run ${decoy_run}: ${decoy}"
  if [[ "${decoy_runner}" == "beep-ci-${instance_id}" ]]; then
    echo "DECOY-VERDICT: the hijacked registration received a different job"
  else
    echo "DECOY-VERDICT: the decoy ran elsewhere (${decoy_runner})"
  fi
fi
sort -u -o "${scratch}/console.notes" <(grep -E '^RTB-(NOTE|LISTENER-ENDED|ATTEMPT|HOLD-START|HOLD-END|VERDICT|WRAPPED|DONE)' "${scratch}/console" || true)
grep -E '^RTB-(NOTE|LISTENER-ENDED|ATTEMPT|HOLD-START|HOLD-END|VERDICT)' "${scratch}/console" | awk '!seen[$0]++'
grep -q '^RTB-WRAPPED' "${scratch}/console" || { echo "SECOND-HOST: inconclusive (no wrapped configuration on the console)"; exit 1; }

# Wrapped lines arrive in order within one console snapshot; keep first occurrences.
awk '/^RTB-K /{ if (!seen[$0]++) print $2 }' "${scratch}/console" | base64 -d > "${scratch}/kk"
awk '/^RTB-C /{ if (!seen[$0]++) print $2 }' "${scratch}/console" | base64 -d > "${scratch}/c"

echo "waiting for EC2 termination and deregistration"
for _ in {1..60}; do
  state="$(aws ec2 describe-instances --region "${region}" --instance-ids "${instance_id}" \
    --query 'Reservations[0].Instances[0].State.Name' --output text 2> /dev/null || echo not-found)"
  listed="$(gh api --paginate "orgs/${org}/actions/runners?per_page=100" --jq '.runners[].name' \
    | grep -Fxc "beep-ci-${instance_id}" || true)"
  if [[ ( "${state}" == terminated || "${state}" == not-found ) && "${listed}" == 0 ]]; then
    break
  fi
  sleep 20
done
echo "original host: EC2 ${state}, organization roster entries ${listed}, at $(date -u +%FT%TZ)"
[[ ( "${state}" == terminated || "${state}" == not-found ) && "${listed}" == 0 ]] \
  || { echo "SECOND-HOST: inconclusive (original host not gone)"; exit 1; }

openssl pkeyutl -decrypt -inkey "${scratch}/priv.pem" \
  -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
  -in "${scratch}/kk" -out "${scratch}/k"
jit="$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:${scratch}/k" -in "${scratch}/c")"
rm -f -- "${scratch}/k" "${scratch}/priv.pem"
[[ "${jit}" =~ '^[A-Za-z0-9+/=_-]+$' ]] || { echo "SECOND-HOST: inconclusive (unwrap failed)"; exit 1; }

# Second host. The user-data script carries the value; it is AWS-private, like
# the serial console, and dies with the instance. Nothing here prints it.
ami="$(aws ssm get-parameter --region "${region}" \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value --output text)"
{
  print -r -- '#!/bin/bash'
  print -r -- "jit='${jit}'"
  print -r -- "runner_version='${runner_version}'"
  print -r -- "runner_sha256='${runner_sha256}'"
  cat <<'RTB_SECOND'
set -uo pipefail
con() { printf 'RTB2-%s\n' "$*" > /dev/console 2>/dev/null || true; }
finish() { unset jit; rm -rf /root/rtb; con "DONE"; sleep 120; shutdown -P now; }
trap finish EXIT
con "NOTE $(date -u +%FT%TZ) second host booted"
mkdir -p /root/rtb && cd /root/rtb || exit 1
curl -fsSL -o runner.tgz \
  "https://github.com/actions/runner/releases/download/v${runner_version}/actions-runner-linux-x64-${runner_version}.tar.gz"
if ! printf '%s  runner.tgz\n' "${runner_sha256}" | sha256sum -c --quiet; then
  con "VERDICT second-host inconclusive (runner checksum mismatch)"; exit 1
fi
tar xzf runner.tgz && dnf install -y -q libicu > /dev/null 2>&1 || true
con "NOTE $(date -u +%FT%TZ) runner ${runner_version} verified; replaying"
# Absolute path: the pkill patterns below match the command line, so a
# relative ./bin launch would escape them.
(RUNNER_ALLOW_RUNASROOT=1 exec timeout 120 /root/rtb/bin/Runner.Listener run --jitconfig "${jit}" > listener.log 2>&1) &
replay=$!
verdict=""
for _ in $(seq 1 125); do
  if grep -Eq 'Listening for Jobs' listener.log; then
    kill -KILL "${replay}" 2> /dev/null || true; pkill -KILL -f /root/rtb/bin/Runner || true; verdict="accepted"; break
  fi
  line="$(grep -Em1 \
    -e 'A session for this runner already exists' \
    -e 'Failed to create (a )?session' \
    -e 'already (been )?(registered|used|configured|exists)' \
    -e '[Ii]nvalid (JIT|jit|runner) ?(config|configuration|token)' \
    -e '(token|configuration|JIT config|jitconfig) (has )?expired' \
    -e 'registration (has been )?deleted|deleted from the server' \
    -e '\bUnauthorized\b|\bForbidden\b' \
    -e '[Rr]unner (was )?not found' \
    -e '(access|permission) denied' \
    listener.log | tr -d '\r' || true)"
  if [[ -n "${line}" ]]; then
    kill -KILL "${replay}" 2> /dev/null || true; pkill -KILL -f /root/rtb/bin/Runner || true
    line="${line//${jit}/[redacted]}"
    line="$(printf '%s' "${line}" | sed -E 's/--jitconfig[ =]+[A-Za-z0-9+\/_=-]+/--jitconfig [redacted]/g' | cut -c1-200)"
    if [[ "${line}" == *'A session for this runner already exists'* ]]; then
      verdict="session-held (${line})"
    else
      verdict="rejected (${line})"
    fi
    break
  fi
  kill -0 "${replay}" 2> /dev/null || break
  sleep 1
done
kill -KILL "${replay}" 2> /dev/null || true; pkill -KILL -f /root/rtb/bin/Runner || true
wait "${replay}" 2> /dev/null || true
if [[ -z "${verdict}" ]]; then
  first="$(sed -n '/[^[:space:]]/{s/\r$//;p;q;}' listener.log | cut -c1-200)"
  verdict="inconclusive (${first//${jit}/[redacted]})"
fi
con "VERDICT second-host ${verdict}"
RTB_SECOND
} > "${scratch}/user-data"
unset jit

second_host="$(aws ec2 run-instances --region "${region}" --image-id "${ami}" \
  --instance-type t3.small --count 1 \
  --subnet-id "${probe_subnet}" --security-group-ids "${probe_security_group}" \
  --associate-public-ip-address \
  --instance-initiated-shutdown-behavior terminate \
  --metadata-options HttpTokens=required,HttpPutResponseHopLimit=1,HttpEndpoint=enabled \
  --user-data "file://${scratch}/user-data" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=rtb-second-host-probe},{Key=Project,Value=beep-ci},{Key=Purpose,Value=runner-trust-boundary-P8}]' \
  --query 'Instances[0].InstanceId' --output text)"
rm -f -- "${scratch}/user-data"
echo "second host: ${second_host} launched at $(date -u +%FT%TZ)"

: > "${scratch}/console2"
for _ in {1..60}; do
  aws ec2 get-console-output --region "${region}" --instance-id "${second_host}" --latest \
    --query Output --output text 2> /dev/null | tr -d '\r' \
    | sed -n 's/^.*\(RTB2-[A-Z][A-Z-]*.*\)$/\1/p' >> "${scratch}/console2" || true
  grep -q '^RTB2-DONE' "${scratch}/console2" && break
  sleep 15
done
awk '!seen[$0]++' "${scratch}/console2"
aws ec2 terminate-instances --region "${region}" --instance-ids "${second_host}" > /dev/null 2>&1 || true
echo "second host terminate requested at $(date -u +%FT%TZ)"
verdict="$(sed -n 's/^RTB2-VERDICT second-host //p' "${scratch}/console2" | head -1)"
echo "SECOND-HOST: ${verdict:-inconclusive (no verdict on the console)}"
[[ "${verdict}" == rejected* ]]
