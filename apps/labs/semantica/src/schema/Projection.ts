import { $SemanticaId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import { CorpusPaperId } from "@/corpus/Manifest";
import { ChunkId } from "@/schema/Ids";
import { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("schema/Projection");

/**
 * Frozen exact-neighbour assertion for the C1 projection gate.
 *
 * **Example** (Inspect the expected rank)
 *
 * ```ts
 * import { KnnExpectation } from "@/schema/Projection"
 *
 * console.log(KnnExpectation.fields.rank !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnnExpectation extends S.Class<KnnExpectation>($I`KnnExpectation`)(
  {
    neighborChunk: ChunkId,
    queryChunk: ChunkId,
    rank: PosInt,
  },
  $I.annote("KnnExpectation", {
    description: "Known query and neighbour chunk ids with the expected exact-SQL rank.",
  })
) {}

/**
 * Frozen SPARQL query and expected non-empty binding count.
 *
 * **Example** (Inspect the query field)
 *
 * ```ts
 * import { SparqlExpectation } from "@/schema/Projection"
 *
 * console.log(SparqlExpectation.fields.query !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SparqlExpectation extends S.Class<SparqlExpectation>($I`SparqlExpectation`)(
  {
    expectedCount: PosInt,
    id: S.NonEmptyString,
    query: S.NonEmptyString,
  },
  $I.annote("SparqlExpectation", {
    description: "Named C1 SPARQL SELECT expectation whose binding count must match exactly and remain non-empty.",
  })
) {}

/**
 * Committed G-projection contract checked before C1 rebuild identity.
 *
 * **Details**
 *
 * The fixture freezes the OpenAI model identity and dimension together with
 * one exact kNN witness and non-empty SPARQL result counts over F1 plus one
 * relation-gold paper.
 *
 * **Example** (Inspect the fixed schema version)
 *
 * ```ts
 * import { GProjectionExpectation } from "@/schema/Projection"
 *
 * console.log(GProjectionExpectation.fields.schemaVersion.literals[0]) // "g-projection/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GProjectionExpectation extends S.Class<GProjectionExpectation>($I`GProjectionExpectation`)(
  {
    schemaVersion: S.Literal("g-projection/v1"),
    model: ModelIdentity,
    paper: CorpusPaperId,
    knn: KnnExpectation,
    sparql: S.NonEmptyArray(SparqlExpectation),
  },
  $I.annote("GProjectionExpectation", {
    description: "Frozen C1 projection expectations evaluated before any rebuild-identity assertion.",
  })
) {}
