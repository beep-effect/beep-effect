/**
 * Docker container health helpers for Graphiti operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Clock, Console, Duration, Effect } from "effect";
import { dual } from "effect/Function";
import { QualityTaskStep } from "../../../internal/process/index.js";
import { GraphitiProxyOpsError } from "../Graphiti.errors.js";
import { checkProxyHealthUrl, collectOptionalOutput } from "./StepExec.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GraphitiRestoreConfig, ProxyEnsureConfig } from "../Graphiti.schemas.js";

/**
 * Check whether a named Docker container exists for Graphiti recovery.
 *
 * @example
 * ```ts
 * import { containerExists } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 *
 * const exists = containerExists("/repo", "graphiti-mcp-falkordb-1")
 * console.log(exists.pipe !== undefined)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const containerExists: {
  (repoRoot: string, container: string): Effect.Effect<boolean, never, ChildProcessSpawner.ChildProcessSpawner>;
  (container: string): (repoRoot: string) => Effect.Effect<boolean, never, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("GraphitiProxyOps.containerExists")(function* (
    repoRoot: string,
    container: string
  ): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
    const result = yield* collectOptionalOutput(
      QualityTaskStep.make({
        label: "graphiti-recover:docker-inspect",
        command: "docker",
        args: ["inspect", container],
        cwd: repoRoot,
      })
    );
    return result.exitCode === 0;
  })
);

/**
 * Read Docker health text for a named Graphiti container.
 *
 * @example
 * ```ts
 * import { containerHealth } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 *
 * const health = containerHealth("/repo", "graphiti-mcp-graphiti-mcp-1")
 * console.log(health.pipe !== undefined)
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const containerHealth: {
  (repoRoot: string, container: string): Effect.Effect<string, never, ChildProcessSpawner.ChildProcessSpawner>;
  (container: string): (repoRoot: string) => Effect.Effect<string, never, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("GraphitiProxyOps.containerHealth")(function* (
    repoRoot: string,
    container: string
  ): Effect.fn.Return<string, never, ChildProcessSpawner.ChildProcessSpawner> {
    const result = yield* collectOptionalOutput(
      QualityTaskStep.make({
        label: "graphiti-recover:container-health",
        command: "docker",
        args: ["inspect", "--format", "{{.State.Health.Status}}", container],
        cwd: repoRoot,
      })
    );
    return result.exitCode === 0 && Str.isNonEmpty(result.output) ? result.output : "unknown";
  })
);

/**
 * Wait for the two backing containers used by proxy recovery to become healthy.
 *
 * @example
 * ```ts
 * import { waitForHealthyContainers } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 * import { proxyEnsureConfig } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return yield* waitForHealthyContainers("/repo", proxyEnsureConfig(path))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const waitForHealthyContainers: {
  (
    repoRoot: string,
    config: ProxyEnsureConfig
  ): Effect.Effect<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner>;
  (
    config: ProxyEnsureConfig
  ): (repoRoot: string) => Effect.Effect<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("GraphitiProxyOps.waitForHealthyContainers")(function* (
    repoRoot: string,
    config: ProxyEnsureConfig
  ): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
    const start = yield* Clock.currentTimeMillis;
    const deadline = start + config.waitSeconds * 1000;

    while ((yield* Clock.currentTimeMillis) <= deadline) {
      const falkor = yield* containerHealth(repoRoot, config.falkorContainer);
      const graphiti = yield* containerHealth(repoRoot, config.graphitiContainer);
      yield* Console.log(`[graphiti-recover] health falkor=${falkor} graphiti=${graphiti}`);

      if (falkor === "healthy" && graphiti === "healthy") {
        return;
      }

      yield* Effect.sleep(Duration.seconds(5));
    }

    return yield* GraphitiProxyOpsError.make({
      message: "Timed out waiting for Graphiti backing containers to become healthy.",
      exitCode: 1,
    });
  })
);

/**
 * Render Graphiti restore container health states as `name=status` entries.
 *
 * @example
 * ```ts
 * import { restoreContainerHealthStates } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(restoreContainerHealthStates)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const restoreContainerHealthStates = Effect.fn("GraphitiProxyOps.restoreContainerHealthStates")(function* (
  repoRoot: string,
  config: GraphitiRestoreConfig
): Effect.fn.Return<ReadonlyArray<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const containers = [config.falkorContainer, config.browserContainer, config.graphitiContainer];
  return yield* Effect.forEach(
    containers,
    (container) => containerHealth(repoRoot, container).pipe(Effect.map((health) => `${container}=${health}`)),
    { concurrency: "unbounded" }
  );
});

/**
 * Wait for all Graphiti restore containers to become healthy.
 *
 * @example
 * ```ts
 * import { waitForRestoreContainers } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(waitForRestoreContainers)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const waitForRestoreContainers = Effect.fn("GraphitiProxyOps.waitForRestoreContainers")(function* (
  repoRoot: string,
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const start = yield* Clock.currentTimeMillis;
  const deadline = start + config.waitSeconds * 1000;

  while ((yield* Clock.currentTimeMillis) <= deadline) {
    const states = yield* restoreContainerHealthStates(repoRoot, config);
    yield* Console.log(`[graphiti-restore] health ${A.join(states, " ")}`);

    if (A.every(states, Str.includes("=healthy"))) {
      return;
    }

    yield* Effect.sleep(Duration.seconds(5));
  }

  return yield* GraphitiProxyOpsError.make({
    message: "Timed out waiting for Graphiti restore containers to become healthy.",
    exitCode: 1,
  });
});

/**
 * Assert that all Graphiti restore containers are currently healthy.
 *
 * @example
 * ```ts
 * import { requireRestoreContainersHealthy } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(requireRestoreContainersHealthy)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category assertions
 * @since 0.0.0
 */
export const requireRestoreContainersHealthy = Effect.fn("GraphitiProxyOps.requireRestoreContainersHealthy")(function* (
  repoRoot: string,
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const states = yield* restoreContainerHealthStates(repoRoot, config);
  yield* Console.log(`[graphiti-verify] health ${A.join(states, " ")}`);

  if (A.every(states, Str.includes("=healthy"))) {
    return;
  }

  return yield* GraphitiProxyOpsError.make({
    message: `Graphiti restore containers are not healthy: ${A.join(states, " ")}.`,
    exitCode: 1,
  });
});

/**
 * Wait for the Graphiti proxy health endpoint after service installation.
 *
 * @example
 * ```ts
 * import { waitForRestoreProxyHealthy } from "@beep/repo-cli/commands/Graphiti/internal/ContainerHealth"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(waitForRestoreProxyHealthy)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const waitForRestoreProxyHealthy = Effect.fn("GraphitiProxyOps.waitForRestoreProxyHealthy")(function* (
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const start = yield* Clock.currentTimeMillis;
  const deadline = start + config.waitSeconds * 1000;

  while ((yield* Clock.currentTimeMillis) <= deadline) {
    const healthy = yield* checkProxyHealthUrl(config.proxyHealthUrl);
    if (healthy) {
      yield* Console.log(`[graphiti-restore] Proxy service is healthy at ${config.proxyHealthUrl}.`);
      return;
    }

    yield* Effect.sleep(Duration.seconds(1));
  }

  return yield* GraphitiProxyOpsError.make({
    message: `Timed out waiting for Graphiti proxy service to become healthy at ${config.proxyHealthUrl}.`,
    exitCode: 1,
  });
});
