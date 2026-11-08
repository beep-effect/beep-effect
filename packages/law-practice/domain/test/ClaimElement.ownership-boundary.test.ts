import { projectClaimRoleTerms, validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimNominalSpan,
  ClaimOwnedTermRegion,
  ClaimPlannedElement,
  ClaimSourceElementPlan,
  ClaimSourceFrame,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";

const alteredQuote = (anchor: TextAnchor) =>
  TextAnchor.make({ ...anchor, quote: Str.repeat(anchor.quote.length)("X") });
const complete = (plan: ClaimSourceElementPlan) => validateClaimSourceOwnership(plan, () => true);

const texts = [
  "A system comprising a plate and a cover.",
  "A system comprising a plate mounted on a frame.",
  "A system comprising: (a) a plate; (b) a cover.",
];

describe("source ownership trust boundaries", () => {
  for (const text of texts)
    it.effect(`rejects foreign frame owners, cycles and nominal donors: ${text}`, () =>
      Effect.gen(function* () {
        const result = yield* rolePlansOf([text]);
        const plan = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
        assert.isTrue(complete(plan));
        for (const frame of plan.frames) {
          const replacements = [
            ClaimSourceFrame.make({ ...frame, publicOwner: plan.elements.length + 1 }),
            ClaimSourceFrame.make({ ...frame, parent: O.some(frame.ordinal) }),
            ClaimSourceFrame.make({ ...frame, subject: O.some(alteredQuote(frame.extent)) }),
            ClaimSourceFrame.make({ ...frame, nominals: [alteredQuote(frame.extent)] }),
          ];
          for (const replacement of replacements)
            assert.isFalse(
              complete(
                ClaimSourceElementPlan.make({
                  ...plan,
                  frames: A.map(plan.frames, (original) =>
                    original.ordinal === frame.ordinal ? replacement : original
                  ),
                })
              ),
              `frame ${frame.ordinal}`
            );
        }
      })
    );
  it.effect("projects complete owned terms atomically and declines missing, foreign or overlapping ownership", () =>
    Effect.gen(function* () {
      const result = yield* rolePlansOf(["A system comprising a plate and a cover."]);
      const plan = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
      for (const element of plan.elements) {
        const original = projectClaimRoleTerms(element, () => true).pipe(O.getOrThrow);
        assert.strictEqual(original.length, element.nominals.length);
        assert.isAbove(original.length, 0);
        const first = A.head(element.nominals).pipe(O.getOrThrow);
        const region = A.head(element.ownedTermRegions).pipe(O.getOrThrow);
        const mutations = [
          ClaimPlannedElement.make({ ...element, ownedTermRegions: [] }),
          ClaimPlannedElement.make({
            ...element,
            ownedTermRegions: A.map(element.ownedTermRegions, (r) =>
              ClaimOwnedTermRegion.make({ ...r, ownerElement: element.ordinal + 1 })
            ),
          }),
          ClaimPlannedElement.make({
            ...element,
            ownedTermRegions: A.map(element.ownedTermRegions, (r) =>
              ClaimOwnedTermRegion.make({ ...r, extent: alteredQuote(r.extent) })
            ),
          }),
          ClaimPlannedElement.make({
            ...element,
            nominals: [
              ClaimNominalSpan.make({
                ...first,
                head: TextAnchor.make({
                  ...first.head,
                  endChar: first.anchor.endChar + 1,
                  quote: Str.slice(first.head.startChar, first.anchor.endChar + 1)(plan.qualifiedText),
                }),
              }),
              ...A.drop(element.nominals, 1),
            ],
          }),
          ClaimPlannedElement.make({ ...element, nominals: [first, first], ownedTermRegions: [region, region] }),
        ];
        for (const mutation of mutations) assert.isTrue(O.isNone(projectClaimRoleTerms(mutation, () => true)));
      }
    })
  );
});
