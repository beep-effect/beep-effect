import * as PublicClaimElement from "@beep/law-practice-domain/values/ClaimElement";
import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  compileClaimClauseRoles,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

const sourceKey = "synthetic-source-certified-fallback";
const lexicalFacts: Readonly<Record<string, readonly [string, string]>> = {
  a: ["DET", "a"],
  the: ["DET", "the"],
  comprising: ["VERB", "comprise"],
  receives: ["VERB", "receive"],
  keeps: ["VERB", "keep"],
  encoded: ["VERB", "encode"],
  aligned: ["VERB", "align"],
  through: ["ADP", "through"],
  with: ["ADP", "with"],
  of: ["ADP", "of"],
  that: ["PRON", "that"],
  ".": ["PUNCT", "."],
  "5": ["NUM", "5"],
};
const evidenceFor = (text: string, lexicalWorkConsumed = 0) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey,
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "synthetic-explicit-no-provider",
    assetDigest: "synthetic-original-membership",
    lexicalWorkConsumed,
    tokens: A.map(A.fromIterable(Str.matchAll(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/gu)(text)), (match) => {
      const word = match[0];
      const [pos, lemma] = O.getOrElse(R.get(lexicalFacts, Str.toLowerCase(word)), () => [
        "NOUN",
        Str.toLowerCase(word),
      ]);
      return ClaimLexicalToken.make({
        pos,
        lemma: O.some(lemma),
        anchor: TextAnchor.make({
          startChar: O.getOrThrow(O.fromUndefinedOr(match.index)),
          endChar: O.getOrThrow(O.fromUndefinedOr(match.index)) + word.length,
          quote: word,
        }),
      });
    }),
  });
const project = Effect.fn("SourceCertifiedFallbackTest.project")(function* (body: string, consumed = 0) {
  const text = `A system comprising ${body}`;
  const prepared = yield* prepareClaimInspection(
    ClaimInputCollection.make({
      sourceKey,
      records: [
        ClaimInputRecord.cases.text.make({
          sourceOrdinal: 1,
          numberText: O.some("1"),
          sourceText: text,
          canonicalText: text,
        }),
      ],
    })
  );
  const evidence = evidenceFor(text, consumed);
  const qualification = O.getOrThrow(A.head(prepared.qualifications));
  assert.strictEqual(qualification.status, "context-ready");
  if (qualification.status !== "context-ready") return yield* Effect.die("synthetic-qualification-failed");
  assert.isTrue(O.isNone(compileClaimClauseRoles(qualification.claim, evidence)));
  const baseline = yield* decomposePreparedClaimRoles(prepared, []);
  const candidate = yield* decomposePreparedClaimRoles(prepared, [evidence]);
  const old = O.getOrThrow(A.head(baseline.decompositions));
  const current = O.getOrThrow(A.head(candidate.decompositions));
  assert.strictEqual(old.status, "decomposed");
  assert.strictEqual(current.status, "decomposed");
  if (old.status !== "decomposed" || current.status !== "decomposed")
    return yield* Effect.die("synthetic-decomposition-failed");
  assert.strictEqual(candidate.plans.length, 0);
  return { text, old: old.tree, current: current.tree, prepared, evidence, claim: qualification.claim };
});
const terms = (
  elements: ReadonlyArray<{ readonly terms: ReadonlyArray<{ readonly anchor: { readonly quote: string } }> }>
) => A.flatMap(elements, (owner) => A.map(owner.terms, (term) => term.anchor.quote));

