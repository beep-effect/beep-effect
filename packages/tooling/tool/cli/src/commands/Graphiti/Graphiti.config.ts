/**
 * Lazy Graphiti proxy configuration readers.
 *
 * @remarks
 * Every exported builder reads the ambient config provider at call time. Tests
 * mutate GRAPHITI_* variables between cases, so this module must not capture
 * environment values during module evaluation.
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { booleanEnvValue, configStringOptionSync, envValue, intEnvValue } from "../../internal/cli/EnvConfig.js";
import {
  GraphitiProxyServiceInstallOptions,
  GraphitiRestoreConfig,
  GraphitiRestoreOptions,
} from "./Graphiti.schemas.js";
import type { Path } from "effect";
import type { ProxyEnsureConfig, ProxyServiceConfig } from "./Graphiti.schemas.js";

const DEFAULT_GRAPHITI_STACK_DIR_NAME = "graphiti-mcp";
const DEFAULT_GRAPHITI_PROJECT_NAME = "graphiti-mcp";
const DEFAULT_GRAPHITI_GRAPH_NAME = "beep_dev";
const DEFAULT_GRAPHITI_PROXY_HEALTH_URL = "http://127.0.0.1:8123/healthz";
const DEFAULT_GRAPHITI_PROXY_MCP_URL = "http://127.0.0.1:8123/mcp";
const DEFAULT_GRAPHITI_UPSTREAM_MCP_URL = "http://127.0.0.1:8000/mcp";
const GRAPHITI_FALKOR_SERVICE = "falkordb";
const GRAPHITI_BROWSER_SERVICE = "falkordb-browser";
const GRAPHITI_MCP_SERVICE = "graphiti-mcp";

/**
 * Read the current home directory from the ambient config provider at call time.
 *
 * @returns The `HOME` value from the ambient config provider, or the current
 * working directory when `HOME` is unset.
 * @example
 * ```ts
 * import { homeDirectory } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 *
 * console.log(homeDirectory().length > 0) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const homeDirectory = (): string =>
  pipe(
    configStringOptionSync("HOME"),
    O.getOrElse(() => process.cwd())
  );

const defaultGraphitiStackDir = (): string => `${homeDirectory()}/${DEFAULT_GRAPHITI_STACK_DIR_NAME}`;

const proxyPortFromUrl = (healthUrl: string): string => {
  try {
    return new URL(healthUrl).port || "8123";
  } catch {
    return "8123";
  }
};

/**
 * Resolve ensure-loop configuration from the current environment.
 *
 * @param path - Effect `Path` service used to join state, runtime, and log paths.
 * @returns The resolved ensure-loop configuration read from `GRAPHITI_*` and
 * `XDG_*` environment variables.
 * @example
 * ```ts
 * import { proxyEnsureConfig } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, proxyEnsureConfig)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const proxyEnsureConfig = (path: Path.Path): ProxyEnsureConfig => {
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

/**
 * Resolve systemd service installation configuration from current inputs.
 *
 * @param path - Effect `Path` service used to join systemd, config, and state paths.
 * @param options - Install options; a non-empty `upstreamMcpUrl` overrides the
 * environment-derived upstream URL.
 * @returns The resolved systemd service configuration including service file
 * location and upstream MCP URL.
 * @example
 * ```ts
 * import { proxyServiceConfig } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, (path) => proxyServiceConfig(path))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const proxyServiceConfig = (
  path: Path.Path,
  options: GraphitiProxyServiceInstallOptions = GraphitiProxyServiceInstallOptions.make({})
): ProxyServiceConfig => {
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

/**
 * Resolve restore and verify configuration from flags and current environment.
 *
 * @param path - Effect `Path` service used to resolve the stack directory and its children.
 * @param options - Restore options; `stackDir` overrides the `GRAPHITI_STACK_DIR`
 * environment value when provided.
 * @returns The resolved restore/verify configuration including container names,
 * compose file, backup root, and proxy URLs.
 * @example
 * ```ts
 * import { graphitiRestoreConfig } from "@beep/repo-cli/commands/Graphiti/Graphiti.config"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Path.Path, (path) => graphitiRestoreConfig(path))
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const graphitiRestoreConfig = (
  path: Path.Path,
  options: GraphitiRestoreOptions = GraphitiRestoreOptions.make({})
): GraphitiRestoreConfig => {
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
