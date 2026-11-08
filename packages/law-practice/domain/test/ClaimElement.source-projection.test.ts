import {
  ClaimElementKind,
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimTermDeterminer,
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
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import correctionInput from "./fixtures/claim-element/source-projection-outer-correction.json" with { type: "json" };
import contracts from "./fixtures/claim-element/source-projection-plans.json" with { type: "json" };
import type { ClaimElementTree, ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement";

const correctionContract = S.Struct({
  originalSha256: S.String,
  replacements: S.Array(S.Struct({ case: S.String, termOrdinal: S.Int, oldOuter: TextAnchor, newOuter: TextAnchor })),
});
const expected = S.Struct({
  fixtures: S.Array(
    S.Struct({
      case: S.String,
      qualifiedText: S.String,
      outcome: S.String,
      nominals: S.Array(S.Struct({ core: TextAnchor, head: TextAnchor, outer: TextAnchor })).pipe(S.optionalKey),
      attachedFrames: S.Array(
        S.Struct({
          id: S.String,
          parentFrame: S.NullOr(S.String),
          attachment: S.String,
          anchor: TextAnchor,
          predicates: S.Array(TextAnchor),
        })
      ),
      elements: S.Array(
        S.Struct({
          id: S.String,
          parent: S.NullOr(S.String),
          kind: ClaimElementKind,
          anchor: TextAnchor,
          terms: S.Array(S.Struct({ anchor: TextAnchor, head: S.String, determiner: ClaimTermDeterminer })),
        })
      ),
    })
  ),
});
// Explicit injected lexical controls; not a runtime dictionary or trained data.
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["said", ["DET", "said"]],
  ["each", ["DET", "each"]],
  ["its", ["DET", "its"]],
  ["two", ["NUM", "two"]],
  ["detects", ["VERB", "detect"]],
  ["stores", ["VERB", "store"]],
  ["includes", ["VERB", "include"]],
  ["comprising", ["VERB", "comprise"]],
  ["having", ["VERB", "have"]],
  ["ensures", ["VERB", "ensure"]],
  ["receives", ["VERB", "receive"]],
  ["displays", ["NOUN", "display"]],
  ["contains", ["VERB", "contain"]],
  ["operates", ["VERB", "operate"]],
  ["punching", ["VERB", "punch"]],
  ["is", ["AUX", "be"]],
  ["collected", ["VERB", "collect"]],
  ["attached", ["VERB", "attach"]],
  ["radial", ["ADJ", "radial"]],
  ["lower", ["ADJ", "lower"]],
  ["upper", ["ADJ", "upper"]],
  ["outer", ["ADJ", "outer"]],
  ["l-shaped", ["ADJ", "l-shaped"]],
  ["u-shaped", ["ADJ", "u-shaped"]],
  ["of", ["ADP", "of"]],
  ["in", ["ADP", "in"]],
  ["with", ["ADP", "with"]],
  ["for", ["ADP", "for"]],
  ["to", ["ADP", "to"]],
  ["by", ["ADP", "by"]],
  ["during", ["ADP", "during"]],
  ["at", ["ADP", "at"]],
  ["and", ["CCONJ", "and"]],
  ["or", ["CCONJ", "or"]],
  ["that", ["SCONJ", "that"]],
  ["which", ["SCONJ", "which"]],
  ["wherein", ["SCONJ", "wherein"]],
  ["tabs", ["NOUN", "tab"]],
  ["slots", ["NOUN", "slot"]],
  ["sensors", ["NOUN", "sensor"]],
  ["units", ["NOUN", "unit"]],
  ["operate", ["VERB", "operate"]],
  ["detect", ["VERB", "detect"]],
  ["surfaces", ["VERB", "surface"]],
  ["arranged", ["VERB", "arrange"]],
  ["on", ["ADP", "on"]],
  ["reliably", ["ADV", "reliably"]],
  ["consistently", ["ADV", "consistently"]]
);
const evidenceFor = (text: string, sourceOrdinal = 1) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "source-projection-control",
    sourceOrdinal,
    qualifiedText: text,
    provider: "explicit-source-control",
    assetDigest: "test-only",
    tokens: A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
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
    }),
  });
type ExpectedFixture = (typeof expected.Type)["fixtures"][number];
type Correction = typeof correctionContract.Type;

const nominalExpectationsOf = (fixture: ExpectedFixture, correction: Correction) =>
  A.map(
    O.getOrElse(O.fromUndefinedOr(fixture.nominals), () => []),
    (nominal, ordinal) => {
      const replacement = A.findFirst(
        correction.replacements,
        (row) => row.case === fixture.case && row.termOrdinal === ordinal
      );
      if (O.isNone(replacement)) return nominal;
      assert.deepStrictEqual(nominal.outer, replacement.value.oldOuter);
      return { ...nominal, outer: replacement.value.newOuter };
    }
  );
