import {
  appParameterNames,
  DeregisterRetryMessage,
  handleDeregisterRetry,
  handleTerminationEvent,
  InstanceStateChange,
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

const config = TerminationWatcherRuntimeConfig.make({
  environmentPrefix: "beep-ci",
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
      const ownerless = seed(world, { "ghr:environment": "beep-ci-heavy" });
      const run = (instanceId: string) =>
        handleTerminationEvent({ config, event: warning(instanceId) }).pipe(Effect.provideContext(worldContext(world)));
      const outcomes = yield* Effect.forEach([foreign, ownerless, "i-unknown"], run);
      expect(outcomes).toStrictEqual([["ignored"], ["ignored"], []]);
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
