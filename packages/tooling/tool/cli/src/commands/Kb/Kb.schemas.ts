/**
 * Generic knowledge ledger contracts. Offsets always count UTF-16 code units.
 * @packageDocumentation
 * @since 0.0.0
 */
import { BasisDigest, makeClaimReview, ValidTime } from "@beep/epistemics/Claim";
import { ClaimId, makeClaimCore, makeClaimRecords } from "@beep/epistemics/ClaimCore.schema";
import { ClaimReference, claimReferenceKey, makeClaimImport } from "@beep/epistemics/ClaimImport.schema";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { ActivityStart } from "@beep/jsonc/ActivityStart";
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
 * One kb-assertion/v2 evidence item naming its claim through an explicit imported or native reference.
 *
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
    version: S.tag("kb-assertion/v2"),
    id: RegistryId,
    claim: ClaimReference,
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

const claimVocabulary = makeClaimCore({
  $I,
  proposition: KbProposition,
  ids: {
    logicalKey: kbLogicalKey,
    scope: S.NonEmptyString,
    principal: RegistryId,
    action: RegistryId,
    revision: RegistryId,
  },
});
const reviewVocabulary = makeClaimReview({
  $I,
  ids: { assertion: RegistryId, activity: RegistryId, principal: RegistryId },
});
const kbClaimRecordVersion = "kb-claim-record/v2";

/**
 * Native creation facts of one knowledge claim; every field participates in its ClaimId.
 *
 * **Example** (Inspect the core codec)
 *
 * ```ts
 * import { KbClaimCore } from "@beep/repo-cli/commands/Kb"
 * console.log(KbClaimCore.fields.logicalKey !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbClaimCore extends S.Opaque<KbClaimCore, { readonly brand: unique symbol }>()(
  claimVocabulary.ClaimCore
) {}

/**
 * The explicit agent that asserted a native knowledge claim.
 *
 * **Example** (Name a software agent)
 *
 * ```ts
 * import { KbAgentRef } from "@beep/repo-cli/commands/Kb"
 * console.log(KbAgentRef.cases.Person.make({ principal: "reviewer/1" })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KbAgentRef = claimVocabulary.AgentRef;

const records = makeClaimRecords({ $I, core: KbClaimCore });

/**
 * A native knowledge claim keyed by the content address of its core.
 *
 * **Example** (Inspect the keyed record)
 *
 * ```ts
 * import { KbCoreRecord } from "@beep/repo-cli/commands/Kb"
 * console.log(KbCoreRecord.fields.claim !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbCoreRecord extends S.Opaque<KbCoreRecord, { readonly brand: unique symbol }>()(records.ClaimRecord) {}

/**
 * Review payload of a knowledge claim, held outside its immutable core.
 *
 * **Example** (Build a proposed review)
 *
 * ```ts
 * import { KbReviewState } from "@beep/repo-cli/commands/Kb"
 * console.log(KbReviewState.cases.Proposed.make({})._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KbReviewState = reviewVocabulary.ReviewState;
/**
 * Decoded knowledge claim review payload.
 *
 * @category models
 * @since 0.0.0
 */
export type KbReviewState = typeof KbReviewState.Type;

/**
 * Five independent observations about a knowledge claim's evidence; no combined score.
 *
 * **Example** (Inspect the reviewer signal)
 *
 * ```ts
 * import { KbEvidenceSignals } from "@beep/repo-cli/commands/Kb"
 * console.log(KbEvidenceSignals.fields.reviewer !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbEvidenceSignals extends S.Opaque<KbEvidenceSignals, { readonly brand: unique symbol }>()(
  reviewVocabulary.EvidenceSignals
) {}

/**
 * A v2 event that appends one minted native core with its generating activity.
 *
 * **Example** (Inspect the event version)
 *
 * ```ts
 * import { KbCoreEvent } from "@beep/repo-cli/commands/Kb"
 * console.log(KbCoreEvent.fields.version !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbCoreEvent extends S.Opaque<KbCoreEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(kbClaimRecordVersion),
    event: S.tag("Core"),
    record: KbCoreRecord,
    activity: ActivityStart,
    generatedAt: S.DateTimeUtcFromMillis,
  }).pipe($I.annoteSchema("KbCoreEvent", { description: "A native core and the end of its generating activity." }))
) {}

const KbEvidenceEvent = S.Struct({
  version: S.tag(kbClaimRecordVersion),
  event: S.tag("Evidence"),
  claim: ClaimReference,
  supportedBy: S.Array(RegistryId),
  challengedBy: S.Array(RegistryId),
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("KbEvidenceEvent", {
    description: "A separate kb evidence record listing supporting and challenging refs for one claim.",
  })
);

const KbReviewEvent = S.Struct({
  version: S.tag(kbClaimRecordVersion),
  event: S.tag("Review"),
  claim: ClaimReference,
  review: KbReviewState,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("KbReviewEvent", {
    description: "A separate kb review record for one claim.",
  })
);

const KbSignalsEvent = S.Struct({
  version: S.tag(kbClaimRecordVersion),
  event: S.tag("Signals"),
  claim: ClaimReference,
  signals: KbEvidenceSignals,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("KbSignalsEvent", {
    description: "A separate kb evidence-signals record for one claim.",
  })
);

const KbSuccessionEvent = S.Struct({
  version: S.tag(kbClaimRecordVersion),
  event: S.tag("Succession"),
  claim: ClaimId,
  predecessor: ClaimReference,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("KbSuccessionEvent", {
    description: "A kb succession record linking a native core to the claim it replaces.",
  })
);

/**
 * Separate v2 records attached to an explicitly namespaced claim.
 *
 * **Details**
 * Evidence, review and signal records may target imported or native claims. A succession
 * links a native core to the imported claim it replaces, because a core's own predecessor
 * field accepts only a ClaimId.
 *
 * **Example** (Build a review record for an imported claim)
 *
 * ```ts
 * import { KbClaimEvent } from "@beep/repo-cli/commands/Kb"
 * import { ClaimReference } from "@beep/epistemics/ClaimImport.schema"
 * import * as DateTime from "effect/DateTime"
 * const event = KbClaimEvent.cases.Review.make({
 *   claim: ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim/1" }),
 *   review: { _tag: "Proposed" },
 *   at: DateTime.makeUnsafe(1)
 * })
 * console.log(event.event)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KbClaimEvent = S.Union([
  KbCoreEvent,
  KbEvidenceEvent,
  KbReviewEvent,
  KbSignalsEvent,
  KbSuccessionEvent,
]).pipe(
  S.toTaggedUnion("event"),
  $I.annoteSchema("KbClaimEvent", { description: "One kb-claim-record/v2 line; old envelopes are never written." })
);
/**
 * Decoded kb-claim-record/v2 event.
 *
 * @category models
 * @since 0.0.0
 */
