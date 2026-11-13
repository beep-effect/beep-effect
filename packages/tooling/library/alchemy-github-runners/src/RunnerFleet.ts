/**
 * `RunnerFleet`: one self-hosted GitHub Actions runner fleet declared out of
 * shipped Alchemy primitives under `Namespace.push(...)`.
 *
 * The resource graph reproduces the `multi-runner` composition of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT; see the package
 * README): one webhook, a build queue, job-retry queue, scale-up, job-retry and
 * scale-down Lambda per pool, a fleet-wide termination watcher, SSM
 * housekeeper and runner-binaries syncer. There is no autoscaling group: Spot
 * capacity is a runtime `CreateFleet` call in scale-up.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as EventBridge from "@alchemy.run/aws/EventBridge";
import * as IAM from "@alchemy.run/aws/IAM";
import * as KMS from "@alchemy.run/aws/KMS";
import * as Lambda from "@alchemy.run/aws/Lambda";
import * as S3 from "@alchemy.run/aws/S3";
import * as SQS from "@alchemy.run/aws/SQS";
import * as SSM from "@alchemy.run/aws/SSM";
import type { Input } from "alchemy/Input";
import * as Namespace from "alchemy/Namespace";
import * as Output from "alchemy/Output";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { instanceStateChangeDetailType, spotInterruptionWarningDetailType } from "./Ec2Events.models.ts";
import type { RunnerPool, RunnerType } from "./RunnerPool.models.ts";
import {
  HousekeeperRuntimeConfig,
  LaunchTemplateRef,
  PoolMatcher,
  PoolRuntimeConfig,
  runtimeConfigEnvName,
  SyncerRuntimeConfig,
  TerminationWatcherRuntimeConfig,
  WebhookRuntimeConfig,
} from "./RunnerRuntime.models.ts";
import { declareRunnerSweep } from "./RunnerSweep.ts";
import { renderRunnerUserData, RunnerUserDataInput } from "./RunnerUserData.ts";
import { AppParameterNames, appParameterNames, poolConfigPath, poolTokenPath } from "./SsmParameters.models.ts";

type Value<T> = T | Output.Output<T>;

const lambdaDir = `${import.meta.dirname}/internal/lambda`;
const runnerTarballKey = "actions-runner-linux.tar.gz";

/**
 * What a pool's launch template is built from.
 *
 * **Details**
 *
 * The composite owns the runner role and instance profile and renders the
 * user data; the caller turns them into a launch template (until
 * `@beep/alchemy-aws-extras` ships `RunnerLaunchTemplate`, any resource that
 * returns an id and a version). The template must require IMDSv2 and enable
 * instance metadata tags: the user data reads its token path from them.
 *
 * @category models
 * @since 0.0.0
 */
export interface RunnerLaunchSpec {
  readonly pool: RunnerPool;
  readonly environment: string;
  readonly instanceProfileArn: Output.Output<string>;
  readonly instanceProfileName: Output.Output<string>;
  readonly userData: Output.Output<string>;
}

/**
 * The launch template a pool's scale-up Lambda launches from.
 *
 * @category models
 * @since 0.0.0
 */
export interface RunnerLaunchTemplateRef {
  readonly launchTemplateId: Value<string>;
  readonly version: Value<string>;
}

/**
 * Props of {@link RunnerFleet}.
 *
 * **Details**
 *
 * `name` prefixes every pool's `ghr:environment` (`<name>-<pool>`) and is
 * the termination watcher's tag filter. `ssmRoot` holds the App parameters
 * and each pool's token and config paths. `app` values are written as
 * SecureString parameters under the fleet's own KMS key; nothing here mints
 * an App. `runnerManagedPolicyArns` and `runnerPermissionsBoundaryArn` go on
 * every pool's runner role (the live fleet attaches its IMDS-disable policy
 * this way).
 *
 * @category models
 * @since 0.0.0
 */
