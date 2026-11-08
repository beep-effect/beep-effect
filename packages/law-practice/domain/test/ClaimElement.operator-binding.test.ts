import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimOperatorLexicalSlot,
  ClaimSourceElementPlan,
  ClaimSourceOperatorBinding,
  ClaimSourceProofRef,
} from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

const corruptSlotMembers = (
  scope: ClaimSourceProofRef,
  slot: Exclude<ClaimOperatorLexicalSlot, { readonly kind: "gap" }>
) => {
  const parts = { token: slot.token, certificate: slot.certificate, extent: slot.extent };
  const replacements = [
    ClaimOperatorLexicalSlot.cases.gap.make({ extent: slot.extent }),
    ClaimOperatorLexicalSlot.cases[slot.kind].make({ ...parts, token: scope }),
    ClaimOperatorLexicalSlot.cases[slot.kind].make({ ...parts, certificate: scope }),
  ];
  if (slot.kind === "lexical" && slot.extent.quote === "comprising")
    replacements.push(ClaimOperatorLexicalSlot.cases.adjunct.make(parts));
  return replacements;
};

const corruptBindings = (scope: ClaimSourceProofRef) => (binding: ClaimSourceOperatorBinding) => {
  const mutations = [
    ClaimSourceOperatorBinding.make({ ...binding, slots: [] }),
    ClaimSourceOperatorBinding.make({ ...binding, slots: A.drop(binding.slots, 1) }),
  ];
  if (O.isSome(binding.head)) mutations.push(ClaimSourceOperatorBinding.make({ ...binding, head: O.none() }));
  if (binding.slots.length > 1)
    mutations.push(ClaimSourceOperatorBinding.make({ ...binding, slots: A.reverse(binding.slots) }));
  for (let index = 0; index < binding.slots.length; index++) {
    const slot = A.get(binding.slots, index).pipe(O.getOrThrow);
    if (slot.kind === "gap") continue;
    for (const replacement of corruptSlotMembers(scope, slot))
      mutations.push(
        ClaimSourceOperatorBinding.make({
          ...binding,
          slots: A.map(binding.slots, (original, member) => (member === index ? replacement : original)),
        })
      );
  }
  return mutations;
};

describe("lossless operator source joins", () => {
  for (const row of controls.cases)
    if (row.outcome === "admitted")
      it.effect(`rejects gaps, wrong source members and missing unique heads: ${row.case}`, () =>
        Effect.gen(function* () {
          const result = yield* decomposeFiniteSourceFixture(row);
          const source = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
          const rawScope = A.findFirst(source.roles.certificates, (proof) => proof.kind === "scope").pipe(O.getOrThrow);
          const scope = ClaimSourceProofRef.make({ ordinal: rawScope.ordinal, slot: "scope" });
          const validate = (plan: ClaimSourceElementPlan) => validateClaimSourceOwnership(plan, () => true);
          assert.isTrue(validate(source));
          // These controls contain action-like words inside nominal text, with no predicate binding.
          if (
            row.case === "positive-prenominal-action-word-not-predicate" ||
            row.case === "protected-action-text-whole-technical-core"
          ) {
            assert.isEmpty(source.operatorBindings);
            return;
          }
          assert.isAbove(source.operatorBindings.length, 0);
          for (let index = 0; index < source.operatorBindings.length; index++) {
            const binding = A.get(source.operatorBindings, index).pipe(O.getOrThrow);
            assert.isAbove(binding.slots.length, 0);
            for (const replacement of corruptBindings(scope)(binding))
              assert.isFalse(
                validate(
                  ClaimSourceElementPlan.make({
                    ...source,
                    operatorBindings: A.map(source.operatorBindings, (original, member) =>
                      member === index ? replacement : original
                    ),
                  })
                ),
                `${row.case}: operator ${index}`
              );
          }
          assert.isTrue(validate(source));
        })
      );
});
