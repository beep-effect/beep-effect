import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { Count } from "@proto/kernel/Measure";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { ReservationId } from "./Reservation.id.ts";
import { UnknownReservation } from "./UnknownReservation.rejection.ts";
import { UsageExceedsReservation } from "./UsageExceedsReservation.rejection.ts";

/**
 * The fact: a reservation was settled at the usage reported; `remaining` is what is left.
 *
 * @category events
 * @since 0.0.0
 */
export class UsageSettled extends Domain.Event("UsageSettled", RunEvent.fields({ reservation: ReservationId, reserved: Count, units: Count, remaining: Count }), { description: "A reservation was settled at the usage reported. `remaining` is the units left." }) {}

/**
 * Settle a reservation with the usage the call reported, as the run itself.
 * The unused part of the reservation returns to the run; usage over what the
 * reservation holds is refused with `UsageExceedsReservation`.
 *
 * @category commands
 * @since 0.0.0
 */
export class SettleUsage extends Domain.Command(
  "SettleUsage",
  {
    target: RunId,
    middleware: [Session],
    input: { reservation: ReservationId, units: Count },
    events: [UsageSettled],
    rejects: [RunNotRunning, NotThisRun, UnknownReservation, UsageExceedsReservation],
  },
  { description: "Settle a reservation with the usage the call reported, as the run itself." },
) {}
