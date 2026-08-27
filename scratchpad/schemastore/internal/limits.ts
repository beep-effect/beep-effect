/**
 * Shared nesting cap for every recursive walk over SchemaStore documents.
 *
 * **Details**
 *
 * Carriers, lint, canonical JSON, and the `$ref` rewrite all fail through a
 * typed channel — or degrade to a lint finding — rather than overflowing the
 * call stack as an unhandled defect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Maximum collection-nesting depth accepted by the package's recursive
 * document walks (the `$ref` rewrite, the document lint and the canonical
 * JSON emitter).
 *
 * **Details**
 *
 * The kit-wide parity constant (matching `@effected/yaml`, `@effected/jsonc`
 * and `@effected/toml`): deeply-nested hostile input must fail through a
 * typed channel — or degrade to a lint finding — rather than overflowing the
 * call stack as an unhandled defect.
 *
 * **Example** (The kit-wide cap is 256)
 *
 * ```ts
 * import { CarrierDepthExceededError, JsonDepthExceededError } from "@beep/scratchpad/schemastore"
 *
 * const cap = 256
 * const carrier = CarrierDepthExceededError.make({ path: "/$defs/cycle", maxDepth: cap })
 * const json = JsonDepthExceededError.make({ path: "", maxDepth: cap })
 *
 * console.log(carrier.maxDepth === json.maxDepth)
 * // => true
 * console.log(carrier.maxDepth)
 * // => 256
 * ```
 *
 * @see {@link CarrierDepthExceededError} for the carrier walk's typed depth failure.
 * @see {@link JsonDepthExceededError} for the canonical JSON emitter's typed depth failure.
 * @see {@link DocumentLint} for the `DepthExceeded` finding when lint stops descending.
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;
