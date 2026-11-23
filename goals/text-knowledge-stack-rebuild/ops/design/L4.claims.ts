/**
 * L4 claims: an immutable hashed core, and records that point at it
 * (challenge, admission, retraction); owner-declared total assessment
 * coordinates; gates; the proposed-only record write tools return; the pure
 * log checker.
 *
 * Target home: `@beep/epistemics` (foundation/modeling). Existing epistemics
 * schemas (`AbsenceReason`, `ValidTime`) and the factory id contract
 * (`IdCodec`) are imported. `makeClaimEnvelope` and its `ClaimVersion` retire
 * into `makeClaimCore` plus the separate records in P4 (decision 2026-11-19-p0-census-dispositions);
 * rows that store a ClaimVersion keep their bytes behind a read-time transform.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { AbsenceReason, ValidTime } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { ActivityPin } from "@beep/jsonc/ActivityStart";
import { mintContentHash } from "@beep/jsonc/Mint";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { OccurrenceId } from "@beep/text/Occurrence";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { constTrue } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import type { FieldSchema, IdCodec } from "@beep/epistemics/Factory";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type { VerifiedTextAnchor, VerifiedTextAnchorError } from "@beep/text/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";
import type * as Order from "effect/Order";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L4.claims");

/** Content id of a claim core: the hash of `claim/v1` and the canonical core encoding. */
export const ClaimId = ContentHash.pipe(
  S.brand("ClaimId"),
  $I.annoteSchema("ClaimId", { description: "Content hash of an immutable claim core." })
);

/** Decoded type of {@link ClaimId}. */
export type ClaimId = typeof ClaimId.Type;

/** Domain tag of the claim core preimage. */
export const ClaimDomainTag = DomainTag.make("claim/v1");

/** The admission workflow position of a claim; DEC worlds are an export mapping of these, not the storage model. */
export const Stance = LiteralKit(["verbatim", "proposed", "admitted"]).pipe(
  $I.annoteSchema("Stance", {
    description: "verbatim: the source says it; proposed: put forward; admitted: approved for a use.",
  })
);

/** Decoded type of {@link Stance}. */
export type Stance = typeof Stance.Type;

/** How one claim challenges another (argumentation attack kinds). */
export const ChallengeKind = LiteralKit(["rebut", "undercut", "undermine"]).pipe(
  $I.annoteSchema("ChallengeKind", { description: "Attack on a conclusion, an inference, or a premise." })
);

/** Decoded type of {@link ChallengeKind}. */
export type ChallengeKind = typeof ChallengeKind.Type;

const BindingFields = { actor: S.Unknown, scope: S.Unknown, action: S.Unknown, revision: S.Unknown };

const TokenBindingView = S.Struct({ ...BindingFields, token: S.Struct(BindingFields) }).pipe(
  $I.annoteSchema("TokenBindingView", { description: "The fields an admission and its token must agree on." })
);

const isTokenBindingView = S.is(TokenBindingView);

const tokenIsBound = (admission: typeof TokenBindingView.Type): boolean =>
  Eq.equals(admission.actor, admission.token.actor) &&
  Eq.equals(admission.scope, admission.token.scope) &&
  Eq.equals(admission.action, admission.token.action) &&
  Eq.equals(admission.revision, admission.token.revision);

/** Slice-supplied id schemas and the proposition key function, mirroring `makeClaimEnvelope`. */
export type ClaimCoreIds<
  P extends S.Top,
  Scope extends IdCodec,
  Principal extends IdCodec,
  Action extends IdCodec,
  Revision extends IdCodec,
> = {
  readonly logicalKey: (proposition: P["Type"]) => string;
  readonly scope: Scope;
  readonly principal: Principal;
  readonly action: Action;
  readonly revision: Revision;
};

/**
 * Bind the claim core and the records that point at it to a slice's
 * proposition and id schemas. The core holds only what is true at creation;
 * `derivedFrom` is in it, so derivation is acyclic by construction (item 10).
 */
export const makeClaimCore = <
  P extends S.Top,
  Scope extends IdCodec,
  Principal extends IdCodec,
  Action extends IdCodec,
  Revision extends IdCodec,
