/**
 * Package entry point for `@beep/ontology-ui`.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

/**
 * Package version for `@beep/ontology-ui`.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/ontology-ui"
 *
 * console.log(VERSION)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Curated ontology workbench exports.
 *
 * @category components
 * @since 0.0.0
 */
export {
  OntologyChangeLogRegion,
  OntologyDocumentRegion,
  OntologyExplorerRegion,
  OntologyGraphRegion,
  OntologyInspectorRegion,
  OntologyMetricsRegion,
  OntologySourceRegion,
  OntologySparqlRegion,
  OntologyValidationRegion,
  OntologyWorkbench,
  ontologyTreeItemsFor,
} from "./aggregates/Session/index.ts";
