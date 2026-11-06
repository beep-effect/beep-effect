/**
 * Generic knowledge ledger contracts. Offsets always count UTF-16 code units.
 * @packageDocumentation
 * @since 0.0.0
 */
import { BasisDigest, makeClaimEnvelope } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Kb/Kb.schemas");
const RegistryId = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/)).pipe(
  $I.annoteSchema("RegistryId", { description: "Opaque ASCII registry id, safe for RDF and Markdown references." })
);

/**
 * Disclosure audience of a capture and its assertions.
 * **Example** (Recognize public evidence)
 * ```ts
 * import { Audience } from "@beep/repo-cli/commands/Kb"
 * console.log(Audience.is.public("public"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Audience = LiteralKit(["public", "internal", "personal"]).pipe(
  $I.annoteSchema("Audience", { description: "Disclosure audience, independent of proposition identity." })
);
/** Decoded disclosure audience.
 * @category models
 * @since 0.0.0
 */
export type Audience = typeof Audience.Type;

/**
 * Independent basis permitting outward use; none never qualifies.
 * **Example** (Recognize a public basis)
 * ```ts
 * import { DerivationBasis } from "@beep/repo-cli/commands/Kb"
 * console.log(DerivationBasis.is["public-source"]("public-source"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DerivationBasis = LiteralKit(["public-source", "own-public-work", "none"]).pipe(
  $I.annoteSchema("DerivationBasis", { description: "Why an assertion can support outward use." })
);
/** Decoded derivation basis.
 * @category models
 * @since 0.0.0
 */
export type DerivationBasis = typeof DerivationBasis.Type;

const SourceKind = LiteralKit([
  "web",
  "wayback",
  "wacz",
  "youtube",
  "linkedin",
  "x",
  "github",
  "registry",
  "omi",
  "internal-file",
  "chatgpt",
  "codex",
  "session",
  "git",
  "self-report",
]).pipe($I.annoteSchema("SourceKind", { description: "Acquisition systems; internal-file is internal-only." }));
const AssertionReview = LiteralKit(["accepted", "pending", "rejected"]).pipe(
  $I.annoteSchema("AssertionReview", {
    description: "Explicit evidence acceptance, separate from acquisition outcome.",
  })
);
const Outcome = LiteralKit(["captured", "needs-review", "abstain"]).pipe(
  $I.annoteSchema("Outcome", { description: "Acquisition outcome; captured does not imply accepted." })
);

/**
 * Locator and immutable content digest of a capture. Optional text enables exact anchor verification.
 * **Example** (Describe a synthetic source)
 * ```ts
 * import { SourceRef } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(S.is(SourceRef)({ kind: "web", locator: "https://example.com", sha256: "a".repeat(64) }))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class SourceRef extends S.Opaque<SourceRef, { readonly brand: unique symbol }>()(
  S.Struct({ kind: SourceKind, locator: S.NonEmptyString, sha256: BasisDigest, text: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("SourceRef", { description: "Capture identity and optional immutable extracted source text." })
  )
) {}

/**
 * Exact text selector or temporal media interval. Text positions are half-open UTF-16 offsets.
 * **Example** (Select a quote)
 * ```ts
 * import { Selector } from "@beep/repo-cli/commands/Kb"
 * const selector = Selector.cases.TextQuote.make({ exact: "Acme", prefix: "", suffix: "", start: 0, end: 4 })
 * console.log(selector._tag)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Selector = S.TaggedUnion({
  TextQuote: { exact: S.NonEmptyString, prefix: S.String, suffix: S.String, start: S.Natural, end: S.Natural },
  MediaFragment: {
    start: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    end: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  },
}).pipe($I.annoteSchema("Selector", { description: "Text quote with UTF-16 offsets or media fragment in seconds." }));
/** Decoded evidence selector.
 * @category models
 * @since 0.0.0
 */
export type Selector = typeof Selector.Type;

const Derivation = S.Struct({
  basis: DerivationBasis,
  ref: S.String,
  firstCommit: S.optionalKey(S.NonEmptyString),
}).pipe($I.annoteSchema("Derivation", { description: "An independently citable reference for outward use." }));

