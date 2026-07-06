/**
 * Strategy schemas for file-processing engine selection and V1 support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Match } from "effect";
import * as S from "effect/Schema";

const $I = $FileProcessingId.create("Strategy");

/**
 * Operation kinds supported by the capability contract.
 *
 * @example
 * ```ts
 * import { FileProcessingOperationKind } from "@beep/file-processing/Strategy"
 *
 * console.log(FileProcessingOperationKind.Options.includes("process")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingOperationKind = LiteralKit(["detect", "extract", "export-archive", "process"]).pipe(
  $I.annoteSchema("FileProcessingOperationKind", {
    description: "Operation kinds modeled by the file-processing capability.",
  })
);

/**
 * Type for {@link FileProcessingOperationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingOperationKind = typeof FileProcessingOperationKind.Type;

/**
 * Concrete engine families known to P1.
 *
 * @example
 * ```ts
 * import { FileProcessingEngineFamily } from "@beep/file-processing/Strategy"
 *
 * console.log(FileProcessingEngineFamily.Options.includes("tika")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingEngineFamily = LiteralKit(["auto", "tika", "libpff", "test"]).pipe(
  $I.annoteSchema("FileProcessingEngineFamily", {
    description: "Engine families selectable by file-processing strategies.",
  })
);

/**
 * Type for {@link FileProcessingEngineFamily}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingEngineFamily = typeof FileProcessingEngineFamily.Type;

/**
 * V1 file format families recognized by the capability.
 *
 * @example
 * ```ts
 * import { FileFormatFamily } from "@beep/file-processing/Strategy"
 *
 * console.log(FileFormatFamily.Options.includes("pdf-text-layer")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileFormatFamily = LiteralKit([
  "doc",
  "docx",
  "docm",
  "rtf",
  "html",
  "xhtml",
  "pdf-text-layer",
  "pst",
  "plain-text",
  "markdown",
  "image-metadata",
  "xls",
  "xlsx",
  "unknown",
]).pipe(
  $I.annoteSchema("FileFormatFamily", {
    description: "Deterministic file format families recognized by V1 file processing.",
  }),
  SchemaUtils.withStatics(() => ({
    fromExtension: Match.type<string | undefined>().pipe(
      Match.when("doc", () => "doc" as const),
      Match.when("docx", () => "docx" as const),
      Match.when("docm", () => "docm" as const),
      Match.when("rtf", () => "rtf" as const),
      Match.whenOr("htm", "html", () => "html" as const),
      Match.when("xhtml", () => "xhtml" as const),
      Match.when("pdf", () => "pdf-text-layer" as const),
      Match.when("pst", () => "pst" as const),
      Match.whenOr("txt", "text", () => "plain-text" as const),
      Match.whenOr("md", "markdown", () => "markdown" as const),
      Match.whenOr("bmp", "gif", "jpeg", "jpg", "png", "tif", "tiff", "webp", () => "image-metadata" as const),
      Match.when("xls", () => "xls" as const),
      Match.when("xlsx", () => "xlsx" as const),
      Match.orElse(() => "unknown" as const)
    ),
    processCapability: (format: FileFormatFamily): FileProcessingCapability =>
      format === "image-metadata" ? "extract-metadata" : "extract-text",
  }))
);

/**
 * Type for {@link FileFormatFamily}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileFormatFamily = typeof FileFormatFamily.Type;

/**
 * Processing capability advertised by an engine.
 *
 * @example
 * ```ts
 * import { FileProcessingCapability } from "@beep/file-processing/Strategy"
 *
 * console.log(FileProcessingCapability.Options.includes("export-children")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingCapability = LiteralKit([
  "detect",
  "extract-text",
  "extract-metadata",
  "export-children",
]).pipe(
  $I.annoteSchema("FileProcessingCapability", {
    description: "Capability advertised by a file-processing engine.",
  })
);

/**
 * Type for {@link FileProcessingCapability}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingCapability = typeof FileProcessingCapability.Type;

/**
 * Support disposition selected for a source artifact.
 *
 * @example
 * ```ts
 * import { FileProcessingSupportDisposition } from "@beep/file-processing/Strategy"
 *
 * console.log(FileProcessingSupportDisposition.Options.includes("deferred")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingSupportDisposition = LiteralKit(["supported", "deferred", "unsupported"]).pipe(
  $I.annoteSchema("FileProcessingSupportDisposition", {
    description: "Whether an engine can process the source format in the current run.",
  })
);

/**
 * Type for {@link FileProcessingSupportDisposition}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingSupportDisposition = typeof FileProcessingSupportDisposition.Type;

/**
 * Reason a source was skipped or deferred.
 *
 * @example
 * ```ts
 * import { FileProcessingSkipReason } from "@beep/file-processing/Strategy"
 *
 * console.log(FileProcessingSkipReason.Options.includes("operation-not-required")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileProcessingSkipReason = LiteralKit([
  "engine-unavailable",
  "encrypted-source",
  "fixture-unavailable",
  "format-out-of-scope",
  "ocr-disabled",
  "output-budget-exceeded",
  "unsupported-format",
  "operation-not-required",
]).pipe(
  $I.annoteSchema("FileProcessingSkipReason", {
    description: "Machine-readable reason for a deterministic skipped source.",
  })
);

/**
 * Type for {@link FileProcessingSkipReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingSkipReason = typeof FileProcessingSkipReason.Type;

/**
 * Preferred engine selection for an operation.
 *
 * @example
 * ```ts
 * import { StrategyPreference } from "@beep/file-processing/Strategy"
 *
 * const preference = StrategyPreference.make({ engine: "auto" })
 * console.log(preference.engine)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrategyPreference extends S.Class<StrategyPreference>($I`StrategyPreference`)(
  {
    engine: FileProcessingEngineFamily,
  },
  $I.annote("StrategyPreference", {
    description: "Engine preference requested for a file-processing operation.",
  })
) {}

/**
 * Strategy selected when an operation is supported.
 *
 * @example
 * ```ts
 * import { SupportedSelectedStrategy } from "@beep/file-processing/Strategy"
 *
 * const strategy = SupportedSelectedStrategy.make({
 *   disposition: "supported",
 *   engine: "tika",
 *   format: "docx",
 *   operationKind: "extract"
 * })
 *
 * console.log(strategy.disposition) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SupportedSelectedStrategy extends S.Class<SupportedSelectedStrategy>($I`SupportedSelectedStrategy`)(
  {
    disposition: S.Literal("supported"),
    engine: FileProcessingEngineFamily,
    format: FileFormatFamily,
    operationKind: FileProcessingOperationKind,
  },
  $I.annote("SupportedSelectedStrategy", {
    description: "Resolved strategy for a supported source artifact operation.",
  })
) {}

/**
 * Strategy selected when an operation is intentionally deferred.
 *
 * @example
 * ```ts
 * import { DeferredSelectedStrategy } from "@beep/file-processing/Strategy"
 *
 * const strategy = DeferredSelectedStrategy.make({
 *   disposition: "deferred",
 *   engine: "libpff",
 *   format: "pst",
 *   operationKind: "export-archive",
 *   skipReason: "engine-unavailable"
 * })
 *
 * console.log(strategy.skipReason) // "engine-unavailable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeferredSelectedStrategy extends S.Class<DeferredSelectedStrategy>($I`DeferredSelectedStrategy`)(
  {
    disposition: S.Literal("deferred"),
    engine: FileProcessingEngineFamily,
    format: FileFormatFamily,
    operationKind: FileProcessingOperationKind,
    skipReason: FileProcessingSkipReason,
  },
  $I.annote("DeferredSelectedStrategy", {
    description: "Resolved strategy for an intentionally deferred source artifact operation.",
  })
) {}

/**
 * Strategy selected when an operation is unsupported.
 *
 * @example
 * ```ts
 * import { UnsupportedSelectedStrategy } from "@beep/file-processing/Strategy"
 *
 * const strategy = UnsupportedSelectedStrategy.make({
 *   disposition: "unsupported",
 *   engine: "tika",
 *   format: "xls",
 *   operationKind: "extract",
 *   skipReason: "format-out-of-scope"
 * })
 *
 * console.log(strategy.format) // "xls"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnsupportedSelectedStrategy extends S.Class<UnsupportedSelectedStrategy>($I`UnsupportedSelectedStrategy`)(
  {
    disposition: S.Literal("unsupported"),
    engine: FileProcessingEngineFamily,
    format: FileFormatFamily,
    operationKind: FileProcessingOperationKind,
    skipReason: FileProcessingSkipReason,
  },
  $I.annote("UnsupportedSelectedStrategy", {
    description: "Resolved strategy for an unsupported source artifact operation.",
  })
) {}

/**
 * Strategy selected for a concrete operation.
 *
 * @example
 * ```ts
 * import { SelectedStrategy } from "@beep/file-processing/Strategy"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(SelectedStrategy)({
 *   disposition: "deferred",
 *   engine: "libpff",
 *   format: "pst",
 *   operationKind: "export-archive",
 *   skipReason: "engine-unavailable"
 * })
 *
 * Effect.runPromise(program).then((strategy) => console.log(strategy.disposition)) // "deferred"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SelectedStrategy = S.Union([
  SupportedSelectedStrategy,
  DeferredSelectedStrategy,
  UnsupportedSelectedStrategy,
]).pipe(
  S.toTaggedUnion("disposition"),
  $I.annoteSchema("SelectedStrategy", {
    description: "Resolved engine and support strategy for a source artifact operation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link SelectedStrategy}.
 *
 * @category models
 * @since 0.0.0
 */
