/**
 * Schema-derived data for the PACER mock + tests.
 *
 * Instead of hardcoded JSON fixtures, PCL response rows are GENERATED from the
 * effect/Schema definitions via `Schema.toArbitrary` + `FastCheck.sample`, then
 * re-encoded through the envelope schema. This keeps the mock honest: any drift
 * in a schema's checks/refinements (e.g. the `CaseNumberFull` arbitrary) shows
 * up in the generated data. Auth bodies are built with the schema's validated
 * `.make` constructor — their `loginResult` codes are scenario constants, not
 * random — and only the page counts are fixed (so tests can assert totals).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck } from "effect/testing";
import { CsoAuthResponse, CsoLogoutResponse } from "./CsoAuth.models.ts";
import {
  CaseReportList,
  CaseResult,
  PageInfo,
  PartyReportList,
  PartyResult,
  Receipt,
  ReportInfoType,
} from "./Pcl.models.ts";
import type { Effect } from "effect";

const caseArbitrary = S.toArbitrary(CaseResult);
const partyArbitrary = S.toArbitrary(PartyResult);
const receiptArbitrary = S.toArbitrary(Receipt);

/**
 * Generate schema-valid case rows with deterministic FastCheck seeding.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
const sampleCaseResults = (count: number, seed: number): ReadonlyArray<CaseResult> =>
  FastCheck.sample(caseArbitrary, { numRuns: count, seed });

/**
 * Generate schema-valid party rows with deterministic FastCheck seeding.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
const samplePartyResults = (count: number, seed: number): ReadonlyArray<PartyResult> =>
  FastCheck.sample(partyArbitrary, { numRuns: count, seed });

const sampleReceipt = (seed: number): Receipt => {
  const [value] = FastCheck.sample(receiptArbitrary, { numRuns: 1, seed });
  return value ?? Receipt.make({});
};

/**
 * Build one encoded `/cases/find` page envelope with controlled pagination.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
const caseReportListBody = (
  pageNumber: number,
  totalPages: number,
  content: ReadonlyArray<CaseResult>
): Effect.Effect<unknown, S.SchemaError> =>
  S.encodeUnknownEffect(CaseReportList)(
    CaseReportList.make({
      receipt: O.some(sampleReceipt(pageNumber + 1)),
      pageInfo: O.some(
        PageInfo.make({
          number: O.some(pageNumber),
          size: O.some(54),
          totalPages: O.some(totalPages),
          totalElements: O.some(totalPages),
          numberOfElements: O.some(content.length),
          first: O.some(pageNumber === 0),
          last: O.some(pageNumber >= totalPages - 1),
        })
      ),
      content: O.some(content),
    })
  );

/**
 * Build one encoded `/parties/find` page envelope.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
const partyReportListBody = (content: ReadonlyArray<PartyResult>): Effect.Effect<unknown, S.SchemaError> =>
  S.encodeUnknownEffect(PartyReportList)(
    PartyReportList.make({
      receipt: O.some(sampleReceipt(2001)),
      pageInfo: O.some(
        PageInfo.make({
          number: O.some(0),
          size: O.some(54),
          totalPages: O.some(1),
          totalElements: O.some(content.length),
          numberOfElements: O.some(content.length),
          first: O.some(true),
          last: O.some(true),
        })
      ),
      content: O.some(content),
      masterCase: O.none(),
    })
  );

/**
 * Total number of case rows the default mock serves across all pages.
 *
 * **Example** (Log total mock cases)
 *
 * ```ts
 * import { PACER_MOCK_TOTAL_CASES } from "@beep/pacer"
 *
 * const totalCases = PACER_MOCK_TOTAL_CASES
 * console.log(totalCases) // 3
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PACER_MOCK_TOTAL_CASES = 3;

/**
 * Two schema-sampled `/cases/find` pages (2 rows then 1 row; last on page 1).
 *
 * **Example** (Verify pages are Effects)
 *
 * ```ts
 * import { defaultCasePages } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * const pages = defaultCasePages()
 * console.log(pages.every(Effect.isEffect))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const defaultCasePages = (): ReadonlyArray<Effect.Effect<unknown, S.SchemaError>> => [
  caseReportListBody(0, 2, sampleCaseResults(2, 1001)),
  caseReportListBody(1, 2, sampleCaseResults(1, 1002)),
];

/**
 * Build a schema-valid `/cases/find` page that never marks pagination complete.
 *
 * **Example** (Check looping body Effect)
 *
 * ```ts
 * import { loopingCaseReportBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loopingCaseReportBody(0)))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const loopingCaseReportBody = (pageNumber: number): Effect.Effect<unknown, S.SchemaError> =>
  caseReportListBody(pageNumber, pageNumber + 2, sampleCaseResults(1, pageNumber + 4001));

/**
 * One schema-sampled `/parties/find` page (1 row).
 *
 * **Example** (Check party body Effect)
 *
 * ```ts
 * import { defaultPartyBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(defaultPartyBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const defaultPartyBody: Effect.Effect<unknown, S.SchemaError> = partyReportListBody(samplePartyResults(1, 2002));

/**
 * Successful cso-auth body (loginResult "0", non-empty token).
 *
 * **Example** (Check auth success Effect)
 *
 * ```ts
 * import { authSuccessBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(authSuccessBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const authSuccessBody: Effect.Effect<unknown, S.SchemaError> = S.encodeUnknownEffect(CsoAuthResponse)(
  CsoAuthResponse.make({
    nextGenCSO: Str.repeat(128)("Q"),
    loginResult: "0",
    errorDescription: O.none(),
  })
);

/**
 * Failed cso-auth body (invalid credentials / OTP, loginResult "13").
 *
 * **Example** (Check invalid auth Effect)
 *
 * ```ts
 * import { authInvalidBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(authInvalidBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const authInvalidBody: Effect.Effect<unknown, S.SchemaError> = S.encodeUnknownEffect(CsoAuthResponse)(
  CsoAuthResponse.make({
    nextGenCSO: "",
    loginResult: "13",
    errorDescription: O.some("Invalid username, password, or one-time passcode."),
  })
);

/**
 * Successful cso-logout body.
 *
 * **Example** (Check logout body Effect)
 *
 * ```ts
 * import { logoutBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(logoutBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const logoutBody: Effect.Effect<unknown, S.SchemaError> = S.encodeUnknownEffect(CsoLogoutResponse)(
  CsoLogoutResponse.make({
    loginResult: O.some("0"),
    errorDescription: O.none(),
    nextGenCSO: O.none(),
  })
);

/**
 * Failed cso-logout body (invalid or expired nextGenCSO, loginResult "13").
 *
 * **Example** (Check invalid logout Effect)
 *
 * ```ts
 * import { logoutInvalidBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(logoutInvalidBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const logoutInvalidBody: Effect.Effect<unknown, S.SchemaError> = S.encodeUnknownEffect(CsoLogoutResponse)(
  CsoLogoutResponse.make({
    loginResult: O.some("13"),
    errorDescription: O.some("Invalid nextGenCSO."),
    nextGenCSO: O.none(),
  })
);

/**
 * A PCL 406 validation error body (PACER's own shape, not our error schema).
 *
 * **Example** (Log validation error field)
 *
 * ```ts
 * import { invalidParameterBody } from "@beep/pacer"
 *
 * console.log(invalidParameterBody.error)
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const invalidParameterBody = {
  error: "Validation Exception",
  message: "invalid search parameter",
};

/**
 * The report id the default mock issues for batch downloads.
 *
 * **Example** (Log default report id)
 *
 * ```ts
 * import { DEFAULT_REPORT_ID } from "@beep/pacer"
 *
 * const reportId = DEFAULT_REPORT_ID
 * console.log(reportId) // 1078
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const DEFAULT_REPORT_ID = 1078;

/**
 * Total case rows the default batch download returns.
 *
 * **Example** (Log download case count)
 *
 * ```ts
 * import { PACER_MOCK_DOWNLOAD_CASES } from "@beep/pacer"
 *
 * const downloadCases = PACER_MOCK_DOWNLOAD_CASES
 * console.log(downloadCases) // 2
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const PACER_MOCK_DOWNLOAD_CASES = 2;

/**
 * Build an encoded `ReportInfoType` body for a batch job in the given status.
 *
 * **Example** (Build completed report info)
 *
 * ```ts
 * import { reportInfoBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(reportInfoBody(1078, "COMPLETED")))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const reportInfoBody: {
  (
    reportId: number | string,
    status: "WAITING" | "RUNNING" | "COMPLETED" | "FAILED"
  ): Effect.Effect<unknown, S.SchemaError>;
  (
    status: "WAITING" | "RUNNING" | "COMPLETED" | "FAILED"
  ): (reportId: number | string) => Effect.Effect<unknown, S.SchemaError>;
} = dual(2, (reportId: number | string, status: "WAITING" | "RUNNING" | "COMPLETED" | "FAILED") =>
  S.encodeUnknownEffect(ReportInfoType)(
    ReportInfoType.make({
      reportId,
      status: O.some(status),
      recordCount: O.some(3),
      pages: O.some(1),
    })
  )
);

/**
 * Encoded result set returned by a completed batch case download.
 *
 * **Example** (Check download results Effect)
 *
 * ```ts
 * import { downloadResultsBody } from "@beep/pacer"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(downloadResultsBody))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const downloadResultsBody: Effect.Effect<unknown, S.SchemaError> = caseReportListBody(
  0,
  1,
  sampleCaseResults(PACER_MOCK_DOWNLOAD_CASES, 3001)
);
