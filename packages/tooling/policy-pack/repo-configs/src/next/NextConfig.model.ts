/**
 * Schema-backed model for public Next.js configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Result } from "effect";
import * as S from "effect/Schema";
import { isFunctionValue, schemaIssueToError } from "./internal.ts";
import { AllowedDevOrigin } from "./models/AllowedDevOrigin.schema.ts";
import { CompilerConfig, ReactCompilerOptions, SassOptions } from "./models/Compiler.schema.ts";
import { I18NConfig, LoggingConfig, TypeScriptConfig } from "./models/ConfigPrimitives.schema.ts";
import { ExperimentalConfig } from "./models/ExperimentalConfig.schema.ts";
import { ImageConfig } from "./models/ImageConfig.schema.ts";
import { TurbopackOptions } from "./models/Turbopack.schema.ts";
import type { Effect } from "effect";
import type { NextConfig as NextConfigFromNext } from "next";

const $I = $RepoConfigsId.create("next/NextConfig.model");

const withKeyDocumentation = <Schema extends S.Top>(
  schema: Schema,
  description: string,
  documentation?: string
): Schema =>
  schema.annotateKey(
    documentation === undefined
      ? { description }
      : {
          description,
          documentation,
        }
  ) as Schema;

const optional = <Schema extends S.Top>(schema: Schema, description: string, documentation?: string) =>
  S.optionalKey(withKeyDocumentation(schema, description, documentation));

const declaredFunction = <A extends Function>(name: string, description: string) =>
  S.declare<A>(isFunctionValue, {
    expected: "Function",
    description,
  }).pipe(
    $I.annoteSchema(name, {
      description,
    })
  );

const StringArray = S.String.pipe(S.Array, S.mutable);
class CacheLifeProfile extends S.Class<CacheLifeProfile>($I`CacheLifeProfile`)(
  {
    stale: optional(S.Finite, "Seconds that a cache entry may be served stale."),
    revalidate: optional(S.Finite, "Seconds before cached output should be revalidated."),
    expire: optional(S.Finite, "Seconds before cached output must expire."),
  },
  $I.annote("CacheLifeProfile", {
    description: "Timing values for a Next.js cache life profile.",
  })
) {}
const CacheLifeConfig = S.Record(S.String, CacheLifeProfile).pipe(
  $I.annoteSchema("CacheLifeConfig", {
    description: "Named cache life profiles used by Next.js cache components.",
  })
);
const CacheHandlersConfig = S.Record(S.String, S.UndefinedOr(S.String)).pipe(
  $I.annoteSchema("CacheHandlersConfig", {
    description: "Named Next.js cache handler module paths.",
  })
);
class DevIndicatorsConfigOptions extends S.Class<DevIndicatorsConfigOptions>($I`DevIndicatorsConfigOptions`)(
  {
    position: optional(
      LiteralKit(["top-left", "top-right", "bottom-left", "bottom-right"]),
      "Position of the development tools indicator in the browser window."
    ),
  },
  $I.annote("DevIndicatorsConfigOptions", {
    description: "Development indicator object configuration for Next.js.",
  })
) {}
const DevIndicatorsConfig = S.Union([S.Literal(false), DevIndicatorsConfigOptions]).pipe(
  $I.annoteSchema("DevIndicatorsConfig", {
    description: "Development indicator configuration for Next.js.",
  })
);
class OnDemandEntriesConfig extends S.Class<OnDemandEntriesConfig>($I`OnDemandEntriesConfig`)(
  {
    maxInactiveAge: optional(S.Finite, "Period in milliseconds where the server keeps pages in the buffer."),
    pagesBufferLength: optional(S.Finite, "Number of pages kept simultaneously without being disposed."),
  },
  $I.annote("OnDemandEntriesConfig", {
    description: "Development-time on-demand entries cache configuration.",
  })
) {}
class HttpAgentOptionsConfig extends S.Class<HttpAgentOptionsConfig>($I`HttpAgentOptionsConfig`)(
  {
    keepAlive: optional(S.Boolean, "Whether HTTP keep-alive should be enabled."),
  },
  $I.annote("HttpAgentOptionsConfig", {
    description: "HTTP agent options used by Next.js fetch and server internals.",
  })
) {}
class ModularizeImportsRuleConfig extends S.Class<ModularizeImportsRuleConfig>($I`ModularizeImportsRuleConfig`)(
  {
    transform: withKeyDocumentation(
      S.Union([S.String, S.Record(S.String, S.String)]),
      "Import transform string or mapping for the optimized package."
    ),
    preventFullImport: optional(S.Boolean, "Prevent full imports from the optimized package."),
    skipDefaultConversion: optional(S.Boolean, "Skip default import conversion for the optimized package."),
  },
  $I.annote("ModularizeImportsRuleConfig", {
    description: "Package import modularization rule for one optimized package.",
  })
) {}
const ModularizeImportsConfig = S.Record(S.String, ModularizeImportsRuleConfig).pipe(
  $I.annoteSchema("ModularizeImportsConfig", {
    description: "Package import modularization rules.",
  })
);
const OutputFileTracingRules = S.Record(S.String, StringArray).pipe(
  $I.annoteSchema("OutputFileTracingRules", {
    description: "Per-route file tracing include or exclude globs.",
  })
);
class WatchOptionsConfig extends S.Class<WatchOptionsConfig>($I`WatchOptionsConfig`)(
  {
    pollIntervalMs: optional(S.Finite, "Polling interval in milliseconds for file watching."),
  },
  $I.annote("WatchOptionsConfig", {
    description: "File watching options for Next.js.",
  })
) {}

const ExportPathMapFunction = declaredFunction<NonNullable<NextConfigFromNext["exportPathMap"]>>(
  "ExportPathMapFunction",
  "Function used by next.config.js to customize static export paths."
);
const HeadersFunction = declaredFunction<NonNullable<NextConfigFromNext["headers"]>>(
  "HeadersFunction",
  "Function used by next.config.js to provide custom response headers."
);
const RewritesFunction = declaredFunction<NonNullable<NextConfigFromNext["rewrites"]>>(
  "RewritesFunction",
  "Function used by next.config.js to provide custom rewrite routes."
);
const RedirectsFunction = declaredFunction<NonNullable<NextConfigFromNext["redirects"]>>(
  "RedirectsFunction",
  "Function used by next.config.js to provide custom redirect routes."
);
const WebpackFunction = declaredFunction<NonNullable<NextConfigFromNext["webpack"]>>(
  "WebpackFunction",
  "Function used by next.config.js to customize the generated webpack configuration."
);
const GenerateBuildIdFunction = declaredFunction<NonNullable<NextConfigFromNext["generateBuildId"]>>(
  "GenerateBuildIdFunction",
  "Function used by next.config.js to customize the production build identifier."
);

/**
 * Public Next.js configuration schema.
 *
 * **Details**
 *
 * This schema models user-authored `next.config.js` data from the public
 * `next` package declarations. Fields marked `@internal` in Next.js source are
 * intentionally omitted and stripped during decoding.
 *
 * **Example** (Define validated Next config)
 *
 * ```ts
 * import { defineNextConfig } from "@beep/repo-configs/next"
 * import type { NextConfig } from "next"
 * const config = defineNextConfig({
 *   allowedDevOrigins: ["oip-web.beep.localhost"],
 *   reactStrictMode: true
 * } satisfies NextConfig)
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class NextConfig extends S.Class<NextConfig>($I`NextConfig`)(
  {
    allowedDevOrigins: optional(
      AllowedDevOrigin.pipe(S.Array, S.mutable),
      "Additional origins allowed to request the Next.js development server.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins"
    ),
    exportPathMap: optional(
      ExportPathMapFunction,
      "Customize static export paths.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/exportPathMap"
    ),
    i18n: optional(
      S.NullOr(I18NConfig),
      "Internationalization configuration.",
      "https://nextjs.org/docs/advanced-features/i18n-routing"
    ),
    typescript: optional(
      TypeScriptConfig,
      "TypeScript configuration.",
      "https://nextjs.org/docs/app/api-reference/config/typescript"
    ),
    typedRoutes: optional(
      S.Boolean,
      "Enable type checking for Link and Router.push.",
      "https://nextjs.org/docs/app/api-reference/config/typescript#statically-typed-links"
    ),
    headers: optional(
      HeadersFunction,
      "Configure custom HTTP headers for incoming request paths.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/headers"
    ),
    rewrites: optional(
      RewritesFunction,
      "Map incoming request paths to different destination paths.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites"
    ),
    redirects: optional(
      RedirectsFunction,
      "Redirect incoming request paths to destinations.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects"
    ),
    excludeDefaultMomentLocales: optional(
      S.Boolean,
      "Exclude Moment.js locales that Next.js excludes by default.",
      "https://nextjs.org/docs/upgrading#momentjs-locales-excluded-by-default"
    ),
    webpack: optional(
      S.NullOr(WebpackFunction),
      "Customize the generated webpack configuration.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack"
    ),
    trailingSlash: optional(
      S.Boolean,
      "Configure whether routes should keep trailing slashes.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash"
    ),
    env: optional(
      S.Record(S.String, S.UndefinedOr(S.String)),
      "Environment variables to inline into the Next.js application.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/env"
    ),
    distDir: optional(S.String, "Destination directory for build output."),
    cleanDistDir: optional(S.Boolean, "Whether the build output directory is cleared before builds."),
    assetPrefix: optional(
      S.String,
      "CDN or asset prefix for generated assets.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix"
    ),
    cacheHandler: optional(
      S.UndefinedOr(S.String),
      "Path to a custom cache handler.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath"
    ),
    adapterPath: optional(S.String, "Path to a custom adapter module for deployment platform integration."),
    cacheHandlers: optional(CacheHandlersConfig, "Named cache handler module paths."),
    cacheMaxMemorySize: optional(S.Finite, "In-memory cache size in bytes."),
    useFileSystemPublicRoutes: optional(
      S.Boolean,
      "Whether pages are served from the filesystem routes.",
      "https://nextjs.org/docs/advanced-features/custom-server#disabling-file-system-routing"
    ),
    generateBuildId: optional(
      GenerateBuildIdFunction,
      "Customize the production build ID.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/generateBuildId"
    ),
    generateEtags: optional(
      S.Boolean,
      "Configure whether Next.js generates ETags.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/generateEtags"
    ),
    pageExtensions: optional(
      StringArray,
      "File extensions treated as pages.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/pageExtensions"
    ),
    compress: optional(
      S.Boolean,
      "Configure response compression.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/compress"
    ),
    poweredByHeader: optional(
      S.Boolean,
      "Configure the x-powered-by response header.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/poweredByHeader"
    ),
    images: optional(
      ImageConfig,
      "Image component and optimization configuration.",
      "https://nextjs.org/docs/app/api-reference/next-config-js/images"
    ),
    devIndicators: optional(DevIndicatorsConfig, "Development environment indicator configuration."),
    onDemandEntries: optional(
      OnDemandEntriesConfig,
      "Controls how development pages are kept in memory.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/onDemandEntries"
    ),
    deploymentId: optional(S.String, "Unique deployment identifier included in requests."),
    basePath: optional(
      S.String,
      "Deploy the application under a domain sub-path.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath"
    ),
    sassOptions: optional(
      SassOptions,
      "Sass options passed through to Next.js.",
      "https://nextjs.org/docs/app/api-reference/next-config-js/sassOptions"
    ),
    productionBrowserSourceMaps: optional(
      S.Boolean,
      "Enable browser source map generation during production builds.",
      "https://nextjs.org/docs/advanced-features/source-maps"
    ),
    reactCompiler: optional(
      S.Union([S.Boolean, ReactCompilerOptions]),
      "Enable React Compiler in Next.js.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler"
    ),
    reactProductionProfiling: optional(S.Boolean, "Enable React profiling in production."),
    reactStrictMode: optional(
      S.NullOr(S.Boolean),
      "Enable React Strict Mode.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/reactStrictMode"
    ),
    reactMaxHeadersLength: optional(
      S.Finite,
      "Maximum length of headers emitted by React and added to the response.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/reactMaxHeadersLength"
    ),
    httpAgentOptions: optional(
      HttpAgentOptionsConfig,
      "HTTP keep-alive agent options.",
      "https://nextjs.org/docs/app/api-reference/next-config-js/httpAgentOptions"
    ),
    staticPageGenerationTimeout: optional(S.Finite, "Timeout in seconds for static page generation."),
    crossOrigin: optional(
      LiteralKit(["anonymous", "use-credentials"]),
      "Cross-origin attribute for generated script elements.",
      "https://developer.mozilla.org/docs/Web/HTML/Attributes/crossorigin"
    ),
    compiler: optional(
      CompilerConfig,
      "Compiler transform configuration.",
      "https://nextjs.org/docs/advanced-features/compiler#supported-features"
    ),
    output: optional(
      LiteralKit(["standalone", "export"]),
      "Build output type.",
      "https://nextjs.org/docs/advanced-features/output-file-tracing"
    ),
    transpilePackages: optional(
      StringArray,
      "Packages that should be transpiled and bundled by Next.js.",
      "https://nextjs.org/docs/advanced-features/compiler#module-transpilation"
    ),
    turbopack: optional(TurbopackOptions, "Turbopack configuration."),
    skipMiddlewareUrlNormalize: optional(S.Boolean, "Deprecated alias for skipProxyUrlNormalize."),
    skipProxyUrlNormalize: optional(S.Boolean, "Skip proxy URL normalization."),
    skipTrailingSlashRedirect: optional(S.Boolean, "Skip generated trailing slash redirects."),
    modularizeImports: optional(ModularizeImportsConfig, "Package import modularization configuration."),
    logging: optional(S.Union([LoggingConfig, S.Literal(false)]), "Logging configuration."),
    enablePrerenderSourceMaps: optional(S.Boolean, "Enable source maps while generating static pages."),
    cacheComponents: optional(
      S.Boolean,
      "Enable cache components support.",
      "https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents"
    ),
    cacheLife: optional(CacheLifeConfig, "Named cache life profiles."),
    expireTime: optional(S.Finite, "Seconds where the server may serve stale cache."),
    agentRules: optional(S.Boolean, "Enable generated AI coding agent rules for Next.js development."),
    experimental: optional(ExperimentalConfig, "Experimental Next.js feature flags."),
    bundlePagesRouterDependencies: optional(
      S.Boolean,
      "Bundle node_modules packages for pages router server-side bundles.",
      "https://nextjs.org/docs/pages/api-reference/next-config-js/bundlePagesRouterDependencies"
    ),
    serverExternalPackages: optional(
      StringArray,
      "Packages treated as external in the server build.",
      "https://nextjs.org/docs/app/api-reference/next-config-js/serverExternalPackages"
    ),
    outputFileTracingRoot: optional(S.String, "Root directory used for output file tracing."),
    outputFileTracingExcludes: optional(OutputFileTracingRules, "Per-route traced file exclusions."),
    outputFileTracingIncludes: optional(OutputFileTracingRules, "Per-route traced file inclusions."),
    watchOptions: optional(WatchOptionsConfig, "File watching options."),
    htmlLimitedBots: optional(S.RegExp, "User agent pattern for bots that cannot handle streaming metadata."),
  },
  $I.annote("NextConfig", {
    description: "Public Next.js configuration schema.",
    documentation: "https://nextjs.org/docs/app/api-reference/config/next-config-js",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(NextConfig);
  static readonly decodeResult = S.decodeUnknownResult(NextConfig);
  static readonly encodeResult = S.encodeResult(NextConfig);
}

const decodeNextConfigResult = NextConfig.decodeResult;
const encodeNextConfigResult = NextConfig.encodeResult;

/**
 * Decode unknown input into a public Next.js configuration value.
 *
 * **Example** (Decode config with Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { decodeNextConfig } from "@beep/repo-configs/next"
 * const program = decodeNextConfig({ reactStrictMode: true })
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// unary by contract: `options` stays reachable through `NextConfig.decodeEffect`;
// a dual is undecidable here because `input` is `unknown`.
export const decodeNextConfig: (input: unknown) => Effect.Effect<NextConfig, S.SchemaError> = NextConfig.decodeEffect;

/**
 * Synchronously validate and normalize a user-authored Next.js config.
 *
 * **Example** (Validate Next config sync)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { defineNextConfig } from "@beep/repo-configs/next"
 *
 * const config = defineNextConfig({
 *   reactStrictMode: true
 * })
 *
 * strictEqual(config.reactStrictMode, true)
 * ```
 *
 * @param config - Unknown user-authored Next.js configuration input.
 * @returns A plain Next.js configuration object validated by the schema.
 * @category constructors
 * @since 0.0.0
 */
