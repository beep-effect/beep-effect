import { LiteralKit } from "@beep/schema/LiteralKit";

/**
 * What a reviewer, or an agent proposing to one, wants done with a pending claim.
 *
 * **Example** (Accept)
 * ```ts
 * import { Disposition } from "@proto/party-contract/Disposition";
 *
 * const accept: Disposition = "accept";
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Disposition = LiteralKit(["accept", "reject"]);
/**
 * @category models
 * @since 0.0.0
 */
export type Disposition = typeof Disposition.Type;
