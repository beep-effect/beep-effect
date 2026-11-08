import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import fixtures from "./fixtures/claim-element/finite-clause-private-routes.json" with { type: "json" };
import type {
  AntecedentFinding,
  ClaimInputInspectionReport,
  ClaimRoleDecomposition,
} from "@beep/law-practice-domain/values/ClaimElement";

const source = S.Struct({
  sourceOrdinal: S.Int,
  source: S.NonEmptyString,
  references: S.Array(S.Int),
  tokens: S.Array(S.Struct({ anchor: TextAnchor, pos: S.NonEmptyString, lemma: S.NonEmptyString })),
});
const control = S.Struct({
  case: S.NonEmptyString,
  sourceContract: S.Struct({
    privateBasis: S.Boolean.pipe(S.optionalKey),
    privateBasisByRoute: S.Record(S.String, S.Boolean).pipe(S.optionalKey),
    positiveAntecedent: S.Boolean.pipe(S.optionalKey),
    aliasEligible: S.Boolean.pipe(S.optionalKey),
  }),
  sources: S.NonEmptyArray(source),
  reference: S.Struct({ sourceOrdinal: S.Int, anchor: TextAnchor }),
});
type RouteControl = typeof control.Type;
type InspectionRecord = ClaimInputInspectionReport["records"][number];
const assertRouteCompilation = (row: RouteControl, result: ClaimRoleDecomposition, failed: boolean): void => {
  if (failed)
    assert.strictEqual(
      A.some(result.plans, (p) => p.claimNumber === 1),
      false
    );
  else assert.strictEqual(result.plans.length, row.sources.length);
  const privateCount = A.reduce(result.plans, 0, (sum, plan) => sum + plan.plan.privateCandidates.length);
  if (failed) assert.strictEqual(privateCount, 0);
  else assert.isAtLeast(privateCount, 1);
};
const assertRoutePossibleBasis = (
  row: RouteControl,
  target: Exclude<InspectionRecord, { readonly status: "unchecked" }>,
  findings: ReadonlyArray<AntecedentFinding>,
  failed: boolean
): void => {
  if (row.sourceContract.privateBasis === true) {
    assert.strictEqual(target.status, "partial");
    assert.strictEqual(
      A.some(findings, (f) => f.rule === "source-role-unresolved"),
      true
    );
    assert.strictEqual(
      A.some(findings, (f) => f.kind === "missing-antecedent" || f.kind === "antecedent-outside-chain"),
      false
    );
  }
  if (row.sourceContract.privateBasis === false && !failed)
    assert.strictEqual(
      A.some(findings, (f) => f.rule === "source-role-unresolved"),
      false
    );
  if (row.sourceContract.positiveAntecedent === false && target.decomposition.status === "decomposed")
    assert.strictEqual(
      A.some(
        target.decomposition.tree.edges,
        (edge) => edge.kind === "antecedent" && edge.referring.anchor.startChar === row.reference.anchor.startChar
      ),
      false
    );
};
const assertRouteUncertainty = (row: RouteControl, findings: ReadonlyArray<AntecedentFinding>): void => {
  if (row.sourceContract.privateBasisByRoute !== undefined) {
    assert.strictEqual(
      A.some(findings, (f) => f.rule === "source-role-unresolved"),
      true
    );
    for (const [route, uncertain] of R.toEntries(row.sourceContract.privateBasisByRoute)) {
      const chain = A.map(Str.split("->")(route), Number);
      const confident = A.filter(
        findings,
        (finding) =>
          finding.kind !== "pattern-not-covered" &&
          finding.chain.length === chain.length &&
          A.every(finding.chain, (number, index) => O.contains(A.get(chain, index), number))
      );
      assert.strictEqual(confident.length, uncertain ? 0 : 1);
    }
  }
};
const assertPrivateNotPublic = (result: ClaimRoleDecomposition): void => {
  for (const bound of result.plans)
    for (const candidate of bound.plan.privateCandidates)
      assert.strictEqual(
        A.some(
          bound.sourcePlan.nominals,
          (n) => n.core.startChar === candidate.core.startChar && n.core.endChar === candidate.core.endChar
        ),
        false
      );
};
const assertRouteReference = (row: RouteControl, target: InspectionRecord, failed: boolean): void => {
  assert.notStrictEqual(target.status, "unchecked");
  if (target.status === "unchecked") return;
  const findings = A.filter(
    target.findings,
    (f) =>
      f.referring.anchor.startChar === row.reference.anchor.startChar &&
      f.referring.anchor.endChar === row.reference.anchor.endChar
  );
  assertRoutePossibleBasis(row, target, findings, failed);
  assertRouteUncertainty(row, findings);
  if (failed) assert.strictEqual(target.status, "partial");
};
const run = Effect.fn("FinitePrivateRoutes.control")(function* (raw: unknown) {
  const row = yield* S.decodeUnknownEffect(control)(raw);
  const input = ClaimInputCollection.make({
    sourceKey: "finite-private-route-source-only",
    records: A.map(row.sources, (source) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: source.sourceOrdinal,
        numberText: O.some(`${source.sourceOrdinal}`),
        sourceText: source.source,
        canonicalText: source.source,
      })
    ),
  });
  const prepared = yield* prepareClaimInspection(input);
  const evidence = A.map(row.sources, (source) =>
    ClaimLexicalEvidence.cases.aligned.make({
      sourceKey: input.sourceKey,
      sourceOrdinal: source.sourceOrdinal,
      qualifiedText: source.source,
      provider: "injected-route-witness-no-model",
      assetDigest: "synthetic-no-assets",
      tokens: A.map(source.tokens, (token) => ClaimLexicalToken.make({ ...token, lemma: O.some(token.lemma) })),
    })
  );
  const failed = row.case === "failed-source-atomicity";
  const actualEvidence = failed
    ? A.map(evidence, (e, index) =>
        index === 0
          ? ClaimLexicalEvidence.cases.unavailable.make({
              sourceKey: e.sourceKey,
              sourceOrdinal: e.sourceOrdinal,
              qualifiedText: e.qualifiedText,
              reason: "tokenization-failed",
            })
          : e
      )
    : evidence;
  const result = yield* decomposePreparedClaimRoles(prepared, actualEvidence);
  assertRouteCompilation(row, result, failed);
  const report = yield* inspectPreparedClaimRoles(prepared, actualEvidence);
  const target = O.getOrThrow(A.get(report.records, row.reference.sourceOrdinal - 1));
  assertRouteReference(row, target, failed);
  // A source-private value/branch never appears as an introduced public core.
  assertPrivateNotPublic(result);
  return result;
});

