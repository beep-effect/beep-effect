import * as Domain from "@alchemy.run/domain";
import { RunId } from "@proto/kernel/Ids";
import { Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { Count } from "@proto/kernel/Measure";
import { RunEvent } from "./RunEvent.ts";
import { SessionId } from "./Session.id.ts";
import { Since } from "./Since.ts";

/**
 * The fact: the run was refused or could not continue, and why: its grant
 * was refused at request, or a hop was refused at re-admission mid-run.
 * `released` is what the run's open reservations held, given back as it
 * ends (phase 7; older stored events read 0).
 *
 * @category events
 * @since 0.0.0
 */
export class RunRejected extends Domain.Event(
  "RunRejected",
  RunEvent.fields({ reason: S.String, released: Since.phase7(Count, 0) }),
  { description: "The run was refused or could not continue, and why: its grant was refused at request, or a hop was refused at re-admission mid-run. `released` is the units its open reservations held, given back as it ends." },
) {}

/**
 * Record that a run was refused. Sent only by the runs model's own policy
 * and the runs host's gateway, with the provenance they acted on; no Api
 * serves it. It never rejects: a refusal is always recorded.
 *
 * @category commands
 * @since 0.0.0
 */
export class RejectRun extends Domain.Command(
  "RejectRun",
  { target: RunId, input: { session: SessionId, reason: S.String, provenance: Provenance }, events: [RunRejected] },
  { description: "Record that a run was refused, and why." },
) {}
