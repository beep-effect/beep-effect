/**
 * Worker-safe ontology agent toolkit entrypoint.
 *
 * @remarks This subpath intentionally excludes server adapters, transports,
 * and DOM-dependent modules.
 * @packageDocumentation
 * @category tools
 * @since 0.0.0
 */

/** Ontology toolkit schemas and declarations.
 * @example
 * ```ts
 * import { OntologyToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyToolkit.tools).length)
 * ```
 * @category tools
 * @since 0.0.0
 */
export * from "./OntologyToolkit.js";
/** Stateless ontology tool service exports.
 * @example
 * ```ts
 * import { OntologyToolService } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyToolService)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./OntologyToolService.js";
