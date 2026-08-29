/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Edge endpoint value exports.
 *
 * **Example** (Decoding an EdgeEndpoint)
 *
 * ```ts
 * import { EdgeEndpoint } from "@beep/epistemic-domain/values/EdgeEndpoint"
 * import * as S from "effect/Schema"
 *
 * const endpoint = S.decodeUnknownSync(EdgeEndpoint)({ kind: "evidence", evidenceId: 7 })
 * console.log(endpoint.kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./EdgeEndpoint.model.ts";
