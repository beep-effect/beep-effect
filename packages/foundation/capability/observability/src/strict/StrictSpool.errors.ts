/**
 * Typed failure of the strict-tier encrypted spool and its key.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("strict/StrictSpool.errors");

/**
 * What the strict spool was doing when it failed.
 *
 * **Example** (Read an operation)
 *
 * ```ts import.meta.vitest name="Read an operation"
 * import { StrictSpoolOperation } from "@beep/observability/strict"
 *
 * StrictSpoolOperation.Enum.replay // => "replay"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictSpoolOperation = LiteralKit(["key", "open", "append", "replay"]).pipe(
  $I.annoteSchema("StrictSpoolOperation", {
    description: "Strict spool operation that failed: deriving the key, opening the directory, appending or replaying.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictSpoolOperation = typeof StrictSpoolOperation.Type;

/**
 * **Details**
 *
 * `message` is a fixed sentence; it never carries a telemetry body or key
 * bytes. `cause` keeps the underlying platform error for diagnosis and is
 * ignored by equivalence.
 *
 * **Example** (Construct a spool failure)
 *
 * ```ts import.meta.vitest name="Construct a spool failure"
 * import { StrictSpoolError } from "@beep/observability/strict"
 *
 * const error = StrictSpoolError.make({ operation: "open", message: "Spool directory could not be created." })
 * error._tag // => "StrictSpoolError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StrictSpoolError extends S.TaggedError<StrictSpoolError, { readonly brand: unique symbol }>(
  $I`StrictSpoolError`
)(
  "StrictSpoolError",
  {
    operation: StrictSpoolOperation,
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
  },
  $I.annoteError<StrictSpoolError>("StrictSpoolError", {
    description: "The strict-tier encrypted spool or its key could not be used.",
  })
) {}
