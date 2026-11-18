import {
  decodeCiRunnersConfig,
  effectiveCap,
  personalConfig,
  productionConfig,
  RehearsalRepository,
  resolveStageConfig,
  spotVcpuCommitted,
} from "@beep/infra-ci-runners/Config";
import { liveFleetOverlaps, physicalNames, poolEnvironment, touchesLiveFleet } from "@beep/infra-ci-runners/Names";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const isRehearsalRepository = S.is(RehearsalRepository);
const environmentOf = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

describe("CiRunners configuration", () => {
  it.effect("decodes the production configuration with the live pool values", () =>
    Effect.gen(function* () {
      const config = yield* decodeCiRunnersConfig(productionConfig);
      expect(config.phase).toBe("overlap");
      expect(config.heavy.instanceTypes).toHaveLength(7);
      expect(config.heavy.maximumCount).toBe(2);
      expect(config.overflow.maximumCount).toBe(48);
      expect(config.image.amiId).toBe("ami-07af50c345b5ba065");
      expect(config.runnerType).toBe("Org");
      expect(config.repositoryAllowList).toEqual(["beep-effect/beep-effect"]);
    })
  );

  it.effect("commits all 512 Spot vCPU in the overlap and 512 at the live caps", () =>
    Effect.gen(function* () {
      const overlap = yield* decodeCiRunnersConfig(productionConfig);
      expect(spotVcpuCommitted(overlap)).toBe(512);
      const primary = yield* decodeCiRunnersConfig({
        ...productionConfig,
        phase: "primary",
        heavy: { ...productionConfig.heavy, maximumCount: 8 },
      });
      expect(spotVcpuCommitted(primary)).toBe(512);
    })
  );

  it.effect("refuses caps that push the two fleets past the Spot quota", () =>
    Effect.gen(function* () {
      const error = yield* decodeCiRunnersConfig({
        ...productionConfig,
        overflow: { ...productionConfig.overflow, overlapMaximumCount: 48 },
      }).pipe(Effect.flip);
      expect(error.message).toContain("exceeds the Spot vCPU quota");
    })
  );

  it.effect("runs each pool at its overlap cap, then at its live cap", () =>
    Effect.gen(function* () {
      const config = yield* decodeCiRunnersConfig(productionConfig);
      expect(effectiveCap(config.overflow, "overlap")).toBe(2);
      expect(effectiveCap("primary")(config.overflow)).toBe(48);
    })
  );
});

describe("CiRunners personal-stage fence", () => {
  it.effect("launches nothing and allows no repository without a rehearsal", () =>
    Effect.gen(function* () {
      const config = yield* resolveStageConfig("dev-test").pipe(environmentOf({}));
      expect(config.runnerType).toBe("Repo");
      expect(config.repositoryAllowList).toEqual([]);
      expect(effectiveCap(config.heavy, config.phase)).toBe(0);
      expect(effectiveCap(config.overflow, config.phase)).toBe(0);
    })
  );

  it.effect("allows one repository runner per pool for a rehearsal, never inside the overlap budget", () =>
    Effect.gen(function* () {
      const input = personalConfig(O.some("alice/sandbox"));
      expect(input.repositoryAllowList).toEqual(["alice/sandbox"]);
      expect(input.heavy.overlapMaximumCount).toBe(1);
      const error = yield* resolveStageConfig("dev-test").pipe(
        environmentOf({ CI_RUNNERS_REHEARSAL_REPOSITORY: "alice/sandbox" }),
        Effect.flip
      );
      expect(error._tag).toBe("ConfigError");
      expect(error.message).toContain("exceeds the Spot vCPU quota");
      const drained = yield* decodeCiRunnersConfig({ ...input, phase: "primary" });
      expect(effectiveCap(drained.heavy, drained.phase)).toBe(1);
      expect(spotVcpuCommitted(drained)).toBeLessThanOrEqual(drained.spotQuotaVcpu);
    })
  );

  it.effect("refuses the production repository as a rehearsal", () =>
    Effect.gen(function* () {
      assertFalse(isRehearsalRepository("beep-effect/beep-effect"));
      assertFalse(isRehearsalRepository("Beep-Effect/Beep-Effect"));
      assertTrue(isRehearsalRepository("alice/sandbox"));
      const error = yield* resolveStageConfig("dev-test").pipe(
        environmentOf({ CI_RUNNERS_REHEARSAL_REPOSITORY: "beep-effect/beep-effect" }),
        Effect.flip
      );
      expect(error._tag).toBe("ConfigError");
    })
  );

  it.effect("keeps prod on its own configuration whatever the rehearsal variable says", () =>
    Effect.gen(function* () {
      const config = yield* resolveStageConfig("prod").pipe(
        environmentOf({ CI_RUNNERS_REHEARSAL_REPOSITORY: "alice/sandbox" })
      );
      expect(config.runnerType).toBe("Org");
      expect(personalConfig(O.none()).runnerType).toBe("Repo");
    })
  );
});

describe("CiRunners physical names", () => {
  it.effect("pins the production names", () =>
    Effect.sync(() => {
      const names = physicalNames("prod");
      expect(names.fleet).toBe("beep-fleet-prod");
      expect(names.ssmRoot).toBe("/beep-fleet/prod");
      expect(names.kmsAlias).toBe("alias/beep-fleet-prod-github-app");
      expect(names.runnerSecurityGroup).toBe("beep-fleet-prod-runner");
      expect(names.flowLogGroup).toBe("/beep-fleet/prod/vpc-flow-logs");
      expect(names.reaperFunction).toBe("beep-fleet-prod-reaper");
      expect(poolEnvironment("prod", "heavy")).toBe("beep-fleet-prod-heavy");
      expect(poolEnvironment("overflow")("prod")).toBe("beep-fleet-prod-overflow");
    })
  );

  it.effect("keeps every stage's names clear of the live fleet", () =>
    Effect.sync(() => {
      for (const stage of ["prod", "dev-alice", "dev-bob", "staging"]) {
        expect(liveFleetOverlaps(physicalNames(stage))).toEqual([]);
      }
      assertTrue(touchesLiveFleet("beep-ci-heavy"));
      assertTrue(touchesLiveFleet("/github-action-runners/app/github_app_id"));
      assertTrue(touchesLiveFleet("beep-"));
      assertFalse(touchesLiveFleet("beep-fleet-prod-heavy"));
    })
  );

  it.effect("never lets the prod watcher prefix match a personal stage's runners", () =>
    Effect.sync(() => {
      const prodPrefix = physicalNames("prod").fleet;
      assertFalse(Str.startsWith(prodPrefix)(poolEnvironment("dev-alice", "heavy")));
      assertFalse(Str.startsWith(physicalNames("dev-alice").fleet)(poolEnvironment("prod", "heavy")));
    })
  );
});
