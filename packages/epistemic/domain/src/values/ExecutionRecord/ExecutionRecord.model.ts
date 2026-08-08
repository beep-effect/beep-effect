/**
 * Execution ledger record schemas: the write-ahead decision and the
 * post-settlement outcome, hash-chained per run.
 *
 * The ledger stores exactly one class of data (exploration decision 4):
 * hashes, opaque identifiers, bounded literals, and typed outcomes. Every
 * field on these schemas is a `Sha256Hex`-derived brand, a `LiteralKit`
 * member, a branded semantic version, a sequence number, or a timestamp —
 * nothing can carry a payload. Raw destinations and operation names never
 * appear; only their digests do.
 *
 * Decisions carry the chain (seq, prevHash, hash). Outcomes bind to their
 * decision by hash and carry their own seal. A refused dispatch produces a
 * decision and **no** outcome — there is no execution to report — so the
 * derived "decided, outcome unknown" state is meaningful only for allowed
 * decisions, and a hash proves correspondence and ordering only, never that
 * an action was authorized, truthful, or complete.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { A, O } from "@beep/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { DateTime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { PolicyRevision, SinkAudience, SinkClass } from "../ExecutionGrant/index.ts";
import { DenialReason } from "../ExecutionVerdict/index.ts";
import { GrantSetDigest } from "../GrantSet/index.ts";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import type { GrantOperation, SinkDestination } from "../ExecutionGrant/index.ts";

const $I = $EpistemicDomainId.create("values/ExecutionRecord/ExecutionRecord.model");

/**
 * Record-hash encoding version prefixes. Bump on any canonical-encoding change
 * so old and new hashes can never collide in a table holding both.
 */
const decisionEncodingVersion = "epistemic-execution-decision/v1";
const outcomeEncodingVersion = "epistemic-execution-outcome/v1";

