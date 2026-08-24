import { LiteralKit } from "@beep/schema/LiteralKit";
import { ISOStr } from "@beep/schema/Timestamp";
import {
  AlwaysGateApplicability,
  ConditionalGateApplicability,
  EvidencePredicateType,
  GateApplicability,
  GateApplicabilityKind,
  GateAuditRecord,
  GateDeclaration,
  GateEvidenceRequirement,
  GateId,
  GateRegistry,
  GateSeverity,
  GateVerdict,
  makeGateId,
  SchemaReference,
  SchemaReferenceId,
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
  applicability: AlwaysGateApplicability.make({}),
  evidence: GateEvidenceRequirement.make({ predicateType }),
  id: ConsumerGateId.make("artifact-exists"),
  remediationOwner: "qa",
  severity: "blocking",
});

describe("@beep/skill-contract Gate", () => {
  it("brands the wire id while retaining a consumer-local literal domain and distinct identity", () => {
    const OtherGateId = makeGateId(LiteralKit(["other-gate"]));
    expect(S.is(GateId)("artifact-exists")).toBe(true);
    expect(S.is(ConsumerGateId)("artifact-exists")).toBe(true);
    expect(S.is(ConsumerGateId)("unknown-gate")).toBe(false);
    expect(S.is(GateId)("")).toBe(false);
    expect(S.resolveAnnotations(ConsumerGateId)?.identifier).not.toBe(S.resolveAnnotations(OtherGateId)?.identifier);
  });

  it("keeps the base nonempty validation even when a consumer domain declares an empty literal", () => {
    const Sloppy = makeGateId(LiteralKit([""]));
    expect(S.is(Sloppy)("")).toBe(false);
  });

  it("models unconditional and referenced conditional applicability without invalid combinations", () => {
    const conditional = ConditionalGateApplicability.make({
      condition: SchemaReference.make({ schemaId: SchemaReferenceId.make("qa.condition/v1") }),
    });
    expect(GateSeverity.Options).toEqual(["blocking", "advisory"]);
    expect(GateApplicabilityKind.Options).toEqual(["always", "conditional"]);
    expect(declaration.applicability.kind).toBe("always");
    expect(declaration.evidence.predicateType).toBe(predicateType);
    expect(
      GateApplicability.match(conditional, {
        always: () => "always",
        conditional: ({ condition }) => condition.schemaId,
      })
    ).toBe("qa.condition/v1");
  });

  it.effect("round-trips a gate declaration through its schema", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeUnknownEffect(GateDeclaration)(declaration);
      const decoded = yield* S.decodeEffect(GateDeclaration)(encoded);

      expect(S.toEquivalence(GateDeclaration)(decoded, declaration)).toBe(true);
    })
  );

  it.effect("rejects duplicate registry ids and malformed audit timestamps at decode", () =>
    Effect.gen(function* () {
      const encodedDeclaration = yield* S.encodeUnknownEffect(GateDeclaration)(declaration);
      const duplicateRegistryInput: unknown = {
        declarations: [encodedDeclaration, encodedDeclaration],
      };
      const Detail = S.Struct({ paths: S.Array(S.String) });
      const Audit = GateAuditRecord("TimestampAudit", "allowed", Detail);
      const malformedTimestampInput: unknown = {
        detail: { paths: [] },
        evaluator: "qa",
        gateId: "artifact-exists",
        occurredAt: "not-a-timestamp",
        outcome: "allowed",
        reason: "Checked.",
      };
      const duplicateRegistry = yield* S.decodeUnknownEffect(GateRegistry)(duplicateRegistryInput).pipe(Effect.flip);
      const malformedTimestamp = yield* S.decodeUnknownEffect(Audit)(malformedTimestampInput).pipe(Effect.flip);

      expect(duplicateRegistry.message).toContain("unique gate ids");
      expect(malformedTimestamp.message).toContain('["occurredAt"]');
    })
  );

  it.effect("keeps allowed and denied outcomes as coherent audited values", () =>
    Effect.gen(function* () {
      const AllowedDetail = S.Struct({ checkedPaths: S.Array(S.String) });
      const DeniedDetail = S.Struct({ missingPaths: S.NonEmptyArray(S.String) });
      const Verdict = GateVerdict("ArtifactExistsVerdict", AllowedDetail, DeniedDetail);
      const gateId = ConsumerGateId.make("artifact-exists");
      const occurredAt = ISOStr.make("2026-08-24T00:00:00.000Z");
      const allowed = Verdict.cases.allowed.make({
        audit: {
          detail: { checkedPaths: ["frames/drag.png"] },
          evaluator: "qa",
          gateId,
          occurredAt,
          outcome: "allowed",
          reason: "The artifact exists.",
        },
      });
      const denied = Verdict.cases.denied.make({
        audit: {
          detail: { missingPaths: ["frames/ghost.png"] },
          evaluator: "qa",
          gateId,
          occurredAt,
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

  it("supports curried distinctly identified audit and verdict schema factories", () => {
    const Detail = S.Struct({ paths: S.Array(S.String) });
    const DeniedAudit = GateAuditRecord("denied", Detail)("CurriedDeniedAudit");
    const Verdict = GateVerdict(Detail, Detail)("CurriedVerdict");
    const OtherVerdict = GateVerdict("OtherVerdict", Detail, Detail);

    expect(DeniedAudit.ast).toBeDefined();
    expect(Verdict.discriminants).toEqual(["allowed", "denied"]);
    expect(S.resolveAnnotations(Verdict)?.identifier).not.toBe(S.resolveAnnotations(OtherVerdict)?.identifier);
  });
});
