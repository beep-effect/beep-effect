/**
 * Validation policy models for strict, diagnostic, and lossless boundaries.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { LiteralKit } from "../LiteralKit/index.ts";
import { RequirementStrength } from "./Conformance.invariant.schema.ts";

const $I = $SchemaId.create("Conformance/policy");

const ConformancePolicyMode = LiteralKit(["strict", "diagnostic", "lossless"]);
const UnknownRepresentationPolicy = LiteralKit(["preserve", "wrap"]);

class StrictPolicy extends S.Class<StrictPolicy>($I`StrictPolicy`)(
  {
    mode: S.tag("strict"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    rejectOn: S.NonEmptyArray(RequirementStrength),
  },
  $I.annote("StrictPolicy", {
    description: "Policy that rejects values violating configured conformance strengths.",
  })
) {}

class DiagnosticPolicy extends S.Class<DiagnosticPolicy>($I`DiagnosticPolicy`)(
  {
    mode: S.tag("diagnostic"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    reportOn: S.NonEmptyArray(RequirementStrength),
  },
  $I.annote("DiagnosticPolicy", {
    description: "Policy that reports configured conformance strengths without rejecting values.",
  })
) {}

class LosslessPolicy extends S.Class<LosslessPolicy>($I`LosslessPolicy`)(
  {
    mode: S.tag("lossless"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    reportOn: S.NonEmptyArray(RequirementStrength),
    unknownRepresentation: UnknownRepresentationPolicy,
  },
  $I.annote("LosslessPolicy", {
    description: "Policy that reports conformance while retaining unknown representations for round trips.",
  })
) {}

/**
 * Discriminated validation policy that keeps strict rejection separate from lossless preservation.
 *
 * **Details**
 *
 * Strict and diagnostic policies cannot carry lossless unknown-representation
 * behavior. Lossless policies still name the requirement strengths to report,
 * but preservation does not imply that the retained value conforms.
 *
 * **Example** (Decode a strict policy)
 *
 * ```ts import.meta.vitest name="Decode a strict policy"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Policy } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Policy)({
 *   mode: "strict",
 *   profileIds: ["whatwg-html"],
 *   rejectOn: ["must", "mustNot"]
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const ConformancePolicy = ConformancePolicyMode.mapMembers(
  Tuple.evolve([() => StrictPolicy, () => DiagnosticPolicy, () => LosslessPolicy])
).pipe(
  S.toTaggedUnion("mode"),
  $I.annoteSchema("ConformancePolicy", {
    description: "Discriminated validation policy separating strict, diagnostic, and lossless boundaries.",
  })
);

/**
 * Runtime validation policy represented by {@link ConformancePolicy}.
 *
 * @see {@link ConformancePolicy} for constructors and exhaustive matching.
 * @category policies
 * @since 0.0.0
 */
export type ConformancePolicy = typeof ConformancePolicy.Type;
