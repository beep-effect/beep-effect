import {
  AwsApiError,
  ConfigureOperation,
  classifyFailure,
  Ec2Fleet,
  FleetLaunchResult,
  GitHubApiError,
  handleScaleUp,
  PoolRuntimeConfig,
  RunnerPool,
  sanitizeAllocationStrategy,
  toAwsApiError,
  toCreateFleetRequest,
  toGitHubApiError,
} from "@beep/alchemy-github-runners";
import * as ssm from "@distilled.cloud/aws/ssm";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { World, worldContext } from "./support/FakeWorld.ts";
import { heavyPool, poolConfig, queued } from "./support/Fixtures.ts";

const run = Effect.fn("runScaleUp")(function* (
  world: World,
  batch: ReadonlyArray<ReturnType<typeof queued>>,
  config: PoolRuntimeConfig = poolConfig()
) {
  return yield* handleScaleUp({ config, batch }).pipe(Effect.provideContext(worldContext(world)));
});

const decodeRetry = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ id: S.Int, retryCounter: S.Int })));
const encodeLines = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeDeadLetter = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ id: S.Int, retryCounter: S.OptionFromOptionalKey(S.Int) }))
);

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

  it.effect("refuses to launch and returns every message for retry when the runner count cannot be read", () =>
    Effect.gen(function* () {
      const world = new World();
      const base = worldContext(world);
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
      const retry = yield* handleScaleUp({ config: poolConfig(), batch: [queued({ id: 1 }), queued({ id: 2 })] }).pipe(
        Effect.provideContext(Context.add(base, Ec2Fleet, failing))
      );
      expect(retry).toStrictEqual(["m-1", "m-2"]);
      expect(world.fleetRequests).toStrictEqual([]);
      expect(world.sent).toStrictEqual([]);
    })
  );

  it.effect("counts a launch EC2 does not show yet through its unconsumed JIT config, and retries past the cap", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm["/beep-ci/heavy/tokens/i-unseen"] = { value: "jit", modified: 0, tags: { InstanceId: "i-unseen" } };
      const retry = yield* run(
        world,
        [queued({ id: 1 })],
        poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 1 }))
      );
      expect(
        world.fleetRequests,
        "an earlier launch's JIT config holds the slot EC2's filtered read hides"
      ).toStrictEqual([]);
      expect(retry).toStrictEqual(["m-1"]);
    })
  );

  const heavyRunnerTags = {
    "ghr:Application": "github-action-runner",
    "ghr:environment": "beep-ci-heavy",
    "ghr:Type": "Org",
    "ghr:Owner": "beep-effect",
  };

  it.effect("counts a runner that boots right after the EC2 read: its config was already read first", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm["/beep-ci/heavy/tokens/i-booting"] = { value: "jit", modified: 0, tags: { InstanceId: "i-booting" } };
      const base = worldContext(world);
      const fleet = Context.get(base, Ec2Fleet);
      const ec2ShowingRunnerBootedAfterRead = Ec2Fleet.of({
        ...fleet,
        listRunners: Effect.fn("BootingEc2.listRunners")(function* (filter) {
          const listed = yield* fleet.listRunners(filter);
          world.ssm = R.remove(world.ssm, "/beep-ci/heavy/tokens/i-booting");
          world.instances.push({
            instanceId: "i-booting",
            launchTime: 0,
            state: "running",
            tags: { ...heavyRunnerTags },
          });
          return listed;
        }),
      });
      const retry = yield* handleScaleUp({
        config: poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 1 })),
        batch: [queued({ id: 1 })],
      }).pipe(Effect.provideContext(Context.add(base, Ec2Fleet, ec2ShowingRunnerBootedAfterRead)));
      expect(
        world.fleetRequests,
        "Parameter Store is read before EC2, so i-booting's config holds the slot; EC2 first would launch past the cap"
      ).toStrictEqual([]);
      expect(retry).toStrictEqual(["m-1"]);
    })
  );

  it.effect("counts a runner seen by both reads once, by instance id", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm["/beep-ci/heavy/tokens/i-seen"] = { value: "jit", modified: 0, tags: { InstanceId: "i-seen" } };
      world.instances.push({ instanceId: "i-seen", launchTime: 0, state: "running", tags: { ...heavyRunnerTags } });
      const retry = yield* run(
        world,
        [queued({ id: 1 })],
        poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 2 }))
      );
      expect(
        world.fleetRequests[0]?.targetCapacity,
        "cap 2 with one runner counted once leaves one slot; counted twice it would leave none"
      ).toBe(1);
      expect(retry).toStrictEqual([]);
    })
  );

  it.effect("ignores a JIT config older than the in-flight window, so a runner that never booted holds no slot", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm["/beep-ci/heavy/tokens/i-stale"] = { value: "jit", modified: 0, tags: { InstanceId: "i-stale" } };
      yield* TestClock.adjust("16 minutes");
      const retry = yield* run(
        world,
        [queued({ id: 1 })],
        poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 1 }))
      );
      expect(world.fleetRequests[0]?.targetCapacity).toBe(1);
      expect(retry).toStrictEqual([]);
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

  it.effect(
    "returns every message as a batch item failure when CreateFleet itself fails with a quota or capacity code",
    () =>
      Effect.gen(function* () {
        for (const code of [
          "MaxSpotInstanceCountExceeded",
          "VcpuLimitExceeded",
          "InsufficientInstanceCapacity",
          "UnfulfillableCapacity",
        ]) {
          const world = new World();
          world.fleetAnswers = [
            AwsApiError.make({
              service: "ec2",
              operation: "createFleet",
              code: O.some(code),
              retryable: false,
              message: code,
            }),
          ];
          const retried = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })]);
          expect(
            [code, retried, world.sent.length, world.instances.length],
            "a failed request is not a transport retry: both messages return to the build queue, none to job-retry"
          ).toStrictEqual([code, ["m-1", "m-2"], 0, 0]);
        }
      })
  );

  it.effect("keeps a non-quota request-level CreateFleet failure on the job-retry path, as before", () =>
    Effect.gen(function* () {
      const world = new World();
      world.fleetAnswers = [
        AwsApiError.make({
          service: "ec2",
          operation: "createFleet",
          code: O.some("UnauthorizedOperation"),
          retryable: false,
          message: "denied",
        }),
      ];
      const retried = yield* run(world, [queued({ id: 1 })]);
      expect(retried).toStrictEqual([]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([
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

  it.effect("terminates an instance whose JIT config failed transiently and retries its job through job-retry", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      const retry = yield* run(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect(world.terminated).toStrictEqual(["i-0001"]);
      expect(
        retry,
        "a 500 is transient: the job goes to job-retry, which re-checks it, not back to the build queue"
      ).toStrictEqual([]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([
        "https://sqs.us-east-1.amazonaws.com/1/heavy-job-retry",
        "https://sqs.us-east-1.amazonaws.com/1/heavy-job-retry",
      ]);
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

const runLogged = Effect.fn("runScaleUpLogged")(function* (
  world: World,
  batch: ReadonlyArray<ReturnType<typeof queued>>,
  config: PoolRuntimeConfig = poolConfig()
) {
  const lines: Array<{ readonly level: string; readonly message: unknown; readonly annotations: unknown }> = [];
  const capture = Logger.map(Logger.formatStructured, (line) => {
    lines.push(line);
  });
  const loggers = yield* Layer.build(Logger.layer([capture]));
  const retry = yield* run(world, batch, config).pipe(Effect.provideContext(loggers));
  return { retry, lines };
});

const ssmRefusal = (message: string) =>
  AwsApiError.make({
    service: "ssm",
    operation: "putParameter",
    code: O.some("ValidationException"),
    fault: "client",
    message,
  });

const sdkConflictThroughLiveMapper = toAwsApiError("ssm")("putParameter")(new ssm.ParameterAlreadyExists({}));

const jobRetryUrl = "https://sqs.us-east-1.amazonaws.com/1/heavy-job-retry";
const buildDlqUrl = "https://sqs.us-east-1.amazonaws.com/1/heavy-build-dlq";

describe("handleScaleUp configure failures", () => {
  it("classifies a throttling code first, then the AWS layer's fault reading, then the status", () => {
    expect(
      A.map(
        [
          GitHubApiError.make({ operation: "jit", status: O.some(422), message: "invalid" }),
          GitHubApiError.make({ operation: "jit", status: O.some(429), message: "slow down" }),
          GitHubApiError.make({ operation: "jit", status: O.some(502), message: "bad gateway" }),
          GitHubApiError.make({ operation: "jit", message: "socket hang up" }),
          ssmRefusal("too long"),
          AwsApiError.make({
            service: "ssm",
            operation: "putParameter",
            code: O.some("ThrottlingException"),
            retryable: true,
            fault: "transient",
            message: "Rate exceeded",
          }),
          AwsApiError.make({ service: "ssm", operation: "putParameter", status: O.some(409), message: "conflict" }),
          AwsApiError.make({ service: "ssm", operation: "putParameter", message: "unreadable" }),
          AwsApiError.make({
            service: "ssm",
            operation: "putParameter",
            code: O.some("ThrottlingException"),
            status: O.some(400),
            message: "Rate exceeded",
          }),
          GitHubApiError.make({ operation: "jit", status: O.some(403), rateLimited: true, message: "rate limit" }),
          GitHubApiError.make({ operation: "jit", status: O.some(403), message: "Resource not accessible" }),
        ],
        classifyFailure("tagInstance")
      ),
      "AWS throttles with HTTP 400, so a throttling code wins over the status"
    ).toStrictEqual([
      "deterministic",
      "transient",
      "transient",
      "transient",
      "deterministic",
      "transient",
      "deterministic",
      "transient",
      "transient",
      "transient",
      "deterministic",
    ]);
  });

  it("reads a conflict as a landed create only for the token put and generateJitConfig", () => {
    const bareAwsConflict = AwsApiError.make({
      service: "ssm",
      operation: "putParameter",
      status: O.some(409),
      message: "conflict",
    });
    const githubConflict = toGitHubApiError("generateJitConfig")({ _tag: "Conflict", message: "Already exists" });
    const rows = A.map(
      ConfigureOperation.literals,
      (operation) =>
        [
          operation,
          A.map([sdkConflictThroughLiveMapper, bareAwsConflict, githubConflict], classifyFailure(operation)),
        ] as const
    );
    expect(rows).toStrictEqual([
      ["resolveRunnerGroup", ["deterministic", "deterministic", "deterministic"]],
      ["generateJitConfig", ["deterministic", "deterministic", "transient"]],
      ["tagInstance", ["deterministic", "deterministic", "deterministic"]],
      ["registrationToken", ["deterministic", "deterministic", "deterministic"]],
      ["putToken", ["transient", "transient", "deterministic"]],
      ["deleteToken", ["deterministic", "deterministic", "deterministic"]],
      ["deleteRunner", ["deterministic", "deterministic", "deterministic"]],
      ["terminate", ["deterministic", "deterministic", "deterministic"]],
    ]);
  });

  it.effect("retries a token put that conflicts with its own lost response, after cleaning up what landed", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", sdkConflictThroughLiveMapper]];
      const { retry } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, world.terminated, world.deletedRunners]).toStrictEqual([[], ["i-0001"], [1001]]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([jobRetryUrl]);
    })
  );

  it.effect("deletes the token parameter a lost-response put left behind, then the runner, then the instance", () =>
    Effect.gen(function* () {
      const world = new World();
      const token = "/beep-ci/heavy/tokens/i-0001";
      world.landedPutFailures = [[token, sdkConflictThroughLiveMapper]];
      yield* runLogged(world, [queued({ id: 1 })]);
      expect(
        world.cleanupCalls,
        "the put stored the parameter then failed, as when SSM's response was lost"
      ).toStrictEqual([`deleteToken:${token}`, "deleteRunner:1001", "terminate:i-0001"]);
      expect(R.has(world.ssm, token)).toBe(false);
    })
  );

  it.effect("retries a JIT registration that conflicts with its own lost response, with no runner id to delete", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      world.jitError = toGitHubApiError("generateJitConfig")({ _tag: "Conflict", message: "Already exists" });
      const { retry } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, world.terminated, world.deletedRunners]).toStrictEqual([[], ["i-0001"], []]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([jobRetryUrl]);
    })
  );

  it.effect("keeps dead-lettering a JIT refusal that is not a conflict", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      world.jitError = toGitHubApiError("generateJitConfig")({ _tag: "UnprocessableEntity", message: "invalid" });
      const { retry } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, A.map(world.sent, (sent) => sent.queueUrl)]).toStrictEqual([[], [buildDlqUrl]]);
    })
  );

  it.effect("writes the JIT config Advanced-tier, the runner-group cache Standard-tier", () =>
    Effect.gen(function* () {
      const world = new World();
      yield* run(world, [queued({ id: 1 })]);
      expect(A.map(world.puts, (put) => [put.name, put.tier, put.secure])).toStrictEqual([
        ["/beep-ci/heavy/config/runner-group/beep-ec2-heavy", "Standard", false],
        ["/beep-ci/heavy/tokens/i-0001", "Advanced", true],
      ]);
    })
  );

  it.effect(
    "a deterministic token-write failure deletes the JIT runner, terminates once, dead-letters and never retries",
    () =>
      Effect.gen(function* () {
        const world = new World();
        world.putFailures = [["/beep-ci/heavy/tokens/", ssmRefusal("Value too long")]];
        const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })]);
        expect(world.terminated).toStrictEqual(["i-0001"]);
        expect(world.deletedRunners).toStrictEqual([1001]);
        expect(retry).toStrictEqual([]);
        expect(A.filter(world.sent, (sent) => sent.queueUrl === jobRetryUrl)).toStrictEqual([]);
        expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([buildDlqUrl]);
        const dead = yield* decodeDeadLetter(world.sent[0]?.body);
        deepStrictEqual(
          dead,
          { id: 1, retryCounter: O.none() },
          "the DLQ holds the original message, with no retry counter"
        );
        const warnings = A.filter(lines, (line) => line.level === "WARN");
        expect(A.map(warnings, (line) => line.annotations)).toStrictEqual([
          {
            instanceId: "i-0001",
            operation: "putToken",
            failureClass: "deterministic",
            status: null,
            code: "ValidationException",
            providerMessage: "Value too long",
          },
        ]);
        const errors = A.filter(lines, (line) => line.level === "ERROR");
        expect(A.map(errors, (line) => line.annotations)).toStrictEqual([
          {
            instanceId: "i-0001",
            operation: "putToken",
            failureClass: "deterministic",
            status: null,
            code: "ValidationException",
            providerMessage: "Value too long",
            messageId: "m-1",
            jobId: 1,
            reason: "deterministic",
            deadLetter: "sent",
          },
        ]);
      })
  );

  it.effect("never logs the JIT config, even when the provider echoes it back", () =>
    Effect.gen(function* () {
      const world = new World();
      const secret = "jit-beep-ci-i-0001";
      const longTokenLikeRunNotAKnownSecret = Str.repeat(6)("jitconfig");
      world.putFailures = [
        [
          "/beep-ci/heavy/tokens/",
          ssmRefusal(`Value '${secret}' at 'value' failed; also ${longTokenLikeRunNotAKnownSecret}`),
        ],
      ];
      const { lines } = yield* runLogged(world, [queued({ id: 1 })]);
      const rendered = yield* encodeLines(lines);
      expect(
        [Str.includes(secret)(rendered), Str.includes(longTokenLikeRunNotAKnownSecret)(rendered)],
        "the known value is masked, and the long token-like run is masked by its shape"
      ).toStrictEqual([false, false]);
      expect(Str.includes("Value '<redacted>' at 'value' failed; also <redacted>")(rendered)).toBe(true);
    })
  );

  it.effect("a transient token-write failure retries through job-retry with a delay that grows per attempt", () =>
    Effect.gen(function* () {
      const throttled = AwsApiError.make({
        service: "ssm",
        operation: "putParameter",
        code: O.some("ThrottlingException"),
        retryable: true,
        fault: "transient",
        message: "Rate exceeded",
      });
      const first = new World();
      first.putFailures = [["/beep-ci/heavy/tokens/", throttled]];
      const firstRetry = yield* run(first, [queued({ id: 1 })]);
      const second = new World();
      second.putFailures = [["/beep-ci/heavy/tokens/", throttled]];
      const secondRetry = yield* run(second, [queued({ id: 1, retryCounter: 0 })]);
      expect([firstRetry, secondRetry, first.terminated, first.deletedRunners]).toStrictEqual([
        [],
        [],
        ["i-0001"],
        [1001],
      ]);
      deepStrictEqual(
        A.map(A.appendAll(first.sent, second.sent), (sent) => [sent.queueUrl, sent.delaySeconds] as const),
        [[jobRetryUrl, O.some(120)] as const, [jobRetryUrl, O.some(240)] as const]
      );
      const counters = yield* Effect.forEach(A.appendAll(first.sent, second.sent), (sent) => decodeRetry(sent.body), {
        concurrency: 1,
      });
      expect(A.map(counters, (message) => message.retryCounter)).toStrictEqual([0, 1]);
    })
  );

  const exhaustedThrottle = AwsApiError.make({
    service: "ssm",
    operation: "putParameter",
    code: O.some("ThrottlingException"),
    retryable: true,
    fault: "transient",
    message: "Rate exceeded",
  });

  const warnAnnotations = (lines: ReadonlyArray<{ readonly level: string; readonly annotations: unknown }>) =>
    A.map(
      A.filter(lines, (line) => line.level === "WARN"),
      (line) => line.annotations as Readonly<Record<string, unknown>>
    );

  const tokenRegistrationPool = RunnerPool.make({ ...heavyPool, jitConfig: false });

  const errorAnnotations = (lines: ReadonlyArray<{ readonly level: string; readonly annotations: unknown }>) =>
    A.map(
      A.filter(lines, (line) => line.level === "ERROR"),
      (line) => line.annotations as Readonly<Record<string, unknown>>
    );

  it.effect("dead-letters a transient failure once its job-retry attempts are used up, never redelivering it", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1, retryCounter: 1 })]);
      expect([retry, A.map(world.sent, (sent) => sent.queueUrl), world.terminated]).toStrictEqual([
        [],
        [buildDlqUrl],
        ["i-0001"],
      ]);
      expect(
        A.map(errorAnnotations(lines), (annotations) => [annotations.reason, annotations.deadLetter])
      ).toStrictEqual([["retries-exhausted", "sent"]]);
    })
  );

  it.effect(
    "dead-letters a transient token-write failure of a pool with no retry policy, deleting its JIT runner",
    () =>
      Effect.gen(function* () {
        const world = new World();
        world.putFailures = [["/beep-ci/heavy/tokens/", exhaustedThrottle]];
        const pool = RunnerPool.make({ ...heavyPool, jobRetry: O.none() });
        const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })], poolConfig(pool));
        expect([
          retry,
          A.map(world.sent, (sent) => sent.queueUrl),
          world.terminated,
          world.deletedRunners,
        ]).toStrictEqual([[], [buildDlqUrl], ["i-0001"], [1001]]);
        expect(A.map(errorAnnotations(lines), (annotations) => annotations.reason)).toStrictEqual(["no-retry-policy"]);
      })
  );

  it.effect("dead-letters a group whose runner-group lookup is refused, terminating each instance once", () =>
    Effect.gen(function* () {
      const world = new World();
      world.runnerGroupError = GitHubApiError.makeOption({
        operation: "runnerGroupId",
        status: O.some(404),
        message: "Runner group beep-ec2-heavy does not exist",
      });
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect([retry, world.cleanupCalls, world.deletedRunners]).toStrictEqual([
        [],
        ["terminate:i-0001", "terminate:i-0002"],
        [],
      ]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([buildDlqUrl, buildDlqUrl]);
      const dead = yield* Effect.forEach(world.sent, (sent) => decodeDeadLetter(sent.body), { concurrency: 1 });
      expect(A.map(dead, (message) => message.id)).toStrictEqual([1, 2]);
      expect(warnAnnotations(lines)).toStrictEqual([
        {
          instanceId: "i-0001",
          operation: "resolveRunnerGroup",
          failureClass: "deterministic",
          status: 404,
          code: null,
          providerMessage: "Runner group beep-ec2-heavy does not exist",
        },
        {
          instanceId: "i-0002",
          operation: "resolveRunnerGroup",
          failureClass: "deterministic",
          status: 404,
          code: null,
          providerMessage: "Runner group beep-ec2-heavy does not exist",
        },
      ]);
    })
  );

  it.effect("retries a group whose runner-group lookup answered 503, sending nothing to the DLQ", () =>
    Effect.gen(function* () {
      const world = new World();
      world.runnerGroupError = GitHubApiError.makeOption({
        operation: "runnerGroupId",
        status: O.some(503),
        message: "unavailable",
      });
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 }), queued({ id: 2 })]);
      expect([retry, world.cleanupCalls]).toStrictEqual([[], ["terminate:i-0001", "terminate:i-0002"]]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([jobRetryUrl, jobRetryUrl]);
      expect(
        A.map(warnAnnotations(lines), (annotations) => [
          annotations.instanceId,
          annotations.operation,
          annotations.failureClass,
        ])
      ).toStrictEqual([
        ["i-0001", "resolveRunnerGroup", "transient"],
        ["i-0002", "resolveRunnerGroup", "transient"],
      ]);
      expect(errorAnnotations(lines)).toStrictEqual([]);
    })
  );

  it.effect("dead-letters a transient failure whose job-retry publish fails, naming the reason", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", exhaustedThrottle]];
      world.sendFailures = [jobRetryUrl];
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, A.map(world.sent, (sent) => sent.queueUrl), world.terminated]).toStrictEqual([
        [],
        [buildDlqUrl],
        ["i-0001"],
      ]);
      expect(
        A.map(errorAnnotations(lines), (annotations) => [annotations.reason, annotations.deadLetter])
      ).toStrictEqual([["retry-publish-failed", "sent"]]);
    })
  );

  it.effect("acknowledges and only logs the same failure when the pool has no build DLQ", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", exhaustedThrottle]];
      world.sendFailures = [jobRetryUrl];
      const config = PoolRuntimeConfig.make({ ...poolConfig(), buildDlqUrl: O.none() });
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })], config);
      expect([retry, world.sent, world.terminated]).toStrictEqual([[], [], ["i-0001"]]);
      expect(
        A.map(errorAnnotations(lines), (annotations) => [annotations.reason, annotations.deadLetter])
      ).toStrictEqual([["retry-publish-failed", "no-dlq"]]);
    })
  );

  it.effect("dead-letters a registration pool whose token request is refused", () =>
    Effect.gen(function* () {
      const world = new World();
      world.registrationError = GitHubApiError.makeOption({
        operation: "registrationToken",
        status: O.some(403),
        message: "Resource not accessible by integration",
      });
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })], poolConfig(tokenRegistrationPool));
      expect([retry, world.puts, world.cleanupCalls]).toStrictEqual([[], [], ["terminate:i-0001"]]);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([buildDlqUrl]);
      expect(
        A.map(warnAnnotations(lines), (annotations) => [
          annotations.operation,
          annotations.failureClass,
          annotations.status,
        ])
      ).toStrictEqual([["registrationToken", "deterministic", 403]]);
    })
  );

  it.effect("masks the registration token a refused put echoes back, and deletes what landed", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [
        [
          "/beep-ci/heavy/tokens/",
          ssmRefusal("Value '--url https://github.com/beep-effect --token reg-token' failed; token reg-token"),
        ],
      ];
      const { lines } = yield* runLogged(world, [queued({ id: 1 })], poolConfig(tokenRegistrationPool));
      const rendered = yield* encodeLines(lines);
      expect(Str.includes("reg-token")(rendered)).toBe(false);
      expect(Str.includes("--token <redacted>' failed; token <redacted>")(rendered)).toBe(true);
      expect(
        world.cleanupCalls,
        "no JIT runner was registered, so only the token parameter and the instance are cleaned up"
      ).toStrictEqual(["deleteToken:/beep-ci/heavy/tokens/i-0001", "terminate:i-0001"]);
      expect(A.map(world.puts, (put) => put.tier)).toStrictEqual(["Advanced"]);
    })
  );

  it.effect("drops a dead-lettered message whose DLQ send fails, with an error line, and never returns it", () =>
    Effect.gen(function* () {
      const world = new World();
      world.jitFailures = ["i-0001"];
      world.sendFailures = [buildDlqUrl];
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1, retryCounter: 1 })]);
      expect(
        [retry, world.terminated, world.fleetRequests.length],
        "acknowledged: no redelivery, so no second launch for this job"
      ).toStrictEqual([[], ["i-0001"], 1]);
      const sendLine = A.filter(
        lines,
        (line) => line.message === "scale-up: build DLQ send failed; the message is dropped"
      );
      expect(A.map(sendLine, ({ level, annotations }) => ({ level, annotations }))).toStrictEqual([
        {
          level: "ERROR",
          annotations: {
            messageId: "m-1",
            jobId: 1,
            repository: "beep-effect/beep-effect",
            reason: "retries-exhausted",
            code: "ServiceUnavailable",
            status: 503,
          },
        },
      ]);
      expect(
        A.map(errorAnnotations(lines), (annotations) => [annotations.reason, annotations.deadLetter ?? "send line"])
      ).toStrictEqual([
        ["retries-exhausted", "send line"],
        ["retries-exhausted", "send-failed"],
      ]);
    })
  );

  it.effect("logs a failed job-retry publish for a launched runner and keeps the batch successful", () =>
    Effect.gen(function* () {
      const world = new World();
      world.sendFailures = [jobRetryUrl];
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, world.terminated]).toStrictEqual([[], []]);
      expect(
        A.map(
          A.filter(lines, (line) => line.level === "WARN"),
          (line) => line.annotations
        )
      ).toStrictEqual([
        { messageId: "m-1", jobId: 1, code: "ServiceUnavailable", status: 503, providerMessage: "unavailable" },
      ]);
    })
  );

  it.effect("logs each message deferred at the cap with its job and the count it was deferred at", () =>
    Effect.gen(function* () {
      const world = new World();
      world.launch(1, {
        "ghr:Application": "github-action-runner",
        "ghr:environment": "beep-ci-heavy",
        "ghr:Type": "Org",
        "ghr:Owner": "beep-effect",
      });
      const config = poolConfig(RunnerPool.make({ ...heavyPool, maximumCount: 1 }));
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 }), queued({ id: 2, retryCounter: 3 })], config);
      expect(retry).toStrictEqual(["m-1", "m-2"]);
      expect(
        A.map(
          A.filter(lines, (line) => line.message === "scale-up: deferred at cap"),
          (line) => [line.level, line.annotations]
        )
      ).toStrictEqual([
        [
          "INFO",
          { messageId: "m-1", jobId: 1, environment: "beep-ci-heavy", retryCounter: 0, runners: 1, maximumCount: 1 },
        ],
        [
          "INFO",
          { messageId: "m-2", jobId: 2, environment: "beep-ci-heavy", retryCounter: 3, runners: 1, maximumCount: 1 },
        ],
      ]);
    })
  );

  it.effect("logs nothing as deferred when the batch fits under the cap", () =>
    Effect.gen(function* () {
      const world = new World();
      const { lines } = yield* runLogged(world, [queued({ id: 1 })]);
      expect(A.filter(lines, (line) => line.message === "scale-up: deferred at cap")).toStrictEqual([]);
    })
  );

  it.effect("logs a failed instance tag once and keeps the runner", () =>
    Effect.gen(function* () {
      const world = new World();
      world.tagFailure = AwsApiError.makeOption({
        service: "ec2",
        operation: "createTags",
        code: O.some("UnauthorizedOperation"),
        fault: "client",
        message: "denied",
      });
      const { retry, lines } = yield* runLogged(world, [queued({ id: 1 })]);
      expect([retry, world.terminated, R.keys(world.ssm)]).toStrictEqual([
        [],
        [],
        ["/beep-ci/heavy/config/runner-group/beep-ec2-heavy", "/beep-ci/heavy/tokens/i-0001"],
      ]);
      expect(
        A.map(
          A.filter(lines, (line) => line.level === "WARN"),
          (line) => line.annotations
        )
      ).toStrictEqual([
        {
          instanceId: "i-0001",
          operation: "tagInstance",
          failureClass: "deterministic",
          status: null,
          code: "UnauthorizedOperation",
          providerMessage: "denied",
        },
      ]);
    })
  );

  it.effect("cleans up a failed token write in order: token parameter, JIT runner, instance, once each", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", ssmRefusal("Value too long")]];
      const retry = yield* run(world, [queued({ id: 1 })]);
      expect(
        [retry, world.cleanupCalls],
        "a client-side write failure can still have landed, so its parameter must not keep a cap slot"
      ).toStrictEqual([[], ["deleteToken:/beep-ci/heavy/tokens/i-0001", "deleteRunner:1001", "terminate:i-0001"]]);
    })
  );

  it.effect("logs a failed token-parameter delete and still deletes the runner and terminates", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", ssmRefusal("Value too long")]];
      world.deleteFailure = AwsApiError.makeOption({
        service: "ssm",
        operation: "deleteParameter",
        code: O.some("AccessDeniedException"),
        fault: "client",
        message: "not authorized",
      });
      const { lines } = yield* runLogged(world, [queued({ id: 1 })]);
      expect(world.cleanupCalls).toStrictEqual([
        "deleteToken:/beep-ci/heavy/tokens/i-0001",
        "deleteRunner:1001",
        "terminate:i-0001",
      ]);
      expect(
        A.map(
          A.filter(lines, (line) => line.level === "WARN"),
          (line) => line.annotations
        )
      ).toStrictEqual([
        {
          instanceId: "i-0001",
          operation: "putToken",
          failureClass: "deterministic",
          status: null,
          code: "ValidationException",
          providerMessage: "Value too long",
        },
        {
          instanceId: "i-0001",
          operation: "deleteToken",
          failureClass: "deterministic",
          status: null,
          code: "AccessDeniedException",
          providerMessage: "not authorized",
          tokenParameter: "/beep-ci/heavy/tokens/i-0001",
        },
      ]);
    })
  );

  it.effect("logs a failed runner deletion and a failed termination instead of swallowing them", () =>
    Effect.gen(function* () {
      const world = new World();
      world.putFailures = [["/beep-ci/heavy/tokens/", ssmRefusal("Value too long")]];
      world.failOnDelete = [1001];
      world.terminateFailure = AwsApiError.makeOption({
        service: "ec2",
        operation: "terminateInstances",
        code: O.some("InternalError"),
        retryable: true,
        fault: "transient",
        message: "try again",
      });
      const { lines } = yield* runLogged(world, [queued({ id: 1 })]);
      deepStrictEqual(
        A.map(
          A.filter(lines, (line) => line.level === "WARN"),
          (line) => R.get(line.annotations as Readonly<Record<string, unknown>>, "operation")
        ),
        [O.some("putToken"), O.some("deleteRunner"), O.some("terminate")]
      );
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
