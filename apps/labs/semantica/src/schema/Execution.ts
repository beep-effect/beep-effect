import { $SemanticaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { EvalReport } from "@/schema/Eval";
import { LedgerSnapshot } from "@/schema/Ledger";
import { C1EvalReport, C1EvalTelemetry } from "@/schema/Projection";
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

/**
 * Transient C1 result shared with C2 before reasoning and crash probes.
 *
 * **Details**
 *
 * C2 receives the exact ledger snapshot that produced the C1 report. The C0
 * and C1 telemetry remain sidecars and never enter a replay-stable digest.
 *
 * **Example** (Inspect the retained C1 report)
 *
 * ```ts
 * import { C1ExecutionResult } from "@/schema/Execution"
 *
 * console.log(C1ExecutionResult.fields.report !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class C1ExecutionResult extends S.Class<C1ExecutionResult>($I`C1ExecutionResult`)(
  {
    baseTelemetry: EvalRunTelemetry,
    report: C1EvalReport,
    snapshot: LedgerSnapshot,
    telemetry: C1EvalTelemetry,
  },
  $I.annote("C1ExecutionResult", {
    description: "C1 report, source ledger snapshot, and C0/C1 sidecars returned to C2.",
  })
) {}