describe("private possible basis follows actual source order and natural dependency routes", () => {
  for (const row of fixtures.cases) it.effect(row.case, () => run(row));
});

const assertDecompositionSourceAnchors = (
  result: ClaimRoleDecomposition,
  sources: ReadonlyArray<typeof source.Type>
): void => {
  for (const [index, decomposition] of result.decompositions.entries()) {
    if (decomposition.status !== "decomposed") continue;
    const source = O.getOrThrow(A.get(sources, index)).source;
    for (const element of decomposition.tree.elements)
      for (const term of element.terms) {
        assert.strictEqual(term.anchor.quote, Str.slice(term.anchor.startChar, term.anchor.endChar)(source));
      }
  }
};
it.effect("a same-head ordinary donor remains eligible beside an unrelated opaque source", () =>
  Effect.gen(function* () {
    const fixture = A.findFirst(
      fixtures.cases,
      (row) => row.case === "whole-group-reference-unknown-not-introduction"
    ).pipe(O.getOrThrow);
    const original = yield* S.decodeUnknownEffect(control)(fixture);
    const origin = O.getOrThrow(A.head(original.sources));
    const dependent = O.getOrThrow(A.get(original.sources, 1));
    const rebuild = (sourceOrdinal: number, text: string, selected: ReadonlyArray<(typeof origin.tokens)[number]>) => {
      let cursor = 0;
      const tokens = A.map(selected, (token) => {
        const quote = token.anchor.quote;
        const startChar = O.getOrThrow(Str.indexOf(quote)(Str.slice(cursor)(text))) + cursor;
        assert.isAtLeast(startChar, cursor);
        cursor = startChar + quote.length;
        return { ...token, anchor: TextAnchor.make({ startChar, endChar: cursor, quote }) };
      });
      return { sourceOrdinal, source: text, tokens, references: sourceOrdinal === 3 ? [2] : [] };
    };
    const singular = (tokens: typeof origin.tokens) =>
      A.map(tokens, (token) => {
        const quote =
          token.anchor.quote === "sensors" ? "sensor" : token.anchor.quote === "valves" ? "valve" : token.anchor.quote;
        return { ...token, anchor: { ...token.anchor, quote } };
      });
    const singularText = (text: string) => Str.replaceAll("valves", "valve")(Str.replaceAll("sensors", "sensor")(text));
    const opaque = rebuild(1, singularText(origin.source), singular(origin.tokens));
    const ordinaryTokens = singular(A.filter(origin.tokens, (_token, index) => index < 4 || index >= 8));
    const ordinary = rebuild(2, "A system comprising a sensor or valve.", ordinaryTokens);
    const referringTokens = A.map(singular(dependent.tokens), (token) =>
      token.anchor.quote === "1" ? { ...token, anchor: { ...token.anchor, quote: "2" }, lemma: "2" } : token
    );
    const referring = rebuild(3, Str.replace("claim 1", "claim 2")(singularText(dependent.source)), referringTokens);
    const result = yield* run({
      ...original,
      case: "source-specific-nonopaque-donor",
      sourceContract: {},
      sources: [opaque, ordinary, referring],
      reference: { ...original.reference, sourceOrdinal: 3 },
    });
    assertDecompositionSourceAnchors(result, [opaque, ordinary, referring]);
    const target = O.getOrThrow(A.get(result.decompositions, 2));
    assert.strictEqual(target.status, "decomposed");
    if (target.status !== "decomposed") return;
    const edge = A.findFirst(
      target.tree.edges,
      (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "said sensor or valve"
    );
    assert.strictEqual(O.isSome(edge), true);
    if (O.isSome(edge) && edge.value.kind === "antecedent") assert.strictEqual(edge.value.introducing.path, "2.a");
  })
);
