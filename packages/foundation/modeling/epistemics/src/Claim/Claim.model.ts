/**
 * Bitemporal claim envelope over a slice-owned proposition.
 *
 * **Details**
 *
 * A claim version is one immutable ledger row: a proposition, the assertions
 * that support or challenge it, when it holds (valid time), when the system
 * knew it (knowledge time), its review state and five separate evidence
 * signals. The proposition and every id are supplied by the binding slice, so
 * this module carries no product identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { KnowledgeInterval } from "../KnowledgeInterval/index.ts";
import { ValidInterval, ValidIntervalFields } from "../ValidInterval/index.ts";
import type { FieldSchema, IdCodec, SchemaIdentity } from "../Factory/index.ts";

const $I = $EpistemicsId.create("Claim/Claim.model");

/**
 * Why an evidence signal is absent. Absence is never zero.
 *
 * **Example** (Decode an absence reason)
 *
 * ```ts
 * import { AbsenceReason } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(AbsenceReason)("not-assessed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AbsenceReason = LiteralKit(["not-assessed", "unavailable", "not-applicable", "legacy-unknown"]).pipe(
  $I.annoteSchema("AbsenceReason", { description: "Why an evidence signal is absent." })
);

/**
 * Decoded type of {@link AbsenceReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type AbsenceReason = typeof AbsenceReason.Type;

/**
 * Wrap a value schema as a signal that is either present or absent with a
 * reason.
 *
 * **Example** (A present trust signal)
 *
 * ```ts
 * import { makeSignal } from "@beep/epistemics/Claim"
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import * as S from "effect/Schema"
 *
 * const Trust = makeSignal(LiteralKit(["low", "high"]))
 * S.decodeUnknownSync(Trust)({ _tag: "Absent", reason: "not-assessed" })
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeSignal = <A extends S.Top>(value: A) =>
  S.TaggedUnion({ Present: { value }, Absent: { reason: AbsenceReason } });

/**
 * A typed measurement. A detector score, a cosine similarity and a calibrated
 * probability are different contracts and never share a field.
 *
 * **Example** (Decode a calibrated classifier probability)
 *
 * ```ts
 * import { Measurement } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * const m = S.decodeUnknownSync(Measurement)({
 *   _tag: "ClassifierProbability",
 *   value: 0.82,
 *   model: "detector-v1",
 *   calibrated: true,
 * })
 * console.log(m._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Measurement = S.TaggedUnion({
  Similarity: { value: S.Finite, metric: S.NonEmptyString, model: S.NonEmptyString },
  ClassifierProbability: {
    value: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })),
    model: S.NonEmptyString,
    calibrated: S.Boolean,
  },
  OrdinalJudgment: { level: LiteralKit(["low", "moderate", "high"]) },
}).pipe($I.annoteSchema("Measurement", { description: "Typed measurement; never a blended score." }));

/**
 * Decoded type of {@link Measurement}.
 *
 * @category models
 * @since 0.0.0
 */
export type Measurement = typeof Measurement.Type;

/**
 * Lowercase SHA-256 hex digest of the evidence basis a reviewer looked at.
 *
 * **Example** (Accept only a lowercase SHA-256 digest)
 *
 * ```ts
 * import { BasisDigest } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BasisDigest)("a".repeat(64))) // true
 * console.log(S.is(BasisDigest)("not-a-digest")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BasisDigest = S.String.check(
  S.isPattern(/^[0-9a-f]{64}$/, $I.annote("BasisDigestPattern", { description: "Lowercase SHA-256 hex." }))
).pipe($I.annoteSchema("BasisDigest", { description: "SHA-256 digest of a sealed evidence basis." }));

/**
 * Decoded type of {@link BasisDigest}.
 *
 * @category models
 * @since 0.0.0
 */
export type BasisDigest = typeof BasisDigest.Type;

