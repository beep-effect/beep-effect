import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as Rdf from "@beep/rdf/Rdf";
import type { Effect } from "effect";
import type { ProjectionFailed } from "@/schema/Errors";
import type { LedgerSnapshot } from "@/schema/Ledger";
import type { SparqlExpectation, SparqlResultWitness } from "@/schema/Projection";

const $I = $SemanticaId.create("services/RdfProjection");

/**
 * Canonical triple terms exposed without leaking the RDF implementation family.
 *
 * @category models
 * @since 0.0.0
 */
export interface RdfProjectionTriple {
  readonly object: string;
  readonly predicate: string;
  readonly subject: string;
}

/**
 * Disposable RDF dataset plus canonical quad and triple projections.
 *
 * @category models
 * @since 0.0.0
 */
export interface RdfProjectionBuild {
  readonly dataset: Rdf.Dataset;
  readonly serializedQuads: ReadonlyArray<string>;
  readonly serializedTriples: ReadonlyArray<RdfProjectionTriple>;
}

interface RdfProjectionShape {
  readonly query: (
    build: RdfProjectionBuild,
    expectations: ReadonlyArray<SparqlExpectation>
  ) => Effect.Effect<ReadonlyArray<SparqlResultWitness>, ProjectionFailed>;
  readonly rebuild: (snapshot: LedgerSnapshot) => Effect.Effect<RdfProjectionBuild, ProjectionFailed>;
}

/**
 * Ledger-to-RDF projection and timeout-bounded Oxigraph query boundary.
 *
 * **Example** (Access the rebuild function)
 *
 * ```ts
 * import { RdfProjection } from "@/services/RdfProjection"
 * import { Effect } from "effect"
 *
 * const program = RdfProjection.pipe(Effect.map((service) => typeof service.rebuild))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RdfProjection extends Context.Service<RdfProjection, RdfProjectionShape>()($I`RdfProjection`) {}
