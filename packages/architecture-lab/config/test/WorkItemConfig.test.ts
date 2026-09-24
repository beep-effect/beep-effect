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

const decodeUnknownWorkItemConfigValue = S.decodeUnknownEffect(WorkItemConfigValue);
const decodeUnknownWorkItemPublicConfig = S.decodeUnknownEffect(WorkItemPublicConfig);
const decodeUnknownWorkItemSecretConfig = S.decodeUnknownEffect(WorkItemSecretConfig);
const decodeUnknownWorkItemServerConfig = S.decodeUnknownEffect(WorkItemServerConfig);
const encodeWorkItemConfigValue = S.encodeEffect(WorkItemConfigValue);
const encodeWorkItemPublicConfig = S.encodeEffect(WorkItemPublicConfig);
const encodeWorkItemSecretConfig = S.encodeEffect(WorkItemSecretConfig);
const encodeWorkItemServerConfig = S.encodeEffect(WorkItemServerConfig);

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

  it.effect(
    "keeps default encoded configuration shape byte-identical",
    Effect.fnUntraced(function* () {
      expect(yield* encodeWorkItemPublicConfig(defaultWorkItemPublicConfig)).toEqual({
        assignmentEnabled: true,
        reopenCompletedEnabled: true,
      });
      expect(yield* encodeWorkItemServerConfig(defaultWorkItemServerConfig)).toEqual({
        migrationSchemaName: "architecture_lab",
        repositoryName: "architecture-lab-work-items",
      });
      expect(yield* encodeWorkItemSecretConfig(defaultWorkItemSecretConfig)).toEqual({
        connectionName: "architecture-lab-proof",
      });
      expect(yield* encodeWorkItemConfigValue(testWorkItemConfig)).toEqual({
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
      expect(
        Equal.equals(
          yield* decodeUnknownWorkItemPublicConfig(yield* encodeWorkItemPublicConfig(publicConfig)),
          publicConfig
        )
      ).toBe(true);
      expect(
        Equal.equals(
          yield* decodeUnknownWorkItemServerConfig(yield* encodeWorkItemServerConfig(serverConfig)),
          serverConfig
        )
      ).toBe(true);
      expect(
        Equal.equals(
          yield* decodeUnknownWorkItemSecretConfig(yield* encodeWorkItemSecretConfig(secretConfig)),
          secretConfig
        )
      ).toBe(true);
      expect(
        Equal.equals(
          yield* decodeUnknownWorkItemConfigValue(yield* encodeWorkItemConfigValue(configValue)),
          configValue
        )
      ).toBe(true);
    }),
    { arbitrary: fcRuns(25) }
  );
});
