/**
 * Evidence span value schema.
 *
 * The char-offset substrate now lives in `@beep/provenance` (`TextAnchor`) and
 * the unit-interval primitive in `@beep/schema` (`UnitInterval`); this module is
 * the epistemic value object that wraps the anchor fields and adds an extraction
 * confidence. Keeping the offset shape in foundation lets any slice ground
 * knowledge in a source span without depending on the epistemic slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { TextAnchorFields } from "@beep/provenance/TextAnchor";
import { SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("values/EvidenceSpan/EvidenceSpan.model");

/**
 * Extraction confidence in the unit interval `[0, 1]` — the epistemic semantic
 * name for the domain-agnostic {@link UnitInterval} primitive.
 *
 * @example
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const confidence = S.decodeUnknownSync(Confidence)(0.92)
 * console.log(confidence) // 0.92
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Confidence = UnitInterval.pipe(
  $I.annoteSchema("Confidence", {
    description: "Extraction confidence in the unit interval [0, 1].",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link Confidence}.
 *
 * @example
 * ```ts
 * import { Confidence } from "@beep/epistemic-domain"
 * import type { Confidence as ConfidenceValue } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const value: ConfidenceValue = S.decodeUnknownSync(Confidence)(0.92)
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Confidence = typeof Confidence.Type;

/**
 * Char-offset evidence span: the exact quoted source text and its start/end
 * character offsets, with an extraction confidence. Structurally it is a
 * `@beep/provenance` `TextAnchor` (offset fields spread from `TextAnchorFields`)
 * plus a `Confidence` — the confidence is the epistemic judgement layered on top
 * of the pure provenance anchor.
 *
 * @example
 * ```ts
 * import { EvidenceSpan } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const span = S.decodeUnknownSync(EvidenceSpan)({
 *   startChar: 12,
 *   endChar: 48,
 *   quote: "a claimed fact",
 *   confidence: 0.92,
 * })
 * console.log(span.endChar)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class EvidenceSpan extends S.Class<EvidenceSpan>($I`EvidenceSpan`)(
  {
    ...TextAnchorFields,
    confidence: Confidence.annotateKey({ description: "Extraction confidence in the unit interval [0, 1]." }),
  },
  $I.annote("EvidenceSpan", {
    description: "Char-offset evidence span wrapping a @beep/provenance TextAnchor with an extraction confidence.",
  })
) {}
