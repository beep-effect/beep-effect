/**
 * Hold ledger errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("commands/Holds/Holds.errors");

/**
 * Failure category for hold ledger operations.
 *
 * @category errors
 * @since 0.0.0
 */
export const HoldsErrorReason = LiteralKit(["io", "decode", "not-found", "usage", "probe"]).pipe(
  $I.annoteSchema("HoldsErrorReason", { description: "Failure category for hold ledger operations." })
);

/**
 * Decoded type of {@link HoldsErrorReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type HoldsErrorReason = typeof HoldsErrorReason.Type;

/**
 * A hold ledger read, write or probe failed.
 *
 * **Example** (Build a usage error)
 *
 * ```ts
 * import { HoldsError } from "@beep/repo-cli/commands/Holds"
 *
 * const error = HoldsError.make({ reason: "usage", message: "Unknown hold id." })
 * console.log(error.reason) // "usage"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HoldsError extends S.TaggedError<HoldsError, { readonly brand: unique symbol }>($I`HoldsError`)(
  "HoldsError",
  { reason: HoldsErrorReason, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<HoldsError>("HoldsError", { description: "A hold ledger read, write or probe failed." })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

/**
 * Map a platform failure into a {@link HoldsError}.
 *
 * @category errors
 * @since 0.0.0
 */
export const holdsPlatformError =
  (message: string) =>
  (cause: PlatformError.PlatformError): HoldsError =>
    HoldsError.make({ reason: "io", message: `${message}: ${cause.message}`, cause });
