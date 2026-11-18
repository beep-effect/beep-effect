/**
 * The runner post-install the live fleet runs, ported verbatim: the
 * toolbelt fallback, the per-job IMDS hook and the fail-closed IMDS
 * workload boundary.
 *
 * **Details**
 *
 * The composite's user data extracts the runner into `/opt/actions-runner`,
 * runs the post-install, then starts `./run.sh` as the run-as user, the same
 * order the terraform module used. The boundary therefore still wraps
 * `run.sh`: it disables IMDS before the runner accepts a job and powers the
 * instance off when the runner exits (shutdown behavior `terminate`). The
 * Pulumi bridge escaped `${` as `$${` for Terraform's HCL templates; the
 * composite passes the script through unchanged, so no escaping applies.
 *
 * @packageDocumentation
 * @category constants
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import type * as IAM from "@alchemy.run/aws/IAM";

// The runner agent and every job step both run as this user (ImageSettings.runAs in prod).
const runnerRunAs = "ec2-user";

const runnerToolbeltPostInstall = `(
  set -eu
  if [ -f /etc/beep-ci/baked-runner ]; then
    logger -t beep-ci-toolbelt "baked runner image; toolbelt already present"
  else
    dnf install -y git unzip zip jq
    logger -t beep-ci-toolbelt "installed git unzip zip jq for heavy lanes"
  fi
)
`;

// CSF-003 rework: a per-job ACTIONS_RUNNER_HOOK_JOB_STARTED hook installs the
// uid-scoped IMDS DROP after the agent has registered (JIT config happens as
// root at boot; the agent's own traffic is GitHub HTTPS long-poll, never IMDS
// once running) but before any job step executes. The hook process runs as
// runnerRunAs with no CAP_NET_ADMIN, so the privilege transition is explicit:
// a wrapper execs the root-owned installer through a sudoers entry scoped to
// exactly that one non-writable script. Re-invocation from a malicious step is
// harmless — the installer is idempotent and only re-asserts the DROP. Every
// firewall prerequisite and hook invocation fails CLOSED before job steps can
// run. A missing runner directory aborts post-install before the module can
// register the runner. Gate E still proves the hook on a live worker; the whole
// snippet stays subshell-scoped for the same inline-user-data reason as the
// toolbelt above.
const imdsJobHookPostInstall = `(
  set -eu
  dnf install -y iptables-nft
  command -v iptables >/dev/null 2>&1
  iptables --version | grep -Fq 'nf_tables'
  iptables -m owner --help >/dev/null 2>&1
  logger -t beep-imds-hook "verified iptables-nft with OWNER match support"
  install -d -m 0755 /opt/beep
  cat > /opt/beep/imds-job-started.sh <<'BEEP_IMDS_DROP'
#!/usr/bin/env bash
set -eu
runner_uid="$(id -u ${runnerRunAs})"
iptables -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "\${runner_uid}" -j DROP 2>/dev/null \\
  || iptables -A OUTPUT -d 169.254.169.254/32 -m owner --uid-owner "\${runner_uid}" -j DROP
if command -v ip6tables >/dev/null 2>&1; then
  ip6tables -C OUTPUT -d fd00:ec2::254/128 -m owner --uid-owner "\${runner_uid}" -j DROP 2>/dev/null \\
    || ip6tables -A OUTPUT -d fd00:ec2::254/128 -m owner --uid-owner "\${runner_uid}" -j DROP
fi
logger -t beep-imds-hook "installed per-job IMDS DROP for uid \${runner_uid}"
BEEP_IMDS_DROP
  chmod 0755 /opt/beep/imds-job-started.sh
  printf '#!/usr/bin/env bash\\nexec sudo /opt/beep/imds-job-started.sh\\n' > /opt/beep/imds-job-started-hook.sh
  chmod 0755 /opt/beep/imds-job-started-hook.sh
  printf '${runnerRunAs} ALL=(root) NOPASSWD: /opt/beep/imds-job-started.sh\\n' > /etc/sudoers.d/beep-imds-hook
  chmod 0440 /etc/sudoers.d/beep-imds-hook
  visudo -cf /etc/sudoers.d/beep-imds-hook
  hook_armed=false
  for runner_dir in /opt/actions-runner /home/${runnerRunAs}/actions-runner; do
    if [ -d "\${runner_dir}" ]; then
      printf 'ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/beep/imds-job-started-hook.sh\\n' >> "\${runner_dir}/.env"
      chown ${runnerRunAs}:${runnerRunAs} "\${runner_dir}/.env"
      logger -t beep-imds-hook "armed ACTIONS_RUNNER_HOOK_JOB_STARTED in \${runner_dir}/.env"
      hook_armed=true
      break
    fi
  done
  if [ "\${hook_armed}" = false ]; then
    logger -t beep-imds-hook "runner directory not found; per-job IMDS hook NOT armed"
    exit 1
  fi
)
`;

// The pinned module fetches and deletes the one-use JIT configuration before
// invoking /opt/actions-runner/run.sh as ec2-user. Replacing that entrypoint in
// post-install puts the one-way metadata shutdown after the last bootstrap
// credential use but before the runner can accept a job. The two sudo targets
// are root-owned and job-non-writable. They deliberately remain callable by a
// job: metadata disable is idempotent, and powering off one ephemeral worker is
// only self-denial of service. Keep the whole installer subshell-scoped because
// the module inlines it into the surrounding user-data shell.
const imdsWorkloadBoundaryPostInstall = `(
  set -eu
  beep_log() { logger -t "$1" -- "$2"; printf '%s %s: %s\\n' "$(date -u +%FT%TZ)" "$1" "$2" > /dev/console 2>/dev/null || true; }
  install -d -o root -g root -m 0755 /opt/beep

  cat > /opt/beep/imds-disable.sh <<'BEEP_IMDS_DISABLE'
#!/usr/bin/env bash
set -eu

beep_log() { logger -t "$1" -- "$2"; printf '%s %s: %s\\n' "$(date -u +%FT%TZ)" "$1" "$2" > /dev/console 2>/dev/null || true; }
beep_exit_reason="helper exited before completion"
edge_error_file=
aws_version_file=
beep_on_exit() {
  exit_code=$?
  beep_log beep-imds-disable "final exit: status=$exit_code reason=$beep_exit_reason"
  if [ -n "$edge_error_file" ]; then
    rm -f -- "$edge_error_file"
  fi
  if [ -n "$aws_version_file" ]; then
    rm -f -- "$aws_version_file"
  fi
}
trap beep_on_exit EXIT

if aws_path="$(command -v aws)"; then
  beep_log beep-imds-disable "command -v aws: $aws_path"
else
  beep_exit_reason="aws command missing"
  beep_log beep-imds-disable "command -v aws: MISSING"
  exit 1
fi
edge_error_file="$(mktemp /tmp/beep-imds-edges.XXXXXX)"
aws_version_file="$(mktemp /tmp/beep-aws-version.XXXXXX)"
: > "$edge_error_file"
if aws --version >"$aws_version_file" 2>"$edge_error_file"; then
  aws_version_line="$(head -n 1 "$aws_version_file" || true)"
  if [ -z "$aws_version_line" ]; then
    aws_version_line="$(head -n 1 "$edge_error_file" || true)"
  fi
  beep_log beep-imds-disable "aws --version: $aws_version_line"
else
  aws_version_exit_code=$?
  aws_error_line="$(head -n 1 "$edge_error_file" || true)"
  beep_log beep-imds-disable "AWS CLI stderr first line: $aws_error_line"
  beep_exit_reason="aws --version failed (exit=$aws_version_exit_code)"
  beep_log beep-imds-disable "$beep_exit_reason"
  exit 1
fi
if jq_path="$(command -v jq)"; then
  beep_log beep-imds-disable "command -v jq: $jq_path"
else
  beep_exit_reason="jq command missing"
  beep_log beep-imds-disable "command -v jq: MISSING"
  exit 1
fi
beep_log beep-imds-disable "id -u: $(id -u)"

beep_exit_reason="IMDSv2 bootstrap token request failed"
beep_log beep-imds-disable "requesting IMDSv2 bootstrap token"
imds_token="$(curl --noproxy '*' --silent --show-error --fail \\
  --connect-timeout 2 --max-time 5 \\
  --request PUT \\
  --header 'X-aws-ec2-metadata-token-ttl-seconds: 60' \\
  http://169.254.169.254/latest/api/token)"
beep_log beep-imds-disable "IMDSv2 bootstrap token obtained"
beep_exit_reason="instance id resolution failed"
instance_id="$(curl --noproxy '*' --silent --show-error --fail \\
  --connect-timeout 2 --max-time 5 \\
  --header "X-aws-ec2-metadata-token: $imds_token" \\
  http://169.254.169.254/latest/meta-data/instance-id)"
beep_exit_reason="region resolution failed"
region="$(curl --noproxy '*' --silent --show-error --fail \\
  --connect-timeout 2 --max-time 5 \\
  --header "X-aws-ec2-metadata-token: $imds_token" \\
  http://169.254.169.254/latest/dynamic/instance-identity/document | jq -er '.region')"
beep_log beep-imds-disable "instance id + region resolved: instance_id=$instance_id region=$region"
beep_exit_reason="IMDS edge validation aborted"

imds_edge_dry_run() {
  local aws_error_line error_code
  : > "$edge_error_file"
  if aws ec2 modify-instance-metadata-options \\
    --dry-run \\
    --instance-id "$1" \\
    --http-endpoint "$2" \\
    --region "$region" \\
    >/dev/null 2>"$edge_error_file"; then
    printf '%s\\n' NoError
    return
  fi
  # The CLI prints a blank line before the error; log the whole stderr on one
  # line so the encoded authorization message (decodable off-box with
  # sts decode-authorization-message) reaches the console.
  aws_error_line="$(tr '\\n' ' ' < "$edge_error_file" | sed 's/  */ /g' || true)"
  beep_log beep-imds-edges "AWS CLI stderr: $aws_error_line"
  error_code="$(grep -oE '\\([A-Za-z0-9._-]+\\)' "$edge_error_file" | head -n 1 | tr -d '()' || true)"
  printf '%s\\n' "\${error_code:-UnknownError}"
}

