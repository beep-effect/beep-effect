/**
 * Schemas for Next.js Turbopack configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/Turbopack.schema");

/**
 * **Example** (Make JSON value object)
 *
 * ```ts
 * import { JSONValue } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const value = JSONValue.make({ enabled: true })
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type JSONValue = string | number | boolean | Array<JSONValue> | { [key: string]: JSONValue };
/**
 * **Example** (Make JSON value schema)
 *
 * ```ts
 * import { JSONValue } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const value = JSONValue.make({ enabled: true })
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSONValue: S.Codec<JSONValue, JSONValue> = S.suspend(() =>
  S.Union([S.String, S.Finite, S.Boolean, JSONValue.pipe(S.Array, S.mutable), S.Record(S.String, JSONValue)])
).pipe(
  $I.annoteSchema("JSONValue", {
    description: "JSON-compatible value accepted by Turbopack loader options.",
  })
);

/**
 * **Example** (Make loader options flag)
 *
 * ```ts
 * import { TurbopackLoaderOptions } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const options = TurbopackLoaderOptions.make({ flag: true })
 * console.log(options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackLoaderOptions = S.Record(S.String, JSONValue).pipe(
  $I.annoteSchema("TurbopackLoaderOptions", {
    description: "Record of Turbopack loader options.",
  })
);

/**
 * **Example** (Annotate loader options type)
 *
 * ```ts
 * import type { TurbopackLoaderOptions } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const options: TurbopackLoaderOptions = { flag: true }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurbopackLoaderOptions = typeof TurbopackLoaderOptions.Type;

/**
 * **Example** (Load SVGs as React components)
 *
 * ```ts
 * import { TurbopackLoaderItemConfig } from "@beep/repo-configs/next"
 *
 * const svgr = TurbopackLoaderItemConfig.make({ loader: "@svgr/webpack", options: { icon: true } })
 *
 * console.log(svgr.loader) // => "@svgr/webpack"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurbopackLoaderItemConfig extends S.Opaque<TurbopackLoaderItemConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    loader: S.String,
    options: S.optionalKey(TurbopackLoaderOptions),
  }).pipe(
    $I.annoteSchema("TurbopackLoaderItemConfig", {
      description: "Object-form loader entry accepted by a Turbopack rule.",
    })
  )
) {}

/**
 * **Example** (Make sass-loader item)
 *
 * ```ts
 * import { TurbopackLoaderItem } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const loader = TurbopackLoaderItem.make({ loader: "sass-loader" })
 * console.log(loader)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackLoaderItem = S.Union([S.String, TurbopackLoaderItemConfig]).pipe(
  $I.annoteSchema("TurbopackLoaderItem", {
    description: "Loader entry accepted by a Turbopack rule.",
  })
);

/**
 * **Example** (Assign string loader item)
 *
 * ```ts
 * import type { TurbopackLoaderItem } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const loader: TurbopackLoaderItem = "sass-loader"
 * console.log(loader)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurbopackLoaderItem = typeof TurbopackLoaderItem.Type;

/**
 * **Example** (Access browser enum condition)
 *
 * ```ts
 * import { TurbopackLoaderBuiltinCondition } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const condition = TurbopackLoaderBuiltinCondition.Enum.browser
 * console.log(condition)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackLoaderBuiltinCondition = LiteralKit([
  "browser",
  "foreign",
  "development",
  "production",
  "node",
  "edge-light",
]).pipe(
  $I.annoteSchema("TurbopackLoaderBuiltinCondition", {
    description: "Built-in Turbopack rule condition.",
  })
);

/**
 * **Example** (Satisfy browser condition string)
 *
 * ```ts
 * import type { TurbopackLoaderBuiltinCondition } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const condition = "browser" satisfies TurbopackLoaderBuiltinCondition
 * console.log(condition)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurbopackLoaderBuiltinCondition = typeof TurbopackLoaderBuiltinCondition.Type;

/**
 * **Example** (Make all browser condition)
 *
 * ```ts
 * import { TurbopackRuleCondition } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const condition = TurbopackRuleCondition.make({ all: ["browser"] })
 * console.log(condition)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type TurbopackRuleCondition =
  | { readonly all: Array<TurbopackRuleCondition> }
  | { readonly any: Array<TurbopackRuleCondition> }
  | { readonly not: TurbopackRuleCondition }
  | TurbopackLoaderBuiltinCondition
  | {
      readonly path?: string | RegExp;
      readonly content?: RegExp;
      readonly query?: string | RegExp;
      readonly contentType?: string | RegExp;
    };

/**
 * Turbopack rule condition requiring all nested conditions to match.
 *
 * @category models
 * @since 0.0.0
 */
