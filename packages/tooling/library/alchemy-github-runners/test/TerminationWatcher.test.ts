import {
  appParameterNames,
  DeregisterRetryMessage,
  handleDeregisterRetry,
  handleTerminationEvent,
  InstanceStateChange,
  poolTokenPath,
  RunnerSweepIncomplete,
  SelfHostedRunner,
  SpotInterruptionWarning,
  sweepRunners,
  TerminationWatcherRuntimeConfig,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { World, worldContext } from "./support/FakeWorld.ts";
import {
  liveEnvironments,
  liveHeavyPool,
  liveOverflowPool,
  liveSsmRoot,
  oldFleetPrefixes,
  oldFleetRunnerName,
  oldFleetTags,
} from "./support/Fixtures.ts";

const config = TerminationWatcherRuntimeConfig.make({
  environments: ["beep-ci-heavy"],
  app: appParameterNames("/beep-ci"),
  deregisterRetryQueueUrl: "https://sqs/deregister-retry",
});

const tags = { "ghr:environment": "beep-ci-heavy", "ghr:Owner": "beep-effect", "ghr:Type": "Org" };

const warning = (instanceId: string) =>
  SpotInterruptionWarning.make({
    "detail-type": "EC2 Spot Instance Interruption Warning",
    detail: { "instance-id": instanceId, "instance-action": "terminate" },
  });

const decodeRetry = S.decodeUnknownEffect(S.fromJsonString(DeregisterRetryMessage));

const seed = (world: World, extraTags: Record<string, string> = tags) => {
  const [instanceId = ""] = world.launch(1, extraTags);
  world.githubRunners.push(
    SelfHostedRunner.make({ id: 42, name: `beep-ci-${instanceId}`, status: "online", busy: true })
  );
  return instanceId;
};

describe("handleTerminationEvent", () => {
  it.effect("deregisters the runner of an interrupted Spot instance", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = seed(world);
      const outcomes = yield* handleTerminationEvent({ config, event: warning(instanceId) }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(outcomes).toStrictEqual(["deregistered"]);
      expect(world.deletedRunners).toStrictEqual([42]);
    })
  );

  it.effect("deregisters on a state change to shutting-down", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = seed(world);
      const event = InstanceStateChange.make({
        "detail-type": "EC2 Instance State-change Notification",
        detail: { "instance-id": instanceId, state: "shutting-down" },
      });
      const outcomes = yield* handleTerminationEvent({ config, event }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(outcomes).toStrictEqual(["deregistered"]);
    })
  );

  it.effect("queues a delayed retry when GitHub reports the runner busy", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = seed(world);
      world.busyOnDelete = [42];
      const outcomes = yield* handleTerminationEvent({ config, event: warning(instanceId) }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(outcomes).toStrictEqual(["retry-queued"]);
      deepStrictEqual(
        A.map(world.sent, (sent) => [sent.queueUrl, sent.delaySeconds] as const),
        [["https://sqs/deregister-retry", O.some(300)] as const]
      );
      const message = yield* decodeRetry(world.sent[0]?.body);
      expect([message.instanceId, message.owner, message.retryCount]).toStrictEqual([instanceId, "beep-effect", 0]);
    })
  );

  it.effect("ignores instances of another fleet, without an owner, or unknown to EC2", () =>
    Effect.gen(function* () {
      const world = new World();
      const foreign = seed(world, { ...tags, "ghr:environment": "someone-else" });
      const extended = seed(world, { ...tags, "ghr:environment": "beep-ci-heavy2" });
      const ownerless = seed(world, { "ghr:environment": "beep-ci-heavy" });
      const run = (instanceId: string) =>
        handleTerminationEvent({ config, event: warning(instanceId) }).pipe(Effect.provideContext(worldContext(world)));
      const outcomes = yield* Effect.forEach([foreign, extended, ownerless, "i-unknown"], run, { concurrency: 1 });
      expect(
        outcomes,
        "exact match only: an environment extending the pool environment is another fleet's"
      ).toStrictEqual([["ignored"], ["ignored"], ["ignored"], []]);
      expect(world.deletedRunners).toStrictEqual([]);
    })
  );

  it.effect("reports not-found when GitHub has no runner for the instance", () =>
    Effect.gen(function* () {
      const world = new World();
      const [instanceId = ""] = world.launch(1, tags);
      const outcomes = yield* handleTerminationEvent({ config, event: warning(instanceId) }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(outcomes).toStrictEqual(["not-found"]);
    })
  );
});

