/**
 * Schema for `.claude-plugin/plugin.json` Claude Code plugin manifests.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "../Settings/HooksSection.ts";

const $I = $ScratchpadId.create("claudecode/Plugin/Manifest");

/**
 * Author or owner metadata shared by plugin and marketplace manifests.
 *
 * **Example** (Create author metadata)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const author = Plugin.AuthorInfo.make({ name: "Beep" })
 *
 * console.log(author.name) // "Beep"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AuthorInfo extends S.Class<AuthorInfo>($I`AuthorInfo`)(
  {
    name: S.String,
    email: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    url: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AuthorInfo", {
    description: "Author or owner metadata in a Claude Code manifest.",
  })
) {}

/**
 * Companion types for {@link AuthorInfo}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AuthorInfo {
  /**
   * Runtime type represented by {@link AuthorInfo}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AuthorInfo;

  /**
   * JSON representation accepted by {@link AuthorInfo}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AuthorInfo.Encoded;
}

/**
 * One component path or a list of component paths.
 *
 * **Example** (Inspect component path spec)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const directory = S.decodeUnknownSync(Plugin.ComponentPathSpec)("./commands")
 * const directories = S.decodeUnknownSync(Plugin.ComponentPathSpec)(["./commands", "./extra"])
 *
 * console.log(directory) // "./commands"
 * console.log(directories) // ["./commands", "./extra"]
 * console.log(S.is(Plugin.ComponentPathSpec)(1)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComponentPathSpec = S.Union([S.String, S.String.pipe(S.Array)]).pipe(
  $I.annoteSchema("ComponentPathSpec", {
    description: "One component path or an array of component paths.",
  })
);

/**
 * Runtime type decoded by {@link ComponentPathSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ComponentPathSpec = typeof ComponentPathSpec.Type;

/**
 * Hook configuration supplied by path or inline.
 *
 * **Example** (Inspect hooks spec)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const byPath = S.decodeUnknownSync(Plugin.HooksSpec)("./hooks/hooks.json")
 * const byFiles = S.decodeUnknownSync(Plugin.HooksSpec)(["./hooks/a.json", "./hooks/b.json"])
 *
 * console.log(byPath) // "./hooks/hooks.json"
 * console.log(byFiles) // ["./hooks/a.json", "./hooks/b.json"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HooksSpec = S.Union([S.String, S.String.pipe(S.Array), HooksSection]).pipe(
  $I.annoteSchema("HooksSpec", {
    description: "Claude Code hook configuration supplied by path or inline.",
  })
);

/**
 * Runtime type decoded by {@link HooksSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HooksSpec = typeof HooksSpec.Type;

/**
 * MCP or LSP server configuration supplied by path or inline.
 *
 * **Example** (Inspect server config spec)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const byPath = S.decodeUnknownSync(Plugin.ServerConfigSpec)("./.mcp.json")
 * const inline = S.decodeUnknownSync(Plugin.ServerConfigSpec)({
 *   docs: { command: "npx" }
 * })
 *
 * console.log(byPath) // "./.mcp.json"
 * console.log(inline) // { docs: { command: "npx" } }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ServerConfigSpec = S.Union([S.String, S.String.pipe(S.Array), S.Record(S.String, S.Unknown)]).pipe(
  $I.annoteSchema("ServerConfigSpec", {
    description: "MCP or LSP server configuration supplied by path or inline.",
  })
);

/**
 * Runtime type decoded by {@link ServerConfigSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ServerConfigSpec = typeof ServerConfigSpec.Type;

/**
 * Supported user configuration value kinds.
 *
 * **Example** (Use a user configuration value kind)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.UserConfigType.is.directory("directory")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UserConfigType = LiteralKit(["string", "number", "boolean", "directory", "file"]).pipe(
  $I.annoteSchema("UserConfigType", {
    description: "Supported Claude Code plugin user-configuration value kinds.",
  })
);

/**
 * Runtime type represented by {@link UserConfigType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UserConfigType = typeof UserConfigType.Type;

/**
 * One user-facing plugin configuration entry.
 *
 * **Example** (Define a user setting)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.UserConfigEntry.make({
 *   type: "string",
 *   title: "Token",
 *   description: "Service token"
 * })
 *
 * console.log(entry.title) // "Token"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UserConfigEntry extends S.Class<UserConfigEntry>($I`UserConfigEntry`)(
  {
    type: UserConfigType,
    title: S.String,
    description: S.String,
    sensitive: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    required: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    default: S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault),
    multiple: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    min: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    max: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("UserConfigEntry", {
    description: "One user-facing Claude Code plugin configuration entry.",
  })
) {}

/**
 * Companion types for {@link UserConfigEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UserConfigEntry {
  /**
   * Runtime type represented by {@link UserConfigEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = UserConfigEntry;

  /**
   * JSON representation accepted by {@link UserConfigEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UserConfigEntry.Encoded;
}

/**
 * User configuration entries keyed by identifier.
 *
 * **Example** (Inspect user config record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const entries = S.decodeUnknownSync(Plugin.UserConfigRecord)({
 *   token: {
 *     type: "string",
 *     title: "Token",
 *     description: "Service token"
 *   }
 * })
 *
 * console.log(entries.token.title) // "Token"
 * console.log(S.is(Plugin.UserConfigRecord)({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UserConfigRecord = S.Record(S.String, UserConfigEntry).pipe(
  $I.annoteSchema("UserConfigRecord", {
    description: "Plugin user configuration entries keyed by identifier.",
  })
);

/**
 * Runtime type decoded by {@link UserConfigRecord}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UserConfigRecord = typeof UserConfigRecord.Type;

/**
 * A plugin message-channel specification.
 *
 * **Example** (Define a message channel)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const channel = Plugin.ChannelSpec.make({ server: "notifications" })
 *
 * console.log(channel.server) // "notifications"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ChannelSpec extends S.Class<ChannelSpec>($I`ChannelSpec`)(
  {
    server: S.String,
    userConfig: S.OptionFromOptionalKey(UserConfigRecord).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ChannelSpec", {
    description: "A plugin message channel backed by one MCP server.",
  })
) {}

/**
 * Companion types for {@link ChannelSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChannelSpec {
  /**
   * Runtime type represented by {@link ChannelSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ChannelSpec;

  /**
   * JSON representation accepted by {@link ChannelSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ChannelSpec.Encoded;
}

/**
 * A named plugin dependency.
 *
 * **Example** (Declare a plugin dependency)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const dependency = Plugin.PluginDependency.make({ name: "base-plugin" })
 *
 * console.log(dependency.name) // "base-plugin"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PluginDependency extends S.Class<PluginDependency>($I`PluginDependency`)(
  {
    name: S.String,
    version: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PluginDependency", {
    description: "A named Claude Code plugin dependency.",
  })
) {}

/**
 * Companion types for {@link PluginDependency}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginDependency {
  /**
   * Runtime type represented by {@link PluginDependency}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginDependency;

  /**
   * JSON representation accepted by {@link PluginDependency}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginDependency.Encoded;
}

/**
 * A dependency expressed by name or by a structured requirement.
 *
 * **Example** (Inspect dependency spec)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const byName = S.decodeUnknownSync(Plugin.DependencySpec)("base-plugin")
 * const structured = S.decodeUnknownSync(Plugin.DependencySpec)({
 *   name: "base-plugin",
 *   version: "1.0.0"
 * })
 *
 * console.log(byName) // "base-plugin"
 * console.log(S.is(Plugin.PluginDependency)(structured) ? structured.name : structured)
 * // "base-plugin"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DependencySpec = S.Union([S.String, PluginDependency]).pipe(
  $I.annoteSchema("DependencySpec", {
    description: "A plugin dependency name or structured version requirement.",
  })
);

/**
 * Runtime type decoded by {@link DependencySpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DependencySpec = typeof DependencySpec.Type;

/**
 * Experimental plugin component paths.
 *
 * **Example** (Create experimental spec)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { Plugin } from "effect-claudecode"
 *
 * const experimental = Plugin.ExperimentalSpec.make({
 *   themes: O.some("./themes")
 * })
 * console.log(experimental.themes)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ExperimentalSpec extends S.Class<ExperimentalSpec>($I`ExperimentalSpec`)(
  {
    themes: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    monitors: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExperimentalSpec", {
    description: "Experimental theme and monitor component paths.",
  })
) {}

/**
 * Companion types for {@link ExperimentalSpec}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExperimentalSpec {
  /**
   * Runtime type represented by {@link ExperimentalSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ExperimentalSpec;

  /**
   * JSON representation accepted by {@link ExperimentalSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ExperimentalSpec.Encoded;
}

/**
 * A Claude Code plugin manifest.
 *
 * **Example** (Create a minimal manifest)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const manifest = Plugin.PluginManifest.make({ name: "example-plugin" })
 *
 * console.log(manifest.name) // "example-plugin"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PluginManifest extends S.Class<PluginManifest>($I`PluginManifest`)(
  {
    name: S.String,
    $schema: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    version: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    displayName: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    defaultEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    author: S.OptionFromOptionalKey(AuthorInfo).pipe(SchemaUtils.withNoneDefault),
    homepage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    repository: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    license: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    keywords: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    dependencies: S.OptionFromOptionalKey(DependencySpec.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    experimental: S.OptionFromOptionalKey(ExperimentalSpec).pipe(SchemaUtils.withNoneDefault),
    commands: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    agents: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    skills: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    outputStyles: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSpec).pipe(SchemaUtils.withNoneDefault),
    mcpServers: S.OptionFromOptionalKey(ServerConfigSpec).pipe(SchemaUtils.withNoneDefault),
    lspServers: S.OptionFromOptionalKey(ServerConfigSpec).pipe(SchemaUtils.withNoneDefault),
    userConfig: S.OptionFromOptionalKey(UserConfigRecord).pipe(SchemaUtils.withNoneDefault),
    channels: S.OptionFromOptionalKey(ChannelSpec.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PluginManifest", {
    description: "Claude Code plugin metadata and component locations.",
  })
) {}

/**
 * Companion types for {@link PluginManifest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginManifest {
  /**
   * Runtime type represented by {@link PluginManifest}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginManifest;

  /**
   * JSON representation accepted by {@link PluginManifest}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginManifest.Encoded;
}