imds_edge_dry_run_with_cached_credentials() {
  local aws_error_line error_code
  : > "$edge_error_file"
  if env \\
    AWS_ACCESS_KEY_ID="$cached_access_key_id" \\
    AWS_SECRET_ACCESS_KEY="$cached_secret_access_key" \\
    AWS_SESSION_TOKEN="$cached_session_token" \\
    AWS_EC2_METADATA_DISABLED=true \\
    aws ec2 modify-instance-metadata-options \\
      --dry-run \\
      --instance-id "$1" \\
      --http-endpoint "$2" \\
      --region "$region" \\
      >/dev/null 2>"$edge_error_file"; then
    printf '%s\\n' NoError
    return
  fi
  aws_error_line="$(tr '\\n' ' ' < "$edge_error_file" | sed 's/  */ /g' || true)"
  beep_log beep-imds-edges "AWS CLI stderr: $aws_error_line"
  error_code="$(grep -oE '\\([A-Za-z0-9._-]+\\)' "$edge_error_file" | head -n 1 | tr -d '()' || true)"
  printf '%s\\n' "\${error_code:-UnknownError}"
}

discard_cached_credentials() {
  unset cached_access_key_id cached_secret_access_key cached_session_token
  beep_log beep-imds-disable "cached credentials discarded"
}

