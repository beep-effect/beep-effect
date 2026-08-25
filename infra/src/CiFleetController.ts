/**
 * Pulumi terraform-module bridge for the beep CI ephemeral runner controller.
 *
 * The component consumes the existing CI runner VPC, subnets, and worker
 * security group. It does not recreate the groundwork network. GitHub App
 * credentials remain externally managed SSM SecureString parameters; only
 * their ARNs and fixed parameter names cross this boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { O, Str } from "@beep/utils";
import * as aws from "@pulumi/aws";
import * as ghaRunners from "@pulumi/gharunners";
import * as pulumi from "@pulumi/pulumi";
import { flow } from "effect";
import * as S from "effect/Schema";
import { withPulumiConfigDecodeEffect } from "./internal/PulumiConfigSchema.ts";

const $I = $InfraId.create("CiFleetController");

const defaultAmiSsmParameterName = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64";
const defaultRunnerLabel = "beep-ec2-heavy";
const githubAppIdSsmParameterName = "/github-action-runners/app/github_app_id";
const githubAppKeyBase64SsmParameterName = "/github-action-runners/app/github_app_key_base64";
const githubAppWebhookSecretSsmParameterName = "/github-action-runners/app/github_app_webhook_secret";

/**
 * Keeps every runner at 64 GB so the build-mode census peaks of 47.59 GiB for
 * professional-desktop and 24.77 GiB for epistemic-server fit with headroom.
 * See `goals/ci-fleet-endgame/research/build-mode-typecheck-census.md`.
 */
const runnerInstanceTypes = ["r7a.2xlarge", "r7i.2xlarge", "r6i.2xlarge", "m7a.4xlarge"];
const onDemandFailoverErrors = ["InsufficientInstanceCapacity", "InsufficientCapacityOnHost", "UnfulfillableCapacity"];

// The runner agent and every job step both run as this user, so the two cannot
// be told apart by uid at agent-start time — the reason the post-install IMDS
// DROP was rolled back (see the class prose and CSF-003).
const runnerRunAs = "ec2-user";

// The module's own user-data installs only docker and libicu, and the pinned
// AL2023 image ships without git, unzip, zip, or jq — setup-bun dies exit-127
// without unzip and checkout needs git. A baked image (`beep runners bake`)
// carries the toolbelt and stamps /etc/beep-ci/baked-runner; the marker check
// makes this snippet a no-op there and fails OPEN (missing marker means the
// per-boot install resumes). The module INLINES this snippet into its single user-data
// bash script, so shell options must stay subshell-scoped: a leaked `set -u`
// kills the downstream runner-start section on its own unset variables
// (`SEGMENT: unbound variable`, runner-start-failed) — which is also the
// failure signature the rolled-back IMDS DROP produced.
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

// The terraform-module bridge writes module inputs into `pulumi.tf.json`, and
// Terraform's JSON syntax parses every string value as an HCL template: a
// literal bash `${...}` (or `%{...}`) plans as an HCL reference and fails the
// whole stack with "Invalid reference". `$${` / `%%{` render back to `${` /
// `%{` in the instance's user-data, so the scripts run byte-identical. The
// callback replacer is load-bearing: in a plain replacement string, `$$`
// collapses to `$` and the escape silently becomes a no-op.
const escapeHclTemplateSequences = flow(
  Str.replaceAllWith(/\$\{/gu, () => "$${"),
  Str.replaceAll("%{", "%%{")
);

const runnerPostInstall = escapeHclTemplateSequences(
  runnerToolbeltPostInstall + imdsJobHookPostInstall + imdsWorkloadBoundaryPostInstall
);

// Self-only and enabled-state-only: the caller's own instance ARN
// (`ec2:SourceInstanceARN`, present for instance-profile credentials) must name
// the target instance (`ec2:InstanceID`). The role may act only while that
// instance's endpoint is enabled, so after the disable it has no authority over
// its metadata options. For this action the metadata condition keys describe
// current resource state, not requested values, so the requested value cannot
// be constrained through them. That is acceptable because the caller is the
// root-only bootstrap helper and every option other than the endpoint is
// harmless.
const runnerImdsDisablePolicyDocument = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "DisableOwnMetadataEndpointWhileEnabled",
      Effect: "Allow",
      Action: "ec2:ModifyInstanceMetadataOptions",
      Resource: "arn:aws:ec2:*:*:instance/*",
      Condition: {
        ArnEquals: {
          "ec2:SourceInstanceARN": "arn:aws:ec2:*:*:instance/${ec2:InstanceID}",
        },
        StringEquals: {
          "ec2:MetadataHttpEndpoint": "enabled",
        },
      },
    },
  ],
});

