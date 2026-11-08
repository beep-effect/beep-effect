/**
 * Schemas for the per-process compute profile (goal compute-profile-gate-routing, D1 and D5).
 *
 * The compute profile describes the memory ceiling a `beep` process runs
 * under. It is a separate axis from `ProofEnvProfile`, which keeps describing
 * the proof posture (local, PR posture, hosted).
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { LiteralKit } from "@beep/schema";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/ComputeProfile.schemas");

/**
 * Memory class of the host a `beep` process runs on.
 *
 * **Details**
 *
 * `worker` means the process memory ceiling is below the admission envelope
 * (`hardFloorGib + slotSizeGib`, 20 GiB by default), so compute-heavy gates
 * defer to hosted CI. `workstation` means every gate may run locally. Hosted
 * runners are posture `hosted` in `ProofEnvProfile`, never a compute profile.
 *
 * **Example** (Recognize the worker profile)
 *
 * ```ts
 * import { ComputeProfile } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ComputeProfile.is.worker("worker")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ComputeProfile = LiteralKit(["workstation", "worker"]).pipe(
  $I.annoteSchema("ComputeProfile", {
    description: "Memory class of the host a beep process runs on: workstation or a sub-envelope worker.",
  })
);

/**
 * Memory class of the host a `beep` process runs on.
 *
 * @category models
 * @since 0.0.0
 */
export type ComputeProfile = typeof ComputeProfile.Type;

/**
 * Where a resolved compute profile came from.
 *
 * **Example** (Recognize a probe-derived profile)
 *
 * ```ts
 * import { ComputeProfileSource } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ComputeProfileSource.is.probe("probe")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ComputeProfileSource = LiteralKit(["probe", "override", "unavailable"]).pipe(
  $I.annoteSchema("ComputeProfileSource", {
    description: "Origin of a resolved compute profile: the memory probe, the tightening override, or no reading.",
  })
);

/**
 * Where a resolved compute profile came from.
 *
 * @category models
 * @since 0.0.0
 */
export type ComputeProfileSource = typeof ComputeProfileSource.Type;

/**
 * One resolved compute profile with the evidence that produced it.
 *
 * **Details**
 *
 * `ceilingGib` is the probe's memory ceiling: `process.constrainedMemory()`
 * when the process is capped, otherwise the installed memory. It is `None`
 * only when neither reading was usable. `envelopeGib` is the admission
 * envelope the ceiling was compared against. `overrideRequested` records a
 * `BEEP_COMPUTE_PROFILE` value even when it was ignored.
 *
 * **Example** (Construct a worker resolution)
 *
 * ```ts
 * import { ComputeProfileResolution } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const resolution = ComputeProfileResolution.make({
 *   profile: "worker",
 *   source: "probe",
 *   ceilingGib: O.some(7),
 *   envelopeGib: 20,
 *   overrideRequested: O.none()
 * })
 * console.log(resolution.profile) // "worker"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComputeProfileResolution extends S.Opaque<ComputeProfileResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    profile: ComputeProfile,
    source: ComputeProfileSource,
    ceilingGib: S.OptionFromNullOr(S.Finite),
    envelopeGib: S.Finite,
    overrideRequested: S.OptionFromNullOr(ComputeProfile),
  }).pipe(
    $I.annoteSchema("ComputeProfileResolution", {
      description: "A resolved compute profile with its source, probe ceiling, admission envelope and override.",
    })
  )
) {}

/**
 * Encoded form of {@link ComputeProfileResolution}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ComputeProfileResolution {
  /**
   * Encoded form of {@link ComputeProfileResolution}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof ComputeProfileResolution.Encoded;
}

/**
 * Failure raised when the `BEEP_COMPUTE_PROFILE` override cannot be decoded.
 *
 * **Example** (Construct an override error)
 *
 * ```ts
 * import { ComputeProfileError } from "@beep/repo-cli/test/RepoRun"
 *
 * const error = ComputeProfileError.make({ message: "BEEP_COMPUTE_PROFILE must be workstation or worker" })
 * console.log(error._tag) // "ComputeProfileError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ComputeProfileError extends S.TaggedError<ComputeProfileError, { readonly brand: unique symbol }>(
  $I`ComputeProfileError`
)(
  "ComputeProfileError",
  {
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<ComputeProfileError>("ComputeProfileError", {
    description: "The BEEP_COMPUTE_PROFILE override could not be decoded as a compute profile.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 2;
}
