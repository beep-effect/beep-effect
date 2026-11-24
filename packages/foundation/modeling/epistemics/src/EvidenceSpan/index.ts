/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Decode EvidenceSpan with Schema)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { EvidenceSpan } from "@beep/epistemics/EvidenceSpan"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(EvidenceSpan)({
 *   confidence: 0.92,
 *   endChar: 26,
 *   quote: "a claimed fact",
 *   startChar: 12
 * })
 * Effect.runPromise(program).then((span) => console.log(span.quote))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EvidenceSpan.model.ts";
