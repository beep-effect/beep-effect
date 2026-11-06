import {
  ArchitectureLabConfigLive,
  ArchitectureLabConfigTest,
  defaultWorkItemPublicConfig,
  defaultWorkItemSecretConfig,
  defaultWorkItemServerConfig,
  testWorkItemConfig,
  WorkItemConfig,
  WorkItemConfigValue,
  WorkItemPublicConfig,
  WorkItemSecretConfig,
  WorkItemServerConfig,
} from "@beep/architecture-lab-config/aggregates/WorkItem";
import { ArchitectureLabConfigLive as LayerBoundaryLive } from "@beep/architecture-lab-config/layer";
import {
  WorkItemPublicConfig as PublicBoundaryConfig,
  defaultWorkItemPublicConfig as publicBoundaryDefault,
} from "@beep/architecture-lab-config/public";
import {
  WorkItemSecretConfig as SecretBoundaryConfig,
  defaultWorkItemSecretConfig as secretBoundaryDefault,
} from "@beep/architecture-lab-config/secrets";
import {
  WorkItemServerConfig as ServerBoundaryConfig,
  defaultWorkItemServerConfig as serverBoundaryDefault,
} from "@beep/architecture-lab-config/server";
import { ArchitectureLabConfigTest as TestBoundary } from "@beep/architecture-lab-config/test";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

const decodeUnknownWorkItemConfigValue = S.decodeUnknownEffect(WorkItemConfigValue);
const decodeUnknownWorkItemPublicConfig = S.decodeUnknownEffect(WorkItemPublicConfig);
const decodeUnknownWorkItemSecretConfig = S.decodeUnknownEffect(WorkItemSecretConfig);
const decodeUnknownWorkItemServerConfig = S.decodeUnknownEffect(WorkItemServerConfig);
const encodeWorkItemConfigValue = S.encodeEffect(WorkItemConfigValue);
const encodeWorkItemPublicConfig = S.encodeEffect(WorkItemPublicConfig);
const encodeWorkItemSecretConfig = S.encodeEffect(WorkItemSecretConfig);
const encodeWorkItemServerConfig = S.encodeEffect(WorkItemServerConfig);

const liveConfigFrom = (env: Readonly<Record<string, string>>) =>
  ArchitectureLabConfigLive.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))));

describe("WorkItem configuration boundaries", () => {
  it("re-exports the same config contracts from each visibility entry", () => {
    expect(PublicBoundaryConfig).toBe(WorkItemPublicConfig);
    expect(publicBoundaryDefault).toBe(defaultWorkItemPublicConfig);
    expect(SecretBoundaryConfig).toBe(WorkItemSecretConfig);
    expect(secretBoundaryDefault).toBe(defaultWorkItemSecretConfig);
    expect(ServerBoundaryConfig).toBe(WorkItemServerConfig);
    expect(serverBoundaryDefault).toBe(defaultWorkItemServerConfig);
    expect(LayerBoundaryLive).toBe(ArchitectureLabConfigLive);
    expect(TestBoundary).toBe(ArchitectureLabConfigTest);
  });

  it.layer(
    liveConfigFrom({
      ARCHITECTURE_LAB_WORK_ITEM_ASSIGNMENT_ENABLED: "false",
      ARCHITECTURE_LAB_WORK_ITEM_REOPEN_COMPLETED_ENABLED: "false",
      ARCHITECTURE_LAB_WORK_ITEM_REPOSITORY_NAME: "custom-work-items",
      ARCHITECTURE_LAB_WORK_ITEM_MIGRATION_SCHEMA_NAME: "custom_schema",
      ARCHITECTURE_LAB_WORK_ITEM_CONNECTION_NAME: "custom-proof",
    }),
    { timeout: "10 seconds" }
  )("live config with provider overrides", (it) => {
    it.effect(
      "reads every override from the config provider",
      Effect.fnUntraced(function* () {
        const config = yield* WorkItemConfig;

        expect(config.publicConfig.assignmentEnabled).toBe(false);
        expect(config.publicConfig.reopenCompletedEnabled).toBe(false);
        expect(config.serverConfig.repositoryName).toBe("custom-work-items");
        expect(config.serverConfig.migrationSchemaName).toBe("custom_schema");
        expect(config.secretConfig.connectionName).toBe("custom-proof");
      })
    );
  });

  it.layer(liveConfigFrom({}), { timeout: "10 seconds" })("live config without overrides", (it) => {
    it.effect(
      "falls back to the schema defaults",
      Effect.fnUntraced(function* () {
        const config = yield* WorkItemConfig;

        expect(Equal.equals(config, testWorkItemConfig)).toBe(true);
        expect(config.serverConfig.repositoryName).toBe(defaultWorkItemServerConfig.repositoryName);
        expect(config.secretConfig.connectionName).toBe(defaultWorkItemSecretConfig.connectionName);
      })
    );
  });
});

