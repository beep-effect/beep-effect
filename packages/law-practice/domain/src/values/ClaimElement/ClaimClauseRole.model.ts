/**
 * Atomic source-role plans for inspection; independent of NLP drivers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { ClaimInputDecomposition } from "./ClaimElement.inspection.model.ts";
import { ClaimTermDeterminer } from "./ClaimElement.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimClauseRole");
/**
 * Source-proven nominal policy roles, with explicit unknown/legacy cases.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimNominalPolicyRole = LiteralKit([
  "legacy",
  "unknown",
  "generic-plural",
  "quantified-introduction",
  "preamble-introduction",
  "explicit-name",
  "alias-reference",
  "demonstrative-reference",
]).pipe(
  $I.annoteSchema("ClaimNominalPolicyRole", {
    description: "A grammatical role never supplies countability or identity from POS alone.",
  })
);
/**
 * Nominal policy role type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimNominalPolicyRole = typeof ClaimNominalPolicyRole.Type;
/**
 * Nominal source ownership; emitted text is never invented.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimNominalSpan extends S.Opaque<ClaimNominalSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    head: TextAnchor,
    determiner: ClaimTermDeterminer,
    role: ClaimNominalPolicyRole,
  }).pipe(
    $I.annoteSchema("ClaimNominalSpan", {
      description: "A complete source nominal with its lexical head interval and supported or unknown policy role.",
    })
  )
) {}
/**
 * Functional predicate span proven by grammar plus lexical evidence.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimPredicateSpan extends S.Opaque<ClaimPredicateSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    kind: S.Literals([
      "finite",
      "infinitive",
      "gerund",
      "auxiliary",
      "auxiliary-head",
      "possession",
      "adjectival",
      "adjunct",
    ]),
  }).pipe(
    $I.annoteSchema("ClaimPredicateSpan", {
      description: "Consumed predicate/function source interval; no object NP is consumed.",
    })
  )
) {}
/**
 * Source-owned grammatical clause with explicit predicate and nominal proof links.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimClauseSpan extends S.Opaque<ClaimClauseSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    kind: S.Literals(["main", "relative", "conditional", "complement"]),
    introducer: S.OptionFromNullOr(TextAnchor),
    predicates: S.Array(TextAnchor),
    nominals: S.Array(TextAnchor),
  }).pipe(
    $I.annoteSchema("ClaimClauseSpan", {
      description: "Grammatical ownership only; never physical ownership or a new dependency route.",
    })
  )
) {}
/**
 * Atomic plan, accepted only after source/work/coherence validation.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimClauseRolePlan extends S.Opaque<ClaimClauseRolePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    qualifiedText: S.NonEmptyString,
    nominals: S.Array(ClaimNominalSpan),
    predicates: S.Array(ClaimPredicateSpan),
    clauses: S.Array(ClaimClauseSpan),
  }).pipe(
    $I.annoteSchema("ClaimClauseRolePlan", {
      description: "One deterministic qualified-source plan shared by current and ancestor extraction.",
    })
  )
) {}

/**
 * Accepted whole-source plan keyed by its prepared claim identity.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimBoundRolePlan extends S.Opaque<ClaimBoundRolePlan, { readonly brand: unique symbol }>()(
  S.Struct({ claimNumber: PosInt, plan: ClaimClauseRolePlan }).pipe(
    $I.annoteSchema("ClaimBoundRolePlan", { description: "Accepted atomic source plan for a qualified unique claim." })
  )
) {}
/**
 * Decompositions with only successfully projected atomic plans.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimRoleDecomposition extends S.Opaque<ClaimRoleDecomposition, { readonly brand: unique symbol }>()(
  S.Struct({ decompositions: S.Array(ClaimInputDecomposition), plans: S.Array(ClaimBoundRolePlan) }).pipe(
    $I.annoteSchema("ClaimRoleDecomposition", {
      description: "No failed source plan can donate partial lexical or policy roles.",
    })
  )
) {}