const assertNominals = (fixture: ExpectedFixture, correction: Correction, source: ClaimSourceElementPlan): void => {
  for (const nominal of nominalExpectationsOf(fixture, correction)) {
    const actual = O.getOrThrow(
      A.findFirst(
        source.nominals,
        (n) => n.core.startChar === nominal.core.startChar && n.core.endChar === nominal.core.endChar
      )
    );
    assert.deepStrictEqual({ core: actual.core, head: actual.head, outer: actual.outer }, nominal, fixture.case);
  }
};
const assertRelativeArguments = (source: ClaimSourceElementPlan): void => {
  const relative = O.getOrThrow(A.findFirst(source.frames, (f) => f.attachment === "relative"));
  assert.strictEqual(O.getOrThrow(relative.subject).quote, "a display control unit");
  assert.deepStrictEqual(
    A.map(relative.arguments, (argument) => [argument.nominal.quote, argument.role]),
    [
      ["a scan", "prepositional-complement"],
      ["a curve", "object"],
    ]
  );
};
const assertComplementSubject = (source: ClaimSourceElementPlan): void => {
  const complement = O.getOrThrow(A.findFirst(source.frames, (f) => f.attachment === "event-complement"));
  assert.strictEqual(O.getOrThrow(complement.subject).quote, "the detector");
};
const assertSharedSubject = (source: ClaimSourceElementPlan): void => {
  const continuation = O.getOrThrow(A.findFirst(source.frames, (f) => f.attachment === "coordinate"));
  assert.strictEqual(O.getOrThrow(continuation.sharedSubject).quote, "the unit");
  const hasCoordination = O.isSome(continuation.coordination);
  assertTrue(hasCoordination);
};
const assertSpecialFrameContracts = (fixture: ExpectedFixture, source: ClaimSourceElementPlan): void => {
  if (fixture.case === "relative-intervening-adjunct") assertRelativeArguments(source);
  if (fixture.case === "complement-that-not-sibling") assertComplementSubject(source);
  if (fixture.case === "shared-subject-continuation") assertSharedSubject(source);
};
const assertAttachedFrames = (fixture: ExpectedFixture, source: ClaimSourceElementPlan): void => {
  for (const frame of fixture.attachedFrames) {
    const actual = O.getOrThrow(
      A.findFirst(
        source.frames,
        (f) =>
          f.extent.startChar === frame.anchor.startChar &&
          f.extent.endChar === frame.anchor.endChar &&
          f.attachment === frame.attachment
      )
    );
    for (const predicate of frame.predicates)
      assert.isTrue(
        A.some(actual.predicates, (p) => p.startChar === predicate.startChar && p.endChar === predicate.endChar),
        fixture.case
      );
    if (frame.parentFrame !== null) {
      const expectedParent = O.getOrThrow(A.findFirst(fixture.attachedFrames, (f) => f.id === frame.parentFrame));
      const parent = O.getOrThrow(A.findFirst(source.frames, (f) => O.contains(actual.parent, f.ordinal)));
      assert.deepStrictEqual(parent.extent, expectedParent.anchor, fixture.case);
    }
  }
};
const assertElements = (fixture: ExpectedFixture, tree: ClaimElementTree): void => {
  assert.deepStrictEqual(
    A.map(tree.elements, ({ anchor, kind, terms }) => ({
      anchor,
      kind,
      terms: A.map(terms, ({ anchor, head, determiner }) => ({ anchor, head, determiner })),
    })),
    A.map(fixture.elements, ({ anchor, kind, terms }) => ({ anchor, kind, terms })),
    fixture.case
  );
};
const assertParents = (fixture: ExpectedFixture, tree: ClaimElementTree): void => {
  const paths = HashMap.fromIterable(
    A.map(fixture.elements, (element, index) => [element.id, O.getOrThrow(A.get(tree.elements, index)).path])
  );
  const expectedParents = A.flatMap(fixture.elements, (element) =>
    element.parent === null
      ? []
      : [
          {
            kind: "part-of",
            child: O.getOrThrow(HashMap.get(paths, element.id)),
            parent: O.getOrThrow(HashMap.get(paths, element.parent)),
          },
        ]
  );
  assert.deepStrictEqual(
    A.flatMap(tree.edges, (edge) =>
      edge.kind === "part-of" ? [{ kind: edge.kind, child: edge.child, parent: edge.parent }] : []
    ),
    expectedParents,
    fixture.case
  );
};
const assertFunctionalPartitions = (fixture: ExpectedFixture, tree: ClaimElementTree): void => {
  for (const edge of tree.edges) {
    if (edge.kind !== "functional") continue;
    const owner = O.getOrThrow(A.findFirst(tree.elements, (element) => element.path === edge.element));
    assert.strictEqual(
      A.join(
        A.map(edge.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote)),
        ""
      ),
      owner.anchor.quote,
      fixture.case
    );
  }
};
const projectFixture = Effect.fn("SourceProjectionTest.projectFixture")(function* (fixture: ExpectedFixture) {
  const dependent = fixture.case === "governing-introducer-excluded";
  const texts: A.NonEmptyReadonlyArray<string> = dependent
    ? ["A system comprising a detector.", fixture.qualifiedText]
    : [fixture.qualifiedText];
  const input = ClaimInputCollection.make({
    sourceKey: "source-projection-control",
    records: A.map(texts, (text, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: text,
        canonicalText: text,
      })
    ),
  });
  const prepared = yield* prepareClaimInspection(input);
  const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(fixture.qualifiedText, dependent ? 2 : 1)]);
  assert.strictEqual(result.plans.length, fixture.outcome === "admitted" ? 1 : 0, fixture.case);
  if (fixture.outcome !== "admitted") return O.none();
  const decomposition = O.getOrThrow(A.get(result.decompositions, dependent ? 1 : 0));
  assert.strictEqual(decomposition.status, "decomposed", fixture.case);
  if (decomposition.status !== "decomposed") return O.none();
  return O.some({ tree: decomposition.tree, source: O.getOrThrow(A.head(result.plans)).sourcePlan });
});
const runControl = Effect.fn("SourceProjectionTest.runControl")(function* (name: string) {
  const correction = yield* S.decodeEffect(correctionContract)(correctionInput);
  assert.strictEqual(correction.originalSha256, "85610a4b583e904fa0d108bd9582a45dbc48df5b3ccc3a4904b5af82ceff9b24");
  // Actual-byte pin is independently checked through native server FS/Digest.
  const cases = yield* S.decodeUnknownEffect(expected)(contracts);
  for (const fixture of A.filter(cases.fixtures, (candidate) => candidate.case === name)) {
    const projection = yield* projectFixture(fixture);
    if (O.isNone(projection)) continue;
    const { tree, source } = projection.value;
    assertNominals(fixture, correction, source);
    assertSpecialFrameContracts(fixture, source);
    assertAttachedFrames(fixture, source);
    assertElements(fixture, tree);
    assertParents(fixture, tree);
    assertFunctionalPartitions(fixture, tree);
  }
});
describe("actual enhanced source topology projection", () => {
  for (const control of contracts.fixtures) it.effect(control.case, () => runControl(control.case));
});

const sourceInputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "source-projection-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const governingPlanOf = Effect.fn("SourceProjectionTest.governingPlanOf")(function* (text: string) {
  const prepared = yield* prepareClaimInspection(sourceInputOf(text));
  const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});
describe("qualified governing separator ownership", () => {
  it.effect("excludes one leading governing colon from root and nominal children", () =>
    Effect.gen(function* () {
      const plan = yield* governingPlanOf("A system comprising: a plate; a cover.");
      assert.deepStrictEqual(
        A.map(plan.elements, (element) => [element.extent.quote, element.kind, O.getOrNull(element.parent)]),
        [
          ["A system", "preamble-subject", null],
          ["a plate", "limitation", 1],
          ["a cover", "limitation", 1],
        ]
      );
      assert.deepStrictEqual(
        A.map(plan.nominals, (nominal) => [nominal.core.quote, nominal.head.quote, nominal.outer.quote]),
        [
          ["A system", "system", "A system"],
          ["a plate", "plate", "a plate"],
          ["a cover", "cover", "a cover"],
        ]
      );
    })
  );
  it.effect("keeps an incidental quoted colon inside its complete nominal", () =>
    Effect.gen(function* () {
      const plan = yield* governingPlanOf('A system comprising a "comprising: plate" sensor.');
      assert.deepStrictEqual(
        A.map(plan.elements, (element) => element.extent.quote),
        ["A system", 'a "comprising: plate" sensor']
      );
      assert.strictEqual(O.getOrThrow(A.last(plan.nominals)).core.quote, 'a "comprising: plate" sensor');
    })
  );
  it.effect("declines a second unexplained colon without donating a candidate plan", () =>
    Effect.gen(function* () {
      const text = "A system comprising:: a plate.";
      const input = sourceInputOf(text);
      const prepared = yield* prepareClaimInspection(input);
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
      const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
    })
  );
});
describe("source admission barriers and preserved uncertainty", () => {
  it.effect("uses the qualified governing interval rather than an incidental quoted transition", () =>
    Effect.gen(function* () {
      // Qualification is supplied explicitly; raw normalizer recovery is separate.
      for (const { preamble, body } of [
        { preamble: 'A "comprising sensors" system', body: "a sensor." },
        { preamble: "A system", body: 'a "comprising sensors" label; a sensor.' },
      ]) {
        const claimText = `${preamble} comprising ${body}`;
        const claim = PatentClaim.cases.independent.make({
          claimNumber: 1,
          claimText,
          preamble,
          transition: "comprising",
          body,
        });
        const plan = O.getOrThrow(compileClaimClauseRoles(claim, evidenceFor(claimText)));
        const operators = A.filter(plan.predicates, (p) => p.anchor.quote === "comprising");
        assert.strictEqual(operators.length, 1);
        assert.strictEqual(O.getOrThrow(A.head(operators)).anchor.startChar, preamble.length + 1);
        assert.strictEqual(O.getOrThrow(A.head(plan.nominals)).anchor.quote, preamble);
      }
    })
  );
  it.effect("distinguishes plural finite subjects and proved PP nominal heads from unproved verb promotion", () =>
    Effect.gen(function* () {
      for (const { text, admitted } of [
        { text: "A system comprising the units operate a sensor.", admitted: true },
        { text: "A system comprising the units operates with a signal.", admitted: false },
      ]) {
        const prepared = yield* prepareClaimInspection(sourceInputOf(text));
        const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
        assert.strictEqual(result.plans.length, admitted ? 1 : 0);
      }
      const text = "A system comprising a plate; the plate is arranged on the side surfaces of the plate.";
      const prepared = yield* prepareClaimInspection(sourceInputOf(text));
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(result.plans.length, 1);
      const plan = O.getOrThrow(A.head(result.plans));
      assert.isTrue(
        A.some(plan.plan.nominals, (n) => n.anchor.quote === "the side surfaces" && n.head.quote === "side surfaces")
      );
      assert.isFalse(A.some(plan.plan.predicates, (p) => p.anchor.quote === "surfaces"));
    })
  );
  it.effect("keeps contradictory relative agreement adverse through multiple licensed adjuncts", () =>
    Effect.gen(function* () {
      for (const [verb, role] of [
        ["detect", "generic-plural"],
        ["detects", "unknown"],
      ]) {
        const text = `A system comprising sensors that reliably consistently ${verb} a signal; the sensors.`;
        const prepared = yield* prepareClaimInspection(sourceInputOf(text));
        const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
        assert.strictEqual(result.plans.length, 1);
        const nominal = O.getOrThrow(
          A.findFirst(O.getOrThrow(A.head(result.plans)).plan.nominals, (n) => n.anchor.quote === "sensors")
        );
        assert.strictEqual(nominal.role, role);
        const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
        const row = O.getOrThrow(A.head(report.records));
        assert.strictEqual(row.status, verb === "detect" ? "complete" : "partial");
      }
    })
  );
});

