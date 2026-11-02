import { Sha256Hex } from "@beep/schema/Sha256";
import { URLStr } from "@beep/schema/URL";
import {
  applyGateCertificatePlan,
  CertificateCheck,
  CertificateReach,
  CheckOutcome,
  EvidenceDigest,
  EvidencePredicateType,
  EvidenceSubject,
  GateCertificate,
  GateCertificateApplyPlan,
  GateCertificateApplyVerdict,
  GateCertificatePredicateType,
  GateCertificateReceipt,
  GateId,
  GateSummaryVerifier,
  InconclusiveCheckOutcome,
  settleGateCertificateOutcome,
} from "@beep/skill-contract";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GateSeverity } from "@beep/skill-contract";

const decodeReceipt = S.decodeUnknownEffect(GateCertificateReceipt);
const encodeReceipt = S.encodeUnknownEffect(GateCertificateReceipt);
const decodeCertificateResult = S.decodeUnknownResult(GateCertificate);
const decodeCheckResult = S.decodeUnknownResult(CertificateCheck);
const encodeCheckResult = S.encodeUnknownResult(CertificateCheck);
const decodePlan = S.decodeUnknownEffect(GateCertificateApplyPlan);
const isInconclusive = S.is(InconclusiveCheckOutcome);

const digestOf = (char: string) => EvidenceDigest.make({ sha256: Sha256Hex.make(Str.repeat(64)(char)) });
const inventory = EvidenceSubject.make({ digest: digestOf("a"), name: "qa/round-1/inventory.json" });
const contractSubject = EvidenceSubject.make({ digest: digestOf("b"), name: "contract@1.0.0" });
const evidenceType = EvidencePredicateType.make("https://example.test/evidence/check/v1");
const verifier = GateSummaryVerifier.make({
  id: URLStr.make("https://example.test/verifier/v1"),
  version: { kernel: "1.0.0" },
});

const check = (
  id: string,
  outcome: CheckOutcome,
  options: { readonly inReach?: boolean; readonly severity?: GateSeverity } = {}
) =>
  CertificateCheck.make({
    checkId: GateId.make(id),
    evidenceSubjects: CheckOutcome.is.passed(outcome) ? [inventory] : [],
    evidenceType,
    inReach: options.inReach ?? true,
    outcome,
    severity: options.severity ?? "blocking",
  });

const certificateFor = (reach: CertificateReach, checks: ReadonlyArray<CertificateCheck>) =>
  GateCertificate.make({
    checks,
    contractSubject,
    outcome: settleGateCertificateOutcome(reach, checks),
    reach,
    timeVerified: "2026-11-02T00:00:00.000Z",
    verifier,
  });

const receiptFor = (certificate: GateCertificate) =>
  GateCertificateReceipt.make({
    predicate: certificate,
    predicateType: GateCertificatePredicateType,
    subject: [inventory],
  });

