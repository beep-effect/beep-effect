/**
 * Schema for the public Next.js experimental configuration surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// cspell:words Navigations
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { isFunctionValue } from "../internal.ts";
import { LightningCssFeatures } from "./ConfigPrimitives.schema.ts";
import { SizeLimit } from "./Shared.schema.ts";
import { SubresourceIntegrityAlgorithm } from "./SubresourceIntegrityPlugin.schema.ts";
import type { ExperimentalConfig as ExperimentalConfigFromNext } from "next/dist/server/config-shared.js";

const $I = $RepoConfigsId.create("next/models/ExperimentalConfig.schema");

const StringArray = S.String.pipe(S.Array, S.mutable);
const UnknownRecord = S.Record(S.String, S.Unknown);
const BooleanOrStrict = S.Union([S.Boolean, S.Literal("strict")]);
const ProxyPrefetchMode = LiteralKit(["strict", "flexible"]).pipe(
  $I.annoteSchema("ProxyPrefetchMode", {
    description: "Allowed Next.js proxy prefetch modes.",
  })
);
const WebVitalsMetric = LiteralKit(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]).pipe(
  $I.annoteSchema("WebVitalsMetric", {
    description: "Web Vitals metric identifiers accepted by Next.js experimental config.",
  })
);
const TurbopackRuntimeStrategy = LiteralKit(["workerThreads", "childProcesses"]).pipe(
  $I.annoteSchema("TurbopackRuntimeStrategy", {
    description: "Runtime strategies accepted by Next.js Turbopack configuration.",
  })
);
const TurbopackModuleIds = LiteralKit(["named", "deterministic"]).pipe(
  $I.annoteSchema("TurbopackModuleIds", {
    description: "Turbopack module id strategies accepted by Next.js experimental config.",
  })
);
const MdxType = LiteralKit(["gfm", "commonmark"]).pipe(
  $I.annoteSchema("MdxType", {
    description: "MDX parser modes accepted by Next.js experimental config.",
  })
);
const BrowserDebugLevel = LiteralKit(["error", "warn", "verbose"]).pipe(
  $I.annoteSchema("BrowserDebugLevel", {
    description: "Browser debug log levels accepted by Next.js experimental config.",
  })
);
const ReportSystemEnvInlining = LiteralKit(["error", "warn"]).pipe(
  $I.annoteSchema("ReportSystemEnvInlining", {
    description: "System environment inlining report levels accepted by Next.js experimental config.",
  })
);
const SwcEnvMode = LiteralKit(["usage", "entry"]).pipe(
  $I.annoteSchema("SwcEnvMode", {
    description: "SWC environment transform modes accepted by Next.js experimental config.",
  })
);

const typedUnknown = <A>(name: string, description: string) =>
  S.declare<A>((value: unknown): value is A => P.isUnknown(value), {
    expected: "Unknown",
    description,
  }).pipe(
    $I.annoteSchema(name, {
      description,
    })
  );

const UrlImports = typedUnknown<NonNullable<ExperimentalConfigFromNext["urlImports"]>>(
  "UrlImports",
  "Webpack buildHttp value accepted by Next.js urlImports."
);

const OnBeforeDeferredEntries = S.declare<NonNullable<ExperimentalConfigFromNext["onBeforeDeferredEntries"]>>(
  isFunctionValue,
  {
    expected: "Function",
    description: "Async function called before processing deferred entries.",
  }
).pipe(
  $I.annoteSchema("OnBeforeDeferredEntries", {
    description: "Async function called before processing deferred entries.",
  })
);

class CacheLifeProfile extends S.Class<CacheLifeProfile>($I`CacheLifeProfile`)(
  {
    stale: S.optionalKey(S.Finite),
    revalidate: S.optionalKey(S.Finite),
    expire: S.optionalKey(S.Finite),
  },
  $I.annote("CacheLifeProfile", {
    description: "Cache life timing profile for a named cache strategy.",
  })
) {}

const CacheLife = S.Record(S.String, CacheLifeProfile);

class PrefetchInliningOptions extends S.Class<PrefetchInliningOptions>($I`PrefetchInliningOptions`)(
  {
    maxSize: S.optionalKey(S.Finite),
    maxBundleSize: S.optionalKey(S.Finite),
  },
  $I.annote("PrefetchInliningOptions", {
    description: "Prefetch inlining size limits.",
  })
) {}

const PrefetchInlining = S.Union([S.Boolean, PrefetchInliningOptions]);

class StaleTimes extends S.Class<StaleTimes>($I`StaleTimes`)(
  {
    dynamic: S.optionalKey(S.Finite),
    static: S.optionalKey(
      S.Finite.check(
        S.isGreaterThanOrEqualTo(30, {
          identifier: $I`StaleTimesStaticMinimum`,
          title: "Static stale time minimum",
          description: "The static stale time must be at least 30 seconds.",
        })
      )
    ),
  },
  $I.annote("StaleTimes", {
    description: "Stale time settings for dynamic and static routes.",
  })
) {}

class SwcEnvOptions extends S.Class<SwcEnvOptions>($I`SwcEnvOptions`)(
  {
    mode: S.optionalKey(SwcEnvMode),
    coreJs: S.optionalKey(S.String),
    skip: S.optionalKey(StringArray),
    include: S.optionalKey(StringArray),
    exclude: S.optionalKey(StringArray),
    shippedProposals: S.optionalKey(S.Boolean),
    forceAllTransforms: S.optionalKey(S.Boolean),
    debug: S.optionalKey(S.Boolean),
    loose: S.optionalKey(S.Boolean),
  },
  $I.annote("SwcEnvOptions", {
    description: "SWC environment transform options.",
  })
) {}

class SriConfig extends S.Class<SriConfig>($I`SriConfig`)(
  {
    algorithm: S.optionalKey(SubresourceIntegrityAlgorithm),
  },
  $I.annote("SriConfig", {
    description: "Subresource integrity configuration.",
  })
) {}

class MdxRsConfig extends S.Class<MdxRsConfig>($I`MdxRsConfig`)(
  {
    development: S.optionalKey(S.Boolean),
    jsx: S.optionalKey(S.Boolean),
    jsxRuntime: S.optionalKey(S.String),
    jsxImportSource: S.optionalKey(S.String),
    providerImportSource: S.optionalKey(S.String),
    mdxType: S.optionalKey(MdxType),
  },
  $I.annote("MdxRsConfig", {
    description: "Rust MDX compiler configuration.",
  })
) {}

class ServerActions extends S.Class<ServerActions>($I`ServerActions`)(
  {
    bodySizeLimit: S.optionalKey(SizeLimit),
    allowedOrigins: S.optionalKey(StringArray),
  },
  $I.annote("ServerActions", {
    description: "Server Actions configuration.",
  })
) {}

class SlowModuleDetection extends S.Class<SlowModuleDetection>($I`SlowModuleDetection`)(
  {
    buildTimeThresholdMs: S.Int.annotateKey({ description: "Build time threshold in milliseconds." }),
  },
  $I.annote("SlowModuleDetection", {
    description: "Slow module detection configuration.",
  })
) {}

class BrowserDebugInfoInTerminalOptions extends S.Class<BrowserDebugInfoInTerminalOptions>(
  $I`BrowserDebugInfoInTerminalOptions`
)(
  {
    level: S.optionalKey(BrowserDebugLevel),
    depthLimit: S.optionalKey(S.Finite),
    edgeLimit: S.optionalKey(S.Finite),
    showSourceLocation: S.optionalKey(S.Boolean),
  },
  $I.annote("BrowserDebugInfoInTerminalOptions", {
    description: "Browser debug output controls for terminal rendering.",
  })
) {}

const BrowserDebugInfoInTerminal = S.Union([S.Boolean, BrowserDebugLevel, BrowserDebugInfoInTerminalOptions]);

const SwcPlugins = S.Tuple([S.String, UnknownRecord]).pipe(S.mutable, S.Array, S.mutable);

/**
 * Public experimental configuration accepted by Next.js.
 *
 * @example
 * ```ts
 * import { ExperimentalConfig } from "@beep/repo-configs/next/models/ExperimentalConfig.schema"
 * const config = ExperimentalConfig.make({
 *   cssChunking: true,
 *   mcpServer: true
 * })
 * console.log(config)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ExperimentalConfig extends S.Class<ExperimentalConfig>($I`ExperimentalConfig`)(
  {
    outputHashSalt: S.optionalKey(S.String),
    appNewScrollHandler: S.optionalKey(S.Boolean),
    useSkewCookie: S.optionalKey(S.Boolean),
    cacheHandlers: S.optionalKey(S.Record(S.String, S.UndefinedOr(S.String))),
    multiZoneDraftMode: S.optionalKey(S.Boolean),
    appNavFailHandling: S.optionalKey(S.Boolean),
    prerenderEarlyExit: S.optionalKey(S.Boolean),
    linkNoTouchStart: S.optionalKey(S.Boolean),
    caseSensitiveRoutes: S.optionalKey(S.Boolean),
    clientParamParsingOrigins: S.optionalKey(StringArray),
    cachedNavigations: S.optionalKey(S.Boolean),
    partialFallbacks: S.optionalKey(S.Boolean),
    dynamicOnHover: S.optionalKey(S.Boolean),
    useOffline: S.optionalKey(S.Boolean),
    optimisticRouting: S.optionalKey(S.Boolean),
    varyParams: S.optionalKey(S.Boolean),
    prefetchInlining: S.optionalKey(PrefetchInlining),
    preloadEntriesOnStart: S.optionalKey(S.Boolean),
    clientRouterFilter: S.optionalKey(S.Boolean),
    clientRouterFilterRedirects: S.optionalKey(S.Boolean),
    staleTimes: S.optionalKey(StaleTimes),
    cacheLife: S.optionalKey(CacheLife),
    clientRouterFilterAllowedRate: S.optionalKey(S.Finite),
    externalMiddlewareRewritesResolve: S.optionalKey(S.Boolean),
    externalProxyRewritesResolve: S.optionalKey(S.Boolean),
    exposeTestingApiInProductionBuild: S.optionalKey(S.Boolean),
    instantNavigationDevToolsToggle: S.optionalKey(S.Boolean),
    extensionAlias: S.optionalKey(S.Record(S.String, S.Unknown)),
    allowedRevalidateHeaderKeys: S.optionalKey(StringArray),
    fetchCacheKeyPrefix: S.optionalKey(S.String),
    imgOptConcurrency: S.optionalKey(S.Finite.pipe(S.NullOr)),
    imgOptTimeoutInSeconds: S.optionalKey(S.Finite),
    imgOptMaxInputPixels: S.optionalKey(S.Finite),
    imgOptSequentialRead: S.optionalKey(S.Boolean.pipe(S.NullOr)),
    imgOptSkipMetadata: S.optionalKey(S.Boolean.pipe(S.NullOr)),
    optimisticClientCache: S.optionalKey(S.Boolean),
    expireTime: S.optionalKey(S.Finite),
    middlewarePrefetch: S.optionalKey(ProxyPrefetchMode),
    proxyPrefetch: S.optionalKey(ProxyPrefetchMode),
    manualClientBasePath: S.optionalKey(S.Boolean),
    cssChunking: S.optionalKey(BooleanOrStrict),
    disablePostcssPresetEnv: S.optionalKey(S.Boolean),
    cpus: S.optionalKey(S.Finite),
    memoryBasedWorkersCount: S.optionalKey(S.Boolean),
    proxyTimeout: S.optionalKey(
      S.Finite.check(
        S.isGreaterThanOrEqualTo(0, {
          identifier: $I`ProxyTimeoutMinimum`,
          title: "Proxy timeout minimum",
          description: "Proxy timeout must be greater than or equal to zero.",
        })
      )
    ),
    isrFlushToDisk: S.optionalKey(S.Boolean),
    workerThreads: S.optionalKey(S.Boolean),
    optimizeCss: S.optionalKey(S.Union([S.Boolean, UnknownRecord])),
    nextScriptWorkers: S.optionalKey(S.Boolean),
    scrollRestoration: S.optionalKey(S.Boolean),
    externalDir: S.optionalKey(S.Boolean),
    disableOptimizedLoading: S.optionalKey(S.Boolean),
    gzipSize: S.optionalKey(S.Boolean),
    craCompat: S.optionalKey(S.Boolean),
    esmExternals: S.optionalKey(S.Union([S.Boolean, S.Literal("loose")])),
    fullySpecified: S.optionalKey(S.Boolean),
    urlImports: S.optionalKey(UrlImports),
    swcTraceProfiling: S.optionalKey(S.Boolean),
    forceSwcTransforms: S.optionalKey(S.Boolean),
    swcPlugins: S.optionalKey(SwcPlugins),
    swcEnvOptions: S.optionalKey(SwcEnvOptions),
    largePageDataBytes: S.optionalKey(S.Finite),
    fallbackNodePolyfills: S.optionalKey(S.Literal(false)),
    sri: S.optionalKey(SriConfig),
    webVitalsAttribution: S.optionalKey(WebVitalsMetric.pipe(S.Array, S.mutable)),
    optimizePackageImports: S.optionalKey(StringArray),
    optimizeServerReact: S.optionalKey(S.Boolean),
    strictRouteTypes: S.optionalKey(S.Boolean),
    transitionIndicator: S.optionalKey(S.Boolean),
    gestureTransition: S.optionalKey(S.Boolean),
    turbopackMemoryLimit: S.optionalKey(S.Finite),
    turbopackPluginRuntimeStrategy: S.optionalKey(TurbopackRuntimeStrategy),
    turbopackMinify: S.optionalKey(S.Boolean),
    turbopackImportTypeBytes: S.optionalKey(S.Boolean),
    turbopackImportTypeText: S.optionalKey(S.Boolean),
    turbopackScopeHoisting: S.optionalKey(S.Boolean),
    turbopackWorkerAssetPrefix: S.optionalKey(S.String),
    turbopackClientSideNestedAsyncChunking: S.optionalKey(S.Boolean),
    turbopackServerSideNestedAsyncChunking: S.optionalKey(S.Boolean),
    turbopackFileSystemCacheForDev: S.optionalKey(S.Boolean),
    turbopackFileSystemCacheForBuild: S.optionalKey(S.Boolean),
    turbopackSourceMaps: S.optionalKey(S.Boolean),
    turbopackInputSourceMaps: S.optionalKey(S.Boolean),
    turbopackTreeShaking: S.optionalKey(S.Boolean),
    turbopackRemoveUnusedImports: S.optionalKey(S.Boolean),
    turbopackRemoveUnusedExports: S.optionalKey(S.Boolean),
    turbopackInferModuleSideEffects: S.optionalKey(S.Boolean),
    turbopackUseBuiltinBabel: S.optionalKey(S.Boolean),
    turbopackUseBuiltinSass: S.optionalKey(S.Boolean),
    turbopackLocalPostcssConfig: S.optionalKey(S.Boolean),
    turbopackModuleIds: S.optionalKey(TurbopackModuleIds),
    turbopackServerFastRefresh: S.optionalKey(S.Boolean),
    mdxRs: S.optionalKey(S.Union([S.Boolean, MdxRsConfig])),
    typedRoutes: S.optionalKey(S.Boolean),
    typedEnv: S.optionalKey(S.Boolean),
    parallelServerCompiles: S.optionalKey(S.Boolean),
    parallelServerBuildTraces: S.optionalKey(S.Boolean),
    webpackBuildWorker: S.optionalKey(S.Boolean),
    webpackMemoryOptimizations: S.optionalKey(S.Boolean),
    clientTraceMetadata: S.optionalKey(StringArray),
    ppr: S.optionalKey(S.Union([S.Boolean, S.Literal("incremental")])),
    taint: S.optionalKey(S.Boolean),
    removeUncaughtErrorAndRejectionListeners: S.optionalKey(S.Boolean),
    validateRSCRequestHeaders: S.optionalKey(S.Boolean),
    serverActions: S.optionalKey(ServerActions),
    maxPostponedStateSize: S.optionalKey(SizeLimit),
    serverMinification: S.optionalKey(S.Boolean),
    serverSourceMaps: S.optionalKey(S.Boolean),
    useWasmBinary: S.optionalKey(S.Boolean),
    useLightningcss: S.optionalKey(S.Boolean),
    lightningCssFeatures: S.optionalKey(LightningCssFeatures),
    viewTransition: S.optionalKey(S.Boolean),
    testProxy: S.optionalKey(S.Boolean),
    defaultTestRunner: S.optionalKey(S.Literal("playwright")),
    allowDevelopmentBuild: S.optionalKey(S.Literal(true)),
    bundlePagesExternals: S.optionalKey(S.Boolean),
    serverComponentsExternalPackages: S.optionalKey(StringArray),
    reactDebugChannel: S.optionalKey(S.Boolean),
    cacheComponents: S.optionalKey(S.Boolean),
    staticGenerationRetryCount: S.optionalKey(S.Int),
    staticGenerationMaxConcurrency: S.optionalKey(S.Int),
    staticGenerationMinPagesPerWorker: S.optionalKey(S.Int),
    serverComponentsHmrCache: S.optionalKey(S.Boolean),
    inlineCss: S.optionalKey(S.Boolean),
    authInterrupts: S.optionalKey(S.Boolean),
    useCacheTimeout: S.optionalKey(
      S.Finite.check(
        S.isGreaterThan(0, {
          identifier: $I`UseCacheTimeoutPositive`,
          title: "Use cache timeout positive",
          description: "useCacheTimeout must be greater than zero.",
        })
      )
    ),
    useCache: S.optionalKey(S.Boolean),
    useNodeStreams: S.optionalKey(S.Boolean),
    slowModuleDetection: S.optionalKey(SlowModuleDetection),
    globalNotFound: S.optionalKey(S.Boolean),
    browserDebugInfoInTerminal: S.optionalKey(BrowserDebugInfoInTerminal),
    rootParams: S.optionalKey(S.Boolean),
    middlewareClientMaxBodySize: S.optionalKey(SizeLimit),
    proxyClientMaxBodySize: S.optionalKey(SizeLimit),
    mcpServer: S.optionalKey(S.Boolean),
    lockDistDir: S.optionalKey(S.Boolean),
    hideLogsAfterAbort: S.optionalKey(S.Boolean),
    runtimeServerDeploymentId: S.optionalKey(S.Boolean),
    supportsImmutableAssets: S.optionalKey(S.Boolean),
    deferredEntries: S.optionalKey(StringArray),
    onBeforeDeferredEntries: S.optionalKey(OnBeforeDeferredEntries),
    reportSystemEnvInlining: S.optionalKey(ReportSystemEnvInlining),
  },
  $I.annote("ExperimentalConfig", {
    description: "Public experimental configuration accepted by Next.js.",
  })
) {}
