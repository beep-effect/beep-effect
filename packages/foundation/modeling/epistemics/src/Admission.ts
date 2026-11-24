/**
 * Scoped admission arrows and explicit trusted verification ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { Anchored, mintOccurrenceId, OccurrenceId } from "@beep/text/Occurrence";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchorVerificationReceipt, VerifyTextAnchorInput, verifyTextAnchor } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ClaimId, Stance } from "./ClaimCore.schema.ts";
import { makeClaimArrows } from "./ClaimCore.ts";
import { ClaimLogEntry } from "./ClaimLog.schema.ts";
import { checkClaimLog, claimsAt, orphanedDerivations } from "./ClaimLog.ts";
import type * as Digest from "effect/crypto/Digest";
import type { FieldSchema, SchemaIdentity } from "./Factory/index.ts";

const $I = $EpistemicsId.create("Admission");
const PrimitiveId = S.Union([S.String, S.Finite]).pipe(
  $I.annoteSchema("PrimitiveId", {
    description: "The decoded id facets read by admission ports; owners retain their actual codecs.",
  })
);
const BindingFields = { actor: PrimitiveId, action: PrimitiveId, revision: PrimitiveId, scope: PrimitiveId };
const TokenView = S.Struct({
  ...BindingFields,
  issuedAt: S.DateTimeUtcFromMillis,
  attestation: Sha256PrefixedDigest,
}).pipe($I.annoteSchema("TokenView", { description: "The powerless token fields admission verification reads." }));
const AdmissionView = S.Struct({
  claim: ClaimId,
  ...BindingFields,
  token: TokenView,
  grounding: S.NonEmptyArray(TextAnchorVerificationReceipt),
  at: S.DateTimeUtcFromMillis,
  clearsRetraction: S.OptionFromOptionalKey(ContentHash),
}).pipe(
  $I.annoteSchema("AdmissionView", { description: "The claim-local admission fields read by the verification arrows." })
);
const RetractionView = S.Struct({
  claim: ClaimId,
  actor: PrimitiveId,
  reason: S.NonEmptyString,
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("RetractionView", {
    description: "The exact prior retraction whose digest an action may authorize clearing.",
  })
);
const StanceEventView = S.Struct({
  claim: ClaimId,
  stance: S.Literals(["verbatim", "proposed"]),
  at: S.DateTimeUtcFromMillis,
}).pipe(
  $I.annoteSchema("StanceEventView", { description: "Only non-authoritative stance events are writable directly." })
);
const BindingUnavailable = LiteralKit(["missing", "stale"]).pipe(
  $I.annoteSchema("BindingUnavailable", {
    description: "Trusted action state is absent or no longer matches the exact revision.",
  })
);
const TokenFailure = LiteralKit(["binding", "principal", "future", "unauthenticated"]).pipe(
  $I.annoteSchema("TokenFailure", { description: "Sanitized token verification refusals." })
);
const BindingFailure = LiteralKit([
  "missing",
  "stale",
  "claim-mismatch",
  "set-digest-mismatch",
  "clearing-mismatch",
  "missing-retraction",
]).pipe($I.annoteSchema("BindingFailure", { description: "Sanitized trusted claim-binding refusals." }));
/**
 * A trusted action revision resolves exact claim membership, independently of caller metadata.
 *
 * **Example** (Describe an absent trusted binding)
 *
 * ```ts
 * import { TrustedClaimBinding } from "@beep/epistemics/Admission"
 * console.log(TrustedClaimBinding.cases.Unavailable.make({ reason: "missing" })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TrustedClaimBinding = S.TaggedUnion({
  Claim: { claim: ClaimId, clearsRetraction: S.OptionFromOptionalKey(ContentHash) },
  ClaimSet: {
    digest: ContentHash,
    members: CanonicalHashSet(ClaimId),
    clearsRetraction: S.OptionFromOptionalKey(ContentHash),
  },
  Unavailable: { reason: BindingUnavailable },
}).pipe(
  $I.annoteSchema("TrustedClaimBinding", {
    description: "Only trusted immutable action state supplies this binding; a claimed digest alone grants nothing.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type TrustedClaimBinding = typeof TrustedClaimBinding.Type;
/**
 * Expected source-resolution outcomes under an already authorized scope.
 *
 * **Example** (Describe unavailable historical text)
 *
 * ```ts
 * import { SourceResolution } from "@beep/epistemics/Admission"
 * console.log(SourceResolution.cases.Unavailable.make({})._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceResolution = S.TaggedUnion({
  Resolved: { source: SourceTextIdentity, text: S.String },
  Missing: {},
  Stale: {},
  Ambiguous: {},
  Denied: {},
  Unavailable: {},
}).pipe(
  $I.annoteSchema("SourceResolution", {
    description: "Resolved canonical text or a sanitized expected refusal; unavailable history is explicitly unknown.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type SourceResolution = typeof SourceResolution.Type;
/**
 * The native generating activity and its explicit end time.
 *
 * **Example** (Inspect native generation facts)
 *
 * ```ts
 * import { GenerationFact } from "@beep/epistemics/Admission"
 * console.log(GenerationFact.fields.activity)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GenerationFact extends S.Opaque<GenerationFact, { readonly brand: unique symbol }>()(
  S.Struct({ activity: ActivityId, at: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("GenerationFact", {
      description: "Trusted native claim-generation facts; annotation generation times are not required.",
    })
  )
) {}
/**
 * Expected admission refusals carry only identifiers, indexes and sanitized reasons.
 *
 * **Example** (Describe empty grounding)
 *
 * ```ts
 * import { AdmissionRefused } from "@beep/epistemics/Admission"
 * import { ClaimId } from "@beep/epistemics/ClaimCore"
 * console.log(AdmissionRefused.cases.EmptyGrounding.make({ claim: ClaimId.make("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionRefused = S.TaggedUnion({
  EmptyGrounding: { claim: ClaimId },
  InvalidClaim: { claim: ClaimId },
  InvalidToken: { claim: ClaimId, reason: TokenFailure },
  InvalidBinding: { claim: ClaimId, reason: BindingFailure },
  DeniedScope: { claim: ClaimId },
  MissingGeneration: { claim: ClaimId },
  WrongClaimOccurrence: { claim: ClaimId, index: S.Natural, occurrence: OccurrenceId },
  GroundingInvalid: { claim: ClaimId, index: S.Natural },
  GroundingStale: { claim: ClaimId, index: S.Natural },
  GroundingMissing: { claim: ClaimId, index: S.Natural },
  GroundingAmbiguous: { claim: ClaimId, index: S.Natural },
  GroundingUnavailable: { claim: ClaimId, index: S.Natural },
}).pipe(
  $I.annoteSchema("AdmissionRefused", {
    description: "A refusal creates no admission or record append and mutates no coordinate or signal.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type AdmissionRefused = typeof AdmissionRefused.Type;
/**
 * Canonical immutable claim-set membership under a declared domain.
 *
 * **Example** (Read the trusted membership version)
 *
 * ```ts
 * import { ClaimSetPreimage } from "@beep/epistemics/Admission"
 * console.log(ClaimSetPreimage.domainTag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimSetPreimage = definePreimage({
  domainTag: DomainTag.make("claim-set/v1"),
  schema: S.Tuple([CanonicalHashSet(ClaimId)]),
  golden: {
    preimage: [
      [
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
    ],
    hash: ContentHash.make("sha256:b11588a0faf0111c170491cfebc99717f2508104c8b6b0358cb43b255f8ae40c"),
  },
});
/**
 * Digest the complete canonical encoded prior retraction, including its actor, reason and time.
 *
 * **Example** (Read the exact retraction version)
 *
 * ```ts
 * import { RetractionPreimage } from "@beep/epistemics/Admission"
 * console.log(RetractionPreimage.domainTag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RetractionPreimage = definePreimage({
  domainTag: DomainTag.make("claim-retraction/v1"),
  schema: S.Tuple([S.Json]),
  golden: {
    preimage: [
      {
        claim: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        actor: "fixture",
        reason: "withdrawn",
        at: 2000,
      },
    ],
    hash: ContentHash.make("sha256:7b0f5fe7853abd4054e2384e13ca5d34ef34a6163e9c8b15a557c826a01c2f99"),
  },
});
/**
 * Explicit trusted authority and text ports; infrastructure failures retain their typed error channel.
 *
 * **Example** (Read an authentication port)
 *
 * ```ts
 * import type { AdmissionPorts } from "@beep/epistemics/Admission"
 * const authenticationOf = (ports: AdmissionPorts) => ports.authenticate
 * console.log(typeof authenticationOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AdmissionPorts<
  Admission extends typeof AdmissionView.Type = typeof AdmissionView.Type,
  E = never,
  R = never,
> {
  readonly authenticate: (scope: Admission["scope"]) => Effect.Effect<O.Option<Admission["actor"]>, E, R>;
  readonly generation: (activity: ActivityId) => Effect.Effect<O.Option<GenerationFact>, E, R>;
  readonly resolveAt: (request: {
    readonly scope: Admission["scope"];
    readonly receipt: TextAnchorVerificationReceipt;
    readonly at: DateTime.Utc;
  }) => Effect.Effect<SourceResolution, E, R>;
  readonly resolveBinding: (request: {
    readonly actor: Admission["actor"];
    readonly action: Admission["action"];
    readonly revision: Admission["revision"];
    readonly scope: Admission["scope"];
  }) => Effect.Effect<TrustedClaimBinding, E, R>;
  readonly resolveCurrent: (request: {
    readonly scope: Admission["scope"];
    readonly receipt: TextAnchorVerificationReceipt;
  }) => Effect.Effect<SourceResolution, E, R>;
  readonly verifyToken: (token: Admission["token"]) => Effect.Effect<boolean, E, R>;
}

const IneligibleReason = LiteralKit([
  "not-selected",
  "unresolved-stance",
  "not-admitted",
  "unverified-admission",
  "direct-retraction",
  "derived-orphan",
]).pipe(
  $I.annoteSchema("IneligibleReason", {
    description: "Known reasons an immutable claim cannot qualify for outward use.",
  })
);
const UnknownReason = LiteralKit([
  "snapshot-unavailable",
  "ambiguous-grounding",
  "uncertain-retraction",
  "authorization-unavailable",
]).pipe(
  $I.annoteSchema("UnknownReason", {
    description: "Selected-time verification is incomplete and cannot grant eligibility.",
  })
);
/**
 * Eligibility is separate from stance and never substitutes for a product capability.
 *
 * **Example** (Describe a nonselected claim)
 *
 * ```ts
 * import { ClaimEligibility } from "@beep/epistemics/Admission"
 * console.log(ClaimEligibility.cases.Ineligible.make({ reasons: ["not-selected"] })._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimEligibility = S.TaggedUnion({
  Eligible: {},
  Ineligible: { reasons: S.NonEmptyArray(IneligibleReason) },
  Unknown: { reason: UnknownReason },
}).pipe(
  $I.annoteSchema("ClaimEligibility", {
    description: "Descriptive eligibility after explicit verification, not an authenticated product capability.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimEligibility = typeof ClaimEligibility.Type;
/**
 * A selected-time stance and eligibility view, or an explicit ambiguity refusal.
 *
 * **Example** (Inspect ambiguity refusals)
 *
 * ```ts
 * import { ClaimViewResult } from "@beep/epistemics/Admission"
 * console.log(ClaimViewResult.cases.AmbiguousStance.fields.claim)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimViewResult = S.TaggedUnion({
  Viewed: {
    claim: ClaimId,
    asOf: S.DateTimeUtcFromMillis,
    stance: S.OptionFromOptionalKey(Stance),
    eligibility: ClaimEligibility,
    directRetraction: S.Boolean,
    orphan: S.Boolean,
  },
  AmbiguousStance: { claim: ClaimId, at: S.DateTimeUtcFromMillis },
  InvalidLog: { claim: ClaimId },
}).pipe(
  $I.annoteSchema("ClaimViewResult", {
    description:
      "An explicit as-of projection; missing stance remains unresolved and unknown verification never passes.",
  })
);
/**
 * @category models
 * @since 0.0.0
 */
