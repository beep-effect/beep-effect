import * as Domain from "@alchemy.run/domain";
import { ReservationId } from "./Reservation.id.ts";

/**
 * Refused: the run holds no open reservation by that id.
 *
 * @category rejections
 * @since 0.0.0
 */
export class UnknownReservation extends Domain.Rejection(
  "UnknownReservation",
  { reservation: ReservationId },
  { httpApiStatus: 409, description: "The run holds no open reservation by that id." },
) {}
