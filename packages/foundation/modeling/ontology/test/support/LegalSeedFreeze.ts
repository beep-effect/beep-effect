import { N3ParseTurtleRequest, N3TurtleCodec } from "@beep/n3";
import { DocketingVocabulary, LegalRoleVocabulary, PartyKindVocabulary, SemanticFoundationSeed } from "@beep/ontology";
import { mappingPredicateIri } from "@beep/ontology/Mapping";
import * as Rdf from "@beep/rdf/Rdf";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TaxonomySeed, VocabularySeed } from "@beep/ontology";

class LegalSeedFreezeReadError extends S.TaggedError<LegalSeedFreezeReadError, { readonly brand: unique symbol }>()(
  "LegalSeedFreezeReadError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed seed file read in the legal seed freeze support." }
) {}

export const FrozenConcept = S.Struct({
  iri: S.String,
  notation: S.optionalKey(S.String),
});

export const FrozenScheme = S.Struct({
  scheme: S.String,
  version: S.optionalKey(S.String),
  concepts: S.Array(FrozenConcept),
});

export const FrozenStatement = S.Struct({
  subject: S.String,
  predicate: S.String,
  object: S.String,
});

export const LegalSeedFreeze = S.Struct({
  schemes: S.Array(FrozenScheme),
  files: S.Record(S.String, S.String),
  turtleParses: S.Record(S.String, S.Boolean),
  legalIntakeParity: S.Union([
    S.TaggedStruct("Parsed", {
      renderingOnly: S.Array(FrozenStatement),
      seedOnly: S.Array(FrozenStatement),
    }),
    S.TaggedStruct("Refused", { message: S.String }),
  ]),
});

export type LegalSeedFreeze = typeof LegalSeedFreeze.Type;

export const LegalSeedFreezeJson = S.fromJsonString(LegalSeedFreeze);

export const seedFiles = [
  "docketing.jsonld",
  "docketing.ttl",
  "legal-intake.jsonld",
  "legal-intake.ttl",
  "party-roles.jsonld",
  "party-roles.ttl",
] as const;

const turtleFiles = ["docketing.ttl", "legal-intake.ttl", "party-roles.ttl"] as const;

const skos = "http://www.w3.org/2004/02/skos/core#";
const dcterms = "http://purl.org/dc/terms/";
const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const beep = "https://beep-effect.com/ns/ontology/semantic-foundation/";

const readBytes = (path: string) =>
  Effect.tryPromise({
    try: () => Bun.file(path).bytes(),
    catch: (cause) => LegalSeedFreezeReadError.make({ cause }),
  }).pipe(Effect.orDie);

const vocabularyScheme = (seed: VocabularySeed) => ({
  scheme: seed.schemeIri,
  version: seed.version,
  concepts: A.map(seed.concepts, (concept) => ({ iri: concept.iri, notation: concept.notation })),
});

const intakeScheme = (seed: TaxonomySeed) => ({
  scheme: seed.schemeIri,
  concepts: A.appendAll(
    A.map(seed.concepts, (concept) => ({ iri: concept.iri })),
    A.map(seed.filingRoots, (root) => ({ iri: root.iri }))
  ),
});

const objectKey = (object: Rdf.ObjectTerm): string =>
  Rdf.ObjectTerm.match(object, {
    NamedNode: (node) => `<${node.value}>`,
    BlankNode: (node) => `_:${node.value}`,
    Literal: (literal) =>
      O.match(Rdf.Literal.languageOf(literal), {
        onNone: () => `"${literal.value}"`,
        onSome: (language) => `"${literal.value}"@${language}`,
      }),
  });

const statementKey = (statement: typeof FrozenStatement.Type) =>
  `${statement.subject} ${statement.predicate} ${statement.object}`;

const byStatement: Order.Order<typeof FrozenStatement.Type> = Order.mapInput(Order.String, statementKey);

const statement = (subject: string, predicate: string, object: string) => ({ subject, predicate, object });

const iriObject = (iri: string) => `<${iri}>`;

const enObject = (value: string) => `"${value}"@en`;

const plainObject = (value: string) => `"${value}"`;

