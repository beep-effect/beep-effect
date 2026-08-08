import {
  addGrant,
  DecisionRecordHash,
  DenialReason,
  DraftGrantSet,
  denialGuidance,
  destinationDigestOf,
  ExecutionDecisionRecord,
  ExecutionGrant,
  ExecutionOutcomeRecord,
  ExecutionRequest,
  ExecutionRequestEvaluationOptions,
  ExecutionRunKey,
  emptyDraftGrantSet,
  evaluateExecutionRequest,
  evaluatorDenialReasons,
  FrozenGrantSet,
  freezeGrantSet,
  GrantOperation,
  GrantOperationDigest,
  GrantSetDigest,
  operationDigestOf,
  PolicyRevision,
  SinkClass,
  SinkDestination,
  SinkDestinationDigest,
  sealExecutionDecision,
  sealExecutionOutcome,
  ungovernedInfrastructureDestinations,
  verifyExecutionDecisionChain,
  verifyExecutionDecisionHash,
  verifyExecutionOutcomeHash,
  verifyFrozenGrantSetDigest,
  verifyOutcomeBinding,
} from "@beep/epistemic-domain";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type {
  ChainVerification,
  DecisionRecordHash as DecisionRecordHashType,
  ExecutionVerdict,
} from "@beep/epistemic-domain";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: {
    readonly numRuns?: number;
  }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 50)
  );
};

const sha256HexPattern = /^[0-9a-f]{64}$/;

const revision = S.decodeSync(PolicyRevision)("1.0.0");
const otherRevision = S.decodeSync(PolicyRevision)("2.0.0");

const grant = S.decodeSync(ExecutionGrant)({
  budget: { maxToolCalls: null },
  expiresAt: 60000,
  operation: "ontology_publish_provenance",
  policyRevision: "1.0.0",
  principal: { component: "Runtime", kind: "System" },
  purpose: "provenance-publication",
  resource: "ontology-workspace",
  sink: {
    audience: "external-network",
    destination: "https://registry.example",
    sinkClass: "network-egress",
  },
});

const requestInput = {
  destination: "https://registry.example",
  operation: "ontology_publish_provenance",
  principal: { component: "Runtime", kind: "System" },
  resolvedAudience: "external-network",
  sinkClass: "network-egress",
} as const;

const request = (overrides: Record<string, unknown> = {}): ExecutionRequest =>
  S.decodeSync(ExecutionRequest)({ ...requestInput, ...overrides });

const now = DateTime.makeUnsafe(0);
const afterExpiry = DateTime.makeUnsafe(120000);
const evaluationOptions = (
  evaluationTime: DateTime.Utc,
  currentPolicyRevision: PolicyRevision
): ExecutionRequestEvaluationOptions =>
  ExecutionRequestEvaluationOptions.make({ currentPolicyRevision, now: evaluationTime });

const draft = Result.getOrThrow(addGrant(emptyDraftGrantSet(revision), grant));
const frozen = freezeGrantSet(draft, DateTime.makeUnsafe(0));

const expectDenied = (verdict: ExecutionVerdict, reason: DenialReason): void => {
  expect(verdict.verdict).toBe("denied");
  if (verdict.verdict === "denied") {
    expect(verdict.reason).toBe(reason);
  }
};

const expectChainBrokenAt = (verification: ChainVerification, atIndex: number): void => {
  expect(verification.result).toBe("chain-broken");
  if (verification.result === "chain-broken") {
    expect(verification.atIndex).toBe(atIndex);
  }
};

const decisionContent = (input: {
  readonly seq: number;
  readonly prevHash: O.Option<DecisionRecordHashType>;
  readonly destinationDigest?: string;
  readonly runKey?: string;
}) =>
  ({
    audience: "external-network",
    decidedAt: DateTime.makeUnsafe(input.seq + 1),
    destinationDigest: SinkDestinationDigest.make(input.destinationDigest ?? "e".repeat(64)),
    grantSetDigest: GrantSetDigest.make("a".repeat(64)),
    operationDigest: GrantOperationDigest.make("f".repeat(64)),
    policyRevision: revision,
    prevHash: input.prevHash,
    runKey: ExecutionRunKey.make(input.runKey ?? "b".repeat(64)),
    seq: NonNegativeInt.make(input.seq),
    sinkClass: "network-egress",
    verdict: "allowed",
  }) as const;

