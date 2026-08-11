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
 * The host IMDS credential-theft mitigation (CSF-003) is NOT wired here. A
 * post-install `iptables` OWNER-match DROP on the `runnerRunAs` uid was deployed
 * and rolled back the same day: because the runner agent itself runs as that
 * uid, the DROP starved the agent at start-up and the worker failed to register
 * (`runner-start-failed`), which the Gate E probe caught before any heavy-lane
 * cutover. A uid DROP cannot separate the agent from job steps when both share
 * one uid, and a blanket DROP would additionally sever the root config-time IMDS
 * the runner needs for JIT registration. The rework is a per-job
 * `ACTIONS_RUNNER_HOOK_JOB_STARTED` hook that installs the DROP after the agent
 * is running but before a job's steps, re-validated through Gate E before
 * redeploy. Until then the controls that bound credential theft are the layers
 * that remain live: IMDSv2 with hop limit 1 (blocks unprivileged containers), a
 * minimal permissions-boundary-capped instance-profile role, the ephemeral
 * one-job-one-VM lifecycle, and JIT config that keeps no registration token on
 * the instance.
 *
 * Reliability semantics for the one-job-one-VM fleet: `job_retry` rescues a
 * job whose runner died between launch and pickup (spot reclaim, boot
 * failure) — without it such a job waits on GitHub's six-hour queue timeout,
 * because nothing else re-delivers it. A spot reclaim mid-job still fails
 * that job and only a workflow re-run recovers it; spot is kept anyway as a
 * deliberate ~3x cost trade against on-demand. `runners_maximum_count` bounds
 * concurrent instances only — jobs beyond the cap retry from SQS as capacity
 * frees rather than being dropped.
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
            device_name: "/dev/sda1",
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
        enable_job_queued_check: true,
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
        runner_metadata_options: {
          http_endpoint: "enabled",
          http_put_response_hop_limit: 1,
          http_tokens: "required",
          instance_metadata_tags: "enabled",
        },
        runner_name_prefix: "beep-ci-",
        runner_os: "linux",
        runner_run_as: runnerRunAs,
        runners_ebs_optimized: true,
        runners_lambda_zip: args.config.runnersLambdaZip,
        // Concurrency cap, not a budget: each ephemeral VM lives exactly one
        // job, so the cap only decides how much of a wave runs in parallel. A
        // full main wave is seven heavy lanes; ten absorbs an overlapping PR
        // wave without serializing. Excess jobs retry from SQS every ~30s.
        runners_maximum_count: 10,
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
