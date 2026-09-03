/**
 * Schemas for Next.js image configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, NonNegNum, SchemaUtils } from "@beep/schema";
import { Struct } from "@beep/utils";
import { Result } from "effect";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/ImageConfig.schema");
const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Valid values for the Next.js image loader configuration.
 *
 * **Example** (Import LoaderValue constant)
 *
 * ```ts
 * import { LoaderValue } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const loader = LoaderValue
 * console.log(loader)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LoaderValue = LiteralKit(["default", "imgix", "cloudinary", "akamai", "custom"]).pipe(
  $I.annoteSchema("LoaderValue", {
    description: "Valid values for the loader configuration in the image component.",
  })
);

/**
 * Literal union of valid Next.js image loader values.
 *
 * **Example** (Assign default loader type)
 *
 * ```ts
 * import type { LoaderValue } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const loader: LoaderValue = "default"
 * console.log(loader)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type LoaderValue = typeof LoaderValue.Type;

const ImageQuality = S.Int.check(S.isBetween({ minimum: 1, maximum: 100 })).pipe(
  $I.annoteSchema("ImageQuality", {
    description: "Next.js image quality value from 1 through 100.",
  })
);

/**
 * Configuration properties passed to a Next.js image loader function.
 *
 * **Example** (Import ImageLoaderProps schema)
 *
 * ```ts
 * import { ImageLoaderProps } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const schema = ImageLoaderProps
 * console.log(schema)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImageLoaderProps extends S.Class<ImageLoaderProps>($I`ImageLoaderProps`)(
  {
    src: S.String,
    width: NonNegNum,
    quality: S.optionalKey(ImageQuality),
  },
  $I.annote("ImageLoaderProps", {
    description: "Configuration properties for the image loader component.",
  })
) {}

/**
 * Next.js local image matching pattern.
 *
 * **Example** (Make local pathname pattern)
 *
 * ```ts
 * import { LocalPattern } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const pattern = LocalPattern.make({ pathname: "/assets/**" })
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocalPattern extends S.Class<LocalPattern>($I`LocalPattern`)(
  {
    /**
     * Can be literal or wildcard.
     * Single `*` matches a single path segment.
     * Double `**` matches any number of path segments.
     */
    pathname: S.optionalKey(S.String).annotateKey({
      description:
        "Can be literal or wildcard.\nSingle `*` matches a single path segment.\nDouble `**` matches any number of path segments.",
    }),
    /**
     * Can be literal query string such as `?v=1` or
     * empty string meaning no query string.
     *
     */
    search: S.optionalKey(S.String).annotateKey({
      description: "Can be literal query string such as `?v=1` or\nempty string meaning no query string.",
    }),
  },
  $I.annote("LocalPattern", {
    description: "Next.js local image matching pattern.",
  })
) {}

/**
 * Next.js remote image matching pattern.
 *
 * **Example** (Make remote hostname pattern)
 *
 * ```ts
 * import { RemotePattern } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const pattern = RemotePattern.make({ hostname: "images.example.com" })
 * console.log(pattern)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RemotePattern extends S.Class<RemotePattern>($I`RemotePattern`)(
  {
    /**
     * Must be `http` or `https`.
     */
    protocol: S.optionalKey(
      LiteralKit(["http", "https"]).annotateKey({
        description: "Must be `http` or `https`.",
      })
    ),
    /**
     * Can be literal or wildcard.
     * Single `*` matches a single subdomain.
     * Double `**` matches any number of subdomains.
     */
    hostname: S.String.annotateKey({
      description:
        "Can be literal or wildcard.\nSingle `*` matches a single subdomain.\nDouble `**` matches any number of subdomains.",
    }),
    /**
     * Can be literal port such as `8080` or empty string
     * meaning no port.
     */
    port: S.optionalKey(S.String).annotateKey({
      description: "Can be literal port such as `8080` or empty string\nmeaning no port.",
    }),

    /**
     * Can be literal or wildcard.
     * Single `*` matches a single path segment.
     * Double `**` matches any number of path segments.
     */
    pathname: S.optionalKey(S.String).annotateKey({
      description:
        "Can be literal or wildcard.\nSingle `*` matches a single path segment.\nDouble `**` matches any number of path segments.",
    }),

    /**
     * Can be literal query string such as `?v=1` or
     * empty string meaning no query string.
     */
    search: S.optionalKey(S.String).annotateKey({
      description: "Can be literal query string such as `?v=1` or\nempty string meaning no query string.",
    }),
  },
  $I.annote("RemotePattern", {
    description: "Next.js remote image matching pattern.",
  })
) {}

