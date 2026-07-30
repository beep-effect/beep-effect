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
import {
  isInternallyConsistent as isTextAnchorInternallyConsistent,
  TextAnchorFields,
  TextAnchorWidthCheck,
} from "@beep/provenance/TextAnchor";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { identity } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $EpistemicDomainId.create("values/EvidenceSpan/EvidenceSpan.model");

/**
 * Extraction confidence in the unit interval `[0, 1]` — the epistemic semantic
 * name for the domain-agnostic {@link UnitInterval} primitive.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Confidence } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * Effect.runPromise(S.decodeUnknownEffect(Confidence)(0.92)).then(console.log)
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
 * import { Effect } from "effect"
 * import { Confidence } from "@beep/epistemic-domain"
 * import type { Confidence as ConfidenceValue } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(Confidence)(0.92)
 * Effect.runPromise(program).then((value: ConfidenceValue) => console.log(value))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Confidence = typeof Confidence.Type;

class EvidenceSpanStruct extends S.Class<EvidenceSpanStruct>($I`EvidenceSpanStruct`)(
  {
    ...TextAnchorFields,
    confidence: Confidence.annotateKey({ description: "Extraction confidence in the unit interval [0, 1]." }),
  },
  $I.annote("EvidenceSpanStruct", {
    description: "Internal structural base for a text anchor and its extraction confidence.",
  })
) {}

const EvidenceSpanSchema = EvidenceSpanStruct.mapFields(identity)
  .check(TextAnchorWidthCheck)
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(fc.nat(10_000), fc.string({ minLength: 1, maxLength: 256 }), fc.integer({ min: 0, max: 1_000 }))
        .map(([startChar, quote, confidence]) =>
          EvidenceSpanStruct.make({
            startChar: NonNegativeInt.make(startChar),
            endChar: NonNegativeInt.make(startChar + Str.length(quote)),
            quote,
            confidence: Confidence.make(confidence / 1_000),
          })
        ),
  });

/**
 * Char-offset evidence span: the exact quoted source text and its start/end
 * character offsets, with an extraction confidence. Structurally it is a
 * `@beep/provenance` `TextAnchor` (offset fields spread from `TextAnchorFields`)
 * plus a `Confidence` — the confidence is the epistemic judgement layered on top
 * of the pure provenance anchor.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { EvidenceSpan } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(EvidenceSpan)({
 *   startChar: 12,
 *   endChar: 26,
 *   quote: "a claimed fact",
 *   confidence: 0.92,
 * })
 * Effect.runPromise(program).then((span) => console.log(span.endChar))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class EvidenceSpan extends S.Class<EvidenceSpan>($I`EvidenceSpan`)(
  EvidenceSpanSchema,
  $I.annote("EvidenceSpan", {
    description: "Char-offset evidence span wrapping a @beep/provenance TextAnchor with an extraction confidence.",
  })
) {
  /**
   * Whether the span is internally consistent before source-text re-slicing:
   * non-empty range, non-empty quote, and quote length matching the range width.
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly isInternallyConsistent = (span: EvidenceSpan): boolean => isTextAnchorInternallyConsistent(span);
}

/**
 * Whether an evidence span is internally consistent before source-text re-slicing.
 *
 * @example
 * ```ts
 * import { Confidence, EvidenceSpan, isEvidenceSpanInternallyConsistent } from "@beep/epistemic-domain/values/EvidenceSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const span = EvidenceSpan.make({
 *   startChar: NonNegativeInt.make(0),
 *   endChar: NonNegativeInt.make(12),
 *   quote: "Ada Lovelace",
 *   confidence: Confidence.make(0.98)
 * })
 *
 * console.log(isEvidenceSpanInternallyConsistent(span))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isEvidenceSpanInternallyConsistent = EvidenceSpan.isInternallyConsistent;
