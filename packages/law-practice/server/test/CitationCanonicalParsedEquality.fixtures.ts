/** Original parsed model equality/hash assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationAuthorityEdition } from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import {
  CitationCaseResourceHashInput,
  makeCitationCaseResourceHash,
} from "@beep/law-practice-server/internal/Citation/CaseResourceHash";
import {
  CitationFrozenEditions,
  readCitationFrozenEdition,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { installCitationParsedResourceReplay } from "./CitationParsedResource.fixtures.ts";
import type { Citation } from "@beep/law-practice-domain/values";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const cohorts = [
  { test: "test_citation_comparison_with_nominative_reporter", calls: [101, 102], model: 107, hash: 108 },
  { test: "test_tax_court_citation_comparison", calls: [131, 132], model: 135, hash: 136 },
] as const;
const Value = S.Struct({ kind: S.tag("value"), value: S.JsonObject });
const EqualRelation = S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) });
const Criterion = S.Struct({
  context: S.Struct({ values: S.Struct({ citations: S.Array(S.JsonObject).check(S.isBetweenLength(2, 2)) }) }),
  operands: S.Tuple([Value, Value]),
  passed: S.tag(true),
  relation: EqualRelation,
}).pipe(S.fromJsonString);
const Integer = S.Struct({ integer: S.BigIntFromString });
const readRows = Effect.fn("CanonicalParsedEqualityTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const calls = HashMap.fromIterable(A.map(operations.cases, (row) => [row.id, row] as const));
  return yield* Effect.forEach(
    cohorts,
    Effect.fnUntraced(function* (cohort) {
      const prefix = `tests.test_ModelsTest.ModelsTest.${cohort.test}::tests/test_ModelsTest.py:`;
      const models = yield* Effect.forEach(
        cohort.calls,
        Effect.fnUntraced(function* (line) {
          const id = `${prefix}${line}:12:get_citations::1`;
          const row = yield* Effect.fromOption(HashMap.get(calls, id));
          if (row.operation !== "get_citations") return yield* Effect.die("Expected original parsed comparison call");
          const body = row.payload.value;
          if (body.outcome.kind !== "success") return yield* Effect.die("Expected successful original parsing");
          expect(
            {
              steps: body.input.clean_steps,
              markup: body.input.markup_text,
              ambiguous: body.input.remove_ambiguous,
              tokenizer: body.input.tokenizer.tokenizer,
            },
            id
          ).toEqual({ steps: null, markup: "", ambiguous: false, tokenizer: "AhocorasickTokenizer" });
          const original = yield* S.decodeEffect(OriginalModels)(body.outcome.value);
          expect(original, id).toHaveLength(1);
          return { id, raw: body.input.plain_text, models: original };
        })
      );
      const criteria = yield* Effect.forEach(
        [cohort.model, cohort.hash],
        Effect.fnUntraced(function* (line) {
          const id = `${prefix}${line}:8:caseDeclaration::1`;
          const event = yield* Effect.fromOption(HashMap.get(assertions, id));
          const criterion = yield* S.decodeEffect(Criterion)(event.payload);
          expect(criterion.context.values.citations, id).toEqual(
            A.map(models, (value) => A.getUnsafe(value.models, 0))
          );
          return { id, criterion };
        })
      );
      const modelCriterion = A.getUnsafe(criteria, 0);
      expect(
        A.map(modelCriterion.criterion.operands, (value) => value.value),
        modelCriterion.id
      ).toEqual(modelCriterion.criterion.context.values.citations);
      const hashCriterion = A.getUnsafe(criteria, 1);
      const hashes = yield* Effect.forEach(
        hashCriterion.criterion.operands,
        Effect.fnUntraced(function* (value) {
          return (yield* S.decodeUnknownEffect(Integer)(value.value)).integer;
        })
      );
      expect(A.getUnsafe(hashes, 0), hashCriterion.id).toBe(A.getUnsafe(hashes, 1));
      return { models, modelId: modelCriterion.id, hashId: hashCriterion.id, hashes };
    })
  );
});
const hashActualCase = Effect.fn("CanonicalParsedEqualityTest.hash")(function* (
  owner: CitationFrozenEditions["Service"],
  citation: Citation
) {
  if (citation.type !== "case") return yield* Effect.die("Expected original full case model");
  const reference = yield* Effect.fromOption(citation.publication.selectedEdition);
  const edition = yield* readCitationFrozenEdition(owner, reference);
  const input = CitationCaseResourceHashInput.make({
    citation,
    selectedEdition: O.some(CitationAuthorityEdition.make({ edition: reference, shortName: edition.value.short_name })),
    missingPageIdentityHash: O.none(),
  });
  return yield* makeCitationCaseResourceHash(input);
});

/** Original comparison cohorts; replay slices must cover every cohort. */
export const citationCanonicalParsedEqualityCohorts = cohorts.length;
/** Recompute raw parsing and the original hash-based equality predicate for one slice of cohorts.
 * Full known-page source hashes are compared exactly; identity-backed models
 * and general retained object/hash protocols stay in separate cohorts.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalParsedEquality = Effect.fn("CanonicalParsedEqualityTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  from: number,
  count: number
) {
  const rows = A.take(A.drop(yield* readRows(), from), count);
  const { replay, service: owner } = yield* installCitationParsedResourceReplay(kind, () => CitationFrozenEditions);
  for (const row of rows) {
    const actual = yield* Effect.forEach(
      row.models,
      Effect.fnUntraced(function* (input) {
        const parsed = yield* replay.extract(input.raw, "plain", input.models, input.id, null);
        return yield* hashActualCase(owner, A.getUnsafe(parsed.citations, 0));
      })
    );
    expect(
      A.map(actual, (value) => value.citationHash),
      row.hashId
    ).toEqual(row.hashes);
    // CitationBase.__eq__ delegates to the exact hash comparison in models.py.
    expect(A.getUnsafe(actual, 0).citationHash === A.getUnsafe(actual, 1).citationHash, row.modelId).toBe(true);
  }
  yield* replay.assertRetired;
});

const OriginalModels = S.Array(S.JsonObject);
