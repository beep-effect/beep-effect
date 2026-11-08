import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimCitationWitness,
  ClaimFiniteSourceProof,
  ClaimLexicalToken,
  ClaimSourceElementPlan,
  ClaimSourceExclusion,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  OriginalLexicalTokenOrdinal,
  validateClaimCitationWitness,
  validateClaimFiniteSourceProofs,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";
import { assertClaimReservationPrefixes } from "./helpers/ClaimElementWorkAssertions.ts";

const text = "The system of claim 1 comprising a plate.";
const claim = PatentClaim.cases.dependent.make({
  claimNumber: 2,
  claimReferences: [1],
  claimText: text,
  preamble: "The system of claim 1",
  transition: "comprising",
  body: "a plate.",
});
const words = [
  { quote: "The", start: 0, pos: "DET" },
  { quote: "system", start: 4, pos: "NOUN" },
  { quote: "of", start: 11, pos: "ADP" },
  { quote: "claim", start: 14, pos: "NOUN" },
  { quote: "1", start: 20, pos: "NUM" },
  { quote: "comprising", start: 22, pos: "VERB" },
  { quote: "a", start: 33, pos: "DET" },
  { quote: "plate", start: 35, pos: "NOUN" },
  { quote: ".", start: 40, pos: "PUNCT" },
];
const tokensAt = (rows: typeof words) =>
  A.map(rows, (word) =>
    ClaimLexicalToken.make({
      anchor: TextAnchor.make({ startChar: word.start, endChar: word.start + word.quote.length, quote: word.quote }),
      pos: word.pos,
      lemma: O.none(),
    })
  );
const tokens = tokensAt(words);
const tokenRef = (ordinal: number) =>
  ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(ordinal), slot: "token" });
const raw = A.map(tokens, (token, index) =>
  ClaimFiniteSourceProof.cases.token.make({
    ordinal: ClaimSourceProofOrdinal.make(index + 1),
    tokenOrdinal: OriginalLexicalTokenOrdinal.make(index + 1),
    token,
  })
);
const scope = (ordinal: number, role: "preamble" | "transition" | "body", startChar: number, quote: string) =>
  ClaimFiniteSourceProof.cases.scope.make({
    ordinal: ClaimSourceProofOrdinal.make(ordinal),
    role,
    extent: TextAnchor.make({ startChar, endChar: startChar + quote.length, quote }),
  });
const proofs = [
  ...raw,
  scope(10, "preamble", 0, claim.preamble),
  scope(11, "transition", 22, claim.transition),
  scope(12, "body", 33, claim.body),
];
const extent = TextAnchor.make({ startChar: 11, endChar: 21, quote: "of claim 1" });
const witness = ClaimCitationWitness.make({
  claim,
  keyword: tokenRef(4),
  tokens: [tokenRef(3), tokenRef(4), tokenRef(5)],
});
const citation = (anchor: TextAnchor) =>
  ClaimFiniteSourceProof.cases["citation-boundary"].make({
    ordinal: ClaimSourceProofOrdinal.make(13),
    token: tokenRef(3),
    scope: ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(10), slot: "scope" }),
    extent: anchor,
    witness,
  });
const rawValid = (anchor: TextAnchor) => validateClaimCitationWitness(text, proofs, anchor, [1], witness, () => true);
const finiteValid = (anchor: TextAnchor) =>
  validateClaimFiniteSourceProofs(claim, tokens, [...proofs, citation(anchor)], [], () => true);

const multipleText = "The system of claims 1 and 2 comprising a plate.";
const multipleRegistry = () => {
  const claim = PatentClaim.cases.dependent.make({
    claimNumber: 3,
    claimReferences: [1, 2],
    claimText: multipleText,
    preamble: "The system of claims 1 and 2",
    transition: "comprising",
    body: "a plate.",
  });
  const tokens = tokensAt([
    { quote: "The", start: 0, pos: "DET" },
    { quote: "system", start: 4, pos: "NOUN" },
    { quote: "of", start: 11, pos: "ADP" },
    { quote: "claims", start: 14, pos: "NOUN" },
    { quote: "1", start: 21, pos: "NUM" },
    { quote: "and", start: 23, pos: "CCONJ" },
    { quote: "2", start: 27, pos: "NUM" },
    { quote: "comprising", start: 29, pos: "VERB" },
    { quote: "a", start: 40, pos: "DET" },
    { quote: "plate", start: 42, pos: "NOUN" },
    { quote: ".", start: 47, pos: "PUNCT" },
  ]);
  const raw = A.map(tokens, (token, index) =>
    ClaimFiniteSourceProof.cases.token.make({
      ordinal: ClaimSourceProofOrdinal.make(index + 1),
      tokenOrdinal: OriginalLexicalTokenOrdinal.make(index + 1),
      token,
    })
  );
  const proofs = [
    ...raw,
    scope(12, "preamble", 0, claim.preamble),
    scope(13, "transition", 29, claim.transition),
    scope(14, "body", 40, claim.body),
  ];
  const extent = TextAnchor.make({ startChar: 11, endChar: 28, quote: "of claims 1 and 2" });
  const witness = ClaimCitationWitness.make({ claim, keyword: tokenRef(4), tokens: A.map([3, 4, 5, 6, 7], tokenRef) });
  const boundary = ClaimFiniteSourceProof.cases["citation-boundary"].make({
    ordinal: ClaimSourceProofOrdinal.make(15),
    token: tokenRef(3),
    scope: ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(12), slot: "scope" }),
    extent,
    witness,
  });
  return { claim, tokens, proofs, extent, witness, boundary };
};

