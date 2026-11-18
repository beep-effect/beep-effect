import { type Capability, CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { DelegationId, GrantId, OrgId, PrincipalId, RunId } from "@proto/kernel/Ids";
import { type Hop, Invocation, Root } from "@proto/kernel/Invocation";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isInvocation = S.is(Invocation);

// Test fixtures stand where the authority context's boundary stands in a host:
// they build root invocations directly, which no package source may do.

export const acme = OrgId.make("org_acme");
export const globex = OrgId.make("org_globex");

/** A grant on a whole org, every operation, no expiry. */
export const onOrg: {
  (capability: Capability, org: OrgId): (id: string) => CapabilityGrant;
  (id: string, capability: Capability, org: OrgId): CapabilityGrant;
} = dual(3, (id: string, capability: Capability, org: OrgId) =>
  CapabilityGrant.make({
    grant: GrantId.make(id),
    delegation: O.none(),
    capability: capability.id,
    operations: O.none(),
    resource: ResourceScope.cases.Org.make({ org }),
    expires: O.none(),
  }),
);

/** A human-rooted invocation as the boundary would build it: empty chain. */
export const human: {
  (grants: ReadonlyArray<CapabilityGrant>): (principal: string) => Invocation;
  (principal: string, grants: ReadonlyArray<CapabilityGrant>): Invocation;
} = dual(2, (principal: string, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Human.make({ principal: PrincipalId.make(principal) }),
    onBehalfOf: PrincipalId.make(principal),
    grants: A.fromIterable(grants),
    chain: [],
  }),
);

export const signalFrom = (source: string) => EvidenceSignal.make({ source, quote: `${source} says so` });
export const twoSources = [signalFrom("mailbox:intake"), signalFrom("crm")];
// Two signals, one source: one source for the gate.
export const oneSource = [signalFrom("mailbox:intake"), signalFrom("mailbox:intake")];

/** What the authority context returns for a hop: the same root, these live grants, the chain plus the hop. */
export const readmitted: {
  (hop: Hop, grants?: ReadonlyArray<CapabilityGrant>): (from: Invocation) => Invocation;
  (from: Invocation, hop: Hop, grants?: ReadonlyArray<CapabilityGrant>): Invocation;
} = dual(
  (args: IArguments) => isInvocation(args[0]),
  (from: Invocation, hop: Hop, grants: ReadonlyArray<CapabilityGrant> = from.grants) =>
    Invocation.make({ ...from, grants: A.fromIterable(grants), chain: A.append(from.chain, hop) }),
);

/** An agent-rooted invocation: a run, its accountable human, and its delegated grants. */
export const agentRun: {
  (accountable: string, grants: ReadonlyArray<CapabilityGrant>): (run: string) => Invocation;
  (run: string, accountable: string, grants: ReadonlyArray<CapabilityGrant>): Invocation;
} = dual(3, (run: string, accountable: string, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Agent.make({ run: RunId.make(run), accountable: PrincipalId.make(accountable) }),
    onBehalfOf: PrincipalId.make(accountable),
    grants: A.fromIterable(grants),
    chain: [],
  }),
);

/** A delegated grant on one record, for the named operations. */
export const delegated = ({
  grant,
  delegation,
  capability,
  org,
  record,
  operations,
}: {
  readonly grant: string;
  readonly delegation: string;
  readonly capability: Capability;
  readonly org: OrgId;
  readonly record: string;
  readonly operations: ReadonlyArray<string>;
}) =>
  CapabilityGrant.make({
    grant: GrantId.make(grant),
    delegation: O.some(DelegationId.make(delegation)),
    capability: capability.id,
    operations: O.some(A.fromIterable(operations)),
    resource: ResourceScope.cases.Record.make({ org, record }),
    expires: O.none(),
  });
