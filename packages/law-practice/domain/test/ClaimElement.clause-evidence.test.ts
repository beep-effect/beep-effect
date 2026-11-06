import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  compileClaimClauseRoles,
  decomposeClaimInput,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";

const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "qualified-evidence-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const factsFor = (text: string): ReadonlyArray<ClaimLexicalToken> =>
  A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
    const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
    const lower = Str.toLowerCase(match[0]);
    const pos = A.contains(["a", "an", "the"], lower)
      ? "DET"
      : lower === "comprising"
        ? "VERB"
        : O.isSome(Str.match(/^[\p{L}\p{N}]+$/u)(lower))
          ? "NOUN"
          : "PUNCT";
    return ClaimLexicalToken.make({
      anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
      pos,
      lemma: O.some(lower),
    });
  });
const evidenceFor = (text: string) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "qualified-evidence-control",
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "injected-domain-control",
    assetDigest: "test-only",
    tokens: factsFor(text),
  });

describe("qualified source evidence and atomic projection", () => {
  it.effect("keeps ambiguous partitive attachment and mass roles unknown", () =>
    Effect.gen(function* () {
      for (const noun of ["sensors", "material"]) {
        const text = `A system comprising a set of ${noun} that is mounted.`;
        const claim = PatentClaim.cases.independent.make({
          claimNumber: 1,
          claimText: text,
          preamble: "A system",
          transition: "comprising",
          body: `a set of ${noun} that is mounted.`,
        });
        const original = evidenceFor(text);
        const evidence = ClaimLexicalEvidence.cases.aligned.make({
          ...original,
          tokens: A.map(original.tokens, (token) => {
            const lower = Str.toLowerCase(token.anchor.quote);
            const [pos, lemma] = O.getOrElse(
              HashMap.get(
                HashMap.make(
                  ["of", ["ADP", "of"]],
                  ["that", ["SCONJ", "that"]],
                  ["is", ["AUX", "be"]],
                  ["mounted", ["VERB", "mount"]],
                  ["sensors", ["NOUN", "sensor"]]
                ),
                lower
              ),
              () => [token.pos, lower]
            );
            return ClaimLexicalToken.make({ ...token, pos, lemma: O.some(lemma) });
          }),
        });
        const plan = O.getOrThrow(compileClaimClauseRoles(claim, evidence));
        const nominal = O.getOrThrow(A.findFirst(plan.nominals, (candidate) => candidate.head.quote === noun));
        assert.strictEqual(nominal.role, "unknown");
      }
    })
  );
  it.effect("rejects wrong source identity, ordinal, stale text and duplicate evidence", () =>
    Effect.gen(function* () {
      const input = inputOf("A system comprising a sensor; the sensor.");
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const fact = evidenceFor(qualification.claim.claimText);
      const accepted = yield* decomposePreparedClaimRoles(prepared, [fact]);
      assert.strictEqual(accepted.plans.length, 1);
      const cases = [
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, sourceKey: "another-source" })],
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, sourceOrdinal: 2 })],
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, qualifiedText: `${fact.qualifiedText} ` })],
        [fact, fact],
      ];
      const old = yield* decomposeClaimInput(input);
      for (const evidence of cases) {
        const result = yield* decomposePreparedClaimRoles(prepared, evidence);
        assert.strictEqual(result.plans.length, 0);
        assert.deepStrictEqual(result.decompositions, old);
        const report = yield* inspectPreparedClaimRoles(prepared, evidence);
        assert.isTrue(
          A.every(
            report.records,
            (row) => row.status === "partial" && A.some(row.coverage, (issue) => issue.kind === "policy-uncovered")
          )
        );
        assert.deepStrictEqual(report.input, input);
      }
    })
  );
  it.effect("keeps a bounded one-hundred-NP source under the shared source reservation", () =>
    Effect.gen(function* () {
      const body = A.join(
        A.map(A.range(1, 100), (index) => `a component${index}`),
        "; "
      );
      const input = inputOf(`A system comprising ${body}.`);
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(qualification.claim.claimText)]);
      assert.strictEqual(result.plans.length, 1);
      const decomposition = O.getOrThrow(A.head(result.decompositions));
      assert.strictEqual(decomposition.status, "decomposed");
      if (decomposition.status === "decomposed") assert.strictEqual(decomposition.tree.elements.length, 101);
    })
  );
  it.effect("discards every projection of one source when two hundred NPs exhaust its shared reservation", () =>
    Effect.gen(function* () {
      const body = A.join(
        A.map(A.range(1, 200), (index) => `a component${index}`),
        "; "
      );
      const input = inputOf(`A system comprising ${body}.`);
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(qualification.claim.claimText)]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
    })
  );
  it.effect("discards every projection of one source when its shared reservation is exhausted", () =>
    Effect.gen(function* () {
      const body = A.join(
        A.map(A.range(1, 400), (index) => `a component${index}`),
        "; "
      );
      const input = inputOf(`A system comprising ${body}.`);
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(qualification.claim.claimText)]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
    })
  );
  it.effect("declines excessive bracket depth without admitting a partial role plan", () =>
    Effect.gen(function* () {
      const body = `${Str.repeat(129)("(")}a sensor${Str.repeat(129)(")")}`;
      const text = `A system comprising ${body}.`;
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: text,
        preamble: "A system",
        transition: "comprising",
        body,
      });
      assertNone(compileClaimClauseRoles(claim, evidenceFor(text)));
    })
  );
});