const awsArnPattern = /^arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:[0-9]*:.+$/u;
const ssmParameterArnPattern = /^arn:aws[a-z-]*:ssm:[a-z0-9-]+:[0-9]*:parameter\/.+$/u;
const absoluteZipPathPattern = /^\/.+\.zip$/u;
const amiIdPattern = /^ami-[0-9a-f]{8,17}$/u;
const runnerLabelPattern = /^[A-Za-z0-9_-]{1,64}$/u;
const ssmParameterNamePattern = /^\/[A-Za-z0-9_./-]+$/u;

const AwsArn = S.String.check(
  S.isPattern(awsArnPattern, {
    identifier: $I`AwsArnFormat`,
    title: "AWS ARN Format",
    description: "An AWS resource ARN.",
    message: "Expected an AWS ARN",
  })
).pipe($I.annoteSchema("AwsArn", { description: "An AWS resource ARN." }));

const SsmParameterArn = S.String.check(
  S.isPattern(ssmParameterArnPattern, {
    identifier: $I`SsmParameterArnFormat`,
    title: "SSM Parameter ARN Format",
    description: "An ARN for an AWS Systems Manager parameter.",
    message: "Expected an SSM parameter ARN",
  })
).pipe($I.annoteSchema("SsmParameterArn", { description: "An ARN for an AWS Systems Manager parameter." }));

const AbsoluteZipPath = S.String.check(
  S.isPattern(absoluteZipPathPattern, {
    identifier: $I`AbsoluteZipPathFormat`,
    title: "Absolute ZIP Path Format",
    description: "An absolute filesystem path ending in .zip.",
    message: "Expected an absolute path ending in .zip",
  })
).pipe($I.annoteSchema("AbsoluteZipPath", { description: "An absolute filesystem path ending in .zip." }));

const AmiId = S.String.check(
  S.isPattern(amiIdPattern, {
    identifier: $I`AmiIdFormat`,
    title: "AMI ID Format",
    description: "An EC2 machine image id.",
    message: "Expected an AMI id like ami-0123456789abcdef0",
  })
).pipe($I.annoteSchema("AmiId", { description: "An EC2 machine image id." }));

const RunnerLabel = S.String.check(
  S.isPattern(runnerLabelPattern, {
    identifier: $I`RunnerLabelFormat`,
    title: "Runner Label Format",
    description: "A GitHub Actions runner label containing letters, digits, underscores, or hyphens.",
    message: "Expected a runner label containing only letters, digits, underscores, or hyphens",
  })
).pipe($I.annoteSchema("RunnerLabel", { description: "A GitHub Actions runner label." }));

/**
 * Absolute AWS Systems Manager parameter name.
 *
 * **Example** (Amazon Linux 2023 public AMI)
 *
 * `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`
 * is a valid parameter name.
 *
 * **Details**
 *
 * Parameter names must be absolute paths beginning with `/`.
 */