class TurbopackRuleAllCondition extends S.Opaque<TurbopackRuleAllCondition, { readonly brand: unique symbol }>()(
  S.Struct({
    all: S.suspend(() => TurbopackRuleCondition).pipe(S.Array, S.mutable),
  }).pipe(
    $I.annoteSchema("TurbopackRuleAllCondition", {
      description: "Turbopack rule condition requiring all nested conditions to match.",
    })
  )
) {}

/**
 * Turbopack rule condition requiring any nested condition to match.
 *
 * @category models
 * @since 0.0.0
 */
class TurbopackRuleAnyCondition extends S.Opaque<TurbopackRuleAnyCondition, { readonly brand: unique symbol }>()(
  S.Struct({
    any: S.suspend(() => TurbopackRuleCondition).pipe(S.Array, S.mutable),
  }).pipe(
    $I.annoteSchema("TurbopackRuleAnyCondition", {
      description: "Turbopack rule condition requiring any nested condition to match.",
    })
  )
) {}

/**
 * Turbopack rule condition negating a nested condition.
 *
 * @category models
 * @since 0.0.0
 */
class TurbopackRuleNotCondition extends S.Opaque<TurbopackRuleNotCondition, { readonly brand: unique symbol }>()(
  S.Struct({
    not: S.suspend(() => TurbopackRuleCondition),
  }).pipe(
    $I.annoteSchema("TurbopackRuleNotCondition", {
      description: "Turbopack rule condition negating a nested condition.",
    })
  )
) {}

/**
 * Turbopack rule condition matching file path, content, query, or content type.
 *
 * @category models
 * @since 0.0.0
 */
class TurbopackRuleMatcherCondition extends S.Opaque<
  TurbopackRuleMatcherCondition,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: S.optionalKey(S.Union([S.String, S.RegExp])),
    content: S.optionalKey(S.RegExp),
    query: S.optionalKey(S.Union([S.String, S.RegExp])),
    contentType: S.optionalKey(S.Union([S.String, S.RegExp])),
  }).pipe(
    $I.annoteSchema("TurbopackRuleMatcherCondition", {
      description: "Turbopack rule condition matching file path, content, query, or content type.",
    })
  )
) {}

