/** Default test-factory semantic/hash observations, eyecite 2.7.6 BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationEditionRef,
  FullCaseCitation,
  FullJournalCitation,
  FullLawCitation,
} from "@beep/law-practice-domain/values";
import { CitationAuthorityEdition } from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import {
  CitationCaseResourceHashInput,
  makeCitationCaseResourceHash,
} from "@beep/law-practice-server/internal/Citation/CaseResourceHash";
import {
  makeCitationFrozenEditions,
  readCitationFrozenEdition,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationPublicationResourceHashInput,
  makeCitationPublicationResourceHash,
} from "@beep/law-practice-server/internal/Citation/PublicationResourceHash";
import { makeCitationSemanticVocabulary } from "@beep/law-practice-server/internal/Citation/SemanticVocabulary";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";

const profiles = [
  { family: "case", reporter: "U.S.", factory: "case_citation", line: 48 },
  { family: "journal", reporter: "Minn. L. Rev.", factory: "journal_citation", line: 80 },
  { family: "law", reporter: "Mass. Gen. Laws", factory: "law_citation", line: 71 },
] as const;
const Value = S.Struct({ kind: S.tag("value"), value: S.JsonObject });
const Equal = S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) });
const Criterion = S.Struct({
  context: S.Struct({ values: S.JsonObject }),
  operands: S.Tuple([Value, Value]),
  relation: Equal,
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const FactoryContext = S.Struct({
  citations: S.Array(S.JsonObject).check(S.isBetweenLength(2, 2)),
  factory: S.Struct({
    callable: S.String,
    line: S.Int,
    path: S.tag("eyecite/test_factories.py"),
    sourceSha256: S.tag("6ce47cbbc600416c1f67233f76381aff8bbf46f3a246af96e45d2c4322415744"),
  }),
});
const Integer = S.Struct({ integer: S.BigIntFromString });
const EditionName = S.Struct({ fields: S.Struct({ short_name: S.String }) }).pipe(S.fromJsonString);
const common = { pinCite: null, parenthetical: null, year: null, month: null, day: null };

const installFactory = Effect.fn("CanonicalDefaultFactoryTest.install")(function* () {
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const assetPath = yield* path.fromFileUrl(new URL("../assets/citation/semantic-editions.json", import.meta.url));
  const text = yield* fs.readFileString(assetPath);
  const vocabulary = yield* makeCitationSemanticVocabulary(text);
  const names = yield* Effect.forEach(
    bundle.editions,
    Effect.fnUntraced(function* (row) {
      const value = yield* S.decodeEffect(EditionName)(row.payload);
      return { reference: CitationEditionRef.make(row.ref), name: value.fields.short_name };
    })
  );
  const create = Effect.fn("CanonicalDefaultFactoryTest.create")(function* (profile: (typeof profiles)[number]) {
    const candidates = A.filter(names, (row) => row.name === profile.reporter);
    // Every default used here has one exact named edition, so original [0]
    // selection is unambiguous without borrowing an assertion's edition guess.
    expect(candidates).toHaveLength(1);
    const reference = A.getUnsafe(candidates, 0).reference;
    yield* readCitationFrozenEdition(owner, reference);
    const publication = { editions: [reference], selectedEdition: reference };
    if (profile.family === "law")
      return yield* S.decodeEffect(FullLawCitation)({
        type: "law",
        components: { reporter: profile.reporter },
        publication,
        metadata: { ...common, publisher: null },
      });
    const components = { reporter: profile.reporter, volume: "1", page: "1" };
    if (profile.family === "journal")
      return yield* S.decodeEffect(FullJournalCitation)({ type: "journal", components, publication, metadata: common });
    const identity = yield* vocabulary.lookup(reference, "case");
    if (identity.family !== "case") return yield* Effect.die("Expected default case edition");
    return yield* S.decodeEffect(FullCaseCitation)({
      type: "case",
      components,
      publication: {
        vocabularyVersion: vocabulary.vocabularyVersion,
        editions: [{ edition: reference, reporterId: identity.reporterId }],
        selectedEdition: reference,
      },
      metadata: {
        ...common,
        court: { status: "known", id: "scotus", vocabularyVersion: vocabulary.vocabularyVersion },
        plaintiff: null,
        defendant: null,
        additionalText: null,
        antecedentGuess: null,
        shortCaseName: null,
        caseName: null,
      },
    });
  });
  const hash = Effect.fn("CanonicalDefaultFactoryTest.hash")(function* (
    citation: FullCaseCitation | FullLawCitation | FullJournalCitation
  ) {
    if (citation.type !== "case") {
      const editions = yield* owner.lookupMany(citation.publication.editions, citation.type);
      return yield* makeCitationPublicationResourceHash(
        CitationPublicationResourceHashInput.make({ citation, editions })
      );
    }
    const reference = yield* Effect.fromOption(citation.publication.selectedEdition);
    const edition = yield* readCitationFrozenEdition(owner, reference);
    return yield* makeCitationCaseResourceHash(
      CitationCaseResourceHashInput.make({
        citation,
        selectedEdition: O.some(
          CitationAuthorityEdition.make({ edition: reference, shortName: edition.value.short_name })
        ),
        missingPageIdentityHash: O.none(),
      })
    );
  });
  return { create, hash };
});
const integerOperands = Effect.fn("CanonicalDefaultFactoryTest.integers")(function* (criterion: typeof Criterion.Type) {
  return yield* Effect.forEach(
    criterion.operands,
    Effect.fnUntraced(function* (operand) {
      return (yield* S.decodeUnknownEffect(Integer)(operand.value)).integer;
    })
  );
});

/** Rebuild default semantic factory inputs, then compare original hash/equality outputs.
 * Fake token positions are never used as verified evidence. General retained
 * factory/token/resource protocols remain separate from these finite assertions.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalDefaultFactory = Effect.fn("CanonicalDefaultFactoryTest.replay")(function* () {
  const { assertions } = yield* readCitationCanonicalCaptures();
  const factory = yield* installFactory();
  const read = Effect.fn("CanonicalDefaultFactoryTest.read")(function* (id: string) {
    const event = yield* Effect.fromOption(HashMap.get(assertions, id));
    return yield* S.decodeEffect(Criterion)(event.payload);
  });
  for (const [index, profile] of profiles.entries()) {
    const prefix = "tests.test_ModelsTest.ModelsTest.test_citation_comparison::tests/test_ModelsTest.py:";
    const equality = yield* read(`${prefix}24:12:caseDeclaration::${index + 1}`);
    const context = yield* S.decodeUnknownEffect(FactoryContext)(equality.context.values);
    expect(context.factory.callable).toBe(`eyecite.test_factories.${profile.factory}`);
    expect(context.factory.line).toBe(profile.line);
    const models = yield* Effect.forEach([0, 1], () => factory.create(profile));
    yield* Effect.forEach(models, (model, i) =>
      compareCitationCanonicalModel(model, A.getUnsafe(context.citations, i), profile.family)
    );
    expect(A.map(equality.operands, (value) => value.value)).toEqual(context.citations);
    const hashes = yield* Effect.forEach(models, factory.hash);
    expect(A.getUnsafe(hashes, 0).citationHash === A.getUnsafe(hashes, 1).citationHash).toBe(true);
    const comparison = yield* read(`${prefix}25:12:caseDeclaration::${index + 1}`);
    expect(comparison.context.values.citations).toEqual(context.citations);
    const comparisonHashes = yield* integerOperands(comparison);
    expect(A.map(hashes, (value) => value.citationHash)).toEqual(comparisonHashes);
    const persistentId = `tests.test_ModelsTest.ModelsTest.test_persistent_hash::tests/test_ModelsTest.py:194:12:caseDeclaration::${index + 1}`;
    const persistent = yield* read(persistentId);
    yield* compareCitationCanonicalModel(A.getUnsafe(models, 0), persistent.context.values.citation, persistentId);
    const expected = yield* integerOperands(persistent);
    expect(expected[0]).toBe(expected[1]);
    expect(A.getUnsafe(hashes, 0).citationHash, persistentId).toBe(expected[1]);
  }
  const resourceId =
    "tests.test_ModelsTest.ModelsTest.test_persistent_hash::tests/test_ModelsTest.py:194:12:caseDeclaration::4";
  const resource = yield* read(resourceId);
  const wrapper = yield* S.decodeUnknownEffect(
    S.Struct({ fields: S.Struct({ citation: S.JsonObject }), pythonType: S.tag("eyecite.models.Resource") })
  )(resource.context.values.citation);
  const actual = yield* factory.create(profiles[0]);
  yield* compareCitationCanonicalModel(actual, wrapper.fields.citation, resourceId);
  const hashes = yield* factory.hash(actual);
  const expected = yield* integerOperands(resource);
  expect(expected[0]).toBe(expected[1]);
  expect(hashes.resourceHash, resourceId).toBe(expected[1]);
});
