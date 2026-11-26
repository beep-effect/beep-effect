import { SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { it } from "@beep/test-runner";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import { modelOutput, text } from "./fixtures/office-action-review/fixture.ts";
import {
  fixturePrincipal,
  fixtureRevision,
  issueToken,
  makeLayer,
  reviewScenario,
  unstaffedPrincipal,
} from "./fixtures/office-action-review/support.ts";
import type { SourceTextResolverErrorReason, SourceTextResolverShape } from "@beep/file-processing/SourceText";
import type { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim";

const failingWith = (reason: SourceTextResolverErrorReason): SourceTextResolverShape =>
  SourceTextResolver.of({
    resolve: Effect.fn("LawAdmissionTest.resolve")(function* () {
      return yield* SourceTextResolverError.new(reason, "The source text could not be resolved.");
    }),
  });

const admitUnder = Effect.fn("LawAdmissionTest.admitUnder")(function* (options: {
  readonly resolver?: SourceTextResolverShape;
  readonly admittingAs?: LawPrincipalId;
}) {
  const scenario = yield* reviewScenario({ principal: fixturePrincipal, current: text, ...options });
  const result = yield* scenario.review.review(scenario.input);
  const handoff = scenario.handoff();
  const occurrence = result.proposed.core.supportAtCreation.pipe(A.fromIterable, A.head, O.getOrThrow);
  const receipt = TextAnchorVerificationReceipt.make(HashMap.getUnsafe(handoff.document.anchors, occurrence).receipt);
  yield* scenario.admission.open({ claim: result.proposed.claim, revision: fixtureRevision });
  return yield* scenario.admission.admit({
    claim: result.proposed.claim,
    token: issueToken({ revision: fixtureRevision, scope: result.proposed.core.scope }),
    grounding: [receipt],
    revision: fixtureRevision,
    assessments: result.assessments,
  });
});

const refusalTag = (result: Effect.Success<ReturnType<typeof admitUnder>>) =>
  result._tag === "Refused" && result.refusal._tag === "Admission" ? result.refusal.refusal._tag : result._tag;

describe("LawAdmission", () => {
  it.layer(makeLayer(modelOutput), { timeout: "10 seconds" })("attorney admission", (it) => {
    it.effect("maps every source resolution failure to the admission refusal it reads as", () =>
      Effect.gen(function* () {
        const cases = [
          ["scope-unavailable", "DeniedScope"],
          ["locator-invalid", "GroundingMissing"],
          ["source-unavailable", "GroundingMissing"],
          ["text-unavailable", "GroundingMissing"],
          ["page-out-of-range", "GroundingMissing"],
          ["source-digest-mismatch", "GroundingStale"],
          ["text-digest-mismatch", "GroundingStale"],
          ["extractor-unavailable", "GroundingUnavailable"],
          ["extraction-failed", "GroundingUnavailable"],
        ] as const;
        for (const [reason, refusal] of cases) {
          const result = yield* admitUnder({ resolver: failingWith(reason) });
          expect(refusalTag(result)).toBe(refusal);
        }
      })
    );

    it.effect("refuses an unstaffed attorney as a denied scope", () =>
      Effect.gen(function* () {
        const result = yield* admitUnder({ admittingAs: unstaffedPrincipal });
        expect(refusalTag(result)).toBe("DeniedScope");
      })
    );

    it.effect("opens nothing and refuses admission for a claim it never proposed", () =>
      Effect.gen(function* () {
        const proposed = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        const result = yield* proposed.review.review(proposed.input);
        const fresh = yield* reviewScenario({ principal: fixturePrincipal, current: text });
        yield* fresh.admission.open({ claim: result.proposed.claim, revision: fixtureRevision });
        const binding = yield* fresh.store.admissions.binding({
          actor: fixturePrincipal,
          action: "admit-distinction",
          revision: fixtureRevision,
          scope: result.proposed.core.scope,
        });
        const unknown = yield* fresh.admission.admit({
          claim: result.proposed.claim,
          token: issueToken({ revision: fixtureRevision, scope: result.proposed.core.scope }),
          grounding: [],
          revision: fixtureRevision,
          assessments: result.assessments,
        });
        expect(binding).toMatchObject({ _tag: "Unavailable", reason: "missing" });
        expect(unknown).toMatchObject({ _tag: "Refused", refusal: { _tag: "UnknownClaim" } });
      })
    );
  });
});