it.effect("keeps proved semicolon siblings and declines an orphan auxiliary without donating candidate facts", () =>
  Effect.gen(function* () {
    for (const text of [
      "A system comprising a plate; a cover.",
      "A system comprising the unit detects a signal; the processor stores a value.",
    ]) {
      const prepared = yield* prepareClaimInspection(sourceInputOf(text));
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(result.plans.length, 1);
      const decomposition = O.getOrThrow(A.head(result.decompositions));
      assert.strictEqual(decomposition.status, "decomposed");
      if (decomposition.status === "decomposed") assert.strictEqual(decomposition.tree.elements.length, 3);
    }
    for (const continuation of ["stores the signal", "is attached to the unit"]) {
      const text = `A system comprising a unit that detects a signal; and ${continuation}.`;
      const input = sourceInputOf(text);
      const prepared = yield* prepareClaimInspection(input);
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
      const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
      assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
    }
  })
);
it.effect("binds excluded explicit labels to their actual root and nested child ordinals", () =>
  Effect.gen(function* () {
    const text = "A system comprising: (a) a plate; (b) a cover.";
    const prepared = yield* prepareClaimInspection(sourceInputOf(text));
    const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text)]);
    assert.strictEqual(result.plans.length, 1);
    const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
    const declaration = O.getOrThrow(A.head(source.declarations));
    assert.strictEqual(declaration.owner, 1);
    assert.deepStrictEqual(
      A.map(declaration.items, (item) => item.label.quote),
      ["(a)", "(b)"]
    );
    assert.deepStrictEqual(
      A.map(
        declaration.items,
        (item) => O.getOrThrow(A.findFirst(source.elements, (e) => e.ordinal === item.child)).extent.quote
      ),
      ["a plate", "a cover"]
    );
  })
);
