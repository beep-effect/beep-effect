import { projectClaimFrameLexicalView } from "@beep/law-practice-domain/test";
import { ClaimElementTree, ClaimTermDeterminer } from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { Sha256HexFromBytes } from "@beep/schema";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import wire from "../fixtures/claim-element/finite-clause-public-plans.json" with { type: "json" };
import controls from "../fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import headCorrection from "../fixtures/claim-element/finite-clause-synthetic-head-correction.json" with {
  type: "json",
};
import wireCorrection from "../fixtures/claim-element/finite-clause-synthetic-wire-correction.json" with {
  type: "json",
};
import { decomposeFiniteSourceFixture } from "./ClaimElementFiniteSource.ts";

const nominal = S.Struct({
  id: S.NonEmptyString,
  core: TextAnchor,
  head: TextAnchor,
  outer: TextAnchor,
  publicHead: S.NonEmptyString,
  canonicalReferenceHead: S.NonEmptyString,
  determiner: ClaimTermDeterminer,
  role: S.NonEmptyString,
});
const semanticArgument = S.Struct({
  nominal: TextAnchor,
  role: S.String,
  predicate: S.NullOr(TextAnchor),
  ownerNominal: S.NullOr(TextAnchor),
});
type SemanticArgument = typeof semanticArgument.Type;
const expectedArgument = S.Struct({
  nominal: S.NonEmptyString.pipe(S.optionalKey),
  description: S.NonEmptyString.pipe(S.optionalKey),
  selector: S.NonEmptyString.pipe(S.optionalKey),
  role: S.NonEmptyString,
  predicate: S.NullOr(S.NonEmptyString),
  ownerNominal: S.NullOr(S.NonEmptyString),
});
const expectedFrame = S.Struct({
  id: S.NonEmptyString,
  extent: TextAnchor,
  lexicalHeader: TextAnchor,
  publicOwner: S.NonEmptyString,
  parent: S.NullOr(S.NonEmptyString),
  attachment: S.NonEmptyString,
  introducer: S.NullOr(TextAnchor),
  predicates: S.Array(TextAnchor),
  subject: S.NullOr(S.NonEmptyString),
  arguments: S.Array(expectedArgument),
  nominals: S.Array(S.NonEmptyString),
  inheritedSubject: S.NullOr(
    S.Struct({ nominal: S.NonEmptyString, fromFrame: S.NonEmptyString, publicCoreDonor: S.Boolean })
  ),
  coordination: S.NullOr(S.NonEmptyString),
});
const description = S.Struct({
  id: S.NonEmptyString,
  operator: TextAnchor,
  auxiliary: TextAnchor,
  lexicalPredicate: S.Struct({ anchor: TextAnchor, pos: S.NonEmptyString, lemma: S.NonEmptyString }),
  introducer: TextAnchor,
  completeCandidate: S.NonEmptyString,
  sourceFrame: S.NonEmptyString,
});
const selector = S.Struct({
  id: S.NonEmptyString,
  operator: TextAnchor,
  content: TextAnchor,
  groupCore: S.NonEmptyString,
  sourceFrame: S.NonEmptyString,
  branches: S.Array(
    S.Struct({
      core: TextAnchor,
      head: TextAnchor,
      outer: TextAnchor,
      identity: S.NonEmptyString,
      publicTerm: S.Boolean,
      introduction: S.Boolean,
      aliasEligible: S.Boolean,
    })
  ),
});
const tokenOwner = S.Union([
  S.Struct({ kind: S.Literal("public-core"), id: S.NonEmptyString }),
  S.Struct({ kind: S.Literal("private-description-core"), id: S.NonEmptyString }),
  S.Struct({ kind: S.Literal("certified-predicate"), id: S.NonEmptyString }),
  S.Struct({
    kind: S.Literal("certified-structural-control"),
    certificate: S.NonEmptyString,
    sourceWord: S.NonEmptyString,
  }),
]);
const expected = S.Struct({
  publicTree: ClaimElementTree.pipe(S.optionalKey),
  sourceTokenOwnership: S.Array(S.Struct({ token: TextAnchor, owner: tokenOwner })).pipe(S.optionalKey),
  frames: S.Array(expectedFrame).pipe(S.optionalKey),
  descriptionProofs: S.Array(description).pipe(S.optionalKey),
  selectorProofs: S.Array(selector).pipe(S.optionalKey),
  nominals: S.Array(nominal).pipe(S.optionalKey),
  privateCandidates: S.Array(nominal).pipe(S.optionalKey),
  elements: S.Array(
    S.Struct({
      id: S.NonEmptyString,
      parent: S.NullOr(S.NonEmptyString),
      kind: S.NonEmptyString,
      extent: TextAnchor,
      lexicalHeader: TextAnchor,
    })
  ).pipe(S.optionalKey),
});
const source = S.Struct({
  case: S.NonEmptyString,
  source: S.NonEmptyString,
  qualifiedParts: S.Struct({ preamble: S.NonEmptyString, transition: S.NonEmptyString, body: S.NonEmptyString }),
  outcome: S.Literals(["admitted", "unsupported"]),
  tokens: S.Array(S.Struct({ anchor: TextAnchor, pos: S.NonEmptyString, lemma: S.NullOr(S.NonEmptyString) })),
  expected,
});
const publicControls = S.Struct({ positive: S.Array(S.Struct({ case: S.NonEmptyString, tree: ClaimElementTree })) });
const headCorrectionSchema = S.Struct({
  reviewedPrivateOverlaySha256: S.NonEmptyString,
  entries: S.Array(
    S.Struct({
      case: S.NonEmptyString,
      source: S.NonEmptyString,
      sourceSha256: S.NonEmptyString,
      originalExpectedCanonicalJson: S.NonEmptyString,
      originalExpectedSha256: S.NonEmptyString,
      correctedExpectedCanonicalJson: S.NonEmptyString,
      correctedExpectedSha256: S.NonEmptyString,
      correctedExpected: S.Json,
      correctedPublicTree: ClaimElementTree,
      originalPublicTreeCanonicalJson: S.NonEmptyString,
      originalPublicTreeSha256: S.NonEmptyString,
      correctedPublicTreeCanonicalJson: S.NonEmptyString,
      correctedPublicTreeSha256: S.NonEmptyString,
      exactAllowedLeafDeltas: S.Array(S.Struct({ path: S.NonEmptyString, old: S.Json, new: S.Json })),
    })
  ),
});
const jsonAt = (value: S.Json, path: string): S.Json => {
  let current = value;
  for (const part of A.drop(Str.split("/")(path), 1)) {
    if (S.is(S.Array(S.Json))(current)) current = O.getOrThrow(A.get(current, Number(part)));
    else if (S.is(S.Record(S.String, S.Json))(current)) current = O.getOrThrow(O.fromUndefinedOr(current[part]));
    else throw new Error("reviewed correction path must exist");
  }
  return current;
};
const replaceJsonPath = (value: S.Json, path: ReadonlyArray<string>, replacement: S.Json): S.Json => {
  const first = A.head(path);
  if (O.isNone(first)) return replacement;
  const rest = A.drop(path, 1);
  if (S.is(S.Array(S.Json))(value))
    return A.map(value, (entry, index) =>
      index === Number(first.value) ? replaceJsonPath(entry, rest, replacement) : entry
    );
  if (typeof value === "object" && value !== null && !A.isArray(value) && S.is(S.Record(S.String, S.Json))(value))
    return R.map(value, (entry, key) => (key === first.value ? replaceJsonPath(entry, rest, replacement) : entry));
  throw new Error("reviewed correction path must have a container");
};
const correctedSourceRow = Effect.fn("FiniteTopology.correctedSourceRow")(function* (row: Source) {
  const overlay = yield* S.decodeUnknownEffect(headCorrectionSchema)(headCorrection);
  assert.strictEqual(
    overlay.reviewedPrivateOverlaySha256,
    "b3f813947df71063ebe89c53520c6c255581567bd5ba38fe19bf158e1a2195a8"
  );
  const entry = A.findFirst(overlay.entries, (e) => e.case === row.case);
  if (O.isNone(entry)) return row;
  const correction = entry.value;
  assert.strictEqual(correction.source, row.source);
  const sourceHash = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(row.source));
  assert.strictEqual(sourceHash, correction.sourceSha256);
  const oldHash = yield* S.decodeEffect(Sha256HexFromBytes)(
    new TextEncoder().encode(correction.originalExpectedCanonicalJson)
  );
  const newHash = yield* S.decodeEffect(Sha256HexFromBytes)(
    new TextEncoder().encode(correction.correctedExpectedCanonicalJson)
  );
  assert.strictEqual(oldHash, correction.originalExpectedSha256);
  assert.strictEqual(newHash, correction.correctedExpectedSha256);
  const original = yield* S.decodeEffect(S.fromJsonString(S.Json))(correction.originalExpectedCanonicalJson);
  const corrected = yield* S.decodeEffect(S.fromJsonString(S.Json))(correction.correctedExpectedCanonicalJson);
  assert.deepStrictEqual<unknown>(
    original,
    O.getOrThrow(A.findFirst(controls.cases, (c) => c.case === row.case)).expected
  );
  assert.deepStrictEqual(corrected, correction.correctedExpected);
  for (const delta of correction.exactAllowedLeafDeltas) {
    assert.deepStrictEqual(jsonAt(original, delta.path), delta.old);
    assert.deepStrictEqual(jsonAt(corrected, delta.path), delta.new);
  }
  let forward = original;
  let reverse = corrected;
  for (const delta of correction.exactAllowedLeafDeltas)
    forward = replaceJsonPath(forward, A.drop(Str.split("/")(delta.path), 1), delta.new);
  for (const delta of A.reverse(correction.exactAllowedLeafDeltas))
    reverse = replaceJsonPath(reverse, A.drop(Str.split("/")(delta.path), 1), delta.old);
  assert.deepStrictEqual(forward, corrected);
  assert.deepStrictEqual(reverse, original);
  const semanticExpected = yield* S.decodeUnknownEffect(expected)(corrected);
  return { ...row, expected: semanticExpected };
});
const correctionSchema = S.Struct({
  reviewedPrivateOverlaySha256: S.NonEmptyString,
  repositoryOriginal25Sha256: S.NonEmptyString,
  entries: S.Array(
    S.Struct({
      case: S.NonEmptyString,
      source: S.NonEmptyString,
      sourceSha256: S.NonEmptyString,
      originalTreeCanonicalJson: S.NonEmptyString,
      originalTreeSha256: S.NonEmptyString,
      originalEdges: ClaimElementTree.fields.edges,
      correctedTree: ClaimElementTree,
      correctedTreeCanonicalJson: S.NonEmptyString,
      correctedTreeSha256: S.NonEmptyString,
    })
  ),
});
const correctedPublicTree = Effect.fn("FiniteTopology.correctedPublicTree")(function* (
  row: Source,
  original: ClaimElementTree
) {
  const overlay = yield* S.decodeUnknownEffect(correctionSchema)(wireCorrection);
  assert.strictEqual(
    overlay.reviewedPrivateOverlaySha256,
    "e1ec75e1750e096902bb034243083cfdae09c09d59784622b45fe0c269268cfb"
  );
  const entry = A.findFirst(overlay.entries, (e) => e.case === row.case);
  if (O.isNone(entry)) {
    const heads = yield* S.decodeUnknownEffect(headCorrectionSchema)(headCorrection);
    const head = A.findFirst(heads.entries, (e) => e.case === row.case);
    if (O.isNone(head)) return original;
    const correction = head.value;
    const oldHash = yield* S.decodeEffect(Sha256HexFromBytes)(
      new TextEncoder().encode(correction.originalPublicTreeCanonicalJson)
    );
    const newHash = yield* S.decodeEffect(Sha256HexFromBytes)(
      new TextEncoder().encode(correction.correctedPublicTreeCanonicalJson)
    );
    assert.strictEqual(oldHash, correction.originalPublicTreeSha256);
    assert.strictEqual(newHash, correction.correctedPublicTreeSha256);
    const oldTree = yield* S.decodeEffect(S.fromJsonString(ClaimElementTree))(
      correction.originalPublicTreeCanonicalJson
    );
    const newTree = yield* S.decodeEffect(S.fromJsonString(ClaimElementTree))(
      correction.correctedPublicTreeCanonicalJson
    );
    assert.deepStrictEqual(oldTree, original);
    assert.deepStrictEqual(newTree, correction.correctedPublicTree);
    assert.deepStrictEqual(newTree, O.getOrThrow(O.fromUndefinedOr(row.expected.publicTree)));
    const oldExpected = yield* S.decodeEffect(S.fromJsonString(S.Json))(correction.originalExpectedCanonicalJson);
    const correctedExpected = yield* S.decodeEffect(S.fromJsonString(S.Json))(
      correction.correctedExpectedCanonicalJson
    );
    const oldFromExpected = yield* S.decodeUnknownEffect(ClaimElementTree)(jsonAt(oldExpected, "/publicTree"));
    const newFromExpected = yield* S.decodeUnknownEffect(ClaimElementTree)(jsonAt(correctedExpected, "/publicTree"));
    assert.deepStrictEqual(oldFromExpected, oldTree);
    assert.deepStrictEqual(newFromExpected, newTree);
    let inverse = correctedExpected;
    for (const delta of A.reverse(correction.exactAllowedLeafDeltas))
      inverse = replaceJsonPath(inverse, A.drop(Str.split("/")(delta.path), 1), delta.old);
    assert.deepStrictEqual(inverse, oldExpected);
    return newTree;
  }
  const correction = entry.value;
  assert.strictEqual(correction.source, row.source);
  const sourceDigest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(row.source));
  assert.strictEqual(sourceDigest, correction.sourceSha256);
  const oldDigest = yield* S.decodeEffect(Sha256HexFromBytes)(
    new TextEncoder().encode(correction.originalTreeCanonicalJson)
  );
  assert.strictEqual(oldDigest, correction.originalTreeSha256);
  const frozenOriginal = yield* S.decodeEffect(S.fromJsonString(ClaimElementTree))(
    correction.originalTreeCanonicalJson
  );
  assert.deepStrictEqual(frozenOriginal, original);
  assert.deepStrictEqual(original.edges, correction.originalEdges);
  const candidate = yield* S.decodeEffect(ClaimElementTree)({ ...original, edges: correction.correctedTree.edges });
  assert.deepStrictEqual(candidate, correction.correctedTree);
  const correctedDigest = yield* S.decodeEffect(Sha256HexFromBytes)(
    new TextEncoder().encode(correction.correctedTreeCanonicalJson)
  );
  assert.strictEqual(correctedDigest, correction.correctedTreeSha256);
  const frozenCorrected = yield* S.decodeEffect(S.fromJsonString(ClaimElementTree))(
    correction.correctedTreeCanonicalJson
  );
  assert.deepStrictEqual(candidate, frozenCorrected);
  assert.deepStrictEqual({ ...candidate, edges: correction.originalEdges }, original);
  return candidate;
});
type Source = typeof source.Type;
type SourcePlan = Parameters<typeof projectClaimFrameLexicalView>[0];
type Certificate = SourcePlan["roles"]["certificates"][number];
const isDescriptionCertificate = (
  proof: Certificate
): proof is Extract<Certificate, { readonly kind: "description" }> => proof.kind === "description";
const isRawCertificate = (proof: Certificate): proof is Extract<Certificate, { readonly kind: "token" }> =>
  proof.kind === "token";