export type ClaimViewResult = typeof ClaimViewResult.Type;
const CheckResult = S.TaggedUnion({
  Verified: { clearsRetraction: S.OptionFromOptionalKey(ContentHash) },
  Refused: { refusal: AdmissionRefused },
}).pipe(
  $I.annoteSchema("CheckResult", {
    description: "Private verification output; no public decoder can supply it to an authority arrow.",
  })
);
class StanceSelection extends S.Opaque<StanceSelection, { readonly brand: unique symbol }>()(
  S.Struct({ at: S.OptionFromOptionalKey(S.DateTimeUtcFromMillis), stances: S.HashSet(Stance) }).pipe(
    $I.annoteSchema("StanceSelection", {
      description: "The latest compatible stance observations at an explicit selected time.",
    })
  )
) {}
class StanceObservation extends S.Opaque<StanceObservation, { readonly brand: unique symbol }>()(
  S.Struct({ at: S.DateTimeUtcFromMillis, stance: Stance }).pipe(
    $I.annoteSchema("StanceObservation", {
      description: "One authenticated admission stance or explicit non-authoritative stance event.",
    })
  )
) {}
const sameProjection = S.toEquivalence(ClaimLogEntry);
const isBindingUnavailable = S.is(BindingUnavailable);
const F = AdmissionRefused.cases;
const isUnknown = (refusal: AdmissionRefused): boolean =>
  AdmissionRefused.guards.GroundingUnavailable(refusal) || AdmissionRefused.guards.GroundingAmbiguous(refusal);