self_disable_code="$(imds_edge_dry_run "$instance_id" disabled)"
case "$self_disable_code" in
  DryRunOperation) beep_log beep-imds-edges "IMDS_EDGE self_disable: PASS" ;;
  *) beep_exit_reason="IMDS_EDGE self_disable failed ($self_disable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_disable: FAIL ($self_disable_code)"; exit 1 ;;
esac

other_disable_code="$(imds_edge_dry_run i-0f0f0f0f0f0f0f0f0 disabled)"
case "$other_disable_code" in
  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE other_disable: PASS" ;;
  InvalidInstanceID.NotFound|InvalidInstanceID.Malformed)
    beep_log beep-imds-edges "IMDS_EDGE other_disable: INCONCLUSIVE ($other_disable_code)" ;;
  *) beep_exit_reason="IMDS_EDGE other_disable failed ($other_disable_code)"; beep_log beep-imds-edges "IMDS_EDGE other_disable: FAIL ($other_disable_code)"; exit 1 ;;
esac

beep_exit_reason="instance-profile role name resolution failed"
role_name="$(curl --noproxy '*' --silent --show-error --fail \\
  --connect-timeout 2 --max-time 5 \\
  --header "X-aws-ec2-metadata-token: $imds_token" \\
  http://169.254.169.254/latest/meta-data/iam/security-credentials/)"
