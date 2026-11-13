import * as S from "effect/Schema";

/**
 * One budget reservation on a run, made before an inference or tool call
 * and settled or released after it.
 *
 * **Example** (Brand a reservation id)
 * ```ts
 * import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
 *
 * const reservation = ReservationId.make("review:claim_1:1:assess");
 * ```
 *
 * @category ids
 * @since 0.0.0
 */
export const ReservationId = S.String.pipe(S.brand("ReservationId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type ReservationId = typeof ReservationId.Type;
