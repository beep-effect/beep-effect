/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Decode admitted ClaimGateResult)
 *
 * ```ts
 * import { ClaimGateResult } from "@beep/epistemics/ClaimGate"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownSync(ClaimGateResult)({ verdict: "admitted" })
 * console.log(result.verdict)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./ClaimGateResult.model.ts";
