/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Logical edge identity and digest exports.
 *
 * **Example** (Decode LogicalEdgeIdentity and key)
 *
 * ```ts
 * import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(LogicalEdgeIdentity)({
 *   evidenceScope: null,
 *   matterScope: null,
 *   orgScope: "1",
 *   qualifiers: {},
 *   relation: "contradicts",
 *   source: { kind: "claim", claimId: 1 },
 *   target: { kind: "claim", claimId: 2 }
 * })
 *
 * console.log(logicalEdgeKey(identity).length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./LogicalEdgeIdentity.model.ts";
