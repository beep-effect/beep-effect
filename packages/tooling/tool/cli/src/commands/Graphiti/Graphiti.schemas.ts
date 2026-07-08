/**
 * Graphiti proxy operational schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { URLStr } from "@beep/schema";
import { Str } from "@beep/utils";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Graphiti/Graphiti.schemas");

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;

const hasControlCharacters = (value: string): boolean => O.isSome(Str.match(CONTROL_CHARACTER_PATTERN)(value));

const isSafeUpstreamMcpUrl = (value: string): boolean => !hasControlCharacters(value) && URLStr.is(value);

/**
 * Validated upstream MCP endpoint URL safe to render into a systemd unit.
 *
 * Rejects control characters (CR, LF, NUL, and other C0/C1 controls) that could
 * inject systemd directives, and requires a well-formed URL. This fails closed
 * at the model boundary before any value reaches the generated unit file.
 *
 * @example
 * ```ts
 * import { UpstreamMcpUrl } from "@beep/repo-cli/commands/Graphiti"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UpstreamMcpUrl)("http://127.0.0.1:8000/mcp"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const UpstreamMcpUrl = S.String.check(
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

/**
 * Runtime services required by Graphiti proxy operation effects.
 *
 * @example
 * ```ts
 * import type { GraphitiProxyOpsEnvironment } from "@beep/repo-cli/commands/Graphiti"
 * import { Effect } from "effect"
 *
 * const program: Effect.Effect<void, never, GraphitiProxyOpsEnvironment> = Effect.void
 * console.log(program.pipe !== undefined)
 * ```
 * @category services
 * @since 0.0.0
 */
export type GraphitiProxyOpsEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
/**
 * CLI options accepted by Graphiti restore.
 *
 * @example
 * ```ts
 * import { GraphitiRestoreOptions } from "@beep/repo-cli/commands/Graphiti"
 *
 * const options = GraphitiRestoreOptions.make({ dryRun: true, stackDir: "/tmp/graphiti" })
 * console.log(options.dryRun === true)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiRestoreOptions extends S.Class<GraphitiRestoreOptions>($I`GraphitiRestoreOptions`)(
  {
    backup: S.optional(S.Boolean),
    dryRun: S.optional(S.Boolean),
    force: S.optional(S.Boolean),
    stackDir: S.optional(S.String),
  },
  $I.annote("GraphitiRestoreOptions", {
    description: "Optional CLI flags used by Graphiti restore and verify operations.",
  })
) {}

/**
 * CLI options accepted by Graphiti proxy service installation.
 *
 * @example
 * ```ts
 * import { GraphitiProxyServiceInstallOptions } from "@beep/repo-cli/commands/Graphiti"
 *
 * const options = GraphitiProxyServiceInstallOptions.make({
 *   upstreamMcpUrl: "http://127.0.0.1:8000/mcp",
 * })
 * console.log(options.upstreamMcpUrl?.endsWith("/mcp") === true)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiProxyServiceInstallOptions extends S.Class<GraphitiProxyServiceInstallOptions>(
  $I`GraphitiProxyServiceInstallOptions`
)(
  {
    upstreamMcpUrl: S.optional(S.String),
  },
  $I.annote("GraphitiProxyServiceInstallOptions", {
    description: "Optional CLI flags used when installing the Graphiti proxy user service.",
  })
) {}

/**
 * Resolved configuration for the proxy ensure loop.
 *
 * @example
 * ```ts
 * import { ProxyEnsureConfig } from "@beep/repo-cli/commands/Graphiti"
 *
 * const config = ProxyEnsureConfig.make({ falkorContainer: "falkor", graphitiContainer: "graphiti", healthUrl: "http://127.0.0.1:8123/healthz", logFile: "/tmp/proxy.log", pidFile: "/tmp/proxy.pid", port: "8123", recoverOnUnhealthy: true, recoveryMcpUrl: "http://127.0.0.1:8000/mcp", recoveryVerifyGroup: "beep_dev", stateDir: "/tmp", timeoutSeconds: 20, waitSeconds: 180 })
 * console.log(config.port)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ProxyEnsureConfig extends S.Class<ProxyEnsureConfig>($I`ProxyEnsureConfig`)(
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
 * import { GraphitiRestoreConfig } from "@beep/repo-cli/commands/Graphiti"
 *
 * const stackDir = "/home/me/graphiti-mcp"
 * const config = GraphitiRestoreConfig.make({
 *   backupRoot: `${stackDir}/backups`,
 *   browserContainer: "graphiti-browser",
 *   browserService: "browser",
 *   composeFile: `${stackDir}/docker-compose.yml`,
 *   dataDir: `${stackDir}/data`,
 *   envFile: `${stackDir}/.env`,
 *   falkorContainer: "graphiti-falkordb",
 *   falkorService: "falkordb",
 *   graphName: "beep_dev",
 *   graphitiContainer: "graphiti-mcp",
 *   graphitiService: "graphiti",
 *   projectName: "graphiti",
 *   proxyHealthUrl: "http://127.0.0.1:8123/healthz",
 *   proxyMcpUrl: "http://127.0.0.1:8123/mcp",
 *   stackDir,
 *   upstreamMcpUrl: "http://127.0.0.1:8000/mcp",
 *   waitSeconds: 180,
 * })
 *
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
