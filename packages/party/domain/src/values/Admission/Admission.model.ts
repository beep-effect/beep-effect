/**
 * Usage-tier admission: a proof that is minted, not a flag that is stored.
 *
 * **Details**
 * An `AdmissionPolicy` is versioned data: a tier plus a conjunction of
 * clauses, each reading one evidence channel. `admit` evaluates a claim
 * version against a policy and either mints an `Admitted<Tier>` (a branded
 * value only this module can construct) or returns the exact unmet clauses.
 * Work-product builders accept only `Admitted<"deposition-ready">`, so the
 * compiler refuses a weak attribution.
 *
 * There is deliberately no schema decoder for `Admitted`. A persisted
 * admission is an `AdmissionRecord`; rehydrating it means re-running `admit`
 * at the recorded knowledge time and checking the basis digest still matches.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { knownAt } from "@beep/epistemics/KnowledgeInterval";
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { thunkEmptyArray } from "@beep/utils";
import * as A from "effect/Array";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ClaimVersion, DependenceAssessment, ReviewState } from "../../Claim.ts";
import { EvidenceKind } from "../../Communication.ts";
import { AssertionId, ClaimVersionId } from "../../Ids.ts";
import { Proposition } from "../../Proposition.ts";
import { CollectionSide } from "../../Provenance.ts";
import type * as DateTime from "effect/DateTime";

const $I = $PartyDomainId.create("values/Admission/Admission.model");

/**
 * Usage tiers, weakest first.
 *
 * **Example** (Decode AdmissionTier)
 * ```ts
 * import { AdmissionTier } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionTier)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionTier = LiteralKit(["analyst-lead", "client-facing", "deposition-ready"]).pipe(
  $I.annoteSchema("AdmissionTier", { description: "Usage tier an admission authorizes." })
);
/**
 * Decoded AdmissionTier type.
 * @category models
 * @since 0.0.0
 */
export type AdmissionTier = typeof AdmissionTier.Type;

/**
 * One requirement of a policy. Each clause reads one channel; no clause
 * blends signals into a score.
 *
 * **Example** (Decode MinIndependentSupport)
 * ```ts
 * import { MinIndependentSupport } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MinIndependentSupport)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MinIndependentSupport extends S.Opaque<MinIndependentSupport, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MinIndependentSupport", {
    n: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    unknownCountsAs: LiteralKit(["dependent", "independent"]),
  }).pipe($I.annoteSchema("MinIndependentSupport", { description: "MinIndependentSupport data." }))
) {}
/**
 * RequireReviewerAcceptance payload with validated role fields.
 *
 * **Example** (Decode RequireReviewerAcceptance)
 * ```ts
 * import { RequireReviewerAcceptance } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(RequireReviewerAcceptance)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RequireReviewerAcceptance extends S.Opaque<RequireReviewerAcceptance, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RequireReviewerAcceptance", {}).pipe(
    $I.annoteSchema("RequireReviewerAcceptance", { description: "RequireReviewerAcceptance data." })
  )
) {}
/**
 * NoOpenChallenge payload with validated role fields.
 *
 * **Example** (Decode NoOpenChallenge)
 * ```ts
 * import { NoOpenChallenge } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(NoOpenChallenge)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NoOpenChallenge extends S.Opaque<NoOpenChallenge, { readonly brand: unique symbol }>()(
  S.TaggedStruct("NoOpenChallenge", {}).pipe(
    $I.annoteSchema("NoOpenChallenge", { description: "NoOpenChallenge data." })
  )
) {}
/**
 * RequireDistinctiveEvidence payload with validated role fields.
 *
 * **Example** (Decode RequireDistinctiveEvidence)
 * ```ts
 * import { RequireDistinctiveEvidence } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(RequireDistinctiveEvidence)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RequireDistinctiveEvidence extends S.Opaque<
  RequireDistinctiveEvidence,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("RequireDistinctiveEvidence", {}).pipe(
    $I.annoteSchema("RequireDistinctiveEvidence", { description: "RequireDistinctiveEvidence data." })
  )
) {}
/**
 * RequireSupportOutsideSide payload with validated role fields.
 *
 * **Example** (Decode RequireSupportOutsideSide)
 * ```ts
 * import { RequireSupportOutsideSide } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(RequireSupportOutsideSide)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RequireSupportOutsideSide extends S.Opaque<RequireSupportOutsideSide, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RequireSupportOutsideSide", { side: CollectionSide }).pipe(
    $I.annoteSchema("RequireSupportOutsideSide", { description: "RequireSupportOutsideSide data." })
  )
) {}
/**
 * SupportsInVersion payload with validated role fields.
 *
 * **Example** (Decode SupportsInVersion)
 * ```ts
 * import { SupportsInVersion } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SupportsInVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SupportsInVersion extends S.Opaque<SupportsInVersion, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SupportsInVersion", {}).pipe(
    $I.annoteSchema("SupportsInVersion", { description: "SupportsInVersion data." })
  )
) {}
/**
 * KnownAtKnowledgeTime payload with validated role fields.
 *
 * **Example** (Decode KnownAtKnowledgeTime)
 * ```ts
 * import { KnownAtKnowledgeTime } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(KnownAtKnowledgeTime)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KnownAtKnowledgeTime extends S.Opaque<KnownAtKnowledgeTime, { readonly brand: unique symbol }>()(
  S.TaggedStruct("KnownAtKnowledgeTime", {}).pipe(
    $I.annoteSchema("KnownAtKnowledgeTime", { description: "KnownAtKnowledgeTime data." })
  )
) {}
/**
 * AdmissionClause public schema for the admission model.
 *
 * **Example** (Decode AdmissionClause)
 * ```ts
 * import { AdmissionClause } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionClause)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionClause = S.Union([
  MinIndependentSupport,
  RequireReviewerAcceptance,
  NoOpenChallenge,
  RequireDistinctiveEvidence,
  RequireSupportOutsideSide,
  SupportsInVersion,
  KnownAtKnowledgeTime,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("AdmissionClause", { description: "One admission requirement." }));
/**
 * Decoded AdmissionClause type.
 * @category models
 * @since 0.0.0
 */