describe("WorkItem configuration", () => {
  it.layer(ArchitectureLabConfigTest)((it) => {
    it.effect(
      "provides client-safe and server configuration",
      Effect.fnUntraced(function* () {
        const config = yield* WorkItemConfig;
        expect(config.publicConfig.assignmentEnabled).toBe(true);
        expect(config.serverConfig.migrationSchemaName).toBe("architecture_lab");
      })
    );
  });

  it.effect(
    "keeps default encoded configuration shape byte-identical",
    Effect.fnUntraced(function* () {
      const encodedWorkItemPublicConfig = yield* encodeWorkItemPublicConfig(defaultWorkItemPublicConfig);
      expect(encodedWorkItemPublicConfig).toEqual({
        assignmentEnabled: true,
        reopenCompletedEnabled: true,
      });
      const encodedWorkItemServerConfig = yield* encodeWorkItemServerConfig(defaultWorkItemServerConfig);
      expect(encodedWorkItemServerConfig).toEqual({
        migrationSchemaName: "architecture_lab",
        repositoryName: "architecture-lab-work-items",
      });
      const encodedWorkItemSecretConfig = yield* encodeWorkItemSecretConfig(defaultWorkItemSecretConfig);
      expect(encodedWorkItemSecretConfig).toEqual({
        connectionName: "architecture-lab-proof",
      });
      const encodedWorkItemConfigValue = yield* encodeWorkItemConfigValue(testWorkItemConfig);
      expect(encodedWorkItemConfigValue).toEqual({
        publicConfig: {
          assignmentEnabled: true,
          reopenCompletedEnabled: true,
        },
        secretConfig: {
          connectionName: "architecture-lab-proof",
        },
        serverConfig: {
          migrationSchemaName: "architecture_lab",
          repositoryName: "architecture-lab-work-items",
        },
      });
    })
  );

  it.effect.prop(
    "round-trips schema-derived WorkItem config values",
    [
      Arbitrary.schema(WorkItemPublicConfig),
      Arbitrary.schema(WorkItemServerConfig),
      Arbitrary.schema(WorkItemSecretConfig),
      Arbitrary.schema(WorkItemConfigValue),
    ],
    Effect.fnUntraced(function* ([publicConfig, serverConfig, secretConfig, configValue]) {
      const encodedWorkItemPublicConfig1 = yield* encodeWorkItemPublicConfig(publicConfig);
      const decodedUnknownWorkItemPublicConfig = yield* decodeUnknownWorkItemPublicConfig(encodedWorkItemPublicConfig1);
      expect(Equal.equals(decodedUnknownWorkItemPublicConfig, publicConfig)).toBe(true);
      const encodedWorkItemServerConfig2 = yield* encodeWorkItemServerConfig(serverConfig);
      const decodedUnknownWorkItemServerConfig = yield* decodeUnknownWorkItemServerConfig(encodedWorkItemServerConfig2);
      expect(Equal.equals(decodedUnknownWorkItemServerConfig, serverConfig)).toBe(true);
      const encodedWorkItemSecretConfig3 = yield* encodeWorkItemSecretConfig(secretConfig);
      const decodedUnknownWorkItemSecretConfig = yield* decodeUnknownWorkItemSecretConfig(encodedWorkItemSecretConfig3);
      expect(Equal.equals(decodedUnknownWorkItemSecretConfig, secretConfig)).toBe(true);
      const encodedWorkItemConfigValue4 = yield* encodeWorkItemConfigValue(configValue);
      const decodedUnknownWorkItemConfigValue = yield* decodeUnknownWorkItemConfigValue(encodedWorkItemConfigValue4);
      expect(Equal.equals(decodedUnknownWorkItemConfigValue, configValue)).toBe(true);
    }),
    { arbitrary: fcRuns(25) }
  );
});
