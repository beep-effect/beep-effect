import {
  decodeCiRunnersConfig,
  effectiveCap,
  personalConfig,
  productionConfig,
  RehearsalRepository,
  resolveStageConfig,
  spotVcpuCommitted,
} from "@beep/infra-ci-runners/Config";
import { stageCredentials } from "@beep/infra-ci-runners/Credentials";
import { liveFleetOverlaps, physicalNames, poolEnvironment, touchesLiveFleet } from "@beep/infra-ci-runners/Names";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
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

describe("CiRunners configuration validation", () => {
  const withNetwork = (network: Partial<typeof productionConfig.network>) =>
    decodeCiRunnersConfig({ ...productionConfig, network: { ...productionConfig.network, ...network } });

  const refusedMessage = <A, E extends { readonly message: string }, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.map(Effect.flip(effect), (error) => error.message);

  it.effect("refuses CIDR blocks AWS does not accept, subnets outside the VPC and overlapping subnets", () =>
    Effect.gen(function* () {
      const subnet = (cidrBlock: string) => ({ availabilityZone: "us-east-1a", cidrBlock });
      const messages = yield* Effect.forEach(
        [
          withNetwork({ vpcCidr: "10.300.0.0/16" }),
          withNetwork({ vpcCidr: "10.89.0.0/8" }),
          withNetwork({ vpcCidr: "10.89.1.0/16" }),
          withNetwork({ subnets: [subnet("10.89.0.0/29")] }),
          withNetwork({ subnets: [subnet("10.90.0.0/20")] }),
          withNetwork({ subnets: [subnet("10.89.0.0/20"), subnet("10.89.8.0/21")] }),
        ],
        refusedMessage,
        { concurrency: 1 }
      );
      expect(messages[0]).toContain("/16 to /28");
      expect(messages[1]).toContain("/16 to /28");
      expect(messages[2]).toContain("first address");
      expect(messages[3]).toContain("/16 to /28");
      expect(messages[4]).toContain("inside the VPC block");
      expect(messages[5]).toContain("must not overlap");
      const fine = yield* withNetwork({ subnets: [subnet("10.89.0.0/20"), subnet("10.89.16.0/28")] });
      expect(fine.network.subnets.length).toBe(2);
    })
  );

  it.effect(
    "refuses a flow-log retention CloudWatch Logs does not offer, another run-as user and swapped pool slots",
    () =>
      Effect.gen(function* () {
        const retention = yield* Effect.flip(withNetwork({ flowLogRetentionDays: 2 as 14 }));
        expect(retention._tag).toBe("SchemaError");
        const runAs = yield* Effect.flip(
          decodeCiRunnersConfig({
            ...productionConfig,
            image: { ...productionConfig.image, runAs: "runner" as "ec2-user" },
          })
        );
        expect(runAs._tag).toBe("SchemaError");
        const swapped = yield* refusedMessage(
          decodeCiRunnersConfig({ ...productionConfig, overflow: { ...productionConfig.overflow, name: "heavy" } })
        );
        expect(swapped).toContain("heavy slot must hold the heavy pool");
      })
  );

  it.effect("counts the pools once per runner owner the allow list admits", () =>
    Effect.gen(function* () {
      const primary = yield* decodeCiRunnersConfig({ ...productionConfig, phase: "primary" });
      const owners = {
        ...primary,
        repositoryAllowList: ["beep-effect/beep-effect", "Beep-Effect/other", "alice/sandbox"],
      };
      expect(spotVcpuCommitted(owners)).toBe(spotVcpuCommitted(primary) * 2);
      expect(spotVcpuCommitted({ ...primary, repositoryAllowList: [] })).toBe(spotVcpuCommitted(primary));
    })
  );
});

describe("CiRunners production credentials", () => {
  const credentialsOf = (values: Record<string, string>) =>
    stageCredentials("prod").pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values))
    );

  it.effect("refuses a blank or placeholder credential, naming neither value", () =>
    Effect.gen(function* () {
      const real = {
        CI_RUNNERS_GITHUB_APP_ID: "12345",
        CI_RUNNERS_GITHUB_APP_KEY_BASE64: "a2V5",
        CI_RUNNERS_GITHUB_WEBHOOK_SECRET: "s3cret",
      };
      const loaded = yield* credentialsOf(real);
      const isSecret = Redacted.isRedacted(loaded.id);
      assertTrue(isSecret);
      for (const bad of ["", "   ", "unset"]) {
        const error = yield* Effect.flip(credentialsOf({ ...real, CI_RUNNERS_GITHUB_WEBHOOK_SECRET: bad }));
        expect(error._tag).toBe("ConfigError");
        expect(error.message).toContain("CI_RUNNERS_GITHUB_WEBHOOK_SECRET");
      }
    })
  );
});
