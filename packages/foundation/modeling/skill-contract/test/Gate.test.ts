import { LiteralKit } from "@beep/schema/LiteralKit";
import {
  EvidencePredicateType,
  GateApplicability,
  GateAuditRecord,
  GateDeclaration,
  GateEvidenceRequirement,
  GateId,
  GateSeverity,
  GateVerdict,
  makeGateId,
} from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { GateEvaluator } from "@beep/skill-contract";

const ConsumerGateId = makeGateId(LiteralKit(["artifact-exists", "event-exists"]));
const predicateType = EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1");
const declaration = GateDeclaration.make({
  applicability: "always",
  evidence: GateEvidenceRequirement.make({ predicateType }),
  id: ConsumerGateId.make("artifact-exists"),
  remediationOwner: "qa",
  severity: "blocking",
});

describe("@beep/skill-contract Gate", () => {
  it("brands the wire id while retaining a consumer-local literal domain", () => {
    expect(S.is(GateId)("artifact-exists")).toBe(true);
    expect(S.is(ConsumerGateId)("artifact-exists")).toBe(true);
    expect(S.is(ConsumerGateId)("unknown-gate")).toBe(false);
    expect(S.is(GateId)("")).toBe(false);
  });

  it("keeps the base nonempty validation even when a consumer domain declares an empty literal", () => {
    const Sloppy = makeGateId(LiteralKit([""]));
    expect(S.is(Sloppy)("")).toBe(false);
  });

  it("exposes severity and the reserved conditional applicability value", () => {
    expect(GateSeverity.Options).toEqual(["blocking", "advisory"]);
    expect(GateApplicability.Options).toEqual(["always", "conditional"]);
    expect(declaration.applicability).toBe("always");
    expect(declaration.evidence.predicateType).toBe(predicateType);
  });

  it.effect("round-trips a gate declaration through its schema", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(GateDeclaration)(declaration);
      const decoded = yield* S.decodeEffect(GateDeclaration)(encoded);

      expect(S.toEquivalence(GateDeclaration)(decoded, declaration)).toBe(true);
    })
  );

  it.effect("keeps allowed and denied outcomes as coherent audited values", () =>
    Effect.gen(function* () {
      const AllowedDetail = S.Struct({ checkedPaths: S.Array(S.String) });
      const DeniedDetail = S.Struct({ missingPaths: S.NonEmptyArray(S.String) });
      const Verdict = GateVerdict(AllowedDetail, DeniedDetail);
      const gateId = ConsumerGateId.make("artifact-exists");
      const allowed = Verdict.cases.allowed.make({
        audit: {
          detail: { checkedPaths: ["frames/drag.png"] },
          evaluator: "qa",
          gateId,
          occurredAt: "2026-08-24T00:00:00.000Z",
          outcome: "allowed",
          reason: "The artifact exists.",
        },
      });
      const denied = Verdict.cases.denied.make({
        audit: {
          detail: { missingPaths: ["frames/ghost.png"] },
          evaluator: "qa",
          gateId,
          occurredAt: "2026-08-24T00:00:00.000Z",
          outcome: "denied",
          reason: "The artifact is missing.",
        },
      });
      const evaluate: GateEvaluator<void, typeof Verdict.Type> = () => Effect.succeed(denied);
      const result = yield* evaluate();
      const mismatchedOutcome: unknown = {
        ...denied,
        audit: { ...denied.audit, outcome: "allowed" },
      };
      const mismatch = yield* S.decodeUnknownEffect(Verdict)(mismatchedOutcome).pipe(Effect.flip);

      expect(Verdict.match(allowed, { allowed: ({ audit }) => audit.outcome, denied: () => "denied" })).toBe("allowed");
      expect(result.verdict).toBe("denied");
      expect(mismatch.message).toContain("denied");
    })
  );

  it("round-trips schema-derived arbitrary gate declarations", () =>
    fc.assert(
      fc.property(S.toArbitrary(GateDeclaration)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(GateDeclaration)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(GateDeclaration)(encoded));

        expect(S.toEquivalence(GateDeclaration)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));

  it("supports curried audit and verdict schema factories", () => {
    const Detail = S.Struct({ paths: S.Array(S.String) });
    const DeniedAudit = GateAuditRecord(Detail)("denied");
    const Verdict = GateVerdict(Detail)(Detail);

    expect(DeniedAudit.ast).toBeDefined();
    expect(Verdict.discriminants).toEqual(["allowed", "denied"]);
  });
});
