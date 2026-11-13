import * as Test from "@alchemy.run/test/Vitest";
import {
  declareRunnerSweep,
  JobRetryPolicy,
  PoolRuntimeConfig,
  RunnerFleet,
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
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeProviders, Recorder } from "./support/FakeProviders.ts";
import { World } from "./support/FakeWorld.ts";
import type * as Core from "@alchemy.run/test/Core";
import type { RunnerLaunchSpec } from "@beep/alchemy-github-runners";
import type { Input } from "alchemy/Input";
import type { StackServices } from "alchemy/Stack";

/** One harness per test: its own recorder, world, in-memory state and stage. */
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
  jobRetry: O.some(JobRetryPolicy.make({ maxAttempts: 2, delaySeconds: 120, delayBackoff: 2 })),
});
const overflow = RunnerPool.make({
  name: "overflow",
  instanceTypes: ["r7a.2xlarge"],
  maximumCount: 48,
  labels: ["beep-shard-overflow"],
  runnerGroup: "beep-shard-overflow",
  runnerNamePrefix: "beep-ovf-",
});

const fleet = (pools: A.NonEmptyReadonlyArray<RunnerPool>, launchSpecs: Array<RunnerLaunchSpec> = []) =>
  RunnerFleet({
    id: "Runners",
    name: "beep-ci",
    ssmRoot: "/beep-ci",
    runnerType: "Org",
    repositoryAllowList: ["beep-effect/beep-effect"],
    subnetIds: ["subnet-a", "subnet-b"],
    app: { id: Redacted.make("123"), keyBase64: Redacted.make("a2V5"), webhookSecret: Redacted.make("secret") },
    pools,
    runnerManagedPolicyArns: ["arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable"],
    launchTemplate: (spec) =>
      Effect.sync(() => {
        launchSpecs.push(spec);
        return { launchTemplateId: `lt-${spec.pool.name}`, version: "$Default" };
      }),
  });

type ScratchStack = Test.ScratchStack;

/** The failures Alchemy declares for a stack deployment; the scratch stack erases them to `any`. */
type DeployError = Effect.Error<Core.DeployResult<unknown>>;

type ScratchDeploy = <A, E, R>(
  definition: Effect.Effect<A, E, R>
) => Effect.Effect<Input.Resolve<A>, DeployError | E, Exclude<R, StackServices>>;

const deploy = <A, E, R>(stack: ScratchStack, definition: Effect.Effect<A, E, R>) => {
  const run: ScratchDeploy = stack.deploy;
  return run(definition);
};

const destroy = (stack: ScratchStack) => {
  const run: () => Effect.Effect<void, DeployError> = stack.destroy;
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
    const launchSpecs: Array<RunnerLaunchSpec> = [];
    yield* destroy(stack);
    const out = yield* deploy(stack, fleet([heavy], launchSpecs));

    expect(typeCounts(recorder)).toStrictEqual({
      "KMS.Key": 1,
      "KMS.Alias": 1,
      "SSM.Parameter": 3,
      "S3.Bucket": 1,
      "IAM.Role": 1,
      "IAM.InstanceProfile": 1,
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
      config.tokenPath,
      config.subnetIds,
    ]).toStrictEqual(["beep-ci-heavy", "lt-heavy", "/beep-ci/heavy/tokens", ["subnet-a", "subnet-b"]]);
    expect(config.buildQueueUrl).toBe("https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-BuildQueue");
    expect(O.getOrUndefined(config.jobRetryQueueUrl)).toBe(
      "https://sqs.us-east-1.amazonaws.com/123456789012/Runners-Poolheavy-JobRetryQueue"
    );

    const source = O.getOrThrow(recorder.byFqn("Runners/Poolheavy/ScaleUpSource"));
    expect([source.news.functionName, source.news.functionResponseTypes]).toStrictEqual([
      "Runners-Poolheavy-ScaleUp",
      ["ReportBatchItemFailures"],
    ]);

    const sources = A.map(recorder.ofType("Lambda.EventSourceMapping"), (entry) => entry.news.functionResponseTypes);
    expect(sources).toStrictEqual([
      ["ReportBatchItemFailures"],
      ["ReportBatchItemFailures"],
      ["ReportBatchItemFailures"],
    ]);

    expect(fn(recorder, "Runners/Webhook").news.functionUrl).toBe(true);
    expect(out.webhookUrl).toBe("https://runners-webhook.lambda-url.on.aws/");
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

    const spec = launchSpecs[launchSpecs.length - 1];
    expect(spec?.environment).toBe("beep-ci-heavy");
    const role = O.getOrThrow(recorder.byFqn("Runners/Poolheavy/RunnerRole"));
    expect(role.news.managedPolicyArns).toStrictEqual(["arn:aws:iam::123456789012:policy/beep-ci-runner-imds-disable"]);
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
    const runnerTags = { "ghr:Application": "github-action-runner", "ghr:Owner": "beep-effect", "ghr:Type": "Org" };
    const heavyRunners = world.launch(1, { ...runnerTags, "ghr:environment": "beep-ci-heavy" });
    const overflowRunners = world.launch(1, { ...runnerTags, "ghr:environment": "beep-ci-overflow" });
    yield* destroy(stack);
    expect(world.terminated).toStrictEqual([...heavyRunners, ...overflowRunners]);
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
      declareRunnerSweep({ id: "Sweep", props: { environments: ["beep-ci-heavy"], tokenPaths, dependsOn: [] } }).pipe(
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