/**
 * Supported image output formats for Next.js image optimization.
 *
 * **Example** (Import ImageFormat schema)
 *
 * ```ts
 * import { ImageFormat } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const format = ImageFormat
 * console.log(format)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageFormat = LiteralKit(["image/avif", "image/webp"]).pipe(
  $I.annoteSchema("ImageFormat", {
    description: "Supported image formats for Next.js Image component.",
  })
);

/**
 * Supported image output format for Next.js image optimization.
 *
 * **Example** (Satisfy webp image format)
 *
 * ```ts
 * import type { ImageFormat } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const format = "image/webp" satisfies ImageFormat
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ImageFormat = typeof ImageFormat.Type;

/**
 * Image configurations
 *
 * **Example** (Import complete image config)
 *
 * ```ts
 * import { ImageConfigComplete } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const schema = ImageConfigComplete
 * console.log(schema)
 * ```
 *
 * @see [Image configuration options](https://nextjs.org/docs/api-reference/next/image#configuration-options)
 * @category models
 * @since 0.0.0
 */
export class ImageConfigComplete extends S.Class<ImageConfigComplete>($I`ImageConfigComplete`)(
  {
    /** @see [Device sizes documentation](https://nextjs.org/docs/api-reference/next/image#device-sizes) */
    deviceSizes: NonNegativeInt.pipe(
      S.Array,
      S.mutable,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/api-reference/next/image#device-sizes",
      })
    ),

    /** @see [Image sizing documentation](https://nextjs.org/docs/app/building-your-application/optimizing/images#image-sizing) */
    imageSizes: NonNegativeInt.pipe(
      S.Array,
      S.mutable,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/app/building-your-application/optimizing/images#image-sizing",
      })
    ),

    /** @see [Image loaders configuration](https://nextjs.org/docs/api-reference/next/legacy/image#loader) */
    loader: LoaderValue.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/legacy/image#loader",
    }),

    /** @see [Image loader configuration](https://nextjs.org/docs/app/api-reference/components/image#path) */
    path: S.String.annotateKey({
      documentation: "https://nextjs.org/docs/app/api-reference/components/image#path",
    }),

    /** @see [Image loader configuration](https://nextjs.org/docs/api-reference/next/image#loader-configuration) */
    loaderFile: S.String.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#loader-configuration",
    }),

    /** @see [Disable static image import configuration](https://nextjs.org/docs/api-reference/next/image#disable-static-imports) */
    disableStaticImages: S.Boolean.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#disable-static-imports",
    }),

    /** @see [Cache behavior](https://nextjs.org/docs/api-reference/next/image#caching-behavior) */
    minimumCacheTTL: NonNegativeInt.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#caching-behavior",
    }),

    /** @see [Acceptable formats](https://nextjs.org/docs/api-reference/next/image#acceptable-formats) */
    formats: ImageFormat.pipe(
      S.Array,
      S.mutable,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/api-reference/next/image#acceptable-formats",
      })
    ),

    /** @see [Maximum Disk Cache Size (in bytes)](https://nextjs.org/docs/api-reference/next/image#maximumdiskcachesize) */
    maximumDiskCacheSize: S.UndefinedOr(NonNegativeInt).annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#maximumdiskcachesize",
    }),

    /** @see [Maximum Redirects](https://nextjs.org/docs/api-reference/next/image#maximumredirects) */
    maximumRedirects: NonNegativeInt.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#maximumredirects",
    }),

    /** @see [Maximum Response Body](https://nextjs.org/docs/api-reference/next/image#maximumresponsebody) */
    maximumResponseBody: NonNegativeInt.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#maximumresponsebody",
    }),

    /** @see [Dangerously Allow Local IP](https://nextjs.org/docs/api-reference/next/image#dangerously-allow-local-ip) */
    dangerouslyAllowLocalIP: S.Boolean.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#dangerously-allow-local-ip",
    }),

    /** @see [Dangerously Allow SVG](https://nextjs.org/docs/api-reference/next/image#dangerously-allow-svg) */
    dangerouslyAllowSVG: S.Boolean.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#dangerously-allow-svg",
    }),

    /** @see [Content Security Policy](https://nextjs.org/docs/api-reference/next/image#contentsecuritypolicy) */
    contentSecurityPolicy: S.String.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#contentsecuritypolicy",
    }),

    /** @see [Content Disposition Type](https://nextjs.org/docs/api-reference/next/image#contentdispositiontype) */
    contentDispositionType: LiteralKit(["inline", "attachment"]).annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#contentdispositiontype",
    }),

    /** @see [Remote Patterns](https://nextjs.org/docs/api-reference/next/image#remotepatterns) */
    remotePatterns: S.Union([S.URL, RemotePattern]).pipe(
      S.Array,
      S.mutable,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/api-reference/next/image#remotepatterns",
      })
    ),

    /** @see [Local Patterns](https://nextjs.org/docs/api-reference/next/image#localPatterns) */
    localPatterns: LocalPattern.pipe(
      S.Array,
      S.mutable,
      S.UndefinedOr,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/api-reference/next/image#localPatterns",
      })
    ),

    /** @see [Qualities](https://nextjs.org/docs/api-reference/next/image#qualities) */
    qualities: ImageQuality.pipe(
      S.Array,
      S.mutable,
      S.UndefinedOr,
      S.annotateKey({
        documentation: "https://nextjs.org/docs/api-reference/next/image#qualities",
      })
    ),

    /** @see [Unoptimized](https://nextjs.org/docs/api-reference/next/image#unoptimized) */
    unoptimized: S.Boolean.annotateKey({
      documentation: "https://nextjs.org/docs/api-reference/next/image#unoptimized",
    }),

    /**
     * When true, the `cacheHandler` configured in next.config.js will also be used
     * for caching optimized images. When false, images use the default filesystem cache.
     *
     * @see [Image Optimization Caching](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandler#image-optimization-caching)
     */
    customCacheHandler: S.Boolean.annotateKey({
      description:
        "When true, the `cacheHandler` configured in next.config.js will also be used\n" +
        "for caching optimized images. When false, images use the default filesystem cache.\n" +
        "",
      documentation:
        "https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandler#image-optimization-caching",
    }),
  },
  $I.annote("ImageConfigComplete", {
    description: "Image configurations",
    documentation: "https://nextjs.org/docs/api-reference/next/image#configuration-options",
  })
) {}