const isHeadCertificate = (proof: Certificate): proof is Extract<Certificate, { readonly kind: "head" }> =>
  proof.kind === "head";
const assertDescriptionSourceFacts = (row: Source, plan: SourcePlan): void => {
  const privateExpected = O.getOrThrow(O.fromUndefinedOr(row.expected.privateCandidates));
  const descriptions = O.getOrThrow(O.fromUndefinedOr(row.expected.descriptionProofs));
  const actualDescriptions = A.filter(plan.roles.certificates, (p) => p.kind === "description");
  assert.strictEqual(actualDescriptions.length, descriptions.length);
  for (const description of descriptions) {
    const candidate = O.getOrThrow(A.findFirst(privateExpected, (n) => n.id === description.completeCandidate));
    const certificate = O.getOrThrow(
      O.filter(
        A.findFirst(
          actualDescriptions,
          (p) => p.kind === "description" && p.extent.startChar === description.auxiliary.startChar
        ),
        isDescriptionCertificate
      )
    );
    assert.deepStrictEqual(certificate.extent, description.operator);
    const token = O.getOrThrow(
      O.filter(A.get(plan.roles.certificates, certificate.introducer.ordinal - 1), isRawCertificate)
    );
    assert.deepStrictEqual(token.token.anchor, description.introducer);
    const head = O.getOrThrow(
      O.filter(A.get(plan.roles.certificates, certificate.candidate.ordinal - 1), isHeadCertificate)
    );
    assert.deepStrictEqual({ core: head.core, head: head.head }, { core: candidate.core, head: candidate.head });
    assert.strictEqual(
      A.some(plan.nominals, (n) => n.core.startChar === candidate.core.startChar),
      false
    );
  }
};
const assertOpaqueSourceFacts = (row: Source, plan: SourcePlan): void => {
  const selectors = O.getOrThrow(O.fromUndefinedOr(row.expected.selectorProofs));
  assert.strictEqual(plan.roles.opaqueSelections.length, selectors.length);
  for (let i = 0; i < selectors.length; i++) {
    const expected = O.getOrThrow(A.get(selectors, i));
    const actual = O.getOrThrow(A.get(plan.roles.opaqueSelections, i));
    assert.deepStrictEqual(
      { operator: actual.operator, core: actual.core, head: actual.head },
      { operator: expected.operator, core: expected.content, head: expected.content }
    );
    assert.deepStrictEqual(
      A.map(actual.branches, (b) => ({ core: b.core, head: b.head, outer: b.outer, origin: b.origin })),
      A.map(expected.branches, (b) => ({ core: b.core, head: b.head, outer: b.outer, origin: "opaque-branch" }))
    );
    for (const branch of expected.branches) {
      assert.deepStrictEqual(
        {
          identity: branch.identity,
          publicTerm: branch.publicTerm,
          introduction: branch.introduction,
          aliasEligible: branch.aliasEligible,
        },
        { identity: "unresolved", publicTerm: false, introduction: false, aliasEligible: false }
      );
      assert.strictEqual(
        A.some(
          plan.nominals,
          (n) => n.core.startChar === branch.core.startChar && n.core.endChar === branch.core.endChar
        ),
        false
      );
    }
    const state = O.getOrThrow(
      A.findFirst(
        plan.roles.candidateStates,
        (state) =>
          state.nominal.anchor.startChar === actual.core.startChar &&
          state.nominal.anchor.endChar === actual.core.endChar
      )
    );
    assert.strictEqual(state.kind, "proved");
    if (state.kind === "proved") assert.strictEqual(state.use, "opaque");
  }
};
const assertPrivateSourceFacts = (row: Source, plan: SourcePlan): void => {
  const privateExpected = O.getOrThrow(O.fromUndefinedOr(row.expected.privateCandidates));
  const selectorExpected = O.getOrThrow(O.fromUndefinedOr(row.expected.selectorProofs));
  assert.deepStrictEqual(
    A.map(
      A.filter(plan.roles.privateCandidates, (n) => n.origin === "description"),
      (n) => ({ core: n.core, head: n.head, outer: n.outer })
    ),
    A.map(privateExpected, (n) => ({ core: n.core, head: n.head, outer: n.outer }))
  );
  assert.deepStrictEqual(
    A.map(
      A.filter(plan.roles.privateCandidates, (n) => n.origin === "opaque-branch"),
      (n) => ({ core: n.core, head: n.head, outer: n.outer })
    ),
    A.map(
      A.flatMap(selectorExpected, (selector) => selector.branches),
      (n) => ({ core: n.core, head: n.head, outer: n.outer })
    )
  );
  assert.strictEqual(
    plan.roles.privateCandidates.length,
    privateExpected.length + A.reduce(selectorExpected, 0, (sum, selector) => sum + selector.branches.length)
  );
  assertDescriptionSourceFacts(row, plan);
  assertOpaqueSourceFacts(row, plan);
};
const assertSourceTokens = (row: Source, plan: SourcePlan): void => {
  const expected = O.getOrThrow(O.fromUndefinedOr(row.expected.sourceTokenOwnership));
  const nominals = O.getOrThrow(O.fromUndefinedOr(row.expected.nominals));
  const privateValues = O.getOrThrow(O.fromUndefinedOr(row.expected.privateCandidates));
  const frames = O.getOrThrow(O.fromUndefinedOr(row.expected.frames));
  const actual = A.map(plan.tokenOwnership, (record) => {
    if (record.kind === "public-core") {
      const core = O.getOrThrow(A.get(plan.nominals, record.core - 1)).core;
      const value = O.getOrThrow(
        A.findFirst(nominals, (n) => n.core.startChar === core.startChar && n.core.endChar === core.endChar)
      );
      return { token: record.extent, owner: { kind: "public-core", id: value.id } };
    }
    if (record.kind === "private-value") {
      const candidate = O.getOrThrow(
        A.findFirst(plan.roles.privateCandidates, (c) => c.seed.ordinal === record.candidate.ordinal)
      );
      const value = O.getOrThrow(
        A.findFirst(
          privateValues,
          (n) => n.core.startChar === candidate.core.startChar && n.core.endChar === candidate.core.endChar
        )
      );
      return { token: record.extent, owner: { kind: "private-description-core", id: value.id } };
    }
    if (record.kind === "predicate")
      return {
        token: record.extent,
        owner: { kind: "certified-predicate", id: O.getOrThrow(A.get(frames, record.frame - 1)).id },
      };
    return { token: record.extent, owner: { kind: "certified-structural-control", sourceWord: record.extent.quote } };
  });
  const normalizedExpected = A.map(expected, (entry) => ({
    token: entry.token,
    owner:
      entry.owner.kind === "certified-structural-control"
        ? { kind: entry.owner.kind, sourceWord: entry.owner.sourceWord }
        : entry.owner,
  }));
  assert.deepStrictEqual<unknown>(actual, normalizedExpected);
};
const assertFrameAt = (row: Source, plan: SourcePlan, index: number): void => {
  const frames = O.getOrThrow(O.fromUndefinedOr(row.expected.frames));
  const nominals = O.getOrThrow(O.fromUndefinedOr(row.expected.nominals));
  const privateCandidates = O.getOrThrow(O.fromUndefinedOr(row.expected.privateCandidates));
  const descriptions = O.getOrThrow(O.fromUndefinedOr(row.expected.descriptionProofs));
  const selectors = O.getOrThrow(O.fromUndefinedOr(row.expected.selectorProofs));
  const elements = O.getOrThrow(O.fromUndefinedOr(row.expected.elements));
  const core = (id: string) => O.getOrThrow(A.findFirst([...nominals, ...privateCandidates], (n) => n.id === id)).core;
  const ordinal = (id: string) => O.getOrThrow(A.findFirstIndex(frames, (f) => f.id === id)) + 1;
  const expected = O.getOrThrow(A.get(frames, index));
  const actual = O.getOrThrow(A.get(plan.frames, index));
  const view = O.getOrThrow(projectClaimFrameLexicalView(plan, actual, () => true));
  const standard = A.map(view.arguments, (a) => ({
    nominal: a.nominal,
    role: a.role,
    predicate: O.getOrNull(a.predicate),
    ownerNominal: O.getOrNull(a.ownerNominal),
  }));
  const privateArgs = A.map(
    A.filter(view.privateArguments, (a) => a.origin === "description"),
    (a) => ({ nominal: a.core, role: "descriptive-complement", predicate: a.predicate, ownerNominal: null })
  );
  const arguments_ = A.sort([...standard, ...privateArgs], (a: SemanticArgument, b: SemanticArgument) =>
    a.nominal.startChar < b.nominal.startChar ? -1 : a.nominal.startChar > b.nominal.startChar ? 1 : 0
  );
  const expectedArguments = A.map(expected.arguments, (a) => {
    const id =
      a.nominal ??
      (a.description === undefined
        ? O.getOrThrow(A.findFirst(selectors, (s) => s.id === a.selector)).groupCore
        : O.getOrThrow(A.findFirst(descriptions, (d) => d.id === a.description)).completeCandidate);
    const predicate =
      a.predicate === null ? null : O.getOrThrow(A.findFirst(view.predicates, (p) => p.quote === a.predicate));
    return {
      nominal: core(id),
      role: a.role,
      predicate,
      ownerNominal: a.ownerNominal === null ? null : core(a.ownerNominal),
    };
  });
  assert.deepStrictEqual<unknown>(
    {
      extent: actual.extent,
      lexicalHeader: actual.lexicalHeader,
      publicOwner: actual.publicOwner,
      parent: O.getOrNull(actual.parent),
      attachment: actual.attachment,
      introducer: O.getOrNull(actual.introducer),
      predicates: view.predicates,
      subject: O.getOrNull(actual.subject),
      arguments: arguments_,
      nominals: actual.nominals,
      inheritedSubject: O.getOrNull(O.map(actual.inheritedSubject, (i) => i.nominal)),
      coordination: O.getOrNull(actual.coordination),
    },
    {
      extent: expected.extent,
      lexicalHeader: expected.lexicalHeader,
      publicOwner: O.getOrThrow(A.findFirstIndex(elements, (e) => e.id === expected.publicOwner)) + 1,
      parent: expected.parent === null ? null : ordinal(expected.parent),
      attachment: expected.attachment,
      introducer: expected.introducer,
      predicates: expected.predicates,
      subject: expected.subject === null ? null : core(expected.subject),
      arguments: expectedArguments,
      nominals: A.map(expected.nominals, core),
      inheritedSubject: expected.inheritedSubject === null ? null : core(expected.inheritedSubject.nominal),
      coordination: expected.coordination === null ? null : ordinal(expected.coordination),
    },
    `${row.case}/${expected.id}`
  );
  const inverse = A.map(actual.arguments, (_, i) => {
    if (O.exists(view.headerMembership, (h) => h.rawOrdinal === i + 1))
      return O.getOrThrow(view.headerMembership).argument;
    const index = O.getOrThrow(A.findFirstIndex(view.sourceArgumentOrdinals, (n) => n === i + 1));
    const semantic = O.getOrThrow(A.get(view.arguments, index));
    const original = O.getOrThrow(A.get(actual.arguments, i));
    // The lexical/operator inverse is checked against the exact original
    // predicate join, while header demultiplexing preserves the raw record.
    return { ...semantic, predicate: original.predicate };
  });
  assert.deepStrictEqual(inverse, actual.arguments);
};
const assertFrames = (row: Source, plan: SourcePlan): void => {
  const frames = O.getOrThrow(O.fromUndefinedOr(row.expected.frames));
  O.getOrThrow(O.fromUndefinedOr(row.expected.nominals));
  O.getOrThrow(O.fromUndefinedOr(row.expected.privateCandidates));
  O.getOrThrow(O.fromUndefinedOr(row.expected.descriptionProofs));
  O.getOrThrow(O.fromUndefinedOr(row.expected.selectorProofs));
  O.getOrThrow(O.fromUndefinedOr(row.expected.elements));
  assert.strictEqual(plan.frames.length, frames.length);
  for (let index = 0; index < frames.length; index++) assertFrameAt(row, plan, index);
};
/**
 * Assert every authored source projection field and the complete public tree.
 * Historical originals and specifically reviewed versioned views stay separate.
 * **Example** (Use the source control)
 * ```ts
 * import { assertFiniteSourceConformance } from "./helpers/ClaimElementFiniteConformance.ts"
 * console.log(typeof assertFiniteSourceConformance) // "function"
 * ```
 * @category testing
 * @since 0.0.0
 */
