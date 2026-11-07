/**
 * Closed server citation safety failures, including dependency-owned resources.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CitationEngineLimits } from "./CitationEngine.limits.ts";
import { CitationEngineOperation } from "./CitationEngine.operations.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.safety");
/**
 * Policy field or dependency resource whose exhaustion prevents completion.
 * **Example** (Recognize native parser resource exhaustion)
 * ```ts
 * import { CitationSafetyBudget } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationSafetyBudget)("nativeHtmlParserResource")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationSafetyBudget = LiteralKit([
  "nativeHtmlParserResource",
  ...R.keys(CitationEngineLimits.fields),
]).pipe(
  $I.annoteSchema("CitationSafetyBudget", {
    description: "Closed effective-policy field names plus the non-configurable native HTML parser resource category.",
  })
);
/**
 * Schema-derived safety resource name.
 * @category models
 * @since 0.0.0
 */
export type CitationSafetyBudget = typeof CitationSafetyBudget.Type;
/**
 * A citation operation exhausted a count, deadline or native parser resource.
 * **Details**
 * No partial result, source text, native message or nested cause is carried.
 * The native parser category adds no configurable policy field.
 * **Example** (Withhold a native parser's truncated result)
 * ```ts
 * import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server"
 * const failure = CitationSafetyLimitExceeded.make({ operation: "clean", limit: "nativeHtmlParserResource" })
 * console.log(failure._tag) // "CitationSafetyLimitExceeded"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CitationSafetyLimitExceeded extends S.TaggedError<
  CitationSafetyLimitExceeded,
  { readonly brand: unique symbol }
>($I`CitationSafetyLimitExceeded`)(
  "CitationSafetyLimitExceeded",
  { operation: CitationEngineOperation, limit: CitationSafetyBudget },
  $I.annoteError<CitationSafetyLimitExceeded>("CitationSafetyLimitExceeded", {
    description: "Closed redacted citation resource/deadline exhaustion; a partial result is never returned.",
  })
) {}