describe("@beep/skill-contract GateCertificate settlement", () => {
  it("settles each rule in order", () => {
    const passed = check("a", "passed");
    expect(settleGateCertificateOutcome("complete", [passed, check("b", "failed")])).toBe("failed");
    expect(settleGateCertificateOutcome("complete", [passed, check("b", "failed", { severity: "advisory" })])).toBe(
      "passed"
    );
    expect(settleGateCertificateOutcome("complete", [passed, check("b", "cantTell"), check("c", "untested")])).toBe(
      "cantTell"
    );
    expect(settleGateCertificateOutcome("complete", [passed, check("b", "untested")])).toBe("untested");
    expect(settleGateCertificateOutcome("incomplete", [passed])).toBe("cantTell");
    expect(settleGateCertificateOutcome("unknown", [passed])).toBe("cantTell");
    expect(settleGateCertificateOutcome("complete", [check("a", "inapplicable")])).toBe("inapplicable");
    expect(settleGateCertificateOutcome("complete", [])).toBe("inapplicable");
    expect(settleGateCertificateOutcome("complete", [passed, check("b", "untested", { inReach: false })])).toBe(
      "cantTell"
    );
    expect(settleGateCertificateOutcome("incomplete", [passed, check("b", "failed", { inReach: false })])).toBe(
      "cantTell"
    );
    expect(settleGateCertificateOutcome([passed])("complete")).toBe("passed");
  });

  it.effect.prop(
    "never settles passed while an in-reach check is inconclusive, failed-blocking, or reach is not complete",
    [CertificateReach, S.Array(CertificateCheck)],
    ([reach, checks]) =>
      Effect.sync(() => {
        const outcome = settleGateCertificateOutcome(reach, checks);
        const inReach = A.filter(checks, (candidate) => candidate.inReach);
        const anyInconclusive = A.some(inReach, (candidate) => isInconclusive(candidate.outcome));
        if (anyInconclusive) {
          expect(outcome).not.toBe("passed");
          expect(CheckOutcome.is.failed(outcome) || isInconclusive(outcome)).toBe(true);
        }
        if (CheckOutcome.is.passed(outcome)) {
          expect(reach).toBe("complete");
          expect(A.length(inReach)).toBe(A.length(checks));
          expect(
            A.every(
              inReach,
              (candidate) =>
                CheckOutcome.is.passed(candidate.outcome) ||
                CheckOutcome.is.inapplicable(candidate.outcome) ||
                candidate.severity === "advisory"
            )
          ).toBe(true);
        }
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect.prop(
    "rejects a decoded certificate claiming passed with an in-reach inconclusive check",
    [InconclusiveCheckOutcome, CertificateReach],
    ([inconclusive, reach]) =>
      Effect.sync(() => {
        const decoded = decodeCertificateResult({
          checks: [{ ...check("a", "passed"), evidenceSubjects: [inventory] }, { ...check("b", inconclusive) }],
          contractSubject,
          outcome: "passed",
          reach,
          timeVerified: "2026-11-02T00:00:00.000Z",
          verifier,
        });
        expect(Result.isFailure(decoded)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips schema-derived certificate checks",
    [CertificateCheck],
    ([candidate]) =>
      Effect.sync(() => {
        const encoded = Result.getOrThrow(encodeCheckResult(candidate));
        const decoded = Result.getOrThrow(decodeCheckResult(encoded));
        expect(S.toEquivalence(CertificateCheck)(decoded, candidate)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );
});

describe("@beep/skill-contract GateCertificate envelope", () => {
  it.effect("round-trips an unsigned digest-bound certificate envelope", () =>
    Effect.gen(function* () {
      const receipt = receiptFor(certificateFor("complete", [check("a", "passed"), check("b", "inapplicable")]));
      const encoded = yield* encodeReceipt(receipt);
      const decoded = yield* decodeReceipt(encoded);

      expect(S.toEquivalence(GateCertificateReceipt)(decoded, receipt)).toBe(true);
      expect(decoded.predicateType).toBe(GateCertificatePredicateType);
      expect(decoded.subject[0].digest.sha256).toBe(Str.repeat(64)("a"));
      expect(decoded.predicate.outcome).toBe("passed");
    })
  );

  it.effect("rejects incoherent outcomes, duplicate check ids, and passed checks without evidence", () =>
    Effect.gen(function* () {
      const encoded = yield* encodeReceipt(receiptFor(certificateFor("complete", [check("a", "passed")])));
      const wrongOutcome = yield* decodeReceipt({
        ...encoded,
        predicate: { ...encoded.predicate, outcome: "failed" },
      }).pipe(Effect.flip);
      const duplicate = yield* decodeReceipt({
        ...encoded,
        predicate: { ...encoded.predicate, checks: [encoded.predicate.checks[0], encoded.predicate.checks[0]] },
      }).pipe(Effect.flip);
      const noEvidence = yield* decodeReceipt({
        ...encoded,
        predicate: {
          ...encoded.predicate,
          checks: A.map(encoded.predicate.checks, (row) => ({ ...row, evidenceSubjects: [] })),
        },
      }).pipe(Effect.flip);

      const completeWithOutOfReach = yield* decodeReceipt({
        ...encoded,
        predicate: {
          ...encoded.predicate,
          checks: A.map(encoded.predicate.checks, (row) => ({ ...row, inReach: false })),
          outcome: "cantTell",
        },
      }).pipe(Effect.flip);

      expect(wrongOutcome.message).toContain("must equal the outcome settled");
      expect(completeWithOutOfReach.message).toContain("requires every listed check in reach");
      expect(duplicate.message).toContain("unique check ids");
      expect(noEvidence.message).toContain("require non-empty evidence subjects");
    })
  );
});

describe("@beep/skill-contract GateCertificate apply-by-id plan", () => {
  const receipt = receiptFor(certificateFor("complete", [check("a", "passed"), check("b", "passed")]));
  const certificateSubject = EvidenceSubject.make({ digest: digestOf("c"), name: "qa/round-1/certificate.json" });
  const planFor = (ids: A.NonEmptyReadonlyArray<string>, subject = certificateSubject) =>
    GateCertificateApplyPlan.make({ certificate: subject, checkIds: A.map(ids, (id) => GateId.make(id)) });
  const appliedIds = (verdict: GateCertificateApplyVerdict) =>
    GateCertificateApplyVerdict.match(verdict, {
      applied: ({ checks }) => A.map(checks, (row) => row.checkId),
      refused: () => [],
    });

  it("applies known ids in plan order against the bound digest", () => {
    const verdict = applyGateCertificatePlan(planFor(["b", "a"]), certificateSubject, receipt);
    expect(verdict.verdict).toBe("applied");
    expect(appliedIds(verdict)).toEqual(["b", "a"]);
    expect(applyGateCertificatePlan(certificateSubject, receipt)(planFor(["a"])).verdict).toBe("applied");
  });

  it("refuses a stale digest before inspecting ids", () => {
    const stale = EvidenceSubject.make({ digest: digestOf("d"), name: certificateSubject.name });
    const verdict = applyGateCertificatePlan(planFor(["a", "zzz"], stale), certificateSubject, receipt);
    expect(verdict).toMatchObject({ reason: "stale-digest", unknownIds: [], verdict: "refused" });
    expect(appliedIds(verdict)).toEqual([]);
  });

  it("refuses the whole plan when any id is unknown", () => {
    const verdict = applyGateCertificatePlan(planFor(["a", "zzz", "yyy"]), certificateSubject, receipt);
    expect(verdict).toMatchObject({ reason: "unknown-id", unknownIds: ["zzz", "yyy"], verdict: "refused" });
  });

  it.effect("rejects a plan naming the same id twice at decode", () =>
    Effect.gen(function* () {
      const failure = yield* decodePlan({ certificate: certificateSubject, checkIds: ["a", "a"] }).pipe(Effect.flip);
      expect(failure.message).toContain("unique check ids");
    })
  );
});
