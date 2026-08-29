/**
 * Project-scoped cached loaders for effect-claudecode programs.
 *
 * `ClaudeProject` centralizes repeated reads of the current repository's Claude
 * Code state (`settings.json`, `.mcp.json`, plugin directories) behind a
 * service with explicit invalidation effects.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import type * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";

import type {
  McpConfigError,
  PluginLoadError,
  SettingsDecodeError,
  SettingsParseError,
  SettingsReadError,
} from "./Errors.ts";
import * as Mcp from "./Mcp.ts";
import * as Plugin from "./Plugin.ts";
import * as Settings from "./Settings.ts";

const $I = $ScratchpadId.create("claudecode/ClaudeProject");

/**
 * Configuration for {@link layer}.
 *
 * **Example** (Configure a project root)
 *
 * ```ts
 * import type { ClaudeProject } from "effect-claudecode"
 *
 * const options = { cwd: "/repo" } satisfies ClaudeProject.ClaudeProjectOptions
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface ClaudeProjectOptions {
  readonly cwd: string;
  readonly pluginRoot?: string;
  readonly mcpPath?: string;
}

/**
 * Explicit cache invalidators for the project service.
 *
 * **Example** (Describe cache invalidators)
 *
 * ```ts
 * import type { ClaudeProject } from "effect-claudecode"
 *
 * type Invalidators = ClaudeProject.ClaudeProjectInvalidate
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ClaudeProjectInvalidate {
  readonly settings: Effect.Effect<void>;
  readonly mcp: Effect.Effect<void>;
  readonly plugin: Effect.Effect<void>;
  readonly all: Effect.Effect<void>;
}

/**
 * Project-scoped Claude Code resources.
 *
 * **Example** (Describe project resources)
 *
 * ```ts
 * import type { ClaudeProject } from "effect-claudecode"
 *
 * type Project = ClaudeProject.Interface
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface Interface {
  readonly cwd: string;
  readonly pluginRoot: string;
  readonly mcpPath: string;
  readonly settings: Effect.Effect<
    Settings.SettingsFile,
    Config.ConfigError | SettingsReadError | SettingsParseError | SettingsDecodeError
  >;
  readonly mcp: Effect.Effect<O.Option<Mcp.McpJsonFile>, McpConfigError>;
  readonly plugin: Effect.Effect<Plugin.LoadedPlugin, PluginLoadError>;
  readonly skill: (name: string) => Effect.Effect<O.Option<Plugin.PluginSkillEntry>, PluginLoadError>;
  readonly command: (name: string) => Effect.Effect<O.Option<Plugin.PluginCommandEntry>, PluginLoadError>;
  readonly agent: (name: string) => Effect.Effect<O.Option<Plugin.PluginAgentEntry>, PluginLoadError>;
  readonly outputStyle: (name: string) => Effect.Effect<O.Option<Plugin.PluginOutputStyleEntry>, PluginLoadError>;
  readonly invalidate: ClaudeProjectInvalidate;
}

/**
 * Project-scoped Claude Code service.
 *
 * **Example** (Access the project service)
 *
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const cwd = Effect.service(ClaudeProject.Service).pipe(
 *   Effect.map((project) => project.cwd)
 * )
 * console.log(cwd)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

const providePlatform =
  (fs: FileSystem.FileSystem, path: Path.Path) =>
  <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): Effect.Effect<A, E> =>
    effect.pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));

/**
 * Construct a project service layer.
 *
 * **Example** (Build a project layer)
 *
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 * import * as Layer from "effect/Layer"
 *
 * const projectLayer = ClaudeProject.layer({ cwd: process.cwd() })
 * console.log(Layer.isLayer(projectLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (options: ClaudeProjectOptions): Layer.Layer<Service, never, FileSystem.FileSystem | Path.Path> =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const pluginRoot = options.pluginRoot ?? options.cwd;
      const mcpPath = options.mcpPath ?? path.join(options.cwd, ".mcp.json");
      const provide = providePlatform(fs, path);

      const [settings, invalidateSettings] = yield* Effect.cachedInvalidateWithTTL(
        provide(Settings.load(options.cwd)),
        Duration.infinity
      );
      const [mcp, invalidateMcp] = yield* Effect.cachedInvalidateWithTTL(
        provide(
          Effect.gen(function* () {
            const effective = yield* Mcp.loadEffective(options.cwd, {
              projectMcpPath: mcpPath,
            });
            return R.isEmptyReadonlyRecord(effective.mcpServers) ? O.none<Mcp.McpJsonFile>() : O.some(effective);
          })
        ),
        Duration.infinity
      );
      const [plugin, invalidatePlugin] = yield* Effect.cachedInvalidateWithTTL(
        provide(Plugin.load(pluginRoot)),
        Duration.infinity
      );

      const skill = Effect.fn("ClaudeProject.skill")((name: string) =>
        plugin.pipe(Effect.map((loaded) => A.findFirst(loaded.skills, (entry) => entry.name === name)))
      );
      const command = Effect.fn("ClaudeProject.command")((name: string) =>
        plugin.pipe(Effect.map((loaded) => A.findFirst(loaded.commands, (entry) => entry.name === name)))
      );
      const agent = Effect.fn("ClaudeProject.agent")((name: string) =>
        plugin.pipe(Effect.map((loaded) => A.findFirst(loaded.agents, (entry) => entry.name === name)))
      );
      const outputStyle = Effect.fn("ClaudeProject.outputStyle")((name: string) =>
        plugin.pipe(Effect.map((loaded) => A.findFirst(loaded.outputStyles, (entry) => entry.name === name)))
      );

      return Service.of({
        cwd: options.cwd,
        pluginRoot,
        mcpPath,
        settings,
        mcp,
        plugin,
        skill,
        command,
        agent,
        outputStyle,
        invalidate: {
          settings: invalidateSettings,
          mcp: invalidateMcp,
          plugin: invalidatePlugin,
          all: Effect.all([invalidateSettings, invalidateMcp, invalidatePlugin]).pipe(Effect.asVoid),
        },
      });
    })
  );

/**
 * Effectful access to the full project service.
 *
 * **Example** (Read the project root)
 *
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const cwd = Effect.map(ClaudeProject.project, (service) => service.cwd)
 * console.log(cwd)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const project: Effect.Effect<Interface, never, Service> = Effect.service(Service);

/**
 * Effectful access to the cached settings loader.
 *
 * **Example** (Load project settings)
 *
 * ```ts
 * import { ClaudeProject, ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.project({ cwd: process.cwd() })
 * const loaded = await runtime.runPromise(ClaudeProject.settings)
 * console.log(loaded.permissions)
 * await runtime.dispose()
 * ```
 *
 * @effects Requires {@link Service} and reads the cached settings document; may fail with settings I/O or decode errors.
 * @category getters
 * @since 0.0.0
 */
