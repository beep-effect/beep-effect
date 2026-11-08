import {
  ClaimFiniteSourceProof,
  ClaimIntrinsicNounWitness,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceProofRef,
  compileClaimClauseRoles,
  OriginalLexicalTokenOrdinal,
  validateClaimFiniteSourceProofs,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { assertClaimReservationPrefixes } from "./helpers/ClaimElementWorkAssertions.ts";

const source = "A system comprising a welded joint is fixed.";
const claim = PatentClaim.cases.independent.make({
  claimNumber: 1,
  claimText: source,
  preamble: "A system",
  transition: "comprising",
  body: "a welded joint is fixed.",
});
const raw = [
  { quote: "A", start: 0, pos: "DET", lemma: "a" },
  { quote: "system", start: 2, pos: "NOUN", lemma: "system" },
  { quote: "comprising", start: 9, pos: "VERB", lemma: "comprise" },
  { quote: "a", start: 20, pos: "DET", lemma: "a" },
  { quote: "welded", start: 22, pos: "VERB", lemma: "weld" },
  { quote: "joint", start: 29, pos: "ADJ", lemma: "joint" },
  { quote: "is", start: 35, pos: "AUX", lemma: "be" },
  { quote: "fixed", start: 38, pos: "VERB", lemma: "fix" },
  { quote: ".", start: 43, pos: "PUNCT", lemma: "." },
];
const evidence = (known: boolean, consumed = 0) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "intrinsic-source-control",
    sourceOrdinal: 1,
    qualifiedText: source,
    provider: "injected-original-input",
    assetDigest: "no-provider",
    lexicalWorkConsumed: consumed,
    tokens: A.map(raw, (row) => {
      const anchor = TextAnchor.make({ startChar: row.start, endChar: row.start + row.quote.length, quote: row.quote });
      return ClaimLexicalToken.make({
        anchor,
        pos: row.pos,
        lemma: O.some(row.lemma),
        intrinsicNoun:
          row.quote === "joint" && known
            ? ClaimIntrinsicNounWitness.cases.known.make({ anchor, rawForm: row.quote, baseNoun: true, oov: false })
            : ClaimIntrinsicNounWitness.cases.unavailable.make({}),
      });
    }),
  });
