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
  decomposeClaim,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimInputDecomposition } from "@beep/law-practice-domain/values/ClaimElement";

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
const prepareTexts = Effect.fn("SourceCompositionProjectionTest.prepare")(function* (
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
  return prepared;
});
const compile = Effect.fn("SourceCompositionProjectionTest.compile")(function* (
  texts: A.NonEmptyReadonlyArray<string>
) {
  const prepared = yield* prepareTexts(texts);
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

const assertAtomicProjection = (
  actual: ClaimInputDecomposition,
  complete: ClaimInputDecomposition,
  fallback: ClaimInputDecomposition,
  text: string,
  remaining: number
): void => {
  if (actual.status !== "decomposed" || complete.status !== "decomposed" || fallback.status !== "decomposed")
    assert.fail("projection refusal must retain a decomposed fallback");
  const expected = actual.tree.elements.length === complete.tree.elements.length ? complete.tree : fallback.tree;
  assert.deepStrictEqual(actual.tree, expected);
  if (remaining === 0) assert.deepStrictEqual(actual.tree, fallback.tree);
  if (remaining === 4096) assert.deepStrictEqual(actual.tree, complete.tree);
  for (const element of actual.tree.elements) {
    assert.strictEqual(Str.slice(element.anchor.startChar, element.anchor.endChar)(text), element.anchor.quote);
    assert.isFalse(A.some(actual.tree.edges, (edge) => edge.kind === "part-of" && edge.child === edge.parent));
  }
};

describe("source composition public projection", () => {
  it.effect("keeps complete source ownership while grouping the public terms and descendant donor", () =>
    Effect.gen(function* () {
      const texts = [parent, "The fixture of claim 1 wherein the bushing is rigid."] as const;
      const prepared = yield* prepareTexts(texts);
      const evidence = evidenceOf(texts);
      const result = yield* decomposePreparedClaimRoles(prepared, evidence);
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      const inspected = A.map(report.records, ({ decomposition }) => decomposition);
      const detailed = O.getOrThrow(A.head(result.decompositions));
      assert.strictEqual(detailed.status, "decomposed");
      if (detailed.status !== "decomposed") return;
      assert.strictEqual(detailed.tree.elements.length, 6);
      const bound = O.getOrThrow(A.findFirst(result.plans, ({ claimNumber }) => claimNumber === 1));
      const root = O.getOrThrow(A.findFirst(inspected, (d) => d.status === "decomposed" && d.tree.claimNumber === 1));
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
        A.findFirst(inspected, (d) => d.status === "decomposed" && d.tree.claimNumber === 2)
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

  it.effect("keeps projection atomic across the remaining source-work boundary", () =>
    Effect.gen(function* () {
      for (const text of [
        "A fixture comprising a module; the module includes a bracket and a bushing.",
        `A fixture comprising ${A.join(A.replicate("a plate", 29), "; ")}.`,
      ]) {
        const prepared = yield* prepareTexts([text]);
        const evidence = evidenceOf([text]);
        const baseline = yield* decomposePreparedClaimRoles(prepared, evidence);
        const source = O.getOrThrow(A.head(baseline.plans)).sourcePlan;
        const complete = yield* inspectPreparedClaimRoles(prepared, evidence);
        const exhausted = A.map(evidence, (fact) =>
          ClaimLexicalEvidence.cases.aligned.make({ ...fact, lexicalWorkConsumed: 262144 })
        );
        const fallback = yield* inspectPreparedClaimRoles(prepared, exhausted);
        const expectedComplete = O.getOrThrow(A.head(complete.records)).decomposition;
        const expectedFallback = O.getOrThrow(A.head(fallback.records)).decomposition;
        for (const remaining of A.filter(A.range(0, 4096), (remaining) => remaining % 8 === 0)) {
          const bounded = A.map(evidence, (fact) =>
            ClaimLexicalEvidence.cases.aligned.make({
              ...fact,
              lexicalWorkConsumed: source.remainingWork - remaining,
            })
          );
          const report = yield* inspectPreparedClaimRoles(prepared, bounded);
          const actual = O.getOrThrow(A.head(report.records)).decomposition;
          assertAtomicProjection(actual, expectedComplete, expectedFallback, text, remaining);
        }
      }
    })
  );

  it.effect("assigns distinct public paths beyond the first alphabet of siblings", () =>
    Effect.gen(function* () {
      const text = `A fixture comprising ${A.join(A.replicate("a plate", 29), "; ")}.`;
      const result = yield* compile([text]);
      assert.strictEqual(result.plans.length, 1);
      const outcome = O.getOrThrow(A.head(result.decompositions));
      assert.strictEqual(outcome.status, "decomposed");
      if (outcome.status !== "decomposed") return;
      assert.isTrue(A.some(outcome.tree.elements, ({ path }) => path === "1.aa"));
      assert.isTrue(A.some(outcome.tree.elements, ({ path }) => path === "1.ac"));
      assert.strictEqual(
        HashSet.size(HashSet.fromIterable(A.map(outcome.tree.elements, ({ path }) => path))),
        outcome.tree.elements.length
      );
    })
  );

  it.effect("excludes an explicit claim-number phrase from legacy term ownership", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([["1", "A fixture comprising the claim 1; a module."]]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const terms = A.flatMap(tree.elements, ({ terms }) => terms);
      assert.isFalse(A.some(terms, ({ head }) => head === "claim 1"));
      assert.isTrue(A.some(terms, ({ head }) => head === "module"));
      const text = "A fixture comprising the claim 1; a module.";
      const prepared = yield* prepareTexts([text]);
      const numericNounEvidence = A.map(evidenceOf([text]), (fact) =>
        ClaimLexicalEvidence.cases.aligned.make({
          ...fact,
          lexicalWorkConsumed: 262144,
          tokens: A.map(fact.tokens, (token) =>
            token.anchor.quote === "1" ? ClaimLexicalToken.make({ ...token, pos: "NOUN" }) : token
          ),
        })
      );
      const report = yield* inspectPreparedClaimRoles(prepared, numericNounEvidence);
      const result = O.getOrThrow(A.head(report.records)).decomposition;
      assert.strictEqual(result.status, "decomposed");
      if (result.status === "decomposed")
        assert.isFalse(
          A.some(
            A.flatMap(result.tree.elements, ({ terms }) => terms),
            ({ head }) => head === "claim 1"
          )
        );
    })
  );

  it.effect("retains nonflat source children in canonical inspection", () =>
    Effect.gen(function* () {
      for (const text of [
        "A fixture comprising a module; the module includes a bracket, a bushing, and a washer.",
        "A fixture comprising a module; the module includes a bracket and a bushing that is rigid.",
      ]) {
        const prepared = yield* prepareTexts([text]);
        const evidence = evidenceOf([text]);
        const detailed = yield* decomposePreparedClaimRoles(prepared, evidence);
        assert.strictEqual(detailed.plans.length, 1);
        const report = yield* inspectPreparedClaimRoles(prepared, evidence);
        const original = O.getOrThrow(A.head(detailed.decompositions));
        const inspected = O.getOrThrow(A.head(report.records)).decomposition;
        assert.strictEqual(original.status, "decomposed");
        assert.strictEqual(inspected.status, "decomposed");
        if (original.status === "decomposed" && inspected.status === "decomposed")
          assert.deepStrictEqual(inspected.tree, original.tree);
      }
    })
  );
});
