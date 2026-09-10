import {
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
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Layer } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownWorkItemConfigValueSync = S.decodeUnknownSync(WorkItemConfigValue);
const decodeUnknownWorkItemPublicConfigSync = S.decodeUnknownSync(WorkItemPublicConfig);
const decodeUnknownWorkItemSecretConfigSync = S.decodeUnknownSync(WorkItemSecretConfig);
const decodeUnknownWorkItemServerConfigSync = S.decodeUnknownSync(WorkItemServerConfig);
const encodeWorkItemConfigValueSync = S.encodeSync(WorkItemConfigValue);
const encodeWorkItemPublicConfigSync = S.encodeSync(WorkItemPublicConfig);
const encodeWorkItemSecretConfigSync = S.encodeSync(WorkItemSecretConfig);
const encodeWorkItemServerConfigSync = S.encodeSync(WorkItemServerConfig);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("WorkItem configuration", () => {
  it.effect(
    "provides client-safe and server configuration",
    Effect.fnUntraced(function* () {
      const config = yield* WorkItemConfig;
      expect(config.publicConfig.assignmentEnabled).toBe(true);
      expect(config.serverConfig.migrationSchemaName).toBe("architecture_lab");
    }, provideScopedLayer(ArchitectureLabConfigTest))
  );

  it("keeps default encoded configuration shape byte-identical", () => {
    expect(encodeWorkItemPublicConfigSync(defaultWorkItemPublicConfig)).toEqual({
      assignmentEnabled: true,
      reopenCompletedEnabled: true,
    });
    expect(encodeWorkItemServerConfigSync(defaultWorkItemServerConfig)).toEqual({
      migrationSchemaName: "architecture_lab",
      repositoryName: "architecture-lab-work-items",
    });
    expect(encodeWorkItemSecretConfigSync(defaultWorkItemSecretConfig)).toEqual({
      connectionName: "architecture-lab-proof",
    });
    expect(encodeWorkItemConfigValueSync(testWorkItemConfig)).toEqual({
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
  });

  it("round-trips schema-derived WorkItem config values", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.schema(WorkItemPublicConfig),
            Arbitrary.schema(WorkItemServerConfig),
            Arbitrary.schema(WorkItemSecretConfig),
            Arbitrary.schema(WorkItemConfigValue),
          ]),
          ([publicConfig, serverConfig, secretConfig, configValue]) => {
            const result =
              Equal.equals(
                decodeUnknownWorkItemPublicConfigSync(encodeWorkItemPublicConfigSync(publicConfig)),
                publicConfig
              ) &&
              Equal.equals(
                decodeUnknownWorkItemServerConfigSync(encodeWorkItemServerConfigSync(serverConfig)),
                serverConfig
              ) &&
              Equal.equals(
                decodeUnknownWorkItemSecretConfigSync(encodeWorkItemSecretConfigSync(secretConfig)),
                secretConfig
              ) &&
              Equal.equals(
                decodeUnknownWorkItemConfigValueSync(encodeWorkItemConfigValueSync(configValue)),
                configValue
              );
            return result;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });
});
