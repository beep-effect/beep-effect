import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import { Count } from "@proto/kernel/Measure";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { BudgetExceeded } from "./BudgetExceeded.rejection.ts";
import { ReservationId } from "./Reservation.id.ts";

/**
 * The fact: part of the run's allowance is held for one call; `remaining` is what is left.
 *
 * @category events
 * @since 0.0.0
 */
export class BudgetReserved extends Domain.Event("BudgetReserved", RunEvent.fields({ reservation: ReservationId, units: Count, remaining: Count }), { description: "Part of the run's allowance is held for one call. `remaining` is the units left." }) {}

/**
 * Reserve budget before an inference or tool call, as the run itself.
 *
 * @category commands
 * @since 0.0.0
 */
export class ReserveBudget extends Domain.Command(
  "ReserveBudget",
  {
    target: RunId,
    middleware: [Session],
    input: { reservation: ReservationId, units: Count },
    events: [BudgetReserved],
    rejects: [RunNotRunning, NotThisRun, BudgetExceeded],
    reply: { remaining: Count },
  },
  { description: "Reserve budget before an inference or tool call, as the run itself." },
) {}