/**
 * Structural verdict. `Admitted` means the candidate satisfied the shape
 * contract. It does not mean the claim is true.
 *
 * **Example** (Record a shape rejection)
 *
 * ```ts
 * import { StructuralVerdict } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * const verdict = S.decodeUnknownSync(StructuralVerdict)({ _tag: "ShapeRejected", violations: ["missing subject"] })
 * console.log(verdict._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StructuralVerdict = S.TaggedUnion({
  Admitted: {},
  ShapeRejected: { violations: S.NonEmptyArray(S.String) },
}).pipe($I.annoteSchema("StructuralVerdict", { description: "Shape verdict only." }));

/**
 * Decoded type of {@link StructuralVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type StructuralVerdict = typeof StructuralVerdict.Type;

/**
 * Review-state tags a projection may select.
 *
 * **Example** (Select accepted versions only)
 *
 * ```ts
 * import { ReviewTag } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * const states = S.decodeUnknownSync(S.Array(ReviewTag))(["Accepted"])
 * console.log(states)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReviewTag = LiteralKit(["Proposed", "Accepted", "Rejected", "Disputed", "Retracted"]).pipe(
  $I.annoteSchema("ReviewTag", { description: "Review-state tag." })
);

/**
 * Decoded type of {@link ReviewTag}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReviewTag = typeof ReviewTag.Type;

// Compiled once: ValidInterval already carries ValidIntervalOrderCheck.
const isOrderedValidInterval = S.is(ValidInterval);

/**
 * When a claim holds. `Unknown` is a real state, not an open interval: an
 * as-of-valid-time read never selects it.
 *
 * **Example** (Unknown valid time is a value, not a missing field)
 *
 * ```ts
 * import { ValidTime } from "@beep/epistemics/Claim"
 * import * as S from "effect/Schema"
 *
 * const unknown = S.decodeUnknownSync(ValidTime)({ _tag: "Unknown" })
 * const bounded = S.decodeUnknownSync(ValidTime)({ _tag: "Interval", validFrom: 0, validTo: 1_000 })
 * console.log(unknown._tag, bounded._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidTime = S.TaggedUnion({
  Unknown: {},
  Interval: ValidIntervalFields,
})
  .check(
    S.makeFilter(
      (validTime: { readonly _tag: "Unknown" } | ({ readonly _tag: "Interval" } & ValidInterval)) =>
        validTime._tag === "Unknown" || isOrderedValidInterval(validTime),
      $I.annote("ValidTimeOrderCheck", { description: "An Interval valid time is non-empty and forward." })
    )
  )
  .pipe($I.annoteSchema("ValidTime", { description: "Valid time: unknown, or a half-open interval." }));

/**
 * Decoded type of {@link ValidTime}.
 *
 * @category models
 * @since 0.0.0
 */
export type ValidTime = typeof ValidTime.Type;

