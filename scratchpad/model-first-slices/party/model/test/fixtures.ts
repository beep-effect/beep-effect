import { type Capability, CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { type Hop, Invocation, Root } from "@proto/kernel/Invocation";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import * as A from "effect/Array";

// Test fixtures stand where the authority context's boundary stands in a host:
// they build root invocations directly, which no package source may do.

export const acme = OrgId.make("org_acme");
export const globex = OrgId.make("org_globex");

/** A grant on a whole org, every operation, no expiry. */
export const onOrg = (id: string, capability: Capability, org: OrgId) =>
  CapabilityGrant.make({
    grant: GrantId.make(id),
    delegation: null,
    capability: capability.id,
    operations: null,
    resource: ResourceScope.cases.Org.make({ org }),
    expires: null,
  });

/** A human-rooted invocation as the boundary would build it: empty chain. */
export const human = (principal: string, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: PrincipalId.make(principal) }),
    onBehalfOf: PrincipalId.make(principal),
    grants: A.fromIterable(grants),
    chain: [],
  });

export const signalFrom = (source: string) => EvidenceSignal.make({ source, excerpt: `${source} says so` });
export const twoSources = [signalFrom("mailbox:intake"), signalFrom("crm")];
// Two signals, one source: one source for the gate.
export const oneSource = [signalFrom("mailbox:intake"), signalFrom("mailbox:intake")];

/** What the authority context returns for a hop: the same root, these live grants, the chain plus the hop. */
export const readmitted = (from: Invocation, hop: Hop, grants: ReadonlyArray<CapabilityGrant> = from.grants) =>
  Invocation.make({ ...from, grants: A.fromIterable(grants), chain: A.append(from.chain, hop) });

/** An agent-rooted invocation: a run, its accountable human, and its delegated grants. */
export const agentRun = (run: string, accountable: string, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Agent.make({ run: RunId.make(run), accountable: PrincipalId.make(accountable) }),
    onBehalfOf: PrincipalId.make(accountable),
    grants: A.fromIterable(grants),
    chain: [],
  });

/** A delegated grant on one record, for the named operations. */
export const delegated = (grant: string, delegation: string, capability: Capability, org: OrgId, record: string, operations: ReadonlyArray<string>) =>
  CapabilityGrant.make({
    grant: GrantId.make(grant),
    delegation: DelegationId.make(delegation),
    capability: capability.id,
    operations: A.fromIterable(operations),
    resource: ResourceScope.cases.Record.make({ org, record }),
    expires: null,
  });
