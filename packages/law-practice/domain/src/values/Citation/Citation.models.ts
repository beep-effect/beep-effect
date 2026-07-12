/**
 * Recursive citation cluster: the explanatory {@link Parenthetical} value
 * object, the case/id/supra/short-form citation subtypes, and the
 * {@link Citation}, {@link FullCitation}, and {@link ShortFormCitation} tagged
 * unions — ported from the eyecite `citation.ts` surface.
 *
 * Everything mutually recursive lives in this one module so the recursion
 * resolves through `S.suspend` without a cross-module import cycle: a
 * `Parenthetical` may nest child `Citation`s, and several citation subtypes
 * carry `Parenthetical`s of their own.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
// Tier-C citation subtypes participating in the Citation union.
import { AnnotationCitation } from "../AnnotationCitation/index.js";
import { CanonCitation } from "../CanonCitation/index.js";
import { CitationBase } from "../CitationBase/index.js";
import { CitationId } from "../CitationId/index.js";
import {
  CaseComponentSpan,
  IdComponentSpan,
  ShortFormCaseComponentSpan,
  SupraComponentSpan,
} from "../ComponentSpan/index.js";
import { ConstitutionalCitation } from "../ConstitutionalCitation/index.js";
import { CourtInference } from "../CourtInference/index.js";
import { DocketCitation } from "../DocketCitation/index.js";
import { FederalRegisterCitation } from "../FederalRegisterCitation/index.js";
import { FederalRuleCitation } from "../FederalRuleCitation/index.js";
import { HistoryChain } from "../HistoryChain/index.js";
import { HistorySignal } from "../HistorySignal/index.js";
import { JournalCitation } from "../JournalCitation/index.js";
import { LegislativeMaterialCitation } from "../LegislativeMaterialCitation/index.js";
import { LocalOrdinanceCitation } from "../LocalOrdinanceCitation/index.js";
import { NeutralCitation } from "../NeutralCitation/index.js";
import { ParallelGroup } from "../ParallelGroup/index.js";
import { ParentheticalType } from "../ParentheticalType/index.js";
import { PinciteInfo } from "../PinciteInfo/index.js";
import { PublicLawCitation } from "../PublicLawCitation/index.js";
import { RegulationCitation } from "../RegulationCitation/index.js";
import { RestatementCitation } from "../RestatementCitation/index.js";
import { SessionLawCitation } from "../SessionLawCitation/index.js";
import { Span } from "../Span/index.js";
import { StateRuleCitation } from "../StateRuleCitation/index.js";
import { StatuteCitation } from "../StatuteCitation/index.js";
import { StatutesAtLargeCitation } from "../StatutesAtLargeCitation/index.js";
import { SubsequentHistoryEntry } from "../SubsequentHistoryEntry/index.js";
import { TreatiseCitation } from "../TreatiseCitation/index.js";
import { TreatyCitation } from "../TreatyCitation/index.js";
import type * as O from "effect/Option";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.models");

/**
 * Child citations nested within an explanatory {@link Parenthetical} (#851).
 *
 * Kept as a standalone schema so the mutually-recursive `S.suspend` sits outside
 * the {@link Parenthetical} class base expression — referencing the {@link Citation}
 * union there would make the class's own base expression circular. The suspend
 * annotation names only the hand-written {@link Citation} namespace types for the
 * same reason (mirrors the `AdditionalPincites` pattern in `PinciteInfo`).
 */
const ParentheticalCitations = S.Array(S.suspend((): S.Codec<Citation.Type, Citation.Encoded> => Citation)).pipe(
  S.OptionFromOptionalKey,
  SchemaUtils.withNoneDefault,
  S.annotateKey({
    description:
      "Child citations nested within this explanatory parenthetical (#851); each carries its own CitationId, may be any citation type, and may itself carry parentheticals (recursive).",
  })
);