const SsmParameterName = S.String.check(
  S.isPattern(ssmParameterNamePattern, {
    identifier: $I`SsmParameterNameFormat`,
    title: "SSM Parameter Name Format",
    description: "An absolute SSM parameter path.",
    message: "Expected an absolute SSM parameter path starting with /",
  })
).pipe($I.annoteSchema("SsmParameterName", { description: "An absolute SSM parameter path." }));

type CiFleetControllerPulumiConfigValuesFields = {
  readonly amiId?: string | undefined;
  readonly amiSsmParameterName?: string | undefined;
  readonly githubAppIdSsmParameterArn: string;
  readonly githubAppKeyBase64SsmParameterArn: string;
  readonly githubAppKmsKeyArn: string;
  readonly githubAppWebhookSecretSsmParameterArn: string;
  readonly runnerBinariesSyncerLambdaZip: string;
  readonly runnerLabel?: string | undefined;
  readonly runnerRolePermissionsBoundaryArn: string;
  readonly runnersLambdaZip: string;
  readonly terminationWatcherLambdaZip: string;
  readonly webhookLambdaZip: string;
};

/**
 * Pulumi config values accepted by the CI fleet controller.
 *
 * @category models
 * @since 0.0.0
 */
export const CiFleetControllerPulumiConfigValues = S.Class<CiFleetControllerPulumiConfigValuesFields>(
  $I`CiFleetControllerPulumiConfigValues`
)(
  {
    amiId: S.optionalKey(AmiId),
    amiSsmParameterName: S.optionalKey(SsmParameterName),
    githubAppIdSsmParameterArn: SsmParameterArn,
    githubAppKeyBase64SsmParameterArn: SsmParameterArn,
    githubAppKmsKeyArn: AwsArn,
    githubAppWebhookSecretSsmParameterArn: SsmParameterArn,
    runnerBinariesSyncerLambdaZip: AbsoluteZipPath,
    runnerLabel: S.optionalKey(RunnerLabel),
    runnerRolePermissionsBoundaryArn: AwsArn,
    runnersLambdaZip: AbsoluteZipPath,
    terminationWatcherLambdaZip: AbsoluteZipPath,
    webhookLambdaZip: AbsoluteZipPath,
  },
  $I.annote("CiFleetControllerPulumiConfigValues", {
    description: "Pulumi config values accepted by the CI fleet controller.",
  })
).pipe(withPulumiConfigDecodeEffect);

/**
 * Runtime type for {@link CiFleetControllerPulumiConfigValues}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiFleetControllerPulumiConfigValues = typeof CiFleetControllerPulumiConfigValues.Type;

/**
 * Fully validated CI fleet controller configuration.
 *
 * @category models
 * @since 0.0.0
 */
export class CiFleetControllerConfig extends S.Class<CiFleetControllerConfig>($I`CiFleetControllerConfig`)(
  {
    amiId: S.OptionFromOptionalKey(AmiId).pipe(SchemaUtils.withNoneDefault),
    amiSsmParameterName: SsmParameterName.pipe(SchemaUtils.withKeyDefaults(defaultAmiSsmParameterName)),
    githubAppIdSsmParameterArn: SsmParameterArn,
    githubAppKeyBase64SsmParameterArn: SsmParameterArn,
    githubAppKmsKeyArn: AwsArn,
    githubAppWebhookSecretSsmParameterArn: SsmParameterArn,
    runnerBinariesSyncerLambdaZip: AbsoluteZipPath,
    runnerLabel: RunnerLabel.pipe(SchemaUtils.withKeyDefaults(defaultRunnerLabel)),
    runnerRolePermissionsBoundaryArn: AwsArn,
    runnersLambdaZip: AbsoluteZipPath,
    terminationWatcherLambdaZip: AbsoluteZipPath,
    webhookLambdaZip: AbsoluteZipPath,
  },
  $I.annote("CiFleetControllerConfig", {
    description: "Fully validated CI fleet controller configuration.",
  })
) {}

