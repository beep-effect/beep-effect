import { Count } from "@proto/kernel/Measure";
import * as S from "effect/Schema";
import { $RunsContractId } from "@proto/kernel/Identity";
import { ReservationId } from "./Reservation.id.ts";

const $I = $RunsContractId.create("Run/UsageExceedsReservation.rejection");

/**
 * Refused: the usage reported for a reservation is more than it holds. A
 * call reports usage within what was reserved for it, so a settlement
 * returns what the reservation did not use and never spends past it.
 *
 * **Example** (A settlement of 45 units on a reservation of 40)
 * ```ts
 * import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
 * import { UsageExceedsReservation } from "@proto/runs-contract/Run/UsageExceedsReservation.rejection";
 *
 * const refused = UsageExceedsReservation.make({ reservation: ReservationId.make("r1"), reserved: 40, units: 45 });
 * ```
 *
 * @category rejections
 * @since 0.0.0
 */
export class UsageExceedsReservation extends S.TaggedError<UsageExceedsReservation, { readonly brand: unique symbol }>()(
  "UsageExceedsReservation",
  { reservation: ReservationId, reserved: Count, units: Count },
  $I.annote("UsageExceedsReservation", {
    httpApiStatus: 422,
    description: "The usage reported is more than the reservation holds.",
  }),
) {}
