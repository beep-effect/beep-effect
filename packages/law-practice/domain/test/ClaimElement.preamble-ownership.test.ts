import { projectClaimRoleTerms, validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimAttachedNominal,
  ClaimClauseRolePlan,
  ClaimClauseSpan,
  ClaimFrameAttachment,
  ClaimInputCollection,
  ClaimInputQualification,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimNominalSpan,
  ClaimOwnedTermRegion,
  ClaimPlannedElement,
  ClaimSourceElementPlan,
  ClaimSourceExclusion,
  ClaimSourceFrame,
  ClaimTermOwnerCertificate,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  PreparedClaimInspection,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import fixtures from "./fixtures/claim-element/preamble-ownership-plans.json" with { type: "json" };
import routeFixtures from "./fixtures/claim-element/preamble-ownership-routes.json" with { type: "json" };

const nominal = S.Struct({
  id: S.String,
  core: TextAnchor,
  head: TextAnchor,
  outer: TextAnchor,
  determiner: S.Literals(["a", "an", "the", "said", "bare"]),
  role: S.Literals(["unknown", "explicit-name"]),
  elementOwner: S.String,
});
const region = S.Struct({
  core: S.String,
  extent: TextAnchor,
  certificate: S.Struct({
    kind: S.Literals(["existing-element-nominal", "preamble-clause-nominal"]),
    sourceClause: S.OptionFromOptionalKey(S.String),
    clauseNominal: S.OptionFromOptionalKey(TextAnchor),
    preamble: S.OptionFromOptionalKey(TextAnchor),
    lexicalRegion: S.OptionFromOptionalKey(TextAnchor),
  }),
});
const element = S.Struct({
  id: S.String,
  parent: S.NullOr(S.String),
  extent: TextAnchor,
  lexicalHeader: TextAnchor,
  kind: S.Literals(["preamble-subject", "functional-relation"]),
  nominals: S.Array(S.String),
  ownedTermRegions: S.Array(region),
});
const frame = S.Struct({
  id: S.String,
  parent: S.NullOr(S.String),
  publicOwner: S.String,
  extent: TextAnchor,
  lexicalHeader: TextAnchor,
  attachment: ClaimFrameAttachment,
  introducer: S.NullOr(TextAnchor),
  predicates: S.Array(TextAnchor),
  nominals: S.Array(S.String),
  subject: S.NullOr(S.String),
  arguments: S.Array(
    S.Struct({
      nominal: S.String,
      role: S.Literals(["unknown", "subject", "object", "nominal-modifier"]),
      predicate: S.NullOr(TextAnchor),
      ownerNominal: S.NullOr(S.String),
    })
  ),
});
const plan = S.Struct({ nominals: S.Array(nominal), elements: S.Array(element), frames: S.Array(frame) });
const fixture = S.Struct({
  case: S.String,
  qualifiedText: S.String,
  outcome: S.String,
  negativeMutation: S.OptionFromOptionalKey(S.String),
  inputNominals: S.Array(nominal),
  lexicalEvidence: S.Struct({ tokens: S.Array(S.Struct({ anchor: TextAnchor, pos: S.String, lemma: S.String })) }),
  inputClauses: S.Array(S.Struct({ id: S.String, extent: TextAnchor, nominals: S.Array(S.String) })),
  sourceExclusions: S.Array(S.Struct({ extent: TextAnchor, claimReferences: S.Array(S.Int) })),
  expected: S.OptionFromOptionalKey(S.Union([plan, S.Struct({ sourcePlan: S.Null })])),
  rejectedCandidatePlan: S.OptionFromOptionalKey(plan),
});
type Fixture = typeof fixture.Type;
const coreOf = (values: ReadonlyArray<typeof nominal.Type>, id: string) =>
  O.getOrThrow(A.findFirst(values, (n) => n.id === id));
const ordinalOf = <Value extends { readonly id: string }>(values: ReadonlyArray<Value>, id: string): number =>
  O.getOrThrow(A.findFirstIndex(values, (value) => value.id === id)) + 1;
const nominalOf = (value: typeof nominal.Type) =>
  ClaimNominalSpan.make({ anchor: value.core, head: value.head, determiner: value.determiner, role: value.role });
const certificateFor = (e: typeof element.Type, value: typeof region.Type, owner: number, core: number, f: Fixture) =>
  value.certificate.kind === "existing-element-nominal"
    ? ClaimTermOwnerCertificate.cases["existing-element-nominal"].make({
        element: owner,
        roleNominal: core,
        production: e.id === "root" ? "preamble" : "single-restriction",
        lexicalRegion: O.getOrThrow(value.certificate.lexicalRegion),
      })
    : ClaimTermOwnerCertificate.cases["preamble-clause-nominal"].make({
        element: owner,
        roleNominal: core,
        sourceClause: ordinalOf(f.inputClauses, O.getOrThrow(value.certificate.sourceClause)),
        clauseNominal: O.getOrThrow(value.certificate.clauseNominal),
        preamble: O.getOrThrow(value.certificate.preamble),
      });
const buildPlan = (f: Fixture): ClaimSourceElementPlan => {
  const p = O.getOrElse(f.rejectedCandidatePlan, () => O.getOrThrow(O.filter(f.expected, S.is(plan))));
  const ns = A.sort(p.nominals, (a: typeof nominal.Type, b: typeof nominal.Type) =>
    a.core.startChar < b.core.startChar ? -1 : a.core.startChar > b.core.startChar ? 1 : 0
  );
  const elements = A.map(p.elements, (e, i) =>
    ClaimPlannedElement.make({
      ordinal: i + 1,
      parent: O.map(O.fromNullishOr(e.parent), (id) => ordinalOf(p.elements, id)),
      extent: e.extent,
      lexicalHeader: e.lexicalHeader,
      kind: e.kind,
      grouping: e.id === "root" ? "preamble" : "single-restriction",
      nominals: A.map(e.nominals, (id) => nominalOf(coreOf(ns, id))),
      ownedTermRegions: A.map(e.ownedTermRegions, (r, j) => {
        const core = ordinalOf(ns, r.core);
        return ClaimOwnedTermRegion.make({
          ordinal: j + 1,
          ownerElement: i + 1,
          core,
          extent: r.extent,
          certificate: certificateFor(e, r, i + 1, core, f),
        });
      }),
    })
  );
  const frames = A.map(p.frames, (v, i) =>
    ClaimSourceFrame.make({
      ordinal: i + 1,
      publicOwner: ordinalOf(p.elements, v.publicOwner),
      extent: v.extent,
      lexicalHeader: v.lexicalHeader,
      parent: O.map(O.fromNullishOr(v.parent), (id) => ordinalOf(p.frames, id)),
      attachment: v.attachment,
      introducer: O.fromNullishOr(v.introducer),
      predicates: v.predicates,
      nominals: A.map(v.nominals, (id) => coreOf(ns, id).core),
      subject: O.map(O.fromNullishOr(v.subject), (id) => coreOf(ns, id).core),
      sharedSubject: O.none(),
      coordination: O.none(),
      arguments: A.map(v.arguments, (a) => ({
        nominal: coreOf(ns, a.nominal).core,
        role: a.role,
        predicate: O.fromNullishOr(a.predicate),
        ownerNominal: O.map(O.fromNullishOr(a.ownerNominal), (id) => coreOf(ns, id).core),
      })),
    })
  );
  const sourceExclusions = A.appendAll(
    A.map(f.sourceExclusions, (x) => ClaimSourceExclusion.cases["dependency-citation"].make(x)),
    A.map(A.fromIterable(Str.matchAll(/"[^"\n]*"/gu)(f.qualifiedText)), (m) => {
      const startChar = O.getOrThrow(O.fromUndefinedOr(m.index));
      return ClaimSourceExclusion.cases["quoted-protection"].make({
        extent: TextAnchor.make({ startChar, endChar: startChar + m[0].length, quote: m[0] }),
      });
    })
  );
  return ClaimSourceElementPlan.make({
    qualifiedText: f.qualifiedText,
    remainingWork: 262_144,
    frames,
    nominals: A.map(ns, (n) =>
      ClaimAttachedNominal.make({ core: n.core, head: n.head, outer: n.outer, nominal: nominalOf(n) })
    ),
    elements,
    sourceExclusions,
    declarations: [],
    declarationPlans: [],
    proofs: [],
    roles: ClaimClauseRolePlan.make({
      qualifiedText: f.qualifiedText,
      remainingWork: 262_144,
      nominals: A.map(f.inputNominals, nominalOf),
      predicates: [],
      proofs: [],
      clauses: A.map(f.inputClauses, (c) => ({
        anchor: c.extent,
        kind: "main",
        introducer: O.none(),
        predicates: [],
        nominals: A.map(c.nominals, (id) => coreOf(f.inputNominals, id).core),
      })),
    }),
  });
};
const runOracle = Effect.fn("PreambleOwnershipTest.oracle")(function* (raw: object) {
  const f = yield* S.decodeUnknownEffect(fixture)(raw);
  if (f.negativeMutation.pipe(O.contains("failed"))) {
    yield* failedSourceAtomicity();
    return;
  }
  const source = buildPlan(f);
  let remaining = source.remainingWork;
  const charge = (amount: number): boolean => {
    remaining -= amount;
    return remaining >= 0;
  };
  const valid = validateClaimSourceOwnership(source, charge);
  if (f.outcome === "declined") {
    if (O.contains(f.negativeMutation, "sibling")) {
      const root = O.getOrThrow(A.head(source.elements));
      const duplicate = ClaimPlannedElement.make({ ...root, ordinal: source.elements.length + 1 });
      assert.strictEqual(
        validateClaimSourceOwnership(
          ClaimSourceElementPlan.make({ ...source, elements: A.append(source.elements, duplicate) }),
          charge
        ),
        false
      );
    } else assert.strictEqual(valid, false, f.case);
    return;
  }
  assert.strictEqual(valid, true, f.case);
  const terms = O.getOrThrow(O.all(A.map(source.elements, (e) => projectClaimRoleTerms(e, charge))));
  assert.deepStrictEqual(
    A.map(terms, (t) => A.map(t, (n) => n.anchor.quote)),
    A.map(source.elements, (e) => A.map(e.nominals, (n) => n.anchor.quote))
  );
  assert.strictEqual(remaining > 0, true);
});

const evidenceOf = (f: Fixture, sourceOrdinal: number) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "preamble-atomic-control",
    sourceOrdinal,
    qualifiedText: f.qualifiedText,
    provider: "explicit-source-oracle",
    assetDigest: "source-control-only",
    tokens: A.map(f.lexicalEvidence.tokens, (token) =>
      ClaimLexicalToken.make({ ...token, lemma: O.some(token.lemma) })
    ),
  });
