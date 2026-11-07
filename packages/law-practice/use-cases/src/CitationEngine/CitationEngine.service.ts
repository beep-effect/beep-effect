/** Server citation operations with captured dependencies and closed failures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { CitationEngineAnnotationInput } from "./CitationEngine.annotation.ts";
import type { CitationEngineFailure } from "./CitationEngine.errors.ts";
import type {
  CitationEngineCleanInput,
  CitationEngineResolutionInput,
  CitationEngineSourcePairInput,
} from "./CitationEngine.input.ts";
import type {
  CitationEngineAnnotationResult,
  CitationEngineCleanResult,
  CitationEngineExtractionResult,
  CitationEngineResolutionResult,
} from "./CitationEngine.result.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.service");
/** Captured server engine. Primitive source requests carry schema-owned modes;
 * executable cleaner/tokenizer/annotation behavior belongs to installed ports.
 * Every method requires no caller services and uses the closed failure union.
 * Broader retained-document/host protocols remain separately qualified work.
 * **Example** (Access the installed engine)
 * ```ts
 * import { CitationEngine } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () { return yield* CitationEngine })
 * console.log(typeof program) // "object"
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationEngine extends Context.Service<
  CitationEngine,
  {
    readonly clean: (
      input: CitationEngineCleanInput
    ) => Effect.Effect<CitationEngineCleanResult, CitationEngineFailure>;
    readonly extract: (
      input: CitationEngineSourcePairInput
    ) => Effect.Effect<CitationEngineExtractionResult, CitationEngineFailure>;
    readonly resolve: (
      input: CitationEngineResolutionInput
    ) => Effect.Effect<CitationEngineResolutionResult, CitationEngineFailure>;
    readonly annotate: (
      input: CitationEngineAnnotationInput
    ) => Effect.Effect<CitationEngineAnnotationResult, CitationEngineFailure>;
  }
>()($I`CitationEngine`) {}