export type KbClaimEvent = typeof KbClaimEvent.Type;

/**
 * Historical facts read from a frozen v1 claim row; never a native core or an admission.
 *
 * **Example** (Inspect the retained old identifier)
 *
 * ```ts
 * import { KbLegacyImported } from "@beep/repo-cli/commands/Kb"
 * console.log(KbLegacyImported.fields.oldId !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbLegacyImported extends S.Opaque<KbLegacyImported, { readonly brand: unique symbol }>()(
  makeClaimImport({ $I, ledger: "kb", proposition: KbProposition, review: KbReviewState, signals: KbEvidenceSignals })
) {}

const KbClaimSource = S.Union([KbLegacyImported, KbCoreEvent]).pipe(
  S.toTaggedUnion("version"),
  $I.annoteSchema("KbClaimSource", { description: "Imported history or a verified native core event." })
);

/**
 * Read-time join of one stored claim with its separate evidence, review and signal records.
 *
 * **Details**
 * The join is a projection for validation and rendering; it is never written back.
 *
 * **Example** (Inspect the join's reference)
 *
 * ```ts
 * import { KbClaim } from "@beep/repo-cli/commands/Kb"
 * console.log(KbClaim.fields.reference !== undefined)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class KbClaim extends S.Opaque<KbClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    source: KbClaimSource,
    reference: ClaimReference,
    predecessor: S.OptionFromOptionalKey(ClaimReference),
    evidence: S.Struct({ supportedBy: S.Array(S.String), challengedBy: S.Array(S.String) }),
    review: KbReviewState,
    signals: S.OptionFromOptionalKey(KbEvidenceSignals),
    knowledge: ClaimKnowledgeInterval,
    valid: ValidTime,
  }).pipe(
    $I.annoteSchema("KbClaim", { description: "Imported history or a native core joined with its separate records." })
  )
) {}

/**
 * Namespace-aware index key; equal-looking old and native identifiers never merge.
 *
 * **Example** (Key an imported claim)
 *
 * ```ts
 * import { kbClaimKey } from "@beep/repo-cli/commands/Kb"
 * console.log(typeof kbClaimKey)
 * ```
 *
 * @param claim - A stored or imported knowledge-base claim.
 * @returns The namespaced reference key of the claim.
 * @category utilities
 * @since 0.0.0
 */
export const kbClaimKey = (claim: KbClaim): string => claimReferenceKey(claim.reference);

/**
 * Rendered claim name: the old id of an imported claim, the ClaimId of a native one.
 *
 * **Example** (Render an imported reference)
 *
 * ```ts
 * import { kbReferenceLabel } from "@beep/repo-cli/commands/Kb"
 * import { ClaimReference } from "@beep/epistemics/ClaimImport.schema"
 * console.log(kbReferenceLabel(ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim/1" })))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const kbReferenceLabel: (reference: ClaimReference) => string = ClaimReference.match({
  Imported: ({ oldId }) => oldId,
  Native: ({ claim }) => claim,
});

/**
 * Rendered name of a joined claim.
 *
 * **Example** (Render a joined claim)
 *
 * ```ts
 * import { kbClaimLabel } from "@beep/repo-cli/commands/Kb"
 * console.log(typeof kbClaimLabel)
 * ```
 *
 * @param claim - A stored or imported knowledge-base claim.
 * @returns A short human-readable label for the claim reference.
 * @category projections
 * @since 0.0.0
 */
export const kbClaimLabel = (claim: KbClaim): string => kbReferenceLabel(claim.reference);

/**
 * The proposition a claim states, read from its imported history or native core.
 *
 * **Example** (Read the proposition)
 *
 * ```ts
 * import { kbProposition } from "@beep/repo-cli/commands/Kb"
 * console.log(typeof kbProposition)
 * ```
 *
 * @param claim - A stored or imported knowledge-base claim.
 * @returns The knowledge-base proposition the claim asserts.
 * @category projections
 * @since 0.0.0
 */
export const kbProposition = (claim: KbClaim): KbProposition =>
  KbClaimSource.match(claim.source, {
    "legacy-claim-import/v1": (imported) => imported.proposition,
    [kbClaimRecordVersion]: (event) => event.record.core.proposition,
  });

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