>(config: {
  readonly proposition: P;
  readonly ids: ClaimCoreIds<P, Scope, Principal, Action, Revision>;
}) => {
  const { proposition, ids } = config;
  const propositionType: FieldSchema<P["Type"]> = S.toType(proposition);
  const hasCoreKey = S.is(S.Struct({ logicalKey: S.NonEmptyString, proposition: propositionType }));
  const AgentRef = S.TaggedUnion({
    Person: { principal: ids.principal },
    Organization: { organization: ids.principal },
    SoftwareAgent: { name: S.NonEmptyString, pin: ActivityPin },
  });

  const ClaimCore = S.Struct({
    proposition,
    logicalKey: S.NonEmptyString,
    supportAtCreation: CanonicalHashSet(OccurrenceId),
    derivedFrom: CanonicalHashSet(ClaimId),
    supersedes: S.OptionFromOptionalKey(ClaimId).annotateKey({
      description: "The record this one supersedes, inside the hashed preimage (amended item 3).",
    }),
    generatedBy: ActivityId,
    assertedBy: AgentRef,
    valid: ValidTime,
    knowledgeStart: S.DateTimeUtcFromMillis,
    scope: ids.scope,
  }).check(
    S.makeFilter(
      (core: unknown) => hasCoreKey(core) && core.logicalKey === ids.logicalKey(core.proposition),
      $I.annote("ClaimCoreLogicalKeyCheck", {
        description: "The logical key matches the slice-owned proposition key function.",
        message: "Expected logicalKey to match the proposition key.",
      })
    )
  );

  const HumanAdmissionToken = S.Struct({
    actor: ids.principal,
    action: ids.action,
    revision: ids.revision,
    scope: ids.scope,
    issuedAt: S.DateTimeUtcFromMillis,
    attestation: Sha256PrefixedDigest,
  });

  const Admission = S.Struct({
    claim: ClaimId,
    actor: ids.principal,
    scope: ids.scope,
    action: ids.action,
    revision: ids.revision,
    grounding: S.NonEmptyArray(TextAnchorVerificationReceipt),
    token: HumanAdmissionToken,
    at: S.DateTimeUtcFromMillis,
  }).check(
    S.makeFilter(
      (admission: unknown) => isTokenBindingView(admission) && tokenIsBound(admission),
      $I.annote("AdmissionTokenBindingCheck", {
        description: "The human token is bound to the admission's actor, scope, action and revision.",
        message: "Expected the token to name the admission's actor, scope, action and revision.",
      })
    )
  );

  // Challenge cycles are allowed (L4-3); a person challenges as the slice principal (decision 2026-11-19-p0-admission-actor-is-the-principal).
  const Challenge = S.TaggedUnion({
    ByPerson: { from: ClaimId, to: ClaimId, kind: ChallengeKind, actor: ids.principal, at: S.DateTimeUtcFromMillis },
    ByActivity: { from: ClaimId, to: ClaimId, kind: ChallengeKind, generatedBy: ActivityId },
  });

  const Retraction = S.Struct({
    claim: ClaimId,
    actor: ids.principal,
    reason: S.NonEmptyString,
    at: S.DateTimeUtcFromMillis,
  });

  const ProposedClaimRecord = S.Struct({
    claim: ClaimId,
    stance: S.tag("proposed"),
    core: ClaimCore,
  });

  return { AgentRef, ClaimCore, Challenge, HumanAdmissionToken, Admission, Retraction, ProposedClaimRecord };
};

const makeAssessment = <V extends S.Top>(value: V) =>
  S.TaggedUnion({ Assessed: { value }, Unassessed: { reason: AbsenceReason } });

/** One assessment coordinate: `Assessed{value}` or `Unassessed{reason}`. */
export type Assessment<V extends S.Top> = ReturnType<typeof makeAssessment<V>>;

interface AssessmentLambda extends Struct.Lambda {
  readonly "~lambda.out": this["~lambda.in"] extends S.Top ? Assessment<this["~lambda.in"]> : never;
  <V extends S.Top>(value: V): Assessment<V>;
}

const assessmentLambda = Struct.lambda<AssessmentLambda>(makeAssessment);

/**
 * The total, owner-declared assessment carrier (decision p0-rq2): every
 * coordinate is present, so a missing one is a decode failure, and each is
 * `Assessed{value}` or `Unassessed{reason}`.
 */
export const makeAssessments = <const Coords extends Record<string, S.Top>>(coords: Coords) =>
  S.Struct(Struct.map(coords, assessmentLambda));