/**
 * An extracted explanatory parenthetical from a case citation.
 *
 * Not a citation subtype — it does not spread {@link CitationBase} and carries
 * no `type` discriminant of the citation family. Its `type` field is instead a
 * {@link ParentheticalType} signal-word classification. A parenthetical may nest
 * child {@link Citation}s (e.g. the `Doe v. City, 100 F.2d 1` in
 * `(quoting Doe v. City, 100 F.2d 1)`), so `citations` is a self/mutually
 * recursive field resolved through `S.suspend`.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Parenthetical } from "@beep/law-practice-domain"
 *
 * const parenthetical = Parenthetical.make({
 *   text: "holding that X requires Y",
 *   type: "holding",
 * })
 *
 * console.log(parenthetical.type) // "holding"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Parenthetical extends S.Class<Parenthetical>($I`Parenthetical`)(
  {
    text: S.String.annotateKey({
      description: "Full text content between the parentheses (excluding parens themselves).",
    }),
    type: ParentheticalType.annotateKey({
      description: "Signal-word classification based on leading gerund.",
    }),
    span: Span.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Position of full parenthetical block including delimiters.",
      })
    ),
    citations: ParentheticalCitations,
  },
  $I.annote("Parenthetical", {
    description: "An extracted explanatory parenthetical from a case citation.",
  })
) {}

/**
 * Companion namespace for `Parenthetical`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Parenthetical {
  /**
   * Decoded representation of a {@link Parenthetical}.
   *
   * Hand-written (rather than `typeof Parenthetical.Type`) so the mutually
   * recursive `citations` field can name {@link Citation.Type} through an
   * interface boundary without making the {@link Parenthetical} class base
   * expression circular.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { Parenthetical } from "@beep/law-practice-domain"
   *
   * type Decoded = Parenthetical.Type
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type {
    readonly citations: O.Option<ReadonlyArray<Citation.Type>>;
    readonly span: O.Option<Span>;
    readonly text: string;
    readonly type: ParentheticalType;
  }

  /**
   * Wire-encoded representation of a decoded {@link Parenthetical}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { Parenthetical } from "@beep/law-practice-domain"
   *
   * type Wire = Parenthetical.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
    readonly citations?: ReadonlyArray<Citation.Encoded>;
    readonly span?: typeof Span.Encoded;
    readonly text: string;
    readonly type: typeof ParentheticalType.Encoded;
  }
}

/**
 * A parsed full case citation (type: `case`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `case`
 * discriminant plus the volume/reporter/page anatomy of a reporter citation,
 * parallel-citation grouping, explanatory {@link Parenthetical}s, subsequent
 * procedural history, structured dates, party names, and the inferred court.
 * Only `volume` and `reporter` are required; every other own field is optional
 * and modeled as `Option` with a `None` constructor default because case-citation
 * forms vary widely across reporters and pinpoint styles.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FullCaseCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = FullCaseCitation.make({
 *   text: "410 U.S. 113",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(12),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(12),
 *   }),
 *   confidence: 1,
 *   matchedText: "410 U.S. 113",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   volume: NonNegativeInt.make(410),
 *   reporter: "U.S.",
 * })
 *
 * console.log(citation.type) // "case"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FullCaseCitation extends S.Class<FullCaseCitation>($I`FullCaseCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("case"),
    volume: S.Union([NonNegativeInt, S.String]).annotateKey({
      description: "Reporter volume number (numeric, or a string for non-numeric volumes).",
    }),
    reporter: S.String.annotateKey({
      description: "Reporter abbreviation.",
    }),
    page: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Page number — optional for blank page placeholder citations (e.g., "___" or "---").',
      })
    ),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Specific page reference within the cited authority.",
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote).",
      })
    ),
    court: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Court string as captured from the citation parenthetical.",
      })
    ),
    unpublished: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "True for citations whose source carried an unpublished-disposition marker. Set by NY Slip Op `(U)` / `[U]` suffix detection (#231). Absent or false for published decisions.",
      })
    ),
    normalizedCourt: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Normalized court string: spaces collapsed, trailing period ensured.",
      })
    ),
    year: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Year of decision as captured from the citation parenthetical.",
      })
    ),
    normalizedReporter: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Normalized reporter abbreviation from reporters-db (e.g., "F.2d" vs "F. 2d").',
      })
    ),
    groupId: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Group identifier for parallel citations (same case in multiple reporters), populated by Phase 8 (Parallel Linking). Format: ${volume}-${reporter}-${page} (e.g., "410-U.S.-113"); all citations in the same parallel group share it.',
      })
    ),
    parallelGroup: ParallelGroup.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Parallel-citation group (#850): all members (incl. self) by stable id, in document order. Survives consumer filter/sort/map.",
      })
    ),
    parallelCitations: S.Array(
      S.Struct({
        volume: S.Union([NonNegativeInt, S.String]),
        reporter: S.String,
        page: NonNegativeInt,
      })
    ).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Parallel citations for the same case in different reporters.",
      })
    ),
    parentheticals: S.Array(Parenthetical).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Explanatory parentheticals following the citation. Only populated when explanatory content is found (not court/year/disposition).",
      })
    ),
    subsequentHistoryEntries: S.Array(SubsequentHistoryEntry).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Subsequent history entries attached to this citation. Populated on every chain link that received a history clause from the scanner — not just the chain's root (#619). Each entry describes a procedural event (affirmed, reversed, etc.).",
      })
    ),
    historyChain: HistoryChain.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Ordered subsequent-history chain (root → latest), shared by every member of the chain (#849). Built in the structuring pass; references members by stable id.",
      })
    ),
    subsequentHistoryOf: S.Struct({
      index: NonNegativeInt,
      priorId: CitationId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      signal: HistorySignal,
    }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Back-pointer indicating this citation is a subsequent history citation. `index` is the parent's position in the results array returned by extractCitations() — it becomes invalid if the array is filtered or reordered.",
      })
    ),
    date: S.Struct({
      iso: S.String,
      parsed: S.Struct({
        year: NonNegativeInt,
        month: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
        day: NonNegativeInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
      }).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    }).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Date information in multiple formats. iso: ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ); parsed: structured date components.",
      })
    ),
    possibleInterpretations: S.Array(
      S.Struct({
        volume: S.Union([NonNegativeInt, S.String]),
        reporter: S.String,
        page: NonNegativeInt,
        confidence: S.Finite,
        reason: S.String,
      })
    ).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Alternative interpretations for ambiguous citations. Used when reporter abbreviation matches multiple reporters or format is unclear.",
      })
    ),
    fullSpan: Span.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Full span covering citation from case name through closing parenthetical, populated by Phase 6 (Full Span extraction).",
      })
    ),
    caseName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Extracted case name (party names around "v."), populated by Phase 6 (Full Span extraction).',
      })
    ),
    plaintiff: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Plaintiff party name (text before "v." or procedural prefix), populated by Phase 7 (Party Name extraction).',
      })
    ),
    defendant: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: 'Defendant party name (text after "v."), populated by Phase 7 (Party Name extraction).',
      })
    ),
    plaintiffNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Normalized plaintiff name for matching (lowercase, stripped of noise), populated by Phase 7 (Party Name extraction).",
      })
    ),
    defendantNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Normalized defendant name for matching (lowercase, stripped of noise), populated by Phase 7 (Party Name extraction).",
      })
    ),
    proceduralPrefix: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Procedural prefix for non-adversarial cases (e.g. "In re" from "In re Smith"), populated by Phase 7 (Party Name extraction).',
      })
    ),
    nominativeVolume: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Nominative (historical) reporter volume for early SCOTUS citations. Present only when the citation includes a nominative parenthetical, e.g., `67 U.S. (2 Black) 635` → 2.",
      })
    ),
    nominativeReporter: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Nominative (historical) reporter abbreviation for early SCOTUS citations. Present only when the citation includes a nominative parenthetical, e.g., `67 U.S. (2 Black) 635` → "Black".',
      })
    ),
    hasBlankPage: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'True when page position contains a blank placeholder ("___" or "---"), populated by Phase 5 (Blank Page support). When true, page is undefined and confidence is reduced to 0.8.',
      })
    ),
    disposition: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Disposition or procedural status from parenthetical, populated by Phase 6 (Complex Parentheticals). E.g., "en banc", "per curiam", "dissent", "concurrence", "mixed", "plurality opinion", "mem.".',
      })
    ),
    justices: S.Array(S.String).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Surname(s) of justice(s) attributed to the parenthetical disposition, populated for justice-attribution parens (#235) like `(Brennan, J., dissenting)` → ["Brennan"].',
      })
    ),
    scope: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Scope qualifier from a justice-attribution parenthetical (#235): in_judgment, in_part, or from_denial.",
      })
    ),
    adminParenthetical: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          'Administrative parenthetical from a bankruptcy adversary caption (#241). Content is the parenthetical text without the surrounding parens — e.g., "In re Hintze".',
      })
    ),
    inferredCourt: CourtInference.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Court level/jurisdiction inferred from reporter series. Always populated independently of the parenthetical `court` field, via a curated static lookup table.",
      })
    ),
    spans: CaseComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Precise text positions for each parsed component of this citation.",
      })
    ),
  },
  $I.annote("FullCaseCitation", {
    description: 'A parsed full case citation (type: "case").',
  })
) {}

/**
 * Companion namespace for `FullCaseCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace FullCaseCitation {
  /**
   * Wire-encoded representation of a decoded {@link FullCaseCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { FullCaseCitation } from "@beep/law-practice-domain"
   *
   * type Wire = FullCaseCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  /**
   * Decoded representation of a {@link FullCaseCitation}.
   *
   * Hand-written so the mutually recursive `parentheticals` field can name
   * {@link Parenthetical.Type} through an interface boundary without making the
   * class base expression circular.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends CitationBase {
    readonly adminParenthetical: O.Option<string>;
    readonly caseName: O.Option<string>;
    readonly court: O.Option<string>;
    readonly date: O.Option<{
      readonly iso: string;
      readonly parsed: O.Option<{
        readonly year: NonNegativeInt;
        readonly month: O.Option<NonNegativeInt>;
        readonly day: O.Option<NonNegativeInt>;
      }>;
    }>;
    readonly defendant: O.Option<string>;
    readonly defendantNormalized: O.Option<string>;
    readonly disposition: O.Option<string>;
    readonly fullSpan: O.Option<Span>;
    readonly groupId: O.Option<string>;
    readonly hasBlankPage: O.Option<boolean>;
    readonly historyChain: O.Option<HistoryChain>;
    readonly inferredCourt: O.Option<CourtInference>;
    readonly justices: O.Option<ReadonlyArray<string>>;
    readonly nominativeReporter: O.Option<string>;
    readonly nominativeVolume: O.Option<NonNegativeInt>;
    readonly normalizedCourt: O.Option<string>;
    readonly normalizedReporter: O.Option<string>;
    readonly page: O.Option<NonNegativeInt>;
    readonly parallelCitations: O.Option<
      ReadonlyArray<{
        readonly volume: NonNegativeInt | string;
        readonly reporter: string;
        readonly page: NonNegativeInt;
      }>
    >;
    readonly parallelGroup: O.Option<ParallelGroup>;
    readonly parentheticals: O.Option<ReadonlyArray<Parenthetical.Type>>;
    readonly pincite: O.Option<NonNegativeInt>;
    readonly pinciteInfo: O.Option<PinciteInfo>;
    readonly plaintiff: O.Option<string>;
    readonly plaintiffNormalized: O.Option<string>;
    readonly possibleInterpretations: O.Option<
      ReadonlyArray<{
        readonly volume: NonNegativeInt | string;
        readonly reporter: string;
        readonly page: NonNegativeInt;
        readonly confidence: number;
        readonly reason: string;
      }>
    >;
    readonly proceduralPrefix: O.Option<string>;
    readonly reporter: string;
    readonly scope: O.Option<string>;
    readonly spans: O.Option<CaseComponentSpan>;
    readonly subsequentHistoryEntries: O.Option<ReadonlyArray<SubsequentHistoryEntry>>;
    readonly subsequentHistoryOf: O.Option<{
      readonly index: NonNegativeInt;
      readonly priorId: O.Option<CitationId>;
      readonly signal: HistorySignal;
    }>;
    readonly type: "case";
    readonly unpublished: O.Option<boolean>;
    readonly volume: NonNegativeInt | string;
    readonly year: O.Option<NonNegativeInt>;
  }

  /**
   * Wire-encoded representation of a decoded {@link FullCaseCitation}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends CitationBase.Encoded {
    readonly adminParenthetical?: string;
    readonly caseName?: string;
    readonly court?: string;
    readonly date?: {
      readonly iso: string;
      readonly parsed?: { readonly year: number; readonly month?: number; readonly day?: number };
    };
    readonly defendant?: string;
    readonly defendantNormalized?: string;
    readonly disposition?: string;
    readonly fullSpan?: typeof Span.Encoded;
    readonly groupId?: string;
    readonly hasBlankPage?: boolean;
    readonly historyChain?: typeof HistoryChain.Encoded;
    readonly inferredCourt?: typeof CourtInference.Encoded;
    readonly justices?: ReadonlyArray<string>;
    readonly nominativeReporter?: string;
    readonly nominativeVolume?: number;
    readonly normalizedCourt?: string;
    readonly normalizedReporter?: string;
    readonly page?: number;
    readonly parallelCitations?: ReadonlyArray<{
      readonly volume: number | string;
      readonly reporter: string;
      readonly page: number;
    }>;
    readonly parallelGroup?: typeof ParallelGroup.Encoded;
    readonly parentheticals?: ReadonlyArray<Parenthetical.Encoded>;
    readonly pincite?: number;
    readonly pinciteInfo?: PinciteInfo.Encoded;
    readonly plaintiff?: string;
    readonly plaintiffNormalized?: string;
    readonly possibleInterpretations?: ReadonlyArray<{
      readonly volume: number | string;
      readonly reporter: string;
      readonly page: number;
      readonly confidence: number;
      readonly reason: string;
    }>;
    readonly proceduralPrefix?: string;
    readonly reporter: string;
    readonly scope?: string;
    readonly spans?: typeof CaseComponentSpan.Encoded;
    readonly subsequentHistoryEntries?: ReadonlyArray<typeof SubsequentHistoryEntry.Encoded>;
    readonly subsequentHistoryOf?: {
      readonly index: number;
      readonly priorId?: string;
      readonly signal: typeof HistorySignal.Encoded;
    };
    readonly type: "case";
    readonly unpublished?: boolean;
    readonly volume: number | string;
    readonly year?: number;
  }
}

/**
 * A parsed `Id.` short-form citation (type: `id`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `id` discriminant.
 * Every own field is optional and modeled as `Option` with a `None` constructor
 * default: an `Id.` reference inherits most of its anatomy (pincite, party
 * names) from the antecedent citation it resolves to, and may carry a trailing
 * {@link Parenthetical}.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { IdCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = IdCitation.make({
 *   text: "Id. at 460",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(10),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(10),
 *   }),
 *   confidence: 1,
 *   matchedText: "Id. at 460",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "id"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IdCitation extends S.Class<IdCitation>($I`IdCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("id"),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Specific page reference within the cited authority.",
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote, star-pagination).",
      })
    ),
    pinciteInherited: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "True if `pincite` was inherited from a preceding same-authority citation per Bluebook Rule 4.1 / Indigo Book R6.2.2. Undefined when `pincite` was extracted directly from this citation's text or when no pincite was set.",
      })
    ),
    pinciteInheritedFrom: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Array index of the citation from which `pincite` was inherited, indexing into the same array this citation appears in. Set only when `pinciteInherited` is true; records the immediate predecessor.",
      })
    ),
    pinciteInheritedFromId: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Stable id of the `pinciteInheritedFrom` citation (#860). Survives consumer filter/sort/map (keys on identity, not array position).",
      })
    ),
    sectionPincite: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Section-style pincite locator captured from `Id. § 1983(c)` forms (#847) — the text after §/§§. Its presence marks the `Id.` as statute-family for antecedent selection; undefined for page/paragraph/bare `Id.` forms.",
      })
    ),
    parenthetical: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Trailing parenthetical content (text between the parens, excluding the parens themselves) captured from `Id. at N (...)` forms. Unclassified — consumers can post-classify if needed (#303).",
      })
    ),
    parentheticalNode: Parenthetical.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Structured form of `parenthetical` (#869) — same content, classified `type` and a `span`, plus any nested child citations in `citations`.",
      })
    ),
    caseName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Case name inherited from the antecedent (full citation that the `Id.` resolves to). Populated by the resolver when `resolve: true` and the antecedent is a `case`-type citation.",
      })
    ),
    plaintiff: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Inherited plaintiff name from antecedent (resolver-populated).",
      })
    ),
    defendant: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Inherited defendant name from antecedent (resolver-populated).",
      })
    ),
    plaintiffNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Inherited normalized plaintiff name from antecedent.",
      })
    ),
    defendantNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Inherited normalized defendant name from antecedent.",
      })
    ),
    proceduralPrefix: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Inherited procedural prefix (`In re`, `Estate of`, etc.) from antecedent.",
      })
    ),
    spans: IdComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component-level spans (currently just `pincite`; extend when needed).",
      })
    ),
  },
  $I.annote("IdCitation", {
    description: 'A parsed `Id.` short-form citation (type: "id").',
  })
) {}

/**
 * Companion namespace for `IdCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace IdCitation {
  /**
   * Wire-encoded representation of a decoded {@link IdCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { IdCitation } from "@beep/law-practice-domain"
   *
   * type Wire = IdCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  /**
   * Decoded representation of an {@link IdCitation}.
   *
   * Hand-written so the recursive `parentheticalNode` field can name
   * {@link Parenthetical.Type} through an interface boundary without making the
   * class base expression circular.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends CitationBase {
    readonly caseName: O.Option<string>;
    readonly defendant: O.Option<string>;
    readonly defendantNormalized: O.Option<string>;
    readonly parenthetical: O.Option<string>;
    readonly parentheticalNode: O.Option<Parenthetical.Type>;
    readonly pincite: O.Option<NonNegativeInt>;
    readonly pinciteInfo: O.Option<PinciteInfo>;
    readonly pinciteInherited: O.Option<boolean>;
    readonly pinciteInheritedFrom: O.Option<NonNegativeInt>;
    readonly pinciteInheritedFromId: O.Option<CitationId>;
    readonly plaintiff: O.Option<string>;
    readonly plaintiffNormalized: O.Option<string>;
    readonly proceduralPrefix: O.Option<string>;
    readonly sectionPincite: O.Option<string>;
    readonly spans: O.Option<IdComponentSpan>;
    readonly type: "id";
  }

  /**
   * Wire-encoded representation of a decoded {@link IdCitation}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends CitationBase.Encoded {
    readonly caseName?: string;
    readonly defendant?: string;
    readonly defendantNormalized?: string;
    readonly parenthetical?: string;
    readonly parentheticalNode?: Parenthetical.Encoded;
    readonly pincite?: number;
    readonly pinciteInfo?: PinciteInfo.Encoded;
    readonly pinciteInherited?: boolean;
    readonly pinciteInheritedFrom?: number;
    readonly pinciteInheritedFromId?: string;
    readonly plaintiff?: string;
    readonly plaintiffNormalized?: string;
    readonly proceduralPrefix?: string;
    readonly sectionPincite?: string;
    readonly spans?: typeof IdComponentSpan.Encoded;
    readonly type: "id";
  }
}

/**
 * A parsed `supra` short-form citation (type: `supra`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `supra`
 * discriminant. A `supra` reference points back to an earlier citation by party
 * name; every own field is optional and modeled as `Option` with a `None`
 * constructor default.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { SupraCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = SupraCitation.make({
 *   text: "Smith, supra, at 460",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(20),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(20),
 *   }),
 *   confidence: 1,
 *   matchedText: "Smith, supra, at 460",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 * })
 *
 * console.log(citation.type) // "supra"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SupraCitation extends S.Class<SupraCitation>($I`SupraCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("supra"),
    partyName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Party name extracted from citation text (undefined for standalone supra references).",
      })
    ),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Specific page reference.",
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote, star-pagination).",
      })
    ),
    pinciteInherited: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "True if `pincite` was inherited from a preceding same-authority citation per Bluebook Rule 4.1 / Indigo Book R6.2.2. Undefined when `pincite` was extracted directly from this citation's text or when no pincite was set.",
      })
    ),
    pinciteInheritedFrom: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Array index of the citation from which `pincite` was inherited, indexing into the same array this citation appears in. Set only when `pinciteInherited` is true; records the immediate predecessor.",
      })
    ),
    pinciteInheritedFromId: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Stable id of the `pinciteInheritedFrom` citation (#860). Survives consumer filter/sort/map (keys on identity, not array position).",
      })
    ),
    parenthetical: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Trailing parenthetical content (text between the parens, excluding the parens themselves). See IdCitation.parenthetical for common shapes and rationale (#303).",
      })
    ),
    parentheticalNode: Parenthetical.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Structured form of `parenthetical` (#869) — same content, classified `type` and a `span`, plus any nested child citations in `citations`.",
      })
    ),
    spans: SupraComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component-level spans (currently just `pincite`; extend when needed).",
      })
    ),
  },
  $I.annote("SupraCitation", {
    description: 'A parsed `supra` short-form citation (type: "supra").',
  })
) {}

/**
 * Companion namespace for `SupraCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SupraCitation {
  /**
   * Wire-encoded representation of a decoded {@link SupraCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { SupraCitation } from "@beep/law-practice-domain"
   *
   * type Wire = SupraCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  /**
   * Decoded representation of a {@link SupraCitation}.
   *
   * Hand-written so the recursive `parentheticalNode` field can name
   * {@link Parenthetical.Type} through an interface boundary without making the
   * class base expression circular.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends CitationBase {
    readonly parenthetical: O.Option<string>;
    readonly parentheticalNode: O.Option<Parenthetical.Type>;
    readonly partyName: O.Option<string>;
    readonly pincite: O.Option<NonNegativeInt>;
    readonly pinciteInfo: O.Option<PinciteInfo>;
    readonly pinciteInherited: O.Option<boolean>;
    readonly pinciteInheritedFrom: O.Option<NonNegativeInt>;
    readonly pinciteInheritedFromId: O.Option<CitationId>;
    readonly spans: O.Option<SupraComponentSpan>;
    readonly type: "supra";
  }

  /**
   * Wire-encoded representation of a decoded {@link SupraCitation}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends CitationBase.Encoded {
    readonly parenthetical?: string;
    readonly parentheticalNode?: Parenthetical.Encoded;
    readonly partyName?: string;
    readonly pincite?: number;
    readonly pinciteInfo?: PinciteInfo.Encoded;
    readonly pinciteInherited?: boolean;
    readonly pinciteInheritedFrom?: number;
    readonly pinciteInheritedFromId?: string;
    readonly spans?: typeof SupraComponentSpan.Encoded;
    readonly type: "supra";
  }
}

/**
 * A parsed short-form case citation (type: `shortFormCase`).
 *
 * Spreads the shared {@link CitationBase} fields and adds the `shortFormCase`
 * discriminant. An abbreviated reference to an earlier full citation,
 * distinguished from a full case by the lack of a case name. Only `volume` and
 * `reporter` are required; every other own field is optional and modeled as
 * `Option` with a `None` constructor default.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ShortFormCaseCitation, Span } from "@beep/law-practice-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const citation = ShortFormCaseCitation.make({
 *   text: "500 F.2d at 125",
 *   span: Span.make({
 *     cleanStart: NonNegativeInt.make(0),
 *     cleanEnd: NonNegativeInt.make(15),
 *     originalStart: NonNegativeInt.make(0),
 *     originalEnd: NonNegativeInt.make(15),
 *   }),
 *   confidence: 1,
 *   matchedText: "500 F.2d at 125",
 *   processTimeMs: 0,
 *   patternsChecked: NonNegativeInt.make(1),
 *   volume: NonNegativeInt.make(500),
 *   reporter: "F.2d",
 * })
 *
 * console.log(citation.type) // "shortFormCase"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShortFormCaseCitation extends S.Class<ShortFormCaseCitation>($I`ShortFormCaseCitation`)(
  {
    ...CitationBase.fields,
    type: S.tag("shortFormCase"),
    volume: S.Union([NonNegativeInt, S.String]).annotateKey({
      description: "Reporter volume number (numeric, or a string for non-numeric volumes).",
    }),
    reporter: S.String.annotateKey({
      description: "Reporter abbreviation.",
    }),
    page: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Page number of the referenced reporter citation.",
      })
    ),
    pincite: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Specific page reference within the cited authority.",
      })
    ),
    pinciteInfo: PinciteInfo.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Structured pincite information (page, range, footnote, star-pagination).",
      })
    ),
    pinciteInherited: S.Boolean.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "True if `pincite` was inherited from a preceding same-authority citation per Bluebook Rule 4.1 / Indigo Book R6.2.2. Undefined when `pincite` was extracted directly from this citation's text or when no pincite was set.",
      })
    ),
    pinciteInheritedFrom: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Array index of the citation from which `pincite` was inherited, indexing into the same array this citation appears in. Set only when `pinciteInherited` is true; records the immediate predecessor.",
      })
    ),
    pinciteInheritedFromId: CitationId.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Stable id of the `pinciteInheritedFrom` citation (#860). Survives consumer filter/sort/map (keys on identity, not array position).",
      })
    ),
    inferredCaseName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Case name inferred from prose preceding this short-form when no full citation in citations[] matched its vol+reporter. Populated by the resolver fallback. Consumers: prefer `caseName ?? inferredCaseName ?? partyName`.",
      })
    ),
    inferredPlaintiff: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Plaintiff side of the inferred case name.",
      })
    ),
    inferredDefendant: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Defendant side of the inferred case name.",
      })
    ),
    inferredCaseNameSpan: Span.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Span in original text where the inferred case name was found.",
      })
    ),
    spans: ShortFormCaseComponentSpan.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Component-level spans (currently just `pincite`; extend when needed).",
      })
    ),
    partyName: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Back-reference party name when the short-form includes one (Bluebook form: `Smith, 500 F.2d at 125`). Undefined when the short-form is bare `500 F.2d at 125`. Used by the resolver to disambiguate when multiple full citations share the same vol+reporter (#216).",
      })
    ),
    partyNameNormalized: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Normalized party name for resolver matching (lowercased, whitespace collapsed). Mirrors defendantNormalized/plaintiffNormalized on FullCaseCitation.",
      })
    ),
    groupId: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Parallel-reporter grouping shared group key (#884). Mirrors FullCaseCitation.groupId.",
      })
    ),
    parallelGroup: ParallelGroup.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Parallel-reporter group (#884): all members (incl. self) by id, in document order. Mirrors FullCaseCitation.parallelGroup.",
      })
    ),
    parallelCitations: S.Array(
      S.Struct({
        volume: S.Union([NonNegativeInt, S.String]),
        reporter: S.String,
        page: NonNegativeInt,
      })
    ).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Legacy flat copy of the parallel run on the primary short-form citation (#884).",
      })
    ),
    parenthetical: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Trailing parenthetical content (text between the parens, excluding the parens themselves). See IdCitation.parenthetical for common shapes and rationale (#303).",
      })
    ),
    parentheticalNode: Parenthetical.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description:
          "Structured form of `parenthetical` (#869) — same content, classified `type` and a `span`, plus any nested child citations in `citations`.",
      })
    ),
  },
  $I.annote("ShortFormCaseCitation", {
    description: 'A parsed short-form case citation (type: "shortFormCase").',
  })
) {}

/**
 * Companion namespace for `ShortFormCaseCitation`.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ShortFormCaseCitation {
  /**
   * Wire-encoded representation of a decoded {@link ShortFormCaseCitation}.
   *
   * **Example**
   *
   * @example
   * ```ts
   * import type { ShortFormCaseCitation } from "@beep/law-practice-domain"
   *
   * type Wire = ShortFormCaseCitation.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  /**
   * Decoded representation of a {@link ShortFormCaseCitation}.
   *
   * Hand-written so the recursive `parentheticalNode` field can name
   * {@link Parenthetical.Type} through an interface boundary without making the
   * class base expression circular.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Type extends CitationBase {
    readonly groupId: O.Option<string>;
    readonly inferredCaseName: O.Option<string>;
    readonly inferredCaseNameSpan: O.Option<Span>;
    readonly inferredDefendant: O.Option<string>;
    readonly inferredPlaintiff: O.Option<string>;
    readonly page: O.Option<NonNegativeInt>;
    readonly parallelCitations: O.Option<
      ReadonlyArray<{
        readonly volume: NonNegativeInt | string;
        readonly reporter: string;
        readonly page: NonNegativeInt;
      }>
    >;
    readonly parallelGroup: O.Option<ParallelGroup>;
    readonly parenthetical: O.Option<string>;
    readonly parentheticalNode: O.Option<Parenthetical.Type>;
    readonly partyName: O.Option<string>;
    readonly partyNameNormalized: O.Option<string>;
    readonly pincite: O.Option<NonNegativeInt>;
    readonly pinciteInfo: O.Option<PinciteInfo>;
    readonly pinciteInherited: O.Option<boolean>;
    readonly pinciteInheritedFrom: O.Option<NonNegativeInt>;
    readonly pinciteInheritedFromId: O.Option<CitationId>;
    readonly reporter: string;
    readonly spans: O.Option<ShortFormCaseComponentSpan>;
    readonly type: "shortFormCase";
    readonly volume: NonNegativeInt | string;
  }

  /**
   * Wire-encoded representation of a decoded {@link ShortFormCaseCitation}.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded extends CitationBase.Encoded {
    readonly groupId?: string;
    readonly inferredCaseName?: string;
    readonly inferredCaseNameSpan?: typeof Span.Encoded;
    readonly inferredDefendant?: string;
    readonly inferredPlaintiff?: string;
    readonly page?: number;
    readonly parallelCitations?: ReadonlyArray<{
      readonly volume: number | string;
      readonly reporter: string;
      readonly page: number;
    }>;
    readonly parallelGroup?: typeof ParallelGroup.Encoded;
    readonly parenthetical?: string;
    readonly parentheticalNode?: Parenthetical.Encoded;
    readonly partyName?: string;
    readonly partyNameNormalized?: string;
    readonly pincite?: number;
    readonly pinciteInfo?: PinciteInfo.Encoded;
    readonly pinciteInherited?: boolean;
    readonly pinciteInheritedFrom?: number;
    readonly pinciteInheritedFromId?: string;
    readonly reporter: string;
    readonly spans?: typeof ShortFormCaseComponentSpan.Encoded;
    readonly type: "shortFormCase";
    readonly volume: number | string;
  }
}

/**
 * Union type of all citation types.
 *
 * Discriminated on the `type` field, so downstream code can branch exhaustively
 * across every parsed legal-authority kind — full case, short-form, statute,
 * regulation, and the rest of the Tier-C family.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Citation } from "@beep/law-practice-domain"
 *
 * type AllCitations = typeof Citation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Citation = S.Union([
  FullCaseCitation,
  DocketCitation,
  StatuteCitation,
  RegulationCitation,
  JournalCitation,
  NeutralCitation,
  PublicLawCitation,
  FederalRegisterCitation,
  StatutesAtLargeCitation,
  ConstitutionalCitation,
  FederalRuleCitation,
  StateRuleCitation,
  RestatementCitation,
  TreatiseCitation,
  AnnotationCitation,
  SessionLawCitation,
  TreatyCitation,
  LegislativeMaterialCitation,
  LocalOrdinanceCitation,
  CanonCitation,
  IdCitation,
  SupraCitation,
  ShortFormCaseCitation,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Citation", {
    description: "Union type of all citation types.",
  })
);

/**
 * The decoded union of every citation type.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Citation } from "@beep/law-practice-domain"
 *
 * type AllCitations = typeof Citation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Citation = typeof Citation.Type;

/**
 * Companion namespace for {@link Citation}.
 *
 * The decoded and encoded shapes are named here so the mutually-recursive
 * {@link ParentheticalCitations} suspend can reference them without forcing the
 * {@link Parenthetical} class base expression to evaluate the {@link Citation}
 * union value (which would be circular).
 *
 * **Example**
 *
 * @example
 * ```ts
 * import type { Citation } from "@beep/law-practice-domain"
 *
 * type AllCitations = Citation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Citation {
  /**
   * Decoded union of every citation type.
   *
   * @since 0.0.0
   */
  export type Type =
    | FullCaseCitation.Type
    | DocketCitation
    | StatuteCitation
    | RegulationCitation
    | JournalCitation
    | NeutralCitation
    | PublicLawCitation
    | FederalRegisterCitation
    | StatutesAtLargeCitation
    | ConstitutionalCitation
    | FederalRuleCitation
    | StateRuleCitation
    | RestatementCitation
    | TreatiseCitation
    | AnnotationCitation
    | SessionLawCitation
    | TreatyCitation
    | LegislativeMaterialCitation
    | LocalOrdinanceCitation
    | CanonCitation
    | IdCitation.Type
    | SupraCitation.Type
    | ShortFormCaseCitation.Type;

  /**
   * Wire-encoded union of every citation type.
   *
   * @since 0.0.0
   */
  export type Encoded =
    | FullCaseCitation.Encoded
    | DocketCitation.Encoded
    | StatuteCitation.Encoded
    | RegulationCitation.Encoded
    | JournalCitation.Encoded
    | NeutralCitation.Encoded
    | PublicLawCitation.Encoded
    | FederalRegisterCitation.Encoded
    | StatutesAtLargeCitation.Encoded
    | ConstitutionalCitation.Encoded
    | FederalRuleCitation.Encoded
    | StateRuleCitation.Encoded
    | RestatementCitation.Encoded
    | TreatiseCitation.Encoded
    | AnnotationCitation.Encoded
    | SessionLawCitation.Encoded
    | TreatyCitation.Encoded
    | LegislativeMaterialCitation.Encoded
    | LocalOrdinanceCitation.Encoded
    | CanonCitation.Encoded
    | IdCitation.Encoded
    | SupraCitation.Encoded
    | ShortFormCaseCitation.Encoded;
}

