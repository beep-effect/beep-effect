/**
 * Grant set: the Draft/Frozen authority container and the pure evaluator.
 *
 * The freeze is expressed as types, not as a runtime flag someone must
 * remember to check: {@link addGrant} accepts only a {@link DraftGrantSet},
 * and evaluation accepts only a {@link FrozenGrantSet}, so widening a frozen
 * set does not compile. Because `S.Class` always exposes `.make`, the frozen
 * class is additionally sealed two ways: a digest computed at freeze time and
 * re-verifiable at any read ({@link verifyFrozenGrantSetDigest}), and a repo
 * law banning `FrozenGrantSet.make` outside this module — so
 * {@link freezeGrantSet} is the only legal constructor.
 *
 * Grants derive only from session-static inputs (config, policy revision,
 * caller identity), never from tool output. That is what makes the freeze
 * sound: the allowed-destination set provably predates any untrusted content
 * that tries to change it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { A } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DateTime, Result, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { ExecutionGrant, PolicyRevision } from "../ExecutionGrant/index.ts";
import { ExecutionVerdict } from "../ExecutionVerdict/index.ts";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import { GrantRevisionMismatch } from "./GrantSet.errors.ts";
import type { DenialReason, ExecutionRequest } from "../ExecutionVerdict/index.ts";

const $I = $EpistemicDomainId.create("values/GrantSet/GrantSet.model");

/**
 * Digest version prefix. Bump whenever the canonical encoding changes so old
 * and new digests can never collide in a table that holds both.
 */
const grantSetEncodingVersion = "epistemic-grant-set/v1";

