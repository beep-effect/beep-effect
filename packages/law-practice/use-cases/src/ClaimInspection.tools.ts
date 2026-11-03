/**
 * Local read-only inspection of caller-supplied, failure-preserving source records.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ClaimInputCollection, ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";
import { annotateFourHints, FourHintAnnotations } from "@beep/mcp-kit";
import * as Tool from "effect/ai/Tool";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ClaimInspectionError } from "./ClaimSelfCheck/ClaimInspection.errors.ts";
import { ClaimInspection } from "./ClaimSelfCheck/ClaimInspection.service.ts";

const encodeReport = S.encodeEffect(S.fromJsonString(ClaimInputInspectionReport));
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
      "Inspect every supplied source record without dropping malformed claims or unknown dependency chains. Returns original source identity/text, advisory findings, and complete/partial/unchecked coverage for every record. Empty findings are not a clean result when coverage is partial or unchecked. Fetches and stores nothing. The complete encoded response is limited to 1 MiB; an oversized response fails explicitly with no truncation or clean verdict. Do not drop or renumber source records to fit the limit.",
    parameters: ClaimInputCollection,
    success: ClaimInputInspectionReport,
    failure: ClaimInspectionError,
    failureMode: "return",
  }),
  FourHintAnnotations.make({ readOnly: true, destructive: false, idempotent: true, openWorld: false })
);

/**
 * Run the local inspection and enforce the exact encoded UTF-8 response limit.
 *
 * **Example** (Inspect the tool handler)
 * ```ts
 * import { claimInspectInput } from "@beep/law-practice-use-cases/server"
 * console.log(typeof claimInspectInput) // function
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const claimInspectInput = Effect.fn("ClaimInspection.localTool")(function* (
  input: ClaimInputCollection
): Effect.fn.Return<ClaimInputInspectionReport, ClaimInspectionError, ClaimInspection> {
  const report = yield* (yield* ClaimInspection).inspect(input);
  const encoded = yield* encodeReport(report).pipe(
    Effect.mapError((cause) =>
      ClaimInspectionError.make({
        reason: "response-encoding-failed",
        message: "The complete inspection report could not be encoded.",
        cause,
      })
    )
  );
  if (encoder.encode(encoded).byteLength > responseLimit) {
    return yield* ClaimInspectionError.make({
      reason: "response-too-large",
      message:
        "No inspection report was delivered because the complete encoded response exceeds 1 MiB. No supplied record is cleared; this source requires review outside this tool. Do not drop or renumber source records to fit the limit.",
    });
  }
  return report;
});
