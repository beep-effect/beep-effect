/**
 * Graphiti stack restore and verification workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import { Clock, Console, DateTime, Effect, FileSystem, Path, pipe } from "effect";
import { QualityTaskStep } from "../../../internal/process/index.js";
import { graphitiRestoreConfig } from "../Graphiti.config.js";
import { GraphitiProxyOpsError } from "../Graphiti.errors.js";
import { GraphitiRestoreOptions } from "../Graphiti.schemas.js";
import {
  requireRestoreContainersHealthy,
  waitForRestoreContainers,
  waitForRestoreProxyHealthy,
} from "./ContainerHealth.js";
import { ensureProxyServiceForRestore } from "./ProxyServiceInstall.js";
import {
  collectStepOutput,
  collectSuccessfulOutput,
  dockerRequired,
  requireExistingPath,
  runInheritedStep,
  shellQuote,
} from "./StepExec.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GraphitiProxyOpsEnvironment, GraphitiRestoreConfig } from "../Graphiti.schemas.js";

const backupTimestamp = (epochMillis: number): string =>
  pipe(DateTime.makeUnsafe(epochMillis), DateTime.formatIso, Str.replaceAll(":", ""), Str.replaceAll(".", ""));

/**
 * Build the backup directory name used by `graphiti restore --backup`.
 *
 * @param epochMillis - Millisecond epoch timestamp.
 * @returns Stable backup directory name.
 * @example
 * ```ts
 * import { backupDirectoryNameFromEpochMillisForTesting } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * console.log(backupDirectoryNameFromEpochMillisForTesting(0))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const backupDirectoryNameFromEpochMillisForTesting = (epochMillis: number): string =>
  `data-${backupTimestamp(epochMillis)}`;

const composeArgs = (config: GraphitiRestoreConfig, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "compose",
  "-f",
  config.composeFile,
  "-p",
  config.projectName,
  ...args,
];

const composeStep = (config: GraphitiRestoreConfig, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "docker",
    args: composeArgs(config, args),
    cwd: config.stackDir,
  });

const requireOutputContains = (
  output: string,
  needle: string,
  label: string
): Effect.Effect<void, GraphitiProxyOpsError> =>
  Str.includes(needle)(output)
    ? Effect.void
    : GraphitiProxyOpsError.make({
        message: `${label} did not contain expected text: ${needle}`,
        exitCode: 1,
      });

const preflightGraphitiStack = Effect.fn("GraphitiProxyOps.preflightGraphitiStack")(function* (
  repoRoot: string,
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner> {
  yield* dockerRequired(repoRoot);
  yield* requireExistingPath(config.stackDir, "Graphiti stack directory");
  yield* requireExistingPath(config.composeFile, "Graphiti docker-compose.yml");
  yield* requireExistingPath(config.envFile, "Graphiti .env file");
  yield* requireExistingPath(config.dataDir, "Graphiti persisted data directory");

  const fs = yield* FileSystem.FileSystem;
  const dumpPath = `${config.dataDir}/dump.rdb`;
  const aofManifestPath = `${config.dataDir}/appendonlydir/appendonly.aof.manifest`;
  const hasDump = yield* fs.exists(dumpPath).pipe(Effect.orElseSucceed(thunkFalse));
  const hasAof = yield* fs.exists(aofManifestPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!hasDump && !hasAof) {
    return yield* GraphitiProxyOpsError.make({
      message: `Graphiti persisted data at ${config.dataDir} did not contain dump.rdb or appendonlydir/appendonly.aof.manifest.`,
      exitCode: 1,
    });
  }

  const services = yield* collectSuccessfulOutput(
    composeStep(config, "graphiti-restore:compose-services", ["config", "--services"])
  );
  yield* requireOutputContains(services, config.falkorService, "compose services");
  yield* requireOutputContains(services, config.browserService, "compose services");
  yield* requireOutputContains(services, config.graphitiService, "compose services");

  const composeText = yield* fs
    .readFileString(config.composeFile)
    .pipe(GraphitiProxyOpsError.mapError(`Failed to read ${config.composeFile}.`));
  yield* requireOutputContains(composeText, config.graphName, "docker-compose.yml graph configuration");
  yield* requireOutputContains(composeText, "/var/lib/falkordb/data", "docker-compose.yml data mount");
  yield* requireOutputContains(composeText, "TIMEOUT_MAX 120000", "docker-compose.yml Falkor timeout configuration");
});

const runMcpSessionProbe = Effect.fn("GraphitiProxyOps.runMcpSessionProbe")(function* (
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const script = A.join(
    [
      "set -eu",
      `graphiti_url=${shellQuote(config.proxyMcpUrl)}`,
      'headers="$(mktemp)"',
      'body="$(mktemp)"',
      'cleanup() { rm -f "$headers" "$body"; }',
      "trap cleanup EXIT",
      'initialize_body=\'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"beep-graphiti-verify","version":"0.0.0"}}}\'',
      'initialized_body=\'{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}\'',
      'tools_body=\'{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\'',
      'status_body=\'{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_status","arguments":{}}}\'',
      'curl -sS -m 10 -N -D "$headers" -H "content-type: application/json" -H "accept: application/json, text/event-stream" --data-binary "$initialize_body" "$graphiti_url" > "$body" || true',
      'cat "$body"',
      'session_id="$(awk \'tolower($0) ~ /^mcp-session-id:/ {gsub("\\r","",$2); print $2; exit}\' "$headers")"',
      'test -n "$session_id"',
      'curl -sS -m 10 -N -H "content-type: application/json" -H "accept: application/json, text/event-stream" -H "mcp-session-id: $session_id" --data-binary "$initialized_body" "$graphiti_url" >/dev/null || true',
      'curl -sS -m 10 -N -H "content-type: application/json" -H "accept: application/json, text/event-stream" -H "mcp-session-id: $session_id" --data-binary "$tools_body" "$graphiti_url" || true',
      'curl -sS -m 10 -N -H "content-type: application/json" -H "accept: application/json, text/event-stream" -H "mcp-session-id: $session_id" --data-binary "$status_body" "$graphiti_url" || true',
    ],
    "\n"
  );
  const result = yield* collectStepOutput(
    QualityTaskStep.make({
      label: "graphiti-verify:mcp-session",
      command: "sh",
      args: ["-c", script],
      cwd: config.stackDir,
    })
  ).pipe(
    GraphitiProxyOpsError.mapError("Failed to run graphiti MCP session probe.", {
      command: `sh -c <mcp-session-probe> ${config.proxyMcpUrl}`,
    })
  );

  const expectedMarkers = ["Graphiti Agent Memory", "get_status", "Graphiti MCP server is running"];
  const hasExpectedMarker = A.some(expectedMarkers, (marker) => Str.includes(marker)(result.output));
  if (result.exitCode !== 0 && !hasExpectedMarker) {
    return yield* GraphitiProxyOpsError.make({
      message: `graphiti MCP session probe failed with exit code ${result.exitCode}.`,
      command: `sh -c <mcp-session-probe> ${config.proxyMcpUrl}`,
      exitCode: result.exitCode,
    });
  }

  yield* requireOutputContains(result.output, "Graphiti Agent Memory", "MCP initialize response");
  yield* requireOutputContains(result.output, "get_status", "MCP tools/list response");
  yield* requireOutputContains(result.output, "Graphiti MCP server is running", "MCP get_status response");
});

const verifyFalkor = Effect.fn("GraphitiProxyOps.verifyFalkor")(function* (
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const ping = yield* collectSuccessfulOutput(
    composeStep(config, "graphiti-verify:falkor-ping", ["exec", "-T", config.falkorService, "redis-cli", "ping"])
  );
  yield* requireOutputContains(ping, "PONG", "Falkor ping");

  const graphs = yield* collectSuccessfulOutput(
    composeStep(config, "graphiti-verify:graph-list", ["exec", "-T", config.falkorService, "redis-cli", "GRAPH.LIST"])
  );
  yield* requireOutputContains(graphs, config.graphName, "Falkor graph list");

  const clients = yield* collectSuccessfulOutput(
    composeStep(config, "graphiti-verify:clients", ["exec", "-T", config.falkorService, "redis-cli", "INFO", "clients"])
  );
  yield* requireOutputContains(clients, "blocked_clients:0", "Falkor client info");

  const timeoutMax = yield* collectSuccessfulOutput(
    composeStep(config, "graphiti-verify:timeout-max", [
      "exec",
      "-T",
      config.falkorService,
      "redis-cli",
      "GRAPH.CONFIG",
      "GET",
      "TIMEOUT_MAX",
    ])
  );
  yield* requireOutputContains(timeoutMax, "120000", "Falkor TIMEOUT_MAX");
});

const verifyProxy = Effect.fn("GraphitiProxyOps.verifyProxy")(function* (
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "graphiti-verify:proxy-health",
      command: "curl",
      args: ["-fsS", "-m", "5", config.proxyHealthUrl],
      cwd: config.stackDir,
    })
  );

  yield* runMcpSessionProbe(config);
});

const backupGraphitiData = Effect.fn("GraphitiProxyOps.backupGraphitiData")(function* (
  config: GraphitiRestoreConfig
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const now = yield* Clock.currentTimeMillis;
  const backupDir = `${config.backupRoot}/${backupDirectoryNameFromEpochMillisForTesting(now)}`;
  yield* fs
    .makeDirectory(config.backupRoot, { recursive: true })
    .pipe(GraphitiProxyOpsError.mapError(`Failed to create ${config.backupRoot}.`));
  yield* Console.log(`[graphiti-restore] Backing up persisted data to ${backupDir}.`);
  yield* runInheritedStep(
    QualityTaskStep.make({
      label: "graphiti-restore:backup-data",
      command: "cp",
      args: ["-R", "--no-preserve=ownership,mode", config.dataDir, backupDir],
      cwd: config.stackDir,
    })
  );
});

const renderRestorePlan = (config: GraphitiRestoreConfig, options: GraphitiRestoreOptions): ReadonlyArray<string> => [
  "[graphiti-restore] Dry-run mode enabled; no containers, data, or systemd services will be mutated.",
  `[graphiti-restore] Stack directory: ${config.stackDir}`,
  `[graphiti-restore] Compose file: ${config.composeFile}`,
  `[graphiti-restore] Persisted data: ${config.dataDir}`,
  `[graphiti-restore] Compose project: ${config.projectName}`,
  `[graphiti-restore] Verify graph: ${config.graphName}`,
  `[graphiti-restore] Proxy MCP endpoint: ${config.proxyMcpUrl}`,
  `[graphiti-restore] Backing MCP endpoint: ${config.upstreamMcpUrl}`,
  `[graphiti-restore] Backup requested: ${options.backup === true ? "yes" : "no"}`,
  `[graphiti-restore] Force requested: ${options.force === true ? "yes" : "no"}`,
];

/**
 * Verify the local Graphiti stack, persisted `beep_dev` graph, and proxy MCP endpoint.
 *
 * @param options - Optional stack directory override.
 * @returns Effect that succeeds once all restore smoke checks pass.
 * @example
 * ```ts
 * import { verifyGraphitiStack } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const program = verifyGraphitiStack()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const verifyGraphitiStack = Effect.fn("GraphitiProxyOps.verifyGraphitiStack")(function* (
  options: Pick<GraphitiRestoreOptions, "stackDir"> = GraphitiRestoreOptions.make({})
): Effect.fn.Return<void, GraphitiProxyOpsError, GraphitiProxyOpsEnvironment> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(GraphitiProxyOpsError.mapError("Failed to locate repository root."));
  const config = graphitiRestoreConfig(path, options);

  yield* preflightGraphitiStack(repoRoot, config);
  yield* requireRestoreContainersHealthy(repoRoot, config);
  yield* verifyFalkor(config);
  yield* verifyProxy(config);
  yield* Console.log("[graphiti-verify] Graphiti stack, persisted graph, and proxy MCP endpoint are healthy.");
});

/**
 * Restore the local Graphiti backing stack and repair the agent-facing proxy.
 *
 * @param options - Restore execution options.
 * @returns Effect that restores and verifies the local Graphiti runtime.
 * @example
 * ```ts
 * import { restoreGraphitiStack } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const program = restoreGraphitiStack({ dryRun: true })
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const restoreGraphitiStack = Effect.fn("GraphitiProxyOps.restoreGraphitiStack")(function* (
  options: GraphitiRestoreOptions = GraphitiRestoreOptions.make({})
): Effect.fn.Return<void, GraphitiProxyOpsError, GraphitiProxyOpsEnvironment> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(GraphitiProxyOpsError.mapError("Failed to locate repository root."));
  const config = graphitiRestoreConfig(path, options);

  yield* preflightGraphitiStack(repoRoot, config);

  if (options.dryRun === true) {
    yield* Effect.forEach(renderRestorePlan(config, options), (line) => Console.log(line), { concurrency: 1 });
    return;
  }

  if (options.backup === true) {
    yield* backupGraphitiData(config);
  }

  yield* runInheritedStep(composeStep(config, "graphiti-restore:compose-pull", ["pull"]));
  yield* runInheritedStep(
    composeStep(config, "graphiti-restore:compose-up", [
      "up",
      "-d",
      ...(options.force === true ? ["--force-recreate"] : []),
    ])
  );
  yield* waitForRestoreContainers(repoRoot, config);
  yield* verifyFalkor(config);
  yield* ensureProxyServiceForRestore(repoRoot, config);
  yield* waitForRestoreProxyHealthy(config);
  yield* verifyProxy(config);
  yield* Console.log(
    "[graphiti-restore] Graphiti memory runtime restored. Start a fresh Codex session if this session does not expose the graphiti-memory MCP tool."
  );
});
