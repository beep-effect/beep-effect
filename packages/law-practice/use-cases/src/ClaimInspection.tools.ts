/**
 * Local read-only inspection of caller-supplied, failure-preserving source records.
 * @packageDocumentation
 * @since 0.0.0
 */

import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ClaimInspectionError } from "./ClaimSelfCheck/ClaimInspection.errors.ts";
import {
  ClaimInspectionCursor,
  ClaimInspectionPage,
  ClaimInspectionPageRange,
  ClaimInspectionPageRequest,
  ClaimInspectionSummary,
} from "./ClaimSelfCheck/ClaimInspection.pages.ts";
import { ClaimInspection } from "./ClaimSelfCheck/ClaimInspection.service.ts";
import type { ClaimInputInspection, ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";

const encodePage = S.encodeEffect(S.fromJsonString(ClaimInspectionPage));
const encoder = new TextEncoder();
const responseLimit = 1024 * 1024;

/**
 * Local source-record inspection, with complete/partial/unchecked outcomes and no persistence.
 *
 * **Example** (Read the tool name)
 * ```ts
 * import { ClaimInspectionTool } from "@beep/law-practice-use-cases/server"
 * console.log(ClaimInspectionTool.name) // claim_inspect_input
 * ```
 * @category tools
 * @since 0.0.0
 */
export const ClaimInspectionTool = annotateFourHints(
  Tool.make("claim_inspect_input", {
    description:
      "Inspect the full supplied source ledger without dropping malformed claims or unknown dependency chains. Returns a contiguous page of original inspection records, the entire unchanged input, global index status, and complete/partial/unchecked counts for the whole source. Follow nextCursor by repeating the exact input plus cursor until deliveryStatus is complete; delivery is incomplete while a cursor remains. Empty findings never mean clean when source coverage is partial or unchecked. Fetches and stores nothing. Each encoded page is limited to 1 MiB; if the ledger plus one whole record cannot fit, fails explicitly without truncation or a clean verdict. Do not drop or renumber records to fit.",
    parameters: ClaimInspectionPageRequest,
    success: ClaimInspectionPage,
    failure: ClaimInspectionError,
    failureMode: "return",
  }),
  FourHintAnnotations.make({ readOnly: true, destructive: false, idempotent: true, openWorld: false })
);

const responseBytes = Effect.fn("ClaimInspection.pageBytes")(function* (page: ClaimInspectionPage) {
  const encoded = yield* encodePage(page).pipe(
    Effect.mapError((cause) =>
      ClaimInspectionError.make({
        reason: "response-encoding-failed",
        message: "The inspection page could not be encoded.",
        cause,
      })
    )
  );
  return encoder.encode(encoded).byteLength;
});

const pageOf = (
  report: ClaimInputInspectionReport,
  summary: ClaimInspectionSummary,
  records: A.NonEmptyReadonlyArray<ClaimInputInspection>
) => {
  const startSourceOrdinal = A.headNonEmpty(records).decomposition.qualification.record.sourceOrdinal;
  const endSourceOrdinal = A.lastNonEmpty(records).decomposition.qualification.record.sourceOrdinal;
  const hasMore = endSourceOrdinal < report.records.length;
  return ClaimInspectionPage.make({
    input: report.input,
    indexStatus: report.indexStatus,
    summary,
    records,
    range: ClaimInspectionPageRange.make({ startSourceOrdinal, endSourceOrdinal, totalRecords: report.records.length }),
    deliveryStatus: hasMore ? "incomplete" : "complete",
    nextCursor: hasMore
      ? O.some(
          ClaimInspectionCursor.make({ sourceKey: report.input.sourceKey, nextSourceOrdinal: endSourceOrdinal + 1 })
        )
      : O.none(),
  });
};

const cursorStart = Effect.fn("ClaimInspection.cursorStart")(function* (request: ClaimInspectionPageRequest) {
  const { input, cursor } = request;
  const start = O.getOrElse(
    O.map(O.fromUndefinedOr(cursor), (value) => value.nextSourceOrdinal),
    () => 1
  );
  if ((cursor !== undefined && cursor.sourceKey !== input.sourceKey) || start < 1 || start > input.records.length) {
    return yield* ClaimInspectionError.make({
      reason: "invalid-cursor",
      message:
        "The cursor must name this exact immutable source version and an existing source ordinal. Repeat the complete unchanged ledger.",
    });
  }
  return start;
});

const boundedPage = Effect.fn("ClaimInspection.boundedPage")(function* (
  report: ClaimInputInspectionReport,
  summary: ClaimInspectionSummary,
  start: number
) {
  const first = yield* Effect.fromOption(A.get(report.records, start - 1)).pipe(
    Effect.mapError(() =>
      ClaimInspectionError.make({
        reason: "invalid-cursor",
        message: "The cursor position is unavailable in this source report.",
      })
    )
  );
  const remaining = A.prepend(A.drop(report.records, start), first);
  const completePage = pageOf(report, summary, remaining);
  if ((yield* responseBytes(completePage)) <= responseLimit) return completePage;
  let records: A.NonEmptyReadonlyArray<ClaimInputInspection> = [first];
  let page = pageOf(report, summary, records);
  if ((yield* responseBytes(page)) > responseLimit) {
    return yield* ClaimInspectionError.make({
      reason: "response-too-large",
      message:
        "No page was delivered: the full ledger plus one whole inspection record exceeds 1 MiB. No supplied record is cleared; this source requires review outside this tool. Do not drop or renumber source records to fit the limit.",
    });
  }
  let next = start;
  while (next < report.records.length) {
    const record = A.get(report.records, next);
    if (O.isNone(record)) break;
    const candidateRecords = A.append(records, record.value);
    const candidate = pageOf(report, summary, candidateRecords);
    if ((yield* responseBytes(candidate)) > responseLimit) break;
    records = candidateRecords;
    page = candidate;
    next += 1;
  }
  return page;
});

/**
 * Recompute the full inspection and greedily deliver whole records within the exact encoded UTF-8 page budget.
 * **Details**
 * Continuations are stateless and source-bound. The complete source ledger is
 * repeated on every page. No source or result record is discarded or renumbered.
 * **Example** (Inspect the tool handler)
 * ```ts
 * import { claimInspectInput } from "@beep/law-practice-use-cases/server"
 * console.log(typeof claimInspectInput) // function
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const claimInspectInput = Effect.fn("ClaimInspection.localTool")(function* (
  request: ClaimInspectionPageRequest
): Effect.fn.Return<ClaimInspectionPage, ClaimInspectionError, ClaimInspection> {
  const start = yield* cursorStart(request);
  const report = yield* (yield* ClaimInspection).inspect(request.input);
  const summary = ClaimInspectionSummary.make({
    complete: A.countBy(report.records, (record) => record.status === "complete"),
    partial: A.countBy(report.records, (record) => record.status === "partial"),
    unchecked: A.countBy(report.records, (record) => record.status === "unchecked"),
  });
  return yield* boundedPage(report, summary, start);
});
