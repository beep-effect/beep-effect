import { ReservationId } from "./Reservation.id.ts";
import * as S from "effect/Schema";
import { $RunsContractId } from "@proto/kernel/Identity";

const $I = $RunsContractId.create("Run/UnknownReservation.rejection");

/**
 * Refused: the run holds no open reservation by that id.
 *
 * @category rejections
 * @since 0.0.0
 */
export class UnknownReservation extends S.TaggedError<UnknownReservation, { readonly brand: unique symbol }>()(
  "UnknownReservation",
  { reservation: ReservationId },
  $I.annote("UnknownReservation", { httpApiStatus: 409, description: "The run holds no open reservation by that id." }),
) {}
