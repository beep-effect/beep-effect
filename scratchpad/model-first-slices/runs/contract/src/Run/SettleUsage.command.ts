import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { ReservationId } from "./Reservation.id.ts";
import { UnknownReservation } from "./UnknownReservation.rejection.ts";

/**
 * The fact: a reservation was settled at the usage reported; `remaining` is what is left.
 *
 * @category events
 * @since 0.0.0
 */
export class UsageSettled extends Domain.Event("UsageSettled", RunEvent.fields({ reservation: ReservationId, reserved: S.Int, units: S.Int, remaining: S.Int }), { description: "A reservation was settled at the usage reported. `remaining` is the units left." }) {}

/**
 * Settle a reservation with the usage the call reported, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class SettleUsage extends Domain.Command(
  "SettleUsage",
  {
    target: RunId,
    middleware: [Session],
    input: { reservation: ReservationId, units: S.Int },
    events: [UsageSettled],
    rejects: [RunNotRunning, NotThisRun, UnknownReservation],
  },
  { description: "Settle a reservation with the usage the call reported, as the run itself." },
) {}
