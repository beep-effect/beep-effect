/**
 * Graphiti proxy ensure and recovery workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import { Clock, Console, Duration, Effect, FileSystem, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { QualityTaskStep } from "../../../internal/process/index.js";
import { proxyEnsureConfig } from "../Graphiti.config.js";
import { GraphitiProxyOpsError } from "../Graphiti.errors.js";
import { containerExists, containerHealth, waitForHealthyContainers } from "./ContainerHealth.js";
import { checkProxyHealth, dockerAvailable, runInheritedStep, shellQuote } from "./StepExec.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GraphitiProxyOpsEnvironment, ProxyEnsureConfig } from "../Graphiti.schemas.js";

const recoverGraphitiStackInternal = Effect.fn("GraphitiProxyOps.recoverGraphitiStackInternal")(function* (
  repoRoot: string,
  config: ProxyEnsureConfig,
  force: boolean,
  dryRun: boolean
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  if (dryRun) {
    yield* Console.log("[graphiti-recover] Dry-run mode enabled; no containers or MCP services will be mutated.");
    yield* Console.log(
      `[graphiti-recover] Planned restart targets: ${config.falkorContainer}, ${config.graphitiContainer}`
    );
    yield* Console.log(`[graphiti-recover] Planned MCP endpoint: ${config.recoveryMcpUrl}`);
    yield* Console.log(`[graphiti-recover] Planned verify group: ${config.recoveryVerifyGroup}`);
    return;
  }

  if (!force && !config.recoverOnUnhealthy) {
    yield* Console.log("[graphiti-recover] Recovery disabled by GRAPHITI_PROXY_RECOVER_ON_UNHEALTHY.");
    return;
  }

  if (!(yield* dockerAvailable(repoRoot))) {
    yield* Console.log("[graphiti-recover] docker is unavailable; skipping backing stack recovery.");
    return;
  }

  const falkorExists = yield* containerExists(repoRoot, config.falkorContainer);
  const graphitiExists = yield* containerExists(repoRoot, config.graphitiContainer);
  if (!falkorExists || !graphitiExists) {
    yield* Console.log("[graphiti-recover] Graphiti backing containers were not found; skipping recovery.");
    return;
  }

  const falkor = yield* containerHealth(repoRoot, config.falkorContainer);
  const graphiti = yield* containerHealth(repoRoot, config.graphitiContainer);
  if (
    !shouldRecoverGraphitiStackForTesting({
      falkor,
      force,
      graphiti,
      recoverOnUnhealthy: config.recoverOnUnhealthy,
    })
  ) {
    yield* Console.log("[graphiti-recover] Backing containers are already healthy.");
    return;
  }

  yield* Console.log(`[graphiti-recover] Restarting ${config.falkorContainer} and ${config.graphitiContainer}.`);
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "graphiti-recover:docker-restart",
      command: "docker",
      args: ["restart", config.falkorContainer, config.graphitiContainer],
      cwd: repoRoot,
    })
  );
  yield* waitForHealthyContainers(repoRoot, config);
});

const readLivePid = Effect.fn("GraphitiProxyOps.readLivePid")(function* (
  config: ProxyEnsureConfig
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(config.pidFile).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return O.none<string>();
  }

  const pid = yield* fs.readFileString(config.pidFile).pipe(Effect.orElseSucceed(thunkEmptyStr), Effect.map(Str.trim));
  if (Str.isEmpty(pid)) {
    yield* fs.remove(config.pidFile).pipe(Effect.ignore);
    return O.none<string>();
  }

  const alive = yield* Effect.sync(() => {
    try {
      process.kill(Number(pid), 0);
      return true;
    } catch {
      return false;
    }
  });
  if (!alive) {
    yield* fs.remove(config.pidFile).pipe(Effect.ignore);
    return O.none<string>();
  }

  return O.some(pid);
});

const startProxyDetached: {
  (
    repoRoot: string,
    config: ProxyEnsureConfig
  ): Effect.Effect<
    void,
    GraphitiProxyOpsError,
    ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
  >;
  (
    config: ProxyEnsureConfig
  ): (
    repoRoot: string
  ) => Effect.Effect<
    void,
    GraphitiProxyOpsError,
    ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
  >;
} = dual(
  2,
  Effect.fn("GraphitiProxyOps.startProxyDetached")(function* (
    repoRoot: string,
    config: ProxyEnsureConfig
  ): Effect.fn.Return<
    void,
    GraphitiProxyOpsError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs
      .makeDirectory(config.stateDir, { recursive: true })
      .pipe(GraphitiProxyOpsError.mapError(`Failed to create ${config.stateDir}.`));
    yield* fs.makeDirectory(path.dirname(config.pidFile), { recursive: true }).pipe(Effect.ignore);

    yield* Console.log(
      `[graphiti-proxy:ensure] Starting proxy via 'bun run beep graphiti proxy' (log: ${config.logFile}).`
    );
    const launchScript = A.join(
      [
        `mkdir -p ${shellQuote(config.stateDir)} ${shellQuote(path.dirname(config.pidFile))}`,
        "if command -v setsid >/dev/null 2>&1; then",
        `  setsid bun run beep graphiti proxy >> ${shellQuote(config.logFile)} 2>&1 < /dev/null &`,
        "else",
        `  nohup bun run beep graphiti proxy >> ${shellQuote(config.logFile)} 2>&1 < /dev/null &`,
        "fi",
        `echo "$!" > ${shellQuote(config.pidFile)}`,
      ],
      "\n"
    );

    yield* runInheritedStep(
      QualityTaskStep.make({
        label: "graphiti-proxy:start-detached",
        command: "sh",
        args: ["-c", launchScript],
        cwd: repoRoot,
      })
    );
  })
);

const tailLog = Effect.fn("GraphitiProxyOps.tailLog")(function* (
  config: ProxyEnsureConfig
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(config.logFile).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return;
  }

  const text = yield* fs.readFileString(config.logFile).pipe(Effect.orElseSucceed(thunkEmptyStr));
  const tail = pipe(Str.split(text, "\n"), A.takeRight(40), A.join("\n"));
  if (Str.isNonEmpty(tail)) {
    yield* Console.error("[graphiti-proxy:ensure] Recent proxy log tail:");
    yield* Console.error(tail);
  }
});

/**
 * Ensure the local Graphiti proxy is healthy, starting it in the background when needed.
 *
 * @returns Effect that exits successfully once the health endpoint responds.
 * @example
 * ```ts
 * import { ensureGraphitiProxy } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const program = ensureGraphitiProxy()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const ensureGraphitiProxy = Effect.fn("GraphitiProxyOps.ensureGraphitiProxy")(function* (): Effect.fn.Return<
  void,
  GraphitiProxyOpsError,
  GraphitiProxyOpsEnvironment
> {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot().pipe(GraphitiProxyOpsError.mapError("Failed to locate repository root."));
  const config = proxyEnsureConfig(path);
  const start = yield* Clock.currentTimeMillis;
  const deadline = start + config.timeoutSeconds * 1000;

  yield* fs
    .makeDirectory(config.stateDir, { recursive: true })
    .pipe(GraphitiProxyOpsError.mapError(`Failed to create ${config.stateDir}.`));
  yield* fs.makeDirectory(path.dirname(config.pidFile), { recursive: true }).pipe(Effect.ignore);

  yield* recoverGraphitiStackInternal(repoRoot, config, false, false).pipe(
    Effect.catchTag("GraphitiProxyOpsError", (error) =>
      Console.error(`[graphiti-proxy:ensure] ${error.message}; continuing ensure loop.`)
    )
  );

  while ((yield* Clock.currentTimeMillis) <= deadline) {
    const healthy = yield* checkProxyHealth(config);
    if (healthy) {
      const trackedPid = yield* readLivePid(config);
      const pidSuffix = O.isSome(trackedPid) ? ` (pid ${trackedPid.value})` : "";
      yield* Console.log(`[graphiti-proxy:ensure] Proxy is healthy at ${config.healthUrl}${pidSuffix}.`);
      return;
    }

    const livePid = yield* readLivePid(config);
    if (O.isNone(livePid)) {
      yield* startProxyDetached(repoRoot, config);
    }

    yield* Effect.sleep(Duration.seconds(1));
  }

  yield* Console.error(`[graphiti-proxy:ensure] Proxy did not become healthy within ${config.timeoutSeconds}s.`);
  yield* tailLog(config);
  return yield* GraphitiProxyOpsError.make({
    message: `Graphiti proxy is not healthy at ${config.healthUrl}.`,
    exitCode: 1,
  });
});

/**
 * Recover the local Graphiti backing stack by restarting unhealthy containers.
 *
 * @param options - Recovery execution options.
 * @returns Effect that restarts unhealthy Graphiti backing containers.
 * @example
 * ```ts
 * import { recoverGraphitiStack } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const program = recoverGraphitiStack({ dryRun: true })
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const recoverGraphitiStack = Effect.fn("GraphitiProxyOps.recoverGraphitiStack")(function* (options?: {
  readonly dryRun?: boolean;
  readonly force?: boolean;
}): Effect.fn.Return<void, GraphitiProxyOpsError, GraphitiProxyOpsEnvironment> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(GraphitiProxyOpsError.mapError("Failed to locate repository root."));
  const config = proxyEnsureConfig(path);
  yield* recoverGraphitiStackInternal(repoRoot, config, options?.force ?? false, options?.dryRun ?? false);
});

/**
 * Decide whether Graphiti recovery should restart the backing containers.
 *
 * @internal
 * @param options - Recovery decision inputs.
 * @returns Whether the recovery routine should restart the backing containers.
 * @example
 * ```ts
 * import { shouldRecoverGraphitiStackForTesting } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const shouldRecover = shouldRecoverGraphitiStackForTesting({
 *   falkor: "unhealthy",
 *   force: false,
 *   graphiti: "healthy",
 *   recoverOnUnhealthy: true
 * })
 * ```
 * @category testing
 * @since 0.0.0
 */
export const shouldRecoverGraphitiStackForTesting = (options: {
  readonly recoverOnUnhealthy: boolean;
  readonly force: boolean;
  readonly falkor: string;
  readonly graphiti: string;
}): boolean =>
  options.force || (options.recoverOnUnhealthy && (options.falkor !== "healthy" || options.graphiti !== "healthy"));
