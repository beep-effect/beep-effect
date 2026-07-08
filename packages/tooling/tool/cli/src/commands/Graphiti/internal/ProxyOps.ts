/**
 * Graphiti proxy operational helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// cspell:ignore gsub

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, guardLiteralArg } from "@beep/repo-utils";
import { URLStr } from "@beep/schema";
import { A, Str, thunkEmptyStr, thunkFalse } from "@beep/utils";
import { Clock, Config, Console, DateTime, Duration, Effect, FileSystem, Path, pipe, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { QualityTaskStep } from "../../../internal/process/index.js";
import { GraphitiProxyOpsError } from "../Graphiti.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";

/**
 * Public Graphiti proxy operations error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { GraphitiProxyOpsError } from "../Graphiti.errors.js";

const $I = $RepoCliId.create("commands/Graphiti/internal/ProxyOps");

/**
 * Matches any ASCII/C1 control character (CR, LF, NUL, tab, and other C0/C1
 * controls) that, when interpolated into a line-oriented systemd unit, could
 * terminate a directive and inject additional `[Service]` directives.
 */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

const hasControlCharacters = (value: string): boolean => O.isSome(Str.match(CONTROL_CHARACTER_PATTERN)(value));

const isSafeUpstreamMcpUrl = (value: string): boolean => !hasControlCharacters(value) && URLStr.is(value);

/**
 * Validated upstream MCP endpoint URL safe to render into a systemd unit.
 *
 * Rejects control characters (CR, LF, NUL, and other C0/C1 controls) that could
 * inject systemd directives, and requires a well-formed URL. This fails closed
 * at the model boundary before any value reaches the generated unit file.
 */
const UpstreamMcpUrl = S.String.check(
  S.makeFilter(isSafeUpstreamMcpUrl, {
    identifier: $I`UpstreamMcpUrlSafeCheck`,
    title: "Upstream MCP URL Safe",
    description:
      "An upstream MCP endpoint URL containing no control characters and parseable as a URL, safe to render into a systemd unit Environment directive.",
    message: "Upstream MCP URL must be a valid URL free of control characters",
  })
).pipe(
  $I.annoteSchema("UpstreamMcpUrl", {
    description:
      "An upstream MCP endpoint URL validated to be free of control characters and parseable as a URL before it is rendered into a systemd unit.",
  })
);

type GraphitiProxyOpsEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
type GraphitiRestoreOptions = {
  readonly backup?: boolean | undefined;
  readonly dryRun?: boolean | undefined;
  readonly force?: boolean | undefined;
  readonly stackDir?: string | undefined;
};
type GraphitiProxyServiceInstallOptions = {
  readonly upstreamMcpUrl?: string | undefined;
};

const DEFAULT_GRAPHITI_STACK_DIR_NAME = "graphiti-mcp";
const DEFAULT_GRAPHITI_PROJECT_NAME = "graphiti-mcp";
const DEFAULT_GRAPHITI_GRAPH_NAME = "beep_dev";
const DEFAULT_GRAPHITI_PROXY_HEALTH_URL = "http://127.0.0.1:8123/healthz";
const DEFAULT_GRAPHITI_PROXY_MCP_URL = "http://127.0.0.1:8123/mcp";
const DEFAULT_GRAPHITI_UPSTREAM_MCP_URL = "http://127.0.0.1:8000/mcp";
const GRAPHITI_FALKOR_SERVICE = "falkordb";
const GRAPHITI_BROWSER_SERVICE = "falkordb-browser";
const GRAPHITI_MCP_SERVICE = "graphiti-mcp";

class ProxyEnsureConfig extends S.Class<ProxyEnsureConfig>($I`ProxyEnsureConfig`)(
  {
    falkorContainer: S.String,
    graphitiContainer: S.String,
    healthUrl: S.String,
    logFile: S.String,
    pidFile: S.String,
    port: S.String,
    recoverOnUnhealthy: S.Boolean,
    recoveryMcpUrl: S.String,
    recoveryVerifyGroup: S.String,
    stateDir: S.String,
    timeoutSeconds: S.Finite,
    waitSeconds: S.Finite,
  },
  $I.annote("ProxyEnsureConfig", {
    description: "Configuration for ensuring the Graphiti proxy service is running.",
  })
) {}