describe("handleDeregisterRetry", () => {
  it.effect("ignores a retry for an instance outside the fleet's pools, or no longer known to EC2", () =>
    Effect.gen(function* () {
      const world = new World();
      const foreign = seed(world, { ...tags, "ghr:environment": "beep-ci-heavy-other" });
      const retry = (instanceId: string) =>
        handleDeregisterRetry({
          config,
          message: DeregisterRetryMessage.make({
            instanceId,
            owner: "beep-effect",
            runnerType: "Org",
            runnerId: 0,
            retryCount: 0,
          }),
        }).pipe(Effect.provideContext(worldContext(world)));
      const outcomes = yield* Effect.forEach([foreign, "i-unknown"], retry, { concurrency: 1 });
      expect(outcomes).toStrictEqual(["ignored", "ignored"]);
      expect(world.deletedRunners).toStrictEqual([]);
    })
  );

  it.effect("fails the record once the busy-retry cap is reached so SQS can dead-letter it", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = seed(world);
      world.busyOnDelete = [42];
      const message = DeregisterRetryMessage.make({
        instanceId,
        owner: "beep-effect",
        runnerType: "Org",
        runnerId: 0,
        retryCount: 4,
      });
      const error = yield* Effect.flip(
        handleDeregisterRetry({ config, message }).pipe(Effect.provideContext(worldContext(world)))
      );
      expect([error._tag, world.sent]).toStrictEqual(["GitHubApiError", []]);
    })
  );

  it.effect("re-queues a still-busy runner with the count incremented, and deregisters once free", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = seed(world);
      world.busyOnDelete = [42];
      const message = DeregisterRetryMessage.make({
        instanceId,
        owner: "beep-effect",
        runnerType: "Org",
        runnerId: 0,
        retryCount: 1,
      });
      const busy = yield* handleDeregisterRetry({ config, message }).pipe(Effect.provideContext(worldContext(world)));
      const requeued = yield* decodeRetry(world.sent[0]?.body);
      expect([busy, requeued.retryCount]).toStrictEqual(["retry-queued", 2]);
      world.busyOnDelete = [];
      const done = yield* handleDeregisterRetry({ config, message }).pipe(Effect.provideContext(worldContext(world)));
      expect(done).toBe("deregistered");
    })
  );
});