/**
 * Apply the shadow-label default to decoded Pulumi config values.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCiFleetControllerConfig = (values: CiFleetControllerPulumiConfigValues): CiFleetControllerConfig =>
  CiFleetControllerConfig.make({
    amiId: O.fromUndefinedOr(values.amiId),
    githubAppIdSsmParameterArn: values.githubAppIdSsmParameterArn,
    githubAppKeyBase64SsmParameterArn: values.githubAppKeyBase64SsmParameterArn,
    githubAppKmsKeyArn: values.githubAppKmsKeyArn,
    githubAppWebhookSecretSsmParameterArn: values.githubAppWebhookSecretSsmParameterArn,
    runnerBinariesSyncerLambdaZip: values.runnerBinariesSyncerLambdaZip,
    runnerRolePermissionsBoundaryArn: values.runnerRolePermissionsBoundaryArn,
    runnersLambdaZip: values.runnersLambdaZip,
    terminationWatcherLambdaZip: values.terminationWatcherLambdaZip,
    webhookLambdaZip: values.webhookLambdaZip,
    ...O.getSomesStruct({
      amiSsmParameterName: O.fromUndefinedOr(values.amiSsmParameterName),
      runnerLabel: O.fromUndefinedOr(values.runnerLabel),
    }),
  });

/**
 * Load the CI fleet controller configuration from Pulumi config.
 *
 * @category constructors
 * @since 0.0.0
 */
export const loadCiFleetControllerConfig = (): CiFleetControllerConfig => {
  const config = new pulumi.Config("ciFleetController");

  return makeCiFleetControllerConfig(
    CiFleetControllerPulumiConfigValues.make({
      ...O.getSomesStruct({
        amiId: O.fromUndefinedOr(config.get("amiId")),
        amiSsmParameterName: O.fromUndefinedOr(config.get("amiSsmParameterName")),
        runnerLabel: O.fromUndefinedOr(config.get("runnerLabel")),
      }),
      githubAppIdSsmParameterArn: config.require("githubAppIdSsmParameterArn"),
      githubAppKeyBase64SsmParameterArn: config.require("githubAppKeyBase64SsmParameterArn"),
      githubAppKmsKeyArn: config.require("githubAppKmsKeyArn"),
      githubAppWebhookSecretSsmParameterArn: config.require("githubAppWebhookSecretSsmParameterArn"),
      runnerBinariesSyncerLambdaZip: config.require("runnerBinariesSyncerLambdaZip"),
      runnerRolePermissionsBoundaryArn: config.require("runnerRolePermissionsBoundaryArn"),
      runnersLambdaZip: config.require("runnersLambdaZip"),
      terminationWatcherLambdaZip: config.require("terminationWatcherLambdaZip"),
      webhookLambdaZip: config.require("webhookLambdaZip"),
    })
  );
};

type CiFleetControllerArgs = {
  readonly config: CiFleetControllerConfig;
  readonly region: pulumi.Input<string>;
  readonly subnetIds: pulumi.Input<pulumi.Input<string>[]>;
  readonly vpcId: pulumi.Input<string>;
  readonly workerSecurityGroupId: pulumi.Input<string>;
};