/**
 * An owner-defined gate over an assessments struct. Laws the foundation
 * harness checks (L4-6): refusal is a no-op, independent coordinates commute,
 * a gate never passes on `Unassessed`, and it is monotone under the owner's
 * per-coordinate order.
 */
export interface Gate<Coords extends Record<string, S.Top>> {
  readonly name: string;
  /** The owner-declared order on each coordinate value, under which the gate must be monotone. */
  readonly order: { readonly [K in keyof Coords]: Order.Order<Coords[K]["Type"]> };
  readonly passes: (assessments: AssessmentsOf<Coords>) => boolean;
  readonly version: string;
}

/** Decoded assessments struct of a coordinate registry. */
export type AssessmentsOf<Coords extends Record<string, S.Top>> = {
  readonly [K in keyof Coords]: Assessment<Coords[K]>["Type"];
};

/** Re-verify an admission's grounding against current source text (L4-2); a failure is a refusal value upstream. */
export declare const verifyGrounding: <R>(
  resolve: (receipt: TextAnchorVerificationReceipt) => Effect.Effect<VerifiedTextAnchor, VerifiedTextAnchorError, R>
) => (
  grounding: readonly [TextAnchorVerificationReceipt, ...Array<TextAnchorVerificationReceipt>]
) => Effect.Effect<readonly [VerifiedTextAnchor, ...Array<VerifiedTextAnchor>], VerifiedTextAnchorError, R>;

/** Mint a claim id from a core already encoded by its slice's JSON codec. */
export const mintClaimId = Effect.fn("ClaimCore.mint")(function* (
  encodedCore: unknown
): Effect.fn.Return<ClaimId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(ClaimDomainTag, [encodedCore]);
  return ClaimId.make(hash);
});

/** The partition, supersession and time fields the log checker reads from each entry. */
export class ClaimLogEntry extends S.Opaque<ClaimLogEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    scope: S.Union([S.String, S.Finite]),
    logicalKey: S.NonEmptyString,
    supersedes: S.OptionFromOptionalKey(ClaimId),
    derivedFrom: CanonicalHashSet(ClaimId).annotateKey({ description: "Parents the record was derived from." }),
    knowledgeStart: S.DateTimeUtcFromMillis,
    generatedAt: S.DateTimeUtcFromMillis.annotateKey({ description: "End time of the generating activity." }),
    valid: ValidTime,
  }).pipe($I.annoteSchema("ClaimLogEntry", { description: "Projection of a log record for the interval laws." }))
) {}

/**
 * A violated clause of the amended item 3. Acyclic supersession is the fourth
 * clause and holds by hash construction, so it has no case: a core's id
 * hashes the id it supersedes, so it cannot name itself or a later core.
 */
export const ClaimLogViolation = S.TaggedUnion({
  SupersessionFork: { superseded: ClaimId, superseders: CanonicalHashSet(ClaimId) },
  // Decision 2026-11-19-p0-item3-amended-supersession-is-explicit: a record may supersede only a record of its own partition.
  SupersededAcrossPartitions: { claim: ClaimId, superseded: ClaimId },
  StartsBeforeSuperseded: { claim: ClaimId, superseded: ClaimId },
  StartsBeforeGeneration: { claim: ClaimId },
  // Decisions 2026-11-19-p0-item3-amended-supersession-is-explicit and 2026-11-19-p0-item10-derived-from-in-the-hashed-core: the log is append-ordered in knowledge time, and parents precede children.
  KnowledgeStartRegression: { claim: ClaimId, previous: ClaimId },
  ParentMissing: { claim: ClaimId, parent: ClaimId },
  ParentStartsLater: { claim: ClaimId, parent: ClaimId },
  ValidTimeOverlap: { left: ClaimId, right: ClaimId },
}).pipe($I.annoteSchema("ClaimLogViolation", { description: "A partition-level interval law violation." }));

/** Decoded type of {@link ClaimLogViolation}. */
export type ClaimLogViolation = typeof ClaimLogViolation.Type;

const Violation = ClaimLogViolation.cases;
const isIntervalValid = ValidTime.guards.Interval;

const samePartition = (left: ClaimLogEntry, right: ClaimLogEntry): boolean =>
  Eq.equals(left.scope, right.scope) && Eq.equals(left.logicalKey, right.logicalKey);