const failedSourceAtomicity = Effect.fn("PreambleOwnershipTest.failedSourceAtomicity")(function* () {
  const parent = yield* S.decodeUnknownEffect(fixture)(fixtures.fixtures[0]);
  const child = yield* S.decodeUnknownEffect(fixture)(fixtures.fixtures[3]);
  const sources: A.NonEmptyReadonlyArray<Fixture> = [parent, child];
  const input = ClaimInputCollection.make({
    sourceKey: "preamble-atomic-control",
    records: A.map(sources, (f, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: f.qualifiedText,
        canonicalText: f.qualifiedText,
      })
    ),
  });
  const prepared = yield* prepareClaimInspection(input);
  const evidence = [
    ClaimLexicalEvidence.cases.unavailable.make({
      sourceKey: input.sourceKey,
      sourceOrdinal: 1,
      qualifiedText: parent.qualifiedText,
      reason: "tokenization-failed",
    }),
    evidenceOf(child, 2),
  ];
  const result = yield* decomposePreparedClaimRoles(prepared, evidence);
  assert.deepStrictEqual(
    A.map(result.plans, (plan) => plan.claimNumber),
    [2]
  );
  const report = yield* inspectPreparedClaimRoles(prepared, evidence);
  const row = O.getOrThrow(A.get(report.records, 1));
  assert.strictEqual(row.status, "partial");
  if (row.status === "partial")
    assert.deepStrictEqual(
      A.map(row.coverage, (issue) => issue.kind),
      ["policy-uncovered"]
    );
});
const reservation = (available: number) => {
  let remaining = available;
  return (amount: number): boolean => {
    remaining -= amount;
    return remaining >= 0;
  };
};
const invalidFrameOwner = Effect.fn("PreambleOwnershipTest.invalidFrameOwner")(function* () {
  const f = yield* S.decodeUnknownEffect(fixture)(fixtures.fixtures[0]);
  const source = buildPlan(f);
  const root = O.getOrThrow(A.head(source.frames));
  const frames = A.prepend(A.drop(source.frames, 1), ClaimSourceFrame.make({ ...root, publicOwner: 2 }));
  assert.strictEqual(
    validateClaimSourceOwnership(ClaimSourceElementPlan.make({ ...source, frames }), reservation(source.remainingWork)),
    false
  );
});
const invalidInheritedReference = Effect.fn("PreambleOwnershipTest.invalidInheritedReference")(function* () {
  const f = yield* S.decodeUnknownEffect(fixture)(fixtures.fixtures[1]);
  const source = buildPlan(f);
  const relative = O.getOrThrow(A.get(source.frames, 1));
  const body = O.getOrThrow(A.last(source.nominals));
  const frames = A.map(source.frames, (frame) =>
    frame.ordinal === relative.ordinal ? ClaimSourceFrame.make({ ...relative, subject: O.some(body.core) }) : frame
  );
  assert.strictEqual(
    validateClaimSourceOwnership(ClaimSourceElementPlan.make({ ...source, frames }), reservation(source.remainingWork)),
    false
  );
});