/**
 * Bind admission, revalidation and selected-time views to actual owner codecs and explicit ports.
 *
 * **Details**
 *
 * Selected views verify stored admissions at their admission time before observing stance.
 * Supply historicalPorts when historical authority evidence differs from selected-snapshot ports.
 * Decoding grants no authority; unavailable historical proof cannot establish admitted stance.
 * Selected-snapshot authorization and grounding govern eligibility independently.
 *
 * **Example** (Bind scoped admission arrows)
 *
 * ```ts
 * import { makeAdmissionArrows } from "@beep/epistemics/Admission"
 * console.log(typeof makeAdmissionArrows)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeAdmissionArrows = <
  CoreCodec extends Parameters<typeof makeClaimArrows>[0]["ClaimCore"],
  AdmissionCodec extends S.Top & {
    readonly Type: typeof AdmissionView.Type;
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
  RetractionCodec extends S.Top & {
    readonly Type: typeof RetractionView.Type;
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  },
>(binding: {
  readonly $I: SchemaIdentity;
  readonly ClaimCore: CoreCodec;
  readonly Admission: AdmissionCodec;
  readonly Retraction: RetractionCodec;
}) => {
  const core = makeClaimArrows(binding);
  type Record = Parameters<typeof core.encodeClaimRecord>[0];
  type Admission = AdmissionCodec["Type"];
  type Retraction = RetractionCodec["Type"];
  const admission: FieldSchema<Admission, AdmissionCodec["Encoded"], AdmissionCodec["~type.make.in"]> =
    binding.Admission;
  const AdmissionResult = S.TaggedUnion({ Admitted: { admission }, Refused: { refusal: AdmissionRefused } }).pipe(
    binding.$I.annoteSchema("AdmissionResult", {
      description:
        "An admission record or expected refusal; neither schema decoding nor this data union constructs a product capability.",
    })
  );
  const decodeAdmission = S.decodeUnknownEffect(S.toType(binding.Admission));
  const RetractionJson = S.toCodecJson(binding.Retraction);
  const encodeRetraction = S.encodeEffect(RetractionJson);
  const retractionDigest = Effect.fn("ClaimAdmission.retractionDigest")(function* (record: Retraction) {
    const encoded = yield* encodeRetraction(record);
    return yield* RetractionPreimage.mint([encoded]);
  });
  type Request<E, R> = {
    readonly record: Record;
    readonly actor: Admission["actor"];
    readonly action: Admission["action"];
    readonly revision: Admission["revision"];
    readonly scope: Admission["scope"];
    readonly token: Admission["token"];
    readonly grounding: ReadonlyArray<TextAnchorVerificationReceipt>;
    readonly at: DateTime.Utc;
    readonly clears: O.Option<Retraction>;
    readonly ports: AdmissionPorts<Admission, E, R>;
  };
  const check = Effect.fn("ClaimAdmission.check")(function* <E, R>(
    options: Request<E, R>,
    resolve: (receipt: TextAnchorVerificationReceipt) => Effect.Effect<SourceResolution, E, R>
  ): Effect.fn.Return<typeof CheckResult.Type, E, R | Digest.Digest> {
    const { record, token, ports, at } = options;
    const claim = record.claim;
    yield* Effect.annotateCurrentSpan({ "claim.id": claim, "claim.grounding_count": options.grounding.length });
    const refuse = (refusal: AdmissionRefused) => CheckResult.cases.Refused.make({ refusal });
    if (!A.isReadonlyArrayNonEmpty(options.grounding)) return refuse(F.EmptyGrounding.make({ claim }));
    const identity = yield* core.encodeClaimRecord(record).pipe(Effect.result);
    if (Result.isFailure(identity)) return refuse(F.InvalidClaim.make({ claim }));
    if (!Eq.equals(record.core.scope, options.scope)) return refuse(F.DeniedScope.make({ claim }));
    const authenticated = yield* ports.authenticate(options.scope);
    if (O.isNone(authenticated)) return refuse(F.DeniedScope.make({ claim }));
    if (!Eq.equals(authenticated.value, options.actor))
      return refuse(F.InvalidToken.make({ claim, reason: "principal" }));
    if (
      !Eq.equals(token.actor, options.actor) ||
      !Eq.equals(token.action, options.action) ||
      !Eq.equals(token.revision, options.revision) ||
      !Eq.equals(token.scope, options.scope)
    )
      return refuse(F.InvalidToken.make({ claim, reason: "binding" }));
    if (DateTime.isGreaterThan(token.issuedAt, at)) return refuse(F.InvalidToken.make({ claim, reason: "future" }));
    if (!(yield* ports.verifyToken(token))) return refuse(F.InvalidToken.make({ claim, reason: "unauthenticated" }));
    const trusted = yield* ports.resolveBinding({
      actor: options.actor,
      action: options.action,
      revision: options.revision,
      scope: options.scope,
    });
    if (TrustedClaimBinding.guards.Unavailable(trusted))
      return refuse(F.InvalidBinding.make({ claim, reason: trusted.reason }));
    if (TrustedClaimBinding.guards.Claim(trusted) && !Eq.equals(trusted.claim, claim))
      return refuse(F.InvalidBinding.make({ claim, reason: "claim-mismatch" }));
    if (TrustedClaimBinding.guards.ClaimSet(trusted)) {
      const digest = yield* ClaimSetPreimage.mint([trusted.members]).pipe(Effect.result);
      if (Result.isFailure(digest) || !Eq.equals(digest.success, trusted.digest))
        return refuse(F.InvalidBinding.make({ claim, reason: "set-digest-mismatch" }));
      if (!HashSet.has(trusted.members, claim))
        return refuse(F.InvalidBinding.make({ claim, reason: "claim-mismatch" }));
    }
    const generation = yield* ports.generation(record.core.generatedBy);
    if (
      O.isNone(generation) ||
      !Eq.equals(generation.value.activity, record.core.generatedBy) ||
      DateTime.isGreaterThan(generation.value.at, record.core.knowledgeStart)
    )
      return refuse(F.MissingGeneration.make({ claim }));
    let clearsRetraction = O.none<ContentHash>();
    if (O.isSome(options.clears)) {
      const prior = options.clears.value;
      if (!Eq.equals(prior.claim, claim) || !DateTime.isLessThan(prior.at, at))
        return refuse(F.InvalidBinding.make({ claim, reason: "clearing-mismatch" }));
      const digest = yield* retractionDigest(prior).pipe(Effect.result);
      if (Result.isFailure(digest) || !O.contains(trusted.clearsRetraction, digest.success))
        return refuse(F.InvalidBinding.make({ claim, reason: "clearing-mismatch" }));
      clearsRetraction = O.some(digest.success);
    }
    const indexed = A.map(options.grounding, (receipt, index): readonly [TextAnchorVerificationReceipt, number] => [
      receipt,
      index,
    ]);
    for (const [receipt, index] of indexed) {
      const occurrence = yield* mintOccurrenceId(Anchored.make({ receipt })).pipe(Effect.result);
      if (Result.isFailure(occurrence)) return refuse(F.GroundingInvalid.make({ claim, index }));
      if (!HashSet.has(record.core.supportAtCreation, occurrence.success))
        return refuse(F.WrongClaimOccurrence.make({ claim, index, occurrence: occurrence.success }));
    }
    for (const [receipt, index] of indexed) {
      const resolved = yield* resolve(receipt);
      const verified: Effect.Effect<
        Result.Result<void, AdmissionRefused>,
        never,
        Digest.Digest
      > = SourceResolution.match(resolved, {
        Resolved: (current) =>
          verifyTextAnchor(
            VerifyTextAnchorInput.make({
              expectedSource: receipt.source,
              source: current.source,
              sourceText: current.text,
              anchor: receipt.anchor,
            })
          ).pipe(
            Effect.match({
              onFailure: () => Result.fail(F.GroundingStale.make({ claim, index })),
              onSuccess: () => Result.void,
            })
          ),
        Missing: () => Effect.succeed(Result.fail(F.GroundingMissing.make({ claim, index }))),
        Stale: () => Effect.succeed(Result.fail(F.GroundingStale.make({ claim, index }))),
        Ambiguous: () => Effect.succeed(Result.fail(F.GroundingAmbiguous.make({ claim, index }))),
        Denied: () => Effect.succeed(Result.fail(F.DeniedScope.make({ claim }))),
        Unavailable: () => Effect.succeed(Result.fail(F.GroundingUnavailable.make({ claim, index }))),
      });
      const failure = yield* verified;
      if (Result.isFailure(failure)) return refuse(failure.failure);
    }
    return CheckResult.cases.Verified.make({ clearsRetraction });
  });
  const admit = Effect.fn("ClaimAdmission.admit")(function* <E, R>(
    options: Request<E, R>
  ): Effect.fn.Return<typeof AdmissionResult.Type, E, R | Digest.Digest> {
    const checked = yield* check(options, (receipt) => options.ports.resolveCurrent({ scope: options.scope, receipt }));
    if (CheckResult.guards.Refused(checked)) return AdmissionResult.cases.Refused.make({ refusal: checked.refusal });
    const candidate: unknown = {
      claim: options.record.claim,
      actor: options.actor,
      action: options.action,
      revision: options.revision,
      scope: options.scope,
      token: options.token,
      grounding: options.grounding,
      at: options.at,
      clearsRetraction: checked.clearsRetraction,
    };
    const decoded = yield* decodeAdmission(candidate).pipe(Effect.result);
    if (Result.isFailure(decoded))
      return AdmissionResult.cases.Refused.make({
        refusal: F.InvalidToken.make({ claim: options.record.claim, reason: "binding" }),
      });
    return { _tag: "Admitted", admission: decoded.success } satisfies typeof AdmissionResult.Type;
  });
  const revalidateAt = Effect.fn("ClaimAdmission.revalidate")(function* <E, R>(
    options: {
      readonly record: Record;
      readonly admission: Admission;
      readonly clears: O.Option<Retraction>;
      readonly ports: AdmissionPorts<Admission, E, R>;
    },
    snapshot: O.Option<DateTime.Utc>
  ): Effect.fn.Return<typeof AdmissionResult.Type, E, R | Digest.Digest> {
    const stored = options.admission;
    if (!Eq.equals(stored.claim, options.record.claim))
      return AdmissionResult.cases.Refused.make({ refusal: F.InvalidClaim.make({ claim: options.record.claim }) });
    const request: Request<E, R> = {
      ...options,
      actor: stored.actor,
      action: stored.action,
      revision: stored.revision,
      scope: stored.scope,
      token: stored.token,
      grounding: stored.grounding,
      at: stored.at,
    };
    const checked = yield* check(request, (receipt) =>
      O.match(snapshot, {
        onNone: () => options.ports.resolveCurrent({ scope: stored.scope, receipt }),
        onSome: (at) => options.ports.resolveAt({ scope: stored.scope, receipt, at }),
      })
    );
    if (CheckResult.guards.Refused(checked)) return AdmissionResult.cases.Refused.make({ refusal: checked.refusal });
    if (!Eq.equals(checked.clearsRetraction, stored.clearsRetraction))
      return AdmissionResult.cases.Refused.make({
        refusal: F.InvalidBinding.make({ claim: stored.claim, reason: "missing-retraction" }),
      });
    return { _tag: "Admitted", admission: stored } satisfies typeof AdmissionResult.Type;
  });
  const revalidate = Effect.fn("ClaimAdmission.revalidateCurrent")(function* <E, R>(options: {
    readonly record: Record;
    readonly admission: Admission;
    readonly clears: O.Option<Retraction>;
    readonly ports: AdmissionPorts<Admission, E, R>;
  }) {
    return yield* revalidateAt(options, O.none());
  });
  const viewAt = Effect.fn("ClaimAdmission.viewAt")(function* <E, R>(options: {
    readonly claim: ClaimId;
    readonly log: ReadonlyArray<ClaimLogEntry>;
    readonly records: HashMap.HashMap<ClaimId, Record>;
    readonly stances: ReadonlyArray<typeof StanceEventView.Type>;
    readonly admissions: ReadonlyArray<Admission>;
    readonly retractions: ReadonlyArray<Retraction>;
    readonly validSelection: HashSet.HashSet<ClaimId>;
    readonly asOf: DateTime.Utc;
    readonly historicalPorts?: AdmissionPorts<Admission, E, R>;
    readonly ports: AdmissionPorts<Admission, E, R>;
  }): Effect.fn.Return<ClaimViewResult, E, R | Digest.Digest> {
    const { claim, log, asOf, ports } = options;
    yield* Effect.annotateCurrentSpan({ "claim.id": claim, "claim.admission_count": options.admissions.length });
    if (!A.isReadonlyArrayEmpty(checkClaimLog(log))) return ClaimViewResult.cases.InvalidLog.make({ claim });
    const selected =
      HashSet.has(options.validSelection, claim) &&
      A.some(claimsAt(log, asOf), (entry) => Eq.equals(entry.claim, claim));
    if (!selected)
      return ClaimViewResult.cases.Viewed.make({
        claim,
        asOf,
        stance: O.none(),
        eligibility: ClaimEligibility.cases.Ineligible.make({ reasons: ["not-selected"] }),
        directRetraction: false,
        orphan: false,
      });
    for (const entry of log) {
      const model = HashMap.get(options.records, entry.claim);
      if (O.isNone(model)) return ClaimViewResult.cases.InvalidLog.make({ claim });
      const identity = yield* core.encodeClaimRecord(model.value).pipe(Effect.result);
      if (
        Result.isFailure(identity) ||
        !sameProjection(
          ClaimLogEntry.make({ ...model.value.core, claim: model.value.claim, generatedAt: entry.generatedAt }),
          entry
        )
      )
        return ClaimViewResult.cases.InvalidLog.make({ claim });
    }
    const retractions = A.filter(options.retractions, (record) => !DateTime.isGreaterThan(record.at, asOf));
    const digests = yield* Effect.forEach(retractions, retractionDigest, { concurrency: 1 }).pipe(Effect.result);
    if (Result.isFailure(digests)) return ClaimViewResult.cases.InvalidLog.make({ claim });
    const byDigest = HashMap.fromIterable(A.zip(digests.success, retractions));
    let cleared = HashSet.empty<ContentHash>();
    let maybeCleared = HashSet.empty<ContentHash>();
    let fresh = false;
    let unknown = O.none<typeof UnknownReason.Type>();
    let observations: ReadonlyArray<StanceObservation> = A.map(
      A.filter(options.stances, (event) => Eq.equals(event.claim, claim) && !DateTime.isGreaterThan(event.at, asOf)),
      (event) => StanceObservation.make({ at: event.at, stance: event.stance })
    );
    const known = HashSet.fromIterable(A.map(log, (entry) => entry.claim));
    for (const stored of A.filter(
      options.admissions,
      (record) => HashSet.has(known, record.claim) && !DateTime.isGreaterThan(record.at, asOf)
    )) {
      const record = O.getOrThrow(HashMap.get(options.records, stored.claim));
      const clears = O.flatMap(stored.clearsRetraction, (digest) => HashMap.get(byDigest, digest));
      const request = { record, admission: stored, clears, ports };
      const original = yield* revalidateAt({ ...request, ports: options.historicalPorts ?? ports }, O.some(stored.at));
      const verified = yield* revalidateAt(request, O.some(asOf));
      if (Eq.equals(stored.claim, claim)) {
        if (
          A.some(
            [original, verified],
            (result) =>
              AdmissionResult.guards.Refused(result) &&
              AdmissionRefused.guards.InvalidBinding(result.refusal) &&
              isBindingUnavailable(result.refusal.reason)
          )
        )
          unknown = O.some("authorization-unavailable");
        if (AdmissionResult.guards.Admitted(original))
          observations = A.append(observations, StanceObservation.make({ at: stored.at, stance: "admitted" }));
        if (AdmissionResult.guards.Admitted(original) && AdmissionResult.guards.Admitted(verified)) {
          fresh = true;
        } else if (AdmissionResult.guards.Refused(verified)) {
          if (isUnknown(verified.refusal))
            unknown = O.some(
              AdmissionRefused.guards.GroundingAmbiguous(verified.refusal)
                ? "ambiguous-grounding"
                : "snapshot-unavailable"
            );
        }
      }
      if (O.isSome(stored.clearsRetraction)) {
        if (AdmissionResult.guards.Admitted(original)) cleared = HashSet.add(cleared, stored.clearsRetraction.value);
        else if (isUnknown(original.refusal)) maybeCleared = HashSet.add(maybeCleared, stored.clearsRetraction.value);
      }
    }
    const selection = A.reduce(
      observations,
      StanceSelection.make({ at: O.none(), stances: HashSet.empty() }),
      (state, observation) => {
        const reset = () =>
          StanceSelection.make({
            at: O.some(observation.at),
            stances: HashSet.fromIterable<Stance>([observation.stance]),
          });
        return O.match(state.at, {
          onNone: reset,
          onSome: (at) =>
            Match.value(DateTime.Order(observation.at, at)).pipe(
              Match.when(1, reset),
              Match.when(0, () =>
                StanceSelection.make({ at: state.at, stances: HashSet.add(state.stances, observation.stance) })
              ),
              Match.orElse(() => state)
            ),
        });
      }
    );
    if (HashSet.size(selection.stances) > 1)
      return ClaimViewResult.cases.AmbiguousStance.make({ claim, at: O.getOrThrow(selection.at) });
    const stance = selection.stances.pipe(A.fromIterable, A.head);
    const possiblyRetracted = byDigest.pipe(
      HashMap.toEntries,
      A.filter(([digest]) => !HashSet.has(cleared, digest)),
      A.map(([, record]) => record.claim),
      HashSet.fromIterable
    );
    const definitelyRetracted = byDigest.pipe(
      HashMap.toEntries,
      A.filter(([digest]) => !HashSet.has(cleared, digest) && !HashSet.has(maybeCleared, digest)),
      A.map(([, record]) => record.claim),
      HashSet.fromIterable
    );
    const parents = HashMap.fromIterable(
      A.map(log, (entry): readonly [ClaimId, HashSet.HashSet<ClaimId>] => [entry.claim, entry.derivedFrom])
    );
    const directRetraction = HashSet.has(definitelyRetracted, claim);
    const orphan = HashSet.has(orphanedDerivations(parents, definitelyRetracted), claim);
    const maybeDead =
      HashSet.has(possiblyRetracted, claim) || HashSet.has(orphanedDerivations(parents, possiblyRetracted), claim);
    let reasons: ReadonlyArray<typeof IneligibleReason.Type> = [];
    if (O.isNone(stance) && O.isNone(unknown)) reasons = A.append(reasons, "unresolved-stance");
    else if (O.isSome(stance) && stance.value !== "admitted") reasons = A.append(reasons, "not-admitted");
    if (directRetraction) reasons = A.append(reasons, "direct-retraction");
    if (orphan) reasons = A.append(reasons, "derived-orphan");
    const eligibility = A.match(reasons, {
      onNonEmpty: (reasons) => ClaimEligibility.cases.Ineligible.make({ reasons }),
      onEmpty: (): ClaimEligibility => {
        if (maybeDead) return ClaimEligibility.cases.Unknown.make({ reason: "uncertain-retraction" });
        if (fresh) return ClaimEligibility.cases.Eligible.make({});
        return O.match(unknown, {
          onSome: (reason) => ClaimEligibility.cases.Unknown.make({ reason }),
          onNone: () => ClaimEligibility.cases.Ineligible.make({ reasons: ["unverified-admission"] }),
        });
      },
    });
    return ClaimViewResult.cases.Viewed.make({ claim, asOf, stance, eligibility, directRetraction, orphan });
  });
  return { AdmissionResult, admit, revalidate, revalidateAt, retractionDigest, viewAt };
};