export interface RunnerFleetProps<E, R> {
  readonly id: string;
  readonly name: string;
  readonly ssmRoot: string;
  readonly runnerType: RunnerType;
  readonly repositoryAllowList: ReadonlyArray<string>;
  readonly subnetIds: A.NonEmptyReadonlyArray<Value<string>>;
  readonly app: {
    readonly id: Redacted.Redacted<string>;
    readonly keyBase64: Redacted.Redacted<string>;
    readonly webhookSecret: Redacted.Redacted<string>;
  };
  readonly pools: A.NonEmptyReadonlyArray<RunnerPool>;
  readonly launchTemplate: (spec: RunnerLaunchSpec) => Effect.Effect<RunnerLaunchTemplateRef, E, R>;
  readonly runnerManagedPolicyArns?: ReadonlyArray<Value<string>> | undefined;
  readonly runnerPermissionsBoundaryArn?: Value<string> | undefined;
  readonly preInstall?: string | undefined;
  readonly postInstall?: string | undefined;
  readonly runAs?: string | undefined;
  readonly logRetention?: Duration.Input | undefined;
  readonly tokenMinimumDaysOld?: number | undefined;
}

const encodeJson = <A, I>(schema: S.Codec<A, I>) => {
  const encode = S.encodeEffect(S.fromJsonString(schema));
  return (value: A) => encode(value).pipe(Effect.orDie);
};
const encodePool = encodeJson(PoolRuntimeConfig);
const encodeWebhook = encodeJson(WebhookRuntimeConfig);
const encodeHousekeeper = encodeJson(HousekeeperRuntimeConfig);
const encodeWatcher = encodeJson(TerminationWatcherRuntimeConfig);
const encodeSyncer = encodeJson(SyncerRuntimeConfig);

type Statement = Input<IAM.PolicyStatement>;

const allow = (input: {
  readonly actions: ReadonlyArray<string>;
  readonly resources: ReadonlyArray<Value<string>>;
  readonly condition?: Record<string, Record<string, Value<string> | Array<Value<string>>>> | undefined;
}): Statement => ({
  Effect: "Allow",
  Action: A.copy(input.actions),
  Resource: A.copy(input.resources),
  ...(input.condition === undefined ? {} : { Condition: input.condition }),
});

const lambdaRole = (statements: ReadonlyArray<Statement>) => ({ policyStatements: A.copy(statements) });

/** Collects an array of outputs into one output of the array, keeping order. */
const collect = <T>(values: ReadonlyArray<Value<T>>): Output.Output<ReadonlyArray<T>> =>
  A.reduce(values, Output.asOutput<ReadonlyArray<T>>([]), (acc, value) =>
    Output.all(acc, Output.asOutput(value)).pipe(Output.map(([items, item]) => A.append(items, item)))
  );

const ssmArn = Output.interpolate;

const scheduledFunction = Effect.fn("RunnerFleet.scheduledFunction")(function* (input: {
  readonly id: string;
  readonly fn: Lambda.Function;
  readonly scheduleExpression: string;
}) {
  const rule = yield* EventBridge.Rule(`${input.id}Schedule`, {
    scheduleExpression: input.scheduleExpression,
    targets: [{ Id: input.id, Arn: input.fn.functionArn }],
  });
  yield* Lambda.Permission(`${input.id}Invoke`, {
    action: "lambda:InvokeFunction",
    functionName: input.fn.functionName,
    principal: "events.amazonaws.com",
    sourceArn: rule.ruleArn,
  });
  return rule;
});

const queueConsumer = (queue: SQS.Queue): Statement =>
  allow({
    actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"],
    resources: [queue.queueArn],
  });

const queueWithDlq = Effect.fn("RunnerFleet.queueWithDlq")(function* (input: {
  readonly id: string;
  readonly visibilityTimeout: Duration.Input;
  readonly maxReceiveCount: number;
}) {
  const dlq = yield* SQS.Queue(`${input.id}Dlq`, { messageRetentionPeriod: "14 days", sqsManagedSseEnabled: true });
  return yield* SQS.Queue(input.id, {
    visibilityTimeout: input.visibilityTimeout,
    sqsManagedSseEnabled: true,
    redrivePolicy: { deadLetterTargetArn: dlq.queueArn, maxReceiveCount: input.maxReceiveCount },
  });
});

