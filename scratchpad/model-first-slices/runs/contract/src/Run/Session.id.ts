import * as S from "effect/Schema";
import { IdText } from "@proto/kernel/Measure";

/**
 * A session: a conversation or standing assignment that holds a chain of
 * bounded runs (D23).
 *
 * **Example** (Brand a session id)
 * ```ts
 * import { SessionId } from "@proto/runs-contract/Run/Session.id";
 *
 * const session = SessionId.make("claim-review:claim_1");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const SessionId = IdText.pipe(S.brand("SessionId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type SessionId = typeof SessionId.Type;
