/**
 * Targets and the per-app packaging spec for `.mcpb` bundles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpbKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $McpbKitId.create("McpbKit.models");

/**
 * A platform an `.mcpb` bundle is built for.
 *
 * **Example** (Check a target)
 *
 * ```ts
 * import { McpbTarget } from "@beep/mcpb-kit"
 *
 * console.log(McpbTarget.is["linux-x64"]("linux-x64")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbTarget = LiteralKit(["linux-x64", "windows-x64"]).pipe(
  $I.annoteSchema("McpbTarget", {
    description: "A platform an .mcpb bundle is built for.",
  })
);

/**
 * Decoded type of {@link McpbTarget}.
 *
 * **Example** (Type a target)
 *
 * ```ts
 * import type { McpbTarget } from "@beep/mcpb-kit"
 *
 * const target: McpbTarget = "windows-x64"
 * console.log(target)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbTarget = typeof McpbTarget.Type;

/**
 * The `--target` choice of a packaging command: one platform, or `all`.
 *
 * **Example** (Check a selection)
 *
 * ```ts
 * import { McpbTargetSelection } from "@beep/mcpb-kit"
 *
 * console.log(McpbTargetSelection.is.all("all")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbTargetSelection = LiteralKit(["all", "linux-x64", "windows-x64"]).pipe(
  $I.annoteSchema("McpbTargetSelection", {
    description: "The --target choice of a packaging command: one platform, or all.",
  })
);

/**
 * Decoded type of {@link McpbTargetSelection}.
 *
 * **Example** (Type a selection)
 *
 * ```ts
 * import type { McpbTargetSelection } from "@beep/mcpb-kit"
 *
 * const selection: McpbTargetSelection = "all"
 * console.log(selection)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbTargetSelection = typeof McpbTargetSelection.Type;

/**
 * The Node platform name an `.mcpb` manifest declares compatibility with.
 *
 * **Example** (Check a platform)
 *
 * ```ts
 * import { McpbPlatform } from "@beep/mcpb-kit"
 *
 * console.log(McpbPlatform.is.win32("win32")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbPlatform = LiteralKit(["linux", "win32"]).pipe(
  $I.annoteSchema("McpbPlatform", {
    description: "The Node platform name an .mcpb manifest declares compatibility with.",
  })
);

/**
 * Decoded type of {@link McpbPlatform}.
 *
 * **Example** (Type a platform)
 *
 * ```ts
 * import type { McpbPlatform } from "@beep/mcpb-kit"
 *
 * const platform: McpbPlatform = "linux"
 * console.log(platform)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbPlatform = typeof McpbPlatform.Type;

/**
 * How one target is compiled and which executable it ships.
 *
 * **Example** (Describe the Linux target)
 *
 * ```ts
 * import { McpbTargetSpec } from "@beep/mcpb-kit"
 *
 * const spec = McpbTargetSpec.make({
 *   target: "linux-x64",
 *   bunTarget: "bun-linux-x64",
 *   executable: "example-mcp",
 *   nativePackage: "node-bindings-linux-x64",
 *   platform: "linux",
 * })
 * console.log(spec.executable) // "example-mcp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbTargetSpec extends S.Opaque<McpbTargetSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    target: McpbTarget.annotateKey({ description: "The platform this spec builds." }),
    bunTarget: S.NonEmptyString.annotateKey({ description: "The `bun build --compile --target` value." }),
    executable: S.NonEmptyString.annotateKey({ description: "File name of the compiled executable in the bundle." }),
    nativePackage: S.NonEmptyString.annotateKey({
      description: "The `@duckdb/<name>` native bindings package shipped beside the executable.",
    }),
    platform: McpbPlatform.annotateKey({ description: "The platform the manifest declares." }),
  }).pipe(
    $I.annoteSchema("McpbTargetSpec", {
      description: "How one target is compiled and which executable it ships.",
    })
  )
) {}

/**
 * The kind of value a Claude Desktop extension setting holds.
 *
 * **Example** (Check a setting type)
 *
 * ```ts
 * import { McpbUserConfigType } from "@beep/mcpb-kit"
 *
 * console.log(McpbUserConfigType.is.directory("directory")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbUserConfigType = LiteralKit(["string", "number", "boolean", "directory", "file"]).pipe(
  $I.annoteSchema("McpbUserConfigType", {
    description: "The kind of value a Claude Desktop extension setting holds.",
  })
);

/**
 * Decoded type of {@link McpbUserConfigType}.
 *
 * **Example** (Type a setting type)
 *
 * ```ts
 * import type { McpbUserConfigType } from "@beep/mcpb-kit"
 *
 * const type: McpbUserConfigType = "directory"
 * console.log(type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbUserConfigType = typeof McpbUserConfigType.Type;

/**
 * One extension setting the user fills in when installing the bundle.
 *
 * **Example** (Declare an optional folder setting)
 *
 * ```ts
 * import { McpbUserConfigField } from "@beep/mcpb-kit"
 *
 * const field = McpbUserConfigField.make({
 *   type: "directory",
 *   title: "Data folder",
 *   description: "Optional folder the server reads.",
 *   required: false,
 * })
 * console.log(field.required) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbUserConfigField extends S.Opaque<McpbUserConfigField, { readonly brand: unique symbol }>()(
  S.Struct({
    type: McpbUserConfigType.annotateKey({ description: "The kind of value the setting holds." }),
    title: S.NonEmptyString.annotateKey({ description: "Setting label shown in Claude Desktop." }),
    description: S.NonEmptyString.annotateKey({ description: "Help text shown under the setting." }),
    required: S.Boolean.annotateKey({ description: "Whether the extension refuses to start without it." }),
  }).pipe(
    $I.annoteSchema("McpbUserConfigField", {
      description: "One extension setting the user fills in when installing the bundle.",
    })
  )
) {}

/**
 * One tool the bundle's server declares in its manifest.
 *
 * **Example** (Declare a tool)
 *
 * ```ts
 * import { McpbTool } from "@beep/mcpb-kit"
 *
 * const tool = McpbTool.make({ name: "kg_find", description: "Find knowledge-graph nodes." })
 * console.log(tool.name) // "kg_find"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbTool extends S.Opaque<McpbTool, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Tool name as the server registers it." }),
    description: S.String.annotateKey({ description: "One-line tool description." }),
  }).pipe(
    $I.annoteSchema("McpbTool", {
      description: "One tool the bundle's server declares in its manifest.",
    })
  )
) {}

/**
 * One prompt template the bundle declares in its manifest (MCPB `prompts`).
 *
 * **Example** (Declare a prompt)
 *
 * ```ts
 * import { McpbPrompt } from "@beep/mcpb-kit"
 *
 * const prompt = McpbPrompt.make({ name: "onboard", description: "Set up this computer.", text: "Follow the steps." })
 * console.log(prompt.name) // "onboard"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbPrompt extends S.Opaque<McpbPrompt, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Prompt name as the server registers it." }),
    description: S.String.annotateKey({ description: "One-line prompt description." }),
    text: S.NonEmptyString.annotateKey({ description: "The prompt text." }),
  }).pipe(
    $I.annoteSchema("McpbPrompt", {
      description: "One prompt template the bundle's server declares in its manifest.",
    })
  )
) {}

/**
 * The app-specific fields of an `.mcpb` `manifest.json`.
 *
 * **Details**
 *
 * The kit fills in the rest: manifest version `0.3`, author, repository,
 * license, the target platform, and a binary server whose command is the
 * bundled executable. `env` gains `NODE_PATH` pointing at the bundled
 * `node_modules`, and its keys are written in sorted order. `prompts` is
 * written only when it is non-empty.
 *
 * **Example** (Describe an app's manifest)
 *
 * ```ts
 * import { McpbManifestFields } from "@beep/mcpb-kit"
 *
 * const fields = McpbManifestFields.make({
 *   name: "beep-example",
 *   displayName: "Beep Example",
 *   version: "0.1.0",
 *   description: "An example server.",
 *   env: { DATA_DIR: "${user_config.data_dir}" },
 *   userConfig: {},
 *   tools: [],
 * })
 * console.log(fields.displayName) // "Beep Example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbManifestFields extends S.Opaque<McpbManifestFields, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.annotateKey({ description: "Extension id." }),
    displayName: S.NonEmptyString.annotateKey({ description: "Extension name shown in Claude Desktop." }),
    version: S.NonEmptyString.annotateKey({ description: "Extension version." }),
    description: S.NonEmptyString.annotateKey({ description: "One-paragraph extension description." }),
    env: S.Record(S.String, S.String).annotateKey({
      description: "Environment the server starts with; values may reference `${user_config.<key>}`.",
    }),
    userConfig: S.Record(S.String, McpbUserConfigField).annotateKey({
      description: "Settings the user fills in, keyed by the name `${user_config.<key>}` references.",
    }),
    tools: S.Array(McpbTool).annotateKey({ description: "Tools the server declares." }),
    prompts: S.Array(McpbPrompt)
      .pipe(S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({ description: "Prompt templates the server declares; omitted from the manifest when empty." }),
  }).pipe(
    $I.annoteSchema("McpbManifestFields", {
      description: "The app-specific fields of an .mcpb manifest.json.",
    })
  )
) {}

/**
 * The per-app part of an `.mcpb` packaging command.
 *
 * **Details**
 *
 * `appName` names the app directory under `apps/`, the executable (with
 * `.exe` on Windows), the archive (`<appName>-<target>.mcpb`) and the default
 * output directory (`apps/<appName>/dist/mcpb`). The compiled entrypoint is
 * `apps/<appName>/src/bin.ts`.
 *
 * **Example** (Describe an app's packaging)
 *
 * ```ts
 * import { McpbManifestFields, McpbPackageSpec } from "@beep/mcpb-kit"
 *
 * const spec = McpbPackageSpec.make({
 *   appName: "example-mcp",
 *   commandName: "example-package",
 *   repoRoot: "/repo",
 *   forbiddenArchiveFragments: ["package.ts", "src/"],
 *   manifest: McpbManifestFields.make({
 *     name: "beep-example",
 *     displayName: "Beep Example",
 *     version: "0.1.0",
 *     description: "An example server.",
 *     env: {},
 *     userConfig: {},
 *     tools: [],
 *   }),
 * })
 * console.log(spec.appName) // "example-mcp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbPackageSpec extends S.Opaque<McpbPackageSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    appName: S.NonEmptyString.annotateKey({
      description: "The app directory under apps/, also the executable and archive base name.",
    }),
    commandName: S.NonEmptyString.annotateKey({ description: "Name of the packaging command." }),
    repoRoot: S.NonEmptyString.annotateKey({ description: "Absolute path of the repository root." }),
    forbiddenArchiveFragments: S.Array(S.String).annotateKey({
      description: "Substrings that must not appear in any archive entry; a match deletes the archive and fails.",
    }),
    manifest: McpbManifestFields.annotateKey({ description: "The app-specific manifest fields." }),
  }).pipe(
    $I.annoteSchema("McpbPackageSpec", {
      description: "The per-app part of an .mcpb packaging command.",
    })
  )
) {}

/**
 * A complete `.mcpb` `manifest.json`, in the field order the kit writes it.
 *
 * **Example** (Check a manifest version)
 *
 * ```ts
 * import { McpbManifest } from "@beep/mcpb-kit"
 *
 * console.log(McpbManifest.fields.manifest_version.literal) // "0.3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbManifest extends S.Opaque<McpbManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    manifest_version: S.Literal("0.3"),
    name: S.String,
    display_name: S.String,
    version: S.String,
    description: S.String,
    author: S.Struct({ name: S.String }),
    repository: S.Struct({ type: S.Literal("git"), url: S.String }),
    license: S.String,
    compatibility: S.Struct({ platforms: S.Array(McpbPlatform) }),
    server: S.Struct({
      type: S.Literal("binary"),
      entry_point: S.String,
      mcp_config: S.Struct({ command: S.String, env: S.Record(S.String, S.String) }),
    }),
    user_config: S.Record(
      S.String,
      S.Struct({ type: McpbUserConfigType, title: S.String, description: S.String, required: S.Boolean })
    ),
    tools: S.Array(S.Struct({ name: S.String, description: S.String })),
    prompts: S.Struct({ name: S.String, description: S.String, text: S.String }).pipe(S.Array, S.optionalKey),
  }).pipe(
    $I.annoteSchema("McpbManifest", {
      description: "A complete .mcpb manifest.json, in the field order the kit writes it.",
    })
  )
) {}
