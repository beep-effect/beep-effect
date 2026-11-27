import {
  AwsApiError,
  appParameterNames,
  Ec2Fleet,
  HousekeeperRuntimeConfig,
  PoolMatcher,
  PoolRuntimeConfig,
  ReleaseAsset,
  RunnerPool,
  runtimeConfigEnvName,
  SelfHostedRunner,
  SyncerRuntimeConfig,
  TerminationWatcherRuntimeConfig,
  WebhookRuntimeConfig,
} from "@beep/alchemy-github-runners";
import * as JobRetryLambda from "@beep/alchemy-github-runners/internal/lambda/job-retry";
import { defineLambda, lambdaHandler } from "@beep/alchemy-github-runners/internal/lambda/Runtime";
import * as SyncerLambda from "@beep/alchemy-github-runners/internal/lambda/runner-binaries-syncer";
import * as ScaleDownLambda from "@beep/alchemy-github-runners/internal/lambda/scale-down";
import * as ScaleUpLambda from "@beep/alchemy-github-runners/internal/lambda/scale-up";
import * as HousekeeperLambda from "@beep/alchemy-github-runners/internal/lambda/ssm-housekeeper";
import * as WatcherLambda from "@beep/alchemy-github-runners/internal/lambda/termination-watcher";
import * as WebhookLambda from "@beep/alchemy-github-runners/internal/lambda/webhook";
import { hmacSha256Hex } from "@beep/alchemy-github-runners/WebCrypto";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { World, worldContext } from "./support/FakeWorld.ts";
import {
  heavyPool,
  liveEnvironments,
  liveHeavyPool,
  liveOverflowPool,
  liveSsmRoot,
  message,
  oldFleetPrefixes,
  oldFleetRunnerName,
  oldFleetTags,
  poolConfig,
} from "./support/Fixtures.ts";

const encodeMessage = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodePool = S.encodeEffect(S.fromJsonString(PoolRuntimeConfig));

const sqsEvent = Effect.fn("sqsEvent")(function* (bodies: ReadonlyArray<unknown>) {
  const records = yield* Effect.forEach(
    bodies,
    (body, index) =>
      (typeof body === "string" ? Effect.succeed(body) : encodeMessage(body)).pipe(
        Effect.map((encoded) => ({ messageId: `m-${index}`, body: encoded, eventSource: "aws:sqs" }))
      ),
    { concurrency: 1 }
  );
  return { Records: records };
});

const watcherConfig = TerminationWatcherRuntimeConfig.make({
  environments: ["beep-ci-heavy"],
  app: appParameterNames("/beep-ci"),
  deregisterRetryQueueUrl: "https://sqs/deregister-retry",
});

const liveWatcherConfig = TerminationWatcherRuntimeConfig.make({
  environments: liveEnvironments,
  app: appParameterNames(liveSsmRoot),
  deregisterRetryQueueUrl: "https://sqs/beep-fleet-prod-deregister-retry",
});

const noFailures = { batchItemFailures: [] };

const watchIdleThenBusyRunnerPerPool = Effect.fn("watchIdleThenBusyRunnerPerPool")(function* (
  pools: ReadonlyArray<{
    readonly tags: Readonly<Record<string, string>>;
    readonly runnerName: (instanceId: string) => string;
  }>
) {
  const world = new World();
  const instances = A.flatMap(pools, (pool, poolIndex) =>
    A.map([false, true], (busy, index) => {
      const id = 10 + 2 * poolIndex + index;
      const [instanceId = ""] = world.launch(1, pool.tags);
      world.githubRunners.push(
        SelfHostedRunner.make({ id, name: pool.runnerName(instanceId), status: "online", busy })
      );
      world.busyOnDelete = busy ? A.append(world.busyOnDelete, id) : world.busyOnDelete;
      return instanceId;
    })
  );
  const context = worldContext(world);
  const warned = yield* Effect.forEach(
    instances,
    (instanceId) =>
      WatcherLambda.definition
        .run(liveWatcherConfig, {
          "detail-type": "EC2 Spot Instance Interruption Warning",
          detail: { "instance-id": instanceId, "instance-action": "terminate" },
        })
        .pipe(Effect.provideContext(context)),
    { concurrency: 1 }
  );
  const retry = yield* sqsEvent(
    A.map(instances, (instanceId) => ({
      instanceId,
      owner: "beep-effect",
      runnerType: "Org",
      runnerId: 0,
      retryCount: 0,
    }))
  );
  const retried = yield* WatcherLambda.definition.run(liveWatcherConfig, retry).pipe(Effect.provideContext(context));
  return { world, warned, retried };
});

