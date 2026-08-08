/**
 * Shared schemas for named Next.js configuration declarations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// cspell:words oklab
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/ConfigPrimitives.schema");

const StringArray = S.String.pipe(S.Array, S.mutable);
const RegExpArray = S.RegExp.pipe(S.Array, S.mutable);
const StringOrStringArray = S.Union([S.String, StringArray]);

/**
 * Locale-specific domain routing entry for Next.js internationalization.
 *
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
export class DomainLocale extends S.Class<DomainLocale>($I`DomainLocale`)(
  {
    defaultLocale: S.NonEmptyString.annotateKey({
      description: "Default locale served for the configured domain.",
    }),
    domain: S.NonEmptyString.annotateKey({
      description: "Domain name used for locale routing.",
    }),
    http: S.optionalKey(S.Literal(true).annotateKey({ description: "Whether the domain uses HTTP." })),
    locales: S.optionalKey(StringArray.annotateKey({ description: "Locales served for this domain." })),
  },
  $I.annote("DomainLocale", {
    description: "Locale-specific domain routing entry for Next.js internationalization.",
  })
) {}

/**
 * Internationalization configuration for a Next.js app.
 *
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
export class I18NConfig extends S.Class<I18NConfig>($I`I18NConfig`)(
  {
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
  },
  $I.annote("I18NConfig", {
    description: "Internationalization configuration for a Next.js app.",
    documentation: "https://nextjs.org/docs/advanced-features/i18n-routing",
  })
) {}

/**
 * Next.js TypeScript configuration block.
 *
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
export class TypeScriptConfig extends S.Class<TypeScriptConfig>($I`TypeScriptConfig`)(
  {
    ignoreBuildErrors: S.optionalKey(
      S.Boolean.annotateKey({ description: "Do not run TypeScript during production builds." })
    ),
    tsconfigPath: S.optionalKey(
      S.NonEmptyString.annotateKey({
        description: "Relative path to a custom tsconfig file.",
        documentation: "https://nextjs.org/docs/app/api-reference/config/typescript",
      })
    ),
  },
  $I.annote("TypeScriptConfig", {
    description: "Next.js TypeScript configuration block.",
  })
) {}

/**
 * Route export path map entry query parameters.
 *
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
 * Route export path map entry query parameters.
 *
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

class ExportPathMapEntry extends S.Class<ExportPathMapEntry>($I`ExportPathMapEntry`)(
  {
    page: S.String.annotateKey({ description: "Page route that should render this export path." }),
    query: S.optionalKey(NextParsedUrlQuery.annotateKey({ description: "Query parameters for the exported path." })),
  },
  $I.annote("ExportPathMapEntry", {
    description: "Public export path map entry returned by next.config.js exportPathMap.",
  })
) {}

/**
 * Public export path map returned by `next.config.js` `exportPathMap`.
 *
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
 * Public export path map returned by `next.config.js` `exportPathMap`.
 *
 * **Example** (Type export path map)
 *
 * ```ts
 * import type { ExportPathMap } from "@beep/repo-configs/next/models/ConfigPrimitives.schema"
 * const paths: ExportPathMap = { "/": { page: "/" } }
 * console.log(paths)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ExportPathMap = typeof ExportPathMap.Type;

class FetchLoggingConfig extends S.Class<FetchLoggingConfig>($I`FetchLoggingConfig`)(
  {
    fullUrl: S.optionalKey(S.Boolean.annotateKey({ description: "Log full fetch request URLs." })),
    hmrRefreshes: S.optionalKey(
      S.Boolean.annotateKey({
        description: "If true, fetch requests restored from the HMR cache are logged during an HMR refresh request.",
      })
    ),
  },
  $I.annote("FetchLoggingConfig", {
    description: "Fetch logging configuration.",
  })
) {}

class IncomingRequestLoggingConfig extends S.Class<IncomingRequestLoggingConfig>($I`IncomingRequestLoggingConfig`)(
  {
    ignore: S.optionalKey(
      RegExpArray.annotateKey({
        description: "Regular expressions matching incoming requests that should not be logged.",
      })
    ),
  },
  $I.annote("IncomingRequestLoggingConfig", {
    description: "Incoming request logging ignore rules.",
  })
) {}

/**
 * Fetch logging configuration used by Next.js.
 *
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
export class LoggingConfig extends S.Class<LoggingConfig>($I`LoggingConfig`)(
  {
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
  },
  $I.annote("LoggingConfig", {
    description: "Logging configuration for Next.js.",
  })
) {}

/**
 * Lightning CSS feature name accepted by Next.js.
 *
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
 * Lightning CSS feature name accepted by Next.js.
 *
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
 * Lightning CSS include/exclude feature configuration.
 *
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
export class LightningCssFeatures extends S.Class<LightningCssFeatures>($I`LightningCssFeatures`)(
  {
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
  },
  $I.annote("LightningCssFeatures", {
    description: "Lightning CSS include/exclude feature configuration.",
  })
) {}
