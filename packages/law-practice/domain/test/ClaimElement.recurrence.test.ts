import {
  ClaimElementKind,
  ClaimFrameAttachment,
  ClaimInputCollection,
  ClaimInputQualification,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimTermDeterminer,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  PreparedClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import routeInput from "./fixtures/claim-element/recurrence-route-plans.json" with { type: "json" };
import sourceInput from "./fixtures/claim-element/recurrence-source-plans.json" with { type: "json" };
import type {
  AntecedentFinding,
  ClaimElementTree,
  ClaimInputInspectionReport,
  ClaimRoleDecomposition,
  ClaimSourceElementPlan,
} from "@beep/law-practice-domain/values/ClaimElement";

const argument = S.Struct({
  anchor: TextAnchor,
  role: S.Literals(["subject", "object", "prepositional-complement", "nominal-modifier", "unknown"]),
  predicate: S.NullOr(TextAnchor),
  predicateOwnerFrame: S.NullOr(S.String),
  ownerCore: S.NullOr(TextAnchor),
});
const certificate = S.Record(S.String, S.Union([TextAnchor, S.Array(TextAnchor), S.String, S.Boolean, S.Null]));
const expectedPlan = S.Struct({
  proofCertificates: S.Array(certificate),
  referenceExpectations: S.Array(
    S.Struct({ referring: S.String, verdict: S.String, eligibleIntroductions: S.Array(S.String).pipe(S.optionalKey) })
  ),
  elements: S.Array(
    S.Struct({
      id: S.String,
      ordinal: S.Int,
      parent: S.NullOr(S.String),
      kind: ClaimElementKind,
      anchor: TextAnchor,
      lexicalHeader: TextAnchor,
      terms: S.Array(S.Struct({ anchor: TextAnchor, head: S.String, determiner: ClaimTermDeterminer })),
      functionalParts: S.Array(S.Struct({ kind: S.Literals(["text", "term"]), anchor: TextAnchor })),
    })
  ),
  nominals: S.Array(
    S.Struct({
      id: S.String,
      core: TextAnchor,
      head: TextAnchor,
      outer: TextAnchor,
      determiner: ClaimTermDeterminer,
      sourceRole: S.String,
    })
  ),
  frames: S.Array(
    S.Struct({
      id: S.String,
      ordinal: S.Int,
      parent: S.NullOr(S.String),
      attachment: ClaimFrameAttachment,
      anchor: TextAnchor,
      lexicalHeader: TextAnchor,
      introducer: S.NullOr(TextAnchor),
      predicates: S.Array(TextAnchor),
      nominals: S.Array(S.String),
      subject: S.NullOr(TextAnchor),
      sharedSubject: S.NullOr(TextAnchor),
      coordination: S.NullOr(S.String),
      arguments: S.Array(argument),
    })
  ),
  declarationPlans: S.Array(
    S.Struct({
      kind: S.String,
      ownerElement: S.String,
      frame: S.String,
      anchor: TextAnchor,
      items: S.Array(S.Struct({ element: S.String, anchor: TextAnchor, label: S.NullOr(TextAnchor) })),
    })
  ),
  coverage: S.String,
});
const control = S.Struct({
  case: S.String,
  qualifiedText: S.String,
  claimNumber: S.Int,
  claimReferences: S.Array(S.Int),
  qualifiedParts: S.Struct({ preamble: S.String, transition: S.String, body: S.String }),
  outcome: S.String,
  lexicalEvidence: S.Struct({
    tokens: S.Array(S.Struct({ anchor: TextAnchor, pos: S.String, lemma: S.NullOr(S.String) })),
  }),
  expected: expectedPlan,
});
const sourceControls = S.Struct({ fixtures: S.Array(control) });
const routeControls = S.Struct({
  fixtures: S.Array(
    S.Struct({
      case: S.String,
      sourceKey: S.String,
      records: S.Array(control),
      expectedPerRoute: S.Array(S.Struct({ claims: S.Array(S.Int), verdict: S.String })),
      providerUnavailableControl: S.Struct({ retainedSubstantiveFinding: S.String }).pipe(S.optionalKey),
    })
  ),
});
type Control = typeof control.Type;

const inputFor = Effect.fn("recurrence.inputFor")(function* (key: string, records: ReadonlyArray<Control>) {
  return yield* S.decodeUnknownEffect(ClaimInputCollection)({
    sourceKey: key,
    records: A.map(records, (record, index) => ({
      kind: "text",
      sourceOrdinal: index + 1,
      numberText: `${record.claimNumber}`,
      sourceText: record.qualifiedText,
      canonicalText: record.qualifiedText,
    })),
  });
});
// Exact compiler conformance uses the reviewed qualification. Normalizer and
// real-provider acquisition are exercised separately without replacing their output.
const preparedFor = Effect.fn("recurrence.preparedFor")(function* (
  input: ClaimInputCollection,
  controls: ReadonlyArray<Control>
) {
  const qualifications = yield* Effect.forEach(
    controls,
    Effect.fnUntraced(function* (control, index) {
      const source = O.getOrThrow(A.get(input.records, index));
      if (source.kind !== "text") throw new Error("source fixture must retain text");
      const fields = { ...control.qualifiedParts, claimNumber: control.claimNumber, claimText: control.qualifiedText };
      const claim = yield* S.decodeUnknownEffect(PatentClaim)(
        control.claimReferences.length === 0
          ? { ...fields, claimType: "independent" }
          : { ...fields, claimType: "dependent", claimReferences: control.claimReferences }
      );
      return ClaimInputQualification.cases["context-ready"].make({ record: source, claim });
    })
  );
  return PreparedClaimInspection.make({ input, qualifications });
});
const factsFor = (key: string, record: Control, sourceOrdinal: number) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: key,
    sourceOrdinal,
    qualifiedText: record.qualifiedText,
    provider: "reviewed-source-control",
    assetDigest: "injected-no-model",
    tokens: A.map(record.lexicalEvidence.tokens, (token) =>
      ClaimLexicalToken.make({ ...token, lemma: O.fromNullOr(token.lemma) })
    ),
  });
