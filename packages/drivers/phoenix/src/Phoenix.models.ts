/**
 * Schema-backed request and response models for the Phoenix driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PhoenixId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $PhoenixId.create("Phoenix.models");

const PhoenixPositiveCount = S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
  $I.annoteSchema("PhoenixPositiveCount", {
    description: "Positive integer count used for Phoenix experiment repetitions.",
  })
);

const PhoenixCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("PhoenixCount", {
    description: "Non-negative integer count returned by Phoenix experiment summaries.",
  })
);

/**
 * **Example** (Access passed status enum)
 *
 * ```ts
 * import { PhoenixDoctorStatus } from "@beep/phoenix"
 *
 * console.log(PhoenixDoctorStatus.Enum.passed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixDoctorStatus = LiteralKit(["passed", "unavailable"]).pipe(
  $I.annoteSchema("PhoenixDoctorStatus", {
    description: "Phoenix driver health states returned by the doctor operation.",
  })
);

/**
 * **Example** (Type-check passed status)
 *
 * ```ts
 * import { PhoenixDoctorStatus } from "@beep/phoenix"
 *
 * const status: PhoenixDoctorStatus = "passed"
 * console.log(PhoenixDoctorStatus.is.passed(status))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixDoctorStatus = typeof PhoenixDoctorStatus.Type;

/**
 * **Example** (Access dataset-name kind enum)
 *
 * ```ts
 * import { PhoenixDatasetSelectorKind } from "@beep/phoenix"
 *
 * console.log(PhoenixDatasetSelectorKind.Enum["dataset-name"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixDatasetSelectorKind = LiteralKit(["dataset-id", "dataset-name"]).pipe(
  $I.annoteSchema("PhoenixDatasetSelectorKind", {
    description: "Selector kinds used when addressing Phoenix datasets.",
  })
);

/**
 * **Example** (Type-check dataset-name kind)
 *
 * ```ts
 * import { PhoenixDatasetSelectorKind } from "@beep/phoenix"
 *
 * const kind: PhoenixDatasetSelectorKind = "dataset-name"
 * console.log(PhoenixDatasetSelectorKind.is["dataset-name"](kind))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixDatasetSelectorKind = typeof PhoenixDatasetSelectorKind.Type;

/**
 * **Example** (Access trace target kind)
 *
 * ```ts
 * import { PhoenixAnnotationTargetKind } from "@beep/phoenix"
 *
 * console.log(PhoenixAnnotationTargetKind.Enum.trace)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixAnnotationTargetKind = LiteralKit(["span", "session", "trace"]).pipe(
  $I.annoteSchema("PhoenixAnnotationTargetKind", {
    description: "Phoenix annotation target kinds supported by the driver.",
  })
);

/**
 * **Example** (Type-check trace target kind)
 *
 * ```ts
 * import { PhoenixAnnotationTargetKind } from "@beep/phoenix"
 *
 * const kind: PhoenixAnnotationTargetKind = "trace"
 * console.log(PhoenixAnnotationTargetKind.is.trace(kind))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixAnnotationTargetKind = typeof PhoenixAnnotationTargetKind.Type;

/**
 * **Example** (Access CODE annotator kind)
 *
 * ```ts
 * import { PhoenixAnnotatorKind } from "@beep/phoenix"
 *
 * console.log(PhoenixAnnotatorKind.Enum.CODE)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixAnnotatorKind = LiteralKit(["CODE", "HUMAN", "LLM"]).pipe(
  $I.annoteSchema("PhoenixAnnotatorKind", {
    description: "Phoenix annotator kinds supported by annotation writes.",
  })
);

/**
 * **Example** (Type-check CODE annotator kind)
 *
 * ```ts
 * import { PhoenixAnnotatorKind } from "@beep/phoenix"
 *
 * const kind: PhoenixAnnotatorKind = "CODE"
 * console.log(PhoenixAnnotatorKind.is.CODE(kind))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixAnnotatorKind = typeof PhoenixAnnotatorKind.Type;

/**
 * **Example** (Log annotation value schema)
 *
 * ```ts
 * import { PhoenixAnnotationValue } from "@beep/phoenix"
 *
 * console.log(PhoenixAnnotationValue)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixAnnotationValue = S.Union([S.Boolean, S.Finite, S.String]).pipe(
  $I.annoteSchema("PhoenixAnnotationValue", {
    description: "Primitive annotation value accepted by repo-owned Phoenix annotations.",
  })
);

/**
 * **Example** (Decode string annotation value)
 *
 * ```ts
 * import { PhoenixAnnotationValue } from "@beep/phoenix"
 * import * as S from "effect/Schema"
 *
 * const value: PhoenixAnnotationValue = S.decodeUnknownSync(PhoenixAnnotationValue)("accurate")
 * console.log(value)
 * // "accurate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixAnnotationValue = typeof PhoenixAnnotationValue.Type;

/**
 * **Example** (Access system chat role)
 *
 * ```ts
 * import { PhoenixPromptChatRole } from "@beep/phoenix"
 *
 * console.log(PhoenixPromptChatRole.Enum.system)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixPromptChatRole = LiteralKit([
  "ai",
  "assistant",
  "developer",
  "model",
  "system",
  "tool",
  "user",
]).pipe(
  $I.annoteSchema("PhoenixPromptChatRole", {
    description: "Prompt chat roles accepted by repo-owned Phoenix prompt templates.",
  })
);

/**
 * **Example** (Type-check system chat role)
 *
 * ```ts
 * import { PhoenixPromptChatRole } from "@beep/phoenix"
 *
 * const role: PhoenixPromptChatRole = "system"
 * console.log(PhoenixPromptChatRole.is.system(role))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixPromptChatRole = typeof PhoenixPromptChatRole.Type;

/**
 * **Example** (Access MUSTACHE format enum)
 *
 * ```ts
 * import { PhoenixPromptTemplateFormat } from "@beep/phoenix"
 *
 * console.log(PhoenixPromptTemplateFormat.Enum.MUSTACHE)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixPromptTemplateFormat = LiteralKit(["F_STRING", "MUSTACHE"]).pipe(
  $I.annoteSchema("PhoenixPromptTemplateFormat", {
    description: "Prompt template formats accepted by repo-owned Phoenix prompt templates.",
  })
);

/**
 * **Example** (Type-check MUSTACHE format)
 *
 * ```ts
 * import { PhoenixPromptTemplateFormat } from "@beep/phoenix"
 *
 * const format: PhoenixPromptTemplateFormat = "MUSTACHE"
 * console.log(PhoenixPromptTemplateFormat.is.MUSTACHE(format))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixPromptTemplateFormat = typeof PhoenixPromptTemplateFormat.Type;

/**
 * Prompt model providers supported by the Phoenix SDK helper without extra invocation parameters.
 *
 * **Example** (Access GOOGLE provider enum)
 *
 * ```ts
 * import { PhoenixPromptModelProvider } from "@beep/phoenix"
 *
 * console.log(PhoenixPromptModelProvider.Enum.GOOGLE)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoenixPromptModelProvider = LiteralKit([
  "OPENAI",
  "AZURE_OPENAI",
  "GOOGLE",
  "DEEPSEEK",
  "XAI",
  "OLLAMA",
  "AWS",
]).pipe(
  $I.annoteSchema("PhoenixPromptModelProvider", {
    description: "Prompt model providers supported by the Phoenix driver prompt creation path.",
  })
);

/**
 * **Example** (Type-check GOOGLE provider)
 *
 * ```ts
 * import { PhoenixPromptModelProvider } from "@beep/phoenix"
 *
 * const provider: PhoenixPromptModelProvider = "GOOGLE"
 * console.log(PhoenixPromptModelProvider.is.GOOGLE(provider))
 * // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoenixPromptModelProvider = typeof PhoenixPromptModelProvider.Type;

/**
 * **Example** (Build doctor result object)
 *
 * ```ts
 * import { PhoenixDoctorResult } from "@beep/phoenix"
 *
 * const result = PhoenixDoctorResult.make({
 *   baseUrl: "https://phoenix.test",
 *   message: "Phoenix is reachable.",
 *   status: "passed",
 *   version: "1.2.3"
 * })
 * console.log(result.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDoctorResult extends S.Opaque<PhoenixDoctorResult, { readonly brand: unique symbol }>()(
  S.Struct({
    baseUrl: S.String.annotateKey({
      description: "Phoenix API base URL checked by the doctor operation.",
    }),
    message: S.String.annotateKey({
      description: "Sanitized Phoenix doctor status message.",
    }),
    status: PhoenixDoctorStatus.annotateKey({
      description: "Phoenix doctor health status.",
    }),
    version: S.NullOr(S.String).annotateKey({
      description: "Phoenix server version when it is available.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDoctorResult", {
      description: "Phoenix driver doctor result with sanitized connectivity status.",
    })
  )
) {}

/**
 * **Example** (Build dataset name selector)
 *
 * ```ts
 * import { PhoenixDatasetSelector } from "@beep/phoenix"
 *
 * const selector = PhoenixDatasetSelector.make({ kind: "dataset-name", value: "agent-loop-health-v1" })
 * console.log(selector.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetSelector extends S.Opaque<PhoenixDatasetSelector, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: PhoenixDatasetSelectorKind.annotateKey({
      description: "Dataset selector mode used by the Phoenix SDK.",
    }),
    splits: S.Array(S.String).pipe(S.optionalKey).annotateKey({
      description: "Optional Phoenix dataset split names.",
    }),
    value: S.String.annotateKey({
      description: "Dataset id or dataset name, interpreted according to kind.",
    }),
    versionId: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix dataset version identifier.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetSelector", {
      description: "Phoenix dataset selector by dataset id or dataset name.",
    })
  )
) {}

/**
 * **Example** (Build dataset example object)
 *
 * ```ts
 * import { PhoenixDatasetExample } from "@beep/phoenix"
 *
 * const example = PhoenixDatasetExample.make({
 *   input: { task: "score-loop-health" },
 *   metadata: { suite: "agent-effectiveness" }
 * })
 * console.log(example.input)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetExample extends S.Opaque<PhoenixDatasetExample, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix dataset example identifier.",
    }),
    input: S.Record(S.String, S.Unknown).annotateKey({
      description: "Phoenix dataset example input payload.",
    }),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      S.annotateKey({
        description: "Phoenix dataset example metadata payload.",
      }),
      S.withDecodingDefaultKey(Effect.succeed({}))
    ),
    output: S.Record(S.String, S.Unknown).pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Optional nullable Phoenix dataset example output payload.",
    }),
    spanId: S.String.pipe(S.NullOr, S.optionalKey).annotateKey({
      description: "Optional nullable Phoenix span identifier linked to the example.",
    }),
    splits: S.Union([S.String, S.Array(S.String)])
      .pipe(S.NullOr, S.optionalKey)
      .annotateKey({
        description: "Optional nullable Phoenix split assignment for the example.",
      }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetExample", {
      description: "Phoenix dataset example with sanitized input, output, metadata, and optional span linkage.",
    })
  )
) {}

/**
 * **Example** (Build dataset create input)
 *
 * ```ts
 * import { PhoenixDatasetCreateInput, PhoenixDatasetExample } from "@beep/phoenix"
 *
 * const input = PhoenixDatasetCreateInput.make({
 *   description: "Agent loop health examples.",
 *   examples: [PhoenixDatasetExample.make({ input: { task: "loop-health" } })],
 *   name: "agent-loop-health-v1"
 * })
 * console.log(input.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetCreateInput extends S.Opaque<PhoenixDatasetCreateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.String.annotateKey({
      description: "Human-readable Phoenix dataset description.",
    }),
    examples: S.Array(PhoenixDatasetExample).annotateKey({
      description: "Examples written into the Phoenix dataset.",
    }),
    name: S.String.annotateKey({
      description: "Phoenix dataset name.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetCreateInput", {
      description: "Input for creating or idempotently replacing a Phoenix dataset.",
    })
  )
) {}

/**
 * **Example** (Build dataset create result)
 *
 * ```ts
 * import { PhoenixDatasetCreateResult } from "@beep/phoenix"
 *
 * const result = PhoenixDatasetCreateResult.make({ datasetId: "dataset-id" })
 * console.log(result.datasetId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetCreateResult extends S.Opaque<
  PhoenixDatasetCreateResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    datasetId: S.String.annotateKey({
      description: "Phoenix dataset identifier returned after creation.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetCreateResult", {
      description: "Result from creating or replacing a Phoenix dataset.",
    })
  )
) {}

/**
 * **Example** (Build dataset append input)
 *
 * ```ts
 * import { PhoenixDatasetAppendInput, PhoenixDatasetExample, PhoenixDatasetSelector } from "@beep/phoenix"
 *
 * const input = PhoenixDatasetAppendInput.make({
 *   dataset: PhoenixDatasetSelector.make({ kind: "dataset-name", value: "agent-outcomes-v1" }),
 *   examples: [PhoenixDatasetExample.make({ input: { task: "outcome" } })]
 * })
 * console.log(input.dataset.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetAppendInput extends S.Opaque<PhoenixDatasetAppendInput, { readonly brand: unique symbol }>()(
  S.Struct({
    dataset: PhoenixDatasetSelector.annotateKey({
      description: "Phoenix dataset receiving appended examples.",
    }),
    examples: S.Array(PhoenixDatasetExample).annotateKey({
      description: "Examples appended to the Phoenix dataset.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetAppendInput", {
      description: "Input for appending examples to an existing Phoenix dataset.",
    })
  )
) {}

/**
 * **Example** (Build dataset append result)
 *
 * ```ts
 * import { PhoenixDatasetAppendResult } from "@beep/phoenix"
 *
 * const result = PhoenixDatasetAppendResult.make({ datasetId: "dataset-id", versionId: "version-id" })
 * console.log(result.versionId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetAppendResult extends S.Opaque<
  PhoenixDatasetAppendResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    datasetId: S.String.annotateKey({
      description: "Phoenix dataset identifier receiving appended examples.",
    }),
    versionId: S.String.annotateKey({
      description: "Phoenix dataset version identifier after append.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetAppendResult", {
      description: "Result from appending examples to a Phoenix dataset.",
    })
  )
) {}

const phoenixDatasetInfoResultMetadataDefault = R.empty();
/**
 * **Example** (Build dataset info result)
 *
 * ```ts
 * import { PhoenixDatasetInfoResult } from "@beep/phoenix"
 *
 * const result = PhoenixDatasetInfoResult.make({ datasetId: "dataset-id", name: "agent-outcomes-v1" })
 * console.log(result.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetInfoResult extends S.Opaque<PhoenixDatasetInfoResult, { readonly brand: unique symbol }>()(
  S.Struct({
    datasetId: S.String.annotateKey({
      description: "Phoenix dataset identifier.",
    }),
    description: S.NullOr(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(null)),
      S.annotateKey({
        description: "Nullable Phoenix dataset description.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(null))
    ),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(phoenixDatasetInfoResultMetadataDefault)),
      S.annotateKey({
        description: "Phoenix dataset metadata payload.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixDatasetInfoResultMetadataDefault))
    ),
    name: S.String.annotateKey({
      description: "Phoenix dataset name.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetInfoResult", {
      description: "Readback summary for a Phoenix dataset.",
    })
  )
) {}

/**
 * **Example** (Build dataset examples result)
 *
 * ```ts
 * import { PhoenixDatasetExamplesResult } from "@beep/phoenix"
 *
 * const result = PhoenixDatasetExamplesResult.make({ examples: [], versionId: "version-id" })
 * console.log(result.examples.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixDatasetExamplesResult extends S.Opaque<
  PhoenixDatasetExamplesResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    examples: S.Array(PhoenixDatasetExample).annotateKey({
      description: "Phoenix dataset examples returned for the selected version.",
    }),
    versionId: S.String.annotateKey({
      description: "Phoenix dataset version identifier used for the readback.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixDatasetExamplesResult", {
      description: "Readback result for Phoenix dataset examples.",
    })
  )
) {}

/**
 * **Example** (Build prompt chat message)
 *
 * ```ts
 * import { PhoenixPromptChatMessage } from "@beep/phoenix"
 *
 * const message = PhoenixPromptChatMessage.make({ content: "Score {{caseId}}", role: "user" })
 * console.log(message.role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixPromptChatMessage extends S.Opaque<PhoenixPromptChatMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.String.annotateKey({
      description: "Prompt chat message content.",
    }),
    role: PhoenixPromptChatRole.annotateKey({
      description: "Prompt chat message role.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixPromptChatMessage", {
      description: "Phoenix prompt chat message used by repo-owned prompt templates.",
    })
  )
) {}

const phoenixPromptCreateInputMetadataDefault = R.empty();
/**
 * **Example** (Build prompt create input)
 *
 * ```ts
 * import { PhoenixPromptChatMessage, PhoenixPromptCreateInput } from "@beep/phoenix"
 *
 * const input = PhoenixPromptCreateInput.make({
 *   modelName: "gpt-4o-mini",
 *   modelProvider: "OPENAI",
 *   name: "agent-effectiveness-review-evaluator-v1",
 *   template: [PhoenixPromptChatMessage.make({ content: "Review {{caseId}}", role: "user" })]
 * })
 * console.log(input.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixPromptCreateInput extends S.Opaque<PhoenixPromptCreateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt description.",
    }),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(phoenixPromptCreateInputMetadataDefault)),
      S.annotateKey({
        description: "Phoenix prompt metadata payload.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixPromptCreateInputMetadataDefault))
    ),
    modelName: S.String.annotateKey({
      description: "Provider model name used by the Phoenix prompt version.",
    }),
    modelProvider: PhoenixPromptModelProvider.pipe(
      S.withConstructorDefault(Effect.succeed(PhoenixPromptModelProvider.Enum.OPENAI)),
      S.annotateKey({
        description: "Prompt model provider used by the Phoenix SDK prompt helper.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(PhoenixPromptModelProvider.Enum.OPENAI))
    ),
    name: S.String.annotateKey({
      description: "Phoenix prompt name.",
    }),
    template: S.Array(PhoenixPromptChatMessage).annotateKey({
      description: "Phoenix prompt chat template messages.",
    }),
    templateFormat: PhoenixPromptTemplateFormat.pipe(
      S.withConstructorDefault(Effect.succeed(PhoenixPromptTemplateFormat.Enum.MUSTACHE)),
      S.annotateKey({
        description: "Phoenix prompt template format.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(PhoenixPromptTemplateFormat.Enum.MUSTACHE))
    ),
    versionDescription: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt version description.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixPromptCreateInput", {
      description: "Input for creating a repo-owned Phoenix prompt version.",
    })
  )
) {}

/**
 * **Example** (Build prompt write result)
 *
 * ```ts
 * import { PhoenixPromptWriteResult } from "@beep/phoenix"
 *
 * const result = PhoenixPromptWriteResult.make({ name: "prompt", promptVersionId: "version-id" })
 * console.log(result.promptVersionId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixPromptWriteResult extends S.Opaque<PhoenixPromptWriteResult, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.annotateKey({
      description: "Phoenix prompt name.",
    }),
    promptVersionId: S.String.annotateKey({
      description: "Phoenix prompt version identifier.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixPromptWriteResult", {
      description: "Result from creating a Phoenix prompt version.",
    })
  )
) {}

/**
 * **Example** (Build prompt name selector)
 *
 * ```ts
 * import { PhoenixPromptSelector } from "@beep/phoenix"
 *
 * const selector = PhoenixPromptSelector.make({ name: "agent-effectiveness-review-evaluator-v1" })
 * console.log(selector.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixPromptSelector extends S.Opaque<PhoenixPromptSelector, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt name.",
    }),
    promptId: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt identifier.",
    }),
    tag: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt tag.",
    }),
    versionId: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix prompt version identifier.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixPromptSelector", {
      description: "Phoenix prompt selector by prompt id, name, version id, or name plus tag.",
    })
  )
) {}

/**
 * **Example** (Build prompt read result)
 *
 * ```ts
 * import { PhoenixPromptReadResult } from "@beep/phoenix"
 *
 * const result = PhoenixPromptReadResult.make({ exists: true, promptVersionId: "version-id" })
 * console.log(result.exists)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixPromptReadResult extends S.Opaque<PhoenixPromptReadResult, { readonly brand: unique symbol }>()(
  S.Struct({
    exists: S.Boolean.annotateKey({
      description: "Whether the Phoenix prompt selector resolved to a prompt.",
    }),
    promptVersionId: S.NullOr(S.String).annotateKey({
      description: "Nullable Phoenix prompt version identifier.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixPromptReadResult", {
      description: "Readback result for a Phoenix prompt selector.",
    })
  )
) {}

const phoenixExperimentCreateInputExperimentMetadataDefault = R.empty();
/**
 * **Example** (Build experiment create input)
 *
 * ```ts
 * import { PhoenixExperimentCreateInput } from "@beep/phoenix"
 *
 * const input = PhoenixExperimentCreateInput.make({
 *   datasetId: "dataset-id",
 *   experimentName: "agent-effectiveness-deterministic-v1"
 * })
 * console.log(input.datasetId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixExperimentCreateInput extends S.Opaque<
  PhoenixExperimentCreateInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    datasetId: S.String.annotateKey({
      description: "Phoenix dataset identifier used by the experiment.",
    }),
    datasetVersionId: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix dataset version identifier used by the experiment.",
    }),
    experimentDescription: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix experiment description.",
    }),
    experimentMetadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(phoenixExperimentCreateInputExperimentMetadataDefault)),
      S.annotateKey({
        description: "Phoenix experiment metadata payload.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixExperimentCreateInputExperimentMetadataDefault))
    ),
    experimentName: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix experiment name.",
    }),
    repetitions: PhoenixPositiveCount.pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.annotateKey({
        description: "Positive integer number of repetitions requested for the experiment.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(1))
    ),
    splits: S.Array(S.String).pipe(S.optionalKey).annotateKey({
      description: "Optional Phoenix dataset splits used by the experiment.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixExperimentCreateInput", {
      description: "Input for creating a Phoenix experiment record without running billable model work.",
    })
  )
) {}

const phoenixExperimentInfoResultMetadataDefault = R.empty();
/**
 * **Example** (Build experiment info result)
 *
 * ```ts
 * import { PhoenixExperimentInfoResult } from "@beep/phoenix"
 *
 * const result = PhoenixExperimentInfoResult.make({
 *   datasetId: "dataset-id",
 *   datasetVersionId: "version-id",
 *   exampleCount: 1,
 *   experimentId: "experiment-id",
 *   failedRunCount: 0,
 *   missingRunCount: 1,
 *   repetitions: 1,
 *   successfulRunCount: 0
 * })
 * console.log(result.experimentId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixExperimentInfoResult extends S.Opaque<
  PhoenixExperimentInfoResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    datasetId: S.String.annotateKey({
      description: "Phoenix dataset identifier used by the experiment.",
    }),
    datasetVersionId: S.String.annotateKey({
      description: "Phoenix dataset version identifier used by the experiment.",
    }),
    exampleCount: PhoenixCount.annotateKey({
      description: "Non-negative count of examples in the experiment.",
    }),
    experimentId: S.String.annotateKey({
      description: "Phoenix experiment identifier.",
    }),
    failedRunCount: PhoenixCount.annotateKey({
      description: "Non-negative count of failed experiment runs.",
    }),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(phoenixExperimentInfoResultMetadataDefault)),
      S.annotateKey({
        description: "Phoenix experiment metadata payload.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixExperimentInfoResultMetadataDefault))
    ),
    missingRunCount: PhoenixCount.annotateKey({
      description: "Non-negative count of missing experiment runs.",
    }),
    projectName: S.NullOr(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(null)),
      S.annotateKey({
        description: "Nullable Phoenix project name for the experiment.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(null))
    ),
    repetitions: PhoenixPositiveCount.annotateKey({
      description: "Positive integer repetition count configured for the experiment.",
    }),
    successfulRunCount: PhoenixCount.annotateKey({
      description: "Non-negative count of successful experiment runs.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixExperimentInfoResult", {
      description: "Readback summary for a Phoenix experiment record.",
    })
  )
) {}

const phoenixAnnotationInputMetadataDefault = R.empty();
/**
 * **Example** (Build annotation write input)
 *
 * ```ts
 * import { PhoenixAnnotationInput } from "@beep/phoenix"
 *
 * const input = PhoenixAnnotationInput.make({
 *   label: "passed",
 *   name: "agent.outcome",
 *   targetId: "trace-id",
 *   targetKind: "trace"
 * })
 * console.log(input.targetKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixAnnotationInput extends S.Opaque<PhoenixAnnotationInput, { readonly brand: unique symbol }>()(
  S.Struct({
    annotatorKind: PhoenixAnnotatorKind.pipe(
      S.withConstructorDefault(Effect.succeed(PhoenixAnnotatorKind.Enum.CODE)),
      S.annotateKey({
        description: "Phoenix annotator kind for the annotation.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(PhoenixAnnotatorKind.Enum.CODE))
    ),
    explanation: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix annotation explanation.",
    }),
    identifier: S.optionalKey(S.String).annotateKey({
      description: "Optional stable Phoenix annotation identifier.",
    }),
    label: S.optionalKey(S.String).annotateKey({
      description: "Optional Phoenix annotation label value.",
    }),
    metadata: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(phoenixAnnotationInputMetadataDefault)),
      S.annotateKey({
        description: "Phoenix annotation metadata payload.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(phoenixAnnotationInputMetadataDefault))
    ),
    name: S.String.annotateKey({
      description: "Phoenix annotation name.",
    }),
    score: S.optionalKey(S.Finite).annotateKey({
      description: "Optional finite Phoenix annotation score.",
    }),
    sync: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.annotateKey({
        description: "Whether the Phoenix SDK should synchronously write the annotation.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ),
    targetId: S.String.annotateKey({
      description: "Phoenix span, session, or trace identifier targeted by the annotation.",
    }),
    targetKind: PhoenixAnnotationTargetKind.annotateKey({
      description: "Phoenix annotation target kind.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixAnnotationInput", {
      description: "Input for writing one Phoenix span, session, or trace annotation.",
    })
  )
) {}

/**
 * **Example** (Build annotation write result)
 *
 * ```ts
 * import { PhoenixAnnotationWriteResult } from "@beep/phoenix"
 *
 * const result = PhoenixAnnotationWriteResult.make({
 *   annotationId: "annotation-id",
 *   name: "agent.outcome",
 *   targetId: "trace-id",
 *   targetKind: "trace"
 * })
 * console.log(result.annotationId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoenixAnnotationWriteResult extends S.Opaque<
  PhoenixAnnotationWriteResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    annotationId: S.NullOr(S.String).annotateKey({
      description: "Nullable Phoenix annotation identifier returned by the SDK.",
    }),
    name: S.String.annotateKey({
      description: "Phoenix annotation name.",
    }),
    targetId: S.String.annotateKey({
      description: "Phoenix span, session, or trace identifier targeted by the annotation.",
    }),
    targetKind: PhoenixAnnotationTargetKind.annotateKey({
      description: "Phoenix annotation target kind.",
    }),
  }).pipe(
    $I.annoteSchema("PhoenixAnnotationWriteResult", {
      description: "Result from writing one Phoenix annotation.",
    })
  )
) {}
