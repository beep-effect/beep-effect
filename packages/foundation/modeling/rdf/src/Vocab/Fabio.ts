/**
 * Attributed Fabio vocabulary constants from the pinned SPAR inventory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeNamedNode } from "../Rdf.ts";
import { FABIO_NAMESPACE } from "./generated/Fabio.terms.ts";

/**
 * Generated namespace and selected upstream inventory.
 *
 * @category constants
 * @since 0.0.0
 */
export { FABIO_NAMESPACE, FABIO_TERMS } from "./generated/Fabio.terms.ts";

/**
 * Named node for `fabio:Report`.
 *
 * **Example** (Read fabio Report)
 *
 * ```ts
 * import { FABIO_REPORT } from "@beep/rdf/Vocab/Fabio"
 * console.log(FABIO_REPORT.value)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FABIO_REPORT = makeNamedNode(`${FABIO_NAMESPACE}Report`);