/**
 * Digest sealing a frozen grant set: SHA-256 over the versioned canonical
 * encoding of (grants, policyRevision, frozenAt). Recorded in every execution
 * decision so a record provably names the exact authority it was decided
 * under.
 *
 * **Example** (Usage)
 * ```ts
 * import { GrantSetDigest } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(GrantSetDigest)("a".repeat(64)))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantSetDigest = Sha256Hex.pipe(
  S.brand("GrantSetDigest"),
  $I.annoteSchema("GrantSetDigest", {
    description: "SHA-256 digest sealing a frozen grant set's exact contents.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantSetDigest}.
 *
 * **Example** (Usage)
 * ```ts
 * import { GrantSetDigest } from "@beep/epistemic-domain"
 *
 * const digest: GrantSetDigest = GrantSetDigest.make("a".repeat(64))
 * console.log(digest.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantSetDigest = typeof GrantSetDigest.Type;

/**
 * A grant set still under construction. The only state {@link addGrant}
 * accepts; carries no digest because its contents are not yet fixed.
 *
 * **Example** (Usage)
 * ```ts
 * import { DraftGrantSet } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const draft = S.decodeUnknownSync(DraftGrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * console.log(draft.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DraftGrantSet extends S.Class<DraftGrantSet>($I`DraftGrantSet`)(
  {
    state: S.tag("draft"),
    grants: S.Array(ExecutionGrant).annotateKey({
      description: "Grants accumulated so far; still widenable.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision every grant in this set is pinned to.",
    }),
  },
  $I.annote("DraftGrantSet", {
    description: "Grant set under construction; the only state addGrant accepts.",
  })
) {
  static readonly is = S.is(DraftGrantSet);
}

/**
 * A sealed grant set: contents fixed at {@link freezeGrantSet} time and named
 * by {@link GrantSetDigest}. Construct only through {@link freezeGrantSet} —
 * a repo law bans `FrozenGrantSet.make` outside this module, and
 * {@link verifyFrozenGrantSetDigest} re-checks the seal on any instance that
 * crossed a boundary.
 *
 * **Example** (Usage)
 * ```ts
 * import { DraftGrantSet, freezeGrantSet } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 *
 * const draft = S.decodeUnknownSync(DraftGrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * const frozen = freezeGrantSet(draft, DateTime.makeUnsafe(0))
 * console.log(frozen.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrozenGrantSet extends S.Class<FrozenGrantSet>($I`FrozenGrantSet`)(
  {
    state: S.tag("frozen"),
    grants: S.Array(ExecutionGrant).annotateKey({
      description: "The fixed grant contents this set was sealed with.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision the set was frozen under.",
    }),
    frozenAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Instant the set was sealed; part of the digest input.",
    }),
    digest: GrantSetDigest.annotateKey({
      description: "Seal over (grants, policyRevision, frozenAt); re-verify after any boundary crossing.",
    }),
  },
  $I.annote("FrozenGrantSet", {
    description: "Sealed grant set; construct only via freezeGrantSet, verify via verifyFrozenGrantSetDigest.",
  })
) {
  static readonly is = S.is(FrozenGrantSet);
}

const GrantSetState = LiteralKit(["draft", "frozen"]);

/**
 * The Draft/Frozen grant-set union, discriminated on `state`, with exhaustive
 * `.match` from `S.toTaggedUnion`. The two states are deliberately different
 * types so "widen after freeze" is unrepresentable rather than checked.
 *
 * **Example** (Usage)
 * ```ts
 * import { GrantSet } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const set = S.decodeUnknownSync(GrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * console.log(set.state)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantSet = GrantSetState.mapMembers(Tuple.evolve([() => DraftGrantSet, () => FrozenGrantSet])).pipe(
  S.toTaggedUnion("state"),
  $I.annoteSchema("GrantSet", {
    description: "Draft/Frozen grant-set union discriminated on state.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantSet}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { GrantSet } from "@beep/epistemic-domain"
 * import { DraftGrantSet } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const set: GrantSet = S.decodeUnknownSync(DraftGrantSet)({
 *   grants: [],
 *   policyRevision: "1.0.0",
 *   state: "draft"
 * })
 * console.log(set.state)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantSet = typeof GrantSet.Type;

/**
 * Starts a draft grant set pinned to one policy revision.
 *
 * **Example** (Usage)
 * ```ts
 * import { emptyDraftGrantSet, PolicyRevision } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const draft = emptyDraftGrantSet(S.decodeUnknownSync(PolicyRevision)("1.0.0"))
 * console.log(draft.grants.length)
 * // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const emptyDraftGrantSet = (policyRevision: PolicyRevision): DraftGrantSet =>
  DraftGrantSet.make({ grants: [], policyRevision });

/**
 * Adds a grant to a draft set. Accepts only {@link DraftGrantSet} — passing a
 * {@link FrozenGrantSet} is a compile error, which is the freeze invariant
 * expressed as a type rather than as a runtime check.
 *
 * Fails with {@link GrantRevisionMismatch} when the grant's own
 * `policyRevision` differs from the set's: a set pinned to revision X must not
 * smuggle in authority issued under revision Y, or the revision recorded in
 * every decision would not describe the grants that actually authorized it.
 *
 * **Example** (Usage)
 * ```ts
 * import { addGrant, emptyDraftGrantSet, ExecutionGrant, PolicyRevision } from "@beep/epistemic-domain"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const revision = S.decodeUnknownSync(PolicyRevision)("1.0.0")
 * const grant = S.decodeUnknownSync(ExecutionGrant)({
 *   budget: { maxToolCalls: null },
 *   expiresAt: 60000,
 *   operation: "ontology_publish_provenance",
 *   policyRevision: "1.0.0",
 *   principal: { component: "Runtime", kind: "System" },
 *   purpose: "provenance-publication",
 *   resource: "ontology-workspace",
 *   sink: {
 *     audience: "external-network",
 *     destination: "https://registry.example",
 *     sinkClass: "network-egress"
 *   }
 * })
 * const widened = addGrant(emptyDraftGrantSet(revision), grant)
 * console.log(Result.getOrThrow(widened).grants.length)
 * // 1
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const addGrant: {
  (grant: ExecutionGrant): (draft: DraftGrantSet) => Result.Result<DraftGrantSet, GrantRevisionMismatch>;
  (draft: DraftGrantSet, grant: ExecutionGrant): Result.Result<DraftGrantSet, GrantRevisionMismatch>;
} = dual(
  2,
  (draft: DraftGrantSet, grant: ExecutionGrant): Result.Result<DraftGrantSet, GrantRevisionMismatch> =>
    grant.policyRevision === draft.policyRevision
      ? Result.succeed(DraftGrantSet.make({ grants: [...draft.grants, grant], policyRevision: draft.policyRevision }))
      : Result.fail(GrantRevisionMismatch.between(draft.policyRevision, grant.policyRevision))
);

/**
 * Exactly what the grant-set seal commits to. Modeled as a schema rather than
 * an inline shape so the digest's input contract is executable: adding a field
 * to the freeze without adding it here would be a silent change in what the
 * seal actually covers.
 *
 * **Example** (Usage)
 * ```ts
 * import { GrantSetDigestInput } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(GrantSetDigestInput)({
 *   frozenAt: 0,
 *   grants: [],
 *   policyRevision: "1.0.0"
 * })
 * console.log(input.grants.length)
 * // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrantSetDigestInput extends S.Class<GrantSetDigestInput>($I`GrantSetDigestInput`)(
  {
    frozenAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Instant the set was sealed.",
    }),
    grants: S.Array(ExecutionGrant).annotateKey({
      description: "The exact grant contents the seal covers.",
    }),
    policyRevision: PolicyRevision.annotateKey({
      description: "Policy revision the set was frozen under.",
    }),
  },
  $I.annote("GrantSetDigestInput", {
    description: "The committed-to input of a grant-set seal.",
  })
) {
  static readonly is = S.is(GrantSetDigestInput);
}

const encodeDigestInput = S.encodeSync(GrantSetDigestInput);

const computeGrantSetDigest = (input: GrantSetDigestInput): GrantSetDigest =>
  GrantSetDigest.make(
    bytesToHex(sha256(utf8ToBytes(`${grantSetEncodingVersion}\n${canonicalJson(encodeDigestInput(input))}`)))
  );

/**
 * Seals a draft grant set: the one legal constructor of
 * {@link FrozenGrantSet}. Computes the digest over the versioned canonical
 * encoding of (grants, policyRevision, frozenAt); a repo law bans
 * `FrozenGrantSet.make` everywhere else, so freezing cannot be bypassed by
 * constructing the class directly.
 *
 * **Example** (Usage)
 * ```ts
 * import { emptyDraftGrantSet, freezeGrantSet, PolicyRevision } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 *
 * const revision = S.decodeUnknownSync(PolicyRevision)("1.0.0")
 * const frozen = freezeGrantSet(emptyDraftGrantSet(revision), DateTime.makeUnsafe(0))
 * console.log(frozen.digest.length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const freezeGrantSet: {
  (frozenAt: DateTime.Utc): (draft: DraftGrantSet) => FrozenGrantSet;
  (draft: DraftGrantSet, frozenAt: DateTime.Utc): FrozenGrantSet;
} = dual(
  2,
  (draft: DraftGrantSet, frozenAt: DateTime.Utc): FrozenGrantSet =>
    FrozenGrantSet.make({
      grants: draft.grants,
      policyRevision: draft.policyRevision,
      frozenAt,
      digest: computeGrantSetDigest(
        GrantSetDigestInput.make({ frozenAt, grants: draft.grants, policyRevision: draft.policyRevision })
      ),
    })
);

/**
 * Re-verifies a frozen set's seal by recomputing the digest from its own
 * contents. Run this on any frozen set that crossed a process or persistence
 * boundary before trusting it for evaluation.
 *
 * **Example** (Usage)
 * ```ts
 * import { emptyDraftGrantSet, freezeGrantSet, PolicyRevision, verifyFrozenGrantSetDigest } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 *
 * const revision = S.decodeUnknownSync(PolicyRevision)("1.0.0")
 * const frozen = freezeGrantSet(emptyDraftGrantSet(revision), DateTime.makeUnsafe(0))
 * console.log(verifyFrozenGrantSetDigest(frozen))
 * // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const verifyFrozenGrantSetDigest = (frozen: FrozenGrantSet): boolean =>
  computeGrantSetDigest(
    GrantSetDigestInput.make({
      frozenAt: frozen.frozenAt,
      grants: frozen.grants,
      policyRevision: frozen.policyRevision,
    })
  ) === frozen.digest;

/**
 * Time and policy context used to evaluate one execution request.
 *
 * **Example** (Usage)
 * ```ts
 * import { ExecutionRequestEvaluationOptions, PolicyRevision } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 *
 * const options = ExecutionRequestEvaluationOptions.make({
 *   currentPolicyRevision: PolicyRevision.fromUnknown("1.0.0"),
 *   now: DateTime.makeUnsafe(0)
 * })
 * console.log(options.currentPolicyRevision)
 * // "1.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionRequestEvaluationOptions extends S.Class<ExecutionRequestEvaluationOptions>(
  $I`ExecutionRequestEvaluationOptions`
)(
  {
    currentPolicyRevision: PolicyRevision,
    now: S.DateTimeUtc,
  },
  $I.annote("ExecutionRequestEvaluationOptions", {
    description: "Time and current policy revision used to evaluate one execution request.",
  })
) {}

const denied = (reason: DenialReason): ExecutionVerdict => ExecutionVerdict.make({ verdict: "denied", reason });
const principalsEqual = S.toEquivalence(Principal);

/**
 * The pure evaluator: a total function of (frozen grants, request, evaluation
 * options) with error channel `never` — refusal is a value.
 *
 * It re-verifies the set's seal **first**, because `S.Class` and schema
 * decoding can both produce a `FrozenGrantSet` whose `digest` does not match
 * its contents; without this check the freeze would depend on every caller
 * remembering to call {@link verifyFrozenGrantSetDigest}. A tampered set denies
 * with `grant-set-digest-mismatch` and answers nothing else.
 *
 * The remaining checks narrow the candidate grant set in a fixed precedence
 * order (revision, principal, operation, sink class, audience, destination,
 * expiry) and
 * the first narrowing that empties it names the reason, so every member of
 * {@link evaluatorDenialReasons} is reachable and distinct. Narrowing is
 * cumulative over a single list, so all axes must be satisfied by **one**
 * grant — authority cannot be assembled from an audience in grant A and a
 * destination in grant B.
 *
 * Fail-closed by construction: an operation, sink class, audience, or
 * destination that matches no grant denies; there is no default-allow branch
 * to land in.
 *
 * **Example** (Usage)
 * ```ts
 * import { emptyDraftGrantSet, evaluateExecutionRequest, ExecutionRequest, ExecutionRequestEvaluationOptions, freezeGrantSet, PolicyRevision } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 *
 * const revision = S.decodeUnknownSync(PolicyRevision)("1.0.0")
 * const frozen = freezeGrantSet(emptyDraftGrantSet(revision), DateTime.makeUnsafe(0))
 * const request = S.decodeUnknownSync(ExecutionRequest)({
 *   destination: "https://registry.example",
 *   operation: "ontology_publish_provenance",
 *   principal: { component: "Runtime", kind: "System" },
 *   resolvedAudience: "external-network",
 *   sinkClass: "network-egress"
 * })
 * const verdict = evaluateExecutionRequest(
 *   frozen,
 *   request,
 *   ExecutionRequestEvaluationOptions.make({
 *     currentPolicyRevision: revision,
 *     now: DateTime.makeUnsafe(0)
 *   })
 * )
 * console.log(verdict)
 * // { verdict: "denied", reason: "operation-not-granted" }
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const evaluateExecutionRequest: {
  (request: ExecutionRequest, options: ExecutionRequestEvaluationOptions): (frozen: FrozenGrantSet) => ExecutionVerdict;
  (frozen: FrozenGrantSet, request: ExecutionRequest, options: ExecutionRequestEvaluationOptions): ExecutionVerdict;
} = dual(3, (frozen: FrozenGrantSet, request: ExecutionRequest, options: ExecutionRequestEvaluationOptions) => {
  if (!verifyFrozenGrantSetDigest(frozen)) {
    return denied("grant-set-digest-mismatch");
  }
  if (frozen.policyRevision !== options.currentPolicyRevision) {
    return denied("policy-revision-mismatch");
  }
  const byPrincipal = A.filter(frozen.grants, (grant) => principalsEqual(grant.principal, request.principal));
  if (byPrincipal.length === 0) {
    return denied("principal-not-granted");
  }
  const byOperation = A.filter(byPrincipal, (grant) => grant.operation === request.operation);
  if (byOperation.length === 0) {
    return denied("operation-not-granted");
  }
  const bySinkClass = A.filter(byOperation, (grant) => grant.sink.sinkClass === request.sinkClass);
  if (bySinkClass.length === 0) {
    return denied("sink-class-not-granted");
  }
  const byAudience = A.filter(bySinkClass, (grant) => grant.sink.audience === request.resolvedAudience);
  if (byAudience.length === 0) {
    return denied("audience-not-granted");
  }
  const byDestination = A.filter(byAudience, (grant) => grant.sink.destination === request.destination);
  if (byDestination.length === 0) {
    return denied("destination-not-granted");
  }
  const live = A.filter(byDestination, (grant) => DateTime.isLessThan(options.now, grant.expiresAt));
  if (live.length === 0) {
    return denied("grant-expired");
  }
  return ExecutionVerdict.make({ verdict: "allowed" });
});