export const settings = Effect.flatMap(project, (current) => current.settings);

/**
 * Effectful access to the cached optional MCP config.
 *
 * **Example** (Inspect effective MCP configuration)
 *
 * ```ts
 * import { ClaudeProject, ClaudeRuntime } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const runtime = ClaudeRuntime.project({ cwd: process.cwd() })
 * const loaded = await runtime.runPromise(ClaudeProject.mcp)
 * console.log(O.isSome(loaded))
 * await runtime.dispose()
 * ```
 *
 * @effects Requires {@link Service} and reads the cached MCP configuration; may fail with {@link McpConfigError}.
 * @category getters
 * @since 0.0.0
 */
export const mcp = Effect.flatMap(project, (current) => current.mcp);

/**
 * Effectful access to the cached plugin definition.
 *
 * **Example** (Inspect a loaded plugin)
 *
 * ```ts
 * import { ClaudeProject, ClaudeRuntime } from "effect-claudecode"
 *
 * const runtime = ClaudeRuntime.project({ cwd: process.cwd() })
 * const loaded = await runtime.runPromise(ClaudeProject.plugin)
 * console.log(loaded.skills.length)
 * await runtime.dispose()
 * ```
 *
 * @effects Requires {@link Service} and reads the cached plugin tree; may fail with {@link PluginLoadError}.
 * @category getters
 * @since 0.0.0
 */
export const plugin = Effect.flatMap(project, (current) => current.plugin);
