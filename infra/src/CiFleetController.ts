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
import { O } from "@beep/utils";
import * as aws from "@pulumi/aws";
import * as ghaRunners from "@pulumi/gharunners";
import * as pulumi from "@pulumi/pulumi";
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
// without unzip and checkout needs git. The P4 baked AMI later absorbs this
// into the image. The module INLINES this snippet into its single user-data
// bash script, so shell options must stay subshell-scoped: a leaked `set -u`
// kills the downstream runner-start section on its own unset variables
// (`SEGMENT: unbound variable`, runner-start-failed) — which is also the
// failure signature the rolled-back IMDS DROP produced.
const runnerToolbeltPostInstall = `(
  set -eu
  dnf install -y git unzip zip jq
  logger -t beep-ci-toolbelt "installed git unzip zip jq for heavy lanes"
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
// run. A missing runner directory leaves the hook visibly unarmed for Gate E
// to reject during deployment; the whole snippet stays subshell-scoped for the
// same inline-user-data reason as the toolbelt above.
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
  fi
)
`;

const runnerPostInstall = runnerToolbeltPostInstall + imdsJobHookPostInstall;

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
 * The host IMDS credential-theft mitigation (CSF-003) is wired as a per-job
 * `ACTIONS_RUNNER_HOOK_JOB_STARTED` hook (`imdsJobHookPostInstall`) that
 * installs the uid-scoped `iptables` OWNER-match DROP after the agent has
 * registered but before any job step runs. History that shaped it: the
 * original post-install DROP was deployed and rolled back the same day after
 * the worker failed to register (`runner-start-failed`) — but the toolbelt
 * post-install later reproduced the identical failure with no firewall at
 * all, because the module inlines `userdata_post_install` into its user-data
 * script and a leaked `set -u` kills the runner-start section on its own
 * unset variables. The DROP's culpability was never proven; the retest must
 * keep every snippet subshell-scoped, and no failure story about the hook is
 * believed until reproduced in that form. The hook design accounts for the
 * two structural constraints the rollback exposed: agent and steps share one
 * uid (so the DROP lands per-job, when the agent no longer needs IMDS), and
 * root's config-time IMDS for JIT registration stays open (uid-scoped rule).
 * Privilege transition is explicit — the hook wrapper execs the root-owned
 * installer through a sudoers entry scoped to exactly that script. Boot first
 * installs `iptables-nft` and verifies the nft backend plus OWNER match before
 * writing or wiring the hook. The installer and wrapper propagate failures so
 * GitHub's job-start hook fails closed before any job step can run. A missing
 * runner directory leaves the hook unarmed for the Gate E IMDSv2 token-PUT
 * probe to reject during deployment; no live deployment proof is claimed here.
 * Deploys are gated on Gate E plus the full guest-isolation red-team re-run on
 * a live ephemeral worker; the always-on layers remain IMDSv2 hop limit 1, the
 * permissions-boundary-capped instance role, the ephemeral one-job-one-VM
 * lifecycle, and JIT config that keeps no registration token on the instance.
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
        enable_organization_runners: false,
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
        // Bring-up posture: cutover night saw three correlated spot-reclaim
        // events kill six jobs in two hours (one swept three VMs in the same
        // second), so waves could not complete. Return to "spot" with a
        // one-line revert once steady-state wave stability is proven.
        instance_target_capacity_type: "on-demand",
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
