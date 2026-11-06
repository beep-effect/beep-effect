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
 * @category normalization
 * @since 0.0.0
 */
export const prepareClaimInspection = Effect.fn("ClaimInspection.prepare")(function* (input: ClaimInputCollection) {
  const qualifications = yield* qualifyClaimInput(input);
  return PreparedClaimInspection.make({ input, qualifications });
});
