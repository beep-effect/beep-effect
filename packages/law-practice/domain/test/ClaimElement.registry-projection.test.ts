import {
  ClaimInputCollection,
  ClaimInputDecomposition,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
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
import * as Record from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import contracts from "./fixtures/claim-element/source-registry-plans.json" with { type: "json" };
import type { ClaimElementTree, ClaimRoleDecomposition } from "@beep/law-practice-domain/values/ClaimElement";

const sourceKey = "source-registry-control";
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["comprising", ["VERB", "comprise"]],
  ["detects", ["VERB", "detect"]],
  ["wherein", ["SCONJ", "wherein"]],
  ["of", ["ADP", "of"]],
  ["or", ["CCONJ", "or"]],
  ["jaws", ["NOUN", "jaw"]]
);
const recordOf = (text: string, ordinal: number, claimNumber = ordinal) =>
  ClaimInputRecord.cases.text.make({
    sourceOrdinal: ordinal,
    numberText: O.some(`${claimNumber}`),
    sourceText: text,
    canonicalText: text,
  });
const inputOf = (texts: A.NonEmptyReadonlyArray<string>) =>
  ClaimInputCollection.make({ sourceKey, records: A.map(texts, (text, index) => recordOf(text, index + 1)) });
const fixtureFor = (name: string) =>
  O.getOrThrow(A.findFirst(contracts.fixtures, (candidate) => candidate.case === name));
const fixtureInput = (name: string) => {
  const fixture = fixtureFor(name);
  const texts = A.map(fixture.sourceRecords, (record) => record.claimText);
  return inputOf(A.prepend(A.drop(texts, 1), O.getOrThrow(A.head(texts))));
};
const evidenceFor = (qualifiedText: string, sourceOrdinal: number) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey,
    sourceOrdinal,
    qualifiedText,
    provider: "explicit-registry-control",
    assetDigest: "test-only",
    tokens: A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(qualifiedText)), (match) => {
      const word = Str.toLowerCase(match[0]);
      const [pos, lemma] = O.getOrElse(HashMap.get(lexical, word), () => [
        O.isSome(Str.match(/^\d+$/u)(word)) ? "NUM" : O.isSome(Str.match(/^[\p{L}\p{N}]/u)(word)) ? "NOUN" : "PUNCT",
        word,
      ]);
      const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
      return ClaimLexicalToken.make({
        anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
        pos,
        lemma: O.some(lemma),
      });
    }),
  });
const prepare = Effect.fn("RegistryProjectionTest.prepare")(function* (input: ClaimInputCollection) {
  const prepared = yield* prepareClaimInspection(input);
  const evidence = A.flatMap(prepared.qualifications, (qualification) =>
    qualification.status === "context-ready"
      ? [evidenceFor(qualification.claim.claimText, qualification.record.sourceOrdinal)]
      : []
  );
  const result = yield* decomposePreparedClaimRoles(prepared, evidence);
  return { prepared, evidence, result };
});
const treeAt = (result: ClaimRoleDecomposition, claimNumber: number): ClaimElementTree =>
  O.getOrThrow(
    A.findFirst(
      A.filter(result.decompositions, ClaimInputDecomposition.guards.decomposed),
      (row) => row.tree.claimNumber === claimNumber
    )
  ).tree;
