/** Original ResolveTest assertion criteria from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { citationAuthorityMentionIds } from "@beep/law-practice-domain/values";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { CitationDocument } from "@beep/law-practice-domain/values";

const sourceSites = [
  ["tests/test_ResolveTest.py:29:33:resolve_citations", "tests/test_ResolveTest.py:30:8:caseDeclaration"],
  ["tests/test_ResolveTest.py:78:29:resolve_citations", "tests/test_ResolveTest.py:89:8:caseDeclaration"],
] as const;
const Common = {
  passed: S.tag(true),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
  context: S.Struct({ values: S.Struct({ citations: S.Array(S.JsonObject) }) }),
};
const FormattedValue = S.Record(S.String, S.Array(S.String));
const FormattedOperand = S.Struct({ kind: S.tag("value"), value: FormattedValue });
const Formatted = S.fromJsonString(S.Struct({ ...Common, operands: S.Tuple([FormattedOperand, FormattedOperand]) }));
const IndicesValue = S.Natural.pipe(S.Array, S.Array);
const IndicesOperand = S.Struct({ kind: S.tag("value"), value: IndicesValue });
const Indices = S.fromJsonString(
  S.Struct({
    ...Common,
    context: S.Struct({
      values: S.Struct({
        ...Common.context.fields.values.fields,
        expected_indices: IndicesValue,
        actual_indices: IndicesValue,
      }),
    }),
    operands: S.Tuple([IndicesOperand, IndicesOperand]),
  })
);
const Capture = S.fromJsonString(S.Struct({ events: S.Array(S.Struct({ id: S.String, payload: S.String })) }));
const SourceModels = S.Array(S.JsonObject);
const Views = S.Array(S.Struct({ matchedText: S.String, correctedCitation: S.String }));
const SourceGroups = S.Array(
  S.Struct({
    members: S.Array(S.Natural).check(S.isMinLength(1)),
    resource: S.Struct({ pythonType: S.tag("eyecite.models.Resource"), fields: S.Struct({ citation: S.JsonObject }) }),
  })
);

const readAssertions = Effect.fn("CanonicalResolutionTest.readAssertions")(function* () {
  const capture = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  ).pipe(Effect.flatMap(S.decodeEffect(Capture)));
  const rows = A.filter(capture.events, (row) =>
    A.some(sourceSites, ([, site]) => Str.includes(`::${site}::`)(row.id))
  );
  expect(rows).toHaveLength(30);
  const decoded = yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      if (Str.includes(`::${sourceSites[0][1]}::`)(row.id)) {
        const criterion = yield* S.decodeEffect(Formatted)(row.payload);
        expect(criterion.operands[0].value, row.id).toEqual(criterion.operands[1].value);
        return { kind: "formatted" as const, id: row.id, criterion };
      }
      const criterion = yield* S.decodeEffect(Indices)(row.payload);
      expect(criterion.operands[0].value, row.id).toEqual(criterion.context.values.expected_indices);
      expect(criterion.operands[1].value, row.id).toEqual(criterion.context.values.actual_indices);
      expect(criterion.operands[0].value, row.id).toEqual(criterion.operands[1].value);
      return { kind: "indices" as const, id: row.id, criterion };
    })
  );
  expect(A.filter(decoded, (row) => row.kind === "formatted")).toHaveLength(23);
  expect(A.filter(decoded, (row) => row.kind === "indices")).toHaveLength(7);
  return HashMap.fromIterable(A.map(decoded, (row) => Tuple.make(row.id, row)));
});
const formatDocument = Effect.fn("CanonicalResolutionTest.formatDocument")(function* (document: CitationDocument) {
  const quotes = HashMap.fromIterable(
    A.map(document.mentions, (mention) => Tuple.make(mention.id, mention.anchor.anchor.quote))
  );
  const entries = yield* Effect.forEach(
    document.authorities,
    Effect.fnUntraced(function* (authority) {
      const members = yield* Effect.forEach(citationAuthorityMentionIds(document, authority.id), (id) =>
        Effect.fromOption(HashMap.get(quotes, id))
      );
      const key = yield* Effect.fromOption(A.get(members, 0));
      return Tuple.make(key, members);
    })
  );
  // Python dict-comprehension overwrites duplicate matched-text keys. The source
  // assertion compares this view; exact group membership is checked separately.
  return R.fromEntries(entries);
});
const referenceIndices = Effect.fn("CanonicalResolutionTest.referenceIndices")(function* (
  models: ReadonlyArray<S.JsonObject>,
  formatted: typeof FormattedValue.Type,
  id: string
) {
  const views = yield* S.decodeUnknownEffect(Views)(models);
  // These seven original scenes have unique labels and identical corrected/raw
  // citation strings. Check that condition instead of assuming a general getter law.
  const labels = A.map(views, (model) => model.matchedText);
  expect(labels, id).toEqual(A.map(views, (model) => model.correctedCitation));
  expect(A.dedupe(labels), id).toHaveLength(labels.length);
  const indices = R.fromEntries(A.map(labels, (label, index) => Tuple.make(label, index)));
  return yield* Effect.forEach(R.values(formatted), (members) =>
    Effect.forEach(members, (member) => Effect.fromOption(R.get(indices, member)))
  );
});
/** Bind every original resolve operation to its exact assertion and input models.
 * Verified witness quotes represent the original matched-text labels only; this
 * does not qualify upstream extraction, native hashes or general model getters.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationCanonicalResolutionComparison = Effect.fn("CanonicalResolutionTest.makeComparison")(
  function* () {
    const assertions = yield* readAssertions();
    const seen = yield* Ref.make(HashSet.empty<string>());
    const compare = Effect.fn("CanonicalResolutionTest.compare")(function* (
      operationId: string,
      rawModels: unknown,
      rawGroups: unknown,
      document: CitationDocument
    ) {
      const [from, to] = yield* Effect.fromOption(
        A.findFirst(sourceSites, ([site]) => Str.includes(`::${site}::`)(operationId))
      );
      const id = Str.replace(from, to)(operationId);
      const assertion = yield* Effect.fromOption(HashMap.get(assertions, id));
      const previous = yield* Ref.getAndUpdate(seen, HashSet.add(id));
      expect(HashSet.has(previous, id), id).toBe(false);
      const models = yield* S.decodeUnknownEffect(SourceModels)(rawModels);
      expect(models, id).toEqual(assertion.criterion.context.values.citations);
      const sourceGroups = yield* S.decodeUnknownEffect(SourceGroups)(rawGroups);
      // Every one of these 45 default source groups retains its resource citation
      // as the first member. Validate the whole model before using that finite law;
      // the public optional authority example is not a resource-key capability.
      for (const group of sourceGroups) {
        expect(group.resource.fields.citation, id).toEqual(A.getUnsafe(models, A.getUnsafe(group.members, 0)));
      }
      const formatted = yield* formatDocument(document);
      if (assertion.kind === "formatted") expect(formatted, id).toEqual(assertion.criterion.operands[1].value);
      else {
        const indices = yield* referenceIndices(models, formatted, id);
        expect(indices, id).toEqual(assertion.criterion.operands[0].value);
      }
    });
    return { compare, verify: Ref.get(seen).pipe(Effect.map((ids) => expect(HashSet.size(ids)).toBe(30))) };
  }
);