export type AdmissionClause = typeof AdmissionClause.Type;

/**
 * Versioned admission policy.
 *
 * **Example** (Decode AdmissionPolicy)
 * ```ts
 * import { AdmissionPolicy } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionPolicy)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class AdmissionPolicy extends S.Opaque<AdmissionPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.NonEmptyString,
    version: S.NonEmptyString,
    tier: AdmissionTier,
    clauses: S.NonEmptyArray(AdmissionClause),
  }).pipe($I.annoteSchema("AdmissionPolicy", { description: "Versioned admission policy." }))
) {}

/**
 * What one supporting assertion contributes to admission.
 *
 * **Example** (Decode SupportFacts)
 * ```ts
 * import { SupportFacts } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SupportFacts)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class SupportFacts extends S.Opaque<SupportFacts, { readonly brand: unique symbol }>()(
  S.Struct({ assertion: AssertionId, side: CollectionSide, kind: EvidenceKind }).pipe(
    $I.annoteSchema("SupportFacts", { description: "SupportFacts admission data." })
  )
) {}

/**
 * Evidence an admission is evaluated against.
 *
 * **Example** (Decode AdmissionEvidence)
 * ```ts
 * import { AdmissionEvidence } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionEvidence)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class AdmissionEvidence extends S.Opaque<AdmissionEvidence, { readonly brand: unique symbol }>()(
  S.Struct({ version: ClaimVersion, supports: S.Array(SupportFacts), dependence: S.Array(DependenceAssessment) }).pipe(
    $I.annoteSchema("AdmissionEvidence", { description: "AdmissionEvidence admission data." })
  )
) {}

/**
 * PolicyReference public schema for the admission model.
 *
 * **Example** (Decode PolicyReference)
 * ```ts
 * import { PolicyReference } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(PolicyReference)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class PolicyReference extends S.Opaque<PolicyReference, { readonly brand: unique symbol }>()(
  S.Struct({ id: S.NonEmptyString, version: S.NonEmptyString }).pipe(
    $I.annoteSchema("PolicyReference", { description: "PolicyReference admission data." })
  )
) {}
/**
 * UnmetClause public schema for the admission model.
 *
 * **Example** (Decode UnmetClause)
 * ```ts
 * import { UnmetClause } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(UnmetClause)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class UnmetClause extends S.Opaque<UnmetClause, { readonly brand: unique symbol }>()(
  S.Struct({ clause: AdmissionClause, saw: S.NonEmptyString }).pipe(
    $I.annoteSchema("UnmetClause", { description: "UnmetClause admission data." })
  )
) {}
/**
 * SupportCountInput public schema for the admission model.
 *
 * **Example** (Decode SupportCountInput)
 * ```ts
 * import { SupportCountInput } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(SupportCountInput)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class SupportCountInput extends S.Opaque<SupportCountInput, { readonly brand: unique symbol }>()(
  S.Struct({
    supports: S.Array(AssertionId),
    dependence: S.Array(DependenceAssessment),
    unknownCountsAs: S.Literals(["dependent", "independent"]),
  }).pipe($I.annoteSchema("SupportCountInput", { description: "SupportCountInput admission data." }))
) {}
/** Module-private mint token: code outside this module cannot obtain it, so cannot construct a proof. */
const mintToken: unique symbol = Symbol("party/Admission/mint");