/**
 * Declares a runner fleet.
 *
 * **Details**
 *
 * Every resource is a shipped Alchemy primitive except the delete-only
 * `RunnerSweep` and the launch template the caller builds from
 * {@link RunnerLaunchSpec}. Lambda roles get least-privilege inline policies
 * through `bind`; the termination watcher's `kms:Decrypt` is scoped by
 * `kms:EncryptionContext:PARAMETER_ARN` to the App id and key parameters (no
 * KMS grant). Each Lambda reads its runtime config from one JSON environment
 * variable.
 *
 * **Example** (One pool)
 *
 * ```ts
 * import { RunnerFleet } from "@beep/alchemy-github-runners/RunnerFleet"
 * import { RunnerPool } from "@beep/alchemy-github-runners/RunnerPool.models"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * const fleet = RunnerFleet({
 *   id: "Runners",
 *   name: "beep-ci",
 *   ssmRoot: "/beep-ci",
 *   runnerType: "Org",
 *   repositoryAllowList: ["beep-effect/beep-effect"],
 *   subnetIds: ["subnet-a"],
 *   app: { id: Redacted.make("1"), keyBase64: Redacted.make("a2V5"), webhookSecret: Redacted.make("s") },
 *   pools: [RunnerPool.make({ name: "heavy", instanceTypes: ["m7i.4xlarge"], maximumCount: 2, labels: ["beep-ec2-heavy"] })],
 *   launchTemplate: () => Effect.succeed({ launchTemplateId: "lt-0123456789abcdef0", version: "$Default" }),
 * })
 * console.log(fleet)
 * ```
 *
 * @param props - Namespace id and fleet configuration.
 * @returns The webhook URL, the binaries bucket and each pool's build queue and instance profile.
 * @category constructors
 * @since 0.0.0
 */
