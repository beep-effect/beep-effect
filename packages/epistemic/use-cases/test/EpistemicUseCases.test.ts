import { CandidateClaim, ClaimGateResult, ClaimLifecycle, ClaimProjectionView, Evidence } from "@beep/epistemic-domain";
import * as ClaimGateUC from "@beep/epistemic-use-cases/ClaimGate";
import * as ClaimLifecycleUC from "@beep/epistemic-use-cases/ClaimLifecycle";
import { ClaimProjection, projectClaims } from "@beep/epistemic-use-cases/ClaimProjection";
import { ShaclValidationServiceLive } from "@beep/semantic-web/adapters/shacl-engine";
import { ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ClaimProjectionAuthorityArbitrary = S.toArbitrary(ClaimProjection.inputSchema);
const sameClaimProjectionView = S.toEquivalence(ClaimProjectionView);

const makeCandidate = (id: number, fixtureKey: string, lifecycle: string): CandidateClaim =>
  S.decodeUnknownSync(CandidateClaim)({
    ...baseEntityFixtureInput("EpistemicCandidateClaim", id),
    fixtureKey,
    lifecycle,
    snapshot: {},
  });

const evidence: Evidence = S.decodeUnknownSync(Evidence)({
  ...baseEntityFixtureInput("EpistemicEvidence", 10),
  artifactFixtureKey: "artifact.office-action",
  spanFixtureKey: "span.claim-1",
  span: { startChar: 0, endChar: 14, quote: "a claimed fact", confidence: 0.92 },
});

const candidate = makeCandidate(1, "claim.patentability", "candidate");
const alreadyAdmitted = makeCandidate(4, "claim.alreadyAdmitted", "admitted");
const admittedVerdict = S.decodeSync(ClaimGateResult)({ verdict: "admitted" });

describe("@beep/epistemic-use-cases", () => {
  // Boots only the bounded SHACL capability layer — no other slice, no runtime.
  it.layer(ShaclValidationServiceLive)("claim gate over the bounded SHACL engine", (it) => {
    it.effect(
      "admits a well-formed claim and advances candidate -> shape_valid",
      Effect.fnUntraced(function* () {
        const shacl = yield* ShaclValidationService;
        const gate = ClaimGateUC.makeClaimGate(shacl);

        const verdict = yield* gate.evaluate(candidate, [evidence]);
        expect(verdict.verdict).toBe("admitted");

        const advanced = yield* ClaimLifecycleUC.makeClaimTransition().advance(candidate, verdict);
        expect(advanced.lifecycle).toBe("shape_valid");
        expect(advanced.fixtureKey).toBe(candidate.fixtureKey);
      })
    );

    it.effect(
      "rejects a claim with no evidence span and does not advance",
      Effect.fnUntraced(function* () {
        const shacl = yield* ShaclValidationService;
        const gate = ClaimGateUC.makeClaimGate(shacl);

        const verdict = yield* gate.evaluate(candidate, []);
        expect(verdict.verdict).toBe("rejected");
        if (ClaimGateResult.guards.rejected(verdict)) {
          expect(verdict.violations.length).toBeGreaterThan(0);
          expect(verdict.violations[0].severity).toBe("violation");
        }

        const blocked = yield* ClaimLifecycleUC.makeClaimTransition().advance(candidate, verdict);
        expect(blocked.lifecycle).toBe("candidate");
      })
    );
  });

  it.effect(
    "fails an illegal advance from a non-candidate state with ClaimInvalidTransition",
    Effect.fnUntraced(function* () {
      const error = yield* ClaimLifecycleUC.makeClaimTransition()
        .advance(alreadyAdmitted, admittedVerdict)
        .pipe(Effect.flip);

      expect(error._tag).toBe("ClaimInvalidTransition");
      expect(error.from).toBe("admitted");
      expect(error.to).toBe("shape_valid");
    })
  );

  it("projects a single-owner authority deterministically and referentially equal on rebuild", () => {
    const authority: ReadonlyArray<CandidateClaim> = [
      candidate,
      makeCandidate(2, "claim.novelty", "admitted"),
      makeCandidate(3, "claim.obviousness", "shape_valid"),
    ];

    const view1 = projectClaims(authority);
    const view2 = projectClaims(authority);
    const encoded = S.encodeSync(ClaimProjection.outputSchema)(view1);

    expect(view1.total).toBe(3);
    expect(view1.counts.candidate).toBe(1);
    expect(view1.counts.shape_valid).toBe(1);
    expect(view1.counts.admitted).toBe(1);
    expect([...view1.admittedKeys]).toEqual(["claim.novelty"]);
    expect(encoded).toStrictEqual({
      admittedKeys: ["claim.novelty"],
      counts: {
        admitted: 1,
        candidate: 1,
        consistency_checked: 0,
        shape_valid: 1,
      },
      total: 3,
    });
    expect(sameClaimProjectionView(view1, view2)).toBe(true);
  });

  it("round-trips schema-derived projection outputs without changing encoded shape", () =>
    fc.assert(
      fc.property(ClaimProjectionAuthorityArbitrary, (authority) => {
        const view = projectClaims(authority);
        const encoded = S.encodeSync(ClaimProjection.outputSchema)(view);
        const decoded = S.decodeSync(ClaimProjection.outputSchema)(encoded);

        expect(encoded.total).toBe(A.length(authority));
        for (const state of ClaimLifecycle.Options) {
          expect(encoded.counts[state]).toBe(A.length(A.filter(authority, (claim) => claim.lifecycle === state)));
        }
        expect(sameClaimProjectionView(decoded, view)).toBe(true);
      }),
      fcRuns(50)
    ));
});