const inspectRouteTexts = Effect.fn("PreambleOwnershipTest.inspectRoutes")(function* (
  texts: A.NonEmptyReadonlyArray<string>
) {
  const witnesses = yield* Effect.forEach(A.take(fixtures.fixtures, 4), (raw) => S.decodeUnknownEffect(fixture)(raw));
  const lexical = HashMap.fromIterable(
    A.flatMap(witnesses, (f) => A.map(f.lexicalEvidence.tokens, (t) => [Str.toLowerCase(t.anchor.quote), t] as const))
  );
  const input = ClaimInputCollection.make({
    sourceKey: "preamble-atomic-control",
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
  const evidence = A.map(texts, (text, index) =>
    ClaimLexicalEvidence.cases.aligned.make({
      sourceKey: input.sourceKey,
      sourceOrdinal: index + 1,
      qualifiedText: text,
      provider: "source-control-witnesses",
      assetDigest: "source-only-no-model",
      tokens: A.map(A.fromIterable(Str.matchAll(/[A-Za-z]+|[0-9]+|[^\w\s]/gu)(text)), (m) => {
        const startChar = O.getOrThrow(O.fromUndefinedOr(m.index));
        const word = Str.toLowerCase(m[0]);
        const known = HashMap.get(lexical, word);
        const pos = O.getOrElse(
          O.map(known, (t) => t.pos),
          () =>
            O.isSome(Str.match(/^[0-9]+$/u)(word)) ? "NUM" : O.isSome(Str.match(/^[A-Za-z]/u)(word)) ? "NOUN" : "PUNCT"
        );
        return ClaimLexicalToken.make({
          anchor: TextAnchor.make({ startChar, endChar: startChar + m[0].length, quote: m[0] }),
          pos,
          lemma: O.some(
            O.getOrElse(
              O.map(known, (t) => t.lemma),
              () => word
            )
          ),
        });
      }),
    })
  );
  const result = yield* decomposePreparedClaimRoles(prepared, evidence);
  const report = yield* inspectPreparedClaimRoles(prepared, evidence);
  return { report, result, prepared, evidence };
});
const actualAlternativeRoutes = Effect.fn("PreambleOwnershipTest.actualAlternatives")(function* () {
  const texts = yield* S.decodeUnknownEffect(S.NonEmptyArray(S.String))(
    A.map(routeFixtures.sources, (source) => source.text)
  );
  const { report } = yield* inspectRouteTexts(texts);
  const direct = O.getOrThrow(A.get(report.records, 2));
  assert.strictEqual(direct.decomposition.status, "decomposed");
  if (direct.decomposition.status === "decomposed")
    assert.strictEqual(
      A.some(
        direct.decomposition.tree.edges,
        (edge) =>
          edge.kind === "antecedent" && edge.introducing.path === "1" && edge.introducing.anchor.quote === "a strip"
      ),
      true
    );
  const alternative = O.getOrThrow(A.get(report.records, 4));
  if (alternative.status !== "unchecked")
    assert.strictEqual(
      A.some(
        alternative.findings,
        (finding) =>
          finding.rule === "outside-chain" &&
          finding.referring.anchor.quote === "the strip" &&
          "chain" in finding &&
          A.contains(finding.chain, 2)
      ),
      true
    );
});
const laterBodyIntroduction = Effect.fn("PreambleOwnershipTest.laterBodyIntroduction")(function* () {
  const { report } = yield* inspectRouteTexts(["A cap, wherein the strip is mounted with a strip."]);
  const row = O.getOrThrow(A.head(report.records));
  assert.strictEqual(row.decomposition.status, "decomposed");
  if (row.decomposition.status === "decomposed")
    assert.strictEqual(
      A.some(
        row.decomposition.tree.edges,
        (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the strip"
      ),
      false
    );
});

const citationBarriers = Effect.fn("PreambleOwnershipTest.citationBarriers")(function* () {
  const positive = yield* inspectRouteTexts([
    "A cap, wherein the cap is mounted.",
    "A cover, wherein the cover is mounted.",
    "The cap of claim 1 or claim 2, wherein the cap is mounted.",
  ]);
  assert.deepStrictEqual(
    A.map(positive.result.plans, (plan) => plan.claimNumber),
    [1, 2, 3]
  );
  const group = O.getOrThrow(A.last(positive.result.plans));
  assert.deepStrictEqual(
    A.map(O.getOrThrow(A.head(group.sourcePlan.elements)).nominals, (n) => n.anchor.quote),
    ["The cap"]
  );
  const ordinary = yield* inspectRouteTexts([
    "A cap, wherein the cap is mounted.",
    "The cap of claim 1 with a claim, wherein the claim is mounted.",
  ]);
  // The unchanged normalizer rejects a second ordinary "claim" word. Keep that public outcome adverse.
  assert.strictEqual(O.getOrThrow(A.last(ordinary.prepared.qualifications)).status, "normalization-failed");
  const record = O.getOrThrow(O.filter(A.get(ordinary.prepared.input.records, 1), ClaimInputRecord.guards.text));
  const supplied = PreparedClaimInspection.make({
    input: ordinary.prepared.input,
    qualifications: [
      O.getOrThrow(A.head(ordinary.prepared.qualifications)),
      ClaimInputQualification.cases["context-ready"].make({
        record,
        claim: PatentClaim.cases.dependent.make({
          claimNumber: 2,
          claimText: record.canonicalText,
          preamble: "The cap of claim 1 with a claim,",
          transition: "wherein",
          body: "the claim is mounted.",
          claimReferences: [1],
        }),
      }),
    ],
  });
  const ordinarySource = yield* decomposePreparedClaimRoles(supplied, ordinary.evidence);
  const owner = O.getOrThrow(A.last(ordinarySource.plans));
  assert.strictEqual(owner.claimNumber, 2);
  assert.deepStrictEqual(
    A.map(O.getOrThrow(A.head(owner.sourcePlan.elements)).nominals, (n) => n.anchor.quote),
    ["The cap", "a claim"]
  );
  const range = yield* inspectRouteTexts([
    "A cap, wherein the cap is mounted.",
    "A cover, wherein the cover is mounted.",
    "A sensor, wherein the sensor is mounted.",
    "The cap of claims 1 to 3, wherein the cap is mounted.",
  ]);
  assert.strictEqual(
    A.some(range.result.plans, (plan) => plan.claimNumber === 4),
    false
  );
  assert.strictEqual(O.getOrThrow(A.last(range.report.records)).status, "partial");
});

const citationBoundary = Effect.fn("PreambleOwnershipTest.citationBoundary")(function* (
  preamble: string,
  expectedAdmission: boolean
) {
  const actual = yield* inspectRouteTexts([
    "A cap, wherein the cap is mounted.",
    `${preamble} wherein the cap is mounted.`,
  ]);
  if (!expectedAdmission)
    assert.strictEqual(O.getOrThrow(A.last(actual.prepared.qualifications)).status, "normalization-failed");
  const record = O.getOrThrow(O.filter(A.last(actual.prepared.input.records), ClaimInputRecord.guards.text));
  const supplied = PreparedClaimInspection.make({
    input: actual.prepared.input,
    qualifications: [
      O.getOrThrow(A.head(actual.prepared.qualifications)),
      ClaimInputQualification.cases["context-ready"].make({
        record,
        claim: PatentClaim.cases.dependent.make({
          claimNumber: 2,
          claimText: record.canonicalText,
          preamble,
          transition: "wherein",
          body: "the cap is mounted.",
          claimReferences: [1],
        }),
      }),
    ],
  });
  const result = yield* decomposePreparedClaimRoles(supplied, actual.evidence);
  const admitted = A.findFirst(result.plans, (value) => value.claimNumber === 2);
  assert.strictEqual(O.isSome(admitted), expectedAdmission);
  if (O.isSome(admitted))
    assert.deepStrictEqual(
      A.map(O.getOrThrow(A.head(admitted.value.sourcePlan.elements)).nominals, (n) => n.anchor.quote),
      ["The cap"]
    );
  else {
    const report = yield* inspectPreparedClaimRoles(supplied, actual.evidence);
    assert.strictEqual(O.getOrThrow(A.last(report.records)).status, "partial");
  }
});
describe("Preamble citation complete-boundary regressions", () => {
  it.effect("declines an explicit repeated keyword without its decimal", () =>
    citationBoundary("The cap of claims 1 or claim,", false)
  );
  it.effect("declines a dangling citation coordinator", () => citationBoundary("The cap of claim 1 or,", false));
  it.effect("retains a complete repeated decimal group", () => citationBoundary("The cap of claims 1 or 1,", true));
});

const invalidSourceClause = Effect.fn("PreambleOwnershipTest.invalidSourceClause")(function* () {
  const f = yield* S.decodeUnknownEffect(fixture)(fixtures.fixtures[0]);
  const source = buildPlan(f);
  const original = O.getOrThrow(A.head(source.roles.clauses));
  const anchor = TextAnchor.make({ ...original.anchor, quote: `X${Str.slice(1)(original.anchor.quote)}` });
  const clauses = A.prepend(A.drop(source.roles.clauses, 1), ClaimClauseSpan.make({ ...original, anchor }));
  const roles = ClaimClauseRolePlan.make({ ...source.roles, clauses });
  assert.strictEqual(
    validateClaimSourceOwnership(ClaimSourceElementPlan.make({ ...source, roles }), reservation(source.remainingWork)),
    false
  );
});

describe("exclusive source ownership independent of grammatical header", () => {
  it.effect("rejects a clause membership certificate whose text disagrees with its source", invalidSourceClause);
  it.effect(
    "matches a whole repeated citation group, retains ordinary claim nouns and declines unproved ranges",
    citationBarriers
  );
  it.effect("uses the actual ancestor and keeps the unsupported alternative route adverse", actualAlternativeRoutes);
  it.effect("does not resolve an earlier reference from a later body introduction", laterBodyIntroduction);
  it.effect("rejects a frame assigned to another existing public element", invalidFrameOwner);
  it.effect("rejects an inherited subject from an unrelated frame", invalidInheritedReference);
  for (const raw of fixtures.fixtures) {
    if (raw.outcome === "admitted-existing-normative-overlay") continue;
    it.effect(raw.case, () => runOracle(raw));
  }
});