const acceptedNumbers = (result: ClaimRoleDecomposition) => A.map(result.plans, (plan) => plan.claimNumber);
const endpointIndex = S.Record(S.String, S.Struct({ claimNumber: S.Int, kind: S.String, anchor: TextAnchor }));
const assertReviewedEndpointIdentities = Effect.fn("RegistryProjectionTest.assertReviewedEndpointIdentities")(
  function* (name: string, result: ClaimRoleDecomposition) {
    const decoded = yield* S.decodeEffect(endpointIndex)(fixtureFor(name).canonicalEndpointIdentityIndex);
    for (const expected of Record.values(decoded)) {
      assert.isTrue(
        A.some(
          treeAt(result, expected.claimNumber).elements,
          (element) =>
            element.kind === expected.kind &&
            element.anchor.startChar === expected.anchor.startChar &&
            element.anchor.endChar === expected.anchor.endChar &&
            element.anchor.quote === expected.anchor.quote
        ),
        `${name}: reviewed source endpoint ${expected.claimNumber}/${expected.anchor.startChar}`
      );
    }
  }
);
const assertForeignEndpointsExist = (child: ClaimElementTree, ancestor: ClaimElementTree): void => {
  const edges = A.filter(
    child.edges,
    (edge) => edge.kind === "antecedent" && Str.startsWith(`${ancestor.claimNumber}.`)(edge.introducing.path)
  );
  assert.isTrue(A.isReadonlyArrayNonEmpty(edges));
  for (const edge of edges) {
    if (edge.kind !== "antecedent") continue;
    const owner = O.getOrThrow(A.findFirst(ancestor.elements, (element) => element.path === edge.introducing.path));
    assert.isTrue(A.some(owner.terms, (term) => S.toEquivalence(TextAnchor)(term.anchor, edge.introducing.anchor)));
  }
};

