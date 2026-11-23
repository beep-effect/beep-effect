/**
 * Evidence span value schema.
 *
 * **Details**
 *
 * The char-offset substrate now lives in `@beep/text` (`TextAnchor`) and
 * the unit-interval primitive in `@beep/schema` (`UnitInterval`); this module is
 * the epistemic value object that wraps the anchor fields and adds an extraction
 * confidence. Keeping the offset shape in foundation lets any slice ground
 * knowledge in a source span without depending on the epistemic slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import {
  isInternallyConsistent as isTextAnchorInternallyConsistent,
  TextAnchor,
  TextAnchorFields,
  TextAnchorWidthCheck,
} from "@beep/text/TextAnchor";
import * as Arbitrary from "effect/Arbitrary";
import { dual, identity } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Confidence } from "../Confidence.ts";

const $I = $EpistemicsId.create("EvidenceSpan/EvidenceSpan.model");
const textAnchorEquivalent = S.toEquivalence(TextAnchor);

/**
 * Maximum UTF-16 code-unit length retained by one evidence quote.
 *
 * **Example** (Log max quote length)
 *
 * ```ts
 * import { EVIDENCE_SPAN_QUOTE_MAX_LENGTH } from "@beep/epistemics/EvidenceSpan"
 *
 * console.log(EVIDENCE_SPAN_QUOTE_MAX_LENGTH) // 65536
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EVIDENCE_SPAN_QUOTE_MAX_LENGTH = 65_536;

const EvidenceSpanQuote = TextAnchorFields.quote
  .check(
    S.isMaxLength(
      EVIDENCE_SPAN_QUOTE_MAX_LENGTH,
      $I.annote("EvidenceSpanQuoteMaximumLengthCheck", {
        title: "Evidence Span Quote Maximum Length",
        description: "Checks that an evidence quote fits within one bounded 65,536-code-unit source-text page.",
        message: "Expected evidence quote to contain at most 65,536 UTF-16 code units.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("EvidenceSpanQuote", {
      description: "Non-empty exact evidence quote bounded to one 65,536-code-unit source-text page.",
    })
  );

class EvidenceSpanStruct extends S.Opaque<EvidenceSpanStruct, { readonly brand: unique symbol }>()(
  S.Struct({
    ...TextAnchorFields,
    confidence: Confidence.annotateKey({ description: "Extraction confidence in the unit interval [0, 1]." }),
    quote: EvidenceSpanQuote,
  }).pipe(
    $I.annoteSchema("EvidenceSpanStruct", {
      description: "Internal structural base for a text anchor and its extraction confidence.",
    })
  )
) {}

const EvidenceSpanSchema = EvidenceSpanStruct.mapFields(identity).check(TextAnchorWidthCheck);

/**
 * Char-offset evidence span: the exact quoted source text and its start/end
 * character offsets, with an extraction confidence. Structurally it is a
 * `@beep/text` `TextAnchor` (offset fields spread from `TextAnchorFields`)
 * plus a `Confidence` — the confidence is the epistemic judgement layered on top
 * of the pure provenance anchor.
 *
 * **Example** (Decode evidence span)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { EvidenceSpan } from "@beep/epistemics/EvidenceSpan"
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
export class EvidenceSpan extends S.Opaque<EvidenceSpan, { readonly brand: unique symbol }>()(
  EvidenceSpanSchema.pipe(
    $I.annoteSchema("EvidenceSpan", {
      description: "Char-offset evidence span wrapping a @beep/text TextAnchor with an extraction confidence.",
    })
  )
) {
  /**
   * Whether the span is internally consistent before source-text re-slicing:
   * non-empty range, non-empty quote, and quote length matching the range width.
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly isInternallyConsistent = (span: EvidenceSpan): boolean => isTextAnchorInternallyConsistent(span);

  /**
   * Whether a provenance anchor names the exact offsets and quote carried by
   * this evidence span. Extraction confidence is intentionally not part of the
   * provenance anchor.
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly matchesAnchor: {
    (span: EvidenceSpan, anchor: TextAnchor): boolean;
    (anchor: TextAnchor): (span: EvidenceSpan) => boolean;
  } = dual(2, (span: EvidenceSpan, anchor: TextAnchor): boolean =>
    textAnchorEquivalent(
      TextAnchor.make({
        endChar: span.endChar,
        quote: span.quote,
        startChar: span.startChar,
      }),
      anchor
    )
  );
}

/**
 * Whether an evidence span is internally consistent before source-text re-slicing.
 *
 * **Example** (Check span consistency)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Confidence } from "@beep/epistemics/Confidence"
 * import { EvidenceSpan, isEvidenceSpanInternallyConsistent } from "@beep/epistemics/EvidenceSpan"
 *
 * const span = EvidenceSpan.make({
 *   startChar: S.Natural.make(0),
 *   endChar: S.Natural.make(12),
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

/**
 * Native generator preserving the cross-field invariants of EvidenceSpan.
 *
 * **Example** (Sample a valid value)
 *
 * ```ts
 * import { EvidenceSpanArbitrary } from "@beep/epistemics/EvidenceSpan"
 * import * as Arbitrary from "effect/Arbitrary"
 *
 * const sample = Arbitrary.sampleEffect(EvidenceSpanArbitrary, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const EvidenceSpanArbitrary = Arbitrary.schema(
  S.Struct({
    startChar: S.Int.check(S.isBetween({ minimum: 0, maximum: 10_000 })),
    quote: EvidenceSpanQuote,
    confidence: Confidence,
  })
).pipe(
  Arbitrary.map(({ startChar, quote, confidence }) =>
    EvidenceSpan.make({
      startChar: S.Natural.make(startChar),
      endChar: S.Natural.make(startChar + Str.length(quote)),
      quote,
      confidence,
    })
  )
);