describe("Lambda entry points", () => {
  it.effect("fall back without a runtime config instead of throwing", () =>
    Effect.gen(function* () {
      const answers = yield* Effect.promise(() =>
        Promise.all([
          ScaleUpLambda.handler({ Records: [{ messageId: "m-1", body: "{}" }] }),
          WebhookLambda.handler({}),
          ScaleDownLambda.handler({}),
        ])
      );
      expect(answers).toStrictEqual([
        { batchItemFailures: [{ itemIdentifier: "m-1" }] },
        { statusCode: 500, body: "Check the Lambda logs for the error details." },
        undefined,
      ]);
    })
  );

  it.effect("scale-up decodes SQS records, skips foreign and malformed ones and launches", () =>
    Effect.gen(function* () {
      const world = new World();
      const event = yield* sqsEvent([message({ id: 1 }), "not json"]);
      const out = yield* ScaleUpLambda.definition
        .run(poolConfig(), { Records: [...event.Records, { messageId: "x", body: "{}", eventSource: "aws:sns" }] })
        .pipe(Effect.provideContext(worldContext(world)));
      expect([out, world.instances.length]).toStrictEqual([{ batchItemFailures: [] }, 1]);
      expect(ScaleUpLambda.definition.layer(poolConfig())).toBeDefined();
    })
  );

  it.effect("scale-up logs the id of a message it cannot decode, never its body", () =>
    Effect.gen(function* () {
      const world = new World();
      const lines: Array<{ readonly level: string; readonly message: unknown; readonly annotations: unknown }> = [];
      const capture = Logger.map(Logger.formatStructured, (line) => {
        lines.push(line);
      });
      const loggers = yield* Layer.build(Logger.layer([capture]));
      const event = yield* sqsEvent([message({ id: 1 }), "a body that must stay out of the log"]);
      yield* ScaleUpLambda.definition
        .run(poolConfig(), event)
        .pipe(Effect.provideContext(worldContext(world)), Effect.provideContext(loggers));
      expect(A.map(lines, ({ level, message, annotations }) => ({ level, message, annotations }))).toStrictEqual([
        {
          level: "WARN",
          message: "scale-up: a message that does not decode is dropped",
          annotations: { messageId: "m-1" },
        },
      ]);
      const logged = yield* encodeMessage(lines);
      expect(logged).not.toContain("must stay out of the log");
    })
  );

  it.effect("scale-up reports a launch refused for an unreadable or unsettled count as a batch item failure", () =>
    Effect.gen(function* () {
      const event = yield* sqsEvent([message({ id: 1 })]);
      const unreadable = new World();
      const base = worldContext(unreadable);
      const fleet = Context.get(base, Ec2Fleet);
      const failing = Ec2Fleet.of({
        ...fleet,
        listRunners: Effect.fn("FailingEc2.listRunners")(function* () {
          return yield* AwsApiError.make({
            service: "ec2",
            operation: "describeInstances",
            code: O.some("RequestLimitExceeded"),
            retryable: true,
            message: "throttled",
          });
        }),
      });
      const refused = yield* ScaleUpLambda.definition
        .run(poolConfig(), event)
        .pipe(Effect.provideContext(Context.add(base, Ec2Fleet, failing)));
      expect(
        [refused, unreadable.fleetRequests.length],
        "an unreadable runner count launches nothing and the record goes back to SQS, never acknowledged"
      ).toStrictEqual([{ batchItemFailures: [{ itemIdentifier: "m-0" }] }, 0]);
      const unsettled = new World();
      unsettled.ssm["/beep-ci/heavy/tokens/i-unseen"] = { value: "jit", modified: 0, tags: { InstanceId: "i-unseen" } };
      const capped = yield* ScaleUpLambda.definition
        .run(poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 1 })), event)
        .pipe(Effect.provideContext(worldContext(unsettled)));
      expect(
        [capped, unsettled.fleetRequests.length],
        "a launch EC2 does not show yet holds its slot through its JIT config, so the record goes back"
      ).toStrictEqual([{ batchItemFailures: [{ itemIdentifier: "m-0" }] }, 0]);
    })
  );

  it.effect("job-retry re-queues still-queued jobs and reports failed records for redelivery", () =>
    Effect.gen(function* () {
      const world = new World();
      const event = yield* sqsEvent([message({ id: 3, retryCounter: 0 }), "{"]);
      const out = yield* JobRetryLambda.definition
        .run(poolConfig(), event)
        .pipe(Effect.provideContext(worldContext(world)));
      expect(out).toStrictEqual({ batchItemFailures: [{ itemIdentifier: "m-1" }] });
      expect(JobRetryLambda.definition.fallback(event)).toStrictEqual({
        batchItemFailures: [{ itemIdentifier: "m-0" }, { itemIdentifier: "m-1" }],
      });
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([
        "https://sqs.us-east-1.amazonaws.com/1/heavy-build",
      ]);
    })
  );

  it.effect("scheduled entries run their programs", () =>
    Effect.gen(function* () {
      const world = new World();
      world.latestAsset = ReleaseAsset.makeOption({
        name: "actions-runner-linux-x64-2.330.0.tar.gz",
        downloadUrl: "u",
      });
      const context = worldContext(world);
      yield* ScaleDownLambda.definition.run(poolConfig(), {}).pipe(Effect.provideContext(context));
      yield* HousekeeperLambda.definition
        .run(
          HousekeeperRuntimeConfig.make({ tokenPaths: ["/beep-ci/heavy/tokens"], minimumDaysOld: 1, dryRun: false }),
          {}
        )
        .pipe(Effect.provideContext(context));
      yield* SyncerLambda.definition
        .run(SyncerRuntimeConfig.make({ bucketName: "b", objectKey: "k", os: "linux", architecture: "x64" }), {})
        .pipe(Effect.provideContext(context));
      expect(world.mirrored).toStrictEqual(["actions-runner-linux-x64-2.330.0.tar.gz"]);
      expect([HousekeeperLambda.definition.layer, SyncerLambda.definition.layer]).toHaveLength(2);
    })
  );

  it.effect("termination watcher handles EventBridge events and deregister-retry batches", () =>
    Effect.gen(function* () {
      const world = new World();
      const [instanceId = ""] = world.launch(1, {
        "ghr:environment": "beep-ci-heavy",
        "ghr:Owner": "beep-effect",
        "ghr:Type": "Org",
      });
      world.githubRunners.push(
        SelfHostedRunner.make({ id: 5, name: `beep-ci-${instanceId}`, status: "online", busy: false })
      );
      const context = worldContext(world);
      yield* WatcherLambda.definition
        .run(watcherConfig, {
          "detail-type": "EC2 Spot Instance Interruption Warning",
          detail: { "instance-id": instanceId, "instance-action": "terminate" },
        })
        .pipe(Effect.provideContext(context));
      world.githubRunners.push(
        SelfHostedRunner.make({ id: 6, name: `beep-ci-${instanceId}`, status: "online", busy: false })
      );
      const retry = yield* sqsEvent([
        { instanceId, owner: "beep-effect", runnerType: "Org", runnerId: 0, retryCount: 0 },
      ]);
      yield* WatcherLambda.definition.run(watcherConfig, retry).pipe(Effect.provideContext(context));
      expect(world.deletedRunners).toStrictEqual([5, 6]);
    })
  );

  it.effect("termination watcher ignores the old fleet's idle and busy runners in events and retry batches", () =>
    Effect.gen(function* () {
      const run = yield* watchIdleThenBusyRunnerPerPool(
        A.map(oldFleetPrefixes, (prefix) => ({
          tags: oldFleetTags(prefix),
          runnerName: oldFleetRunnerName(prefix),
        }))
      );
      expect([run.warned, run.retried]).toStrictEqual([A.makeBy(4, () => noFailures), noFailures]);
      expect([
        run.world.deletedRunners,
        run.world.sent,
        A.map(run.world.githubRunners, (runner) => runner.id),
      ]).toStrictEqual([[], [], [10, 11, 12, 13]]);
    })
  );

  it.effect("termination watcher acts on the new fleet's runners under the same live config (control)", () =>
    Effect.gen(function* () {
      const run = yield* watchIdleThenBusyRunnerPerPool(
        A.map([liveHeavyPool, liveOverflowPool], (pool) => ({
          tags: {
            "ghr:environment": `beep-fleet-prod-${pool.name}`,
            "ghr:Application": "github-action-runner",
            "ghr:Owner": "beep-effect",
            "ghr:Type": "Org",
          },
          runnerName: (instanceId: string) => `${pool.runnerNamePrefix}${instanceId}`,
        }))
      );
      expect([run.warned, run.retried]).toStrictEqual([A.makeBy(4, () => noFailures), noFailures]);
      expect(
        [run.world.deletedRunners, A.map(run.world.sent, (sent) => sent.queueUrl)],
        "idle runners go on the warning; each busy one is queued on the warning and re-queued from the batch"
      ).toStrictEqual([[10, 12], A.makeBy(4, () => liveWatcherConfig.deregisterRetryQueueUrl)]);
    })
  );

  it.effect("termination watcher reports a deregister retry past the busy cap as a batch item failure", () =>
    Effect.gen(function* () {
      const world = new World();
      const [instanceId = ""] = world.launch(1, {
        "ghr:environment": "beep-ci-heavy",
        "ghr:Owner": "beep-effect",
        "ghr:Type": "Org",
      });
      world.githubRunners.push(
        SelfHostedRunner.make({ id: 7, name: `beep-ci-${instanceId}`, status: "online", busy: true })
      );
      world.busyOnDelete = [7];
      const retry = yield* sqsEvent([
        { instanceId, owner: "beep-effect", runnerType: "Org", runnerId: 0, retryCount: 1 },
        { instanceId, owner: "beep-effect", runnerType: "Org", runnerId: 0, retryCount: 4 },
      ]);
      const out = yield* WatcherLambda.definition
        .run(watcherConfig, retry)
        .pipe(Effect.provideContext(worldContext(world)));
      expect(out).toStrictEqual({ batchItemFailures: [{ itemIdentifier: "m-1" }] });
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual(["https://sqs/deregister-retry"]);
    })
  );

  it.effect("webhook verifies a base64 function-URL body with mixed-case headers", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm["/beep-ci/app/github_app_webhook_secret"] = { value: "s3cret", modified: 0, tags: {} };
      const config = WebhookRuntimeConfig.make({
        webhookSecretParameterName: "/beep-ci/app/github_app_webhook_secret",
        repositoryAllowList: [],
        pools: [
          PoolMatcher.make({
            pool: "heavy",
            queueUrl: "https://sqs/heavy",
            labels: ["x"],
            labelMatch: "bidirectional",
          }),
        ],
      });
      const body = '{"zen":"ok"}';
      const signature = yield* hmacSha256Hex("s3cret", body);
      const out = yield* WebhookLambda.definition
        .run(config, {
          headers: { "X-GitHub-Event": "ping", "X-Hub-Signature-256": `sha256=${signature}` },
          body: Base64.encode(body),
          isBase64Encoded: true,
        })
        .pipe(Effect.provideContext(worldContext(world)));
      expect(out).toStrictEqual({ statusCode: 202, body: "Unsupported event type: ping" });
    })
  );

  it.effect("lambdaHandler decodes the config once and falls back when the program fails", () =>
    Effect.gen(function* () {
      const encoded = yield* encodePool(poolConfig());
      const handler = lambdaHandler(
        defineLambda({
          config: PoolRuntimeConfig,
          layer: () => Layer.empty,
          run: (config, event) =>
            event === "boom" ? Effect.fail("boom" as const) : Effect.succeed(config.environment),
          fallback: () => "fallback",
          configProvider: ConfigProvider.fromEnvRecord({ [runtimeConfigEnvName]: encoded }),
        })
      );
      const ok = yield* Effect.promise(() => handler("ok"));
      const boom = yield* Effect.promise(() => handler("boom"));
      const answers = [ok, boom];
      expect(answers).toStrictEqual(["beep-ci-heavy", "fallback"]);
    })
  );
});
