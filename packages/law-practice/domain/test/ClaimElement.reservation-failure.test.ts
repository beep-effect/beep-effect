import { projectClaimRoleTerms, validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimLexicalEvidence,
  validateClaimFiniteSourceProofs,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";
import { roleEvidenceOf, rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";

const assertAtomicReservations = (name: string, operation: (charge: (amount: number) => boolean) => boolean) => {
  const reservations = A.empty<number>();
  assert.isTrue(
    operation((amount) => {
      reservations.push(amount);
      return true;
    }),
    name
  );
  assert.isAbove(reservations.length, 0, name);
  for (let failureAt = 0; failureAt < reservations.length; failureAt++) {
    const calls = A.empty<number>();
    const result = operation((amount) => {
      calls.push(amount);
      return calls.length <= failureAt;
    });
    assert.isFalse(result, `${name}: reservation ${failureAt}`);
    assert.strictEqual(calls.length, failureAt + 1, `${name}: no reservation after rejection ${failureAt}`);
    assert.deepStrictEqual(calls, A.take(reservations, failureAt + 1), `${name}: original reservation prefix`);
  }
};

const texts = [
  "A system comprising a plate.",
  "A system comprising a plate and a cover.",
  "A system comprising a plate mounted on a frame.",
  "A system comprising: (a) a plate; (b) a cover.",
];

describe("source-proof reservation failure atomicity", () => {
  for (const text of texts)
    it.effect(`rejects each denied reservation without publishing evidence: ${text}`, () =>
      Effect.gen(function* () {
        const result = yield* rolePlansOf([text]);
        const source = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
        const claim = source.roles.qualifiedClaim.pipe(O.getOrThrow);
        const evidence = A.head(roleEvidenceOf([text])).pipe(O.getOrThrow);
        assert.isTrue(ClaimLexicalEvidence.guards.aligned(evidence));
        if (!ClaimLexicalEvidence.guards.aligned(evidence)) return;
        assertAtomicReservations("complete source ownership", (charge) => validateClaimSourceOwnership(source, charge));
        assertAtomicReservations("finite original-token registry", (charge) =>
          validateClaimFiniteSourceProofs(
            claim,
            evidence.tokens,
            source.roles.certificates,
            source.roles.proofs,
            charge
          )
        );
        assertAtomicReservations("original-input proof binding", (charge) =>
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            evidence,
            source.roles.certificates,
            source.roles.proofs,
            charge
          )
        );
        for (const element of source.elements)
          assertAtomicReservations("term projection", (charge) => O.isSome(projectClaimRoleTerms(element, charge)));
      })
    );
});

describe("complete finite source family reservation failures", () => {
  for (const row of controls.cases)
    if (row.outcome === "admitted")
      it.effect(`stops at each denied ownership reservation: ${row.case}`, () =>
        Effect.gen(function* () {
          const result = yield* decomposeFiniteSourceFixture(row);
          const source = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
          assertAtomicReservations(row.case, (charge) => validateClaimSourceOwnership(source, charge));
        })
      );
});
