/**
 * Shared compute-profile read for the Yeet porcelain.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import { ComputeProfileProbe } from "../../../internal/repo-run/ComputeProfile.ts";
import { YeetCommandError } from "../Yeet.errors.ts";

/**
 * Reads the host compute profile through {@link ComputeProfileProbe}, mapping
 * an unreadable probe to a `YeetCommandError` with exit code 2 whose message is
 * prefixed by the command label.
 *
 * **Example** (Read the profile for a command)
 *
 * ```ts
 * import { readYeetComputeProfile } from "@beep/repo-cli/test/Yeet"
 *
 * const program = readYeetComputeProfile("yeet publish")
 * console.log(typeof program) // "object"
 * ```
 *
 * @param label - Command label prefixed onto the failure message.
 * @returns The resolved compute profile.
 * @category use-cases
 * @since 0.0.0
 */
export const readYeetComputeProfile = (label: string) =>
  ComputeProfileProbe.use((probe) => probe.resolve).pipe(
    Effect.mapBoth({
      onFailure: (cause) => YeetCommandError.make({ message: `${label}: ${cause.message}`, exitCode: 2 }),
      onSuccess: (resolution) => resolution.profile,
    })
  );
