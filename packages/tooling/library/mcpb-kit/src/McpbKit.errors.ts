/**
 * Typed failures for `.mcpb` packaging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpbKitId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $McpbKitId.create("McpbKit.errors");

/**
 * Sanitized failure from compiling or assembling an `.mcpb` artifact.
 *
 * **Details**
 *
 * The `cause` is ignored by equivalence, so two failures with the same message
 * compare equal. Apps map this failure into their own packaging error at the
 * command boundary.
 *
 * **Example** (Create a packaging failure)
 *
 * ```ts
 * import { McpbPackageFailure } from "@beep/mcpb-kit"
 *
 * const error = McpbPackageFailure.make({ message: "Packaging failed." })
 * console.log(error._tag) // "McpbPackageFailure"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class McpbPackageFailure extends S.TaggedError<McpbPackageFailure, { readonly brand: unique symbol }>(
  $I`McpbPackageFailure`
)(
  "McpbPackageFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<McpbPackageFailure>("McpbPackageFailure", {
    description: "Sanitized failure from compiling or assembling an MCPB artifact.",
  })
) {}
