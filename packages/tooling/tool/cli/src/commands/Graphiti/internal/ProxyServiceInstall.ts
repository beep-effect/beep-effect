/**
 * User-level systemd service installation for the Graphiti proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot, guardLiteralArg } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { QualityTaskStep } from "../../../internal/process/index.ts";
import { homeDirectory, proxyServiceConfig } from "../Graphiti.config.ts";
import { GraphitiProxyOpsError } from "../Graphiti.errors.ts";
import { GraphitiProxyServiceInstallOptions, UpstreamMcpUrl } from "../Graphiti.schemas.ts";
import { collectOptionalOutput, collectSuccessfulOutput, runInheritedStep } from "./StepExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GraphitiProxyOpsEnvironment, GraphitiRestoreConfig, ProxyServiceConfig } from "../Graphiti.schemas.ts";

/**
 * Decide whether the live proxy systemd unit should be reinstalled.
 *
 * @param options - Current unit text and expected service invariants.
 * @returns Whether the service unit has drifted.
 * @example
 * ```ts
 * import { shouldInstallProxyServiceForTesting } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * console.log(shouldInstallProxyServiceForTesting({
 *   repoRoot: "/repo",
 *   unitText: "",
 *   upstream: "http://127.0.0.1:8000/mcp"
 * }))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const shouldInstallProxyServiceForTesting = (options: {
  readonly repoRoot: string;
  readonly unitText: string;
  readonly upstream: string;
}): boolean => {
  const unitLines = pipe(Str.split(options.unitText, "\n"), A.map(Str.trim));
  return (
    Str.isEmpty(options.unitText) ||
    !A.contains(unitLines, `WorkingDirectory=${options.repoRoot}`) ||
    !Str.includes("run beep graphiti proxy")(options.unitText) ||
    !A.contains(unitLines, "Environment=GRAPHITI_PROXY_HOST=127.0.0.1") ||
    !A.contains(unitLines, "Environment=GRAPHITI_PROXY_PORT=8123") ||
    !A.contains(unitLines, `Environment=GRAPHITI_PROXY_UPSTREAM=${options.upstream}`)
  );
};

/**
 * Read the currently installed user service unit text.
 *
 * @example
 * ```ts
 * import { readProxyServiceUnit } from "@beep/repo-cli/commands/Graphiti/internal/ProxyServiceInstall"
 * import { Effect } from "effect"
 *
 * // Provide ChildProcessSpawner to run the effect.
 * const program = readProxyServiceUnit("/repo", "beep-graphiti-proxy")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const readProxyServiceUnit = Effect.fn("GraphitiProxyOps.readProxyServiceUnit")(function* (
  repoRoot: string,
  serviceName: string
): Effect.fn.Return<string, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectOptionalOutput(
    QualityTaskStep.make({
      label: "graphiti-restore:systemctl-cat",
      command: "systemctl",
      args: ["--user", "cat", serviceName],
      cwd: repoRoot,
    })
  );
  return result.exitCode === 0 ? result.output : "";
});

/**
 * Check whether the user-level proxy service is active.
 *
 * @example
 * ```ts
 * import { proxyServiceIsActive } from "@beep/repo-cli/commands/Graphiti/internal/ProxyServiceInstall"
 * import { Effect } from "effect"
 *
 * const program = proxyServiceIsActive("/repo", "beep-graphiti-proxy")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const proxyServiceIsActive = Effect.fn("GraphitiProxyOps.proxyServiceIsActive")(function* (
  repoRoot: string,
  serviceName: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectOptionalOutput(
    QualityTaskStep.make({
      label: "graphiti-restore:systemctl-active",
      command: "systemctl",
      args: ["--user", "is-active", "--quiet", serviceName],
      cwd: repoRoot,
    })
  );
  return result.exitCode === 0;
});

/**
 * Ensure the proxy service is installed and active before restore verification.
 *
 * @example
 * ```ts
 * import { ensureProxyServiceForRestore } from "@beep/repo-cli/commands/Graphiti/internal/ProxyServiceInstall"
 * import { graphitiRestoreConfig } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return yield* ensureProxyServiceForRestore("/repo", graphitiRestoreConfig(path))
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const ensureProxyServiceForRestore = Effect.fn("GraphitiProxyOps.ensureProxyServiceForRestore")(function* (
  repoRoot: string,
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, GraphitiProxyOpsEnvironment> {
  const path = yield* Path.Path;
  const serviceConfig = proxyServiceConfig(path);
  const unitText = yield* readProxyServiceUnit(repoRoot, serviceConfig.serviceName);
  const shouldInstall = shouldInstallProxyServiceForTesting({
    repoRoot,
    unitText,
    upstream: config.upstreamMcpUrl,
  });

  if (shouldInstall) {
    yield* Console.log("[graphiti-restore] Proxy service unit drift detected; reinstalling from this checkout.");
    yield* installGraphitiProxyService({ upstreamMcpUrl: config.upstreamMcpUrl });
    return;
  }

  if (!(yield* proxyServiceIsActive(repoRoot, serviceConfig.serviceName))) {
    yield* Console.log("[graphiti-restore] Proxy service is installed but inactive; starting it.");
    yield* runInheritedStep(
      QualityTaskStep.make({
        label: "graphiti-restore:systemctl-start",
        command: "systemctl",
        args: ["--user", "start", serviceConfig.serviceName],
        cwd: repoRoot,
      })
    );
    return;
  }

  yield* Console.log("[graphiti-restore] Proxy service unit is current and active.");
});

const escapeSystemdEnvironmentValue = (value: string): string => Str.replaceAll("%", "%%")(value);

const renderServiceUnit = (repoRoot: string, bunBin: string, config: ProxyServiceConfig): string =>
  A.join(
    [
      "[Unit]",
      "Description=beep Graphiti MCP queue proxy",
      "After=network-online.target",
      "Wants=network-online.target",
      "",
      "[Service]",
      "Type=simple",
      `WorkingDirectory=${repoRoot}`,
      `ExecStart=${bunBin} run beep graphiti proxy`,
      "Restart=always",
      "RestartSec=2",
      `Environment=PATH=/usr/local/bin:/usr/bin:/bin:${homeDirectory()}/.bun/bin`,
      "Environment=GRAPHITI_PROXY_HOST=127.0.0.1",
      "Environment=GRAPHITI_PROXY_PORT=8123",
      `Environment=GRAPHITI_PROXY_UPSTREAM=${escapeSystemdEnvironmentValue(config.upstreamMcpUrl)}`,
      "Environment=GRAPHITI_PROXY_SERVER_IDLE_TIMEOUT_SECONDS=75",
      `StandardOutput=append:${config.stateDir}/graphiti-proxy.log`,
      `StandardError=append:${config.stateDir}/graphiti-proxy.err.log`,
      "",
      "[Install]",
      "WantedBy=default.target",
      "",
    ],
    "\n"
  );

/**
 * Render the user-level systemd unit for the Graphiti proxy.
 *
 * @param repoRoot - Repository root used as the service working directory.
 * @param bunBin - Resolved Bun executable path.
 * @param config - Proxy service configuration.
 * @returns Rendered systemd unit text.
 * @example
 * ```ts
 * import { ProxyServiceConfig, renderProxyServiceUnitForTesting } from "@beep/repo-cli/test/Graphiti"
 *
 * const unit = renderProxyServiceUnitForTesting(
 *   "/repo",
 *   "/bin/bun",
 *   ProxyServiceConfig.make({
 *     serviceFile: "/tmp/beep-graphiti-proxy.service",
 *     serviceName: "beep-graphiti-proxy.service",
 *     stateDir: "/tmp/beep",
 *     systemdUserDir: "/tmp/systemd/user",
 *     upstreamMcpUrl: "http://127.0.0.1:9000/mcp"
 *   })
 * )
 * console.log(unit) // example value
 * ```
 * @category testing
 * @since 0.0.0
 */
