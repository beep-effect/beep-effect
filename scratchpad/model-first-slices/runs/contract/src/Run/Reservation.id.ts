import * as S from "effect/Schema";
import { IdText } from "@proto/kernel/Measure";

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
export const ReservationId = IdText.pipe(S.brand("ReservationId"));
/**
 * @category ids
 * @since 0.0.0
 */
export type ReservationId = typeof ReservationId.Type;

/**
 * A reservation a run holds open, and its units.
 *
 * @category models
 * @since 0.0.0
 */
export const HeldReservation = S.Struct({ reservation: ReservationId, units: S.Int });
/**
 * @category models
 * @since 0.0.0
 */
export type HeldReservation = typeof HeldReservation.Type;
