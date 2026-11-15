import {
  decodeCostControlsConfig,
  NotificationRecipients,
  notificationRecipients,
  personalConfig,
  productionConfig,
  resolveStageConfig,
} from "@beep/infra-cost-controls/Config";
import { requireCiForProduction } from "@beep/infra-cost-controls/Guards";
import { describe, expect, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const withEnvironment = (values: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));
const decodeRecipients = S.decodeUnknownEffect(NotificationRecipients);

describe("CostControlsConfig", () => {
  it.effect("resolves prod to the guarded account and its thresholds, live", () =>
    Effect.gen(function* () {
      const config = yield* resolveStageConfig("prod");
      expect(config.expectedAccountId).toBe("832907639880");
      expect(config.region).toBe("us-east-1");
      expect(config.monthlyBudgetUsd).toBe(200);
      expect(config.anomalyImpactUsd).toBe(10);
      expect(config.notifications).toBe("live");
    })
  );

  it.effect("resolves every other stage silent", () =>
    Effect.gen(function* () {
      const config = yield* resolveStageConfig("dev_alice");
      expect(config.notifications).toBe("silent");
      expect(personalConfig.notifications).toBe("silent");
    })
  );

  const rejected: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["a short account id", { expectedAccountId: "12345" }],
    ["a zero budget", { monthlyBudgetUsd: 0 }],
    ["a negative anomaly threshold", { anomalyImpactUsd: -5 }],
    ["another region", { region: "eu-west-1" }],
    ["an unknown phase", { notifications: "loud" }],
  ];
  it.effect.each(rejected)("rejects %s", ([, override]) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeCostControlsConfig({ ...productionConfig, ...override }));
      expect(error._tag).toBe("SchemaError");
    })
  );
});

describe("NotificationRecipients", () => {
  it.effect("normalizes, trims and splits a comma-separated list", () =>
    Effect.gen(function* () {
      const recipients = yield* decodeRecipients(" Ops@Example.com ,billing@example.com,");
      expect(recipients).toEqual(["ops@example.com", "billing@example.com"]);
    })
  );

  it.effect.each(["", " , ", "ops@example.com,not-an-address"])("rejects %j", (input) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeRecipients(input));
      expect(error._tag).toBe("SchemaError");
    })
  );

  it.effect("reads the environment variable and drops duplicates", () =>
    Effect.gen(function* () {
      const recipients = yield* notificationRecipients.pipe(
        withEnvironment({ COST_CONTROLS_NOTIFICATION_EMAILS: "a@example.com,A@example.com,b@example.com" })
      );
      expect(recipients).toEqual(["a@example.com", "b@example.com"]);
    })
  );
});

describe("requireCiForProduction", () => {
  it.effect("passes a personal stage without CI", () => requireCiForProduction("dev_alice").pipe(withEnvironment({})));

  it.effect("passes prod in CI and fails it outside", () =>
    Effect.gen(function* () {
      yield* requireCiForProduction("prod").pipe(withEnvironment({ CI: "true" }));
      const error = yield* Effect.flip(requireCiForProduction("prod").pipe(withEnvironment({})));
      expect(error._tag).toBe("ConfigError");
    })
  );
});
