/**
 * Effect v4 service contract for the W8 KPI reading (S7 contract §9).
 *
 * **Details**
 *
 * The contract lands before its implementation (design order: schema, then
 * service, then implementation). `CiOpsKpiNotImplemented` satisfies the
 * contract with a typed failure until the reading fold lands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import { KpiNotImplementedError } from "./Schemas.ts";
import type {
  KpiAdmissionJoinMismatchError,
  KpiDigestMismatchError,
  KpiInputDecodeError,
  KpiInputReadError,
  KpiReading,
  KpiReadingInput,
} from "./Schemas.ts";

const $I = $CiopsId.create("kpi/CiOpsKpi");

/**
 * Typed failures the KPI reading can return.
 *
 * **Details**
 *
 * Read, digest and decode failures cover every pinned input and committed
 * table; the join mismatch covers the two admission sources. The
 * not-implemented member rides the union until the fold lands.
 *
 * @category errors
 * @since 0.0.0
 */
export type CiOpsKpiError =
  | KpiInputReadError
  | KpiDigestMismatchError
  | KpiInputDecodeError
  | KpiAdmissionJoinMismatchError
  | KpiNotImplementedError;

/**
 * Operations exposed by the KPI reading service.
 *
 * **Details**
 *
 * `read` reads each pinned input by repo-relative path, checks its SHA-256
 * over the raw bytes before decoding, and returns the `ciops-kpi-reading/v1`
 * document. It spawns no process, makes no live fleet read and emits nothing
 * to the A-Box.
 *
 * @category services
 * @since 0.0.0
 */
export interface CiOpsKpiShape {
  readonly read: (input: KpiReadingInput) => Effect.Effect<KpiReading, CiOpsKpiError>;
}

/**
 * KPI reading service over pinned corpora and committed tables.
 *
 * **Example** (Reference the service key)
 *
 * ```ts
 * import { CiOpsKpi } from "@/kpi/CiOpsKpi"
 *
 * console.log(CiOpsKpi.key.length > 0) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiOpsKpi extends Context.Service<CiOpsKpi, CiOpsKpiShape>()($I`CiOpsKpi`) {}

// The stub ignores its input: every call fails typed until the fold lands.
const readNotImplemented = Effect.fn("CiOpsKpi.read")(function* (): Effect.fn.Return<KpiReading, CiOpsKpiError> {
  return yield* KpiNotImplementedError.make({ operation: "read" });
});

/**
 * Contract stub layer: `read` fails with `KpiNotImplementedError`.
 *
 * **Example** (Provide the stub)
 *
 * ```ts
 * import { CiOpsKpi, CiOpsKpiNotImplemented } from "@/kpi/CiOpsKpi"
 * import { Effect, Layer } from "effect"
 *
 * const program = Effect.flatMap(CiOpsKpi, (service) => Effect.succeed(service.read))
 * console.log(Layer.isLayer(CiOpsKpiNotImplemented)) // true
 * console.log(Effect.isEffect(Effect.provide(program, CiOpsKpiNotImplemented))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiOpsKpiNotImplemented: Layer.Layer<CiOpsKpi> = Layer.succeed(CiOpsKpi, {
  read: readNotImplemented,
});
