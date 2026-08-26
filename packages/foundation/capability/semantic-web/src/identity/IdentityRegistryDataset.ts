/**
 * Dataset-backed identity registry layer for tests and development.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IdentityRegistry } from "@beep/identity";
import { Effect, Layer } from "effect";
import { dual } from "effect/Function";
import { datasetToEntries } from "./IdentityRdfBinding.ts";
import type { IdentityRegistryConflictError } from "@beep/identity";
import type { Dataset } from "@beep/rdf/Rdf";
import type { IdentityDatasetDecodeError, IdentityRdfBinding } from "./IdentityRdfBinding.ts";

type IdentityRegistryDatasetLayer = Layer.Layer<
  IdentityRegistry,
  IdentityDatasetDecodeError | IdentityRegistryConflictError
>;

/**
 * Builds an identity registry by decoding an in-memory RDF dataset once.
 *
 * **Details**
 *
 * This layer is a test and development adapter only. It delegates conflict
 * detection and exact lookup behavior to `IdentityRegistry.layerLocal`.
 *
 * **Example** (Build an empty dataset registry)
 *
 * ```ts
 * import { DefaultIdentityRdfBinding, layerDataset } from "@beep/semantic-web"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const layer = layerDataset(DefaultIdentityRdfBinding, makeDataset([]))
 * console.log(layer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerDataset: {
  (binding: IdentityRdfBinding, dataset: Dataset): IdentityRegistryDatasetLayer;
  (dataset: Dataset): (binding: IdentityRdfBinding) => IdentityRegistryDatasetLayer;
} = dual(
  2,
  (binding: IdentityRdfBinding, dataset: Dataset): IdentityRegistryDatasetLayer =>
    Layer.unwrap(datasetToEntries(binding)(dataset).pipe(Effect.map(IdentityRegistry.layerLocal)))
);