export const renderProxyServiceUnitForTesting = renderServiceUnit;

/**
 * Install and start the user-level systemd unit for the Graphiti proxy.
 *
 * @param options - Optional service install overrides.
 * @returns Effect that writes, enables, starts, and displays the user unit status.
 * @example
 * ```ts
 * import { installGraphitiProxyService } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const program = installGraphitiProxyService({ upstreamMcpUrl: "http://127.0.0.1:9000/mcp" })
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const installGraphitiProxyService = Effect.fn("GraphitiProxyOps.installGraphitiProxyService")(function* (
  options: GraphitiProxyServiceInstallOptions = GraphitiProxyServiceInstallOptions.make({})
): Effect.fn.Return<void, GraphitiProxyOpsError, GraphitiProxyOpsEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(GraphitiProxyOpsError.mapError("Failed to locate repository root."));
  const config = proxyServiceConfig(path, options);
  yield* S.decodeUnknownEffect(UpstreamMcpUrl)(config.upstreamMcpUrl).pipe(
    GraphitiProxyOpsError.mapError(
      "Refusing to install the Graphiti proxy service with an invalid or control-character-bearing upstream MCP URL.",
      { exitCode: 1 }
    )
  );
  yield* guardLiteralArg(config.serviceName).pipe(
    GraphitiProxyOpsError.mapError(
      "Refusing to forward an option-like Graphiti proxy service name into a systemctl argument vector.",
      { exitCode: 1 }
    )
  );
  const bunBin = yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "which:bun",
      command: "which",
      args: ["bun"],
      cwd: repoRoot,
    })
  );

  yield* fs
    .makeDirectory(config.systemdUserDir, { recursive: true })
    .pipe(GraphitiProxyOpsError.mapError(`Failed to create ${config.systemdUserDir}.`));
  yield* fs
    .makeDirectory(config.stateDir, { recursive: true })
    .pipe(GraphitiProxyOpsError.mapError(`Failed to create ${config.stateDir}.`));
  yield* fs
    .writeFileString(config.serviceFile, renderServiceUnit(repoRoot, bunBin, config))
    .pipe(GraphitiProxyOpsError.mapError(`Failed to write ${config.serviceFile}.`));
  yield* Console.log(`[graphiti-proxy:service] Wrote user unit: ${config.serviceFile}`);

  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "systemctl:daemon-reload",
      command: "systemctl",
      args: ["--user", "daemon-reload"],
      cwd: repoRoot,
    })
  );
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "systemctl:enable-now",
      command: "systemctl",
      args: ["--user", "enable", "--now", config.serviceName],
      cwd: repoRoot,
    })
  );
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "systemctl:restart",
      command: "systemctl",
      args: ["--user", "restart", config.serviceName],
      cwd: repoRoot,
    })
  );
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "systemctl:is-active",
      command: "systemctl",
      args: ["--user", "is-active", "--quiet", config.serviceName],
      cwd: repoRoot,
    })
  );
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "systemctl:status",
      command: "systemctl",
      args: ["--user", "--no-pager", "--full", "status", config.serviceName],
      cwd: repoRoot,
    })
  );
  yield* Console.log("[graphiti-proxy:service] Service enabled and started.");
});