describe("complete raw citation source extent", () => {
  it.effect("rejects source bounds, incomplete members and cross-scope citation joins", () =>
    Effect.sync(() => {
      for (const anchor of [
        TextAnchor.make({ startChar: text.length + 1, endChar: text.length + 11, quote: extent.quote }),
        TextAnchor.make({ startChar: 11, endChar: 20, quote: "of claim " }),
      ]) {
        assert.isFalse(rawValid(anchor));
        assert.isFalse(finiteValid(anchor));
      }
      for (const changed of [
        ClaimCitationWitness.make({ ...witness, tokens: [] }),
        ClaimCitationWitness.make({ ...witness, tokens: A.drop(witness.tokens, 1) }),
        ClaimCitationWitness.make({ ...witness, tokens: A.reverse(witness.tokens) }),
        ClaimCitationWitness.make({ ...witness, keyword: tokenRef(2) }),
      ]) {
        assert.isFalse(validateClaimCitationWitness(text, proofs, extent, [1], changed, () => true));
        const altered = ClaimFiniteSourceProof.cases["citation-boundary"].make({
          ...citation(extent),
          witness: changed,
        });
        assert.isFalse(validateClaimFiniteSourceProofs(claim, tokens, [...proofs, altered], [], () => true));
      }
      const crossScope = ClaimFiniteSourceProof.cases["citation-boundary"].make({
        ...citation(extent),
        scope: ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(12), slot: "scope" }),
      });
      assert.isFalse(validateClaimFiniteSourceProofs(claim, tokens, [...proofs, crossScope], [], () => true));
      assert.isTrue(rawValid(extent));
      assert.isTrue(finiteValid(extent));
    })
  );
  it.effect("binds all dependent references and source bytes in a multiple citation", () =>
    Effect.sync(() => {
      const f = multipleRegistry();
      const raw = (anchor: TextAnchor, refs: ReadonlyArray<number>, reserve: (amount: number) => boolean) =>
        validateClaimCitationWitness(multipleText, f.proofs, anchor, refs, f.witness, reserve);
      const finite = (anchor: TextAnchor, reserve: (amount: number) => boolean) =>
        validateClaimFiniteSourceProofs(
          f.claim,
          f.tokens,
          [...f.proofs, ClaimFiniteSourceProof.cases["citation-boundary"].make({ ...f.boundary, extent: anchor })],
          [],
          reserve
        );
      assert.isTrue(raw(f.extent, [1, 2], () => true));
      assert.isTrue(finite(f.extent, () => true));
      const foreign = TextAnchor.make({ ...f.extent, quote: Str.repeat(f.extent.quote.length)("X") });
      assert.isFalse(raw(foreign, [1, 2], () => true));
      assert.isFalse(finite(foreign, () => true));
      assert.isFalse(raw(f.extent, [1], () => true));
      assert.isFalse(raw(f.extent, [1, 3], () => true));
      assertClaimReservationPrefixes("multiple raw citation", (reserve) => raw(f.extent, [1, 2], reserve));
      assertClaimReservationPrefixes("multiple finite citation", (reserve) => finite(f.extent, reserve));
      assert.isTrue(raw(f.extent, [1, 2], () => true));
      assert.isTrue(finite(f.extent, () => true));
    })
  );

  it.effect("ends every denied raw and finite citation reservation at its funded prefix", () =>
    Effect.sync(() => {
      assertClaimReservationPrefixes("raw citation", (reserve) =>
        validateClaimCitationWitness(text, proofs, extent, [1], witness, reserve)
      );
      assertClaimReservationPrefixes("finite citation", (reserve) =>
        validateClaimFiniteSourceProofs(claim, tokens, [...proofs, citation(extent)], [], reserve)
      );
    })
  );
  for (const inputText of [text, multipleText])
    it.effect(`keeps complete dependent ownership and rejects foreign citation exclusion quotes: ${inputText}`, () =>
      Effect.gen(function* () {
        const result = yield* rolePlansOf(["A system comprising a plate.", "A system comprising a cover.", inputText]);
        const source = A.findFirst(result.plans, (plan) => plan.sourcePlan.qualifiedText === inputText).pipe(
          O.getOrThrow
        ).sourcePlan;
        assert.isTrue(validateClaimSourceOwnership(source, () => true));
        const foreign = (anchor: TextAnchor) =>
          TextAnchor.make({ ...anchor, quote: Str.repeat(anchor.quote.length)("X") });
        assert.isTrue(A.some(source.sourceExclusions, (exclusion) => exclusion.kind === "dependency-citation"));
        const forgedExclusions = A.map(source.sourceExclusions, (exclusion) =>
          exclusion.kind === "dependency-citation"
            ? ClaimSourceExclusion.cases["dependency-citation"].make({
                ...exclusion,
                extent: foreign(exclusion.extent),
              })
            : exclusion
        );
        assert.isFalse(
          validateClaimSourceOwnership(
            ClaimSourceElementPlan.make({ ...source, sourceExclusions: forgedExclusions }),
            () => true
          )
        );
        assertClaimReservationPrefixes("complete citation ownership", (reserve) =>
          validateClaimSourceOwnership(source, reserve)
        );
        assert.isTrue(validateClaimSourceOwnership(source, () => true));
      })
    );
  it.effect("rejects a schema-valid foreign quote in both raw and finite citation witnesses", () =>
    Effect.sync(() => {
      assert.isTrue(rawValid(extent));
      assert.isTrue(finiteValid(extent));
      const foreign = TextAnchor.make({ ...extent, quote: Str.repeat(extent.quote.length)("X") });
      assert.deepStrictEqual({ raw: rawValid(foreign), finite: finiteValid(foreign) }, { raw: false, finite: false });
      assert.isTrue(rawValid(extent));
      assert.isTrue(finiteValid(extent));
    })
  );
});