export const assertFiniteSourceConformance = Effect.fn("FiniteTopology.runControl")(function* (input: unknown) {
  const originalRow = yield* S.decodeUnknownEffect(source)(input);
  const row = yield* correctedSourceRow(originalRow);
  const result = yield* decomposeFiniteSourceFixture(row);
  assert.strictEqual(result.plans.length, row.outcome === "admitted" ? 1 : 0);
  if (row.outcome !== "admitted") return;
  const bound = O.getOrThrow(A.head(result.plans));
  const plan = bound.sourcePlan;
  const nominals = O.getOrThrow(O.fromUndefinedOr(row.expected.nominals));
  assert.deepStrictEqual(
    A.map(plan.nominals, (n) => ({
      core: n.core,
      head: n.head,
      outer: n.outer,
      determiner: n.nominal.determiner,
      role: n.nominal.role,
    })),
    A.map(nominals, (n) => ({ core: n.core, head: n.head, outer: n.outer, determiner: n.determiner, role: n.role }))
  );
  const elements = O.getOrThrow(O.fromUndefinedOr(row.expected.elements));
  assert.deepStrictEqual(
    A.map(plan.elements, (element) => ({
      parent: O.getOrNull(element.parent),
      kind: element.kind,
      extent: element.extent,
      lexicalHeader: element.lexicalHeader,
    })),
    A.map(elements, (element) => ({
      parent:
        element.parent === null
          ? null
          : O.getOrThrow(A.findFirstIndex(elements, (candidate) => candidate.id === element.parent)) + 1,
      kind: element.kind,
      extent: element.extent,
      lexicalHeader: element.lexicalHeader,
    }))
  );
  assertSourceTokens(row, plan);
  assertPrivateSourceFacts(row, plan);
  assertFrames(row, plan);
  const publicExpected = yield* S.decodeUnknownEffect(publicControls)(wire);
  const publicRow = A.findFirst(publicExpected.positive, (candidate) => candidate.case === originalRow.case);
  const publicTree = O.isSome(publicRow)
    ? publicRow.value.tree
    : O.getOrThrow(O.fromUndefinedOr(originalRow.expected.publicTree));
  if (O.isSome(publicRow))
    assert.deepStrictEqual(publicTree, O.getOrThrow(O.fromUndefinedOr(originalRow.expected.publicTree)));
  const actual = O.getOrThrow(A.head(result.decompositions));
  if (actual.status !== "decomposed") throw new Error("admitted source must decompose");
  const versionedPublicTree = yield* correctedPublicTree(row, publicTree);
  assert.deepStrictEqual(actual.tree, versionedPublicTree);
});