/**
 * **Example** (Make recursive rule condition)
 *
 * ```ts
 * import { TurbopackRuleCondition } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const condition = TurbopackRuleCondition.make({ all: ["browser"] })
 * console.log(condition)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackRuleCondition: S.Codec<TurbopackRuleCondition, TurbopackRuleCondition> = S.suspend(() =>
  S.Union([
    TurbopackRuleAllCondition,
    TurbopackRuleAnyCondition,
    TurbopackRuleNotCondition,
    TurbopackLoaderBuiltinCondition,
    TurbopackRuleMatcherCondition,
  ])
).pipe(
  $I.annoteSchema("TurbopackRuleCondition", {
    description: "Recursive condition object used by Turbopack rules.",
  })
);

/**
 * **Example** (Access ecmascript module enum)
 *
 * ```ts
 * import { TurbopackModuleType } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const type = TurbopackModuleType.Enum.ecmascript
 * console.log(type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackModuleType = LiteralKit([
  "asset",
  "ecmascript",
  "typescript",
  "css",
  "css-module",
  "wasm",
  "raw",
  "node",
  "bytes",
  "text",
]).pipe(
  $I.annoteSchema("TurbopackModuleType", {
    description: "Module type used by Turbopack for matched files.",
    documentation: "https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#module-types",
  })
);

/**
 * **Example** (Satisfy text module type)
 *
 * ```ts
 * import type { TurbopackModuleType } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const type = "text" satisfies TurbopackModuleType
 * console.log(type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurbopackModuleType = typeof TurbopackModuleType.Type;

/**
 * **Example** (Make text type rule)
 *
 * ```ts
 * import { TurbopackRuleConfigItem } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const rule = TurbopackRuleConfigItem.make({ type: "text" })
 * console.log(rule)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TurbopackRuleConfigItem extends S.Opaque<TurbopackRuleConfigItem, { readonly brand: unique symbol }>()(
  S.Struct({
    loaders: S.optionalKey(
      TurbopackLoaderItem.pipe(S.Array, S.mutable, S.annotateKey({ description: "Loaders to apply." }))
    ),
    as: S.optionalKey(S.String.annotateKey({ description: "Rename the file extension for loader output." })),
    condition: S.optionalKey(
      TurbopackRuleCondition.annotateKey({ description: "Condition for when this rule applies." })
    ),
    type: S.optionalKey(
      TurbopackModuleType.annotateKey({ description: "Module type to use for matched files without a custom loader." })
    ),
  }).pipe(
    $I.annoteSchema("TurbopackRuleConfigItem", {
      description: "Object-form Turbopack rule configuration.",
    })
  )
) {}

/**
 * **Example** (Make sass-loader collection)
 *
 * ```ts
 * import { TurbopackRuleConfigCollection } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const collection = TurbopackRuleConfigCollection.make([{ loader: "sass-loader" }])
 * console.log(collection)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TurbopackRuleConfigCollection = S.Union([
  TurbopackRuleConfigItem,
  S.Union([TurbopackLoaderItem, TurbopackRuleConfigItem]).pipe(S.Array, S.mutable),
]).pipe(
  $I.annoteSchema("TurbopackRuleConfigCollection", {
    description: "Turbopack rule configuration collection.",
  })
);

/**
 * **Example** (Annotate string loader collection)
 *
 * ```ts
 * import type { TurbopackRuleConfigCollection } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const collection: TurbopackRuleConfigCollection = ["sass-loader"]
 * console.log(collection)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurbopackRuleConfigCollection = typeof TurbopackRuleConfigCollection.Type;

/**
 * **Example** (Silence a known warning from a vendored package)
 *
 * ```ts
 * import { TurbopackIgnoredIssue } from "@beep/repo-configs/next"
 *
 * const ignored = TurbopackIgnoredIssue.make({ path: /node_modules\/pdfjs-dist/, title: "Module not found" })
 *
 * console.log(ignored.path instanceof RegExp) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurbopackIgnoredIssue extends S.Opaque<TurbopackIgnoredIssue, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.Union([S.String, S.RegExp]),
    title: S.optionalKey(S.Union([S.String, S.RegExp])),
    description: S.optionalKey(S.Union([S.String, S.RegExp])),
  }).pipe(
    $I.annoteSchema("TurbopackIgnoredIssue", {
      description: "Issue filter rule ignored by Turbopack.",
    })
  )
) {}

/**
 * **Example** (Make options with root)
 *
 * ```ts
 * import { TurbopackOptions } from "@beep/repo-configs/next/models/Turbopack.schema"
 * const options = TurbopackOptions.make({ root: process.cwd() })
 * console.log(options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TurbopackOptions extends S.Opaque<TurbopackOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    resolveAlias: S.optionalKey(
      S.Record(
        S.String,
        S.Union([
          S.String,
          S.String.pipe(S.Array, S.mutable),
          S.Record(S.String, S.Union([S.String, S.String.pipe(S.Array, S.mutable)])),
        ])
      ).annotateKey({
        description: "Mapping of aliased imports to modules loaded in their place.",
        documentation: "https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#resolving-aliases",
      })
    ),
    resolveExtensions: S.optionalKey(
      S.String.pipe(
        S.Array,
        S.mutable,
        S.annotateKey({
          description: "Extensions to resolve when importing files.",
          documentation:
            "https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#resolving-custom-extensions",
        })
      )
    ),
    rules: S.optionalKey(
      S.Record(S.String, TurbopackRuleConfigCollection).annotateKey({
        description: "Webpack loaders to apply when running with Turbopack.",
        documentation:
          "https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#configuring-webpack-loaders",
      })
    ),
    root: S.optionalKey(S.String.annotateKey({ description: "Repo root available for Turbopack resolution." })),
    debugIds: S.optionalKey(
      S.Boolean.annotateKey({ description: "Enables generation of debug IDs in JavaScript bundles and source maps." })
    ),
    ignoreIssue: S.optionalKey(
      TurbopackIgnoredIssue.pipe(
        S.Array,
        S.mutable,
        S.annotateKey({ description: "Issue filter rules ignored by Turbopack." })
      )
    ),
  }).pipe(
    $I.annoteSchema("TurbopackOptions", {
      description: "Options for Turbopack in next.config.js.",
    })
  )
) {}