describe("sweepRunners", () => {
  const sweepInput = { environments: ["beep-ci-heavy"], tokenPaths: ["/beep-ci/heavy/tokens"] };
  const idle = (world: World) => {
    const [instanceId = ""] = world.launch(1, { ...tags, "ghr:Application": "github-action-runner" });
    world.githubRunners.push(
      SelfHostedRunner.make({ id: 42, name: `beep-ci-${instanceId}`, status: "online", busy: false })
    );
    world.ssm["/beep-ci/heavy/tokens/i-stale"] = { value: "x", modified: 0, tags: {} };
    return instanceId;
  };

  it.effect("retries a runner that is still busy and deregisters it once it goes idle", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = idle(world);
      world.busyDeletesLeft[42] = 2;
      const fiber = yield* sweepRunners(sweepInput).pipe(Effect.provideContext(worldContext(world)), Effect.forkChild);
      yield* TestClock.adjust("1 minute");
      const report = yield* Fiber.join(fiber);
      expect([report.terminated, report.deregistered, report.tokensDeleted]).toStrictEqual([[instanceId], 1, 1]);
      expect(world.deletedRunners).toStrictEqual([42]);
    })
  );

  it.effect("fails loudly when a runner stays busy, after terminating and deleting tokens", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = idle(world);
      world.busyOnDelete.push(42);
      const fiber = yield* sweepRunners(sweepInput).pipe(
        Effect.provideContext(worldContext(world)),
        Effect.flip,
        Effect.forkChild
      );
      yield* TestClock.adjust("5 minutes");
      const error = yield* Fiber.join(fiber);
      assertInstanceOf(error, RunnerSweepIncomplete);
      expect([error.instanceIds, world.terminated, R.keys(world.ssm)]).toStrictEqual([[instanceId], [instanceId], []]);
    })
  );

  it.effect("fails without retrying when GitHub refuses the deregistration", () =>
    Effect.gen(function* () {
      const world = new World();
      const instanceId = idle(world);
      world.failOnDelete.push(42);
      const error = yield* sweepRunners(sweepInput).pipe(Effect.provideContext(worldContext(world)), Effect.flip);
      assertInstanceOf(error, RunnerSweepIncomplete);
      expect([error.instanceIds, world.deletedRunners]).toStrictEqual([[instanceId], []]);
    })
  );
});

