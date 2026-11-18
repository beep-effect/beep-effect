import { Story } from "@alchemy.run/domain/Story";
import { CapabilityGrant, type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { DelegationId, type RunId } from "@proto/kernel/Ids";
import { byProcess, Cause, extend, GrantRef, Invocation, type Provenance, provenanceOf, Root } from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";
import { GrantOnRequest } from "@proto/runs-model/Run/GrantOnRequest.policy";
import * as O from "@beep/utils/Option";
import type { Cast } from "./Cast.ts";

// Builders over a generated cast: they make invocations as the authority context does in a
// host, and the ids the runs model derives, from the cast's members.

/** The delegation the authority context opens for a run, as the runs model asks for it. */
export const delegationOf = (run: RunId): DelegationId => DelegationId.make(`dlg:${run}`);

/** The stream a run's events are recorded on, as a hop's cause names it. */
export const streamOf = (run: RunId): string => `AgentRun/${run}`;

/** The cast's grant terms on its org, with these operations (none for every one). */
export const termsOf = (cast: Cast, operations: O.Option<ReadonlyArray<string>>): GrantTerms => ({
  capability: cast.capability,
  operations,
  resource: ResourceScope.cases.Org.make({ org: cast.org }),
  expires: O.none(),
});

/** What a run is granted: both of the cast's operations. */
export const parentTerms = (cast: Cast): GrantTerms => termsOf(cast, O.some([cast.operations.kept, cast.operations.dropped]));

/** What a child is granted: the operation its parent keeps for it, a narrowing of the parent's. */
export const childTerms = (cast: Cast): GrantTerms => termsOf(cast, O.some([cast.operations.kept]));

/** The requester's grant, as a requested run names its source. */
export const sourceOf = (cast: Cast): GrantRef => GrantRef.make({ grant: cast.grant, delegation: O.none() });

/** The requester's grant as it reaches a run's child or continuation: through the run's delegation. */
export const delegatedSource = (cast: Cast): GrantRef =>
  GrantRef.make({ grant: cast.grant, delegation: O.some(delegationOf(cast.runs.run)) });

/** The requester at the boundary: a human root holding the cast's grant on its org, for every operation. */
export const requesterOf = (cast: Cast): Invocation =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: cast.principals.requester }),
    onBehalfOf: cast.principals.requester,
    grants: [CapabilityGrant.make({ grant: cast.grant, delegation: O.none(), ...termsOf(cast, O.none()) })],
    chain: [],
  });

/** The stranger at the boundary: a human root with no grants. */
export const strangerOf = (cast: Cast): Invocation =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: cast.principals.stranger }),
    onBehalfOf: cast.principals.stranger,
    grants: [],
    chain: [],
  });

/** A run's own invocation: an agent root naming the requester as accountable, its delegation its only grant. */
export const asRun = (cast: Cast, run: RunId, granted: GrantTerms = parentTerms(cast)): Invocation =>
  Invocation.make({
    root: Root.cases.Agent.make({ run, accountable: cast.principals.requester }),
    onBehalfOf: cast.principals.requester,
    grants: [CapabilityGrant.make({ grant: cast.grant, delegation: O.some(delegationOf(run)), ...granted })],
    chain: [],
  });

/** The provenance a run reports under. */
export const self = (cast: Cast, run: RunId, granted?: GrantTerms): Provenance => provenanceOf(asRun(cast, run, granted));

/** A policy's hop, reacting to the event at `seq` on a run's stream. */
export const hopOn = (policy: string, run: RunId, seq: number, event: { readonly tag: string }) =>
  byProcess(policy, Cause.cases.Event.make({ stream: streamOf(run), seq, event: event.tag }));

/** The cast's run, addressed. */
export const runOf = (cast: Cast) => AgentRun.ref(cast.runs.run);

/** The requester asked for the cast's run, with this budget and history bound. */
export const requested = (cast: Cast, allowance: number, historyBound: number = cast.bound): RunRequested =>
  RunRequested.make({
    session: cast.session,
    purpose: cast.purposes.run,
    versions: cast.versions,
    allowance,
    historyBound,
    source: sourceOf(cast),
    terms: parentTerms(cast),
    requester: cast.principals.requester,
    provenance: provenanceOf(requesterOf(cast)),
  });

/** The cast's run requested by its requester and granted, with this budget and history bound (the cast's by default). */
export const active = (cast: Cast, allowance: number, historyBound: number = cast.bound): ReadonlyArray<ReturnType<typeof Story.given>> => [
  Story.given(
    runOf(cast),
    requested(cast, allowance, historyBound),
    RunActivated.make({
      session: cast.session,
      delegation: delegationOf(cast.runs.run),
      accountable: cast.principals.requester,
      runProvenance: self(cast, cast.runs.run),
      provenance: extend(provenanceOf(requesterOf(cast)), hopOn(GrantOnRequest.policyName, cast.runs.run, 1, RunRequested)),
    }),
  ),
];
