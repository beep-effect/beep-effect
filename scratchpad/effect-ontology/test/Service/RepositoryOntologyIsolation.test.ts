import { DrizzleError } from "@beep/drizzle";
import { PgliteTestLayer } from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import { ArticleRepository } from "../../Repository/Article.ts";
import { CachedClaimRepository } from "../../Repository/CachedClaim.ts";
import { EntityRegistryRepository } from "../../Repository/EntityRegistry.ts";
import { ExamplesRepository } from "../../Repository/Examples.ts";
import { IngestedLinks, LinkBatches, LinkBatchItems } from "../../Repository/schema.ts";

const DatabaseTestLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgliteTestLayer));
const RepositoryTestLayer = Layer.mergeAll(
  ArticleRepository.Default,
  CachedClaimRepository.Default,
  EntityRegistryRepository.Default,
  ExamplesRepository.Default
).pipe(Layer.provideMerge(DatabaseTestLayer));

const resetTables = Effect.fn("RepositoryOntologyIsolation.resetTables")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE IF EXISTS entity_aliases`;
  yield* sql`DROP TABLE IF EXISTS canonical_entities`;
  yield* sql`DROP TABLE IF EXISTS claims`;
  yield* sql`DROP TABLE IF EXISTS articles`;
  yield* sql`
    CREATE TABLE articles (
      id UUID PRIMARY KEY,
      uri TEXT NOT NULL,
      ontology_id TEXT NOT NULL,
      source_name TEXT,
      headline TEXT,
      published_at TIMESTAMPTZ NOT NULL,
      ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      graph_uri TEXT,
      content_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (ontology_id, uri)
    )
  `;
  yield* sql`
    CREATE TABLE claims (
      id UUID PRIMARY KEY,
      article_id UUID NOT NULL,
      ontology_id TEXT NOT NULL,
      subject_iri TEXT NOT NULL,
      predicate_iri TEXT NOT NULL,
      object_value TEXT NOT NULL,
      object_type TEXT DEFAULT 'iri',
      object_datatype TEXT,
      object_language TEXT,
      rank TEXT NOT NULL DEFAULT 'normal',
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      asserted_at TIMESTAMPTZ DEFAULT NOW(),
      derived_at TIMESTAMPTZ,
      deprecated_at TIMESTAMPTZ,
      deprecated_by UUID,
      confidence_score NUMERIC(4, 3),
      evidence_text TEXT,
      evidence_start_offset INTEGER,
      evidence_end_offset INTEGER,
      UNIQUE (article_id, subject_iri, predicate_iri, object_value)
    )
  `;
  yield* sql`
    CREATE TABLE canonical_entities (
      id UUID PRIMARY KEY,
      ontology_id TEXT NOT NULL,
      iri TEXT NOT NULL,
      canonical_mention TEXT NOT NULL,
      types TEXT[] NOT NULL DEFAULT '{}',
      embedding TEXT NOT NULL,
      merge_count INTEGER DEFAULT 1,
      confidence_avg NUMERIC(4, 3),
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ontology_id, iri)
    )
  `;
  yield* sql`
    CREATE TABLE entity_aliases (
      id UUID PRIMARY KEY,
      ontology_id TEXT NOT NULL,
      canonical_entity_id UUID NOT NULL REFERENCES canonical_entities(id),
      mention TEXT NOT NULL,
      mention_normalized TEXT NOT NULL,
      embedding TEXT,
      resolution_method TEXT NOT NULL,
      resolution_confidence NUMERIC(4, 3) NOT NULL,
      first_batch_id TEXT,
      source_article_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ontology_id, mention_normalized)
    )
  `;
});

const OntologyA = "ontology-a";
const OntologyB = "ontology-b";
const ArticleA = "00000000-0000-4000-8000-000000000001";
const ArticleB = "00000000-0000-4000-8000-000000000002";
const ClaimA = "00000000-0000-4000-8000-000000000011";
const ClaimB = "00000000-0000-4000-8000-000000000012";
const EntityA = "00000000-0000-4000-8000-000000000021";
const EntityB = "00000000-0000-4000-8000-000000000022";
const PublishedAt = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-17T12:00:00.000Z"));

describe.sequential("repository ontology isolation", () => {
  it.layer(RepositoryTestLayer)("with two ontology scopes", (it) => {
    it.effect(
      "isolates URI, ID, and cached subject claim lookups",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        const articles = yield* ArticleRepository;
        const claims = yield* CachedClaimRepository;

        yield* articles.insertArticlesBatch([
          {
            id: ArticleA,
            uri: "https://example.test/shared",
            ontologyId: OntologyA,
            headline: "Ontology A",
            publishedAt: PublishedAt,
          },
          {
            id: ArticleB,
            uri: "https://example.test/shared",
            ontologyId: OntologyB,
            headline: "Ontology B",
            publishedAt: PublishedAt,
          },
        ]);
        yield* claims.insertClaimsBatch([
          {
            id: ClaimA,
            articleId: ArticleA,
            ontologyId: OntologyA,
            subjectIri: "https://example.test/entity/shared",
            predicateIri: "https://example.test/predicate/name",
            objectValue: "A",
          },
          {
            id: ClaimB,
            articleId: ArticleB,
            ontologyId: OntologyB,
            subjectIri: "https://example.test/entity/shared",
            predicateIri: "https://example.test/predicate/name",
            objectValue: "B",
          },
        ]);

        const articleA = yield* articles.getArticleByUri("https://example.test/shared", OntologyA);
        const articleB = yield* articles.getArticleByUri("https://example.test/shared", OntologyB);
        const crossScopedArticle = yield* articles.getArticle(ArticleA, OntologyB);
        const claimsA = yield* claims.getClaimsBySubject("https://example.test/entity/shared", OntologyA);
        const claimsB = yield* claims.getClaimsBySubject("https://example.test/entity/shared", OntologyB);
        const crossScopedClaim = yield* claims.getClaim(ClaimA, OntologyB);

        assert.strictEqual(O.map(articleA, (article) => article.id).pipe(O.getOrNull), ArticleA);
        assert.strictEqual(O.map(articleB, (article) => article.id).pipe(O.getOrNull), ArticleB);
        assert.isTrue(O.isNone(crossScopedArticle));
        assert.deepStrictEqual(
          A.map(claimsA, (claim) => claim.id),
          [ClaimA]
        );
        assert.deepStrictEqual(
          A.map(claimsB, (claim) => claim.id),
          [ClaimB]
        );
        assert.isTrue(O.isNone(crossScopedClaim));
      })
    );

    it.effect(
      "applies hasGraphUri inside the requested ontology",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        const articles = yield* ArticleRepository;

        yield* articles.insertArticlesBatch([
          {
            id: ArticleA,
            uri: "https://example.test/with-graph",
            ontologyId: OntologyA,
            graphUri: "https://example.test/graph/a",
            publishedAt: PublishedAt,
          },
          {
            id: ArticleB,
            uri: "https://example.test/without-graph",
            ontologyId: OntologyA,
            publishedAt: PublishedAt,
          },
          {
            id: "00000000-0000-4000-8000-000000000003",
            uri: "https://example.test/other-ontology-graph",
            ontologyId: OntologyB,
            graphUri: "https://example.test/graph/b",
            publishedAt: PublishedAt,
          },
        ]);

        const withGraph = yield* articles.getArticles({ ontologyId: OntologyA, hasGraphUri: true });
        const withoutGraph = yield* articles.getArticles({ ontologyId: OntologyA, hasGraphUri: false });

        assert.deepStrictEqual(
          A.map(withGraph, (article) => article.id),
          [ArticleA]
        );
        assert.deepStrictEqual(
          A.map(withoutGraph, (article) => article.id),
          [ArticleB]
        );
      })
    );

    it.effect(
      "isolates canonical entity IDs, IRIs, and aliases by ontology",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        const sql = yield* SqlClient.SqlClient;
        const registry = yield* EntityRegistryRepository;
        const embeddingA = `[${A.join(A.replicate("0.1", 768), ",")}]`;
        const embeddingB = `[${A.join(A.replicate("0.2", 768), ",")}]`;

        yield* sql`
          INSERT INTO canonical_entities (id, ontology_id, iri, canonical_mention, embedding)
          VALUES (${EntityA}, ${OntologyA}, 'https://example.test/entity/shared', 'Entity A', ${embeddingA}),
                 (${EntityB}, ${OntologyB}, 'https://example.test/entity/shared', 'Entity B', ${embeddingB})
        `;
        yield* sql`
          INSERT INTO entity_aliases (
            id, ontology_id, canonical_entity_id, mention, mention_normalized,
            resolution_method, resolution_confidence
          ) VALUES (
            '00000000-0000-4000-8000-000000000031', ${OntologyA}, ${EntityA},
            'Shared', 'shared', 'exact', 1.0
          ), (
            '00000000-0000-4000-8000-000000000032', ${OntologyB}, ${EntityB},
            'Shared', 'shared', 'exact', 1.0
          )
        `;

        const entityA = yield* registry.getCanonicalEntity(OntologyA, EntityA);
        const crossScopedEntity = yield* registry.getCanonicalEntity(OntologyB, EntityA);
        const iriB = yield* registry.getCanonicalEntityByIri(OntologyB, "https://example.test/entity/shared");
        const aliasesA = yield* registry.getAliasesForCanonical(OntologyA, EntityA);
        const crossScopedAliases = yield* registry.getAliasesForCanonical(OntologyB, EntityA);

        assert.strictEqual(O.map(entityA, (entity) => entity.id).pipe(O.getOrNull), EntityA);
        assert.isTrue(O.isNone(crossScopedEntity));
        assert.strictEqual(O.map(iriB, (entity) => entity.id).pipe(O.getOrNull), EntityB);
        assert.strictEqual(aliasesA.length, 1);
        assert.strictEqual(crossScopedAliases.length, 0);
      })
    );

    it.effect(
      "reports malformed article and claim rows as decodeRows failures",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        const sql = yield* SqlClient.SqlClient;
        const articles = yield* ArticleRepository;
        const claims = yield* CachedClaimRepository;

        yield* sql`
          INSERT INTO articles (id, uri, ontology_id, published_at)
          VALUES (${ArticleA}, 'https://example.test/malformed', '', ${PublishedAt})
        `;
        yield* sql`
          INSERT INTO claims (
            id,
            article_id,
            ontology_id,
            subject_iri,
            predicate_iri,
            object_value,
            rank
          ) VALUES (
            ${ClaimA},
            ${ArticleA},
            ${OntologyA},
            'https://example.test/entity/a',
            'https://example.test/predicate/name',
            'malformed',
            'unknown-rank'
          )
        `;

        const articleError = yield* articles.getArticle(ArticleA, "").pipe(Effect.flip);
        const claimError = yield* claims.getClaim(ClaimA, OntologyA).pipe(Effect.flip);

        assert.instanceOf(articleError, DrizzleError);
        assert.strictEqual(articleError.operation, "decodeRows");
        assert.instanceOf(claimError, DrizzleError);
        assert.strictEqual(claimError.operation, "decodeRows");
      })
    );

    it.effect(
      "rejects malformed LLM example rows as decodeRows failures",
      Effect.fnUntraced(function* () {
        const sql = yield* SqlClient.SqlClient;
        const examples = yield* ExamplesRepository;
        const exampleId = "00000000-0000-4000-8000-000000000041";
        const embedding = `[${A.join(A.replicate("0.1", 768), ",")}]`;

        yield* sql`DROP TABLE IF EXISTS llm_examples`;
        yield* sql`
          CREATE TABLE llm_examples (
            id UUID PRIMARY KEY,
            ontology_id TEXT NOT NULL,
            example_type TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            input_text TEXT NOT NULL,
            target_class TEXT,
            target_predicate TEXT,
            evidence_text TEXT,
            evidence_start_offset INTEGER,
            evidence_end_offset INTEGER,
            expected_output JSONB NOT NULL,
            prompt_messages JSONB,
            explanation TEXT,
            embedding TEXT NOT NULL,
            is_negative BOOLEAN NOT NULL DEFAULT FALSE,
            negative_pattern TEXT,
            usage_count INTEGER DEFAULT 0,
            success_rate NUMERIC(4, 3),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            created_by TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
          )
        `;
        yield* sql`
          INSERT INTO llm_examples (
            id, ontology_id, example_type, input_text, expected_output, embedding
          ) VALUES (
            ${exampleId}, ${OntologyA}, 'malformed', 'input', '{}'::jsonb, ${embedding}
          )
        `;

        const error = yield* examples.getById(exampleId).pipe(Effect.flip);
        assert.instanceOf(error, DrizzleError);
        assert.strictEqual(error.operation, "decodeRows");
      })
    );

    it.effect("enforces persisted link lifecycle domains", () =>
      Effect.sync(() => {
        assert.isTrue(S.is(IngestedLinks.select.fields.status)("processed"));
        assert.isFalse(S.is(IngestedLinks.select.fields.status)("unknown"));
        assert.isTrue(S.is(LinkBatches.select.fields.status)("running"));
        assert.isFalse(S.is(LinkBatches.select.fields.status)("processing"));
        assert.isTrue(S.is(LinkBatchItems.select.fields.status)("processing"));
        assert.isFalse(S.is(LinkBatchItems.select.fields.status)("running"));
      })
    );
  });
});
