import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceControlEvidence,
  ClaimSourceElementPlan,
  ClaimSourceProofRef,
  ClaimSourceTokenOwnership,
  decomposePreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";

const sourceKey = "synthetic-source-composition-projection";
const lexical = HashMap.fromIterable<string, readonly [string, string]>([
  ["a", ["DET", "a"]],
  ["the", ["DET", "the"]],
  ["comprising", ["VERB", "comprise"]],
  ["includes", ["VERB", "include"]],
  ["and", ["CCONJ", "and"]],
  ["is", ["AUX", "be"]],
  ["disposed", ["VERB", "dispose"]],
  ["located", ["VERB", "locate"]],
  ["at", ["ADP", "at"]],
  ["below", ["ADP", "below"]],
  ["of", ["ADP", "of"]],
  ["wherein", ["SCONJ", "wherein"]],
  ["rigid", ["ADJ", "rigid"]],
]);
const evidenceOf = (texts: ReadonlyArray<string>) =>
  A.map(texts, (text, index) =>
    ClaimLexicalEvidence.cases.aligned.make({
      sourceKey,
      sourceOrdinal: index + 1,
      qualifiedText: text,
      provider: "explicit-synthetic-control",
      assetDigest: "test-only",
      lexicalWorkConsumed: 0,
      tokens: A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
        const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
        const word = Str.toLowerCase(match[0]);
        const [pos, lemma] = O.getOrElse(HashMap.get(lexical, word), () => [
          O.isSome(Str.match(/^\p{N}+$/u)(word)) ? "NUM" : O.isSome(Str.match(/^\p{L}/u)(word)) ? "NOUN" : "PUNCT",
          word,
        ]);
        return ClaimLexicalToken.make({
          anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
          pos,
          lemma: O.some(lemma),
        });
      }),
    })
  );
const compile = Effect.fn("SourceCompositionProjectionTest.compile")(function* (
  texts: A.NonEmptyReadonlyArray<string>
) {
  const prepared = yield* prepareClaimInspection(
    ClaimInputCollection.make({
      sourceKey,
      records: A.map(texts, (text, index) =>
        ClaimInputRecord.cases.text.make({
          sourceOrdinal: index + 1,
          numberText: O.some(`${index + 1}`),
          sourceText: text,
          canonicalText: text,
        })
      ),
    })
  );
  return yield* decomposePreparedClaimRoles(prepared, evidenceOf(texts));
});
const parent =
  "A fixture comprising a module; the module includes a bracket (1) and a bushing (2); the bracket is disposed at a plate (3) and is located below a rail (4).";
const validates = (plan: ClaimSourceElementPlan): boolean => {
  let remaining = plan.remainingWork;
  const accepted = validateClaimSourceOwnership(plan, (amount) => {
    remaining -= amount;
    return remaining >= 0;
  });
  assert.isAbove(remaining, 0, "the ownership result must not be caused by exhaustion");
  return accepted;
};

describe("source composition public projection", () => {
  it.effect("keeps complete source ownership while grouping the public terms and descendant donor", () =>
    Effect.gen(function* () {
      const result = yield* compile([parent, "The fixture of claim 1 wherein the bushing is rigid."]);
      const bound = O.getOrThrow(A.findFirst(result.plans, ({ claimNumber }) => claimNumber === 1));
      const root = O.getOrThrow(
        A.findFirst(result.decompositions, (d) => d.status === "decomposed" && d.tree.claimNumber === 1)
      );
      assert.strictEqual(root.status, "decomposed");
      if (root.status !== "decomposed") return;
      assert.strictEqual(bound.sourcePlan.elements.length, 6);
      assert.strictEqual(root.tree.elements.length, 4);
      assert.isTrue(validates(bound.sourcePlan));
      const flat = O.getOrThrow(
        A.findFirst(root.tree.elements, ({ anchor }) => Str.startsWith("the module includes")(anchor.quote))
      );
      assert.strictEqual(flat.kind, "limitation");
      assert.deepStrictEqual(
        A.map(flat.terms, ({ anchor }) => anchor.quote),
        ["the module", "a bracket", "a bushing"]
      );
      assert.deepStrictEqual(
        A.map(flat.terms, ({ determiner }) => determiner),
        ["the", "a", "a"]
      );
      assert.isTrue(A.some(bound.sourcePlan.declarationPlans, (d) => d.kind === "composition" && d.items.length === 2));
      assert.isTrue(
        A.some(bound.sourcePlan.tokenOwnership, (r) => r.kind === "control" && r.evidence.kind === "declaration-gap")
      );
      assert.isTrue(
        A.some(
          bound.sourcePlan.tokenOwnership,
          (r) => r.kind === "control" && r.evidence.kind === "pp-operator-coordinate"
        )
      );
      assert.isFalse(A.some(root.tree.edges, (e) => e.kind === "part-of" && e.child === e.parent));
      const descendant = O.getOrThrow(
        A.findFirst(result.decompositions, (d) => d.status === "decomposed" && d.tree.claimNumber === 2)
      );
      assert.strictEqual(descendant.status, "decomposed");
      if (descendant.status !== "decomposed") return;
      const edge = O.getOrThrow(
        A.findFirst(descendant.tree.edges, (e) => e.kind === "antecedent" && e.referring.anchor.quote === "the bushing")
      );
      assert.strictEqual(edge.kind, "antecedent");
      if (edge.kind === "antecedent") {
        assert.strictEqual(edge.introducing.path, flat.path);
        assert.deepStrictEqual(edge.introducing.anchor, O.getOrThrow(A.last(flat.terms)).anchor);
      }
    })
  );

  it.effect("rejects a PP coordinate with a forged original-token witness", () =>
    Effect.gen(function* () {
      const result = yield* compile([parent]);
      const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
      const row = O.getOrThrow(
        A.findFirst(source.tokenOwnership, (r) => r.kind === "control" && r.evidence.kind === "pp-operator-coordinate")
      );
      assert.strictEqual(row.kind, "control");
      if (row.kind !== "control" || row.evidence.kind !== "pp-operator-coordinate") return;
      const evidence = ClaimSourceControlEvidence.cases["pp-operator-coordinate"].make({
        ...row.evidence,
        introducer: ClaimSourceProofRef.make({ ...row.evidence.introducer, slot: "scope" }),
      });
      const invalid = ClaimSourceElementPlan.make({
        ...source,
        tokenOwnership: A.map(source.tokenOwnership, (r) =>
          r !== row
            ? r
            : ClaimSourceTokenOwnership.cases.control.make({ token: row.token, extent: row.extent, evidence })
        ),
      });
      assert.isFalse(validates(invalid));
    })
  );

  it.effect("retains a three-item declaration and an independent functional scope", () =>
    Effect.gen(function* () {
      for (const text of [
        "A fixture comprising a module; the module includes a bracket (1), a bushing (2), and a washer (3).",
        "A fixture comprising a module is disposed at a bracket (3) and is located below a rail (4).",
      ]) {
        const result = yield* compile([text]);
        const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
        const outcome = O.getOrThrow(A.head(result.decompositions));
        assert.strictEqual(outcome.status, "decomposed");
        if (outcome.status !== "decomposed") return;
        assert.strictEqual(outcome.tree.elements.length, source.elements.length);
        assert.deepStrictEqual(
          A.map(outcome.tree.elements, ({ anchor }) => anchor),
          A.map(source.elements, ({ extent }) => extent)
        );
        assert.isTrue(validates(source));
      }
    })
  );
});