/**
 * Proof that a claim version met a tier's policy at a knowledge time.
 * Constructible only by `admit`: the constructor demands a token that never
 * leaves this module. The private `#tier` field makes the class nominal.
 *
 * **Example** (Require a strong proof)
 * ```ts
 * import type { Admitted } from "@beep/party-domain/Admission"
 * const tier = (proof: Admitted<"deposition-ready">) => proof.provenTier
 * ```
 * @category models
 * @since 0.0.0
 */
export class Admitted<T extends AdmissionTier> {
  readonly #tier: T;
  readonly tier: T;
  readonly claimVersion: ClaimVersion;
  readonly policy: PolicyReference;
  readonly knowledgeTime: DateTime.Utc;
  readonly basis: ReadonlyArray<AssertionId>;

  constructor(
    token: typeof mintToken,
    fields: {
      readonly tier: T;
      readonly claimVersion: ClaimVersion;
      readonly policy: PolicyReference;
      readonly knowledgeTime: DateTime.Utc;
      readonly basis: ReadonlyArray<AssertionId>;
    }
  ) {
    void token;
    this.#tier = fields.tier;
    this.tier = fields.tier;
    this.claimVersion = fields.claimVersion;
    this.policy = fields.policy;
    this.knowledgeTime = fields.knowledgeTime;
    this.basis = fields.basis;
  }

  /** The tier this proof was minted for (nominal: not forgeable by structural typing). */
  get provenTier(): T {
    return this.#tier;
  }
}

/**
 * Serializable record of an admission. Not a proof: re-admit to rehydrate.
 *
 * **Example** (Decode AdmissionRecord)
 * ```ts
 * import { AdmissionRecord } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionRecord)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class AdmissionRecord extends S.Opaque<AdmissionRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    tier: AdmissionTier,
    claimVersion: ClaimVersionId,
    policyId: S.NonEmptyString,
    policyVersion: S.NonEmptyString,
    knowledgeTime: S.DateTimeUtcFromMillis,
  }).pipe($I.annoteSchema("AdmissionRecord", { description: "Serializable admission record; not a proof." }))
) {}

/**
 * The refusal names every unmet clause with what it saw. It doubles as an
 * analyst worklist: find a second independent channel, resolve challenge X.
 *
 * **Example** (Decode AdmissionRefused)
 * ```ts
 * import { AdmissionRefused } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(AdmissionRefused)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class AdmissionRefused extends S.Opaque<AdmissionRefused, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AdmissionRefused", { policy: PolicyReference, unmet: S.NonEmptyArray(UnmetClause) }).pipe(
    $I.annoteSchema("AdmissionRefused", { description: "AdmissionRefused admission data." })
  )
) {}

/**
 * Number of independent support clusters. Pairs assessed `dependent`, and
 * pairs with no assessment or `unknown` when `unknownCountsAs = "dependent"`,
 * are merged into one cluster.
 *
 * **Example** (Use independentSupportCount)
 * ```ts
 * import { independentSupportCount } from "@beep/party-domain/Admission"
 * const inspect = independentSupportCount
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const independentSupportCount = ({ supports, dependence, unknownCountsAs }: SupportCountInput): number => {
  const unique = A.dedupe(supports);
  let indices = HashMap.empty<AssertionId, Graph.NodeIndex>();
  const graph = Graph.undirected<AssertionId, boolean>((g) => {
    A.forEach(unique, (id) => {
      indices = HashMap.set(indices, id, Graph.addNode(g, id));
    });
    const node = (id: AssertionId) => O.getOrThrow(HashMap.get(indices, id));
    A.forEach(unique, (left, index) =>
      A.forEach(A.drop(unique, index + 1), (right) => {
        const assessments = A.filter(
          dependence,
          (d) => (d.left === left && d.right === right) || (d.left === right && d.right === left)
        );
        const dependent = A.some(assessments, (d) => d.dependence === "dependent");
        const independent = A.some(assessments, (d) => d.dependence === "independent");
        const unknown = A.isReadonlyArrayEmpty(assessments) || A.some(assessments, (d) => d.dependence === "unknown");
        if (dependent || (!independent && unknown && unknownCountsAs === "dependent"))
          Graph.addEdge(g, node(left), node(right), true);
      })
    );
  });
  return graph.pipe(Graph.connectedComponents, A.length);
};

/** Clauses `admit` checks before any policy clause, so no policy can omit them. */
const integrityClauses: ReadonlyArray<AdmissionClause> = [SupportsInVersion.make({}), KnownAtKnowledgeTime.make({})];