const planOf = Effect.fn("recurrence.planOf")(function* (record: Control) {
  const input = yield* inputFor("recurrence-source", [record]);
  const prepared = yield* preparedFor(input, [record]);
  const evidence = [factsFor(input.sourceKey, record, 1)];
  const result = yield* decomposePreparedClaimRoles(prepared, evidence);
  return { input, prepared, evidence, result };
});
const ordinalOf = (rows: ReadonlyArray<{ readonly id: string; readonly ordinal: number }>, id: string | null) =>
  id === null ? null : O.getOrThrow(A.findFirst(rows, (row) => row.id === id)).ordinal;

const requiredOrdinalOf = (
  rows: ReadonlyArray<{ readonly id: string; readonly ordinal: number }>,
  id: string
): number => O.getOrThrow(O.fromNullOr(ordinalOf(rows, id)));
const assertNominals = (expected: Control["expected"], actual: ClaimSourceElementPlan): void => {
  assert.deepStrictEqual(
    A.map(actual.nominals, (nominal) => ({
      core: nominal.core,
      head: nominal.head,
      outer: nominal.outer,
      determiner: nominal.nominal.determiner,
      sourceRole: nominal.nominal.role,
    })),
    A.map(expected.nominals, ({ core, head, outer, determiner, sourceRole }) => ({
      core,
      head,
      outer,
      determiner,
      sourceRole,
    }))
  );
};
const assertElements = (expected: Control["expected"], actual: ClaimSourceElementPlan): void => {
  assert.deepStrictEqual(
    A.map(actual.elements, (element) => ({
      ordinal: element.ordinal,
      parent: O.getOrNull(element.parent),
      kind: element.kind,
      anchor: element.extent,
      lexicalHeader: element.lexicalHeader,
      terms: A.map(element.nominals, (nominal) => ({
        anchor: nominal.anchor,
        head: Str.toLowerCase(nominal.head.quote),
        determiner: nominal.determiner,
      })),
    })),
    A.map(expected.elements, (element) => ({
      ordinal: element.ordinal,
      parent: ordinalOf(expected.elements, element.parent),
      kind: element.kind,
      anchor: element.anchor,
      lexicalHeader: element.lexicalHeader,
      terms: element.terms,
    }))
  );
};
const assertFrames = (expected: Control["expected"], actual: ClaimSourceElementPlan): void => {
  assert.deepStrictEqual(
    A.map(actual.frames, (frame) => ({
      ordinal: frame.ordinal,
      parent: O.getOrNull(frame.parent),
      attachment: frame.attachment,
      anchor: frame.extent,
      lexicalHeader: frame.lexicalHeader,
      introducer: O.getOrNull(frame.introducer),
      predicates: frame.predicates,
      nominals: frame.nominals,
      subject: O.getOrNull(frame.subject),
      sharedSubject: O.getOrNull(frame.sharedSubject),
      coordination: O.getOrNull(frame.coordination),
      arguments: A.map(frame.arguments, (arg) => ({
        anchor: arg.nominal,
        role: arg.role,
        predicate: O.getOrNull(arg.predicate),
        ownerCore: O.getOrNull(arg.ownerNominal),
        predicateOwnerFrame: O.match(arg.predicate, {
          onNone: () => null,
          onSome: (operator) =>
            O.getOrThrow(
              A.findFirst(actual.frames, (owner) =>
                A.some(
                  owner.predicates,
                  (predicate) => predicate.startChar === operator.startChar && predicate.endChar === operator.endChar
                )
              )
            ).ordinal,
        }),
      })),
    })),
    A.map(expected.frames, (frame) => ({
      ordinal: frame.ordinal,
      parent: ordinalOf(expected.frames, frame.parent),
      attachment: frame.attachment,
      anchor: frame.anchor,
      lexicalHeader: frame.lexicalHeader,
      introducer: frame.introducer,
      predicates: frame.predicates,
      nominals: A.map(
        frame.nominals,
        (id) => O.getOrThrow(A.findFirst(expected.nominals, (nominal) => nominal.id === id)).core
      ),
      subject: frame.subject,
      sharedSubject: frame.sharedSubject,
      coordination: ordinalOf(expected.frames, frame.coordination),
      arguments: A.map(frame.arguments, ({ anchor, role, predicate, ownerCore, predicateOwnerFrame }) => ({
        anchor,
        role,
        predicate,
        ownerCore,
        predicateOwnerFrame: ordinalOf(expected.frames, predicateOwnerFrame),
      })),
    }))
  );
};
const assertDeclarations = (expected: Control["expected"], actual: ClaimSourceElementPlan): void => {
  assert.deepStrictEqual(
    A.map(actual.declarationPlans, (declaration) => ({
      kind: declaration.kind,
      owner: declaration.owner,
      frame: declaration.frame,
      anchor: declaration.anchor,
      items: A.map(declaration.items, (item) => ({
        child: item.child,
        extent: item.extent,
        label: "label" in item ? item.label : null,
      })),
    })),
    A.map(expected.declarationPlans, (declaration) => ({
      kind: declaration.kind,
      owner: requiredOrdinalOf(expected.elements, declaration.ownerElement),
      frame: ordinalOf(expected.frames, declaration.frame),
      anchor: declaration.anchor,
      items: A.map(declaration.items, (item) => ({
        child: requiredOrdinalOf(expected.elements, item.element),
        extent: item.anchor,
        label: item.label,
      })),
    }))
  );
  assert.deepStrictEqual(
    A.map(actual.declarations, (declaration) => ({
      owner: declaration.owner,
      anchor: declaration.anchor,
      items: declaration.items,
    })),
    A.flatMap(expected.declarationPlans, (declaration) =>
      declaration.kind !== "labelled"
        ? []
        : [
            {
              owner: requiredOrdinalOf(expected.elements, declaration.ownerElement),
              anchor: declaration.anchor,
              items: A.map(declaration.items, (item) => ({
                child: requiredOrdinalOf(expected.elements, item.element),
                label: O.getOrThrow(O.fromNullOr(item.label)),
              })),
            },
          ]
    )
  );
};
const proofKinds = HashMap.make(
  ["finite-plural-PP", "finite-pp"],
  ["postnominal-adjective-PP", "reduced-adjective"],
  ["postnominal-adjective-in-owned-PP-object", "reduced-adjective"],
  ["reduced-participle-PP", "reduced-participle"],
  ["scalar-inside-proved-auxiliary", "scalar-auxiliary"],
  ["shared-article-alternative-NP", "nominal-coordination"],
  ["existing-collective-reference", "quantity"],
  ["proved-first-action", "action"],
  ["declared-action", "action"],
  ["source-licensed-coordinated-action", "coordinated-action"],
  ["existing-explicit-quantity-prefix", "quantity"],
  ["corroborated-cardinal-prefix", "quantity"],
  ["prenominal-adverb-participle-with-noun-head", "nominal-modifier"],
  ["prenominal-compound-with-actual-head", "nominal-modifier"]
);
const isAnchor = S.is(TextAnchor);
const isAnchors = S.is(S.Array(TextAnchor));
const assertCertificates = (record: Control, plan: ClaimSourceElementPlan): void => {
  for (const proof of record.expected.proofCertificates) {
    const kind = O.getOrThrow(O.filter(R.get(proof, "kind"), P.isString));
    const expectedKind = HashMap.get(proofKinds, kind);
    if (O.isSome(expectedKind))
      assert.strictEqual(
        A.some(plan.proofs, (actual) => actual.kind === expectedKind.value),
        true,
        kind
      );
    const anchors = A.flatMap(R.values(proof), (value) => (isAnchor(value) ? [value] : isAnchors(value) ? value : []));
    for (const span of anchors) {
      assert.strictEqual(Str.slice(span.startChar, span.endChar)(record.qualifiedText), span.quote, kind);
      assert.strictEqual(
        A.some(record.lexicalEvidence.tokens, (token) => token.anchor.startChar === span.startChar),
        true,
        kind
      );
      assert.strictEqual(
        A.some(record.lexicalEvidence.tokens, (token) => token.anchor.endChar === span.endChar),
        true,
        kind
      );
      assert.strictEqual(
        A.some(
          plan.frames,
          (frame) =>
            (frame.extent.startChar <= span.startChar && frame.extent.endChar >= span.endChar) ||
            O.exists(frame.introducer, (intro) => intro.startChar <= span.startChar && intro.endChar >= span.endChar)
        ),
        true,
        kind
      );
    }
  }
};
const assertReferenceExpectations = (expected: Control["expected"], report: ClaimInputInspectionReport): void => {
  const record = O.getOrThrow(A.head(report.records));
  assert.notStrictEqual(record.status, "unchecked");
  if (record.status === "unchecked") return;
  for (const reference of expected.referenceExpectations) {
    const nominal = O.getOrThrow(A.findFirst(expected.nominals, (nominal) => nominal.id === reference.referring));
    const findings = A.filter(
      record.findings,
      (finding) =>
        finding.referring.anchor.startChar === nominal.core.startChar &&
        finding.referring.anchor.endChar === nominal.core.endChar
    );
    if (reference.verdict === "resolved") {
      assert.deepStrictEqual(findings, []);
      continue;
    }
    assert.strictEqual(findings.length, 1);
    const finding = O.getOrThrow(A.head(findings));
    assert.strictEqual(finding.kind, reference.verdict);
    if (finding.kind === "ambiguous-antecedent" && reference.eligibleIntroductions !== undefined)
      assert.deepStrictEqual(
        A.map(finding.candidates, (candidate) => candidate.anchor),
        A.map(
          reference.eligibleIntroductions,
          (id) => O.getOrThrow(A.findFirst(expected.nominals, (n) => n.id === id)).core
        )
      );
  }
};
const assertPublicTopology = (expected: Control["expected"], tree: ClaimElementTree): void => {
  const pathOf = (id: string): string =>
    O.getOrThrow(
      A.get(tree.elements, O.getOrThrow(A.findFirstIndex(expected.elements, (element) => element.id === id)))
    ).path;
  assert.deepStrictEqual(
    A.flatMap(tree.edges, (edge) => (edge.kind === "part-of" ? [{ child: edge.child, parent: edge.parent }] : [])),
    A.flatMap(expected.elements, (element) =>
      element.parent === null ? [] : [{ child: pathOf(element.id), parent: pathOf(element.parent) }]
    )
  );
  for (const element of expected.elements) {
    const functional = A.filter(
      tree.edges,
      (edge) => edge.kind === "functional" && edge.element === pathOf(element.id)
    );
    assert.strictEqual(functional.length, element.kind === "functional-relation" ? 1 : 0);
    const parts = A.flatMap(functional, (edge) =>
      edge.kind === "functional"
        ? A.map(edge.parts, (part) => {
            if (part.kind === "term") {
              assert.strictEqual(part.term.path, pathOf(element.id));
              return { kind: part.kind, anchor: part.term.anchor };
            }
            return { kind: part.kind, anchor: part.anchor };
          })
        : []
    );
    assert.deepStrictEqual(parts, element.functionalParts);
  }
};
const assertAdmittedProjection = (record: Control, result: ClaimRoleDecomposition): void => {
  const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
  assertNominals(record.expected, plan);
  assertElements(record.expected, plan);
  assertFrames(record.expected, plan);
  assertDeclarations(record.expected, plan);
  assertCertificates(record, plan);
  const decomposition = O.getOrThrow(A.head(result.decompositions));
  assert.strictEqual(decomposition.status, "decomposed");
  if (decomposition.status === "decomposed") {
    assertPublicTopology(record.expected, decomposition.tree);
    assert.deepStrictEqual(
      A.map(decomposition.tree.elements, ({ anchor, kind, terms }) => ({
        anchor,
        kind,
        terms: A.map(terms, (term) => ({ anchor: term.anchor, head: term.head, determiner: term.determiner })),
      })),
      A.map(record.expected.elements, ({ anchor, kind, terms }) => ({ anchor, kind, terms }))
    );
  }
};
const runControl = Effect.fn("recurrence.runControl")(function* (record: Control) {
  const { prepared, evidence, result } = yield* planOf(record);
  assert.strictEqual(result.plans.length, record.outcome === "admitted" ? 1 : 0);
  if (record.outcome !== "admitted") {
    const legacy = yield* decomposePreparedClaimRoles(prepared, []);
    assert.deepStrictEqual(result.decompositions, legacy.decompositions);
  } else {
    assertAdmittedProjection(record, result);
  }
  const adverse = record.outcome !== "admitted" || Str.startsWith("partial-required")(record.expected.coverage);
  if (adverse || record.expected.referenceExpectations.length > 0) {
    const report = yield* inspectPreparedClaimRoles(prepared, evidence);
    if (adverse) assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
    assertReferenceExpectations(record.expected, report);
  }
});