/**
 * Partial Next.js image configuration with repo-default statics.
 *
 * **Example** (Import ImageConfig schema)
 *
 * ```ts
 * import { ImageConfig } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const config = ImageConfig
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImageConfig = ImageConfigComplete.mapFields(Struct.map(S.optionalKey)).pipe(
  SchemaUtils.withStatics((schema) => ({
    default: Result.getOrThrowWith(
      S.decodeResult(schema)({
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [32, 48, 64, 96, 128, 256, 384],
        path: "/_next/image",
        loader: "default",
        loaderFile: "",
        disableStaticImages: false,
        minimumCacheTTL: 14400, // 4 hours
        formats: ["image/webp"],
        maximumDiskCacheSize: undefined, // auto-detect by default
        maximumRedirects: 3,
        maximumResponseBody: 50_000_000, // 50 MB
        dangerouslyAllowLocalIP: false,
        dangerouslyAllowSVG: false,
        contentSecurityPolicy: `script-src 'none'; frame-src 'none'; sandbox;`,
        contentDispositionType: "attachment",
        localPatterns: undefined, // default: allow all local images
        remotePatterns: [], // default: allow no remote images
        qualities: [75],
        unoptimized: false,
        customCacheHandler: false,
      }),
      schemaIssueToError
    ),
  })),
  $I.annoteSchema("ImageConfig", {
    description: "Partial Next.js image configuration with repo-default statics.",
    documentation: "https://nextjs.org/docs/api-reference/next/image#configuration-options",
  })
);

/**
 * Partial Next.js image configuration.
 *
 * **Example** (Satisfy empty image config)
 *
 * ```ts
 * import type { ImageConfig } from "@beep/repo-configs/next/models/ImageConfig.schema"
 * const config = {} satisfies ImageConfig
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ImageConfig = typeof ImageConfig.Type;