beep_exit_reason="instance-profile credential resolution failed"
role_credentials_json="$(curl --noproxy '*' --silent --show-error --fail \\
  --connect-timeout 2 --max-time 5 \\
  --header "X-aws-ec2-metadata-token: $imds_token" \\
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/$role_name")"
cached_access_key_id="$(printf '%s' "$role_credentials_json" | jq -er '.AccessKeyId | strings | select(length > 0)')"
cached_secret_access_key="$(printf '%s' "$role_credentials_json" | jq -er '.SecretAccessKey | strings | select(length > 0)')"
cached_session_token="$(printf '%s' "$role_credentials_json" | jq -er '.Token | strings | select(length > 0)')"
unset role_credentials_json imds_token
beep_log beep-imds-disable "instance-profile credentials cached in memory for post-disable lock probes"

beep_exit_reason="modify call aborted"
beep_log beep-imds-disable "disabling IMDS on $instance_id in $region"
: > "$edge_error_file"
if aws ec2 modify-instance-metadata-options \\
  --instance-id "$instance_id" \\
  --http-endpoint disabled \\
  --region "$region" \\
  >/dev/null 2>"$edge_error_file"; then
  beep_log beep-imds-disable "disable request accepted; waiting for sustained host endpoint denial"
  beep_exit_reason="IMDS reachability wait aborted"
else
  modify_exit_code=$?
  aws_error_line="$(tr '\\n' ' ' < "$edge_error_file" | sed 's/  */ /g' || true)"
  beep_log beep-imds-disable "AWS CLI stderr: $aws_error_line"
  modify_error_code="$(grep -oE '\\([A-Za-z0-9._-]+\\)' "$edge_error_file" | head -n 1 | tr -d '()' || true)"
  if [ -z "$modify_error_code" ]; then
    modify_error_code=UnknownError
  fi
  beep_exit_reason="modify call failed ($modify_error_code, exit=$modify_exit_code)"
  beep_log beep-imds-disable \\
    "disable request failed ($modify_error_code, exit=$modify_exit_code); failing closed"
  exit 1
fi

deadline=$(( $(date +%s) + 90 ))
required_denial_streak=5
denial_streak=0
while :; do
  ipv4_reachable=false
  ipv6_reachable=false
  if curl --noproxy '*' --silent --show-error --fail \\
    --connect-timeout 2 --max-time 3 \\
    --request PUT \\
    --header 'X-aws-ec2-metadata-token-ttl-seconds: 60' \\
    --output /dev/null \\
    http://169.254.169.254/latest/api/token 2>/dev/null; then
    ipv4_reachable=true
  fi
  if curl --noproxy '*' --silent --show-error --fail --globoff --ipv6 \\
    --connect-timeout 2 --max-time 3 \\
    --request PUT \\
    --header 'X-aws-ec2-metadata-token-ttl-seconds: 60' \\
    --output /dev/null \\
    'http://[fd00:ec2::254]/latest/api/token' 2>/dev/null; then
    ipv6_reachable=true
  fi

  if [ "$ipv4_reachable" = false ] && [ "$ipv6_reachable" = false ]; then
    denial_streak=$(( denial_streak + 1 ))
  else
    denial_streak=0
  fi
  beep_log beep-imds-disable \\
    "IMDS reachability: ipv4=$ipv4_reachable ipv6=$ipv6_reachable streak=$denial_streak"
  if [ "$(date +%s)" -ge "$deadline" ]; then
    beep_exit_reason="IMDS denial was not sustained before deadline"
    beep_log beep-imds-disable \\
      "IMDS denial was not sustained at deadline (ipv4=$ipv4_reachable ipv6=$ipv6_reachable streak=$denial_streak); failing closed"
    exit 1
  fi
  if [ "$denial_streak" -ge "$required_denial_streak" ]; then
    beep_exit_reason="IMDS was unreachable for $denial_streak consecutive checks"
    beep_log beep-imds-disable \\
      "IPv4 and IPv6 IMDS probes both failed for $denial_streak consecutive checks; testing metadata-options lock"
    break
  fi
  sleep 1
done

beep_exit_reason="post-disable IAM edge validation aborted"
self_reenable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" enabled)"
case "$self_reenable_code" in
  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE self_reenable: PASS" ;;
  *) beep_exit_reason="IMDS_EDGE self_reenable failed ($self_reenable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_reenable: FAIL ($self_reenable_code)"; discard_cached_credentials; exit 1 ;;
