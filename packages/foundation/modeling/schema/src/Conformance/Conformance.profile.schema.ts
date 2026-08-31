/**
 * Named conformance profile models.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("Conformance/profile");

const ConformanceProfileFields = S.Struct({
  id: S.NonEmptyString,
  title: S.NonEmptyString,
  version: S.NonEmptyString,
  description: S.NonEmptyString,
  sourceIds: S.NonEmptyArray(S.NonEmptyString),
  invariantIds: S.NonEmptyArray(S.NonEmptyString),
}).pipe(
  $I.annoteSchema("ConformanceProfileFields", {
    description: "Fields of a versioned conformance profile.",
  })
);

const ConformanceProfileConsistency = S.makeFilter(
  (profile: typeof ConformanceProfileFields.Type) =>
    A.dedupe(profile.sourceIds).length === profile.sourceIds.length &&
    A.dedupe(profile.invariantIds).length === profile.invariantIds.length,
  {
    identifier: $I`ConformanceProfileConsistency`,
    title: "Conformance profile identifier uniqueness",
    description: "A profile selects every source and invariant identifier at most once.",
    message: "Expected unique sourceIds and invariantIds within the conformance profile",
  }
);

const ConformanceProfileValue = ConformanceProfileFields.check(ConformanceProfileConsistency);

/**
 * Versioned set of sources and invariants implemented as one conformance profile.
 *
 * **Example** (Decode a CommonMark profile)
 *
 * ```ts import.meta.vitest name="Decode a CommonMark profile"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Profile } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Profile)({
 *   id: "commonmark",
 *   title: "CommonMark",
 *   version: "0.31.2",
 *   description: "CommonMark block and inline syntax supported by the Markdown AST.",
 *   sourceIds: ["commonmark-0.31.2"],
 *   invariantIds: ["commonmark.heading.level"]
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Source and invariant identifiers are unique within the profile.
 * @category specifications
 * @since 0.0.0
 */
export class ConformanceProfile extends S.Class<ConformanceProfile>($I`ConformanceProfile`)(
  ConformanceProfileValue,
  $I.annote("ConformanceProfile", {
    description: "Versioned set of sources and invariants implemented as one conformance profile.",
  })
) {
  static readonly toEquivalenceArray = ConformanceProfile.pipe(S.Array, SchemaUtils.toEquivalence);
}
