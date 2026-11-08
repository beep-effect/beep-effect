/** Original Resource comparison replay, eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationDetachedId, CitationGroupMember } from "@beep/law-practice-domain/values";
import { CitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationResourceModelInput,
  CitationResourceModels,
  CitationResourceObjectFailure,
  makeCitationResourceObjects,
} from "@beep/law-practice-server/internal/Citation/ResourceObjects";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { installCitationCanonicalFactory } from "./CitationCanonicalDefaultFactory.fixtures.ts";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";

const Value = S.Struct({ kind: S.tag("value"), value: S.JsonObject });
const Criterion = S.Struct({
  context: S.Struct({ values: S.JsonObject }),
  operands: S.Tuple([Value, Value]),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const Resource = S.Struct({
  fields: S.Struct({ citation: S.JsonObject }),
  pythonType: S.tag("eyecite.models.Resource"),
});
const Context = S.Struct({ resources: S.Array(Resource).check(S.isBetweenLength(2, 2)) });
const Integer = S.Struct({ integer: S.BigIntFromString });
const missingModel = () => CitationResourceObjectFailure.make({ reason: "model-failed" });

/** Recompute original equal Resources using the existing owned live registry.
 * Detached semantic references never fabricate verified source occurrences.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalResourceComparison = Effect.fn("CanonicalResourceTest.replay")(function* () {
  const { assertions } = yield* readCitationCanonicalCaptures();
  const factory = yield* installCitationCanonicalFactory();
  const policy = yield* defaultCitationEnginePolicy;
  const prefix = "tests.test_ModelsTest.ModelsTest.test_resource_comparison::tests/test_ModelsTest.py:";
  const events = yield* Effect.forEach(
    [36, 37],
    Effect.fnUntraced(function* (line) {
      const row = yield* Effect.fromOption(HashMap.get(assertions, `${prefix}${line}:8:caseDeclaration::1`));
      return yield* S.decodeEffect(Criterion)(row.payload);
    })
  );
  const equality = A.getUnsafe(events, 0);
  const context = yield* S.decodeUnknownEffect(Context)(equality.context.values);
  const profile = { family: "case", reporter: "U.S.", factory: "case_citation", line: 48 } as const;
  const defaultModel = yield* factory.create(profile);
  const reference = yield* Effect.fromOption(defaultModel.publication.selectedEdition);
  const citations = yield* Effect.forEach([0, 1], () =>
    factory.create(profile, { reporter: "U.S.", volume: "2", page: "2", reference })
  );
  yield* Effect.forEach(citations, (citation, i) =>
    compareCitationCanonicalModel(citation, A.getUnsafe(context.resources, i).fields.citation, "resource comparison")
  );
  const expectedOperands = yield* Effect.forEach(equality.operands, (operand) =>
    S.decodeUnknownEffect(Resource)(operand.value)
  );
  expect(expectedOperands).toEqual(context.resources);
  const persistentId =
    "tests.test_ModelsTest.ModelsTest.test_persistent_hash::tests/test_ModelsTest.py:194:12:caseDeclaration::4";
  const persistentRow = yield* Effect.fromOption(HashMap.get(assertions, persistentId));
  const persistent = yield* S.decodeEffect(Criterion)(persistentRow.payload);
  const persistentResource = yield* S.decodeUnknownEffect(Resource)(persistent.context.values.citation);
  yield* compareCitationCanonicalModel(defaultModel, persistentResource.fields.citation, persistentId);
  const ids = A.map(["0", "1", "2"], (digit) => CitationDetachedId.make(`cd1:${Str.repeat(64)(digit)}`));
  const references = A.map(ids, (detachedId) => CitationGroupMember.cases.Detached.make({ detachedId }));
  const modelRows = HashMap.fromIterable(
    A.map(A.append(citations, defaultModel), (citation, i) => [A.getUnsafe(ids, i), citation] as const)
  );
  const models = CitationResourceModels.of({
    read: Effect.fn("CanonicalResourceTest.read")(function* (reference: CitationGroupMember) {
      if (reference._tag !== "Detached") return yield* missingModel();
      const citation = yield* Effect.fromOption(HashMap.get(modelRows, reference.detachedId), missingModel);
      return CitationResourceModelInput.make({ citation, missingPageIdentityHash: O.none() });
    }),
    step: Effect.void,
  });
  yield* Effect.acquireUseRelease(
    makeCitationResourceObjects(policy.limits).pipe(
      Effect.provideService(CitationResourceModels, models),
      Effect.provideService(CitationFrozenEditions, factory.owner)
    ),
    Effect.fnUntraced(function* (objects) {
      const resources = yield* Effect.forEach(references, objects.create);
      expect(A.getUnsafe(resources, 0)).not.toBe(A.getUnsafe(resources, 1));
      const keys = yield* Effect.forEach(resources, objects.key);
      const equal = yield* objects.comparison.equal(A.getUnsafe(keys, 0).objectId, A.getUnsafe(keys, 1).objectId);
      expect(equal).toBe(true);
      const hashEvent = A.getUnsafe(events, 1);
      const hashContext = yield* S.decodeUnknownEffect(Context)(hashEvent.context.values);
      expect(hashContext).toEqual(context);
      const expectedHashes = yield* Effect.forEach(
        hashEvent.operands,
        Effect.fnUntraced(function* (operand) {
          return (yield* S.decodeUnknownEffect(Integer)(operand.value)).integer;
        })
      );
      expect(A.map(A.take(keys, 2), (key) => key.hash)).toEqual(expectedHashes);
      const persistentHashes = yield* Effect.forEach(
        persistent.operands,
        Effect.fnUntraced(function* (operand) {
          return (yield* S.decodeUnknownEffect(Integer)(operand.value)).integer;
        })
      );
      expect(persistentHashes[0]).toBe(persistentHashes[1]);
      expect(A.getUnsafe(keys, 2).hash).toBe(persistentHashes[1]);
      const retained = yield* Effect.forEach(resources, objects.referenceOf);
      expect(retained).toEqual(references);
    }),
    (objects) => objects.close
  );
});
