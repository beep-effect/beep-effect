/**
 * Targets and the per-app packaging spec for `.mcpb` bundles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpbKitId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
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
 * A pinned official Bun release archive and the runtime executable inside it.
 *
 * **Details**
 *
 * The release archive is `<asset>.zip` and holds the runtime at
 * `<asset>/<executable>`. `version` must equal the repository's
 * `.bun-version`: the script bundle is built by that Bun and runs on the same
 * one. `sha256` is the value the release's `SHASUMS256.txt` publishes for the
 * archive.
 *
 * **Example** (Describe a pinned runtime)
 *
 * ```ts
 * import { McpbRuntimePin } from "@beep/mcpb-kit"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const pin = McpbRuntimePin.make({
 *   version: "1.4.4",
 *   asset: "bun-windows-x64",
 *   executable: "bun.exe",
 *   sha256: Sha256Hex.make("cd2c0fccc78f3ede1f50ca827a15f063eda13d4d150a3d0674f4f6e323d864a5"),
 * })
 * console.log(pin.executable) // "bun.exe"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbRuntimePin extends S.Opaque<McpbRuntimePin, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.NonEmptyString.annotateKey({
      description: "Bun release version; equal to the repository's .bun-version.",
    }),
    asset: S.NonEmptyString.annotateKey({
      description: "Release asset name without `.zip`; also the folder inside the archive.",
    }),
    executable: S.NonEmptyString.annotateKey({
      description: "File name of the runtime executable, in the archive folder and in the bundle.",
    }),
    sha256: Sha256Hex.annotateKey({ description: "The sha256 the release publishes for the archive." }),
  }).pipe(
    $I.annoteSchema("McpbRuntimePin", {
      description: "A pinned official Bun release archive and the runtime executable inside it.",
    })
  )
) {}

/**
 * The ways a bundle starts its server.
 *
 * **Details**
 *
 * `compiled` ships one `bun build --compile` executable. `runtime-script`
 * ships the official Bun runtime beside a script bundle, so the only
 * executable in the bundle carries the Bun publisher's signature.
 *
 * **Example** (Check a launch kind)
 *
 * ```ts
 * import { McpbLaunchKind } from "@beep/mcpb-kit"
 *
 * console.log(McpbLaunchKind.is["runtime-script"]("runtime-script")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbLaunchKind = LiteralKit(["compiled", "runtime-script"]).pipe(
  $I.annoteSchema("McpbLaunchKind", {
    description: "The ways a bundle starts its server: a compiled executable, or a runtime plus a script.",
  })
);

/**
 * Decoded type of {@link McpbLaunchKind}.
 *
 * **Example** (Type a launch kind)
 *
 * ```ts
 * import type { McpbLaunchKind } from "@beep/mcpb-kit"
 *
 * const kind: McpbLaunchKind = "compiled"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbLaunchKind = typeof McpbLaunchKind.Type;

/**
 * What a bundle ships to start its server, and how the manifest starts it.
 *
 * **Details**
 *
 * A `compiled` launch runs `executable` with no arguments. A `runtime-script`
 * launch runs the pinned `runtime` with `runtimeArgs` followed by the path of
 * `script`; the files `bun build` emits for `with { type: "file" }` imports
 * sit beside the script.
 *
 * **Example** (Describe a signed-runtime launch)
 *
 * ```ts
 * import { McpbLaunch, mcpbWindowsRuntime } from "@beep/mcpb-kit"
 *
 * const launch = McpbLaunch.make({
 *   kind: "runtime-script",
 *   runtime: mcpbWindowsRuntime,
 *   runtimeArgs: ["--no-env-file"],
 *   script: "example-mcp.js",
 * })
 * console.log(McpbLaunch.guards["runtime-script"](launch)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const McpbLaunch = McpbLaunchKind.toTaggedUnion("kind")({
  compiled: {
    bunTarget: S.NonEmptyString.annotateKey({ description: "The `bun build --compile --target` value." }),
    executable: S.NonEmptyString.annotateKey({ description: "File name of the compiled executable in the bundle." }),
  },
  "runtime-script": {
    // Not `annotateKey`: it would trade the opaque pin for its plain struct type.
    runtime: McpbRuntimePin,
    runtimeArgs: S.Array(S.String).annotateKey({
      description: "Arguments the manifest passes to the runtime before the script path.",
    }),
    script: S.NonEmptyString.annotateKey({ description: "File name of the script bundle the runtime runs." }),
  },
}).pipe(
  $I.annoteSchema("McpbLaunch", {
    description: "What a bundle ships to start its server, and how the manifest starts it.",
  })
);

/**
 * Decoded type of {@link McpbLaunch}.
 *
 * **Example** (Type a compiled launch)
 *
 * ```ts
 * import type { McpbLaunch } from "@beep/mcpb-kit"
 *
 * const launch: McpbLaunch = { kind: "compiled", bunTarget: "bun-linux-x64", executable: "example-mcp" }
 * console.log(launch.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbLaunch = typeof McpbLaunch.Type;

/**
 * The `compiled` case of {@link McpbLaunch}: one `bun build --compile`
 * executable.
 *
 * **Example** (Type a compiled launch case)
 *
 * ```ts
 * import type { McpbCompiledLaunch } from "@beep/mcpb-kit"
 *
 * const launch: McpbCompiledLaunch = { kind: "compiled", bunTarget: "bun-windows-x64", executable: "setup.exe" }
 * console.log(launch.executable)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type McpbCompiledLaunch = typeof McpbLaunch.cases.compiled.Type;

/**
 * What one target ships: its launch, native bindings and platform.
 *
 * **Example** (Describe the Linux target)
 *
 * ```ts
 * import { McpbTargetSpec } from "@beep/mcpb-kit"
 *
 * const spec = McpbTargetSpec.make({
 *   target: "linux-x64",
 *   launch: { kind: "compiled", bunTarget: "bun-linux-x64", executable: "example-mcp" },
 *   nativePackage: "node-bindings-linux-x64",
 *   platform: "linux",
 * })
 * console.log(spec.launch.kind) // "compiled"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbTargetSpec extends S.Opaque<McpbTargetSpec, { readonly brand: unique symbol }>()(
  S.Struct({
    target: McpbTarget.annotateKey({ description: "The platform this spec builds." }),
    launch: McpbLaunch.annotateKey({ description: "What the bundle ships to start its server." }),
    nativePackage: S.NonEmptyString.annotateKey({
      description: "The `@duckdb/<name>` native bindings package shipped beside the launch files.",
    }),
    platform: McpbPlatform.annotateKey({ description: "The platform the manifest declares." }),
  }).pipe(
    $I.annoteSchema("McpbTargetSpec", {
      description: "What one target ships: its launch, native bindings and platform.",
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
 * target's launch: the compiled executable, or the bundled runtime with the
 * script path as its argument. `env` gains `NODE_PATH` pointing at the
 * bundled `node_modules`, and its keys are written in sorted order. `prompts`
 * is written only when it is non-empty.
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
 * `appName` names the app directory under `apps/`, the Linux executable, the
 * Windows script bundle (`<appName>.js`), the archive
 * (`<appName>-<target>.mcpb`) and the default output directory
 * (`apps/<appName>/dist/mcpb`). The entrypoint is `apps/<appName>/src/bin.ts`.
 *
 * `assets` lists the files that entrypoint imports `with { type: "file" }`.
 * A compiled executable embeds them; a runtime-script bundle ships them
 * beside the script, and the archive audit requires exactly these names.
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
      description: "The app directory under apps/, also the executable, script and archive base name.",
    }),
    commandName: S.NonEmptyString.annotateKey({ description: "Name of the packaging command." }),
    repoRoot: S.NonEmptyString.annotateKey({ description: "Absolute path of the repository root." }),
    assets: S.Array(S.NonEmptyString)
      .pipe(S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description:
          "File names the entrypoint imports as files; a runtime-script bundle ships them beside the script.",
      }),
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
 * **Details**
 *
 * `server.mcp_config.args` is written only for a launch that passes
 * arguments: a runtime-script bundle names its script there, a compiled
 * executable takes none.
 *
 * **Example** (Check a manifest version)
 *
 * ```ts
 * import { McpbManifest } from "@beep/mcpb-kit"
 *
 * console.log(McpbManifest.fields.manifest_version.schema.literal) // "0.3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class McpbManifest extends S.Opaque<McpbManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    manifest_version: S.tag("0.3"),
    name: S.String,
    display_name: S.String,
    version: S.String,
    description: S.String,
    author: S.Struct({ name: S.String }),
    repository: S.Struct({ type: S.tag("git"), url: S.String }),
    license: S.String,
    compatibility: S.Struct({ platforms: S.Array(McpbPlatform) }),
    server: S.Struct({
      type: S.tag("binary"),
      entry_point: S.String,
      mcp_config: S.Struct({
        command: S.String,
        args: S.String.pipe(S.Array, S.optionalKey),
        env: S.Record(S.String, S.String),
      }),
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
