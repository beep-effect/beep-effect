import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef } from "@proto/kernel/Invocation";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { NotThisRun } from "./NotThisRun.rejection.ts";
import { HeldReservation } from "./Reservation.id.ts";
import { RunEvent } from "./RunEvent.ts";
import { Since } from "./Since.ts";
import { RunNotRunning } from "./RunNotRunning.rejection.ts";
import { RunVersions } from "./RunVersions.ts";

/**
 * The fact: the run took a step; `count` is how many it has recorded.
 *
 * @category events
 * @since 0.0.0
 */
export class StepRecorded extends Domain.Event("StepRecorded", RunEvent.fields({ step: S.String, count: S.Int })) {}

/**
 * The fact: the run reached its history bound and continues as `next`,
 * carrying its parent, remaining budget, open reservations, purpose,
 * versions and grant forward.
 *
 * @category events
 * @since 0.0.0
 */
export class RunContinued extends Domain.Event(
  "RunContinued",
  RunEvent.fields({
    next: RunId,
    lineage: RunId,
    generation: S.Int,
    parent: Since.phase3(S.NullOr(RunId), null),
    remaining: S.Int,
    reservations: Since.phase3(S.Array(HeldReservation), []),
    purpose: S.String,
    versions: RunVersions,
    historyBound: S.Int,
    source: GrantRef,
    terms: GrantTerms,
    requester: PrincipalId,
  }),
) {}

/**
 * Record a step of the run, as the run itself. At its history bound the run continues as a new run.
 *
 * @category commands
 * @since 0.0.0
 */
export class RecordStep extends Domain.Command(
  "RecordStep",
  {
    target: RunId,
    middleware: [Session],
    input: { step: S.String },
    events: [StepRecorded, RunContinued],
    rejects: [RunNotRunning, NotThisRun],
  },
  { description: "Record a step of the run, as the run itself. At its history bound the run continues as a new run." },
) {}
