/**
 * Validation policy models for strict, diagnostic, and lossless boundaries.
 *
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { $SchemaId } from "../internal/SchemaId.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import { RequirementStrength } from "./Conformance.invariant.schema.ts";

const $I = $SchemaId.create("Conformance/policy");

const ConformancePolicyMode = LiteralKit(["strict", "diagnostic", "lossless"]);
const UnknownRepresentationPolicy = LiteralKit(["preserve", "wrap"]);

/**
 * Policy that rejects values violating configured conformance strengths.
 *
 * **Example** (Reject anything that breaks a MUST)
 *
 * ```ts
 * import { Policy, StrictPolicy } from "@beep/schema/Conformance"
 *
 * const policy = StrictPolicy.make({ profileIds: ["commonmark-0.31.2"], rejectOn: ["must", "mustNot"] })
 *
 * console.log(policy.mode) // => "strict"
 * console.log(Policy.guards.strict(policy)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictPolicy extends S.Opaque<StrictPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("strict"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    rejectOn: S.NonEmptyArray(RequirementStrength),
  }).pipe(
    $I.annoteSchema("StrictPolicy", {
      description: "Policy that rejects values violating configured conformance strengths.",
    })
  )
) {}

/**
 * Policy that reports configured conformance strengths without rejecting values.
 *
 * **Example** (Report SHOULD-level findings without rejecting)
 *
 * ```ts
 * import { DiagnosticPolicy } from "@beep/schema/Conformance"
 *
 * const policy = DiagnosticPolicy.make({ profileIds: ["gfm-0.29"], reportOn: ["should", "shouldNot"] })
 *
 * console.log(policy.reportOn) // => ["should", "shouldNot"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiagnosticPolicy extends S.Opaque<DiagnosticPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("diagnostic"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    reportOn: S.NonEmptyArray(RequirementStrength),
  }).pipe(
    $I.annoteSchema("DiagnosticPolicy", {
      description: "Policy that reports configured conformance strengths without rejecting values.",
    })
  )
) {}

/**
 * Policy that reports conformance while retaining unknown representations for round trips.
 *
 * **Example** (Preserve unknown nodes while reporting MUST findings)
 *
 * ```ts
 * import { LosslessPolicy, Policy } from "@beep/schema/Conformance"
 *
 * const policy = LosslessPolicy.make({
 *   profileIds: ["pandoc-ast-1.23"],
 *   reportOn: ["must"],
 *   unknownRepresentation: "preserve"
 * })
 *
 * console.log(Policy.isAnyOf(["diagnostic", "lossless"])(policy)) // => true
 * console.log(policy.unknownRepresentation) // => "preserve"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LosslessPolicy extends S.Opaque<LosslessPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("lossless"),
    profileIds: S.NonEmptyArray(S.NonEmptyString),
    reportOn: S.NonEmptyArray(RequirementStrength),
    unknownRepresentation: UnknownRepresentationPolicy,
  }).pipe(
    $I.annoteSchema("LosslessPolicy", {
      description: "Policy that reports conformance while retaining unknown representations for round trips.",
    })
  )
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
 * import * as Result from "effect/Result";
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
