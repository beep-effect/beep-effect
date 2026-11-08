/**
 * Shared source qualification for legacy and enhanced inspection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { qualifyClaimInput } from "../PatentDocument/PatentDocument.normalizer.ts";
import { PreparedClaimInspection } from "./ClaimLexicalEvidence.model.ts";
import type { ClaimInputCollection } from "./ClaimElement.input.model.ts";
/**
 * Preserve and qualify every input record before annotating normalized text.
 *
 * **Example** (Qualify a supplied source record)
 *
 * ```ts
 * import { ClaimInputCollection, ClaimInputRecord, prepareClaimInspection } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const text = "A system comprising a sensor."
 * const input = ClaimInputCollection.make({ sourceKey: "example", records: [ClaimInputRecord.cases.text.make({ sourceOrdinal: 1, numberText: O.some("1"), sourceText: text, canonicalText: text })] })
 * const program = Effect.map(prepareClaimInspection(input), prepared => prepared.qualifications.length)
 * Effect.runPromise(program).then(console.log) // 1
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const prepareClaimInspection = Effect.fn("ClaimInspection.prepare")(function* (input: ClaimInputCollection) {
  const qualifications = yield* qualifyClaimInput(input);
  return PreparedClaimInspection.make({ input, qualifications });
});
