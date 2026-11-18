import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { Count, Sequence } from "@proto/kernel/Measure";
import { HistoryBound } from "./HistoryBound.ts";
import { HeldReservation } from "./Reservation.id.ts";
import { RunEvent } from "./RunEvent.ts";
import { Since } from "./Since.ts";
import { RunVersions } from "./RunVersions.ts";
import { SessionId } from "./Session.id.ts";

/**
 * The fact: a run at its history bound continued as this run, which carries
 * its parent, purpose, versions, remaining budget, open reservations and
 * narrowed grant forward (D23). `allowance` includes what those
 * reservations hold.
 *
 * @category events
 * @since 0.0.0
 */
export class ContinuationOpened extends Domain.Event(
  "ContinuationOpened",
  RunEvent.fields({
    previous: RunId,
    lineage: RunId,
    generation: Sequence,
    parent: Since.phase3(S.OptionFromNullOr(RunId), null),
    purpose: S.String,
    versions: RunVersions,
    allowance: Count,
    reservations: Since.phase3(S.Array(HeldReservation), []),
    historyBound: HistoryBound,
    source: GrantRef,
    terms: GrantTerms,
    delegation: DelegationId,
    accountable: PrincipalId,
    requester: PrincipalId,
    runProvenance: Provenance,
  }),
  { description: "A run at its history bound continued as this run, which carries its parent, purpose, versions, remaining budget, open reservations and narrowed grant forward. `allowance` includes the units those reservations hold." },
) {}

/**
 * Open the run a bounded run continues as. Sent only by the runs model's
 * own policy; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class OpenContinuation extends Domain.Command(
  "OpenContinuation",
  {
    target: RunId,
    input: {
      session: SessionId,
      previous: RunId,
      lineage: RunId,
      generation: Sequence,
      parent: S.OptionFromNullOr(RunId),
      purpose: S.String,
      versions: RunVersions,
      allowance: Count,
      reservations: S.Array(HeldReservation),
      historyBound: HistoryBound,
      source: GrantRef,
      terms: GrantTerms,
      delegation: DelegationId,
      accountable: PrincipalId,
      requester: PrincipalId,
      runProvenance: Provenance,
      provenance: Provenance,
    },
    events: [ContinuationOpened],
  },
  { description: "Open the run a bounded run continues as, carrying its state forward." },
) {}
