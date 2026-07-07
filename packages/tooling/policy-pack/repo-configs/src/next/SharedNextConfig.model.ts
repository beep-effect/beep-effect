/**
 * Shared repo-owned Next.js configuration preset.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O } from "@beep/utils";
import bundleAnalyzer from "@next/bundle-analyzer";
import createMDX from "@next/mdx";
import withSerwistInit from "@serwist/next";
import { flow, pipe, Result } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { schemaIssueToError } from "./internal.ts";
import { AllowedDevOrigin } from "./models/AllowedDevOrigin.schema.ts";
import { defineNextConfig, NextConfig as NextConfigModel } from "./NextConfig.model.ts";
import { SecureHeadersConfig, withSecureHeaders } from "./security/index.ts";
import type { NextConfig as NextConfigFromNext } from "next";

const $I = $RepoConfigsId.create("next/SharedNextConfig.model");
const isFalse = (value: unknown): value is false => Eq.equals(false)(value);

const optional = <Schema extends S.Top>(schema: Schema, description: string) =>
  S.optionalKey(schema).annotateKey({ description });
const emptyStringList: Array<string> = [];
const stringListWithEmptyDefault = (description: string) =>
  S.String.pipe(S.Array, S.mutable, SchemaUtils.withKeyDefaults(emptyStringList)).annotateKey({ description });

const DEFAULT_PAGE_EXTENSIONS: ReadonlyArray<string> = ["ts", "tsx", "md", "mdx"];
const DEFAULT_TRANSPILE_PACKAGES: ReadonlyArray<string> = ["@beep/ui", "@beep/identity", "@beep/schema", "@beep/utils"];
const DEFAULT_OPTIMIZE_PACKAGE_IMPORTS: ReadonlyArray<string> = [
  "@base-ui/react",
  "@mui/material",
  "@mui/x-charts",
  "@mui/x-data-grid",
  "@mui/x-date-pickers",
  "@mui/x-date-pickers-pro",
  "@mui/x-tree-view",
  "@phosphor-icons/react",
];
const DEFAULT_MDX_EXTENSION = /\.(md|mdx)$/;

const AnalyzerMode = LiteralKit(["json", "static"]).pipe(
  $I.annoteSchema("AnalyzerMode", {
    description: "Bundle analyzer report output mode.",
  })
);
const AnalyzerLogLevel = LiteralKit(["info", "warn", "error", "silent"]).pipe(
  $I.annoteSchema("AnalyzerLogLevel", {
    description: "Bundle analyzer logging level.",
  })
);

/**
 * Environment snapshot understood by the shared Next.js config preset.
 *
 * @remarks
 * The app entrypoint passes environment values into this data contract. The
 * shared helper decodes only the keys it understands and strips everything
 * else, avoiding hidden ambient `process.env` reads inside repo-configs.
 * @example
 * ```ts
 * import { BeepNextConfigEnv } from "@beep/repo-configs/next"
 * const env = BeepNextConfigEnv.make({
 *   ANALYZE: "1",
 *   NEXT_DISABLE_PWA: "1"
 * })
 * console.log(env)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class BeepNextConfigEnv extends S.Class<BeepNextConfigEnv>($I`BeepNextConfigEnv`)(
  {
    ANALYZE: optional(S.String, "Enables bundle analyzer output when set to 1."),
    NEXT_DISABLE_PWA: optional(S.String, "Keeps PWA disabled unless set to 0."),
  },
  $I.annote("BeepNextConfigEnv", {
    description: "Environment snapshot understood by the shared Next.js config preset.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(BeepNextConfigEnv);
  static readonly decodeResult = S.decodeUnknownResult(BeepNextConfigEnv);
}

class BeepNextBundleAnalyzerConfigOptions extends S.Class<BeepNextBundleAnalyzerConfigOptions>(
  $I`BeepNextBundleAnalyzerConfigOptions`
)(
  {
    enabled: optional(S.Boolean, "Overrides the decoded ANALYZE env toggle."),
    openAnalyzer: optional(S.Boolean, "Automatically open analyzer output in a browser."),
    analyzerMode: optional(AnalyzerMode, "Bundle analyzer output mode."),
    logLevel: optional(AnalyzerLogLevel, "Bundle analyzer logging level."),
  },
  $I.annote("BeepNextBundleAnalyzerConfigOptions", {
    description: "Bundle analyzer object configuration for the shared Next.js preset.",
  })
) {}

/**
 * Bundle analyzer feature configuration for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import { BeepNextBundleAnalyzerConfig } from "@beep/repo-configs/next"
 * const config = BeepNextBundleAnalyzerConfig.make({
 *   analyzerMode: "static",
 *   openAnalyzer: false
 * })
 * console.log(config)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BeepNextBundleAnalyzerConfig = S.Union([S.Literal(false), BeepNextBundleAnalyzerConfigOptions]).pipe(
  $I.annoteSchema("BeepNextBundleAnalyzerConfig", {
    description: "Bundle analyzer feature configuration for the shared Next.js preset.",
  })
);

/**
 * Bundle analyzer feature configuration for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import type { BeepNextBundleAnalyzerConfig } from "@beep/repo-configs/next"
 * const config: BeepNextBundleAnalyzerConfig = { enabled: true }
 * console.log(config)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BeepNextBundleAnalyzerConfig = typeof BeepNextBundleAnalyzerConfig.Type;

class BeepNextMdxConfigOptions extends S.Class<BeepNextMdxConfigOptions>($I`BeepNextMdxConfigOptions`)(
  {
    extension: S.RegExp.pipe(SchemaUtils.withKeyDefaults(DEFAULT_MDX_EXTENSION)).annotateKey({
      description: "Webpack rule condition for MDX file extensions.",
    }),
  },
  $I.annote("BeepNextMdxConfigOptions", {
    description: "MDX object configuration for the shared Next.js preset.",
  })
) {}

/**
 * MDX feature configuration for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import { BeepNextMdxConfig } from "@beep/repo-configs/next"
 * const config = BeepNextMdxConfig.make({
 *   extension: /\.(md|mdx)$/
 * })
 * console.log(config)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BeepNextMdxConfig = S.Union([S.Literal(false), BeepNextMdxConfigOptions]).pipe(
  $I.annoteSchema("BeepNextMdxConfig", {
    description: "MDX feature configuration for the shared Next.js preset.",
  })
);

/**
 * MDX feature configuration for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import type { BeepNextMdxConfig } from "@beep/repo-configs/next"
 * const config: BeepNextMdxConfig = {}
 * console.log(config)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BeepNextMdxConfig = typeof BeepNextMdxConfig.Type;

class BeepNextPwaConfigOptions extends S.Class<BeepNextPwaConfigOptions>($I`BeepNextPwaConfigOptions`)(
  {
    enabled: optional(S.Boolean, "Overrides the decoded NEXT_DISABLE_PWA env toggle."),
    swSrc: S.String.pipe(SchemaUtils.withKeyDefaults("src/app/sw.ts")).annotateKey({
      description: "Service worker source file passed to serwist (swSrc).",
    }),
    swDest: S.String.pipe(SchemaUtils.withKeyDefaults("public/sw.js")).annotateKey({
      description: "Compiled service worker output path passed to serwist (swDest).",
    }),
    register: optional(S.Boolean, "Whether serwist auto-registers the generated service worker."),
    cacheOnNavigation: optional(S.Boolean, "Cache additional routes on next/link navigation (serwist)."),
    reloadOnOnline: optional(S.Boolean, "Reload the app when the browser comes back online (serwist)."),
  },
  $I.annote("BeepNextPwaConfigOptions", {
    description: "PWA (serwist) object configuration for the shared Next.js preset.",
  })
) {}

/**
 * PWA feature configuration for the shared Next.js preset.
 *
 * @remarks
 * `enabled` overrides the decoded env snapshot. When absent, PWA remains
 * disabled unless `NEXT_DISABLE_PWA` is set to `0`.
 * @example
 * ```ts
 * import { BeepNextPwaConfig } from "@beep/repo-configs/next"
 * const config = BeepNextPwaConfig.make({
 *   swSrc: "src/app/sw.ts",
 *   swDest: "public/sw.js"
 * })
 * console.log(config)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const BeepNextPwaConfig = S.Union([S.Literal(false), BeepNextPwaConfigOptions]).pipe(
  $I.annoteSchema("BeepNextPwaConfig", {
    description: "PWA feature configuration for the shared Next.js preset.",
  })
);

/**
 * PWA feature configuration for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import type { BeepNextPwaConfig } from "@beep/repo-configs/next"
 * const config: BeepNextPwaConfig = { enabled: false }
 * console.log(config)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BeepNextPwaConfig = typeof BeepNextPwaConfig.Type;

/**
 * Input options for the shared repo-owned Next.js config preset.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { BeepNextConfigOptions } from "@beep/repo-configs/next"
 * const program = S.decodeUnknownEffect(BeepNextConfigOptions)({
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.localhost"]
 * })
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class BeepNextConfigOptions extends S.Class<BeepNextConfigOptions>($I`BeepNextConfigOptions`)(
  {
    repoRoot: S.String.annotateKey({
      description: "Absolute repository root used for tracing and Turbopack roots.",
    }),
    allowedDevOrigins: AllowedDevOrigin.pipe(S.Array, S.mutable).annotateKey({
      description: "App-local development origins allowed by the Next.js dev server.",
    }),
    env: optional(BeepNextConfigEnv, "Environment snapshot for shared feature toggles."),
    additionalPageExtensions: stringListWithEmptyDefault("Additional page extensions appended to the shared defaults."),
    additionalTranspilePackages: stringListWithEmptyDefault("Additional workspace packages transpiled by Next.js."),
    additionalOptimizePackageImports: stringListWithEmptyDefault(
      "Additional packages added to experimental.optimizePackageImports."
    ),
    securityHeaders: optional(SecureHeadersConfig, "Shared secure-header configuration."),
    mdx: optional(BeepNextMdxConfig, "MDX feature configuration."),
    pwa: optional(BeepNextPwaConfig, "PWA feature configuration."),
    bundleAnalyzer: optional(BeepNextBundleAnalyzerConfig, "Bundle analyzer feature configuration."),
    next: optional(NextConfigModel, "Raw Next.js config overrides merged with the shared preset."),
  },
  $I.annote("BeepNextConfigOptions", {
    description: "Input options for the shared repo-owned Next.js config preset.",
  })
) {
  static readonly decodeResult = S.decodeUnknownResult(BeepNextConfigOptions);
}

/**
 * User-authored input options accepted by {@link defineBeepNextConfig}.
 *
 * @remarks
 * `env` intentionally accepts unknown objects such as `process.env`; the schema
 * decoder keeps only the two feature-toggle keys the shared preset owns.
 * @example
 * ```ts
 * import type { BeepNextConfigOptionsInput } from "@beep/repo-configs/next"
 * const options: BeepNextConfigOptionsInput = {
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.localhost"],
 *   env: { ANALYZE: "1" }
 * }
 * console.log(options)
 * ```
 * @category models
 * @since 0.0.0
 */
