/**
 * Attributed Cito vocabulary constants from the pinned SPAR inventory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeNamedNode } from "../Rdf.ts";
import { CITO_NAMESPACE } from "./generated/Cito.terms.ts";

/**
 * Generated namespace and selected upstream inventory.
 *
 * @category constants
 * @since 0.0.0
 */
export { CITO_NAMESPACE, CITO_TERMS } from "./generated/Cito.terms.ts";

/**
 * Named node for `cito:citesAsEvidence`.
 *
 * **Example** (Read cito citesAsEvidence)
 *
 * ```ts
 * import { CITO_CITES_AS_EVIDENCE } from "@beep/rdf/Vocab/Cito"
 * console.log(CITO_CITES_AS_EVIDENCE.value)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CITO_CITES_AS_EVIDENCE = makeNamedNode(`${CITO_NAMESPACE}citesAsEvidence`);
