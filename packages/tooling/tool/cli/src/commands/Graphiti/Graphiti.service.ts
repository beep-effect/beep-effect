/**
 * Service facade for Graphiti operational commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import {
  ensureGraphitiProxy as ensureGraphitiProxyInternal,
  recoverGraphitiStack as recoverGraphitiStackInternal,
} from "./internal/ProxyEnsure.ts";
import { installGraphitiProxyService as installGraphitiProxyServiceInternal } from "./internal/ProxyServiceInstall.ts";
import {
  restoreGraphitiStack as restoreGraphitiStackInternal,
  verifyGraphitiStack as verifyGraphitiStackInternal,
} from "./internal/StackRestore.ts";
import type { GraphitiProxyOpsError } from "./Graphiti.errors.ts";
import type {
  GraphitiProxyOpsEnvironment,
  GraphitiProxyServiceInstallOptions,
  GraphitiRestoreOptions,
} from "./Graphiti.schemas.ts";

const $I = $RepoCliId.create("commands/Graphiti/Graphiti.service");

/**
 * Service contract for Graphiti proxy and stack operations.
 *
 * @example
 * ```ts
 * import { GraphitiCommandService } from "@beep/repo-cli/commands/Graphiti"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(GraphitiCommandService, (service) => service.verify({}))
 * console.log(program.pipe !== undefined)
 * ```
 * @category services
 * @since 0.0.0
 */
interface GraphitiCommandServiceShape {
  readonly ensure: Effect.Effect<void, GraphitiProxyOpsError>;
  readonly install: (options?: GraphitiProxyServiceInstallOptions) => Effect.Effect<void, GraphitiProxyOpsError>;
  readonly recover: (options?: {
    readonly dryRun?: boolean;
    readonly force?: boolean;
  }) => Effect.Effect<void, GraphitiProxyOpsError>;
  readonly restore: (options?: GraphitiRestoreOptions) => Effect.Effect<void, GraphitiProxyOpsError>;
  readonly verify: (options?: Pick<GraphitiRestoreOptions, "stackDir">) => Effect.Effect<void, GraphitiProxyOpsError>;
}

/**
 * Service tag for Graphiti proxy and stack operations.
 *
 * @example
 * ```ts
 * import { GraphitiCommandService } from "@beep/repo-cli/commands/Graphiti"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(GraphitiCommandService, (service) => service.ensure)
 * console.log(program.pipe !== undefined)
 * ```
 * @category services
 * @since 0.0.0
 */
export class GraphitiCommandService extends Context.Service<GraphitiCommandService, GraphitiCommandServiceShape>()(
  $I`GraphitiCommandService`
) {}

const makeGraphitiCommandService = Effect.fn("GraphitiCommandService.make")(function* () {
  const runtimeContext = yield* Effect.context<GraphitiProxyOpsEnvironment>();

  return GraphitiCommandService.of({
    ensure: ensureGraphitiProxyInternal().pipe(Effect.provide(runtimeContext)),
    install: Effect.fn("GraphitiCommandService.install")((options) =>
      installGraphitiProxyServiceInternal(options).pipe(Effect.provide(runtimeContext))
    ),
    recover: Effect.fn("GraphitiCommandService.recover")((options) =>
      recoverGraphitiStackInternal(options).pipe(Effect.provide(runtimeContext))
    ),
    restore: Effect.fn("GraphitiCommandService.restore")((options) =>
      restoreGraphitiStackInternal(options).pipe(Effect.provide(runtimeContext))
    ),
    verify: Effect.fn("GraphitiCommandService.verify")((options) =>
      verifyGraphitiStackInternal(options).pipe(Effect.provide(runtimeContext))
    ),
  });
});

/**
 * Live Graphiti operation service layer.
 *
 * @example
 * ```ts
 * import { GraphitiCommandServiceLive } from "@beep/repo-cli/commands/Graphiti"
 *
 * const layer = GraphitiCommandServiceLive
 * console.log(layer) // example value
 * ```
 * @category layers
 * @since 0.0.0
 */
export const GraphitiCommandServiceLive: Layer.Layer<GraphitiCommandService, never, GraphitiProxyOpsEnvironment> =
  Layer.effect(GraphitiCommandService, makeGraphitiCommandService());

/**
 * Ensure the local Graphiti proxy is healthy.
 *
 * @example
 * ```ts
 * import { ensureGraphitiProxy } from "@beep/repo-cli/commands/Graphiti"
 *
 * const program = ensureGraphitiProxy()
 * console.log(program.pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const ensureGraphitiProxy = ensureGraphitiProxyInternal;

/**
 * Install the user-level Graphiti proxy service.
 *
 * @example
 * ```ts
 * import { installGraphitiProxyService } from "@beep/repo-cli/commands/Graphiti"
 *
 * const program = installGraphitiProxyService({ upstreamMcpUrl: "http://127.0.0.1:8000/mcp" })
 * console.log(program.pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const installGraphitiProxyService = installGraphitiProxyServiceInternal;

/**
 * Recover unhealthy Graphiti backing containers.
 *
 * @example
 * ```ts
 * import { recoverGraphitiStack } from "@beep/repo-cli/commands/Graphiti"
 *
 * const program = recoverGraphitiStack({ dryRun: true })
 * console.log(program.pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const recoverGraphitiStack = recoverGraphitiStackInternal;

/**
 * Restore the Graphiti backing stack and verify the proxy.
 *
 * @example
 * ```ts
 * import { restoreGraphitiStack } from "@beep/repo-cli/commands/Graphiti"
 *
 * const program = restoreGraphitiStack({ dryRun: true })
 * console.log(program.pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const restoreGraphitiStack = restoreGraphitiStackInternal;

/**
 * Verify the Graphiti backing stack and proxy MCP endpoint.
 *
 * @example
 * ```ts
 * import { verifyGraphitiStack } from "@beep/repo-cli/commands/Graphiti"
 *
 * const program = verifyGraphitiStack({})
 * console.log(program.pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const verifyGraphitiStack = verifyGraphitiStackInternal;
