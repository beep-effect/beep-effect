/**
 * Component-span value objects that locate the sub-parts of a parsed legal
 * citation within the source text.
 *
 * The remaining provisional extension kinds each have a dedicated
 * schema whose fields are optional {@link Span}s — one per recognized
 * component (reporter, page, section, year, ...). A field is present only when
 * the parser identified that component, so every field is modeled as
 * `Option<Span>` with a `None` constructor default.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Span } from "../Span/index.ts";

const $I = $LawPracticeDomainId.create("values/ComponentSpan/ComponentSpan.models");

/** Optional {@link Span} field: a missing key decodes to `None`, default `None`. */
const OptionFromOptionalSpan = Span.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

/**
 * Component spans for constitutional citations (type: `constitutional`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make constitutional component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ConstitutionalComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = ConstitutionalComponentSpan.make({
 *   amendment: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(5),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(5),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.amendment)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConstitutionalComponentSpan extends S.Opaque<
  ConstitutionalComponentSpan,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    jurisdiction: OptionFromOptionalSpan,
    article: OptionFromOptionalSpan,
    amendment: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    clause: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
    currentLocation: OptionFromOptionalSpan.annotateKey({
      description: "Span of the `(now …)` post-reform parenthetical, when present (#789).",
    }),
  }).pipe(
    $I.annoteSchema("ConstitutionalComponentSpan", {
      description: 'Component spans for constitutional citations (type: "constitutional").',
    })
  )
) {}

/**
 * Companion namespace for `ConstitutionalComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { ConstitutionalComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof ConstitutionalComponentSpan.Encoded = "amendment"
 * console.log(component) // "amendment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ConstitutionalComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link ConstitutionalComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { ConstitutionalComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = ConstitutionalComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ConstitutionalComponentSpan.Encoded;
}

/**
 * Component spans for neutral citations (type: `neutral`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make neutral component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NeutralComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = NeutralComponentSpan.make({
 *   documentNumber: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(3),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(3),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.documentNumber)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NeutralComponentSpan extends S.Opaque<NeutralComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    year: OptionFromOptionalSpan,
    court: OptionFromOptionalSpan,
    documentNumber: OptionFromOptionalSpan,
    pincite: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("NeutralComponentSpan", {
      description: 'Component spans for neutral citations (type: "neutral").',
    })
  )
) {}

/**
 * Companion namespace for `NeutralComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { NeutralComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof NeutralComponentSpan.Encoded = "documentNumber"
 * console.log(component) // "documentNumber"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace NeutralComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link NeutralComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { NeutralComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = NeutralComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof NeutralComponentSpan.Encoded;
}

/**
 * Component spans for public law citations (type: `publicLaw`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make public law component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PublicLawComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = PublicLawComponentSpan.make({
 *   lawNumber: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(6),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(6),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.lawNumber)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicLawComponentSpan extends S.Opaque<PublicLawComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    congress: OptionFromOptionalSpan,
    lawNumber: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("PublicLawComponentSpan", {
      description: 'Component spans for public law citations (type: "publicLaw").',
    })
  )
) {}

/**
 * Companion namespace for `PublicLawComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { PublicLawComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof PublicLawComponentSpan.Encoded = "lawNumber"
 * console.log(component) // "lawNumber"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PublicLawComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link PublicLawComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { PublicLawComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = PublicLawComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof PublicLawComponentSpan.Encoded;
}

/**
 * Component spans for federal register citations (type: `federalRegister`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make federal register spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FederalRegisterComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = FederalRegisterComponentSpan.make({
 *   page: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(5),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(5),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.page)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FederalRegisterComponentSpan extends S.Opaque<
  FederalRegisterComponentSpan,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    volume: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("FederalRegisterComponentSpan", {
      description: 'Component spans for federal register citations (type: "federalRegister").',
    })
  )
) {}

/**
 * Companion namespace for `FederalRegisterComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { FederalRegisterComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof FederalRegisterComponentSpan.Encoded = "volume"
 * console.log(component) // "volume"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FederalRegisterComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link FederalRegisterComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { FederalRegisterComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = FederalRegisterComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof FederalRegisterComponentSpan.Encoded;
}

/**
 * Component spans for statutes at large citations (type: `statutesAtLarge`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make statutes at large spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Span, StatutesAtLargeComponentSpan } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = StatutesAtLargeComponentSpan.make({
 *   page: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(4),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(4),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.page)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatutesAtLargeComponentSpan extends S.Opaque<
  StatutesAtLargeComponentSpan,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    volume: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("StatutesAtLargeComponentSpan", {
      description: 'Component spans for statutes at large citations (type: "statutesAtLarge").',
    })
  )
) {}

/**
 * Companion namespace for `StatutesAtLargeComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { StatutesAtLargeComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof StatutesAtLargeComponentSpan.Encoded = "page"
 * console.log(component) // "page"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StatutesAtLargeComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link StatutesAtLargeComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { StatutesAtLargeComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = StatutesAtLargeComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StatutesAtLargeComponentSpan.Encoded;
}

/**
 * Component spans for federal rule citations (type: `federalRule`). #576
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make federal rule component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FederalRuleComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = FederalRuleComponentSpan.make({
 *   rule: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(2),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(2),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.rule)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FederalRuleComponentSpan extends S.Opaque<FederalRuleComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    ruleSet: OptionFromOptionalSpan,
    rule: OptionFromOptionalSpan,
    subsection: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("FederalRuleComponentSpan", {
      description: 'Component spans for federal rule citations (type: "federalRule").',
    })
  )
) {}

/**
 * Companion namespace for `FederalRuleComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { FederalRuleComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof FederalRuleComponentSpan.Encoded = "ruleSet"
 * console.log(component) // "ruleSet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FederalRuleComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link FederalRuleComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { FederalRuleComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = FederalRuleComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof FederalRuleComponentSpan.Encoded;
}

/**
 * Component spans for Restatement citations (type: `restatement`). #578
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make Restatement component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RestatementComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = RestatementComponentSpan.make({
 *   section: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(3),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(3),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.section)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RestatementComponentSpan extends S.Opaque<RestatementComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    edition: OptionFromOptionalSpan,
    subject: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    subsection: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("RestatementComponentSpan", {
      description: 'Component spans for Restatement citations (type: "restatement").',
    })
  )
) {}

/**
 * Companion namespace for `RestatementComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { RestatementComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof RestatementComponentSpan.Encoded = "subject"
 * console.log(component) // "subject"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RestatementComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link RestatementComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { RestatementComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = RestatementComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RestatementComponentSpan.Encoded;
}

/**
 * Component spans for treatise citations (type: `treatise`). #579
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make treatise component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Span, TreatiseComponentSpan } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = TreatiseComponentSpan.make({
 *   section: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(3),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(3),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.section)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TreatiseComponentSpan extends S.Opaque<TreatiseComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    volume: OptionFromOptionalSpan,
    title: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("TreatiseComponentSpan", {
      description: 'Component spans for treatise citations (type: "treatise").',
    })
  )
) {}

/**
 * Companion namespace for `TreatiseComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { TreatiseComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof TreatiseComponentSpan.Encoded = "title"
 * console.log(component) // "title"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TreatiseComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link TreatiseComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { TreatiseComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = TreatiseComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TreatiseComponentSpan.Encoded;
}

/**
 * Component spans for A.L.R. annotation citations (type: `annotation`). #581
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make annotation component spans)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AnnotationComponentSpan, Span } from "@beep/law-practice-domain"
 * import * as O from "effect/Option"
 *
 * const spans = AnnotationComponentSpan.make({
 *   series: O.some(
 *     Span.make({
 *       cleanStart: S.Natural.make(0),
 *       cleanEnd: S.Natural.make(5),
 *       originalStart: S.Natural.make(0),
 *       originalEnd: S.Natural.make(5),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.series)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotationComponentSpan extends S.Opaque<AnnotationComponentSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    volume: OptionFromOptionalSpan,
    series: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  }).pipe(
    $I.annoteSchema("AnnotationComponentSpan", {
      description: 'Component spans for A.L.R. annotation citations (type: "annotation").',
    })
  )
) {}

/**
 * Companion namespace for `AnnotationComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { AnnotationComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof AnnotationComponentSpan.Encoded = "series"
 * console.log(component) // "series"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AnnotationComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link AnnotationComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { AnnotationComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = AnnotationComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AnnotationComponentSpan.Encoded;
}
