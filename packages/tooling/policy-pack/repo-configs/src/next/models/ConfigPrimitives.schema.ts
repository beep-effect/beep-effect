/**
 * Shared schemas for named Next.js configuration declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/ConfigPrimitives.schema");

const StringArray = S.String.pipe(S.Array, S.mutable);
const RegExpArray = S.RegExp.pipe(S.Array, S.mutable);
const StringOrStringArray = S.Union([S.String, StringArray]);

/**
 * **Example** (Make domain locale entry)
 *
 * ```ts
 * import { DomainLocale } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const locale = DomainLocale.make({
 *   defaultLocale: "en",
 *   domain: "example.com"
 * })
 * console.log(locale)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DomainLocale extends S.Opaque<DomainLocale, { readonly brand: unique symbol }>()(
  S.Struct({
    defaultLocale: S.NonEmptyString.annotateKey({
      description: "Default locale served for the configured domain.",
    }),
    domain: S.NonEmptyString.annotateKey({
      description: "Domain name used for locale routing.",
    }),
    http: S.optionalKey(S.Literal(true).annotateKey({ description: "Whether the domain uses HTTP." })),
    locales: S.optionalKey(StringArray.annotateKey({ description: "Locales served for this domain." })),
  }).pipe(
    $I.annoteSchema("DomainLocale", {
      description: "Locale-specific domain routing entry for Next.js internationalization.",
    })
  )
) {}

/**
 * **Example** (Make i18n configuration)
 *
 * ```ts
 * import { I18NConfig } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const i18n = I18NConfig.make({
 *   defaultLocale: "en",
 *   locales: ["en", "es"]
 * })
 * console.log(i18n)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class I18NConfig extends S.Opaque<I18NConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    defaultLocale: S.NonEmptyString.annotateKey({
      description: "Default locale for the application.",
      documentation: "https://nextjs.org/docs/advanced-features/i18n-routing",
    }),
    domains: S.optionalKey(
      DomainLocale.pipe(S.Array, S.mutable, S.annotateKey({ description: "Domain locale routing entries." }))
    ),
    localeDetection: S.optionalKey(
      S.Literal(false).annotateKey({ description: "Disables automatic locale detection." })
    ),
    locales: StringArray.annotateKey({
      description: "Locales supported by the application.",
      documentation: "https://nextjs.org/docs/advanced-features/i18n-routing",
    }),
  }).pipe(
    $I.annoteSchema("I18NConfig", {
      description: "Internationalization configuration for a Next.js app.",
      documentation: "https://nextjs.org/docs/advanced-features/i18n-routing",
    })
  )
) {}

/**
 * **Example** (Make TypeScript config path)
 *
 * ```ts
 * import { TypeScriptConfig } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const config = TypeScriptConfig.make({ tsconfigPath: "tsconfig.next.json" })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TypeScriptConfig extends S.Opaque<TypeScriptConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    ignoreBuildErrors: S.optionalKey(
      S.Boolean.annotateKey({ description: "Do not run TypeScript during production builds." })
    ),
    tsconfigPath: S.optionalKey(
      S.NonEmptyString.annotateKey({
        description: "Relative path to a custom tsconfig file.",
        documentation: "https://nextjs.org/docs/app/api-reference/config/typescript",
      })
    ),
  }).pipe(
    $I.annoteSchema("TypeScriptConfig", {
      description: "Next.js TypeScript configuration block.",
    })
  )
) {}

/**
 * **Example** (Make query with slug)
 *
 * ```ts
 * import { NextParsedUrlQuery } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const query = NextParsedUrlQuery.make({ slug: "hello" })
 * console.log(query)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NextParsedUrlQuery = S.Record(S.String, StringOrStringArray).pipe(
  $I.annoteSchema("NextParsedUrlQuery", {
    description: "Route export path map entry query parameters.",
  })
);

/**
 * **Example** (Type query parameters object)
 *
 * ```ts
 * import type { NextParsedUrlQuery } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const query: NextParsedUrlQuery = { slug: "hello" }
 * console.log(query)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NextParsedUrlQuery = typeof NextParsedUrlQuery.Type;

/**
 * **Example** (Export a dynamic patent page as a static path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExportPathMapEntry } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 *
 * const entry = S.decodeUnknownSync(ExportPathMapEntry)({ page: "/patents/[id]", query: { id: "US11234567B2" } })
 *
 * console.log(entry.page) // => "/patents/[id]"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportPathMapEntry extends S.Opaque<ExportPathMapEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    page: S.String.annotateKey({ description: "Page route that should render this export path." }),
    query: S.optionalKey(NextParsedUrlQuery.annotateKey({ description: "Query parameters for the exported path." })),
  }).pipe(
    $I.annoteSchema("ExportPathMapEntry", {
      description: "Public export path map entry returned by next.config.js exportPathMap.",
    })
  )
) {}

/**
 * **Example** (Make export path map)
 *
 * ```ts
 * import { ExportPathMap } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const paths = ExportPathMap.make({
 *   "/": { page: "/" }
 * })
 * console.log(paths)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExportPathMap = S.Record(S.String, ExportPathMapEntry).pipe(
  $I.annoteSchema("ExportPathMap", {
    description: "Public export path map returned by next.config.js exportPathMap.",
  })
);

/**
 * **Example** (Type export path map)
 *
 * ```ts
 * import type { ExportPathMap } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * import { ExportPathMapEntry } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 *
 * const paths: ExportPathMap = {
 *   "/": ExportPathMapEntry.make({ page: "/" }),
 *   "/about": ExportPathMapEntry.make({ page: "/about", query: { ref: "nav" } })
 * }
 * console.log(paths["/about"]?.page) // /about
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExportPathMap = typeof ExportPathMap.Type;

/**
 * Log full fetch request URLs.
 *
 * @category models
 * @since 0.0.0
 */
