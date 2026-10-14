/**
 * Tagged errors for the Explore command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { OpaqueDefect } from "../../internal/schema/OpaqueDefect.ts";

const $I = $RepoCliId.create("commands/Explore/Explore.errors");

/**
 * Failure raised when `explore graduate --resume-events` cannot recover the
 * graduation events an interrupted write left pending.
 *
 * **Details**
 *
 * A graduation of an exploration with `ops/events/` stages its pending
 * events in a sidecar before it flips the manifest. Recovery refuses with
 * this error when the sidecar is missing or undecodable, the manifest no
 * longer matches the graduated bytes the sidecar recorded, the stream moved
 * in a way the recorded events do not explain, or the append itself fails.
 *
 * **Example** (Create a recovery error)
 *
 * ```ts
 * import { GraduationRecoveryError } from "@beep/repo-cli/commands/Explore"
 *
 * const error = GraduationRecoveryError.new("demo", "No pending graduation events are recorded.")()
 * console.log(error.exploration) // "demo"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GraduationRecoveryError extends S.TaggedError<GraduationRecoveryError>($I`GraduationRecoveryError`)(
  "GraduationRecoveryError",
  {
    exploration: S.String,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<GraduationRecoveryError>("GraduationRecoveryError", {
    description: "Recovery of an interrupted graduation's pending stream events was refused or failed.",
  })
) {
  static readonly new =
    (exploration: string, message: string): ((cause?: unknown) => GraduationRecoveryError) =>
    (cause?: unknown) =>
      GraduationRecoveryError.make({ exploration, message, ...(cause === undefined ? {} : { cause }) });
}
