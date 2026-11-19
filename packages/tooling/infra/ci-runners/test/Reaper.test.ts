import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service";
import { AwsApiError } from "@beep/alchemy-github-runners/RunnerFleet.errors";
import { RunnerInstance } from "@beep/alchemy-github-runners/RunnerInstance.models";
import { isExpired, ReaperRuntimeConfig, reapExpiredRunners } from "@beep/infra-ci-runners/Reaper";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as TestClock from "effect/testing/TestClock";

const minute = Duration.toMillis(Duration.minutes(1));

const runner = (instanceId: string, launchedAtMinute: O.Option<number>) =>
  RunnerInstance.make({
    instanceId,
    launchTime: O.map(launchedAtMinute, (at) => at * minute),
    owner: O.none(),
    type: O.none(),
    githubRunnerId: O.none(),
  });

const unusedCall = () => Effect.die("unused in the reaper tests");

const fleetOf = (input: {
  readonly byEnvironment: Readonly<Record<string, ReadonlyArray<RunnerInstance>>>;
  readonly failTerminate?: ReadonlyArray<string>;
  readonly filters: Array<string>;
  readonly terminated: Array<string>;
}) =>
  Ec2Fleet.of({
    createFleet: unusedCall,
    describeInstances: unusedCall,
    tag: unusedCall,
    untag: unusedCall,
    listRunners: Effect.fn("FakeEc2Fleet.listRunners")(function* (filter) {
      const environment = O.getOrElse(filter.environment, () => "");
      input.filters.push(`${environment}:${A.join(filter.states, ",")}`);
      return input.byEnvironment[environment] ?? [];
    }),
    terminate: Effect.fn("FakeEc2Fleet.terminate")(function* (instanceId) {
      if (A.contains(input.failTerminate ?? [], instanceId)) {
        return yield* AwsApiError.make({ service: "ec2", operation: "TerminateInstances", message: "boom" });
      }
      input.terminated.push(instanceId);
    }),
  });

const config = ReaperRuntimeConfig.make({
  environments: ["beep-fleet-prod-heavy", "beep-fleet-prod-overflow"],
  ttlMinutes: 90,
});

describe("CiRunners reaper", () => {
  it.effect("terminates only runners older than the TTL, across both pools", () =>
    Effect.gen(function* () {
      const filters: Array<string> = [];
      const terminated: Array<string> = [];
      const fleet = fleetOf({
        byEnvironment: {
          "beep-fleet-prod-heavy": [runner("i-old", O.some(0)), runner("i-young", O.some(60))],
          "beep-fleet-prod-overflow": [runner("i-older", O.some(5)), runner("i-undated", O.none())],
        },
        filters,
        terminated,
      });
      yield* TestClock.adjust(Duration.minutes(100));
      const report = yield* reapExpiredRunners(config).pipe(Effect.provideService(Ec2Fleet, fleet));
      expect(report.inspected).toBe(4);
      expect(report.reaped).toEqual(["i-old", "i-older"]);
      expect(terminated).toEqual(["i-old", "i-older"]);
      expect(filters).toEqual([
        "beep-fleet-prod-heavy:pending,running,stopping,stopped",
        "beep-fleet-prod-overflow:pending,running,stopping,stopped",
      ]);
    })
  );

  it.effect("keeps going when one termination fails", () =>
    Effect.gen(function* () {
      const terminated: Array<string> = [];
      const fleet = fleetOf({
        byEnvironment: { "beep-fleet-prod-heavy": [runner("i-stuck", O.some(0)), runner("i-old", O.some(1))] },
        failTerminate: ["i-stuck"],
        filters: [],
        terminated,
      });
      yield* TestClock.adjust(Duration.minutes(200));
      const report = yield* reapExpiredRunners(config).pipe(Effect.provideService(Ec2Fleet, fleet));
      expect(report.reaped).toEqual(["i-old"]);
      expect(terminated).toEqual(["i-old"]);
    })
  );

  it.effect("never expires an instance it cannot date", () =>
    Effect.sync(() => {
      assertFalse(isExpired(runner("i-1", O.none()), Number.MAX_SAFE_INTEGER));
      assertTrue(isExpired(runner("i-1", O.some(0)), 1));
      assertFalse(isExpired(1)(runner("i-1", O.some(10))));
    })
  );
});
