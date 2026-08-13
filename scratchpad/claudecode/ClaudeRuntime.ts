/**
 * Prewired ManagedRuntime for effect-claudecode programs.
 *
 * `ClaudeRuntime` bundles the platform services most library consumers
 * otherwise have to wire manually (`FileSystem`, `Path`, and logger
 * configuration) into a reusable `ManagedRuntime`. Callers may replace the
 * platform layer for tests and merge in additional services for their own
 * programs.
 *
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem";
import * as NodePath from "@effect/platform-node-shared/NodePath";
import type * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Match from "effect/Match";
import type * as Path from "effect/Path";
import * as References from "effect/References";

import * as ClaudeProject from "./ClaudeProject.ts";

const $I = $ScratchpadId.create("claudecode/ClaudeRuntime");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The baseline services every default Claude runtime provides.
 *
 * **Example** (Name the baseline services)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * type Services = ClaudeRuntime.BaseServices
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BaseServices = FileSystem.FileSystem | Path.Path;

/**
 * Logger presets for `ClaudeRuntime.layer` / `ClaudeRuntime.make`.
 *
 * **Example** (Select a logger preset)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const logger = ClaudeRuntime.LoggerKind.Enum.pretty
 * console.log(logger) // "pretty"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LoggerKind = LiteralKit(["default", "pretty", "json", "logFmt", "structured", "none"]).pipe(
  $I.annoteSchema("LoggerKind", {
    description: "Logger preset installed by a Claude runtime.",
  })
);

/**
 * Logger preset installed by a Claude runtime.
 *
 * **Example** (Constrain a logger preset)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * const logger = "json" satisfies ClaudeRuntime.LoggerKind
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LoggerKind = typeof LoggerKind.Type;

/**
 * Runtime construction options.
 *
 * `platformLayer` replaces the default Node-backed `FileSystem` / `Path`
 * layer, which is useful in tests. `layer` merges in additional services.
 *
 * **Example** (Configure a runtime)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * const options = { logger: "pretty" } satisfies ClaudeRuntime.RuntimeOptions
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface RuntimeOptions<R = never, E = never, EP = never> {
  readonly platformLayer?: Layer.Layer<BaseServices, EP, never>;
  readonly layer?: Layer.Layer<R, E, never>;
  readonly logger?: LoggerKind;
  readonly mergeWithExistingLoggers?: boolean;
  readonly memoMap?: Layer.MemoMap;
}

/**
 * Runtime construction options for `ClaudeRuntime.project(...)`.
 *
 * Adds the cached `ClaudeProject` service for one concrete project root while
 * preserving the same platform / logger overrides as `ClaudeRuntime.make(...)`.
 *
 * **Example** (Configure a project runtime)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * const options = { cwd: "/repo" } satisfies ClaudeRuntime.ProjectRuntimeOptions
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface ProjectRuntimeOptions<R = never, E = never, EP = never> extends RuntimeOptions<R, E, EP> {
  readonly cwd: string;
  readonly pluginRoot?: string;
  readonly mcpPath?: string;
}

/**
 * Runtime construction options for `ClaudeRuntime.plugin(...)`.
 *
 * Like `ClaudeRuntime.project(...)`, but requires an explicit plugin root so
 * plugin scans and named component lookups resolve against the plugin
 * directory instead of the project root.
 *
 * **Example** (Configure a plugin runtime)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * const options = {
 *   cwd: "/repo",
 *   pluginRoot: "/repo/.claude-plugin"
 * } satisfies ClaudeRuntime.PluginRuntimeOptions
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PluginRuntimeOptions<R = never, E = never, EP = never> extends RuntimeOptions<R, E, EP> {
  readonly cwd: string;
  readonly pluginRoot: string;
  readonly mcpPath?: string;
}

/**
 * Managed runtime returned by `ClaudeRuntime.make`.
 *
 * **Example** (Name the runtime interface)
 *
 * ```ts
 * import type { ClaudeRuntime } from "effect-claudecode"
 *
 * type Runtime = ClaudeRuntime.Runtime
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Runtime<R = never, E = never> extends ManagedRuntime.ManagedRuntime<BaseServices | R, E> {
  readonly layer: Layer.Layer<BaseServices | R, E, never>;
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/**
 * The default platform layer for effect-claudecode programs.
 *
 * **Example** (Inspect the platform layer)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const platform = ClaudeRuntime.baseLayer
 * console.log(platform)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const baseLayer: Layer.Layer<BaseServices> = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const loggerLayer = (kind: LoggerKind, mergeWithExistingLoggers: boolean): Layer.Layer<never> => {
  const configured = (logger: Logger.Logger<unknown, void>) =>
    Logger.layer([Logger.tracerLogger, logger], {
      mergeWithExisting: mergeWithExistingLoggers,
    });

  return Match.value(kind).pipe(
    Match.when("none", () => Layer.succeed(References.MinimumLogLevel, "None")),
    Match.when("json", () => configured(Logger.consoleJson)),
    Match.when("logFmt", () => configured(Logger.consoleLogFmt)),
    Match.when("structured", () => configured(Logger.consoleStructured)),
    Match.when("pretty", () => configured(Logger.consolePretty())),
    Match.when("default", () => configured(Logger.consolePretty())),
    Match.exhaustive
  );
};

/**
 * Build the full layer used by the shared runtime.
 *
 * **Example** (Build a runtime layer)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtimeLayer = ClaudeRuntime.layer({ logger: "json" })
 * console.log(runtimeLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = <R = never, E = never, EP = never>(
  options?: RuntimeOptions<R, E, EP>
): Layer.Layer<BaseServices | R, E | EP, never> => {
  const platformLayer = options?.platformLayer ?? baseLayer;
  const extraLayer = options?.layer ?? Layer.empty;
  return Layer.mergeAll(
    platformLayer,
    extraLayer,
    loggerLayer(options?.logger ?? "default", options?.mergeWithExistingLoggers ?? false)
  );
};

const mergeExtraLayer = <R = never, E = never, EP = never>(options: {
  readonly projectLayer: Layer.Layer<ClaudeProject.Service, EP, never>;
  readonly extraLayer?: Layer.Layer<R, E, never>;
}): Layer.Layer<ClaudeProject.Service | R, E | EP, never> =>
  Layer.mergeAll(options.projectLayer, options.extraLayer ?? Layer.empty);

const projectRuntimeLayer = <R = never, E = never, EP = never>(
  options: ProjectRuntimeOptions<R, E, EP>
): Layer.Layer<BaseServices | ClaudeProject.Service | R, E | EP, never> =>
  (() => {
    const platformLayer = options.platformLayer ?? baseLayer;
    const projectOptions: ClaudeProject.ClaudeProjectOptions = {
      cwd: options.cwd,
      ...(options.pluginRoot === undefined ? {} : { pluginRoot: options.pluginRoot }),
      ...(options.mcpPath === undefined ? {} : { mcpPath: options.mcpPath }),
    };
    const runtimeOptions: RuntimeOptions<ClaudeProject.Service | R, E | EP, EP> = {
      platformLayer,
      layer: mergeExtraLayer({
        projectLayer: ClaudeProject.layer(projectOptions).pipe(Layer.provide(platformLayer)),
        ...(options.layer === undefined ? {} : { extraLayer: options.layer }),
      }),
      ...(options.logger === undefined ? {} : { logger: options.logger }),
      ...(options.mergeWithExistingLoggers === undefined
        ? {}
        : {
            mergeWithExistingLoggers: options.mergeWithExistingLoggers,
          }),
    };
    return layer({
      ...runtimeOptions,
    });
  })();

// ---------------------------------------------------------------------------
// Managed runtime constructors
// ---------------------------------------------------------------------------

const fromLayer = <R = never, E = never>(
  runtimeLayer: Layer.Layer<BaseServices | R, E, never>,
  memoMap?: Layer.MemoMap
): Runtime<R, E> => {
  const runtime = ManagedRuntime.make(runtimeLayer, { memoMap });
  return {
    ...runtime,
    layer: runtimeLayer,
  };
};

/**
 * Create a prewired `ManagedRuntime` for effect-claudecode programs.
 *
 * **Example** (Create and dispose a runtime)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.make({ logger: "none" })
 * console.log(runtime.layer)
 * await runtime.dispose()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const make = <R = never, E = never, EP = never>(options?: RuntimeOptions<R, E, EP>): Runtime<R, E | EP> =>
  fromLayer(layer(options), options?.memoMap);

/**
 * Alias for `make` that highlights the default setup.
 *
 * **Example** (Create the default runtime)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.defaultRuntime()
 * console.log(runtime.layer)
 * await runtime.dispose()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const defaultRuntime = <R = never, E = never, EP = never>(
  options?: RuntimeOptions<R, E, EP>
): Runtime<R, E | EP> => make(options);

/**
 * Create a prewired runtime that also includes the cached `ClaudeProject`
 * service for one project root.
 *
 * This is the recommended entry point for project-aware scripts that need
 * settings, `.mcp.json`, or plugin component lookups in addition to the base
 * platform services.
 *
 * **Example** (Create a project runtime)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.project({ cwd: "/repo" })
 * console.log(runtime.layer)
 * await runtime.dispose()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const project = <R = never, E = never, EP = never>(
  options: ProjectRuntimeOptions<R, E, EP>
): Runtime<ClaudeProject.Service | R, E | EP> => fromLayer(projectRuntimeLayer(options), options.memoMap);

/**
 * Create a prewired runtime for plugin-aware scripts.
 *
 * Compared with `ClaudeRuntime.project(...)`, this preset requires an explicit
 * `pluginRoot` so `ClaudeProject.plugin` and named component lookups read from
 * the plugin directory rather than the project root.
 *
 * **Example** (Create a plugin runtime)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.plugin({
 *   cwd: "/repo",
 *   pluginRoot: "/repo/.claude-plugin"
 * })
 * console.log(runtime.layer)
 * await runtime.dispose()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const plugin = <R = never, E = never, EP = never>(
  options: PluginRuntimeOptions<R, E, EP>
): Runtime<ClaudeProject.Service | R, E | EP> => project(options);

/**
 * Alias retained for ergonomic call sites: `ClaudeRuntime.default(...)`.
 *
 * **Example** (Use the default alias)
 *
 * ```ts
 * import { ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.default()
 * await runtime.dispose()
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export { defaultRuntime as default };
