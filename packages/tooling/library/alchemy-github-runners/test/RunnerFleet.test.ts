import * as Test from "@alchemy.run/test/Vitest";
import {
  declareRunnerSweep,
  JobRetryPolicy,
  PoolRuntimeConfig,
  RunnerFleet,
  RunnerFleetProps,
  RunnerPool,
  runtimeConfigEnvName,
  SelfHostedRunner,
  WebhookRuntimeConfig,
} from "@beep/alchemy-github-runners";
import { expect } from "@effect/vitest";
import { inMemoryState } from "alchemy/State/InMemoryState";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeProviders, Recorder } from "./support/FakeProviders.ts";
import { World } from "./support/FakeWorld.ts";
import type * as Core from "@alchemy.run/test/Core";
import type { Input } from "alchemy/Input";
import type { StackServices } from "alchemy/Stack";

interface Statement {
  readonly Action: ReadonlyArray<string>;
  readonly Condition?: Record<string, Record<string, string>>;
  readonly Effect: string;
  readonly Resource: ReadonlyArray<string>;
}

const harness = (stage: string) => {
  const recorder = new Recorder();
  const world = new World();
  const { test } = Test.make({ providers: fakeProviders({ recorder, world }), state: inMemoryState(), stage });
  return { recorder, world, test };
};

const onePool = harness("one-pool");
const twoPools = harness("two-pools");
const sweeping = harness("sweep");

const heavy = RunnerPool.make({
  name: "heavy",
  instanceTypes: ["r7a.2xlarge", "m7i.4xlarge"],
  maximumCount: 2,
  labels: ["beep-ec2-heavy"],
  runnerGroup: "beep-ec2-heavy",
  runnerNamePrefix: "beep-ci-",
  jobRetry: JobRetryPolicy.makeOption({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 }),
});
const overflow = RunnerPool.make({
  name: "overflow",
  instanceTypes: ["r7a.2xlarge"],
  maximumCount: 48,
  labels: ["beep-shard-overflow"],
  runnerGroup: "beep-shard-overflow",
  runnerNamePrefix: "beep-ovf-",
});

const fleet = (pools: A.NonEmptyReadonlyArray<RunnerPool>) =>
  RunnerFleet(
    RunnerFleetProps.make({
      id: "Runners",
      name: "beep-ci",
      ssmRoot: "/beep-ci",
      runnerType: "Org",
      repositoryAllowList: ["beep-effect/beep-effect"],
      subnetIds: ["subnet-a", "subnet-b"],
      app: { id: Redacted.make("123"), keyBase64: Redacted.make("a2V5"), webhookSecret: Redacted.make("secret") },
      pools,
      runnerManagedPolicyArns: ["arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable"],
      launchTemplate: {
        imageId: "resolve:ssm:/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id",
        securityGroupIds: ["sg-runner"],
        ebsOptimized: true,
      },
    })
  );

type ScratchStack = Test.ScratchStack;

type AlchemyDeclaredDeployError = Effect.Error<Core.DeployResult<unknown>>;

type ScratchDeploy = <A, E, R>(
  definition: Effect.Effect<A, E, R>
) => Effect.Effect<Input.Resolve<A>, AlchemyDeclaredDeployError | E, Exclude<R, StackServices>>;

const deploy = <A, E, R>(stack: ScratchStack, definition: Effect.Effect<A, E, R>) => {
  const run: ScratchDeploy = stack.deploy;
  return run(definition);
};

const destroy = (stack: ScratchStack) => {
  const run: () => Effect.Effect<void, AlchemyDeclaredDeployError> = stack.destroy;
  return run();
};

const decodePool = S.decodeUnknownEffect(S.fromJsonString(PoolRuntimeConfig));
const decodeWebhook = S.decodeUnknownEffect(S.fromJsonString(WebhookRuntimeConfig));

const typeCounts = (recorder: Recorder) =>
  A.reduce(recorder.reconciled, R.empty<string, number>(), (counts, entry) =>
    R.set(counts, entry.type, (counts[entry.type] ?? 0) + 1)
  );