export type SelectedStrategy = typeof SelectedStrategy.Type;

/**
 * Runtime-neutral engine descriptor.
 *
 * @example
 * ```ts
 * import { FileProcessingEngineDescriptor } from "@beep/file-processing/Strategy"
 *
 * const descriptor = FileProcessingEngineDescriptor.make({
 *   capabilities: ["detect", "extract-text"],
 *   engine: "tika",
 *   name: "apache-tika",
 *   supportedFormats: ["docx", "pdf-text-layer"],
 *   version: "2.9.0"
 * })
 *
 * console.log(descriptor.supportedFormats.includes("docx")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FileProcessingEngineDescriptor extends S.Class<FileProcessingEngineDescriptor>(
  $I`FileProcessingEngineDescriptor`
)(
  {
    capabilities: S.Array(FileProcessingCapability),
    engine: FileProcessingEngineFamily,
    name: S.String,
    supportedFormats: S.Array(FileFormatFamily),
    version: S.optionalKey(S.String),
  },
  $I.annote("FileProcessingEngineDescriptor", {
    description: "Runtime-neutral descriptor for a file-processing engine implementation.",
  })
) {
  matchesPreference(preferredEngine: FileProcessingEngineDescriptor["engine"]): boolean {
    return preferredEngine === "auto" || this.engine === preferredEngine;
  }

  supportsCapability(capability: FileProcessingCapability): boolean {
    return A.contains(this.capabilities, capability);
  }

  supportsFormat(format: FileFormatFamily): boolean {
    return A.contains(this.supportedFormats, format);
  }
}

/**
 * Classify a bare file extension into its deterministic format family.
 *
 * This is the canonical extension-to-format mapping shared by detection
 * engines and processing pipelines; unknown extensions classify as
 * `"unknown"`.
 *
 * @example
 * ```ts
 * import { classifyFormatFromExtension } from "@beep/file-processing/Strategy"
 *
 * console.log(classifyFormatFromExtension("docx")) // "docx"
 * console.log(classifyFormatFromExtension("zip")) // "unknown"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const classifyFormatFromExtension: (extension: string | undefined) => FileFormatFamily =
  FileFormatFamily.fromExtension;