const intakeProjection = (seed: TaxonomySeed) => [
  statement(seed.schemeIri, rdfType, iriObject(`${skos}ConceptScheme`)),
  statement(seed.schemeIri, `${dcterms}title`, enObject(seed.title)),
  ...A.map(seed.pathTemplateSegments, (segment) =>
    statement(seed.schemeIri, `${beep}pathTemplateSegment`, plainObject(segment))
  ),
  ...A.map(
    A.filter(seed.concepts, (concept) => A.isReadonlyArrayEmpty(concept.broader)),
    (concept: TaxonomySeed["concepts"][number]) =>
      statement(seed.schemeIri, `${skos}hasTopConcept`, iriObject(concept.iri))
  ),
  ...A.flatMap(seed.concepts, (concept) => [
    statement(concept.iri, rdfType, iriObject(`${skos}Concept`)),
    statement(concept.iri, `${skos}inScheme`, iriObject(seed.schemeIri)),
    statement(concept.iri, `${skos}prefLabel`, enObject(concept.prefLabel)),
    statement(concept.iri, `${skos}definition`, enObject(concept.definition)),
    ...A.map(concept.broader, (broader) => statement(concept.iri, `${skos}broader`, iriObject(broader))),
    ...A.map(concept.alignments, (alignment) =>
      statement(concept.iri, mappingPredicateIri(alignment.predicate), iriObject(alignment.target))
    ),
  ]),
  ...A.flatMap(seed.filingRoots, (root) => [
    statement(root.iri, rdfType, iriObject(`${skos}Concept`)),
    statement(root.iri, `${skos}inScheme`, iriObject(seed.schemeIri)),
    statement(root.iri, `${beep}rootSegment`, plainObject(root.rootSegment)),
  ]),
];

const difference = (
  left: ReadonlyArray<typeof FrozenStatement.Type>,
  right: ReadonlyArray<typeof FrozenStatement.Type>
) => {
  const keys = HashSet.fromIterable(A.map(right, statementKey));
  return A.sort(
    A.filter(left, (entry) => !HashSet.has(keys, statementKey(entry))),
    byStatement
  );
};

export const observeLegalSeeds = Effect.fnUntraced(function* (seedDirectory: string) {
  const digest = yield* Digest.Digest;
  const codec = yield* N3TurtleCodec;
  const files: Record<string, string> = {};
  for (const file of seedFiles) {
    const bytes = yield* readBytes(`${seedDirectory}/${file}`);
    files[file] = yield* digest.digestHex(Digest.sha256, bytes);
  }
  const rendering = yield* readBytes(`${seedDirectory}/legal-intake.ttl`).pipe(
    Effect.map((bytes) => new TextDecoder().decode(bytes))
  );
  const turtleParses: Record<string, boolean> = {};
  for (const file of turtleFiles) {
    const bytes = yield* readBytes(`${seedDirectory}/${file}`);
    const source = new TextDecoder().decode(bytes);
    turtleParses[file] = yield* codec.parse(N3ParseTurtleRequest.make({ source })).pipe(
      Effect.as(true),
      Effect.catchTag("N3TurtleCodecError", () => Effect.succeed(false))
    );
  }
  const projected = intakeProjection(SemanticFoundationSeed);
  const legalIntakeParity = yield* codec.parse(N3ParseTurtleRequest.make({ source: rendering })).pipe(
    Effect.map((parsed) => {
      const rendered = A.map(A.fromIterable(parsed.dataset.quads), (quad) =>
        statement(quad.subject.value, quad.predicate.value, objectKey(quad.object))
      );
      return {
        _tag: "Parsed" as const,
        renderingOnly: difference(rendered, projected),
        seedOnly: difference(projected, rendered),
      };
    }),
    Effect.catchTag("N3TurtleCodecError", (error) =>
      Effect.succeed({ _tag: "Refused" as const, message: Str.split("\n")(error.message)[0] ?? "" })
    )
  );
  return {
    schemes: [
      vocabularyScheme(DocketingVocabulary),
      vocabularyScheme(PartyKindVocabulary),
      vocabularyScheme(LegalRoleVocabulary),
      intakeScheme(SemanticFoundationSeed),
    ],
    files,
    turtleParses,
    legalIntakeParity,
  } satisfies LegalSeedFreeze;
});
