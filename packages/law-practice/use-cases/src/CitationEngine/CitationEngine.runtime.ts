/** Server-only native Unicode layout and operation allocation capability.
 * Source representation follows pinned CPython/eyecite semantics; see
 * THIRD_PARTY_NOTICES.md. Neither decoding nor a structural handle issues work.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import type * as Effect from "effect/Effect";
import type { CitationSafetyLimitExceeded } from "./CitationEngine.safety.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.runtime");
const UnicodeBytes = S.Uint8Array.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16 * 4)).pipe(
  $I.annoteSchema("UnicodeBytes", { description: "Bounded adapter-owned canonical native Unicode bytes." })
);
/** Native Unicode layout preserving scalar and adjacent surrogate distinctions. Shape decoding grants no source proof.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server"
 * console.log(CitationPythonUnicodeStorage.fields.width !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationPythonUnicodeStorage extends S.Opaque<
  CitationPythonUnicodeStorage,
  { readonly brand: unique symbol }
>()(
  S.Struct({ width: S.Literals([1, 2, 4]), bytes: UnicodeBytes }).pipe(
    $I.annoteSchema("CitationPythonUnicodeStorage", {
      description: "Explicit canonical one/two/four-byte source code-point storage; not a source-identity receipt.",
    })
  )
) {}
/** One operation’s captured allocation authority. Construct its server owner afresh for each operation.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationTextBudget } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const capture = Effect.gen(function* () { return yield* CitationTextBudget })
 * console.log(typeof capture) // "object"
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationTextBudget extends Context.Service<
  CitationTextBudget,
  {
    readonly maximum: number;
    readonly reserve: (units: number) => Effect.Effect<void, CitationSafetyLimitExceeded>;
    readonly snapshot: Effect.Effect<number>;
    /** The captured producer enforces the allowance before output allocation and
     * completes cleanup before return. Failure/interruption publishes no output
     * or successful charge. Reentry, including child fibers, is forbidden.
     */
    readonly withCapacity: <A, E>(
      produce: (remaining: number) => Effect.Effect<{ readonly value: A; readonly units: number }, E>
    ) => Effect.Effect<{ readonly value: A; readonly units: number }, E | CitationSafetyLimitExceeded>;
  }
>()($I`CitationTextBudget`) {}