describe("canonical source projection across dependency routes", () => {
  it.effect("keeps an admitted current claim alongside its canonical declined parent", () =>
    Effect.gen(function* () {
      const input = fixtureInput("supported-current-declined-parent");
      const { prepared, evidence, result } = yield* prepare(input);
      assert.deepStrictEqual(acceptedNumbers(result), [2]);
      yield* assertReviewedEndpointIdentities("supported-current-declined-parent", result);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(A.head(result.decompositions), A.head(legacy));
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(O.getOrThrow(A.get(report.records, 1)).status, "partial");
      const reversedResult = yield* decomposePreparedClaimRoles(prepared, A.reverse(evidence));
      assert.deepStrictEqual(reversedResult, result);
    })
  );
  it.effect("does not roll back an admitted parent when the current source declines", () =>
    Effect.gen(function* () {
      const input = fixtureInput("declined-current-supported-parent");
      const { prepared, evidence, result } = yield* prepare(input);
      assert.deepStrictEqual(acceptedNumbers(result), [1]);
      yield* assertReviewedEndpointIdentities("declined-current-supported-parent", result);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(A.get(result.decompositions, 1), A.get(legacy, 1));
      const alone = yield* prepare(inputOf(["A system comprising a plate."]));
      assert.deepStrictEqual(treeAt(result, 1), treeAt(alone.result, 1));
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(O.getOrThrow(A.get(report.records, 1)).status, "partial");
    })
  );
  it.effect("reuses a shared ancestor without donating one descendant's failed projection", () =>
    Effect.gen(function* () {
      const { prepared, evidence, result } = yield* prepare(fixtureInput("shared-ancestor-stable"));
      assert.deepStrictEqual(acceptedNumbers(result), [1, 3]);
      yield* assertReviewedEndpointIdentities("shared-ancestor-stable", result);
      const alone = yield* prepare(inputOf(["A system comprising a plate."]));
      assert.deepStrictEqual(treeAt(result, 1), treeAt(alone.result, 1));
      assertForeignEndpointsExist(treeAt(result, 3), treeAt(result, 1));
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(O.getOrThrow(A.get(report.records, 1)).status, "partial");
      assert.strictEqual(O.getOrThrow(A.get(report.records, 2)).status, "complete");
      const repeatedResult = yield* decomposePreparedClaimRoles(prepared, evidence);
      assert.deepStrictEqual(repeatedResult, result);
    })
  );
  it.effect("does not borrow an introduction from only one alternative route", () =>
    Effect.gen(function* () {
      const { prepared, evidence, result } = yield* prepare(fixtureInput("alternative-route-failure"));
      assert.deepStrictEqual(acceptedNumbers(result), [1, 3]);
      yield* assertReviewedEndpointIdentities("alternative-route-failure", result);
      const child = treeAt(result, 3);
      assert.isFalse(
        A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.introducing.anchor.quote === "a plate")
      );
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(O.getOrThrow(A.get(report.records, 2)).status, "partial");
      const reversedReport = yield* inspectPreparedClaimRoles(prepared, A.reverse(evidence));
      assert.deepStrictEqual(reversedReport, report);
    })
  );
  it.effect("retains missing-source positions and an absent parent without fabricating endpoints", () =>
    Effect.gen(function* () {
      const fixture = O.getOrThrow(A.findFirst(contracts.fixtures, (row) => row.case === "absent-parent"));
      const source = O.getOrThrow(A.head(fixture.sourceRecords));
      const input = ClaimInputCollection.make({
        sourceKey,
        records: [
          ClaimInputRecord.cases.unavailable.make({
            sourceOrdinal: 1,
            numberText: O.none(),
            sourceText: "<unavailable-source-control/>",
            reason: "invalid-text",
          }),
          recordOf(source.claimText, source.sourceOrdinal, source.claimNumber),
        ],
      });
      const { prepared, evidence, result } = yield* prepare(input);
      assert.deepStrictEqual(result.plans, []);
      assert.isTrue(A.every(result.decompositions, (row) => row.status !== "decomposed"));
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(report.indexStatus, "incomplete");
      assert.isTrue(A.every(report.records, (row) => row.status === "unchecked"));
      assert.deepStrictEqual(report.input, input);
    })
  );
  it.effect("declines a source atomically without spending another source's allowance", () =>
    Effect.gen(function* () {
      const body = A.join(
        A.map(A.range(1, 200), (number) => `a component${number}`),
        "; "
      );
      const input = inputOf([`A system comprising ${body}.`, "A system comprising a plate."]);
      const { prepared, evidence, result } = yield* prepare(input);
      assert.deepStrictEqual(acceptedNumbers(result), [2]);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(A.head(result.decompositions), A.head(legacy));
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
      assert.strictEqual(O.getOrThrow(A.get(report.records, 1)).status, "complete");
      const reversedResult = yield* decomposePreparedClaimRoles(prepared, A.reverse(evidence));
      assert.deepStrictEqual(reversedResult, result);
    })
  );
  it.effect("keeps source identities fixed through route-work exhaustion and a fresh call", () =>
    Effect.gen(function* () {
      const texts = A.prepend(
        A.map(
          A.range(2, 64),
          (number) =>
            `The system of claim ${number - 1} wherein ${number === 64 ? A.join(A.replicate("the sensor1", 100), "; ") : `a sensor${number}`}.`
        ),
        "A system comprising a sensor1."
      );
      const input = inputOf(texts);
      const { prepared, evidence, result } = yield* prepare(input);
      const parent = treeAt(result, 1);
      const report = yield* inspectPreparedClaimRoles(prepared, evidence);
      assert.isTrue(
        A.some(
          report.records,
          (row) => row.status !== "unchecked" && A.some(row.findings, (finding) => finding.rule === "chain-work-limit")
        )
      );
      assert.strictEqual(O.getOrThrow(A.last(report.records)).status, "partial");
      const repeatedResult = yield* decomposePreparedClaimRoles(prepared, evidence);
      assert.deepStrictEqual(repeatedResult, result);
      const fresh = yield* prepare(inputOf(["A system comprising a sensor1."]));
      assert.deepStrictEqual(treeAt(fresh.result, 1), parent);
      const freshReport = yield* inspectPreparedClaimRoles(fresh.prepared, fresh.evidence);
      assert.strictEqual(O.getOrThrow(A.head(freshReport.records)).status, "complete");
    })
  );
  it.effect("permutes evidence deterministically while rejecting reordered public source positions", () =>
    Effect.gen(function* () {
      const input = fixtureInput("shared-ancestor-stable");
      const { prepared, evidence, result } = yield* prepare(input);
      const reversedResult = yield* decomposePreparedClaimRoles(prepared, A.reverse(evidence));
      assert.deepStrictEqual(reversedResult, result);
      const failure = yield* Effect.flip(
        S.decodeUnknownEffect(S.toType(ClaimInputCollection))({ sourceKey, records: A.reverse(input.records) })
      );
      assert.strictEqual(failure._tag, "SchemaError");
    })
  );
});
