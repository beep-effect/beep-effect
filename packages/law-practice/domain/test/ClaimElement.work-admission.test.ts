import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  decomposeClaimInput,
  decomposePreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { roleEvidenceOf, rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";

const cap = 262_144;
const texts = [
  "A system comprising a plate.",
  "A system comprising a plate and a cover.",
  "A system comprising a plate mounted on a frame.",
  "A system comprising: (a) a plate; (b) a cover.",
];
const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "role-inspection-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });

describe("source compilation finite-work admission", () => {
  for (const text of texts)
    it.effect(
      `declines every insufficient structural allowance without publishing a partial plan: ${text}`,
      () =>
        Effect.gen(function* () {
          const input = inputOf(text);
          const baseline = yield* rolePlansOf([text]);
          assert.strictEqual(baseline.plans.length, 1);
          const source = A.head(baseline.plans).pipe(O.getOrThrow).sourcePlan;
          const evidence = A.head(roleEvidenceOf([text])).pipe(O.getOrThrow);
          assert.isTrue(ClaimLexicalEvidence.guards.aligned(evidence));
          if (!ClaimLexicalEvidence.guards.aligned(evidence)) return;
          const originalTokens = A.map(evidence.tokens, (token) => [
            token.anchor.startChar,
            token.anchor.endChar,
            token.anchor.quote,
            token.pos,
          ]);
          const required = cap - source.remainingWork;
          assert.isAbove(required, 0);
          const prepared = yield* prepareClaimInspection(input);
          const fallback = yield* decomposeClaimInput(input);
          // The fixed production cap is unchanged. The injected lexical provider declares
          // more already-spent work, leaving each possible allowance below the structural plan reservation once.
          // Term projection may require additional work after that structural reservation.
          for (let allowance = 0; allowance < required; allowance++) {
            const charged = ClaimLexicalEvidence.cases.aligned.make({
              ...evidence,
              lexicalWorkConsumed: cap - allowance,
            });
            const result = yield* decomposePreparedClaimRoles(prepared, [charged]);
            assert.strictEqual(result.plans.length, 0, `remaining allowance ${allowance}`);
            assert.deepStrictEqual(result.decompositions, fallback);
          }
          const fullyFunded = yield* decomposePreparedClaimRoles(prepared, [evidence]);
          assert.strictEqual(fullyFunded.plans.length, 1);
          assert.deepStrictEqual(fullyFunded.decompositions, baseline.decompositions);
          assert.deepStrictEqual(
            A.map(evidence.tokens, (token) => [
              token.anchor.startChar,
              token.anchor.endChar,
              token.anchor.quote,
              token.pos,
            ]),
            originalTokens
          );
        }),
      { timeout: 120000 }
    );
});
