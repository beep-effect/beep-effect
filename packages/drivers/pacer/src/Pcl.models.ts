/**
 * Schema-first request/response models for the PACER Case Locator (PCL) API
 * synchronous search endpoints (`/cases/find`, `/parties/find`).
 *
 * Response fields are modeled defensively with `S.optionalKey` (PACER omits
 * empty fields) and permissive unions for the int-vs-string fields that the
 * spec is inconsistent about, so a live QA response never fails to decode.
 * effect/Schema ignores excess keys on decode, so unmodeled PACER fields are
 * dropped rather than rejected.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PacerId } from "@beep/identity";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CaseNumberFull, JurisdictionType, ReportStatus } from "./Pacer.tokens.ts";

const $I = $PacerId.create("pacer/pcl/Pcl.models");

/** Permissive numeric field: PACER returns these as int (immediate) or string (batch). */
const NumberOrString = S.Union([S.Finite, S.String]);

/**
 * `CourtCaseSearchDto` — request body for `/cases/find` (pragmatic subset).
 *
 * **Example** (Search by full case number)
 *
 * ```ts
 * import { CourtCaseSearchDto } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const search = CourtCaseSearchDto.make({ caseNumberFull: O.some("1:2002bk20340") })
 * console.log(search.caseNumberFull)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CourtCaseSearchDto extends S.Class<CourtCaseSearchDto>($I`CourtCaseSearchDto`)(
  {
    caseNumberFull: CaseNumberFull.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    jurisdictionType: JurisdictionType.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    courtId: S.String.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseType: S.String.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    natureOfSuit: S.String.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateFiledFrom: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateFiledTo: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("CourtCaseSearchDto", {
    description: "PCL /cases/find request body (subset).",
  })
) {}

/**
 * `PartySearchDto` — request body for `/parties/find` (pragmatic subset).
 *
 * **Example** (Search by party last name)
 *
 * ```ts
 * import { PartySearchDto } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const search = PartySearchDto.make({ lastName: O.some("Henderson") })
 * console.log(search.lastName)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartySearchDto extends S.Class<PartySearchDto>($I`PartySearchDto`)(
  {
    lastName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    firstName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    middleName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    exactNameMatch: S.Boolean.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    courtId: S.String.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    jurisdictionType: JurisdictionType.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("PartySearchDto", {
    description: "PCL /parties/find request body (subset).",
  })
) {}

/**
 * Billing receipt block returned with each immediate search.
 *
 * **Example** (Create receipt with fees)
 *
 * ```ts
 * import { Receipt } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const receipt = Receipt.make({ billablePages: O.some(1), searchFee: O.some("0.10") })
 * console.log(receipt.billablePages)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Receipt extends S.Class<Receipt>($I`Receipt`)(
  {
    transactionDate: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    billablePages: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    loginId: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    clientCode: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    firmId: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    search: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    description: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    csoId: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    reportId: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    searchFee: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("Receipt", {
    description: "PCL search billing receipt block.",
  })
) {}

/**
 * Pagination block. `last` drives the pagination stream's stop condition.
 *
 * **Example** (Create non-final page info)
 *
 * ```ts
 * import { PageInfo } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const pageInfo = PageInfo.make({ number: O.some(0), last: O.some(false) })
 * console.log(pageInfo.last)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PageInfo extends S.Class<PageInfo>($I`PageInfo`)(
  {
    number: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    size: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    totalPages: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    totalElements: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    numberOfElements: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    first: S.Boolean.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    last: S.Boolean.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("PageInfo", {
    description: "PCL search pagination block (54 records per page).",
  })
) {}

/**
 * A single case search result (pragmatic subset).
 *
 * **Example** (Create titled case result)
 *
 * ```ts
 * import { CaseResult } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const result = CaseResult.make({ caseTitle: O.some("In re Example") })
 * console.log(result.caseTitle)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CaseResult extends S.Class<CaseResult>($I`CaseResult`)(
  {
    courtId: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseId: NumberOrString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseYear: NumberOrString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseNumber: NumberOrString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseOffice: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateFiled: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    effectiveDateClosed: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    natureOfSuit: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    jurisdictionType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseLink: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseNumberFull: S.OptionFromOptionalKey(CaseNumberFull).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("CaseResult", {
    description: "PCL case search result record (subset).",
  })
) {}

/**
 * A single party search result (pragmatic subset).
 *
 * **Example** (Create named party result)
 *
 * ```ts
 * import { PartyResult } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const result = PartyResult.make({ lastName: O.some("Henderson") })
 * console.log(result.lastName)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartyResult extends S.Class<PartyResult>($I`PartyResult`)(
  {
    lastName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    firstName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    middleName: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    generation: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    partyType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    partyRole: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    courtId: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseNumberFull: CaseNumberFull.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    jurisdictionType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    dateFiled: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    caseId: NumberOrString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("PartyResult", {
    description: "PCL party search result record (subset).",
  })
) {}

/**
 * `/cases/find` response envelope.
 *
 * **Example** (Wrap case results list)
 *
 * ```ts
 * import { CaseReportList, CaseResult } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const report = CaseReportList.make({ content: O.some([CaseResult.make({})]) })
 * console.log(report.content)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CaseReportList extends S.Class<CaseReportList>($I`CaseReportList`)(
  {
    receipt: Receipt.pipe(S.NullOr, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    pageInfo: PageInfo.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    content: CaseResult.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("CaseReportList", {
    description: "PCL /cases/find response envelope.",
  })
) {}

/**
 * `/parties/find` response envelope.
 *
 * **Example** (Wrap party results list)
 *
 * ```ts
 * import { PartyReportList, PartyResult } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const report = PartyReportList.make({ content: O.some([PartyResult.make({})]) })
 * console.log(report.content)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartyReportList extends S.Class<PartyReportList>($I`PartyReportList`)(
  {
    receipt: Receipt.pipe(S.NullOr, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    pageInfo: PageInfo.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    content: PartyResult.pipe(S.Array, S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    masterCase: S.OptionFromOptionalNullOr(S.Unknown).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("PartyReportList", {
    description: "PCL /parties/find response envelope.",
  })
) {}

/**
 * `ReportInfoType` — metadata for an asynchronous batch/download job. Returned
 * by `POST /cases/download` and the `/download/status/{reportId}` poll. Note
 * `reportId` is an integer for batch jobs (vs a UUID string in immediate
 * receipts), so it is modeled permissively.
 *
 * **Example** (Create completed report info)
 *
 * ```ts
 * import { ReportInfoType } from "@beep/pacer"
 * import * as O from "effect/Option"
 *
 * const info = ReportInfoType.make({ reportId: 1078, status: O.some("COMPLETED") })
 * console.log(info.status)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReportInfoType extends S.Class<ReportInfoType>($I`ReportInfoType`)(
  {
    reportId: NumberOrString,
    status: ReportStatus.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    recordCount: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    pages: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    unbilledPageCount: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    downloadFee: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    startTime: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    endTime: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    searchType: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("ReportInfoType", {
    description: "PCL batch report job metadata.",
  })
) {}