export const RunnerFleet = <E, R>(props: RunnerFleetProps<E, R>) =>
  Namespace.push(
    props.id,
    Effect.gen(function* () {
      const appNames = appParameterNames(props.ssmRoot);
      const logging = { retention: props.logRetention ?? "14 days" };
      const key = yield* KMS.Key("SecretsKey", {
        description: `GitHub App secrets of runner fleet ${props.name}`,
        enableKeyRotation: true,
      });
      yield* KMS.Alias("SecretsKeyAlias", { aliasName: `alias/${props.name}-github-app`, targetKeyId: key.keyId });
      const appParameter = (logicalId: string, name: string, value: Redacted.Redacted<string>) =>
        SSM.Parameter(logicalId, { name, type: "SecureString", keyId: key.keyArn, value });
      const appId = yield* appParameter("AppId", appNames.id, props.app.id);
      const appKey = yield* appParameter("AppKey", appNames.keyBase64, props.app.keyBase64);
      const webhookSecret = yield* appParameter("WebhookSecret", appNames.webhookSecret, props.app.webhookSecret);
      const readAppSecrets = [
        allow({ actions: ["ssm:GetParameter"], resources: [appId.parameterArn, appKey.parameterArn] }),
        allow({ actions: ["kms:Decrypt"], resources: [key.keyArn] }),
      ] as const;

      const binaries = yield* S3.Bucket("RunnerBinaries", {
        forceDestroy: true,
        publicAccessBlock: {
          blockPublicAcls: true,
          blockPublicPolicy: true,
          ignorePublicAcls: true,
          restrictPublicBuckets: true,
        },
      });
      const tarballUrl = Output.interpolate`s3://${binaries.bucketName}/${runnerTarballKey}`;

      const pools = yield* Effect.forEach(props.pools, (pool) =>
        Namespace.push(
          `Pool${pool.name}`,
          Effect.gen(function* () {
            const environment = `${props.name}-${pool.name}`;
            const tokenPath = poolTokenPath({ root: props.ssmRoot, pool: pool.name });
            const configPath = poolConfigPath({ root: props.ssmRoot, pool: pool.name });
            const tokenArn = ssmArn`arn:aws:ssm:*:*:parameter${tokenPath}`;
            const configArn = ssmArn`arn:aws:ssm:*:*:parameter${configPath}`;

            const runnerRole = yield* IAM.Role("RunnerRole", {
              assumeRolePolicyDocument: {
                Version: "2012-10-17",
                Statement: [
                  { Effect: "Allow", Principal: { Service: "ec2.amazonaws.com" }, Action: ["sts:AssumeRole"] },
                ],
              },
              ...(props.runnerPermissionsBoundaryArn === undefined
                ? {}
                : { permissionsBoundary: props.runnerPermissionsBoundaryArn }),
              ...(props.runnerManagedPolicyArns === undefined
                ? {}
                : { managedPolicyArns: A.copy(props.runnerManagedPolicyArns) }),
              inlinePolicies: {
                runner: {
                  Version: "2012-10-17",
                  Statement: [
                    allow({
                      actions: ["ssm:GetParameter", "ssm:DeleteParameter"],
                      resources: [Output.interpolate`${tokenArn}/*`],
                      condition: { StringLike: { "ec2:SourceInstanceARN": "*/${aws:ResourceTag/InstanceId}" } },
                    }),
                    allow({
                      actions: ["kms:Decrypt"],
                      resources: ["*"],
                      condition: { StringLike: { "kms:ViaService": "ssm.*.amazonaws.com" } },
                    }),
                    allow({
                      actions: ["s3:GetObject"],
                      resources: [Output.interpolate`${binaries.bucketArn}/${runnerTarballKey}`],
                    }),
                    allow({
                      actions: ["ec2:TerminateInstances", "ec2:CreateTags"],
                      resources: ["arn:aws:ec2:*:*:instance/*"],
                      condition: { StringEquals: { "aws:ARN": "${ec2:SourceInstanceARN}" } },
                    }),
                    allow({ actions: ["ec2:DescribeTags"], resources: ["*"] }),
                  ],
                },
              },
            });
            const instanceProfile = yield* IAM.InstanceProfile("RunnerInstanceProfile", {
              roleName: runnerRole.roleName,
            });
            const template = yield* props.launchTemplate({
              pool,
              environment,
              instanceProfileArn: instanceProfile.instanceProfileArn,
              instanceProfileName: instanceProfile.instanceProfileName,
              userData: tarballUrl.pipe(
                Output.map((runnerTarballS3Url) =>
                  renderRunnerUserData(
                    RunnerUserDataInput.make({
                      runnerTarballS3Url,
                      ephemeral: pool.ephemeral,
                      jitConfig: pool.jitConfig,
                      ...(props.runAs === undefined ? {} : { runAs: props.runAs }),
                      ...(props.preInstall === undefined ? {} : { preInstall: props.preInstall }),
                      ...(props.postInstall === undefined ? {} : { postInstall: props.postInstall }),
                    })
                  )
                )
              ),
            });

            const buildQueue = yield* queueWithDlq({
              id: "BuildQueue",
              visibilityTimeout: "2 minutes",
              maxReceiveCount: 5,
            });
            const jobRetryQueue = O.isSome(pool.jobRetry)
              ? yield* queueWithDlq({ id: "JobRetryQueue", visibilityTimeout: "2 minutes", maxReceiveCount: 3 }).pipe(
                  Effect.asSome
                )
              : O.none<SQS.Queue>();

            const runtimeConfig = Output.all(
              collect(props.subnetIds),
              Output.asOutput(template.launchTemplateId),
              Output.asOutput(template.version),
              buildQueue.queueUrl,
              jobRetryQueue.pipe(
                O.map((queue) => queue.queueUrl),
                O.toArray,
                collect
              )
            ).pipe(
              Output.mapEffect(([subnetIds, launchTemplateId, version, buildQueueUrl, jobRetryQueueUrl]) =>
                encodePool(
                  PoolRuntimeConfig.make({
                    pool,
                    environment,
                    runnerType: props.runnerType,
                    subnetIds: A.isReadonlyArrayNonEmpty(subnetIds) ? subnetIds : [""],
                    launchTemplate: LaunchTemplateRef.make({ launchTemplateId, version }),
                    tokenPath,
                    configPath,
                    buildQueueUrl,
                    jobRetryQueueUrl: A.head(jobRetryQueueUrl),
                    app: appNames,
                  })
                )
              )
            );
            const poolFunction = (logicalId: string, file: string, extra: Partial<Lambda.FunctionProps> = {}) =>
              Lambda.Function(logicalId, {
                main: `${lambdaDir}/${file}`,
                handler: "handler",
                functionUrl: false,
                timeout: Duration.seconds(60),
                memorySize: 512,
                logging,
                env: { [runtimeConfigEnvName]: runtimeConfig },
                ...extra,
              } as Lambda.FunctionZipProps);

            const scaleUp = yield* poolFunction("ScaleUp", "scale-up.ts", { reservedConcurrentExecutions: 1 });
            yield* Lambda.EventSourceMapping("ScaleUpSource", {
              functionName: scaleUp.functionName,
              eventSourceArn: buildQueue.queueArn,
              batchSize: 10,
              functionResponseTypes: ["ReportBatchItemFailures"],
            });
            yield* scaleUp.bind(
              "ScaleUp",
              lambdaRole([
                queueConsumer(buildQueue),
                allow({
                  actions: [
                    "ec2:CreateFleet",
                    "ec2:RunInstances",
                    "ec2:CreateTags",
                    "ec2:DescribeInstances",
                    "ec2:DescribeLaunchTemplateVersions",
                  ],
                  resources: ["*"],
                }),
                allow({
                  actions: ["ec2:TerminateInstances"],
                  resources: ["*"],
                  condition: { StringEquals: { "ec2:ResourceTag/ghr:environment": environment } },
                }),
                allow({ actions: ["iam:PassRole"], resources: [runnerRole.roleArn] }),
                allow({
                  actions: ["ssm:PutParameter", "ssm:AddTagsToResource", "ssm:GetParameter"],
                  resources: [Output.interpolate`${tokenArn}/*`, Output.interpolate`${configArn}/*`],
                }),
                ...readAppSecrets,
                ...O.match(jobRetryQueue, {
                  onNone: () => [],
                  onSome: (queue) => [allow({ actions: ["sqs:SendMessage"], resources: [queue.queueArn] })],
                }),
              ])
            );

            if (O.isSome(jobRetryQueue)) {
              const jobRetry = yield* poolFunction("JobRetry", "job-retry.ts");
              yield* Lambda.EventSourceMapping("JobRetrySource", {
                functionName: jobRetry.functionName,
                eventSourceArn: jobRetryQueue.value.queueArn,
                batchSize: 10,
              });
              yield* jobRetry.bind(
                "JobRetry",
                lambdaRole([
                  queueConsumer(jobRetryQueue.value),
                  allow({ actions: ["sqs:SendMessage"], resources: [buildQueue.queueArn] }),
                  ...readAppSecrets,
                ])
              );
            }

            const scaleDown = yield* poolFunction("ScaleDown", "scale-down.ts");
            yield* scheduledFunction({ id: "ScaleDown", fn: scaleDown, scheduleExpression: "cron(* * * * ? *)" });
            yield* scaleDown.bind(
              "ScaleDown",
              lambdaRole([
                allow({ actions: ["ec2:DescribeInstances", "ec2:DescribeTags"], resources: ["*"] }),
                allow({
                  actions: ["ec2:TerminateInstances", "ec2:CreateTags", "ec2:DeleteTags"],
                  resources: ["*"],
                  condition: { StringEquals: { "ec2:ResourceTag/ghr:environment": environment } },
                }),
                ...readAppSecrets,
              ])
            );

            return {
              pool,
              environment,
              tokenPath,
              buildQueue,
              scaleUp,
              instanceProfileArn: instanceProfile.instanceProfileArn,
              matcher: buildQueue.queueUrl.pipe(
                Output.map((queueUrl) =>
                  PoolMatcher.make({ pool: pool.name, queueUrl, labels: pool.labels, labelMatch: pool.labelMatch })
                )
              ),
            };
          })
        )
      );

      const webhookConfig = collect(A.map(pools, (pool) => pool.matcher)).pipe(
        Output.mapEffect((matchers) =>
          encodeWebhook(
            WebhookRuntimeConfig.make({
              webhookSecretParameterName: appNames.webhookSecret,
              repositoryAllowList: props.repositoryAllowList,
              pools: A.isReadonlyArrayNonEmpty(matchers)
                ? matchers
                : A.map(props.pools, (pool) =>
                    PoolMatcher.make({
                      pool: pool.name,
                      queueUrl: "",
                      labels: pool.labels,
                      labelMatch: pool.labelMatch,
                    })
                  ),
            })
          )
        )
      );
      const webhook = yield* Lambda.Function("Webhook", {
        main: `${lambdaDir}/webhook.ts`,
        handler: "handler",
        functionUrl: true,
        timeout: Duration.seconds(10),
        memorySize: 256,
        logging,
        env: { [runtimeConfigEnvName]: webhookConfig },
      });
      yield* webhook.bind(
        "Webhook",
        lambdaRole([
          allow({ actions: ["ssm:GetParameter"], resources: [webhookSecret.parameterArn] }),
          allow({ actions: ["kms:Decrypt"], resources: [key.keyArn] }),
          allow({ actions: ["sqs:SendMessage"], resources: A.map(pools, (pool) => pool.buildQueue.queueArn) }),
        ])
      );

      const tokenPaths = A.map(pools, (pool) => pool.tokenPath);
      const housekeeper = yield* Lambda.Function("SsmHousekeeper", {
        main: `${lambdaDir}/ssm-housekeeper.ts`,
        handler: "handler",
        functionUrl: false,
        timeout: Duration.minutes(5),
        logging,
        env: {
          [runtimeConfigEnvName]: yield* encodeHousekeeper(
            HousekeeperRuntimeConfig.make({
              tokenPaths: A.isReadonlyArrayNonEmpty(tokenPaths) ? tokenPaths : [props.ssmRoot],
              minimumDaysOld: props.tokenMinimumDaysOld ?? 1,
              dryRun: false,
            })
          ),
        },
      });
      yield* scheduledFunction({ id: "SsmHousekeeper", fn: housekeeper, scheduleExpression: "rate(1 day)" });
      yield* housekeeper.bind(
        "SsmHousekeeper",
        lambdaRole([
          allow({
            actions: ["ssm:GetParametersByPath", "ssm:DeleteParameter"],
            resources: A.flatMap(tokenPaths, (path) => [
              ssmArn`arn:aws:ssm:*:*:parameter${path}`,
              ssmArn`arn:aws:ssm:*:*:parameter${path}/*`,
            ]),
          }),
        ])
      );

      const syncerConfig = binaries.bucketName.pipe(
        Output.mapEffect((bucketName) =>
          encodeSyncer(
            SyncerRuntimeConfig.make({ bucketName, objectKey: runnerTarballKey, os: "linux", architecture: "x64" })
          )
        )
      );
      const syncer = yield* Lambda.Function("RunnerBinariesSyncer", {
        main: `${lambdaDir}/runner-binaries-syncer.ts`,
        handler: "handler",
        functionUrl: false,
        timeout: Duration.minutes(5),
        memorySize: 1024,
        logging,
        env: { [runtimeConfigEnvName]: syncerConfig },
      });
      yield* scheduledFunction({ id: "RunnerBinariesSyncer", fn: syncer, scheduleExpression: "rate(1 day)" });
      yield* syncer.bind(
        "RunnerBinariesSyncer",
        lambdaRole([
          allow({
            actions: ["s3:GetObjectTagging", "s3:PutObject", "s3:PutObjectTagging"],
            resources: [Output.interpolate`${binaries.bucketArn}/${runnerTarballKey}`],
          }),
        ])
      );

      const deregisterRetry = yield* queueWithDlq({
        id: "DeregisterRetryQueue",
        visibilityTimeout: "2 minutes",
        maxReceiveCount: 3,
      });
      const watcherConfig = deregisterRetry.queueUrl.pipe(
        Output.mapEffect((deregisterRetryQueueUrl) =>
          encodeWatcher(
            TerminationWatcherRuntimeConfig.make({
              environmentPrefix: props.name,
              app: appNames,
              deregisterRetryQueueUrl,
            })
          )
        )
      );
      const watcher = yield* Lambda.Function("TerminationWatcher", {
        main: `${lambdaDir}/termination-watcher.ts`,
        handler: "handler",
        functionUrl: false,
        timeout: Duration.seconds(60),
        logging,
        env: { [runtimeConfigEnvName]: watcherConfig },
      });
      yield* Lambda.EventSourceMapping("DeregisterRetrySource", {
        functionName: watcher.functionName,
        eventSourceArn: deregisterRetry.queueArn,
        batchSize: 1,
      });
      yield* Effect.forEach(
        [
          {
            id: "SpotInterruption",
            pattern: { source: ["aws.ec2"], "detail-type": [spotInterruptionWarningDetailType] },
          },
          {
            id: "InstanceStateChange",
            pattern: {
              source: ["aws.ec2"],
              "detail-type": [instanceStateChangeDetailType],
              detail: { state: ["shutting-down", "terminated"] },
            },
          },
        ],
        Effect.fnUntraced(function* ({ id: ruleId, pattern }) {
          const rule = yield* EventBridge.Rule(`${ruleId}Rule`, {
            eventPattern: pattern,
            targets: [{ Id: ruleId, Arn: watcher.functionArn }],
          });
          yield* Lambda.Permission(`${ruleId}Invoke`, {
            action: "lambda:InvokeFunction",
            functionName: watcher.functionName,
            principal: "events.amazonaws.com",
            sourceArn: rule.ruleArn,
          });
        }),
        { discard: true }
      );
      yield* watcher.bind(
        "TerminationWatcher",
        lambdaRole([
          queueConsumer(deregisterRetry),
          allow({ actions: ["sqs:SendMessage"], resources: [deregisterRetry.queueArn] }),
          allow({ actions: ["ec2:DescribeInstances"], resources: ["*"] }),
          allow({ actions: ["ssm:GetParameter"], resources: [appId.parameterArn, appKey.parameterArn] }),
          {
            Effect: "Allow",
            Action: ["kms:Decrypt"],
            Resource: [key.keyArn],
            Condition: {
              StringEquals: { "kms:EncryptionContext:PARAMETER_ARN": [appId.parameterArn, appKey.parameterArn] },
            },
          },
        ])
      );

      yield* declareRunnerSweep({
        id: "Sweep",
        props: {
          environments: A.map(pools, (pool) => pool.environment),
          tokenPaths,
          dependsOn: A.map(pools, (pool) => pool.scaleUp.functionName),
        },
      });

      return {
        webhookUrl: webhook.functionUrl,
        binariesBucket: binaries.bucketName,
        app: AppParameterNames.make(appNames),
        pools: A.map(pools, (pool) => ({
          name: pool.pool.name,
          environment: pool.environment,
          buildQueueUrl: pool.buildQueue.queueUrl,
          instanceProfileArn: pool.instanceProfileArn,
        })),
      };
    })
  );
