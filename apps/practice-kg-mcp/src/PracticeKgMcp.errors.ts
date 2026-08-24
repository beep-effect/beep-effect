/**
 * Runtime-neutral typed failures for the practice KG MCP application.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeKgMcpId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PracticeKgMcpId.create("PracticeKgMcp.errors");

const PackageFailureFields = {
  cause: S.optionalKey(S.Defect({ includeStack: true })),
  message: S.NonEmptyString,
} satisfies S.Struct.Fields;
const PackageFailureEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  message: PackageFailureFields.message,
} satisfies S.Struct.Fields;
const samePackageFailureFields = S.toEquivalence(S.TaggedStruct("PackageFailure", PackageFailureEquivalenceFields));
const samePackageFailure = (self: PackageFailure, that: PackageFailure): boolean =>
  samePackageFailureFields(self, that);

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
  PackageFailureFields,
  $I.annoteClass<S.declare<PackageFailure>, readonly [S.TaggedStruct<"PackageFailure", typeof PackageFailureFields>]>(
    "PackageFailure",
    {
      description: "Sanitized failure from compiling or assembling an MCPB artifact.",

      toEquivalence: () => samePackageFailure,
    }
  )
) {}

const PracticeKgHostErrorFields = {
  cause: S.optionalKey(S.Defect({ includeStack: true })),
  message: S.NonEmptyString,
} satisfies S.Struct.Fields;
const PracticeKgHostErrorEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  message: PracticeKgHostErrorFields.message,
} satisfies S.Struct.Fields;
const samePracticeKgHostErrorFields = S.toEquivalence(
  S.TaggedStruct("PracticeKgHostError", PracticeKgHostErrorEquivalenceFields)
);
const samePracticeKgHostError = (self: PracticeKgHostError, that: PracticeKgHostError): boolean =>
  samePracticeKgHostErrorFields(self, that);

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
  PracticeKgHostErrorFields,
  $I.annoteClass<
    S.declare<PracticeKgHostError>,
    readonly [S.TaggedStruct<"PracticeKgHostError", typeof PracticeKgHostErrorFields>]
  >("PracticeKgHostError", {
    description: "Sanitized startup failure while resolving a portable practice KG bundle.",

    toEquivalence: () => samePracticeKgHostError,
  })
) {}

const SmokeFailureFields = {
  cause: S.optionalKey(S.Defect({ includeStack: true })),
  message: S.NonEmptyString,
} satisfies S.Struct.Fields;
const SmokeFailureEquivalenceFields = {
  // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  message: SmokeFailureFields.message,
} satisfies S.Struct.Fields;
const sameSmokeFailureFields = S.toEquivalence(S.TaggedStruct("SmokeFailure", SmokeFailureEquivalenceFields));
const sameSmokeFailure = (self: SmokeFailure, that: SmokeFailure): boolean => sameSmokeFailureFields(self, that);

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
  SmokeFailureFields,
  $I.annoteClass<S.declare<SmokeFailure>, readonly [S.TaggedStruct<"SmokeFailure", typeof SmokeFailureFields>]>(
    "SmokeFailure",
    { description: "Sanitized compiled-host smoke failure.", toEquivalence: () => sameSmokeFailure }
  )
) {}