class FetchLoggingConfig extends S.Opaque<FetchLoggingConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    fullUrl: S.optionalKey(S.Boolean.annotateKey({ description: "Log full fetch request URLs." })),
    hmrRefreshes: S.optionalKey(
      S.Boolean.annotateKey({
        description: "If true, fetch requests restored from the HMR cache are logged during an HMR refresh request.",
      })
    ),
  }).pipe(
    $I.annoteSchema("FetchLoggingConfig", {
      description: "Fetch logging configuration.",
    })
  )
) {}

/**
 * Incoming request logging ignore rules: regular expressions matching requests that should not be
 * logged.
 *
 * **Example** (Skip health checks in the request log)
 *
 * ```ts
 * import { IncomingRequestLoggingConfig } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 *
 * const logging = IncomingRequestLoggingConfig.make({ ignore: [/^\/api\/health/, /^\/_next\/static/] })
 *
 * console.log(logging.ignore?.some((pattern) => pattern.test("/api/health/live"))) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IncomingRequestLoggingConfig extends S.Opaque<
  IncomingRequestLoggingConfig,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ignore: S.optionalKey(
      RegExpArray.annotateKey({
        description: "Regular expressions matching incoming requests that should not be logged.",
      })
    ),
  }).pipe(
    $I.annoteSchema("IncomingRequestLoggingConfig", {
      description: "Incoming request logging ignore rules.",
    })
  )
) {}

/**
 * **Example** (Make fetch logging config)
 *
 * ```ts
 * import { LoggingConfig } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const logging = LoggingConfig.make({ fetches: { fullUrl: true } })
 * console.log(logging)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LoggingConfig extends S.Opaque<LoggingConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    fetches: S.optionalKey(FetchLoggingConfig.annotateKey({ description: "Fetch logging configuration." })),
    incomingRequests: S.optionalKey(
      S.Union([S.Boolean, IncomingRequestLoggingConfig]).annotateKey({
        description: "Incoming request logging configuration.",
      })
    ),
    serverFunctions: S.optionalKey(
      S.Boolean.annotateKey({ description: "If false, Server Function invocation logging is disabled." })
    ),
    browserToTerminal: S.optionalKey(
      S.Union([S.Boolean, LiteralKit(["error", "warn"])]).annotateKey({
        description: "Forward browser console logs to the terminal.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LoggingConfig", {
      description: "Logging configuration for Next.js.",
    })
  )
) {}

/**
 * **Example** (Select nesting feature enum)
 *
 * ```ts
 * import { LightningCssFeature } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const feature = LightningCssFeature.Enum.nesting
 * console.log(feature)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LightningCssFeature = LiteralKit([
  "nesting",
  "not-selector-list",
  "dir-selector",
  "lang-selector-list",
  "is-selector",
  "text-decoration-thickness-percent",
  "media-interval-syntax",
  "media-range-syntax",
  "custom-media-queries",
  "clamp-function",
  "color-function",
  "oklab-colors",
  "lab-colors",
  "p3-colors",
  "hex-alpha-colors",
  "space-separated-color-notation",
  "font-family-system-ui",
  "double-position-gradients",
  "vendor-prefixes",
  "logical-properties",
  "light-dark",
  "selectors",
  "media-queries",
  "colors",
]).pipe(
  $I.annoteSchema("LightningCssFeature", {
    description: "Lightning CSS feature name accepted by Next.js.",
  })
);

/**
 * **Example** (Satisfy nesting feature type)
 *
 * ```ts
 * import type { LightningCssFeature } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const feature = "nesting" satisfies LightningCssFeature
 * console.log(feature)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LightningCssFeature = typeof LightningCssFeature.Type;

/**
 * **Example** (Make features include nesting)
 *
 * ```ts
 * import { LightningCssFeatures } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const features = LightningCssFeatures.make({ include: ["nesting"] })
 * console.log(features)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LightningCssFeatures extends S.Opaque<LightningCssFeatures, { readonly brand: unique symbol }>()(
  S.Struct({
    include: S.optionalKey(
      LightningCssFeature.pipe(
        S.Array,
        S.mutable,
        S.annotateKey({ description: "Lightning CSS features to always include." })
      )
    ),
    exclude: S.optionalKey(
      LightningCssFeature.pipe(
        S.Array,
        S.mutable,
        S.annotateKey({ description: "Lightning CSS features to always exclude." })
      )
    ),
  }).pipe(
    $I.annoteSchema("LightningCssFeatures", {
      description: "Lightning CSS include/exclude feature configuration.",
    })
  )
) {}
