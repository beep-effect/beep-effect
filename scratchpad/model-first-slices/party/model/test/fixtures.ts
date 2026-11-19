import { type Capability, CapabilityGrant, ResourceScope } from "@proto/kernel/Capability";
import { DelegationId, GrantId, type OrgId, type PrincipalId, type RunId } from "@proto/kernel/Ids";
import { type Hop, Invocation, Root } from "@proto/kernel/Invocation";
import type { EvidenceSignal } from "@proto/party-contract/Evidence";
import * as A from "@beep/utils/Array";
import { dual } from "effect/Function";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import type { Cast } from "./Cast.ts";

const isInvocation = S.is(Invocation);

// Test builders stand where the authority context's boundary stands in a host:
// they build root invocations directly, which no package source may do. Every
// id they take is a cast member; every id they make is derived from one.

/** The id of the grant a holder, a person or a run, has for a capability. */
export const grantOf: {
  (capability: Capability): (holder: PrincipalId | RunId) => GrantId;
  (holder: PrincipalId | RunId, capability: Capability): GrantId;
} = dual(2, (holder: PrincipalId | RunId, capability: Capability) => GrantId.make(`${holder}~${capability.id}`));

/** The delegation a review run acts under. */
export const delegationOf = (run: RunId) => DelegationId.make(`dlg:${run}`);

/** A holder's grant on a whole org, every operation, no expiry. */
export const onOrg: {
  (capability: Capability, org: OrgId): (holder: PrincipalId | RunId) => CapabilityGrant;
  (holder: PrincipalId | RunId, capability: Capability, org: OrgId): CapabilityGrant;
} = dual(3, (holder: PrincipalId | RunId, capability: Capability, org: OrgId) =>
  CapabilityGrant.make({
    grant: grantOf(holder, capability),
    delegation: O.none(),
    capability: capability.id,
    operations: O.none(),
    resource: ResourceScope.cases.Org.make({ org }),
    expires: O.none(),
  }),
);

/** A human-rooted invocation as the boundary would build it: empty chain. */
export const human: {
  (grants: ReadonlyArray<CapabilityGrant>): (principal: PrincipalId) => Invocation;
  (principal: PrincipalId, grants: ReadonlyArray<CapabilityGrant>): Invocation;
} = dual(2, (principal: PrincipalId, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Human.make({ principal }),
    onBehalfOf: principal,
    grants: A.fromIterable(grants),
    chain: [],
  }),
);

/** A person acting with org-wide grants for these capabilities. */
export const member: {
  (org: OrgId, capabilities: ReadonlyArray<Capability>): (principal: PrincipalId) => Invocation;
  (principal: PrincipalId, org: OrgId, capabilities: ReadonlyArray<Capability>): Invocation;
} = dual(3, (principal: PrincipalId, org: OrgId, capabilities: ReadonlyArray<Capability>) =>
  human(principal, A.map(capabilities, (capability) => onOrg(principal, capability, org))),
);

/** The cast's two signals, from two sources. */
export const twoSources = (cast: Cast): ReadonlyArray<EvidenceSignal> => cast.signals;
/** Two signals, one source: one source for the gate. */
export const oneSource = ({ signals: [first, second] }: Cast): ReadonlyArray<EvidenceSignal> => [
  first,
  { ...second, source: first.source },
];

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
  (accountable: PrincipalId, grants: ReadonlyArray<CapabilityGrant>): (run: RunId) => Invocation;
  (run: RunId, accountable: PrincipalId, grants: ReadonlyArray<CapabilityGrant>): Invocation;
} = dual(3, (run: RunId, accountable: PrincipalId, grants: ReadonlyArray<CapabilityGrant>) =>
  Invocation.make({
    root: Root.cases.Agent.make({ run, accountable }),
    onBehalfOf: accountable,
    grants: A.fromIterable(grants),
    chain: [],
  }),
);

/** A grant on one record, for the named operations: the holder's own, or delegated to a run. */
export const onRecord = ({
  grant,
  delegation = O.none(),
  capability,
  org,
  record,
  operations,
}: {
  readonly grant: GrantId;
  readonly delegation?: O.Option<DelegationId>;
  readonly capability: Capability;
  readonly org: OrgId;
  readonly record: string;
  readonly operations: ReadonlyArray<string>;
}) =>
  CapabilityGrant.make({
    grant,
    delegation,
    capability: capability.id,
    operations: O.some(A.fromIterable(operations)),
    resource: ResourceScope.cases.Record.make({ org, record }),
    expires: O.none(),
  });
