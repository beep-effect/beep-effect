/**
 * Worker-safe ontology agent toolkit entrypoint.
 *
 * **Details**
 *
 * This subpath intentionally excludes server adapters, transports,
 * and DOM-dependent modules.
 *
 * @packageDocumentation
 * @category tools
 * @since 0.0.0
 */

/**
 *  Ontology toolkit schemas and declarations.
 *
 * **Example** (Count registered toolkit tools)
 *
 * ```ts
 * import { OntologyToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyToolkit.tools).length)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./OntologyToolkit.ts";
/**
 *  Stateless ontology tool service exports.
 *
 * **Example** (Import ontology tool service)
 *
 * ```ts
 * import { OntologyToolService } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyToolService)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./OntologyToolService.ts";
