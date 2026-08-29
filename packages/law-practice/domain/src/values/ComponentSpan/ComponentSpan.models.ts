/**
 * Component-span value objects that locate the sub-parts of a parsed legal
 * citation within the source text.
 *
 * Each citation kind (case, statute, constitutional, ...) has a dedicated
 * schema whose fields are optional {@link Span}s — one per recognized
 * component (reporter, page, section, year, ...). A field is present only when
 * the parser identified that component, so every field is modeled as
 * `Option<Span>` with a `None` constructor default.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { Span } from "../Span/index.ts";

const $I = $LawPracticeDomainId.create("values/ComponentSpan/ComponentSpan.models");

/** Optional {@link Span} field: a missing key decodes to `None`, default `None`. */
const OptionFromOptionalSpan = Span.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

/**
 * Component spans for case citations (type: `case`).
 *
 * **Details**
 *
 * Containment: when both `metadataParenthetical` and `court`/`year` are present,
 * `court` and `year` are sub-ranges within `metadataParenthetical`. Consumers
 * rendering highlights should use either the parent or child spans, not both.
 *
 * **Example** (Make case component spans)
 *
 * ```ts
 * import { CaseComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = CaseComponentSpan.make({
 *   caseName: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(12),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(12),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.caseName)) // true
 * console.log(O.isNone(spans.reporter)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaseComponentSpan extends S.Class<CaseComponentSpan>($I`CaseComponentSpan`)(
  {
    caseName: OptionFromOptionalSpan,
    plaintiff: OptionFromOptionalSpan,
    defendant: OptionFromOptionalSpan,
    volume: OptionFromOptionalSpan,
    reporter: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    pincite: OptionFromOptionalSpan,
    court: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
    metadataParenthetical: OptionFromOptionalSpan,
  },
  $I.annote("CaseComponentSpan", {
    description: 'Component spans for case citations (type: "case").',
  })
) {}

/**
 * Companion namespace for `CaseComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { CaseComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof CaseComponentSpan.Encoded = "reporter"
 * console.log(component) // "reporter"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CaseComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link CaseComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { CaseComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = CaseComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CaseComponentSpan.Encoded;
}

/**
 * Component spans for statute citations (type: `statute`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make statute component spans)
 *
 * ```ts
 * import { Span, StatuteComponentSpan } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = StatuteComponentSpan.make({
 *   section: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(4),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(4),
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
export class StatuteComponentSpan extends S.Class<StatuteComponentSpan>($I`StatuteComponentSpan`)(
  {
    title: OptionFromOptionalSpan,
    code: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    subsection: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("StatuteComponentSpan", {
    description: 'Component spans for statute citations (type: "statute").',
  })
) {}

/**
 * Companion namespace for `StatuteComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { StatuteComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof StatuteComponentSpan.Encoded = "section"
 * console.log(component) // "section"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StatuteComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link StatuteComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { StatuteComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = StatuteComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StatuteComponentSpan.Encoded;
}

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
 * import { ConstitutionalComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = ConstitutionalComponentSpan.make({
 *   amendment: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(5),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(5),
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
export class ConstitutionalComponentSpan extends S.Class<ConstitutionalComponentSpan>($I`ConstitutionalComponentSpan`)(
  {
    jurisdiction: OptionFromOptionalSpan,
    article: OptionFromOptionalSpan,
    amendment: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    clause: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
    currentLocation: OptionFromOptionalSpan.annotateKey({
      description: "Span of the `(now …)` post-reform parenthetical, when present (#789).",
    }),
  },
  $I.annote("ConstitutionalComponentSpan", {
    description: 'Component spans for constitutional citations (type: "constitutional").',
  })
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
 * Component spans for journal citations (type: `journal`).
 *
 * **Details**
 *
 * Note: `signal` is included for future extensibility but is currently only
 * populated for case citations.
 *
 * **Example** (Make journal component spans)
 *
 * ```ts
 * import { JournalComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = JournalComponentSpan.make({
 *   journal: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(8),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(8),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.journal)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JournalComponentSpan extends S.Class<JournalComponentSpan>($I`JournalComponentSpan`)(
  {
    volume: OptionFromOptionalSpan,
    journal: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    pincite: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("JournalComponentSpan", {
    description: 'Component spans for journal citations (type: "journal").',
  })
) {}

/**
 * Companion namespace for `JournalComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { JournalComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof JournalComponentSpan.Encoded = "journal"
 * console.log(component) // "journal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace JournalComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link JournalComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { JournalComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = JournalComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof JournalComponentSpan.Encoded;
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
 * import { NeutralComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = NeutralComponentSpan.make({
 *   documentNumber: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(3),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(3),
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
export class NeutralComponentSpan extends S.Class<NeutralComponentSpan>($I`NeutralComponentSpan`)(
  {
    year: OptionFromOptionalSpan,
    court: OptionFromOptionalSpan,
    documentNumber: OptionFromOptionalSpan,
    pincite: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("NeutralComponentSpan", {
    description: 'Component spans for neutral citations (type: "neutral").',
  })
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
 * Component spans for Id./Ibid. citations (type: `id`).
 *
 * **Example** (Make Id component spans)
 *
 * ```ts
 * import { IdComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = IdComponentSpan.make({
 *   pincite: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(2),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(2),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.pincite)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdComponentSpan extends S.Class<IdComponentSpan>($I`IdComponentSpan`)(
  {
    pincite: OptionFromOptionalSpan,
  },
  $I.annote("IdComponentSpan", {
    description: 'Component spans for Id./Ibid. citations (type: "id").',
  })
) {}

/**
 * Companion namespace for `IdComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { IdComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof IdComponentSpan.Encoded = "pincite"
 * console.log(component) // "pincite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace IdComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link IdComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { IdComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = IdComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof IdComponentSpan.Encoded;
}

/**
 * Component spans for supra citations (type: `supra`).
 *
 * **Example** (Make supra component spans)
 *
 * ```ts
 * import { Span, SupraComponentSpan } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = SupraComponentSpan.make({
 *   pincite: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(2),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(2),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.pincite)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SupraComponentSpan extends S.Class<SupraComponentSpan>($I`SupraComponentSpan`)(
  {
    pincite: OptionFromOptionalSpan,
  },
  $I.annote("SupraComponentSpan", {
    description: 'Component spans for supra citations (type: "supra").',
  })
) {}

/**
 * Companion namespace for `SupraComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { SupraComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof SupraComponentSpan.Encoded = "pincite"
 * console.log(component) // "pincite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SupraComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link SupraComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { SupraComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = SupraComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SupraComponentSpan.Encoded;
}

/**
 * Component spans for short-form case citations (type: `shortFormCase`).
 *
 * **Example** (Make short-form case spans)
 *
 * ```ts
 * import { ShortFormCaseComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = ShortFormCaseComponentSpan.make({
 *   pincite: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(2),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(2),
 *     })
 *   ),
 * })
 *
 * console.log(O.isSome(spans.pincite)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShortFormCaseComponentSpan extends S.Class<ShortFormCaseComponentSpan>($I`ShortFormCaseComponentSpan`)(
  {
    pincite: OptionFromOptionalSpan,
  },
  $I.annote("ShortFormCaseComponentSpan", {
    description: 'Component spans for short-form case citations (type: "shortFormCase").',
  })
) {}

/**
 * Companion namespace for `ShortFormCaseComponentSpan`.
 *
 * **Example** (Encoded component key type)
 *
 * ```ts
 * import type { ShortFormCaseComponentSpan } from "@beep/law-practice-domain"
 *
 * const component: keyof ShortFormCaseComponentSpan.Encoded = "pincite"
 * console.log(component) // "pincite"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ShortFormCaseComponentSpan {
  /**
   * Wire-encoded representation of a decoded {@link ShortFormCaseComponentSpan}.
   *
   * **Example** (Alias encoded wire type)
   *
   * ```ts
   * import type { ShortFormCaseComponentSpan } from "@beep/law-practice-domain"
   *
   * type Wire = ShortFormCaseComponentSpan.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ShortFormCaseComponentSpan.Encoded;
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
 * import { PublicLawComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = PublicLawComponentSpan.make({
 *   lawNumber: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(6),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(6),
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
export class PublicLawComponentSpan extends S.Class<PublicLawComponentSpan>($I`PublicLawComponentSpan`)(
  {
    congress: OptionFromOptionalSpan,
    lawNumber: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("PublicLawComponentSpan", {
    description: 'Component spans for public law citations (type: "publicLaw").',
  })
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
 * import { FederalRegisterComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = FederalRegisterComponentSpan.make({
 *   page: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(5),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(5),
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
export class FederalRegisterComponentSpan extends S.Class<FederalRegisterComponentSpan>(
  $I`FederalRegisterComponentSpan`
)(
  {
    volume: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("FederalRegisterComponentSpan", {
    description: 'Component spans for federal register citations (type: "federalRegister").',
  })
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
 * import { Span, StatutesAtLargeComponentSpan } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = StatutesAtLargeComponentSpan.make({
 *   page: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(4),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(4),
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
export class StatutesAtLargeComponentSpan extends S.Class<StatutesAtLargeComponentSpan>(
  $I`StatutesAtLargeComponentSpan`
)(
  {
    volume: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("StatutesAtLargeComponentSpan", {
    description: 'Component spans for statutes at large citations (type: "statutesAtLarge").',
  })
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
 * import { FederalRuleComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = FederalRuleComponentSpan.make({
 *   rule: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(2),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(2),
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
export class FederalRuleComponentSpan extends S.Class<FederalRuleComponentSpan>($I`FederalRuleComponentSpan`)(
  {
    ruleSet: OptionFromOptionalSpan,
    rule: OptionFromOptionalSpan,
    subsection: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("FederalRuleComponentSpan", {
    description: 'Component spans for federal rule citations (type: "federalRule").',
  })
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
 * import { RestatementComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = RestatementComponentSpan.make({
 *   section: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(3),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(3),
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
export class RestatementComponentSpan extends S.Class<RestatementComponentSpan>($I`RestatementComponentSpan`)(
  {
    edition: OptionFromOptionalSpan,
    subject: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    subsection: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("RestatementComponentSpan", {
    description: 'Component spans for Restatement citations (type: "restatement").',
  })
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
 * import { Span, TreatiseComponentSpan } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = TreatiseComponentSpan.make({
 *   section: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(3),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(3),
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
export class TreatiseComponentSpan extends S.Class<TreatiseComponentSpan>($I`TreatiseComponentSpan`)(
  {
    volume: OptionFromOptionalSpan,
    title: OptionFromOptionalSpan,
    section: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("TreatiseComponentSpan", {
    description: 'Component spans for treatise citations (type: "treatise").',
  })
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
 * import { AnnotationComponentSpan, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const spans = AnnotationComponentSpan.make({
 *   series: O.some(
 *     Span.make({
 *       cleanStart: NonNegativeInt.make(0),
 *       cleanEnd: NonNegativeInt.make(5),
 *       originalStart: NonNegativeInt.make(0),
 *       originalEnd: NonNegativeInt.make(5),
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
export class AnnotationComponentSpan extends S.Class<AnnotationComponentSpan>($I`AnnotationComponentSpan`)(
  {
    volume: OptionFromOptionalSpan,
    series: OptionFromOptionalSpan,
    page: OptionFromOptionalSpan,
    year: OptionFromOptionalSpan,
    signal: OptionFromOptionalSpan,
  },
  $I.annote("AnnotationComponentSpan", {
    description: 'Component spans for A.L.R. annotation citations (type: "annotation").',
  })
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
