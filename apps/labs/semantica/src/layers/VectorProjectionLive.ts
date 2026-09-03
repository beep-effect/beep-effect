import { DuckDb } from "@beep/duckdb";
import { $SemanticaId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema";
import { Crypto, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { canonicalJson } from "@/corpus/Canonical";
import { contentDigest } from "@/schema/Digest";
import { ProjectionFailed } from "@/schema/Errors";
import { ChunkId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";
import { KnnNeighbor, KnnQueryResult } from "@/schema/Projection";
import { VectorProjection } from "@/services/VectorProjection";

const $I = $SemanticaId.create("layers/VectorProjectionLive");
const TABLE = "semantica_embedding_vectors";
const CREATE_TABLE = `CREATE TABLE ${TABLE} (
  model_key VARCHAR NOT NULL,
  dimension INTEGER NOT NULL,
  chunk_id VARCHAR NOT NULL,
  vector DOUBLE[] NOT NULL,
  PRIMARY KEY (model_key, dimension, chunk_id),
  CHECK (array_length(vector) = dimension)
)`;
const DROP_TABLE = `DROP TABLE IF EXISTS ${TABLE}`;

class KnnRow extends S.Class<KnnRow>($I`KnnRow`)(
  { chunk_id: ChunkId, distance: S.Finite },
  $I.annote("KnnRow", { description: "Decoded DuckDB exact-neighbour row." })
) {}

const failed = (message: string): ProjectionFailed => ProjectionFailed.make({ message, reason: "vector-failed" });

const makeVectorProjection = Effect.fn("VectorProjection.make")(function* () {
  const crypto = yield* Crypto.Crypto;
  const db = yield* DuckDb;
  const modelKey = (model: ModelIdentity) =>
    contentDigest(ModelIdentity)(model).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
      Effect.mapError(() => failed("The embedding model identity could not be hashed."))
    );

  const drop = db
    .run(DROP_TABLE)
    .pipe(Effect.mapError(() => failed("The DuckDB vector projection could not be dropped.")));

  return VectorProjection.of({
    drop,
    rebuild: Effect.fn("VectorProjection.rebuild")(function* (vectors) {
      const rows = yield* Effect.forEach(
        vectors,
        Effect.fnUntraced(function* (vector) {
          return {
            chunk: vector.chunk,
            dimension: O.getOrThrow(vector.model.dimension),
            modelKey: yield* modelKey(vector.model),
            values: canonicalJson(vector.values),
          };
        }),
        { concurrency: 8 }
      );
      yield* drop;
      yield* db
        .run(CREATE_TABLE)
        .pipe(Effect.mapError(() => failed("The dimension-keyed DuckDB vector table could not be created.")));
      yield* db
        .withTransaction((transaction) =>
          Effect.forEach(
            rows,
            (row) =>
              transaction.run(
                `INSERT INTO ${TABLE} (model_key, dimension, chunk_id, vector)
                 VALUES ($modelKey, $dimension, $chunk, CAST($values AS DOUBLE[]))`,
                row
              ),
            { concurrency: 1, discard: true }
          )
        )
        .pipe(Effect.mapError(() => failed("The DuckDB vector projection could not be rebuilt atomically.")));
    }),
    neighbors: Effect.fn("VectorProjection.neighbors")(function* (query, limit) {
      const dimension = O.getOrThrow(query.model.dimension);
      const key = yield* modelKey(query.model);
      const rows = yield* db
        .query(
          `SELECT chunk_id, list_cosine_distance(vector, CAST($vector AS DOUBLE[])) AS distance
           FROM ${TABLE}
           WHERE model_key = $modelKey
             AND dimension = $dimension
             AND chunk_id <> $queryChunk
           ORDER BY distance, chunk_id
           LIMIT $limit`,
          {
            dimension,
            limit,
            modelKey: key,
            queryChunk: query.chunk,
            vector: canonicalJson(query.values),
          }
        )
        .pipe(Effect.mapError(() => failed("The exact DuckDB kNN query failed.")));
      const decoded = yield* S.decodeUnknownEffect(S.Array(KnnRow))(rows).pipe(
        Effect.mapError(() => failed("DuckDB returned invalid exact-neighbour rows."))
      );
      return KnnQueryResult.make({
        dimension,
        modelKey: key,
        neighbors: A.map(decoded, (row, index) =>
          KnnNeighbor.make({ chunk: row.chunk_id, distance: row.distance, rank: PosInt.make(index + 1) })
        ),
        queryChunk: query.chunk,
      });
    }),
  });
});

/**
 * Native DuckDB implementation of the app-local dimension-keyed vector projection.
 *
 * **Example** (Inspect the vector projection Layer)
 *
 * ```ts
 * import { VectorProjectionLive } from "@/layers/VectorProjectionLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(VectorProjectionLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VectorProjectionLive = Layer.effect(VectorProjection, makeVectorProjection());
