/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Evidence span model exports.
 *
 * @example
 * ```ts
 * import { EvidenceSpan } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import * as S from "effect/Schema"
 *
 * const span = S.decodeUnknownSync(EvidenceSpan)({
 *   confidence: 0.92,
 *   endChar: 48,
 *   quote: "a claimed fact",
 *   startChar: 12
 * })
 * console.log(span.quote)
 * ```

 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceSpan.model.ts";
