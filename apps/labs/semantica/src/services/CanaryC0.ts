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
  ReportInvalid,
} from "@/schema/Errors";
import type { EvalReport } from "@/schema/Eval";

const $I = $SemanticaId.create("services/CanaryC0");

/**
 * Full C0 command workflow contract.
 *
 * @category services
 * @since 0.0.0
 */
interface CanaryC0Shape {
  readonly run: (
    options: CanaryOptions
  ) => Effect.Effect<
    EvalReport,
    | AnchorRejected
    | C0ExecutionFailed
    | DocumentUnavailable
    | GoldUnavailable
    | LedgerFailed
    | ModelRevisionUnpinned
    | ReportInvalid
  >;
}

/**
 * Headless C0 workflow service used by the CLI and command tests.
 *
 * **Example** (Access the C0 runner)
 *
 * ```ts
 * import { CanaryC0 } from "@/services/CanaryC0"
 * import { Effect } from "effect"
 *
 * const program = CanaryC0.pipe(Effect.map((service) => typeof service.run))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CanaryC0 extends Context.Service<CanaryC0, CanaryC0Shape>()($I`CanaryC0`) {}
