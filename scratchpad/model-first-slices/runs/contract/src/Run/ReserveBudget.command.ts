import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
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
export class BudgetReserved extends Domain.Event("BudgetReserved", RunEvent.fields({ reservation: ReservationId, units: S.Int, remaining: S.Int })) {}

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
    input: { reservation: ReservationId, units: S.Int },
    events: [BudgetReserved],
    rejects: [RunNotRunning, NotThisRun, BudgetExceeded],
    reply: { remaining: S.Int },
  },
  { description: "Reserve budget before an inference or tool call, as the run itself." },
) {}
