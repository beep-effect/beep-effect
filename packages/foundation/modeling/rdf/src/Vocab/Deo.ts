/**
 * Attributed Deo vocabulary constants from the pinned SPAR inventory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeNamedNode } from "../Rdf.ts";
import { DEO_NAMESPACE } from "./generated/Deo.terms.ts";

/**
 * Generated namespace and selected upstream inventory.
 *
 * @category constants
 * @since 0.0.0
 */
export { DEO_NAMESPACE, DEO_TERMS } from "./generated/Deo.terms.ts";

/**
 * Named node for `deo:Introduction`.
 *
 * **Example** (Read deo Introduction)
 *
 * ```ts
 * import { DEO_INTRODUCTION } from "@beep/rdf/Vocab/Deo"
 * console.log(DEO_INTRODUCTION.value)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEO_INTRODUCTION = makeNamedNode(`${DEO_NAMESPACE}Introduction`);
