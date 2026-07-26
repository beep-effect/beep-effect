/**
 * Schema for `.claude-plugin/marketplace.json` plugin catalogs.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { AuthorInfo, ComponentPathSpec, HooksSpec, ServerConfigSpec } from "./Manifest.ts";

const $I = $ScratchpadId.create("claudecode/Plugin/Marketplace");

/**
 * A GitHub repository plugin source.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const source = Plugin.GithubPluginSource.make({ repo: "owner/repository" })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GithubPluginSource extends S.Class<GithubPluginSource>($I`GithubPluginSource`)(
  {
    source: S.tag("github"),
    repo: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sha: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GithubPluginSource", {
    description: "Marketplace plugin source hosted in a GitHub repository.",
  })
) {}

/**
 * Companion types for {@link GithubPluginSource}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   source: "github",
 *   repo: "owner/repository"
 * } satisfies Plugin.GithubPluginSource.Encoded
 * console.log(input.repo)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GithubPluginSource {
  /**
   * Runtime type represented by {@link GithubPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GithubPluginSource;

  /**
   * JSON representation accepted by {@link GithubPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GithubPluginSource.Encoded;
}

/**
 * A plugin archive or repository URL source.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const source = Plugin.UrlPluginSource.make({
 *   url: "https://example.test/plugin.git"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UrlPluginSource extends S.Class<UrlPluginSource>($I`UrlPluginSource`)(
  {
    source: S.tag("url"),
    url: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sha: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("UrlPluginSource", {
    description: "Marketplace plugin source addressed by URL.",
  })
) {}

/**
 * Companion types for {@link UrlPluginSource}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   source: "url",
 *   url: "https://example.test/plugin.git"
 * } satisfies Plugin.UrlPluginSource.Encoded
 * console.log(input.url)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UrlPluginSource {
  /**
   * Runtime type represented by {@link UrlPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = UrlPluginSource;

  /**
   * JSON representation accepted by {@link UrlPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UrlPluginSource.Encoded;
}

/**
 * A plugin located in a git repository subdirectory.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const source = Plugin.GitSubdirPluginSource.make({
 *   url: "https://example.test/plugins.git",
 *   path: "plugins/example"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GitSubdirPluginSource extends S.Class<GitSubdirPluginSource>($I`GitSubdirPluginSource`)(
  {
    source: S.tag("git-subdir"),
    url: S.String,
    path: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sha: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GitSubdirPluginSource", {
    description: "Marketplace plugin source in a git repository subdirectory.",
  })
) {}

/**
 * Companion types for {@link GitSubdirPluginSource}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   source: "git-subdir",
 *   url: "https://example.test/plugins.git",
 *   path: "plugins/example"
 * } satisfies Plugin.GitSubdirPluginSource.Encoded
 * console.log(input.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitSubdirPluginSource {
  /**
   * Runtime type represented by {@link GitSubdirPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GitSubdirPluginSource;

  /**
   * JSON representation accepted by {@link GitSubdirPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitSubdirPluginSource.Encoded;
}

/**
 * An npm package plugin source.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const source = Plugin.NpmPluginSource.make({ package: "@example/plugin" })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NpmPluginSource extends S.Class<NpmPluginSource>($I`NpmPluginSource`)(
  {
    source: S.tag("npm"),
    package: S.String,
    version: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    registry: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("NpmPluginSource", {
    description: "Marketplace plugin source published as an npm package.",
  })
) {}

/**
 * Companion types for {@link NpmPluginSource}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   source: "npm",
 *   package: "@example/plugin"
 * } satisfies Plugin.NpmPluginSource.Encoded
 * console.log(input.package)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NpmPluginSource {
  /**
   * Runtime type represented by {@link NpmPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = NpmPluginSource;

  /**
   * JSON representation accepted by {@link NpmPluginSource}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof NpmPluginSource.Encoded;
}

const StructuredPluginSource = S.Union([
  GithubPluginSource,
  UrlPluginSource,
  GitSubdirPluginSource,
  NpmPluginSource,
]).pipe(
  S.toTaggedUnion("source"),
  $I.annoteSchema("StructuredPluginSource", {
    description: "Structured marketplace plugin source variants.",
  })
);

/**
 * A relative path or structured marketplace plugin source.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Plugin } from "effect-claudecode"
 *
 * const source = S.decodeUnknownSync(Plugin.MarketplacePluginSourceSpec)(
 *   { source: "github", repo: "owner/repository" }
 * )
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarketplacePluginSourceSpec = S.Union([S.String, StructuredPluginSource]).pipe(
  $I.annoteSchema("MarketplacePluginSourceSpec", {
    description: "A relative path or structured marketplace plugin source.",
  })
);

/**
 * Runtime type decoded by {@link MarketplacePluginSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const source: Plugin.MarketplacePluginSourceSpec.Type = "./plugins/example"
 * console.log(source)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplacePluginSourceSpec {
  /**
   * Runtime type represented by {@link MarketplacePluginSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof MarketplacePluginSourceSpec.Type;
}

/**
 * One plugin entry in a marketplace catalog.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.MarketplacePluginEntry.make({
 *   name: "example",
 *   source: "./plugins/example"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MarketplacePluginEntry extends S.Class<MarketplacePluginEntry>($I`MarketplacePluginEntry`)(
  {
    name: S.String,
    source: MarketplacePluginSourceSpec,
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    displayName: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    category: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    tags: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    defaultEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    version: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    author: S.OptionFromOptionalKey(AuthorInfo).pipe(SchemaUtils.withNoneDefault),
    homepage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    repository: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    license: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    keywords: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    commands: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    agents: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    skills: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    outputStyles: S.OptionFromOptionalKey(ComponentPathSpec).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSpec).pipe(SchemaUtils.withNoneDefault),
    mcpServers: S.OptionFromOptionalKey(ServerConfigSpec).pipe(SchemaUtils.withNoneDefault),
    lspServers: S.OptionFromOptionalKey(ServerConfigSpec).pipe(SchemaUtils.withNoneDefault),
    strict: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("MarketplacePluginEntry", {
    description: "One plugin entry in a Claude Code marketplace catalog.",
  })
) {}

/**
 * Companion types for {@link MarketplacePluginEntry}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   name: "example",
 *   source: "./plugins/example"
 * } satisfies Plugin.MarketplacePluginEntry.Encoded
 * console.log(input.name)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplacePluginEntry {
  /**
   * Runtime type represented by {@link MarketplacePluginEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = MarketplacePluginEntry;

  /**
   * JSON representation accepted by {@link MarketplacePluginEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarketplacePluginEntry.Encoded;
}

/**
 * Marketplace-wide metadata.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Plugin } from "effect-claudecode"
 *
 * const metadata = Plugin.MarketplaceMetadata.make({
 *   pluginRoot: O.some("./plugins")
 * })
 * console.log(metadata.pluginRoot)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MarketplaceMetadata extends S.Class<MarketplaceMetadata>($I`MarketplaceMetadata`)(
  {
    pluginRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("MarketplaceMetadata", {
    description: "Marketplace-wide plugin root metadata.",
  })
) {}

/**
 * Companion types for {@link MarketplaceMetadata}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = { pluginRoot: "./plugins" } satisfies Plugin.MarketplaceMetadata.Encoded
 * console.log(input.pluginRoot)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplaceMetadata {
  /**
   * Runtime type represented by {@link MarketplaceMetadata}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = MarketplaceMetadata;

  /**
   * JSON representation accepted by {@link MarketplaceMetadata}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarketplaceMetadata.Encoded;
}

/**
 * A complete `.claude-plugin/marketplace.json` file.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const marketplace = Plugin.MarketplaceFile.make({
 *   name: "example",
 *   owner: Plugin.AuthorInfo.make({ name: "Beep" }),
 *   plugins: []
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MarketplaceFile extends S.Class<MarketplaceFile>($I`MarketplaceFile`)(
  {
    $schema: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    name: S.String,
    version: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    owner: AuthorInfo,
    metadata: S.OptionFromOptionalKey(MarketplaceMetadata).pipe(SchemaUtils.withNoneDefault),
    allowCrossMarketplaceDependenciesOn: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(
      SchemaUtils.withNoneDefault
    ),
    plugins: MarketplacePluginEntry.pipe(S.Array),
  },
  $I.annote("MarketplaceFile", {
    description: "A Claude Code plugin marketplace catalog.",
  })
) {}

/**
 * Companion types for {@link MarketplaceFile}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const input = {
 *   name: "example",
 *   owner: { name: "Beep" },
 *   plugins: []
 * } satisfies Plugin.MarketplaceFile.Encoded
 * console.log(input.name)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplaceFile {
  /**
   * Runtime type represented by {@link MarketplaceFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = MarketplaceFile;

  /**
   * JSON representation accepted by {@link MarketplaceFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarketplaceFile.Encoded;
}
