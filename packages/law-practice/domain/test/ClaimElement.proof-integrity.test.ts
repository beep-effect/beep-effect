import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimFiniteSourceProof,
  ClaimLexicalToken,
  ClaimSourceElementPlan,
  validateClaimFiniteSourceProofs,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

const foreignQuote = (anchor: TextAnchor) =>
  TextAnchor.make({ ...anchor, quote: Str.repeat(anchor.quote.length)("X") });
const outsideClaim = (length: number) => (anchor: TextAnchor) =>
  TextAnchor.make({ startChar: length + 1, endChar: length + 1 + anchor.quote.length, quote: anchor.quote });

// Each variant states an independently invalid source/witness mutation; constructors retain all schema invariants.
const proofMutations =
  (length: number) =>
  (proof: ClaimFiniteSourceProof): ReadonlyArray<ClaimFiniteSourceProof> =>
    ClaimFiniteSourceProof.match(proof, {
      token: () => [],
      "intrinsic-noun": () => [],
      boundary: () => [],
      "citation-boundary": () => [],
      "verbal-boundary": () => [],
      scope: (p) => [ClaimFiniteSourceProof.cases.scope.make({ ...p, extent: foreignQuote(p.extent) })],
      opening: (p) => [ClaimFiniteSourceProof.cases.opening.make({ ...p, coreStart: p.coreStart + 1 })],
      closure: (p) => [ClaimFiniteSourceProof.cases.closure.make({ ...p, coreEnd: p.coreEnd - 1 })],
      head: (p) => [
        ClaimFiniteSourceProof.cases.head.make({ ...p, tokens: [] }),
        ClaimFiniteSourceProof.cases.head.make({ ...p, head: foreignQuote(p.head) }),
      ],
      operator: (p) => [
        ClaimFiniteSourceProof.cases.operator.make({ ...p, lexical: [] }),
        ClaimFiniteSourceProof.cases.operator.make({ ...p, extent: foreignQuote(p.extent) }),
      ],
      "ordered-arguments": (p) => [
        ClaimFiniteSourceProof.cases["ordered-arguments"].make({ ...p, coverage: [] }),
        ClaimFiniteSourceProof.cases["ordered-arguments"].make({ ...p, extent: foreignQuote(p.extent) }),
        ClaimFiniteSourceProof.cases["ordered-arguments"].make({ ...p, extent: outsideClaim(length)(p.extent) }),
      ],
      description: (p) => [
        ClaimFiniteSourceProof.cases.description.make({ ...p, extent: foreignQuote(p.extent) }),
        ClaimFiniteSourceProof.cases.description.make({ ...p, extent: outsideClaim(length)(p.extent) }),
      ],
      selection: (p) => [
        ClaimFiniteSourceProof.cases.selection.make({ ...p, selector: [] }),
        ClaimFiniteSourceProof.cases.selection.make({ ...p, branches: [] }),
      ],
      "opaque-core": (p) => [ClaimFiniteSourceProof.cases["opaque-core"].make({ ...p, core: foreignQuote(p.core) })],
      attachment: (p) => [ClaimFiniteSourceProof.cases.attachment.make({ ...p, extent: foreignQuote(p.extent) })],
    });

describe("finite certificates remain bound to complete original evidence", () => {
  for (const row of controls.cases)
    if (row.outcome === "admitted")
      it.effect(`rejects changed source scopes and incomplete proof witnesses: ${row.case}`, () =>
        Effect.gen(function* () {
          const result = yield* decomposeFiniteSourceFixture(row);
          const source = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
          const claim = source.roles.qualifiedClaim.pipe(O.getOrThrow);
          const original = A.map(row.tokens, (token) =>
            ClaimLexicalToken.make({
              anchor: TextAnchor.make(token.anchor),
              pos: token.pos,
              lemma: O.fromNullOr(token.lemma),
            })
          );
          const validate = (proofs: ReadonlyArray<ClaimFiniteSourceProof>) =>
            validateClaimFiniteSourceProofs(claim, original, proofs, source.roles.proofs, () => true);
          assert.isTrue(validate(source.roles.certificates));
          let attacks = 0;
          for (const proof of source.roles.certificates) {
            for (const replacement of proofMutations(claim.claimText.length)(proof)) {
              const altered = A.map(source.roles.certificates, (entry) =>
                entry.ordinal === proof.ordinal ? replacement : entry
              );
              if (proof.kind === "description" || proof.kind === "ordered-arguments" || proof.kind === "attachment")
                assert.isFalse(
                  validateClaimSourceOwnership(
                    ClaimSourceElementPlan.make({
                      ...source,
                      roles: ClaimClauseRolePlan.make({ ...source.roles, certificates: altered }),
                    }),
                    () => true
                  ),
                  `${row.case}: complete plan argument source binding`
                );
              assert.isFalse(validate(altered), `${row.case} ${proof.kind} ${proof.ordinal}`);
              attacks++;
            }
          }
          assert.isAbove(attacks, 0);
          assert.isTrue(validate(source.roles.certificates));
        })
      );
});