/**
 * Ephemeral GitHub Actions runner controller backed by the pinned Terraform
 * module through Pulumi's terraform-module provider.
 *
 * **Gotchas**
 *
 * The primary workload-identity boundary is the post-install `run.sh` shim.
 * The pinned module first uses IMDS to read its instance facts, fetches static
 * and one-use JIT configuration from SSM, deletes the JIT parameter, and then
 * invokes the shim as `ec2-user`. The shim calls a root-owned helper that may
 * only disable IMDS on the source instance. It waits until both host metadata
 * endpoints are unreachable before it starts the module runner. Failure powers
 * off the guest without starting the runner. The launch template converts that
 * guest shutdown into EC2 termination, so teardown does not need role
 * credentials after IMDS closes.
 *
 * The `ACTIONS_RUNNER_HOOK_JOB_STARTED` owner DROP remains defense in depth.
 * Its root-owned installer is exposed through one exact sudoers entry, and
 * every prerequisite fails closed before a job step. Gate E proves the runner
 * user's token PUT remains denied; Gate J separately proves the owner rule is
 * still armed after the stronger endpoint shutdown lands. A job may call the
 * disable helper again or power off its own one-job VM. Neither call grants
 * privilege.
 *
 * The module inlines `userdata_post_install` into one user-data script. Each
 * snippet must keep shell options in a subshell because a leaked `set -u`
 * kills the module's later start section on unset variables. Terraform also
 * parses every module-input string as an HCL template, so literal shell
 * `${...}` and `%{...}` sequences must pass through
 * `escapeHclTemplateSequences`.
 *
 * Reliability semantics for the one-job-one-VM fleet: `job_retry` rescues a
 * job whose runner died between launch and pickup (spot reclaim, boot
 * failure) — without it such a job waits on GitHub's six-hour queue timeout,
 * because nothing else re-delivers it. A capacity reclaim mid-job still fails
 * that job and only a workflow re-run recovers it; the fleet runs on-demand
 * for the bring-up window after cutover-night reclaim sweeps, with spot (a
 * ~3x cost saving) as the intended steady state. `runners_maximum_count` bounds
 * concurrent instances only — jobs beyond the cap retry from SQS as capacity
 * frees rather than being dropped. `enable_job_queued_check` stays false: its
 * not-queued branch consumes the scale-up message with no retry, so GitHub
 * API propagation lag would strand a genuinely queued job forever — a wasted
 * VM on a cancelled job is the cheaper failure.
 *
 * **Example** (Provision the heavy-lane fleet controller)
 *
 * ```ts
 * import { CiFleetController, CiFleetControllerPulumiConfigValues, makeCiFleetControllerConfig } from "@beep/infra"
 *
 * const config = makeCiFleetControllerConfig(
 *   CiFleetControllerPulumiConfigValues.make({
 *     githubAppIdSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/id",
 *     githubAppKeyBase64SsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/key",
 *     githubAppKmsKeyArn: "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
 *     githubAppWebhookSecretSsmParameterArn: "arn:aws:ssm:us-east-1:123456789012:parameter/github/app/webhook-secret",
 *     runnerBinariesSyncerLambdaZip: "/artifacts/runner-binaries-syncer.zip",
 *     runnerRolePermissionsBoundaryArn: "arn:aws:iam::123456789012:policy/beep-ci-fleet-boundary",
 *     runnersLambdaZip: "/artifacts/runners.zip",
 *     terminationWatcherLambdaZip: "/artifacts/termination-watcher.zip",
 *     webhookLambdaZip: "/artifacts/webhook.zip",
 *   })
 * )
 *
 * const controller = new CiFleetController("beep-ci-fleet", {
 *   config,
 *   region: "us-east-1",
 *   subnetIds: ["subnet-abc", "subnet-def"],
 *   vpcId: "vpc-123",
 *   workerSecurityGroupId: "sg-456",
 * })
 * console.log(controller.webhook)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export class CiFleetController extends pulumi.ComponentResource {
  /**
   * Module-created SSM parameter names.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly ssmParameters: pulumi.Output<string[] | undefined>;

  /**
   * Module webhook output containing the API Gateway endpoint.
   *
   * @category resources
   * @since 0.0.0
   */
  public readonly webhook: pulumi.Output<unknown>;

  public constructor(name: string, args: CiFleetControllerArgs, opts?: pulumi.ComponentResourceOptions) {
    super("beep:infra:CiFleetController", name, {}, opts);

    const resolvedAmiId = O.match(args.config.amiId, {
      onNone: () =>
        aws.ssm.getParameterOutput(
          {
            name: args.config.amiSsmParameterName,
            region: args.region,
          },
          { parent: this }
        ).value,
      onSome: (amiId) => pulumi.output(amiId),
    });

    const runnerAmiParameter = new aws.ssm.Parameter(
      `${name}-runner-ami`,
      {
        name: "/beep-ci/controller/runner-ami-id",
        dataType: "aws:ec2:image",
        region: args.region,
        tags: {
          App: "ci-runners",
          ManagedBy: "pulumi",
          Project: "beep-ci",
        },
        type: "String",
        value: resolvedAmiId,
      },
      { parent: this }
    );

    const runnerImdsDisablePolicy = new aws.iam.Policy(
      `${name}-runner-imds-disable`,
      {
        description: "Allow a CI runner to disable IMDS on only its own instance.",
        name: "beep-ci-runner-imds-disable",
        path: "/beep-ci/",
        policy: runnerImdsDisablePolicyDocument,
        tags: {
          App: "ci-runners",
          ManagedBy: "pulumi",
          Project: "beep-ci",
        },
      },
      { parent: this }
    );

    const provider = new ghaRunners.Provider(
      `${name}-provider`,
      {
        aws: { region: args.region },
      },
      { parent: this }
    );

    // The module gates internal count expressions on this ARN, so it must be
    // plan-time-known: compose it from invoke results and the static parameter
    // name instead of the parameter resource's own output.
    const runnerAmiParameterArn = pulumi.interpolate`arn:aws:ssm:${args.region}:${
      aws.getCallerIdentityOutput({}, { parent: this }).accountId
    }:parameter/beep-ci/controller/runner-ami-id`;

    const controller = new ghaRunners.Module(
      name,
      {
        ami: { id_ssm_parameter_arn: runnerAmiParameterArn },
        associate_public_ipv4_address: true,
        aws_region: args.region,
        block_device_mappings: [
          {
            delete_on_termination: true,
            // AL2023's root device — /dev/sda1 (the Ubuntu burst convention)
            // leaves the AMI's 8 GB root in place and attaches this volume as
            // an unused side disk; real lanes then die on a full root.
            device_name: "/dev/xvda",
            encrypted: true,
            iops: 3000,
            throughput: 250,
            volume_size: 100,
            volume_type: "gp3",
          },
        ],
        create_service_linked_role_spot: false,
        delay_webhook_event: 0,
        enable_cloudwatch_agent: false,
        enable_ephemeral_runners: true,
        enable_jit_config: true,
        // The module's ephemeral default. The pre-launch "is the job still
        // queued" GitHub lookup hits API propagation lag, and its not-queued
        // branch consumes the scale-up message with NO retry path — two live
        // probes stranded 25+ minutes proved it. A cancelled job now costs
        // one self-reaping VM instead of a stranded lane.
        enable_job_queued_check: false,
        enable_managed_runner_security_group: false,
        /**
         * Register only in the named organization group. If the group is
         * absent or rejects the runner, the module fails registration. It
         * does not fall back to `Default` or repository registration;
         * `Default` also rejects public repositories in this organization.
         */
        enable_organization_runners: true,
        runner_group_name: "beep-ec2-heavy",
        /**
         * Require an exact label-set match so ordinary `self-hosted` jobs
         * cannot reach the fleet without naming its dedicated label.
         *
         * **Gotchas**
         *
         * Default labels plus any-match webhook filtering widened the fleet
         * to ordinary `self-hosted` jobs, so both label sets must be exact.
         */
        enable_runner_bidirectional_label_match: true,
        enable_runner_on_demand_failover_for_errors: onDemandFailoverErrors,
        enable_ssm_on_runners: false,
        enable_user_data_debug_logging_runner: false,
        github_app: {
          id_ssm: {
            arn: args.config.githubAppIdSsmParameterArn,
            name: githubAppIdSsmParameterName,
          },
          key_base64_ssm: {
            arn: args.config.githubAppKeyBase64SsmParameterArn,
            name: githubAppKeyBase64SsmParameterName,
          },
          webhook_secret_ssm: {
            arn: args.config.githubAppWebhookSecretSsmParameterArn,
            name: githubAppWebhookSecretSsmParameterName,
          },
        },
        instance_allocation_strategy: "price-capacity-optimized",
        // P1 spot revert (2026-08-16): the measured on-demand week was calm —
        // 20/528 re-runs since 2026-08-11, all attributed to lane-wedge
        // reruns, one glob-timeout flake, and supersede cancels; zero
        // capacity-class. Tripwire stays armed: >2 interruption re-runs/week
        // sends the longest lanes back to on-demand
        // (goals/ci-fleet-residue/research/p1-spot-revert-baseline.md).
        instance_target_capacity_type: "spot",
        instance_termination_watcher: {
          enable: true,
          enable_runner_deregistration: true,
          features: {
            enable_spot_termination_handler: true,
            enable_spot_termination_notification_watcher: true,
          },
          zip: args.config.terminationWatcherLambdaZip,
        },
        instance_types: runnerInstanceTypes,
        // Rescues a job whose runner died between launch and pickup (spot
        // reclaim, boot failure) by re-checking the still-queued job and
        // scaling up again; a runner lost mid-job is out of its reach and
        // needs a workflow re-run.
        job_retry: {
          delay_backoff: 2,
          delay_in_seconds: 120,
          enable: true,
          max_attempts: 2,
        },
        kms_key_arn: args.config.githubAppKmsKeyArn,
        logging_retention_in_days: 14,
        minimum_running_time_in_minutes: 5,
        prefix: "beep-ci",
        repository_white_list: ["beep-effect/beep-effect"],
        role_permissions_boundary: args.config.runnerRolePermissionsBoundaryArn,
        runner_additional_security_group_ids: [args.workerSecurityGroupId],
        runner_architecture: "x64",
        runner_binaries_syncer_lambda_zip: args.config.runnerBinariesSyncerLambdaZip,
        runner_disable_default_labels: true,
        runner_ec2_tags: { "beep-ci": "runner" },
        runner_extra_labels: [args.config.runnerLabel],
        runner_iam_role_managed_policy_arns: [runnerImdsDisablePolicy.arn],
        runner_metadata_options: {
          http_endpoint: "enabled",
          http_put_response_hop_limit: 1,
          http_tokens: "required",
          instance_metadata_tags: "enabled",
        },
        runner_name_prefix: "beep-ci-",
        runner_os: "linux",
        runner_run_as: runnerRunAs,
        userdata_post_install: runnerPostInstall,
        runners_ebs_optimized: true,
        runners_lambda_zip: args.config.runnersLambdaZip,
        // Concurrency cap, not a budget: each ephemeral VM lives exactly one
        // job, so the cap only decides how much of a wave runs in parallel. A
        // push wave requests seven heavy jobs (five verify lanes plus
        // jsdoc-ratchet and build) and an overlapping PR wave adds six more —
        // fourteen covers that worst case with one spare. Excess jobs retry
        // from SQS every ~30s.
        runners_maximum_count: 14,
        runners_ssm_housekeeper: {
          config: { dryRun: false, minimumDaysOld: 1 },
          enabled: true,
          schedule_expression: "rate(1 day)",
        },
        scale_down_schedule_expression: "cron(* * * * ? *)",
        subnet_ids: args.subnetIds,
        tags: {
          App: "ci-runners",
          ManagedBy: "pulumi-terraform-module",
          Project: "beep-ci",
        },
        vpc_id: args.vpcId,
        webhook_lambda_zip: args.config.webhookLambdaZip,
      },
      { dependsOn: [runnerAmiParameter], parent: this, provider }
    );

    this.ssmParameters = controller.ssm_parameters;
    this.webhook = controller.webhook;

    this.registerOutputs({
      ssmParameters: this.ssmParameters,
      webhook: this.webhook,
    });
  }
}
