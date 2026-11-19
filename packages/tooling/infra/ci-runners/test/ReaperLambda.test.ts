import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service";
import { RunnerInstance } from "@beep/alchemy-github-runners/RunnerInstance.models";
import { runtimeConfigEnvName } from "@beep/alchemy-github-runners/RunnerRuntime.models";
import { handler, reaperPass } from "@beep/infra-ci-runners/internal/lambda/reaper";
import { ReaperRuntimeConfig } from "@beep/infra-ci-runners/Reaper";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const unusedCall = () => Effect.die("unused in the reaper Lambda tests");

const terminated: Array<string> = [];
const fleet = Ec2Fleet.of({
  createFleet: unusedCall,
  describeInstances: unusedCall,
  tag: unusedCall,
  untag: unusedCall,
  listRunners: Effect.fn("FakeEc2Fleet.listRunners")(function* () {
    return [
      RunnerInstance.make({
        instanceId: "i-old",
        launchTime: O.some(0),
        owner: O.none(),
        type: O.none(),
        githubRunnerId: O.none(),
      }),
    ];
  }),
  terminate: Effect.fn("FakeEc2Fleet.terminate")(function* (instanceId) {
    terminated.push(instanceId);
  }),
});

const encodeConfig = S.encodeEffect(S.fromJsonString(ReaperRuntimeConfig));
const config = ReaperRuntimeConfig.make({ environments: ["beep-fleet-prod-heavy"], ttlMinutes: 90 });

describe("CiRunners reaper Lambda", () => {
  it.effect("reads its runtime config from the environment and reaps", () =>
    Effect.gen(function* () {
      const configJson = yield* encodeConfig(config);
      yield* TestClock.adjust(Duration.minutes(120));
      const report = yield* reaperPass.pipe(
        Effect.provideService(Ec2Fleet, fleet),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ [runtimeConfigEnvName]: configJson })
        )
      );
      expect(report).toEqual({ inspected: 1, reaped: ["i-old"] });
      expect(terminated).toEqual(["i-old"]);
    })
  );

  it.effect("fails the invocation when its runtime config is missing", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.tryPromise({ try: () => handler(), catch: (cause) => String(cause) }).pipe(
        Effect.flip
      );
      expect(failure).toContain(runtimeConfigEnvName);
    })
  );
});