const fn = (recorder: Recorder, fqn: string) =>
  O.getOrThrow(O.filter(recorder.byFqn(fqn), (entry) => entry.type === "Lambda.Function"));

const statementsOf = (recorder: Recorder, fqn: string) =>
  A.flatMap(fn(recorder, fqn).bindings, (binding) => binding.data.policyStatements ?? []);

onePool.test.provider("one pool declares the whole fleet from shipped primitives", (stack) =>
  Effect.gen(function* () {
    const { recorder } = onePool;
    yield* destroy(stack);
    const out = yield* deploy(stack, fleet([heavy]));

    expect(typeCounts(recorder)).toStrictEqual({
      "KMS.Key": 1,
      "KMS.Alias": 1,
      "SSM.Parameter": 3,
      "S3.Bucket": 1,
      "IAM.Role": 1,
      "IAM.InstanceProfile": 1,
      "BeepAWS.EC2.RunnerLaunchTemplate": 1,
      "SQS.Queue": 6,
      "Lambda.Function": 7,
      "Lambda.EventSourceMapping": 3,
      "EventBridge.Rule": 5,
      "Lambda.Permission": 5,
    });

    const scaleUp = fn(recorder, "Runners/Poolheavy/ScaleUp");
    expect(scaleUp.news.reservedConcurrentExecutions).toBe(1);
    expect(scaleUp.news.functionUrl).toBe(false);
    expect(Str.endsWith("internal/lambda/scale-up.ts")(String(scaleUp.news.main))).toBe(true);
    const config = yield* decodePool((scaleUp.news.env as Record<string, unknown>)[runtimeConfigEnvName]);
    expect([
      config.environment,
      config.launchTemplate.launchTemplateId,
      config.launchTemplate.version,
      config.tokenPath,
      config.subnetIds,
    ]).toStrictEqual([
      "beep-ci-heavy",
      "lt-Runners-Poolheavy-LaunchTemplate",
      "1",
      "/beep-ci/heavy/tokens",
      ["subnet-a", "subnet-b"],
    ]);
    expect(config.buildQueueUrl).toBe("https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-BuildQueue");
    expect(O.getOrUndefined(config.jobRetryQueueUrl)).toBe(
      "https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-JobRetryQueue"
    );
    expect(O.getOrUndefined(config.buildDlqUrl)).toBe(
      "https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-BuildQueueDlq"
    );
    const sends = A.filter(statementsOf(recorder, "Runners/Poolheavy/ScaleUp"), (statement) =>
      A.contains(statement.Action as ReadonlyArray<string>, "sqs:SendMessage")
    );
    const deletes = A.filter(statementsOf(recorder, "Runners/Poolheavy/ScaleUp"), (statement) =>
      A.contains(statement.Action as ReadonlyArray<string>, "ssm:DeleteParameter")
    );
    expect(
      A.map(deletes, (statement) => [statement.Action, statement.Resource] as const),
      "scale-up may delete only its own pool's token parameters, a failed configuration's leftover"
    ).toStrictEqual([
      [["ssm:DeleteParameter"], ["arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/heavy/tokens/*"]],
    ]);
    expect(
      A.flatMap(sends, (statement) => statement.Resource as ReadonlyArray<string>),
      "scale-up may send to its build DLQ (a deterministic configure failure) and to job-retry, nowhere else"
    ).toStrictEqual([
      "arn:aws:sqs:us-east-1:123456789012:Runners-Poolheavy-BuildQueueDlq",
      "arn:aws:sqs:us-east-1:123456789012:Runners-Poolheavy-JobRetryQueue",
    ]);

    const queueSettings = (fqn: string) => {
      const { visibilityTimeout, messageRetentionPeriod, redrivePolicy } = O.getOrThrow(recorder.byFqn(fqn)).news;
      return { visibilityTimeout, messageRetentionPeriod, redrivePolicy };
    };
    expect(
      queueSettings("Runners/Poolheavy/BuildQueue"),
      "a message over the cap waits a day on the build queue and never reaches a DLQ for waiting alone"
    ).toStrictEqual({
      visibilityTimeout: "1 minute",
      messageRetentionPeriod: "1 day",
      redrivePolicy: undefined,
    });
    const jobRetryQueue = queueSettings("Runners/Poolheavy/JobRetryQueue");
    expect([jobRetryQueue.visibilityTimeout, jobRetryQueue.messageRetentionPeriod]).toStrictEqual([
      "2 minutes",
      undefined,
    ]);
    expect(jobRetryQueue.redrivePolicy).toMatchObject({ maxReceiveCount: 3 });

    const source = O.getOrThrow(recorder.byFqn("Runners/Poolheavy/ScaleUpSource"));
    expect(
      [source.news.functionName, source.news.functionResponseTypes],
      "by ARN, so lambda:FunctionArn in the deploy role policy reads one value on every mapping call"
    ).toStrictEqual([
      "arn:aws:lambda:us-east-1:123456789012:function-Runners-Poolheavy-ScaleUp",
      ["ReportBatchItemFailures"],
    ]);

    const mappingFunctions = A.map(recorder.ofType("Lambda.EventSourceMapping"), (entry) => [
      entry.fqn,
      entry.news.functionName,
    ]);
    expect(
      A.sort(
        mappingFunctions,
        Order.mapInput(Order.String, ([fqn]: ReadonlyArray<unknown>) => String(fqn))
      ),
      "every mapping names its function by ARN, not only the scale-up one"
    ).toStrictEqual([
      ["Runners/DeregisterRetrySource", "arn:aws:lambda:us-east-1:123456789012:function-Runners-TerminationWatcher"],
      ["Runners/Poolheavy/JobRetrySource", "arn:aws:lambda:us-east-1:123456789012:function-Runners-Poolheavy-JobRetry"],
      ["Runners/Poolheavy/ScaleUpSource", "arn:aws:lambda:us-east-1:123456789012:function-Runners-Poolheavy-ScaleUp"],
    ]);

    const sources = A.map(recorder.ofType("Lambda.EventSourceMapping"), (entry) => entry.news.functionResponseTypes);
    expect(sources).toStrictEqual([
      ["ReportBatchItemFailures"],
      ["ReportBatchItemFailures"],
      ["ReportBatchItemFailures"],
    ]);

    expect(fn(recorder, "Runners/Webhook").news.functionUrl).toBe(true);
    expect(out.webhookUrl).toBe("https://runners-webhook.lambda-url.on.aws/");
    expect(
      A.map(["Runners/SsmHousekeeper", "Runners/TerminationWatcher"], (fqn) => fn(recorder, fqn).news.memorySize),
      "both ran at 93-98% of Lambda's 128 MB default before they were sized (2026-11-20)"
    ).toStrictEqual([256, 256]);
    const webhook = yield* decodeWebhook(
      (fn(recorder, "Runners/Webhook").news.env as Record<string, unknown>)[runtimeConfigEnvName]
    );
    expect(A.map(webhook.pools, (pool) => [pool.pool, pool.labels])).toStrictEqual([["heavy", ["beep-ec2-heavy"]]]);

    const rules = A.map(recorder.ofType("EventBridge.Rule"), (rule) =>
      String(rule.news.scheduleExpression ?? "pattern")
    );
    expect(A.sort(rules, Str.Order)).toStrictEqual([
      "cron(* * * * ? *)",
      "pattern",
      "pattern",
      "rate(1 day)",
      "rate(1 day)",
    ]);

    expect(
      A.map(statementsOf(recorder, "Runners/RunnerBinariesSyncer"), (statement) => statement.Action),
      "the runner tarball mirror is a multipart upload, and a failed one is aborted"
    ).toStrictEqual([["s3:AbortMultipartUpload", "s3:GetObjectTagging", "s3:PutObject", "s3:PutObjectTagging"]]);

    const kms = A.filter(statementsOf(recorder, "Runners/TerminationWatcher"), (statement) =>
      A.contains(statement.Action as ReadonlyArray<string>, "kms:Decrypt")
    );
    expect(kms).toStrictEqual([
      {
        Effect: "Allow",
        Action: ["kms:Decrypt"],
        Resource: ["arn:aws:kms:us-east-1:123456789012:key-Runners-SecretsKey"],
        Condition: {
          StringEquals: {
            "kms:EncryptionContext:PARAMETER_ARN": [
              "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/app/github_app_id",
              "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/app/github_app_key_base64",
            ],
          },
        },
      },
    ]);

    const template = O.getOrThrow(recorder.byFqn("Runners/Poolheavy/LaunchTemplate"));
    expect([
      template.news.securityGroupIds,
      template.news.ebsOptimized,
      template.news.instanceProfileArn,
      template.news.metadataOptions,
    ]).toStrictEqual([
      ["sg-runner"],
      true,
      "arn:aws:iam:us-east-1:123456789012:instance-profile-Runners-Poolheavy-RunnerInstanceProfile",
      { httpEndpoint: "enabled", httpTokens: "required", httpPutResponseHopLimit: 1, instanceMetadataTags: "enabled" },
    ]);
    expect(Str.includes("ghr:token_path")(String(template.news.userData))).toBe(true);
    const role = O.getOrThrow(recorder.byFqn("Runners/Poolheavy/RunnerRole"));
    expect(role.news.managedPolicyArns).toStrictEqual(["arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable"]);
    const runnerPolicy = (role.news.inlinePolicies as Record<string, { readonly Statement: ReadonlyArray<Statement> }>)
      .runner;
    const decrypts = A.filter(runnerPolicy?.Statement ?? [], (statement) =>
      A.contains(statement.Action, "kms:Decrypt")
    );
    expect(
      decrypts,
      "a runner decrypts only via Parameter Store, in its region, for its own pool's token; never <root>/app"
    ).toStrictEqual([
      {
        Effect: "Allow",
        Action: ["kms:Decrypt"],
        Resource: ["arn:aws:kms:us-east-1:123456789012:key/*"],
        Condition: {
          StringEquals: { "kms:ViaService": "ssm.us-east-1.amazonaws.com" },
          StringLike: {
            "kms:EncryptionContext:PARAMETER_ARN":
              "arn:aws:ssm:us-east-1:123456789012:parameter/beep-ci/heavy/tokens/*",
          },
        },
      },
    ]);
    const kmsEverywhere = A.filter(runnerPolicy?.Statement ?? [], (statement) =>
      A.some(statement.Action, Str.startsWith("kms:"))
    );
    expect(kmsEverywhere).toStrictEqual(decrypts);
    const secrets = A.map(recorder.ofType("SSM.Parameter"), (parameter) => [parameter.news.name, parameter.news.type]);
    expect(secrets).toStrictEqual([
      ["/beep-ci/app/github_app_id", "SecureString"],
      ["/beep-ci/app/github_app_key_base64", "SecureString"],
      ["/beep-ci/app/github_app_webhook_secret", "SecureString"],
    ]);
    yield* destroy(stack);
  })
);

