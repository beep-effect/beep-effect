/**
 * Typed failure of the Windows bootstrapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeSetupId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PracticeSetupId.create("Setup.errors");

/**
 * A bootstrapper operation failed; `message` is plain language the lawyer
 * can read.
 *
 * **Example** (Make a failure)
 *
 * ```ts
 * import { SetupFailure } from "@/Setup.errors"
 *
 * const failure = SetupFailure.make({ message: "Claude could not be installed." })
 * console.log(failure._tag) // "SetupFailure"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SetupFailure extends S.TaggedError<SetupFailure, { readonly brand: unique symbol }>($I`SetupFailure`)(
  "SetupFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<SetupFailure>("SetupFailure", {
    description: "A bootstrapper operation failed, described in plain language.",
  })
) {}
