import {
  AdmissionClause,
  AdmissionEvidence,
  AdmissionPolicy,
  AdmissionTier,
  admit,
  independentSupportCount,
  SupportCountInput,
  SupportFacts,
} from "@beep/party-domain/Admission";
import { ClaimVersion, DependenceAssessment } from "@beep/party-domain/Claim";
import { ActivityId, AssertionId } from "@beep/party-domain/Ids";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import { AcmeFixture, AcmeFixtureLive, at } from "./fixtures/acme.ts";
import type { Admitted } from "@beep/party-domain/Admission";

const a = AssertionId.make("party-asrt:a");
const b = AssertionId.make("party-asrt:b");
const c = AssertionId.make("party-asrt:c");
const independent = (left: AssertionId, right: AssertionId) =>
  DependenceAssessment.make({
    left,
    right,
    dependence: "independent",
    basis: "Different witnesses and systems",
    producedBy: ActivityId.make("party-act:dependence-review"),
  });

describe("independent evidence and admission tiers", () => {
  it("conservatively groups missing dependence evidence and deduplicates support", () => {
    expect(
      independentSupportCount(
        SupportCountInput.make({ supports: [a, b, a], dependence: [], unknownCountsAs: "dependent" })
      )
    ).toBe(1);
    expect(
      independentSupportCount(
        SupportCountInput.make({ supports: [a, b, a], dependence: [], unknownCountsAs: "independent" })
      )
    ).toBe(2);
    expect(
      independentSupportCount(
        SupportCountInput.make({
          supports: [a, b, c],
          dependence: [independent(a, c), independent(b, c)],
          unknownCountsAs: "dependent",
        })
      )
    ).toBe(2);
  });
  it("does not type a client-facing proof as deposition-ready", () => {
    expectTypeOf<Admitted<"client-facing">>().not.toExtend<Admitted<"deposition-ready">>();
  });
  it.layer(AcmeFixtureLive, { timeout: "30 seconds" })("adversarial-source corroboration", (it) => {
    it.effect("requires independent testimony outside one interested production", () =>
      Effect.gen(function* () {
        const fx = yield* AcmeFixture;
        const policy = {
          ...AdmissionPolicy.make({
            id: "outside-source",
            version: "1",
            tier: "deposition-ready",
            clauses: [
              AdmissionClause.cases.MinIndependentSupport.make({ n: 2, unknownCountsAs: "dependent" }),
              AdmissionClause.cases.RequireSupportOutsideSide.make({ side: "adversary-production" }),
            ],
          }),
          tier: AdmissionTier.Enum["deposition-ready"],
        };
        const version = ClaimVersion.make({ ...fx.averyAuthorship, supportedBy: [a, b, c] });
        const evidence = AdmissionEvidence.make({
          version,
          supports: [
            SupportFacts.make({ assertion: a, side: "adversary-production", kind: "distinctive-behavior" }),
            SupportFacts.make({ assertion: b, side: "adversary-production", kind: "distinctive-behavior" }),
          ],
          dependence: [],
        });
        const refused = admit({ policy, evidence, knowledgeTime: at(20) });
        pipe(refused, Result.isFailure, TestUtils.assertTrue);
        if (Result.isFailure(refused))
          expect(A.map(refused.failure.unmet, (row) => row.clause._tag)).toEqual([
            "MinIndependentSupport",
            "RequireSupportOutsideSide",
          ]);
        const corroborated = AdmissionEvidence.make({
          ...evidence,
          supports: [
            ...evidence.supports,
            SupportFacts.make({ assertion: c, side: "third-party-production", kind: "distinctive-behavior" }),
          ],
          dependence: [independent(a, c), independent(b, c)],
        });
        pipe(admit({ policy, evidence: corroborated, knowledgeTime: at(20) }), Result.isSuccess, TestUtils.assertTrue);
      })
    );
  });
});