const charge = () => {
  let remaining = 262_144;
  return (amount: number) => {
    remaining -= amount;
    return remaining >= 0;
  };
};
const positive = () => {
  const input = evidence(true);
  const plan = O.getOrThrow(compileClaimClauseRoles(claim, input));
  assert.strictEqual(O.isSome(plan.originalLexicalInput), true);
  assert.strictEqual(
    validateClaimFiniteSourceProofsFromOriginalInput(claim, input, plan.certificates, plan.proofs, charge()),
    true
  );
  return { input, plan };
};
describe("intrinsic terminal original source proof", () => {
  it.effect("ends every denied original intrinsic-proof reservation at the exact funded prefix", () =>
    Effect.sync(() => {
      const { input, plan } = positive();
      assertClaimReservationPrefixes("original intrinsic source registry", (reserve) =>
        validateClaimFiniteSourceProofsFromOriginalInput(claim, input, plan.certificates, plan.proofs, reserve)
      );
    })
  );
  it.effect("rejects coherent original token and certificate joins with unproved intrinsic membership", () =>
    Effect.sync(() => {
      const { input, plan } = positive();
      const original = A.get(input.tokens, 5).pipe(O.getOrThrow);
      const witness = original.intrinsicNoun;
      assert.isTrue(ClaimIntrinsicNounWitness.guards.known(witness));
      if (!ClaimIntrinsicNounWitness.guards.known(witness)) return;
      const alteredTokens = [
        ClaimLexicalToken.make({ ...original, pos: "NOUN" }),
        ClaimLexicalToken.make({ ...original, intrinsicNoun: ClaimIntrinsicNounWitness.cases.unavailable.make({}) }),
        ...A.map(
          [
            ClaimIntrinsicNounWitness.cases.known.make({ ...witness, baseNoun: false }),
            ClaimIntrinsicNounWitness.cases.known.make({ ...witness, oov: true }),
            ClaimIntrinsicNounWitness.cases.known.make({ ...witness, rawForm: "Joint" }),
            ClaimIntrinsicNounWitness.cases.known.make({
              ...witness,
              anchor: TextAnchor.make({ ...witness.anchor, quote: "WRONG" }),
            }),
          ],
          (intrinsicNoun) => ClaimLexicalToken.make({ ...original, intrinsicNoun })
        ),
      ];
      for (const token of alteredTokens) {
        const coherentInput = ClaimLexicalEvidence.cases.aligned.make({
          ...input,
          tokens: A.map(input.tokens, (member, index) => (index === 5 ? token : member)),
        });
        const coherentProofs = A.map(plan.certificates, (proof) =>
          proof.kind === "token" && proof.tokenOrdinal === 6
            ? ClaimFiniteSourceProof.cases.token.make({ ...proof, token })
            : proof
        );
        assert.isFalse(
          validateClaimFiniteSourceProofsFromOriginalInput(claim, coherentInput, coherentProofs, plan.proofs, charge())
        );
      }
      assert.isTrue(
        validateClaimFiniteSourceProofsFromOriginalInput(claim, input, plan.certificates, plan.proofs, charge())
      );
    })
  );
  it.effect("preserves contextual ADJ and complete modifier head without reconstructing evidence", () =>
    Effect.sync(() => {
      const { input, plan } = positive();
      const head = O.getOrThrow(
        A.findFirst(
          plan.certificates,
          (proof) => proof.kind === "head" && proof.terminalEvidence.kind === "intrinsic-noun-terminal"
        )
      );
      assert.strictEqual(head.kind, "head");
      if (head.kind !== "head") return;
      assert.strictEqual(head.head.quote, "welded joint");
      assert.strictEqual(O.getOrThrow(A.get(input.tokens, 5)).pos, "ADJ");
      assert.strictEqual(
        validateClaimFiniteSourceProofs(claim, input.tokens, plan.certificates, plan.proofs, charge()),
        false
      );
      assert.strictEqual(
        O.exists(compileClaimClauseRoles(claim, evidence(false)), (p) =>
          A.some(p.certificates, (proof) => proof.kind === "intrinsic-noun")
        ),
        false
      );
    })
  );
  it.effect("rejects foreign original identity, form, input ordinal and missing membership", () =>
    Effect.sync(() => {
      const { input, plan } = positive();
      const mutations = [
        (p: Extract<ClaimFiniteSourceProof, { readonly kind: "intrinsic-noun" }>) =>
          ClaimFiniteSourceProof.cases["intrinsic-noun"].make({
            ...p,
            originalTokenDataOrdinal: OriginalLexicalTokenOrdinal.make(input.tokens.length + 1),
          }),
        (p: Extract<ClaimFiniteSourceProof, { readonly kind: "intrinsic-noun" }>) =>
          ClaimFiniteSourceProof.cases["intrinsic-noun"].make({
            ...p,
            originalTokenDataOrdinal: OriginalLexicalTokenOrdinal.make(5),
          }),
        (p: Extract<ClaimFiniteSourceProof, { readonly kind: "intrinsic-noun" }>) =>
          ClaimFiniteSourceProof.cases["intrinsic-noun"].make({ ...p, rawForm: "Joint" }),
        (p: Extract<ClaimFiniteSourceProof, { readonly kind: "intrinsic-noun" }>) =>
          ClaimFiniteSourceProof.cases["intrinsic-noun"].make({
            ...p,
            anchor: TextAnchor.make({ ...p.anchor, quote: "WRONG" }),
          }),
      ];
      for (const mutate of mutations)
        assert.strictEqual(
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            input,
            A.map(plan.certificates, (p) => (p.kind === "intrinsic-noun" ? mutate(p) : p)),
            plan.proofs,
            charge()
          ),
          false
        );
      assert.strictEqual(
        validateClaimFiniteSourceProofsFromOriginalInput(
          claim,
          ClaimLexicalEvidence.cases.aligned.make({ ...input, sourceKey: "another-source" }),
          plan.certificates,
          plan.proofs,
          charge()
        ),
        false
      );
      assert.strictEqual(
        validateClaimFiniteSourceProofsFromOriginalInput(
          claim,
          evidence(false),
          plan.certificates,
          plan.proofs,
          charge()
        ),
        false
      );
    })
  );
  it.effect("rejects actual field cycles, missing nonfinite proof and token-index closure geometry", () =>
    Effect.sync(() => {
      const { input, plan } = positive();
      const mutations = [
        A.map(plan.certificates, (p) =>
          p.kind === "intrinsic-noun"
            ? { ...p, dependencies: [ClaimSourceProofRef.make({ ordinal: p.ordinal, slot: "intrinsic-noun" })] }
            : p
        ),
        A.map(plan.certificates, (p) =>
          p.kind === "head" && p.terminalEvidence.kind === "intrinsic-noun-terminal"
            ? ClaimFiniteSourceProof.cases.head.make({
                ...p,
                terminalEvidence: {
                  ...p.terminalEvidence,
                  intrinsicNoun: ClaimSourceProofRef.make({ ordinal: p.ordinal, slot: "core" }),
                },
              })
            : p
        ),
        A.map(plan.certificates, (p) =>
          p.kind === "head" && p.terminalEvidence.kind === "intrinsic-noun-terminal"
            ? ClaimFiniteSourceProof.cases.head.make({
                ...p,
                terminalEvidence: { ...p.terminalEvidence, orderedModifiers: [] },
              })
            : p
        ),
        A.map(plan.certificates, (p) =>
          p.kind === "opening" && p.coreStart === 20
            ? ClaimFiniteSourceProof.cases.opening.make({ ...p, coreStart: 4 })
            : p
        ),
        A.map(plan.certificates, (p) =>
          p.kind === "closure" && p.coreEnd === 34 ? ClaimFiniteSourceProof.cases.closure.make({ ...p, coreEnd: 6 }) : p
        ),
      ];
      for (const proofs of mutations)
        assert.strictEqual(
          validateClaimFiniteSourceProofsFromOriginalInput(claim, input, proofs, plan.proofs, charge()),
          false
        );
    })
  );
  it.effect("deducts paid lexical work exactly once under the unchanged cap", () =>
    Effect.sync(() => {
      const ordinary = O.getOrThrow(compileClaimClauseRoles(claim, evidence(true)));
      const paid = O.getOrThrow(compileClaimClauseRoles(claim, evidence(true, 1_000)));
      assert.strictEqual(ordinary.remainingWork - paid.remainingWork, 1_000);
      assert.strictEqual(O.isNone(compileClaimClauseRoles(claim, evidence(true, 262_144))), true);
    })
  );
});
