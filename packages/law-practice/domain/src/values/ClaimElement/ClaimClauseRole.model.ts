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
    remainingWork: S.Int,
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
 * Source attachment proof, independent of structural or physical ownership.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimFrameAttachment = LiteralKit([
  "main",
  "relative",
  "event-complement",
  "condition",
  "adjunct",
  "coordinate",
  "composition-child",
]).pipe(
  $I.annoteSchema("ClaimFrameAttachment", {
    description: "An admitted grammatical attachment; ambiguity declines the complete source plan.",
  })
);
/**
 * Grammatical attachment type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimFrameAttachment = typeof ClaimFrameAttachment.Type;
/**
 * Anchored grammatical argument, separate from physical or antecedent ownership.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFrameArgument extends S.Opaque<ClaimFrameArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    role: S.Literals(["subject", "object", "prepositional-complement", "nominal-modifier", "unknown"]),
    nominal: TextAnchor,
    predicate: S.OptionFromNullOr(TextAnchor),
    ownerNominal: S.OptionFromNullOr(TextAnchor),
  }).pipe(
    $I.annoteSchema("ClaimFrameArgument", {
      description:
        "Only source-attached syntactic argument proof; unknown does not supply identity or an introduction.",
    })
  )
) {}
/**
 * One enclosing frame with explicit attached-parent and argument provenance.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceFrame extends S.Opaque<ClaimSourceFrame, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: PosInt,
    extent: TextAnchor,
    lexicalHeader: TextAnchor,
    parent: S.OptionFromNullOr(PosInt),
    attachment: ClaimFrameAttachment,
    introducer: S.OptionFromNullOr(TextAnchor),
    predicates: S.Array(TextAnchor),
    nominals: S.Array(TextAnchor),
    coordination: S.OptionFromNullOr(PosInt),
    sharedSubject: S.OptionFromNullOr(TextAnchor),
    subject: S.OptionFromNullOr(TextAnchor),
    arguments: S.Array(ClaimFrameArgument),
  }).pipe(
    $I.annoteSchema("ClaimSourceFrame", {
      description: "Enclosing source frame retained around subordinate frames; never a physical ownership assertion.",
    })
  )
) {}
/**
 * Separate nominal core, lexical head and attached outer extent.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimAttachedNominal extends S.Opaque<ClaimAttachedNominal, { readonly brand: unique symbol }>()(
  S.Struct({ core: TextAnchor, head: TextAnchor, outer: TextAnchor, nominal: ClaimNominalSpan }).pipe(
    $I.annoteSchema("ClaimAttachedNominal", {
      description: "Public term projects the validated core; attached outer arguments never overlap its lexical head.",
    })
  )
) {}
/**
 * Source-backed element grouping production.
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimElementGrouping = LiteralKit([
  "preamble",
  "explicit-list-header",
  "enumeration-child",
  "composition-header",
  "composition-child",
  "independent-coordinate",
  "introduced-restriction",
  "shared-subject-continuation",
  "single-restriction",
  "nominal-leaf",
  "adjectival-property",
]).pipe(
  $I.annoteSchema("ClaimElementGrouping", {
    description: "Admitted structural production; no source IDs or expected counts participate.",
  })
);
/**
 * Structural grouping type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementGrouping = typeof ClaimElementGrouping.Type;
/**
 * Complete local element identity before source-ordered path assignment.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimPlannedElement extends S.Opaque<ClaimPlannedElement, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: PosInt,
    parent: S.OptionFromNullOr(PosInt),
    extent: TextAnchor,
    lexicalHeader: TextAnchor,
    kind: S.Literals(["preamble-subject", "limitation", "sub-limitation", "functional-relation"]),
    grouping: ClaimElementGrouping,
    nominals: S.Array(ClaimNominalSpan),
  }).pipe(
    $I.annoteSchema("ClaimPlannedElement", {
      description:
        "Atomic enhanced element extent, parent and exclusive nominal ownership before public path projection.",
    })
  )
) {}
/**
 * Accepted complete structural plan; failed candidates donate no source facts.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimListDeclaration extends S.Opaque<ClaimListDeclaration, { readonly brand: unique symbol }>()(
  S.Struct({ owner: PosInt, anchor: TextAnchor, items: S.Array(S.Struct({ label: TextAnchor, child: PosInt })) }).pipe(
    $I.annoteSchema("ClaimListDeclaration", {
      description:
        "Exact declaration and excluded source labels bound to their admitted structural owner and child ordinals.",
    })
  )
) {}
/**
 * Accepted complete structural plan with source declarations and role proofs.
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceElementPlan extends S.Opaque<ClaimSourceElementPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    qualifiedText: S.NonEmptyString,
    remainingWork: S.Int,
    frames: S.Array(ClaimSourceFrame),
    nominals: S.Array(ClaimAttachedNominal),
    elements: S.Array(ClaimPlannedElement),
    declarations: S.Array(ClaimListDeclaration),
    roles: ClaimClauseRolePlan,
  }).pipe(
    $I.annoteSchema("ClaimSourceElementPlan", {
      description:
        "One immutable source plan shared by every current and ancestor appearance; route resolution cannot mutate it.",
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
  S.Struct({ claimNumber: PosInt, plan: ClaimClauseRolePlan, sourcePlan: ClaimSourceElementPlan }).pipe(
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
