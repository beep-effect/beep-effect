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
 * @example
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
 * @example
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
 * @example
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
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const project = Effect.service(ClaudeProject.Service)
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
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 *
 * const projectLayer = ClaudeProject.layer({ cwd: process.cwd() })
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
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const cwd = Effect.map(ClaudeProject.project, (service) => service.cwd)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const project: Effect.Effect<Interface, never, Service> = Effect.service(Service);

/**
 * Effectful access to the cached settings loader.
 *
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 *
 * const settings = ClaudeProject.settings
 * console.log(settings)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const settings = Effect.flatMap(project, (current) => current.settings);

/**
 * Effectful access to the cached optional MCP config.
 *
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 *
 * const mcp = ClaudeProject.mcp
 * console.log(mcp)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const mcp = Effect.flatMap(project, (current) => current.mcp);

/**
 * Effectful access to the cached plugin definition.
 *
 * @example
 * ```ts
 * import { ClaudeProject } from "effect-claudecode"
 *
 * const plugin = ClaudeProject.plugin
 * console.log(plugin)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const plugin = Effect.flatMap(project, (current) => current.plugin);
