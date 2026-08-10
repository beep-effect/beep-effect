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

const defaultRunnerLabel = "beep-ec2-heavy-shadow";
const githubAppIdSsmParameterName = "/github-action-runners/app/github_app_id";
const githubAppKeyBase64SsmParameterName = "/github-action-runners/app/github_app_key_base64";
const githubAppWebhookSecretSsmParameterName = "/github-action-runners/app/github_app_webhook_secret";

const runnerInstanceTypes = ["m7i.2xlarge", "m7i-flex.2xlarge", "m7a.2xlarge", "m6i.2xlarge"];
const onDemandFailoverErrors = ["InsufficientInstanceCapacity", "InsufficientCapacityOnHost", "UnfulfillableCapacity"];

const awsArnPattern = /^arn:aws[a-z-]*:[a-z0-9-]+:[a-z0-9-]*:[0-9]*:.+$/u;
const ssmParameterArnPattern = /^arn:aws[a-z-]*:ssm:[a-z0-9-]+:[0-9]*:parameter\/.+$/u;
const absoluteZipPathPattern = /^\/.+\.zip$/u;
const runnerLabelPattern = /^[A-Za-z0-9_-]{1,64}$/u;

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

const RunnerLabel = S.String.check(
  S.isPattern(runnerLabelPattern, {
    identifier: $I`RunnerLabelFormat`,
    title: "Runner Label Format",
    description: "A GitHub Actions runner label containing letters, digits, underscores, or hyphens.",
    message: "Expected a runner label containing only letters, digits, underscores, or hyphens",
  })
).pipe($I.annoteSchema("RunnerLabel", { description: "A GitHub Actions runner label." }));

type CiFleetControllerPulumiConfigValuesFields = {
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
    githubAppIdSsmParameterArn: values.githubAppIdSsmParameterArn,
    githubAppKeyBase64SsmParameterArn: values.githubAppKeyBase64SsmParameterArn,
    githubAppKmsKeyArn: values.githubAppKmsKeyArn,
    githubAppWebhookSecretSsmParameterArn: values.githubAppWebhookSecretSsmParameterArn,
    runnerBinariesSyncerLambdaZip: values.runnerBinariesSyncerLambdaZip,
    runnerRolePermissionsBoundaryArn: values.runnerRolePermissionsBoundaryArn,
    runnersLambdaZip: values.runnersLambdaZip,
    terminationWatcherLambdaZip: values.terminationWatcherLambdaZip,
    webhookLambdaZip: values.webhookLambdaZip,
    ...O.getSomesStruct({ runnerLabel: O.fromUndefinedOr(values.runnerLabel) }),
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
      githubAppIdSsmParameterArn: config.require("githubAppIdSsmParameterArn"),
      githubAppKeyBase64SsmParameterArn: config.require("githubAppKeyBase64SsmParameterArn"),
      githubAppKmsKeyArn: config.require("githubAppKmsKeyArn"),
      githubAppWebhookSecretSsmParameterArn: config.require("githubAppWebhookSecretSsmParameterArn"),
      runnerBinariesSyncerLambdaZip: config.require("runnerBinariesSyncerLambdaZip"),
      runnerRolePermissionsBoundaryArn: config.require("runnerRolePermissionsBoundaryArn"),
      runnersLambdaZip: config.require("runnersLambdaZip"),
      terminationWatcherLambdaZip: config.require("terminationWatcherLambdaZip"),
      webhookLambdaZip: config.require("webhookLambdaZip"),
      ...O.getSomesStruct({ runnerLabel: O.fromUndefinedOr(config.get("runnerLabel")) }),
    })
  );
};

type CiFleetControllerArgs = {
  readonly config: CiFleetControllerConfig;
  readonly region: pulumi.Input<string>;
  readonly resolvedAmiId: pulumi.Input<string>;
  readonly subnetIds: pulumi.Input<pulumi.Input<string>[]>;
  readonly vpcId: pulumi.Input<string>;
  readonly workerSecurityGroupId: pulumi.Input<string>;
};

/**
 * Ephemeral GitHub Actions runner controller backed by the pinned Terraform
 * module through Pulumi's terraform-module provider.
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
        value: args.resolvedAmiId,
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
        kms_key_arn: args.config.githubAppKmsKeyArn,
        logging_retention_in_days: 14,
        minimum_running_time_in_minutes: 5,
        prefix: "beep-ci",
        repository_white_list: ["beep-effect/beep-effect"],
        role_permissions_boundary: args.config.runnerRolePermissionsBoundaryArn,
        runner_additional_security_group_ids: [args.workerSecurityGroupId],
        runner_architecture: "x64",
        runner_binaries_syncer_lambda_zip: args.config.runnerBinariesSyncerLambdaZip,
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
        runner_run_as: "ubuntu",
        runners_ebs_optimized: true,
        runners_lambda_zip: args.config.runnersLambdaZip,
        runners_maximum_count: 4,
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