/**
 * One evidence item supporting or challenging a specific immutable claim version.
 * **Example** (Access the assertion decoder)
 * ```ts
 * import { Assertion } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(Assertion))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class Assertion extends S.Opaque<Assertion, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RegistryId,
    claimId: RegistryId,
    captureId: RegistryId,
    sourceRef: SourceRef,
    selector: Selector,
    quote: S.NonEmptyString,
    quoteDigest: BasisDigest,
    audience: Audience,
    derivation: Derivation,
    review: AssertionReview,
    outcome: Outcome,
  }).pipe(
    $I.annoteSchema("Assertion", {
      description: "Version-bound assertion with audience, anchors and independent derivation.",
    })
  )
) {}

const relationship = { subject: RegistryId, object: RegistryId, text: S.NonEmptyString };

/**
 * Generic relationship propositions; opaque entity ids never derive from names.
 * **Details**
 * The tag supplies the relationship predicate. Subject and object are registry ids;
 * text is the reviewed proposition wording. N-ary domain models can extend these cases later.
 * **Example** (Describe a fictional publication)
 * ```ts
 * import { KbProposition } from "@beep/repo-cli/commands/Kb"
 * const p = KbProposition.cases.Published.make({ subject: "entity/1", object: "entity/2", text: "Acme Widgets Co. published a guide." })
 * console.log(p._tag)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbProposition = S.TaggedUnion({
  HoldsRole: relationship,
  AccountOf: relationship,
  Published: relationship,
  UsesTechnology: relationship,
  Said: relationship,
  WorkedOn: relationship,
  FundingRound: relationship,
  Convergence: relationship,
  FitEvidence: relationship,
  Gap: relationship,
  ReferralAct: relationship,
  DefenseLink: relationship,
}).pipe($I.annoteSchema("KbProposition", { description: "Knowledge ledger relationship proposition family." }));
/** Decoded generic proposition.
 * @category models
 * @since 0.0.0
 */
export type KbProposition = typeof KbProposition.Type;

/**
 * Audience-free, unambiguous proposition identity including the reviewed wording.
 * **Example** (Compute a proposition key)
 * ```ts
 * import { kbLogicalKey, KbProposition } from "@beep/repo-cli/commands/Kb"
 * console.log(kbLogicalKey(KbProposition.cases.Gap.make({ subject: "1", object: "2", text: "A gap" })))
 * ```
 * @param p - Reviewed relationship proposition, without evidence or audience metadata.
 * @returns A length-delimited stable proposition key.
 * @category utilities
 * @since 0.0.0
 */
export const kbLogicalKey = (p: KbProposition): string =>
  `${p._tag}|${Str.length(p.subject)}:${p.subject}|${Str.length(p.object)}:${p.object}|${Str.length(p.text)}:${p.text}`;

const envelope = makeClaimEnvelope({
  $I,
  proposition: KbProposition,
  logicalKey: kbLogicalKey,
  ids: {
    claimVersion: RegistryId,
    assertion: RegistryId,
    activity: RegistryId,
    principal: RegistryId,
  },
});
/**
 * Bitemporal claim version using the shared epistemic envelope and its evidence-bound review.
 * **Example** (Access the claim decoder)
 * ```ts
 * import { KbClaim } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(typeof S.decodeUnknownEffect(KbClaim))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbClaim = envelope.ClaimVersion;
/** Decoded claim version.
 * @category models
 * @since 0.0.0
 */
export type KbClaim = typeof KbClaim.Type;

/**
 * Separate projection views; outward filters before any rendering.
 * **Example** (Recognize a view)
 * ```ts
 * import { KbView } from "@beep/repo-cli/commands/Kb"
 * console.log(KbView.is.outward("outward"))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const KbView = LiteralKit(["planning", "outward"]).pipe(
  $I.annoteSchema("KbView", { description: "Planning or outward disclosure boundary." })
);
/** Decoded projection view.
 * @category models
 * @since 0.0.0
 */
export type KbView = typeof KbView.Type;

/**
 * Validation result with claim ids eligible for outward projection and row-level violations.
 * **Example** (Validate the report shape)
 * ```ts
 * import { KbReport } from "@beep/repo-cli/commands/Kb"
 * import * as S from "effect/Schema"
 * console.log(S.is(KbReport)({ valid: true, claims: 0, assertions: 0, outwardEligible: [], violations: [] }))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbReport extends S.Opaque<KbReport, { readonly brand: unique symbol }>()(
  S.Struct({
    valid: S.Boolean,
    claims: S.Natural,
    assertions: S.Natural,
    outwardEligible: S.Array(S.NonEmptyString),
    violations: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KbReport", { description: "Structural validation and outward eligibility; no truth judgment." })
  )
) {}

/**
 * Decoded ledger and its cross-row validation result.
 * **Example** (Create an empty snapshot)
 * ```ts
 * import { KbSnapshot, KbReport } from "@beep/repo-cli/commands/Kb"
 * const snapshot = KbSnapshot.make({ claims: [], assertions: [], report: KbReport.make({ valid: true, claims: 0, assertions: 0, outwardEligible: [], violations: [] }) })
 * console.log(snapshot.report.valid)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class KbSnapshot extends S.Opaque<KbSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({ claims: S.Array(KbClaim), assertions: S.Array(Assertion), report: KbReport }).pipe(
    $I.annoteSchema("KbSnapshot", { description: "Decoded ledger and structural validation report." })
  )
) {}
