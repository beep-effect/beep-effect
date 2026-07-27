/**
 * Law-practice value-object export surface.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

/**
 * Annotation-citation value-object exports.
 *
 * @example
 * ```ts
 * import { AnnotationCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./AnnotationCitation/index.ts";
/**
 * Patent application number value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ApplicationNumber/index.ts";
/**
 * Canon-citation value-object exports.
 *
 * @example
 * ```ts
 * import { CanonCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CanonCitation/index.ts";
/**
 * Case-group value-object exports.
 *
 * @example
 * ```ts
 * import { CaseGroup } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CaseGroup/index.ts";
/**
 * Citation value-object exports (the tagged-union `Citation`, its full/short-form
 * unions, and the recursive `Parenthetical` + case/id/supra/short-form members).
 *
 * @example
 * ```ts
 * import { Citation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Citation/index.ts";
/**
 * Citation-base value-object exports.
 *
 * @example
 * ```ts
 * import { CitationBase } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CitationBase/index.ts";
/**
 * Citation-id value-object exports.
 *
 * @example
 * ```ts
 * import { CitationId } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CitationId/index.ts";
/**
 * Citation-signal value-object exports.
 *
 * @example
 * ```ts
 * import { CitationSignal } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CitationSignal/index.ts";
/**
 * Citation-type value-object exports.
 *
 * @example
 * ```ts
 * import { CitationType } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CitationType/index.ts";
/**
 * Citation-warning value-object exports.
 *
 * @example
 * ```ts
 * import { CitationWarning } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CitationWarning/index.ts";
/**
 * Component-span value-object exports.
 *
 * @example
 * ```ts
 * import { CaseComponentSpan } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ComponentSpan/index.ts";
/**
 * Constitutional-citation value-object exports.
 *
 * @example
 * ```ts
 * import { ConstitutionalCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ConstitutionalCitation/index.ts";
/**
 * Context-options value-object exports.
 *
 * @example
 * ```ts
 * import { ContextOptions } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ContextOptions/index.ts";
/**
 * Court-inference value-object exports.
 *
 * @example
 * ```ts
 * import { CourtInference } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./CourtInference/index.ts";
/**
 * Docket-citation value-object exports.
 *
 * @example
 * ```ts
 * import { DocketCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./DocketCitation/index.ts";
/**
 * Durable-locator value-object exports.
 *
 * @example
 * ```ts
 * import { DurableLocator } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./DurableLocator/index.ts";
/**
 * Durable-locator-options value-object exports.
 *
 * @example
 * ```ts
 * import { DurableLocatorOptions } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./DurableLocatorOptions/index.ts";
/**
 * Federal-register-citation value-object exports.
 *
 * @example
 * ```ts
 * import { FederalRegisterCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./FederalRegisterCitation/index.ts";
/**
 * Federal-rule-citation value-object exports.
 *
 * @example
 * ```ts
 * import { FederalRuleCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./FederalRuleCitation/index.ts";
/**
 * Footnote namespace module export.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { Footnote } from "@beep/law-practice-domain";
 *
 * const footnoteMap: Footnote.FootnoteMap =
 *   Footnote.detectTextFootnotes("Body\n----------\n1. See Smith v. Jones.");
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Footnote/index.ts";
/**
 * Full-citation-type value-object exports.
 *
 * @example
 * ```ts
 * import { FullCitationType } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./FullCitationType/index.ts";
/**
 * History-chain value-object exports.
 *
 * @example
 * ```ts
 * import { HistoryChain } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./HistoryChain/index.ts";
/**
 * History-link value-object exports.
 *
 * @example
 * ```ts
 * import { HistoryLink } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./HistoryLink/index.ts";
/**
 * History-signal value-object exports.
 *
 * @example
 * ```ts
 * import { HistorySignal } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./HistorySignal/index.ts";
/**
 * Journal-citation value-object exports.
 *
 * @example
 * ```ts
 * import { JournalCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./JournalCitation/index.ts";
/**
 * Practice knowledge-graph edge-predicate exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./KgEdgePredicate/index.ts";
/**
 * Practice knowledge-graph node-kind exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./KgNodeKind/index.ts";
/**
 * WIPO ST.16 kind code value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./KindCode/index.ts";
/**
 * Legislative-material-citation value-object exports.
 *
 * @example
 * ```ts
 * import { LegislativeMaterialCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./LegislativeMaterialCitation/index.ts";
/**
 * Local-ordinance-citation value-object exports.
 *
 * @example
 * ```ts
 * import { LocalOrdinanceCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./LocalOrdinanceCitation/index.ts";
/**
 * Neutral-citation value-object exports.
 *
 * @example
 * ```ts
 * import { NeutralCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./NeutralCitation/index.ts";
/**
 * WIPO ST.3 office code value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./OfficeCode/index.ts";
/**
 * Parallel-group value-object exports.
 *
 * @example
 * ```ts
 * import { ParallelGroup } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ParallelGroup/index.ts";
/**
 * Parenthetical-type value-object exports.
 *
 * @example
 * ```ts
 * import { ParentheticalType } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ParentheticalType/index.ts";
/**
 * Canonical patent document triplet value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PatentDocumentTriplet/index.ts";
/**
 * Patent metadata value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PatentMetadata/index.ts";
/**
 * WIPO ST.6 patent number value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PatentNumber/index.ts";
/**
 * Patent office metadata value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PatentOffice/index.ts";
/**
 * Pincite value-object exports.
 *
 * @example
 * ```ts
 * import { PinciteInfo } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PinciteInfo/index.ts";
/**
 * Public-law-citation value-object exports.
 *
 * @example
 * ```ts
 * import { PublicLawCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./PublicLawCitation/index.ts";
/**
 * Regulation-citation value-object exports.
 *
 * @example
 * ```ts
 * import { RegulationCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./RegulationCitation/index.ts";
/**
 * Resolution-result value-object exports.
 *
 * @example
 * ```ts
 * import { ResolutionResult } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ResolutionResult/index.ts";
/**
 * Restatement-citation value-object exports.
 *
 * @example
 * ```ts
 * import { RestatementCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./RestatementCitation/index.ts";
/**
 * Segment value-object exports.
 *
 * @example
 * ```ts
 * import { Segment } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Segment/index.ts";
/**
 * Segment map value-object exports.
 *
 * @example
 * ```ts
 * import { SegmentMap } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./SegmentMap/index.ts";
/**
 * Lawyer seniority tier value-object exports.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./SeniorityTier/index.ts";
/**
 * Session-law-citation value-object exports.
 *
 * @example
 * ```ts
 * import { SessionLawCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./SessionLawCitation/index.ts";
/**
 * Short-form-citation-type value-object exports.
 *
 * @example
 * ```ts
 * import { ShortFormCitationType } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ShortFormCitationType/index.ts";
/**
 * Span value-object exports.
 *
 * @example
 * ```ts
 * import { Span } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./Span/index.ts";
/**
 * State-rule-citation value-object exports.
 *
 * @example
 * ```ts
 * import { StateRuleCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./StateRuleCitation/index.ts";
/**
 * Statute-citation value-object exports.
 *
 * @example
 * ```ts
 * import { StatuteCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./StatuteCitation/index.ts";
/**
 * Statutes-at-large-citation value-object exports.
 *
 * @example
 * ```ts
 * import { StatutesAtLargeCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./StatutesAtLargeCitation/index.ts";
/**
 * String-citation-group value-object exports.
 *
 * @example
 * ```ts
 * import { StringCitationGroup } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./StringCitationGroup/index.ts";
/**
 * Structured-date value-object exports.
 *
 * @example
 * ```ts
 * import { StructuredDate } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./StructuredDate/index.ts";
/**
 * Subsequent-history-entry value-object exports.
 *
 * @example
 * ```ts
 * import { SubsequentHistoryEntry } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./SubsequentHistoryEntry/index.ts";
/**
 * Surrounding-context value-object exports.
 *
 * @example
 * ```ts
 * import { SurroundingContext } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./SurroundingContext/index.ts";
/**
 * Treatise-citation value-object exports.
 *
 * @example
 * ```ts
 * import { TreatiseCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./TreatiseCitation/index.ts";
/**
 * Treaty-citation value-object exports.
 *
 * @example
 * ```ts
 * import { TreatyCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./TreatyCitation/index.ts";
