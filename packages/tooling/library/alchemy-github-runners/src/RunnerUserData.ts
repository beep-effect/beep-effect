/**
 * The runner instance's user data: install the `actions/runner` tarball from
 * the fleet's S3 mirror, fetch the one-use registration from SSM and run the
 * runner.
 *
 * **Details**
 *
 * Ported from `modules/runners/templates/{user-data,install-runner,start-runner}.sh`
 * of github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice. X-Ray segments, the CloudWatch agent
 * and the SSM config-path lookup are not ported: the token path and name
 * prefix arrive as instance tags written by scale-up.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RunnerTag } from "./RunnerInstance.models.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerUserData");

/**
 * What a pool's user data needs.
 *
 * **Details**
 *
 * `runnerTarballS3Url` is `s3://<bucket>/<key>` of the syncer's mirror.
 * `preInstall` runs before the OS update, `postInstall` after the runner is
 * unpacked and before it starts; both are inlined into the one script, so
 * they must keep shell options subshell-scoped. `ephemeral` decides whether
 * the instance terminates itself when the runner exits.
 *
 * **Example** (The heavy pool)
 *
 * ```ts
 * import { RunnerUserDataInput } from "@beep/alchemy-github-runners/RunnerUserData"
 *
 * const input = RunnerUserDataInput.make({ runnerTarballS3Url: "s3://binaries/actions-runner-linux.tar.gz" })
 * console.log(input.runAs) // "ec2-user"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerUserDataInput extends S.Opaque<RunnerUserDataInput, { readonly brand: unique symbol }>()(
  S.Struct({
    runnerTarballS3Url: S.String,
    runAs: S.String.pipe(S.withConstructorDefault(Effect.succeed("ec2-user"))),
    preInstall: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
    postInstall: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
    ephemeral: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    jitConfig: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
  }).pipe(
    $I.annoteSchema("RunnerUserDataInput", {
      description: "What a pool's user data needs.",
    })
  )
) {}

const retryInstall = [
  'os_id="$(. /etc/os-release && echo "$ID")"',
  'case "$os_id" in ubuntu|debian) os_family=apt ;; *) os_family=dnf ;; esac',
  'pkg_install() { if [ "$os_family" = apt ]; then DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"; else dnf install -y "$@"; fi; }',
  "install_with_retry() {",
  "  attempt=0",
  '  until pkg_install "$@"; do',
  "    attempt=$((attempt + 1))",
  '    if [ "$attempt" -gt 5 ]; then return 1; fi',
  '    echo "install of $* failed; retrying"',
  "    sleep 5",
  "  done",
  "}",
];

const imds = [
  'imds_token=""',
  "for _ in $(seq 1 40); do",
  "  imds_token=\"$(curl -sf -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 180' || true)\"",
  '  if [ -n "$imds_token" ]; then break; fi',
  "  sleep 5",
  "done",
  'imds() { curl -sf -H "X-aws-ec2-metadata-token: $imds_token" "http://169.254.169.254/latest/$1"; }',
  'region="$(imds dynamic/instance-identity/document | jq -r .region)"',
  'instance_id="$(imds meta-data/instance-id)"',
  `token_path="$(imds meta-data/tags/instance/${RunnerTag.tokenPath})"`,
  `runner_name_prefix="$(imds meta-data/tags/instance/${RunnerTag.runnerNamePrefix} || true)"`,
];

/**
 * Renders the user data script for a pool's launch template.
 *
 * **Details**
 *
 * The script logs to `/var/log/user-data.log` and the console, installs
 * docker, jq, git and curl with retries (dnf on Amazon Linux, apt-get plus the
 * AWS CLI v2 installer on Ubuntu and Debian, chosen from `/etc/os-release`), unpacks the runner under
 * `/opt/actions-runner` (as `runAs`), reads the instance id, region, token
 * path and name prefix through IMDSv2 (the launch template must enable
 * instance metadata tags), waits for its configuration at
 * `<token path>/<instance id>`, deletes it, and runs the runner from
 * `/opt/actions-runner` with `./run.sh`, so a post-install that wraps
 * `run.sh` keeps working. JIT registration applies to ephemeral pools only,
 * matching scale-up; other pools register with `config.sh`. On exit an
 * ephemeral instance terminates itself, and any instance terminates itself
 * when the runner exits non-zero.
 *
 * **Example** (Render the script)
 *
 * ```ts
 * import { renderRunnerUserData, RunnerUserDataInput } from "@beep/alchemy-github-runners/RunnerUserData"
 *
 * const script = renderRunnerUserData(RunnerUserDataInput.make({ runnerTarballS3Url: "s3://b/runner.tar.gz" }))
 * console.log(script.startsWith("#!/bin/bash")) // true
 * ```
 *
 * @param input - Tarball location, run-as user, install hooks and runner mode.
 * @returns The bash user data, not base64-encoded.
 * @category constructors
 * @since 0.0.0
 */
