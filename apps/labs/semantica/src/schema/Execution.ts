import { $SemanticaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { EvalReport } from "@/schema/Eval";
import { LedgerSnapshot } from "@/schema/Ledger";
import { EvalRunTelemetry } from "@/schema/Telemetry";

const $I = $SemanticaId.create("schema/Execution");

/**
 * Transient C0 result shared with later canary stages before derived rebuilds.
 *
 * **Details**
 *
 * The persisted report and telemetry retain their existing files; the ledger
 * snapshot stays in process so C1 can prove its projections derive only from
 * C0 truth.
 *
 * **Example** (Inspect the transient snapshot field)
 *
 * ```ts
 * import { C0ExecutionResult } from "@/schema/Execution"
 *
 * console.log(C0ExecutionResult.fields.snapshot !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class C0ExecutionResult extends S.Class<C0ExecutionResult>($I`C0ExecutionResult`)(
  { report: EvalReport, snapshot: LedgerSnapshot, telemetry: EvalRunTelemetry },
  $I.annote("C0ExecutionResult", {
    description: "C0 report, ledger snapshot, and non-digest telemetry returned to downstream canary stages.",
  })
) {}