describe("cross-fleet isolation in one shared account and org, where a stray deregistration has no CloudTrail or IAM backstop", () => {
  const liveConfig = TerminationWatcherRuntimeConfig.make({
    environments: liveEnvironments,
    app: appParameterNames(liveSsmRoot),
    deregisterRetryQueueUrl: "https://sqs/beep-fleet-prod-deregister-retry",
  });

  const newFleetTags = (environment: string) => ({
    "ghr:environment": environment,
    "ghr:Application": "github-action-runner",
    "ghr:Type": "Org",
    "ghr:Owner": "beep-effect",
  });

  const oldFleetPools = A.map(oldFleetPrefixes, (prefix) => ({
    tags: oldFleetTags(prefix),
    runnerName: oldFleetRunnerName(prefix),
  }));

  const newFleetPools = A.map([liveHeavyPool, liveOverflowPool], (pool) => ({
    tags: newFleetTags(`beep-fleet-prod-${pool.name}`),
    runnerName: (instanceId: string) => `${pool.runnerNamePrefix}${instanceId}`,
  }));

  const seedIdleThenBusyRunnerPerPool = (
    world: World,
    pools: ReadonlyArray<{
      readonly tags: Readonly<Record<string, string>>;
      readonly runnerName: (instanceId: string) => string;
    }>,
    firstRunnerId: number
  ) =>
    A.flatMap(pools, (pool, poolIndex) =>
      A.map([false, true], (busy, index) => {
        const id = firstRunnerId + 2 * poolIndex + index;
        const [instanceId = ""] = world.launch(1, pool.tags);
        world.githubRunners.push(
          SelfHostedRunner.make({ id, name: pool.runnerName(instanceId), status: "online", busy })
        );
        world.busyOnDelete = busy ? A.append(world.busyOnDelete, id) : world.busyOnDelete;
        return instanceId;
      })
    );

  const stateChange = (instanceId: string, state: string) =>
    InstanceStateChange.make({
      "detail-type": "EC2 Instance State-change Notification",
      detail: { "instance-id": instanceId, state },
    });

  const driveWarningShutdownThenTerminated = (world: World) => (instanceId: string) =>
    Effect.forEach(
      [warning(instanceId), stateChange(instanceId, "shutting-down"), stateChange(instanceId, "terminated")],
      (event) => handleTerminationEvent({ config: liveConfig, event }).pipe(Effect.provideContext(worldContext(world))),
      { concurrency: 1 }
    );

  const retryOnce = (world: World) => (instanceId: string) =>
    handleDeregisterRetry({
      config: liveConfig,
      message: DeregisterRetryMessage.make({
        instanceId,
        owner: "beep-effect",
        runnerType: "Org",
        runnerId: 0,
        retryCount: 0,
      }),
    }).pipe(Effect.provideContext(worldContext(world)));

  const runnerIds = (world: World) => A.map(world.githubRunners, (runner) => runner.id);

  const queuedRetryUrlInstanceAndCount = (world: World) =>
    Effect.forEach(
      world.sent,
      (sent) => decodeRetry(sent.body).pipe(Effect.map((retry) => [sent.queueUrl, retry.instanceId, retry.retryCount])),
      { concurrency: 1 }
    );

  const ignoredThrice = [["ignored"], ["ignored"], ["ignored"]];

  it.effect("ignores every termination event for the old fleet's idle and busy runners in both pools", () =>
    Effect.gen(function* () {
      const world = new World();
      const instances = seedIdleThenBusyRunnerPerPool(world, oldFleetPools, 101);
      const outcomes = yield* Effect.forEach(instances, driveWarningShutdownThenTerminated(world), { concurrency: 1 });
      expect(outcomes).toStrictEqual(A.makeBy(4, () => ignoredThrice));
      expect([world.deletedRunners, world.sent, runnerIds(world)]).toStrictEqual([[], [], [101, 102, 103, 104]]);
    })
  );

  it.effect("deregisters an idle runner and queues a retry for a busy one in either new-fleet pool (control)", () =>
    Effect.gen(function* () {
      const world = new World();
      const instances = seedIdleThenBusyRunnerPerPool(world, newFleetPools, 201);
      const [, heavyBusy = "", , overflowBusy = ""] = instances;
      const outcomes = yield* Effect.forEach(instances, driveWarningShutdownThenTerminated(world), { concurrency: 1 });
      const idle = [["deregistered"], ["not-found"], ["not-found"]];
      const busy = A.makeBy(3, () => ["retry-queued"]);
      expect(outcomes).toStrictEqual([idle, busy, idle, busy]);
      expect([world.deletedRunners, runnerIds(world)]).toStrictEqual([
        [201, 203],
        [202, 204],
      ]);
      const queued = yield* queuedRetryUrlInstanceAndCount(world);
      expect(queued).toStrictEqual(
        A.flatMap([heavyBusy, overflowBusy], (instanceId) =>
          A.makeBy(3, () => [liveConfig.deregisterRetryQueueUrl, instanceId, 0])
        )
      );
    })
  );

  it.effect("ignores an idle or busy registered instance without a ghr:environment tag, or with no tags", () =>
    Effect.gen(function* () {
      const world = new World();
      const environmentless = {
        tags: { "ghr:Application": "github-action-runner", "ghr:Owner": "beep-effect", "ghr:Type": "Org" },
        runnerName: (instanceId: string) => `beep-ci-${instanceId}`,
      };
      const untagged = { tags: {}, runnerName: (instanceId: string) => `beep-ci-${instanceId}` };
      const instances = seedIdleThenBusyRunnerPerPool(world, [environmentless, untagged], 301);
      const outcomes = yield* Effect.forEach(instances, driveWarningShutdownThenTerminated(world), { concurrency: 1 });
      expect(outcomes).toStrictEqual(A.makeBy(4, () => ignoredThrice));
      expect([world.deletedRunners, world.sent, runnerIds(world)]).toStrictEqual([[], [], [301, 302, 303, 304]]);
    })
  );

  it.effect("ignores a deregister retry naming an old-fleet instance, idle or busy, and never re-queues it", () =>
    Effect.gen(function* () {
      const world = new World();
      const instances = seedIdleThenBusyRunnerPerPool(world, oldFleetPools, 401);
      const outcomes = yield* Effect.forEach(instances, retryOnce(world), { concurrency: 1 });
      expect(outcomes).toStrictEqual(["ignored", "ignored", "ignored", "ignored"]);
      expect([world.deletedRunners, world.sent, runnerIds(world)]).toStrictEqual([[], [], [401, 402, 403, 404]]);
    })
  );

  it.effect("deregisters on a deregister retry and re-queues a still-busy one in either new-fleet pool (control)", () =>
    Effect.gen(function* () {
      const world = new World();
      const instances = seedIdleThenBusyRunnerPerPool(world, newFleetPools, 501);
      const [, heavyBusy = "", , overflowBusy = ""] = instances;
      const outcomes = yield* Effect.forEach(instances, retryOnce(world), { concurrency: 1 });
      expect(outcomes).toStrictEqual(["deregistered", "retry-queued", "deregistered", "retry-queued"]);
      expect([world.deletedRunners, runnerIds(world)]).toStrictEqual([
        [501, 503],
        [502, 504],
      ]);
      const queued = yield* queuedRetryUrlInstanceAndCount(world);
      expect(queued).toStrictEqual([
        [liveConfig.deregisterRetryQueueUrl, heavyBusy, 1],
        [liveConfig.deregisterRetryQueueUrl, overflowBusy, 1],
      ]);
    })
  );

  it.effect("sweeps only the new fleet's instances, runners and tokens, never the old fleet's", () =>
    Effect.gen(function* () {
      const world = new World();
      const oldInstances = A.map(oldFleetPrefixes, (prefix, index) => {
        const [instanceId = ""] = world.launch(1, oldFleetTags(prefix));
        world.githubRunners.push(
          SelfHostedRunner.make({
            id: 601 + index,
            name: oldFleetRunnerName(prefix)(instanceId),
            status: "online",
            busy: false,
          })
        );
        world.ssm[`/github-action-runners/${prefix}/runners/tokens/${instanceId}`] = {
          value: "jit",
          modified: 0,
          tags: { InstanceId: instanceId },
        };
        world.ssm[`/github-action-runners/${prefix}/runners/config/runner_group_id`] = {
          value: "7",
          modified: 0,
          tags: {},
        };
        return instanceId;
      });
      world.ssm["/github-action-runners/app/github_app_id"] = { value: "1", modified: 0, tags: {} };
      const oldParameters = R.keys(world.ssm);
      const newPools = [liveHeavyPool, liveOverflowPool];
      const newInstances = A.map(newPools, (pool, index) => {
        const [instanceId = ""] = world.launch(1, newFleetTags(`beep-fleet-prod-${pool.name}`));
        world.githubRunners.push(
          SelfHostedRunner.make({
            id: 701 + index,
            name: `${pool.runnerNamePrefix}${instanceId}`,
            status: "online",
            busy: false,
          })
        );
        world.ssm[`${poolTokenPath(liveSsmRoot, pool.name)}/${instanceId}`] = {
          value: "jit",
          modified: 0,
          tags: { InstanceId: instanceId },
        };
        return instanceId;
      });
      const report = yield* sweepRunners({
        environments: liveEnvironments,
        tokenPaths: A.map(newPools, (pool) => poolTokenPath(liveSsmRoot, pool.name)),
      }).pipe(Effect.provideContext(worldContext(world)));
      expect([report.terminated, report.deregistered, report.tokensDeleted]).toStrictEqual([newInstances, 2, 2]);
      expect([world.terminated, world.deletedRunners, runnerIds(world)]).toStrictEqual([
        newInstances,
        [701, 702],
        [601, 602],
      ]);
      expect(
        A.map(
          A.filter(world.instances, (instance) => A.contains(oldInstances, instance.instanceId)),
          (instance) => instance.state
        )
      ).toStrictEqual(["running", "running"]);
      expect(
        R.keys(world.ssm),
        "the old fleet's token and runner config under /github-action-runners/<prefix>/runners and shared App parameters stay"
      ).toStrictEqual(oldParameters);
    })
  );
});
