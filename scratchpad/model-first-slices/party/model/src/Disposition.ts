import * as S from "effect/Schema";

/**
 * What a reviewer, or an agent proposing to one, wants done with a pending claim.
 *
 * **Example** (Accept)
 * ```ts
 * import { Disposition } from "@proto/party/Disposition";
 *
 * const accept: Disposition = "accept";
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Disposition = S.Literals(["accept", "reject"]);
/**
 * @category models
 * @since 0.0.0
 */
export type Disposition = typeof Disposition.Type;