twoPools.test.provider("two pools get their own queues and Lambdas behind one webhook", (stack) =>
  Effect.gen(function* () {
    const { recorder, world } = twoPools;
    yield* destroy(stack);
    const out = yield* deploy(stack, fleet([heavy, overflow]));
    const counts = typeCounts(recorder);
    expect([counts["Lambda.Function"], counts["SQS.Queue"], counts["IAM.Role"], counts["KMS.Key"]]).toStrictEqual([
      9, 8, 2, 1,
    ]);
    const webhook = yield* decodeWebhook(
      (fn(recorder, "Runners/Webhook").news.env as Record<string, unknown>)[runtimeConfigEnvName]
    );
    expect(A.map(webhook.pools, (pool) => [pool.pool, pool.queueUrl])).toStrictEqual([
      ["heavy", "https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-BuildQueue"],
      ["overflow", "https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Pooloverflow-BuildQueue"],
    ]);
    const overflowConfig = yield* decodePool(
      (fn(recorder, "Runners/Pooloverflow/ScaleUp").news.env as Record<string, unknown>)[runtimeConfigEnvName]
    );
    expect([
      overflowConfig.environment,
      overflowConfig.pool.maximumCount,
      O.isNone(overflowConfig.jobRetryQueueUrl),
    ]).toStrictEqual(["beep-ci-overflow", 48, true]);
    expect(A.map(out.pools, (pool) => pool.environment)).toStrictEqual(["beep-ci-heavy", "beep-ci-overflow"]);
    expect(
      A.map(recorder.ofType("BeepAWS.EC2.RunnerLaunchTemplate"), (template) => [
        template.fqn,
        template.news.instanceInitiatedShutdownBehavior,
      ])
    ).toStrictEqual([
      ["Runners/Poolheavy/LaunchTemplate", "terminate"],
      ["Runners/Pooloverflow/LaunchTemplate", "terminate"],
    ]);
    const runnerTags = { "ghr:Application": "github-action-runner", "ghr:Owner": "beep-effect", "ghr:Type": "Org" };
    const heavyRunners = world.launch(1, { ...runnerTags, "ghr:environment": "beep-ci-heavy" });
    const overflowRunners = world.launch(1, { ...runnerTags, "ghr:environment": "beep-ci-overflow" });
    const sweepReadsLiveAtFirstTerminate = [
      "SSM.Parameter:Runners/AppId",
      "SSM.Parameter:Runners/AppKey",
      "KMS.Key:Runners/SecretsKey",
      "Lambda.Function:Runners/TerminationWatcher",
    ];
    const deletedBeforeSweep: Array<ReadonlyArray<string>> = [];
    world.onTerminate = () => {
      deletedBeforeSweep.push(A.copy(recorder.deleted));
    };
    yield* destroy(stack);
    expect(world.terminated).toStrictEqual([...heavyRunners, ...overflowRunners]);
    expect(A.map(deletedBeforeSweep, A.intersection(sweepReadsLiveAtFirstTerminate))).toStrictEqual([[], []]);
    expect(A.intersection(recorder.deleted, sweepReadsLiveAtFirstTerminate)).toHaveLength(
      sweepReadsLiveAtFirstTerminate.length
    );
  })
);