/**
 * Configuration for restoring and verifying the local Graphiti stack.
 *
 * @example
 * ```ts
 * import { GraphitiRestoreConfig } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const config = GraphitiRestoreConfig.make({ stackDir: "/home/me/graphiti-mcp" })
 * console.log(config.stackDir)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiRestoreConfig extends S.Class<GraphitiRestoreConfig>($I`GraphitiRestoreConfig`)(
  {
    backupRoot: S.String,
    browserContainer: S.String,
    browserService: S.String,
    composeFile: S.String,
    dataDir: S.String,
    envFile: S.String,
    falkorContainer: S.String,
    falkorService: S.String,
    graphName: S.String,
    graphitiContainer: S.String,
    graphitiService: S.String,
    projectName: S.String,
    proxyHealthUrl: S.String,
    proxyMcpUrl: S.String,
    stackDir: S.String,
    upstreamMcpUrl: UpstreamMcpUrl,
    waitSeconds: S.Finite,
  },
  $I.annote("GraphitiRestoreConfig", {
    description: "Resolved filesystem, container, and endpoint configuration for Graphiti stack restoration.",
  })
) {}

/**
 * Configuration for installing and managing the Graphiti proxy user service.
 *
 * @example
 * ```ts
 * import { ProxyServiceConfig } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 *
 * const serviceName: ProxyServiceConfig["serviceName"] = "beep-graphiti-proxy.service"
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProxyServiceConfig extends S.Class<ProxyServiceConfig>($I`ProxyServiceConfig`)(
  {
    serviceFile: S.String,
    serviceName: S.String,
    stateDir: S.String,
    systemdUserDir: S.String,
    upstreamMcpUrl: UpstreamMcpUrl,
  },
  $I.annote("ProxyServiceConfig", {
    description: "Configuration for managing the Graphiti proxy service.",
  })
) {}

const commandText: {
  (command: string, args: ReadonlyArray<string>): string;
  (args: ReadonlyArray<string>): (command: string) => string;
} = dual(2, (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " "));

const shellQuote = (value: string): string => `'${Str.replaceAll("'", "'\"'\"'")(value)}'`;

const configStringOptionSync = (name: string): O.Option<string> => Effect.runSync(Config.option(Config.string(name)));

const homeDirectory = (): string =>
  pipe(
    configStringOptionSync("HOME"),
    O.getOrElse(() => process.cwd())
  );

const defaultGraphitiStackDir = (): string => `${homeDirectory()}/${DEFAULT_GRAPHITI_STACK_DIR_NAME}`;

const envValue: {
  (name: string, fallback: string): string;
  (fallback: string): (name: string) => string;
} = dual(2, (name: string, fallback: string): string =>
  pipe(
    configStringOptionSync(name),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => fallback)
  )
);

const intEnvValue: {
  (name: string, fallback: number): number;
  (fallback: number): (name: string) => number;
} = dual(2, (name: string, fallback: number): number => {
  const parsed = Number.parseInt(envValue(name, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
});

const booleanEnvValue: {
  (name: string, fallback: boolean): boolean;
  (fallback: boolean): (name: string) => boolean;
} = dual(2, (name: string, fallback: boolean): boolean => {
  const normalized = Str.toLowerCase(Str.trim(envValue(name, "")));
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
});

const proxyPortFromUrl = (healthUrl: string): string => {
  try {
    return new URL(healthUrl).port || "8123";
  } catch {
    return "8123";
  }
};

const proxyEnsureConfig = (path: Path.Path): ProxyEnsureConfig => {
  const healthUrl = envValue("GRAPHITI_PROXY_HEALTH_URL", "http://127.0.0.1:8123/healthz");
  const stateDir = path.join(envValue("XDG_STATE_HOME", path.join(homeDirectory(), ".local", "state")), "beep");
  const runtimeDir = envValue("XDG_RUNTIME_DIR", "/tmp");
  return {
    falkorContainer: envValue(
      "GRAPHITI_PROXY_FALKOR_CONTAINER",
      envValue("FALKOR_CONTAINER", "graphiti-mcp-falkordb-1")
    ),
    graphitiContainer: envValue(
      "GRAPHITI_PROXY_GRAPHITI_CONTAINER",
      envValue("GRAPHITI_CONTAINER", "graphiti-mcp-graphiti-mcp-1")
    ),
    healthUrl,
    logFile: path.join(stateDir, "graphiti-proxy.log"),
    pidFile: envValue("GRAPHITI_PROXY_PID_FILE", path.join(runtimeDir, "beep-graphiti-proxy.pid")),
    port: proxyPortFromUrl(healthUrl),
    recoverOnUnhealthy: booleanEnvValue("GRAPHITI_PROXY_RECOVER_ON_UNHEALTHY", true),
    recoveryMcpUrl: envValue("GRAPHITI_PROXY_RECOVERY_MCP_URL", "http://127.0.0.1:8000/mcp"),
    recoveryVerifyGroup: envValue("GRAPHITI_PROXY_RECOVERY_GROUP", "beep_dev"),
    stateDir,
    timeoutSeconds: intEnvValue("GRAPHITI_PROXY_START_TIMEOUT_SECONDS", 20),
    waitSeconds: intEnvValue("GRAPHITI_RECOVERY_WAIT_SECONDS", intEnvValue("WAIT_SECONDS", 180)),
  };
};

const proxyServiceConfig = (path: Path.Path, options: GraphitiProxyServiceInstallOptions = {}): ProxyServiceConfig => {
  const serviceName = envValue("GRAPHITI_PROXY_SERVICE_NAME", "beep-graphiti-proxy.service");
  const systemdUserDir = path.join(
    envValue("XDG_CONFIG_HOME", path.join(homeDirectory(), ".config")),
    "systemd",
    "user"
  );
  const stateDir = path.join(envValue("XDG_STATE_HOME", path.join(homeDirectory(), ".local", "state")), "beep");
  const upstreamMcpUrl = pipe(
    O.fromUndefinedOr(options.upstreamMcpUrl),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => envValue("GRAPHITI_PROXY_UPSTREAM", DEFAULT_GRAPHITI_UPSTREAM_MCP_URL))
  );
  return {
    serviceFile: path.join(systemdUserDir, serviceName),
    serviceName,
    stateDir,
    systemdUserDir,
    upstreamMcpUrl,
  };
};

const containerName = (projectName: string, serviceName: string): string => `${projectName}-${serviceName}-1`;

/**
 * Resolve the Graphiti stack directory from CLI and environment inputs.
 *
 * @param cliStackDir - Optional CLI stack directory.
 * @param envStackDir - Optional environment stack directory.
 * @returns Resolved stack directory text.
 * @example
 * ```ts
 * import { resolveGraphitiStackDirForTesting } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * import * as O from "effect/Option"
 * console.log(resolveGraphitiStackDirForTesting(O.some("/tmp/stack"), O.none()))
 * console.log(resolveGraphitiStackDirForTesting(O.none())(O.some("/tmp/stack")))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const resolveGraphitiStackDirForTesting: {
  (cliStackDir: O.Option<string>, envStackDir: O.Option<string>): string;
  (cliStackDir: O.Option<string>): (envStackDir: O.Option<string>) => string;
} = dual(
  2,
  function resolveGraphitiStackDirForTestingImpl(cliStackDir: O.Option<string>, envStackDir: O.Option<string>): string {
    return pipe(
      cliStackDir,
      O.filter(Str.isNonEmpty),
      O.orElse(() => pipe(envStackDir, O.filter(Str.isNonEmpty))),
      O.getOrElse(defaultGraphitiStackDir)
    );
  }
);

const graphitiRestoreConfig = (path: Path.Path, options: GraphitiRestoreOptions = {}): GraphitiRestoreConfig => {
  const stackDir = path.resolve(
    resolveGraphitiStackDirForTesting(O.fromUndefinedOr(options.stackDir), configStringOptionSync("GRAPHITI_STACK_DIR"))
  );
  const projectName = envValue("GRAPHITI_RESTORE_PROJECT_NAME", DEFAULT_GRAPHITI_PROJECT_NAME);
  return GraphitiRestoreConfig.make({
    backupRoot: path.join(stackDir, "backups"),
    browserContainer: containerName(projectName, GRAPHITI_BROWSER_SERVICE),
    browserService: GRAPHITI_BROWSER_SERVICE,
    composeFile: path.join(stackDir, "docker-compose.yml"),
    dataDir: path.join(stackDir, "data"),
    envFile: path.join(stackDir, ".env"),
    falkorContainer: containerName(projectName, GRAPHITI_FALKOR_SERVICE),
    falkorService: GRAPHITI_FALKOR_SERVICE,
    graphName: envValue("GRAPHITI_RESTORE_GRAPH_NAME", DEFAULT_GRAPHITI_GRAPH_NAME),
    graphitiContainer: containerName(projectName, GRAPHITI_MCP_SERVICE),
    graphitiService: GRAPHITI_MCP_SERVICE,
    projectName,
    proxyHealthUrl: envValue("GRAPHITI_PROXY_HEALTH_URL", DEFAULT_GRAPHITI_PROXY_HEALTH_URL),
    proxyMcpUrl: envValue("GRAPHITI_PROXY_MCP_URL", DEFAULT_GRAPHITI_PROXY_MCP_URL),
    stackDir,
    upstreamMcpUrl: envValue("GRAPHITI_PROXY_UPSTREAM", DEFAULT_GRAPHITI_UPSTREAM_MCP_URL),
    waitSeconds: intEnvValue("GRAPHITI_RESTORE_WAIT_SECONDS", intEnvValue("WAIT_SECONDS", 180)),
  });
};

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

const collectStepOutput = (step: QualityTaskStep) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(step.command, [...step.args], {
        cwd: step.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(thunkEmptyStr, (acc, chunk) => acc + chunk)
      );
      const exitCode = yield* handle.exitCode;
      return {
        exitCode,
        output: Str.trim(output),
      };
    })
  );

const collectSuccessfulOutput = Effect.fn("GraphitiProxyOps.collectSuccessfulOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<string, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectStepOutput(step).pipe(
    GraphitiProxyOpsError.mapError(`Failed to run ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );
  if (result.exitCode !== 0) {
    return yield* GraphitiProxyOpsError.make({
      message: `${step.label} failed with exit code ${result.exitCode}.`,
      command: commandText(step.command, step.args),
      exitCode: result.exitCode,
    });
  }
  return result.output;
});

const runInheritedStep = Effect.fn("GraphitiProxyOps.runInheritedStep")(function* (
  step: QualityTaskStep
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[graphiti-proxy] ${step.label}: ${commandText(step.command, step.args)}`);
  const exitCode = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(step.command, [...step.args], {
        cwd: step.cwd,
        env: step.env,
        extendEnv: true,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      return yield* handle.exitCode;
    })
  ).pipe(
    GraphitiProxyOpsError.mapError(`Failed to spawn ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );

  if (exitCode !== 0) {
    return yield* GraphitiProxyOpsError.make({
      message: `${step.label} failed with exit code ${exitCode}.`,
      command: commandText(step.command, step.args),
      exitCode,
    });
  }
});

const checkProxyHealth = Effect.fn("GraphitiProxyOps.checkProxyHealth")(function* (
  config: ProxyEnsureConfig
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* checkProxyHealthUrl(config.healthUrl);
});

const checkProxyHealthUrl = Effect.fn("GraphitiProxyOps.checkProxyHealthUrl")(function* (
  healthUrl: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const exitCode = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("curl", ["-fsS", "-m", "2", healthUrl], {
        stdout: "ignore",
        stderr: "ignore",
      });
      return yield* handle.exitCode;
    })
  ).pipe(Effect.orElseSucceed(() => 1));

  return exitCode === 0;
});

const collectOptionalOutput = (step: QualityTaskStep) =>
  collectStepOutput(step).pipe(
    Effect.orElseSucceed(
      () =>
        ({
          exitCode: 1,
          output: "",
        }) as const
    )
  );

const requireExistingPath = Effect.fn("GraphitiProxyOps.requireExistingPath")(function* (
  targetPath: string,
  label: string
): Effect.fn.Return<void, GraphitiProxyOpsError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(targetPath).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return yield* GraphitiProxyOpsError.make({
      message: `${label} was not found at ${targetPath}.`,
      exitCode: 1,
    });
  }
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

const dockerAvailable = Effect.fn("GraphitiProxyOps.dockerAvailable")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectOptionalOutput(
    QualityTaskStep.make({
      label: "graphiti-recover:docker-version",
      command: "docker",
      args: ["--version"],
      cwd: repoRoot,
    })
  );
  return result.exitCode === 0;
});

const dockerRequired = Effect.fn("GraphitiProxyOps.dockerRequired")(function* (
  repoRoot: string
): Effect.fn.Return<void, GraphitiProxyOpsError, ChildProcessSpawner.ChildProcessSpawner> {
  if (yield* dockerAvailable(repoRoot)) {
    return;
  }
  return yield* GraphitiProxyOpsError.make({
    message: "docker is unavailable; cannot restore or verify the Graphiti stack.",
    exitCode: 1,
  });
});

const containerExists: {
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

const containerHealth: {
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

const waitForHealthyContainers: {
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

const restoreContainerHealthStates = Effect.fn("GraphitiProxyOps.restoreContainerHealthStates")(function* (
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

const waitForRestoreContainers = Effect.fn("GraphitiProxyOps.waitForRestoreContainers")(function* (
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

const requireRestoreContainersHealthy = Effect.fn("GraphitiProxyOps.requireRestoreContainersHealthy")(function* (
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

const waitForRestoreProxyHealthy = Effect.fn("GraphitiProxyOps.waitForRestoreProxyHealthy")(function* (
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

const readProxyServiceUnit = Effect.fn("GraphitiProxyOps.readProxyServiceUnit")(function* (
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

const proxyServiceIsActive = Effect.fn("GraphitiProxyOps.proxyServiceIsActive")(function* (
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

const ensureProxyServiceForRestore = Effect.fn("GraphitiProxyOps.ensureProxyServiceForRestore")(function* (
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
  options: Pick<GraphitiRestoreOptions, "stackDir"> = {}
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
  options: GraphitiRestoreOptions = {}
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
 * console.log(unit)
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
  options: GraphitiProxyServiceInstallOptions = {}
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
