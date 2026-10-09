/**
 * Attributed Doco vocabulary constants from the pinned SPAR inventory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeNamedNode } from "../Rdf.ts";
import { DOCO_NAMESPACE } from "./generated/Doco.terms.ts";

/**
 * Generated namespace and selected upstream inventory.
 *
 * @category constants
 * @since 0.0.0
 */
export { DOCO_NAMESPACE, DOCO_TERMS } from "./generated/Doco.terms.ts";

/**
 * Named node for `doco:Section`.
 *
 * **Example** (Read doco Section)
 *
 * ```ts
 * import { DOCO_SECTION } from "@beep/rdf/Vocab/Doco"
 * console.log(DOCO_SECTION.value)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCO_SECTION = makeNamedNode(`${DOCO_NAMESPACE}Section`);

/**
 * Named node for `doco:Title`.
 *
 * **Example** (Read doco Title)
 *
 * ```ts
 * import { DOCO_TITLE } from "@beep/rdf/Vocab/Doco"
 * console.log(DOCO_TITLE.value)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCO_TITLE = makeNamedNode(`${DOCO_NAMESPACE}Title`);
