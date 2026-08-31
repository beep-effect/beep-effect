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
 * **Example** (Check process option included)
 *
 * ```ts import.meta.vitest name="Check process option included"
 * import { FileProcessingOperationKind } from "@beep/file-processing/Strategy"
 *
 * FileProcessingOperationKind.Options.includes("process") // => true
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
 * **Example** (Type process kind guard)
 *
 * ```ts import.meta.vitest name="Type process kind guard"
 * import { FileProcessingOperationKind } from "@beep/file-processing/Strategy"
 *
 * const kind: FileProcessingOperationKind = "process"
 * FileProcessingOperationKind.is.process(kind) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingOperationKind = typeof FileProcessingOperationKind.Type;

/**
 * Concrete engine families known to P1.
 *
 * **Example** (Check tika option included)
 *
 * ```ts import.meta.vitest name="Check tika option included"
 * import { FileProcessingEngineFamily } from "@beep/file-processing/Strategy"
 *
 * FileProcessingEngineFamily.Options.includes("tika") // => true
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
 * **Example** (Type tika engine guard)
 *
 * ```ts import.meta.vitest name="Type tika engine guard"
 * import { FileProcessingEngineFamily } from "@beep/file-processing/Strategy"
 *
 * const engine: FileProcessingEngineFamily = "tika"
 * FileProcessingEngineFamily.is.tika(engine) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingEngineFamily = typeof FileProcessingEngineFamily.Type;

/**
 * V1 file format families recognized by the capability.
 *
 * **Example** (Check pdf-text-layer option)
 *
 * ```ts import.meta.vitest name="Check pdf-text-layer option"
 * import { FileFormatFamily } from "@beep/file-processing/Strategy"
 *
 * FileFormatFamily.Options.includes("pdf-text-layer") // => true
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
 * **Example** (Type format family guard)
 *
 * ```ts import.meta.vitest name="Type format family guard"
 * import { FileFormatFamily } from "@beep/file-processing/Strategy"
 *
 * const format: FileFormatFamily = "pdf-text-layer"
 * FileFormatFamily.is["pdf-text-layer"](format) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileFormatFamily = typeof FileFormatFamily.Type;

/**
 * Processing capability advertised by an engine.
 *
 * **Example** (Check export-children option)
 *
 * ```ts import.meta.vitest name="Check export-children option"
 * import { FileProcessingCapability } from "@beep/file-processing/Strategy"
 *
 * FileProcessingCapability.Options.includes("export-children") // => true
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
 * **Example** (Type capability guard)
 *
 * ```ts import.meta.vitest name="Type capability guard"
 * import { FileProcessingCapability } from "@beep/file-processing/Strategy"
 *
 * const capability: FileProcessingCapability = "export-children"
 * FileProcessingCapability.is["export-children"](capability) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingCapability = typeof FileProcessingCapability.Type;

/**
 * Support disposition selected for a source artifact.
 *
 * **Example** (Check deferred disposition option)
 *
 * ```ts import.meta.vitest name="Check deferred disposition option"
 * import { FileProcessingSupportDisposition } from "@beep/file-processing/Strategy"
 *
 * FileProcessingSupportDisposition.Options.includes("deferred") // => true
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
 * **Example** (Type deferred disposition guard)
 *
 * ```ts import.meta.vitest name="Type deferred disposition guard"
 * import { FileProcessingSupportDisposition } from "@beep/file-processing/Strategy"
 *
 * const disposition: FileProcessingSupportDisposition = "deferred"
 * FileProcessingSupportDisposition.is.deferred(disposition) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingSupportDisposition = typeof FileProcessingSupportDisposition.Type;

/**
 * Reason a source was skipped or deferred.
 *
 * **Example** (Check skip reason option)
 *
 * ```ts import.meta.vitest name="Check skip reason option"
 * import { FileProcessingSkipReason } from "@beep/file-processing/Strategy"
 *
 * FileProcessingSkipReason.Options.includes("operation-not-required") // => true
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
 * **Example** (Type skip reason guard)
 *
 * ```ts import.meta.vitest name="Type skip reason guard"
 * import { FileProcessingSkipReason } from "@beep/file-processing/Strategy"
 *
 * const reason: FileProcessingSkipReason = "operation-not-required"
 * FileProcessingSkipReason.is["operation-not-required"](reason) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileProcessingSkipReason = typeof FileProcessingSkipReason.Type;

/**
 * Preferred engine selection for an operation.
 *
 * **Example** (Make auto engine preference)
 *
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
 * **Example** (Make supported selected strategy)
 *
 * ```ts import.meta.vitest name="Make supported selected strategy"
 * import { SupportedSelectedStrategy } from "@beep/file-processing/Strategy"
 *
 * const strategy = SupportedSelectedStrategy.make({
 *   disposition: "supported",
 *   engine: "tika",
 *   format: "docx",
 *   operationKind: "extract"
 * })
 *
 * strategy.disposition // => "supported"
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
 * **Example** (Make deferred selected strategy)
 *
 * ```ts import.meta.vitest name="Make deferred selected strategy"
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
 * strategy.skipReason // => "engine-unavailable"
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
 * **Example** (Make unsupported selected strategy)
 *
 * ```ts import.meta.vitest name="Make unsupported selected strategy"
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
 * strategy.format // => "xls"
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
 * **Example** (Decode deferred selected strategy)
 *
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
  })
);

/**
 * Type for {@link SelectedStrategy}.
 *
 * **Example** (Typed decode selected strategy)
 *
 * ```ts import.meta.vitest name="Typed decode selected strategy"
 * import { SelectedStrategy } from "@beep/file-processing/Strategy"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const strategy: SelectedStrategy = yield* S.decodeUnknownEffect(SelectedStrategy)({
 *     disposition: "deferred",
 *     engine: "libpff",
 *     format: "pst",
 *     operationKind: "export-archive",
 *     skipReason: "engine-unavailable"
 *   })
 *   return strategy.disposition
 * })
 *
 * await Effect.runPromise(program) // => "deferred"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SelectedStrategy = typeof SelectedStrategy.Type;

/**
 * Runtime-neutral engine descriptor.
 *
 * **Example** (Make engine descriptor)
 *
 * ```ts import.meta.vitest name="Make engine descriptor"
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
 * descriptor.supportedFormats.includes("docx") // => true
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
 * **Details**
 *
 * This is the canonical extension-to-format mapping shared by detection
 * engines and processing pipelines; unknown extensions classify as
 * `"unknown"`.
 *
 * **Example** (Classify known unknown extensions)
 *
 * ```ts import.meta.vitest name="Classify known unknown extensions"
 * import { classifyFormatFromExtension } from "@beep/file-processing/Strategy"
 *
 * classifyFormatFromExtension("docx") // => "docx"
 * classifyFormatFromExtension("zip") // => "unknown"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const classifyFormatFromExtension: (extension: string | undefined) => FileFormatFamily =
  FileFormatFamily.fromExtension;
