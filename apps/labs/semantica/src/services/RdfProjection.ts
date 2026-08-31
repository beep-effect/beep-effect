import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as Rdf from "@beep/rdf/Rdf";
import type { Effect } from "effect";
import type { ProjectionFailed } from "@/schema/Errors";
import type { LedgerSnapshot } from "@/schema/Ledger";
import type { SparqlExpectation, SparqlResultWitness } from "@/schema/Projection";

const $I = $SemanticaId.create("services/RdfProjection");

/**
 * One disposable RDF dataset rebuilt from the append-only ledger.
 *
 * **Example** (Count canonical quads)
 *
 * ```ts
 * import type { RdfProjectionBuild } from "@/services/RdfProjection"
 *
 * const quadCount = (build: RdfProjectionBuild) => build.serializedQuads.length
 * console.log(typeof quadCount) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface RdfProjectionBuild {
  readonly dataset: Rdf.Dataset;
  readonly serializedQuads: ReadonlyArray<string>;
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