/**
 * Union of all full citation types (not short-form references).
 *
 * Excludes the `id`, `supra`, and `shortFormCase` back-references, leaving only
 * the citation kinds that stand on their own as a complete authority.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FullCitation } from "@beep/law-practice-domain"
 *
 * type AllFullCitations = typeof FullCitation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FullCitation = S.Union([
  FullCaseCitation,
  SessionLawCitation,
  TreatyCitation,
  LegislativeMaterialCitation,
  LocalOrdinanceCitation,
  CanonCitation,
  DocketCitation,
  StatuteCitation,
  RegulationCitation,
  JournalCitation,
  NeutralCitation,
  PublicLawCitation,
  FederalRegisterCitation,
  StatutesAtLargeCitation,
  ConstitutionalCitation,
  FederalRuleCitation,
  StateRuleCitation,
  RestatementCitation,
  TreatiseCitation,
  AnnotationCitation,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("FullCitation", {
    description: "Union of all full citation types (not short-form references).",
  })
);

/**
 * The decoded union of every full (non-short-form) citation type.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { FullCitation } from "@beep/law-practice-domain"
 *
 * type AllFullCitations = typeof FullCitation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FullCitation = typeof FullCitation.Type;

/**
 * Union of all short-form citation types (Id., supra, short-form case).
 *
 * These are back-references to an earlier full citation rather than
 * free-standing authorities.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ShortFormCitation } from "@beep/law-practice-domain"
 *
 * type AllShortFormCitations = typeof ShortFormCitation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShortFormCitation = S.Union([IdCitation, SupraCitation, ShortFormCaseCitation]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("ShortFormCitation", {
    description: "Union of all short-form citation types (Id., supra, short-form case).",
  })
);

/**
 * The decoded union of every short-form citation type.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ShortFormCitation } from "@beep/law-practice-domain"
 *
 * type AllShortFormCitations = typeof ShortFormCitation.Type
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ShortFormCitation = typeof ShortFormCitation.Type;
