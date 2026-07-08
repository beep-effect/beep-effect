/**
 * Dependency health implementation for the Graphiti proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Clock, Effect, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  DependencyHealthDetails,
  DependencyHealthSnapshot,
  decodeContainerHealthState,
  unknownContainerHealthState,
} from "./ProxySchemas.js";
import { GraphitiDependencyHealthService } from "./ProxyServices.js";
import type * as S from "effect/Schema";
import type { GraphitiProxyConfig } from "./ProxyConfig.js";
import type { ContainerHealthState } from "./ProxySchemas.js";

const unknownDependencySnapshot = () =>
  DependencyHealthSnapshot.make({
    status: "unknown",
    details: DependencyHealthDetails.make({
      falkor: "unknown",
      graphiti: "unknown",
    }),
  });

const parseContainerHealth = (value: string): S.Schema.Type<typeof ContainerHealthState> =>
  pipe(
    decodeContainerHealthState(pipe(value, Str.trim, Str.toLowerCase)),
    O.getOrElse(() => unknownContainerHealthState)
  );

const readContainerHealth: (
  dependencyHealthEnabled: boolean,
  containerName: string
) => Effect.Effect<S.Schema.Type<typeof ContainerHealthState>> = Effect.fnUntraced(
  function* (dependencyHealthEnabled, containerName) {
    if (!dependencyHealthEnabled) {
      return "unknown";
    }

    const result = yield* Effect.sync(() =>
      Bun.spawnSync({
        cmd: ["docker", "inspect", "--format", "{{.State.Health.Status}}", containerName],
        stdout: "pipe",
        stderr: "pipe",
      })
    );

    if (!result.success) {
      return "unknown";
    }

    const value = new TextDecoder("utf-8").decode(result.stdout);
    return parseContainerHealth(value);
  }
);

/**
 * Construct dependency health service implementation.
 *
 * @param config - Runtime graphiti proxy config.
 * @returns Effect producing dependency health service.
 * @example
 * ```ts
 * console.log("makeGraphitiDependencyHealthService")
 * ```
 * @category models
 * @since 0.0.0
 */
export const makeGraphitiDependencyHealthService: (
  config: GraphitiProxyConfig
) => Effect.Effect<GraphitiDependencyHealthService["Service"]> = Effect.fn(
  "GraphitiProxyServices.makeGraphitiDependencyHealthService"
)(function* (config) {
  const cacheRef = yield* Ref.make({
    checkedAtMs: 0,
    snapshot: unknownDependencySnapshot(),
  });

  const snapshot = Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis;
    const cache = yield* Ref.get(cacheRef);

    if (nowMs - cache.checkedAtMs < config.dependencyHealthTtlMs) {
      return cache.snapshot;
    }

    const falkor = yield* readContainerHealth(config.dependencyHealthEnabled, config.falkorContainer);
    const graphiti = yield* readContainerHealth(config.dependencyHealthEnabled, config.graphitiContainer);

    const status =
      config.dependencyHealthEnabled && (falkor !== "healthy" || graphiti !== "healthy") ? "degraded" : "ok";

    const nextSnapshot = DependencyHealthSnapshot.make({
      status,
      details: DependencyHealthDetails.make({
        falkor,
        graphiti,
      }),
    });

    yield* Ref.set(cacheRef, {
      checkedAtMs: nowMs,
      snapshot: nextSnapshot,
    });

    return nextSnapshot;
  });

  return GraphitiDependencyHealthService.of({
    snapshot,
  });
});
