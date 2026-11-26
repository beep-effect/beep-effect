import { GenerationFact } from "@beep/epistemics/Admission";
import {
  DistinctionProposition,
  LawClaimArrows,
  LawClaimCore,
  LawProposedClaimRecord,
  logicalKey,
  OfficeActionDistinctionGate,
} from "@beep/law-practice-domain/values/LawClaim";
import { ProposedClaimEntry } from "@beep/law-practice-use-cases/ClaimStore";
import { requiredExtraction } from "@beep/law-practice-use-cases/IrToLaw";
import { it } from "@beep/test-runner";
import { TextAnchorVerificationReceipt, VerifyTextAnchorInput, verifyTextAnchor } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import { modelOutput, text } from "./fixtures/office-action-review/fixture.ts";
import {
  fixturePrincipal,
  fixtureRevision,
  issueToken,
  makeLayer,
  reviewScenario,
} from "./fixtures/office-action-review/support.ts";
import type { OfficeActionAssessments } from "@beep/law-practice-domain/values/LawClaim";

it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("law claims at a shared occurrence", (it) => {
  it.effect("L4-2 the office-action gate and admission keep two law claims at one occurrence separate", () =>
    Effect.gen(function* () {
      const scenario = yield* reviewScenario({ principal: fixturePrincipal, current: text });
      const first = yield* scenario.review.review(scenario.input);
      const handoff = scenario.handoff();
      const support = yield* requiredExtraction(handoff, "distinction");
      const occurrence = support.occurrence;
      const receipt = TextAnchorVerificationReceipt.make(
        HashMap.getUnsafe(handoff.document.anchors, occurrence).receipt
      );
      const verified = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          expectedSource: receipt.source,
          source: handoff.document.text,
          sourceText: text,
          anchor: receipt.anchor,
        })
      );
      const otherProposition = DistinctionProposition.make({
        ...first.proposed.core.proposition,
        claimNumber: first.proposed.core.proposition.claimNumber + 1,
      });
      const secondCore = LawClaimCore.make({
        ...first.proposed.core,
        proposition: otherProposition,
        logicalKey: logicalKey(otherProposition),
      });
      const generation = GenerationFact.make({
        activity: first.proposed.core.generatedBy,
        at: first.proposed.core.knowledgeStart,
      });
      const promoted = yield* LawClaimArrows.promote({
        core: secondCore,
        document: handoff.document,
        candidates: HashSet.make(support.id),
        verified: [verified],
        generation,
      });
      const second = LawProposedClaimRecord.make(promoted);
      yield* scenario.store.proposals.appendProposed(
        ProposedClaimEntry.make({
          record: second,
          generation,
          activities: first.activities,
          captures: HashSet.make(handoff.document.text),
        })
      );
      expect(second.claim).not.toBe(first.proposed.claim);
      expect(A.fromIterable(second.core.supportAtCreation)).toEqual([occurrence]);
      const rejectedAssessments: OfficeActionAssessments = {
        ...first.assessments,
        support: { _tag: "Assessed", value: "unverified" },
      };
      const byClaim = HashMap.make([first.proposed.claim, first.assessments], [second.claim, rejectedAssessments]);
      expect(HashMap.size(byClaim)).toBe(2);
      assertSome(HashMap.get(byClaim, first.proposed.claim), first.assessments);
      assertSome(HashMap.get(byClaim, second.claim), rejectedAssessments);
      expect(OfficeActionDistinctionGate.passes(first.assessments)).toBe(true);
      expect(OfficeActionDistinctionGate.passes(rejectedAssessments)).toBe(false);
      yield* scenario.admission.open({ claim: first.proposed.claim, revision: fixtureRevision });
      const token = issueToken({ revision: fixtureRevision, scope: first.proposed.core.scope });
      const accepted = yield* scenario.admission.admit({
        claim: first.proposed.claim,
        token,
        grounding: [receipt],
        revision: fixtureRevision,
        assessments: first.assessments,
      });
      const gated = yield* scenario.admission.admit({
        claim: second.claim,
        token,
        grounding: [receipt],
        revision: fixtureRevision,
        assessments: rejectedAssessments,
      });
      const unbound = yield* scenario.admission.admit({
        claim: second.claim,
        token,
        grounding: [receipt],
        revision: fixtureRevision,
        assessments: first.assessments,
      });
      expect(accepted._tag).toBe("Admitted");
      expect(gated).toMatchObject({ _tag: "Refused", refusal: { _tag: "GateNotPassed", claim: second.claim } });
      expect(unbound).toMatchObject({
        _tag: "Refused",
        refusal: { _tag: "Admission", refusal: { _tag: "InvalidBinding", reason: "claim-mismatch" } },
      });
    })
  );
});