const assertRouteFindings = (
  findings_: ReadonlyArray<AntecedentFinding>,
  routes: ReadonlyArray<{ readonly claims: ReadonlyArray<number>; readonly verdict: string }>
): void => {
  for (const route of routes) {
    const findings = A.filter(
      findings_,
      (finding) =>
        finding.referring.anchor.quote === "said plurality of pins" &&
        "chain" in finding &&
        finding.chain.length === route.claims.length &&
        A.every(finding.chain, (claim) => A.contains(route.claims, claim))
    );
    if (route.verdict === "resolved") assert.deepStrictEqual(findings, []);
    else assert.strictEqual(O.getOrThrow(A.head(findings)).kind, route.verdict);
  }
};
const insertReviewedTokens = (record: Control, from: number, to: number, insertion: number): Control => {
  const extra = Str.slice(from, to)(record.qualifiedText);
  const text = `${Str.slice(0, insertion)(record.qualifiedText)}${extra}${Str.slice(insertion)(record.qualifiedText)}`;
  const shifted = A.map(record.lexicalEvidence.tokens, (token) =>
    token.anchor.startChar < insertion
      ? token
      : {
          ...token,
          anchor: TextAnchor.make({
            ...token.anchor,
            startChar: token.anchor.startChar + extra.length,
            endChar: token.anchor.endChar + extra.length,
          }),
        }
  );
  const inserted = A.map(
    A.filter(record.lexicalEvidence.tokens, (token) => token.anchor.startChar >= from && token.anchor.endChar <= to),
    (token) => ({
      ...token,
      anchor: TextAnchor.make({
        ...token.anchor,
        startChar: token.anchor.startChar + insertion - from,
        endChar: token.anchor.endChar + insertion - from,
      }),
    })
  );
  const tokens = A.sort(
    A.appendAll(shifted, inserted),
    (left: Control["lexicalEvidence"]["tokens"][number], right: Control["lexicalEvidence"]["tokens"][number]) =>
      left.anchor.startChar < right.anchor.startChar ? -1 : 1
  );
  return {
    ...record,
    qualifiedText: text,
    qualifiedParts: {
      ...record.qualifiedParts,
      body: Str.slice(record.qualifiedParts.preamble.length + record.qualifiedParts.transition.length + 2)(text),
    },
    lexicalEvidence: { tokens },
  };
};
describe("reviewed recurrence source frames and actual enhanced topology", () => {
  it.effect("declines higher-arity groups atomically instead of introducing a truncated binary prefix", () =>
    Effect.gen(function* () {
      const controls = yield* S.decodeUnknownEffect(sourceControls)(sourceInput);
      for (const [case_, connector, last] of [
        ["shared-article-alternative", "or", "cover"],
        ["shared-head-modifiers", "and", "second"],
      ]) {
        const record = O.getOrThrow(A.findFirst(controls.fixtures, (record) => record.case === case_));
        const first = O.getOrThrow(
          A.findFirst(record.lexicalEvidence.tokens, (token) => token.anchor.quote === connector)
        );
        const final = O.getOrThrow(A.findLast(record.lexicalEvidence.tokens, (token) => token.anchor.quote === last));
        const expanded = insertReviewedTokens(
          record,
          first.anchor.startChar - 1,
          final.anchor.endChar,
          final.anchor.endChar
        );
        const { prepared, evidence, result } = yield* planOf(expanded);
        assert.deepStrictEqual(result.plans, []);
        const legacy = yield* decomposePreparedClaimRoles(prepared, []);
        assert.deepStrictEqual(result.decompositions, legacy.decompositions);
        const report = yield* inspectPreparedClaimRoles(prepared, evidence);
        assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "partial");
      }
    })
  );
  for (const raw of sourceInput.fixtures)
    it.effect(raw.case, () =>
      Effect.gen(function* () {
        const controls = yield* S.decodeUnknownEffect(sourceControls)(sourceInput);
        const record = O.getOrThrow(A.findFirst(controls.fixtures, (control) => control.case === raw.case));
        yield* runControl(record);
      })
    );
  for (const raw of routeInput.fixtures)
    it.effect(raw.case, () =>
      Effect.gen(function* () {
        const controls = yield* S.decodeUnknownEffect(routeControls)(routeInput);
        const family = O.getOrThrow(A.findFirst(controls.fixtures, (control) => control.case === raw.case));
        const input = yield* inputFor(family.sourceKey, family.records);
        const prepared = yield* preparedFor(input, family.records);
        const evidence = A.map(family.records, (record, index) => factsFor(input.sourceKey, record, index + 1));
        const result = yield* decomposePreparedClaimRoles(prepared, evidence);
        assert.strictEqual(result.plans.length, family.records.length);
        for (let index = 0; index < family.records.length; index++) {
          const record = O.getOrThrow(A.get(family.records, index));
          const plan = O.getOrThrow(A.get(result.plans, index)).sourcePlan;
          assertNominals(record.expected, plan);
          assertElements(record.expected, plan);
          assertFrames(record.expected, plan);
        }
        const report = yield* inspectPreparedClaimRoles(prepared, evidence);
        const child = O.getOrThrow(A.last(report.records));
        assert.notStrictEqual(child.status, "unchecked");
        if (child.status === "unchecked") return;
        assertRouteFindings(child.findings, family.expectedPerRoute);
        if (family.providerUnavailableControl !== undefined) {
          const unavailable = A.map(family.records, (record, index) =>
            ClaimLexicalEvidence.cases.unavailable.make({
              sourceKey: input.sourceKey,
              sourceOrdinal: index + 1,
              qualifiedText: record.qualifiedText,
              reason: "tokenization-failed",
            })
          );
          const fallback = yield* inspectPreparedClaimRoles(prepared, unavailable);
          const last = O.getOrThrow(A.last(fallback.records));
          assert.strictEqual(last.status, "partial");
          if (last.status !== "unchecked")
            assert.strictEqual(
              A.filter(
                last.findings,
                (finding) =>
                  finding.referring.anchor.quote === "said plurality of pins" &&
                  finding.kind === family.providerUnavailableControl?.retainedSubstantiveFinding
              ).length,
              1
            );
        }
      })
    );
});
