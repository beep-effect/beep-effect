/**
 * Public entry point for shared schema helpers, codecs, and value objects.
 *
 * @packageDocumentation
 * @category schemas
 * @since 0.0.0
 */

/**
 * @since 0.0.0
 * @category validation
 */
export * from "./AbortSignal.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./ArrayBuffer.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./ArrayOf.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./AtURI.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./BigDecimal.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./BufferEncoding.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Bytes.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Color/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./CommonTextSchemas.ts";
/**
 * Specification-grounded conformance models and annotation helpers.
 *
 * @category specifications
 * @since 0.0.0
 */
export * as Conformance from "./Conformance/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./ContinentCode.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./CountryCode.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./CountryName.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export { CSV, Csv, type CsvDocument, type CsvText, type RowSchemaWithFields } from "./Csv/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./CurrencyCode.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./DateTimeUtcFromValid/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Did.ts";
/**
 * @since 0.0.0
 * @category validation
 */
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Double.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export {
  Duration,
  type Duration as DurationValue,
  DurationFromInput,
  type DurationFromInput as DurationFromInputValue,
  DurationInput,
  type DurationInput as DurationInputValue,
  DurationObject,
  DurationUnit,
  type DurationUnit as DurationUnitValue,
  FromInput,
  type Unit as DurationUnitAlias,
} from "./Duration/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./EffectSchema.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Email.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * as FileDiff from "./FileDiff.schema.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./FileExtension.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./FileInfo.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./FileName.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./FilePath/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * as FileTypeChecker from "./FileTypeChecker/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Fixed32.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Fixed64.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Float.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Float16Array.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Float32Array.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Float64Array.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Fn/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Glob/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Graph/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Html.ts";
/**
 * HTTP method schemas and literal-kit helpers.
 *
 * **Example** (Check HTTP method literal)
 *
 * ```ts
 * import { HttpMethod } from "@beep/schema"
 *
 * console.log(HttpMethod.Schema.is.OPTIONS("OPTIONS"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as HttpMethod from "./HttpMethod/index.ts";
/**
 * Canonical schema for any three-digit HTTP response status.
 *
 * @category validation
 * @since 0.0.0
 */
export { HttpStatusCode } from "./HttpStatus/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Int.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Int64.ts";
/**
 * Structured model of JSON Schema draft-2020-12 documents: recursive `Node`
 * class, lossless wire codec, `boolean | Node` subschema union, document
 * envelope, and local `$ref` resolvers.
 *
 * **Example** (Decode JSON Schema node)
 *
 * ```ts
 * import { JSONSchema } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownResult(JSONSchema.NodeCodec)({ type: "object" })
 * console.log(node._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as JSONSchema from "./JSONSchema/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Json.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Jsonc.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Jsonl.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./KebabStr.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./LiteralKit/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./LocalDate/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Logs.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./MappedLiteralKit/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Markdown.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./MimeType.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./MutableHashMap.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./MutableHashSet.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Number.ts";
/**
 * Opaque payload schemas (`Defect`, `OpaqueUnknown`) whose equivalence is declared always-true.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Opaque.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Options.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./PascalStr.ts";
/**
 * Transport-layer port number schemas and codecs.
 *
 * **Example** (Decode port from string)
 *
 * ```ts import.meta.vitest name="Decode port from string"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { PortFromString } from "@beep/schema"
 *
 * const port = await Effect.runPromise(S.decodeUnknownEffect(PortFromString)("443"))
 * port // => 443
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Port.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./PosixPath.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Primitive.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./PromiseSchema.ts";
/**
 * @since 0.0.0
 * @category schemas
 */
export * from "./Record/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./RegExp.ts";
/**
 * Nominal safe-object schema and object-keyword normalization codec.
 *
 * **Example** (Decode safe object value)
 *
 * ```ts import.meta.vitest name="Decode safe object value"
 * import { SafeObject } from "@beep/schema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const value = await Effect.runPromise(
 *   S.decodeUnknownEffect(SafeObject)({ enabled: true })
 * )
 * value.enabled // => true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export { SafeObject, SafeObjectFromObjectKeyword } from "./SafeObject/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./SafeRemoteHost.ts";
/**
 * @since 0.0.0
 * @category utilities
 */
export * as SchemaUtils from "./SchemaUtils/index.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./SemanticVersion.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Semver.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./SeverityLevel.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Sfixed32.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Sfixed64.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Sha256.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Sint32.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Sint64.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Slug.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./SnakeStr.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./StatusCauseError.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./String.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./TerritoryCode.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Timezone.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Toml.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Transformations.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Uint32.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Uint64.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Unknown.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./URL.ts";
/**
 * Current `@beep/schema` package version.
 *
 * @category configuration
 * @since 0.0.0
 */
export { VERSION } from "./Version.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Xml.ts";
/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Yaml.ts";
