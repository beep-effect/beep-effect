/**
 * Runtime-neutral typed failures for the practice KG MCP application.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeKgMcpId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
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
    cause: S.optionalKey(Defect({ includeStack: true })),
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
    cause: S.optionalKey(Defect({ includeStack: true })),
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
    cause: S.optionalKey(Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annoteError<SmokeFailure>("SmokeFailure", { description: "Sanitized compiled-host smoke failure." })
) {}