const compositionEvidence = (text: string) => {
  const original = evidenceFor(text);
  const evidence = ClaimLexicalEvidence.cases.aligned.make({
    ...original,
    tokens: A.map(original.tokens, (token) => {
      const lexical = HashMap.get(
        HashMap.make<ReadonlyArray<readonly [string, readonly [string, string]]>>(
          ["and", ["CCONJ", "and"]],
          ["radial", ["ADJ", "radial"]],
          ["detects", ["VERB", "detect"]],
          ["that", ["SCONJ", "that"]],
          ["of", ["ADP", "of"]],
          ["is", ["AUX", "be"]],
          ["attached", ["VERB", "attach"]],
          ["to", ["ADP", "to"]],
          ["in", ["ADP", "in"]],
          ["with", ["ADP", "with"]],
          ["for", ["ADP", "for"]],
          ["by", ["ADP", "by"]],
          ["punching", ["VERB", "punch"]]
        ),
        Str.toLowerCase(token.anchor.quote)
      );
      return O.match(lexical, {
        onNone: () => token,
        onSome: ([pos, lemma]) => ClaimLexicalToken.make({ ...token, pos, lemma: O.some(lemma) }),
      });
    }),
  });
  return evidence;
};
const compositionControl = Effect.fn("compositionControl")(function* (text: string) {
  const prepared = yield* prepareClaimInspection(inputOf(text));
  return yield* decomposePreparedClaimRoles(prepared, [compositionEvidence(text)]);
});

it.effect("projects governing NP coordination into exact preamble-owned children including adjective modifiers", () =>
  Effect.gen(function* () {
    for (const first of ["a detector", "a radial detector"]) {
      const text = `A system comprising ${first} and a processor.`;
      const result = yield* compositionControl(text);
      assert.strictEqual(result.plans.length, 1);
      const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
      assert.deepStrictEqual(
        A.map(source.elements, (element) => element.extent.quote),
        ["A system", first, "a processor"]
      );
      assert.deepStrictEqual(
        A.map(source.elements, (element) => element.parent),
        [O.none(), O.some(1), O.some(1)]
      );
      assert.deepStrictEqual(
        A.map(source.elements, (element) => element.kind),
        ["preamble-subject", "limitation", "limitation"]
      );
      for (const element of source.elements) {
        const anchor = element.extent;
        assert.strictEqual(Str.slice(anchor.startChar, anchor.endChar)(text), anchor.quote);
      }
    }
  })
);
it.effect("keeps finite SVO object coordination in one element and declines ambiguous modifier-list attachment", () =>
  Effect.gen(function* () {
    const body = "the unit detects a signal and a processor";
    const result = yield* compositionControl(`A system comprising ${body}.`);
    assert.strictEqual(result.plans.length, 1);
    const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
    assert.deepStrictEqual(
      A.map(source.elements, (element) => element.extent.quote),
      ["A system", body]
    );
    for (const text of [
      "A system comprising a unit that detects a signal and a processor.",
      "A system comprising a plate of the unit and a cover.",
    ]) {
      const declined = yield* compositionControl(text);
      assert.strictEqual(declined.plans.length, 0);
      const legacy = yield* decomposeClaimInput(inputOf(text));
      assert.deepStrictEqual(declined.decompositions, legacy);
    }
  })
);

