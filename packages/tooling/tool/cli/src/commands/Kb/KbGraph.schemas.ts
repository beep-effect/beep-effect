/**
 * Wire contracts for deterministic knowledge graph exports.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Audience, KbView } from "./Kb.schemas.ts";

const $I = $RepoCliId.create("commands/Kb/KbGraph.schemas");
/**
 * Viewer entity categories.
 * **Example** (Access the KbGraphNodeType contract)
 * ```ts
 * import { KbGraphNodeType } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphNodeType))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbGraphNodeType = LiteralKit([
  "Organization",
  "Person",
  "Product",
  "Capability",
  "Artifact",
  "Document",
  "Video",
  "Podcast",
  "Role",
  "Concept",
  "Need",
  "Gap",
  "FundingRound",
  "Account",
  "Event",
]).pipe($I.annoteSchema("KbGraphNodeType", { description: "Viewer entity categories." }));
/** Decoded viewer entity categories.
 * @category models
 * @since 0.0.0
 */
export type KbGraphNodeType = typeof KbGraphNodeType.Type;
/**
 * Viewer review dispositions.
 * **Example** (Access the KbGraphReview contract)
 * ```ts
 * import { KbGraphReview } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphReview))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbGraphReview = LiteralKit(["proposed", "accepted", "disputed", "retracted"]).pipe(
  $I.annoteSchema("KbGraphReview", { description: "Viewer review dispositions." })
);
/** Decoded viewer review dispositions.
 * @category models
 * @since 0.0.0
 */
export type KbGraphReview = typeof KbGraphReview.Type;
/**
 * Viewer confidence categories, independent of review.
 * **Example** (Access the KbGraphConfidence contract)
 * ```ts
 * import { KbGraphConfidence } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphConfidence))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbGraphConfidence = LiteralKit(["verified", "reported", "inferred"]).pipe(
  $I.annoteSchema("KbGraphConfidence", { description: "Viewer confidence categories, independent of review." })
);
/** Decoded viewer confidence categories, independent of review.
 * @category models
 * @since 0.0.0
 */
export type KbGraphConfidence = typeof KbGraphConfidence.Type;
/**
 * Registry metadata for one opaque entity id.
 * **Example** (Access the KbRegistryNode contract)
 * ```ts
 * import { KbRegistryNode } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbRegistryNode))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbRegistryNode extends S.Opaque<KbRegistryNode, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    type: KbGraphNodeType,
    label: S.NonEmptyString,
    url: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
  }).pipe($I.annoteSchema("KbRegistryNode", { description: "Registry metadata for one opaque entity id." }))
) {}
/**
 * Entity with the strictest audience of its visible claims.
 * **Example** (Access the KbGraphNode contract)
 * ```ts
 * import { KbGraphNode } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphNode))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbGraphNode extends S.Opaque<KbGraphNode, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    type: KbGraphNodeType,
    label: S.NonEmptyString,
    url: S.optionalKey(S.String),
    description: S.optionalKey(S.String),
    audience: Audience,
    claimIds: S.Array(S.NonEmptyString).check(S.isMinLength(1)),
  }).pipe($I.annoteSchema("KbGraphNode", { description: "Entity with the strictest audience of its visible claims." }))
) {}
/**
 * Visible evidence without source text or internal derivation metadata.
 * **Example** (Access the KbGraphAssertion contract)
 * ```ts
 * import { KbGraphAssertion } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphAssertion))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbGraphAssertion extends S.Opaque<KbGraphAssertion, { readonly brand: unique symbol }>()(
  S.Struct({
    quote: S.String,
    sourceKind: S.NonEmptyString,
    locator: S.NonEmptyString,
    url: S.optionalKey(S.String),
    audience: Audience,
    capturedAt: S.String,
  }).pipe(
    $I.annoteSchema("KbGraphAssertion", {
      description: "Visible evidence without source text or internal derivation metadata.",
    })
  )
) {}
/**
 * Reviewed proposition and its filtered assertions.
 * **Example** (Access the KbGraphClaim contract)
 * ```ts
 * import { KbGraphClaim } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphClaim))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbGraphClaim extends S.Opaque<KbGraphClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString,
    review: KbGraphReview,
    confidence: KbGraphConfidence,
    assertions: S.Array(KbGraphAssertion),
  }).pipe($I.annoteSchema("KbGraphClaim", { description: "Reviewed proposition and its filtered assertions." }))
) {}
/**
 * Binary proposition linked to exactly one claim.
 * **Example** (Access the KbGraphLink contract)
 * ```ts
 * import { KbGraphLink } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraphLink))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbGraphLink extends S.Opaque<KbGraphLink, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    source: S.NonEmptyString,
    target: S.NonEmptyString,
    predicate: S.String.check(S.isPattern(/^[A-Za-z][A-Za-z0-9-]*:[^\s]+$/)),
    label: S.NonEmptyString,
    claimId: S.NonEmptyString,
    audience: Audience,
    review: KbGraphReview,
    confidence: KbGraphConfidence,
    validFrom: S.optionalKey(S.String),
    validTo: S.optionalKey(S.String),
  }).pipe($I.annoteSchema("KbGraphLink", { description: "Binary proposition linked to exactly one claim." }))
) {}
/**
 * Complete viewer JSON contract, encoded through Effect Schema.
 * **Example** (Access the KbGraph contract)
 * ```ts
 * import { KbGraph } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbGraph))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbGraph extends S.Opaque<KbGraph, { readonly brand: unique symbol }>()(
  S.Struct({
    view: KbView,
    builtAt: S.String,
    stats: S.Struct({ nodes: S.Natural, links: S.Natural, claims: S.Natural }),
    nodes: S.Array(KbGraphNode),
    links: S.Array(KbGraphLink),
    claims: S.Record(S.String, KbGraphClaim),
  }).pipe($I.annoteSchema("KbGraph", { description: "Complete viewer JSON contract, encoded through Effect Schema." }))
) {}
