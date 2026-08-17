import { DrizzleError } from "@beep/drizzle";
import { PgliteTestLayer } from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import { IRI } from "@beep/rdf";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { assert, describe, it } from "@effect/vitest";
import { Context, DateTime, Effect, Equal, Layer, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HttpRouter } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";
import { ConflictActor, ConflictsQuery, ConflictTransition } from "../../Domain/Schema/Timeline.ts";
import { ArticleRepository } from "../../Repository/Article.ts";
import { ClaimRepository } from "../../Repository/Claim.ts";
import { ConflictRepository } from "../../Repository/Conflict.ts";
import { CurrentConflictActor } from "../../Runtime/HttpMiddleware.ts";
import { TimelineRouter } from "../../Runtime/HttpServer.ts";

const DatabaseTestLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgliteTestLayer));
const RepositoryTestLayer = Layer.mergeAll(
  ArticleRepository.Default,
  ClaimRepository.Default,
  ConflictRepository.Default
).pipe(Layer.provideMerge(DatabaseTestLayer));

const OntologyA = "ontology-a";
const ArticleA = "00000000-0000-4000-8000-000000000001";
const ArticleB = "00000000-0000-4000-8000-000000000002";
const ClaimA = "00000000-0000-4000-8000-000000000011";
const ClaimB = "00000000-0000-4000-8000-000000000012";
const ClaimC = "00000000-0000-4000-8000-000000000013";
const ClaimD = "00000000-0000-4000-8000-000000000014";
const ValidFrom = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-01T00:00:00.000Z"));
const ValidTo = DateTime.toDateUtc(DateTime.makeUnsafe("2026-08-31T00:00:00.000Z"));

const resetTables = Effect.fn("ConflictRepositoryTest.resetTables")(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DROP TABLE IF EXISTS conflicts`;
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
      article_id UUID NOT NULL REFERENCES articles(id),
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
    CREATE TABLE conflicts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ontology_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      claim_a_id UUID NOT NULL REFERENCES claims(id),
      claim_b_id UUID NOT NULL REFERENCES claims(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
      resolution_strategy TEXT,
      accepted_claim_id UUID REFERENCES claims(id),
      resolved_by TEXT,
      resolved_by_fingerprint TEXT,
      resolved_at TIMESTAMPTZ,
      resolution_notes TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (ontology_id, claim_a_id, claim_b_id),
      CONSTRAINT conflicts_conflict_type_check CHECK (conflict_type IN ('position', 'temporal')),
      CONSTRAINT conflicts_canonical_claim_pair_check CHECK (claim_a_id < claim_b_id)
    )
  `;
  yield* sql`
    INSERT INTO articles (id, uri, ontology_id, published_at)
    VALUES (${ArticleA}, 'https://example.test/a', ${OntologyA}, ${ValidFrom}),
           (${ArticleB}, 'https://example.test/b', ${OntologyA}, ${ValidFrom})
  `;
});

const insertConflictFixtures = Effect.fn("ConflictRepositoryTest.insertConflictFixtures")(function* () {
  const claims = yield* ClaimRepository;
  yield* claims.upsertClaimsBatch([
    {
      id: ClaimB,
      articleId: ArticleA,
      ontologyId: OntologyA,
      subjectIri: "https://example.test/entities/position",
      predicateIri: "https://example.test/predicate/value",
      objectValue: "second",
      objectType: "literal",
    },
    {
      id: ClaimA,
      articleId: ArticleA,
      ontologyId: OntologyA,
      subjectIri: "https://example.test/entities/position",
      predicateIri: "https://example.test/predicate/value",
      objectValue: "first",
      objectType: "literal",
    },
    {
      id: ClaimD,
      articleId: ArticleB,
      ontologyId: OntologyA,
      subjectIri: "https://example.test/entities/temporal",
      predicateIri: "https://example.test/predicate/value",
      objectValue: "new",
      objectType: "literal",
      validFrom: ValidFrom,
      validTo: ValidTo,
    },
    {
      id: ClaimC,
      articleId: ArticleB,
      ontologyId: OntologyA,
      subjectIri: "https://example.test/entities/temporal",
      predicateIri: "https://example.test/predicate/value",
      objectValue: "old",
      objectType: "literal",
      validFrom: ValidFrom,
      validTo: ValidTo,
    },
  ]);
});