describe("source-certified fallback head boundary", () => {
  it.effect("uses the actual public route to remove only the proved trailing operator", () =>
    Effect.gen(function* () {
      const result = yield* project("a controller receives a signal encoded through a channel.");
      assert.include(terms(result.old.elements), "a signal encoded");
      assert.include(terms(result.current.elements), "a signal");
      assert.notInclude(terms(result.current.elements), "a signal encoded");
      assert.deepStrictEqual(
        A.map(result.old.elements, (owner) => [
          owner.path,
          owner.kind,
          owner.anchor,
          A.map(owner.terms, (term) => term.determiner),
        ]),
        A.map(result.current.elements, (owner) => [
          owner.path,
          owner.kind,
          owner.anchor,
          A.map(owner.terms, (term) => term.determiner),
        ])
      );
      for (const owner of result.current.elements)
        for (const term of owner.terms)
          assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(result.text), term.anchor.quote);
    })
  );
  it.effect("keeps attachment ambiguity unresolved for a selected complement", () =>
    Effect.gen(function* () {
      const result = yield* project("a controller keeps a signal encoded through a channel.");
      assert.include(terms(result.current.elements), "a signal");
    })
  );
  it.effect("retains explicit partial policy coverage after neutral lexical refinement", () =>
    Effect.gen(function* () {
      const result = yield* project("a controller keeps a signal encoded through a channel.");
      const report = yield* inspectPreparedClaimRoles(result.prepared, [result.evidence]);
      const record = O.getOrThrow(A.head(report.records));
      assert.strictEqual(record.status, "partial");
      if (record.status === "partial")
        assert.isTrue(A.some(record.coverage, (issue) => issue.kind === "policy-uncovered"));
    })
  );
  it.effect("retains unchanged fallback when the shared lexical debit exhausts refinement", () =>
    Effect.gen(function* () {
      const result = yield* project("a controller receives a signal encoded through a channel.", 250_000);
      assert.deepStrictEqual(result.current, result.old);
    })
  );
  it.effect("refuses numeric and PP object boundaries", () =>
    Effect.gen(function* () {
      for (const body of [
        "a controller receives a signal encoded through 5.",
        "a controller receives a signal of a module encoded through a channel.",
      ]) {
        const result = yield* project(body);
        assert.deepStrictEqual(result.current, result.old);
      }
    })
  );
  it.effect("leaves already bounded terms and unsupported open heads unchanged", () =>
    Effect.gen(function* () {
      for (const body of [
        "a controller receives a signal aligned with a channel.",
        "a controller receives signal encoded through a channel.",
      ]) {
        const result = yield* project(body);
        assert.deepStrictEqual(result.current, result.old);
      }
    })
  );
  it.effect("rebuilds each functional partition from the refined source mentions", () =>
    Effect.gen(function* () {
      const result = yield* project("a controller receives a signal encoded through a channel.");
      for (const edge of result.current.edges) {
        if (edge.kind !== "functional") continue;
        const owner = O.getOrThrow(A.findFirst(result.current.elements, (element) => element.path === edge.element));
        assert.strictEqual(
          A.join(
            A.map(edge.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote)),
            ""
          ),
          owner.anchor.quote
        );
        for (const part of edge.parts)
          if (part.kind === "term")
            assert.isTrue(
              A.some(
                owner.terms,
                (term) =>
                  term.anchor.startChar === part.term.anchor.startChar &&
                  term.anchor.endChar === part.term.anchor.endChar
              )
            );
      }
    })
  );
  it.effect("reuses one refined ancestor for multiple descendant constructions", () =>
    Effect.gen(function* () {
      const texts: A.NonEmptyReadonlyArray<string> = [
        "A system comprising a controller receives a signal encoded through a channel.",
        "The system of claim 1, wherein the signal is configured to enter a filter.",
        "The system of claim 1, wherein the signal is configured to enter a receiver.",
      ];
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
      const firstText = O.getOrThrow(A.head(texts));
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(firstText)]);
      assert.strictEqual(result.plans.length, 0);
      const descendants = A.drop(result.decompositions, 1);
      assert.strictEqual(descendants.length, 2);
      for (const outcome of descendants) {
        assert.strictEqual(outcome.status, "decomposed");
        if (outcome.status !== "decomposed") continue;
        assert.includeDeepMembers(
          A.flatMap(outcome.tree.edges, (edge) =>
            edge.kind === "antecedent"
              ? [
                  {
                    referring: edge.referring.anchor.quote,
                    introducing: edge.introducing.anchor.quote,
                  },
                ]
              : []
          ),
          [{ referring: "the signal", introducing: "a signal" }]
        );
      }
    })
  );
  it("keeps the internal capability outside the public barrel", () => {
    assert.isFalse("compileClaimClauseRolesForFallback" in PublicClaimElement);
  });
});
