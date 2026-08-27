/**
 * Runtime configuration defaults and schema-backed model options for the
 * OpenAI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OpenaiId } from "@beep/identity/packages";
import { PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import type { OpenAiEmbeddingModel, OpenAiLanguageModel } from "@effect/ai-openai";

const $I = $OpenaiId.create("OpenAi.config");

/**
 * Environment binding used by {@link OpenAiLive} for the redacted API key.
 *
 * **Details**
 *
 * Local configuration may hold a 1Password secret reference such as
 * `op://BEEP_SECRETS/OpenAI/API Key`; the driver reads the resolved value as
 * `Redacted` and never logs it.
 *
 * **Example** (Configure a secret reference)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OPENAI_API_KEY_ENV } from "@beep/openai"
 *
 * const localEnv = {
 *   [OPENAI_API_KEY_ENV]: "op://BEEP_SECRETS/OpenAI/API Key"
 * }
 *
 * strictEqual(localEnv.AI_OPENAI_API_KEY, "op://BEEP_SECRETS/OpenAI/API Key")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENAI_API_KEY_ENV = "AI_OPENAI_API_KEY";

/**
 * Environment binding overriding the default OpenAI language model.
 *
 * **Example** (Override the language model)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OPENAI_MODEL_ENV } from "@beep/openai"
 *
 * const localEnv = { [OPENAI_MODEL_ENV]: "gpt-4o-mini" }
 *
 * strictEqual(localEnv.AI_OPENAI_MODEL, "gpt-4o-mini")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENAI_MODEL_ENV = "AI_OPENAI_MODEL";

/**
 * Environment binding overriding the default OpenAI embedding model.
 *
 * **Example** (Override the embedding model)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OPENAI_EMBEDDING_MODEL_ENV } from "@beep/openai"
 *
 * const localEnv = { [OPENAI_EMBEDDING_MODEL_ENV]: "text-embedding-3-large" }
 *
 * strictEqual(localEnv.AI_OPENAI_EMBEDDING_MODEL, "text-embedding-3-large")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENAI_EMBEDDING_MODEL_ENV = "AI_OPENAI_EMBEDDING_MODEL";

/**
 * OpenAI Responses API model used when `AI_OPENAI_MODEL` is unset.
 *
 * **Example** (Inspect the default language model)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OPENAI_DEFAULT_MODEL } from "@beep/openai"
 *
 * strictEqual(OPENAI_DEFAULT_MODEL, "gpt-4o-mini")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini" satisfies OpenAiLanguageModel.Model;

/**
 * OpenAI embeddings API model used when `AI_OPENAI_EMBEDDING_MODEL` is unset.
 *
 * **Example** (Inspect the default embedding model)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OPENAI_DEFAULT_EMBEDDING_MODEL } from "@beep/openai"
 *
 * strictEqual(OPENAI_DEFAULT_EMBEDDING_MODEL, "text-embedding-3-small")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OPENAI_DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small" satisfies OpenAiEmbeddingModel.Model;

/**
 * Schema-backed options accepted by the OpenAI language-model Layer factory.
 *
 * **Details**
 *
 * Omitting `model` applies {@link OPENAI_DEFAULT_MODEL} at construction and
 * decoding time.
 *
 * **Example** (Create language-model options)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OpenAiLanguageModelOptions } from "@beep/openai"
 *
 * const options = OpenAiLanguageModelOptions.make({})
 *
 * strictEqual(options.model, "gpt-4o-mini")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiLanguageModelOptions extends S.Class<OpenAiLanguageModelOptions>($I`OpenAiLanguageModelOptions`)(
  {
    model: SchemaUtils.withKeyDefaults(S.String, OPENAI_DEFAULT_MODEL).annotateKey({
      description: "OpenAI Responses API model identifier used by the language-model Layer.",
    }),
  },
  $I.annote("OpenAiLanguageModelOptions", {
    description: "Options accepted by the OpenAI language-model Layer factory.",
  })
) {}

/**
 * Schema-backed options accepted by the OpenAI embedding-model Layer factory.
 *
 * **Gotchas**
 *
 * Callers must always choose `dimensions`. The driver deliberately has no
 * environment or schema default for vector size.
 *
 * **Example** (Create embedding-model options)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { OpenAiEmbeddingModelOptions } from "@beep/openai"
 * import { PosInt } from "@beep/schema"
 *
 * const options = OpenAiEmbeddingModelOptions.make({ dimensions: PosInt.make(1536) })
 *
 * strictEqual(options.dimensions, 1536)
 * strictEqual(options.model, "text-embedding-3-small")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OpenAiEmbeddingModelOptions extends S.Class<OpenAiEmbeddingModelOptions>($I`OpenAiEmbeddingModelOptions`)(
  {
    dimensions: PosInt.annotateKey({
      description: "Positive embedding vector size provided as `EmbeddingModel.Dimensions`.",
    }),
    model: SchemaUtils.withKeyDefaults(S.String, OPENAI_DEFAULT_EMBEDDING_MODEL).annotateKey({
      description: "OpenAI embeddings API model identifier used by the embedding-model Layer.",
    }),
  },
  $I.annote("OpenAiEmbeddingModelOptions", {
    description: "Options accepted by the OpenAI embedding-model Layer factory.",
  })
) {}
