#!/usr/bin/env zsh
# Operator side of Probe N (runner-trust-boundary P8, exception E1).
#
# Usage: post-release-replay.sh [ref]   (ref defaults to main; the runner group
# admits fleet-shadow-check.yml only at refs/heads/main)
#
# 1. Mint a one-time RSA-4096 key pair in a private scratch directory.
# 2. Dispatch fleet-shadow-check.yml with jit_post_release_replay=true and the
#    public half. On the worker, Probe N reads the JIT configuration as root,
#    disarms the poweroff shim, stops the listener gracefully, replays on the
#    same host, and writes its verdict plus the wrapped configuration to the
#    EC2 serial console only.
# 3. Poll the serial console with AWS credentials until the probe is done.
# 4. Wait until the instance is terminated and the runner has left the
#    organization roster, then unwrap the configuration in memory and replay it
#    from this host inside a throwaway container. The container is killed the
#    moment the listener reports a connection, so an accepted replay can never
#    run a job here.
# 5. Print sanitized verdicts. The JIT value and the private key never reach
#    stdout or any file outside the scratch directory, which is removed on exit.
#
# Needs: gh with workflow dispatch rights, AWS credentials that can call
# ec2:DescribeInstances and ec2:GetConsoleOutput (for example
# AWS_PROFILE=elpresidank-vault), docker, and openssl.
set -euo pipefail

readonly repo="beep-effect/beep-effect"
readonly org="${repo%%/*}"
readonly workflow="fleet-shadow-check.yml"
readonly region="${AWS_REGION:-us-east-1}"
readonly runner_image="ghcr.io/actions/actions-runner:${REPLAY_RUNNER_VERSION:-2.338.2}"
readonly ref="${1:-main}"

if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo "AWS credentials unavailable; the serial console cannot be read" >&2
  exit 78
fi

scratch="$(mktemp -d "${TMPDIR:-/tmp}/rtb-post-release.XXXXXX")"
readonly scratch
container="rtb-replay-$$"
cleanup() {
  docker kill "${container}" > /dev/null 2>&1 || true
  unset jit
  rm -rf -- "${scratch}"
}
trap cleanup EXIT
umask 077

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out "${scratch}/priv.pem" 2> /dev/null
openssl pkey -in "${scratch}/priv.pem" -pubout -out "${scratch}/pub.pem"
recipient_key="$(base64 -w0 "${scratch}/pub.pem")"

docker pull --quiet "${runner_image}" > /dev/null

gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
  --json databaseId --jq '.[].databaseId' > "${scratch}/before"
gh workflow run "${workflow}" --ref "${ref}" \
  -f jit_post_release_replay=true -f "replay_recipient_key=${recipient_key}"
run_id=""
for _ in {1..30}; do
  run_id="$(gh run list --workflow="${workflow}" --branch="${ref}" --limit 100 \
    --json databaseId --jq '.[].databaseId' | grep -Fvxf "${scratch}/before" | head -1 || true)"
  [[ -n "${run_id}" ]] && break
  sleep 2
done
[[ -n "${run_id}" ]] || { echo "dispatched run not found" >&2; exit 1; }
echo "run id: ${run_id}"

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
for _ in {1..80}; do
  aws ec2 get-console-output --region "${region}" --instance-id "${instance_id}" --latest \
    --query Output --output text 2> /dev/null | tr -d '\r' \
    | sed -n 's/^.*\(RTB-[A-Z][A-Z-]*.*\)$/\1/p' >> "${scratch}/console" || true
  grep -q '^RTB-DONE' "${scratch}/console" && break
  sleep 15
done
sort -u -o "${scratch}/console.notes" <(grep -E '^RTB-(NOTE|LISTENER-ENDED|VERDICT|WRAPPED|DONE)' "${scratch}/console" || true)
grep -E '^RTB-(NOTE|LISTENER-ENDED|VERDICT)' "${scratch}/console" | awk '!seen[$0]++'
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

# The value enters the container on stdin, never in argv or the environment here.
print -r -- "${jit}" | docker run --rm -i --name "${container}" --entrypoint bash "${runner_image}" \
  -c 'read -r v; cd /home/runner && exec timeout 120 ./bin/Runner.Listener run --jitconfig "$v"' \
  > "${scratch}/listener.log" 2>&1 &
replay=$!
verdict=""
for _ in {1..125}; do
  if grep -Eq 'Listening for Jobs|Connected to GitHub' "${scratch}/listener.log"; then
    docker kill "${container}" > /dev/null 2>&1 || true
    verdict="accepted"
    break
  fi
  line="$(grep -Em1 \
    -e 'A session for this runner already exists' \
    -e 'already (been )?(registered|used|configured|exists)' \
    -e '[Ii]nvalid (JIT|jit|runner) ?(config|configuration|token)' \
    -e '(token|configuration|JIT config|jitconfig) (has )?expired' \
    -e 'registration (has been )?deleted|deleted from the server' \
    -e '\bUnauthorized\b|\bForbidden\b' \
    -e '[Rr]unner (was )?not found' \
    -e '(access|permission) denied' \
    "${scratch}/listener.log" | tr -d '\r' || true)"
  if [[ -n "${line}" ]]; then
    docker kill "${container}" > /dev/null 2>&1 || true
    line="${line//${jit}/[redacted]}"
    line="$(print -r -- "${line}" | sed -E 's/--jitconfig[ =]+[A-Za-z0-9+\/_=-]+/--jitconfig [redacted]/g' | cut -c1-200)"
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
docker kill "${container}" > /dev/null 2>&1 || true
wait "${replay}" 2> /dev/null || true
if [[ -z "${verdict}" ]]; then
  first="$(sed -n '/[^[:space:]]/{s/\r$//;p;q;}' "${scratch}/listener.log" | cut -c1-200)"
  verdict="inconclusive (${first//${jit}/[redacted]})"
fi
unset jit
echo "SECOND-HOST: ${verdict} at $(date -u +%FT%TZ)"
[[ "${verdict}" == rejected* ]]
