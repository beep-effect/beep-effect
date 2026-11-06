/** Closed operation names shared by server requests, reports and failures.
 * @packageDocumentation @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.operations");
/** Server-only citation operation; not an arbitrary request label.
 * **Example** (Recognize extraction)
 * ```ts
 * import { CitationEngineOperation } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineOperation.is.extract("extract")) // true
 * ```
 * @category models @since 0.0.0
 */
export const CitationEngineOperation = LiteralKit(["clean", "extract", "resolve", "annotate"]).pipe(
  $I.annoteSchema("CitationEngineOperation", {
    description: "Closed server operation whose result is completed or withheld.",
  })
);
/** Schema-derived server operation.
 * **Example** (Type an operation)
 * ```ts
 * import type { CitationEngineOperation } from "@beep/law-practice-use-cases/server"
 * const operation: CitationEngineOperation = "extract"
 * console.log(operation) // "extract"
 * ```
 * @category models @since 0.0.0
 */
export type CitationEngineOperation = typeof CitationEngineOperation.Type;
