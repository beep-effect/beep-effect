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
  ReasoningFailed,
  ReportInvalid,
} from "@/schema/Errors";
import type { C2EvalReport } from "@/schema/Reasoning";

const $I = $SemanticaId.create("services/CanaryC2");

interface CanaryC2Shape {
  readonly run: (
    options: CanaryOptions
  ) => Effect.Effect<
    C2EvalReport,
    | AnchorRejected
    | C0ExecutionFailed
    | DocumentUnavailable
    | GoldUnavailable
    | LedgerFailed
    | ModelRevisionUnpinned
    | ProjectionFailed
    | ReasoningFailed
    | ReportInvalid
  >;
}

/**
 * Headless C2 workflow over C1 truth, declarative closure, and Tier-L gates.
 *
 * **Example** (Access the C2 runner)
 *
 * ```ts
 * import { CanaryC2 } from "@/services/CanaryC2"
 * import { Effect } from "effect"
 *
 * const program = CanaryC2.pipe(Effect.map((service) => typeof service.run))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CanaryC2 extends Context.Service<CanaryC2, CanaryC2Shape>()($I`CanaryC2`) {}
