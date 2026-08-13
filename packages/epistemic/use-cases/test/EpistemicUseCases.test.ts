import { CandidateClaim, ClaimGateResult, ClaimLifecycle, ClaimProjectionView } from "@beep/epistemic-domain";
import * as ClaimLifecycleUC from "@beep/epistemic-use-cases/ClaimLifecycle";
import { ClaimProjection, projectClaims } from "@beep/epistemic-use-cases/ClaimProjection";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ClaimProjectionAuthorityArbitrary = S.toArbitrary(ClaimProjection.inputSchema)(fc);
const sameClaimProjectionView = S.toEquivalence(ClaimProjectionView);

const makeCandidate = (id: number, fixtureKey: string, lifecycle: string): CandidateClaim =>
  S.decodeUnknownSync(CandidateClaim)({
    ...baseEntityFixtureInput("EpistemicCandidateClaim", id),
    fixtureKey,
    lifecycle,
    snapshot: {},
  });

const candidate = makeCandidate(1, "claim.patentability", "candidate");
const alreadyAdmitted = makeCandidate(4, "claim.alreadyAdmitted", "admitted");
const admittedVerdict = S.decodeSync(ClaimGateResult)({ verdict: "admitted" });

describe("@beep/epistemic-use-cases", () => {
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
