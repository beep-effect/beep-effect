import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceControlEvidence,
  ClaimSourceElementPlan,
  decomposeClaimInput,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
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

// Explicit source-only controls; this map is not production lexical evidence.
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["comprising", ["VERB", "comprise"]],
  ["having", ["VERB", "have"]],
  ["and", ["CCONJ", "and"]],
  ["or", ["CCONJ", "or"]],
  ["is", ["AUX", "be"]],
  ["mounted", ["VERB", "mount"]],
  ["with", ["ADP", "with"]],
  ["each", ["DET", "each"]]
);
const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "dotted-label-source-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const evidenceFor = (text: string, joined = false) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "dotted-label-source-control",
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "explicit-source-only",
    assetDigest: "no-provider-executed",
    tokens: A.map(
      A.fromIterable(
        Str.matchAll(joined ? /[a-z]\.(?=\s)|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu : /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)
      ),
      (match) => {
        const lower = Str.toLowerCase(match[0]);
        const [pos, lemma] = O.getOrElse(HashMap.get(lexical, lower), () => [
          O.isSome(Str.match(/^[\p{L}\p{N}]/u)(lower)) ? "NOUN" : "PUNCT",
          lower,
        ]);
        const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
        return ClaimLexicalToken.make({
          anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
          pos,
          lemma: O.some(lemma),
        });
      }
    ),
  });
const resultOf = Effect.fn("DottedLabelTest.resultOf")(function* (text: string, joined = false) {
  const prepared = yield* prepareClaimInspection(inputOf(text));
  return yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text, joined)]);
});
const planOf = Effect.fn("DottedLabelTest.planOf")(function* (text: string, joined = false) {
  const result = yield* resultOf(text, joined);
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});
const meter = (initial = 262_144) => {
  let remaining = initial;
  let failed = false;
  let afterFailure = 0;
  return {
    charge: (amount: number) => {
      if (failed) afterFailure++;
      remaining -= amount;
      failed = remaining < 0;
      return !failed;
    },
    remaining: () => remaining,
    afterFailure: () => afterFailure,
  };
};
const labelsOf = (plan: ClaimSourceElementPlan) =>
  A.flatMap(plan.declarations, (d) => A.map(d.items, (item) => item.label.quote));
const assertLabelTermsAbsent = (plan: ClaimSourceElementPlan) => {
  for (const element of plan.elements)
    for (const nominal of element.nominals) {
      assert.notStrictEqual(nominal.anchor.quote, "a.");
      assert.notStrictEqual(nominal.anchor.quote, "b.");
      assert.notStrictEqual(nominal.anchor.quote, "b");
    }
};

