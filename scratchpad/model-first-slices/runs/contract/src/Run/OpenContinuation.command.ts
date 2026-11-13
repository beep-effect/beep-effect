import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { RunEvent } from "./RunEvent.ts";
import { RunVersions } from "./RunVersions.ts";
import { SessionId } from "./Session.id.ts";

/**
 * The fact: a run at its history bound continued as this run, which carries
 * its purpose, versions, remaining budget and narrowed grant forward (D23).
 *
 * @category events
 * @since 0.0.0
 */
export class ContinuationOpened extends Domain.Event(
  "ContinuationOpened",
  RunEvent.fields({
    previous: RunId,
    lineage: RunId,
    generation: S.Int,
    purpose: S.String,
    versions: RunVersions,
    allowance: S.Int,
    historyBound: S.Int,
    source: GrantRef,
    terms: GrantTerms,
    delegation: DelegationId,
    accountable: PrincipalId,
    requester: PrincipalId,
    runProvenance: Provenance,
  }),
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
      generation: S.Int,
      purpose: S.String,
      versions: RunVersions,
      allowance: S.Int,
      historyBound: S.Int,
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
