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

import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { CaseNumberFull, JurisdictionType, ReportStatus } from "../Pacer.tokens.ts";

const $I = $ScratchpadId.create("pacer/pcl/Pcl.models");

/** Permissive numeric field: PACER returns these as int (immediate) or string (batch). */
const NumberOrString = S.Union([S.Finite, S.String]);

/**
 * `CourtCaseSearchDto` — request body for `/cases/find` (pragmatic subset).
 *
 * @category schemas
 * @since 0.0.0
 */
export class CourtCaseSearchDto extends S.Class<CourtCaseSearchDto>($I`CourtCaseSearchDto`)(
  {
    caseNumberFull: CaseNumberFull.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    jurisdictionType: JurisdictionType.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    courtId: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseType: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    natureOfSuit: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateFiledFrom: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateFiledTo: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CourtCaseSearchDto", {
    description: "PCL /cases/find request body (subset).",
  })
) {}

/**
 * `PartySearchDto` — request body for `/parties/find` (pragmatic subset).
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartySearchDto extends S.Class<PartySearchDto>($I`PartySearchDto`)(
  {
    lastName: S.String.pipe(S.OptionFromOptionalKey,SchemaUtils.withNoneDefault),
    firstName: S.String.pipe(S.OptionFromOptionalKey,SchemaUtils.withNoneDefault),
    middleName: S.String.pipe(S.OptionFromOptionalKey,SchemaUtils.withNoneDefault),
    exactNameMatch: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    courtId: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    jurisdictionType: JurisdictionType.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PartySearchDto", {
    description: "PCL /parties/find request body (subset).",
  })
) {}

/**
 * Billing receipt block returned with each immediate search.
 *
 * @category schemas
 * @since 0.0.0
 */
export class Receipt extends S.Class<Receipt>($I`Receipt`)(
  {
    transactionDate: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    billablePages: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    loginId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    clientCode: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    firmId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    search: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    csoId: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    reportId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    searchFee: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("Receipt", {
    description: "PCL search billing receipt block.",
  })
) {}

/**
 * Pagination block. `last` drives the pagination stream's stop condition.
 *
 * @category schemas
 * @since 0.0.0
 */
export class PageInfo extends S.Class<PageInfo>($I`PageInfo`)(
  {
    number: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    size: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    totalPages: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    totalElements: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    numberOfElements: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    first: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    last: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PageInfo", {
    description: "PCL search pagination block (54 records per page).",
  })
) {}

/**
 * A single case search result (pragmatic subset).
 *
 * @category schemas
 * @since 0.0.0
 */
export class CaseResult extends S.Class<CaseResult>($I`CaseResult`)(
  {
    courtId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseId: NumberOrString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseYear: NumberOrString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseNumber: NumberOrString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseOffice: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateFiled: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    effectiveDateClosed: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    natureOfSuit: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    jurisdictionType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseLink: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseNumberFull: S.OptionFromOptionalKey(CaseNumberFull).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CaseResult", {
    description: "PCL case search result record (subset).",
  })
) {}

/**
 * A single party search result (pragmatic subset).
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartyResult extends S.Class<PartyResult>($I`PartyResult`)(
  {
    lastName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    firstName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    middleName: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    generation: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    partyType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    partyRole: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    courtId: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseTitle: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseNumberFull: CaseNumberFull.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    jurisdictionType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    dateFiled: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    caseId: NumberOrString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("PartyResult", {
    description: "PCL party search result record (subset).",
  })
) {}

/**
 * `/cases/find` response envelope.
 *
 * @category schemas
 * @since 0.0.0
 */
export class CaseReportList extends S.Class<CaseReportList>($I`CaseReportList`)(
  {
    receipt: Receipt.pipe(S.NullOr, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pageInfo: PageInfo.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    content: CaseResult.pipe(S.Array ,S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CaseReportList", {
    description: "PCL /cases/find response envelope.",
  })
) {}

/**
 * `/parties/find` response envelope.
 *
 * @category schemas
 * @since 0.0.0
 */
export class PartyReportList extends S.Class<PartyReportList>($I`PartyReportList`)(
  {
    receipt: Receipt.pipe(S.NullOr, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pageInfo: PageInfo.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    content: PartyResult.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    masterCase: S.OptionFromOptionalNullOr(S.Unknown).pipe(SchemaUtils.withNoneDefault),
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
 * @category schemas
 * @since 0.0.0
 */
export class ReportInfoType extends S.Class<ReportInfoType>($I`ReportInfoType`)(
  {
    reportId: NumberOrString,
    status: ReportStatus.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    recordCount: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    pages: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    unbilledPageCount: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    downloadFee: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startTime: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    endTime: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    searchType: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ReportInfoType", {
    description: "PCL batch report job metadata.",
  })
) {}
