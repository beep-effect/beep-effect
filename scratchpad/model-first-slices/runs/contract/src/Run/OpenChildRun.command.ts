import * as Domain from "@alchemy.run/domain";
import { GrantTerms } from "@proto/kernel/Capability";
import { DelegationId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { GrantRef, Provenance } from "@proto/kernel/Invocation";
import * as S from "effect/Schema";
import { Count } from "@proto/kernel/Measure";
import { HistoryBound } from "./HistoryBound.ts";
import { RunEvent } from "./RunEvent.ts";
import { RunVersions } from "./RunVersions.ts";
import { SessionId } from "./Session.id.ts";

/**
 * The fact: a child run started, with its share of its parent's budget and
 * its own narrowed delegation.
 *
 * @category events
 * @since 0.0.0
 */
export class ChildRunOpened extends Domain.Event(
  "ChildRunOpened",
  RunEvent.fields({
    parent: RunId,
    purpose: S.String,
    versions: RunVersions,
    allowance: Count,
    historyBound: HistoryBound,
    source: GrantRef,
    terms: GrantTerms,
    delegation: DelegationId,
    accountable: PrincipalId,
    requester: PrincipalId,
    runProvenance: Provenance,
  }),
  { description: "A child run started with its share of its parent's budget and its own narrowed delegation." },
) {}

/**
 * Open a child run its parent requested and the authority context granted.
 * Sent only by the runs model's own policy; no Api serves it.
 *
 * @category commands
 * @since 0.0.0
 */
export class OpenChildRun extends Domain.Command(
  "OpenChildRun",
  {
    target: RunId,
    input: {
      session: SessionId,
      parent: RunId,
      purpose: S.String,
      versions: RunVersions,
      allowance: Count,
      historyBound: HistoryBound,
      source: GrantRef,
      terms: GrantTerms,
      delegation: DelegationId,
      accountable: PrincipalId,
      requester: PrincipalId,
      runProvenance: Provenance,
      provenance: Provenance,
    },
    events: [ChildRunOpened],
  },
  { description: "Open a child run its parent requested and the authority context granted." },
) {}