/**
 * Bind the claim envelope to a slice's proposition schema and id brands.
 *
 * **Details**
 *
 * The returned schemas carry identifiers from the caller's `$I`, so two slices
 * binding the envelope get distinct schema identities. `logicalKey` is the
 * slice's own stable key for the proposition (two versions of the same fact
 * share it). The binding supplies its key function; decoding and encoding
 * reject a key that disagrees with the decoded proposition.
 *
 * **Example** (Bind the envelope for a tiny proposition)
 *
 * ```ts
 * import { makeClaimEnvelope } from "@beep/epistemics/Claim"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * import * as Str from "effect/String"
 *
 * const { ClaimVersion } = makeClaimEnvelope({
 *   $I: $ScratchpadId.create("example/Claim"),
 *   proposition: S.TaggedStruct("Knows", { left: S.String, right: S.String }),
 *   logicalKey: (p) => `Knows|${Str.length(p.left)}:${p.left}|${Str.length(p.right)}:${p.right}`,
 *   ids: {
 *     claimVersion: S.String.pipe(S.brand("ClaimVersionId")),
 *     assertion: S.String.pipe(S.brand("AssertionId")),
 *     activity: S.String.pipe(S.brand("ActivityId")),
 *     principal: S.String.pipe(S.brand("PrincipalId")),
 *   },
 * })
 * ClaimVersion.fields.logicalKey
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimEnvelope = <
  P extends S.Top,
  ClaimVersionId extends IdCodec,
  AssertionId extends IdCodec,
  ActivityId extends IdCodec,
  PrincipalId extends IdCodec,
>(config: {
  readonly $I: SchemaIdentity;
  readonly proposition: P;
  readonly logicalKey: (proposition: P["Type"]) => string;
  readonly ids: {
    readonly claimVersion: ClaimVersionId;
    readonly assertion: AssertionId;
    readonly activity: ActivityId;
    readonly principal: PrincipalId;
  };
}) => {
  const { $I: $C, ids } = config;

  const dispositionStruct = <D extends S.Top>(disposition: D) =>
    S.Struct({
      disposition,
      reviewer: ids.principal,
      basis: BasisDigest,
      reviewedAt: S.DateTimeUtcFromMillis,
      reason: S.NonEmptyString,
    });

  const ReviewerDisposition = LiteralKit(["accepted", "rejected", "abstained"]).pipe(
    dispositionStruct,
    $C.annoteSchema("ReviewerDisposition", {
      description: "A human disposition bound to the exact evidence basis it reviewed.",
    })
  );

  const EvidenceSignals = S.Struct({
    sourceTrust: makeSignal(LiteralKit(["low", "moderate", "high"])),
    sourceAssertedConfidence: makeSignal(Measurement),
    extractorConfidence: makeSignal(Measurement),
    validator: makeSignal(S.TaggedUnion({ Conforms: {}, Violations: { messages: S.NonEmptyArray(S.String) } })),
    reviewer: makeSignal(ReviewerDisposition),
  }).pipe($C.annoteSchema("EvidenceSignals", { description: "evidence-signals/v1: five separate signals, no score." }));

  const DependenceAssessment = S.Struct({
    left: ids.assertion,
    right: ids.assertion,
    dependence: LiteralKit(["independent", "dependent", "unknown"]),
    basis: S.NonEmptyString,
    producedBy: ids.activity,
  }).pipe(
    $C.annoteSchema("DependenceAssessment", {
      description: "Lineage between two assertions; unknown is never treated as independent.",
    })
  );

  const ReviewState = S.TaggedUnion({
    Proposed: {},
    // Each case carries its own disposition literal, so an Accepted state cannot hold a rejection.
    Accepted: { disposition: S.Literal("accepted").pipe(dispositionStruct) },
    Rejected: { disposition: S.Literal("rejected").pipe(dispositionStruct) },
    Disputed: { challengedBy: S.NonEmptyArray(ids.assertion), openedAt: S.DateTimeUtcFromMillis },
    Retracted: { reason: S.NonEmptyString, at: S.DateTimeUtcFromMillis },
  }).pipe($C.annoteSchema("ReviewState", { description: "Epistemic review state." }));

  const proposition: FieldSchema<P["Type"]> = S.toType(config.proposition);
  const hasClaimKey = S.is(S.Struct({ logicalKey: S.NonEmptyString, proposition }));

  const ClaimVersion = S.Struct({
    id: ids.claimVersion,
    logicalKey: S.NonEmptyString,
    proposition: config.proposition,
    supportedBy: S.NonEmptyArray(ids.assertion),
    challengedBy: S.Array(ids.assertion),
    validTime: ValidTime,
    knowledge: KnowledgeInterval,
    supersedes: S.OptionFromNullOr(ids.claimVersion),
    review: ReviewState,
    signals: EvidenceSignals,
  })
    .check(
      S.makeFilter(
        (claim: unknown) => hasClaimKey(claim) && claim.logicalKey === config.logicalKey(claim.proposition),
        $C.annote("ClaimLogicalKeyCheck", {
          description: "The logical key matches the slice-owned proposition key function.",
          message: "Expected logicalKey to match the proposition key.",
        })
      )
    )
    .pipe(
      $C.annoteSchema("ClaimVersion", {
        description: "One immutable bitemporal claim version; corrections append and expire, never update.",
      })
    );

  return { ReviewerDisposition, EvidenceSignals, DependenceAssessment, ReviewState, ClaimVersion };
};

/**
 * The fields a bitemporal read needs from a claim version. Every binding's
 * `ClaimVersion` satisfies it.
 *
 * @category models
 * @since 0.0.0
 */
const BitemporalVersionSchema = S.Struct({
  knowledge: KnowledgeInterval,
  review: S.Struct({ _tag: ReviewTag }),
  validTime: ValidTime,
}).pipe($I.annoteSchema("BitemporalVersion", { description: "Fields a bitemporal read selects on." }));

/**
 * Decoded type of {@link BitemporalVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type BitemporalVersion = typeof BitemporalVersionSchema.Type;

/**
 * A bitemporal read scope: what the system knew at `asOf`, about what held at
 * `validAt`, in the review states a consumer accepts.
 *
 * @category models
 * @since 0.0.0
 */
const BitemporalScopeSchema = S.Struct({
  asOf: S.DateTimeUtc,
  states: S.Array(ReviewTag),
  validAt: S.DateTimeUtc,
}).pipe($I.annoteSchema("BitemporalScope", { description: "Knowledge time, valid time and accepted review states." }));

/**
 * Decoded type of {@link BitemporalScope}.
 *
 * @category models
 * @since 0.0.0
 */
export type BitemporalScope = typeof BitemporalScopeSchema.Type;
