import {
  decodeCiRunnersConfig,
  effectiveCap,
  PoolName,
  personalConfig,
  productionConfig,
  productionStage,
  RehearsalRepository,
  resolveStageConfig,
  spotVcpuCommitted,
} from "@beep/infra-ci-runners/Config";
import { AppCredentials, requireSigningAppKey, stageCredentials } from "@beep/infra-ci-runners/Credentials";
import {
  liveFleetOverlaps,
  liveFleetPrefixes,
  physicalNames,
  poolEnvironment,
  touchesLiveFleet,
} from "@beep/infra-ci-runners/Names";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeWebhookSecret, productionCredentialEnv } from "./support/Credentials.ts";

const isRehearsalRepository = S.is(RehearsalRepository);

const upstreamTagFilter = (
  instanceTags: Readonly<Record<string, string>>,
  tagFilters: Readonly<Record<string, string>>
): boolean =>
  A.every(R.toEntries(tagFilters), ([key, prefix]) =>
    O.exists(O.fromUndefinedOr(instanceTags[key]), Str.startsWith(prefix))
  );
const environmentOf = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

describe("CiRunners configuration", () => {
  it.effect("decodes the production configuration with the live pool values", () =>
    Effect.gen(function* () {
      const config = yield* decodeCiRunnersConfig(productionConfig);
      expect(config.phase).toBe("primary");
      expect(
        config.heavy.instanceTypes,
        "r7a.2xlarge and m6i.4xlarge left the heavy pool for their eviction rates"
      ).toEqual(["r7i.2xlarge", "r6i.2xlarge", "m7a.4xlarge", "m7i.4xlarge", "m6a.4xlarge"]);
      expect(config.overflow.instanceTypes, "the overflow pool keeps the 8-vCPU r7i and r6i").toEqual([
        "r7i.2xlarge",
        "r6i.2xlarge",
      ]);
      expect(config.heavy.maximumCount).toBe(2);
      expect(config.overflow.maximumCount).toBe(48);
      expect(config.image.amiId).toBe("ami-07af50c345b5ba065");
      expect(config.runnerType).toBe("Org");
      expect(config.repositoryAllowList).toEqual(["beep-effect/beep-effect"]);
    })
  );

  it.effect("commits all 512 Spot vCPU in the overlap and 512 at the live caps", () =>
    Effect.gen(function* () {
      const overlap = yield* decodeCiRunnersConfig({ ...productionConfig, phase: "overlap" });
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
        phase: "overlap",
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

  it.effect("keeps both production pool environments clear of the live fleet", () =>
    Effect.sync(() => {
      const environments = A.map(PoolName.literals, (pool) => poolEnvironment(productionStage, pool));
      expect(environments).toStrictEqual(["beep-fleet-prod-heavy", "beep-fleet-prod-overflow"]);
      expect(A.map(environments, touchesLiveFleet)).toStrictEqual([false, false]);
    })
  );

  it.effect("keeps both production pool environments outside the live watchers' prefix tag filters", () =>
    Effect.sync(() => {
      const liveEnvironments = A.filter(liveFleetPrefixes, (prefix) => !Str.includes("/")(prefix));
      expect(liveEnvironments).toStrictEqual(["beep-ci", "beep-ovf"]);
      const prodEnvironments = A.map(PoolName.literals, (pool) => poolEnvironment(productionStage, pool));
      const selects = (environment: string) =>
        A.map(liveEnvironments, (prefix) =>
          upstreamTagFilter({ "ghr:environment": environment }, { "ghr:environment": prefix })
        );
      expect(
        A.map(prodEnvironments, selects),
        'the live termination watchers select { "ghr:environment": <prefix> } by startsWith; no prod pool may match'
      ).toStrictEqual([
        [false, false],
        [false, false],
      ]);
      expect(
        A.map(liveEnvironments, selects),
        "positive control: each live watcher selects its own pool's instances"
      ).toStrictEqual([
        [true, false],
        [false, true],
      ]);
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

  it.effect(
    "refuses CIDR blocks AWS does not accept, non-private VPC blocks, subnets outside the VPC, overlapping subnets and two in one AZ",
    () =>
      Effect.gen(function* () {
        const subnet = (cidrBlock: string, availabilityZone = "us-east-1a") => ({ availabilityZone, cidrBlock });
        const messages = yield* Effect.forEach(
          [
            withNetwork({ vpcCidr: "10.300.0.0/16" }),
            withNetwork({ vpcCidr: "10.89.0.0/8" }),
            withNetwork({ vpcCidr: "10.89.1.0/16" }),
            withNetwork({ subnets: [subnet("10.89.0.0/29")] }),
            withNetwork({ subnets: [subnet("10.90.0.0/20")] }),
            withNetwork({ subnets: [subnet("10.89.0.0/20"), subnet("10.89.8.0/21", "us-east-1b")] }),
            withNetwork({ subnets: [subnet("10.89.0.0/20"), subnet("10.89.16.0/20")] }),
            withNetwork({ vpcCidr: "169.254.0.0/16", subnets: [subnet("169.254.0.0/20")] }),
            withNetwork({ vpcCidr: "100.64.0.0/16", subnets: [subnet("100.64.0.0/20")] }),
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
        expect(messages[6]).toContain("only one runner subnet");
        expect(messages[7]).toContain("RFC 1918");
        expect(messages[8]).toContain("RFC 1918");
        const fine = yield* withNetwork({ subnets: [subnet("10.89.0.0/20"), subnet("10.89.16.0/28", "us-east-1b")] });
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
      const allowList = ["beep-effect/beep-effect", "beep-effect/other", "alice/sandbox"];
      expect(
        spotVcpuCommitted({ ...primary, runnerType: "Org", repositoryAllowList: allowList }),
        "org runners: one owner per organization (beep-effect, alice), compared exactly as scale-up's ownerOf does"
      ).toBe(spotVcpuCommitted(primary) * 2);
      expect(
        spotVcpuCommitted({ ...primary, runnerType: "Repo", repositoryAllowList: allowList }),
        "repo runners: one owner per repository"
      ).toBe(spotVcpuCommitted(primary) * 3);
      expect(spotVcpuCommitted({ ...primary, repositoryAllowList: [] })).toBe(spotVcpuCommitted(primary));
    })
  );
});

describe("CiRunners production credentials", () => {
  const credentialsOf = (values: Record<string, string>) =>
    stageCredentials("prod").pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values))
    );

  it.effect("loads real-shaped credentials and refuses weak ones, naming neither the value nor its length", () =>
    Effect.gen(function* () {
      const loaded = yield* credentialsOf(productionCredentialEnv);
      const isSecret = Redacted.isRedacted(loaded.id);
      assertTrue(isSecret);
      const pem = (length: number) =>
        Base64.encode(
          `-----BEGIN ${A.join(["RSA", "PRIVATE", "KEY"], " ")}-----\n${Str.repeat(length)("A")}\n-----END ${A.join(["RSA", "PRIVATE", "KEY"], " ")}-----\n`
        );
      const refusals: ReadonlyArray<readonly [string, string, string]> = [
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", "", "Credentials/WebhookSecret"],
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", "unset", "webhook secret is a placeholder"],
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", Str.repeat(7)("unset"), "webhook secret is a placeholder"],
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", `unset${fakeWebhookSecret}`, "webhook secret is a placeholder"],
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", Str.repeat(40)("a"), "webhook secret too weak"],
        ["CI_RUNNERS_GITHUB_WEBHOOK_SECRET", Str.slice(0, 31)(fakeWebhookSecret), "webhook secret too weak"],
        [
          "CI_RUNNERS_GITHUB_WEBHOOK_SECRET",
          `${fakeWebhookSecret}      `,
          "webhook secret has characters outside [A-Za-z0-9+/=_-]",
        ],
        ["CI_RUNNERS_GITHUB_APP_KEY_BASE64", "a2V5", "App key is not a PEM private key"],
        ["CI_RUNNERS_GITHUB_APP_KEY_BASE64", pem(64), "App key is not a PEM private key"],
        ["CI_RUNNERS_GITHUB_APP_KEY_BASE64", "not base64 at all!", "App key is not a PEM private key"],
        ["CI_RUNNERS_GITHUB_APP_ID", "unset", "App id is not a number"],
        ["CI_RUNNERS_GITHUB_APP_ID", "", "Credentials/AppId"],
      ];
      for (const [variable, bad, message] of refusals) {
        const error = yield* Effect.flip(credentialsOf({ ...productionCredentialEnv, [variable]: bad }));
        expect(error._tag).toBe("ConfigError");
        expect(error.message, "names the refusal, or for an empty value the schema type it fails on").toContain(
          message
        );
        expect(error.message).toContain(variable);
        if (Str.isNonEmpty(bad)) assertFalse(Str.includes(bad)(error.message));
        assertFalse(Str.includes(` ${bad.length} `)(error.message));
      }
    })
  );
});

const generatedAppKeyBase64 = Effect.promise(() =>
  crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"]
  )
).pipe(
  Effect.flatMap((pair) => Effect.promise(() => crypto.subtle.exportKey("pkcs8", pair.privateKey))),
  Effect.map((der) => {
    const body = A.join(A.map(A.chunksOf(Str.split("")(Base64.encode(new Uint8Array(der))), 64), A.join("")), "\n");
    const label = A.join(["PRIVATE", "KEY"], " ");
    return Base64.encode(`-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`);
  })
);

const credentialsWith = (keyBase64: string) =>
  AppCredentials.make({
    id: Redacted.make("12345"),
    keyBase64: Redacted.make(keyBase64),
    webhookSecret: Redacted.make(fakeWebhookSecret),
  });

describe("CiRunners App key signing check", () => {
  it.effect("passes a key that signs and refuses a well-formed key that cannot, naming neither", () =>
    Effect.gen(function* () {
      const real = yield* generatedAppKeyBase64;
      yield* requireSigningAppKey(credentialsWith(real));
      const env = productionCredentialEnv;
      const refused = yield* requireSigningAppKey(credentialsWith(env.CI_RUNNERS_GITHUB_APP_KEY_BASE64)).pipe(
        Effect.flip
      );
      expect(refused._tag).toBe("ConfigError");
      expect(refused.message).toContain("App key cannot sign a GitHub App JWT");
      assertFalse(Str.includes(env.CI_RUNNERS_GITHUB_APP_KEY_BASE64)(refused.message));
      const garbage = yield* requireSigningAppKey(credentialsWith("not base64 at all!")).pipe(Effect.flip);
      expect(garbage.message).toContain("App key cannot sign a GitHub App JWT");
    })
  );
});
