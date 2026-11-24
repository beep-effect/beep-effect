import { $I as $BeepId } from "@beep/identity/packages";
import { IntakeTaxonomy } from "@beep/law-practice-domain/values/IntakeTaxonomy";
import {
  IntakeTaxonomyNotLoaded,
  intakeScheme,
  intakeTaxonomy,
  intakeTaxonomyPayloadId,
  LegalVocabularyKind,
  legalVocabularyManifestUrl,
  pinFor,
  scheme,
} from "@beep/law-practice-domain/values/LegalVocabularyPack";
import { ConceptSchemePin, checkBroader } from "@beep/ontology/ConceptScheme";
import { ConceptSchemeVersionMismatch, LoadedPack } from "@beep/ontology/TaxonomyLoader";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { legalPackLayer, loadLegalPack } from "./support/LegalPack.ts";
import type { ConceptScheme } from "@beep/ontology/ConceptScheme";

class PackFixtureReadError extends S.TaggedError<PackFixtureReadError, { readonly brand: unique symbol }>()(
  "PackFixtureReadError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed fixture read in LegalVocabularyPack.test.ts." }
) {}

const FrozenConcept = S.Struct({ iri: S.String, notation: S.optionalKey(S.String) });
const FrozenScheme = S.Struct({
  scheme: S.String,
  version: S.optionalKey(S.String),
  concepts: S.Array(FrozenConcept),
});
const Freeze = S.Struct({
  schemes: S.Array(FrozenScheme),
  files: S.Record(S.String, S.String),
  turtleParses: S.Record(S.String, S.Boolean),
  legalIntakeParity: S.TaggedStruct("Refused", { message: S.String }),
});
const CompetencyFixture = S.Struct({
  cq: S.Finite,
  kind: LegalVocabularyKind,
  version: S.String,
  notation: S.String,
  expectedIri: S.String,
});

const readFixture = <A>(file: string, schema: S.Codec<A, string>) =>
  Effect.tryPromise({
    try: () => Bun.file(`test/fixtures/${file}`).text(),
    catch: (cause) => PackFixtureReadError.make({ cause }),
  }).pipe(Effect.flatMap(S.decodeEffect(schema)), Effect.orDie);

const freeze = readFixture("legal-seed-freeze.json", S.fromJsonString(Freeze));
const competency = readFixture("vocabulary-competency.json", CompetencyFixture.pipe(S.Array, S.fromJsonString));

const byIri = Order.mapInput(Order.String, (concept: typeof FrozenConcept.Type) => concept.iri);

const frozenScheme = (loaded: ConceptScheme) => ({
  scheme: loaded.iri,
  version: loaded.version,
  concepts: A.sort(
    A.map(A.fromIterable(loaded.concepts), (concept) =>
      O.match(concept.notation, {
        onNone: () => ({ iri: concept.iri }),
        onSome: (notation) => ({ iri: concept.iri, notation }),
      })
    ),
    byIri
  ),
});

const sortedConcepts = (entry: typeof FrozenScheme.Type) => ({ ...entry, concepts: A.sort(entry.concepts, byIri) });

const byNotation = (loaded: ConceptScheme, notation: string) =>
  A.findFirst(A.fromIterable(loaded.concepts), (concept) => O.contains(concept.notation, notation));

const payload = (pack: LoadedPack, id: string) =>
  Effect.fromOption(HashMap.get(pack.payloads, id), () => IntakeTaxonomyNotLoaded.make({ id }));

