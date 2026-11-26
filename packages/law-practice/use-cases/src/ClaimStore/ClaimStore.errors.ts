/**
 * Claim store failure: the typed port failure both claim store ports raise.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("ClaimStore/ClaimStore.errors");

/**
 * **Example** (Check a store operation)
 *
 * ```ts
 * import { LawClaimStoreOperation } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * console.log(LawClaimStoreOperation.is["append-proposed"]("append-proposed")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LawClaimStoreOperation = LiteralKit([
  "append-proposed",
  "read-proposed",
  "open-admission",
  "append-admission",
  "read-admission",
]).pipe($I.annoteSchema("LawClaimStoreOperation", { description: "The claim store operation that failed." }));

/**
 * @category errors
 * @since 0.0.0
 */
export type LawClaimStoreOperation = typeof LawClaimStoreOperation.Type;

/**
 * A claim store port failure; adapter detail stays in the adapter.
 *
 * **Example** (Raise a store failure)
 *
 * ```ts
 * import { LawClaimStoreError } from "@beep/law-practice-use-cases/ClaimStore"
 *
 * const error = LawClaimStoreError.make({ operation: "append-proposed" })
 * console.log(error._tag) // "LawClaimStoreError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LawClaimStoreError extends S.TaggedError<LawClaimStoreError, { readonly brand: unique symbol }>(
  $I`LawClaimStoreError`
)(
  "LawClaimStoreError",
  { operation: LawClaimStoreOperation.annotateKey({ description: "Store operation that failed." }) },
  $I.annoteError<LawClaimStoreError>("LawClaimStoreError", {
    title: "Claim store unavailable",
    description: "A claim store port could not read or append.",
  })
) {}