const evaluate = (
  clause: AdmissionClause,
  evidence: AdmissionEvidence,
  knowledgeTime: DateTime.Utc
): O.Option<string> =>
  AdmissionClause.match(clause, {
    MinIndependentSupport: ({ n, unknownCountsAs }) => {
      const count = independentSupportCount(
        SupportCountInput.make({
          supports: A.map(evidence.supports, (s) => s.assertion),
          dependence: evidence.dependence,
          unknownCountsAs,
        })
      );
      return count >= n ? O.none() : O.some(`${count} independent support cluster(s), need ${n}`);
    },
    RequireReviewerAcceptance: () =>
      ReviewState.guards.Accepted(evidence.version.review)
        ? O.none()
        : O.some(`review state is ${evidence.version.review._tag}`),
    NoOpenChallenge: () =>
      A.isReadonlyArrayEmpty(evidence.version.challengedBy) && !ReviewState.guards.Disputed(evidence.version.review)
        ? O.none()
        : O.some(`${A.length(evidence.version.challengedBy)} challenging assertion(s)`),
    RequireDistinctiveEvidence: () =>
      A.some(evidence.supports, (s) => s.kind === "distinctive-behavior")
        ? O.none()
        : O.some("all support is shared-template or bulk-distribution evidence"),
    RequireSupportOutsideSide: ({ side }) =>
      A.some(evidence.supports, (s) => s.side !== side) ? O.none() : O.some(`all support comes from ${side}`),
    SupportsInVersion: () => {
      const outside = A.filter(evidence.supports, (s) => !A.contains(evidence.version.supportedBy, s.assertion));
      return A.isReadonlyArrayEmpty(outside)
        ? O.none()
        : O.some(`${A.length(outside)} support(s) not in the version's supportedBy`);
    },
    KnownAtKnowledgeTime: () =>
      knownAt(evidence.version.knowledge, knowledgeTime)
        ? O.none()
        : O.some(`version ${evidence.version.id} is not known at ${knowledgeTime}`),
  });

/**
 * Evaluate a policy and mint an admission or a refusal.
 *
 * **Example** (Use admit)
 * ```ts
 * import { admit } from "@beep/party-domain/Admission"
 * const inspect = admit
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const admit = <T extends AdmissionTier>({
  policy,
  evidence,
  knowledgeTime,
}: {
  readonly policy: AdmissionPolicy & { readonly tier: T };
  readonly evidence: AdmissionEvidence;
  readonly knowledgeTime: DateTime.Utc;
}): Result.Result<Admitted<T>, AdmissionRefused> => {
  const unmet = A.flatMap(A.appendAll(integrityClauses, policy.clauses), (clause) =>
    O.match(evaluate(clause, evidence, knowledgeTime), {
      onNone: thunkEmptyArray(),
      onSome: (saw) => [UnmetClause.make({ clause, saw })],
    })
  );
  const ref = PolicyReference.make({ id: policy.id, version: policy.version });
  return A.isReadonlyArrayNonEmpty(unmet)
    ? Result.fail(AdmissionRefused.make({ policy: ref, unmet }))
    : Result.succeed(
        new Admitted(mintToken, {
          tier: policy.tier,
          claimVersion: evidence.version,
          policy: ref,
          knowledgeTime,
          basis: A.map(evidence.supports, (s) => s.assertion),
        })
      );
};

/**
 * DepositionEntry public schema for the admission model.
 *
 * **Example** (Decode DepositionEntry)
 * ```ts
 * import { DepositionEntry } from "@beep/party-domain/Admission"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(DepositionEntry)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class DepositionEntry extends S.Opaque<DepositionEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    claimVersion: ClaimVersionId,
    proposition: Proposition,
    policy: PolicyReference,
    knowledgeTime: S.DateTimeUtcFromMillis,
    basis: S.Array(AssertionId),
    note: S.String,
  }).pipe(
    $I.annoteSchema("DepositionEntry", { description: "Work-product entry minted from a deposition-ready proof." })
  )
) {}

/**
 * One line of a deposition outline. Accepts only deposition-ready proofs.
 *
 * **Example** (Use depositionOutlineEntry)
 * ```ts
 * import { depositionOutlineEntry } from "@beep/party-domain/Admission"
 * const inspect = depositionOutlineEntry
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const depositionOutlineEntry = ({
  admitted,
  note,
}: {
  readonly admitted: Admitted<"deposition-ready">;
  readonly note: string;
}) =>
  DepositionEntry.make({
    claimVersion: admitted.claimVersion.id,
    proposition: admitted.claimVersion.proposition,
    policy: admitted.policy,
    knowledgeTime: admitted.knowledgeTime,
    basis: admitted.basis,
    note,
  });
