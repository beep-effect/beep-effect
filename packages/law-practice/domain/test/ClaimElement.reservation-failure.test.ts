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
import { assertClaimReservationPrefixes } from "./helpers/ClaimElementWorkAssertions.ts";

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
        assertClaimReservationPrefixes("complete source ownership", (charge) =>
          validateClaimSourceOwnership(source, charge)
        );
        assertClaimReservationPrefixes("finite original-token registry", (charge) =>
          validateClaimFiniteSourceProofs(
            claim,
            evidence.tokens,
            source.roles.certificates,
            source.roles.proofs,
            charge
          )
        );
        assertClaimReservationPrefixes("original-input proof binding", (charge) =>
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            evidence,
            source.roles.certificates,
            source.roles.proofs,
            charge
          )
        );
        for (const element of source.elements)
          assertClaimReservationPrefixes("term projection", (charge) =>
            O.isSome(projectClaimRoleTerms(element, charge))
          );
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
          assertClaimReservationPrefixes(row.case, (charge) => validateClaimSourceOwnership(source, charge));
        })
      );
});