describe("source-owned dotted alphabetic declarations", () => {
  for (const joined of [false, true])
    it.effect(`binds complete root labels and original token geometry (${joined ? "one" : "two"} token form)`, () =>
      Effect.gen(function* () {
        const text = "A system comprising: a. a plate; b. a cover.";
        const plan = yield* planOf(text, joined);
        assert.deepStrictEqual(labelsOf(plan), ["a.", "b."]);
        assert.deepStrictEqual(
          A.map(plan.elements, (e) => [e.extent.startChar, e.extent.endChar, e.extent.quote]),
          [
            [0, 8, "A system"],
            [24, 31, "a plate"],
            [36, 43, "a cover"],
          ]
        );
        const declaration = O.getOrThrow(A.head(plan.declarations));
        assert.strictEqual(declaration.owner, 1);
        assert.deepStrictEqual(
          A.map(declaration.items, (item) => [item.label.startChar, item.label.endChar, item.child]),
          [
            [21, 23, 2],
            [33, 35, 3],
          ]
        );
        assert.deepStrictEqual(
          A.map(plan.elements, (e) => O.getOrNull(e.parent)),
          [null, 1, 1]
        );
        assertLabelTermsAbsent(plan);
        const work = meter();
        assert.isTrue(validateClaimSourceOwnership(plan, work.charge));
      })
    );
  it.effect("retains the parenthesized spelling and the actual qualified leading colon", () =>
    Effect.gen(function* () {
      const old = yield* planOf("A system comprising: (a) a plate; (b) a cover.");
      assert.deepStrictEqual(labelsOf(old), ["(a)", "(b)"]);
      const dotted = yield* planOf("A system comprising: a. a plate; b. a cover.");
      assert.deepStrictEqual(
        A.map(dotted.elements, (e) => [e.kind, O.getOrNull(e.parent)]),
        A.map(old.elements, (e) => [e.kind, O.getOrNull(e.parent)])
      );
      assert.strictEqual(O.getOrThrow(A.head(dotted.declarationPlans)).anchor.quote, "comprising:");
    })
  );
  it.effect("retains source whitespace inside legacy parenthesized labels", () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
        ["A system comprising: ( a ) a plate; ( b ) a cover.", ["( a )", "( b )"]],
        ["A system comprising: (a ) a plate; (b ) a cover.", ["(a )", "(b )"]],
        ["A system comprising: ( a) a plate; ( b) a cover.", ["( a)", "( b)"]],
        ["A system comprising: ( i ) a plate; ( ii ) a cover.", ["( i )", "( ii )"]],
      ];
      for (const [text, labels] of cases) {
        const plan = yield* planOf(text);
        assert.deepStrictEqual(labelsOf(plan), labels);
        assert.isTrue(validateClaimSourceOwnership(plan, meter().charge));
      }
    })
  );
  it.effect("reuses a proved local owner and nested Roman declaration", () =>
    Effect.gen(function* () {
      const local = yield* planOf("A system comprising a housing comprising: a. a plate; b. a cover.");
      assert.strictEqual(O.getOrThrow(A.head(local.declarations)).owner, 2);
      assert.deepStrictEqual(
        A.map(local.elements, (e) => O.getOrNull(e.parent)),
        [null, 1, 2, 2]
      );
      const nested = yield* planOf("A system comprising: a. a plate having: (i) a rib; (ii) a lip; b. a cover.");
      assert.deepStrictEqual(
        A.map(nested.declarations, (d) => A.map(d.items, (item) => item.label.quote)),
        [
          ["a.", "b."],
          ["(i)", "(ii)"],
        ]
      );
    })
  );
  it.effect("uses original UTF-16 units and the exposed silo-list shape without source identities", () =>
    Effect.gen(function* () {
      const silo = yield* planOf("A feeder comprising: a. A silo; b. A plate.");
      assert.deepStrictEqual(labelsOf(silo), ["a.", "b."]);
      const renamed = yield* planOf("A rack comprising: a. A column; b. A panel.");
      assert.deepStrictEqual(labelsOf(renamed), ["a.", "b."]);
      const text = 'A "🚀" system comprising: a. a plate; b. a cover.';
      const unicode = yield* planOf(text);
      for (const d of unicode.declarations)
        for (const item of d.items)
          assert.strictEqual(Str.slice(item.label.startChar, item.label.endChar)(text), item.label.quote);
    })
  );
  const negatives = [
    "A system comprising a. a plate; b. a cover.",
    "A system comprising: a. a plate.",
    "A system comprising: b. a plate; c. a cover.",
    "A system comprising: a. a plate; c. a cover.",
    "A system comprising: a. a plate; a. a cover.",
    "A system comprising: b. a plate; a. a cover.",
    "A system comprising: a. a plate; (b) a cover.",
    "A system comprising: (a) a plate; b. a cover.",
    "A system comprising: A. a plate; B. a cover.",
    "A system comprising: a . a plate; b. a cover.",
    "A system comprising: a.a plate; b.a cover.",
    "A system comprising: a. a plate; b.",
    "A system comprising: a. ; b. a cover.",
    "A system comprising a housing: a. a plate; b. a cover.",
    "A system comprising: i. a plate; ii. a cover.",
    'A system comprising: "a. a plate; b. a cover".',
    "A system comprising: (a. a plate; b. a cover).",
    "A system comprising: A. Smith; B. Jones.",
    "A system comprising: 1.5 plates; 2.5 covers.",
  ];
  for (const text of negatives)
    it.effect(`declines an unsupported or ambiguous declaration: ${text}`, () =>
      Effect.gen(function* () {
        const result = yield* resultOf(text);
        assert.strictEqual(result.plans.length, 0);
        const legacy = yield* decomposeClaimInput(inputOf(text));
        assert.deepStrictEqual(result.decompositions, legacy);
        const prepared = yield* prepareClaimInspection(inputOf(text));
        const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
        assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
      })
    );
  it.effect("rejects a coherent downgrade of every dotted label to an unsupported bare label", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a. a plate; b. a cover.");
      const short = (label: TextAnchor): TextAnchor =>
        TextAnchor.make({ ...label, endChar: label.endChar - 1, quote: Str.slice(0, -1)(label.quote) });
      const corrupted = ClaimSourceElementPlan.make({
        ...plan,
        declarations: A.map(plan.declarations, (declaration) => ({
          ...declaration,
          items: A.map(declaration.items, (item) => ({ ...item, label: short(item.label) })),
        })),
        declarationPlans: A.map(plan.declarationPlans, (declaration) =>
          declaration.kind === "labelled"
            ? { ...declaration, items: A.map(declaration.items, (item) => ({ ...item, label: short(item.label) })) }
            : declaration
        ),
        sourceExclusions: A.map(plan.sourceExclusions, (exclusion) =>
          exclusion.kind === "declaration-metadata" ? { ...exclusion, extent: short(exclusion.extent) } : exclusion
        ),
        tokenOwnership: A.map(plan.tokenOwnership, (token) =>
          token.kind === "control" && token.extent.quote === "." && token.evidence.kind === "exclusion"
            ? { ...token, evidence: ClaimSourceControlEvidence.cases.punctuation.make({}) }
            : token
        ),
      });
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.head(corrupted.declarations)).items, (item) => item.label.quote),
        ["a", "b"]
      );
      assert.isFalse(validateClaimSourceOwnership(corrupted, meter().charge));
      const parenthesized = yield* planOf("A system comprising: (a) a plate; (b) a cover.");
      assert.isTrue(validateClaimSourceOwnership(parenthesized, meter().charge));
    })
  );
  it.effect("rejects direct corruption of declaration rank, anchor, child and owner", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a. a plate; b. a cover.");
      const declaration = O.getOrThrow(A.head(plan.declarationPlans));
      if (declaration.kind !== "labelled") throw new Error("expected labelled declaration");
      const first = O.getOrThrow(A.head(declaration.items));
      const mutations = [
        { ...declaration, items: A.reverse(declaration.items) },
        { ...declaration, owner: O.getOrThrow(A.get(plan.elements, 1)).ordinal },
        {
          ...declaration,
          items: A.prepend(A.drop(declaration.items, 1), {
            ...first,
            child: O.getOrThrow(A.get(plan.elements, 2)).ordinal,
          }),
        },
        {
          ...declaration,
          items: A.prepend(A.drop(declaration.items, 1), {
            ...first,
            label: TextAnchor.make({ ...first.label, quote: "c." }),
          }),
        },
        {
          ...declaration,
          items: A.prepend(A.drop(declaration.items, 1), {
            ...first,
            label: TextAnchor.make({ startChar: first.label.startChar, endChar: first.label.endChar - 1, quote: "a" }),
          }),
        },
      ];
      for (const mutation of mutations) {
        const source = ClaimSourceElementPlan.make({ ...plan, declarationPlans: [mutation] });
        assert.isFalse(validateClaimSourceOwnership(source, meter().charge));
        const coherentList = {
          owner: mutation.owner,
          anchor: mutation.anchor,
          items: A.map(mutation.items, (item) => ({ child: item.child, label: item.label })),
        };
        const paired = ClaimSourceElementPlan.make({ ...source, declarations: [coherentList] });
        assert.isFalse(validateClaimSourceOwnership(paired, meter().charge));
      }
      const exhausted = meter(0);
      assert.isFalse(validateClaimSourceOwnership(plan, exhausted.charge));
      assert.strictEqual(exhausted.afterFailure(), 0);
    })
  );
});