const HttpActor = ConflictActor.make({
  principal: "api-key",
  credentialFingerprint: O.some("http-test-fingerprint"),
});

const SeededRepositoryTestLayer = Layer.effectDiscard(
  resetTables().pipe(Effect.andThen(insertConflictFixtures()))
).pipe(Layer.provideMerge(RepositoryTestLayer));

const TimelineHttpTestLayer = TimelineRouter.pipe(
  Layer.provideMerge(SeededRepositoryTestLayer),
  Layer.provideMerge(RepositoryTestLayer),
  Layer.provideMerge(Layer.succeed(CurrentConflictActor, HttpActor))
);

describe.sequential("ConflictRepository", () => {
  it.layer(RepositoryTestLayer)("with PGlite persistence", (it) => {
    it.effect(
      "persists canonical position and temporal conflicts transactionally",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        yield* insertConflictFixtures();
        const conflicts = yield* ConflictRepository;
        const records = yield* conflicts.list(ConflictsQuery.make({ ontologyId: OntologyA }));

        assert.strictEqual(records.length, 2);
        assert.deepStrictEqual(
          A.sort(
            A.map(records, (record) => record.conflict.conflictType),
            Order.String
          ),
          ["position", "temporal"]
        );
        assert.isTrue(
          A.every(records, (record) =>
            Order.isLessThan(Order.String)(record.conflict.claimAId, record.conflict.claimBId)
          )
        );
      })
    );

    it.effect(
      "applies filters while keeping total and pending counts independent of pagination",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        yield* insertConflictFixtures();
        const conflicts = yield* ConflictRepository;
        const query = ConflictsQuery.make({
          ontologyId: OntologyA,
          limit: PosInt.make(1),
          offset: NonNegativeInt.make(1),
        });
        const page = yield* conflicts.list(query);
        const counts = yield* conflicts.counts(query);
        const articleCounts = yield* conflicts.counts(
          ConflictsQuery.make({ ontologyId: OntologyA, articleId: O.some(UUID.make(ArticleA)) })
        );
        const subjectCounts = yield* conflicts.counts(
          ConflictsQuery.make({
            ontologyId: OntologyA,
            status: O.some("pending"),
            subject: O.some(IRI.make("https://example.test/entities/position")),
          })
        );

        assert.strictEqual(page.length, 1);
        assert.strictEqual(counts.total, 2);
        assert.strictEqual(counts.pending, 2);
        assert.strictEqual(articleCounts.total, 1);
        assert.strictEqual(subjectCounts.total, 1);
      })
    );

    it.effect(
      "preserves ignored and resolved terminal states during redetection",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        yield* insertConflictFixtures();
        const conflicts = yield* ConflictRepository;
        const records = yield* conflicts.list(ConflictsQuery.make({ ontologyId: OntologyA }));
        const position = yield* Effect.fromOption(
          A.findFirst(records, (record) => Equal.equals(record.conflict.conflictType, "position")),
          () => "missing position conflict"
        ).pipe(Effect.orDie);
        const temporal = yield* Effect.fromOption(
          A.findFirst(records, (record) => Equal.equals(record.conflict.conflictType, "temporal")),
          () => "missing temporal conflict"
        ).pipe(Effect.orDie);
        const actor = ConflictActor.make({ principal: "api-key", credentialFingerprint: O.some("fingerprint") });
        const ignored = yield* conflicts.transition(
          OntologyA,
          position.conflict.id,
          ConflictTransition.cases.ignore.make({ notes: O.some("not authoritative") }),
          actor
        );
        const resolved = yield* conflicts.transition(
          OntologyA,
          temporal.conflict.id,
          ConflictTransition.cases.resolve.make({
            acceptedClaim: "claimB",
            strategy: "prefer-later-claim",
            notes: O.none(),
          }),
          actor
        );
        const ignoredRecord = yield* Effect.fromOption(ignored, () => "missing ignored conflict").pipe(Effect.orDie);
        const resolvedRecord = yield* Effect.fromOption(resolved, () => "missing resolved conflict").pipe(Effect.orDie);
        assert.strictEqual(ignoredRecord.conflict.resolvedBy, "api-key");
        assert.strictEqual(ignoredRecord.conflict.resolvedByFingerprint, "fingerprint");
        assert.strictEqual(resolvedRecord.conflict.acceptedClaimId, temporal.conflict.claimBId);

        const redetectedIgnored = yield* conflicts.recordDetected({
          ontologyId: OntologyA,
          conflictType: "position",
          claimAId: ClaimB,
          claimBId: ClaimA,
        });
        const redetectedResolved = yield* conflicts.recordDetected({
          ontologyId: OntologyA,
          conflictType: "temporal",
          claimAId: ClaimD,
          claimBId: ClaimC,
        });
        const preservedIgnored = yield* conflicts.get(OntologyA, position.conflict.id);
        const preservedResolved = yield* conflicts.get(OntologyA, temporal.conflict.id);
        assert.isTrue(O.isNone(redetectedIgnored));
        assert.isTrue(O.isNone(redetectedResolved));
        assert.strictEqual(O.map(preservedIgnored, (record) => record.conflict.status).pipe(O.getOrNull), "ignored");
        assert.strictEqual(O.map(preservedResolved, (record) => record.conflict.status).pipe(O.getOrNull), "resolved");
      })
    );

    it.effect(
      "classifies malformed persistence rows as decodeRows failures",
      Effect.fnUntraced(function* () {
        yield* resetTables();
        yield* insertConflictFixtures();
        const sql = yield* SqlClient.SqlClient;
        const conflicts = yield* ConflictRepository;
        yield* sql`ALTER TABLE conflicts DROP CONSTRAINT conflicts_conflict_type_check`;
        yield* sql`UPDATE conflicts SET conflict_type = 'unsupported'`;

        const error = yield* conflicts.list(ConflictsQuery.make({ ontologyId: OntologyA })).pipe(Effect.flip);
        assert.instanceOf(error, DrizzleError);
        assert.strictEqual(error.operation, "decodeRows");
      })
    );

    it.effect(
      "requires ontology scope for every conflict query",
      Effect.fnUntraced(function* () {
        const decoded = yield* S.decodeUnknownEffect(ConflictsQuery)({}).pipe(Effect.option);
        assert.isTrue(O.isNone(decoded));
      })
    );
  });

  it.effect(
    "serves filtered conflict pages and enforces tagged terminal PATCH transitions",
    Effect.fnUntraced(function* () {
      return yield* Effect.acquireUseRelease(
        Effect.sync(() => HttpRouter.toWebHandler(TimelineHttpTestLayer, { disableLogger: true })),
        Effect.fnUntraced(function* (webHandler) {
          const requestContext = Context.empty();
          const listResponse = yield* Effect.tryPromise(() =>
            webHandler.handler(
              new Request("http://effect-ontology.test/v1/timeline/conflicts?ontologyId=ontology-a&limit=1&offset=0"),
              requestContext
            )
          );
          const ListResponse = S.Struct({
            conflicts: S.Array(S.Struct({ _tag: S.String, id: UUID })),
            total: S.Finite,
            pendingCount: S.Finite,
          });
          const listText = yield* Effect.tryPromise(() => listResponse.text());
          assert.strictEqual(listResponse.status, 200);
          const list = yield* S.decodeEffect(S.fromJsonString(ListResponse))(listText);
          const conflict = yield* Effect.fromOption(A.head(list.conflicts), () => "missing HTTP conflict").pipe(
            Effect.orDie
          );
          assert.strictEqual(list.total, 2);
          assert.strictEqual(list.pendingCount, 2);

          const patchBody = yield* S.encodeEffect(S.fromJsonString(ConflictTransition))(
            ConflictTransition.cases.ignore.make({ notes: O.some("reviewed") })
          );
          const patch = Effect.fnUntraced(function* () {
            return yield* Effect.tryPromise(() =>
              webHandler.handler(
                new Request(
                  `http://effect-ontology.test/v1/timeline/conflicts/${conflict.id}?ontologyId=${OntologyA}`,
                  {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: patchBody,
                  }
                ),
                requestContext
              )
            );
          });
          const transitioned = yield* patch();
          const repeated = yield* patch();
          assert.strictEqual(transitioned.status, 200);
          assert.strictEqual(repeated.status, 409);
          const transitionedJson = yield* Effect.tryPromise(() => transitioned.json());
          const transitionedTag = yield* S.decodeUnknownEffect(S.Struct({ _tag: S.String }))(transitionedJson);
          assert.strictEqual(transitionedTag._tag, "ignored");
        }),
        (webHandler) => Effect.promise(webHandler.dispose)
      );
    })
  );
});
