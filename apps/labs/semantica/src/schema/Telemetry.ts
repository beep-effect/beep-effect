import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { RunId } from "@/schema/Ids";

const $I = $SemanticaId.create("schema/Telemetry");

const EvaluationMode = LiteralKit(["live", "replay"]);

/**
 * Non-replay-stable performance sidecar for one evaluation execution.
 *
 * **Details**
 *
 * This is the only C0 schema that admits wall-clock time. It is never included
 * in a content-addressed id or evaluation report digest. Dependency and model
 * footprints are `O.none()` when the runtime cannot measure them honestly.
 *
 * **Example** (Inspect the fixed telemetry version)
 *
 * ```ts
 * import { EvalRunTelemetry } from "@/schema/Telemetry"
 *
 * console.log(EvalRunTelemetry.fields.schemaVersion.literals[0]) // "eval-telemetry/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvalRunTelemetry extends S.Class<EvalRunTelemetry>($I`EvalRunTelemetry`)(
  {
    schemaVersion: S.Literal("eval-telemetry/v1"),
    reportDigest: Sha256Hex,
    runId: RunId,
    mode: EvaluationMode,
    startedAt: S.DateTimeUtcFromString,
    wallClockMs: NonNegativeInt,
    coldStartMs: NonNegativeInt,
    p95Ms: NonNegativeInt,
    rssBytes: NonNegativeInt,
    diskGrowthBytes: NonNegativeInt,
    dependencyBytes: S.OptionFromNullOr(NonNegativeInt),
    modelBytes: S.OptionFromNullOr(NonNegativeInt),
  },
  $I.annote("EvalRunTelemetry", {
    description:
      "Live-or-replay timing and available byte measurements kept outside every replay-stable digest preimage.",
  })
) {}
