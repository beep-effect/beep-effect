import { Story } from "@alchemy.run/domain/Story";
import { CapabilityGrant, type GrantTerms, ResourceScope } from "@proto/kernel/Capability";
import { CapabilityId, DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { byProcess, Cause, extend, GrantRef, Invocation, type Provenance, provenanceOf, Root } from "@proto/kernel/Invocation";
import { RunActivated } from "@proto/runs-contract/Run/ActivateRun.command";
import { RunRequested } from "@proto/runs-contract/Run/RequestRun.command";
import { ReservationId } from "@proto/runs-contract/Run/Reservation.id";
import { RunVersions } from "@proto/runs-contract/Run/RunVersions";
import { SessionId } from "@proto/runs-contract/Run/Session.id";
import { AgentRun } from "@proto/runs-model/Run/AgentRun.aggregate";

// Fixtures build invocations, as the authority context does in a host.
export const acme = OrgId.make("org_acme");
export const session = SessionId.make("session_1");
export const versions = RunVersions.make({ prompt: "p1", model: "m1", tools: "t1" });
export const requester = Invocation.make({
  root: Root.cases.Human.make({ principal: PrincipalId.make("p_req") }),
  onBehalfOf: PrincipalId.make("p_req"),
  grants: [
    CapabilityGrant.make({
      grant: GrantId.make("g_req"),
      delegation: null,
      capability: CapabilityId.make("party.propose"),
      operations: null,
      resource: ResourceScope.cases.Org.make({ org: acme }),
      expires: null,
    }),
  ],
  chain: [],
});
export const terms = (operations: ReadonlyArray<string> | null): GrantTerms => ({
  capability: CapabilityId.make("party.propose"),
  operations,
  resource: ResourceScope.cases.Org.make({ org: acme }),
  expires: null,
});
export const parentTerms = terms(["ProposeDisposition", "AcceptClaim"]);
export const source = GrantRef.make({ grant: GrantId.make("g_req"), delegation: null });

/** A run's own invocation: an agent root naming its accountable human, its delegation its only grant. */
export const asRun = (run: string, delegation: string, granted: GrantTerms = parentTerms) =>
  Invocation.make({
    root: Root.cases.Agent.make({ run: RunId.make(run), accountable: PrincipalId.make("p_req") }),
    onBehalfOf: PrincipalId.make("p_req"),
    grants: [CapabilityGrant.make({ grant: GrantId.make("g_req"), delegation: DelegationId.make(delegation), ...granted })],
    chain: [],
  });

export const run1 = AgentRun.ref("run_1");
export const reservation = (id: string) => ReservationId.make(id);
export const hopOn = (policy: string, stream: string, seq: number, event: string) =>
  byProcess(policy, Cause.cases.Event.make({ stream, seq, event }));

/** A run requested by p_req and granted, with this budget and history bound. */
export const active = (allowance: number, historyBound = 20): ReadonlyArray<ReturnType<typeof Story.given>> => [
  Story.given(
    run1,
    new RunRequested({
      session,
      purpose: "review",
      versions,
      allowance,
      historyBound,
      source,
      terms: parentTerms,
      requester: PrincipalId.make("p_req"),
      provenance: provenanceOf(requester),
    }),
    new RunActivated({
      session,
      delegation: DelegationId.make("dlg:run_1"),
      accountable: PrincipalId.make("p_req"),
      runProvenance: provenanceOf(asRun("run_1", "dlg:run_1")),
      provenance: extend(provenanceOf(requester), hopOn("GrantOnRequest", "AgentRun/run_1", 1, "RunRequested")),
    }),
  ),
];

export const self = (run: string, delegation: string, granted?: GrantTerms): Provenance =>
  provenanceOf(asRun(run, delegation, granted));