export const defineNextConfig = (config: unknown): NextConfigFromNext =>
  Result.getOrThrowWith(
    encodeNextConfigResult(Result.getOrThrowWith(decodeNextConfigResult(config), schemaIssueToError)),
    schemaIssueToError
  );

/**
 * Backwards-compatible alias for the public experimental Next.js schema.
 *
 * **Example** (Make experimental schema value)
 *
 * ```ts
 * import { NextConfigExperimental } from "@beep/repo-configs/next"
 * const experimental = NextConfigExperimental.make({ cssChunking: true })
 * console.log(experimental)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NextConfigExperimental = ExperimentalConfig;

/**
 * Backwards-compatible alias for the public experimental Next.js model.
 *
 * **Example** (Type experimental config object)
 *
 * ```ts
 * import type { NextConfigExperimental } from "@beep/repo-configs/next"
 * const experimental: NextConfigExperimental = { cssChunking: true }
 * console.log(experimental)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NextConfigExperimental = ExperimentalConfig;

/**
 * Backwards-compatible alias for the public Next.js configuration schema.
 *
 * **Example** (Make base schema value)
 *
 * ```ts
 * import { NextConfigBase } from "@beep/repo-configs/next"
 * const config = NextConfigBase.make({ reactStrictMode: true })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NextConfigBase: typeof NextConfig = NextConfig;

/**
 * Backwards-compatible alias for the public Next.js configuration model.
 *
 * **Example** (Type base config object)
 *
 * ```ts
 * import type { NextConfigBase } from "@beep/repo-configs/next"
 * const config: NextConfigBase = { reactStrictMode: true }
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NextConfigBase = typeof NextConfigBase.Type;