it.effect("keeps grammatical NP ownership and auxiliary operators source-bound under the shared reservation", () =>
  Effect.gen(function* () {
    const text = "A system comprising a plate of the unit; the plate is attached to a frame.";
    const result = yield* compositionControl(text);
    assert.strictEqual(result.plans.length, 1);
    const bound = O.getOrThrow(A.head(result.plans));
    const source = bound.sourcePlan;
    const modifierFrame = O.getOrThrow(
      A.findFirst(source.frames, (frame) => frame.lexicalHeader.quote === "a plate of the unit")
    );
    const modifier = O.getOrThrow(
      A.findFirst(modifierFrame.arguments, (argument) => argument.role === "nominal-modifier")
    );
    assert.strictEqual(modifier.nominal.quote, "the unit");
    assert.strictEqual(O.getOrThrow(modifier.ownerNominal).quote, "a plate");
    assert.deepStrictEqual(modifier.predicate, O.none());
    const auxiliaryFrame = O.getOrThrow(
      A.findFirst(source.frames, (frame) => frame.lexicalHeader.quote === "the plate is attached to a frame")
    );
    assert.deepStrictEqual(
      A.map(auxiliaryFrame.predicates, (predicate) => predicate.quote),
      ["is attached"]
    );
    const object = O.getOrThrow(
      A.findFirst(auxiliaryFrame.arguments, (argument) => argument.nominal.quote === "a frame")
    );
    assert.strictEqual(object.role, "prepositional-complement");
    assert.strictEqual(O.getOrThrow(object.predicate).quote, "is attached");
    assert.deepStrictEqual(object.ownerNominal, O.none());
    assert.isBelow(source.remainingWork, bound.plan.remainingWork);
    assert.isAtLeast(source.remainingWork, 0);
  })
);

