import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { CanaryOptions } from "@/canary/Command";
import type {
  AnchorRejected,
  C0ExecutionFailed,
  DocumentUnavailable,
  GoldUnavailable,
  LedgerFailed,
  ModelRevisionUnpinned,
  ProjectionFailed,
  ReportInvalid,
} from "@/schema/Errors";
import type { C1EvalReport } from "@/schema/Projection";

const $I = $SemanticaId.create("services/CanaryC1");

interface CanaryC1Shape {
  readonly run: (
    options: CanaryOptions
  ) => Effect.Effect<
    C1EvalReport,
    | AnchorRejected
    | C0ExecutionFailed
    | DocumentUnavailable
    | GoldUnavailable
    | LedgerFailed
    | ModelRevisionUnpinned
    | ProjectionFailed
    | ReportInvalid
  >;
}

/**
 * Headless C1 workflow service over C0 truth and disposable projections.
 *
 * **Example** (Access the C1 runner)
 *
 * ```ts
 * import { CanaryC1 } from "@/services/CanaryC1"
 * import { Effect } from "effect"
 *
 * const program = CanaryC1.pipe(Effect.map((service) => typeof service.run))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CanaryC1 extends Context.Service<CanaryC1, CanaryC1Shape>()($I`CanaryC1`) {}
