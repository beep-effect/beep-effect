/**
 * Runtime-neutral typed failures for the practice KG MCP application.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeKgMcpId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $PracticeKgMcpId.create("PracticeKgMcp.errors");

/**
 * Sanitized packaging failure for the MCPB build entrypoint.
 *
 * **Example** (Create a packaging failure)
 *
 * ```ts
 * import { PackageFailure } from "../../src/PracticeKgMcp.errors.ts"
 *
 * const error = PackageFailure.make({ message: "Packaging failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PackageFailure extends S.TaggedError<PackageFailure>($I`PackageFailure`)(
  "PackageFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<PackageFailure>("PackageFailure", {
    description: "Sanitized failure from compiling or assembling an MCPB artifact.",
  })
) {}

/**
 * Sanitized startup failure while resolving a portable practice KG bundle.
 *
 * **Example** (Make PracticeKgHostError)
 *
 * ```ts
 * import { PracticeKgHostError } from "../../src/PracticeKgMcp.errors.ts"
 *
 * const error = PracticeKgHostError.make({ message: "Bundle directory is required." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgHostError extends S.TaggedError<PracticeKgHostError>($I`PracticeKgHostError`)(
  "PracticeKgHostError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<PracticeKgHostError>("PracticeKgHostError", {
    description: "Sanitized startup failure while resolving a portable practice KG bundle.",
  })
) {}

/**
 * Sanitized failure from the compiled MCP host smoke test.
 *
 * **Example** (Create a smoke failure)
 *
 * ```ts
 * import { SmokeFailure } from "../../src/PracticeKgMcp.errors.ts"
 *
 * const error = SmokeFailure.make({ message: "Compiled smoke failed." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SmokeFailure extends S.TaggedError<SmokeFailure>($I`SmokeFailure`)(
  "SmokeFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<SmokeFailure>("SmokeFailure", { description: "Sanitized compiled-host smoke failure." })
) {}

/**
 * Failure of a bundle check after its refusal has already been printed.
 *
 * **Details**
 *
 * The self-check owns stdout: it prints `{"ok":false,"message":…}` itself, so
 * Startup uses the same error after printing one refusal to stderr.
 * This error opts out of the main runner's own error log through
 * `Runtime.errorReported`. The process still exits non-zero.
 *
 * **Example** (Create a self-check failure)
 *
 * ```ts
 * import { SelfCheckFailure } from "../../src/PracticeKgMcp.errors.ts"
 *
 * const error = SelfCheckFailure.make({ message: "Bundle directory is required." })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SelfCheckFailure extends S.TaggedError<SelfCheckFailure>($I`SelfCheckFailure`)(
  "SelfCheckFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<SelfCheckFailure>("SelfCheckFailure", {
    description: "Bundle-check failure whose refusal was already printed.",
  })
) {
  override readonly [Runtime.errorReported] = false;
}