it.effect("proves ordinary NP PP ownership without changing core heads or public term partitions", () =>
  Effect.gen(function* () {
    const text = "A system comprising a plate in the housing.";
    const result = yield* compositionControl(text);
    assert.strictEqual(result.plans.length, 1);
    const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
    const plate = O.getOrThrow(A.findFirst(source.nominals, (nominal) => nominal.core.quote === "a plate"));
    assert.deepStrictEqual(
      [plate.core.quote, plate.head.quote, plate.outer.quote],
      ["a plate", "plate", "a plate in the housing"]
    );
    assert.strictEqual(Str.slice(plate.outer.startChar, plate.outer.endChar)(text), plate.outer.quote);
    const frame = O.getOrThrow(A.findFirst(source.frames, (candidate) => candidate.extent.quote === plate.outer.quote));
    const housing = O.getOrThrow(A.findFirst(frame.arguments, (argument) => argument.nominal.quote === "the housing"));
    assert.strictEqual(housing.role, "nominal-modifier");
    assert.deepStrictEqual(housing.ownerNominal, O.some(plate.core));
    assert.deepStrictEqual(housing.predicate, O.none());
    const body = O.getOrThrow(A.get(source.elements, 1));
    assert.deepStrictEqual(
      A.map(body.nominals, (nominal) => [nominal.anchor.quote, nominal.head.quote]),
      [
        ["a plate", "plate"],
        ["the housing", "housing"],
      ]
    );
    const decomposition = O.getOrThrow(A.head(result.decompositions));
    assert.strictEqual(decomposition.status, "decomposed");
    if (decomposition.status === "decomposed")
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.get(decomposition.tree.elements, 1)).terms, (term) => term.anchor.quote),
        ["a plate", "the housing"]
      );
  })
);
it.effect("distinguishes an NP event modifier from a finite manner event without nearest-NP donation", () =>
  Effect.gen(function* () {
    const nominalText = "A system comprising a unit for punching a hole.";
    const nominal = yield* compositionControl(nominalText);
    assert.strictEqual(nominal.plans.length, 1);
    const nominalSource = O.getOrThrow(A.head(nominal.plans)).sourcePlan;
    const unit = O.getOrThrow(A.findFirst(nominalSource.nominals, (n) => n.core.quote === "a unit"));
    assert.strictEqual(unit.outer.quote, "a unit for punching a hole");
    const text = "A system comprising a controller that detects a signal by punching a hole.";
    const result = yield* compositionControl(text);
    assert.strictEqual(result.plans.length, 1);
    const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
    const signal = O.getOrThrow(A.findFirst(source.nominals, (n) => n.core.quote === "a signal"));
    assert.deepStrictEqual(signal.outer, signal.core);
    const event = O.getOrThrow(A.findFirst(source.frames, (frame) => frame.extent.quote === "by punching a hole"));
    const parent = O.getOrThrow(A.findFirst(source.frames, (frame) => O.contains(event.parent, frame.ordinal)));
    assert.strictEqual(parent.attachment, "relative");
    assert.deepStrictEqual(
      A.map(parent.predicates, (predicate) => predicate.quote),
      ["detects"]
    );
    assert.deepStrictEqual(
      A.map(event.predicates, (predicate) => predicate.quote),
      ["punching"]
    );
    const object = O.getOrThrow(A.head(event.arguments));
    assert.strictEqual(object.nominal.quote, "a hole");
    assert.strictEqual(object.role, "object");
    assert.strictEqual(O.getOrThrow(object.predicate).quote, "punching");
    assert.deepStrictEqual(object.ownerNominal, O.none());
    assert.deepStrictEqual(
      A.map(O.getOrThrow(A.get(source.elements, 1)).nominals, (n) => [n.anchor.quote, n.head.quote]),
      [
        ["a controller", "controller"],
        ["a signal", "signal"],
        ["a hole", "hole"],
      ]
    );
    const decomposition = O.getOrThrow(A.head(result.decompositions));
    assert.strictEqual(decomposition.status, "decomposed");
    if (decomposition.status === "decomposed") {
      const body = O.getOrThrow(A.get(decomposition.tree.elements, 1));
      assert.strictEqual(body.kind, "functional-relation");
      assert.deepStrictEqual(
        A.map(body.terms, (term) => [term.anchor.quote, term.head]),
        [
          ["a controller", "controller"],
          ["a signal", "signal"],
          ["a hole", "hole"],
        ]
      );
    }
  })
);
it.effect("declines competing event and chained PP attachments atomically with adverse coverage", () =>
  Effect.gen(function* () {
    for (const text of [
      "A system comprising a controller that detects a signal for punching a hole.",
      "A system comprising a plate in the housing with a cover.",
    ]) {
      const input = inputOf(text);
      const prepared = yield* prepareClaimInspection(input);
      const evidence = compositionEvidence(text);
      const result = yield* decomposePreparedClaimRoles(prepared, [evidence]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
      const report = yield* inspectPreparedClaimRoles(prepared, [evidence]);
      const row = O.getOrThrow(A.head(report.records));
      assert.strictEqual(row.status, "partial");
      if (row.status === "partial")
        assert.strictEqual(A.filter(row.coverage, (issue) => issue.kind === "policy-uncovered").length, 1);
    }
  })
);
