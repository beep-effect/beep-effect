import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { Count } from "@proto/kernel/Measure";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { ReservationId } from "./Reservation.id.ts";
import { UnknownReservation } from "./UnknownReservation.rejection.ts";

/**
 * The fact: a reservation was released unspent.
 *
 * @category events
 * @since 0.0.0
 */
export class ReservationReleased extends Domain.Event("ReservationReleased", RunEvent.fields({ reservation: ReservationId, units: Count }), { description: "A reservation was released unspent." }) {}

/**
 * Release a reservation whose call failed, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class ReleaseReservation extends Domain.Command(
  "ReleaseReservation",
  {
    target: RunId,
    middleware: [Session],
    input: { reservation: ReservationId },
    events: [ReservationReleased],
    rejects: [RunNotRunning, NotThisRun, UnknownReservation],
  },
  { description: "Release a reservation whose call failed, as the run itself." },
) {}