export type BeepNextConfigOptionsInput = Omit<typeof BeepNextConfigOptions.Encoded, "env"> & {
  readonly env?: unknown;
};

/**
 * A pure Next.js config plugin function.
 *
 * @example
 * ```ts
 * import type { NextConfigPlugin } from "@beep/repo-configs/next"
 * const plugin: NextConfigPlugin = (config) => config
 * console.log(plugin)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NextConfigPlugin = (config: NextConfigFromNext) => NextConfigFromNext;

const decodeBeepNextConfigEnvResult = BeepNextConfigEnv.decodeResult;
const decodeBeepNextConfigOptionsResult = BeepNextConfigOptions.decodeResult;

const withDefault = <A>(value: A | undefined, fallback: A): A =>
  pipe(
    O.fromNullishOr(value),
    O.getOrElse(() => fallback)
  );
const mergeUniqueStrings = (...groups: ReadonlyArray<ReadonlyArray<string> | undefined>): Array<string> =>
  pipe(groups, A.flatMap(flow(O.fromNullishOr, O.getOrElse(A.empty))), A.dedupe);

const analyzerEnabledFromEnv = (env: BeepNextConfigEnv | undefined): boolean =>
  pipe(O.fromNullishOr(env?.ANALYZE), O.exists(Eq.equals("1")));

const pwaEnabledFromEnv = (env: BeepNextConfigEnv | undefined): boolean =>
  pipe(O.fromNullishOr(env?.NEXT_DISABLE_PWA), O.exists(Eq.equals("0")));

type BundleAnalyzerFeatureConfig = Exclude<BeepNextBundleAnalyzerConfig, false>;
type MdxFeatureConfig = Exclude<BeepNextMdxConfig, false>;
type PwaFeatureConfig = Exclude<BeepNextPwaConfig, false>;
type SerwistNextConfigPlugin = ReturnType<typeof withSerwistInit>;

const emptyBundleAnalyzerConfig: BundleAnalyzerFeatureConfig = {};
const emptyMdxConfig: MdxFeatureConfig = BeepNextMdxConfigOptions.make({});
const emptyPwaConfig: PwaFeatureConfig = BeepNextPwaConfigOptions.make({});

const bundleAnalyzerConfig = (
  config: BeepNextBundleAnalyzerConfig | undefined
): O.Option<BundleAnalyzerFeatureConfig> => {
  if (isFalse(config)) return O.none();
  if (P.isUndefined(config)) return O.some(emptyBundleAnalyzerConfig);
  return O.some(config);
};

const mdxConfig = (config: BeepNextMdxConfig | undefined): O.Option<MdxFeatureConfig> => {
  if (isFalse(config)) return O.none();
  if (P.isUndefined(config)) return O.some(emptyMdxConfig);
  return O.some(config);
};

const pwaConfig = (config: BeepNextPwaConfig | undefined): O.Option<PwaFeatureConfig> => {
  if (isFalse(config)) return O.none();
  if (P.isUndefined(config)) return O.some(emptyPwaConfig);
  return O.some(config);
};

// Serwist can resolve its own Next canary, so its plugin type can point at a
// different NextConfig identity even though the runtime config contract matches.
const adaptSerwistNextConfigPlugin = (plugin: SerwistNextConfigPlugin): NextConfigPlugin =>
  plugin as unknown as NextConfigPlugin;

const makeBundleAnalyzerPlugin = (options: BeepNextConfigOptions): O.Option<NextConfigPlugin> =>
  pipe(
    bundleAnalyzerConfig(options.bundleAnalyzer),
    O.map((config) =>
      bundleAnalyzer({
        enabled: withDefault(config.enabled, analyzerEnabledFromEnv(options.env)),
        ...O.getSomesStruct({
          analyzerMode: O.fromUndefinedOr(config.analyzerMode),
          logLevel: O.fromUndefinedOr(config.logLevel),
          openAnalyzer: O.fromUndefinedOr(config.openAnalyzer),
        }),
      })
    )
  );

const makeMdxPlugin = (options: BeepNextConfigOptions): O.Option<NextConfigPlugin> =>
  pipe(
    mdxConfig(options.mdx),
    O.map((config) =>
      createMDX({
        extension: config.extension,
      })
    )
  );

const makePwaPlugin = (options: BeepNextConfigOptions): O.Option<NextConfigPlugin> =>
  pipe(
    pwaConfig(options.pwa),
    O.map((config) =>
      adaptSerwistNextConfigPlugin(
        withSerwistInit({
          swSrc: config.swSrc,
          swDest: config.swDest,
          disable: !withDefault(config.enabled, pwaEnabledFromEnv(options.env)),
          ...O.getSomesStruct({
            register: O.fromUndefinedOr(config.register),
            cacheOnNavigation: O.fromUndefinedOr(config.cacheOnNavigation),
            reloadOnOnline: O.fromUndefinedOr(config.reloadOnOnline),
          }),
        })
      )
    )
  );

const makePlugins = (options: BeepNextConfigOptions): ReadonlyArray<NextConfigPlugin> =>
  pipe(A.make(makeMdxPlugin(options), makePwaPlugin(options), makeBundleAnalyzerPlugin(options)), A.getSomes);

const makeBaseConfig = (options: BeepNextConfigOptions): NextConfigFromNext => {
  const next = withDefault(options.next, {});
  const experimental = withDefault(next.experimental, {});
  const turbopack = withDefault(next.turbopack, {});
  const typescript = withDefault(next.typescript, {});

  return defineNextConfig({
    ...next,
    agentRules: withDefault(next.agentRules, false),
    allowedDevOrigins: mergeUniqueStrings(options.allowedDevOrigins, next.allowedDevOrigins),
    cacheComponents: withDefault(next.cacheComponents, true),
    outputFileTracingRoot: withDefault(next.outputFileTracingRoot, options.repoRoot),
    pageExtensions: mergeUniqueStrings(DEFAULT_PAGE_EXTENSIONS, options.additionalPageExtensions, next.pageExtensions),
    poweredByHeader: withDefault(next.poweredByHeader, false),
    reactCompiler: withDefault(next.reactCompiler, true),
    reactStrictMode: withDefault(next.reactStrictMode, true),
    transpilePackages: mergeUniqueStrings(
      DEFAULT_TRANSPILE_PACKAGES,
      options.additionalTranspilePackages,
      next.transpilePackages
    ),
    turbopack: {
      root: options.repoRoot,
      ...turbopack,
    },
    typedRoutes: withDefault(next.typedRoutes, true),
    typescript: {
      tsconfigPath: "tsconfig.next.json",
      ...typescript,
    },
    experimental: {
      cssChunking: true,
      mcpServer: true,
      mdxRs: true,
      turbopackFileSystemCacheForBuild: true,
      turbopackFileSystemCacheForDev: true,
      ...experimental,
      optimizePackageImports: mergeUniqueStrings(
        DEFAULT_OPTIMIZE_PACKAGE_IMPORTS,
        options.additionalOptimizePackageImports,
        experimental.optimizePackageImports
      ),
    },
  });
};

/**
 * Decode an unknown environment snapshot for the shared Next.js preset.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { decodeBeepNextConfigEnv } from "@beep/repo-configs/next"
 * const program = decodeBeepNextConfigEnv({ ANALYZE: "1" })
 * console.log(Effect.runPromise(program))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeBeepNextConfigEnv = BeepNextConfigEnv.decodeEffect;

/**
 * Synchronously decode an environment snapshot for the shared Next.js preset.
 *
 * @param env - Unknown environment snapshot containing shared preset toggles.
 * @returns The decoded environment toggle object.
 * @example
 * ```ts
 * import { defineBeepNextConfigEnv } from "@beep/repo-configs/next"
 * const env = defineBeepNextConfigEnv({ NEXT_DISABLE_PWA: "0" })
 * console.log(env)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const defineBeepNextConfigEnv = (env: unknown): BeepNextConfigEnv =>
  Result.getOrThrowWith(decodeBeepNextConfigEnvResult(env), schemaIssueToError);

/**
 * Compose Next.js config plugin functions in explicit left-to-right order.
 *
 * @example
 * ```ts
 * import { composeNextConfig } from "@beep/repo-configs/next"
 * const config = composeNextConfig({ reactStrictMode: true }, [
 *   (current) => ({ ...current, poweredByHeader: false })
 * ])
 * console.log(config)
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const composeNextConfig: {
  (config: NextConfigFromNext, plugins: ReadonlyArray<NextConfigPlugin>): NextConfigFromNext;
  (plugins: ReadonlyArray<NextConfigPlugin>): (config: NextConfigFromNext) => NextConfigFromNext;
} = dual(
  2,
  (config: NextConfigFromNext, plugins: ReadonlyArray<NextConfigPlugin>): NextConfigFromNext =>
    pipe(
      plugins,
      A.reduce(config, (current, plugin) => plugin(current))
    )
);

/**
 * Build the shared repo-owned Next.js base config before plugin wrapping.
 *
 * @param options - User-authored shared Next.js preset options.
 * @returns The shared base Next.js configuration before plugin wrapping.
 * @example
 * ```ts
 * import { makeBeepNextBaseConfig } from "@beep/repo-configs/next"
 * const config = makeBeepNextBaseConfig({
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.localhost"]
 * })
 * console.log(config)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeBeepNextBaseConfig = (options: BeepNextConfigOptionsInput): NextConfigFromNext =>
  makeBaseConfig(Result.getOrThrowWith(decodeBeepNextConfigOptionsResult(options), schemaIssueToError));

/**
 * Define a shared repo-owned Next.js config with the standard plugin stack.
 *
 * @param options - User-authored shared Next.js preset options.
 * @returns The fully composed shared Next.js configuration.
 * @remarks
 * The canonical composition order is MDX, then PWA, then bundle analyzer.
 * Secure headers are added to the base config before those plugin wrappers.
 * @example
 * ```ts
 * import { defineBeepNextConfig } from "@beep/repo-configs/next"
 * const config = defineBeepNextConfig({
 *   repoRoot: "/repo",
 *   allowedDevOrigins: ["oip-web.localhost"],
 *   env: { NEXT_DISABLE_PWA: "1" }
 * })
 * console.log(config)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const defineBeepNextConfig = (options: BeepNextConfigOptionsInput): NextConfigFromNext => {
  const decoded = Result.getOrThrowWith(decodeBeepNextConfigOptionsResult(options), schemaIssueToError);
  return pipe(
    decoded,
    makeBaseConfig,
    (config) => withSecureHeaders(config, decoded.securityHeaders),
    (config) => composeNextConfig(config, makePlugins(decoded))
  );
};