esac

self_redisable_code="$(imds_edge_dry_run_with_cached_credentials "$instance_id" disabled)"
case "$self_redisable_code" in
  UnauthorizedOperation) beep_log beep-imds-edges "IMDS_EDGE self_redisable: PASS" ;;
  *) beep_exit_reason="IMDS_EDGE self_redisable failed ($self_redisable_code)"; beep_log beep-imds-edges "IMDS_EDGE self_redisable: FAIL ($self_redisable_code)"; discard_cached_credentials; exit 1 ;;
esac

discard_cached_credentials
beep_exit_reason="IMDS disabled and metadata-options lock proven"
beep_log beep-imds-disable "metadata-options lock proven; runner may start"
exit 0
BEEP_IMDS_DISABLE

  cat > /opt/beep/self-poweroff.sh <<'BEEP_SELF_POWEROFF'
#!/usr/bin/env bash
set -eu
beep_log() { logger -t "$1" -- "$2"; printf '%s %s: %s\\n' "$(date -u +%FT%TZ)" "$1" "$2" > /dev/console 2>/dev/null || true; }
beep_log beep-self-poweroff "powering off ephemeral runner"
exec shutdown -P now
BEEP_SELF_POWEROFF

  chown root:root /opt/beep/imds-disable.sh /opt/beep/self-poweroff.sh
  chmod 0755 /opt/beep/imds-disable.sh /opt/beep/self-poweroff.sh
  printf '%s\\n' \\
    '${runnerRunAs} ALL=(root) NOPASSWD: /opt/beep/imds-disable.sh' \\
    '${runnerRunAs} ALL=(root) NOPASSWD: /opt/beep/self-poweroff.sh' \\
    > /etc/sudoers.d/beep-imds-boundary
  chown root:root /etc/sudoers.d/beep-imds-boundary
  chmod 0440 /etc/sudoers.d/beep-imds-boundary
  if visudo -cf /etc/sudoers.d/beep-imds-boundary; then
    beep_log beep-runner-shim "validated fail-closed IMDS boundary sudoers"
  else
    visudo_status=$?
    beep_log beep-runner-shim "visudo failed for IMDS boundary sudoers (exit=$visudo_status); aborting post-install"
    exit "$visudo_status"
  fi

  if [ ! -f /opt/actions-runner/run.sh ]; then
    beep_log beep-runner-shim "module run.sh missing; refusing to register runner"
    exit 1
  fi
  if [ -e /opt/actions-runner/run.module.sh ]; then
    beep_log beep-runner-shim "run.module.sh already exists; refusing ambiguous runner entrypoint"
    exit 1
  fi
  mv /opt/actions-runner/run.sh /opt/actions-runner/run.module.sh
  cat > /opt/actions-runner/run.sh <<'BEEP_RUNNER_SHIM'
#!/usr/bin/env bash
set -eu

beep_log() { logger -t "$1" -- "$2"; printf '%s %s: %s\\n' "$(date -u +%FT%TZ)" "$1" "$2" > /dev/console 2>/dev/null || true; }

if ! sudo /opt/beep/imds-disable.sh; then
  beep_log beep-runner-shim "IMDS disable failed; runner will not start"
  beep_log beep-runner-shim "HOLDING 240s for console capture"
  sleep 240
  if ! sudo /opt/beep/self-poweroff.sh; then
    beep_log beep-runner-shim "poweroff failed after IMDS disable failure"
  fi
  exit 1
fi

beep_log beep-runner-shim "IMDS disabled and unreachable; starting module runner"
if ./run.module.sh "$@"; then
  runner_status=0
else
  runner_status=$?
fi
beep_log beep-runner-shim "module runner exited with status $runner_status; powering off"
if ! sudo /opt/beep/self-poweroff.sh; then
  beep_log beep-runner-shim "poweroff failed after runner exit"
  exit 1
