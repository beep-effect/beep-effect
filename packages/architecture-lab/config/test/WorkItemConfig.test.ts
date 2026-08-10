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
import { FastCheck as fc } from "effect/testing";

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
    expect(S.encodeSync(WorkItemPublicConfig)(defaultWorkItemPublicConfig)).toEqual({
      assignmentEnabled: true,
      reopenCompletedEnabled: true,
    });
    expect(S.encodeSync(WorkItemServerConfig)(defaultWorkItemServerConfig)).toEqual({
      migrationSchemaName: "architecture_lab",
      repositoryName: "architecture-lab-work-items",
    });
    expect(S.encodeSync(WorkItemSecretConfig)(defaultWorkItemSecretConfig)).toEqual({
      connectionName: "architecture-lab-proof",
    });
    expect(S.encodeSync(WorkItemConfigValue)(testWorkItemConfig)).toEqual({
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
    const encodePublicConfig = S.encodeSync(WorkItemPublicConfig);
    const decodePublicConfig = S.decodeUnknownSync(WorkItemPublicConfig);
    const encodeServerConfig = S.encodeSync(WorkItemServerConfig);
    const decodeServerConfig = S.decodeUnknownSync(WorkItemServerConfig);
    const encodeSecretConfig = S.encodeSync(WorkItemSecretConfig);
    const decodeSecretConfig = S.decodeUnknownSync(WorkItemSecretConfig);
    const encodeConfigValue = S.encodeSync(WorkItemConfigValue);
    const decodeConfigValue = S.decodeUnknownSync(WorkItemConfigValue);

    fc.assert(
      fc.property(
        S.toArbitrary(WorkItemPublicConfig)(fc),
        S.toArbitrary(WorkItemServerConfig)(fc),
        S.toArbitrary(WorkItemSecretConfig)(fc),
        S.toArbitrary(WorkItemConfigValue)(fc),
        (publicConfig, serverConfig, secretConfig, configValue) =>
          Equal.equals(decodePublicConfig(encodePublicConfig(publicConfig)), publicConfig) &&
          Equal.equals(decodeServerConfig(encodeServerConfig(serverConfig)), serverConfig) &&
          Equal.equals(decodeSecretConfig(encodeSecretConfig(secretConfig)), secretConfig) &&
          Equal.equals(decodeConfigValue(encodeConfigValue(configValue)), configValue)
      ),
      fcRuns(25)
    );
  });
});