describe("ExecutionAuthority", () => {
  describe("evaluateExecutionRequest", () => {
    it("allows a request matching every grant axis", () => {
      const verdict = evaluateExecutionRequest(request(), evaluationOptions(now, revision))(frozen);

      expect(verdict.verdict).toBe("allowed");
    });

    it("reaches every evaluator denial reason distinctly, one axis per case", () => {
      const tamperedFrozen = S.decodeSync(FrozenGrantSet)({
        ...S.encodeSync(FrozenGrantSet)(frozen),
        grants: [],
      });
      const verdictsByReason: Record<(typeof evaluatorDenialReasons)[number], ExecutionVerdict> = {
        "grant-set-digest-mismatch": evaluateExecutionRequest(
          tamperedFrozen,
          request(),
          evaluationOptions(now, revision)
        ),
        "policy-revision-mismatch": evaluateExecutionRequest(frozen, request(), evaluationOptions(now, otherRevision)),
        "principal-not-granted": evaluateExecutionRequest(
          frozen,
          request({ principal: { component: "Policy", kind: "System" } }),
          evaluationOptions(now, revision)
        ),
        "operation-not-granted": evaluateExecutionRequest(
          frozen,
          request({ operation: "ontology_delete_everything" }),
          evaluationOptions(now, revision)
        ),
        "sink-class-not-granted": evaluateExecutionRequest(
          frozen,
          request({ sinkClass: "mcp-write" }),
          evaluationOptions(now, revision)
        ),
        "audience-not-granted": evaluateExecutionRequest(
          frozen,
          request({ resolvedAudience: "local-workspace" }),
          evaluationOptions(now, revision)
        ),
        "destination-not-granted": evaluateExecutionRequest(
          frozen,
          request({ destination: "https://attacker.example" }),
          evaluationOptions(now, revision)
        ),
        "grant-expired": evaluateExecutionRequest(frozen, request(), evaluationOptions(afterExpiry, revision)),
      };

      expect(evaluatorDenialReasons.length).toBe(8);
      for (const reason of evaluatorDenialReasons) {
        expectDenied(verdictsByReason[reason], reason);
      }
    });

    it("fails closed: an operation absent from the set denies, never allows", () => {
      const verdict = evaluateExecutionRequest(
        frozen,
        request({ operation: "ontology_delete_everything" }),
        evaluationOptions(now, revision)
      );

      expectDenied(verdict, "operation-not-granted");
    });

    it("denies grant-set-digest-mismatch for a tampered seal before answering anything else", () => {
      // The tampered set's grants would otherwise produce operation-not-granted;
      // the broken seal must win because a set that fails its own digest cannot
      // be trusted to answer any narrower question.
      const tampered = S.decodeSync(FrozenGrantSet)({
        ...S.encodeSync(FrozenGrantSet)(frozen),
        grants: [],
      });

      expectDenied(
        evaluateExecutionRequest(tampered, request(), evaluationOptions(now, revision)),
        "grant-set-digest-mismatch"
      );
    });
  });

  describe("grant sets", () => {
    it("addGrant appends and preserves the policy revision", () => {
      const widened = Result.getOrThrow(addGrant(draft, grant));

      expect(widened.grants.length).toBe(draft.grants.length + 1);
      expect(widened.grants[widened.grants.length - 1]).toStrictEqual(grant);
      expect(widened.policyRevision).toBe(draft.policyRevision);
    });

    it("addGrant rejects a grant issued under a different policy revision", () => {
      const failed = addGrant(emptyDraftGrantSet(otherRevision), grant);

      expect(Result.isFailure(failed)).toBe(true);
      if (Result.isFailure(failed)) {
        expect(failed.failure._tag).toBe("GrantRevisionMismatch");
        expect(failed.failure.setRevision).toBe(otherRevision);
        expect(failed.failure.grantRevision).toBe(revision);
      }
    });

    it("freezeGrantSet seals with a deterministic 64-char lowercase hex digest", () => {
      expect(frozen.digest).toMatch(sha256HexPattern);

      const again = freezeGrantSet(draft, DateTime.makeUnsafe(0));
      expect(again.digest).toBe(frozen.digest);

      const later = freezeGrantSet(draft, DateTime.makeUnsafe(1));
      expect(later.digest).not.toBe(frozen.digest);
    });

    it("verifyFrozenGrantSetDigest accepts the sealed set and rejects a tampered copy", () => {
      expect(verifyFrozenGrantSetDigest(frozen)).toBe(true);

      const tampered = S.decodeSync(FrozenGrantSet)({
        ...S.encodeSync(FrozenGrantSet)(frozen),
        policyRevision: "2.0.0",
      });
      expect(verifyFrozenGrantSetDigest(tampered)).toBe(false);
    });
  });

  describe("decision records", () => {
    it("sealExecutionDecision round-trips through verifyExecutionDecisionHash", () => {
      const record = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));

      expect(record.hash).toMatch(sha256HexPattern);
      expect(verifyExecutionDecisionHash(record)).toBe(true);
    });

    it("rejects a tampered decision record keeping its old hash", () => {
      const record = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const tampered = S.decodeSync(ExecutionDecisionRecord)({
        ...S.encodeSync(ExecutionDecisionRecord)(record),
        audience: "local-workspace",
      });

      expect(verifyExecutionDecisionHash(tampered)).toBe(false);
    });

    it("verifies an intact 3-record chain and the empty chain", () => {
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const second = sealExecutionDecision(decisionContent({ seq: 1, prevHash: O.some(first.hash) }));
      const third = sealExecutionDecision(decisionContent({ seq: 2, prevHash: O.some(second.hash) }));

      expect(verifyExecutionDecisionChain([first, second, third]).result).toBe("chain-intact");
      expect(verifyExecutionDecisionChain([]).result).toBe("chain-intact");
    });

    it("breaks the chain at the tampered middle record", () => {
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const second = sealExecutionDecision(decisionContent({ seq: 1, prevHash: O.some(first.hash) }));
      const third = sealExecutionDecision(decisionContent({ seq: 2, prevHash: O.some(second.hash) }));
      const tamperedSecond = S.decodeSync(ExecutionDecisionRecord)({
        ...S.encodeSync(ExecutionDecisionRecord)(second),
        destinationDigest: "0".repeat(64),
      });

      expectChainBrokenAt(verifyExecutionDecisionChain([first, tamperedSecond, third]), 1);
    });

    it("breaks the chain at a seq gap", () => {
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const gapped = sealExecutionDecision(decisionContent({ seq: 2, prevHash: O.some(first.hash) }));

      expectChainBrokenAt(verifyExecutionDecisionChain([first, gapped]), 1);
    });

    it("breaks the chain at a cross-run splice: a foreign runKey continuing the chain", () => {
      // The foreign record is correctly sealed and continues seq/prevHash —
      // only its runKey names another run. Without the in-verifier run check,
      // this mixed-run array would certify as intact.
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const foreign = sealExecutionDecision(
        decisionContent({ seq: 1, prevHash: O.some(first.hash), runKey: "d".repeat(64) })
      );

      expectChainBrokenAt(verifyExecutionDecisionChain([first, foreign]), 1);
    });

    it("accepts an intact chain whose runKey matches expectedRunKey", () => {
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const second = sealExecutionDecision(decisionContent({ seq: 1, prevHash: O.some(first.hash) }));

      const verification = verifyExecutionDecisionChain([first, second], ExecutionRunKey.make("b".repeat(64)));

      expect(verification.result).toBe("chain-intact");
    });

    it("rejects an internally consistent chain whose runKey differs from expectedRunKey", () => {
      const first = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));
      const second = sealExecutionDecision(decisionContent({ seq: 1, prevHash: O.some(first.hash) }));

      expectChainBrokenAt(verifyExecutionDecisionChain([first, second], ExecutionRunKey.make("d".repeat(64))), 0);
    });
  });

  describe("outcome records", () => {
    it("sealExecutionOutcome round-trips through verifyExecutionOutcomeHash", () => {
      const outcome = sealExecutionOutcome({
        decisionHash: DecisionRecordHash.make("c".repeat(64)),
        recordedAt: DateTime.makeUnsafe(2),
        runKey: ExecutionRunKey.make("b".repeat(64)),
        settlement: "completed",
      });

      expect(outcome.hash).toMatch(sha256HexPattern);
      expect(verifyExecutionOutcomeHash(outcome)).toBe(true);
    });

    it("rejects a tampered outcome record keeping its old hash", () => {
      const outcome = sealExecutionOutcome({
        decisionHash: DecisionRecordHash.make("c".repeat(64)),
        recordedAt: DateTime.makeUnsafe(2),
        runKey: ExecutionRunKey.make("b".repeat(64)),
        settlement: "completed",
      });
      const tampered = S.decodeSync(ExecutionOutcomeRecord)({
        ...S.encodeSync(ExecutionOutcomeRecord)(outcome),
        settlement: "failed",
      });

      expect(verifyExecutionOutcomeHash(tampered)).toBe(false);
    });
  });

  describe("verifyOutcomeBinding", () => {
    const allowedDecision = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));

    it("accepts an outcome bound to its own allowed decision", () => {
      const outcome = sealExecutionOutcome({
        decisionHash: allowedDecision.hash,
        recordedAt: DateTime.makeUnsafe(2),
        runKey: allowedDecision.runKey,
        settlement: "completed",
      });

      expect(verifyOutcomeBinding(outcome, allowedDecision)).toBe(true);
    });

    it("rejects an outcome recorded under the wrong runKey", () => {
      const outcome = sealExecutionOutcome({
        decisionHash: allowedDecision.hash,
        recordedAt: DateTime.makeUnsafe(2),
        runKey: ExecutionRunKey.make("d".repeat(64)),
        settlement: "completed",
      });

      expect(verifyOutcomeBinding(outcome, allowedDecision)).toBe(false);
    });

    it("rejects an outcome claiming to settle a denied decision", () => {
      // A denied decision never executes, so nothing can legitimately settle it.
      const deniedDecision = sealExecutionDecision({
        ...decisionContent({ seq: 0, prevHash: O.none() }),
        verdict: "denied",
        reason: DenialReason.Enum["destination-not-granted"],
      });
      const outcome = sealExecutionOutcome({
        decisionHash: deniedDecision.hash,
        recordedAt: DateTime.makeUnsafe(2),
        runKey: deniedDecision.runKey,
        settlement: "completed",
      });

      expect(verifyOutcomeBinding(outcome, deniedDecision)).toBe(false);
    });
  });

  describe("ledger digests", () => {
    it("ledger digesters are deterministic and produce distinct 64-char digests per input", () => {
      const operation = GrantOperation.make("ontology_publish_provenance");
      const destination = SinkDestination.make("https://registry.example");

      expect(operationDigestOf(operation)).toMatch(sha256HexPattern);
      expect(destinationDigestOf(destination)).toMatch(sha256HexPattern);
      expect(operationDigestOf(operation)).toBe(operationDigestOf(operation));
      expect(destinationDigestOf(destination)).toBe(destinationDigestOf(destination));
      expect(operationDigestOf(GrantOperation.make("ontology_read_provenance"))).not.toBe(operationDigestOf(operation));
      expect(destinationDigestOf(SinkDestination.make("https://other.example"))).not.toBe(
        destinationDigestOf(destination)
      );
    });
  });

  describe("bounded vocabularies", () => {
    it("keeps the ungoverned-infrastructure destination set empty", () => {
      // Membership is CLOSED: this set is the only fail-open branch at the
      // policy seam, and a change here must be deliberate — update this
      // assertion only alongside an explicit governance decision.
      expect(ungovernedInfrastructureDestinations.length).toBe(0);
    });

    it("denialGuidance is total with constant, non-interpolated guidance", () => {
      for (const reason of DenialReason.Options) {
        const guidance = denialGuidance[reason];

        expect(guidance.length).toBeGreaterThan(0);
        expect(guidance.includes("$" + "{")).toBe(false);
      }
    });

    it("exposes LiteralKit guards for hyphenated members", () => {
      expect(DenialReason.is["grant-expired"]("grant-expired")).toBe(true);
      expect(SinkClass.is["mcp-write"]("mcp-write")).toBe(true);
    });
  });

  describe("golden digest vectors", () => {
    // These vectors pin the EXACT output of the canonical encodings and their
    // version prefixes. A change to ANY part of a canonical encoding — the
    // shared canonicalJson, the wire-form projections, the field sets, or the
    // version strings — MUST break these assertions deliberately: bump the
    // encoding version and update the vectors in the same change. A silent
    // digest change would strand every previously persisted seal.
    it("pins freezeGrantSet over the empty draft at frozenAt=0, policyRevision 1.0.0", () => {
      const emptyFrozen = freezeGrantSet(emptyDraftGrantSet(revision), DateTime.makeUnsafe(0));

      expect(emptyFrozen.digest).toBe("6b964a03608449b6b1900d53904a30b85625b8086f18dee48593d05cc94bc623");
    });

    it("pins freezeGrantSet over the one-grant draft at frozenAt=0", () => {
      expect(frozen.digest).toBe("637c2eed3a1a2cc13e35c71e3d309a63a56b5c26eea8cbb3eb7e15333ac33379");
    });

    it("pins sealExecutionDecision over a fixed allowed content", () => {
      const record = sealExecutionDecision(decisionContent({ seq: 0, prevHash: O.none() }));

      expect(record.hash).toBe("59963d1ec97b2eaabb2c4d6ff37cf1118b3f513a8da259b736586ab6791dbe9b");
    });

    it("pins sealExecutionOutcome over a fixed content", () => {
      const outcome = sealExecutionOutcome({
        decisionHash: DecisionRecordHash.make("c".repeat(64)),
        recordedAt: DateTime.makeUnsafe(2),
        runKey: ExecutionRunKey.make("b".repeat(64)),
        settlement: "completed",
      });

      expect(outcome.hash).toBe("c73e693653a6eb591d9a1cff1f46e5addf7e771ac3a32d9faa4d52dd7536113d");
    });
  });

  describe("schema arbitraries", () => {
    it("derives round-tripping arbitraries for execution authority schemas", () => {
      const options = { numRuns: 10 };

      assertSchemaArbitraryRoundTrip(ExecutionGrant, options);
      assertSchemaArbitraryRoundTrip(DraftGrantSet, options);
      assertSchemaArbitraryRoundTrip(ExecutionDecisionRecord, options);
      assertSchemaArbitraryRoundTrip(ExecutionOutcomeRecord, options);
    });
  });
});
