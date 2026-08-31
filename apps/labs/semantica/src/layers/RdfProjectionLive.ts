import * as Rdf from "@beep/rdf/Rdf";
import { NonNegativeInt } from "@beep/schema";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { Duration, Effect, Layer, Match, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { canonicalJson } from "@/corpus/Canonical";
import { LabConfig } from "@/runtime/Config";
import { ProjectionFailed } from "@/schema/Errors";
import { ClaimBody, ExtractOutcome } from "@/schema/Evidence";
import { SparqlResultWitness } from "@/schema/Projection";
import { RdfProjection } from "@/services/RdfProjection";
import type { EvidenceBatch, EvidenceClaim } from "@/schema/Evidence";
import type { LedgerSnapshot } from "@/schema/Ledger";
import type { SparqlExpectation } from "@/schema/Projection";

const BASE = "https://beep.sh/semantica/";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const RDF_TYPE = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const RDF_SUBJECT = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#subject");
const RDF_PREDICATE = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate");
const RDF_OBJECT = Rdf.makeNamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#object");
const EVIDENCE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EvidenceClaim`);
const ENTITY_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/EntityClaim`);
const RELATION_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/RelationClaim`);
const STRUCTURE_CLAIM = Rdf.makeNamedNode(`${BASE}ontology/StructureClaim`);
const CHUNK = Rdf.makeNamedNode(`${BASE}ontology/sourceChunk`);
const LABEL = Rdf.makeNamedNode(`${BASE}ontology/label`);
const ROLE = Rdf.makeNamedNode(`${BASE}ontology/role`);
const PREDICATE_TEXT = Rdf.makeNamedNode(`${BASE}ontology/predicateText`);
const rowOrder = Order.mapInput(Order.String, canonicalJson);

const failed = (message: string): ProjectionFailed => ProjectionFailed.make({ message, reason: "rdf-failed" });
const claimNode = (id: string) => Rdf.makeNamedNode(`${BASE}claim/${id}`);
const chunkNode = (id: string) => Rdf.makeNamedNode(`${BASE}chunk/${id}`);
const graphNode = (id: string) => Rdf.makeNamedNode(`${BASE}provenance/batch/${id}`);
const stringLiteral = (value: string) => Rdf.makeLiteral(value, XSD_STRING);
const quad = (claim: EvidenceClaim, graph: Rdf.NamedNode, predicate: Rdf.NamedNode, object: Rdf.ObjectTerm) =>
  Rdf.makeQuad(claimNode(claim.id), predicate, { graph, object });

const claimQuads = (batch: EvidenceBatch, claim: EvidenceClaim): ReadonlyArray<Rdf.Quad> => {
  const graph = graphNode(batch.id);
  const common = [quad(claim, graph, RDF_TYPE, EVIDENCE_CLAIM), quad(claim, graph, CHUNK, chunkNode(claim.chunk))];
  return A.appendAll(
    common,
    ClaimBody.match(claim.body, {
      Entity: (body) => [
        quad(claim, graph, RDF_TYPE, ENTITY_CLAIM),
        quad(claim, graph, LABEL, stringLiteral(body.label)),
      ],
      Relation: (body) => [
        quad(claim, graph, RDF_TYPE, RELATION_CLAIM),
        quad(claim, graph, RDF_SUBJECT, claimNode(body.subject)),
        quad(claim, graph, RDF_PREDICATE, Rdf.makeNamedNode(`${BASE}predicate/${claim.id}`)),
        quad(claim, graph, RDF_OBJECT, claimNode(body.object)),
        quad(claim, graph, PREDICATE_TEXT, stringLiteral(body.predicate)),
      ],
      Structure: (body) => [
        quad(claim, graph, RDF_TYPE, STRUCTURE_CLAIM),
        quad(claim, graph, ROLE, stringLiteral(body.role)),
      ],
    })
  );
};

const snapshotQuads = (snapshot: LedgerSnapshot): ReadonlyArray<Rdf.Quad> =>
  A.flatMap(snapshot.batches, (outcome) =>
    ExtractOutcome.match(outcome, {
      Degraded: () => [],
      Extracted: ({ batch }) => A.flatMap(batch.claims, (claim) => claimQuads(batch, claim)),
    })
  );

const canonicalRows = (rows: ReadonlyArray<Record<string, Rdf.Term>>) =>
  A.sort(
    A.map(rows, (row) => R.map(row, Rdf.serializeTerm)),
    rowOrder
  );

const makeRdfProjection = Effect.fn("RdfProjection.make")(function* () {
  const config = yield* LabConfig;
  const sparql = yield* SparqlQueryService;
  const timeoutMs = NonNegativeInt.make(Duration.toMillis(config.projectionTimeout));

  return RdfProjection.of({
    rebuild: Effect.fn("RdfProjection.rebuild")((snapshot) =>
      Effect.sync(() => {
        const dataset = Rdf.makeDataset(snapshotQuads(snapshot));
        const sorted = Rdf.sortDatasetQuads(dataset);
        return {
          dataset: Rdf.makeDataset(sorted),
          serializedQuads: A.map(sorted, Rdf.serializeQuad),
          serializedTriples: A.map(sorted, (quad) => ({
            object: Rdf.serializeTerm(quad.object),
            predicate: Rdf.serializeTerm(quad.predicate),
            subject: Rdf.serializeTerm(quad.subject),
          })),
        };
      })
    ),
    query: Effect.fn("RdfProjection.query")(function* (build, expectations) {
      return yield* Effect.forEach(
        expectations,
        Effect.fnUntraced(function* (expectation: SparqlExpectation) {
          const result = yield* sparql
            .execute(
              SparqlQueryRequest.make({
                dataset: build.dataset,
                profile: "select",
                query: expectation.query,
                timeoutMs: O.some(timeoutMs),
              })
            )
            .pipe(
              Effect.timeoutOrElse({
                duration: config.projectionTimeout,
                orElse: () => Effect.fail(failed("The Oxigraph projection query exceeded its Effect deadline.")),
              }),
              Effect.mapError(() => failed("Oxigraph could not execute the C1 projection query."))
            );
          return yield* Match.value(result).pipe(
            Match.discriminatorsExhaustive("profile")({
              ask: () => Effect.fail(failed("Oxigraph returned ASK output for a SELECT projection query.")),
              construct: () => Effect.fail(failed("Oxigraph returned CONSTRUCT output for a SELECT projection query.")),
              select: ({ rows }) => {
                const canonical = canonicalRows(rows);
                return Effect.succeed(
                  SparqlResultWitness.make({
                    count: NonNegativeInt.make(A.length(canonical)),
                    id: expectation.id,
                    rows: canonical,
                  })
                );
              },
            })
          );
        }),
        { concurrency: 1 }
      );
    }),
  });
});

/**
 * Oxigraph-backed disposable RDF projection rebuilt from ledger values per run.
 *
 * **Example** (Inspect the RDF projection Layer)
 *
 * ```ts
 * import { RdfProjectionLive } from "@/layers/RdfProjectionLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(RdfProjectionLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const RdfProjectionLive = Layer.effect(RdfProjection, makeRdfProjection());
