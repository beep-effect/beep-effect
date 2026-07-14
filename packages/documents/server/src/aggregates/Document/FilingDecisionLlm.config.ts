/**
 * Runtime configuration for LLM-backed document filing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FILING_TEXT_EXCERPT_MAX_LENGTH } from "@beep/documents-use-cases/aggregates/Document/server";
import { $DocumentsServerId } from "@beep/identity/packages";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Config, Context, Duration, Effect, Layer } from "effect";
import * as S from "effect/Schema";

const $I = $DocumentsServerId.create("aggregates/Document/FilingDecisionLlm.config");

/**
 * Environment variable selecting the Anthropic model used for filing decisions.
 *
 * @example
 * ```ts
 * import { FILING_DECISION_MODEL_ENV } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_DECISION_MODEL_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_DECISION_MODEL_ENV = "DOCUMENTS_FILING_MODEL";

/**
 * Environment variable controlling the minimum confidence required to auto-file.
 *
 * @example
 * ```ts
 * import { FILING_DECISION_CONFIDENCE_THRESHOLD_ENV } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_DECISION_CONFIDENCE_THRESHOLD_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_DECISION_CONFIDENCE_THRESHOLD_ENV = "DOCUMENTS_FILING_CONFIDENCE_THRESHOLD";

/**
 * Environment variable controlling the maximum extracted-text excerpt length.
 *
 * @example
 * ```ts
 * import { FILING_DECISION_MAX_EXCERPT_CHARS_ENV } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_DECISION_MAX_EXCERPT_CHARS_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_DECISION_MAX_EXCERPT_CHARS_ENV = "DOCUMENTS_FILING_MAX_EXCERPT_CHARS";

/**
 * Environment variable controlling the maximum source bytes accepted by filing
 * text extraction before parsing.
 *
 * @example
 * ```ts
 * import { FILING_TEXT_EXTRACTION_MAX_BYTES_ENV } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_TEXT_EXTRACTION_MAX_BYTES_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_TEXT_EXTRACTION_MAX_BYTES_ENV = "DOCUMENTS_FILING_TEXT_EXTRACTION_MAX_BYTES";

/**
 * Environment variable controlling the filing text-extraction timeout, accepted
 * in Effect `Config` duration syntax.
 *
 * @example
 * ```ts
 * import { FILING_TEXT_EXTRACTION_TIMEOUT_ENV } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_TEXT_EXTRACTION_TIMEOUT_ENV)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_TEXT_EXTRACTION_TIMEOUT_ENV = "DOCUMENTS_FILING_TEXT_EXTRACTION_TIMEOUT";

/**
 * Default fast Anthropic model used for filing classification.
 *
 * @example
 * ```ts
 * import { FILING_DECISION_DEFAULT_MODEL } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_DECISION_DEFAULT_MODEL)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_DECISION_DEFAULT_MODEL = "claude-haiku-4-5";

/**
 * Default confidence threshold for automatic filing.
 *
 * @example
 * ```ts
 * import { FILING_DECISION_DEFAULT_CONFIDENCE_THRESHOLD } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_DECISION_DEFAULT_CONFIDENCE_THRESHOLD)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_DECISION_DEFAULT_CONFIDENCE_THRESHOLD = UnitInterval.make(0.6);

/**
 * Default source-byte cap for PDF and DOCX filing extraction (32 MiB).
 *
 * @example
 * ```ts
 * import { FILING_TEXT_EXTRACTION_DEFAULT_MAX_BYTES } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_TEXT_EXTRACTION_DEFAULT_MAX_BYTES)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_TEXT_EXTRACTION_DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/**
 * Default wall-clock budget for PDF and DOCX filing extraction.
 *
 * @example
 * ```ts
 * import { FILING_TEXT_EXTRACTION_DEFAULT_TIMEOUT } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FILING_TEXT_EXTRACTION_DEFAULT_TIMEOUT)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FILING_TEXT_EXTRACTION_DEFAULT_TIMEOUT = Duration.seconds(15);

const ConfiguredExcerptLength = S.Int.check(
  S.makeFilterGroup([S.isGreaterThan(0), S.isLessThanOrEqualTo(FILING_TEXT_EXCERPT_MAX_LENGTH)])
).pipe(
  $I.annoteSchema("ConfiguredExcerptLength", {
    description: "Configured positive excerpt length bounded by the FilingDecision port maximum.",
  })
);

const ConfiguredMaxMaterializedBytes = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("ConfiguredMaxMaterializedBytes", {
    description: "Configured positive source-byte cap for filing text extraction.",
  })
);

/**
 * Resolved configuration value for LLM-backed filing.
 *
 * @example
 * ```ts
 * import { FilingDecisionLlmConfigValue } from "@beep/documents-server/aggregates/Document"
 * import { Duration } from "effect"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(FilingDecisionLlmConfigValue)({
 *   confidenceThreshold: 0.6,
 *   extractionTimeout: Duration.seconds(15),
 *   maxExcerptChars: 8000,
 *   maxMaterializedBytes: 33554432,
 *   model: "claude-haiku-4-5"
 * })
 * console.log(config.model)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class FilingDecisionLlmConfigValue extends S.Class<FilingDecisionLlmConfigValue>(
  $I`FilingDecisionLlmConfigValue`
)(
  {
    confidenceThreshold: UnitInterval,
    extractionTimeout: S.Duration,
    maxExcerptChars: ConfiguredExcerptLength,
    maxMaterializedBytes: ConfiguredMaxMaterializedBytes,
    model: S.NonEmptyString,
  },
  $I.annote("FilingDecisionLlmConfigValue", {
    description: "Resolved configuration value for LLM-backed document filing.",
  })
) {}

/**
 * Typed runtime configuration service for LLM-backed filing.
 *
 * @example
 * ```ts
 * import { FilingDecisionLlmConfig } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingDecisionLlmConfig.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FilingDecisionLlmConfig extends Context.Service<FilingDecisionLlmConfig, FilingDecisionLlmConfigValue>()(
  $I`FilingDecisionLlmConfig`
) {}

const readFilingDecisionLlmConfig = Effect.fn($I`readFilingDecisionLlmConfig`)(function* () {
  const confidenceThreshold = yield* Config.schema(UnitInterval, FILING_DECISION_CONFIDENCE_THRESHOLD_ENV).pipe(
    Config.withDefault(FILING_DECISION_DEFAULT_CONFIDENCE_THRESHOLD)
  );
  const extractionTimeout = yield* Config.duration(FILING_TEXT_EXTRACTION_TIMEOUT_ENV).pipe(
    Config.withDefault(FILING_TEXT_EXTRACTION_DEFAULT_TIMEOUT)
  );
  const maxExcerptChars = yield* Config.schema(ConfiguredExcerptLength, FILING_DECISION_MAX_EXCERPT_CHARS_ENV).pipe(
    Config.withDefault(FILING_TEXT_EXCERPT_MAX_LENGTH)
  );
  const maxMaterializedBytes = yield* Config.schema(
    ConfiguredMaxMaterializedBytes,
    FILING_TEXT_EXTRACTION_MAX_BYTES_ENV
  ).pipe(Config.withDefault(FILING_TEXT_EXTRACTION_DEFAULT_MAX_BYTES));
  const model = yield* Config.nonEmptyString(FILING_DECISION_MODEL_ENV).pipe(
    Config.withDefault(FILING_DECISION_DEFAULT_MODEL)
  );

  return FilingDecisionLlmConfigValue.make({
    confidenceThreshold,
    extractionTimeout,
    maxExcerptChars,
    maxMaterializedBytes,
    model,
  });
});

/**
 * Live configuration layer backed by the ambient Effect ConfigProvider.
 *
 * @example
 * ```ts
 * import { FilingDecisionLlmConfigLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingDecisionLlmConfigLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingDecisionLlmConfigLayer = Layer.effect(FilingDecisionLlmConfig, readFilingDecisionLlmConfig());