const startsBefore = (start: DateTime.Utc, end: O.Option<DateTime.Utc>): boolean =>
  O.match(end, { onNone: constTrue, onSome: (bound) => DateTime.isLessThan(start, bound) });

// Decision 2026-11-19-p0-item3-amended-supersession-is-explicit: an Unknown valid time asserts no interval and stays out of the disjointness clause.
const validOverlap = (left: ClaimLogEntry, right: ClaimLogEntry): boolean =>
  isIntervalValid(left.valid) &&
  isIntervalValid(right.valid) &&
  startsBefore(left.valid.validFrom, right.valid.validTo) &&
  startsBefore(right.valid.validFrom, left.valid.validTo);

const supersessionIndex = (log: ReadonlyArray<ClaimLogEntry>): HashMap.HashMap<ClaimId, HashSet.HashSet<ClaimId>> =>
  A.reduce(log, HashMap.empty<ClaimId, HashSet.HashSet<ClaimId>>(), (index, entry) =>
    O.match(entry.supersedes, {
      onNone: () => index,
      onSome: (superseded) =>
        HashMap.set(
          index,
          superseded,
          HashSet.add(O.getOrElse(HashMap.get(index, superseded), HashSet.empty<ClaimId>), entry.claim)
        ),
    })
  );

/**
 * The pure log checker L4-1 property-tests (amended item 3), per partition
 * (scope, logicalKey): a record is superseded at most once; a superseder
 * starts no earlier than the record it supersedes nor than its own
 * generation; records not yet superseded have pairwise disjoint valid
 * intervals, mirroring the Postgres exclusion constraint. A record's knowledge
 * interval ends at its superseder's knowledgeStart and is open otherwise. The
 * log is append-ordered: a knowledgeStart earlier than the previous entry's is
 * a regression, and every derivedFrom parent must appear earlier in the log
 * and start no later than its child (decision 2026-11-19-p0-item10-derived-from-in-the-hashed-core).
 */
export const checkClaimLog = (log: ReadonlyArray<ClaimLogEntry>): ReadonlyArray<ClaimLogViolation> => {
  const byClaim = HashMap.fromIterable(A.map(log, (entry): readonly [ClaimId, ClaimLogEntry] => [entry.claim, entry]));
  const supersededBy = supersessionIndex(log);
  const forks = A.filterMap(HashMap.toEntries(supersededBy), ([superseded, superseders]) =>
    HashSet.size(superseders) > 1
      ? Result.succeed(Violation.SupersessionFork.make({ superseded, superseders }))
      : Result.fail(superseded)
  );
  const ordering = A.flatMap(log, (entry) =>
    O.match(
      O.flatMap(entry.supersedes, (id) => HashMap.get(byClaim, id)),
      {
        onNone: A.empty<ClaimLogViolation>,
        onSome: (prior): ReadonlyArray<ClaimLogViolation> => [
          ...(samePartition(entry, prior)
            ? A.empty<ClaimLogViolation>()
            : A.of<ClaimLogViolation>(
                Violation.SupersededAcrossPartitions.make({ claim: entry.claim, superseded: prior.claim })
              )),
          ...(DateTime.isLessThan(entry.knowledgeStart, prior.knowledgeStart)
            ? A.of<ClaimLogViolation>(
                Violation.StartsBeforeSuperseded.make({ claim: entry.claim, superseded: prior.claim })
              )
            : A.empty<ClaimLogViolation>()),
        ],
      }
    )
  );
  const generation = A.filterMap(log, (entry) =>
    DateTime.isLessThan(entry.knowledgeStart, entry.generatedAt)
      ? Result.succeed(Violation.StartsBeforeGeneration.make({ claim: entry.claim }))
      : Result.fail(entry.claim)
  );
  const current = A.filter(log, (entry) => !HashMap.has(supersededBy, entry.claim));
  const overlaps = A.flatMap(current, (left, index) =>
    A.filterMap(A.drop(current, index + 1), (right) =>
      samePartition(left, right) && validOverlap(left, right)
        ? Result.succeed(Violation.ValidTimeOverlap.make({ left: left.claim, right: right.claim }))
        : Result.fail(right.claim)
    )
  );
  const regressions = A.filterMap(A.zip(log, A.drop(log, 1)), ([previous, entry]) =>
    DateTime.isLessThan(entry.knowledgeStart, previous.knowledgeStart)
      ? Result.succeed(Violation.KnowledgeStartRegression.make({ claim: entry.claim, previous: previous.claim }))
      : Result.fail(entry.claim)
  );
  const position = HashMap.fromIterable(A.map(log, (entry, index): readonly [ClaimId, number] => [entry.claim, index]));
  const parents = A.flatMap(log, (entry, index) =>
    A.filterMap(
      A.fromIterable(entry.derivedFrom),
      (parent): Result.Result<ClaimLogViolation, ClaimId> =>
        O.match(
          O.filter(HashMap.get(position, parent), (at) => at < index),
          {
            onNone: () => Result.succeed(Violation.ParentMissing.make({ claim: entry.claim, parent })),
            onSome: () =>
              O.exists(HashMap.get(byClaim, parent), (prior) =>
                DateTime.isGreaterThan(prior.knowledgeStart, entry.knowledgeStart)
              )
                ? Result.succeed(Violation.ParentStartsLater.make({ claim: entry.claim, parent }))
                : Result.fail(parent),
          }
        )
    )
  );
  return [...forks, ...ordering, ...generation, ...overlaps, ...regressions, ...parents];
};