/**
 * Opaque key naming one governed run (one MCP session's frozen authority).
 * Derived at run open from session inputs; deliberately a digest so the
 * ledger key carries no session detail.
 *
 * @example
 * ```ts
 * import { ExecutionRunKey } from "@beep/epistemic-domain"
 *
 * console.log(ExecutionRunKey.make("b".repeat(64)).length)
 * // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExecutionRunKey = Sha256Hex.pipe(
  S.brand("ExecutionRunKey"),
  $I.annoteSchema("ExecutionRunKey", {
    description: "Opaque digest key naming one governed run.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ExecutionRunKey}.
 *
 * @example
 * ```ts
 * import { ExecutionRunKey } from "@beep/epistemic-domain"
 *
 * const key: ExecutionRunKey = ExecutionRunKey.make("b".repeat(64))
 * console.log(key.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionRunKey = typeof ExecutionRunKey.Type;

/**
 * Seal hash of one decision record: SHA-256 over the versioned canonical
 * encoding of the record's own content (prevHash included), which is what
 * chains the run.
 *
 * @example
 * ```ts
 * import { DecisionRecordHash } from "@beep/epistemic-domain"
 *
 * console.log(DecisionRecordHash.make("c".repeat(64)).length)
 * // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DecisionRecordHash = Sha256Hex.pipe(
  S.brand("DecisionRecordHash"),
  $I.annoteSchema("DecisionRecordHash", {
    description: "Seal hash of one execution decision record.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link DecisionRecordHash}.
 *
 * @example
 * ```ts
 * import { DecisionRecordHash } from "@beep/epistemic-domain"
 *
 * const hash: DecisionRecordHash = DecisionRecordHash.make("c".repeat(64))
 * console.log(hash.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DecisionRecordHash = typeof DecisionRecordHash.Type;

/**
 * Seal hash of one outcome record.
 *
 * @example
 * ```ts
 * import { OutcomeRecordHash } from "@beep/epistemic-domain"
 *
 * console.log(OutcomeRecordHash.make("d".repeat(64)).length)
 * // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OutcomeRecordHash = Sha256Hex.pipe(
  S.brand("OutcomeRecordHash"),
  $I.annoteSchema("OutcomeRecordHash", {
    description: "Seal hash of one execution outcome record.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link OutcomeRecordHash}.
 *
 * @example
 * ```ts
 * import { OutcomeRecordHash } from "@beep/epistemic-domain"
 *
 * const hash: OutcomeRecordHash = OutcomeRecordHash.make("d".repeat(64))
 * console.log(hash.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type OutcomeRecordHash = typeof OutcomeRecordHash.Type;

/**
 * Digest of the destination a decision was made about. The raw destination
 * never enters the ledger; operators correlate by recomputing digests from
 * the configured allowlist.
 *
 * @example
 * ```ts
 * import { SinkDestinationDigest } from "@beep/epistemic-domain"
 *
 * console.log(SinkDestinationDigest.make("e".repeat(64)).length)
 * // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SinkDestinationDigest = Sha256Hex.pipe(
  S.brand("SinkDestinationDigest"),
  $I.annoteSchema("SinkDestinationDigest", {
    description: "SHA-256 digest of a sink destination; the raw destination never enters the ledger.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link SinkDestinationDigest}.
 *
 * @example
 * ```ts
 * import { SinkDestinationDigest } from "@beep/epistemic-domain"
 *
 * const digest: SinkDestinationDigest = SinkDestinationDigest.make("e".repeat(64))
 * console.log(digest.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SinkDestinationDigest = typeof SinkDestinationDigest.Type;

/**
 * Digest of the operation a decision was made about — a tool name is
 * quasi-bounded but schema-unbounded text, so it enters the ledger only as a
 * digest, keeping every ledger column inside the no-payload allowlist.
 *
 * @example
 * ```ts
 * import { GrantOperationDigest } from "@beep/epistemic-domain"
 *
 * console.log(GrantOperationDigest.make("f".repeat(64)).length)
 * // 64
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GrantOperationDigest = Sha256Hex.pipe(
  S.brand("GrantOperationDigest"),
  $I.annoteSchema("GrantOperationDigest", {
    description: "SHA-256 digest of a granted operation name; raw names never enter the ledger.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link GrantOperationDigest}.
 *
 * @example
 * ```ts
 * import { GrantOperationDigest } from "@beep/epistemic-domain"
 *
 * const digest: GrantOperationDigest = GrantOperationDigest.make("f".repeat(64))
 * console.log(digest.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GrantOperationDigest = typeof GrantOperationDigest.Type;

/**
 * How a governed execution settled after an allowed decision. A bounded
 * literal rather than an `Exit` so no failure detail — which is payload — can
 * reach the ledger. Mirrored (deliberately, without an import) by
 * `@beep/mcp-kit`'s settlement vocabulary; foundation may not import slices,
 * so member equality between the two is asserted by a test in
 * `epistemic/server`, which may import both.
 *
 * @example
 * ```ts
 * import { ExecutionSettlement } from "@beep/epistemic-domain"
 *
 * console.log(ExecutionSettlement.Enum.interrupted)
 * // "interrupted"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExecutionSettlement = LiteralKit(["completed", "failed", "interrupted"]).pipe(
  $I.annoteSchema("ExecutionSettlement", {
    description: "Bounded settlement of an allowed execution: completed, failed, or interrupted.",
  })
);

/**
 * Runtime type for {@link ExecutionSettlement}.
 *
 * @example
 * ```ts
 * import type { ExecutionSettlement } from "@beep/epistemic-domain"
 *
 * const settlement: ExecutionSettlement = "completed"
 * console.log(settlement)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionSettlement = typeof ExecutionSettlement.Type;

const decisionCommonFields = {
  runKey: ExecutionRunKey.annotateKey({
    description: "Governed run this decision belongs to.",
  }),
  seq: NonNegativeInt.annotateKey({
    description: "Position in the run's chain; zero-based, dense.",
  }),
  prevHash: DecisionRecordHash.pipe(S.OptionFromNullOr, SchemaUtils.withNoneDefault).annotateKey({
    description: "Hash of the previous decision in this run; none only at seq zero.",
  }),
  hash: DecisionRecordHash.annotateKey({
    description: "Seal over this record's canonical encoding, prevHash included.",
  }),
  operationDigest: GrantOperationDigest.annotateKey({
    description: "Digest of the operation decided on.",
  }),
  sinkClass: SinkClass.annotateKey({
    description: "Sink class decided on.",
  }),
  audience: SinkAudience.annotateKey({
    description: "Resolver-assigned audience the decision was made under.",
  }),
  destinationDigest: SinkDestinationDigest.annotateKey({
    description: "Digest of the destination decided on.",
  }),
  grantSetDigest: GrantSetDigest.annotateKey({
    description: "Digest of the frozen grant set the decision was evaluated against.",
  }),
  policyRevision: PolicyRevision.annotateKey({
    description: "Policy revision pinned at freeze time.",
  }),
  decidedAt: EntitySchema.DateTimeFromMillis.annotateKey({
    description: "Instant the decision was made — before the effect ran.",
  }),
} as const;

const DecisionVerdictTag = LiteralKit(["allowed", "denied"]);

/**
 * The write-ahead decision record, discriminated on `verdict`. Written before
 * the governed effect runs — no record, no action — and chained per run by
 * (seq, prevHash, hash). The denied variant carries the bounded reason; the
 * allowed variant carries none, because "allowed" is its own complete
 * statement.
 *
 * @example
 * ```ts
 * import { ExecutionDecisionRecord } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const record = S.decodeUnknownSync(ExecutionDecisionRecord)({
 *   audience: "external-network",
 *   decidedAt: 1,
 *   destinationDigest: "e".repeat(64),
 *   grantSetDigest: "a".repeat(64),
 *   hash: "c".repeat(64),
 *   operationDigest: "f".repeat(64),
 *   policyRevision: "1.0.0",
 *   prevHash: null,
 *   reason: "destination-not-granted",
 *   runKey: "b".repeat(64),
 *   seq: 0,
 *   sinkClass: "network-egress",
 *   verdict: "denied"
 * })
 * console.log(record.verdict)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExecutionDecisionRecord = DecisionVerdictTag.toTaggedUnion("verdict")({
  allowed: decisionCommonFields,
  denied: { ...decisionCommonFields, reason: DenialReason },
}).pipe(
  $I.annoteSchema("ExecutionDecisionRecord", {
    description: "Write-ahead execution decision record, hash-chained per run; denied carries the bounded reason.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ExecutionDecisionRecord}.
 *
 * @example
 * ```ts
 * import type { ExecutionDecisionRecord } from "@beep/epistemic-domain"
 * import { ExecutionDecisionRecord as Schema } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const record: ExecutionDecisionRecord = S.decodeUnknownSync(Schema)({
 *   audience: "external-network",
 *   decidedAt: 1,
 *   destinationDigest: "e".repeat(64),
 *   grantSetDigest: "a".repeat(64),
 *   hash: "c".repeat(64),
 *   operationDigest: "f".repeat(64),
 *   policyRevision: "1.0.0",
 *   prevHash: null,
 *   runKey: "b".repeat(64),
 *   seq: 0,
 *   sinkClass: "network-egress",
 *   verdict: "allowed"
 * })
 * console.log(record.seq)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionDecisionRecord = typeof ExecutionDecisionRecord.Type;

/**
 * The post-settlement outcome record for an **allowed** decision, bound to it
 * by {@link DecisionRecordHash}. A refused dispatch never produces one — there
 * is no execution to report — which is why the derived "decided, outcome
 * unknown" query must be scoped to allowed decisions.
 *
 * @example
 * ```ts
 * import { ExecutionOutcomeRecord } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const outcome = S.decodeUnknownSync(ExecutionOutcomeRecord)({
 *   decisionHash: "c".repeat(64),
 *   hash: "d".repeat(64),
 *   recordedAt: 2,
 *   runKey: "b".repeat(64),
 *   settlement: "completed"
 * })
 * console.log(outcome.settlement)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionOutcomeRecord extends S.Class<ExecutionOutcomeRecord>($I`ExecutionOutcomeRecord`)(
  {
    runKey: ExecutionRunKey.annotateKey({
      description: "Governed run the settled execution belonged to.",
    }),
    decisionHash: DecisionRecordHash.annotateKey({
      description: "Hash of the allowed decision this outcome settles; unique per decision.",
    }),
    settlement: ExecutionSettlement.annotateKey({
      description: "Bounded settlement; never an Exit, so no failure payload can enter.",
    }),
    recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Instant the settlement was recorded — after the effect settled.",
    }),
    hash: OutcomeRecordHash.annotateKey({
      description: "Seal over this record's canonical encoding, decisionHash included.",
    }),
  },
  $I.annote("ExecutionOutcomeRecord", {
    description: "Post-settlement outcome record bound to its allowed decision by hash.",
  })
) {
  static readonly is = S.is(ExecutionOutcomeRecord);
}

const digestOf = (version: string, canonical: string): string =>
  bytesToHex(sha256(utf8ToBytes(`${version}\n${canonical}`)));

/**
 * Distributes `Omit` over a union so each variant loses the key individually
 * instead of the union collapsing to its common keys.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Content of a decision record before sealing: everything but the hash,
 * distributed over both verdict variants.
 *
 * @example
 * ```ts
 * import type { ExecutionDecisionContent } from "@beep/epistemic-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const seq: ExecutionDecisionContent["seq"] = NonNegativeInt.make(0)
 * console.log(seq)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionDecisionContent = DistributiveOmit<ExecutionDecisionRecord, "hash">;

// Manual wire-form projection of decision content for hashing. Kept manual —
// rather than derived via S.omit — because the record schema is a tagged
// union, and the hash input must be stable independent of schema plumbing.
const encodeDecisionContent = (content: ExecutionDecisionContent): Record<string, unknown> => ({
  audience: content.audience,
  decidedAt: DateTime.toEpochMillis(content.decidedAt),
  destinationDigest: content.destinationDigest,
  grantSetDigest: content.grantSetDigest,
  operationDigest: content.operationDigest,
  policyRevision: content.policyRevision,
  prevHash: O.getOrNull(content.prevHash),
  runKey: content.runKey,
  seq: content.seq,
  sinkClass: content.sinkClass,
  verdict: content.verdict,
  ...(content.verdict === "denied" ? { reason: content.reason } : {}),
});

/**
 * Seals a decision record: computes the hash over the versioned canonical
 * encoding of its content (prevHash included, hash excluded) and attaches it.
 * The chain property follows: alter any sealed field and the seal breaks;
 * alter the seal and the next record's prevHash breaks.
 *
 * @example
 * ```ts
 * import { sealExecutionDecision } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 * import * as O from "effect/Option"
 * import { DateTime } from "effect"
 * import { DecisionRecordHash, ExecutionRunKey, GrantOperationDigest, GrantSetDigest, PolicyRevision, SinkDestinationDigest } from "@beep/epistemic-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const record = sealExecutionDecision({
 *   audience: "external-network",
 *   decidedAt: DateTime.makeUnsafe(1),
 *   destinationDigest: SinkDestinationDigest.make("e".repeat(64)),
 *   grantSetDigest: GrantSetDigest.make("a".repeat(64)),
 *   operationDigest: GrantOperationDigest.make("f".repeat(64)),
 *   policyRevision: S.decodeUnknownSync(PolicyRevision)("1.0.0"),
 *   prevHash: O.none(),
 *   runKey: ExecutionRunKey.make("b".repeat(64)),
 *   seq: NonNegativeInt.make(0),
 *   sinkClass: "network-egress",
 *   verdict: "allowed"
 * })
 * console.log(record.hash.length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const sealExecutionDecision = (content: ExecutionDecisionContent): ExecutionDecisionRecord => {
  const hash = DecisionRecordHash.make(
    digestOf(decisionEncodingVersion, canonicalJson(encodeDecisionContent(content)))
  );
  return ExecutionDecisionRecord.make({ ...content, hash });
};

/**
 * Re-verifies one decision record's seal by recomputing its hash from its own
 * content.
 *
 * @example
 * ```ts
 * import { sealExecutionDecision, verifyExecutionDecisionHash } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 * import * as O from "effect/Option"
 * import { DateTime } from "effect"
 * import { ExecutionRunKey, GrantOperationDigest, GrantSetDigest, PolicyRevision, SinkDestinationDigest } from "@beep/epistemic-domain"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const record = sealExecutionDecision({
 *   audience: "external-network",
 *   decidedAt: DateTime.makeUnsafe(1),
 *   destinationDigest: SinkDestinationDigest.make("e".repeat(64)),
 *   grantSetDigest: GrantSetDigest.make("a".repeat(64)),
 *   operationDigest: GrantOperationDigest.make("f".repeat(64)),
 *   policyRevision: S.decodeUnknownSync(PolicyRevision)("1.0.0"),
 *   prevHash: O.none(),
 *   runKey: ExecutionRunKey.make("b".repeat(64)),
 *   seq: NonNegativeInt.make(0),
 *   sinkClass: "network-egress",
 *   verdict: "allowed"
 * })
 * console.log(verifyExecutionDecisionHash(record))
 * // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const verifyExecutionDecisionHash = (record: ExecutionDecisionRecord): boolean =>
  digestOf(decisionEncodingVersion, canonicalJson(encodeDecisionContent(record))) === record.hash;

const ChainVerificationTag = LiteralKit(["chain-intact", "chain-broken"]);

/**
 * Result of verifying one run's decision chain: intact, or broken at the
 * first failing zero-based index — where "failing" means a bad seal, a seq
 * gap, or a prevHash that does not equal the previous record's hash.
 *
 * @example
 * ```ts
 * import { ChainVerification } from "@beep/epistemic-domain"
 * import * as S from "effect/Schema"
 *
 * const broken = S.decodeUnknownSync(ChainVerification)({
 *   atIndex: 3,
 *   result: "chain-broken"
 * })
 * console.log(broken.result)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChainVerification = ChainVerificationTag.toTaggedUnion("result")({
  "chain-intact": {},
  "chain-broken": { atIndex: NonNegativeInt },
}).pipe(
  $I.annoteSchema("ChainVerification", {
    description: "Chain verification result: intact, or broken at the first failing index.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link ChainVerification}.
 *
 * @example
 * ```ts
 * import type { ChainVerification } from "@beep/epistemic-domain"
 *
 * const intact: ChainVerification = { result: "chain-intact" }
 * console.log(intact.result)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ChainVerification = typeof ChainVerification.Type;

/**
 * Verifies one run's decision chain, ordered by seq ascending. Checks that
 * every record belongs to the **same run**, that every seal recomputes, that
 * sequencing is dense and zero-based, that `prevHash` is none exactly at seq
 * zero, and that each later `prevHash` equals the previous record's hash.
 * Total: returns a value for every input, including the empty chain (intact).
 *
 * The run check is not redundant with the caller's query. Seals are plain
 * SHA-256 with no secret key, so anyone able to write rows can seal a record
 * carrying a foreign
 * `runKey` whose seq and prevHash continue this run; without an in-verifier
 * check, a mixed-run array (join bug, export/import, deliberate splice) would
 * certify as intact. Pass `expectedRunKey` when the caller knows which run it
 * asked for — then even a chain whose *every* record shares one wrong run is
 * rejected.
 *
 * **What this does not prove.** Verification is internal-consistency only, and
 * therefore says nothing about the chain's tail: the last record can be
 * rewritten and resealed, or any suffix deleted, and the result still verifies
 * intact. `chain-intact` is tamper evidence only relative to an externally
 * anchored tail hash and expected length — which this slice deliberately does
 * not ship (anchoring is a separate candidate packet). Read it as "these
 * records are mutually consistent," never as "nothing was removed."
 *
 * @example
 * ```ts
 * import { verifyExecutionDecisionChain } from "@beep/epistemic-domain"
 *
 * console.log(verifyExecutionDecisionChain([]))
 * // { result: "chain-intact" }
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const verifyExecutionDecisionChain: {
  (expectedRunKey?: ExecutionRunKey): (records: ReadonlyArray<ExecutionDecisionRecord>) => ChainVerification;
  (records: ReadonlyArray<ExecutionDecisionRecord>, expectedRunKey?: ExecutionRunKey): ChainVerification;
} = dual(
  (args) => A.isArray(args[0]),
  (records: ReadonlyArray<ExecutionDecisionRecord>, expectedRunKey?: ExecutionRunKey): ChainVerification => {
    let previousHash: DecisionRecordHash | undefined = undefined;
    let runKey: ExecutionRunKey | undefined = expectedRunKey;
    let index = 0;
    for (const record of records) {
      const prev = O.getOrUndefined(record.prevHash);
      runKey = runKey ?? record.runKey;
      if (
        record.runKey !== runKey ||
        record.seq !== index ||
        prev !== previousHash ||
        !verifyExecutionDecisionHash(record)
      ) {
        return ChainVerification.make({ result: "chain-broken", atIndex: NonNegativeInt.make(index) });
      }
      previousHash = record.hash;
      index += 1;
    }
    return ChainVerification.make({ result: "chain-intact" });
  }
);

/**
 * Cross-checks one outcome record against the decision it claims to settle.
 * The two records are sealed independently, so their seals alone cannot catch
 * an outcome recorded against the wrong run or against a *denied* decision —
 * which never executes and therefore can never settle.
 *
 * This is a domain-level check, not an enforcement mechanism: uniqueness of
 * outcomes per decision is a database constraint that a later slice adds, so
 * until then two conflicting outcomes for one decision can both self-verify
 * and this function will accept either.
 *
 * @example
 * ```ts
 * import { verifyOutcomeBinding } from "@beep/epistemic-domain"
 *
 * console.log(typeof verifyOutcomeBinding)
 * // "function"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const verifyOutcomeBinding: {
  (decision: ExecutionDecisionRecord): (outcome: ExecutionOutcomeRecord) => boolean;
  (outcome: ExecutionOutcomeRecord, decision: ExecutionDecisionRecord): boolean;
} = dual(
  2,
  (outcome: ExecutionOutcomeRecord, decision: ExecutionDecisionRecord): boolean =>
    outcome.decisionHash === decision.hash &&
    outcome.runKey === decision.runKey &&
    decision.verdict === "allowed" &&
    verifyExecutionOutcomeHash(outcome) &&
    verifyExecutionDecisionHash(decision)
);

// Manual wire-form projection of outcome content for hashing, mirroring
// encodeDecisionContent's rationale.
const encodeOutcomeContent = (content: ExecutionOutcomeContent): Record<string, unknown> => ({
  decisionHash: content.decisionHash,
  recordedAt: DateTime.toEpochMillis(content.recordedAt),
  runKey: content.runKey,
  settlement: content.settlement,
});

/**
 * Content of an outcome record before sealing: everything but the hash.
 *
 * @example
 * ```ts
 * import type { ExecutionOutcomeContent } from "@beep/epistemic-domain"
 *
 * const settlement: ExecutionOutcomeContent["settlement"] = "completed"
 * console.log(settlement)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExecutionOutcomeContent = Omit<ExecutionOutcomeRecord, "hash">;

/**
 * Seals an outcome record: hash over the versioned canonical encoding of its
 * content, decisionHash included — binding settlement to exactly one allowed
 * decision.
 *
 * @example
 * ```ts
 * import { DecisionRecordHash, ExecutionRunKey, sealExecutionOutcome } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 *
 * const outcome = sealExecutionOutcome({
 *   decisionHash: DecisionRecordHash.make("c".repeat(64)),
 *   recordedAt: DateTime.makeUnsafe(2),
 *   runKey: ExecutionRunKey.make("b".repeat(64)),
 *   settlement: "completed"
 * })
 * console.log(outcome.hash.length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const sealExecutionOutcome = (content: ExecutionOutcomeContent): ExecutionOutcomeRecord =>
  ExecutionOutcomeRecord.make({
    ...content,
    hash: OutcomeRecordHash.make(digestOf(outcomeEncodingVersion, canonicalJson(encodeOutcomeContent(content)))),
  });

/**
 * Re-verifies one outcome record's seal by recomputing its hash from its own
 * content.
 *
 * @example
 * ```ts
 * import { DecisionRecordHash, ExecutionRunKey, sealExecutionOutcome, verifyExecutionOutcomeHash } from "@beep/epistemic-domain"
 * import { DateTime } from "effect"
 *
 * const outcome = sealExecutionOutcome({
 *   decisionHash: DecisionRecordHash.make("c".repeat(64)),
 *   recordedAt: DateTime.makeUnsafe(2),
 *   runKey: ExecutionRunKey.make("b".repeat(64)),
 *   settlement: "completed"
 * })
 * console.log(verifyExecutionOutcomeHash(outcome))
 * // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const verifyExecutionOutcomeHash = (record: ExecutionOutcomeRecord): boolean =>
  digestOf(outcomeEncodingVersion, canonicalJson(encodeOutcomeContent(record))) === record.hash;

/**
 * Digests a raw operation or destination string for ledger storage. The one
 * bridge between grant-side raw values and record-side digests, kept here so
 * every caller hashes identically.
 *
 * @example
 * ```ts
 * import { digestForLedger } from "@beep/epistemic-domain"
 *
 * console.log(digestForLedger("https://registry.example").length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const digestForLedger = (raw: string): string => bytesToHex(sha256(utf8ToBytes(raw)));

/**
 * Digests a granted operation for ledger storage, so a raw tool name never
 * reaches a record column.
 *
 * @example
 * ```ts
 * import { GrantOperation, operationDigestOf } from "@beep/epistemic-domain"
 *
 * console.log(operationDigestOf(GrantOperation.make("ontology_publish_provenance")).length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const operationDigestOf = (operation: GrantOperation): GrantOperationDigest =>
  GrantOperationDigest.make(digestForLedger(operation));

/**
 * Digests a sink destination for ledger storage, so a raw destination never
 * reaches a record column.
 *
 * @example
 * ```ts
 * import { destinationDigestOf, SinkDestination } from "@beep/epistemic-domain"
 *
 * console.log(destinationDigestOf(SinkDestination.make("https://registry.example")).length)
 * // 64
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const destinationDigestOf = (destination: SinkDestination): SinkDestinationDigest =>
  SinkDestinationDigest.make(digestForLedger(destination));
