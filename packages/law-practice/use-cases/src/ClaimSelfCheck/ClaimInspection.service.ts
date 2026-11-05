/**
 * Failure-preserving source inspection use-case service.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { inspectClaimInput } from "@beep/law-practice-domain/values/ClaimElement";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ClaimInspectionError } from "./ClaimInspection.errors.ts";
import { PublishedClaimInspectionReport } from "./ClaimInspection.schemas.ts";
import { UsptoClaimInputs } from "./ClaimSelfCheck.ports.ts";
import type { ClaimInputCollection, ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";
import type { UsptoClaimSource } from "./ClaimSelfCheck.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimInspection.service");

/**
 * Advisory inspection of supplied source ledgers or acquired public source records.
 *
 * **Example** (Name a service operation)
 * ```ts
 * import type { ClaimInspectionShape } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * const method: keyof ClaimInspectionShape = "inspectPublished"
 * console.log(method) // inspectPublished
 * ```
 * @category services
 * @since 0.0.0
 */
export interface ClaimInspectionShape {
  /** Inspect supplied records; partial and all-unusable input remain explicit report outcomes. */
  readonly inspect: (input: ClaimInputCollection) => Effect.Effect<ClaimInputInspectionReport, ClaimInspectionError>;
  /** Acquire and inspect the exact public document, retaining source provenance and all records. */
  readonly inspectPublished: (
    source: UsptoClaimSource
  ) => Effect.Effect<PublishedClaimInspectionReport, ClaimInspectionError>;
}

/**
 * Failure-preserving inspection capability; it writes no candidates or state.
 *
 * **Example** (Reference the service)
 * ```ts
 * import { ClaimInspection } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(ClaimInspection.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class ClaimInspection extends Context.Service<ClaimInspection, ClaimInspectionShape>()($I`ClaimInspection`) {}

/**
 * Inspection implementation over the separate failure-preserving source acquisition port.
 *
 * **Example** (Inspect the service layer)
 * ```ts
 * import { ClaimInspectionLive } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ClaimInspectionLive)) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const ClaimInspectionLive: Layer.Layer<ClaimInspection, never, UsptoClaimInputs> = Layer.effect(
  ClaimInspection,
  Effect.gen(function* () {
    const acquisition = yield* UsptoClaimInputs;
    return ClaimInspection.of({
      inspect: Effect.fn("ClaimInspection.inspect")(inspectClaimInput),
      inspectPublished: Effect.fn("ClaimInspection.inspectPublished")(function* (source: UsptoClaimSource) {
        const acquired = yield* acquisition.inputs(source).pipe(
          Effect.mapError((cause) =>
            ClaimInspectionError.make({
              reason: "public-source-unavailable",
              message: `Public source acquisition failed (${cause.reason}).`,
              cause,
            })
          )
        );
        const report = yield* inspectClaimInput(acquired.input);
        return PublishedClaimInspectionReport.make({ source: acquired, report });
      }),
    });
  })
);
