import {
  AwsApiError,
  FleetLaunchResult,
  handleScaleUp,
  RunnerPool,
  sanitizeAllocationStrategy,
  toCreateFleetRequest,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { World, worldContext } from "./support/FakeWorld.ts";
import { heavyPool, poolConfig, queued } from "./support/Fixtures.ts";
import type { PoolRuntimeConfig } from "@beep/alchemy-github-runners";

const run = Effect.fn("runScaleUp")(function* (
  world: World,
  batch: ReadonlyArray<ReturnType<typeof queued>>,
  config: PoolRuntimeConfig = poolConfig()
) {
  return yield* handleScaleUp({ config, batch }).pipe(Effect.provideContext(worldContext(world)));
});

const decodeRetry = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ id: S.Int, retryCounter: S.Int })));

describe("handleScaleUp", () => {
  it.effect("launches one Spot runner per queued job with a capacity-optimized CreateFleet", () =>
    Effect.gen(function* () {
      const world = new World();
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect(retry).toStrictEqual([]);
      expect(world.fleetRequests).toHaveLength(1);
      const wire = toCreateFleetRequest(world.fleetRequests[0]!);
      expect(wire.Type).toBe("instant");
      expect(wire.SpotOptions).toStrictEqual({ AllocationStrategy: "capacity-optimized" });
      expect(wire.TargetCapacitySpecification).toStrictEqual({
        TotalTargetCapacity: 2,
        DefaultTargetCapacityType: "spot",
      });
      expect(wire.LaunchTemplateConfigs?.[0]?.LaunchTemplateSpecification).toStrictEqual({
        LaunchTemplateId: "lt-heavy",
        Version: "$Default",
      });
      expect(
        A.map(
          wire.LaunchTemplateConfigs?.[0]?.Overrides ?? [],
          (override) => `${override.SubnetId}/${override.InstanceType}`
        )
      ).toStrictEqual([
        "subnet-a/r7a.2xlarge",
        "subnet-a/m7i.4xlarge",
        "subnet-b/r7a.2xlarge",
        "subnet-b/m7i.4xlarge",
        "subnet-c/r7a.2xlarge",
        "subnet-c/m7i.4xlarge",
      ]);
      expect(A.map(wire.TagSpecifications ?? [], (spec) => spec.ResourceType)).toStrictEqual([
        "instance",
        "volume",
        "fleet",
      ]);
      expect(world.fleetRequests[0]?.tags).toStrictEqual({
        "ghr:Application": "github-action-runner",
        "ghr:created_by": "scale-up-lambda",
        "ghr:environment": "beep-ci-heavy",
        "ghr:Type": "Org",
        "ghr:Owner": "beep-effect",
        "ghr:token_path": "/beep-ci/heavy/tokens",
        "ghr:runner_name_prefix": "beep-ci-",
      });
    })
  );

  it.effect("registers each instance with a JIT config in SSM and tags its GitHub runner id", () =>
    Effect.gen(function* () {
      const world = new World();
      yield* run(world, [queued({ id: 1 })]);
      const [instance] = world.instances;
      expect(
        A.map(world.jitRequests, (request) => [request.name, request.runnerGroupId, request.labels])
      ).toStrictEqual([[`beep-ci-${instance?.instanceId}`, 7, ["beep-ec2-heavy"]]]);
      expect(world.ssm[`/beep-ci/heavy/tokens/${instance?.instanceId}`]).toStrictEqual({
        value: `jit-beep-ci-${instance?.instanceId}`,
        modified: 0,
        tags: { InstanceId: instance?.instanceId },
      });
      expect(instance?.tags["ghr:github_runner_id"]).toBe("1001");
      expect(world.ssm["/beep-ci/heavy/config/runner-group/beep-ec2-heavy"]?.value).toBe("7");
    })
  );

  it.effect("caps launches at the pool maximum and returns the overflow for redelivery", () =>
    Effect.gen(function* () {
      const world = new World();
      world.launch(1, {
        "ghr:Application": "github-action-runner",
        "ghr:environment": "beep-ci-heavy",
        "ghr:Type": "Org",
        "ghr:Owner": "beep-effect",
      });
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 }), queued({ id: 3 })]);
      expect(world.fleetRequests[0]?.targetCapacity).toBe(1);
      expect(retry).toStrictEqual(["m-1", "m-2"]);
      deepStrictEqual(
        A.map(world.sent, (sent) => [sent.queueUrl, sent.delaySeconds] as const),
        [["https://sqs.us-east-1.amazonaws.com/1/heavy-job-retry", O.some(120)] as const]
      );
      const published = yield* decodeRetry(world.sent[0]?.body);
      expect(published).toStrictEqual({ id: 3, retryCounter: 0 });
    })
  );

  it.effect("launches nothing at the cap and publishes nothing for redelivered messages", () =>
    Effect.gen(function* () {
      const world = new World();
      world.launch(2, {
        "ghr:Application": "github-action-runner",
        "ghr:environment": "beep-ci-heavy",
        "ghr:Type": "Org",
        "ghr:Owner": "beep-effect",
      });
      const retry = yield* run(world, [queued({ id: 1 })]);
      expect(world.fleetRequests).toStrictEqual([]);
      expect(retry).toStrictEqual(["m-1"]);
      expect(world.sent).toStrictEqual([]);
    })
  );

  it.effect("retries every message when CreateFleet itself fails retryably, and drops them when it does not", () =>
    Effect.gen(function* () {
      const throttled = new World();
      throttled.fleetAnswers = [
        AwsApiError.make({ service: "ec2", operation: "createFleet", retryable: true, message: "slow down" }),
      ];
      const retried = yield* run(throttled, [queued({ id: 1 }), queued({ id: 2 })]);
      expect(retried).toStrictEqual(["m-1", "m-2"]);

      const denied = new World();
      denied.fleetAnswers = [AwsApiError.make({ service: "ec2", operation: "createFleet", message: "denied" })];
      const dropped = yield* run(denied, [queued({ id: 1 })]);
      expect(dropped).toStrictEqual([]);
      expect(A.map(denied.sent, (sent) => sent.queueUrl)).toStrictEqual([
        "https://sqs.us-east-1.amazonaws.com/1/heavy-job-retry",
      ]);
    })
  );

  it.effect("retries the shortfall of a partial launch that reported a scale error", () =>
    Effect.gen(function* () {
      const world = new World();
      world.fleetAnswers = [
        FleetLaunchResult.make({ instanceIds: ["x"], errorCodes: ["InsufficientInstanceCapacity"] }),
      ];
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect(world.instances).toHaveLength(1);
      expect(retry).toStrictEqual(["m-1"]);
    })
  );

  it.effect("fails the Spot shortfall over to on-demand on a configured error code", () =>
    Effect.gen(function* () {
      const world = new World();
      world.fleetAnswers = [FleetLaunchResult.make({ instanceIds: [], errorCodes: ["UnfulfillableCapacity"] })];
      const pool = RunnerPool.make({ ...heavyPool, onDemandFailoverErrors: ["UnfulfillableCapacity"] });
      const retry = yield* run(world, [queued({ id: 1 })], poolConfig(pool));
      expect(retry).toStrictEqual([]);
      expect(A.map(world.fleetRequests, (request) => [request.capacityType, request.allocationStrategy])).toStrictEqual(
        [
          ["spot", "capacity-optimized"],
          ["on-demand", "lowest-price"],
        ]
      );
      expect(world.instances).toHaveLength(1);
    })
  );

  it.effect("terminates instances whose JIT config failed and retries their messages", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect(world.terminated).toStrictEqual(["i-0001"]);
      expect(retry).toStrictEqual(["m-1"]);
      expect(R.keys(world.ssm)).toContain("/beep-ci/heavy/tokens/i-0002");
    })
  );

  it.effect("drops user-owned repositories for org runners and returns non-workflow_job events", () =>
    Effect.gen(function* () {
      const world = new World();
      const retry = yield* run(world, [
        queued({ id: 1, repoOwnerType: "User" }),
        queued({ id: 2, eventType: "check_run" }),
      ]);
      expect(world.fleetRequests).toStrictEqual([]);
      expect(retry).toStrictEqual(["m-2"]);
    })
  );

  it.effect("skips jobs GitHub no longer reports queued when the check is on", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jobQueued = false;
      const pool = RunnerPool.make({ ...heavyPool, jobQueuedCheck: true });
      const retry = yield* run(world, [queued({ id: 1 })], poolConfig(pool));
      expect(retry).toStrictEqual([]);
      expect(world.fleetRequests).toStrictEqual([]);
    })
  );

  it.effect("redelivers only still-queued jobs over the cap, never one that already started", () =>
    Effect.gen(function* () {
      const world = new World();
      world.startedJobs = [1];
      world.launch(2, {
        "ghr:Application": "github-action-runner",
        "ghr:environment": "beep-ci-heavy",
        "ghr:Type": "Org",
        "ghr:Owner": "beep-effect",
      });
      const pool = RunnerPool.make({ ...heavyPool, jobQueuedCheck: true });
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })], poolConfig(pool));
      expect(retry).toStrictEqual(["m-2"]);
    })
  );

  it.effect("retries the right job when a launch partly fails after the queued check drops a started job", () =>
    Effect.gen(function* () {
      const world = new World();
      world.startedJobs = [1];
      world.fleetAnswers = [
        AwsApiError.make({ service: "ec2", operation: "createFleet", retryable: true, message: "slow down" }),
      ];
      const pool = RunnerPool.make({ ...heavyPool, jobQueuedCheck: true });
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })], poolConfig(pool));
      expect(retry).toStrictEqual(["m-2"]);
    })
  );

  it.effect("resolves the installation when the delivery carried none", () =>
    Effect.gen(function* () {
      const world = new World();
      yield* run(world, [queued({ id: 1, installationId: 0 })]);
      expect(world.installationLookups).toBe(1);
    })
  );
});

describe("sanitizeAllocationStrategy", () => {
  it("keeps strategies valid for the capacity type and falls back to lowest-price otherwise", () => {
    expect(sanitizeAllocationStrategy("price-capacity-optimized", "spot")).toBe("price-capacity-optimized");
    expect(sanitizeAllocationStrategy("prioritized", "on-demand")).toBe("prioritized");
    expect(sanitizeAllocationStrategy("prioritized", "spot")).toBe("lowest-price");
  });
});