type Wave = {
  readonly remaining: HashMap.HashMap<ClaimId, number>;
  readonly next: HashSet.HashSet<ClaimId>;
};

/**
 * L4-4: the claims flagged by the retraction closure: a claim whose
 * derivedFrom is non-empty and consists only of retracted or flagged claims,
 * to a fixed point.
 *
 * **Details**
 *
 * A dependency worklist, linear in claims plus derivation edges: each claim
 * keeps a count of its sources that are still live, and a claim is flagged
 * when its count reaches zero; flagging it decrements its dependents. Claims
 * with an empty source set are never flagged, and retracted claims are dead
 * from the start but are not themselves flagged.
 */
export const orphanedDerivations =
  (derivedFrom: HashMap.HashMap<ClaimId, HashSet.HashSet<ClaimId>>) =>
  (retracted: HashSet.HashSet<ClaimId>): HashSet.HashSet<ClaimId> => {
    const dependents = HashMap.reduce(
      derivedFrom,
      HashMap.empty<ClaimId, HashSet.HashSet<ClaimId>>(),
      (acc, sources, claim) =>
        HashSet.reduce(sources, acc, (inner, source) =>
          HashMap.set(
            inner,
            source,
            HashSet.add(O.getOrElse(HashMap.get(inner, source), HashSet.empty<ClaimId>), claim)
          )
        )
    );
    const candidate = (claim: ClaimId): boolean => !HashSet.has(retracted, claim);
    const initialRemaining = derivedFrom.pipe(
      HashMap.map((sources) => HashSet.size(HashSet.filter(sources, candidate)))
    );
    let remaining = initialRemaining;
    let frontier = derivedFrom.pipe(
      HashMap.toEntries,
      A.filterMap(([claim, sources]) =>
        candidate(claim) && !HashSet.isEmpty(sources) && O.contains(HashMap.get(initialRemaining, claim), 0)
          ? Result.succeed(claim)
          : Result.fail(claim)
      ),
      HashSet.fromIterable
    );
    let flagged = HashSet.empty<ClaimId>();
    while (!HashSet.isEmpty(frontier)) {
      flagged = HashSet.union(flagged, frontier);
      const done = flagged;
      const wave = HashSet.reduce(
        frontier,
        { remaining, next: HashSet.empty<ClaimId>() },
        (state: Wave, dead): Wave =>
          HashSet.reduce(
            O.getOrElse(HashMap.get(dependents, dead), HashSet.empty<ClaimId>),
            state,
            (inner: Wave, dependent): Wave => {
              if (!candidate(dependent) || HashSet.has(done, dependent)) {
                return inner;
              }
              const left = O.getOrElse(HashMap.get(inner.remaining, dependent), () => 0) - 1;
              return {
                remaining: HashMap.set(inner.remaining, dependent, left),
                next: left === 0 ? HashSet.add(inner.next, dependent) : inner.next,
              };
            }
          )
      );
      remaining = wave.remaining;
      frontier = wave.next;
    }
    return flagged;
  };