sweeping.test.provider("RunnerSweep changes nothing on create and update, and sweeps on destroy", (stack) =>
  Effect.gen(function* () {
    const { world } = sweeping;
    yield* destroy(stack);
    const tags = {
      "ghr:Application": "github-action-runner",
      "ghr:environment": "beep-ci-heavy",
      "ghr:Owner": "beep-effect",
      "ghr:Type": "Org",
    };
    const [instanceId = ""] = world.launch(1, tags);
    world.launch(1, { ...tags, "ghr:environment": "someone-else" });
    world.githubRunners.push(
      SelfHostedRunner.make({ id: 9, name: `beep-ci-${instanceId}`, status: "online", busy: false })
    );
    world.ssm["/beep-ci/heavy/tokens/i-stale"] = { value: "x", modified: 0, tags: {} };
    const sweep = (tokenPaths: ReadonlyArray<string>) =>
      declareRunnerSweep("Sweep", { environments: ["beep-ci-heavy"], tokenPaths, dependsOn: [] }).pipe(
        Effect.as({ declared: true })
      );
    yield* deploy(stack, sweep(["/beep-ci/heavy/tokens"]));
    yield* deploy(stack, sweep(["/beep-ci/heavy/tokens", "/beep-ci/other/tokens"]));
    expect(world.terminated).toStrictEqual([]);
    yield* destroy(stack);
    expect(world.terminated).toStrictEqual([instanceId]);
    expect(world.deletedRunners).toStrictEqual([9]);
    expect(R.keys(world.ssm)).toStrictEqual([]);
  })
);
