/**
 * Oxigraph driver typed errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OxigraphId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $OxigraphId.create("Oxigraph.errors");

/**
 * Oxigraph SPARQL driver failure reason.
 *
 * **Example** (Assign queryFailed reason)
 *
 * ```ts
 * import { OxigraphSparqlErrorReason } from "@beep/oxigraph"
 *
 * const reason: OxigraphSparqlErrorReason = "queryFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OxigraphSparqlErrorReason = LiteralKit([
  "importFailed",
  "adapterInvariant",
  "datasetLoadFailed",
  "queryFailed",
  "unsupportedResult",
]).pipe(
  $I.annoteSchema("OxigraphSparqlErrorReason", {
    description: "Oxigraph SPARQL driver failure reason.",
  })
);

/**
 * Type for {@link OxigraphSparqlErrorReason}.
 *
 * **Example** (Assign importFailed reason)
 *
 * ```ts
 * import { OxigraphSparqlErrorReason } from "@beep/oxigraph"
 *
 * const reason: OxigraphSparqlErrorReason = "importFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OxigraphSparqlErrorReason = typeof OxigraphSparqlErrorReason.Type;

const OxigraphSparqlErrorFields = {
  reason: OxigraphSparqlErrorReason,
  message: S.String,
} satisfies S.Struct.Fields;
const sameOxigraphSparqlErrorFields = S.toEquivalence(S.TaggedStruct("OxigraphSparqlError", OxigraphSparqlErrorFields));
const sameOxigraphSparqlError = (self: OxigraphSparqlError, that: OxigraphSparqlError): boolean =>
  sameOxigraphSparqlErrorFields(self, that);

/**
 * Typed Oxigraph SPARQL driver error.
 *
 * **Example** (Make SPARQL error)
 *
 * ```ts
 * import { OxigraphSparqlError } from "@beep/oxigraph"
 *
 * const error = OxigraphSparqlError.make({
 *   reason: "queryFailed",
 *   message: "Oxigraph rejected the query."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OxigraphSparqlError extends S.TaggedError<OxigraphSparqlError>($I`OxigraphSparqlError`)(
  "OxigraphSparqlError",
  OxigraphSparqlErrorFields,
  $I.annoteClass<
    S.declare<OxigraphSparqlError>,
    readonly [S.TaggedStruct<"OxigraphSparqlError", typeof OxigraphSparqlErrorFields>]
  >("OxigraphSparqlError", {
    description: "Typed Oxigraph SPARQL driver error.",
    toEquivalence: () => sameOxigraphSparqlError,
  })
) {}
