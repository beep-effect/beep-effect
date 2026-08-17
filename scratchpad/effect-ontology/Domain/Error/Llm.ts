/**
 * Schema-backed failures raised by large-language-model operations.
 *
 * **Details**
 *
 * * Timeout and retry metadata are decoded to `Option` values, keeping absence
 * out of downstream branching and preserving exhaustive `_tag` handling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import {
  ErrorMessage,
  makeOntologyErrorClass,
  OptionalErrorCause,
  OptionalErrorMessage,
  OptionalMilliseconds,
} from "./Base.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Error/Llm");

/**
 * General LLM provider failure without a more precise recovery category.
 *
 * **Example** (Use LlmError)
 * ```ts
 * import { LlmError } from "@effect-ontology/Error/Llm.ts"
 *
 * const error = LlmError.make({ message: "Provider request failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LlmError = makeOntologyErrorClass.make(
  $I`LlmError`,
  "LlmError",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable provider failure diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying provider defect.",
    }),
  },
  $I.annote("LlmError", {
    description: "General LLM provider failure without a more precise recovery category.",
  })
);

/**
 * Runtime value decoded by {@link LlmError}.
 *
 * **Example** (Use LlmError)
 * ```ts
 * import { LlmError, type LlmError as LlmFailure } from "@effect-ontology/Error/Llm.ts"
 *
 * const error: LlmFailure = LlmError.make({ message: "Provider failed." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmError = typeof LlmError.Type;

/**
 * Indicates that an LLM call exceeded its configured deadline.
 *
 * **Details**
 *
 * * The deadline may be unavailable when a provider owns timeout policy; the
 * decoded value is still always an `Option`.
 *
 * **Example** (Use LlmTimeout)
 * ```ts
 * import { LlmTimeout } from "@effect-ontology/Error/Llm.ts"
 *
 * const error = LlmTimeout.make({ message: "Generation timed out." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LlmTimeout = makeOntologyErrorClass.make(
  $I`LlmTimeout`,
  "LlmTimeout",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable timeout diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying timeout defect.",
    }),
    timeoutMs: OptionalMilliseconds.annotateKey({
      description: "Optional configured deadline in milliseconds, normalized to Option.",
    }),
  },
  $I.annote("LlmTimeout", {
    description: "LLM call failure caused by exceeding a configured deadline.",
  })
);

/**
 * Runtime value decoded by {@link LlmTimeout}.
 *
 * **Example** (Use LlmTimeout)
 * ```ts
 * import { LlmTimeout, type LlmTimeout as Timeout } from "@effect-ontology/Error/Llm.ts"
 *
 * const error: Timeout = LlmTimeout.make({ message: "Timed out." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmTimeout = typeof LlmTimeout.Type;

/**
 * Indicates that an LLM provider rejected work because of a rate limit.
 *
 * **Example** (Use LlmRateLimit)
 * ```ts
 * import { LlmRateLimit } from "@effect-ontology/Error/Llm.ts"
 *
 * const error = LlmRateLimit.make({ message: "Request quota exhausted." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LlmRateLimit = makeOntologyErrorClass.make(
  $I`LlmRateLimit`,
  "LlmRateLimit",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable rate-limit diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional underlying provider defect.",
    }),
    retryAfterMs: OptionalMilliseconds.annotateKey({
      description: "Optional provider-directed retry delay in milliseconds, normalized to Option.",
    }),
  },
  $I.annote("LlmRateLimit", {
    description: "LLM request rejected because the provider rate limit was exhausted.",
  })
);

/**
 * Runtime value decoded by {@link LlmRateLimit}.
 *
 * **Example** (Use LlmRateLimit)
 * ```ts
 * import { LlmRateLimit, type LlmRateLimit as RateLimited } from "@effect-ontology/Error/Llm.ts"
 *
 * const error: RateLimited = LlmRateLimit.make({ message: "Quota exhausted." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmRateLimit = typeof LlmRateLimit.Type;

/**
 * Indicates that an LLM response could not be interpreted.
 *
 * **Details**
 *
 * * A diagnostic excerpt may be retained, but callers should truncate or redact
 * provider output before crossing this boundary.
 *
 * **Example** (Use LlmInvalidResponse)
 * ```ts
 * import { LlmInvalidResponse } from "@effect-ontology/Error/Llm.ts"
 *
 * const error = LlmInvalidResponse.make({ message: "Response was not valid JSON." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LlmInvalidResponse = makeOntologyErrorClass.make(
  $I`LlmInvalidResponse`,
  "LlmInvalidResponse",
  {
    message: ErrorMessage.annotateKey({
      description: "Human-readable response-validation diagnostic.",
    }),
    cause: OptionalErrorCause.annotateKey({
      description: "Optional response parser defect.",
    }),
    response: OptionalErrorMessage.annotateKey({
      description: "Optional redacted response excerpt, normalized to Option.",
    }),
  },
  $I.annote("LlmInvalidResponse", {
    description: "LLM response failure caused by invalid or unparseable provider output.",
  })
);

/**
 * Runtime value decoded by {@link LlmInvalidResponse}.
 *
 * **Example** (Use LlmInvalidResponse)
 * ```ts
 * import { LlmInvalidResponse, type LlmInvalidResponse as InvalidResponse } from "@effect-ontology/Error/Llm.ts"
 *
 * const error: InvalidResponse = LlmInvalidResponse.make({ message: "Invalid JSON." })
 * console.log(error.message)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmInvalidResponse = typeof LlmInvalidResponse.Type;

const AnyLlmErrorDefinition = S.Union([LlmError, LlmTimeout, LlmRateLimit, LlmInvalidResponse]).pipe(
  S.toTaggedUnion("_tag")
);

/**
 * Exhaustive tagged union of LLM operation failures.
 *
 * **Example** (Use AnyLlmError)
 * ```ts
 * import { AnyLlmError, LlmTimeout } from "@effect-ontology/Error/Llm.ts"
 *
 * const error = LlmTimeout.make({ message: "Timed out." })
 * console.log(AnyLlmError.guards.LlmTimeout(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AnyLlmError = AnyLlmErrorDefinition.pipe(
  $I.annoteSchema("AnyLlmError", {
    description: "Exhaustive tagged union of LLM operation failures.",
  toArbitrary: () => S.toArbitrary(AnyLlmErrorDefinition),
  })
);

/**
 * Runtime failure decoded by {@link AnyLlmError}.
 *
 * **Example** (Use AnyLlmError)
 * ```ts
 * import { LlmError, type AnyLlmError } from "@effect-ontology/Error/Llm.ts"
 *
 * const error: AnyLlmError = LlmError.make({ message: "Failed." })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnyLlmError = typeof AnyLlmError.Type;