it.layer(legalPackLayer, { timeout: "30 seconds" })("legal vocabulary pack", (it) => {
  it.effect(
    "loads every scheme and concept IRI, notation and rendering digest the freeze recorded",
    Effect.fnUntraced(function* () {
      const pack = yield* loadLegalPack();
      const fixture = yield* freeze;
      const digest = yield* Digest.Digest;
      const vocabularies = yield* Effect.forEach(LegalVocabularyKind.literals, (kind) => scheme(pack, kind), {
        concurrency: 1,
      });
      const intake = yield* intakeScheme(pack);
      const taxonomy = yield* intakeTaxonomy(pack);
      const intakeFrozen = {
        scheme: intake.iri,
        concepts: A.sort(
          A.appendAll(
            frozenScheme(intake).concepts,
            A.map(taxonomy.filingRoots, (root) => ({ iri: root.iri }))
          ),
          byIri
        ),
      };
      expect([...A.map(vocabularies, frozenScheme), intakeFrozen]).toEqual(A.map(fixture.schemes, sortedConcepts));
      const files = yield* Effect.forEach(
        Rec.keys(fixture.files),
        (file) =>
          payload(pack, Str.replace(".", "-")(file)).pipe(
            Effect.flatMap((bytes) => digest.digestHex(Digest.sha256, bytes)),
            Effect.map((hex) => [file, hex] as const)
          ),
        { concurrency: 1 }
      );
      expect(Rec.fromEntries(files)).toEqual(fixture.files);
      expect(pack.exceptions).toEqual([]);
      expect(A.flatMap([...vocabularies, intake], checkBroader)).toEqual([]);
      expect(Str.endsWith("/assets/vocabulary/manifest.jsonl")(legalVocabularyManifestUrl.pathname)).toBe(true);
    })
  );

  it.effect(
    "records that only the legal-intake Turtle rendering is refused by the parser",
    Effect.fnUntraced(function* () {
      const fixture = yield* freeze;
      expect(fixture.turtleParses).toEqual({
        "docketing.ttl": true,
        "legal-intake.ttl": false,
        "party-roles.ttl": true,
      });
      expect(fixture.legalIntakeParity.message).toBe('Unexpected "beep:taxonomy/legal-intake" on line 5.');
    })
  );

  it.effect(
    "replays CQ 1, 5, 7, 8 and 18 to stable concept IRIs",
    Effect.fnUntraced(function* () {
      const pack = yield* loadLegalPack();
      const fixtures = yield* competency;
      expect(A.dedupe(A.map(fixtures, (fixture) => fixture.cq))).toEqual([1, 5, 7, 8, 18]);
      yield* Effect.forEach(
        fixtures,
        Effect.fnUntraced(function* (fixture) {
          const loaded = yield* scheme(pack, fixture.kind);
          expect(loaded.version).toBe(fixture.version);
          assertSome(
            O.map(byNotation(loaded, fixture.notation), (concept) => concept.iri),
            fixture.expectedIri
          );
        }),
        { concurrency: 1 }
      );
    })
  );

  it.effect(
    "keeps party kinds and legal roles separate and every IRI under the repository namespace",
    Effect.fnUntraced(function* () {
      const pack = yield* loadLegalPack();
      const docketing = yield* scheme(pack, "docketing");
      const partyKinds = yield* scheme(pack, "party-kinds");
      const legalRoles = yield* scheme(pack, "legal-roles");
      const party = HashSet.map(partyKinds.concepts, (concept) => concept.iri);
      expect(HashSet.size(docketing.concepts)).toBe(25);
      expect(HashSet.size(partyKinds.concepts)).toBe(6);
      expect(HashSet.size(legalRoles.concepts)).toBe(11);
      expect(
        HashSet.every(
          legalRoles.concepts,
          (concept) => !HashSet.has(party, concept.iri) && HashSet.isEmpty(concept.broader)
        )
      ).toBe(true);
      expect(
        A.every([docketing, partyKinds, legalRoles], (loaded) =>
          HashSet.every(
            loaded.concepts,
            (concept) => Str.startsWith($BeepId.iri)(concept.iri) && HashSet.isEmpty(concept.alignments)
          )
        )
      ).toBe(true);
      const elective = A.map(["Section15DeclarationDeadline", "OpenDeadlineState"], (notation) =>
        O.exists(
          O.flatMap(byNotation(docketing, notation), (concept) => concept.definition),
          Str.includes("elective")
        )
      );
      expect(elective).toEqual([true, true]);
    })
  );

  it.effect(
    "refuses a pin in another version and has no latest",
    Effect.fnUntraced(function* () {
      const pack = yield* loadLegalPack();
      const latest = ConceptSchemePin.make({ scheme: pinFor("docketing").scheme, version: "latest" });
      const error = yield* pack.schemeFor(latest).pipe(Effect.flip);
      expect(S.is(ConceptSchemeVersionMismatch)(error)).toBe(true);
      const docketing = yield* scheme(pack, "docketing");
      assertNone(byNotation(docketing, "OwnerRole"));
    })
  );

  it.effect(
    "decodes the intake taxonomy and refuses a pack without it",
    Effect.fnUntraced(function* () {
      const pack = yield* loadLegalPack();
      const taxonomy = yield* intakeTaxonomy(pack);
      expect(S.is(IntakeTaxonomy)(taxonomy)).toBe(true);
      expect(taxonomy.pathTemplateSegments).toEqual([
        "root",
        "client",
        "matter",
        "taxonomy-concept",
        "document-class",
        "file-name",
      ]);
      const empty = LoadedPack.make({
        schemes: HashMap.empty(),
        alignments: [],
        exceptions: [],
        payloads: HashMap.empty(),
      });
      const missing = yield* intakeTaxonomy(empty).pipe(Effect.flip);
      expect(S.is(IntakeTaxonomyNotLoaded)(missing)).toBe(true);
      const invalid = LoadedPack.make({
        ...empty,
        payloads: HashMap.make([intakeTaxonomyPayloadId, new TextEncoder().encode("{}")]),
      });
      const refused = yield* intakeTaxonomy(invalid).pipe(Effect.flip);
      expect(refused._tag).toBe("SchemaError");
    })
  );
});