export const renderRunnerUserData = (input: RunnerUserDataInput): string => {
  // Scale-up writes a JIT config only for ephemeral pools (upstream start-runner.sh agrees);
  // any other pool gets config.sh arguments.
  const runCommand =
    input.ephemeral && input.jitConfig
      ? 'sudo -u "$run_as" -- ./run.sh --jitconfig "$config"'
      : A.join(
          [
            'sudo -u "$run_as" -- ./config.sh --unattended --name "$runner_name_prefix$instance_id" --work _work $config',
            'sudo -u "$run_as" -- ./run.sh',
          ],
          "\n"
        );
  return A.join(
    [
      "#!/bin/bash -e",
      "exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1",
      "set +x",
      ...retryInstall,
      input.preInstall,
      'if [ "$os_family" = apt ]; then',
      "  for _ in 1 2 3 4 5; do apt-get update -y && break; sleep 5; done",
      "  install_with_retry docker.io jq git curl unzip",
      "  if ! command -v aws >/dev/null 2>&1; then",
      '    curl -sSfL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip',
      "    unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/awscliv2.zip",
      "  fi",
      "else",
      "  for _ in 1 2 3 4 5; do dnf upgrade-minimal -y && break; sleep 5; done",
      "  install_with_retry docker jq git",
      "  install_with_retry --allowerasing curl",
      "fi",
      "service docker start",
      `usermod -a -G docker ${input.runAs}`,
      `run_as=${input.runAs}`,
      "mkdir -p /opt/hostedtoolcache /opt/actions-runner",
      "cd /opt/actions-runner",
      ...imds,
      `aws s3 cp "${input.runnerTarballS3Url}" actions-runner.tar.gz --region "$region" --no-progress`,
      "tar xzf actions-runner.tar.gz && rm -f actions-runner.tar.gz",
      'if [ "$os_family" = apt ]; then ./bin/installdependencies.sh; else install_with_retry libicu; fi',
      'chown -R "$run_as":"$run_as" /opt/actions-runner /opt/hostedtoolcache',
      input.postInstall,
      "cleanup() {",
      "  status=$?",
      '  echo "runner exited with status $status"',
      input.ephemeral
        ? '  aws ec2 terminate-instances --instance-ids "$instance_id" --region "$region" || true'
        : '  if [ "$status" -ne 0 ]; then aws ec2 terminate-instances --instance-ids "$instance_id" --region "$region" || true; fi',
      "}",
      "trap cleanup EXIT",
      'config=""',
      'until [ -n "$config" ]; do',
      '  config="$(aws ssm get-parameter --name "$token_path/$instance_id" --with-decryption --region "$region" --query Parameter.Value --output text 2>/dev/null || true)"',
      '  [ -n "$config" ] || sleep 1',
      "done",
      'aws ssm delete-parameter --name "$token_path/$instance_id" --region "$region"',
      "cd /opt/actions-runner",
      runCommand,
      "",
    ],
    "\n"
  );
};
