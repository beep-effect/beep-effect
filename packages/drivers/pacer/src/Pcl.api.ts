/**
 * Declarative `effect/unstable/httpapi` contract for the PACER Case Locator
 * (PCL) synchronous search endpoints.
 *
 * PCL uses real HTTP status codes for errors (401/406/429/500), which maps
 * cleanly onto HttpApi — so the surface is defined declaratively here and a
 * typed client is derived from it in `PclClient.service.ts`. Non-2xx
 * statuses surface as `HttpClientError` on the derived client and are mapped to
 * `PacerPclError` there (PACER's error bodies are not a stable schema, so they
 * are intentionally not modeled as HttpApi `error` shapes).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import { CaseReportList, CourtCaseSearchDto, PartyReportList, PartySearchDto, ReportInfoType } from "./Pcl.models.ts";

/**
 * HttpApi group for PCL synchronous search endpoints. `page` is a 0-based query
 * parameter (54 records per page).
 *
 * **Example** (Import PclHttpApiGroup)
 *
 * ```ts
 * import { PclHttpApiGroup } from "@beep/pacer"
 *
 * const group = PclHttpApiGroup
 * console.log(group !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PclHttpApiGroup = HttpApiGroup.make("pcl").add(
  HttpApiEndpoint.post("findCases", "/pcl-public-api/rest/cases/find", {
    payload: CourtCaseSearchDto,
    query: { page: S.optional(S.FiniteFromString) },
    success: CaseReportList,
  }).annotate(OpenApi.Summary, "Search PACER Case Locator cases."),
  HttpApiEndpoint.post("findParties", "/pcl-public-api/rest/parties/find", {
    payload: PartySearchDto,
    query: { page: S.optional(S.FiniteFromString) },
    success: PartyReportList,
  }).annotate(OpenApi.Summary, "Search PACER Case Locator parties."),
  HttpApiEndpoint.post("startCaseDownload", "/pcl-public-api/rest/cases/download", {
    payload: CourtCaseSearchDto,
    success: ReportInfoType,
  }).annotate(OpenApi.Summary, "Start an asynchronous case download report."),
  HttpApiEndpoint.get("caseDownloadStatus", "/pcl-public-api/rest/cases/download/status/:reportId", {
    params: { reportId: S.FiniteFromString },
    success: ReportInfoType,
  }).annotate(OpenApi.Summary, "Return the status of a case download report."),
  HttpApiEndpoint.get("caseDownloadResults", "/pcl-public-api/rest/cases/download/:reportId", {
    params: { reportId: S.FiniteFromString },
    success: CaseReportList,
  }).annotate(OpenApi.Summary, "Return the results of a completed case download report.")
);

/**
 * The PACER PCL HttpApi contract.
 *
 * **Example** (Import PclHttpApi)
 *
 * ```ts
 * import { PclHttpApi } from "@beep/pacer"
 *
 * const api = PclHttpApi
 * console.log(api !== undefined)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PclHttpApi = HttpApi.make("PacerPcl")
  .annotate(OpenApi.Title, "PACER Case Locator API")
  .annotate(
    OpenApi.Description,
    "Declarative contract for the PACER Case Locator synchronous case and party search endpoints and asynchronous case download workflow. PACER error responses use HTTP status codes and are mapped by the derived client because their response bodies are not a stable schema."
  )
  .add(PclHttpApiGroup);