fi
exit "$runner_status"
BEEP_RUNNER_SHIM
  chown root:root /opt/actions-runner/run.sh
  chmod 0755 /opt/actions-runner/run.sh /opt/actions-runner/run.module.sh
  beep_log beep-runner-shim "installed fail-closed IMDS boundary runner shim"
)
`;

/**
 * The post-install every pool runs, after the runner is extracted and
 * before it starts: toolbelt, per-job IMDS hook, IMDS workload boundary.
 *
 * **Details**
 *
 * Byte-identical to the live fleet's post-install before its Terraform HCL
 * escaping. It assumes Amazon Linux 2023 (`dnf`, `iptables-nft`) and the
 * `ec2-user` run-as user; a pool on another image needs its own script.
 *
 * **Example** (Check the boundary is present)
 *
 * ```ts
 * import { runnerPostInstall } from "@beep/infra-ci-runners/RunnerBootstrap"
 *
 * console.log(runnerPostInstall.includes("/opt/beep/imds-disable.sh")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const runnerPostInstall: string =
  runnerToolbeltPostInstall + imdsJobHookPostInstall + imdsWorkloadBoundaryPostInstall;

/**
 * The managed policy that lets a runner disable IMDS on its own instance
 * while the endpoint is still enabled, and nothing else; the live
 * `<prefix>-runner-imds-disable` policy document.
 *
 * **Example** (Read the single action)
 *
 * ```ts
 * import { imdsDisablePolicyDocument } from "@beep/infra-ci-runners/RunnerBootstrap"
 *
 * console.log(imdsDisablePolicyDocument.Statement[0]?.Action) // ["ec2:ModifyInstanceMetadataOptions"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const imdsDisablePolicyDocument: IAM.PolicyDocument = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "DisableOwnMetadataEndpointWhileEnabled",
      Effect: "Allow",
      Action: ["ec2:ModifyInstanceMetadataOptions"],
      Resource: ["arn:aws:ec2:*:*:instance/*"],
      Condition: {
        ArnEquals: { "ec2:SourceInstanceARN": "arn:aws:ec2:*:*:instance/${ec2:InstanceID}" },
        StringEquals: { "ec2:MetadataHttpEndpoint": "enabled" },
      },
    },
  ],
};

/**
 * The most raw bytes EC2 accepts as instance user data.
 *
 * **Example** (16 KiB)
 *
 * ```ts
 * import { userDataLimitBytes } from "@beep/infra-ci-runners/RunnerBootstrap"
 *
 * console.log(userDataLimitBytes) // 16384
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const userDataLimitBytes = 16_384;

const gzip = (text: string) =>
  Effect.promise(() =>
    new Response(new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("gzip")))
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer))
  );

/**
 * Pack a post-install into a short loader: the script travels gzip-compressed
 * and base64-encoded, is unpacked to a temporary file and sourced by the user
 * data shell.
 *
 * **Details**
 *
 * Inline, {@link runnerPostInstall} alone is about 15 KB and the rendered
 * user data is 18,015 bytes, past EC2's {@link userDataLimitBytes}; packed,
 * the rendered user data is 7,867 bytes. Sourcing (not a child `bash`) runs
 * the script exactly where the inline text ran: in the user data shell, in
 * `/opt/actions-runner`, under its options. The script needs nothing from
 * that shell's variables: each snippet is a `( … )` subshell, and
 * `/opt/beep/imds-disable.sh` resolves the instance id and region from IMDS
 * itself. Each loader command stands alone under the user data's `bash -e`,
 * so a corrupt payload stops the boot before the runner starts.
 *
 * **Example** (Pack a script)
 *
 * ```ts
 * import { packPostInstall } from "@beep/infra-ci-runners/RunnerBootstrap"
 * import * as Effect from "effect/Effect"
 *
 * const loader = await Effect.runPromise(packPostInstall("echo hi\n"))
 * console.log(loader.includes("gunzip")) // true
 * ```
 *
 * @param script - The post-install to pack.
 * @returns The loader that unpacks and sources it.
 * @category constructors
 * @since 0.0.0
 */
export const packPostInstall = Effect.fn("CiRunners.packPostInstall")(function* (script: string) {
  const packed = yield* gzip(script);
  const payload = Base64.encode(packed);
  return A.join(
    [
      'beep_post_install="$(mktemp)"',
      `base64 -d > "$beep_post_install.gz" <<'BEEP_POST_INSTALL'`,
      payload,
      "BEEP_POST_INSTALL",
      'gunzip -c "$beep_post_install.gz" > "$beep_post_install"',
      '. "$beep_post_install"',
      'rm -f "$beep_post_install" "$beep_post_install.gz"',
      "",
    ],
    "\n"
  );
});
